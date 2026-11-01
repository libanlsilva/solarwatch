# Phase 5 product validation

Owner-approved [Issue #24](https://github.com/libanlsilva/solarwatch/issues/24). Product baseline: main `c0b1d58301bd5d78e796c8d49a93668710037b51` (History B integrated through PR #23). **Phase 5 and the MVP remain pending.** This delivery changes verification/documentation only. It proposes the focused [Refresh accessibility correction #26](https://github.com/libanlsilva/solarwatch/issues/26), without implementing it.

**Recommendation:** retain Phase 5's open status until the owner reviews the findings, the recommended blocking correction and the unverified manual checks. Green automated tests do not settle those decisions. The realistic-energy-pattern simulator improvement remains separate and is not a blocker for this audit.

## Post-audit status

The owner personally approved this audit and its findings; [PR #27](https://github.com/libanlsilva/solarwatch/pull/27) was squash-integrated as `7db08d3` and Issue #24 is closed. All three workflows passed on that main commit. The report, original evidence and findings below describe the audited baseline and remain unchanged.

The owner separately approved implementing F1 through [Issue #26](https://github.com/libanlsilva/solarwatch/issues/26). The [focused correction record](REFRESH_ACCESSIBILITY.md) documents the implementation, regression and AX-tree evidence, pending personal PR review. This does not close Phase 5 or the MVP. F2 remains a separate low-severity readability observation; native screen-reader/zoom checks remain unverified. The realistic-pattern simulator improvement remains independent.

## Execution and evidence

The [portable evidence record](evidence/phase5.json) contains versions, server references, persisted sample identities, response digest, restart comparison, all 48 layout cases, seven History footprints, contrast measurements and image hashes. Windows NT 10.0.26300.0; .NET SDK 10.0.300; Node 24.15.0; npm 12.2.0; PostgreSQL 17.11; Chromium 156.0.8078.4; browser zone `America/Havana`.

| Executed automatic check | Result |
| --- | --- |
| .NET restore / Release build | Pass; zero warnings/errors |
| Backend unit / real PostgreSQL integration | **116 / 56 pass**, zero skips |
| Frontend lint / production build / unit | Pass; **46 unit tests**, zero skips |
| Real PostgreSQL → API → React Playwright suite | **32 pass**, zero skips; 3.8 minutes locally |
| Total existing suite | **250 pass**; no tests removed or added to inflate the count |
| Additional local audit collectors | 48 layouts, 132 focus observations, seven History footprints; no page/card overflow, undersized enabled controls, occluded focus centers or script errors observed |
| Composited text-contrast sampling | 1,425 visible text runs; minimum **5.50:1 normal / 9.05:1 large**, against design targets 4.5 / 3. Nine rendered-background samples per run; disabled/hidden text excluded |
| Frozen prototype verification, final unmodified run | 60 matching exports; eight layouts, 24 states, 12 gallery pairs; no script/data-request/resource errors |

The complete suite remains the CI baseline. The added collectors are local diagnostic tools, not extra passing acceptance tests or a new CI gate; their observations include the findings below. The audit PR's checks provide independent CI results for its final head. Native screen-reader output and native browser zoom were **not** verified.

## Requirements matrix

Results apply to this verification scope; they do not declare the entire MVP released. References point to the existing executed tests and actual evidence, rather than new duplicate cases.

| MVP requirement | Evidence / method | Result and observations |
| --- | --- | --- |
| AC-01 Single simulated installation | Actual Overview/History/Installation inspection; [Overview browser cases](../../frontend/tests/e2e/overview.spec.ts) | Pass: residential demo and simulated labels; conceptual installation has no measured energy-flow claim |
| AC-02 Same persisted latest snapshot | [Full Stack latest tests](../../frontend/tests/e2e/latest-reading.spec.ts); live Chrome after restart | Pass: 1,200 W / 800 W / 65% and original `22:53:00.123456Z` instant came from the same PostgreSQL row |
| AC-03 Persistence across API restart | Actual audit API process stopped/restarted with PostgreSQL retained; before/after HTTP comparisons in evidence | Pass: latest identity/values and all six observations unchanged; server reference advanced; Chrome reload displayed the same row |
| AC-04 Loading/Empty/Error/Retry/Refresh | Existing latest, [chart](../../frontend/tests/e2e/history-charts.spec.ts) and [History view](../../frontend/tests/e2e/history-view.spec.ts) cases | Functional cases pass: independent resources, pending navigation, single flight, retained original snapshots and successful-empty clearing. Accessibility finding F1 remains |
| AC-05 UTC, local zone, freshness | [Reading unit cases](../../frontend/tests/unit/readings.test.ts), latest/browser-clock tests and actual stale Chrome inspection | Pass: strict `>300s`, server `asOf`, retained-reference qualification and no fabricated timestamp |
| AC-06 Inclusive historical window | [PostgreSQL history integration](../../backend/tests/SolarWatch.IntegrationTests/ReadingHistoryTests.cs), [History unit cases](../../frontend/tests/unit/history.test.ts) | Pass: inclusive microsecond limits, chronological original rows, irregular samples, zero and more than 1,441 samples supported |
| AC-07 Missing/partial/empty history | Existing chart geometry and History state cases; sparse audit data | Pass: missing minutes unavailable, uncovered edges retained, curves/fills break at `>300s`, exactly 300s remains connected without inventing intermediate observations |
| AC-08 Validation / AC-09 Duplicates | [Submission unit cases](../../backend/tests/SolarWatch.UnitTests/SubmitReadingTests.cs), [real PostgreSQL ingestion cases](../../backend/tests/SolarWatch.IntegrationTests/IngestionTests.cs) | Pass: validation, boundaries, normalized identity and concurrent HTTP 409 preserve original data |
| AC-10 Out-of-order arrivals | Existing latest/history and ingestion integration cases | Pass: older persisted rows stay chronological without replacing the latest row |
| AC-11 Reproducible data preparation | Existing actual finite/continuous/1,441-request simulator journeys | Pass for implemented host-run path; fresh-clone/container release verification remains Phase 6. Full-series local CLI timings: 5.601s fresh / 9.099s conflict repeat, not benchmarks |
| AC-12 Full Stack verification/documentation | Complete 250-test run, actual API restart, diagnostic evidence and captures | Verification delivered with findings/limitations; no claim of release or complete assistive-technology approval |
| History B interaction requirements | [Selection units](../../frontend/tests/unit/history-selection.test.ts), [real PostgreSQL selection browser cases](../../frontend/tests/e2e/history-selection.spec.ts) | Pass: exact microseconds, multiple rows/minute, minute gaps, UTC/DST offsets, shared selection, pending user changes, disappeared records, changed membership and reset/empty rules |

Positive Full Stack observations use actual persisted API responses. Dedicated `_tests` / `_e2e` databases isolate destructive test setup. The existing suite intentionally uses controlled loader payloads, response fulfillment, delayed requests, aborts and browser-clock overrides for specific boundary/error/state cases; those are **test-only simulations**, not proof that each such case independently exercised PostgreSQL. The diagnostic collectors block external fonts to test fallback; the contrast collector also aborts GETs for retained-error sampling. No application fixtures, new endpoints or generated frontend curves were introduced.

## Responsive and accessibility observations

Overview, Installation and History were checked at **360×640, 390×667, 430×844, 768×1024, 1024×900 and 1440×1186**, plus **374/375, 899/900/901 and 1249/1250/1251px** transitions and **667×375 / 844×390 landscape**. Those 16 sizes across three sections yield 48 cases. Resizing and section navigation used only one Latest and one History request after initial acquisition. Existing tests separately verify reload, direct entry, Back/Forward, unknown hashes, pending navigation, cancellation, independent Refresh/Retry and obsolete completions.

| History scenario | Viewport | Header | Context | Observation |
| --- | --- | --- | --- | --- |
| Selected / unavailable minute | 390×844 | 131px | 249.36px, sticky | Plots/controls reachable; no hidden value substitutes |
| Overlapping observations | 390×844 | 131px | 288.14px, sticky | Explicit minute/count qualification; keyboard reaches individual microsecond records |
| 200% HTML text | 390×844 / 390×667 | 259px | 536.16px, scrolling | Graphs reachable; numeric wrapping noted in F2 |
| 200% HTML text, short phone | 360×640 | 259px | 575.34px, scrolling | No horizontal overflow or occluded focus center; see F2 |
| 200% HTML text, landscape | 844×390 | 151px | 395.77px, scrolling | Controls/plots remain reachable |

The existing short-phone tests also verify normal-text 360×640 and 390×667: a 131px header and scrolling context leave 509/536px below the header for a 210px power plot. The collector's complete Tab cycles preserve logical operability, visible outlines and no trap; it uses a one-CSS-pixel tolerance for fractional viewport edges. Mobile DOM focus reaches charts before minute controls despite the inspector's visual placement; no blocked interaction was observed. Touch checks use Chromium's touchscreen API, **not a physical phone**.

Supporting text, axes, legends, units, accessible names, live-region markup and reduced motion were inspected in the existing suite and the additional browser/DOM evidence. Sampled normal/retained text passes the design contrast targets over actual photo/card backgrounds. Focus outlines use the approved yellow and remain visibly distinct. Sampling is not exhaustive pixel coverage or a certification of every thin decorative border, disabled state or assistive-technology behavior.

**Agent-directed manual review actually performed:** compared the four new application captures with all four frozen prototypes; used connected Chrome to select the first persisted zero reading with Home, step to an unavailable minute, navigate Overview/Installation and reload after the real API restart. DOM/Chrome accessibility-tree inspection confirmed values, units, original timestamps, unavailable text and F1. This was agent-operated browser inspection, not independent human testing or a spoken screen-reader session.

**Pending:** native browser zoom/reflow, a native screen-reader smoke trial and physical mobile browser-chrome/safe-area behavior. Windows native input was unavailable (`native pipe unavailable`) after recovery attempts. HTML text enlargement and browser accessibility-tree inspection are explicitly separate evidence, not substitutes for those trials. Owner disposition is required before treating the outstanding checks as accepted.

## Findings and disposition

| ID | Reproduce / observed result | Severity | Phase 5 disposition |
| --- | --- | --- | --- |
| F1 — Inaccurate idle Refresh guidance | Load any section, wait for zero busy regions: `#refresh-available` still exposes “A request is in progress…” to Chrome's accessibility tree although the enabled button has no description relationship. The collector records this idle DOM state; live Chrome inspection reproduced it | Medium accessibility defect | **Recommended blocker until correction or explicit owner disposition.** Focused [issue #26](https://github.com/libanlsilva/solarwatch/issues/26) prepared; implementation not started |
| F2 — Enlarged numeric wrapping | Run the collector's 200% HTML-text scenario at 360/390px: the unchanged value `1,200` wraps across two lines in Selected Reading. Units/DOM value remain correct, no overflow/blocked control, and landscape fits on one line; [capture](screenshots/history-text-200.png) | Low readability observation | Non-blocking recommendation, for owner review. A targeted reflow refinement can be scoped separately; no redesign or product correction included here |
| D1 — Stale requirements status | MVP document's status still described history/design as future work despite integrated deliveries | Low documentation inconsistency | Resolved in this PR by updating status/handoff context only; approved criteria remain unchanged |
| V1 — Native accessibility checks unavailable | Native Windows helper could not connect; no verified native zoom or screen-reader session | Verification gap, not a confirmed product defect | Pending explicit owner review; not silently treated as passed |

An initial frozen-export checker invocation returned its aggregate resource/isolation failure. A log-only in-memory diagnostic rerun and the final **unmodified** checker both passed all checks; the initial cause was not reproduced. This is recorded as non-blocking verification-tool intermittency, not an application defect or a reason to rewrite frozen exports.

## Visual comparison

| Approved reference | Current real Full Stack capture | Relevant difference |
| --- | --- | --- |
| [Overview Desktop v2](../design/prototypes/desktop-v2/index.html) | [Desktop](screenshots/overview-desktop.png) | Same photograph, asymmetric metric cards and composition. Real range/reference/status copy adds height; neutral metric accents do not invent sparklines |
| [Overview Mobile v1](../design/prototypes/mobile-v1/index.html) | [Mobile](screenshots/overview-mobile.png) | Same photo, compact navigation, power pair and battery/measurement composition; real metadata replaces illustrative labels |
| [History Desktop v1](../design/prototypes/history-desktop-v1/index.html) | [Desktop](screenshots/history-desktop.png) | Same dedicated plot/inspector/coverage structure; three real local date/time ticks and exact/count context replace fixture annotations |
| [History Mobile v1](../design/prototypes/history-mobile-v1/index.html) | [Mobile](screenshots/history-mobile.png) | Same mobile inspector/slider/plot order; real fractional timestamps and state qualification increase card height; short-height sticky adaptation preserves access |

These four captures were exported by this run's real simulator/API/PostgreSQL browser journey. The 1,441 rows were persisted; the later live inclusive query returned 1,440 in-window rows as server time advanced. Its small uncovered edges correctly produce partial coverage. Dense independent random curves are faithful to stored data; realistic patterns remain separate planned simulator work. No smoothing, invented values or prototype modification masks those differences. The existing photograph publication permission applies; no external reference imagery is included.

## Reproduce

Run the existing README restore/build/backend/unit/Playwright commands with separate `_tests` and `_e2e` PostgreSQL databases. For the additional collectors, configure a **new empty disposable audit database** (this run: `solarwatch_phase5_e2e`), migrate using the existing Development CLI, run its API on `127.0.0.1:5191`, and run the production Vite preview on `127.0.0.1:4191` with `SOLARWATCH_API_URL` pointing to that API. Connection credentials remain in ignored environment configuration.

```sh
node docs/validation/checks/seed-phase5-audit.cjs
node docs/validation/checks/phase5-audit.cjs
node docs/validation/checks/phase5-contrast.cjs
node docs/design/checks/verify-prototypes.cjs
```

The audit seed submits six real POSTs: zero, irregular gaps, two same-millisecond microsecond records and exactly five-minute neighbors. It refuses a populated installation and never clears/overwrites existing data; failure leaves earlier accepted rows for inspection. The collectors use only GETs/UI inspection, apart from explicitly simulated GET failures in the contrast check. Optional loopback `SOLARWATCH_AUDIT_URL` / `SOLARWATCH_AUDIT_API` override their addresses. Raw machine-run output goes to ignored `artifacts/phase5-audit`; the portable evidence and selected actual captures are versioned here. No dependency, backend, HTTP contract, migration, simulator or application code changed.
