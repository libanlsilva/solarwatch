# Development plan

SolarWatch is a portfolio project developed incrementally from its initial scaffold to a documented, reproducible application. Its history should explain the requirements, implementation decisions, verification, and limitations of each delivery.

## Current baseline

Phase 0 established the .NET 10 backend layers, React/TypeScript/Vite scaffold, repository conventions, MIT license, and backend/frontend CI. The initial commit is `a19d148`.

Phase 2 completed through squash integration of PR #5: an EF Core migration persists simulated readings in PostgreSQL, the API exposes the latest snapshot, and React displays it with manual refresh and explicit data states. Meaningful unit, real PostgreSQL integration, and browser tests replace the empty templates. Compose runs the database; the API and frontend run on the host. Phase 3 is complete through reviewed squash integration of [PR #7](https://github.com/libanlsilva/solarwatch/pull/7) / [Issue #6](https://github.com/libanlsilva/solarwatch/issues/6), [PR #9](https://github.com/libanlsilva/solarwatch/pull/9) / [Issue #8](https://github.com/libanlsilva/solarwatch/issues/8), and [PR #11](https://github.com/libanlsilva/solarwatch/pull/11) / [Issue #10](https://github.com/libanlsilva/solarwatch/issues/10): finite, continuous, and full reproducible 24-hour preparation. The MVP is not complete. Phase 4 completes with reviewed squash integration of [PR #13](https://github.com/libanlsilva/solarwatch/pull/13): Overview Desktop v2, Overview Mobile v1, History Desktop v1, History Mobile v1, Interface States v1, the reusable design system and resource publication are definitively approved. The [design handoff](design/README.md) preserves the frozen references. The first Phase 5 delivery, [Issue #14](https://github.com/libanlsilva/solarwatch/issues/14), is personally approved and complete with reviewed squash integration of [PR #15](https://github.com/libanlsilva/solarwatch/pull/15): the responsive Overview uses real latest readings. Phase 5 and the MVP remain unfinished; the second delivery, Issue #16, is personally approved and complete with reviewed squash integration of [PR #17](https://github.com/libanlsilva/solarwatch/pull/17): the real 24-hour history API. The third delivery, Issue #18, is personally approved and complete with reviewed squash integration of [PR #19](https://github.com/libanlsilva/solarwatch/pull/19): real Overview history charts. The fourth delivery, owner-approved Issue #20, implements responsive read-only History on this branch and awaits PR review/integration. Synchronized selection and complete app container orchestration remain pending.

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
| 3. Simulated ingestion | Submit and refresh reproducible readings through the complete app | [PR #7](https://github.com/libanlsilva/solarwatch/pull/7) / [Issue #6](https://github.com/libanlsilva/solarwatch/issues/6): finite ingestion; [PR #9](https://github.com/libanlsilva/solarwatch/pull/9) / [Issue #8](https://github.com/libanlsilva/solarwatch/issues/8): continuous cadence/shutdown; [PR #11](https://github.com/libanlsilva/solarwatch/pull/11) / [Issue #10](https://github.com/libanlsilva/solarwatch/issues/10): 1,441-sample UTC/seed reproducibility, safe reruns, full PostgreSQL/browser verification | Complete |
| 4. Dashboard visual design | Define the dashboard before implementation | [Issue #12](https://github.com/libanlsilva/solarwatch/issues/12): four approved Overview/History prototypes and seven approved interface states; [reusable system and exports](design/README.md) definitively approved and integrated through [PR #13](https://github.com/libanlsilva/solarwatch/pull/13); no runtime/UI-library changes | Complete with PR #13 integration |
| 5. Approved dashboard implementation | Deliver the responsive Overview and then explore 24 hours of persisted readings in React | Separate reviewed deliveries: shared shell + real latest Overview; server-referenced history query; real-data charts and accessible selection; independent query states, missing-data semantics, responsive and browser verification | In progress; first delivery complete with reviewed PR #15 integration / Issue #14; second delivery complete with reviewed PR #17 integration / Issue #16; third delivery complete with reviewed PR #19 integration / Issue #18; fourth delivery Issue #20 implemented, awaiting PR review/integration; synchronized interactions pending |
| 6. Local MVP release | Reproduce and demonstrate the accepted MVP | Verified Docker/Compose and fresh-clone setup, all MVP acceptance evidence, actual screenshots/demo, known limitations, and release notes | Planned |

SignalR, automatic refresh, real-device integration, authentication, and other advanced features are later enhancements outside the current MVP. Their priority will be decided after the local MVP works.

Each phase can contain several small pull requests. Add tests with the behavior they verify throughout development. New findings may change the order or split a phase; record the reason before expanding the scope. Mark a phase complete only when its evidence exists.

PR #11 completes the owner-approved `--history-24h` delivery and Phase 3: 1,441 one-minute samples across the inclusive UTC window, one seeded sequence, existing local HTTP ingestion, conflict reporting without overwrites, and truthful incomplete/uncertain results. Finite/continuous modes and React manual refresh remain compatible. Unit, complete-range real PostgreSQL, duplicate/partial/failure, and actual-CLI browser checks provide the evidence; the owner accepted the recorded timings without requesting further optimization. Phase 4 is exclusively a design delivery and completes with [PR #13](https://github.com/libanlsilva/solarwatch/pull/13). The owner approved its four main prototypes, Interface States v1, final reusable system and resource package. This milestone does not complete the MVP or authorize Phase 5 implementation automatically.

## Approved dashboard design and Phase 5 sequence

The first Phase 5 delivery replaces the earlier simple Phase 2 view with the approved responsive Overview, reusing its API contract and data-state guarantees. Issue #12 now has personally approved Overview Desktop v2, Overview Mobile v1, History Desktop v1, History Mobile v1 and Interface States v1, with no further visual versions requested. The [small reusable design system](design/DESIGN.md) specifies exact styles, component responsibilities, responsive constraints, server-based freshness, per-resource query states and accessibility decisions. The [versioned exports](design/README.md) preserve those approved sources and capture evidence; the [asset record](design/ASSETS.md) documents publication permission and excludes the third-party reference.

The owner definitively approved the final design PR; Phase 4 completes with the squash integration of [PR #13](https://github.com/libanlsilva/solarwatch/pull/13). No React, endpoints, UI/chart dependencies or workflow changes are part of this phase. Tailwind CSS, selective shadcn/ui and Recharts are evaluated for later use, without installation. History Mobile sticky height on short phones and intermediate/tablet layout validation remain implementation observations. The owner definitively approved PR #15 / Issue #14: shared responsive structure and real latest Overview, with no history query or chart library. The first Phase 5 delivery completes with its reviewed squash integration. The owner definitively approved PR #17 / Issue #16: the second delivery completes with reviewed squash integration of the real history API. The owner definitively approved PR #19 / Issue #18: the third delivery completes with reviewed squash integration of the real Overview charts. The owner approved Issue #20 and the two-delivery split. Delivery A is implemented on this branch for personal PR review; delivery B remains unimplemented and requires its own issue after A is integrated. More realistic solar-production/consumption patterns can be evaluated separately when planning charts; the generator remains unchanged.

Plan Phase 5 as focused, independently verifiable deliveries, not one dashboard PR:

1. **Issue #14, complete with reviewed PR #15 integration:** shared responsive visual structure/navigation and approved Overview metrics, battery and measurement metadata using the existing Latest Reading endpoint. Manual refresh and all relevant data states are preserved; unimplemented history areas remain explicitly unavailable, with no illustrative charts presented as real. The approved Desktop v2/Mobile v1 and design system remain the reference.
2. **Issue #16, complete with reviewed PR #17 integration:** [server-referenced inclusive 24-hour history API](architecture/reading-history.md) using persisted PostgreSQL readings, a clear HTTP contract, chronological order, exact microsecond boundaries, explicit empty/partial results and meaningful unit/real PostgreSQL integration tests. The approved implementation adds no React changes, graphs, schema migrations, dependencies or infrastructure services. This completes only the history API delivery; Phase 5 and the MVP remain open.
3. **Issue #18, complete with reviewed PR #19 integration:** consume the history API in the approved Overview with actual solar/consumption (W) and battery (%) plots. Preserve desktop/mobile composition, manual refresh, independent latest/history state, real zero, original microsecond timestamps, elapsed-time positions, irregular samples and explicit gaps. Recharts is evaluated and isolated in an on-demand module; unit/Full Stack geometry/state tests, responsive checks and actual captures provide evidence. See the [chart implementation record](architecture/overview-charts.md). This completes only the third delivery; Phase 5 and the MVP remain unfinished.
4. **Issue #20, owner-approved delivery A implemented on this branch, awaiting PR review/integration:** real responsive History navigation, approved desktop/mobile structure, shared API-backed plots, read-only Latest available reading context and complete independent query states. Direct entry/reload/Back/Forward, short-phone sticky adaptation, responsive checks, Full Stack tests and real captures provide acceptance evidence. See the [History implementation record](architecture/history-view.md). Selected Reading, synchronized selection, minute slider and stepping are deliberately omitted. After reviewed squash integration, prepare a separate delivery B issue for exact-record/minute inspection and mouse/keyboard/touch controls. Do not implement B without its own approval.
5. Validate the combined dashboard, responsive intermediate widths, short-height History sticky regions and accessibility against all approved references. Close Phase 5 only when its acceptance evidence exists.

Keep the approved system and prototypes unchanged as implementation references. Reassess chart dependencies only when a real chart delivery needs them; no dependency or implementation work is authorized by this plan alone.

## Phase 1: approved requirements

The [requirements document](requirements/MVP.md), tracked in [Issue #2](https://github.com/libanlsilva/solarwatch/issues/2), defines:

- The intended user and the specific question the first screen should answer.
- The first end-to-end scenario using simulated readings and its observable acceptance criteria.
- Measurement units and meanings: instantaneous power versus accumulated energy, battery state of charge, and consumption.
- Device identity, timestamps/time zones, and expected sampling frequency.
- The expected handling of missing, stale, duplicate, out-of-order, and invalid readings.
- Local-development scope, access assumptions, and explicit non-goals.

The owner approved the requirements and operating defaults on 2026-10-28, and Phase 1 completed through squash integration of PR #3. This approval confirms one reading per minute, staleness after five minutes, manual refresh, UTC storage with local-time display, and deferred accumulated-energy calculations. Current implementation progress is recorded in the phase table above.

The first implementation completed [Issue #4](https://github.com/libanlsilva/solarwatch/issues/4) through PR #5, with its [API contract and decisions](architecture/latest-reading.md) documented. Phase 3 completed Issues #6, #8, and #10 through PRs #7, #9, and #11. The [ingestion/simulator contract](architecture/simulated-ingestion.md) documents local-only POST, database-enforced concurrency behavior, execution modes, and limitations. Phase 5 Issue #14 replaces the earlier React presentation while preserving those API/simulator behaviors. Phase 4 completed the same issue/branch/CI/review/squash workflow for design artifacts through PR #13. Each Phase 5 implementation issue requires personal owner approval before work begins.

## Delivery loop

1. Select one small outcome and agree on its acceptance criteria.
2. Open a focused issue when the work benefits from tracking; use a short-lived branch from current `main`.
3. Implement the outcome with relevant tests and documentation. Record an architectural decision when a significant tradeoff needs explanation.
4. Review the diff for scope, correctness, generated files, and secrets; run the applicable checks in [CONTRIBUTING.md](../CONTRIBUTING.md).
5. Create meaningful commits and push the branch. Open a pull request that explains the problem, resulting behavior, validation, and remaining limitations.
6. Inspect the changes and CI results before merging. Self-review is valid for this solo project; describe it honestly.
7. Integrate the completed outcome using **Squash and merge**, producing one commit on `main` per pull request. Remove the completed remote branch, update progress when a milestone changes, and start the next delivery on a new branch from updated `main`.

## Recorded future improvement: reproducible energy patterns

The owner's PR #19 review confirms that the current independent random samples make the correctly rendered charts dense. Record a separate future simulator improvement: generate more realistic, visually comprehensible solar-generation, household-consumption and battery-charge patterns while retaining reproducible seeds/timestamps, the existing modes/API validation and truthful simulated-data labels. Define its own scope, tests and acceptance criteria before implementation; no priority or implementation approval is implied by this note.

This is outside PR #19 and the proposed History deliveries. Preserve existing stored readings and render them faithfully; do not smooth, interpolate, overwrite or replace real API values to make current charts look more plausible. Issue #20 reuses the existing chart engine; no simulator or synthetic-pattern changes are included.

## Portfolio evidence

- Keep issues and pull requests tied to actual work, with clear acceptance criteria and verification results.
- Commit code and its relevant tests together when they form one coherent behavior change. Avoid arbitrary commit counts or splitting files just to increase activity.
- For consequential decisions, add a concise record under `docs/architecture/` with context, options, the decision, and consequences. Avoid introducing patterns solely to demonstrate a technology.
- Replace template code and empty tests as meaningful implementations arrive. Keep documented test results distinct from coverage claims.
- Add screenshots and demo instructions only after the corresponding behavior works, and label simulated data clearly.
- Preserve published history. Fix mistakes with follow-up commits and document remaining limitations.

The roadmap is a sequence of intended outcomes, not a claim that the product is already implemented or production-ready.
