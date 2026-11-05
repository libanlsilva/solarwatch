# Final local MVP candidate validation — Issue #43

**Recommendation: GO for the owner's personal review, within the local portfolio MVP scope.** The twelve criteria below have satisfactory traceable evidence; no confirmed blocking functional/security defect was found in this focused review. This is a recommendation, not acceptance or publication authorization. **Phase 6 and the MVP remain pending.** The PR must stay open; no merge, Git tag or GitHub Release is performed by this delivery.

Application candidate: approved main **`a469498a237eeb06fbf546357b2c1d7d676d308a`**, cloned independently from GitHub on 2026-11-05. This delivery changes documentation/evidence only and leaves backend, frontend, simulator, dependencies, Compose, workflows, approved designs and original demonstration resources intact. [Machine-readable results/commands](evidence/local-mvp-candidate.json) · [Markdown-only v0.1.0 notes](../releases/v0.1.0-draft.md) · [Issue #43](https://github.com/libanlsilva/solarwatch/issues/43).

## Acceptance matrix

Each **Pass** below means the stated automated/source-review evidence supports the unchanged [MVP criterion](../requirements/MVP.md#user-scenarios-and-acceptance-criteria), not that a human tested a reader or physical device. All referenced tests were executed at the candidate above.

| Criterion | Specific current evidence | Result / qualification |
| --- | --- | --- |
| AC-01 — identify the demo | [Overview E2E](../../frontend/tests/e2e/overview.spec.ts), [App](../../frontend/src/App.tsx), new smoke's visible `Simulated data` check | Pass: one residential installation; no sign-in or installation selector |
| AC-02 — current persisted snapshot | New unmocked SQL/CLI/API/browser comparison; [latest E2E](../../frontend/tests/e2e/latest-reading.spec.ts), including the changed browser-clock case | Pass: W/W/%, original measurement time and battery meter derive from the same latest persisted row |
| AC-03 — persistence | New stop/start of PostgreSQL and both host apps, complete SQL digest comparison and real browser reload; [latest integration](../../backend/tests/SolarWatch.IntegrationTests/LatestReadingTests.cs), `Selects_latest_measurement_not_insertion_order_and_survives_host_restart` | Pass: 1,441 rows, Latest values and timestamp unchanged |
| AC-04 — UI states | [Latest request units](../../frontend/tests/unit/latest-reading-query.test.ts), [History request units](../../frontend/tests/unit/history-query.test.ts), [Overview E2E](../../frontend/tests/e2e/overview.spec.ts), [History E2E](../../frontend/tests/e2e/history-view.spec.ts) | Pass: independent loading/empty/error/retry, single-flight/cancellation, retained original snapshot/asOf and successful-empty clearing. Error/latency fixtures are controlled tests |
| AC-05 — time/freshness | [Reading units](../../frontend/tests/unit/readings.test.ts), strict-boundary [Overview E2E](../../frontend/tests/e2e/overview.spec.ts), new smoke checks the actual server asOf | Pass: exactly 300s fresh, >300s stale; original UTC/local zone/offset; no fabricated missing timestamp. Clock-shift regression cases are identified, not native clock evidence |
| AC-06 — inclusive 24h history | [History integration](../../backend/tests/SolarWatch.IntegrationTests/ReadingHistoryTests.cs), `Partial_history_preserves_both_microsecond_boundaries_order_zero_and_off_cadence_samples`; [chart geometry E2E](../../frontend/tests/e2e/history-charts.spec.ts) | Pass: both microsecond boundaries included, adjacent out-of-range rows excluded, order/irregular samples/elapsed time and separate W/% scales preserved |
| AC-07 — incomplete history | [History units](../../frontend/tests/unit/history.test.ts), including exactly 300s versus 300s + 1µs; chart/History E2E above | Pass: explicit empty/partial coverage, real zero retained, uncovered edges not extrapolated, longer gaps break strokes/fills |
| AC-08 — validation | [Domain units](../../backend/tests/SolarWatch.UnitTests/InstallationReadingTests.cs), [submit units](../../backend/tests/SolarWatch.UnitTests/SubmitReadingTests.cs), [ingestion integration](../../backend/tests/SolarWatch.IntegrationTests/IngestionTests.cs), `Invalid_JSON_or_measurements_return_400_without_writes` | Pass: invalid/future/unknown/missing/non-finite/range values rejected without persistence; 0 W, 0% and 100% accepted |
| AC-09 — duplicates | Ingestion integration `Identical_conflicting_offset_and_submicrosecond_duplicates_return_409_without_overwrite` and `Concurrent_duplicate_requests_produce_one_created_row_and_conflicts` | Pass: normalized-instant uniqueness, HTTP 409 and original values retained, including concurrent requests |
| AC-10 — older arrivals | Ingestion integration `Ingestion_acknowledges_normalized_row_and_older_arrival_cannot_replace_latest`; history integration above | Pass: older valid row retained in chronological history without replacing the newer Latest snapshot |
| AC-11 — reproducible demonstration | New candidate clone/preparation/persistence below; [residential generator units](../../backend/tests/SolarWatch.UnitTests/ResidentialHistoryGeneratorTests.cs), [residential integration](../../backend/tests/SolarWatch.IntegrationTests/ResidentialHistorySimulationTests.cs), existing full CLI rerun E2E | Pass: exact seeded UTC generation; repeat/conflict reporting without accumulation/overwrite. Approved two-clone replay and six captures remain unchanged [historical evidence](../demo/VALIDATION.md) |
| AC-12 — Full Stack/tests/docs | All 277 existing cases, new real PostgreSQL/API/React smoke, this record, README/setup/asset/link review | Pass: meaningful unit/integration/browser coverage, reproducible instructions and explicit limitations; no new regression tests added |

The current suite also verifies shared exact/microsecond versus UTC-minute selection, missing/multiple readings, DST offsets, pointer ambiguity, keyboard/touch, selection changes during pending Refresh and later reconciliation: [selection units](../../frontend/tests/unit/history-selection.test.ts), [selection E2E](../../frontend/tests/e2e/history-selection.spec.ts). Existing responsive/short-phone and F1/F2 regressions remain active. This is not another full manual visual/accessibility audit.

## Clean-clone execution

The actual command was `git clone --depth 1 --branch main https://github.com/libanlsilva/solarwatch.git <new-clone>` while main was exactly the candidate SHA. Initial/final Git status was clean. No `.env`, bin/obj, node_modules, dist or user secrets were copied. Fresh ignored random credentials, project **`solarwatch-demo-final-78d6680f`**, a new named volume, database port **5560**, API **5291**, preview **5293** and per-run application/npm/NuGet configuration were used. Normal installed tools and package/image/browser caches were reused; this was not a fresh OS/VM. No parent MSBuild/global.json overrides were found.

Executed: public-source restore, Release build (**0 warnings/errors**), migration, npm ci/lint/build, 46 frontend units, Chromium install, then 138 .NET units + 58 real PostgreSQL integration + 35 Playwright cases. **277 passed; 0 failed/skipped.** .NET test command wall time: 257.31s; Playwright: **8.2m** (command 493.04s). Tests used separate `solarwatch_demo_tests` / `solarwatch_demo_e2e` databases; their deliberate clear operations never targeted demo data. Existing tests create their usual ignored artifacts; no new demonstration screenshots were generated.

Actual tools: .NET SDK **10.0.402**, Node **24.15.0**, npm **11.12.1**, PostgreSQL **17.11**, Docker **29.5.2**, Compose **5.1.4**, PowerShell **5.1.26100.9818**, Chromium **156.0.8078.4**. The unmocked smoke used 1440×900, en-US and America/Havana. It did not replace HTTP responses/fonts or the clock; existing error/clock/font-bounding regression fixtures are separately identified by their source tests.

### Dataset and restart results

- Initial SQL count **0**, Latest HTTP 200/null, History HTTP 200/[] and React empty state verified before ingestion.
- `residential-v1`, seed **42**, original server T **`2026-11-05T06:23:51.3125391+00:00`**, normalized **`2026-11-05T06:23:51.312539+00:00`**. No local/browser clock assigns the reference.
- **1,441 accepted**, no rejected/conflicting/error/uncertain/unattempted samples; every acknowledgment, UTC timestamp and value matches SQL over inclusive `[T−24h,T]`, exactly one minute apart.
- Complete canonical SHA-256 **`37d7fb75c30294ce15fc3f8cc485888e9a0df7dab0a0daf1cc83c4527432c5e4`** before and after restart. Canonicalization is the unchanged [demo helper](../demo/tools/dataset.mjs): invariant UTC O timestamp, whole-number W, battery F2, UTF-8/LF including final LF.
- Latest persisted values: **0 W / 398 W / 22.84%**, at normalized T. Night-time zero is a stored simulated reading. Overview applies its existing charge formatting.
- The new browser remained empty until manual Refresh, then displayed actual metrics/plots; keyboard exact selection synchronized all three markers/panel. History-only Refresh retained selection and advanced only History; navigation/selection added no fetches. Overview/History/Installation navigation passed.
- Initial live History returned **1,440** rows; after restart **1,438**, each exactly matching SQL filtered by that response's own from/to/asOf. All **1,441 remained stored**. Later query windows/freshness advance naturally; this dataset is not required to match the archived screenshot fixture.
- Host Ctrl+C and scoped PostgreSQL stop/up, with the same credentials/project/volume, preserved everything; browser reload passed. Final scoped `down` omitted `-v`. Own volume retained, six pre-existing container identities/states and all 40 pre-existing volume names preserved; host test services are stopped. No private resource identities are published.

### Repeat only this focused check

Reuse [CLEAN_CLONE.md](../development/CLEAN_CLONE.md) and the [approved demo startup instructions](../demo/README.md#start-the-application), with new directories/project/ports. The archived demo guide pins an older evidence commit; **use the candidate SHA above for this check**, retaining the archive unchanged. A full Git clone permits checking out that SHA after main advances. From a delivery checkout containing the new helper:

```powershell
# Use absolute paths for a new application clone and a nonexistent state directory.
# Execute prepare in a separate process; never reuse populated state/configuration.
powershell -NoProfile -File "$clone/docs/demo/tools/prepare.ps1" -Clone $clone -State $state -Project $newProject -Commit a469498a237eeb06fbf546357b2c1d7d676d308a -DatabasePort 5560 -ApiPort 5291 -WebPort 5293
# In separate fresh terminals, source environment.ps1 ONCE with Mode Api / Frontend.
# Run the built API DLL from the clone, and preview with --host 127.0.0.1 --port 5293 --strictPort.
# Before choosing a fresh T, run existing tests in another fresh terminal with Mode Tests:
dotnet test backend/src/SolarWatch.slnx --configuration Release --no-build --no-restore
# From the clone's frontend (prepare already ran its 46 unit tests):
npm.cmd run test:e2e
# In a fresh terminal with the Frontend environment, from the delivery checkout:
node docs/validation/tools/local-mvp-smoke.mjs $clone $state
node "$clone/docs/demo/tools/persistence.mjs" $clone $state before
# Stop host apps; Compose stop/up using the ORIGINAL project/.env; restart host apps.
node "$clone/docs/demo/tools/persistence.mjs" $clone $state after
# Finally stop host apps and scoped Compose down, without -v. Retain config/volume.
```

The versioned [smoke helper](tools/local-mvp-smoke.mjs) refuses populated data and reuses original complete SQL/CLI/API verification. It writes per-run receipts, not screenshots, and throws on failure. Absolute private paths/passwords remain ignored; sanitized actual arguments/results are in the [manifest](evidence/local-mvp-candidate.json). Its generated T/digest will differ in a future current-time run; no reset/reseed or archived-clock replay is implied.

## Focused security and documentation disposition

Reviewed all **267 tracked candidate files** for the fresh credential, high-confidence token/private-key patterns and unintended build/config/database files; no match was found. The fresh password is also absent from the built frontend. Ignored `.env`/build/dependency paths were checked; appsettings contain no populated connection credentials. This is a focused file/configuration review, **not** a dependency-vulnerability assessment, penetration test, production-hardening certification or full-history secret audit.

Inspected [LocalIngestion.cs](../../backend/src/SolarWatch.Api/LocalIngestion.cs), Compose, Vite, launch profiles and actual startup. PostgreSQL publishes `127.0.0.1:5560`; API/frontend startup explicitly bind loopback. Both respond by loopback HTTP; unfiltered OS endpoints show loopback addresses. The Windows `State=Listen` CIM filter returned no entries while services responded; **that filtered check is not claimed to pass**. Exact limitation/evidence is retained in the manifest.

Ingestion integration verifies absent writes in Production/Staging and rejects nonlocal peer/Host, forwarded headers and nonlocal/null Origin; peer metadata is controlled by the test host, while PostgreSQL is real. Validation, duplicate/no-overwrite and sanitized database errors remain tested. This is **not authentication** and does not make a proxy/tunnel/public binding safe. General `AllowedHosts`, container-debug profiles and unauthenticated reads are not production hardening. Retain ADR-001 and host loopback startup; no public running service is proposed.

README, setup/stop commands, gallery, draft notes, model assumptions and local-only limitations were reviewed. Code/docs retain MIT; the supplied photograph retains its recorded [publication permission](../design/ASSETS.md), without asserting a standalone MIT photo license; no font binary is added. Six definitive PNGs, original manifest/scripts, four prototypes and original audit evidence remain unchanged. Their historical pre-review wording is governed by the current owner approval in README/roadmap, not rewritten as fresh evidence.

## Remaining checks and decision gate

Native Chrome/Edge zoom 100/200/400%, real Narrator/NVDA and physical-mobile behavior remain **unverified**, not failed/passed by inference. No new inaccessible native-channel attempt was made. Preserve [Phase 5's limited accepted risks](PHASE5_ACCEPTANCE.md), four failed attempts and [manual Windows procedure](WINDOWS_MANUAL_CHECKS.md). Existing CSS-text enlargement/AX/touch-emulation regressions do not certify native reflow, speech or hardware. The owner must expressly decide their final release disposition.

Candidate main's [Backend CI](https://github.com/libanlsilva/solarwatch/actions/runs/41966082372), [Frontend CI](https://github.com/libanlsilva/solarwatch/actions/runs/41966082428) and [Full Stack E2E](https://github.com/libanlsilva/solarwatch/actions/runs/41966082400) pass at `a469498`. The final delivery head's exact CI results are recorded in its linked PR; post-integration main verification remains pending **until integration is separately authorized**. No result here approves a later runtime change.

**GO for personal review:** current-clone setup, all twelve criteria, 277 existing tests and the focused local-only review support the limited MVP candidate. No new confirmed blocking defect was found; the CIM observation is a disclosed tooling limitation and the native/device gaps remain accepted-but-unexecuted risks. The owner still decides PR integration, final risk acceptance, Phase 6/MVP closure and any subsequent tag/Release publication. Proposed version **v0.1.0** is only [draft Markdown](../releases/v0.1.0-draft.md); no release object or tag exists from this delivery.
