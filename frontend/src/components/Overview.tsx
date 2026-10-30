import type { LatestReadingState } from '../latestReadingQuery.ts'
import { useLayoutEffect, useRef } from 'react'
import { isStale } from '../readings.ts'
import { ageAtServerCheck, localTimeZone, measurementDate, measurementNumber, measurementTime, utcOffsetAt } from '../measurementDisplay.ts'

type IconName = 'sun' | 'house' | 'battery' | 'panel' | 'inverter' | 'refresh'

function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  const paths = {
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 1.5v3m0 15v3M1.5 12h3m15 0h3M4.6 4.6l2.1 2.1m10.6 10.6 2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" /></>,
    house: <path d="m3 10 9-7 9 7M5 9v12h14V9M10 21v-7h4v7" />,
    battery: <><rect x="3" y="6" width="17" height="12" rx="3" /><path d="M23 10v4M7 10v4m4-4v4m4-4v4" /></>,
    panel: <path d="M5 4h14l3 13H2L5 4Zm-1.5 7h17M9 4 8 17m7-13 1 13M12 17v4m-4 0h8" />,
    inverter: <><rect x="5" y="3" width="14" height="18" rx="3" /><path d="M9 7h6M8 14c2-6 4 6 8 0" /></>,
    refresh: <path d="M20 7v5h-5M20 12a8 8 0 1 0-2.3 5.7M20 7l-3-3" />,
  }
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

export function DashboardHeader({ pending, disabled, error, refresh, section }: {
  pending: boolean; disabled: boolean; error: boolean; refresh: () => void
  section: 'overview' | 'installation'
}) {
  const header = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const element = header.current!
    const updateOffset = () => document.documentElement.style.setProperty('--header-offset', `${element.getBoundingClientRect().height + 12}px`)
    updateOffset()
    const observer = new ResizeObserver(updateOffset)
    observer.observe(element)
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--header-offset') }
  }, [])
  return (
    <header className="app-header" ref={header}>
      <a className="brand" href="#overview" aria-label="SolarWatch Overview"><Icon name="sun" />SolarWatch</a>
      <nav aria-label="Main navigation">
        <a href="#overview" aria-current={section === 'overview' ? 'location' : undefined}>Overview</a>
        <span className="future-section" aria-disabled="true" aria-describedby="history-unavailable">History<span className="nav-future">Coming later</span></span>
        <a href="#installation" aria-current={section === 'installation' ? 'location' : undefined}>Installation</a>
      </nav>
      <span className="sr-only" id="history-unavailable">History is not available yet.</span>
      <div className="header-actions">
        <span className="simulated desktop-simulated"><span className="dot" />Simulated data</span>
        <button className="refresh" type="button" disabled={disabled} aria-describedby={pending && !disabled ? 'refresh-available' : undefined} aria-label={disabled ? 'Refreshing…' : error ? 'Retry' : pending ? 'Refresh available data' : 'Refresh readings'} onClick={refresh}>
          {pending ? <span className="spinner" aria-hidden="true" /> : <Icon name="refresh" />}
          {disabled ? 'Refreshing…' : error ? 'Retry' : 'Refresh'}
        </button>
        <span className="sr-only" id="refresh-available">A request is in progress. Refresh updates only resources without a pending request.</span>
      </div>
    </header>
  )
}

export function QueryNotice({ snapshot, pending, error }: LatestReadingState) {
  const reading = snapshot?.reading
  const stale = snapshot ? isStale(snapshot) : false
  if (pending) return <div className="state-notice" role="status"><h2>{snapshot ? 'Refreshing readings…' : 'Loading latest reading…'}</h2><p>{snapshot ? 'Keeping the last successful result while we check.' : 'Waiting for the installation’s latest measurement.'}</p></div>
  if (error) return <div className="state-notice attention" role="alert"><h2>{reading ? 'Previous reading' : 'Readings are unavailable'}</h2><p>{reading ? 'The previous reading has not been verified again. Current freshness could not be checked. Use Retry.' : snapshot ? 'Unable to refresh readings. The last successful result was empty; current availability is unknown.' : 'Unable to load readings. Check the connection and use Retry.'}</p></div>
  if (snapshot && !reading) return <div className="state-notice" role="status"><h2>No measurements yet</h2><p>Waiting for the first reading. Refresh once data is available.</p></div>
  if (stale) return <div className="state-notice attention" role="status"><h2>Latest reading is old</h2><p>More than five minutes old at the server check. Refresh to check for a newer measurement.</p></div>
  return <p className="sr-only" role="status">Latest reading updated.</p>
}

function Skeleton({ kind = 'number' }: { kind?: 'number' | 'time' | 'date' }) {
  return <span className={`skeleton skeleton-${kind}`} aria-hidden="true" />
}

export function MetricCard({ kind, value, skeleton }: { kind: 'solar' | 'home'; value?: number; skeleton: boolean }) {
  const solar = kind === 'solar'
  const label = solar ? 'Solar generation' : 'Home consumption'
  const formatted = value === undefined ? null : measurementNumber.format(value)
  return (
    <section className={`card metric ${kind}`} aria-labelledby={`${kind}-title`}>
      <div className="card-top"><h2 id={`${kind}-title`}>{label}</h2><span className="icon-bubble"><Icon name={solar ? 'sun' : 'house'} /></span></div>
      {skeleton ? <div className="metric-value"><Skeleton /></div> : <div className={`metric-value ${formatted && formatted.length > 7 ? 'compact-value' : ''}`} data-testid={formatted !== null ? (solar ? 'solar-power' : 'consumption-power') : undefined}>
        {formatted ?? <><span className="unavailable" aria-hidden="true">—</span><span className="sr-only">Not available</span></>}<span className="metric-unit"> W</span>
      </div>}
      <p className="support">Instantaneous power</p>
      <div className="metric-accent" aria-hidden="true" />
    </section>
  )
}

function BatteryGauge({ value, skeleton }: { value?: number; skeleton: boolean }) {
  const circumference = 2 * Math.PI * 60
  return <div className="gauge" role={value === undefined ? 'img' : 'meter'} aria-label={value === undefined ? 'Battery charge unavailable' : 'Battery state of charge'} aria-valuemin={value === undefined ? undefined : 0} aria-valuemax={value === undefined ? undefined : 100} aria-valuenow={value}>
    <svg viewBox="0 0 146 146" aria-hidden="true">
      <circle cx="73" cy="73" r="60" fill="none" stroke="#233126" strokeWidth="7" strokeDasharray="2 5" />
      {value !== undefined && value > 0 && <circle cx="73" cy="73" r="60" fill="none" stroke="var(--lime)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${circumference * value / 100} ${circumference}`} />}
    </svg>
    <div className="gauge-value"><strong data-testid={value === undefined ? undefined : 'battery-charge'}>{skeleton ? <Skeleton /> : value === undefined ? <><span aria-hidden="true">—</span><span className="sr-only">Not available</span></> : measurementNumber.format(value)}{!skeleton && <small>%</small>}</strong><span className="support">State of charge</span></div>
  </div>
}

export function MeasurementCard({ snapshot, pending, error }: LatestReadingState) {
  const reading = snapshot?.reading
  const skeleton = pending && !snapshot
  const stale = snapshot ? isStale(snapshot) : false
  const measuredDate = reading ? new Date(reading.measuredAt) : null
  const checkedDate = snapshot ? new Date(snapshot.asOf) : null
  return <section className="measurement-pair" aria-label="Latest measurement" aria-busy={pending}>
    <div className="card battery">
      <div className="card-top"><h2>Battery charge</h2><span className={`dot battery-dot ${reading ? '' : 'neutral-dot'}`} aria-hidden="true" /></div>
      <BatteryGauge value={reading?.batteryStateOfChargePercent} skeleton={skeleton} />
    </div>
    <div className="card latest">
      <div className="latest-details">
        <h2>Latest measurement</h2>
        {reading && measuredDate ? <>
          <time className="measurement-timestamp" dateTime={reading.measuredAt}><span className="time">{measurementTime.format(measuredDate)}</span><span className="date">{measurementDate.format(measuredDate)}</span></time>
          <p className="zone"><span>{localTimeZone}</span> <span>({utcOffsetAt(reading.measuredAt)})</span></p>
        </> : <div className="missing-time">{skeleton ? <><Skeleton kind="time" /><Skeleton kind="date" /></> : <p className="time">—<span className="sr-only">No measurement timestamp</span></p>}</div>}
      </div>
      {reading ? <span className={`fresh ${stale ? 'stale' : error ? 'neutral' : ''}`}><span className="dot" />{stale ? 'Stale reading' : error ? 'Last check: fresh' : 'Fresh at last check'}</span> : <span className="fresh neutral">{skeleton ? 'Awaiting reading' : 'No reading available'}</span>}
      <div className="checked">
        {snapshot && checkedDate ? <>
          <p>{error || pending ? 'Last successful check' : 'Checked'} <time data-testid="checked-at" dateTime={snapshot.asOf}>{measurementTime.format(checkedDate)}<span className="check-date"> · {measurementDate.format(checkedDate)} {utcOffsetAt(snapshot.asOf)}</span></time></p>
          {reading && <p>{ageAtServerCheck(snapshot)} old at server check</p>}
          {error && <p className="attention-text">Current freshness unverified</p>}
        </> : <p>{skeleton ? 'Waiting for server reference' : 'No successful server check'}</p>}
      </div>
    </div>
  </section>
}

export function InstallationDiagram() {
  return <section className="card installation" id="installation" tabIndex={-1} aria-labelledby="installation-title">
    <div className="card-top"><h2 id="installation-title">Your installation</h2><span className="support">Conceptual layout</span></div>
    <div className="topology" role="group" aria-label="Conceptual layout: solar panels, home and battery connect to the central inverter. No measured energy flows or directions.">
      <div className="node solar-node"><Icon name="panel" /><span>Solar panels</span></div>
      <div className="node"><Icon name="inverter" /><span>Inverter</span></div>
      <div className="node home-node"><Icon name="house" /><span>Home</span></div>
      <div className="node node-battery"><Icon name="battery" /><span>Battery</span></div>
    </div>
    <p className="support installation-note">Connections are illustrative. Energy flows are not measured.</p>
  </section>
}
