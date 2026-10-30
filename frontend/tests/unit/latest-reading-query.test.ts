import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLatestReadingQuery } from '../../src/latestReadingQuery.ts'
import type { LatestReadingState } from '../../src/latestReadingQuery.ts'
import type { LatestReadingResponse } from '../../src/readings.ts'
import { ageAtServerCheck, utcOffsetAt } from '../../src/measurementDisplay.ts'

const snapshot: LatestReadingResponse = {
  asOf: '2026-10-28T18:39:30Z',
  reading: { installationId: 'residential-demo', measuredAt: '2026-10-28T18:32:00Z', solarPowerW: 0, consumptionPowerW: 800, batteryStateOfChargePercent: 65 },
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('manual latest requests are single-flight, then a new explicit refresh is allowed', async () => {
  const states: LatestReadingState[] = []
  const gate = deferred<LatestReadingResponse>()
  let calls = 0
  const query = createLatestReadingQuery((state) => states.push(state), () => { calls++; return gate.promise })
  const first = query.refresh()
  await query.refresh()
  assert.equal(calls, 1)
  assert.equal(states.length, 1)
  assert.deepEqual(states[0], { snapshot: null, pending: true, error: false })
  gate.resolve(snapshot)
  await first
  assert.deepEqual(states.at(-1), { snapshot, pending: false, error: false })
  await query.refresh()
  assert.equal(calls, 2)
})

test('failed refresh retains the exact successful snapshot/reference and retry can clear it with empty', async () => {
  const states: LatestReadingState[] = []
  let outcome: LatestReadingResponse | Error = snapshot
  const query = createLatestReadingQuery((state) => states.push(state), async () => {
    if (outcome instanceof Error) throw outcome
    return outcome
  })
  await query.refresh()
  outcome = new Error('Network unavailable')
  await query.refresh()
  assert.equal(states.at(-2)?.snapshot, snapshot)
  assert.equal(states.at(-2)?.pending, true)
  assert.deepEqual(states.at(-1), { snapshot, pending: false, error: true })
  const empty = { asOf: '2026-10-28T18:40:00Z', reading: null }
  outcome = empty
  await query.refresh()
  assert.deepEqual(states.at(-1), { snapshot: empty, pending: false, error: false })
})

test('initial failure is unknown availability, not an empty successful response', async () => {
  const states: LatestReadingState[] = []
  const query = createLatestReadingQuery((state) => states.push(state), async () => { throw new Error('Unavailable') })
  await query.refresh()
  assert.deepEqual(states.at(-1), { snapshot: null, pending: false, error: true })
})

for (const obsolete of ['success', 'failure'] as const) {
  test(`a cancelled late ${obsolete} cannot replace a newer request or clear its busy state`, async () => {
    const states: LatestReadingState[] = []
    const first = deferred<LatestReadingResponse>()
    const second = deferred<LatestReadingResponse>()
    const signals: AbortSignal[] = []
    const query = createLatestReadingQuery((state) => states.push(state), (signal) => {
      signals.push(signal)
      return signals.length === 1 ? first.promise : second.promise
    })
    const oldRequest = query.refresh()
    query.cancel()
    assert.equal(signals[0].aborted, true)
    const newRequest = query.refresh()
    const notifications = states.length
    if (obsolete === 'success') first.resolve(snapshot)
    else first.reject(new Error('Late failure'))
    await oldRequest
    assert.equal(states.length, notifications)
    assert.equal(states.at(-1)?.pending, true)
    await query.refresh()
    assert.equal(signals.length, 2)
    const latest = { asOf: '2026-10-28T18:40:00Z', reading: null }
    second.resolve(latest)
    await newRequest
    assert.equal(states.at(-1)?.snapshot, latest)
    assert.equal(states.at(-1)?.pending, false)
  })
}

test('unmounted/cancelled queries never publish even if the loader ignores abort', async () => {
  const states: LatestReadingState[] = []
  const gate = deferred<LatestReadingResponse>()
  const query = createLatestReadingQuery((state) => states.push(state), () => gate.promise)
  const running = query.refresh()
  query.cancel()
  gate.resolve(snapshot)
  await running
  assert.equal(states.length, 1)
})

test('HTTP errors and malformed payloads cannot replace a successful response', async (context) => {
  let result = new Response(JSON.stringify(snapshot))
  const fetchMock = context.mock.method(globalThis, 'fetch', async () => result)
  const states: LatestReadingState[] = []
  const query = createLatestReadingQuery((state) => states.push(state))
  await query.refresh()
  const retained = states.at(-1)?.snapshot
  for (const response of [new Response('Unavailable', { status: 503 }), new Response('{'), new Response(JSON.stringify({ asOf: 'bad', reading: null }))]) {
    result = response
    await query.refresh()
    assert.equal(states.at(-1)?.snapshot, retained)
    assert.equal(states.at(-1)?.error, true)
  }
  const options = fetchMock.mock.calls[0].arguments[1]
  assert.equal(options?.cache, 'no-store')
  assert.ok(options?.signal instanceof AbortSignal)
})

test('age labels use only the server snapshot and retain useful stale durations', () => {
  assert.equal(ageAtServerCheck(snapshot), '7m 30s')
  assert.equal(ageAtServerCheck({ ...snapshot, asOf: '2026-10-28T18:32:01Z' }), '1 second')
  assert.equal(ageAtServerCheck({ ...snapshot, asOf: '2026-10-28T18:32:00Z' }), '0 seconds')
  assert.equal(ageAtServerCheck({ ...snapshot, asOf: '2026-10-29T20:32:00Z' }), '1d 2h')
  assert.equal(ageAtServerCheck({ ...snapshot, reading: null }), null)
})

test('local offset is derived from each instant, including daylight-saving transitions', () => {
  assert.equal(utcOffsetAt('2026-10-28T18:32:00Z', 'America/Havana'), 'UTC-04:00')
  assert.equal(utcOffsetAt('2026-12-01T18:32:00Z', 'America/Havana'), 'UTC-05:00')
  assert.equal(utcOffsetAt('2026-10-28T18:32:00Z', 'UTC'), 'UTC+00:00')
})
