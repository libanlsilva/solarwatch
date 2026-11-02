# Selected Reading reflow and final Phase 5 checks

Owner-approved [Issue #29](https://github.com/libanlsilva/solarwatch/issues/29), based on main `9007534`. **Implementation awaits personal PR review. Phase 5 and the MVP remain pending.** This is a focused F2 correction and native-verification attempt, not a new product audit. The [original audit](PHASE5.md), its evidence and all frozen designs remain intact; F1 remains resolved through PR #28.

## F2 reproduction and correction

The new [Full Stack regression](../../frontend/tests/e2e/selected-reading-reflow.spec.ts) first failed on the unchanged production application: at 390×667 with 200% HTML text, DOM Range geometry placed `1,200` on **two lines**. Its W was separated from the full value. The [before record](evidence/f2-before.json) and [before capture](screenshots/f2-before-390-text-200.png) preserve that failure.

The correction is a small CSS change in History only. Values use `white-space: nowrap` and normal wrapping rules. On mobile, the three metrics use wrapping flex items sized to their complete contents, moving whole metrics to another row when needed. On desktop, the inspector column retains its 294px / intermediate 270px minimum and can grow to the intrinsic width of enlarged values. Typography, enlargement, normal-size composition, data/query behavior and units are preserved; there is no clipping, ellipsis, hidden overflow or font-size reduction.

The API accepts and PostgreSQL persists three controlled test readings: **0 W / 0 W / 0%**, **12,345.67 W / 98,765.43 W / 100%**, and **1,200 W / 800 W / 65%**. The larger values intentionally stress formatting; they are not a claim about realistic household consumption. History returns those original observations. An unpopulated minute displays unavailable values rather than zero. No API payload is mocked in this regression.

| Executed check | Result / evidence |
| --- | --- |
| Original 390×667 / 200% HTML-text reproduction | Expected failure before the fix: numeric line counts `[2, 1, 1]` |
| Fixed original case | Numeric line counts `[1, 1, 1]`; units fit alongside values |
| Normal and 200% HTML text | 360×640, 390×667, 430×844, 667×375 landscape, 1440×1186 and 320×640 supporting reflow case |
| Zero, large decimals and unavailable minutes | At every size, numeric tokens remain single-line; full value/unit pairs fit within their metric; no page/card horizontal overflow |
| Enlargement retained | Measured value font sizes double exactly; the original normal-size three-metric row remains at 360/390/430px |
| Regression evidence | [After record](evidence/f2-after.json): 31 recorded cases, three metrics per case; generated and attached by Playwright |
| .NET restore / Release build | Pass; zero warnings/errors |
| Backend unit / real PostgreSQL integration | 116 / 56 pass, zero skips |
| Frontend lint / production build / unit | Pass; 46 unit tests, zero skips |
| Full Playwright suite | 34 pass, zero skips; all 251 baseline tests preserved plus one meaningful regression: **252 total** |

The complete suite retains F1's 17-state AX regression, independent queries, Refresh/Retry, selection, keyboard/touch and short-phone coverage. The new case is automatically discovered by the existing E2E workflow. Supporting viewport emulation and HTML font-size enlargement **do not verify native zoom or spoken screen-reader behavior**.

## Actual visual evidence

| View | Capture |
| --- | --- |
| Original 390px / HTML text 200% | [Before](screenshots/f2-before-390-text-200.png) / [after](screenshots/f2-after-390-text-200.png) |
| Normal-size approved composition | [390px](screenshots/f2-normal-390.png) / [1440px](screenshots/f2-normal-1440.png) |
| Large decimal values / HTML text 200% | [390px](screenshots/f2-large-390-text-200.png) |
| Missing minute / HTML text 200% | [390px](screenshots/f2-unavailable-390-text-200.png) |

These are real application captures using the persisted fixture above. The before/after executions have different server reference times; they are a wrapping comparison, not a pixel-identical timestamp comparison. Normal-size mobile metrics retain their shared row; larger text reflows whole metrics. The expanded inspector continues using the existing measured sticky-height fallback. No original prototype or third-party reference image is modified or added.

## Native checks: attempts and unverified coverage

Environment: Windows NT 10.0.26300.0, .NET SDK 10.0.300, Node 24.15.0, npm 12.2.0. Passive file/process inspection found installed Google Chrome **156.0.8078.74** and the Narrator executable version **10.0.26100.8972**. The automated browser is separate Chrome for Testing **156.0.8078.4**. Executable presence is not a successful screen-reader trial.

Following the Computer Use skill, `@oai/sky` was imported in `node_repl`, then `sky.list_apps()` attempted four times: initial call, retry after two seconds, retry after a JS-kernel reset/reimport, and an availability recheck after work resumed. All failed before any target window or native input was available:

> Computer Use native pipe is unavailable: failed to connect native pipe: The system cannot find the file specified. (os error 2)

The [timestamped attempts](evidence/f2-native-attempts.json) record the exact method/error. No custom helper, PowerShell UI automation or substitute zoom was used. Chrome's zoom controls and Narrator could not be reached; no reader was launched or speech output obtained.

| Requested native check | Actual result |
| --- | --- |
| Chrome/Edge UI zoom at 100%, 200%, 400% | **Not executed**: native control channel unavailable; applied zoom and effective native CSS viewport were not measured at any level |
| Native reflow at an effective 320 CSS px | **Unverified**; the passing 320px emulated test is supporting evidence only |
| Real Narrator/NVDA navigation and Selected Reading | **Not executed**: no targetable Windows app, reader interaction or spoken output |
| Reader announcements for missing minutes, Refresh, error/recovery | **Unverified**; existing browser/AX tests do not establish actual announcement timing/order or speech clarity |

Residual risks are native-zoom clipping/overlap or obscured controls, and reader-specific control interpretation, missing/duplicated status announcements or confusing reading/focus order. They remain verification gaps, not observed new defects or silently accepted risks.

## Brief owner-executable native checklist

1. Follow README setup with a disposable development database and persisted zero, ordinary, larger and sparse readings. Record OS/display scale, browser and reader versions, and which data set is used. Keep the local API and React available.
2. In real Chrome/Edge, set zoom with the browser menu to **100%, 200%, then 400%**. Record the visible percentage, screenshot and actual CSS viewport at each step. For example, read `({width: innerWidth, height: innerHeight, dpr: devicePixelRatio, visualScale: visualViewport?.scale})` in undocked DevTools; these measurements alone do not prove native zoom. Start around 1280 CSS px at 100% and measure whether 400% produces 320 CSS px; adjust the window if needed. Do not substitute CSS zoom, device emulation or pinch zoom. Restore 100% afterward.
3. At each level, navigate Overview → History → Installation and use Refresh. In History read each value/unit, step into a missing minute, reach both charts and the minute controls by keyboard/scrolling, and check focus is visible/unobscured. Record actual defects; do not treat a visible chart as proof that every control works.
4. Start installed Narrator/NVDA and record actual spoken/read results: page/section links, headings, units/date, exact selected values, plot labels, minute controls and unavailable-minute text. Use Home/Left/Right on a focused History plot, then −1/+1 or the mobile slider. Confirm zero and unavailable are distinct.
5. With the reader active, check idle, pending, completed Refresh and retained/error/recovery messages. A controlled interruption of the **test** API can create an error; identify that outage and restore it before Retry. Use temporary request throttling if needed to observe pending states, restoring settings afterward. Mark any mixed/both-pending path not actually observed as unverified; do not infer it from AX evidence.
6. Record pass/fail/not-run for each step, with reproduction and severity for failures. Stop the reader and restore zoom/settings to their prior values. The owner must expressly decide whether to accept any remaining gap before phase closure.

The focused enlargement targets follow [W3C Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) and [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html); this record is not a WCAG conformance claim.

## Recommendation

F2 is corrected for the documented cases, with a regression that fails on the baseline and passes after the small layout change. Existing automated checks have not identified an additional functional blocker. **Review and accept the correction separately from Phase 5 closure.** Keep the phase open until native verification is supplied or the owner explicitly accepts the listed residual risks; any confirmed inability to read a required value or operate a required control blocks closure. No broad repeat audit is recommended. Phase 6/MVP release and realistic simulator patterns remain separate work.
