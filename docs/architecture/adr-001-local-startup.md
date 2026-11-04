# ADR-001: retain the verified host-run local startup

**Status:** proposed, pending personal PR review. Issue #37 authorizes evaluation only. **Recommendation: NO-GO for full-stack Compose in the current local MVP.** Phase 6 and the MVP remain open; no release is authorized.

## Context and evidence

The [initial evaluation](local-compose-evaluation.md) and [two clean-clone runs](../validation/CLEAN_CLONE.md) establish PostgreSQL Compose + host .NET 10/React, including migrations, simulated data, connected UI/Refresh and persistence. This decision reuses that evidence without another audit.

Inspection confirms [Compose](../../docker-compose.yml) supplies PostgreSQL/readiness/a named volume; the [API Dockerfile](../../backend/src/SolarWatch.Api/Dockerfile) uses `backend/src`, publishes the API/migration/seed CLI but no simulator. No frontend image exists. [Vite](../../frontend/vite.config.ts) supplies the host `/api` proxy.

## Concrete alternative considered — not implemented or verified

Build the API plus a Node-build/static-Nginx React image. Publish only frontend on host loopback, proxying existing read routes to `api:8080`; API connects to `postgres:5432` on isolated project networks. No host API/database ports are required; secrets stay server-side. These service names/ports follow [Compose networking](https://docs.docker.com/compose/how-tos/networking/), not a verified deployment.

Order: healthy PostgreSQL → one-off existing `migrate` → API/frontend. [Readiness/successful-completion conditions](https://docs.docker.com/compose/how-tos/startup-order/) would need configuration/testing; container start is not readiness. Migration failure stops startup. Keep volume/project/credentials on restart; seed/history remain opt-in, never automatic clear/reseed.

Data preparation would require published simulator artifacts inside the API image and explicit operator `exec` using its loopback listener, plus the existing seed CLI. This adds packaging/lifecycle work, not a verified security solution. A separate simulator sharing the API network namespace would add another topology to maintain.

## Comparison

| Concern | Verified host-run reference | Hypothetical full-stack Compose |
| --- | --- | --- |
| Developer requirements | Git, Docker, .NET 10 SDK, Node 24/npm | Git/Docker could suffice to **run** containers; builds hold toolchains. Contributor debugging/testing still needs a workflow. |
| Operator actions | Six post-clone phases: config/DB readiness; restore/build; migrate; start API; start frontend; opt-in data. Two app terminals plus control commands. | Potentially three groups: config; build/up/migrate; opt-in data. Not tested commands or a promised one-command demo. |
| Maintenance | Existing Compose, CLI, Vite proxy, walkthrough | API validation/simulator publishing, frontend image/proxy, lifecycle orchestration and parallel walkthroughs |
| Debugging | Direct logs, host tooling and existing test commands | Image/network/proxy diagnosis; container debugging/source mounts remain extra work |
| Demo/data preparation | Current seed/history and finite/continuous HTTP modes already verified; manual Refresh unchanged | Same contracts/modes, but deliberate loopback execution and artifacts must be packaged and tested |
| Persistence/recovery | Both stop/start and down/up verified; isolated named volumes retained | Same intended semantics, still requiring container-path verification; never share an existing demo volume implicitly |

Counts group phases, not shell lines. No new timings, image sizes or container runtime results were measured.

## Ingestion boundary

[LocalIngestion.cs](../../backend/src/SolarWatch.Api/LocalIngestion.cs) requires Development, loopback **peer and Host**, no forwarded headers and local Origin when present. [Host loopback publication](https://docs.docker.com/engine/network/port-publishing/) does not establish the peer seen by ASP.NET Core inside a container.

The alternative must keep proxy access read-only and preserve the API filter. No bridge trust list or forwarded-header workaround is acceptable; private networks are not authentication. Local preparation and rejection of bridge/proxy/non-Development writes require real tests before adoption: **none are claimed for this topology**. Existing host-path guards/tests stay unchanged.

## Recommendation and next step

**NO-GO:** retain the current path. Removing host SDK/Node is a real run-only convenience, but does not outweigh maintaining images, proxy, migration lifecycle and simulator packaging/security verification alongside an accepted working setup. This is a scope/cost decision, not a claim that Compose is impossible or inherently unsafe.

Do not create a Compose implementation delivery or release blocker. Reconsider if a concrete audience needs it and the owner approves a separately scoped, tested topology. No runtime/configuration/dependency changes are made here.

Next: review [simulator-pattern Issue #38](https://github.com/libanlsilva/solarwatch/issues/38) before definitive captures/demo, then prepare demonstration/acceptance using the verified startup. Simulator implementation remains unauthorized; this ADR authorizes no final captures, Phase 6/MVP closure or release. Native/physical checks retain their [unverified status and limited Phase 5 acceptance](../validation/PHASE5_ACCEPTANCE.md).
