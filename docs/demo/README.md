# Reproduce the local SolarWatch demonstration

**Issue #41: prepared for personal review. Phase 6 and the MVP remain incomplete; no release or production deployment is authorized.** PostgreSQL runs in Compose; .NET and React run on the host, following accepted [ADR-001](../architecture/adr-001-local-startup.md).

Review the [six actual captures](GALLERY.md), [verification results](VALIDATION.md) and [evidence manifest](manifest.json). These are real application screenshots using persisted synthetic `residential-v1` readings, not prototype fixtures. The approved prototypes remain unchanged.

## Prepare two isolated clones

Use the prerequisites and configuration explanations in [CLEAN_CLONE.md](../development/CLEAN_CLONE.md): Windows PowerShell, Git, .NET 10 SDK, Node.js 24/npm and Docker with Linux containers. Public GitHub, NuGet, npm and browser-download access is needed; the existing page requests Manrope from Google Fonts. Normal tool/package/image/browser caches may be reused. This is a clean-source demonstration, not a clean OS installation.

The versioned helpers in this documentation checkout are executed **against separate, unmodified application clones**. In a fresh PowerShell terminal at this checkout's root:

```powershell
$demoTools = (Resolve-Path docs/demo/tools).Path
$demoRoot = Join-Path (Get-Location) 'artifacts/demo-replay'
New-Item -ItemType Directory -Force $demoRoot | Out-Null
$demoCommit = 'b4a9c926648848361738f3ddeaddc104ed4aa2e5'
$demoId = [Guid]::NewGuid().ToString('N').Substring(0,8)
$demoCloneA = Join-Path $demoRoot 'clone-a'
$demoCloneB = Join-Path $demoRoot 'clone-b'
$demoStateA = Join-Path $demoRoot 'state-a'
$demoStateB = Join-Path $demoRoot 'state-b'
git clone https://github.com/libanlsilva/solarwatch.git $demoCloneA
git -C $demoCloneA checkout --detach $demoCommit
git clone https://github.com/libanlsilva/solarwatch.git $demoCloneB
git -C $demoCloneB checkout --detach $demoCommit
powershell -NoProfile -File "$demoTools/prepare.ps1" -Clone $demoCloneA -State $demoStateA -Project "solarwatch-demo-$demoId-a" -Commit $demoCommit -DatabasePort 5550 -ApiPort 5281 -WebPort 5283
powershell -NoProfile -File "$demoTools/prepare.ps1" -Clone $demoCloneB -State $demoStateB -Project "solarwatch-demo-$demoId-b" -Commit $demoCommit -DatabasePort 5551 -ApiPort 5282 -WebPort 5284
```

Check each command's exit code before continuing. Choose another **new** replay directory for subsequent runs. The recorded executions used independent shallow GitHub main clones while main was exactly this commit; the explicit checkout above also works after main advances.

`prepare.ps1` refuses existing configuration/state/volume names, dirty or unexpected source and occupied ports. It creates a cryptographically random password in each ignored `.env`, an isolated application profile, empty npm user/global settings and an explicit public NuGet source. It starts only that project's PostgreSQL, restores/builds .NET, migrates, installs/lints/builds React, runs frontend units and installs Chromium. It never seeds or clears data. Private logs and per-run JSON receipts stay under the ignored replay directory. Do not publish `.env`, raw profiles or unreviewed logs.

If these ports are occupied, select six unused ports in the two prepare commands. The helpers read the resulting receipts; no Compose/source edit is needed. Retain the ignored configuration and project names for restart. The API connection never enters frontend variables. Local Development-only ingestion and loopback bindings are unchanged.

## Start the application

Use **fresh PowerShell terminals**, source `environment.ps1` once per terminal and substitute the absolute tool/clone/state paths from above. It changes only the current process environment. Terminal A, API for clone A:

```powershell
. "$demoTools/environment.ps1" -Clone $demoCloneA -State $demoStateA -Mode Api
Set-Location $demoCloneA
dotnet backend/src/SolarWatch.Api/bin/Release/net10.0/SolarWatch.Api.dll
```

Terminal B, frontend for clone A:

```powershell
. "$demoTools/environment.ps1" -Clone $demoCloneA -State $demoStateA -Mode Frontend
Set-Location "$demoCloneA/frontend"
npm.cmd run preview -- --host 127.0.0.1 --port 5283 --strictPort
```

Repeat in two further fresh terminals for clone B, substituting its paths and preview port `5284`. Its API uses `5282` from the receipt. Open `http://127.0.0.1:5283` / `5284`. The production preview proxies `/api` to the corresponding host API. Wait for both services to listen before continuing; do not run the earlier seed/random-history recipe.

## Verify, populate and capture

In another fresh terminal, set the same path variables and source the Frontend environment for the installed browser cache:

```powershell
. "$demoTools/environment.ps1" -Clone $demoCloneA -State $demoStateA -Mode Frontend
node "$demoTools/capture.mjs" $demoCloneA $demoStateA capture
node "$demoTools/capture.mjs" $demoCloneB $demoStateB repeat "$demoStateA/dataset.json"
```

The helper first verifies **SQL zero rows**, HTTP 200 `reading: null` / `readings: []` and the empty React screen in both device contexts. It loads the actual photograph/fonts, then captures a fresh server Latest `asOf` string `T` and executes this existing command, with no database credentials passed to the simulator:

```powershell
# Equivalent CLI command; capture.mjs already executes it. Do not run twice.
dotnet simulator/SolarWatch.Simulator/bin/Release/net10.0/SolarWatch.Simulator.dll --api-url http://127.0.0.1:5281 --history-24h --profile residential-v1 --end-at $demoReference --seed 42
```

`$demoReference` is the **original string** from `GET /api/readings/latest`'s `asOf`, not a browser/local clock value. The helper preserves it and its microsecond-normalized value, checks the CLI's successful summary, all 1,441 acknowledgments, every SQL timestamp/value and the actual API window. It exercises manual Refresh from empty to populated, real curve geometry, Overview/History/Installation navigation, exact keyboard selection, UTC-minute buttons, mobile touch/slider selection, synchronized markers and selection retention after History Refresh. Neither selection nor navigation adds requests. There is no API mocking, clock replacement or UI smoothing.

Clone A writes six raw PNGs plus `empty.json`, `dataset.json`, `browser.json` and the simulator log under its ignored state directory. Clone B starts empty, reuses A's original `T` and seed, compares the **complete dataset digest**, and repeats the browser checks without duplicating captures. Any assertion/CLI failure returns a failing process; inspect the private output before retrying. Do not rerun capture against a populated database: choose a new isolated project. Repeating the CLI's same occupied range yields HTTP 409 / exit 1 without overwriting, as already verified by existing tests; that is not a successful demo load.

Run the second clone promptly within the live window. Identical `T`/seed/profile/runtime reproduces the dataset, **not** later `asOf`, freshness, API row count or screenshots. A future fresh demonstration chooses a new server `T` and therefore a new dataset digest. Replaying the archived reference long afterward can leave no rows in the live 24-hour query; the interactive helper intentionally requires live data. Do not alter dates or responses to hide this.

For a human walkthrough, visit Overview (W/W/% and server-checked freshness), Installation (conceptual components, no invented flows), then History. Use each plot's keyboard help, minute buttons and mobile slider; both plots and Selected reading must agree. Press Refresh and inspect the updated server check. The automated browser performs these interactions; a human/native assistive-technology walkthrough is not implied by its success.

## Stop, restart and check persistence

With services still running, record each clone:

```powershell
node "$demoTools/persistence.mjs" $demoCloneA $demoStateA before
node "$demoTools/persistence.mjs" $demoCloneB $demoStateB before
```

Stop API/frontend with Ctrl+C; answer `Y` if Windows asks to terminate `npm.cmd`. For each clone, use its **original** project/configuration:

```powershell
$demoSetup = Get-Content "$demoStateA/setup.json" -Raw | ConvertFrom-Json
docker compose -p $demoSetup.project --env-file "$demoCloneA/.env" -f "$demoCloneA/docker-compose.yml" stop postgres
docker compose -p $demoSetup.project --env-file "$demoCloneA/.env" -f "$demoCloneA/docker-compose.yml" up -d --wait --wait-timeout 60 postgres
# Repeat with clone B / state B. Restart the four host terminals as above.
node "$demoTools/persistence.mjs" $demoCloneA $demoStateA after
node "$demoTools/persistence.mjs" $demoCloneB $demoStateB after
```

The helper compares SQL content/count/digest and Latest values, verifies the later moving API window, and reloads the real browser. Data may now correctly be stale. When finished, stop the host terminals and run scoped `docker compose ... down` using those same arguments. **Do not add `-v`, prune, clear-demo or deletion commands.** Both named volumes/configurations remain available. A new demonstration uses new names/ports; it never resets a previous run.

## Existing regression tests and handoff

Before selecting a fresh `T`, run the existing suite from clone A in a separate fresh shell sourced with `-Mode Tests`: `dotnet test backend/src/SolarWatch.slnx -c Release --no-build --no-restore`, then `npm.cmd run test:unit` and `npm.cmd run test:e2e` from `frontend`. This mode targets dedicated `solarwatch_demo_tests` / `solarwatch_demo_e2e` databases, **never the demo database**. The existing suites create their test databases; ports 5181/4181 must be free. See [existing test setup](../development/CLEAN_CLONE.md#existing-tests). Prepare already runs the 46 frontend units; count repeated executions only once in the 277 unique cases.

The [manifest](manifest.json) publishes safe command arguments, exact source/simulator versions, tools, UTC references, full dataset digest, per-clone receipts/results, screenshot hashes/fonts/dimensions and lifecycle evidence. Its helper hashes identify the executed verification code (UTF-8/LF; normalize checkout CRLF to LF when verifying PowerShell files). New runs produce their own receipts; their times/project names naturally differ. Secrets, local machine paths and unrelated Docker resource identities are excluded. Native zoom, Narrator/NVDA and physical mobiles remain **unverified** under the [limited Phase 5 acceptance](../validation/PHASE5_ACCEPTANCE.md); use the [manual Windows checklist](../validation/WINDOWS_MANUAL_CHECKS.md). No new product functionality, dependency or regression test is introduced.
