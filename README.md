# SolarWatch

An open-source residential solar energy monitoring and analytics platform built with ASP.NET Core and React.

**Status: Early Development.** Phase 2 completed through [PR #5](https://github.com/libanlsilva/solarwatch/pull/5): PostgreSQL → .NET API → React displays one simulated installation's latest reading. The first Phase 3 delivery completed through [PR #7](https://github.com/libanlsilva/solarwatch/pull/7) / [Issue #6](https://github.com/libanlsilva/solarwatch/issues/6): finite reproducible simulation and local HTTP ingestion. The second delivery implements opt-in continuous simulation under [Issue #8](https://github.com/libanlsilva/solarwatch/issues/8), pending PR review. Phase 3 remains in progress; complete 24-hour backfill and the full MVP remain unfinished.

## Goals and motivation

SolarWatch makes solar generation, household energy consumption, and battery charge easier to understand. It is developed incrementally as a Full Stack portfolio project, with small reviewed deliveries, explicit requirements, meaningful tests, and reproducible local setup.

## Implemented in this delivery

- One residential demo installation with panels, a battery, and an inverter, using simulated readings.
- EF Core migration and PostgreSQL persistence for reading snapshots.
- A latest-reading API returning generation (W), consumption (W), battery state of charge (%), measurement time, and server reference time (`asOf`).
- A responsive React view with manual refresh, loading, empty, error/retry, retained-data warnings, and stale-data states.
- Freshness based on `asOf`, with readings older than five minutes labeled stale at the last successful check.
- Development-only migration, current-time or controlled-time seed, and explicitly confirmed demo-clear commands.
- A local Development-only ingestion endpoint with field validation and PostgreSQL-enforced duplicate conflicts, including concurrent requests.
- A finite .NET HTTP simulator with reproducible seed/timestamps, server-based current time, bounded batches, and explicit acceptance/rejection/error reporting.
- Optional continuous execution with an immediate reading, 60-second cadence, fresh server `asOf` per sample, and controlled Ctrl+C shutdown.
- Meaningful backend unit tests, real PostgreSQL integration tests, frontend unit tests, and Playwright browser tests, executed in CI.

The generated weather endpoint and empty template classes/tests have been removed. Finite simulation remains the default; the separate development seed remains available.

![Latest reading for the simulated residential installation](docs/screenshots/latest-reading.png)

Captured from the local PostgreSQL/API/React demonstration; values and timestamps are simulated example data from that session.

## Planned functionality

Later MVP deliveries add reproducible full 24-hour backfill and history charts. Hardware integration, authentication, multiple users/installations, SignalR, alerts, forecasts, accumulated-energy calculations, and production deployment remain outside this MVP.

Instantaneous power is measured in **W**. Accumulated energy is measured in **Wh/kWh**; 1 kWh = 1,000 Wh. This delivery does not calculate energy totals from power samples or convert battery charge percentage into stored energy.

## Technology stack

| Area | Technology | State |
| --- | --- | --- |
| Backend | ASP.NET Core 10, C# | Latest-reading API, local ingestion, development commands, and .NET simulator |
| Persistence | EF Core, Npgsql, PostgreSQL 17 | Migration and real persistence |
| Frontend | React, TypeScript, Vite | Responsive latest-reading view |
| UI/charts | Plain CSS for this slice; Tailwind CSS, shadcn/ui, Recharts planned | No dashboard component system or charts yet |
| Testing | xUnit, Node.js test runner, Playwright | Unit, PostgreSQL integration, and Chromium E2E tests |
| Infrastructure | Docker Compose, GitHub Actions | PostgreSQL service; backend, frontend, and Full Stack E2E workflows |
| Real-time updates | SignalR | Later enhancement; current refresh is manual |

## Architecture and structure

```text
React → GET /api/readings/latest → Application query → PostgreSQL store → PostgreSQL
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
├── simulator/SolarWatch.Simulator/ # Finite / opt-in continuous .NET HTTP generator
├── docker-compose.yml
├── dotnet-tools.json
├── .env.example
├── CONTRIBUTING.md
└── LICENSE
```

See the [latest-reading contract](docs/architecture/latest-reading.md), [ingestion/simulator contract](docs/architecture/simulated-ingestion.md), [approved MVP](docs/requirements/MVP.md), and [development plan](docs/DEVELOPMENT_PLAN.md).

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

### 4. Generate readings and refresh React

After migration, with the Development API and React running, execute from a third terminal at the repository root:

```sh
dotnet run --project simulator/SolarWatch.Simulator --configuration Release --no-build -- --count 10 --seed 42
```

The simulator reads the API's `asOf`, submits ten synthetic readings one minute apart, and terminates. Press **Refresh readings** in React to see the latest accepted values and timestamp. The browser does not refresh automatically.

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

The first reading is submitted immediately after querying server `asOf`. Subsequent iterations target a 60-second cadence, with one active GET/POST sequence at a time. Slow work skips elapsed minute slots; late timer wake-ups start a new cadence rather than producing closely spaced catch-up requests. Every reading gets a new server reference; the local clock only controls elapsed waiting. React continues updating only when you press **Refresh readings**.

Stop with **Ctrl+C**. A normal stop while waiting or fetching the reference exits 0 with no pending write. Cancellation during an unacknowledged POST reports uncertainty and exits 1; the row may already exist. Continuous mode stops on any 400/409 rejection, unexpected HTTP status, malformed reference/acknowledgment, timeout, or network error. Its summary reports attempted/accepted/rejected/error/uncertain counts. There are no automatic retries or catch-up batches. A seed reproduces the value sequence for equivalent iterations; live timestamps come from the API and are not a deterministic historical batch. `--count` and `--end-at` cannot be combined with `--continuous`; invalid combinations fail before contacting the API.

The finite-mode summary reports requested/attempted/accepted/rejected/error/unattempted counts. Exit 0 means all requested readings were acknowledged; invalid options, any rejection, or errors yield exit 1. 400/409 rejections still allow the finite run to continue; unexpected HTTP/network/acknowledgment errors stop it without automatic retries. A failed acknowledgment may follow a persisted write, so inspect the API before retrying.

**Local writes only:** `POST /api/readings` is absent outside Development and rejects non-loopback peers/hosts, forwarded requests, and non-local browser origins. Point the CLI directly at a loopback-bound API; it accepts no public URL or database credentials. Keep Development private: do not expose it through public listeners, reverse proxies, or tunnels. This guard does not replace authentication. See the [POST contract and limitations](docs/architecture/simulated-ingestion.md).

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

Build the Release solution first, including the API and simulator. Playwright launches its own API on port 5181 and Vite preview on port 4181; those ports must be free. It migrates the E2E database and clears its demo readings before each test. Ingestion tests run the actual finite and continuous CLI, verify persisted data, manual discovery in React, and duplicate conflicts. Linux CI sends SIGINT to verify graceful continuous shutdown; Node cannot deliver console Ctrl+C on Windows, so local Windows browser cleanup terminates the child process. Cancellation and later scheduled iterations are also verified with controlled-time unit/PostgreSQL tests on both platforms, without real-minute waits. Success scenarios use the real API/database; network interruption/delay is injected only for failure/loading checks. Browser clocks are deliberately shifted in freshness tests.

GitHub Actions runs backend tests against PostgreSQL, frontend lint/build/unit tests, and the full browser suite in a separate PostgreSQL-backed job. CI uses trust authentication only for disposable test services; local Compose requires a password. Browser failure traces are uploaded for diagnosis.

## Development roadmap

0. **Foundation complete:** initial structure and CI.
1. **Product definition complete:** approved residential MVP integrated through PR #3.
2. **Persisted latest reading complete:** PR #5 integrated PostgreSQL → API → React, development commands, state handling, and tests.
3. **Simulated ingestion in progress:** finite-generation/local-HTTP delivery completed through PR #7 / Issue #6; opt-in continuous simulation implemented for review under Issue #8. Next: complete reproducible 24-hour backfill in a separate delivery.
4. **History and charts planned:** last 24 hours with correct units and gaps.
5. **Local MVP release planned:** full acceptance evidence, complete local orchestration, and release notes.

Before implementing the historical dashboard, the owner must approve a professional visual prototype and a small reusable design system in a separate delivery. The intended direction is a modern energy-monitoring dashboard, preferably dark, with metric cards, charts, and navigation. Tailwind CSS and shadcn/ui will be considered when justified. When planning charts, also evaluate more realistic solar-production and household-consumption patterns for the simulator. These are future decisions; the current functional view and synthetic generator are retained.

## Current limitations

This is a local, unauthenticated demo with Development-only ingestion. There is no complete reproducible 24-hour backfill, history query/chart, energy integration, real hardware, or public deployment. Continuous execution has no checkpoint/resume or automatic recovery; uncertain writes require inspection. Each simulator POST is atomic; the whole run is not one transaction. Vite's proxy supports development/preview; production static hosting would require an appropriate API routing/deployment configuration. The existing API Dockerfile is retained, but this delivery validates the Compose database and host-run services, not complete app container orchestration. The UI is unchanged; an approved visual prototype and small design system will precede the historical dashboard.

## Contributing and license

Follow [CONTRIBUTING.md](CONTRIBUTING.md) for issues, focused branches, validation, and PR review. Each approved PR is integrated with squash, producing one commit on `main`. SolarWatch is licensed under the [MIT License](LICENSE).
