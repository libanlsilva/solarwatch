# Demonstration verification — Issue #41

**Prepared, pending personal PR review. Phase 6/MVP remain incomplete.** Application source: approved main `b4a9c926648848361738f3ddeaddc104ed4aa2e5` (PR #40). Two actual independent GitHub clones were used; only documentation, verification helpers and raw captures are delivered here. [Reproduction guide](README.md) · [Gallery](GALLERY.md) · [Machine-readable evidence](manifest.json).

## Recorded results

| Requirement | Evidence actually executed | Result / qualification |
| --- | --- | --- |
| Clean source/configuration | Both initial/final Git statuses clean; no initial `.env`, bin/obj, node_modules or dist; new per-run profiles/configuration | Pass. Installed toolchains and normal caches reused; not a fresh OS/VM |
| Isolated PostgreSQL | New `solarwatch-demo-f01348df-a/b` projects, absent-before-creation volumes, fresh ignored random passwords, distinct free loopback ports | Pass. No existing database reset or configuration copied |
| Restore/build/setup | Both public-source restores, Release builds, EF migration, npm ci/lint/build, 46 frontend units and Chromium install | All exit 0; detailed timings/arguments in manifest |
| Initial empty state | SQL 0, Latest 200/null, History 200/[], desktop/mobile empty React before ingestion in each clone | Pass; no seed/sample inserted first |
| Complete dataset | CLI successful summary: 1,441 accepted; 0 rejected/conflicts/errors/uncertain/unattempted; every timestamp/value compared with ordered SQL rows | Pass, both clones. Inclusive 24 hours, exact 60-second intervals, original seconds/microseconds retained |
| Replay | Identical source/runtime/profile/seed/original server reference; compare all ordered SQL keys/values and all CLI acknowledgments | Identical complete SHA-256 in both clones |
| API values/window | Latest equals last SQL row; each History response equals SQL filtered by its own inclusive from/to; to=asOf, window exactly 24h | Pass. Live counts legitimately shrink, rather than assuming 1,441 |
| UI data/geometry | Browser assertions compare W/W/% metrics, timestamps, curve vertex coordinates and synchronized markers against real persisted/API values | Pass, desktop/mobile in both clones; no HTTP or clock mocks |
| Manual update/navigation | Empty UI remains unchanged until Refresh; Overview/Installation/History links, keyboard exact selection, UTC-minute buttons, mobile slider/touch, pointer-minute policy | Pass. Selection/navigation add no API requests; History Refresh advances only History, retaining valid selection |
| Captures/freshness | Six raw PNGs in gallery; Manrope loaded, actual image, no horizontal overflow, recorded viewport/server references, hash checked | Pass. Server-checked ages 18.39–27.51 seconds; no claim of permanent freshness |
| Stop/restart/persistence | Both APIs/frontends stopped, scoped PostgreSQL stop/up, same config, host restart, full SQL digest comparison and real browser reload | Pass: all 1,441 rows and Latest values retained; later server windows correctly advance |
| Regression coverage | Existing 138 .NET unit + 58 real PostgreSQL integration + 46 frontend unit + 35 Playwright cases from clone A | **277 passed, 0 failed, 0 skipped**; Playwright 5.5 min. No new tests/dependencies. B's repeated 46 are not double-counted |
| Cleanup | Host processes stopped, scoped Compose down **without -v**; own two volumes retained | No task listeners remain. Before/after comparison preserves all six pre-existing container identities/states and 38 pre-existing volume names; those private identities are not published |

These are **executed automated checks**, plus agent visual inspection of the six PNGs against the four approved exports. They are not a manual human accessibility/device test. Existing regression tests intentionally cover errors, controlled clocks, empty/missing minutes and recovery with their existing fixtures; those are distinct from this demonstration's unmocked PostgreSQL/API/browser journey. No significant new coverage gap was found.

## Dataset identity and moving time

- Original server `T`: `2026-11-05T04:05:46.4498706+00:00`; normalized: `2026-11-05T04:05:46.449870+00:00`.
- First persisted instant: `2026-11-04T04:05:46.449870Z`; last: `2026-11-05T04:05:46.449870Z`. Profile `residential-v1`, seed **42**, .NET SDK **10.0.402**, PostgreSQL **17.11**.
- Simulator library `SolarWatch.Simulator/1.0.0`, informational version `1.0.0+b4a9c926648848361738f3ddeaddc104ed4aa2e5`. This assembly metadata is **not a published release/tag**.
- Full ordered SHA-256: `a7d2d83a8faf196491294f509326714c4e72f26cd69d4f591571db86489e5798`.

Canonical digest input is UTF-8 without BOM/header, one row per LF (including final LF): `measuredAt,solar,home,battery`. Timestamp is normalized UTC O-format with seven fractional digits and `+00:00`; powers are invariant whole-number W and battery is invariant two decimals. See executable [canonicalization and complete SQL/CLI/API comparison](tools/dataset.mjs).

| Actual query | Server asOf | Returned history rows | Persisted SQL rows |
| --- | --- | --- | --- |
| A, after generation | `2026-11-05T04:06:02.308843+00:00` | 1,440 | 1,441 |
| B, same T replay | `2026-11-05T04:09:18.377403+00:00` | 1,437 | 1,441 |
| A, after restart | `2026-11-05T04:21:28.889355+00:00` | 1,425 | 1,441 |
| B, after restart | `2026-11-05T04:21:28.888786+00:00` | 1,425 | 1,441 |

Each response matched the full SQL subset at **its own** bounds. Missing earliest minutes are the expected advancing query window, not lost data. After restart the unchanged last observation is correctly old; screenshots were taken earlier while fresh. Future fresh captures use a newly recorded server T; exact archived dataset replay and identical later screenshots are different guarantees. Both runs began empty, so they did not intentionally reload a conflicting full range; duplicate/no-overwrite behavior remains covered by the unchanged existing tests and documented CLI contract.

## Comparison with approved designs

Agent inspected Overview Desktop v2, Overview Mobile v1, History Desktop v1 and History Mobile v1 alongside all six actual exports. The dark palette, authorized green solar photograph, compact navigation, asymmetric Overview metrics, layered cards, dedicated History composition, yellow/teal/lime plots and readable mobile labels remain intact. Approved sources were not edited.

Relevant intentional/current implementation differences:

- Prototype illustrative values are replaced by persisted night-time zero solar, actual consumption/charge, and the continuous synthetic residential history. Both scales retain W / % independently; no energy totals or invented flows appear.
- Real microsecond identity, local UTC offset, server check time, moving-edge coverage and exact/minute help replace illustrative dates and prototype review controls. Selected rows follow each device's actual interaction sequence, so desktop/mobile do not pretend to select an identical row.
- The existing Overview uses short color accents instead of the prototype's metric mini-sparklines, as already recorded in the [Overview handoff](../architecture/overview-ui.md). This delivery does not change that implementation.
- Real metadata and accessible controls affect full-page height. Captures preserve the complete content; they are not cropped/composited to conceal differences. No new design discrepancy required a product change.

## Limitations and review gate

- All values are **simulated**, using the documented fixed fictional UTC schedule, a 50% initial battery per window and simplified lossless 10 kWh / ±2 kW balance. No measured battery/grid flow, energy total, weather or forecast is calculated. See [model assumptions](../architecture/residential-history-profile.md).
- Ingestion remains unauthenticated and **local Development-only**. This is not a deployment recipe; accepted ADR-001 does not require full-stack Compose.
- Native Chrome/Edge zoom, real Narrator/NVDA speech and physical-mobile checks remain **unverified**. Browser emulation, reduced-motion settings, automated accessibility checks and screenshots do not substitute for them. Preserve the owner's [limited Phase 5 acceptance](../validation/PHASE5_ACCEPTANCE.md) and [manual procedures](../validation/WINDOWS_MANUAL_CHECKS.md).
- Screenshot provenance records actual server references, browser, timezone, viewport, fonts and raw hashes. Font/network/tool availability and advancing time can affect a later run. Exact dataset reproducibility is scoped to the same profile/version, seed, normalized T and .NET 10 runtime behavior.
- This delivery proposes the definitive presentation for **personal review**, retains the existing regression suite, and leaves Phase 6, final acceptance and the MVP release pending. No release has been published.
