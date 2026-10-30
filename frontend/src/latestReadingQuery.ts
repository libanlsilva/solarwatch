import { parseLatestReading } from './readings.ts'
import type { LatestReadingResponse } from './readings.ts'
import { createReadingQuery } from './readingQuery.ts'

export type LatestReadingState = {
  snapshot: LatestReadingResponse | null
  pending: boolean
  error: boolean
}

export const initialLatestReadingState: LatestReadingState = {
  snapshot: null,
  pending: true,
  error: false,
}

async function fetchLatestReading(signal: AbortSignal): Promise<LatestReadingResponse> {
  const response = await fetch('/api/readings/latest', { signal, cache: 'no-store' })
  if (!response.ok) throw new Error('Reading request failed')
  return parseLatestReading(await response.json())
}

// One latest-reading request owner per mounted view. No timers, retries or shared cache.
export function createLatestReadingQuery(
  notify: (state: LatestReadingState) => void,
  load: (signal: AbortSignal) => Promise<LatestReadingResponse> = fetchLatestReading,
) {
  return createReadingQuery(notify, load)
}
