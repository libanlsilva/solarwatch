import { useCallback, useEffect, useRef, useState } from 'react'
import { createLatestReadingQuery, initialLatestReadingState } from './latestReadingQuery.ts'

export function useLatestReading() {
  const [state, setState] = useState(initialLatestReadingState)
  const query = useRef<ReturnType<typeof createLatestReadingQuery> | null>(null)

  useEffect(() => {
    const current = createLatestReadingQuery(setState)
    query.current = current
    void current.refresh()
    return () => {
      query.current = null
      current.cancel()
    }
  }, [])

  const refresh = useCallback(() => { void query.current?.refresh() }, [])
  return { ...state, refresh }
}
