# opencodex link check — copy to any client machine, run, read the verdicts.
# One command per hop. Each step prints [PASS]/[FAIL] with the key facts, and the
# script exits non-zero if any hop failed (so it works in CI / chained commands).
# Assumes the proxy has disableRemoteAuth enabled (no key needed).
#
# Usage:
#   .\scripts\test-connection.ps1                     # uses the defaults below
#   .\scripts\test-connection.ps1 -IP 10.66.8.220 -Port 10200
#   .\scripts\test-connection.ps1 -RawJson            # dump full response bodies
[CmdletBinding()]
param(
  [string]$IP   = "10.66.8.220",   # <- edit default, or pass -IP at runtime
  [string]$Port = "10200",         # <- edit if your proxy uses a different port
  [switch]$RawJson                 # dump full response bodies for debugging
)
$ErrorActionPreference = "Stop"

$Base = "http://${IP}:${Port}"
$Summary = @()

# Normalize a caught exception into a short, human-readable message (strip the
# long "Invoke-RestMethod:" prefix; surface the HTTP status code when present).
function Format-Error([object]$Err) {
  $resp = $Err.Exception.Response
  if ($resp) {
    $code = [int]$resp.StatusCode
    $reason = $resp.StatusCode
    return "HTTP $code ($reason)"
  }
  $msg = "$($Err.Exception.Message)"
  # PowerShell wraps these as "Invoke-RestMethod: <real message>".
  $idx = $msg.IndexOf(":")
  if ($idx -ge 0 -and $msg.Substring(0, $idx) -match "Invoke-RestMethod") {
    $msg = $msg.Substring($idx + 1).Trim()
  }
  return $msg
}

function Show-Pass([string]$Label, [string]$Detail, [object]$Body) {
  Write-Host "[PASS] " -ForegroundColor Green -NoNewline
  Write-Host "$Label" -NoNewline
  if ($Detail) { Write-Host "  $Detail" -ForegroundColor DarkGray }
  else { Write-Host "" }
  if ($RawJson -and $Body) {
    $Body | ConvertTo-Json -Depth 6 | Write-Host -ForegroundColor DarkGray
  }
}

function Show-Fail([string]$Label, [string]$Reason) {
  Write-Host "[FAIL] " -ForegroundColor Red -NoNewline
  Write-Host "$Label" -NoNewline
  Write-Host "  $Reason" -ForegroundColor Red
}

# --- 1. TCP + process (healthz) -------------------------------------------------
Write-Host "=== 1. healthz (liveness) ===" -ForegroundColor Cyan
$ok1 = $true
try {
  $h = Invoke-RestMethod -Uri "$Base/healthz" -TimeoutSec 10
  if ($h.status -eq "ok") {
    $uptime = if ($null -ne $h.uptime) { [math]::Round([double]$h.uptime, 0) } else { "?" }
    Show-Pass "healthz" "opencodex v$($h.version)  uptime ${uptime}s  pid $($h.pid)" $h
  } else {
    $ok1 = $false
    Show-Fail "healthz" "status was '$($h.status)', expected 'ok'"
  }
} catch {
  $ok1 = $false
  Show-Fail "healthz" (Format-Error $_)
}
$Summary += [pscustomobject]@{ Step = "1. healthz";  Pass = $ok1 }

# --- 2. model list (/v1/models) -------------------------------------------------
Write-Host "`n=== 2. models (/v1/models) ===" -ForegroundColor Cyan
$ok2 = $true
try {
  $m = Invoke-RestMethod -Uri "$Base/v1/models" -TimeoutSec 10
  $list = @($m.data)
  if ($list.Count -gt 0) {
    $ids = ($list | Select-Object -First 5 | ForEach-Object { $_.id }) -join ", "
    Show-Pass "models" "$($list.Count) available$([string]::IsNullOrEmpty($ids) ? '' : ': ' + $ids)" $m
  } else {
    $ok2 = $false
    Show-Fail "models" "model list empty"
  }
} catch {
  $ok2 = $false
  Show-Fail "models" (Format-Error $_)
}
$Summary += [pscustomobject]@{ Step = "2. models";  Pass = $ok2 }

# --- 3. AI round-trip (/v1/chat/completions) ------------------------------------
Write-Host "`n=== 3. chat round-trip (/v1/chat/completions, zai/glm-5.2) ===" -ForegroundColor Cyan
$ok3 = $true
try {
  $body = '{"model":"zai/glm-5.2","messages":[{"role":"user","content":"Say OK"}],"max_tokens":64,"stream":false}'
  $c = Invoke-RestMethod -Uri "$Base/v1/chat/completions" -Method POST `
    -Headers @{ "Content-Type" = "application/json" } `
    -Body $body -TimeoutSec 30
  $text = $c.choices[0].message.content
  if ($text) {
    Show-Pass "chat" "reply: $text" $c
  } else {
    $ok3 = $false
    Show-Fail "chat" "empty reply"
  }
} catch {
  $ok3 = $false
  Show-Fail "chat" (Format-Error $_)
}
$Summary += [pscustomobject]@{ Step = "3. chat";   Pass = $ok3 }

# --- summary --------------------------------------------------------------------
Write-Host ""
Write-Host "=== Summary ($IP`:$Port) ===" -ForegroundColor Cyan
$failed = 0
foreach ($s in $Summary) {
  if ($s.Pass) {
    Write-Host ("  {0,-16} [PASS]" -f $s.Step) -ForegroundColor Green
  } else {
    Write-Host ("  {0,-16} [FAIL]" -f $s.Step) -ForegroundColor Red
    $failed++
  }
}

if ($failed -gt 0) {
  Write-Host "`n$failed hop(s) failed." -ForegroundColor Red
  exit 1
}
Write-Host "`nAll hops passed." -ForegroundColor Green
exit 0
