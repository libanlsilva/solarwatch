import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHistoryQuery } from '../../src/historyQuery.ts'
import type { HistoryState } from '../../src/historyQuery.ts'
import type { HistoryResponse } from '../../src/history.ts'
import { createLatestReadingQuery } from '../../src/latestReadingQuery.ts'

const snapshot: HistoryResponse = { asOf: '2026-10-30T12:00:00Z', from: '2026-10-29T12:00:00Z', to: '2026-10-30T12:00:00Z', readings: [] }
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('History is single-flight and independent of a failing or pending Latest Reading', async () => {
  const states: HistoryState[] = []
  const gate = deferred<HistoryResponse>()
  let historyCalls = 0
  let latestCalls = 0
  const history = createHistoryQuery(state => states.push(state), () => { historyCalls++; return gate.promise })
  const latest = createLatestReadingQuery(() => {}, async () => { latestCalls++; throw new Error('Latest failed') })
  const pending = history.refresh()
  await history.refresh()
  await latest.refresh()
  await latest.refresh()
  assert.equal(historyCalls, 1)
  assert.equal(latestCalls, 2)
  assert.equal(states.at(-1)?.pending, true)
  gate.resolve(snapshot)
  await pending
  assert.equal(states.at(-1)?.snapshot, snapshot)
})

test('failed history updates retain the exact old range/reference; a later successful empty replaces it', async () => {
  const states: HistoryState[] = []
  const populated = { ...snapshot, readings: [{ installationId: 'residential-demo' as const, measuredAt: snapshot.to, solarPowerW: 0, consumptionPowerW: 800, batteryStateOfChargePercent: 65 }] }
  let result: HistoryResponse | Error = populated
  const query = createHistoryQuery(state => states.push(state), async () => { if (result instanceof Error) throw result; return result })
  await query.refresh()
  result = new Error('Database unavailable')
  await query.refresh()
  assert.equal(states.at(-1)?.snapshot, populated)
  assert.equal(states.at(-1)?.error, true)
  result = snapshot
  await query.refresh()
  assert.deepEqual(states.at(-1), { snapshot, error: false, pending: false })
})

for (const result of ['success', 'failure'] as const) {
  test(`a cancelled obsolete history ${result} cannot replace a newer request or clear its busy state`, async () => {
    const states: HistoryState[] = []
    const first = deferred<HistoryResponse>()
    const second = deferred<HistoryResponse>()
    const signals: AbortSignal[] = []
    const query = createHistoryQuery(state => states.push(state), signal => { signals.push(signal); return signals.length === 1 ? first.promise : second.promise })
    const old = query.refresh()
    query.cancel()
    const current = query.refresh()
    const count = states.length
    if (result === 'success') first.resolve(snapshot)
    else first.reject(new Error('Late failure'))
    await old
    assert.equal(signals[0].aborted, true)
    assert.equal(states.length, count)
    await query.refresh()
    assert.equal(signals.length, 2)
    second.resolve(snapshot)
    await current
    assert.equal(states.at(-1)?.snapshot, snapshot)
  })
}

test('unmounted history requests are aborted and never publish even when a loader ignores abort', async () => {
  const states: HistoryState[] = []
  const gate = deferred<HistoryResponse>()
  const query = createHistoryQuery(state => states.push(state), () => gate.promise)
  const pending = query.refresh()
  query.cancel()
  const count = states.length
  gate.resolve(snapshot)
  await pending
  assert.equal(states.length, count)
})

test('history HTTP failures and malformed successes remain errors and preserve a prior valid response', async () => {
  const previous = globalThis.fetch
  let response = new Response(JSON.stringify(snapshot))
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/readings/history')
    assert.equal(options?.cache, 'no-store')
    assert.ok(options?.signal instanceof AbortSignal)
    return response
  }
  try {
    const states: HistoryState[] = []
    const query = createHistoryQuery(state => states.push(state))
    await query.refresh()
    const valid = states.at(-1)?.snapshot
    for (const failure of [new Response('Unavailable', { status: 503 }), new Response('{'), new Response(JSON.stringify({ ...snapshot, from: snapshot.to }))]) {
      response = failure
      await query.refresh()
      assert.equal(states.at(-1)?.snapshot, valid)
      assert.equal(states.at(-1)?.error, true)
    }
  } finally { globalThis.fetch = previous }
})
