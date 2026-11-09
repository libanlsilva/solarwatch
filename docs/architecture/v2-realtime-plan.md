# SolarWatch v0.2 — live telemetry plan

v0.1.0 is a pull-based MVP: the browser asks for readings on load and on manual Refresh, and the
simulator's continuous mode writes one generic reading per minute. v0.2 turns SolarWatch into a
live monitor: the installation streams readings, the API pushes them to the browser, and the
interface visibly reacts. This supersedes the v0.1.0 statement that SignalR is outside scope; the
other exclusions (hardware, authentication, multi-installation, alerts, forecasts, energy totals,
production deployment) stay out.

## Target architecture

```text
Simulator (residential-v1, 1–60 s) ──POST /api/readings──> API ──> PostgreSQL
                                                            │
                                                            └─ IReadingPublisher ──> SignalR hub /hubs/readings
                                                                                         │ WebSocket
                                                                                    React (live hook)
```

* Persistence stays the source of truth. The hub only announces readings that were committed.
* The browser keeps HTTP `/latest` and `/history`: they provide the initial state and the
  recovery path after a disconnect. Live events never replace the history window request.
* Delivery is best effort: a failed push never fails or rolls back ingestion.

## Deliveries (one issue, one branch, one squash PR each)

1. **Realistic continuous simulator.** `--continuous --profile residential-v1 --interval-seconds 1..60`.
   Instantaneous solar/home model shared with the history profile; battery continues from the
   latest stored charge so live and history data agree. Defaults of the legacy continuous mode stay.
2. **Electrical parameters.** Optional `gridVoltageV`, `gridFrequencyHz`, `inverterTemperatureC`,
   `batteryVoltageV` through domain, ingestion, latest/history, PostgreSQL migration (nullable
   columns, so v0.1 rows remain valid) and the simulator.
3. **SignalR hub.** `Application` port `IReadingPublisher`; `Api` implements it with
   `IHubContext`; event `reading` carries the same snapshot as `/latest`. Development-only scope
   inherited from ingestion. Tests: hub receives a committed reading, not a rejected/duplicate one.
4. **Live, animated and interactive interface.** `@microsoft/signalr` hook with
   connecting/live/reconnecting/offline states and resync on reconnect; animated metric values,
   animated power-flow diagram (solar → home / battery), live-appending charts with hover
   crosshair and tooltip, connection and freshness indicators. All motion honours
   `prefers-reduced-motion`; no information is conveyed by animation alone.
5. **Validation and release.** Full unit, integration and Playwright runs, updated README,
   screenshots and a v0.2.0 release record.

## Decisions

* **SignalR over raw WebSockets:** reconnection, serialization and transport fallback come with
  ASP.NET Core; the Vite dev proxy forwards `/hubs` with WebSocket upgrade.
* **Nullable electrical columns:** avoids rewriting history and keeps the 1,441-row reproducible
  profile unchanged and valid.
* **No new batching/aggregation:** a 1 s cadence is about 86,400 rows/day, acceptable for a
  local demo; retention and downsampling are out of scope.

## Acceptance for v0.2.0

* With the simulator running at 1–2 s, the Overview changes without any user action and shows a
  live connection state; stopping the API shows reconnecting/offline, restarting it resyncs.
* Charts respond to hover/focus/keyboard and gain new points live.
* Existing History semantics (windowing, gaps, selection) are unchanged.
* All suites pass in CI; documented limitations remain explicit.
