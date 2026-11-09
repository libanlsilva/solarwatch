import { test } from 'node:test'
import assert from 'node:assert/strict'
import { derivePowerFlow, mergeLatest, mergePoints } from '../../src/liveStore.ts'
import { reconnectDelay } from '../../src/useLiveReadings.ts'
import { parseLatestReading } from '../../src/readings.ts'
import type { Reading } from '../../src/readings.ts'

const at = (second: number, solar = 100, home = 50): Reading => ({
  installationId: 'residential-demo', measuredAt: `2026-11-09T12:00:${String(second).padStart(2, '0')}Z`,
  solarPowerW: solar, consumptionPowerW: home, batteryStateOfChargePercent: 50,
})
const state = (reading: Reading) => ({ snapshot: { asOf: '2026-11-09T12:01:00Z', reading }, pending: false, error: false })

test('an older reading never overwrites a newer one', () => {
  const newer = state(at(30))
  assert.equal(mergeLatest(newer, state(at(10))).snapshot?.reading?.measuredAt, newer.snapshot.reading.measuredAt)
  assert.equal(mergeLatest(state(at(10)), newer).snapshot?.reading?.measuredAt, newer.snapshot.reading.measuredAt)
})

test('mergePoints dedupes by instant, sorts and bounds', () => {
  const merged = mergePoints([at(5), at(1)], [at(3), at(5, 999)])
  assert.deepEqual(merged.map((r) => r.measuredAt.slice(-3, -1)), ['01', '03', '05'])
  assert.equal(merged[2]!.solarPowerW, 999)
  assert.equal(mergePoints([at(1), at(2), at(3)], [at(4)], 2).length, 2)
})

test('derivePowerFlow uses a deadband around zero', () => {
  assert.equal(derivePowerFlow(at(0, 1000, 400)).battery, 'charging')
  assert.equal(derivePowerFlow(at(0, 1000, 400)).batteryW, 600)
  assert.equal(derivePowerFlow(at(0, 100, 400)).battery, 'discharging')
  assert.deepEqual([derivePowerFlow(at(0, 430, 400)).battery, derivePowerFlow(at(0, 430, 400)).batteryW], ['idle', 0])
})

test('reconnectDelay backs off and is capped but never stops', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 50].map(reconnectDelay), [0, 1000, 2000, 4000, 8000, 10000, 10000])
})

test('electrical fields are optional but must be numeric when present', () => {
  const base = { asOf: '2026-11-09T12:01:00Z', reading: { ...at(0) } }
  assert.ok(parseLatestReading(base))
  assert.equal(parseLatestReading({ ...base, reading: { ...at(0), gridVoltageV: 230.4, gridFrequencyHz: null } }).reading?.gridVoltageV, 230.4)
  assert.throws(() => parseLatestReading({ ...base, reading: { ...at(0), gridVoltageV: 'x' } }))
})
