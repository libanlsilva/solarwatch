import { useCallback, useEffect, useRef, useState } from 'react'
import { isStale, parseLatestReading } from './readings.ts'
import type { LatestReadingResponse } from './readings.ts'

const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const dateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'medium',
})
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

export default function App() {
  const [snapshot, setSnapshot] = useState<LatestReadingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const request = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError(false)
    try {
      const response = await fetch('/api/readings/latest', {
        signal: controller.signal,
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('Reading request failed')
      const next = parseLatestReading(await response.json())
      if (!controller.signal.aborted) setSnapshot(next)
    } catch {
      if (!controller.signal.aborted) setError(true)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    return () => request.current?.abort()
  }, [refresh])

  const reading = snapshot?.reading
  const stale = snapshot !== null && isStale(snapshot)

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="SolarWatch home">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="16" cy="16" r="6" />
            <path d="M16 2v4m0 20v4M2 16h4m20 0h4M6 6l3 3m14 14 3 3M6 26l3-3M23 9l3-3" />
          </svg>
          SolarWatch
        </a>
        <span className="demo-label">
          <span /> Simulated data
        </span>
      </header>

      <main id="main-content">
        <div className="page-heading">
          <div>
            <p className="installation-label">Residential installation</p>
            <h1>Home energy</h1>
            <p className="intro">
              A clear view of your latest solar, home and battery readings.
            </p>
          </div>
          <button
            className="refresh-button"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" />
            </svg>
            {loading ? 'Refreshing…' : error ? 'Try again' : 'Refresh readings'}
          </button>
        </div>

        {error && (
          <div className="error-message" role="alert">
            <strong>Unable to {snapshot ? 'refresh' : 'load'} readings.</strong>{' '}
            {reading
              ? 'The previous reading is shown below and has not been verified again. '
              : 'Check the connection and try again. '}
            <button onClick={() => void refresh()}>Retry</button>
          </div>
        )}

        <section
          className="snapshot"
          aria-label="Latest measurement"
          aria-busy={loading}
        >
          <div className="snapshot-heading">
            <h2>{error && reading ? 'Previous reading' : 'Latest reading'}</h2>
            {reading && (
              <span
                className={`freshness ${stale ? 'stale' : ''}`}
                role="status"
              >
                <span />
                {stale ? 'Stale reading' : 'Fresh at last check'}
              </span>
            )}
          </div>

          {!snapshot && loading && (
            <div className="state-panel" role="status">
              <span className="loading-indicator" />
              Loading latest reading…
            </div>
          )}
          {!reading && !loading && error && (
            <div className="state-panel">
              <h3>Readings are unavailable</h3>
              <p>Try again when the connection is restored.</p>
            </div>
          )}
          {snapshot && !reading && !error && (
            <div className="state-panel">
              <div className="empty-symbol" aria-hidden="true">
                ☀
              </div>
              <h3>No measurements yet</h3>
              <p>
                Waiting for the first reading from this installation.
                <br />
                Refresh once data is available.
              </p>
            </div>
          )}

          {reading && snapshot && (
            <>
              <div className="measurement-grid">
                <div className="power-readings">
                  <div className="metric solar">
                    <p>Solar generation</p>
                    <div className="metric-value" data-testid="solar-power">
                      {number.format(reading.solarPowerW)} <span>W</span>
                    </div>
                    <span className="metric-note">Power from your panels</span>
                  </div>
                  <div className="metric consumption">
                    <p>Home consumption</p>
                    <div
                      className="metric-value"
                      data-testid="consumption-power"
                    >
                      {number.format(reading.consumptionPowerW)} <span>W</span>
                    </div>
                    <span className="metric-note">
                      Power your home is using
                    </span>
                  </div>
                </div>
                <div className="battery-reading">
                  <p>Battery charge</p>
                  <div className="battery-value" data-testid="battery-charge">
                    {number.format(reading.batteryStateOfChargePercent)}
                    <span>%</span>
                  </div>
                  <div
                    className="battery-track"
                    role="meter"
                    aria-label="Battery state of charge"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={reading.batteryStateOfChargePercent}
                  >
                    <span
                      style={{
                        width: `${reading.batteryStateOfChargePercent}%`,
                      }}
                    />
                  </div>
                  <span>State of charge</span>
                </div>
              </div>
              <div className="measurement-time">
                <div>
                  <p>Last measurement</p>
                  <time dateTime={reading.measuredAt}>
                    {dateTime.format(new Date(reading.measuredAt))}
                  </time>
                  <span className="timezone">{timeZone}</span>
                </div>
                <p className="check-time">
                  Status at last successful check
                  <br />
                  <time dateTime={snapshot.asOf}>
                    {dateTime.format(new Date(snapshot.asOf))}
                  </time>
                </p>
              </div>
              {stale && (
                <p className="stale-note">
                  This reading was more than five minutes old at the last check.
                  Refresh to check for a newer measurement.
                </p>
              )}
            </>
          )}
        </section>
        <p className="reading-help">
          Readings update when you refresh. Watts (W) show instantaneous power;
          battery charge (%) shows the remaining charge level.
        </p>
      </main>
      <footer>
        Solar panels, battery &amp; inverter{' '}
        <span>One home. One energy snapshot.</span>
      </footer>
    </div>
  )
}
