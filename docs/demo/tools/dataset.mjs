import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

export const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
export const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
export function configuration(clone, state) {
  const setup = readJson(path.join(state, 'setup.json'))
  return { clone: path.resolve(clone), state: path.resolve(state), setup, api: `http://127.0.0.1:${setup.apiPort}`, web: `http://127.0.0.1:${setup.webPort}` }
}
export function micros(value) {
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,7}))?(?:Z|\+00:00)$/.exec(value)
  assert(m, 'Expected explicit UTC from the API/CLI/database')
  return BigInt(Date.parse(`${m[1]}Z`)) * 1000n + BigInt((m[2] ?? '').padEnd(6, '0').slice(0, 6))
}
export function instant(ticks, canonical = false) {
  return new Date(Number(ticks / 1_000_000n) * 1000).toISOString().slice(0, 19) + '.' +
    (ticks % 1_000_000n).toString().padStart(6, '0') + (canonical ? '0' : '') + '+00:00'
}
export function canonical(rows) {
  return rows.map(row => `${instant(micros(row.measuredAt), true)},${row.solarPowerW.toFixed(0)},${row.consumptionPowerW.toFixed(0)},${row.batteryStateOfChargePercent.toFixed(2)}`).join('\n') + '\n'
}
export const digest = rows => createHash('sha256').update(canonical(rows), 'utf8').digest('hex')
export function sql(cfg, query) {
  // Constant read-only SQL, scoped project and database; no credentials in arguments/output.
  return execFileSync('docker', ['compose', '-p', cfg.setup.project, '--env-file', path.join(cfg.clone, '.env'),
    '-f', path.join(cfg.clone, 'docker-compose.yml'), 'exec', '-T', 'postgres', 'psql', '-U', 'solarwatch', '-d', 'solarwatch', '-At', '-v', 'ON_ERROR_STOP=1'],
  { input: query + '\n', encoding: 'utf8', timeout: 30_000 }).trim()
}
export function databaseRows(cfg) {
  return JSON.parse(sql(cfg, `SELECT COALESCE(json_agg(json_build_object(
    'installationId', "InstallationId", 'measuredAt', to_char("MeasuredAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'solarPowerW', "SolarPowerW", 'consumptionPowerW', "ConsumptionPowerW", 'batteryStateOfChargePercent', "BatteryStateOfChargePercent")
    ORDER BY "MeasuredAt"), '[]'::json) FROM readings WHERE "InstallationId"='residential-demo';`))
}
export async function get(cfg, endpoint) {
  const response = await fetch(cfg.api + endpoint, { signal: AbortSignal.timeout(15_000) })
  assert.equal(response.status, 200, `GET ${endpoint}`)
  return response.json()
}
export async function empty(cfg) {
  const latest = await get(cfg, '/api/readings/latest')
  const history = await get(cfg, '/api/readings/history')
  assert.equal(latest.reading, null); assert.deepEqual(history.readings, []); assert.equal(databaseRows(cfg).length, 0)
  const result = { latest: { status: 200, body: latest }, history: { status: 200, body: history }, sqlRows: 0 }
  writeJson(path.join(cfg.state, 'empty.json'), result)
  return result
}
export async function verify(cfg, output, reference) {
  const rows = [...output.matchAll(/^Accepted (\S+): solar=([\d.]+) W, consumption=([\d.]+) W, battery=([\d.]+)%/gm)].map(m => ({
    measuredAt: m[1], solarPowerW: Number(m[2]), consumptionPowerW: Number(m[3]), batteryStateOfChargePercent: Number(m[4]) }))
  assert.equal(rows.length, 1441)
  const end = micros(reference)
  for (const [i, row] of rows.entries()) {
    assert.equal(micros(row.measuredAt), end - 86_400_000_000n + BigInt(i) * 60_000_000n)
    assert(Number.isInteger(row.solarPowerW) && Number.isInteger(row.consumptionPowerW))
  }
  const stored = databaseRows(cfg)
  assert.equal(stored.length, 1441)
  assert(stored.every(row => row.installationId === 'residential-demo'))
  assert.equal(canonical(stored), canonical(rows), 'All persisted UTC keys and values equal all CLI acknowledgments')
  const latest = await get(cfg, '/api/readings/latest')
  assert.equal(canonical([latest.reading]), canonical([stored.at(-1)]))
  const history = await get(cfg, '/api/readings/history')
  const expected = stored.filter(row => micros(row.measuredAt) >= micros(history.from) && micros(row.measuredAt) <= micros(history.to))
  assert.equal(micros(history.to), micros(history.asOf))
  assert.equal(micros(history.to) - micros(history.from), 86_400_000_000n)
  assert.equal(canonical(history.readings), canonical(expected))
  const deps = readJson(path.join(cfg.clone, 'simulator/SolarWatch.Simulator/bin/Release/net10.0/SolarWatch.Simulator.deps.json'))
  const assembly = fs.readFileSync(path.join(cfg.clone, 'simulator/SolarWatch.Simulator/obj/Release/net10.0/SolarWatch.Simulator.AssemblyInfo.cs'), 'utf8')
  const result = { sourceCommit: cfg.setup.commit, profile: 'residential-v1', seed: 42, originalReference: reference,
    normalizedReference: instant(end), simulatorLibrary: Object.keys(deps.libraries).find(k => k.startsWith('SolarWatch.Simulator/')),
    simulatorInformationalVersion: /AssemblyInformationalVersionAttribute\("([^"]+)"\)/.exec(assembly)?.[1],
    postgresVersion: sql(cfg, 'SHOW server_version;'), persistedCount: stored.length,
    first: stored[0], last: stored.at(-1), canonicalFormat: 'UTF-8; no BOM/header; LF including final LF; measuredAt O (7 fraction digits),solar F0,home F0,battery F2; invariant culture',
    acknowledgmentsSha256: digest(rows), postgresSha256: digest(stored),
    latest, history: { asOf: history.asOf, from: history.from, to: history.to, count: history.readings.length, matchesSqlSubset: true },
    summary: output.split(/\r?\n/).find(line => line.startsWith('Summary')) }
  assert.match(result.summary, /accepted=1441, rejected=0, conflicts=0, errors=0, uncertain=0, unattempted=0/)
  writeJson(path.join(cfg.state, 'dataset.json'), result)
  return { result, stored }
}
