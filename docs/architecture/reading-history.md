# Persisted 24-hour reading history

Second Phase 5 delivery, tracked in [Issue #16](https://github.com/libanlsilva/solarwatch/issues/16). The implementation is definitively owner-approved and complete with reviewed squash integration of [PR #17](https://github.com/libanlsilva/solarwatch/pull/17). Phase 5 and the MVP remain incomplete. React, the approved Overview, Latest Reading and simulator behavior are unchanged.

## HTTP contract

`GET /api/readings/history` is read-only and returns HTTP 200, JSON and `Cache-Control: no-store` for the existing `residential-demo` installation:

```json
{
  "asOf": "2026-10-30T12:34:56.123456+00:00",
  "from": "2026-10-29T12:34:56.123456+00:00",
  "to": "2026-10-30T12:34:56.123456+00:00",
  "readings": [
    {
      "installationId": "residential-demo",
      "measuredAt": "2026-10-29T12:34:56.123456+00:00",
      "solarPowerW": 0,
      "consumptionPowerW": 800,
      "batteryStateOfChargePercent": 65
    }
  ]
}
```

This example is illustrative. Actual responses contain only persisted measurements. Solar generation and consumption are instantaneous power in **W**; battery charge is **%**. No Wh/kWh totals or energy-flow estimates are computed.

- `asOf` is captured once from the injected server `TimeProvider`, **before querying PostgreSQL**. `ReadingTimestamp.Normalize` converts it to UTC and truncates sub-microsecond ticks, using the existing storage convention. `to == asOf`; `from == asOf - 24 hours`.
- Exactly these instants are used in the SQL predicate and the response. No second clock read, local-calendar arithmetic or rounding to minutes/days moves the window while the query runs.
- The window is inclusive: `from <= measuredAt <= to`. Both endpoints are included. A reading one PostgreSQL microsecond outside either bound is excluded, including an already persisted measurement newer than the captured reference.
- Readings are returned in ascending `measuredAt` order, independent of insertion order. The existing `(InstallationId, MeasuredAt)` primary key guarantees uniqueness.
- Empty history returns HTTP 200 with `readings: []` and valid window metadata. Partial history returns only actual rows; missing minutes have no rows and are never replaced with zero, `null` samples or interpolation. A stored zero remains zero. Off-minute readings are valid.
- There is no artificial 1,441-row cap. That number describes the simulator's inclusive one-minute preparation, not an API result limit or completeness guarantee. Other valid persisted instants are also returned.
- No client-selected dates, durations, installation IDs, pagination, filtering or aggregation are supported. The response's server bounds are authoritative; supplying query-string values does not select another window.
- Database/query failures return sanitized HTTP 503 `application/problem+json`, with title `Readings are temporarily unavailable.` and no connection details. Failure is distinct from successful empty history.
- Request cancellation propagates through Application and EF Core/Npgsql. Cancelled client requests are not translated into HTTP 503. A disconnected client generally observes cancellation rather than a JSON response; the integration test also verifies ASP.NET Core's server-side aborted-request status (499).

The [Latest Reading](latest-reading.md) contract stays unchanged: its `asOf` is captured after the latest query to evaluate freshness at the check. History captures its reference before the query to fix a consistent range. Future UI code must maintain independent latest/history snapshots, references and error/busy states; this delivery adds no browser history request.

## Implementation decisions

`GetReadingHistory` captures/normalizes the clock, constructs the fixed window and maps through the existing `ReadingSnapshot.From`. `IReadingStore.GetHistoryAsync` specifies inclusive bounds and chronological ordering. `PostgresReadingStore` executes one read-only `AsNoTracking` query filtered by installation and those bounds, ordered ascending; the current primary key supports the lookup. The API registers the small query and maps the read-only route with the same Problem Details conventions as Latest Reading.

No schema migration, package, infrastructure service, generic repository, mediator or cache is introduced. There is no public clock override or test endpoint. Fixed clocks and SQL/cancellation observation are injected only by the existing integration test host. The local Development-only POST guard is unchanged; the new GET does not add writes or alter authentication/deployment assumptions.

## Reproduce locally

Follow [README setup](../../README.md#local-setup) for PostgreSQL, the local connection environment, migrations, current-time seed and Development API. The API normally listens on `http://localhost:5171`.

Query from PowerShell:

```powershell
$history = Invoke-RestMethod http://localhost:5171/api/readings/history
$history | Select-Object asOf, from, to
$history.readings.Count
$history.readings | Select-Object -First 5 measuredAt, solarPowerW, consumptionPowerW, batteryStateOfChargePercent
```

Or inspect the raw HTTP response:

```sh
curl -i http://localhost:5171/api/readings/history
```

To populate a recent reproducible value sequence through the unchanged simulator, obtain a reference from the existing API rather than the browser/machine clock. From the repository root, with the Release solution built and Development API running:

```powershell
$reference = (Invoke-RestMethod http://localhost:5171/api/readings/latest).asOf
dotnet run --project simulator/SolarWatch.Simulator --configuration Release --no-build -- --history-24h --end-at $reference --seed 42
$history = Invoke-RestMethod http://localhost:5171/api/readings/history
$history | Select-Object asOf, from, to
$history.readings.Count
```

The generator submits exactly 1,441 samples over `[reference - 24 hours, reference]`. The **later live GET uses a newer server reference**, so its lower bound has advanced and the earliest generated samples may already be outside the query. Do not expect exactly 1,441 results from that later GET or claim missing older samples are query errors. Additional existing rows may increase the count. The automated fixed-clock test verifies the exact 1,441-result case independently of live timing.

An explicitly supplied past `--end-at` and seed reproduce generation timestamps/values, not the reference of a later live query. Repeated or overlapping generator runs retain existing values and report conflicts according to the [ingestion contract](simulated-ingestion.md). This GET never clears or overwrites data. Use an empty dedicated demo range if all generated acknowledgments are required; do not clear valuable data to obtain a desired count.

## Verification

Unit tests cover one clock capture before storage, UTC/offset normalization and sub-microsecond truncation, unchanged response/filter bounds while a delayed query spans a clock change, preserved snapshots/zero/gaps, cancellation before and during storage, and error propagation.

Real PostgreSQL HTTP tests reuse the existing sequential fixture and dedicated `_tests` database. They verify the exact JSON shape, no-store, empty/partial history, reversed inserts, both inclusive endpoints and adjacent excluded microseconds, equivalent offset instants, unchanged SQL bounds while the clock advances, every value/timestamp of 1,441 samples, an additional off-cadence sample (1,442 results), sanitized failures and client cancellation during a real PostgreSQL lock wait. The cancellation test observes EF cancellation and server completion, releases the lock in `finally`, then verifies a successful query from the same host.

The large fixture is inserted through EF Core directly; existing simulator tests retain HTTP ingestion coverage. No bulk endpoint or extra 1,441-request setup is needed for history-query verification.

Local validation: restore and Release solution build pass with zero warnings/errors; **116 .NET unit, 56 real PostgreSQL integration, 13 frontend unit and 15 Playwright tests pass**, with no skipped tests. Frontend lint/production build pass. Backend CI's existing solution-wide `dotnet test` discovers and executes the new unit and integration tests; Frontend CI and Full Stack E2E retain their complete suites. No workflow changes are needed.

## Limits and later work

This is a bounded rolling 24-hour query, not a frozen database export, historical date picker or paginated API. It returns rows visible to its PostgreSQL SELECT; writes committed after that statement's snapshot are available on a later manual request. The reference fixes temporal inclusion, not a promise to observe concurrent writes. The current local demo permits off-cadence ingestion, so response size depends on actual stored rows; no production load benchmark or volume guarantee is claimed.

React history consumption, real graphs and the detailed History screen require a separate approved issue. Keep the approved Overview and design prototypes intact. No automatic refresh, accumulated energy, realistic simulation redesign, authentication or public deployment is included.
