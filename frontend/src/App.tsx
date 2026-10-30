import { useEffect, useRef, useState } from 'react'
import { DashboardHeader, InstallationDiagram, MeasurementCard, MetricCard, QueryNotice } from './components/Overview.tsx'
import { HistoryCharts } from './components/HistoryCharts.tsx'
import { useLatestReading } from './useLatestReading.ts'
import { useHistory } from './useHistory.ts'
import { HistoryView } from './components/HistoryView.tsx'
import { sectionFromHash } from './navigation.ts'

export default function App() {
  const [section, setSection] = useState(() => sectionFromHash(window.location.hash))
  const isHistory = section === 'history'
  const previousSection = useRef(section)
  const { snapshot, pending, error, refresh } = useLatestReading(!isHistory)
  const history = useHistory()
  const refreshAvailable = () => { refresh(); history.refresh() }
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
  const skeleton = pending && !snapshot

  return (
    <>
      <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>Skip to content</a>
      <div className={`dashboard-shell ${isHistory ? 'history-shell' : ''}`} id={isHistory ? 'history' : 'overview'}>
        <img className="hero-photo" src="/images/solar-house.png" alt="Illustrative home with rooftop solar panels at dusk, not a camera feed." />
        <div className="photo-veil" aria-hidden="true" />
        <DashboardHeader pending={isHistory ? history.pending : pending || history.pending} disabled={isHistory ? history.pending : pending && history.pending} error={isHistory ? history.error : error} refresh={isHistory ? history.refresh : refreshAvailable} section={section} />
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
            <InstallationDiagram />
          </div>
          <div className="overview-right">
            <MeasurementCard snapshot={snapshot} pending={pending} error={error} />
            <HistoryCharts snapshot={history.snapshot} pending={history.pending} error={history.error} retry={history.refresh} />
          </div>
        </main>}
      </div>
      <footer className="app-footer">Simulated residential installation <span>Readings update only when you refresh.</span></footer>
    </>
  )
}
