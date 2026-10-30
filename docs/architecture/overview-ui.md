# Approved Overview implementation

First Phase 5 delivery, tracked in [Issue #14](https://github.com/libanlsilva/solarwatch/issues/14), personally approved and complete with reviewed squash integration of [PR #15](https://github.com/libanlsilva/solarwatch/pull/15). Phase 4 is complete; Phase 5 and the MVP remain open. The backend contract, database schema, simulator, security guards and dependencies are unchanged. The separate [history API delivery](reading-history.md), tracked in Issue #16, awaits personal PR review and integration; historical charts and changes to the approved Overview remain outside that delivery and require separate approval.

## Design and component boundaries

Use the frozen [Desktop v2 and Mobile v1](../design/README.md) and [small design system](../design/DESIGN.md) as visual references. The implementation retains their dark palette, Manrope typography, owner-authorized solar photograph, asymmetric overlaid power cards, circular battery gauge, compact navigation and neutral branched installation diagram.

`App.tsx` composes the screen. The small components in `components/Overview.tsx` own navigation, metric cards, measurement/gauge presentation, installation, query notices and explicitly unavailable historical regions. They receive values/state rather than fetch data. No dashboard framework or general-purpose query library is introduced.

`latestReadingQuery.ts` owns one purpose-built latest request lifecycle; `useLatestReading.ts` binds it to React mount/cleanup and manual actions. `readings.ts` retains the existing response validation and strict server-based freshness rule. `measurementDisplay.ts` formats numbers, local dates/offsets and age from response instants, without reading the browser clock.

## Data and request behavior

- All solar W, consumption W and battery % values come from `GET /api/readings/latest`. There are no runtime fixture scripts or synthetic fallback values. Real zero is rendered as zero; unavailable values have neutral dashes/text and no fabricated measurement timestamp or zero-valued gauge.
- Initial mount starts a request. Refresh/Retry are explicit user actions; there is no polling, automatic retry, focus/reconnect fetch or clock-driven freshness update. Pending buttons are natively disabled and the query also rejects duplicate starts synchronously.
- Pending refresh retains the successful snapshot. Failure retains the exact values and original `asOf`, including a stale label when applicable, and says current freshness could not be verified. Initial error means unknown availability; a prior successful empty result is qualified after failed refresh. A later successful empty response clears old measurements.
- Cancellation aborts transport and invalidates its identity. Even if a loader completes after cancellation, it cannot publish into a newer request or clear its busy state. React cleanup cancels the mounted view's owner; development StrictMode remounts receive a new owner.
- Stale means `asOf - measuredAt > 300 seconds`. Exactly 300 seconds remains fresh. Age is the duration at that successful server check, not a live counter. Measurement and check dates/offsets use their own actual instants, including DST differences. No successful time is invented while initially loading or failing.
- Only the latest resource is queried by React. Future historical requests must keep their own snapshot/reference/error/busy state, as required by the design system; a failed history query must not disable latest metrics.

## Responsive navigation and accessibility

Desktop at 1440px retains the approved two-column layout and exposed roof photograph. At 901–1199px, compact header/navigation rows and a vertically arranged battery/latest pair keep content readable. At 900px and below, the dedicated mobile composition takes over: two-row compact header, mobile hero, offset power pair, combined battery/latest card, historical regions then installation. Intermediate mobile/tablet surfaces grow fluidly up to 600px rather than stretching a phone indefinitely; they are content-fit adaptations, not new approved design versions.

Overview and Installation use real in-page anchors with current-section semantics synchronized to the hash, including browser Back and direct fragment links. History is a non-interactive, explicitly unavailable section with “Coming later”, not a link or pretend screen. A skip link reaches main content. The mobile header wraps for enlarged text; its measured height sets the anchor scroll offset through `ResizeObserver`, so targets stay below the sticky region. No timer is used.

Controls have at least 44px touch targets, native keyboard behavior and visible yellow focus. Status/alert feedback lives outside the updating metric regions; `aria-busy` is scoped to latest data. The gauge exposes a numeric meter for real readings; decorative SVGs and skeletons are hidden appropriately. Static skeletons do not shimmer; reduced motion disables spinner animation and smooth scrolling. Missing values, stale and failed refresh have explicit text, not just colors.

## Visual comparison and intentional differences

Actual application captures, using the production preview and real local PostgreSQL/API data:

- [Desktop 1440px](../screenshots/overview-desktop.png).
- [Mobile 390×844](../screenshots/overview-mobile.png) and [full mobile page](../screenshots/overview-mobile-full.png).

The photograph, palette, major card positions, asymmetric offsets, desktop columns, mobile grouping and installation are preserved from the approved references. Relevant differences:

1. Both history cards keep their surfaces/placement but explicitly say “History charts coming later”. There are no curves, axes, selected samples, coverage numbers or invented date ranges. Metric sparklines are replaced with short series-color accents. Real history arrives in later PRs.
2. Navigation explicitly identifies History as coming later; Overview and Installation are functional anchors.
3. Values, measurement dates, local formats and server-check times reflect the actual queried response rather than the prototype fixture. Check metadata also includes the full date and UTC offset, allowing checks on another local day to remain unambiguous. Cards expand when necessary for content.
4. Application footer text describes manual refresh; prototype/review labels and demonstration controls are absent.
5. Typography requests the same Manrope family through Google Fonts. Without network access the declared Segoe UI/sans-serif fallback may change wrapping. No font binary or new package is installed.

No approved prototype/source/capture was changed to hide implementation differences. The separate History Mobile sticky-card observation remains open for its later implementation. Physical-device/browser-chrome, native zoom and screen-reader audits remain later release checks; the automated checks below are not a complete accessibility certification.

## Verification and local review

Follow the root [local setup and validation commands](../../README.md). Start PostgreSQL, migrate/seed the Development API and run Vite; open Overview, navigate to Installation and use Refresh after submitting a new simulator reading. Do not point test commands at the development demo database: integration and Playwright require dedicated `_tests` and `_e2e` databases.

Meaningful query unit tests cover single-flight behavior, retained references, successful empty clearing, initial failures, cancelled obsolete success/failure and malformed/HTTP errors. Formatting tests cover age and time-zone offsets; existing freshness/contract tests remain.

The Playwright suite retains the real finite, continuous and 1,441-reading history simulator journeys and their manual discovery in React. New Overview cases verify actual persisted metrics/zero values, navigation, explicit unavailable history, pending duplicate prevention, retained stale `asOf`, clearing to empty, exact five-minute freshness boundary and reduced motion. Layout/keyboard checks include 360/390/430/768/1024/1440px, 360×640 short phones and text-only 200% enlargement at representative breakpoints. Boundary/latency/failure responses are controlled only in targeted state tests; successful full-stack journeys use the real API/PostgreSQL.

The state-layout test also captures loading, empty, error, stale, refreshing and retained presentation at 390/1440px with controlled HTTP responses, verifying that the hero notice replaces introductory copy without overlapping metric cards. Those test captures stay under ignored test results; the versioned normal Overview captures above use actual persisted readings.

Existing CI discovers both E2E spec files and all frontend unit tests automatically. Backend CI continues to run all .NET unit and real PostgreSQL integration tests; Frontend CI runs lint/build/unit tests; Full Stack E2E runs the entire browser suite. No workflow or dependency changes are required.

Local validation on Windows, .NET 10, Node 24 and PostgreSQL 17: restore/Release build succeeded with zero warnings/errors; **110 backend unit, 50 real PostgreSQL integration, 13 frontend unit and 15 Playwright tests passed**, with no skipped tests. Frontend lint/production build passed. The complete browser suite took about 2.7 minutes locally. These are test results for this delivery, not performance benchmarks; CI reports its own timing.
