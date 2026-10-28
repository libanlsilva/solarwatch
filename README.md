# SolarWatch

An open-source solar energy monitoring and analytics platform built with ASP.NET Core and React.

**Status: Early Development.** This repository currently contains the .NET 10 backend scaffold, a React and TypeScript frontend scaffold powered by Vite, test projects, API Docker build configuration, and backend/frontend CI workflows. Solar monitoring features are not implemented yet.

## Goals and motivation

SolarWatch aims to make household and small-scale solar energy systems easier to understand by bringing solar generation, battery levels, energy consumption, historical analytics, and device telemetry into one place. The project is also a practical environment for developing a full stack application with clear backend boundaries, automated testing, and reproducible local tooling.

## Current implementation

- Six .NET 10 projects in a single solution, with references establishing the intended backend layers.
- An ASP.NET Core controller-based API retaining the generated `/weatherforecast` sample endpoint and development-only OpenAPI document at `/openapi/v1.json`.
- Domain, application, and infrastructure libraries containing their original template classes.
- Two xUnit test projects, each containing one empty template test. These do not validate application behavior yet.
- A multi-stage API Dockerfile and a backend GitHub Actions workflow for restore, build, and test.
- A React and TypeScript application with Vite, strict TypeScript configuration, Oxlint, and a minimal project status page.
- A frontend CI workflow for dependency installation, linting, and production builds.
- Reserved directories for future frontend modules, simulator, and documentation.

There is no database integration, telemetry ingestion, authentication, dashboard, real-time hub, or simulator implementation. `docker-compose.yml` is currently an empty reserved file; it does not start any services.

## Planned features

- Monitor solar generation, battery state of charge, and energy consumption.
- Ingest and inspect device telemetry.
- Explore historical energy trends and generation/consumption comparisons.
- Display live updates and charts in a responsive dashboard.
- Generate development telemetry with a device simulator.
- Expand automated coverage with meaningful unit, integration, and browser tests.

These features are roadmap items, not currently available functionality.

## Technology stack

| Area | Technology | Current state |
| --- | --- | --- |
| Backend | ASP.NET Core 10, C# | Scaffolded |
| Persistence | EF Core, PostgreSQL | Planned |
| Frontend | React, TypeScript, Vite | Scaffolded; minimal project status page only |
| UI and charts | Tailwind CSS, shadcn/ui, Recharts | Planned |
| Real-time communication | SignalR | Planned |
| Backend tests | xUnit | Template tests only |
| Browser tests | Playwright | Planned |
| Infrastructure | Docker, GitHub Actions | API Dockerfile and backend/frontend CI workflows configured; Compose services planned |

## High-level architecture

The backend establishes the following project dependencies:

```text
SolarWatch.Api ------------> SolarWatch.Application --> SolarWatch.Domain
       |                              ^                       ^
       +--> SolarWatch.Infrastructure-+-----------------------+

SolarWatch.UnitTests ------> SolarWatch.Application, SolarWatch.Domain
SolarWatch.IntegrationTests -> SolarWatch.Api
```

- **Domain:** intended home for energy-system entities and business rules; no project dependencies.
- **Application:** intended home for use cases and application contracts; depends on Domain.
- **Infrastructure:** intended home for persistence and device integrations; depends on Application and Domain.
- **Api:** HTTP entry point and composition root; references Application and Infrastructure.

The React client is scaffolded but does not communicate with the API yet. The planned simulator will also communicate with the API. PostgreSQL persistence through EF Core and SignalR updates will be introduced in later milestones.

## Repository structure

```text
solarwatch/
├── .github/
│   ├── pull_request_template.md
│   └── workflows/
│       ├── backend-ci.yml
│       └── frontend-ci.yml
├── backend/
│   ├── src/
│   │   ├── .dockerignore
│   │   ├── SolarWatch.slnx
│   │   ├── SolarWatch.Api/
│   │   │   ├── Controllers/
│   │   │   ├── Properties/
│   │   │   ├── Dockerfile
│   │   │   └── Program.cs
│   │   ├── SolarWatch.Application/
│   │   ├── SolarWatch.Domain/
│   │   └── SolarWatch.Infrastructure/
│   └── tests/
│       ├── SolarWatch.UnitTests/
│       └── SolarWatch.IntegrationTests/
├── frontend/
│   ├── .nvmrc
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json            # References app and tooling TypeScript configs
│   ├── vite.config.ts
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── index.css
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── routes/
│   └── tests/
├── simulator/                   # Reserved
├── docs/
│   ├── DEVELOPMENT_PLAN.md
│   ├── requirements/
│   │   └── MVP.md               # Approved requirements; features not implemented yet
│   ├── architecture/            # Reserved
│   └── screenshots/             # Reserved; no screenshots yet
├── .editorconfig
├── .gitattributes
├── .gitignore
├── docker-compose.yml           # Empty; services not configured yet
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

The existing solution remains at `backend/src/SolarWatch.slnx`. Empty planned leaf directories are retained with `.gitkeep` files.

## Local development

### Prerequisites

- .NET 10 SDK.
- Node.js 24 or newer and npm for the frontend (CI uses Node.js 24).
- Git.
- Access to NuGet.org to restore the existing packages.
- Optional: Docker with a running Linux container engine to build and run the API image.

PostgreSQL is not required for the current scaffold. Frontend installation requires access to the npm registry; Node.js is not needed to run only the backend.

### Restore, build, and test

From the repository root:

```sh
dotnet restore backend/src/SolarWatch.slnx
dotnet build backend/src/SolarWatch.slnx --configuration Release --no-restore
dotnet test backend/src/SolarWatch.slnx --configuration Release --no-build --no-restore
```

### Run and validate the frontend

```sh
cd frontend
npm ci
npm run dev
```

Open the local address printed by Vite, normally `http://localhost:5173`. The page displays the project name and early development status; there is no dashboard or API integration yet.

From `frontend/`, validate the scaffold with:

```sh
npm run lint
npm run build
```

The build checks TypeScript and produces static assets in the ignored `frontend/dist/` directory. Use `npm run preview` to inspect the production build locally. Frontend automated tests and Playwright are not configured yet; `frontend/tests/` is reserved for future coverage.

### Run the API

For the local HTTPS profile, trust the development certificate where supported:

```sh
dotnet dev-certs https --trust
dotnet run --project backend/src/SolarWatch.Api --launch-profile https
```

The API uses `https://localhost:7265` and `http://localhost:5171`; the configured HTTPS redirection middleware redirects HTTP requests to HTTPS. In this development profile, try:

- Sample endpoint: `https://localhost:7265/weatherforecast`
- OpenAPI JSON: `https://localhost:7265/openapi/v1.json`

The sample returns generated weather data, not solar telemetry. No interactive Swagger UI is configured.

### Build and run the API with Docker

Use `backend/src` as the build context, matching the existing Dockerfile paths:

```sh
docker build -f backend/src/SolarWatch.Api/Dockerfile -t solarwatch-api:local backend/src
docker run --rm -p 8080:8080 --name solarwatch-api solarwatch-api:local
```

The image serves HTTP on container port 8080; the sample endpoint is available at `http://localhost:8080/weatherforecast`. Container HTTPS is not configured by these commands. The image runs in Production by default, so the development OpenAPI endpoint is not exposed. A PostgreSQL container and Compose orchestration are not configured yet.

## Development roadmap

SolarWatch is developed in small, verifiable deliveries. See the [development plan](docs/DEVELOPMENT_PLAN.md) and [residential MVP requirements](docs/requirements/MVP.md) for completion criteria, approved scope and operating defaults, and current limitations. The MVP uses one simulated installation with panels, a battery, and an inverter; its functional requirements are not implemented yet.

0. **Foundation (complete):** backend/frontend scaffolds, layer references, repository conventions, and CI.
1. **Product definition (approved; complete upon integration of [PR #3](https://github.com/libanlsilva/solarwatch/pull/3)):** residential MVP scope, measurement semantics, acceptance criteria, and first full stack slice.
2. **Persisted latest reading (next feature):** save a simulated reading in PostgreSQL, query it through the .NET API, and show it in React with units, timestamp, and data states.
3. **Simulated ingestion:** introduce reproducible seeding and a simulator, validation, and duplicate/out-of-order handling.
4. **History and charts:** query and graph the latest 24 hours with correct power/charge units and missing-data behavior.
5. **Local MVP release:** verify Docker/Compose and fresh-clone setup; complete acceptance checks and publish actual demo evidence and release notes.

SignalR, authentication, real hardware, and other advanced features remain later enhancements outside this MVP. Domain rules, persistence, API behavior, and UI are developed together as each slice needs them.

Tests and relevant documentation accompany each behavior change throughout these phases.

## Contributing

Contributions are welcome as the foundation develops. Follow [CONTRIBUTING.md](CONTRIBUTING.md) for scope, branches, commit conventions, validation, and pull request review. Discuss substantial changes in an issue and keep deliveries aligned with the current phase.

Keep credentials out of committed configuration. Use .NET user secrets for local API credentials or ignored local environment files, and provide only sanitized examples when configuration is documented.

## License

SolarWatch is licensed under the [MIT License](LICENSE).
