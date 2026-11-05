// Issue #43 evidence helper; not an added product/regression test or screenshot generator.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { configuration, empty, get, verify, canonical, micros, writeJson } from '../../demo/tools/dataset.mjs'

const [clone, state] = process.argv.slice(2)
assert(clone && state, 'Usage: node local-mvp-smoke.mjs <new-clone> <new-state>')
const cfg = configuration(clone, state)
const { chromium, expect } = createRequire(path.join(cfg.clone, 'frontend/package.json'))('@playwright/test')
await empty(cfg) // Refuse populated data; never clear or overwrite it.
const browser = await chromium.launch({ channel: 'chromium' })
const record = { sourceCommit: cfg.setup.commit, browser: browser.version(), viewport: { width: 1440, height: 900 },
  locale: 'en-US', timezone: 'America/Havana', apiMocks: false, clockOverrides: false, newScreenshots: 0 }
try {
  const page = await browser.newPage({ viewport: record.viewport, locale: record.locale, timezoneId: record.timezone })
  const errors = [], calls = { latest: 0, history: 0 }
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { for (const name of Object.keys(calls)) if (request.url().endsWith(`/api/readings/${name}`)) calls[name]++ })
  await page.goto(cfg.web, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'No measurements yet' })).toBeVisible()
  const reference = (await get(cfg, '/api/readings/latest')).asOf
  const args = ['simulator/SolarWatch.Simulator/bin/Release/net10.0/SolarWatch.Simulator.dll',
    '--history-24h', '--profile', 'residential-v1', '--seed', '42', '--end-at', reference, '--api-url', cfg.api]
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(ConnectionStrings__|SOLARWATCH_(TEST|E2E)_CONNECTION|POSTGRES_|PGPASSWORD)/i.test(key)))
  const cli = await promisify(execFile)('dotnet', args, { cwd: cfg.clone, env, encoding: 'utf8', timeout: 90_000, maxBuffer: 1024 * 1024 })
  assert.equal(cli.stderr, '')
  fs.writeFileSync(path.join(cfg.state, 'simulator.log'), cli.stdout)
  const { result, stored } = await verify(cfg, cli.stdout, reference)
  record.simulatorCommand = ['dotnet', ...args]; record.dataset = result
  await expect(page.getByRole('heading', { name: 'No measurements yet' })).toBeVisible()
  assert.deepEqual(calls, { latest: 1, history: 1 }, 'No polling discovers data before manual Refresh')
  const received = page.waitForResponse(response => response.url().endsWith('/api/readings/history'))
  await page.getByRole('button', { name: 'Refresh readings', exact: true }).click()
  const history = await (await received).json()
  const subset = stored.filter(row => micros(row.measuredAt) >= micros(history.from) && micros(row.measuredAt) <= micros(history.to))
  assert.equal(canonical(history.readings), canonical(subset))
  const latest = result.latest.reading
  for (const [id, value] of [['solar-power', latest.solarPowerW], ['consumption-power', latest.consumptionPowerW]])
    await expect(page.getByTestId(id)).toHaveText(`${value.toLocaleString('en-US')} W`)
  await expect(page.getByTestId('battery-charge')).toHaveText(`${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(latest.batteryStateOfChargePercent)}%`)
  await expect(page.locator(`time[datetime="${latest.measuredAt}"]`).first()).toBeVisible()
  await expect(page.locator('.simulated:visible')).toHaveText('Simulated data')
  const checked = await page.getByTestId('checked-at').getAttribute('datetime')
  const fresh = micros(checked) - micros(latest.measuredAt) <= 300_000_000n
  await expect(page.getByText(fresh ? 'Fresh at last check' : 'Stale reading', { exact: true })).toBeVisible()
  for (const selector of ['.solar-series .recharts-area-curve', '.consumption-series .recharts-line-curve', '.battery-series .recharts-area-curve'])
    await expect(page.locator(selector)).toBeVisible()
  await page.getByRole('link', { name: 'History', exact: true }).click()
  await expect(page.getByTestId('history-selected-time')).toHaveAttribute('datetime', latest.measuredAt)
  await page.getByTestId('power-plot').focus(); await page.keyboard.press('End'); await page.keyboard.press('ArrowLeft')
  const selected = await page.getByTestId('history-selected-time').getAttribute('datetime')
  const row = stored.find(reading => micros(reading.measuredAt) === micros(selected)); assert(row)
  for (const plot of ['power-plot', 'battery-plot']) await expect(page.getByTestId(plot)).toHaveAttribute('data-selection-mode', 'observation')
  for (const [series, field, unit] of [['solar', 'solarPowerW', 'W'], ['consumption', 'consumptionPowerW', 'W'], ['battery', 'batteryStateOfChargePercent', '%']]) {
    await expect(page.getByTestId(`history-selected-${series}`)).toHaveText(`${row[field].toLocaleString('en-US')}${unit}`)
    await expect(page.locator(`.selection-marker[data-series="${series}"]`)).toHaveAttribute('data-measured-at', selected)
  }
  const before = { ...calls }, asOf = await page.getByTestId('history-asof').getAttribute('datetime')
  assert.deepEqual(before, { latest: 2, history: 2 }, 'Navigation/selection reuse the current response')
  await page.getByRole('button', { name: 'Refresh readings', exact: true }).click()
  await expect.poll(async () => await page.getByTestId('history-asof').getAttribute('datetime')).not.toBe(asOf)
  await expect(page.getByTestId('history-selected-time')).toHaveAttribute('datetime', selected)
  assert.deepEqual(calls, { latest: before.latest, history: before.history + 1 })
  await page.getByRole('link', { name: 'Installation', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your installation', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Overview', exact: true }).click()
  assert.deepEqual(errors, [])
  Object.assign(record, { result: 'pass', latestMeasuredAt: latest.measuredAt, overviewAsOf: checked, freshAtCheck: fresh,
    history: { asOf: history.asOf, from: history.from, to: history.to, rows: history.readings.length, matchesSqlSubset: true },
    selectedReading: row, synchronizedMarkers: 3, noPollingOrSelectionFetches: true, historyOnlyRefreshRetainsSelection: true,
    navigation: ['Overview', 'History', 'Installation', 'Overview'], javascriptErrors: errors })
  writeJson(path.join(cfg.state, 'smoke.json'), record)
  console.log('PASS: empty -> 1441 real SQL/CLI/API rows -> manual Refresh, metrics, plots, synchronized selection and navigation; no screenshots or mocks.')
} finally { await browser.close() }
