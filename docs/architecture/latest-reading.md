# Latest persisted reading

This first feature implements the narrow path PostgreSQL → ASP.NET Core API → React for the single `residential-demo` installation. The next delivery adds [local finite simulated ingestion](simulated-ingestion.md) while preserving this GET contract. History and continuous simulation remain later work.

## API contract

`GET /api/readings/latest` returns HTTP 200 with `Cache-Control: no-store`:

```json
{
  "asOf": "2026-10-28T12:01:00+00:00",
  "reading": {
    "installationId": "residential-demo",
    "measuredAt": "2026-10-28T12:00:00+00:00",
    "solarPowerW": 1200,
    "consumptionPowerW": 800,
    "batteryStateOfChargePercent": 65
  }
}
```

The values above are an illustrative simulated response. When there are no rows, `reading` is `null` and `asOf` is still supplied. A database connection/query failure returns a sanitized HTTP 503 Problem Details response, which the UI treats as an error rather than missing data.

`asOf` is captured from the injected server `TimeProvider` after the query completes. It is distinct from the source measurement timestamp. The frontend labels a snapshot stale only when `asOf - measuredAt > 5 minutes`; exactly five minutes is fresh. The label is explicitly the status at the last successful check. No polling, browser-clock comparison, or timer updates that label between refreshes.

An unsuccessful refresh retains the previous snapshot with a visible warning and a "Previous reading" heading. Initial failure, initial loading, successful empty data, and retry remain distinguishable. Timestamps are transmitted as UTC instants, formatted in the browser's local zone, and retain the original instant in HTML `time` attributes.

## Implementation decisions

- **Existing layers:** Domain validates finite/non-negative power, battery bounds, and measurement time. Application defines a single latest-reading query and its storage port. Infrastructure implements the port through EF Core; Api composes them. No generic repository or mediator is needed.
- **PostgreSQL migration:** a single `readings` table uses `(InstallationId, MeasuredAt)` as its primary key and database constraints for supported identity and numeric values. Latest selection orders by measurement time, independent of insertion order. UTC timestamps use `timestamp with time zone`; PostgreSQL stores microsecond precision.
- **Explicit development setup:** normal API startup neither migrates nor seeds. The `migrate`, `seed-demo`, and confirmed `clear-demo` commands require Development. Default seed time comes from the server clock; a supplied ISO timestamp supports deterministic fixtures. Seeding does not overwrite existing rows at that timestamp.
- **HTTP development path:** Vite proxies `/api` to the local API, avoiding cross-origin configuration for this slice. Production HTTP/HTTPS and reverse-proxy configuration are outside this delivery.
- **Small UI:** plain CSS and inline SVG are sufficient for this view; a dashboard component library is not introduced yet.

The local POST and duplicate-ingestion HTTP contract are documented separately in [simulated ingestion](simulated-ingestion.md). The existing migration and primary key support that delivery without a schema change.

## Verification

Backend unit tests exercise actual reading rules and application mapping/reference time. PostgreSQL integration tests apply migrations, verify the current model, read real rows through the API, recreate the host without losing data, check database constraints, exercise unavailable-database errors, and validate development-command behavior. They require an explicitly named `_tests` database and fail if infrastructure is missing.

Frontend unit tests use Node's built-in test runner for freshness boundaries and response validation. Playwright runs a real Release API, production frontend preview, and dedicated `_e2e` PostgreSQL database. Tests cover persisted fixture values, browser clock skew, local zone display, mobile overflow, loading/empty/error/retry states, failed-refresh retention, stale values, and manual discovery of a fresh seed. External API responses are not mocked for the successful database journey.

See the [README](../../README.md) for exact setup and validation commands. Test databases are deliberately separate from the development demo; test initialization clears only their demo readings.
