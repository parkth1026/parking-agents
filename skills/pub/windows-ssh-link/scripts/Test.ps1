#requires -Version 5.1
param([string]$Dotnet='dotnet')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
& $Dotnet run --project (Join-Path $root 'tests\SshLink.Tests\SshLink.Tests.csproj') -c Release
if($LASTEXITCODE -ne 0){throw 'C# isolated tests failed.'}
