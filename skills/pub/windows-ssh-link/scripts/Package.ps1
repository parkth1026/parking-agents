#requires -Version 5.1
param([string]$OutFile)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
if(-not (Test-Path (Join-Path $root 'bin\ssh-link.exe'))){throw 'Run scripts/Build.ps1 first.'}
if(-not $OutFile){$OutFile=Join-Path $root 'dist\windows-ssh-link.zip'}
$archive=[IO.Path]::GetFullPath($OutFile)
New-Item -ItemType Directory -Force (Split-Path -Parent $archive) | Out-Null
$stage=Join-Path $env:TEMP ('ssh-link-package-'+[Guid]::NewGuid().ToString('N'))
$dest=Join-Path $stage 'windows-ssh-link'
New-Item -ItemType Directory $dest | Out-Null
$dest=(Get-Item -LiteralPath $dest).FullName
Get-ChildItem -LiteralPath $root -Recurse -File -Force | ForEach-Object {
    $relative=$_.FullName.Substring($root.Length).TrimStart('\','/')
    if($relative -match '^(build|dist)\\' -or $relative -match '^(src|tests)\\.*\\(bin|obj)\\'){return}
    $target=Join-Path $dest $relative
    New-Item -ItemType Directory -Force (Split-Path -Parent $target) | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $target
}
$hash=Get-FileHash (Join-Path $dest 'bin\ssh-link.exe') -Algorithm SHA256
[IO.File]::WriteAllText((Join-Path $dest 'SHA256SUMS.txt'),($hash.Hash+'  bin/ssh-link.exe'+[Environment]::NewLine),(New-Object Text.UTF8Encoding($false)))
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stream=[IO.File]::Open($archive,[IO.FileMode]::Create,[IO.FileAccess]::Write,[IO.FileShare]::None)
$zip=New-Object IO.Compression.ZipArchive($stream,[IO.Compression.ZipArchiveMode]::Create,$false)
try{
    Get-ChildItem -LiteralPath $dest -Recurse -File -Force | ForEach-Object {
        $relative='windows-ssh-link/'+$_.FullName.Substring($dest.Length).TrimStart('\','/').Replace('\','/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$_.FullName,$relative,[IO.Compression.CompressionLevel]::Optimal)|Out-Null
    }
}finally{$zip.Dispose();$stream.Dispose()}
Get-Item $archive | Select-Object FullName,Length
Get-FileHash $archive -Algorithm SHA256 | Format-List
