import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseHistory, prepareHistory, utcMicroseconds, localHistoryTime } from '../../src/history.ts'
import type { HistoryResponse } from '../../src/history.ts'
import { utcOffsetAt } from '../../src/measurementDisplay.ts'

const from = '2026-10-29T12:00:00.123456Z'
const to = '2026-10-30T12:00:00.123456Z'
function reading(measuredAt: string, solarPowerW = 0) {
  return { installationId: 'residential-demo' as const, measuredAt, solarPowerW, consumptionPowerW: 800, batteryStateOfChargePercent: 65 }
}
function history(readings: HistoryResponse['readings'] = []): HistoryResponse { return { asOf: to, from, to, readings } }

test('history validates inclusive server bounds while preserving original UTC strings and sub-millisecond readings', () => {
  const input = history([reading(from), reading('2026-10-29T12:00:00.123457+00:00'), reading(to)])
  assert.equal(parseHistory(input), input)
  assert.equal(input.readings.length, 3)
  const model = prepareHistory(input)
  assert.equal(model.duration, 86_400_000)
  assert.equal(model.points[1].x, 0.001)
  assert.equal(model.points[0].solar, 0)
  assert.equal(model.points.at(-1)?.x, model.duration)
  assert.equal(model.points[1].reading?.measuredAt, '2026-10-29T12:00:00.123457+00:00')
})

test('invalid, non-UTC, sub-microsecond and rolled-over calendar timestamps are rejected', () => {
  for (const value of [null, 42, '', '2026-02-30T12:00:00Z', '2026-10-29T12:00:00',
    '2026-10-29T12:00:00-04:00', '2026-10-29T12:00:00.1234567Z', '2026-10-29T25:00:00Z']) {
    assert.throws(() => utcMicroseconds(value))
  }
  assert.equal(utcMicroseconds(from), utcMicroseconds(from.replace('Z', '+00:00')))
  assert.equal(utcMicroseconds('1969-12-31T23:59:59.999999Z'), -1n)
})

test('malformed history metadata and any inconsistent window are errors, never empty successes', () => {
  for (const value of [null, [], {}, { ...history(), readings: null }, { ...history(), readings: {} },
    { ...history(), asOf: from }, { ...history(), from: to },
    { ...history(), from: '2026-10-29T12:00:00.123457Z' }, { ...history(), to: 'invalid' }]) {
    assert.throws(() => parseHistory(value))
  }
})

test('history rejects invalid metrics, order, duplicates and samples one microsecond outside the window', () => {
  const valid = reading(from)
  for (const rows of [
    [null], [{ ...valid, installationId: 'other' }], [{ ...valid, solarPowerW: -1 }],
    [{ ...valid, solarPowerW: Number.NaN }], [{ ...valid, consumptionPowerW: Infinity }],
    [{ ...valid, batteryStateOfChargePercent: 101 }], [{ ...valid, batteryStateOfChargePercent: '65' }],
    [reading('2026-10-29T12:00:00.123455Z')], [reading('2026-10-30T12:00:00.123457Z')],
    [reading(to), valid], [valid, valid], [valid, reading(from.replace('Z', '+00:00'))],
  ]) assert.throws(() => parseHistory({ ...history(), readings: rows }))
})

test('time geometry reflects elapsed time rather than observation index', () => {
  const model = prepareHistory(history([reading(from), reading('2026-10-29T12:01:00.123456Z'), reading('2026-10-29T12:04:00.123456Z')]))
  const positions = model.points.map(point => point.x)
  assert.deepEqual(positions, [0, 60_000, 240_000])
  assert.equal((positions[2] - positions[1]) / (positions[1] - positions[0]), 3)
})

test('exactly 300 seconds stays connected, while 300 seconds plus one microsecond breaks strokes and fills', () => {
  const exact = prepareHistory(history([reading(from), reading('2026-10-29T12:05:00.123456Z')]))
  assert.equal(exact.points.length, 2)
  assert.ok(exact.points.every(point => point.reading))
  const beyond = prepareHistory(history([reading(from), reading('2026-10-29T12:05:00.123457Z')]))
  assert.equal(beyond.points.length, 3)
  assert.equal(beyond.points[1].reading, null)
  assert.equal(beyond.points[1].solar, null)
  assert.equal(beyond.points[1].consumption, null)
  assert.equal(beyond.points[1].battery, null)
  assert.deepEqual(beyond.gaps[0], { from: 0, to: 300_000.001 })
  assert.ok(beyond.points[0].isolated && beyond.points[2].isolated)
})

test('uncovered edges and isolated samples do not produce extrapolated or zero observations', () => {
  const row = reading('2026-10-29T18:00:00.123456Z')
  const model = prepareHistory(history([row]))
  assert.deepEqual(model.gaps, [{ from: 0, to: 21_600_000 }, { from: 21_600_000, to: 86_400_000 }])
  assert.equal(model.points.length, 1)
  assert.equal(model.points[0].reading, row)
  assert.equal(model.points[0].isolated, true)
  assert.equal(model.points[0].solar, 0)
})

test('empty and all-zero history remain distinct and power domains never clip real values', () => {
  const empty = prepareHistory(parseHistory(history()))
  assert.deepEqual(empty.points, [])
  const zeros = prepareHistory(parseHistory(history([{ ...reading(from), consumptionPowerW: 0, batteryStateOfChargePercent: 0 }])))
  assert.equal(zeros.points.length, 1)
  assert.equal(zeros.points[0].battery, 0)
  assert.equal(zeros.powerMax, 1) // A usable axis, not a fabricated observation.
  assert.equal(prepareHistory(history([reading(from, 99999)])).powerMax, 99999)
})

test('more than 1441 off-cadence samples are not downsampled or truncated', () => {
  const rows = Array.from({ length: 1442 }, (_, index) => reading(new Date(Date.parse(from) + index * 1000).toISOString(), index))
  // Start one second inside the window; the API's original microseconds remain authoritative.
  rows.shift()
  rows.push(reading(to, 1442))
  const input = parseHistory(history(rows))
  assert.equal(input.readings.length, 1442)
  assert.equal(prepareHistory(input).points.filter(point => point.reading).length, 1442)
})

test('local labels keep original fractional precision and distinguish repeated local hours by UTC offset', () => {
  assert.match(localHistoryTime(from, 'America/Havana'), /08:00:00\.123456$/)
  const first = '2026-11-01T05:30:00Z'
  const second = '2026-11-01T06:30:00Z'
  assert.equal(localHistoryTime(first, 'America/New_York'), localHistoryTime(second, 'America/New_York'))
  assert.equal(utcOffsetAt(first, 'America/New_York'), 'UTC-04:00')
  assert.equal(utcOffsetAt(second, 'America/New_York'), 'UTC-05:00')
})
