import { useCallback, useEffect, useRef, useState } from 'react'
import { createLatestReadingQuery, initialLatestReadingState } from './latestReadingQuery.ts'

export function useLatestReading(enabled = true) {
  const [state, setState] = useState(initialLatestReadingState)
  const query = useRef<ReturnType<typeof createLatestReadingQuery> | null>(null)
  const started = useRef(false)

  useEffect(() => {
    const current = createLatestReadingQuery(setState)
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
  return { ...state, refresh }
}
