# Simulated-reading ingestion and execution

[Issue #6](https://github.com/libanlsilva/solarwatch/issues/6) delivers the first part of Phase 3: a finite .NET simulator sends readings over HTTP, PostgreSQL persists them, and the existing React view discovers the latest one on manual refresh. The [latest-reading GET contract](latest-reading.md) remains compatible.

[Issue #8](https://github.com/libanlsilva/solarwatch/issues/8) adds opt-in continuous execution for review. The existing API/schema, security/validation guarantees, finite mode, and React interface remain compatible. Full reproducible 24-hour backfill is a later delivery.

## Local write boundary

`POST /api/readings` is registered **only in Development**. Other environments have no write route (404). Development also requires a loopback peer and a loopback request host (`localhost`, `127.0.0.1`, or `::1`). Forwarded / X-Forwarded-* requests and non-loopback browser origins are rejected with 403 before reading the body. Use the API directly, with a loopback bind address. Do not expose Development through a public listener, reverse proxy, or tunnel: this guard is not authentication, and cannot identify a remote client hidden behind a local intermediary that strips forwarding information. Authentication and deployment access controls remain future work.

The CLI accepts only credential-free loopback HTTP base URLs, disables redirects, and never receives database credentials. It uses no browser or CORS exception. React continues using its existing read-only GET through Vite.

## POST contract

Send `Content-Type: application/json` and all five fields:

```json
{
  "installationId": "residential-demo",
  "measuredAt": "2026-10-01T12:00:00.1234567Z",
  "solarPowerW": 1234,
  "consumptionPowerW": 987,
  "batteryStateOfChargePercent": 76
}
```

This is an illustrative past measurement. Timestamps require ISO 8601 date/time with seconds, optional 1–7 fractional digits, and an explicit `Z` or `±HH:mm` offset. The original instant must not exceed the injected server clock, even by a submicrosecond amount. Power must be finite and non-negative; charge must be finite and within 0–100 inclusive. Missing/null metrics are invalid; zero power and 0%/100% charge are valid. Only `residential-demo` is supported. Unknown JSON properties are ignored for compatibility; they do not create additional measurements.

HTTP 201 returns the existing `{ "asOf": ..., "reading": { ... } }` envelope, with the accepted values, UTC measurement timestamp, and server time captured after persistence. The reading timestamp is truncated to microseconds to match PostgreSQL/Npgsql storage. Both acknowledgments and subsequent GETs use that same normalized key. Responses are not cacheable.

| Status | Meaning |
| --- | --- |
| 201 | One reading persisted successfully |
| 400 | Validation Problem Details with `errors` by field; malformed/null JSON reports `body`; no row written |
| 403 | Development request is not a direct local request |
| 404 | Write route absent outside Development |
| 409 | This installation/normalized instant already exists, whether the values match or conflict |
| 415 | Request content type is not JSON |
| 503 | Sanitized database failure; not an empty or accepted result |

No create-location header is advertised because there is no individual-reading GET route. `GET /api/readings/latest` continues selecting by measurement time, so an accepted older arrival never displaces a newer measurement.

## Persistence and concurrency

The existing `(InstallationId, MeasuredAt)` PostgreSQL primary key is sufficient; no schema change or migration is needed. Infrastructure attempts one EF Core insert and translates only that key's unique-violation error into a duplicate result. There is no check-then-insert race, upsert, or overwrite. Concurrent submissions of the same key result in one 201 and conflicts for the others. Each POST is atomic; a simulator run is a sequence of independent requests, not a batch transaction.

Domain retains measurement bounds and UTC/microsecond normalization. Application validates the ingest request, calls the existing storage port's new insertion operation, and reuses the snapshot/envelope. Api owns HTTP and local-access policy. The simulator references Application/Domain contracts but never Infrastructure or EF Core. No additional package dependencies, generic repository, queue, or mediator are introduced.

These choices follow [EF Core insert-conflict behavior](https://learn.microsoft.com/en-us/ef/core/saving/concurrency) and [Npgsql timestamp handling](https://www.npgsql.org/doc/types/datetime.html).

## Simulator semantics

Run `SolarWatch.Simulator` as documented in the [README](../../README.md). Value options are paired and must not repeat; `--continuous` is a standalone flag:

| Option | Default | Validation |
| --- | --- | --- |
| `--api-url` | `http://127.0.0.1:5171` | Loopback HTTP origin; no credentials, path, query, fragment, or redirect |
| `--count` | `10` | Integer 1–120 |
| `--seed` | `42` | Signed 32-bit integer |
| `--end-at` | Server `asOf` | Explicit ISO timestamp with UTC/offset, not later than server reference time |
| `--continuous` | Off (finite mode) | Opt-in immediate/60-second execution; incompatible with `--count` and `--end-at` |
| `--help` | — | Use alone to print usage without contacting the API |

In finite mode, the simulator first GETs the API reference time, even in controlled mode, so it can reject a future batch before any POST. It generates oldest first, one-minute timestamp spacing ending at the chosen instant, normalized to microseconds. There is no waiting between samples in a finite batch. Same seed/count/ending instant produces the same logical readings under the supported .NET 10 runtime. Power/charge are bounded synthetic integers, not a physical model or accumulated energy.

Each confirmed 201 prints accepted values; 400/409 print rejected timestamps and HTTP codes and allow the finite run to continue. The summary reports requested, attempted, accepted, rejected, errors, and unattempted counts. All accepted returns exit 0; invalid options, any rejection, or any error returns exit 1. Unexpected HTTP status, network failure, timeout (15 seconds per request), or invalid acknowledgment stops the run. No exception details, response bodies, URLs containing credentials, or connection strings are printed. After an uncertain transport/acknowledgment failure, the current request may already have persisted: inspect the API before retrying. There are no automatic retries or demo-data deletion.

Rerun a controlled batch to receive explicit 409 conflicts; originals remain unchanged. A fresh default batch uses the new server time. A controlled historical batch only produces a stale React view when no newer reading exists in that database.

## Continuous mode

`--continuous` uses the same generator with one seeded `Random` sequence per run. Each iteration GETs a new `asOf`, requires a valid explicit UTC/offset instant, generates one normalized sample, and awaits its POST/acknowledgment before any further work. The simulator does not read local UTC time to assign measurements. A seed reproduces the value sequence for equivalent iterations on .NET 10, not live timestamps.

The first iteration starts immediately. `TimeProvider.GetTimestamp` / `GetElapsedTime` measure elapsed scheduling time; cancellable `Task.Delay` uses that same injected provider. At completion, wait until the next future 60-second slot relative to that iteration's start. For example, work taking 5 seconds waits 55; work taking 185 seconds skips missed slots and waits 55. A late wake starts one current iteration and a new cadence, so a late request is not followed by a near-immediate catch-up request. No periodic timer, overlapping tasks, backlog, or historical replay is used. Timer/HTTP latency can make actual measurement intervals longer than one minute; this is a local demonstration rather than a real-time guarantee.

The CLI subscribes to `Console.CancelKeyPress` only in continuous mode and passes cancellation through the runner, waits, and HTTP calls. A normal Ctrl+C stop while waiting or fetching `asOf` exits 0 if no earlier rejection/error occurred. If a POST is outstanding without a validated 201 acknowledgment, stopping reports an uncertain outcome and exits 1. A confirmed 201 remains accepted even if shutdown is requested immediately afterward. Reference failure/timeouts without a POST are errors without uncertain writes; they exit 1 unless the operation was explicitly cancelled by the operator.

Continuous mode stops on 400/409, unlike the unchanged finite continue-on-rejection behavior. These responses count as rejected, without an uncertain write. Unexpected POST status (including 503), network/timeout failure, or malformed/mismatched acknowledgment counts as an error with uncertainty: the client does not claim that persistence did or did not occur. Reference errors do not count as POST attempts. The final summary reports `attempted`, `accepted`, `rejected`, `errors`, and `uncertain`; only confirmed acknowledgments count as accepted. Diagnostic messages omit private transport/response details. No automatic retries or data deletion occur.

There is no configurable accelerated interval, checkpoint/resume, physical model, automatic React refresh, or full 24-hour backfill. Defaults approved in Issue #8 are implemented only for this scope. The [TimeProvider delay API](https://learn.microsoft.com/en-us/dotnet/api/system.threading.tasks.task.delay?view=net-10.0) supplies cancellation/testability without adding production or test package dependencies.

## Verification

Unit tests cover validation, timestamp precision, future rejection before truncation, generator determinism/bounds/spacing, option validation, server-reference mode, response counting, conflicts, unexpected HTTP status, network uncertainty, and invalid acknowledgments. Real PostgreSQL integration tests verify persistence/acknowledgment, invalid JSON/fields without writes, identical/conflicting/offset/submicrosecond duplicates, concurrent duplicates, older arrivals, database unavailability, and Development/local restrictions.

Playwright launches the actual CLI against the API and dedicated PostgreSQL database, displays a controlled stale batch, submits a fresh batch with different generated values, verifies React retains the old snapshot until Refresh, then checks the persisted latest values/time and fresh state despite a shifted browser clock. Repeating the controlled batch verifies nonzero exit and explicit conflicts. Existing state-handling tests remain in place. All suites run in CI with dedicated `_tests` / `_e2e` databases.

Continuous unit tests advance a small test-only `TimeProvider` implementing the one-shot timer contract used by `Task.Delay`: they prove immediate/minute scheduling, slow work and late wake-ups without bursts, serialization, server-time assignment, value-sequence compatibility, invalid options, cancellation stages, HTTP failures/timeouts, and malformed responses. Real PostgreSQL tests advance the same scheduler while a separate injected server clock advances `asOf`, verify persisted scheduled readings and latest selection, exercise a real 409 without overwriting, and cancel after a committed POST before its acknowledgment to prove truthful uncertainty reporting.

The continuous browser test launches the actual DLL, observes its immediate sample through the real API/database and manual Refresh, then stops it reliably. Ubuntu GitHub Actions delivers SIGINT and asserts successful graceful shutdown and the summary. On Windows, Node cannot synthesize a console Ctrl+C event, so browser teardown terminates the process; cancellation semantics remain covered by the unit/integration token tests. Subsequent minute ticks are tested with controlled time, not real-minute browser waits. Existing workflows discover and run these tests through the solution and Playwright suite; no test-only scheduling command or separate harness is added to the CLI.
