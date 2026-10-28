# Development plan

SolarWatch is a portfolio project developed incrementally from its initial scaffold to a documented, reproducible application. Its history should explain the requirements, implementation decisions, verification, and limitations of each delivery.

## Current baseline

Phase 0 established the .NET 10 backend layers, React/TypeScript/Vite scaffold, repository conventions, MIT license, and backend/frontend CI. The initial commit is `a19d148`.

The backend currently retains the weather forecast sample and two empty template tests. The frontend displays the project name and development status. Passing these tests demonstrates that the test runner works; it does not demonstrate application coverage. Database integration, solar telemetry, and dashboards are not implemented. Dockerfile paths have been checked; a successful image build and container run still need to be demonstrated. Compose is empty.

## Proposed MVP

A user can run SolarWatch locally, generate clearly identified simulated device readings, and inspect current solar generation, battery level, consumption, and a historical view in the browser. This scope must be refined into acceptance criteria in Phase 1.

Real device protocols, billing, multi-tenant administration, and production operations are outside the proposed first release. Authentication and access requirements must be decided before any public deployment; the development environment is not a production security model.

## Phases and completion evidence

| Phase | Outcome | Evidence required to finish | Status |
| --- | --- | --- | --- |
| 0. Foundation | Backend and frontend scaffolds with CI | Restore/build/test and frontend lint/build succeed locally and in GitHub Actions; limitations documented | Complete |
| 1. Product definition | A bounded MVP and first use case | User scenarios, acceptance criteria, non-goals, data glossary, and a small issue backlog | Next |
| 2. Domain and first use case | Validated measurement rules and an application operation | Tests cover agreed units, ranges, and invalid inputs; project dependencies remain acyclic | Planned |
| 3. Persistence | Store and retrieve readings in PostgreSQL | EF Core migration, reproducible local database setup, and integration tests against a real database | Planned |
| 4. Telemetry ingestion | Accept and query simulated device readings | Documented API contract, validation/error cases, deterministic simulator, and API integration tests | Planned |
| 5. Dashboard | Display current readings and history from the API | React UI with loading/empty/error states, accessible interactions, and a Playwright test of the core journey | Planned |
| 6. Live monitoring | Update the dashboard as readings arrive | SignalR delivery and reconnect behavior verified; stale/offline readings identified | Planned |
| 7. First release | A reproducible, demonstrable MVP | Verified Docker/Compose setup, fresh-clone instructions, actual screenshots/demo, known limitations, and release notes | Planned |

Each phase can contain several small pull requests. Add tests with the behavior they verify throughout development. New findings may change the order or split a phase; record the reason before expanding the scope. Mark a phase complete only when its evidence exists.

## Phase 1: next delivery

Create `docs/requirements/MVP.md` through a focused documentation pull request that defines:

- The intended user and the specific question the first screen should answer.
- The first end-to-end scenario using simulated readings and its observable acceptance criteria.
- Measurement units and meanings: instantaneous power versus accumulated energy, battery state of charge, and consumption.
- Device identity, timestamps/time zones, and expected sampling frequency.
- The expected handling of missing, stale, duplicate, out-of-order, and invalid readings.
- Local-development scope, access assumptions, and explicit non-goals.

Open only the implementation issues needed for the next delivery. Each issue should state the problem, acceptance criteria, intended validation, and relevant dependencies. Detailed contracts and domain rules remain proposals until this phase resolves them.

## Delivery loop

1. Select one small outcome and agree on its acceptance criteria.
2. Open a focused issue when the work benefits from tracking; use a short-lived branch from current `main`.
3. Implement the outcome with relevant tests and documentation. Record an architectural decision when a significant tradeoff needs explanation.
4. Review the diff for scope, correctness, generated files, and secrets; run the applicable checks in [CONTRIBUTING.md](../CONTRIBUTING.md).
5. Create meaningful commits and push the branch. Open a pull request that explains the problem, resulting behavior, validation, and remaining limitations.
6. Inspect the changes and CI results before merging. Self-review is valid for this solo project; describe it honestly.
7. Integrate the completed outcome using **Squash and merge**, producing one commit on `main` per pull request. Remove the completed remote branch, update progress when a milestone changes, and start the next delivery on a new branch from updated `main`.

## Portfolio evidence

- Keep issues and pull requests tied to actual work, with clear acceptance criteria and verification results.
- Commit code and its relevant tests together when they form one coherent behavior change. Avoid arbitrary commit counts or splitting files just to increase activity.
- For consequential decisions, add a concise record under `docs/architecture/` with context, options, the decision, and consequences. Avoid introducing patterns solely to demonstrate a technology.
- Replace template code and empty tests as meaningful implementations arrive. Keep documented test results distinct from coverage claims.
- Add screenshots and demo instructions only after the corresponding behavior works, and label simulated data clearly.
- Preserve published history. Fix mistakes with follow-up commits and document remaining limitations.

The roadmap is a sequence of intended outcomes, not a claim that the product is already implemented or production-ready.
