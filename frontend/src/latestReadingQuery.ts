import { parseLatestReading } from './readings.ts'
import type { LatestReadingResponse } from './readings.ts'

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
  let state = initialLatestReadingState
  let active: AbortController | null = null

  return {
    async refresh() {
      if (active) return
      const request = new AbortController()
      active = request
      state = { ...state, pending: true, error: false }
      notify(state)
      try {
        const snapshot = await load(request.signal)
        if (active !== request || request.signal.aborted) return
        state = { snapshot, pending: false, error: false }
      } catch {
        if (active !== request || request.signal.aborted) return
        state = { ...state, pending: false, error: true }
      } finally {
        // A cancelled response must never clear a newer request or publish its result.
        if (active === request && !request.signal.aborted) {
          active = null
          notify(state)
        }
      }
    },
    cancel() {
      const request = active
      active = null
      request?.abort()
    },
  }
}
