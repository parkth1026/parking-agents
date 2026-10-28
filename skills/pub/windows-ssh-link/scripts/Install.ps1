#requires -Version 5.1
[CmdletBinding()]
param([string]$Destination,[switch]$Update)
$ErrorActionPreference='Stop'
$source=Split-Path -Parent $PSScriptRoot
if(-not $Destination){
    $base=Join-Path $env:USERPROFILE '.agents'
    $Destination=Join-Path $base 'skills\windows-ssh-link'
}
$dest=[IO.Path]::GetFullPath($Destination)
if($source -ieq $dest){Write-Output 'Skill is already in the requested location.';exit 0}
if($dest.StartsWith($source+'\',[StringComparison]::OrdinalIgnoreCase) -or $source.StartsWith($dest+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Source and destination must not be nested.'}
if(Test-Path -LiteralPath $dest){
    if(-not $Update){throw 'Destination exists. Use -Update to preserve it in a dated backup before installing.'}
    if((Get-Item -LiteralPath $dest -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Refusing to move a linked destination.'}
    # Keep backups outside skills/ so discovery does not find duplicate names.
    $backupRoot=Join-Path (Split-Path -Parent (Split-Path -Parent $dest)) 'skill-backups'
    New-Item -ItemType Directory -Force $backupRoot | Out-Null
    $backup=Join-Path $backupRoot ((Split-Path -Leaf $dest)+'-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[Guid]::NewGuid().ToString('N'))
    Move-Item -LiteralPath $dest -Destination $backup
    Write-Output ('Previous skill preserved: '+$backup)
}
New-Item -ItemType Directory $dest | Out-Null
Get-ChildItem -LiteralPath $source -Recurse -File -Force | ForEach-Object {
    $relative=$_.FullName.Substring($source.Length).TrimStart('\','/')
    if($relative -match '^(build|dist)\\' -or $relative -match '^(src|tests)\\.*\\(bin|obj)\\'){return}
    $target=Join-Path $dest $relative
    New-Item -ItemType Directory -Force (Split-Path -Parent $target) | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $target
}
Write-Output ('Installed full skill, C# sources and CLI: '+$dest)
Write-Output 'Use $windows-ssh-link in a new Codex session; bin/ssh-link.exe is immediately available.'
