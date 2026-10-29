# Interface States v1 — awaiting personal approval

All four base prototypes are definitively approved and frozen: Overview Desktop v2, Overview Mobile v1, History Desktop v1 and History Mobile v1. Their current approval record lives outside those folders; historical pending-approval labels inside them remain untouched. The owner requested no additional versions of those screens.

This delivery is a **state-design proposal only**. Issue #12 and Phase 4 remain open. The final reusable design-system document and Phase 4 PR must wait for personal approval of these state proposals.

## Review entry point

Open `index.html` directly. Seven state buttons switch paired desktop/mobile captures. Overview/History switches let the owner inspect resource-specific examples; stale applies only to the latest Overview measurement, while the partial-history example uses the approved History surfaces. Each capture links to its native-size PNG and an interactive specimen HTML.

There are four reusable specimen files, not separately maintained copies for each state:

- `overview-desktop.html` and `overview-mobile.html` derive from approved Overview.
- `history-desktop.html` and `history-mobile.html` derive from approved History.
- A shared `state-layer.js` / `state-layer.css` changes only data-dependent content and state feedback. The builder `../build-interface-states-v1.cjs` reads frozen source files without writing them.
- Twenty-four generated full-resolution captures cover the valid combinations: six Overview states × two platforms, and six History states × two platforms. The gallery defaults to one pair per state and exposes the additional query-state examples on demand, avoiding a long set of duplicate standalone screens.
- `gallery-preview.png` previews the review gallery. `visual-checks.json` records validation and frozen-source hashes are in `approved-reference-hashes.json`.

## State proposals

| State | Visible treatment | Values and reference | Manual action |
| --- | --- | --- | --- |
| Loading | Neutral static skeletons for latest reading and history; text announcement and busy control | No received measurement/time/freshness; no successful server reference | Disabled while the initial query is pending |
| Empty | Explicit successful-empty message, unavailable values, neutral gauge and no curves | No invented zeros or measurement timestamp; a successful empty response can still supply `asOf` | Refresh after readings are added |
| Error | Clear failed-query message and visible Retry; availability is unknown | No data/`asOf` is fabricated; this is not a successful empty response | Retry, once per deliberate action |
| Stale reading | Attention text in existing hero/reading status, age at server check | Keep 1,200 W / 800 W / 65% and measured time; age 7m30s at the stated server reference | Refresh to check again |
| Refreshing | Progress text/spinner and disabled refresh/retry action | Retain last successful values, plots and reference while waiting | No concurrent refresh/retry start |
| Retained data | Update-failed notice, previous snapshot remains usable, Retry visible | Keep values, selected time and last successful reference; current freshness is unverified | Manual Retry |
| Partial history | Approved hatched bands, broken traces, coverage explanation and exact-minute inspection | Null minutes stay unavailable; real recorded zero stays zero; no bridge or backfill | Existing manual Refresh and inspection controls |

The palette, typography, imagery, layout order and metric/plot composition come from the approved sources. Overview notices replace the existing hero supporting-copy slot. History notices use the existing window/reference, selected-reading and coverage areas. No dashboard redesign, new metric card or new color system is introduced. The conceptual installation diagram stays data-independent and does not assert measured flows.

Numeric axis ticks are scale references, not measured values. During loading they are hidden while preserving plot geometry so the skeleton rows cannot be mistaken for readings. Empty/error states have no data curves or point markers. Unknown coverage after an error is explicitly different from known no-readings coverage after a successful query.

## Server freshness and failed updates

The normal fixed example is `measuredAt=2026-10-28T18:32:00Z`, last successful `asOf=2026-10-28T18:32:15Z`: 15 seconds old **at that check**. The stale example uses `asOf=2026-10-28T18:39:30Z`: 7 minutes 30 seconds old. Exactly 300 seconds is not stale; greater than 300 seconds is stale. UI times use America/Havana, UTC−04:00 on that date.

The pending query does not advance or replace the previous server reference. A failed update preserves it, including when the previous snapshot was already stale. The retained notice explicitly says current freshness is unverified, and the age text refers to the last successful check. No browser clock, timer, polling or automatic retry is used.

Selected historical points are not marked stale because they are old. Their statuses indicate availability at the selected time. A failed refresh retains the selected missing minute as well as existing paths and values; it does not select a nearby available record.

## Retry/refresh demonstration

In the specimen HTML, Retry or Refresh stages a pending visual state. The action is disabled and the preview refuses additional starts. The pending state deliberately stays pending until the reviewer uses **Complete successfully** or **Fail preview** in the separate design-review controls below the application surface. These controls are not proposed product actions or an API implementation.

Completing successfully returns to a fixed approved data fixture. Failing an initial query returns to Error. Failing with a prior snapshot returns to Retained data and preserves the last `asOf` and historical selection. No request is ever sent. The duplicate-start guard demonstrates the intended UI behavior only; it does not claim that application request/concurrency code has been implemented.

The gallery's standalone state fixtures simplify review, not future architecture. Real loading/error/empty/refresh/retained statuses must be scoped to the latest-reading and historical queries independently. A successful region must remain usable if the other query fails. Freshness and partial history can coexist with those query states. The fixtures do not impose a single global application enum or a new API contract.

## Accessibility and validation

- Clear text, units and existing series labels accompany color. Attention uses the approved yellow; freshness/unknown/empty/error are never communicated by color alone.
- Loading/refreshing use status messages outside busy data regions; data regions expose `aria-busy`, actions are natively disabled, and failed requests use an alert. Skeletons are hidden from assistive technology. Visible focus and reduced-motion behavior are preserved; reduced motion disables the spinner rotation.
- The mobile state examples retain 44px refresh/navigation controls and were checked at 360, 390 and 430px. No horizontal overflow, card-content overflow or hero-notice/metric collision was found.
- Local checks verify unavailable initial values, strict five-minute threshold, pending duplicate rejection, manual retry, failure-to-retained transition, preserved stale reference, selected-gap continuity, no data requests, no script errors and all frozen file hashes.
- These are isolated **design-artifact checks**, not application tests, passing CI evidence, a final design approval or complete WCAG/device certification.

The requested short-height observation is recorded in `SHORT_PHONE_AUDIT.md`. At 360 × 640 the approved History header/sticky reading surface occupies about 335px, leaving 305px for content. This constraint needs future implementation/device validation; no redesign is made here.

## Scope, provenance and next step

No React components, endpoints, UI/chart packages, simulator, database, workflows or approved prototype files change. No final `DESIGN.md` or Phase 4 PR is prepared before this delivery is personally approved.

The specimens reference the existing user-supplied solar photograph in the frozen local folders. Redistribution rights are not inferred and no third-party Ekova image/logo is embedded or published. All review files remain under ignored `artifacts/`; no public upload, commit, PR or deployment occurs at this checkpoint. The earlier private Stitch source is not a mirror of these local state specimens.

After personal approval, prepare the final small reusable design-system document and the focused Phase 4 design PR. Until then keep Issue #12 and Phase 4 open.
