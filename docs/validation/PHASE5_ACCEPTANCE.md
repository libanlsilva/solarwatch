# Phase 5 acceptance handoff

**Phase 5 remains open. The MVP is incomplete. Phase 6 is not authorized.** The owner personally approved F2 and authorized squash integration of [PR #31](https://github.com/libanlsilva/solarwatch/pull/31), integrated as `8ab3788`; [Issue #29](https://github.com/libanlsilva/solarwatch/issues/29) is closed. The one pre-merge documentation correction changes the native-attempt count from three to four in [PHASE5.md](PHASE5.md), without rewriting its remaining report or evidence.

This is the current disposition record. The [original audit](PHASE5.md) and its pre-integration follow-up wording describe their historical baselines; current F2 acceptance is recorded here and in the [focused correction record](SELECTED_READING_REFLOW.md). No new audit or product change was performed for this handoff.

## Acceptance criteria and approved evidence

| Criteria | Executed / reviewed evidence | Current disposition |
| --- | --- | --- |
| AC-01–03: one simulated installation, same persisted latest snapshot and persistence | Approved Overview/Installation, real PostgreSQL/API/React tests and the audit's actual API-restart comparison | Implemented; accepted functional evidence retained |
| AC-04–05: Loading/Empty/Error/Retry, manual Refresh, freshness and time | Independent Latest/History queries, retained snapshots, successful-empty clearing, strict >300-second server `asOf` freshness and local-zone display | Functional tests pass; F1 corrected; actual reader announcement behavior remains unverified |
| AC-06–07: inclusive 24-hour history and incomplete data | Original microsecond timestamps, server window, chronological real observations, separate W/% scales, real zeros and >300-second curve breaks; no invented missing values | Implemented; approved unit/PostgreSQL/browser evidence retained |
| AC-08–10: validation, duplicates and late arrivals | Existing real PostgreSQL ingestion tests, concurrent HTTP 409/no overwrite and ordered historical retrieval | Passing preserved baseline; no backend or simulator change |
| AC-11: reproducible demonstration | Documented host-run setup, finite/continuous modes and exact 1,441-reading seeded inclusive history | Current demonstration verified; clean-clone/release/container acceptance remains separate Phase 6 work, not authorized |
| AC-12: Full Stack verification and documentation | 116 backend unit + 56 PostgreSQL integration + 46 frontend unit + 34 Playwright tests; restore/build/lint and three workflows | **252 passing tests, no skips**; original audit and correction evidence preserved |
| Approved responsive screens, navigation and History interactions | Four frozen prototypes; 48-layout audit, keyboard/touch/short-phone checks, exact/shared selection, UTC-minute/DST rules and Refresh reconciliation | Approved evidence retained; native zoom/reader and physical-phone behavior are not inferred from it |

The above summarizes the [unchanged MVP requirements](../requirements/MVP.md) and the owner-approved audit/PRs; it does not declare all release criteria complete. The original audit had 250 tests; F1 and F2 add one focused regression each. Existing test-only HTTP failures, controlled payloads, browser-clock overrides and viewport/text emulation remain identified as such in their reports; they are not substituted for every real database/native scenario.

Post-integration checks also pass on `8ab3788`: [Backend CI](https://github.com/libanlsilva/solarwatch/actions/runs/41548072394), [Frontend CI](https://github.com/libanlsilva/solarwatch/actions/runs/41548072363) and [Full Stack E2E](https://github.com/libanlsilva/solarwatch/actions/runs/41548072244). These are automated CI results, not native Windows reader/zoom trials.

## Findings and remaining verification

| Item | Disposition |
| --- | --- |
| F1: inaccurate in-progress Refresh text at rest | **Corrected and approved**, PR #28 / Issue #26. [17-state Chromium AX evidence](REFRESH_ACCESSIBILITY.md) preserves mixed/both-pending, idle, error and recovery checks; no claim of spoken-output approval |
| F2: enlarged Selected Reading numbers split internally | **Corrected and approved**, PR #31 / Issue #29. [Before/after captures and 31 geometry cases](SELECTED_READING_REFLOW.md) verify intact value/unit pairs, whole-metric reflow, zeros/larger values/unavailable minutes and normal-size composition |
| D1: outdated requirements status | Corrected in the approved audit documentation; approved product criteria remain unchanged |
| V1: actual native zoom/reflow and Narrator/NVDA | **Unverified; owner disposition pending.** All [four native-control attempts and exact errors](evidence/f2-native-attempts.json) remain unchanged. No additional repetition of the inaccessible Windows channel is required or claimed |
| Physical-phone browser chrome/safe-area behavior | Remains unverified as recorded by the original audit; desktop/Chromium touch emulation is not physical-device validation |

The [brief Windows checklist](WINDOWS_MANUAL_CHECKS.md) records native 100/200/400% zoom and effective CSS viewports, reader navigation/values, missing minutes and Refresh/error/recovery outcomes. Its result rows start as **Not run**, not passed. The prior detailed checklist and raw evidence are retained.

Residual risks requiring an express decision are native clipping/overlap or obscured controls, and reader-specific focus/reading order, control interpretation and missing/duplicated announcements. No other confirmed functional blocker is recorded in the accepted evidence. A confirmed unreadable required value or inaccessible required control blocks closure until addressed; an unexecuted check is a verification gap rather than proof of a defect or a pass.

## Owner decision still required

Either execute the native checklist and review the actual results, or explicitly accept the named remaining coverage/risk gaps. No such acceptance has been given. Approval/integration of F2, closure of Issue #29 or green CI does not close Phase 5, complete the MVP or authorize Phase 6. No new product work is prepared by this document. Realistic-energy-pattern simulator work remains separate in the [roadmap](../DEVELOPMENT_PLAN.md#recorded-future-improvement-reproducible-energy-patterns).
