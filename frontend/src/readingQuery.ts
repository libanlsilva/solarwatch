export type ReadingQueryState<T> = { snapshot: T | null; pending: boolean; error: boolean }

// One independent request owner; shared lifecycle only, without caching, timers or automatic retries.
export function createReadingQuery<T>(notify: (state: ReadingQueryState<T>) => void, load: (signal: AbortSignal) => Promise<T>) {
  let state: ReadingQueryState<T> = { snapshot: null, pending: true, error: false }
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
