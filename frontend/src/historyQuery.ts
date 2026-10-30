import { parseHistory } from './history.ts'
import type { HistoryResponse } from './history.ts'
import { createReadingQuery } from './readingQuery.ts'
import type { ReadingQueryState } from './readingQuery.ts'

export type HistoryState = ReadingQueryState<HistoryResponse>
export const initialHistoryState: HistoryState = { snapshot: null, pending: true, error: false }

async function fetchHistory(signal: AbortSignal): Promise<HistoryResponse> {
  const response = await fetch('/api/readings/history', { signal, cache: 'no-store' })
  if (!response.ok) throw new Error('History request failed')
  return parseHistory(await response.json())
}

export function createHistoryQuery(notify: (state: HistoryState) => void,
  load: (signal: AbortSignal) => Promise<HistoryResponse> = fetchHistory) {
  return createReadingQuery(notify, load)
}
