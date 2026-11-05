# Residential history profile v1

**Issue #38: implementation authorized by the owner; model parameters recorded before code in commit `4b45635`.** The profile implementation and model assumptions are personally approved through [PR #40](https://github.com/libanlsilva/solarwatch/pull/40) review; this slice completes with its squash integration. This is a separate delivery from accepted ADR-001. Phase 6 and the MVP remain pending; these are synthetic demo patterns, not a physical installation model.

## CLI and compatibility

The new opt-in is `--history-24h --profile residential-v1 --end-at <UTC/offset reference> [--seed <int32>]`. Only `residential-v1` is accepted; missing/duplicate/unknown profile values, use without history or with finite/continuous options fail before HTTP. Omitting `--profile` preserves the existing random history, finite and continuous behavior/output. No new settings file, dependency, endpoint or database field is needed.

Use the existing server `asOf` to validate the original requested reference before microsecond normalization. For normalized UTC `T`, emit exactly 1,441 samples at `T - 24h + i minutes`, `i=0..1440`. Preserve seconds/microseconds; do not round to UTC midnight/minutes or use local time/DST. Same `residential-v1`, seed and normalized reference reproduce the same ordered values/timestamps on .NET 10.

## Fixed synthetic defaults

Let `h` be UTC time-of-day in fractional hours. Four `Random(seed).NextDouble()` draws, in fixed order, supply phases `s1, s2, c1, c2` in `[0, 2π)`. No new random value is drawn per minute. The phases modulate continuous waves; they are not real cloud/appliance events.

| Parameter | v1 value / meaning |
| --- | --- |
| Synthetic daylight | 11:00–23:00 UTC, peak around 17:00 UTC; fixed every day |
| Solar envelope | `4200 × sin²(π(h−11)/12)` W during daylight; exactly 0 outside |
| Solar modulation | `0.97 + 0.02 sin(2πh/2+s1) + 0.01 sin(2πh/0.75+s2)`; factor 0.94–1.00 |
| Solar output | Whole W, midpoint ties away from zero; 0–4,200 W |
| Home base | 350 W |
| Activity bumps | Morning: 12 UTC, 900 W, width 1.25 h; midday: 18 UTC, 350 W, width 2 h; evening: 01 UTC, 1,300 W, width 1.5 h |
| Activity shape | Each adds `amplitude × exp(−0.5(d/width)²)`, with `d` the shortest circular 24-hour distance to its center |
| Home variation | `60 sin(2πh/3+c1) + 30 sin(2πh+c2)` W |
| Home output | Whole W, midpoint ties away from zero; analytic bounds 260–2,990 W |
| Initial battery | Exactly 50% at the **first** requested sample, with no hidden warm-up |
| Assumed capacity | 10,000 Wh, internal simulation assumption only |
| Charge/discharge limit | ±2,000 W, lossless simplified balance |
| Charge output | Two decimal places, midpoint ties away from zero, bounded 0–100% |

The daylight/activity schedule corresponds approximately to 06–18 daylight, 07 morning, 13 midday and 20 evening at a fictional fixed UTC−05 offset. It does not follow the browser's zone or seasonal DST, identify an actual location, or calculate astronomical sunrise/weather. All power waves repeat by UTC day for the same seed; circular activity distances avoid a midnight reset.

For each minute **after** the first, average the previous/current rounded `solar − home` balances, clip this average to ±2,000 W and add `clippedBalance / 6000` percentage points to the internal charge. This is the one-minute rate implied by 10,000 Wh capacity. Keep internal charge as decimal, clamp to 0–100, then round only the reported percentage. Maximum unrounded change is 1/3 percentage point per minute (reported changes can reach 0.34). Do not reset at midnight or accumulate rounded outputs.

## Scope and limitations

- This generates new measurements in the simulator. React must render stored values unchanged; no client smoothing/interpolation is introduced.
- Battery surplus/deficit is a toy input for charge evolution. At saturation, excess/shortfall is not represented; no grid flow, battery-power measurement, energy total, efficiency, tariff, forecast or weather value is emitted.
- Different windows restart charge at 50%, so overlapping windows can have different battery values. Seeds control phases, not unique physical households; no promise of unique values for every distinct seed or cross-version mathematical-runtime identity is made.
- Ingestion still uses the existing sequential HTTP runner and local Development guard. Accepted/rejected/conflicting/uncertain/unattempted counts, cancellation and failure exits retain their meanings. Selecting another profile never overwrites existing rows; occupied ranges may contain mixed old/new values after conflicts. Reproducible comparisons need an explicitly isolated empty range.
- No finite/continuous residential profile, additional CLI tuning parameters or complete physical model belongs to this delivery.

## Prepare an isolated empty demonstration

Follow the [isolated clean-clone walkthrough](../development/CLEAN_CLONE.md) through migration, API/frontend startup and initial empty checks. Use a **new Compose project, new named volume and generated ignored credentials**, with unused ports. Stop before its seed/random-history steps: do not populate those first. The baseline startup procedure and Compose file are unchanged.

From the clone, with the Release solution built and API listening on the chosen address (5271 in that walkthrough):

```powershell
$demoApi = 'http://127.0.0.1:5271'
$demoLatest = Invoke-RestMethod "$demoApi/api/readings/latest"
$demoHistory = Invoke-RestMethod "$demoApi/api/readings/history"
if ($null -ne $demoLatest.reading -or $demoHistory.readings.Count -ne 0) {
    throw 'Preserve these readings; choose a new isolated project/volume for a clean comparison.'
}
$demoReference = $demoLatest.asOf
dotnet simulator/SolarWatch.Simulator/bin/Release/net10.0/SolarWatch.Simulator.dll --history-24h --profile residential-v1 --end-at $demoReference --seed 42 --api-url $demoApi
if ($LASTEXITCODE -ne 0) { throw 'Not a complete successful load; inspect the accepted/rejected/uncertain summary.' }
```

The simulator needs only the local HTTP URL, not database credentials. Press **Refresh** in React after the load. A later live history window can exclude the earliest sample as `asOf` advances; that does not mean persistence failed. Preserve the reference string for a reproducible rerun: the same range now reports 409 conflicts/exit 1, without overwriting. Switching from random to residential in an occupied range cannot replace its values. Choose another new project for a clean alternative, never automatic clearing/deletion. Normal shutdown retains the named volume using the original walkthrough's stop/restart commands.

## Verification scope

Unit coverage checks exact UTC/microsecond windows, determinism, a canonical SHA-256 fixture, seed variation, day/night/peak behavior, adjacent-sample continuity, midnight, battery rate/sign/bounds and invalid arguments. Existing HTTP failure/cancellation tests remain active alongside profile routing/short failure cases. One new real PostgreSQL load checks all stored values plus an occupied timestamp; a short interrupted run checks uncertain persistence. One actual-CLI Playwright load compares HTTP acknowledgments, persisted API results and every existing chart path vertex. All 252 baseline cases are preserved; model unit cases do not repeat HTTP loads. See the [controlled comparison](../validation/RESIDENTIAL_COMPARISON.md) for generated values and limitations.
