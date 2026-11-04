# Run an isolated local demo from a clean clone

Reference environment: **Windows / PowerShell, .NET 10 SDK, Node.js 24/npm, Git and Docker Desktop with Linux containers**. Public GitHub, NuGet and npm access is required; existing package/browser caches are allowed. PostgreSQL runs in Compose; the API and production Vite preview run on the host. This is a local development demonstration, not a production deployment. See the [two actual clean-clone runs](../validation/CLEAN_CLONE.md) for versions, commands/results and limitations.

## Clone and choose isolated resources

Use a new directory. Do not copy `.env`, user secrets, dependencies or built files from another checkout. The validated clones were shallow clones of GitHub main; remove `--depth 1` if you also want history.

```powershell
git clone --depth 1 --branch main https://github.com/libanlsilva/solarwatch.git solarwatch-demo
cd solarwatch-demo
$demoRoot = (Get-Location).Path
$demoProject = 'solarwatch-local-' + ([guid]::NewGuid().ToString('N').Substring(0, 8))
$demoDbPort = 5544
$demoApiPort = 5271
$demoWebPort = 5273
$demoProject # Record this non-secret project name for later stop/restart.
```

Choose unused host ports if another stack is running. Keep the project name and `.env` for restart; a different Compose project creates a different volume. The validation used projects `solarwatch-phase6-a-20261104` / `solarwatch-phase6-b-20261104`, DB ports 5544/5545, API ports 5271/5272 and frontend ports 5273/5274. Do not reuse those retained validation volumes as a new installation.

Generate local credentials once; never print or commit the populated file:

```powershell
if (Test-Path .env) { throw 'Use a new clone; preserve any existing .env and data.' }
$demoBytes = New-Object byte[] 32
$demoRng = [Security.Cryptography.RandomNumberGenerator]::Create()
$demoRng.GetBytes($demoBytes)
$demoRng.Dispose()
$demoPassword = [BitConverter]::ToString($demoBytes).Replace('-', '').ToLowerInvariant()
[IO.File]::WriteAllText("$demoRoot/.env", "POSTGRES_PASSWORD=$demoPassword`nPOSTGRES_PORT=$demoDbPort`n")
docker compose -p $demoProject --env-file .env up -d --wait --wait-timeout 60 postgres
```

Normal stop/restart must reuse this password. Changing `.env` does not change a password already initialized inside a retained PostgreSQL volume. Never solve that mismatch by silently deleting a volume.

## Explicit configuration and builds — terminal A

Compose reads `.env`; ASP.NET Core does not. Set its connection explicitly. The API's `UserSecretsId` does not make another developer's secrets a prerequisite. The validation additionally used empty per-run profile directories and empty npm/NuGet configuration files with public package sources; those details and allowed cache reuse are recorded in the evidence.

| Setting | Where / purpose |
| --- | --- |
| `POSTGRES_PASSWORD` | Required, secret, ignored `.env`; generate once per new volume |
| `POSTGRES_PORT` | `.env`; optional Compose default 5434, explicitly 5544 in this isolated recipe |
| `ConnectionStrings__SolarWatch` | API/CLI terminal only; required explicit connection for this recipe |
| `ASPNETCORE_ENVIRONMENT`, `DOTNET_ENVIRONMENT` | API/CLI terminal; explicitly `Development` for local commands/ingestion |
| `ASPNETCORE_URLS` | API terminal; explicitly selected loopback URL |
| `SOLARWATCH_API_URL` | Vite server terminal; optional default 5171, explicitly custom API URL here |
| `SOLARWATCH_TEST_CONNECTION`, `SOLARWATCH_E2E_CONNECTION` | Separate test shell only; dedicated disposable test databases, never demo data |

```powershell
$demoConfig = Get-Content .env | ConvertFrom-StringData
$env:ConnectionStrings__SolarWatch = "Host=127.0.0.1;Port=$($demoConfig.POSTGRES_PORT);Database=solarwatch;Username=solarwatch;Password=$($demoConfig.POSTGRES_PASSWORD)"
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:DOTNET_ENVIRONMENT = 'Development'
$env:ASPNETCORE_URLS = "http://127.0.0.1:$demoApiPort"
dotnet restore backend/src/SolarWatch.slnx
dotnet build backend/src/SolarWatch.slnx --configuration Release --no-restore
dotnet backend/src/SolarWatch.Api/bin/Release/net10.0/SolarWatch.Api.dll migrate
Push-Location frontend
npm.cmd ci
npm.cmd run lint
npm.cmd run build
Pop-Location
dotnet backend/src/SolarWatch.Api/bin/Release/net10.0/SolarWatch.Api.dll
```

Use the built DLL to avoid an implicit launch profile overriding custom ports. `dotnet run` is also available through the existing README recipe; use `--no-launch-profile` with explicitly configured custom URLs. Only the Development environment permits the existing migration/seed commands and local POST route. All displayed credentials stay server-side; never put a connection string in `VITE_*` variables.

## React and initial checks — terminal B

Open another PowerShell terminal in the clone. Set the same **non-secret** API/frontend ports; no database connection is needed in this terminal.

```powershell
$demoApiPort = 5271
$demoWebPort = 5273
$env:SOLARWATCH_API_URL = "http://127.0.0.1:$demoApiPort"
Push-Location frontend
npm.cmd run preview -- --host 127.0.0.1 --port $demoWebPort --strictPort
```

Open `http://127.0.0.1:5273` (or your selected frontend port). Vite's existing server-side `/api` proxy connects to the API port. This preview uses the built React app; it is not public production hosting.

From a third terminal, query `http://127.0.0.1:5271/api/readings/latest` and `/api/readings/history` using `Invoke-RestMethod`. After migration and before seeding, they return HTTP 200 with `reading: null` / `readings: []` and server UTC metadata. A configuration/database error is not an empty response. A deliberately unconfigured API in an empty profile failed with the expected configuration error during validation.

## Prepare data and demonstrate manual Refresh — terminal C

In the clone, load the same `.env` connection and Development environment as terminal A, and set the chosen API port:

```powershell
$demoApi = 'http://127.0.0.1:5271'
dotnet backend/src/SolarWatch.Api/bin/Release/net10.0/SolarWatch.Api.dll seed-demo
$demoLatest = Invoke-RestMethod "$demoApi/api/readings/latest"
dotnet backend/src/SolarWatch.Api/bin/Release/net10.0/SolarWatch.Api.dll seed-demo --measured-at $demoLatest.reading.measuredAt
$demoReference = (Invoke-RestMethod "$demoApi/api/readings/latest").asOf
dotnet simulator/SolarWatch.Simulator/bin/Release/net10.0/SolarWatch.Simulator.dll --api-url $demoApi --history-24h --end-at $demoReference --seed 42
Invoke-RestMethod "$demoApi/api/readings/latest"
$demoHistory = Invoke-RestMethod "$demoApi/api/readings/history"
$demoHistory | Select-Object asOf, from, to
$demoHistory.readings.Count
```

The fresh seed is 1,200 W / 800 W / 65% at current server UTC time. Repeating that exact timestamp is idempotent. History adds **1,441** one-minute readings over its inclusive window. In the validated empty installation, the separate seed plus history made **1,442 persisted rows**. A subsequent live history query need not return that count: its server reference advances, old rows leave the window, and extra off-cadence readings remain real. Preserve `asOf/from/to`; do not round them or fill gaps.

Open Overview and inspect its real values/charts, navigate to History and Installation, then return to Overview. While it remains open, run:

```powershell
dotnet simulator/SolarWatch.Simulator/bin/Release/net10.0/SolarWatch.Simulator.dll --api-url $demoApi --count 1 --seed 43
```

The UI keeps its prior successful snapshot until **Refresh**. Click it and compare the new values/timestamp with Latest; History uses the same persisted data through its own query. All readings are explicitly simulated. Dense independent random patterns are expected; this delivery does not change the generator or calculate energy totals.

Repeating `--history-24h` with the **same recorded reference and seed** reports 1,441 HTTP 409 conflicts and exits **1**, without overwriting rows. That is a rejected rerun, not a successful load. A new reference creates a different range; do not run it against valuable data expecting a reset. Other failures/cancellations retain the simulator's existing accepted/rejected/uncertain reporting.

## Stop, restart and preserve data

After requests finish, use **Ctrl+C** in the API and frontend terminals. On Windows, confirm `Y` if `npm.cmd` asks to terminate its batch job. From the clone, using the original project name:

```powershell
docker compose -p $demoProject --env-file .env stop postgres
docker compose -p $demoProject --env-file .env up -d --wait --wait-timeout 60 postgres
```

Restart the API/frontend with the same environment and commands; reload React. The measured timestamp and values must survive, while server `asOf` advances. The API's history count can decrease as the time window moves. `docker compose -p $demoProject --env-file .env down` also preserves the named volume; this container-removal/recreation path is tested separately from stop/start. Both paths preserved all **1,443** demo rows and an unchanged SQL content digest after the manual-refresh sample.

There is no automatic destructive reset in this recipe. Do not add `-v`, run `docker volume prune`, or invoke `clear-demo --confirm` against data you want to keep. Stop only your selected Compose project. See the [full-stack Compose evaluation](../architecture/local-compose-evaluation.md) for the deferred containerized app path.

## Existing tests

Use a separate shell and **dedicated databases ending in `_tests` / `_e2e`**, never the demo database: those suites deliberately clear their test readings. From the clone after the Release/frontend builds, use that clone's ignored local credentials without printing them:

```powershell
$demoConfig = Get-Content .env | ConvertFrom-StringData
Remove-Item Env:ConnectionStrings__SolarWatch -ErrorAction SilentlyContinue
Remove-Item Env:ASPNETCORE_URLS -ErrorAction SilentlyContinue
$env:SOLARWATCH_TEST_CONNECTION = "Host=127.0.0.1;Port=$($demoConfig.POSTGRES_PORT);Database=solarwatch_a_tests;Username=solarwatch;Password=$($demoConfig.POSTGRES_PASSWORD)"
$env:SOLARWATCH_E2E_CONNECTION = "Host=127.0.0.1;Port=$($demoConfig.POSTGRES_PORT);Database=solarwatch_a_e2e;Username=solarwatch;Password=$($demoConfig.POSTGRES_PASSWORD)"
dotnet test backend/src/SolarWatch.slnx -c Release --no-build --no-restore
Push-Location frontend
npm.cmd run test:unit
npx.cmd playwright install --no-shell chromium
npm.cmd run test:e2e
Pop-Location
```

Playwright owns API port 5181 and preview port 4181 and refuses reused servers; those ports must be free. Its browser installation may reuse the normal Playwright cache. See the existing [validation notes](../../README.md#validation). The clean-clone run kept all 252 existing cases active; it added no duplicate acceptance tests or dependencies.
