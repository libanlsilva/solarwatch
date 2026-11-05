param(
    [Parameter(Mandatory=$true)][string]$Clone,
    [Parameter(Mandatory=$true)][string]$State,
    [Parameter(Mandatory=$true)][string]$Project,
    [Parameter(Mandatory=$true)][string]$Commit,
    [int]$DatabasePort=5550,[int]$ApiPort=5281,[int]$WebPort=5283
)
$demoClone=(Resolve-Path $Clone).Path
$demoState=[IO.Path]::GetFullPath($State)
if((Test-Path "$demoClone/.env") -or (Test-Path $demoState)) { throw 'Require a new clone and new state directory; preserve existing data/configuration.' }
if($Project -notmatch '^solarwatch-demo-[a-z0-9-]+$') { throw 'Use a unique solarwatch-demo-* project name.' }
foreach($port in @($DatabasePort,$ApiPort,$WebPort)) {
    if(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) { throw "Port $port is in use." }
}
$volumes=@(docker volume ls --format '{{.Name}}')
if($LASTEXITCODE -ne 0 -or $volumes -contains "${Project}_postgres-data") { throw 'Require a working Docker engine and a new project/volume.' }
$actual=& git -c "safe.directory=$demoClone" -C $demoClone rev-parse HEAD
$status=@(& git -c "safe.directory=$demoClone" -C $demoClone status --porcelain)
if($actual -ne $Commit -or $status.Count) { throw 'Unexpected source commit or dirty clone.' }
New-Item -ItemType Directory -Force "$demoState/profile/AppData/Roaming","$demoState/profile/AppData/Local" | Out-Null
$receipt=[ordered]@{ source='https://github.com/libanlsilva/solarwatch.git'; commit=$actual; initialGitStatus=$status; absentBeforeSetup=@{}; project=$Project; databasePort=$DatabasePort; apiPort=$ApiPort; webPort=$WebPort; started=[DateTimeOffset]::UtcNow.ToString('O'); steps=@() }
foreach($item in @('.env','frontend/node_modules','frontend/dist','backend/src/SolarWatch.Api/bin','backend/src/SolarWatch.Api/obj')) {
    $receipt.absentBeforeSetup[$item]=!(Test-Path (Join-Path $demoClone $item))
}
if(@($receipt.absentBeforeSetup.Values | Where-Object { !$_ }).Count) { throw 'Generated files already present.' }
$bytes=New-Object byte[] 32
$rng=[Security.Cryptography.RandomNumberGenerator]::Create(); $rng.GetBytes($bytes); $rng.Dispose()
$password=[BitConverter]::ToString($bytes).Replace('-','').ToLowerInvariant()
[IO.File]::WriteAllText("$demoClone/.env","POSTGRES_PASSWORD=$password`nPOSTGRES_PORT=$DatabasePort`n")
[IO.File]::WriteAllText("$demoState/setup.json",($receipt|ConvertTo-Json -Depth 8))
[IO.File]::WriteAllText("$demoState/user.npmrc",''); [IO.File]::WriteAllText("$demoState/global.npmrc",'')
[IO.File]::WriteAllText("$demoState/NuGet.Config",'<configuration><packageSources><clear/><add key="nuget.org" value="https://api.nuget.org/v3/index.json"/></packageSources></configuration>')
. "$PSScriptRoot/environment.ps1" -Clone $demoClone -State $demoState -Mode Api
function Invoke-DemoStep([string]$Name,[string]$Executable,[string[]]$Arguments) {
    $timer=[Diagnostics.Stopwatch]::StartNew()
    & $Executable @Arguments *> "$demoState/$Name.log"
    $code=$LASTEXITCODE; $timer.Stop()
    $receipt.steps+=@{name=$Name;executable=$Executable;arguments=@($Arguments | ForEach-Object { $_.Replace($demoClone,'<clone>').Replace($demoState,'<state>') });exitCode=$code;seconds=[Math]::Round($timer.Elapsed.TotalSeconds,3)}
    [IO.File]::WriteAllText("$demoState/setup.json",($receipt|ConvertTo-Json -Depth 8))
    if($code -ne 0) { throw "$Name failed; inspect the private log with credentials redacted." }
    Write-Output "$Name passed."
}
Push-Location $demoClone
try {
    Invoke-DemoStep 'compose-up' 'docker' @('compose','-p',$Project,'--env-file','.env','up','-d','--wait','--wait-timeout','60','postgres')
    Invoke-DemoStep 'restore' 'dotnet' @('restore','backend/src/SolarWatch.slnx','--configfile',"$demoState/NuGet.Config")
    Invoke-DemoStep 'build' 'dotnet' @('build','backend/src/SolarWatch.slnx','--configuration','Release','--no-restore')
    Invoke-DemoStep 'migrate' 'dotnet' @('backend/src/SolarWatch.Api/bin/Release/net10.0/SolarWatch.Api.dll','migrate')
    Push-Location frontend
    try {
        Invoke-DemoStep 'npm-ci' 'npm.cmd' @('ci')
        Invoke-DemoStep 'frontend-lint' 'npm.cmd' @('run','lint')
        Invoke-DemoStep 'frontend-build' 'npm.cmd' @('run','build')
        Invoke-DemoStep 'frontend-unit' 'npm.cmd' @('run','test:unit')
        Invoke-DemoStep 'browser-install' 'npx.cmd' @('playwright','install','--no-shell','chromium')
    } finally { Pop-Location }
} finally { Pop-Location }
$receipt.profileSecretsAbsent=!(Test-Path "$env:APPDATA/Microsoft/UserSecrets")
$receipt.finalGitStatus=@(& git -c "safe.directory=$demoClone" -C $demoClone status --porcelain)
$receipt.ended=[DateTimeOffset]::UtcNow.ToString('O')
[IO.File]::WriteAllText("$demoState/setup.json",($receipt|ConvertTo-Json -Depth 8))
