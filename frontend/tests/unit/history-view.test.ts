import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sectionFromHash } from '../../src/navigation.ts'
import { historyViewData } from '../../src/historyViewData.ts'

const from = '2026-10-29T12:00:00.123456Z'
const to = '2026-10-30T12:00:00.123456Z'
const reading = (measuredAt: string) => ({ installationId: 'residential-demo' as const, measuredAt, solarPowerW: 0, consumptionPowerW: 0, batteryStateOfChargePercent: 0 })

test('hash navigation resolves real sections and defaults unknown entry points to Overview', () => {
  assert.equal(sectionFromHash('#history'), 'history')
  assert.equal(sectionFromHash('#installation'), 'installation')
  for (const hash of ['', '#overview', '#unknown']) assert.equal(sectionFromHash(hash), 'overview')
})

test('History context uses the last original history row, preserving zeros and microseconds', () => {
  const rows = [reading(from), reading(to)]
  const model = historyViewData({ asOf: to, from, to, readings: rows })
  assert.equal(model.latest, rows[1])
  assert.equal(model.latest!.solarPowerW, 0)
  assert.equal(model.latest!.measuredAt, to)
  assert.deepEqual(model.intervals.map(({ start, end, label }) => ({ start, end, label })), [{ start: from, end: to, label: 'Between recorded readings' }])
})

test('coverage labels distinguish uncovered edges from interior gaps with exact persisted bounds', () => {
  const rows = [reading('2026-10-29T12:00:01.123457Z'), reading('2026-10-29T12:05:01.123457Z'), reading('2026-10-29T12:10:01.123458Z')]
  const model = historyViewData({ asOf: to, from, to, readings: rows })
  assert.deepEqual(model.intervals.map(item => [item.start, item.end, item.label]), [
    [from, rows[0].measuredAt, 'Before first reading'],
    [rows[1].measuredAt, rows[2].measuredAt, 'Between recorded readings'],
    [rows[2].measuredAt, to, 'After last reading'],
  ])
})

test('successful empty History contains no fabricated latest row or gap boundary samples', () => {
  const model = historyViewData({ asOf: to, from, to, readings: [] })
  assert.equal(model.latest, null)
  assert.deepEqual(model.intervals, [])
  assert.deepEqual(model.plot.points, [])
})
