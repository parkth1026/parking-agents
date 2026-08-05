# Log Strategy

## Smart Log Trimming

Never download full logs blindly — UE5 build logs can be 50MB+.

All commands use PowerShell syntax (compatible with both bash and PowerShell environments).

### FAILURE builds

1. **Download full log** with timeout:
   ```powershell
   curl.exe -s "{baseUrl}/job/{path}/{build}/consoleText" --globoff --max-time 120 -o "{outputDir}/logs/fail-{jobName}-{build}.log"
   ```
2. **If file > 500KB**: re-download using PowerShell filter:
   ```powershell
   $log = curl.exe -s "{baseUrl}/job/{path}/{build}/consoleText" --globoff --max-time 120
   $log -split "`n" | Where-Object { $_ -match 'error|fatal|warning|LNK|ExitCode|FAILED' } | Set-Content "{outputDir}/logs/fail-{jobName}-{build}.log" -Encoding UTF8
   ```
3. **Extract error lines**: from the log, find all lines matching `error C\d+:`, `error CS\d+:`, `fatal error`, `LNK\d+:`, `ExitCode=`

### SUCCESS builds (fix verification)

Only need to confirm errors are gone. Do NOT download the full log.

```powershell
$log = curl.exe -s "{baseUrl}/job/{path}/{build}/consoleText" --globoff --max-time 120
$errorLines = $log -split "`n" | Where-Object { $_ -match 'error C\d+:|error CS\d+:|fatal error|LNK\d+:' }
```

If `$errorLines` count is 0 → fix confirmed. If errors still present → investigate.

### WARNING tracking for SUCCESS builds

```powershell
$log = curl.exe -s "{baseUrl}/job/{path}/{build}/consoleText" --globoff --max-time 60
$warningCount = ($log -split "`n" | Where-Object { $_ -match 'warning C\d+:|warning CS\d+:' }).Count
```

This counts only compiler warnings (C/CS prefixed), avoiding false matches from git log text containing the word "warning".
