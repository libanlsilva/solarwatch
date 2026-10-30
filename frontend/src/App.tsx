import { useEffect, useState } from 'react'
import { DashboardHeader, InstallationDiagram, MeasurementCard, MetricCard, QueryNotice } from './components/Overview.tsx'
import { HistoryCharts } from './components/HistoryCharts.tsx'
import { useLatestReading } from './useLatestReading.ts'
import { useHistory } from './useHistory.ts'

export default function App() {
  const { snapshot, pending, error, refresh } = useLatestReading()
  const history = useHistory()
  const refreshAvailable = () => { refresh(); history.refresh() }
  const [section, setSection] = useState<'overview' | 'installation'>(() => window.location.hash === '#installation' ? 'installation' : 'overview')
  useEffect(() => {
    const updateSection = () => setSection(window.location.hash === '#installation' ? 'installation' : 'overview')
    window.addEventListener('hashchange', updateSection)
    return () => window.removeEventListener('hashchange', updateSection)
  }, [])
  const reading = snapshot?.reading ?? null
  const skeleton = pending && !snapshot

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="dashboard-shell" id="overview">
        <img className="hero-photo" src="/images/solar-house.png" alt="Illustrative home with rooftop solar panels at dusk, not a camera feed." />
        <div className="photo-veil" aria-hidden="true" />
        <DashboardHeader pending={pending || history.pending} disabled={pending && history.pending} error={error} refresh={refreshAvailable} section={section} />
        <main className="overview-grid" id="main-content" tabIndex={-1}>
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
        </main>
      </div>
      <footer className="app-footer">Simulated residential installation <span>Readings update only when you refresh.</span></footer>
    </>
  )
}
