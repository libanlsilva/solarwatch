import { useCallback, useEffect, useRef, useState } from 'react'
import { DashboardHeader, ElectricalPanel, InstallationDiagram, MeasurementCard, MetricCard, QueryNotice } from './components/Overview.tsx'
import { HistoryCharts } from './components/HistoryCharts.tsx'
import { useLatestReading } from './useLatestReading.ts'
import { useHistory } from './useHistory.ts'
import { HistoryView } from './components/HistoryView.tsx'
import { LiveChart } from './components/LiveChart.tsx'
import { useLiveReadings } from './useLiveReadings.ts'
import { mergePoints, readLivePreference, writeLivePreference } from './liveStore.ts'
import type { Reading } from './readings.ts'
import { sectionFromHash } from './navigation.ts'

export default function App() {
  const [section, setSection] = useState(() => sectionFromHash(window.location.hash))
  const isHistory = section === 'history'
  const previousSection = useRef(section)
  const { snapshot, pending, error, refresh, applyLive } = useLatestReading(!isHistory)
  const history = useHistory()
  const refreshAvailable = () => { refresh(); history.refresh() }
  const [liveEnabled, setLiveEnabled] = useState(readLivePreference)
  const toggleLive = () => setLiveEnabled((value) => { writeLivePreference(!value); return !value })
  const [points, setPoints] = useState<Reading[]>([])
  const onLiveReading = useCallback((response: Parameters<typeof applyLive>[0]) => {
    applyLive(response)
    if (response.reading) setPoints((previous) => mergePoints(previous, [response.reading!]))
  }, [applyLive])
  // After every (re)connect, resynchronize over HTTP: events missed while offline are not replayed.
  const liveStatus = useLiveReadings(liveEnabled, onLiveReading, refreshAvailable)
  useEffect(() => {
    const updateSection = () => setSection(sectionFromHash(window.location.hash))
    window.addEventListener('hashchange', updateSection)
    return () => window.removeEventListener('hashchange', updateSection)
  }, [])
  useEffect(() => {
    if (section === 'installation') document.getElementById('installation')?.scrollIntoView()
    else window.scrollTo(0, 0)
    if ((previousSection.current === 'history') !== isHistory) document.getElementById('main-content')?.focus({ preventScroll: true })
    previousSection.current = section
  }, [section, isHistory])
  const reading = snapshot?.reading ?? null
  const historyReadings = history.snapshot?.readings
  useEffect(() => {
    if (historyReadings?.length) setPoints((previous) => mergePoints(previous, historyReadings.slice(-30)))
  }, [historyReadings])
  const skeleton = pending && !snapshot

  return (
    <>
      <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>Skip to content</a>
      <div className={`dashboard-shell ${isHistory ? 'history-shell' : ''}`} id={isHistory ? 'history' : 'overview'}>
        <img className="hero-photo" src="/images/solar-house.png" alt="Illustrative home with rooftop solar panels at dusk, not a camera feed." />
        <div className="photo-veil" aria-hidden="true" />
        <DashboardHeader pending={isHistory ? history.pending : pending || history.pending} disabled={isHistory ? history.pending : pending && history.pending} error={isHistory ? history.error : error} refresh={isHistory ? history.refresh : refreshAvailable} section={section} liveStatus={liveStatus} liveEnabled={liveEnabled} toggleLive={toggleLive} />
        {isHistory ? <HistoryView {...history} /> : <main className="overview-grid" id="main-content" tabIndex={-1}>
          <div className="overview-left">
            <section className="hero" aria-labelledby="overview-title">
              <div className="context-row"><span className="installation-id">Residential demo</span><span className="simulated mobile-simulated"><span className="dot" />Simulated data</span></div>
              <h1 id="overview-title">Your home,<br />in full view.</h1>
              <p className="hero-copy"><span className="desktop-copy">Solar generation, home consumption<br />and battery. All in one place.</span><span className="mobile-copy">Solar, home and battery.<br />A clearer picture of your home.</span></p>
              <QueryNotice snapshot={snapshot} pending={pending} error={error} />
            </section>
            <div className="metric-pair" aria-label="Latest instantaneous power" aria-busy={pending}>
              <MetricCard kind="solar" value={reading?.solarPowerW} skeleton={skeleton} />
              <MetricCard kind="home" value={reading?.consumptionPowerW} skeleton={skeleton} />
            </div>
            <InstallationDiagram reading={reading} live={liveStatus === 'live'} />
          </div>
          <div className="overview-right">
            <LiveChart points={points} status={liveStatus} />
            <ElectricalPanel reading={reading} />
            <MeasurementCard snapshot={snapshot} pending={pending} error={error} />
            <HistoryCharts snapshot={history.snapshot} pending={history.pending} error={history.error} retry={history.refresh} />
          </div>
        </main>}
      </div>
      <footer className="app-footer">Simulated residential installation <span>{liveEnabled ? 'Readings stream live; Refresh resynchronizes.' : 'Live updates are paused. Readings update when you refresh.'}</span></footer>
    </>
  )
}
