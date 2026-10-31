# History synchronized inspection — delivery B

Issue [#22](https://github.com/libanlsilva/solarwatch/issues/22) and its precise temporal/reconciliation rules were expressly approved by the owner. The owner personally approved delivery B and authorized its squash integration in [PR #23](https://github.com/libanlsilva/solarwatch/pull/23) (`6395727eb16b0b9eff2dc13fc70878906bffef5f`); this delivery is complete. Phase 5 and the MVP remain pending. The [delivery A record](history-view.md) describes the preceding read-only increment. The frozen History Desktop v1, History Mobile v1 and [design system](../design/DESIGN.md) remain unchanged.

## Ownership and temporal rules

`HistoryView` owns one `useHistorySelection` state, shared by both existing `HistoryPlot` instances and `SelectedReading`. Pure functions in `historySelection.ts` resolve it against the current successful History response. Presentation does not fetch; moving controls, scrolling and resizing make no API requests. The existing application query owner, validation, chart preparation, independent Latest/History states and manual Refresh behavior remain in place. Overview retains its original independent recorded-reading tooltips/keyboard behavior.

| Mode | Identity and resolution |
| --- | --- |
| Exact observation | Original UTC `measuredAt`; match by epoch microsecond, never JavaScript millisecond or array index. Display the actual row's original timestamp, including its fractional precision. Explicit activation can keep an earlier row in a multi-row minute. |
| UTC minute | Mathematical `floor(epochMicroseconds / 60,000,000)`. Eligible rows must satisfy both the half-open minute `[start, nextStart)` and the original inclusive server window `[from, to]`. Resolve the greatest `measuredAt` and qualify the count when several rows exist. |

The eligible minute keys run from `floor(from / D)` to `floor(to / D)`, inclusive, without changing those exact bounds. First/last minutes can be partial; an exact-minute `to` produces a singleton endpoint bucket. The slider represents these 1,441 intersecting UTC buckets, not an assumed 1,441 samples. It never truncates the observations or skips missing minutes.

A missing minute shows **No measurement in this minute**, unavailable W/W/% and inspection context only. A disappeared exact row is likewise explicitly unavailable; its inspected timestamp is not presented as a recorded measurement. No old value, zero, interpolation or nearest row substitutes for missing data. Real zero remains zero. When a minute resolves to a row, both cursors/markers use that row's actual instant and values. Otherwise both cursors are neutral, anchored at `max(minuteStart, from)` (or the missing exact instant), without value markers.

Original UTC strings remain in the response and row identities. Existing exact relative microsecond arithmetic supplies Recharts' millisecond coordinates. All stepping uses UTC; local measurement/minute labels include the IANA zone and the offset applicable at that instant, distinguishing repeated DST minutes and crossing skipped local hours correctly. No browser clock supplies a historical window or freshness reference. Existing strict `>300 seconds` curve/fill breaks remain unchanged; a connected segment is not proof of a measurement in its intervening minutes.

## Pointer, keyboard and touch

Recharts' nearest active tooltip is deliberately not used as History selection. `HistorySelectionLayer` uses the existing plot's actual scales and SVG coordinate transform to compare a click/tap with real records, including the Y coordinate. One plot-space pointer target receives events; underlying data marks and gap shading cannot intercept it. Shared value markers use those same scales, including Y padding. The keyboard wrapper and textual panel expose the interaction independently of the decorative SVG.

- A unique identifiable visible point selects its original exact observation. The existing chart renders all points for sparse responses (at most 48 rows), otherwise isolated samples and the last endpoint. Clicking an unmarked curve/background inspects a minute; keyboard inspection can still reach every original row.
- Hit radii are 6 CSS pixels for mouse/pen and 22 for touch. Two different records inside the target, or visually indistinguishable within one pixel of a hit, never claim an arbitrary exact choice. Duplicate series marks of the same record count as one identity.
- Ambiguous candidates wholly in the same UTC minute select that minute and its qualified latest/count policy. This avoids pixel rounding accidentally moving overlapping microsecond observations at a minute boundary into the preceding minute. If candidates span minutes, use the pointer's elapsed-time X coordinate, clipped to the server bounds. An explicit notice explains overlap and offers chart arrow keys for individual records. No nearest-record tie-break is hidden from the user.
- Focus either plot: Left/Right inspect previous/next actual records; Home/End select first/last. Escape and blur do not reset the shared selection. This is exact-record inspection, distinct from minute stepping.
- Native **−1/+1 minute** buttons switch to minute mode, advance exactly one UTC key and disable at the bounds. The approved mobile native range slider supports touch, arrow keys and Home/End. Its accessible value includes the local minute, zone, offset and count. It never requires hover.

## Accepted-response reconciliation

Initial nonempty History selects the final actual row in that response. A guarded adjustment of the owning component's state reconciles on **accepted snapshot identity**, using the current user selection at that time. It runs before children commit. No selection is captured at request start; pending queries leave controls usable against retained data. Plot keys remain stable across populated successful updates so keyboard focus is not discarded.

| Outcome | Behavior |
| --- | --- |
| Failure or pending Refresh | Preserve current selection and the exact previous data/from/to/asOf. Existing retained-data alert/History Retry remains available. |
| Exact instant still present | Keep exact mode; use the newly accepted actual row, including its original response spelling. |
| Exact instant absent but still inside bounds | Keep inspected instant, explicitly unavailable. Never borrow a later row in its minute. |
| Minute still intersects new bounds | Keep key; recompute clipped membership/latest/count. An empty bucket remains selected but unavailable. |
| Exact instant or minute leaves the window | Reset to the latest actual row and visibly/politely announce the reason. |
| Successful empty response | Clear selection/old values, remove markers, disable inspection controls; preserve the new valid empty window and working Refresh. |
| Obsolete/cancelled completion | Existing single-flight query ownership ignores it; no snapshot or selection reconciliation occurs. |

Selection survives scroll, resize and focus changes. As in delivery A, the query snapshot survives section navigation; the view's inspection state is intentionally local to its mounted History instance. Leaving/remounting History or a full reload defaults to the latest row of the available response. No localStorage, global selection store, polling or selection endpoint is added.

## Responsive, accessibility and visual evidence

The approved photograph, palette, typography, desktop graph/context columns and mobile card order are retained. The preceding read-only card becomes Selected reading in its approved position. Desktop adds minute stepping; mobile adds the approved native temporal slider. Selected markers and a dashed shared cursor add non-color-only context without changing real curves or coverage. All controls have accessible names, disabled boundaries, visible focus and at least 44px targets. A polite atomic message reports selections/reset reasons; errors retain the existing alert treatment. Reduced-motion styles remain active; plot values do not animate.

At mobile heights of 740px or less, only the header stays sticky. On taller devices, the measured context becomes nonsticky whenever fewer than 320px would remain below it and the header, including enlarged-text or overlap-notice cases. The actual context height also informs chart scroll margins. Browser checks cover 360/390/430/768/1024/1440px, 360×640 and 390×667, native touch, visible focus, plot reachability, no horizontal overflow and 200% HTML text enlargement. The latter is a text-only test, not a claim of native zoom, SVG text scaling or full assistive-technology certification.

Actual API/PostgreSQL captures, separate from all earlier approved/reference exports:

Measured selected-state footprint (reduced motion): both short phones have a 131px sticky header and a 249.36px **scrolling** context. The 360×640 viewport leaves 509px below the header; 390×667 leaves 536px. The 210px power plot is fully reachable below the header in both. The visual test exports these measurements as an attachment; the context is not counted as a permanently occupied region.

| State | Desktop | Mobile |
| --- | --- | --- |
| Persisted observation selected | [Full page](../screenshots/history-interactive-selected-desktop.png) | [Initial viewport](../screenshots/history-interactive-selected-mobile.png), [full page](../screenshots/history-interactive-selected-mobile-full.png) |
| Inspected minute without data | [Full page](../screenshots/history-interactive-missing-desktop.png) | [Initial viewport](../screenshots/history-interactive-missing-mobile.png), [full page](../screenshots/history-interactive-missing-mobile-full.png) |

The comparison with History Desktop v1/Mobile v1 retains the photo treatment, header, dedicated power/battery surfaces, right desktop inspection/coverage column and compact mobile inspection above plots. Intentional data differences: these captures use five observations persisted through the real POST API, including zero and two same-millisecond records. Sparse points and truthful large shaded gaps replace the prototype's illustrative curves; the missing-minute capture has neutral cursors and no fabricated value markers. The existing full-day simulator browser journey still checks every returned observation/path and exports its separate delivery A captures. Dense random curves remain a documented simulator limitation, not something to smooth in this increment. Real axes keep the existing three local date/time marks. No approved source export is rewritten and no new third-party asset is introduced; the photo's existing publication permission applies.

## Verification and local reproduction

Use the README setup to start PostgreSQL, migrate, prepare a current 24-hour range with the unchanged simulator, then run the API and React. Open `http://localhost:5173/#history`, inspect a visible point or use keyboard controls, step minutes and press Refresh. A sparse/partial database demonstrates unavailable minutes. Test setup clears only explicitly dedicated `_tests` / `_e2e` databases; do not clear valuable development data for review.

Run the existing commands (connection strings belong in environment variables, not tracked files):

```sh
dotnet restore backend/src/SolarWatch.slnx
dotnet build backend/src/SolarWatch.slnx --configuration Release --no-restore
dotnet test backend/src/SolarWatch.slnx --configuration Release --no-build --no-restore
cd frontend
npm run lint
npm run build
npm run test:unit
npm run test:e2e
cd ..
node docs/design/checks/verify-prototypes.cjs
```

Actual local validation: **116 .NET unit + 56 real PostgreSQL integration + 46 frontend unit + 32 Playwright = 250 passing tests, no skips**, retaining all 231 baseline cases. Restore/Release build pass with zero warnings/errors; frontend lint/build pass. New pure tests cover microseconds, half-open/inclusive boundaries, singleton/partial minutes, multiple rows, zeros, unavailable minutes, UTC/DST, reconciliation and pointer ambiguity. Six additional Full Stack cases verify real persisted values and cursor geometry across both plots, exact keyboard microseconds, mouse/touch ambiguity, missing minutes, no extra requests, pending user changes on successful/failed Refresh, changed bucket counts, disappeared exact rows, empty clearing, responsive/accessibility behavior and visual exports. Existing query tests verify ignored abort/obsolete results, and existing navigation/Overview/simulator cases remain active with the History context assertions evolved to the approved B semantics.

The complete Playwright run passed in 3.5 minutes locally; the unchanged 1,441-request CLI journey measured 5.893s fresh / 11.028s conflict-only repeat. These are individual local timings, not benchmarks. The three existing workflows automatically discover the new unit/spec files; no CI exclusions, new workflow, backend change or dependency is required. The frozen-design verifier passes: 60 unchanged exports, eight layouts, 24 states and 12 gallery pairs, with no script/data-request/resource errors. The chart module remains lazy-loaded; measured production output is 259.31kB main JS (79.54kB gzip), 376.91kB chart JS (108.70kB gzip) and 28.37kB CSS (6.77kB gzip), before transport headers. No library version or lockfile changes.

Remaining work: combined final Phase 5 acceptance/accessibility validation, proposed in [Issue #24](https://github.com/libanlsilva/solarwatch/issues/24) for review without implementation, and the separately planned local MVP release. Manual screen-reader/native zoom checks and separately approved tablet designs are not claimed by these automated checks. More realistic energy patterns remain a separate unimplemented roadmap item.
