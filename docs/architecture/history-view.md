# Responsive History — delivery A

[Issue #20](https://github.com/libanlsilva/solarwatch/issues/20) is the owner-approved fourth Phase 5 delivery. The owner definitively approved the implementation; this delivery completes with reviewed squash integration of [PR #21](https://github.com/libanlsilva/solarwatch/pull/21). Phase 5 and the MVP remain open. The frozen [History Desktop v1](../design/prototypes/history-desktop-v1/index.html), [History Mobile v1](../design/prototypes/history-mobile-v1/index.html), [states](../design/README.md) and [DESIGN.md](../design/DESIGN.md) are the visual references.

## Navigation and ownership

Open `http://localhost:5173/#history` after following the [local setup](../../README.md#local-setup). Native hash links support direct entry, reload and browser Back/Forward without a router, rewrite rules or dependencies. Overview and Installation retain their existing anchors; returning from History mounts Overview before scrolling to Installation. Cross-view navigation focuses the main region; the skip link focuses the current view without changing its route.

The App keeps **one History query owner** across both screens. Initial entry fetches history once; changing sections reuses its snapshot, pending request, error and original reference without refetching. It does not abort a useful in-flight request merely because the chart presentation changed. On application teardown, the existing request owner aborts work and ignores obsolete completions. No browser clock, polling, background retry, cache library or store is introduced.

Direct History entry does not request Latest Reading. The existing Latest owner starts once when Overview or Installation is first visited. After that, its completed state or in-flight request survives section changes. A valid response can finish while History is open and remains available on return; navigation itself neither refreshes nor clears it.

| Action | Requested resources |
| --- | --- |
| Initial direct History entry / reload | History only |
| Initial Overview / Installation entry | Latest Reading and History independently |
| Navigate between already mounted sections | None; reuse each query's state |
| History header Refresh / Retry, or History Retry notice | History only; disabled while History is pending |
| Overview header Refresh | Each resource without a pending request, as before |
| Overview History Retry | History only, as before |

Request identity, abort handling and the synchronous single-flight guard remain in the existing query owner. Successful empty results replace a populated snapshot; failures retain the exact previous readings, `from`, `to` and `asOf`. The two resources never overwrite one another.

## Read-only context and truthful plots

`HistoryView` composes the window, chart frame, context and coverage. `HistoryPlotFrame` is the actual shared lazy/error-isolated plot wrapper; both screens use the same `HistoryPlot`, parser and preparation functions. The detail variant adds local date labels and larger plot surfaces; the default Overview variant keeps its existing rendering and interactions. No backend, simulator, schema, API contract, dependency or approved prototype changes are needed.

The **Latest available reading** card is strictly the final persisted row in the successful History response, never the separate Latest Reading result. Its original timestamp, solar W, home W and battery % remain together even if a newer reading later appears in the database. It changes only when that history query succeeds. Empty/unknown contexts have no invented timestamp, zero or reading. It is a read-only card, not a selected record.

The [existing contract](reading-history.md) and [chart semantics](overview-charts.md) remain authoritative: exact original UTC/microsecond strings, server-supplied 24-hour window/reference, elapsed-time coordinates, independent W and 0–100% axes, real zero, irregular observations, strict `>300 seconds` curve/fill breaks and unavailable edges. Coverage labels retain exact bounds in `<time datetime>` and full local timestamps in their titles. Historical age is not treated as current-reading freshness. No values are interpolated or extrapolated.

Each chart retains its existing independent tap/click/keyboard tooltip. Inspecting it does **not** change the context card or the other chart. Synchronized Selected Reading, minute buckets, a slider and ±1-minute controls belong exclusively to delivery B, whose own issue and approval follow this PR's integration.

## States and accessibility

| State | History behavior |
| --- | --- |
| Initial Loading | Skeleton charts/context, busy region and loading message; no claimed successful range, reference or metric |
| Empty success | Server window/reference retained, no chart samples or reading values, entire coverage track unavailable |
| Initial Error | Clear alert, History Retry and unknown context/window; no fabricated empty success |
| Refreshing | Existing plots/context remain visible, progress announced, History Refresh disabled; no duplicates |
| Retained Data | Failure alert and retry, old data and original reference/window preserved; explicit previous-result qualification |
| Partial History | Shaded unavailable intervals, broken curves and coverage explanation/ranges; no missing-to-zero substitution |

Heading hierarchy, landmark focus, active navigation, visible keyboard focus, native disabled buttons, 44px navigation/action targets, 12px minimum supporting labels and explicit W/% units follow the approved system. Status/alert messages announce query results; chart keyboard interaction remains independent. Existing reduced-motion rules disable animated refresh indication and smooth scrolling; plots never animate measured values. The authorized photograph has its existing illustrative alternative text and simulated-data labels remain visible.

## Responsive and visual comparison

The desktop retains the approved subdued photograph (`350px`, `.68` opacity, `center 52%`), 44px heading, full-width window, wide combined plot card and 294px right context/coverage column. At 901–1250px the side column becomes 270px and the window metadata wraps. At 900px and below, the existing shared mobile shell/header is used, with the approved `340px` photo and `43% center` crop, 32px title, compact three-value context above separate power/battery cards and coverage below. Gutters reduce from 16px to 12px below 375px.

On mobile heights **740px or less**, only the header remains sticky; the context card scrolls normally. On taller phones the context uses the measured header offset. This deliberately resolves the recorded short-phone observation without reducing text or touch targets. Browser checks cover 360, 390, 430, 768, 1024 and 1440px, plus 360×640 and 390×667; they verify overflow, actual plot reachability and controls after layout settles.

Measured short-phone results (reduced motion, actual application):

| Viewport | Sticky header | Scrolling context card | Space below header | Power plot |
| --- | --- | --- | --- | --- |
| 360×640 | 131px | 175.72px | 509px | 210px, fully reachable |
| 390×667 | 131px | 176.97px | 536px | 210px, fully reachable |

Real API/PostgreSQL captures, separate from the frozen prototypes:

- [Desktop full-day History](../screenshots/history-desktop.png).
- [Mobile initial viewport](../screenshots/history-mobile.png) and [complete mobile page](../screenshots/history-mobile-full.png).
- [Partial History desktop](../screenshots/history-partial-desktop.png) and [mobile](../screenshots/history-partial-mobile-full.png).

Intentional intermediate differences: the card says Latest available reading and omits all synchronized/minute controls; no disabled imitation controls are shipped. Charts use the existing truthful Recharts engine and independent recorded-point tooltips, with three local time/date marks for detail readability rather than the prototype's hand-drawn axis. Both panels show dates independently. Coverage comes from actual responses, not the prototype's example missing intervals. Real full-day curves remain dense because the existing simulator generates independent random values; realistic patterns are separately planned. No smoothing, downsampling or invented measurements disguise that limitation. The short-phone sticky adaptation is described above. The photo, navigation, palette, typography and dedicated desktop/mobile composition are preserved.

The existing owner-authorized photo is reused; no new third-party resources are published. See [asset provenance](../design/ASSETS.md). The full-day captures reuse the existing 1,441-POST simulator E2E journey and its successful database response, avoiding another bulk setup. They may contain slightly fewer than 1,441 rows because the live server window advances before consultation; every returned row is verified in the plotted path. Partial captures use six records persisted through the actual API, including zero, exact five-minute spacing and gaps. No fixture values are shipped in application code.

## Verification

The existing three workflows automatically discover the added unit/spec files; no test exclusion, extra service or workflow change is required. New unit cases verify hash resolution, exact last-history-row identity, zero/microsecond preservation, correct coverage edge/interior classification and empty context. New Full Stack tests verify direct/reload/Back/Forward navigation, lazy Latest acquisition, cache-free owner reuse, History-only Refresh, in-flight navigation, duplicate guards, errors/retry/retention, successful-empty clearing, reload cancellation, real PostgreSQL values/geometry/gaps, keyboard and actual touchscreen behavior, responsive/short-phone accessibility and capture export. Existing owner tests still cover ignored-abort obsolete completions and the full Overview/simulator behavior.

Browser development/finite-simulator helpers now execute the same already-built Release DLLs directly, as the existing full-history journey already did. This avoids repeated MSBuild startup during each test command on Windows; it changes neither CLI arguments/behavior nor assertions, time limits, test discovery or the application's development commands. The Release solution must still be built first, as CI already does.

Run the README's restore, Release build, backend tests, frontend lint/build/unit and Playwright commands using separate `_tests` and `_e2e` PostgreSQL databases. Production hosting and interactive History delivery B are outside this increment; the current MVP remains local-development scope.

Final local validation: **116 backend unit + 56 real PostgreSQL integration + 33 frontend unit + 26 Playwright = 231 passing tests, no skips**. Restore and Release build pass with zero warnings/errors; frontend lint/build pass. The final full browser run passed all 26 cases in 5.8 minutes, with the actual 1,441-request initial/repeat timings of 15.604s / 67.186s on this Windows machine. Earlier overlapping local browser checks exhausted time budgets (and one worker exited); sequential validation with the prebuilt CLI helpers passed without increasing timeouts or removing assertions. These local timing variations are not a performance benchmark. The approved export verifier also passes: 60 unchanged exports, eight main layouts, 24 state cases, 12 gallery pairs, no script/data-request/resource errors; all 55 local Markdown targets in changed documents exist. CI remains the independent clean-run verification.
