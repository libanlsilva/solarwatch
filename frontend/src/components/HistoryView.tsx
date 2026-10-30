import { useMemo } from 'react'
import { localHistoryTime } from '../history.ts'
import { historyViewData } from '../historyViewData.ts'
import type { HistoryState } from '../historyQuery.ts'
import { localTimeZone, measurementDate, measurementTime, utcOffsetAt } from '../measurementDisplay.ts'
import { HistoryPlotFrame } from './HistoryCharts.tsx'
import './history-view.css'

const dateRange = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const number = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 6 })

export function HistoryView({ snapshot, pending, error, refresh }: HistoryState & { refresh: () => void }) {
  const model = useMemo(() => snapshot ? historyViewData(snapshot) : null, [snapshot])
  const populated = !!model?.latest
  const coverage = !snapshot ? 'Not checked' : !populated ? 'Empty window' : model!.intervals.length ? 'Partial history' : 'Available history'
  const message = pending ? snapshot ? 'Refreshing history…' : 'Loading history…' : error ? snapshot ? 'Unable to update. Previous history is still available.' : 'History could not be loaded. Please try again.' : !populated ? 'No measurements in this window. Missing readings are never shown as zero.' : model!.intervals.length ? 'Partial history. Shaded intervals contain no measurements; curves stop across gaps longer than five minutes.' : 'History updated. Only recorded measurements are shown.'
  const latest = model?.latest
  const range = (instant: string) => <time dateTime={instant} title={localHistoryTime(instant)}>{dateRange.format(new Date(instant))}</time>
  return <main className="history-view" id="main-content" tabIndex={-1}>
    <section className="history-heading" aria-labelledby="history-title">
      <div><div className="context-row"><span className="installation-id">Residential demo</span><span className="simulated mobile-simulated"><span className="dot" />Simulated data</span></div>
        <h1 id="history-title">History</h1><p className="history-intro">A full day of readings. Every moment in context.</p></div>
      <p className="history-view-note">24 hours<span>Recorded measurements · manual refresh</span></p>
    </section>
    <section className="history-window card" aria-label="History window">
      <div><p className="history-support">24-hour window · local time</p>
        <p className="detail-range" data-testid="history-window">{snapshot ? <>{range(snapshot.from)}<span>to</span>{range(snapshot.to)}</> : pending ? 'Loading window…' : 'Window unavailable'}</p></div>
      <div className="window-metadata"><p>{localTimeZone}{snapshot && <span> {utcOffsetAt(snapshot.from)}{utcOffsetAt(snapshot.from) !== utcOffsetAt(snapshot.to) ? ` → ${utcOffsetAt(snapshot.to)}` : ''}</span>}</p>
        <p className="history-support">{snapshot ? <>{error || pending ? 'Last successful check' : 'Checked'} <time dateTime={snapshot.asOf} data-testid="history-asof">{measurementDate.format(new Date(snapshot.asOf))}, {measurementTime.format(new Date(snapshot.asOf))}</time></> : 'Reference time supplied by the server'}</p></div>
    </section>
    <div className={`detail-notice ${error ? 'attention-text' : ''}`} role={error ? 'alert' : 'status'}>
      {pending && <span className="spinner" aria-hidden="true" />}<span>{message}</span>
      {error && <button className="history-retry" type="button" onClick={refresh} disabled={pending}>History Retry</button>}
    </div>
    <div className="history-workspace" data-history-state={pending ? 'pending' : error ? 'error' : populated ? 'ready' : 'empty'}>
      <section className="detail-charts card" aria-labelledby="readings-title" aria-busy={pending}>
        <div className="detail-chart-heading card-top"><h2 id="readings-title">Readings over time</h2><span className="coverage-pill">{coverage}</span></div>
        <div className="detail-desktop-legend history-legend"><span><i className="solar-key" />Solar generation</span><span><i className="consumption-key" />Home consumption</span><span><i className="battery-key" />Battery charge</span><span><i className="gap-key" />No measurement</span></div>
        {(['power', 'battery'] as const).map(kind => <section className={`detail-chart ${kind}-detail`} key={kind} aria-labelledby={`detail-${kind}-title`}>
          <div className="card-top"><h3 id={`detail-${kind}-title`}>{kind === 'power' ? 'Solar & home' : 'Battery charge'}</h3><span className="history-support">{kind === 'power' ? 'Power · W' : 'State of charge · %'}</span></div>
          <div className="detail-mobile-legend history-legend">{kind === 'power' ? <><span><i className="solar-key" />Solar generation</span><span><i className="consumption-key" />Home consumption</span></> : <span><i className="battery-key" />State of charge</span>}</div>
          <div className="detail-data">{populated && snapshot && model ? <HistoryPlotFrame kind={kind} snapshot={snapshot} plot={model.plot} detail /> : pending ? <div className="history-skeleton" aria-label="Loading historical measurements"><span /><span /><span /></div> : <div className="history-empty"><h3>{error ? 'History is unavailable' : 'No measurements in this window'}</h3><p>{error ? 'Retry the history query to check again.' : 'No values have been substituted.'}</p></div>}</div>
        </section>)}
        <div className="detail-chart-foot history-support"><p>Click, tap or focus a chart and use arrow keys to inspect its recorded values.</p><p>Each chart is independent. The context card shows the latest available reading in this window.</p></div>
      </section>
      <section className="history-context card" aria-labelledby="history-context-title" aria-busy={pending && !snapshot}>
        <h2 id="history-context-title">Latest available reading</h2>
        {latest ? <>
          <p className="context-recorded">Recorded in this window</p>
          <p className="context-timestamp"><time dateTime={latest.measuredAt} data-testid="history-latest-time"><span>{measurementDate.format(new Date(latest.measuredAt))}</span><strong>{localHistoryTime(latest.measuredAt, undefined, false)}</strong></time></p>
          <p className="history-support context-zone">{localTimeZone} · {utcOffsetAt(latest.measuredAt)}</p>
          <dl className="context-values">
            <div><dt><i className="solar-key" /><span className="context-full-label">Solar generation</span><span className="context-short-label">Solar</span></dt><dd className="solar-text" data-testid="history-latest-solar">{number.format(latest.solarPowerW)}<small>W</small></dd></div>
            <div><dt><i className="consumption-key" /><span className="context-full-label">Home consumption</span><span className="context-short-label">Home</span></dt><dd className="consumption-text" data-testid="history-latest-home">{number.format(latest.consumptionPowerW)}<small>W</small></dd></div>
            <div><dt><i className="battery-key" />Battery</dt><dd className="battery-text" data-testid="history-latest-battery">{number.format(latest.batteryStateOfChargePercent)}<small>%</small></dd></div>
          </dl>
        </> : pending ? <div className="history-skeleton" aria-label="Loading reading context"><span /><span /><span /></div> : <p className="context-no-reading">{error ? 'Reading context is unavailable.' : 'No reading available in this window.'}</p>}
        <p className="history-support context-note">Read-only context from the queried history.{error && snapshot ? ' Previous successful result.' : ''}</p>
      </section>
      <section className="history-coverage card" aria-labelledby="coverage-title"><div className="card-top"><h2 id="coverage-title">Reading coverage</h2><span className="history-support"><i className="gap-key" /> Missing</span></div>
        {snapshot && model && <><div className={`coverage-track ${!populated ? 'empty-track' : ''}`} aria-label={coverage}>{model.intervals.map((gap, index) => <span key={index} style={{ left: `${gap.from / model.plot.duration * 100}%`, width: `${(gap.to - gap.from) / model.plot.duration * 100}%` }} />)}</div>
          <p>{snapshot.readings.length.toLocaleString()} recorded measurements in this window. {populated ? 'Gaps are unavailable data, never zero.' : 'The entire window is empty.'}</p>
          {model.intervals.length > 0 && <div className="coverage-intervals">{model.intervals.map((gap, index) => <p key={index}><span>{gap.label}</span><strong>{range(gap.start)} — {range(gap.end)}</strong></p>)}</div>}
        </>}
        <p>Only persisted readings are displayed. No measurements are inferred between recorded samples.</p>
      </section>
    </div>
    <div className="history-snapshot-note history-support"><span>Simulated residential installation</span><span>{snapshot ? <>Server reference: <time dateTime={snapshot.asOf}>{localHistoryTime(snapshot.asOf)}</time></> : 'Awaiting a successful history query'}</span></div>
  </main>
}
