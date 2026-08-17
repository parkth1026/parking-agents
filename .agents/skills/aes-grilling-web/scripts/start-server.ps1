<#
.SYNOPSIS
  在 Windows 上启动技能自带的 AES Grilling Web 服务并输出连接 JSON。

.EXPECTED BEHAVIOR
  1. 不依赖 Bash 或 Superpowers，只调用同目录的 server.cjs 和系统 Node.js。
  2. 默认在当前仓库的 .aes-workflow/aes-grilling-web 下创建隔离会话。
  3. 只启动一个隐藏的精确 Node 进程，并记录 PID 与随机实例 ID。
  4. 在十秒内输出包含 url、screen_dir 和 state_dir 的 server-started JSON。
  5. 启动失败时只终止本次记录的 PID，并返回非零错误。
  6. PowerShell 7 与 Windows PowerShell 5.1 均可直接无参数执行。
#>
$ErrorActionPreference = 'Stop'; $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path; $projectRoot = [IO.Path]::GetFullPath($(if ($env:AES_GRILLING_WEB_PROJECT_DIR) { $env:AES_GRILLING_WEB_PROJECT_DIR } else { (Get-Location).Path }))
$sessionParent = Join-Path $projectRoot '.aes-workflow\aes-grilling-web'; $sessionRoot = Join-Path $sessionParent ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N')); $stateDir = Join-Path $sessionRoot 'state'; New-Item -ItemType Directory -Force -Path (Join-Path $sessionRoot 'content'), $stateDir | Out-Null
$serverId = -join (1..48 | ForEach-Object { '0123456789abcdef'[(Get-Random -Maximum 16)] }); Set-Content -LiteralPath (Join-Path $stateDir 'server-instance-id') -Value $serverId -Encoding Ascii; Set-Content -LiteralPath (Join-Path $sessionParent '.last-session') -Value $stateDir -Encoding UTF8
$settings = @{ AES_GRILLING_WEB_DIR = $sessionRoot; AES_GRILLING_WEB_HOST = '127.0.0.1'; AES_GRILLING_WEB_URL_HOST = 'localhost'; AES_GRILLING_WEB_OWNER_PID = ''; AES_GRILLING_WEB_PORT_FILE = (Join-Path $sessionParent '.last-port'); AES_GRILLING_WEB_TOKEN_FILE = (Join-Path $sessionParent '.last-token') }; $prior = @{}; foreach ($name in $settings.Keys) { $prior[$name] = [Environment]::GetEnvironmentVariable($name, 'Process'); [Environment]::SetEnvironmentVariable($name, $settings[$name], 'Process') }
try { $node = (Get-Command node.exe -ErrorAction Stop).Source; $server = Join-Path $scriptRoot 'server.cjs'; $process = Start-Process -FilePath $node -ArgumentList @("`"$server`"", "--aes-grilling-web-server-id=$serverId") -WorkingDirectory $scriptRoot -WindowStyle Hidden -PassThru } finally { foreach ($name in $settings.Keys) { [Environment]::SetEnvironmentVariable($name, $prior[$name], 'Process') } }
Set-Content -LiteralPath (Join-Path $stateDir 'server.pid') -Value $process.Id -Encoding Ascii; $infoPath = Join-Path $stateDir 'server-info'; $info = $null; for ($attempt = 0; $attempt -lt 100 -and -not $process.HasExited -and -not $info; $attempt++) { if (Test-Path -LiteralPath $infoPath) { try { $candidate = Get-Content -LiteralPath $infoPath -Raw -Encoding UTF8; if (($candidate | ConvertFrom-Json).type -eq 'server-started') { $info = $candidate } } catch {} }; if (-not $info) { Start-Sleep -Milliseconds 100 } }
if (-not $info) { if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }; throw 'AES Grilling Web failed to start within ten seconds.' }
$info
