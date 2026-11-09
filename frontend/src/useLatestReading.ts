import { useCallback, useEffect, useRef, useState } from 'react'
import { createLatestReadingQuery, initialLatestReadingState } from './latestReadingQuery.ts'
import type { LatestReadingResponse } from './readings.ts'
import { mergeLatest } from './liveStore.ts'

export function useLatestReading(enabled = true) {
  const [state, setState] = useState(initialLatestReadingState)
  const query = useRef<ReturnType<typeof createLatestReadingQuery> | null>(null)
  const started = useRef(false)

  useEffect(() => {
    // Responses and live events share one state: an older result never replaces a newer reading.
    const current = createLatestReadingQuery((next) => setState((previous) => mergeLatest(previous, next)))
    query.current = current
    started.current = false
    return () => {
      query.current = null
      current.cancel()
    }
  }, [])

  // Keep the owner and any completed result when navigating. Direct History
  // entry does not need Latest; visiting Overview starts it once, on demand.
  useEffect(() => {
    if (enabled && !started.current) {
      started.current = true
      void query.current?.refresh()
    }
  }, [enabled])

  const refresh = useCallback(() => { void query.current?.refresh() }, [])
  // A pushed reading is a successful server response: it clears an earlier error but leaves an
  // in-flight request's pending flag alone.
  const applyLive = useCallback((snapshot: LatestReadingResponse) => {
    setState((previous) => mergeLatest(previous, { snapshot, pending: previous.pending, error: false }))
  }, [])
  return { ...state, refresh, applyLive }
}
