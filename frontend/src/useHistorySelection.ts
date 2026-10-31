import { useState } from 'react'
import type { HistoryResponse } from './history.ts'
import { defaultSelection, reconcileSelection } from './historySelection.ts'
import type { HistorySelection } from './historySelection.ts'

export function useHistorySelection(snapshot: HistoryResponse | null) {
  const [state, setState] = useState(() => ({ snapshot, selection: defaultSelection(snapshot), notice: '' }))
  // A guarded render adjustment reconciles before children commit. It uses the
  // latest user state, including input made while the request was pending.
  if (state.snapshot !== snapshot) {
    const next = reconcileSelection(state.selection, snapshot)
    setState({ snapshot, selection: next.selection, notice: next.reset ? 'Previous selection left the window. Showing the latest available reading.' : '' })
  }
  const select = (selection: HistorySelection, notice = '') => setState(current => ({ ...current, selection, notice }))
  return { selection: state.selection, notice: state.notice, select }
}
