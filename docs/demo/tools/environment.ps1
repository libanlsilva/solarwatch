param(
    [Parameter(Mandatory=$true)][string]$Clone,
    [Parameter(Mandatory=$true)][string]$State,
    [ValidateSet('Api','Frontend','Tests')][string]$Mode='Api'
)
# Per-process configuration only. Secrets never enter frontend variables or arguments.
$demoClone=(Resolve-Path $Clone).Path
$demoState=(Resolve-Path $State).Path
$demoReceipt=Get-Content "$demoState/setup.json" -Raw | ConvertFrom-Json
$demoConfig=Get-Content "$demoClone/.env" | ConvertFrom-StringData
$demoCacheProfile=$env:USERPROFILE
$demoCacheLocal=$env:LOCALAPPDATA
Get-ChildItem Env: | Where-Object { $_.Name -match '^(ConnectionStrings|ASPNETCORE|DOTNET|SOLARWATCH|VITE|PG|POSTGRES_|NPM_CONFIG|NODE_|Logging__)' } | ForEach-Object { [Environment]::SetEnvironmentVariable($_.Name,$null,'Process') }
$env:USERPROFILE="$demoState/profile"
$env:APPDATA="$demoState/profile/AppData/Roaming"
$env:LOCALAPPDATA="$demoState/profile/AppData/Local"
$env:DOTNET_CLI_HOME="$demoState/profile"
$env:DOTNET_GENERATE_ASPNET_CERTIFICATE='false'
$env:NUGET_PACKAGES=Join-Path $demoCacheProfile '.nuget/packages'
$env:NPM_CONFIG_USERCONFIG="$demoState/user.npmrc"
$env:NPM_CONFIG_GLOBALCONFIG="$demoState/global.npmrc"
$env:NPM_CONFIG_CACHE=Join-Path $demoCacheLocal 'npm-cache'
$env:NPM_CONFIG_REGISTRY='https://registry.npmjs.org'
$env:PLAYWRIGHT_BROWSERS_PATH=Join-Path $demoCacheLocal 'ms-playwright'
if($Mode -eq 'Frontend') { $env:SOLARWATCH_API_URL="http://127.0.0.1:$($demoReceipt.apiPort)" }
else {
    $env:ASPNETCORE_ENVIRONMENT='Development'; $env:DOTNET_ENVIRONMENT='Development'
    $env:Logging__LogLevel__Default='Warning'
    [Environment]::SetEnvironmentVariable('Logging__LogLevel__Microsoft.Hosting.Lifetime','Information','Process')
    [Environment]::SetEnvironmentVariable('Logging__LogLevel__Microsoft.EntityFrameworkCore','Critical','Process')
    if($Mode -eq 'Api') {
        $env:ASPNETCORE_URLS="http://127.0.0.1:$($demoReceipt.apiPort)"
        $env:ConnectionStrings__SolarWatch="Host=127.0.0.1;Port=$($demoConfig.POSTGRES_PORT);Database=solarwatch;Username=solarwatch;Password=$($demoConfig.POSTGRES_PASSWORD)"
    } else {
        $env:SOLARWATCH_TEST_CONNECTION="Host=127.0.0.1;Port=$($demoConfig.POSTGRES_PORT);Database=solarwatch_demo_tests;Username=solarwatch;Password=$($demoConfig.POSTGRES_PASSWORD)"
        $env:SOLARWATCH_E2E_CONNECTION="Host=127.0.0.1;Port=$($demoConfig.POSTGRES_PORT);Database=solarwatch_demo_e2e;Username=solarwatch;Password=$($demoConfig.POSTGRES_PASSWORD)"
    }
}
