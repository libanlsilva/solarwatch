import { useLayoutEffect, useRef } from 'react'
import type { HistoryResponse } from '../history.ts'
import { localHistoryTime } from '../history.ts'
import { inspectionTimestamp, minuteBounds, stepMinute } from '../historySelection.ts'
import type { HistoryInspection } from '../historySelection.ts'
import { localTimeZone, measurementDate, utcOffsetAt } from '../measurementDisplay.ts'

const number = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 15 })
const minuteTime = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export function SelectedReading({ snapshot, pending, error, inspection, notice }: {
  snapshot: HistoryResponse | null; pending: boolean; error: boolean; inspection: HistoryInspection | null; notice: string
}) {
  const card = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const element = card.current!
    const main = element.closest<HTMLElement>('.history-view')!
    const measure = () => {
      const height = element.getBoundingClientRect().height
      const header = parseFloat(getComputedStyle(main).getPropertyValue('--header-offset')) || 0
      // Large text can make even a tall phone too short for a sticky context.
      const fits = innerHeight - header - height >= 320
      main.style.setProperty('--history-context-height', fits ? `${height}px` : '0px')
      main.style.setProperty('--history-context-position', fits ? 'sticky' : 'static')
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    window.addEventListener('resize', measure)
    measure()
    return () => { observer.disconnect(); window.removeEventListener('resize', measure) }
  }, [])
  const resolved = inspection?.resolved
  const reading = resolved?.reading
  const bounds = snapshot ? minuteBounds(snapshot) : null
  const minuteInstant = resolved ? inspectionTimestamp(resolved.minute * 60_000_000n) : null
  const minuteLabel = minuteInstant ? `${minuteTime.format(new Date(minuteInstant))} · ${utcOffsetAt(minuteInstant)}` : ''
  const inspected = inspection ? reading?.measuredAt ?? (inspection.selection.kind === 'observation' ? inspection.selection.measuredAt : minuteInstant!) : null
  const message = !inspection ? '' : !reading ? inspection.selection.kind === 'minute' ? 'No measurement in this minute.' : 'Selected instant is not present in this response.' :
    inspection.selection.kind === 'minute' && resolved!.count > 1 ? `${resolved!.count} readings in this minute; showing the latest measured time.` :
      inspection.selection.kind === 'observation' ? `Exact observation.${resolved!.count > 1 ? ` ${resolved!.count} readings in this minute.` : ''}` : 'One recorded measurement in this minute.'
  return <section className="history-context card" aria-labelledby="history-context-title" aria-busy={pending && !snapshot} ref={card}>
    <div className="card-top"><h2 id="history-context-title">Selected reading</h2><span className={`selection-status ${reading ? 'battery-text' : ''}`}>{inspection ? reading ? 'Available' : 'Unavailable' : pending ? 'Loading' : 'No selection'}</span></div>
    {inspection && inspected ? <>
      <p className="context-recorded">{reading ? 'Recorded measurement' : 'Inspection context · no measurement'}</p>
      <p className="context-timestamp"><time dateTime={inspected} data-testid={reading ? 'history-selected-time' : 'history-inspected-time'}><span>{measurementDate.format(new Date(inspected))}</span><strong>{localHistoryTime(inspected, undefined, false)}</strong></time></p>
      <p className="history-support context-zone">{localTimeZone} · {utcOffsetAt(inspected)}</p>
      <dl className="context-values">
        {([
          ['solar', 'Solar generation', 'Solar', reading?.solarPowerW, 'W'],
          ['consumption', 'Home consumption', 'Home', reading?.consumptionPowerW, 'W'],
          ['battery', 'Battery', 'Battery', reading?.batteryStateOfChargePercent, '%'],
        ] as const).map(([kind, full, short, value, unit]) => <div key={kind}><dt><i className={`${kind}-key`} /><span className="context-full-label">{full}</span><span className="context-short-label">{short}</span></dt><dd className={`${kind}-text`} data-testid={`history-selected-${kind}`}>
          {value === undefined ? <span aria-label="Unavailable">—</span> : number.format(value)}<small>{unit}</small>
        </dd></div>)}
      </dl>
      <p className="inspection-minute history-support" data-testid="inspected-minute">Minute: {minuteLabel}{resolved!.partial ? ' · partial boundary' : ''}</p>
    </> : pending ? <div className="history-skeleton" aria-label="Loading reading context"><span /><span /><span /></div> : <p className="context-no-reading">{error ? 'Reading context is unavailable.' : 'No reading available in this window.'}</p>}
    <div className="minute-controls" aria-label="Inspect by UTC minute">
      <button type="button" aria-label="Previous minute" disabled={!inspection || resolved!.minute <= bounds!.first} onClick={() => inspection!.select(stepMinute(snapshot!, inspection!.selection, -1))}>−1</button>
      <span className="desktop-minute-step history-support">1 minute</span>
      <input type="range" className="minute-slider" min={0} max={bounds ? Number(bounds.last - bounds.first) : 0} step={1}
        value={inspection ? Number(resolved!.minute - bounds!.first) : 0} disabled={!inspection}
        aria-label="Inspected UTC minute" aria-valuetext={inspection ? `${minuteLabel}, ${localTimeZone}, ${resolved!.count} recorded readings` : 'No readings to inspect'}
        aria-describedby="history-selection-help" onChange={event => inspection!.select({ kind: 'minute', minute: bounds!.first + BigInt(event.currentTarget.value) })} />
      <button type="button" aria-label="Next minute" disabled={!inspection || resolved!.minute >= bounds!.last} onClick={() => inspection!.select(stepMinute(snapshot!, inspection!.selection, 1))}>+1</button>
    </div>
    <p className="history-support selection-message" id="selection-explanation">{message || 'Only persisted readings can be inspected.'}{error && snapshot ? ' Previous successful result.' : ''}</p>
    {notice && <p className="history-support selection-notice">{notice}</p>}
    <p className="sr-only" id="history-selection-help">Click or tap an identifiable point for its exact observation. Chart left/right keys inspect recorded readings. Minute buttons and the mobile slider inspect every UTC minute, including missing minutes.</p>
    <p className="sr-only" aria-live="polite" aria-atomic="true">{inspection && inspected ? `${message} ${localHistoryTime(inspected)}, ${localTimeZone}, ${utcOffsetAt(inspected)}.${reading ? ` Solar ${number.format(reading.solarPowerW)} W, home ${number.format(reading.consumptionPowerW)} W, battery ${number.format(reading.batteryStateOfChargePercent)}%.` : ' Values unavailable.'}` : 'No reading selected.'} {notice}</p>
  </section>
}
