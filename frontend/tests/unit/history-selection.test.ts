import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseHistory, utcMicroseconds, localHistoryTime } from '../../src/history.ts'
import type { HistoryResponse } from '../../src/history.ts'
import { defaultSelection, hitObservation, inspectionTimestamp, minuteAtCoordinate, minuteBounds, reconcileSelection, resolveSelection, stepMinute, stepObservation, utcMinute } from '../../src/historySelection.ts'
import { utcOffsetAt } from '../../src/measurementDisplay.ts'

const from = '2026-10-29T12:34:56.123456Z'
const to = '2026-10-30T12:34:56.123456Z'
const row = (measuredAt: string, value = 0) => ({ installationId: 'residential-demo' as const, measuredAt, solarPowerW: value, consumptionPowerW: value, batteryStateOfChargePercent: value })
const response = (readings: HistoryResponse['readings'] = [row(from), row(to)]): HistoryResponse => parseHistory({ from, to, asOf: to, readings })
const minute = (instant: string) => ({ kind: 'minute' as const, minute: utcMinute(utcMicroseconds(instant)) })
const exact = (measuredAt: string) => ({ kind: 'observation' as const, measuredAt })

test('UTC minutes use mathematical floor including negative instants; inspection labels round-trip microseconds', () => {
  assert.equal(utcMinute(-1n), -1n)
  assert.equal(utcMinute(-60_000_000n), -1n)
  for (const instant of [-60_000_001n, -1001n, -1n, 0n, 1n, utcMicroseconds(to)]) assert.equal(utcMicroseconds(inspectionTimestamp(instant)), instant)
})

test('minute membership is half-open inside inclusive microsecond bounds with partial edges', () => {
  const firstAfter = row('2026-10-29T12:35:00.000000Z')
  const snapshot = response([row(from), firstAfter, row(to)])
  assert.equal(minuteBounds(snapshot).last - minuteBounds(snapshot).first + 1n, 1441n)
  assert.equal(resolveSelection(snapshot, minute(from)).reading, snapshot.readings[0])
  assert.equal(resolveSelection(snapshot, minute(from)).count, 1)
  assert.equal(resolveSelection(snapshot, minute(from)).partial, true)
  assert.equal(resolveSelection(snapshot, minute(firstAfter.measuredAt)).reading, firstAfter)
  assert.equal(resolveSelection(snapshot, minute(to)).reading, snapshot.readings[2])
  assert.equal(resolveSelection(snapshot, minute(to)).partial, true)
  // Defensive membership never admits a row outside the original inclusive window.
  const invalidRows = { ...snapshot, readings: [row('2026-10-29T12:34:56.123455Z'), ...snapshot.readings, row('2026-10-30T12:34:56.123457Z')] }
  assert.equal(resolveSelection(invalidRows, minute(from)).count, 1)
  assert.equal(resolveSelection(invalidRows, minute(to)).count, 1)
})

test('the final minute can be a singleton endpoint and stepping clamps without changing bounds', () => {
  const end = '2026-10-30T12:34:00Z'
  const snapshot = parseHistory({ from: '2026-10-29T12:34:00Z', to: end, asOf: end, readings: [row(end)] })
  assert.equal(resolveSelection(snapshot, minute(end)).reading, snapshot.readings[0])
  assert.equal(resolveSelection(snapshot, minute(end)).partial, true)
  assert.deepEqual(stepMinute(snapshot, minute(end), 1), minute(end))
  assert.deepEqual(stepMinute(snapshot, minute(snapshot.from), -1), minute(snapshot.from))
  assert.equal(snapshot.to, end)
})

test('multiple rows in one millisecond remain exact identities while minute mode chooses maximum measuredAt', () => {
  const a = row('2026-10-29T12:35:00.000001Z', 1)
  const b = row('2026-10-29T12:35:00.000002Z', 2)
  const snapshot = response([a, b])
  assert.equal(resolveSelection(snapshot, minute(a.measuredAt)).reading, b)
  assert.equal(resolveSelection(snapshot, minute(a.measuredAt)).count, 2)
  assert.equal(resolveSelection(snapshot, exact(a.measuredAt)).reading, a)
  assert.equal(resolveSelection(snapshot, exact(a.measuredAt.replace('Z', '+00:00'))).reading, a)
  assert.deepEqual(stepObservation(snapshot, exact(a.measuredAt), 1), exact(b.measuredAt))
})

test('zero measurements remain real, while missing minutes inside connected and broken intervals have no values', () => {
  const snapshot = response([row('2026-10-29T12:35:00Z'), row('2026-10-29T12:40:00Z'), row('2026-10-29T13:00:00Z')])
  assert.equal(resolveSelection(snapshot, minute(snapshot.readings[0].measuredAt)).reading!.solarPowerW, 0)
  for (const at of ['2026-10-29T12:36:00Z', '2026-10-29T12:50:00Z']) {
    const result = resolveSelection(snapshot, minute(at))
    assert.equal(result.reading, null)
    assert.equal(result.count, 0)
    assert.equal(result.anchor, utcMicroseconds(at))
  }
  assert.equal(resolveSelection(snapshot, minute(from)).anchor, utcMicroseconds(from))
})

test('minute stepping discards sample fractions rather than adding a minute to a record; record stepping remains exact', () => {
  const snapshot = response()
  const next = stepMinute(snapshot, exact(from), 1)
  assert.deepEqual(next, minute('2026-10-29T12:35:00Z'))
  assert.equal(resolveSelection(snapshot, next).reading, null)
  assert.deepEqual(stepObservation(snapshot, next, -1), exact(from))
  assert.deepEqual(stepObservation(snapshot, exact(to), 1), exact(to))
})

test('UTC minute stepping crosses repeated/skipped local times with offsets and without ambiguity', () => {
  const autumn = '2026-11-01T05:59:30Z'
  const snapshot = parseHistory({ from: '2026-10-31T06:30:00Z', to: '2026-11-01T06:30:00Z', asOf: '2026-11-01T06:30:00Z', readings: [row(autumn)] })
  const next = stepMinute(snapshot, exact(autumn), 1)
  const anchor = inspectionTimestamp(resolveSelection(snapshot, next).anchor)
  assert.equal(anchor, '2026-11-01T06:00:00.000000Z')
  assert.match(localHistoryTime(autumn, 'America/New_York'), /01:59:30/)
  assert.match(localHistoryTime(anchor, 'America/New_York'), /01:00:00/)
  assert.equal(utcOffsetAt(autumn, 'America/New_York'), 'UTC-04:00')
  assert.equal(utcOffsetAt(anchor, 'America/New_York'), 'UTC-05:00')
  const spring = '2026-03-08T06:59:30Z'
  const springSnapshot = parseHistory({ from: '2026-03-07T07:30:00Z', to: '2026-03-08T07:30:00Z', asOf: '2026-03-08T07:30:00Z', readings: [row(spring)] })
  const after = inspectionTimestamp(resolveSelection(springSnapshot, stepMinute(springSnapshot, exact(spring), 1)).anchor)
  assert.match(localHistoryTime(after, 'America/New_York'), /03:00:00/)
})

test('accepted nonempty refresh preserves exact identity even if a newer record enters the same minute', () => {
  const a = row('2026-10-29T12:35:00.000001Z')
  const b = row('2026-10-29T12:35:00.000002Z')
  const snapshot = response([a, b])
  assert.deepEqual(reconcileSelection(exact(a.measuredAt), snapshot), { selection: exact(a.measuredAt), reset: false })
  assert.equal(resolveSelection(snapshot, exact(a.measuredAt)).reading, a)
})

test('a disappeared exact record stays unavailable in range, without selecting a neighbor in its minute', () => {
  const missing = '2026-10-29T12:35:00.000001Z'
  const snapshot = response([row('2026-10-29T12:35:00.000002Z')])
  const state = reconcileSelection(exact(missing), snapshot)
  assert.deepEqual(state.selection, exact(missing))
  assert.equal(resolveSelection(snapshot, state.selection!).reading, null)
  assert.equal(resolveSelection(snapshot, state.selection!).count, 1)
})

test('refresh resolves the current minute anew, including changed partial-boundary membership', () => {
  const selected = minute(from)
  const shifted = parseHistory({ from: '2026-10-29T12:34:57Z', to: '2026-10-30T12:34:57Z', asOf: '2026-10-30T12:34:57Z', readings: [row(to)] })
  assert.deepEqual(reconcileSelection(selected, shifted).selection, selected)
  assert.equal(resolveSelection(shifted, selected).reading, null)
  const populated = { ...shifted, readings: [row('2026-10-29T12:34:58Z'), row('2026-10-29T12:34:59Z'), row(to)] }
  assert.equal(resolveSelection(populated, selected).reading, populated.readings[1])
})

test('a selection outside a moving window resets to latest; successful empty clears every previous selection', () => {
  const snapshot = response()
  assert.deepEqual(reconcileSelection(exact('2026-10-29T12:34:56.123455Z'), snapshot), { selection: exact(to), reset: true })
  assert.equal(reconcileSelection(minute('2026-10-29T12:33:00Z'), snapshot).reset, true)
  assert.deepEqual(reconcileSelection(exact(to), response([])), { selection: null, reset: false })
  assert.equal(defaultSelection(null), null)
  assert.equal(defaultSelection(response([])), null)
})

test('pointer minute coordinates use the original server window, clip edges and never create an observation identity', () => {
  const snapshot = response()
  assert.deepEqual(minuteAtCoordinate(snapshot, -1), minute(from))
  assert.deepEqual(minuteAtCoordinate(snapshot, 86_400_001), minute(to))
  assert.deepEqual(minuteAtCoordinate(snapshot, 4000), minute('2026-10-29T12:35:00Z'))
})

test('hit testing selects only one identifiable record, and falls back for overlapping or indistinguishable points', () => {
  const a = row(from)
  const b = row(to)
  assert.equal(hitObservation([{ reading: a, x: 10, y: 10 }], 10, 10, 6).reading, a)
  assert.equal(hitObservation([{ reading: a, x: 10, y: 10 }, { reading: a, x: 10, y: 11 }], 10, 10, 6).reading, a)
  assert.equal(hitObservation([{ reading: a, x: 10, y: 10 }, { reading: b, x: 10.5, y: 10 }], 10, 10, 6).ambiguous, true)
  assert.equal(hitObservation([{ reading: a, x: 10, y: 10 }, { reading: b, x: 30, y: 10 }], 20, 10, 22).reading, null)
  const sameMinute = row(from.replace('123456', '123457'))
  assert.equal(hitObservation([{ reading: a, x: 10, y: 10 }, { reading: sameMinute, x: 10, y: 10 }], 10, 10, 6).minute, utcMinute(utcMicroseconds(from)))
  assert.equal(hitObservation([{ reading: a, x: 10, y: 10 }, { reading: b, x: 10, y: 10 }], 10, 10, 6).minute, undefined)
  // Just outside the hit radius still collides visually with the unique inside hit.
  assert.equal(hitObservation([{ reading: a, x: 5.9, y: 0 }, { reading: b, x: 6.1, y: 0 }], 0, 0, 6).ambiguous, true)
  assert.deepEqual(hitObservation([{ reading: a, x: 10, y: 10 }], 100, 100, 6), { reading: null, ambiguous: false })
})
