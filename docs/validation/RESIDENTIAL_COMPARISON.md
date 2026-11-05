# Controlled generated-pattern comparison

Technical comparison for Issue #38, not definitive portfolio captures or a real household benchmark.

Actual .NET 10.0.13 generators; seed **42**, original reference `2026-11-01T23:00:30.1234567+00:00`, normalized to `2026-11-01T23:00:30.123456+00:00`. Both produce 1,441 samples with identical timestamps. See [machine-readable evidence](evidence/residential-comparison.json) and [model parameters](../architecture/residential-history-profile.md).

| Maximum adjacent change | Existing random | residential-v1 |
| --- | --- | --- |
| Solar | 4914 W | 24 W |
| Home | 2845 W | 14 W |
| Battery | 97 percentage points | 0.34 percentage points |

| UTC instant | Random solar W | Random home W | Random battery % | Residential solar W | Residential home W | Residential battery % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-10-31T23:00:30.123456+00:00 | 3341 | 508 | 12 | 0 | 840 | 50 |
| 2026-11-01T02:00:30.123456+00:00 | 176 | 1380 | 3 | 0 | 1324 | 7.27 |
| 2026-11-01T05:00:30.123456+00:00 | 4954 | 2074 | 85 | 0 | 323 | 0 |
| 2026-11-01T08:00:30.123456+00:00 | 2444 | 1821 | 61 | 0 | 292 | 0 |
| 2026-11-01T11:00:30.123456+00:00 | 2809 | 444 | 6 | 0 | 944 | 0 |
| 2026-11-01T14:00:30.123456+00:00 | 2943 | 2071 | 25 | 1990 | 582 | 7.45 |
| 2026-11-01T17:00:30.123456+00:00 | 1033 | 2197 | 15 | 4110 | 596 | 66.18 |
| 2026-11-01T20:00:30.123456+00:00 | 19 | 2188 | 92 | 1972 | 503 | 100 |
| 2026-11-01T23:00:30.123456+00:00 | 4818 | 2607 | 53 | 0 | 840 | 93.19 |

The residential series has 727 actual zero-generation samples and reaches 4169 W. Its battery ranges from 0% to 100%. These are observations for this fixture, not guarantees for every seed/window.

Canonical SHA-256 (all samples, format specified in the evidence): random `0915e51aaa8c0aae1e8ed54351354a60109d98b3f16b85f86e4ba2b04b7a71ee`; residential-v1 `1ea48d5b3d00f9c6031846ea1f14276a38fee77c351b888cd800bc375237c182`. The residential digest is pinned in a unit test that also runs in CI.

Power follows a fixed synthetic UTC schedule. Battery starts at 50% per requested window, has assumed 10 kWh capacity/2 kW rate limits and ignores losses, grid exchanges and saturation surplus/shortfall. Overlapping windows can have different charge values. No accumulated-energy totals, real weather or forecasts are calculated. The default random generator is preserved.
