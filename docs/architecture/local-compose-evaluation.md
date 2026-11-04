# Local startup: host-run apps first, full-stack Compose later

Issue #34's first Phase 6 delivery verifies the existing PostgreSQL Compose + host-run ASP.NET Core/React path from two actual GitHub clones. **Full-stack Compose is evaluated here, not implemented.** Phase 6 and the MVP remain pending; public production hosting is outside this local scope.

| Option | What is established | Tradeoff / disposition |
| --- | --- | --- |
| PostgreSQL Compose; host .NET 10 and Node 24 | Two isolated Windows/PowerShell setups, migrations/seeding, real API/React, normal stop/restart and persistence | Verified first delivery; host SDK/Node prerequisites remain explicit |
| API + frontend + database in Compose | Existing API Dockerfile only; no frontend image or app services in Compose | Potential simpler start after image builds, but requires a separate lifecycle/proxy/data-preparation design and its own reviewed implementation |

The existing [API Dockerfile](../../backend/src/SolarWatch.Api/Dockerfile) expects **`backend/src` as its build context**, with project paths such as `SolarWatch.Api/SolarWatch.Api.csproj`. Its [context ignore file](../../backend/src/.dockerignore) excludes local secrets, certificates, build outputs and dependencies. These paths were inspected; this delivery does **not** claim an API image build or full-container runtime validation. The current [Compose file](../../docker-compose.yml) runs PostgreSQL only, with loopback binding, named volume and a readiness check. All three existing workflows remain unchanged.

A future small container delivery must resolve the following together:

- API connection host becomes the database service name inside the network, not host loopback. Published host ports should remain loopback-only for this unauthenticated local demo; use an explicit project/volume to isolate installations.
- Database readiness, an explicit one-off migration step and opt-in simulated-data preparation must have a clear order. Do not automatically clear or reseed persistent data on every start; normal stop/restart must retain credentials and rows.
- A frontend serving/proxy option must preserve the same-origin `/api` path. The current Vite preview is the verified host demonstration path, not a newly designed production deployment.
- **Development does not authorize arbitrary network writes.** Existing ingestion also requires a direct loopback peer/host and rejects forwarded headers/non-local origins. A host simulator or a separate bridge-network container cannot simply be assumed to satisfy that guard for a containerized API. Data preparation must use a deliberately reviewed local execution topology; do not disable the guard, trust every bridge address, add a bulk endpoint or silently enable forwarded writes.
- Include the unchanged simulator and existing migration/seed CLI in a controlled execution workflow if full demo preparation is promised. The present API image publishes the API project, not a complete simulator/frontend installation.

**Recommendation:** accept the verified host-run reference path as delivery A, then scope one focused full-stack Compose proposal if the owner wants container startup before the final release. That proposal should bring concrete migration/seed commands, frontend proxy choice, loopback-ingestion behavior and persistence tests for review. Do not combine this first verification delivery with full orchestration, security changes, a release/tag or a redesign. Realistic simulator patterns remain a separate optional improvement before the final demonstration.
