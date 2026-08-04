<#
.SYNOPSIS
  在 Windows 上精确停止当前 AES Grilling Web 会话。

.EXPECTED BEHAVIOR
  1. 无参数执行，优先使用 AES_GRILLING_WEB_STATE_DIR，否则读取当前仓库最后会话。
  2. 同时校验 PID、随机实例 ID 和目标进程命令行，身份不匹配时拒绝终止。
  3. 只终止已验证的精确 PID，绝不按 node 进程名批量终止。
  4. 停止后清理存活元数据并写入 server-stopped 记录。
  5. 会话不存在或已经退出时可重复执行并返回明确状态。
  6. PowerShell 7 与 Windows PowerShell 5.1 均可直接执行。
#>
$ErrorActionPreference = 'Stop'; $projectRoot = [IO.Path]::GetFullPath($(if ($env:AES_GRILLING_WEB_PROJECT_DIR) { $env:AES_GRILLING_WEB_PROJECT_DIR } else { (Get-Location).Path })); $lastSession = Join-Path $projectRoot '.aes-workflow\aes-grilling-web\.last-session'; $stateDir = if ($env:AES_GRILLING_WEB_STATE_DIR) { $env:AES_GRILLING_WEB_STATE_DIR } elseif (Test-Path -LiteralPath $lastSession) { (Get-Content -LiteralPath $lastSession -Raw -Encoding UTF8).Trim() } else { $null }
if (-not $stateDir -or -not (Test-Path -LiteralPath $stateDir -PathType Container)) { '{"status":"not_running"}'; exit 0 }; $pidFile = Join-Path $stateDir 'server.pid'; $idFile = Join-Path $stateDir 'server-instance-id'
if (-not (Test-Path -LiteralPath $pidFile) -or -not (Test-Path -LiteralPath $idFile)) { '{"status":"not_running"}'; exit 0 }; $processId = 0; [void][int]::TryParse((Get-Content -LiteralPath $pidFile -Raw).Trim(), [ref]$processId); $serverId = (Get-Content -LiteralPath $idFile -Raw).Trim()
$target = if ($processId -gt 0) { Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue } else { $null }; $verified = $target -and $serverId -match '^[A-Za-z0-9_-]{32,64}$' -and $target.CommandLine -like "*--aes-grilling-web-server-id=$serverId*"
if (-not $verified) { Remove-Item -LiteralPath $pidFile, $idFile, (Join-Path $stateDir 'server-info') -Force -ErrorAction SilentlyContinue; Set-Content -LiteralPath (Join-Path $stateDir 'server-stopped') -Value ('{"reason":"stale_pid","timestamp":' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + '}') -Encoding UTF8; '{"status":"stale_pid"}'; exit 0 }
Stop-Process -Id $processId -ErrorAction SilentlyContinue; for ($attempt = 0; $attempt -lt 20 -and (Get-Process -Id $processId -ErrorAction SilentlyContinue); $attempt++) { Start-Sleep -Milliseconds 100 }; if (Get-Process -Id $processId -ErrorAction SilentlyContinue) { Stop-Process -Id $processId -Force }
Remove-Item -LiteralPath $pidFile, $idFile, (Join-Path $stateDir 'server-info') -Force -ErrorAction SilentlyContinue; Set-Content -LiteralPath (Join-Path $stateDir 'server-stopped') -Value ('{"reason":"stop-server.ps1","timestamp":' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + '}') -Encoding UTF8; '{"status":"stopped"}'
