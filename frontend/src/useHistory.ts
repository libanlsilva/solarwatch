import { useCallback, useEffect, useRef, useState } from 'react'
import { createHistoryQuery, initialHistoryState } from './historyQuery.ts'

export function useHistory() {
  const [state, setState] = useState(initialHistoryState)
  const query = useRef<ReturnType<typeof createHistoryQuery> | null>(null)
  useEffect(() => {
    const current = createHistoryQuery(setState)
    query.current = current
    void current.refresh()
    return () => { query.current = null; current.cancel() }
  }, [])
  const refresh = useCallback(() => { void query.current?.refresh() }, [])
  return { ...state, refresh }
}
