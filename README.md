# SolarWatch

An open-source residential solar energy monitoring and analytics platform built with ASP.NET Core and React.

**Status: Early Development.** Phase 2 completed through [PR #5](https://github.com/libanlsilva/solarwatch/pull/5): PostgreSQL → .NET API → React displays one simulated installation's latest reading. **Phase 3 is complete:** finite HTTP simulation through [PR #7](https://github.com/libanlsilva/solarwatch/pull/7) / [Issue #6](https://github.com/libanlsilva/solarwatch/issues/6), continuous simulation through [PR #9](https://github.com/libanlsilva/solarwatch/pull/9) / [Issue #8](https://github.com/libanlsilva/solarwatch/issues/8), and full reproducible 24-hour preparation through reviewed integration of [PR #11](https://github.com/libanlsilva/solarwatch/pull/11) / [Issue #10](https://github.com/libanlsilva/solarwatch/issues/10). **Phase 4 is complete with the reviewed squash integration of [PR #13](https://github.com/libanlsilva/solarwatch/pull/13):** the owner definitively approved the four Overview/History desktop/mobile prototypes, all seven interface states, the reusable system and the publication package. The [design handoff](docs/design/README.md) remains the reference for future implementation. **Phase 5 is in progress:** its first delivery, [Issue #14](https://github.com/libanlsilva/solarwatch/issues/14), is personally approved and complete with reviewed squash integration of [PR #15](https://github.com/libanlsilva/solarwatch/pull/15): the approved responsive Overview uses real latest-reading data. The second delivery, [Issue #16](https://github.com/libanlsilva/solarwatch/issues/16), is personally approved and complete with reviewed squash integration of [PR #17](https://github.com/libanlsilva/solarwatch/pull/17): the real 24-hour history API. The third delivery, [Issue #18](https://github.com/libanlsilva/solarwatch/issues/18), is personally approved and complete with reviewed squash integration of [PR #19](https://github.com/libanlsilva/solarwatch/pull/19): real Overview history charts. **Phase 5 and the MVP remain incomplete.** The fourth delivery, [Issue #20](https://github.com/libanlsilva/solarwatch/issues/20), is personally approved and complete with reviewed squash integration of [PR #21](https://github.com/libanlsilva/solarwatch/pull/21): responsive read-only History (delivery A). The fifth delivery, owner-approved [Issue #22](https://github.com/libanlsilva/solarwatch/issues/22), is complete through the personally approved squash integration of [PR #23](https://github.com/libanlsilva/solarwatch/pull/23): synchronized History inspection. Combined final validation and local release work remain pending.

## Goals and motivation

SolarWatch makes solar generation, household energy consumption, and battery charge easier to understand. It is developed incrementally as a Full Stack portfolio project, with small reviewed deliveries, explicit requirements, meaningful tests, and reproducible local setup.

## Implemented in this delivery

- One residential demo installation with panels, a battery, and an inverter, using simulated readings.
- EF Core migration and PostgreSQL persistence for reading snapshots.
- A latest-reading API returning generation (W), consumption (W), battery state of charge (%), measurement time, and server reference time (`asOf`).
- A read-only 24-hour history API with one pre-query UTC reference, inclusive microsecond bounds, chronological persisted rows, empty/partial results and sanitized database errors. Overview and the dedicated History screen share its independent request owner.
- The approved desktop/mobile React Overview: solar photograph, asymmetric metric cards, battery gauge, local measurement/check times, conceptual installation and compact responsive navigation.
- Manual refresh with loading skeletons, empty, error/retry, refreshing, retained-data and stale-data states; single-flight requests and cancellation protect against obsolete responses.
- Real 24-hour Overview plots: solar generation (solid yellow) and consumption (dashed teal) in W, plus battery charge (lime) on its own 0–100% scale.
- Original UTC timestamps, server window/reference, elapsed-time positions, real zeros and irregular readings are preserved. Gaps over five minutes break strokes/fills; uncovered edges are not extrapolated.
- Independent latest/history loading, empty, error/retry, refreshing and retained states; shared Refresh updates each non-pending resource, and History Retry targets only History.
- Real responsive History navigation with direct entry/reload, Back/Forward and working Overview/Installation links. History uses the approved dedicated desktop/mobile composition and a shared **Selected reading** panel sourced exclusively from its own response.
- Exact-observation selection preserves UTC microseconds; UTC-minute inspection resolves the latest row in that minute, qualifies multiple readings and explicitly leaves missing minutes unavailable. Both plots share the panel, keyboard inspection, minute buttons and mobile slider.
- History-only manual Refresh, independent query retention, server window/reference and actual missing-interval coverage; navigation reuses the current request/snapshot without refetching.
- Freshness based on `asOf`, with readings older than five minutes labeled stale at the last successful check.
- Development-only migration, current-time or controlled-time seed, and explicitly confirmed demo-clear commands.
- A local Development-only ingestion endpoint with field validation and PostgreSQL-enforced duplicate conflicts, including concurrent requests.
- A finite .NET HTTP simulator with reproducible seed/timestamps, server-based current time, bounded batches, and explicit acceptance/rejection/error reporting.
- Optional continuous execution with an immediate reading, 60-second cadence, fresh server `asOf` per sample, and controlled Ctrl+C shutdown.
- A separate bounded `--history-24h` mode submitting exactly 1,441 reproducible minute samples through the existing API, with explicit conflicts and partial/uncertain-run reporting.
- Meaningful backend unit tests, real PostgreSQL integration tests, frontend unit tests, and Playwright browser tests, executed in CI.

The generated weather endpoint and empty template classes/tests have been removed. Finite simulation remains the default; the separate development seed remains available.

![Implemented Overview — real API/PostgreSQL simulated history](docs/screenshots/overview-charts-desktop.png)

[Mobile initial view](docs/screenshots/overview-charts-mobile.png) · [Complete mobile view](docs/screenshots/overview-charts-mobile-full.png)

Captured from the production frontend preview connected to the real API and dedicated PostgreSQL E2E database after the existing full-history CLI journey. Readings are simulated and persisted, not frontend fixtures. See the [chart implementation and visual comparison](docs/architecture/overview-charts.md) for scope, checks, bundle measurements and differences; the earlier Overview captures remain versioned.

![Implemented History — real API/PostgreSQL simulated readings](docs/screenshots/history-desktop.png)

[History mobile initial view](docs/screenshots/history-mobile.png) · [Complete mobile History](docs/screenshots/history-mobile-full.png) · [Partial History](docs/screenshots/history-partial-desktop.png)

History delivery A uses the same real Full Stack journey for its captures. These captures record its historical read-only scope before delivery B. See the [History implementation and visual comparison](docs/architecture/history-view.md).

![History delivery B — shared selection from persisted readings](docs/screenshots/history-interactive-selected-desktop.png)

[Selected reading on mobile](docs/screenshots/history-interactive-selected-mobile-full.png) · [Missing minute on desktop](docs/screenshots/history-interactive-missing-desktop.png) · [Missing minute on mobile](docs/screenshots/history-interactive-missing-mobile-full.png)

Delivery B captures show five real API/PostgreSQL simulated observations, including zero and two records within one millisecond. Large gaps and unavailable-minute values are intentional; no illustrative curve is presented as real. The [selection implementation record](docs/architecture/history-selection.md) documents the approved temporal rules, interactions, reconciliation and visual comparison.

## Planned functionality

The approved dashboard prototypes guide Phase 5 in small reviewed deliveries: the integrated responsive Overview uses Latest Reading; Issue #16 / PR #17 completes the integrated history API. Issue #18 / PR #19 completes the integrated real Overview charts. Issue #20 completes responsive read-only History delivery A with reviewed squash integration of [PR #21](https://github.com/libanlsilva/solarwatch/pull/21). The owner approved Issue #22 and its exact selection/reconciliation rules. Delivery B is complete through the personally approved squash integration of [PR #23](https://github.com/libanlsilva/solarwatch/pull/23). The next delivery, [Issue #24](https://github.com/libanlsilva/solarwatch/issues/24), proposes combined Phase 5 validation of responsive behavior, accessibility, navigation, states and interactions; it is prepared for owner review only and has not started. Phase 5 and the local MVP release remain pending. Hardware integration, authentication, multiple users/installations, SignalR, alerts, forecasts, accumulated-energy calculations, and production deployment remain outside this MVP.

Instantaneous power is measured in **W**. Accumulated energy is measured in **Wh/kWh**; 1 kWh = 1,000 Wh. This delivery does not calculate energy totals from power samples or convert battery charge percentage into stored energy.

## Technology stack

| Area | Technology | State |
| --- | --- | --- |
| Backend | ASP.NET Core 10, C# | Latest-reading and 24-hour history APIs, local ingestion, development commands, and .NET simulator |
| Persistence | EF Core, Npgsql, PostgreSQL 17 | Migration and real persistence |
| Frontend | React, TypeScript, Vite | Approved responsive Overview and interactive History connected to the existing APIs |
| UI/charts | Plain CSS, inline SVG and Recharts 3.10.1 with matching react-is peer | Shared real charts; no UI framework/router added; History has shared exact-record / UTC-minute selection |
| Testing | xUnit, Node.js test runner, Playwright | Unit, PostgreSQL integration, and Chromium E2E tests |
| Infrastructure | Docker Compose, GitHub Actions | PostgreSQL service; backend, frontend, and Full Stack E2E workflows |
| Real-time updates | SignalR | Later enhancement; current refresh is manual |

## Architecture and structure

```text
React → GET /api/readings/latest + /api/readings/history → Application queries → PostgreSQL store → PostgreSQL
Simulator → local POST /api/readings → Application validation → PostgreSQL insert

Api → Application, Infrastructure
Application → Domain
Infrastructure → Application, Domain
UnitTests → Domain, Application
UnitTests → Simulator (for generation and HTTP-runner tests)
Simulator → Application (shared contracts), Domain transitively
IntegrationTests → Api (including its real PostgreSQL infrastructure)
IntegrationTests → Simulator (for scheduled HTTP / PostgreSQL verification)
```

The Domain owns reading validation. Application defines query/ingestion services and a single purpose-built storage contract. Infrastructure supplies EF Core and its implementation; Api composes the services. The simulator uses HTTP and shared contracts without database access. There is no generic repository framework or messaging layer.

```text
solarwatch/
├── .github/workflows/           # Backend, frontend, and Full Stack E2E CI
├── backend/
│   ├── src/
│   │   ├── SolarWatch.slnx
│   │   ├── SolarWatch.Api/      # Endpoint, development commands, Dockerfile
│   │   ├── SolarWatch.Application/
│   │   ├── SolarWatch.Domain/
│   │   └── SolarWatch.Infrastructure/ # DbContext, store, migrations
│   └── tests/
│       ├── SolarWatch.UnitTests/
│       └── SolarWatch.IntegrationTests/
├── frontend/
│   ├── src/
│   ├── tests/unit/
│   ├── tests/e2e/
│   └── playwright.config.ts
├── docs/
│   ├── DEVELOPMENT_PLAN.md
│   ├── requirements/MVP.md
│   ├── architecture/               # Latest-reading and ingestion contracts
│   └── screenshots/
├── simulator/SolarWatch.Simulator/ # Finite, continuous, and 24-hour HTTP generation
├── docker-compose.yml
├── dotnet-tools.json
├── .env.example
├── CONTRIBUTING.md
└── LICENSE
```

See the [latest-reading contract](docs/architecture/latest-reading.md), [24-hour history contract](docs/architecture/reading-history.md), [ingestion/simulator contract](docs/architecture/simulated-ingestion.md), [approved MVP](docs/requirements/MVP.md), and [development plan](docs/DEVELOPMENT_PLAN.md).

## Approved dashboard design and implementation

The [approved design references](docs/design/README.md) include Overview and History on desktop/mobile and seven interface states. [DESIGN.md](docs/design/DESIGN.md) records exact styles, reusable component responsibilities, independent query states, accessibility decisions and implementation recommendations. The [asset record](docs/design/ASSETS.md) documents publication permission for the supplied photograph; the external Ekova reference is excluded. Phase 4 completes with [PR #13](https://github.com/libanlsilva/solarwatch/pull/13); implementing the approved dashboard belongs to Phase 5. The first Phase 5 delivery implements Overview from Desktop v2 and Mobile v1, with all values from the existing API. Issue #20 delivers the approved read-only History composition through reviewed [PR #21](https://github.com/libanlsilva/solarwatch/pull/21) integration; synchronized selection remains future work. Frozen prototype fixture scripts are never runtime code. The local setup below is unchanged.

## Local setup

Prerequisites: .NET 10 SDK, Node.js 24 with npm, Git, Docker with Linux containers, and access to NuGet/npm. Compose runs PostgreSQL only; the API and frontend run on the host.

### 1. Start PostgreSQL and configure the API

Copy `.env.example` to `.env`, set a non-empty local `POSTGRES_PASSWORD`, and keep that populated file untracked. The default database port is 5434, bound to loopback. Compose preserves data in a named volume.

```sh
docker compose up -d --wait postgres
```

Compose reads `.env`; ASP.NET Core does not automatically read it. In PowerShell, from the repository root, load the same local values into the current session:

```powershell
$localConfig = Get-Content .env | ConvertFrom-StringData
$env:ConnectionStrings__SolarWatch = "Host=127.0.0.1;Port=$($localConfig.POSTGRES_PORT);Database=solarwatch;Username=solarwatch;Password=$($localConfig.POSTGRES_PASSWORD)"
$env:ASPNETCORE_ENVIRONMENT = 'Development'
```

For Bash, set `ConnectionStrings__SolarWatch` to the equivalent local connection string and `ASPNETCORE_ENVIRONMENT=Development` using your local secret values. ASP.NET Core user secrets are also supported. Never commit populated connection strings or print credentials in logs.

### 2. Build, migrate, seed, and run the API

```sh
dotnet restore backend/src/SolarWatch.slnx
dotnet build backend/src/SolarWatch.slnx --configuration Release --no-restore
dotnet run --project backend/src/SolarWatch.Api --configuration Release --no-build --no-launch-profile -- migrate
dotnet run --project backend/src/SolarWatch.Api --configuration Release --no-build --no-launch-profile -- seed-demo
dotnet run --project backend/src/SolarWatch.Api --configuration Release --no-build --launch-profile http
```

The API runs at `http://localhost:5171`. Development OpenAPI JSON is at `/openapi/v1.json`; there is no Swagger UI. The app does not automatically migrate or seed during normal startup.

`seed-demo` inserts 1,200 W generation, 800 W consumption, and 65% charge at the **current server UTC time**, allowing a fresh demo. To prepare a repeatable historical/stale example:

```sh
dotnet run --project backend/src/SolarWatch.Api --configuration Release --no-build --no-launch-profile -- seed-demo --measured-at 2026-10-01T12:00:00Z
```

Timestamps need an explicit UTC/offset designation and cannot be in the future. Repeating the same controlled timestamp does not duplicate it. An older seed does not supersede a newer measurement; use an empty development database for a controlled stale-only demonstration.

To demonstrate an empty state, `clear-demo --confirm` deletes this installation's readings from the configured database. It requires explicit confirmation and the Development environment. Migration/seeding/clearing commands all refuse to run outside Development. Do not point these development commands at valuable data.

### 3. Run React

In a second terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open the address printed by Vite, normally `http://localhost:5173`. Its `/api` proxy defaults to `http://127.0.0.1:5171`. Set `SOLARWATCH_API_URL` before starting Vite if the API uses another address. The same proxy works with `npm run preview` after a production build.

Readings refresh on load and on request. The freshness badge reports the state at the last successful server check, not a continuously updated or browser-clock-based status. Display times use the browser's identified local zone.

Open **History** in the navigation or enter `http://localhost:5173/#history` directly. It shows the server's 24-hour window, real power/battery plots, missing intervals and Selected reading, initially the latest persisted observation **inside that history response**. Its Refresh/Retry updates only History; returning to Overview reuses the current data. A direct History entry does not request Latest Reading. Click/tap an identifiable plotted point or focus either plot and use Left/Right (recorded observations), Home/End (first/last). The −1/+1 buttons and mobile slider inspect UTC minutes, including missing ones; multiple readings resolve to the latest measured time unless an exact observation was explicitly selected. Inspection makes no API requests. Refresh reconciles the current selection; failures retain the original data/window/reference. See the [delivery B selection record](docs/architecture/history-selection.md) for ambiguity, boundaries, DST and reconciliation rules.

### 4. Generate readings and refresh React

After migration, with the Development API and React running, execute from a third terminal at the repository root:

```sh
dotnet run --project simulator/SolarWatch.Simulator --configuration Release --no-build -- --count 10 --seed 42
```

The simulator reads the API's `asOf`, submits ten synthetic readings one minute apart, and terminates. Press **Refresh** in React to see the latest accepted values and timestamp. The browser does not refresh automatically.

For a reproducible controlled batch (choose a past instant):

```sh
dotnet run --project simulator/SolarWatch.Simulator --configuration Release --no-build -- --api-url http://127.0.0.1:5171 --count 3 --seed 42 --end-at 2026-10-01T12:00:00Z
```

Repeat that command to see three HTTP 409 rejections without overwriting rows. A controlled old batch displays stale data only when no newer measurement exists; the simulator never clears your database. To demonstrate stale data from a clean local demo, explicitly run the documented `clear-demo --confirm` helper before the controlled batch, then generate a current batch and manually refresh.

Defaults: count 10, seed 42, API `http://127.0.0.1:5171`, ending instant from server `asOf`. `--count` accepts 1–120, `--seed` accepts a signed 32-bit integer, and `--end-at` requires an explicit UTC/offset timestamp no later than server time. `--help` prints all options. The solution build includes the simulator. Values are synthetic power (W) and charge (%), not a physical or energy model.

For opt-in continuous execution, run this command instead of a finite batch:

```sh
dotnet run --project simulator/SolarWatch.Simulator --configuration Release --no-build -- --continuous --api-url http://127.0.0.1:5171 --seed 42
```

The first reading is submitted immediately after querying server `asOf`. Subsequent iterations target a 60-second cadence, with one active GET/POST sequence at a time. Slow work skips elapsed minute slots; late timer wake-ups start a new cadence rather than producing closely spaced catch-up requests. Every reading gets a new server reference; the local clock only controls elapsed waiting. React continues updating only when you press **Refresh**.

Stop with **Ctrl+C**. A normal stop while waiting or fetching the reference exits 0 with no pending write. Cancellation during an unacknowledged POST reports uncertainty and exits 1; the row may already exist. Continuous mode stops on any 400/409 rejection, unexpected HTTP status, malformed reference/acknowledgment, timeout, or network error. Its summary reports attempted/accepted/rejected/error/uncertain counts. There are no automatic retries or catch-up batches. A seed reproduces the value sequence for equivalent iterations; live timestamps come from the API and are not a deterministic historical batch. `--count` and `--end-at` cannot be combined with `--continuous`; invalid combinations fail before contacting the API.

The finite-mode summary reports requested/attempted/accepted/rejected/error/unattempted counts. Exit 0 means all requested readings were acknowledged; invalid options, any rejection, or errors yield exit 1. 400/409 rejections still allow the finite run to continue; unexpected HTTP/network/acknowledgment errors stop it without automatic retries. A failed acknowledgment may follow a persisted write, so inspect the API before retrying.

### 5. Prepare a reproducible full 24-hour history

With the same Development API and PostgreSQL running, choose an explicit past reference instant:

```sh
dotnet run --project simulator/SolarWatch.Simulator --configuration Release --no-build -- --history-24h --end-at 2026-10-01T12:00:00Z --seed 42
```

This independent mode submits **1,441 readings** in ascending order over the inclusive UTC window `[T - 24 hours, T]`, one minute apart: 1,440 intervals and both endpoints. There is no waiting between historical samples. Equivalent UTC/offset references and the same seed reproduce the same logical readings on .NET 10. The original reference must not exceed server `asOf`; accepted timestamps normalize to PostgreSQL microseconds without rounding to midnight or minute boundaries. `--end-at` is required; `--count` and `--continuous` are incompatible with `--history-24h`. The existing finite 1–120 bound and continuous behavior remain unchanged.

For an empty selected range, success confirms all 1,441 samples. Rerunning the command reports HTTP 409 conflicts and exit 1 without overwriting. A partially populated range fills missing instants but reports occupied ones as conflicts; the result cannot be claimed to match the requested seed if pre-existing values differ. Other pre-existing timestamps, including off-cadence samples, are retained. The CLI reports its requested instants, not an inventory of all stored rows in the window. A newer outside reading remains the latest. The simulator never clears/resets data: a clean deterministic fixture needs an empty range or an explicitly confirmed, separately executed `clear-demo --confirm` helper in a disposable local demo database.

The summary reports requested/attempted/accepted/rejected/**conflicts**/errors/**uncertain**/unattempted counts and `elapsedSeconds`. Conflicts are included in rejected; uncertain attempts are neither accepted nor rejected. Exit 0 requires all 1,441 validated acknowledgments. Known 400/409 rejections continue; unexpected status, network/timeout/acknowledgment errors stop without retrying. Ctrl+C is supported: an incomplete run exits 1, and an outstanding unacknowledged POST is reported as uncertain because it may already have persisted. Each POST is atomic; the whole run is not one transaction. History preparation does not add a history query or chart to React; use **Refresh** to see the latest persisted snapshot.

**Local writes only:** `POST /api/readings` is absent outside Development and rejects non-loopback peers/hosts, forwarded requests, and non-local browser origins. Point the CLI directly at a loopback-bound API; it accepts no public URL or database credentials. Keep Development private: do not expose it through public listeners, reverse proxies, or tunnels. This guard does not replace authentication. See the [POST contract and limitations](docs/architecture/simulated-ingestion.md).

### 6. Query the persisted last 24 hours

With the Development API running, query the new read-only endpoint:

```powershell
$history = Invoke-RestMethod http://localhost:5171/api/readings/history
$history | Select-Object asOf, from, to
$history.readings.Count
$history.readings | Select-Object -First 5 measuredAt, solarPowerW, consumptionPowerW, batteryStateOfChargePercent
```

The window is `[asOf - 24 hours, asOf]`, using one normalized UTC server reference captured before the query. Results are chronological persisted readings only; missing minutes remain absent and actual zeros remain zero. Empty results return HTTP 200 with `readings: []`; database failures return sanitized HTTP 503 Problem Details.

The query has no client-selectable dates. A live query's window advances after a simulator run, so its count need not equal the generator's 1,441 samples; there is no artificial result cap. See the [history contract and reproducible examples](docs/architecture/reading-history.md). Overview now queries History independently, using manual Refresh and actual server data. A single seed appears as a historical point; prepare a full range with the simulator to see the complete recorded pattern. See the [Overview chart implementation](docs/architecture/overview-charts.md) for states and limitations.

## Validation

### Backend unit and real PostgreSQL integration tests

Integration tests require `SOLARWATCH_TEST_CONNECTION` and refuse a database name that does not end in `_tests`. They migrate and clear the dedicated test database; they never silently skip missing infrastructure. The configured PostgreSQL role must be able to create the dedicated database if it does not exist.

In the PowerShell session configured above:

```powershell
$env:SOLARWATCH_TEST_CONNECTION = $env:ConnectionStrings__SolarWatch.Replace('Database=solarwatch;', 'Database=solarwatch_tests;')
dotnet test backend/src/SolarWatch.slnx --configuration Release --no-build --no-restore
```

To run only unit tests without PostgreSQL, target `backend/tests/SolarWatch.UnitTests` explicitly. The solution command intentionally includes the database tests.

### Frontend and browser tests

```sh
cd frontend
npm ci
npm run lint
npm run build
npm run test:unit
npx playwright install --no-shell chromium
```

Before `npm run test:e2e`, set `SOLARWATCH_E2E_CONNECTION` to a dedicated database ending in `_e2e`. In PowerShell, using the earlier local API configuration:

```powershell
$env:SOLARWATCH_E2E_CONNECTION = $env:ConnectionStrings__SolarWatch.Replace('Database=solarwatch;', 'Database=solarwatch_e2e;')
npm run test:e2e
```

Build the Release solution first, including the API and simulator. Playwright launches its own API on port 5181 and Vite preview on port 4181; those ports must be free. It migrates the E2E database and clears its demo readings before each test. Ingestion tests run the actual finite and continuous CLI, verify persisted data, manual discovery in React, and duplicate conflicts. Linux CI sends SIGINT to verify graceful continuous shutdown; Node cannot deliver console Ctrl+C on Windows, so local Windows browser cleanup terminates the child process. Cancellation and later scheduled iterations are also verified with controlled-time unit/PostgreSQL tests on both platforms, without real-minute waits. Success journeys use the real API/database; controlled responses also cover loading/failure and the exact 300-second freshness boundary. Browser clocks are deliberately shifted in freshness tests.

GitHub Actions runs backend tests against PostgreSQL, frontend lint/build/unit tests, and the full browser suite in a separate PostgreSQL-backed job. CI uses trust authentication only for disposable test services; local Compose requires a password. Browser failure traces are uploaded for diagnosis.

The history integration tests verify all 1,441 stored keys/values, both boundaries, minute spacing, full identical and changed-seed reruns, partial ranges, a newer outside reading, and interruption after a committed POST before acknowledgment. The browser test runs the actual CLI for a full preparation and repeat against the real API/PostgreSQL, verifies the reported sample count and every timestamp, then checks React manual refresh. No bulk/test-only endpoint is used. History requests are bounded to 90 seconds per browser command; CI job timeouts remain 15 minutes. Expected EF duplicate-error diagnostics are suppressed only in the history test hosts/browser configuration; HTTP status, count, and persistence assertions remain active.

Local history-delivery validation on Windows, .NET 10, Node 24, and PostgreSQL 17 (Compose): **110 .NET unit tests, 50 real PostgreSQL integration tests, 4 frontend unit tests, and 8 Playwright tests passed**; restore/Release build and frontend lint/build passed.

Issue #14 Overview validation: **110 .NET unit, 50 PostgreSQL integration, 13 frontend unit and 15 Playwright tests passed**; restore/Release build and frontend lint/production build passed. Browser coverage includes the approved layout, navigation, all latest-reading states, zero values, retained server references, pending duplicate prevention, responsive widths, reduced motion and text enlargement. See the [implementation record](docs/architecture/overview-ui.md) for evidence and limitations.

Issue #16 history-query validation: **116 .NET unit, 56 real PostgreSQL integration, 13 frontend unit and 15 Playwright tests passed** (200 total, no skips); restore/Release build and frontend lint/build passed. New tests verify the single pre-query reference, UTC/microsecond normalization, inclusive boundaries and adjacent exclusions, ordering, zeros, gaps, 1,441 samples plus an additional off-cadence sample, sanitized errors and cancellation of a real blocked PostgreSQL query. Existing CI commands discover the new tests without workflow changes. See the [history implementation record](docs/architecture/reading-history.md).

Issue #18 Overview-chart validation: **116 backend unit, 56 real PostgreSQL integration, 29 frontend unit and 21 Playwright tests pass** (222 total, no skips); frontend lint/production build pass. The new cases verify microsecond-preserving validation, real elapsed-time SVG geometry, strict gap segmentation, independent request states/retention, eligible-resource Refresh, recorded-reading keyboard/touch behavior and chart-module failure containment. The existing full-history CLI test supplies actual desktop/mobile captures and verifies every returned sample is drawn. See the [chart record](docs/architecture/overview-charts.md) for bundle measurements, visual differences and limits.

Issue #20 read-only History validation: **116 backend unit, 56 real PostgreSQL integration, 33 frontend unit and 26 Playwright tests pass** (231 total, no skips). Restore/Release build and frontend lint/build pass. New cases cover direct/reload/Back/Forward navigation, deferred Latest acquisition, shared History ownership, new persisted readings on manual Refresh, exact retained/empty context, errors/retry, real chart geometry, keyboard/touch, all six responsive widths and short-phone plot reachability. The [History record](docs/architecture/history-view.md) includes actual captures, intentional delivery A differences, measurements and local validation details. The three existing workflows discover these tests automatically; Phase 5 and the MVP remain open.

Issue #22 History delivery B validation: **116 backend unit, 56 real PostgreSQL integration, 46 frontend unit and 32 Playwright tests pass** (250 total, no skips; all 231 baseline cases remain active). Restore/Release build and frontend lint/build pass. Added cases cover exact/microsecond identity, UTC-minute membership, zeros/gaps, multiple readings, DST, refresh reconciliation including user input while pending, synchronized mouse/keyboard/touch, geometry, responsive/short-phone access and 200% HTML text enlargement. See the [selection record](docs/architecture/history-selection.md) for captures, local timings and limits. Existing workflows discover the tests automatically. Delivery B is personally approved and complete through squash integration of [PR #23](https://github.com/libanlsilva/solarwatch/pull/23); Phase 5 and the MVP remain open pending their separate acceptance/release work.

| Measured scenario (1,441 individual POSTs per run) | Fresh preparation | Identical conflict-only repeat |
| --- | --- | --- |
| Integration HTTP TestServer + real PostgreSQL | 5.806 s | 3.312 s |
| Actual CLI + Kestrel/PostgreSQL in Playwright | 13.378 s | 15.354 s |

These are individual local validation measurements, not benchmarks or performance guarantees. `elapsedSeconds` covers reference lookup, sequential submissions/acknowledgments, and CLI reporting; API/database startup and migrations are prepared separately. CI executes the same full-series/rerun checks and records its own measured browser-command times.

## Development roadmap

0. **Foundation complete:** initial structure and CI.
1. **Product definition complete:** approved residential MVP integrated through PR #3.
2. **Persisted latest reading complete:** PR #5 integrated PostgreSQL → API → React, development commands, state handling, and tests.
3. **Simulated ingestion complete:** finite, continuous, and reproducible 24-hour preparation integrated through PR #7 / Issue #6, PR #9 / Issue #8, and PR #11 / Issue #10, with validation, safe conflicts, and automated verification.
4. **Dashboard visual design complete:** PR #13 / Issue #12 integrated the four personally approved prototypes, seven interface states, reusable system and authorized assets.
5. **Approved dashboard implementation in progress:** the first delivery, [Issue #14](https://github.com/libanlsilva/solarwatch/issues/14), is complete with reviewed squash integration of [PR #15](https://github.com/libanlsilva/solarwatch/pull/15): shared responsive structure and the approved Overview using real latest readings. Phase 5 and the MVP remain incomplete. The second delivery, [Issue #16](https://github.com/libanlsilva/solarwatch/issues/16), is complete with reviewed squash integration of [PR #17](https://github.com/libanlsilva/solarwatch/pull/17): the server-referenced 24-hour history API. The third delivery, [Issue #18](https://github.com/libanlsilva/solarwatch/issues/18), is complete with reviewed squash integration of [PR #19](https://github.com/libanlsilva/solarwatch/pull/19): real Overview charts using that API, independent query states and truthful missing-data treatment. The owner-approved fourth delivery, [Issue #20](https://github.com/libanlsilva/solarwatch/issues/20), is complete with reviewed squash integration of [PR #21](https://github.com/libanlsilva/solarwatch/pull/21): responsive navigation/read-only History. Owner-approved [Issue #22](https://github.com/libanlsilva/solarwatch/issues/22), delivery B, is complete with the personally approved squash integration of [PR #23](https://github.com/libanlsilva/solarwatch/pull/23): synchronized exact-observation/minute inspection. Final Phase 5 validation is proposed in [Issue #24](https://github.com/libanlsilva/solarwatch/issues/24), prepared for review without implementation.
6. **Local MVP release planned:** full acceptance evidence, complete local orchestration, and release notes.

Use the frozen approved designs and [DESIGN.md](docs/design/DESIGN.md) throughout Phase 5. The first Overview delivery used existing React/TypeScript and CSS. The owner-approved chart delivery adds Recharts after compatibility, license, bundle and interaction evaluation; no UI framework is needed. More realistic simulator patterns remain separate future work; the generator is unchanged.

## Current limitations

This is a local, unauthenticated demo with Development-only ingestion. Historical data can be prepared, queried through the API, plotted in Overview and inspected in responsive History. Energy integration, real hardware and public deployment remain unavailable. Simulator runs have no checkpoint/resume or automatic recovery; uncertain writes require inspection. Each POST is atomic; the whole run is not one transaction. Existing conflicting data is retained rather than forcibly replaced. Vite's proxy supports development/preview; production static hosting would require appropriate API routing/deployment configuration. The existing API Dockerfile is retained; validation covers the Compose database and host-run services, not complete app container orchestration. Overview and History implement the approved designs using real persisted data. History selection resets on a full page reload or after leaving and remounting History; scrolling/resizing and accepted Refresh follow the documented preservation rules. The current unchanged simulator produces noisy random histories. More realistic, reproducible energy patterns are recorded in the roadmap as a separate future improvement; current curves are not smoothed or replaced. The additional chart module loads on demand; see the documented bundle cost. Manrope loads from Google Fonts with Segoe UI/sans-serif fallback; offline typography may wrap differently. Intermediate layouts are tested adaptations, not separately approved tablet prototypes.

## Contributing and license

Follow [CONTRIBUTING.md](CONTRIBUTING.md) for issues, focused branches, validation, and PR review. Each approved PR is integrated with squash, producing one commit on `main`. SolarWatch is licensed under the [MIT License](LICENSE).
