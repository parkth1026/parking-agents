# wmi-diag.ps1 — WmiPrvSE 异常 CPU 诊断
#
# 当 WmiPrvSE.exe 持续高 CPU 时,用这个脚本一次性抓齐所有证据:
#   1. WmiPrvSE 实时 CPU%(各实例)
#   2. WMI Provider Host Quota 配置
#   3. 最近 N 分钟 WMI 调用方 Top 进程(谁在反复查 WMI)
#   4. 永久事件订阅(__EventFilter / __FilterToConsumerBinding)
#   5. 高频 NotificationQuery(轮询订阅)
#   6. 句柄数 Top 12(常驻高频调用方)
#   7. WMI 仓库健康状态(verifyrepository)
#
# 用法:
#   powershell -NoProfile -ExecutionPolicy Bypass -File wmi-diag.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File wmi-diag.ps1 -Window 10

param([int]$Window = 5)

[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$cores = [Environment]::ProcessorCount

Write-Host "==== 1. WmiPrvSE live CPU ===="
$samples = (Get-Counter "\Process(WmiPrvSE*)\% Processor Time" -ErrorAction SilentlyContinue).CounterSamples
if ($samples) {
    $samples | Sort-Object CookedValue -Descending | ForEach-Object {
        Write-Host ("  {0}: core={1}% total={2}%" -f $_.Instance, [math]::Round($_.CookedValue,1), [math]::Round($_.CookedValue/$cores,2))
    }
} else { Write-Host "  (no samples - WMI counters unavailable)" }

Write-Host ""
Write-Host "==== 2. Provider Host Quota ===="
try {
    $q = Get-CimInstance -Namespace root -ClassName __ProviderHostQuotaConfiguration -ErrorAction Stop
    Write-Host ("  ThreadsPerHost={0}  HandlesPerHost={1}  MemoryPerHost={2}MB  ProcessLimitAllHosts={3}" -f $q.ThreadsPerHost, $q.HandlesPerHost, [int]($q.MemoryPerHost/1MB), $q.ProcessLimitAllHosts)
} catch { Write-Host "  unreadable" }

Write-Host ""
Write-Host "==== 3. WmiPrvSE processes ===="
Get-CimInstance Win32_Process -Filter "Name='WmiPrvSE.exe'" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host ("  PID={0} WS={1}MB Started={2}" -f $_.ProcessId, [int]($_.WorkingSetSize/1MB), $_.CreationDate)
}

Write-Host ""
Write-Host ("==== 4. WMI callers in last {0} min ====" -f $Window)
$since = (Get-Date).AddMinutes(-$Window)
$log = Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-WMI-Activity/Operational'; StartTime=$since} -ErrorAction SilentlyContinue
if (-not $log) {
    Write-Host "  no events in window"
} else {
    Write-Host ("  events in window: {0}" -f ($log | Measure-Object).Count)
    $byClient = @{}
    $byClientError = @{}
    $byTarget = @{}
    foreach ($evt in $log) {
        $pidMatch = [regex]::Match($evt.Message, 'ClientProcessId\s*=\s*(\d+)')
        if (-not $pidMatch.Success) { continue }
        $cpid = $pidMatch.Groups[1].Value
        if (-not $byClient.ContainsKey($cpid)) { $byClient[$cpid] = 0; $byClientError[$cpid] = 0 }
        $byClient[$cpid]++
        if ($evt.Id -eq 5858) { $byClientError[$cpid]++ }
        $tMatch = [regex]::Match($evt.Message, 'Operation\s*=\s*Start[^-]+-\s*(root[^\s:]+)\s*:\s*([^\s;]+)')
        if ($tMatch.Success) {
            $key = $tMatch.Groups[1].Value.Trim() + ':' + $tMatch.Groups[2].Value.Trim()
            if (-not $byTarget.ContainsKey($key)) { $byTarget[$key] = 0 }
            $byTarget[$key]++
        }
    }
    Write-Host "  --- Top callers ---"
    $byClient.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 10 | ForEach-Object {
        $cpid = $_.Key
        $name = ''
        try {
            $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$cpid" -ErrorAction Stop
            $name = $proc.Name
            $path = $proc.ExecutablePath
        } catch { $name = "(exited)" }
        Write-Host ("  PID={0,-8} calls={1,-5} err={2,-5} {3}" -f $cpid, $_.Value, $byClientError[$cpid], $name)
        if ($path) { Write-Host ("                  Path: $path") }
    }
    if ($byTarget.Count -gt 0) {
        Write-Host "  --- Top queried targets ---"
        $byTarget.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 5 | ForEach-Object {
            Write-Host ("  {0,4}x  {1}" -f $_.Value, $_.Key)
        }
    }
}

Write-Host ""
Write-Host "==== 5. Permanent Event Subscriptions ===="
try {
    $filters = Get-CimInstance -Namespace root\subscription -ClassName __EventFilter -ErrorAction Stop
    $bindings = Get-CimInstance -Namespace root\subscription -ClassName __FilterToConsumerBinding -ErrorAction Stop
    Write-Host ("  EventFilter count: {0}   Binding count: {1}" -f ($filters | Measure-Object).Count, ($bindings | Measure-Object).Count)
    $filters | ForEach-Object { Write-Host ("    [{0}] {1}" -f $_.Name, $_.Query) }
} catch { Write-Host "  unreadable" }

Write-Host ""
Write-Host "==== 6. High-freq NotificationQuery (Id=5860, last 2h) ===="
$recent = Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-WMI-Activity/Operational'; Id=5860; StartTime=(Get-Date).AddHours(-2)} -ErrorAction SilentlyContinue
if ($recent) {
    Write-Host ("  5860 events in 2h: {0}" -f ($recent | Measure-Object).Count)
    $byQ = @{}
    foreach ($r in $recent) {
        $m = [regex]::Match($r.Message, 'NotificationQuery\s*=\s*([^;]+)')
        if ($m.Success) {
            $qq = $m.Groups[1].Value.Trim()
            if (-not $byQ.ContainsKey($qq)) { $byQ[$qq] = 0 }
            $byQ[$qq]++
        }
    }
    $byQ.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 5 | ForEach-Object {
        Write-Host ("  {0,4}x  {1}" -f $_.Value, $_.Key)
    }
} else { Write-Host "  no 5860 events" }

Write-Host ""
Write-Host "==== 7. Handle count Top 12 (常驻高频调用方线索)===="
Get-Process | Sort-Object HandleCount -Descending | Select-Object -First 12 | ForEach-Object {
    Write-Host ("  PID={0,-8} Handles={1,-6} {2}" -f $_.Id, $_.HandleCount, $_.Name)
}

Write-Host ""
Write-Host "==== 8. WMI repository health ===="
$out = & winmgmt /verifyrepository 2>&1
Write-Host ("  verifyrepository: {0}" -f $out)
