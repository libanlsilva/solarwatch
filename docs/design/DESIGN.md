# SolarWatch design system

Design handoff for [Issue #12](https://github.com/libanlsilva/solarwatch/issues/12). The owner approved **Overview Desktop v2, Overview Mobile v1, History Desktop v1, History Mobile v1 and Interface States v1**. This document extracts their existing visual language; it does not introduce another visual version. The design PR and Phase 4 remain open for final review. The functional application still displays the earlier latest-reading view; these dashboard designs are not implemented.

## Visual foundation

Use a premium dark residential-energy dashboard: a compact pill navigation, green-tinted solar photograph, asymmetric overlapping power cards, translucent dark surfaces and restrained electric accents. Keep the approved composition rather than converting it into a uniform card grid. The installation drawing is conceptual: panels, inverter, home and battery have neutral undirected connections, without measured flows.

The [prototype index](README.md) identifies the exact approved sources and captures. Their CSS is the authority for local variations; the names below are handoff names, not a new runtime token package.

| Color | Exact value | Role |
| --- | --- | --- |
| Canvas | `#030B08` | Outer page |
| Shell | `#06110F` | Main dashboard and photo fade |
| Primary text | `#F4F7F3` | Headings and values |
| Secondary text | `#A9BBB0` | Units, axes, dates and supporting copy |
| Solar / primary action / attention | `#F1FF16` | Solar series, Refresh, focus and explicit attention text |
| Battery / successful check | `#B7F36B` | State of charge and freshness at a successful check |
| Home consumption | `#36CBB0` | Consumption series |
| Action text | `#111B09` | Text on yellow buttons |
| Active navigation | `#22302A` | Selected navigation pill |
| Structural line | `#29433A` | Subtle separators; not a sufficient control boundary alone |
| Card edge | `#52615366` | 1px translucent card outline |
| Installation node | `#0C1A13` / `#385042` | Node background / 1px outline |
| Neutral connector | `#728679` | Installation relationships, no flow direction |

Hex values with eight digits use the last two digits as alpha. Overview desktop cards use `rgba(5,16,13,.9)`; History desktop uses `#05100DE8`; mobile uses `#05100DEB`. The mobile sticky header uses `#06110FF2`; History's sticky reading card uses `#09170FF5`. Secondary action fill/edge are `#142319` / `#425744`. Attention is yellow plus text, not an additional red semantic palette.

## Type, spacing and surfaces

Use **Manrope**, weights 400/500/600/700/800, with `"Segoe UI", sans-serif` fallback. Body: **14px / 1.5**, regular. Use tabular numerals for measurements, selected values and timestamps. Do not reduce chart/supporting type below the approved **12px** floor.

| Role | Desktop | Mobile |
| --- | --- | --- |
| Brand | 23px / 800, tracking −1px | 21px / 800, −0.8px |
| Overview heading | 54px / 1.1 / 500, −2.3px | 36px / 1.1 / 500, −1.4px |
| History heading | 44px / 1.1 / 500, −1.8px | 32px / 1.1 / 500, −1.1px |
| Power value | 49px / 1.2 / 500, −2.1px | 34px / 1.2 / 500, −1.5px; 32px below 375px |
| Battery gauge value | 40px / 1.2 / 500 | 32px / 1.2 / 500 |
| History selected value | 32px / 1.25 / 500 | 24px / 1.25 / 500 |
| Card heading | 16px / 600, −0.3px | 16px / 1.4 / 600; compact power labels 12px |
| Navigation / primary button | 13px / 600 or 800 | 13px / 600 or 800 |
| Axes, legend, status, support | 12px, generally 1.5–1.7 | 12px, generally 1.45–1.7 |

Use the existing small spacing set **4, 8, 12, 16, 20, 24, 28, 32px**, preserving measured exceptions such as 10/14/18/22px and asymmetric offsets. Desktop body padding is 32px; shell padding 24px 28px; main gaps 24px (Overview) / 20px (History). Mobile gutters are 16px, reduced to 12px below 375px; inner card padding is generally 13–18px. Do not force every measurement onto a new grid.

| Surface | Geometry and depth |
| --- | --- |
| Desktop shell | Max-width 1440px; radius 32px; `1px solid #42584A66`; shadow `0 28px 90px #0008` |
| Cards | Radius 24px desktop / 22px mobile; 1px edge; shadow `0 8px 20px #0002`; backdrop blur 14–16px |
| History window | Radius 18px desktop / 22px mobile; desktop fill `#081710BF`, blur 12px |
| Pills | Radius 99px; navigation, actions, units and compact badges |
| Installation nodes | Radius 14px desktop / 13px mobile |
| State notice | Radius 12px; fill `#06110FEE`; `1px solid #42584588`; padding 8px 10px (mobile 7px 9px) |
| History mobile sticky card | Shadow `0 9px 24px #0005`; see short-height constraint below |

Desktop outer glows are `radial-gradient(ellipse at 85% 5%, #29432C 0, transparent 42%)` and `radial-gradient(ellipse at 0% 70%, #123A2E 0, transparent 45%)`. The photo remains a background, never a substitute for measurements. Overview Desktop v2 uses the approved veil:

```css
linear-gradient(180deg, #06110f 2%, #06110f80 12%, #06110f04 38%,
  #06110f06 61%, #06110fd9 82%, #06110f 94%),
linear-gradient(90deg, #010a074a, transparent 55%, #03100c24)
```

Desktop Overview photo: top 86px, height 760px, `object-fit: cover`, `center top`. Mobile Overview photo: top 105px, height 510px, `43% center`; its veil is `linear-gradient(180deg,#06110f77,#06110f2a 18%,transparent 45%,#06110f33 72%,#06110f 100%),linear-gradient(90deg,#010a0780,transparent 85%)`. History subordinates the same photo to the plots: desktop height 350px, opacity .68, `center 52%`; mobile height 340px, `43% center`. Preserve their respective veils from the source CSS, rather than applying the Overview crop globally.

## Reusable component inventory for later React

These are responsibilities, not implemented components or a mandated file hierarchy.

| Component | Reuse and contract |
| --- | --- |
| DashboardShell / SectionNavigation | Shared photo layers, brand, simulated label, Overview/History/Installation navigation; active section exposed with `aria-current` |
| RefreshAction | Manual Refresh or resource-specific Retry; busy text, native disabled state, duplicate-request guard per resource |
| Card / MetricCard | Common surface; solar and consumption values with explicit W and unavailable rendering; preserve asymmetric placement |
| BatteryGauge | Recorded charge in %, numeric equivalent, neutral unavailable state; no remaining energy or charge-time estimate |
| MeasurementMetadata / StatusBadge | Actual measurement, local zone, successful `asOf`, age at that check and freshness; retained-data qualification |
| InstallationDiagram | Conceptual, accessible labels for panels/inverter/home/battery; neutral connections |
| HistoryWindow | Fixed 24-hour range, dates, local zone/offset and server reference; no new date filters |
| HistoryChartFrame / SeriesLegend | Aligned time domain, W power panel and independent 0–100% battery panel, labels and visible missing-data treatment |
| SelectedReading / MinuteSelector | Shared exact-minute selection; timestamp, W/W/% values or unavailable status; keyboard and touch controls |
| CoverageNotice | Distinguish known missing intervals, wholly empty window and unknown availability after initial failure |
| QueryNotice / Skeleton | Resource-scoped loading, error, refreshing and retained feedback; status/alert and reduced motion |

Buttons use yellow fill and dark text, 99px corners, 13px/800 labels, refresh icon 16px, and mobile padding 10px 15px. Secondary minute controls use dark fill and visible circular borders. Hover follows the existing active-pill treatment where present; focus is a 2px yellow outline with 3px mobile / 4–5px desktop offset. Press activation uses native button semantics; no extra animated press treatment is specified. Pending actions show text/progress and are disabled; the state-layer pending button uses `#DAE642`, opacity .85. Other disabled prototype controls use opacity .4; future disabled semantics must remain distinguishable from loading. Do not add a new interaction style in handoff.

## Responsive behavior

Desktop Overview keeps two balanced columns (`1.09fr / 1fr`), a prominent roof photograph, offset power cards and the right-side battery/latest pair above charts. History uses a wide plotting area and **294px** right inspector. Mobile is a distinct approved composition: compact two-row sticky header, asymmetric power pair, combined battery/measurement card, readable stacked plots and a compact installation drawing. Mobile History places the selected reading and touch minute selector above the plots; the two chart scales remain separate.

Existing artifact breakpoints are **374px** for narrow mobile adjustments and **600px** for centering the standalone mobile specimen on a review canvas. The latter is **not** a product mobile/desktop switch. Desktop Overview has fallback rules at 1100/850px and expands spacing at 1550px; History adjusts at 1250px and has a narrow fallback at 900px. These fallback pages predate the approved dedicated mobile designs and do not replace them. A unified application breakpoint/tablet composition remains an implementation validation decision: choose based on content fit, retain the approved endpoint layouts, and review the intermediate widths rather than claiming an unreviewed tablet mockup exists.

Check **360, 390 and 430px** mobile widths, fluid containers, wrapping legends/dates and no horizontal overflow. Controls must retain at least 44×44px touch areas. Desktop prototype minute buttons are visually 40px; enlarge their hit area in the implementation without changing the approved visible circle. Safe-area padding and `100dvh` are already represented in mobile sources.

**Open short-height observation:** History Mobile's 131px header + 191.6px sticky reading card + 12px gap reaches 334.6px. On 360×640 that leaves 305.4px (52.3% occupied); on 390×667 it leaves 332.4px. Validate real browser chrome, safe areas, zoom and text scaling before implementation acceptance. Do not silently shrink text/targets or redesign the sticky behavior. A targeted adaptation requires review. See [the measured audit](prototypes/interface-states-v1/SHORT_PHONE_AUDIT.md).

## Data and chart display rules

- Solar generation and household consumption are instantaneous **W**. Battery state of charge is **%**, never W or stored Wh/kWh. No totals, revenue, forecasts, weather or measured flows.
- Keep the simulated-data indication visible. Fixture curves illustrate layout, not physical accuracy or measurements read from the backend.
- A missing reading is **unavailable**, shown as an em dash and explanatory text, never zero. A recorded zero remains `0 W` or `0%`. Do not interpolate, backfill, silently choose a nearby record or connect across missing minutes. Mark gaps with neutral hatching and broken traces; any interval over five minutes must be especially clear.
- Solar is solid yellow; consumption is dashed teal; battery is lime in a separate panel. Use a common time domain and selected timestamp across panels, not independent cursors. Power and charge scales remain independent. The fixture W scale is illustrative; real W-domain selection must preserve all data and avoid clipping. Keep charge at 0–100%.
- Desktop offers pointer selection plus keyboard minute stepping; mobile offers tap selection, a native minute slider and −1/+1 minute actions, without hover dependence. Keep selection when scrolling and when a refresh fails. Inspecting a missing minute returns its time and unavailable values.
- Show the inclusive 24-hour range `[T − 24 hours, T]`, with `T` captured once by the server for that request, local dates (including the day change), identified IANA zone/UTC offset and `asOf` of that query. Store/compare instants in UTC; local formatting does not change them. Repeated local times across DST must remain distinguishable by offset/instant. The frozen fixture's minute-aligned endpoint (14:32:00) and later check label (14:32:15) illustrate the two timestamps; do not infer API rounding or history boundaries from that static axis. The approved MVP server-window rule remains authoritative.
- Freshness applies to the **latest** reading at the successful server check: `asOf − measuredAt > 300 seconds`. Exactly five minutes is not stale. Never use the browser clock to advance freshness. Historical points are not stale merely because they are old.
- A failed refresh preserves the last successful reference and explicitly says current freshness could not be checked. A pending request does not create a new `asOf`. Initial error/loading has no invented successful timestamp; successful empty responses may have one.

## Query states remain independent

Latest-reading and history queries each own their successful snapshot (including that response's `asOf`), pending flag, error and request identity. Do not make a single application-wide loading/error enum or require both requests to succeed with an all-or-nothing update. A shared manual Refresh may start both eligible queries; each applies its own response and disables duplicate requests only for itself. A Retry targets its failed resource and is labeled accordingly. No polling, clock-driven refetch or automatic retry is introduced.

| Per-resource result | Presentation |
| --- | --- |
| Initial pending, no snapshot | Skeleton + status; no received measurements |
| Successful empty | Empty message; clear that resource's previous snapshot values if the new result is truly empty |
| Initial failure | Error + Retry; availability unknown, not empty |
| Pending with snapshot | Refreshing + old snapshot and its original reference |
| Failure with snapshot | Retained data + Retry; selected time and values remain usable |
| Success with readings | Replace only that resource's snapshot/reference; clear its error |

Stale is a property of a successful latest snapshot; partial coverage is a property of successful history. They can coexist with refreshing or retained feedback. For example, latest may fail with retained values while history succeeds with gaps, or latest may be fresh while history initially fails. Preserve the healthy region and use scoped notices/busy regions. Ignore obsolete responses from superseded/unmounted requests; cancellation never manufactures success. History and latest may legitimately have different reference instants, so display each query's own reference. The state specimens stage these rules without networking; they are not production request code.

## Accessibility decisions and limits

Use semantic headings, navigation links and buttons; expose current navigation, descriptive retry labels, W/% units and textual availability. Do not depend on color alone: dashed consumption, series labels, hatching and status words carry meaning. Make the selected reading a readable text equivalent to plot interaction, with keyboard focus and minute stepping/slider accessible names. Maintain a logical header → time context → selection → charts → coverage order; do not trap focus in sticky areas.

Focus uses the outline above; ensure it is not clipped by cards or sticky layers. Native disabled buttons prevent activation while busy. Scope `aria-busy` to the updating region; announce progress with a polite status outside it and failure with an alert. Hide decorative skeletons/icons from assistive technology and avoid duplicate announcements per chart. Retained data stays available to read. Respect `prefers-reduced-motion: reduce`: stop the spinner and smooth scrolling; static skeletons do not shimmer.

Solid-color contrast checks (WCAG relative-luminance calculation, rounded): primary text on shell, secondary text on shell, action text on yellow and each chart accent on shell are recorded in [validation](VALIDATION.md). Target 4.5:1 for normal text and 3:1 for meaningful non-text controls/graphics. Subtle decorative edges are not used as the sole control indicator. Translucent surfaces over the actual photograph need composited, region-specific checks in implementation; these solid pairs and browser checks are **not** a complete WCAG or assistive-technology certification. Test keyboard, screen reader, 200% text and short-height devices before releasing the dashboard.

## Implementation options, not dependency approval

| Option | Recommendation and tradeoff |
| --- | --- |
| Tailwind CSS | Appropriate if it improves consistency when React styling begins. Map these exact semantic colors/spacing to CSS theme variables; retain custom photo layers, geometry and CSS where clearer. Plain CSS is also sufficient. Current [theme-variable documentation](https://tailwindcss.com/docs/theme) supports custom tokens; this does not justify installing it during design. |
| shadcn/ui | Optional, selective use for useful accessible primitives such as Button, Slider or Tooltip. Its [open-code model](https://ui.shadcn.com/docs) allows styling ownership. Native navigation/buttons/range already cover much of this MVP; avoid importing a dashboard kit or forcing the approved shell into default components. Accessibility still needs verification after customization. |
| Recharts | Preferred candidate for the later React chart delivery: SVG plots, [synchronized charts](https://recharts.github.io/en-US/api/LineChart/) and explicit [null-gap behavior](https://recharts.github.io/en-US/api/Line/) fit these views. Use `connectNulls={false}`, a timestamp-based common selection and separate W/% domains. Missing minutes must be represented explicitly, not simply omitted. Prove minute selection, gap bands, keyboard/touch behavior and reduced motion before committing to it; default tooltips alone do not satisfy this design. |

These are recommendations checked against official documentation, not installed or pinned packages. No dependency, runtime component, endpoint, simulator or workflow changes are included. Phase 5 needs its own reviewed issue after this design PR is approved and integrated; Phase 4 and the MVP are not marked complete here.
