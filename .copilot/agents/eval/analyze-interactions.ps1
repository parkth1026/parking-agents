# DEPRECATED: This script has been replaced by the Node.js version (.js). Use the .js version instead.
# analyze-interactions.ps1
# Full-precision JSONL analysis of all VS Code Copilot debug-logs
# Uses StreamReader for memory efficiency on ~2GB data

$ErrorActionPreference = 'Continue'
$startTime = Get-Date

# ── Config ──────────────────────────────────────────────────────────
$basePath   = "C:\Users\Administrator\AppData\Roaming\Code\User\workspaceStorage"
$outFile    = "D:\GIT\parking-agents\interaction-analysis.json"
$maxLineLen = 8000000  # skip lines > 8MB to avoid OOM
$fileTimeout = 60      # seconds per file

# ── Resolve workspace mapping ──────────────────────────────────────
$wsMap = @{}
Get-ChildItem "$basePath\*\workspace.json" -EA SilentlyContinue | ForEach-Object {
    $wsId = $_.Directory.Name
    try {
        $ws = Get-Content $_.FullName -Raw | ConvertFrom-Json
        $folder = $ws.folder -replace '^file:///','/' -replace '%3A',':'
        $name = ($folder -split '/')[-1]
        $wsMap[$wsId] = $name
    } catch {
        $wsMap[$wsId] = $wsId.Substring(0,8)
    }
}

# ── Collect all JSONL files ────────────────────────────────────────
$logDirs = Get-ChildItem "$basePath\*\GitHub.copilot-chat\debug-logs" -Directory -EA SilentlyContinue
$allFiles = @()
foreach ($logDir in $logDirs) {
    $sessions = Get-ChildItem $logDir.FullName -Directory -EA SilentlyContinue
    foreach ($sess in $sessions) {
        $jsonlFiles = Get-ChildItem "$($sess.FullName)\*.jsonl" -File -EA SilentlyContinue
        foreach ($jf in $jsonlFiles) {
            $wsId = ($jf.FullName -split '\\')[8]
            $allFiles += [PSCustomObject]@{
                Path        = $jf.FullName
                Name        = $jf.Name
                SizeKB      = [math]::Round($jf.Length / 1KB, 1)
                SessionId   = $sess.Name
                WorkspaceId = $wsId
                Workspace   = if ($wsMap[$wsId]) { $wsMap[$wsId] } else { $wsId.Substring(0,8) }
                Type        = if ($jf.Name -eq 'main.jsonl') { 'main' }
                             elseif ($jf.Name -match '^runSubagent-') { 'subagent' }
                             elseif ($jf.Name -match '^title-') { 'title' }
                             else { 'other' }
            }
        }
    }
}

$totalSizeMB = [math]::Round(($allFiles | Measure-Object -Property SizeKB -Sum).Sum / 1KB, 1)
$mainFiles     = $allFiles | Where-Object { $_.Type -eq 'main' }
$subagentFiles = $allFiles | Where-Object { $_.Type -eq 'subagent' }
$titleFiles    = $allFiles | Where-Object { $_.Type -eq 'title' }

Write-Host "Files: $($allFiles.Count) (main=$($mainFiles.Count), subagent=$($subagentFiles.Count), title=$($titleFiles.Count)) Total=$($totalSizeMB)MB"

# ── Data containers ────────────────────────────────────────────────
$userMessages       = [System.Collections.ArrayList]::new()
$askQInteractions   = [System.Collections.ArrayList]::new()
$subagentInvocations = [System.Collections.ArrayList]::new()
$childSessionRefs   = @{}   # sessionId -> list of {agentName, childSessionId, childLogFile}
$skippedFiles       = [System.Collections.ArrayList]::new()
$parseErrors        = 0

# ── Helper: safe JSON parse ────────────────────────────────────────
function Parse-JsonLine {
    param([string]$Line)
    if ($Line.Length -gt $maxLineLen) { return $null }
    try { return ($Line | ConvertFrom-Json) }
    catch { $script:parseErrors++; return $null }
}

# ── PHASE 1: Process main.jsonl files ──────────────────────────────
Write-Host "`n=== Phase 1: Processing $($mainFiles.Count) main.jsonl files ==="
$umIndex  = 0
$aqIndex  = 0

foreach ($mf in $mainFiles) {
    $fileStart = Get-Date
    Write-Host "  main: $($mf.Workspace)/$($mf.SessionId) ($($mf.SizeKB)KB)"

    $sr = $null
    try {
        $sr = [System.IO.StreamReader]::new($mf.Path, [System.Text.Encoding]::UTF8)
        while (($line = $sr.ReadLine()) -ne $null) {
            # Timeout check every line is too slow; check length-based proxy
            if (((Get-Date) - $fileStart).TotalSeconds -gt $fileTimeout) {
                Write-Host "    TIMEOUT after ${fileTimeout}s, skipping rest"
                [void]$skippedFiles.Add($mf.Path)
                break
            }

            $evt = Parse-JsonLine $line
            if (-not $evt) { continue }

            switch ($evt.type) {
                'user_message' {
                    $umIndex++
                    $content = ''
                    if ($evt.attrs -and $evt.attrs.content) { $content = $evt.attrs.content }

                    $isTerminal = $content -match '^\[Terminal [0-9a-f\-]+ notification:'
                    $isTryAgain = $content -match '^Try Again$'

                    [void]$userMessages.Add([PSCustomObject]@{
                        index                = $umIndex
                        sessionId            = $mf.SessionId
                        workspacePath        = $mf.Workspace
                        timestamp            = $evt.ts
                        content              = $content
                        contentLength        = $content.Length
                        isTerminalNotification = [bool]$isTerminal
                        isTryAgain           = [bool]$isTryAgain
                    })
                }

                'tool_call' {
                    if ($evt.name -eq 'vscode_askQuestions' -or ($evt.name -and $evt.name -match 'askQuestions')) {
                        $aqIndex++
                        $questions = @()
                        $responses = @()
                        $hasFreeText = $false
                        $hasSelection = $false

                        # Parse args (questions array)
                        if ($evt.attrs.args) {
                            try {
                                $argsObj = if ($evt.attrs.args -is [string]) {
                                    $evt.attrs.args | ConvertFrom-Json
                                } else { $evt.attrs.args }
                                if ($argsObj.questions) {
                                    foreach ($q in $argsObj.questions) {
                                        $opts = @()
                                        if ($q.options) {
                                            foreach ($o in $q.options) {
                                                $opts += [PSCustomObject]@{
                                                    label       = $o.label
                                                    description = $o.description
                                                }
                                            }
                                        }
                                        $questions += [PSCustomObject]@{
                                            header   = $q.header
                                            question = $q.question
                                            options  = $opts
                                        }
                                    }
                                }
                            } catch {}
                        }

                        # Parse result (user responses)
                        if ($evt.attrs.result) {
                            try {
                                $resObj = if ($evt.attrs.result -is [string]) {
                                    $evt.attrs.result | ConvertFrom-Json
                                } else { $evt.attrs.result }
                                if ($resObj.answers) {
                                    foreach ($prop in $resObj.answers.PSObject.Properties) {
                                        $ans = $prop.Value
                                        $sel = @()
                                        if ($ans.selected) { $sel = @($ans.selected); $hasSelection = $true }
                                        $ft = $null
                                        if ($ans.freeText) { $ft = "$($ans.freeText)"; $hasFreeText = $true }
                                        $responses += [PSCustomObject]@{
                                            header   = $prop.Name
                                            selected = $sel
                                            freeText = $ft
                                            skipped  = [bool]$ans.skipped
                                        }
                                    }
                                }
                            } catch {}
                        }

                        [void]$askQInteractions.Add([PSCustomObject]@{
                            index        = $aqIndex
                            sessionId    = $mf.SessionId
                            workspacePath = $mf.Workspace
                            timestamp    = $evt.ts
                            questions    = $questions
                            responses    = $responses
                            hasFreeText  = $hasFreeText
                            hasSelection = $hasSelection
                        })
                    }
                }

                'child_session_ref' {
                    if ($evt.attrs) {
                        $label = $evt.attrs.label
                        $childSid = $evt.attrs.childSessionId
                        $childLog = $evt.attrs.childLogFile
                        if (-not $childSessionRefs[$mf.SessionId]) {
                            $childSessionRefs[$mf.SessionId] = [System.Collections.ArrayList]::new()
                        }
                        [void]$childSessionRefs[$mf.SessionId].Add([PSCustomObject]@{
                            agentName      = $label
                            childSessionId = $childSid
                            childLogFile   = $childLog
                            timestamp      = $evt.ts
                        })
                    }
                }
            }
        }
    } catch {
        Write-Host "    ERROR: $($_.Exception.Message)"
        [void]$skippedFiles.Add($mf.Path)
    } finally {
        if ($sr) { $sr.Close() }
    }
}

Write-Host "  Found: $umIndex user_messages, $aqIndex askQ interactions, $($childSessionRefs.Values | ForEach-Object { $_.Count } | Measure-Object -Sum | Select -ExpandProperty Sum) child_session_refs"

# ── PHASE 2: Process subagent JSONL files ─────────────────────────
Write-Host "`n=== Phase 2: Processing $($subagentFiles.Count) subagent files ==="
$saIndex = 0
$processed = 0

foreach ($sf in $subagentFiles) {
    $processed++
    if ($processed % 100 -eq 0) { Write-Host "  Progress: $processed / $($subagentFiles.Count)" }

    $fileStart = Get-Date
    $saIndex++

    $promptLen    = 0
    $promptPreview = ''
    $outputLen    = 0
    $toolCalls    = @{}
    $toolCallCount = 0
    $agentName    = ''
    $parentSid    = ''

    # Extract agent name from filename: runSubagent-<Name>-<uuid>.jsonl
    if ($sf.Name -match '^runSubagent-(.+)-[0-9a-f]{8}-') {
        $agentName = $matches[1]
    }

    $sr = $null
    try {
        $sr = [System.IO.StreamReader]::new($sf.Path, [System.Text.Encoding]::UTF8)
        while (($line = $sr.ReadLine()) -ne $null) {
            if (((Get-Date) - $fileStart).TotalSeconds -gt $fileTimeout) {
                Write-Host "    TIMEOUT on $($sf.Name)"
                [void]$skippedFiles.Add($sf.Path)
                break
            }

            # Lightweight pre-filter: only parse lines containing key event types
            if ($line.Length -gt $maxLineLen) { continue }

            # For very large files, only parse lines that contain relevant keywords
            if ($line -notmatch '"type"\s*:\s*"(session_start|user_message|tool_call|agent_response)"') { continue }

            $evt = Parse-JsonLine $line
            if (-not $evt) { continue }

            switch ($evt.type) {
                'session_start' {
                    if ($evt.attrs.parentSessionId) { $parentSid = $evt.attrs.parentSessionId }
                    if ($evt.attrs.label -and -not $agentName) { $agentName = $evt.attrs.label }
                }
                'user_message' {
                    if ($evt.attrs -and $evt.attrs.content) {
                        $promptLen = $evt.attrs.content.Length
                        $promptPreview = $evt.attrs.content.Substring(0, [Math]::Min(200, $evt.attrs.content.Length))
                    }
                }
                'tool_call' {
                    $toolCallCount++
                    $tn = $evt.name
                    if ($tn) {
                        if ($toolCalls[$tn]) { $toolCalls[$tn]++ } else { $toolCalls[$tn] = 1 }
                    }
                }
                'agent_response' {
                    if ($evt.attrs -and $evt.attrs.response) {
                        $outputLen = "$($evt.attrs.response)".Length
                    }
                }
            }
        }
    } catch {
        [void]$skippedFiles.Add($sf.Path)
    } finally {
        if ($sr) { $sr.Close() }
    }

    [void]$subagentInvocations.Add([PSCustomObject]@{
        index         = $saIndex
        sessionId     = $sf.SessionId
        agentName     = $agentName
        promptLength  = $promptLen
        promptPreview = $promptPreview
        outputLength  = $outputLen
        toolCallCount = $toolCallCount
        toolNames     = @($toolCalls.Keys | Sort-Object)
        logSizeKB     = $sf.SizeKB
        workspacePath = $sf.Workspace
    })
}

Write-Host "  Processed $processed subagent files"

# ── PHASE 3: Compute summary ──────────────────────────────────────
Write-Host "`n=== Phase 3: Computing summary ==="

$realInputs = $userMessages | Where-Object { -not $_.isTerminalNotification -and -not $_.isTryAgain }
$termNotifs = $userMessages | Where-Object { $_.isTerminalNotification }
$tryAgains  = $userMessages | Where-Object { $_.isTryAgain }
$aqFreeText = $askQInteractions | Where-Object { $_.hasFreeText }
$aqSelection = $askQInteractions | Where-Object { $_.hasSelection }

# By workspace
$byWorkspace = @{}
foreach ($ws in ($userMessages.workspacePath + $askQInteractions.workspacePath + $subagentInvocations.workspacePath | Sort-Object -Unique)) {
    $byWorkspace[$ws] = [PSCustomObject]@{
        userMessages = ($userMessages | Where-Object { $_.workspacePath -eq $ws }).Count
        realInputs   = ($realInputs | Where-Object { $_.workspacePath -eq $ws }).Count
        termNotifs   = ($termNotifs | Where-Object { $_.workspacePath -eq $ws }).Count
        tryAgains    = ($tryAgains | Where-Object { $_.workspacePath -eq $ws }).Count
        askQ         = ($askQInteractions | Where-Object { $_.workspacePath -eq $ws }).Count
        subagents    = ($subagentInvocations | Where-Object { $_.workspacePath -eq $ws }).Count
    }
}

# By session
$bySession = @{}
foreach ($sid in ($userMessages.sessionId + $askQInteractions.sessionId + $subagentInvocations.sessionId | Sort-Object -Unique)) {
    $wsName = ''
    $um = $userMessages | Where-Object { $_.sessionId -eq $sid } | Select-Object -First 1
    if ($um) { $wsName = $um.workspacePath }
    $bySession[$sid] = [PSCustomObject]@{
        workspace    = $wsName
        userMessages = ($userMessages | Where-Object { $_.sessionId -eq $sid }).Count
        realInputs   = ($realInputs | Where-Object { $_.sessionId -eq $sid }).Count
        askQ         = ($askQInteractions | Where-Object { $_.sessionId -eq $sid }).Count
        subagents    = ($subagentInvocations | Where-Object { $_.sessionId -eq $sid }).Count
    }
}

$summary = [PSCustomObject]@{
    totalUserMessages     = $userMessages.Count
    realUserInputs        = $realInputs.Count
    terminalNotifications = $termNotifs.Count
    tryAgainCount         = $tryAgains.Count
    totalAskQuestions     = $askQInteractions.Count
    askQWithFreeText      = $aqFreeText.Count
    askQWithSelection     = $aqSelection.Count
    totalSubagentCalls    = $subagentInvocations.Count
    totalInteractions     = $realInputs.Count + $askQInteractions.Count
    parseErrors           = $parseErrors
    skippedFiles          = $skippedFiles.Count
    byWorkspace           = $byWorkspace
    bySession             = $bySession
}

# ── Build output ───────────────────────────────────────────────────
$output = [PSCustomObject]@{
    meta = [PSCustomObject]@{
        totalFiles     = $allFiles.Count
        totalSizeMB    = $totalSizeMB
        scanDate       = (Get-Date -Format 'yyyy-MM-dd')
        sessions       = $mainFiles.Count
        mainFiles      = $mainFiles.Count
        subagentFiles  = $subagentFiles.Count
        titleFiles     = $titleFiles.Count
        processingTime = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)
    }
    userMessages          = $userMessages
    askQuestionsInteractions = $askQInteractions
    subagentInvocations   = $subagentInvocations
    summary               = $summary
}

# ── Write JSON ─────────────────────────────────────────────────────
Write-Host "`n=== Writing output to $outFile ==="
$json = $output | ConvertTo-Json -Depth 10 -Compress:$false
[System.IO.File]::WriteAllText($outFile, $json, [System.Text.Encoding]::UTF8)
$outSize = [math]::Round((Get-Item $outFile).Length / 1KB, 1)
Write-Host "Output: $outFile ($($outSize)KB)"

# ── Print summary ─────────────────────────────────────────────────
Write-Host "`n========== SUMMARY =========="
Write-Host "Processing time: $([math]::Round(((Get-Date) - $startTime).TotalSeconds, 1))s"
Write-Host "Total user messages: $($summary.totalUserMessages)"
Write-Host "  Real user inputs:  $($summary.realUserInputs)"
Write-Host "  Terminal notifs:   $($summary.terminalNotifications)"
Write-Host "  Try Again:         $($summary.tryAgainCount)"
Write-Host "Total askQuestions:  $($summary.totalAskQuestions)"
Write-Host "  With free text:    $($summary.askQWithFreeText)"
Write-Host "  With selection:    $($summary.askQWithSelection)"
Write-Host "Total subagents:    $($summary.totalSubagentCalls)"
Write-Host "Total interactions: $($summary.totalInteractions)"
Write-Host "Parse errors:       $($summary.parseErrors)"
Write-Host "Skipped files:      $($summary.skippedFiles)"
Write-Host ""
Write-Host "--- By Workspace ---"
foreach ($ws in $byWorkspace.Keys | Sort-Object) {
    $w = $byWorkspace[$ws]
    Write-Host "  ${ws}: msgs=$($w.userMessages) real=$($w.realInputs) term=$($w.termNotifs) try=$($w.tryAgains) askQ=$($w.askQ) sub=$($w.subagents)"
}
Write-Host ""
Write-Host "--- By Session ---"
foreach ($sid in $bySession.Keys | Sort-Object) {
    $s = $bySession[$sid]
    Write-Host "  $($sid.Substring(0,8))... [$($s.workspace)]: msgs=$($s.userMessages) real=$($s.realInputs) askQ=$($s.askQ) sub=$($s.subagents)"
}
Write-Host "`n========== DONE =========="
