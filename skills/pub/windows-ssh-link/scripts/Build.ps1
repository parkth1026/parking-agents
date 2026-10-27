#requires -Version 5.1
[CmdletBinding()]
param([string]$Dotnet='dotnet',[ValidateSet('win-x64','win-arm64')][string]$Runtime='win-x64')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$output=Join-Path $root ('build\'+$Runtime)
& $Dotnet publish (Join-Path $root 'src\SshLink\SshLink.csproj') -c Release -r $Runtime --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -o $output
if($LASTEXITCODE -ne 0){throw 'C# publish failed. Requires .NET 10 SDK.'}
$bin=Join-Path $root 'bin'
New-Item -ItemType Directory -Force $bin | Out-Null
Copy-Item -LiteralPath (Join-Path $output 'ssh-link.exe') -Destination (Join-Path $bin 'ssh-link.exe') -Force
$assets=Get-Content -Raw (Join-Path $root 'src\SshLink\obj\project.assets.json') | ConvertFrom-Json
$runtimePackage=$assets.project.frameworks.PSObject.Properties.Value.downloadDependencies | Where-Object name -eq ('Microsoft.NETCore.App.Runtime.'+$Runtime) | Select-Object -First 1
if(-not $runtimePackage){throw 'Cannot locate runtime package license.'}
$packagePath=$null
foreach($folder in $assets.packageFolders.PSObject.Properties.Name){
    $version=$runtimePackage.version.Trim('[',']').Split(',')[0].Trim()
    $candidate=Join-Path $folder ($runtimePackage.name.ToLowerInvariant()+'/'+$version)
    if(Test-Path (Join-Path $candidate 'LICENSE.TXT')){$packagePath=$candidate;break}
}
if(-not $packagePath){throw 'Runtime license files not found.'}
$licenseDir=Join-Path $root 'licenses\dotnet'
New-Item -ItemType Directory -Force $licenseDir | Out-Null
Copy-Item -LiteralPath (Join-Path $packagePath 'LICENSE.TXT'),(Join-Path $packagePath 'THIRD-PARTY-NOTICES.TXT') -Destination $licenseDir -Force
[IO.File]::WriteAllText((Join-Path $licenseDir 'version.txt'),($runtimePackage.name+'/'+$version+[Environment]::NewLine),(New-Object Text.UTF8Encoding($false)))
Get-Item (Join-Path $bin 'ssh-link.exe') | Select-Object FullName,Length
Get-FileHash (Join-Path $bin 'ssh-link.exe') -Algorithm SHA256 | Format-List
