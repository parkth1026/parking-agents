[CmdletBinding()]
param(
    [string]$CodexHome,
    [switch]$RepairRegistration
)

$ErrorActionPreference = 'Stop'

function Get-CurrentCodexHome {
    param([string]$ExplicitHome)
    $taskHome = if ($ExplicitHome) {
        $ExplicitHome
    } elseif ($env:CODEX_HOME) {
        $env:CODEX_HOME
    } else {
        Join-Path $env:USERPROFILE '.codex'
    }
    [IO.Path]::GetFullPath($taskHome)
}

function Get-AppMatchedCodexCli {
    param([string]$OfficialCli)
    $taskOfficialHash = (Get-FileHash -LiteralPath $OfficialCli -Algorithm SHA256).Hash
    $taskCandidates = @(
        Get-ChildItem -LiteralPath (Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\bin') -Filter codex.exe -File -Recurse -ErrorAction SilentlyContinue
    )
    $taskMatch = $taskCandidates | Where-Object {
        (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash -eq $taskOfficialHash
    } | Select-Object -First 1
    if ($taskMatch) { return $taskMatch.FullName }
    throw 'No executable cached Codex CLI matches the installed official app resource.'
}

function Invoke-CodexJson {
    param([string]$Cli, [string[]]$Arguments, [string]$TaskHome)
    $taskPreviousHome = $env:CODEX_HOME
    try {
        $env:CODEX_HOME = $TaskHome
        $taskOutput = & $Cli @Arguments 2>&1
        $taskExit = $LASTEXITCODE
    } finally {
        $env:CODEX_HOME = $taskPreviousHome
    }
    [pscustomobject]@{ ExitCode=$taskExit; Text=($taskOutput -join "`n") }
}

$taskHome = Get-CurrentCodexHome $CodexHome
$taskHomeItem = Get-Item -LiteralPath $taskHome -Force
$taskConfig = Join-Path $taskHome 'config.toml'
$taskConfigLines = [IO.File]::ReadAllLines($taskConfig)
$taskInMarketplace = $false
$taskMarketplaceSectionExists = $false
$taskRegisteredSource = $null
foreach ($taskLine in $taskConfigLines) {
    if ($taskLine -match '^\s*\[(.+)\]\s*$') {
        $taskInMarketplace = $Matches[1] -eq 'marketplaces.openai-bundled'
        if ($taskInMarketplace) { $taskMarketplaceSectionExists = $true }
        continue
    }
    if ($taskInMarketplace -and $taskLine -match '^\s*source\s*=\s*["'']([^"'']+)["'']\s*$') {
        $taskRegisteredSource = $Matches[1]
    }
}

$taskApp = Get-AppxPackage -Name OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1
if (!$taskApp -or $taskApp.PackageFamilyName -ne 'OpenAI.Codex_2p2nqsd0c76g0') {
    throw 'Official OpenAI.Codex Appx package not found.'
}
$taskAppExe = Join-Path $taskApp.InstallLocation 'app\ChatGPT.exe'
$taskSignature = Get-AuthenticodeSignature -LiteralPath $taskAppExe
if ($taskSignature.Status -ne 'Valid' -or $taskSignature.SignerCertificate.Subject -notmatch 'OpenAI OpCo') {
    throw 'Official application signature verification failed.'
}
$taskOfficialCli = Join-Path $taskApp.InstallLocation 'app\resources\codex.exe'
$taskCli = Get-AppMatchedCodexCli $taskOfficialCli
$taskMarketplace = [IO.Path]::GetFullPath((Join-Path $taskHome '.tmp\bundled-marketplaces\openai-bundled'))
$taskManifestPath = Join-Path $taskMarketplace '.agents\plugins\marketplace.json'
$taskManifestValid = $false
$taskBrowserManifestVersion = $null
if (Test-Path -LiteralPath $taskManifestPath) {
    $taskManifest = Get-Content -LiteralPath $taskManifestPath -Raw | ConvertFrom-Json
    $taskBrowserEntry = $taskManifest.plugins | Where-Object name -eq 'browser'
    $taskBrowserPluginRoot = if ($taskBrowserEntry) {
        [IO.Path]::GetFullPath((Join-Path $taskMarketplace $taskBrowserEntry.source.path))
    }
    if ($taskManifest.name -eq 'openai-bundled' -and $taskBrowserPluginRoot) {
        $taskBrowserPluginManifest = Get-Content -LiteralPath (Join-Path $taskBrowserPluginRoot '.codex-plugin\plugin.json') -Raw | ConvertFrom-Json
        $taskManifestValid = $taskBrowserPluginManifest.name -eq 'browser'
        $taskBrowserManifestVersion = $taskBrowserPluginManifest.version
    }
}

$taskList = Invoke-CodexJson -Cli $taskCli -Arguments @('plugin','list','--marketplace','openai-bundled','--json') -TaskHome $taskHome
$taskBrowserState = $null
if ($taskList.ExitCode -eq 0) {
    try {
        $taskParsedList = $taskList.Text | ConvertFrom-Json
        $taskBrowserState = $taskParsedList.installed | Where-Object name -eq 'browser' | Select-Object -First 1
    } catch {}
}

$taskResult = [ordered]@{
    Status = if ($taskBrowserState.installed -and $taskBrowserState.enabled) { 'PASS' } else { 'FAIL' }
    CodexHome = $taskHome
    HomeLinkType = $taskHomeItem.LinkType
    HomeTarget = $taskHomeItem.Target
    AppVersion = [string]$taskApp.Version
    Cli = $taskCli
    RegisteredSource = $taskRegisteredSource
    ExpectedMarketplace = $taskMarketplace
    MaterializedManifestValid = $taskManifestValid
    MaterializedBrowserVersion = $taskBrowserManifestVersion
    PluginListExitCode = $taskList.ExitCode
    BrowserInstalled = [bool]$taskBrowserState.installed
    BrowserEnabled = [bool]$taskBrowserState.enabled
    BrowserInstalledVersion = $taskBrowserState.version
    BrowserInstalledPath = if ($taskBrowserState.installedPath) { $taskBrowserState.installedPath } else { $taskBrowserState.source.path }
    RepairApplied = $false
    SettingsUi = 'NOT_RUN'
    BrowserRuntime = 'NOT_RUN'
}

if (!$RepairRegistration) {
    $taskResult | ConvertTo-Json -Depth 5
    if ($taskResult.Status -ne 'PASS') { exit 1 }
    exit 0
}

if ($taskHomeItem.LinkType) {
    throw 'Refusing registration repair through a reparse-point Codex Home. Select the canonical Home explicitly.'
}
if (!$taskManifestValid) {
    throw 'Refusing registration repair: current materialized Browser manifest is absent or invalid.'
}
if ($taskResult.Status -eq 'PASS' -and [IO.Path]::GetFullPath($taskBrowserState.source.path).StartsWith($taskMarketplace, [StringComparison]::OrdinalIgnoreCase)) {
    $taskResult | ConvertTo-Json -Depth 5
    exit 0
}

$taskRepairDir = Join-Path $taskHome 'repairs\fix-codex'
[IO.Directory]::CreateDirectory($taskRepairDir) | Out-Null
$taskBackup = Join-Path $taskRepairDir ('config-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.toml')
Copy-Item -LiteralPath $taskConfig -Destination $taskBackup

if ($taskMarketplaceSectionExists) {
    $taskRemove = Invoke-CodexJson -Cli $taskCli -Arguments @('plugin','marketplace','remove','openai-bundled','--json') -TaskHome $taskHome
    if ($taskRemove.ExitCode -ne 0) { throw "Marketplace removal failed: $($taskRemove.Text)" }
}
$taskAdd = Invoke-CodexJson -Cli $taskCli -Arguments @('plugin','marketplace','add',$taskMarketplace,'--json') -TaskHome $taskHome
if ($taskAdd.ExitCode -ne 0) { throw "Marketplace registration failed: $($taskAdd.Text)" }
$taskInstall = Invoke-CodexJson -Cli $taskCli -Arguments @('plugin','add','browser@openai-bundled','--json') -TaskHome $taskHome
if ($taskInstall.ExitCode -ne 0) { throw "Browser installation failed: $($taskInstall.Text)" }
$taskFinal = Invoke-CodexJson -Cli $taskCli -Arguments @('plugin','list','--marketplace','openai-bundled','--json') -TaskHome $taskHome
if ($taskFinal.ExitCode -ne 0) { throw "Final plugin listing failed: $($taskFinal.Text)" }
$taskFinalParsed = $taskFinal.Text | ConvertFrom-Json
$taskFinalBrowser = $taskFinalParsed.installed | Where-Object name -eq 'browser' | Select-Object -First 1
if (!$taskFinalBrowser.installed -or !$taskFinalBrowser.enabled) {
    throw 'Browser remains uninstalled or disabled after official CLI repair.'
}
$taskResult.Status = 'PASS'
$taskResult.RegisteredSource = $taskFinalBrowser.marketplaceSource.source
$taskResult.BrowserInstalled = $true
$taskResult.BrowserEnabled = $true
$taskResult.BrowserInstalledVersion = $taskFinalBrowser.version
$taskResult.BrowserInstalledPath = if ($taskFinalBrowser.installedPath) { $taskFinalBrowser.installedPath } else { $taskFinalBrowser.source.path }
$taskResult.RepairApplied = $true
$taskResult.ConfigBackup = $taskBackup
$taskResult | ConvertTo-Json -Depth 5
