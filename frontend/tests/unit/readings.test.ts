import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isStale, parseLatestReading } from '../../src/readings.ts'

const reading = {
  installationId: 'residential-demo' as const,
  measuredAt: '2026-10-01T12:00:00Z',
  solarPowerW: 1200,
  consumptionPowerW: 800,
  batteryStateOfChargePercent: 65,
}

test('freshness uses the server reference, with a strict five-minute boundary', () => {
  assert.equal(isStale({ asOf: '2026-10-01T12:04:59Z', reading }), false)
  assert.equal(isStale({ asOf: '2026-10-01T12:05:00Z', reading }), false)
  assert.equal(isStale({ asOf: '2026-10-01T12:05:00.001Z', reading }), true)
  assert.equal(isStale({ asOf: '2026-10-01T12:05:01Z', reading }), true)
})

test('empty responses retain asOf without inventing a reading', () => {
  const empty = parseLatestReading({
    asOf: '2026-10-01T12:00:00+00:00',
    reading: null,
  })
  assert.equal(empty.reading, null)
  assert.equal(isStale(empty), false)
})

test('zero power and charge boundaries are valid', () => {
  for (const charge of [0, 100]) {
    assert.doesNotThrow(() =>
      parseLatestReading({
        asOf: reading.measuredAt,
        reading: {
          ...reading,
          solarPowerW: 0,
          consumptionPowerW: 0,
          batteryStateOfChargePercent: charge,
        },
      }),
    )
  }
})

test('malformed responses are errors, never empty or fresh data', () => {
  for (const invalid of [
    null,
    {},
    { asOf: 'invalid', reading: null },
    { asOf: reading.measuredAt },
    { asOf: '2026-10-01T11:59:59Z', reading },
    ...[
      { solarPowerW: -1 },
      { solarPowerW: null },
      { consumptionPowerW: Infinity },
      { batteryStateOfChargePercent: 101 },
      { measuredAt: '2026-10-01T12:00:00' },
      { installationId: 'unknown' },
    ].map((patch) => ({
      asOf: reading.measuredAt,
      reading: { ...reading, ...patch },
    })),
  ])
    assert.throws(() => parseLatestReading(invalid))
})
