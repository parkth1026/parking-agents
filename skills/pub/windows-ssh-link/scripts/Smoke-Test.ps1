#requires -Version 5.1
param([string]$Cli=(Join-Path (Split-Path -Parent $PSScriptRoot) 'bin\ssh-link.exe'))
$ErrorActionPreference='Stop'
$testRoot=Join-Path $env:TEMP ('ssh-link-binary-tests-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory $testRoot | Out-Null
$exe=Join-Path $testRoot 'ssh-link.exe'
Copy-Item -LiteralPath $Cli -Destination $exe
$script:passed=0
function Assert($ok,$message){if(-not $ok){throw $message};$script:passed++;Write-Output ('PASS '+$message)}
Assert ((& $exe --version) -eq 'ssh-link 2.0.0') 'standalone version without companion scripts'
Assert ((& $exe --help) -match 'SchemaVersion=2') 'standalone help'
$key=Join-Path $testRoot 'planned key'
$plan=& $exe connect keygen --key-path $key --no-passphrase --json | ConvertFrom-Json
Assert ($LASTEXITCODE -eq 2 -and -not $plan.Executed -and -not (Test-Path $key)) 'plan exit code and no key mutation'
$bad=& $exe accept test --json | ConvertFrom-Json
Assert ($LASTEXITCODE -eq 1 -and -not $bad.Success -and -not $bad.Executed) 'wrong role yields structured failure'
$unknown=& $exe connect check --bad-option --json | ConvertFrom-Json
Assert ($LASTEXITCODE -eq 1 -and $unknown.SchemaVersion -eq 2) 'unknown option yields stable JSON failure'
$report=Join-Path $testRoot '中文 report with spaces.json'
$reported=& $exe connect keygen --key-path $key --no-passphrase --report-file $report --json | ConvertFrom-Json
Assert ($LASTEXITCODE -eq 2 -and (Test-Path $report) -and -not $reported.Executed) 'Unicode report path through native CLI'
$before=[IO.File]::ReadAllBytes($report)
$existing=& $exe connect keygen --key-path $key --no-passphrase --report-file $report --json | ConvertFrom-Json
Assert ($LASTEXITCODE -eq 1 -and [Convert]::ToBase64String([IO.File]::ReadAllBytes($report)) -eq [Convert]::ToBase64String($before)) 'existing report cannot be overwritten'
Assert (@(Get-ChildItem -LiteralPath $testRoot -Filter '*.ps1').Count -eq 0) 'EXE runs alone with no PS1 runtime dependency'
Write-Output "ALL PASS: $script:passed binary assertions. Files: $testRoot"
