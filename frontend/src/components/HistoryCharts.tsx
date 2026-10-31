import { Component, lazy, Suspense, useMemo } from 'react'
import type { ReactNode } from 'react'
import { prepareHistory } from '../history.ts'
import type { HistoryPlot, HistoryResponse } from '../history.ts'
import type { HistoryState } from '../historyQuery.ts'
import { localTimeZone, measurementDate, measurementTime, utcOffsetAt } from '../measurementDisplay.ts'
import './history.css'

const rangeTime = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const HistoryPlotView = lazy(() => import('./HistoryPlot.tsx'))

// A chart-module download failure must not take down the metrics or the rest of the page.
class ChartBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <div className="history-empty" role="alert"><h3>Chart display is unavailable</h3><p>Reload the page to try loading the chart again.</p></div> : this.props.children
  }
}

export function HistoryPlotFrame({ kind, snapshot, plot, detail = false }: {
  kind: 'power' | 'battery'; snapshot: HistoryResponse; plot: HistoryPlot; detail?: boolean
}) {
  return <ChartBoundary><Suspense fallback={<div className="history-skeleton" aria-label="Loading chart display"><span /><span /><span /></div>}>
    <HistoryPlotView key={snapshot.asOf} kind={kind} snapshot={snapshot} plot={plot} detail={detail} />
  </Suspense></ChartBoundary>
}

function HistoryCard({ kind, snapshot, pending, error, plot, retry }: HistoryState & {
  kind: 'power' | 'battery'; plot: HistoryPlot | null; retry: () => void
}) {
  const power = kind === 'power'
  const populated = snapshot && snapshot.readings.length > 0
  const lastCharge = snapshot?.readings.at(-1)?.batteryStateOfChargePercent
  const chargeText = lastCharge === undefined ? null : lastCharge.toLocaleString(undefined, { maximumSignificantDigits: 6 })
  const message = pending ? snapshot ? 'Refreshing history…' : 'Loading history…' : error ? snapshot ? 'Previous history · unable to update' : 'History is unavailable' :
    !populated ? 'No historical readings yet' : plot!.gaps.length ? 'Partial history · missing intervals are not measurements' : 'History updated'
  return <section className={`card history-card ${kind}-history`} aria-labelledby={`${kind}-history-title`} data-history-state={pending ? 'pending' : error ? 'error' : populated ? 'ready' : 'empty'}>
    <div className="card-top"><h2 id={`${kind}-history-title`}><span className="desktop-chart-title">{power ? 'Power over 24 hours' : 'Battery over 24 hours'}</span><span className="mobile-chart-title">{power ? 'Solar & home' : 'Battery charge'}</span> <span className="history-unit">{power ? 'W' : '%'}</span></h2><span className={`history-period ${!power && populated ? 'battery-text' : ''}`} aria-label={!power && populated ? `Last battery sample in this history window: ${chargeText}%` : undefined}>{!power && populated ? `Last sample ${chargeText}%` : <><span className="desktop-chart-title">Last 24 hours</span><span className="mobile-chart-title">{power ? 'W' : '%'}</span></>}</span></div>
    {snapshot && <p className="history-range" data-testid={`${kind}-range`}>
      <time dateTime={snapshot.from}>{rangeTime.format(new Date(snapshot.from))}</time><span> — </span><time dateTime={snapshot.to}>{rangeTime.format(new Date(snapshot.to))}</time>
    </p>}
    <div className="history-legend" aria-label={power ? 'Power series' : 'Battery series'}>
      {power ? <><span><i className="solar-key" />Solar generation</span><span><i className="consumption-key" />Home consumption</span></> : <span><i className="battery-key" />State of charge</span>}
    </div>
    <div className="history-data" aria-busy={pending}>
      {populated && plot ? <HistoryPlotFrame kind={kind} snapshot={snapshot} plot={plot} /> : pending ?
        <div className="history-skeleton" aria-hidden="true"><span /><span /><span /></div> :
        <div className="history-empty"><h3>{error ? 'History could not be loaded' : 'No measurements in this window'}</h3><p>{error ? 'Latest Reading is checked separately.' : 'No values are substituted for missing readings.'}</p></div>}
    </div>
    <div className={`history-notice ${error ? 'attention-text' : ''}`} role={power ? error ? 'alert' : 'status' : undefined}>
      {pending && <span className="spinner" aria-hidden="true" />}<span>{message}</span>
      {power && error && <button className="history-retry" onClick={retry} disabled={pending} type="button">History Retry</button>}
    </div>
    {snapshot && <div className="history-check">
      <p>{localTimeZone} <span>({utcOffsetAt(snapshot.from)}{utcOffsetAt(snapshot.to) !== utcOffsetAt(snapshot.from) ? ` → ${utcOffsetAt(snapshot.to)}` : ''})</span></p>
      <p>{error || pending ? 'Last successful check' : 'Checked'} <time data-testid={`${kind}-history-asof`} dateTime={snapshot.asOf}>{measurementDate.format(new Date(snapshot.asOf))}, {measurementTime.format(new Date(snapshot.asOf))}</time></p>
    </div>}
    {populated && <p className="sr-only">Click or tap a chart point, or focus the chart and use arrow keys, to read a recorded measurement. Shaded intervals are unavailable.</p>}
  </section>
}

export function HistoryCharts({ retry, ...state }: HistoryState & { retry: () => void }) {
  const plot = useMemo(() => state.snapshot ? prepareHistory(state.snapshot) : null, [state.snapshot])
  return <>
    <HistoryCard kind="power" {...state} plot={plot} retry={retry} />
    <HistoryCard kind="battery" {...state} plot={plot} retry={retry} />
  </>
}
