# Real history charts in Overview

Third Phase 5 delivery, [Issue #18](https://github.com/libanlsilva/solarwatch/issues/18): replace the two pending-history cards with real API-backed plots. The implementation is definitively owner-approved and complete with reviewed squash integration of [PR #19](https://github.com/libanlsilva/solarwatch/pull/19). Phase 5 and the MVP remain open. The approved Overview composition, navigation, photo, metrics and installation are preserved; detailed History and synchronized minute selection remain later work.

## Data and time

React requests the existing [24-hour history endpoint](reading-history.md). `parseHistory` validates the response shape, UTC instants, `asOf == to`, exactly 24 hours between bounds, finite supported metrics, chronological uniqueness and inclusive membership. An invalid response is a History error rather than an empty success or a reason to discard records silently.

The original UTC strings are retained for reading identity and HTML `time` attributes. `utcMicroseconds` parses the API's microsecond precision into `bigint`; window validation, ordering and gap comparisons do not pass through JavaScript Date's millisecond truncation. The plotted coordinate is `Number(readingInstant - fromInstant) / 1000`: relative milliseconds inside a 24-hour interval. Distinct sub-millisecond samples remain distinct. No minute grid, averaging, generated measurement or 1,441-row cap is introduced.

Both charts use the entire server `[from, to]` domain. X is elapsed time, not index/category spacing. Power has solar generation in solid yellow and consumption in dashed teal, in **W**; its scale includes zero and every actual power value. Battery uses lime and an independent **0–100%** scale. An all-zero power result receives a usable 0–1 axis without adding a 1 W observation. A lone measurement is rendered as a point. The battery badge identifies the last actual sample **inside this history window**, which may differ from Latest Reading's own result.

Dates and axis labels use the identified local IANA zone. Range endpoints retain both local dates; UTC offsets at the endpoints distinguish DST changes. The successful History `asOf` is displayed separately from Latest Reading's check. Original fractional precision remains available in timestamp attributes and point readouts; the human-readable check label uses seconds. Browser clock skew cannot move the query window, advance freshness or create a new successful reference.

## Gaps and partial windows

`prepareHistory` keeps every persisted sample. An interval **strictly greater than 300 seconds** inserts a null-valued rendering break with no `reading`; both strokes and area fills stop there. Exactly 300 seconds remains connected. Recharts uses straight segments between observed samples, no smoothing and `connectNulls={false}`. The break marker is presentation metadata, not an interpolated sample or a tooltip value.

Neutral hatched bands identify missing intervals and the uncovered span before the first/after the last reading. Curves are never extended to a window boundary. Isolated observations remain visible. Empty history has no curve or substitute zero. Partial History is a qualitative notice, with no invented coverage percentage or expected-minute count.

A live window often has small uncovered edges even after the unchanged simulator successfully inserted 1,441 inclusive samples: the subsequent GET captures a later reference. Such windows can legitimately show Partial History. This is not evidence of failed ingestion. The existing simulator also produces independent random values, so a dense full-day plot is noisier than the illustrative prototype; this delivery deliberately preserves those persisted values and does not redesign simulation patterns.

## Independent state and manual actions

`useLatestReading` and `useHistory` own separate lifecycle instances, successful snapshots, references, pending flags and errors. Their wrappers reuse only the small `createReadingQuery` state machine; there is no shared cache, polling, automatic retry, focus/reconnect fetch or query framework.

- Initial mount starts each resource independently.
- Shared Refresh calls both request owners, each of which synchronously ignores a duplicate pending request. It is disabled only when **both** are pending. When one is free, the accessible name is **Refresh available data** and the button remains usable; Latest's existing Retry label is retained when relevant.
- History Retry targets only History. A pending/failing History request cannot disable Latest, and vice versa.
- Pending requests retain their own old snapshot. A failed update preserves the exact prior data, bounds and `asOf`; successful empty clears only that resource. Loading/empty/error/refreshing/retained notices are scoped to their data regions. Partial coverage may coexist with refreshing or retained data.
- AbortController identity guards reject cancelled/obsolete successes and failures, including a loader that completes after cancellation. An old response cannot clear a newer request's pending flag. React cleanup cancels only that mounted resource's owner.

Latest Reading's API, parser and freshness rule remain unchanged: stale is based on its successful server check, strictly more than 300 seconds, never a browser-clock timer. Historical points are not stale because of their age.

## Chart library decision and bundle cost

Use **Recharts 3.10.1**, pinned with its required **react-is 19.3.1** peer matching the existing React version. The installed package declares React 19 compatibility and an MIT license; TypeScript production compilation and the browser suite exercise the actual dependency combination. See the official [package metadata](https://github.com/recharts/recharts/blob/main/package.json) and [license](https://github.com/recharts/recharts/blob/main/LICENSE).

The [Line API](https://recharts.github.io/en-US/api/Line/), numeric [axis domains](https://recharts.github.io/en-US/api/XAxis/) and [accessibility layer](https://recharts.github.io/en-US/api/ComposedChart/) support the required plot primitives. Missing-interval detection, validation, labels and states are SolarWatch responsibilities; default null behavior alone would bridge omitted API rows. Plain SVG would avoid a dependency but require maintaining axes, sizing and accessible readout mechanics. Recharts is justified for these two plots and later separately approved chart reuse. Its internal transitive packages do not introduce application-level Redux or a UI framework.

Measured Vite production JavaScript sizes (decimal kB; not a performance benchmark):

| Build | Minified | Gzip |
| --- | --- | --- |
| Baseline Overview before charts | 234.84 | 73.06 |
| Initial chart implementation in one chunk | 613.45 | 181.87 |
| Final initial application entry | 243.76 | 75.81 |
| Additional on-demand chart module | 373.01 | 107.38 |

The chart library is isolated in `HistoryPlot.tsx`, loaded with React lazy/Suspense only when there are observations to draw. Current metrics and empty/error history do not wait for that module. A scoped error boundary contains a failed chart-module download while leaving metrics, navigation and successful server metadata available; the user can reload the page to retry loading the application asset. This is distinct from an API History Retry. No chunk-size warning limit is raised. CSS, the photograph, fonts and HTTP overhead are outside the JavaScript table.

Only Recharts and its necessary peer were added directly; npm added 39 packages in total, including these direct dependencies and their transitive/peer packages and the installation audit reported zero vulnerabilities at validation time. No UI framework, query/date library, backend dependency or build tooling was added. Keep the lockfile versioned; this audit is a point-in-time result, not a future security guarantee.

## Visual comparison and accessibility

Use the frozen [Overview Desktop v2 / Mobile v1](../design/README.md) and [DESIGN.md](../design/DESIGN.md) as the reference. Actual application captures:

- [Desktop 1440px](../screenshots/overview-charts-desktop.png).
- [Mobile 390px initial](../screenshots/overview-charts-mobile.png) and [complete mobile page](../screenshots/overview-charts-mobile-full.png).

These come from the production preview, real .NET API and dedicated PostgreSQL E2E database after the existing `--history-24h` CLI journey. The same test already verifies all 1,441 HTTP acknowledgments and duplicate reruns; capture setup does not add another large ingestion run. Successful curves are never browser fixtures. The browser clock is deliberately skewed in that journey; displayed dates still come from the real server response.

The shell, photo, asymmetric metrics and installation layout are unchanged. The two approved plot regions now contain the actual scales/values rather than illustrative curves or pending notices. Mobile uses the approved compact chart titles. Real server range/check dates, qualitative missing-data feedback and a clearly scoped historical battery badge are intentional adaptations. Their text can make cards taller than static prototypes, with the existing flexible desktop columns remaining balanced. The original first-delivery captures are preserved.

Series have text labels and a dashed consumption trace, not color alone. Plots expose units and accessible names, visible keyboard focus and recorded-reading readouts through keyboard and tap/click. Tooltips show only actual readings, including original fractional timestamps. A small per-chart handoff between pointer/touch and keyboard ensures arrow keys move through real records after a tap; it bypasses the chart library's sticky click-tooltip precedence and skips rendering-only break markers. Escape dismisses the readout. These independent tooltips do not add a synchronized inspector, slider or minute-step control. Static skeletons and non-animated traces respect reduced motion, and status announcements are scoped without repeating the same history message for each plot.

Check 360/390/430/768/1024/1440px, short 360×640, text enlargement and no page/card overflow. The library's accessibility layer is a starting point, not a complete screen-reader/device audit. Physical browser chrome/native zoom and the later History Mobile sticky-height observation remain release/detailed-History checks. Google Fonts failure may still use the approved font fallback.

Playwright bounds only the external Google Fonts requests to three seconds: successful responses use the real font; unresponsive delivery uses the application's existing fallback. This prevents an unrelated font stylesheet from holding navigation open indefinitely. Application font configuration, API responses, test timeouts and assertions are unchanged. Real versioned captures were reviewed with the approved font; the functional browser suite also supports its declared fallback.

## Reproduce and verify

Follow the [README local setup](../../README.md#local-setup), then prepare data with the existing simulator command documented in [reading history](reading-history.md#reproduce-locally). Open Overview and press Refresh to request both eligible resources. A single current `seed-demo` produces an isolated historical point, not a fabricated full-day curve. Keep test databases separate from the local demo.

Frontend unit tests verify metadata and calendar validation, exact UTC/microsecond comparisons, irregular-time geometry, the five-minute boundary, null breaks/edges, zero/single/empty/all-zero histories, more than 1,441 observations, DST labels, independent request owners, retained references and cancellation/obsolete responses. Existing latest tests remain in place.

Playwright verifies real PostgreSQL/API values and SVG coordinates/path segments, full-data rendering, new persisted readings found only after manual Refresh, the history states, independent errors in both directions, partial-resource refresh/duplicate guards, keyboard/touch and responsive behavior. Controlled failures appear only in tests. The full-history CLI journey counts every returned row in the plotted path and exports real captures. Another case verifies chart-module failure containment.

The existing workflows discover all new unit/spec files automatically. Backend tests and the full existing simulator/latest/Overview journeys remain in CI. Detailed History, synchronized selection, backend/simulator changes and any further delivery require separate approval.

Validation totals for this delivery: **116 backend unit, 56 real PostgreSQL integration, 29 frontend unit and 21 Playwright tests pass** (222 total, zero skips), with frontend lint/production build passing. The final keyboard test asserts that successive left/right actions change the original recorded timestamp after a tap, rather than merely checking tooltip visibility. Existing latest/simulator assertions are retained; their locators/pending setup are scoped for the newly independent History resource.
