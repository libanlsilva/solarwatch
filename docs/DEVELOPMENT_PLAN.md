# Development plan

SolarWatch is a portfolio project developed incrementally from its initial scaffold to a documented, reproducible application. Its history should explain the requirements, implementation decisions, verification, and limitations of each delivery.

## Current baseline

Phase 0 established the .NET 10 backend layers, React/TypeScript/Vite scaffold, repository conventions, MIT license, and backend/frontend CI. The initial commit is `a19d148`.

Phase 2 completed through squash integration of PR #5: an EF Core migration persists simulated readings in PostgreSQL, the API exposes the latest snapshot, and React displays it with manual refresh and explicit data states. Meaningful unit, real PostgreSQL integration, and browser tests replace the empty templates. Compose runs the database; the API and frontend run on the host. The first Phase 3 delivery completed through reviewed squash integration of [PR #7](https://github.com/libanlsilva/solarwatch/pull/7), resolving [Issue #6](https://github.com/libanlsilva/solarwatch/issues/6): finite reproducible generation and local HTTP ingestion. The second delivery completed through reviewed squash integration of [PR #9](https://github.com/libanlsilva/solarwatch/pull/9), resolving [Issue #8](https://github.com/libanlsilva/solarwatch/issues/8): opt-in continuous simulation and controlled shutdown. Phase 3 as a whole is not complete. Full reproducible 24-hour backfill remains its next delivery; dedicated visual design, history queries/charts, and complete app container orchestration follow later.

## Residential MVP

A user monitors one residential installation with solar panels, a battery, and an inverter using clearly identified simulated readings. The MVP displays current solar generation (W), household consumption (W), battery state of charge (%), the latest measurement timestamp, and charts for the last 24 hours. Power and accumulated energy retain distinct meanings and units. See the [MVP requirements](requirements/MVP.md) for approved acceptance criteria and operating defaults.

Real hardware, authentication, multiple users/installations, billing, accumulated-energy totals, and advanced operations are outside this local MVP. Authentication and access requirements must be reconsidered before any public deployment.

Prioritize an early complete React/API/PostgreSQL feature. Add only the domain rules and supporting infrastructure needed for each delivery; do not complete the entire backend before connecting the browser.

## Phases and completion evidence

| Phase | Outcome | Evidence required to finish | Status |
| --- | --- | --- | --- |
| 0. Foundation | Backend and frontend scaffolds with CI | Restore/build/test and frontend lint/build succeed locally and in GitHub Actions; limitations documented | Complete |
| 1. Product definition | Residential MVP and first full stack use case | [Issue #2](https://github.com/libanlsilva/solarwatch/issues/2), approved requirements integrated through [PR #3](https://github.com/libanlsilva/solarwatch/pull/3) | Complete |
| 2. Persisted latest reading | Store a simulated reading in PostgreSQL, query it through .NET, and display it in React | [Issue #4](https://github.com/libanlsilva/solarwatch/issues/4): migration/seed, current metrics and states, PostgreSQL integration and browser verification through [PR #5](https://github.com/libanlsilva/solarwatch/pull/5) | Complete |
| 3. Simulated ingestion | Submit and refresh reproducible readings through the complete app | [PR #7](https://github.com/libanlsilva/solarwatch/pull/7) / [Issue #6](https://github.com/libanlsilva/solarwatch/issues/6): finite ingestion; [PR #9](https://github.com/libanlsilva/solarwatch/pull/9) / [Issue #8](https://github.com/libanlsilva/solarwatch/issues/8): continuous cadence/shutdown with tests; full 24-hour backfill follows separately | First and second deliveries complete; phase in progress |
| 4. Dashboard visual design | Define the dashboard before implementing historical charts | After Phase 3 backfill: professional visual prototype, preferably dark, and small reusable design system explicitly approved by the owner | Planned |
| 5. History and charts | Explore the last 24 hours of persisted readings in React | Approved Phase 4 visual design; correct time boundaries and units, ordered history, partial/empty data and gaps, accessible charts, and browser verification | Planned |
| 6. Local MVP release | Reproduce and demonstrate the accepted MVP | Verified Docker/Compose and fresh-clone setup, all MVP acceptance evidence, actual screenshots/demo, known limitations, and release notes | Planned |

SignalR, automatic refresh, real-device integration, authentication, and other advanced features are later enhancements outside the current MVP. Their priority will be decided after the local MVP works.

Each phase can contain several small pull requests. Add tests with the behavior they verify throughout development. New findings may change the order or split a phase; record the reason before expanding the scope. Mark a phase complete only when its evidence exists.

PR #9 completed the owner-approved continuous-simulation delivery: immediate sample and 60-second cadence through the existing local API, controlled shutdown, and honest failure/uncertainty reporting. The finite mode and React manual refresh remain compatible. Complete reproducible 24-hour backfill is the next separate follow-up; prepare and approve its issue before implementation. After that delivery, dedicate Phase 4 to visual design and obtain approval before implementing historical charts in Phase 5. Later phases are numbered accordingly.

## Future dashboard design

The current Phase 2 view is an accepted functional baseline. After the full 24-hour backfill delivery, Phase 4 defines a professional visual prototype and a small reusable design system and obtains owner approval before the historical dashboard is implemented. Prefer a modern dark energy-monitoring dashboard with metric cards, charts, and navigation; introduce Tailwind CSS or shadcn/ui when justified. When planning charts, evaluate more realistic solar-production and household-consumption patterns for the simulator. This future evaluation does not change the current generator or expand the next backfill issue.

## Phase 1: approved requirements

The [requirements document](requirements/MVP.md), tracked in [Issue #2](https://github.com/libanlsilva/solarwatch/issues/2), defines:

- The intended user and the specific question the first screen should answer.
- The first end-to-end scenario using simulated readings and its observable acceptance criteria.
- Measurement units and meanings: instantaneous power versus accumulated energy, battery state of charge, and consumption.
- Device identity, timestamps/time zones, and expected sampling frequency.
- The expected handling of missing, stale, duplicate, out-of-order, and invalid readings.
- Local-development scope, access assumptions, and explicit non-goals.

The owner approved the requirements and operating defaults on 2026-10-28, and Phase 1 completed through squash integration of PR #3. This approval confirms one reading per minute, staleness after five minutes, manual refresh, UTC storage with local-time display, and deferred accumulated-energy calculations. Current implementation progress is recorded in the phase table above.

The first implementation completed [Issue #4](https://github.com/libanlsilva/solarwatch/issues/4) through PR #5, with its [API contract and decisions](architecture/latest-reading.md) documented. The owner also approved the finite-ingestion implementation; PR #7 completes Issue #6 and the first Phase 3 delivery. Its [finite ingestion contract](architecture/simulated-ingestion.md) documents the local-only POST, database-enforced concurrency behavior, CLI options, and remaining limitations. The React interface is preserved. Further Phase 3 work follows the same issue/branch/CI/review/squash workflow.

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
