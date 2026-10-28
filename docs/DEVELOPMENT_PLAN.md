# Development plan

SolarWatch is a portfolio project developed incrementally from its initial scaffold to a documented, reproducible application. Its history should explain the requirements, implementation decisions, verification, and limitations of each delivery.

## Current baseline

Phase 0 established the .NET 10 backend layers, React/TypeScript/Vite scaffold, repository conventions, MIT license, and backend/frontend CI. The initial commit is `a19d148`.

The first Full Stack delivery now persists simulated readings in PostgreSQL through an EF Core migration, exposes the latest snapshot through the API, and displays it in React with manual refresh and explicit data states. Meaningful unit, real PostgreSQL integration, and browser tests replace the empty templates. Compose runs the database; the API and frontend run on the host. This delivery is prepared for review, and history/continuous ingestion remain unimplemented. Complete app container orchestration is still a later milestone.

## Residential MVP

A user monitors one residential installation with solar panels, a battery, and an inverter using clearly identified simulated readings. The MVP displays current solar generation (W), household consumption (W), battery state of charge (%), the latest measurement timestamp, and charts for the last 24 hours. Power and accumulated energy retain distinct meanings and units. See the [MVP requirements](requirements/MVP.md) for approved acceptance criteria and operating defaults.

Real hardware, authentication, multiple users/installations, billing, accumulated-energy totals, and advanced operations are outside this local MVP. Authentication and access requirements must be reconsidered before any public deployment.

Prioritize an early complete React/API/PostgreSQL feature. Add only the domain rules and supporting infrastructure needed for each delivery; do not complete the entire backend before connecting the browser.

## Phases and completion evidence

| Phase | Outcome | Evidence required to finish | Status |
| --- | --- | --- | --- |
| 0. Foundation | Backend and frontend scaffolds with CI | Restore/build/test and frontend lint/build succeed locally and in GitHub Actions; limitations documented | Complete |
| 1. Product definition | Residential MVP and first full stack use case | [Issue #2](https://github.com/libanlsilva/solarwatch/issues/2), approved requirements integrated through [PR #3](https://github.com/libanlsilva/solarwatch/pull/3) | Complete |
| 2. Persisted latest reading | Store a simulated reading in PostgreSQL, query it through .NET, and display it in React | [Issue #4](https://github.com/libanlsilva/solarwatch/issues/4): migration/seed, current metrics and states, PostgreSQL integration and browser verification | Prepared for review |
| 3. Simulated ingestion | Submit and refresh reproducible readings through the complete app | Deterministic seeding and simulator; validation, duplicates, out-of-order arrivals, and focused unit/API/database tests | Planned |
| 4. History and charts | Explore the last 24 hours of persisted readings in React | Correct time boundaries and units, ordered history, partial/empty data and gaps, accessible charts, and browser verification | Planned |
| 5. Local MVP release | Reproduce and demonstrate the accepted MVP | Verified Docker/Compose and fresh-clone setup, all MVP acceptance evidence, actual screenshots/demo, known limitations, and release notes | Planned |

SignalR, automatic refresh, real-device integration, authentication, and other advanced features are later enhancements outside the current MVP. Their priority will be decided after the local MVP works.

Each phase can contain several small pull requests. Add tests with the behavior they verify throughout development. New findings may change the order or split a phase; record the reason before expanding the scope. Mark a phase complete only when its evidence exists.

## Phase 1: approved requirements

The [requirements document](requirements/MVP.md), tracked in [Issue #2](https://github.com/libanlsilva/solarwatch/issues/2), defines:

- The intended user and the specific question the first screen should answer.
- The first end-to-end scenario using simulated readings and its observable acceptance criteria.
- Measurement units and meanings: instantaneous power versus accumulated energy, battery state of charge, and consumption.
- Device identity, timestamps/time zones, and expected sampling frequency.
- The expected handling of missing, stale, duplicate, out-of-order, and invalid readings.
- Local-development scope, access assumptions, and explicit non-goals.

The owner approved the requirements and operating defaults on 2026-10-28, and Phase 1 completed through squash integration of PR #3. This approval confirms one reading per minute, staleness after five minutes, manual refresh, UTC storage with local-time display, and deferred accumulated-energy calculations. Current implementation progress is recorded under Phase 2 above.

The first implementation is tracked in [Issue #4](https://github.com/libanlsilva/solarwatch/issues/4), with its [API contract and decisions](architecture/latest-reading.md) documented. Phase 2 remains open until owner review and squash integration. Open later issues as the work becomes actionable.

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
