# Refresh accessibility correction

Owner-approved [Issue #26](https://github.com/libanlsilva/solarwatch/issues/26), based on main `7db08d3` after the personally approved audit [PR #27](https://github.com/libanlsilva/solarwatch/pull/27). **F1 is corrected and personally approved:** [PR #28](https://github.com/libanlsilva/solarwatch/pull/28) was squash-integrated as `269f132`; Issue #26 is closed. **Phase 5 and the MVP remain pending.**

## Finding and bounded change

Audit F1 exposed “A request is in progress…” as standalone accessibility-tree text even after requests settled. The shared header now renders its description target only when `pending && !disabled`, exactly matching the existing `aria-describedby` condition. The target uses native HTML `hidden`: Chromium uses its referenced text for the button's computed accessible description without exposing a second standalone text node. Neither idle nor both-pending states contain the target or description reference. No live region is added.

This is one presentation-line change. Button names, eligible-resource Refresh, History-only Retry, single-flight guards, retained data, independent query ownership, CSS, approved design, backend, simulator and dependencies are unchanged.

## Regression and actual accessibility-tree evidence

The [new browser regression](../../frontend/tests/e2e/refresh-accessibility.spec.ts) queries Chromium CDP `Accessibility.getFullAXTree` and filters ignored nodes. It checks the button's computed accessible description, target existence, description relationship, absence of standalone/duplicate guidance, and existing live-region text. [Portable evidence](evidence/refresh-guidance-ax.json) records **17 states**, button names/references, exposed guidance nodes, live messages and request counts.

| Executed transition | Expected and observed result |
| --- | --- |
| Initial or refreshed Latest + History both pending | Disabled Refreshing button; no guidance target, relationship or exposed guidance node |
| History pending, Latest eligible; reverse mixed state | One accurate computed button description; no separate guidance node or live announcement; clicking requests only the eligible resource |
| Settled success; Overview / Installation / History idle navigation | No in-progress guidance; navigation causes no additional requests |
| Latest failure with History still pending | Retained Latest warning and Retry; one mixed-state button description; retry does not duplicate History |
| Both pending during retry, then success | Description removed; existing resource statuses remain; recovery restores idle button |
| History-only refresh, failure, retry and recovery | No mixed-resource guidance; retained History warning and existing Retry work; no Latest request |

Successful responses use the real .NET API and PostgreSQL seed; the original persisted row is included in the evidence. Test-only gates delay GET requests before continuing them to the real API. Explicit `route.abort()` simulates Latest/History failures; these failures are not claimed as actual database outages. Final request counts are Latest **4**, History **5**; successful History recovery retains the persisted timestamp.

## Verification and reproduction

| Executed check | Result |
| --- | --- |
| .NET restore / Release build | Pass, zero build warnings/errors |
| Backend unit / real PostgreSQL integration | 116 / 56 pass; no skips |
| Frontend lint / production build / unit | Pass; 46 unit tests; no skips |
| Complete real PostgreSQL / API / React Playwright suite | 33 pass; no skips |
| Total | **251 pass**: all 250 baseline tests preserved plus one focused regression |

All three workflows passed on the integrated main commit `269f132`: [Backend CI](https://github.com/libanlsilva/solarwatch/actions/runs/41267832032), [Frontend CI](https://github.com/libanlsilva/solarwatch/actions/runs/41267832108) and [Full Stack E2E](https://github.com/libanlsilva/solarwatch/actions/runs/41267832091). The original versioned AX record remains unchanged.

Use the README's dedicated `_tests` / `_e2e` database setup and test commands. After the Release API and production frontend builds, run all browser tests with `npm run test:e2e` from `frontend`, or only this regression with:

```sh
npx playwright test tests/e2e/refresh-accessibility.spec.ts
```

The test generates and attaches `refresh-guidance-ax.json` in its Playwright output directory on every run, including CI. The versioned portable record is from the complete local suite; generated test output remains ignored. The existing E2E workflow discovers the new test automatically, with no workflow changes.

## Remaining limitations

The AX-tree and computed-description checks verify browser accessibility semantics, **not spoken screen-reader output or native browser zoom**. Those native checks remain unverified and require owner disposition. [Issue #29](https://github.com/libanlsilva/solarwatch/issues/29) proposes the focused F2/native-check follow-up for review; implementation has not started. F2 (200% HTML-text numeric wrapping) remains documented in the [original audit](PHASE5.md); it is not modified or accepted as resolved here. No new visual capture is needed for this nonvisual correction; the four approved prototypes and original audit captures remain intact. Realistic simulator patterns remain separate future work. Neither this correction nor green CI completes Phase 5 or the MVP.
