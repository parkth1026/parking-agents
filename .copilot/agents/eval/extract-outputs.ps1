#Requires -Version 5.1
<#
.SYNOPSIS
    从 VS Code Copilot Chat debug-logs 提取 subagent 调用的结构化数据。

.DESCRIPTION
    扫描所有 workspace 的 debug-logs，解析 JSONL 事件流，
    提取每次 subagent 调用的 prompt、output、工具统计、行为标记。
    输出结构化 JSON 供 run-eval.ps1 消费。

.EXAMPLE
    # 提取所有数据
    .\extract-outputs.ps1

    # 只看 Worker
    .\extract-outputs.ps1 -AgentFilter "Worker"

    # 导出到文件
    .\extract-outputs.ps1 -OutputPath .\eval-data.json

    # 含主控调度记录
    .\extract-outputs.ps1 -IncludeMainLog
#>
param(
    [string]$WorkspacePath,     # 可选，限定特定 workspace（路径或 hash 前缀）
    [string]$SessionId,         # 可选，限定特定 session ID
    [string]$AgentFilter,       # 可选，按 agent 名过滤（支持通配符）
    [string]$OutputPath,        # 可选，输出 JSON 文件路径（默认输出到 stdout）
    [int]$MaxFiles = 500,       # 最大处理文件数
    [switch]$IncludeMainLog     # 是否也解析 main.jsonl（提取主控调度决策）
)

$ErrorActionPreference = 'Stop'

# ── 常量 ──────────────────────────────────────────────
$PROMPT_MAX_CHARS   = 500
$OUTPUT_MAX_CHARS   = 500
$DISPATCH_PROMPT_MAX = 200
$LARGE_FILE_BYTES   = 50 * 1024 * 1024  # 50 MB
$HEAD_LINES         = 10000
$TAIL_LINES         = 1000

$FILE_WRITE_TOOLS = @('create_file', 'replace_string_in_file', 'multi_replace_string_in_file')
$FLAGGED_TOOL_SET = @('kill_terminal', 'vscode_askQuestions', 'manage_todo_list', 'runSubagent')

# ── 辅助函数 ──────────────────────────────────────────

function Read-JsonlLines {
    <# 读取 JSONL 文件行，大文件只取头尾 #>
    param([string]$Path)
    $fi = [System.IO.FileInfo]::new($Path)
    if ($fi.Length -gt $LARGE_FILE_BYTES) {
        Write-Host "[warn] 大文件 ($([math]::Round($fi.Length/1MB,1)) MB)，仅解析头尾: $Path" -ForegroundColor Yellow
        $allLines = [System.IO.File]::ReadAllLines($Path)
        $total = $allLines.Count
        if ($total -le ($HEAD_LINES + $TAIL_LINES)) {
            return $allLines
        }
        $head = $allLines[0..($HEAD_LINES - 1)]
        $tail = $allLines[($total - $TAIL_LINES)..($total - 1)]
        $merged = New-Object 'string[]' ($head.Count + $tail.Count)
        [Array]::Copy($head, 0, $merged, 0, $head.Count)
        [Array]::Copy($tail, 0, $merged, $head.Count, $tail.Count)
        return $merged
    }
    return [System.IO.File]::ReadAllLines($Path)
}

function Truncate-String {
    param([string]$Text, [int]$Max)
    if (-not $Text) { return '' }
    if ($Text.Length -le $Max) { return $Text }
    return $Text.Substring(0, $Max) + '...'
}

function Extract-ResponseText {
    <# 从 agent_response 事件提取合并的 text 输出 #>
    param($Evt)
    if (-not $Evt -or -not $Evt.attrs -or -not $Evt.attrs.response) { return '' }
    $resp = $Evt.attrs.response
    # response.parts 可能已经是对象数组，也可能是 JSON 字符串
    $parts = $null
    if ($resp.parts) {
        $parts = $resp.parts
    } else {
        try {
            $parsed = $resp | ConvertFrom-Json -ErrorAction Stop
            if ($parsed.parts) { $parts = $parsed.parts }
        } catch {
            return [string]$resp
        }
    }
    if (-not $parts) { return [string]$resp }
    $texts = @($parts | Where-Object { $_.type -eq 'text' } | ForEach-Object { $_.content })
    return ($texts -join "`n")
}

# ── 定位 workspace 目录 ───────────────────────────────
$debugLogsRoot = Join-Path $env:APPDATA 'Code\User\workspaceStorage'

if (-not (Test-Path $debugLogsRoot)) {
    Write-Error "Debug logs 根目录不存在: $debugLogsRoot"
    return
}

if ($WorkspacePath) {
    # 支持完整路径或 hash 前缀
    if (Test-Path $WorkspacePath) {
        $workspaceDirs = @(Get-Item $WorkspacePath)
    } else {
        # 当作 hash 前缀匹配
        $workspaceDirs = @(Get-ChildItem $debugLogsRoot -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -like "$WorkspacePath*" })
        if ($workspaceDirs.Count -eq 0) {
            Write-Error "没有匹配的 workspace: $WorkspacePath"
            return
        }
    }
} else {
    $workspaceDirs = @(Get-ChildItem $debugLogsRoot -Directory -ErrorAction SilentlyContinue)
}

# ── 收集 JSONL 文件 ───────────────────────────────────
$allJsonlFiles = [System.Collections.Generic.List[PSCustomObject]]::new()

foreach ($wsDir in $workspaceDirs) {
    $logsDir = Join-Path $wsDir.FullName 'GitHub.copilot-chat\debug-logs'
    if (-not (Test-Path $logsDir)) { continue }

    $workspaceId = $wsDir.Name

    $sessionDirs = @(Get-ChildItem $logsDir -Directory -ErrorAction SilentlyContinue)
    if ($SessionId) {
        $sessionDirs = @($sessionDirs | Where-Object { $_.Name -eq $SessionId })
    }

    foreach ($sessionDir in $sessionDirs) {
        $jsonlFiles = @(Get-ChildItem $sessionDir.FullName -Filter 'runSubagent-*.jsonl' -ErrorAction SilentlyContinue)
        foreach ($f in $jsonlFiles) {
            $allJsonlFiles.Add([PSCustomObject]@{
                File        = $f
                WorkspaceId = $workspaceId
                SessionId   = $sessionDir.Name
            })
        }
    }
}

# 限制文件数
if ($allJsonlFiles.Count -gt $MaxFiles) {
    Write-Host "[info] 文件数 $($allJsonlFiles.Count) 超过上限 $MaxFiles，只处理最近 $MaxFiles 个" -ForegroundColor Yellow
    $sorted = @($allJsonlFiles | Sort-Object { $_.File.LastWriteTime } -Descending | Select-Object -First $MaxFiles)
    $allJsonlFiles = [System.Collections.Generic.List[PSCustomObject]]::new()
    foreach ($item in $sorted) { $allJsonlFiles.Add($item) }
}

Write-Host "[info] 待处理 $($allJsonlFiles.Count) 个 subagent 日志文件" -ForegroundColor Cyan

# ── 解析 subagent 日志 ────────────────────────────────
$invocations = [System.Collections.Generic.List[PSCustomObject]]::new()
$fileIdx = 0

foreach ($entry in $allJsonlFiles) {
    $fileIdx++
    $jsonlFile   = $entry.File
    $workspaceId = $entry.WorkspaceId
    $sid         = $entry.SessionId

    # 从文件名提取 agent 名称：runSubagent-<AgentName>-(call|toolu)_*
    $baseName  = $jsonlFile.BaseName
    $agentName = $baseName -replace '^runSubagent-', '' -replace '-(call|toolu)_.*$', ''

    # 通配符过滤
    if ($AgentFilter -and $agentName -notlike $AgentFilter) { continue }

    if ($fileIdx % 50 -eq 0) {
        Write-Host "[progress] $fileIdx / $($allJsonlFiles.Count) ..." -ForegroundColor DarkGray
    }

    try {
        $lines = Read-JsonlLines -Path $jsonlFile.FullName
    } catch {
        Write-Host "[warn] 跳过无法读取: $($jsonlFile.Name) — $_" -ForegroundColor Yellow
        continue
    }

    $prompt          = ''
    $lastAgentResp   = $null
    $toolCounts      = @{}
    $hasFileWrites   = $false
    $hasNestedDispatch = $false
    $hasKillTerminal = $false
    $hasAskQuestions = $false
    $hasTodoList     = $false
    $flaggedTools    = [System.Collections.Generic.List[string]]::new()
    $firstTs         = $null
    $lastTs          = $null
    $totalDurMs      = 0

    foreach ($line in $lines) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        try {
            $evt = $line | ConvertFrom-Json -ErrorAction SilentlyContinue
        } catch {
            continue
        }
        if (-not $evt) { continue }

        # 时间戳追踪
        if ($evt.ts) {
            if (-not $firstTs) { $firstTs = $evt.ts }
            $lastTs = $evt.ts
        }

        switch ($evt.type) {
            'user_message' {
                if (-not $prompt -and $evt.attrs -and $evt.attrs.content) {
                    $prompt = [string]$evt.attrs.content
                }
            }
            'agent_response' {
                $lastAgentResp = $evt
            }
            'tool_call' {
                $toolName = if ($evt.name) { $evt.name } else { 'unknown' }
                if ($toolCounts.ContainsKey($toolName)) {
                    $toolCounts[$toolName]++
                } else {
                    $toolCounts[$toolName] = 1
                }
                # 文件写入检测
                if ($toolName -in $FILE_WRITE_TOOLS) {
                    $hasFileWrites = $true
                }
                # 嵌套调度检测
                if ($toolName -eq 'runSubagent') {
                    $hasNestedDispatch = $true
                    if ('runSubagent' -notin $flaggedTools) { $flaggedTools.Add('runSubagent') }
                }
                # kill_terminal
                if ($toolName -eq 'kill_terminal') {
                    $hasKillTerminal = $true
                    if ('kill_terminal' -notin $flaggedTools) { $flaggedTools.Add('kill_terminal') }
                }
                # vscode_askQuestions（subagent 越权）
                if ($toolName -eq 'vscode_askQuestions') {
                    $hasAskQuestions = $true
                    if ('vscode_askQuestions' -notin $flaggedTools) { $flaggedTools.Add('vscode_askQuestions') }
                }
                # manage_todo_list（subagent 越权）
                if ($toolName -eq 'manage_todo_list') {
                    $hasTodoList = $true
                    if ('manage_todo_list' -notin $flaggedTools) { $flaggedTools.Add('manage_todo_list') }
                }
            }
            'tool_result' {
                if ($evt.dur) {
                    $totalDurMs += [int]$evt.dur
                }
            }
        }
    }

    # 提取输出文本
    $outputText = Extract-ResponseText -Evt $lastAgentResp

    # 计算整体持续时间（首尾时间戳差）
    $durationMs = 0
    if ($firstTs -and $lastTs -and $firstTs -ne $lastTs) {
        try {
            $startTime = [DateTimeOffset]::Parse([string]$firstTs)
            $endTime   = [DateTimeOffset]::Parse([string]$lastTs)
            $durationMs = [math]::Round(($endTime - $startTime).TotalMilliseconds)
        } catch {
            $durationMs = 0
        }
    }

    $logSizeKB  = [math]::Round($jsonlFile.Length / 1024, 1)
    $timestamp  = if ($firstTs) { [string]$firstTs } else { '' }
    $totalCalls = 0
    foreach ($v in $toolCounts.Values) { $totalCalls += $v }

    $invocations.Add([PSCustomObject]@{
        logFile            = $jsonlFile.FullName
        agentName          = $agentName
        sessionId          = $sid
        workspaceId        = $workspaceId
        logSizeKB          = $logSizeKB
        prompt             = Truncate-String -Text $prompt -Max $PROMPT_MAX_CHARS
        output             = Truncate-String -Text $outputText -Max $OUTPUT_MAX_CHARS
        toolCalls          = $toolCounts
        totalToolCalls     = $totalCalls
        hasFileWrites      = $hasFileWrites
        hasNestedDispatch  = $hasNestedDispatch
        hasKillTerminal    = $hasKillTerminal
        hasAskQuestions    = $hasAskQuestions
        hasTodoList        = $hasTodoList
        timestamp          = $timestamp
        durationMs         = $durationMs
        flaggedTools       = @($flaggedTools)
    })
}

Write-Host "[info] 解析完成，共 $($invocations.Count) 条 subagent 调用记录" -ForegroundColor Cyan

# ── 解析 main.jsonl（主控调度） ───────────────────────
$dispatches = [System.Collections.Generic.List[PSCustomObject]]::new()

if ($IncludeMainLog) {
    Write-Host "[info] 正在解析 main.jsonl 主控调度记录 ..." -ForegroundColor Cyan

    foreach ($wsDir in $workspaceDirs) {
        $logsDir = Join-Path $wsDir.FullName 'GitHub.copilot-chat\debug-logs'
        if (-not (Test-Path $logsDir)) { continue }
        $workspaceId = $wsDir.Name

        $sessionDirs = @(Get-ChildItem $logsDir -Directory -ErrorAction SilentlyContinue)
        if ($SessionId) {
            $sessionDirs = @($sessionDirs | Where-Object { $_.Name -eq $SessionId })
        }

        foreach ($sessionDir in $sessionDirs) {
            $mainFile = Join-Path $sessionDir.FullName 'main.jsonl'
            if (-not (Test-Path $mainFile)) { continue }

            try {
                $mainLines = Read-JsonlLines -Path $mainFile
            } catch {
                Write-Host "[warn] 跳过无法读取的 main.jsonl: $mainFile" -ForegroundColor Yellow
                continue
            }

            foreach ($line in $mainLines) {
                if ([string]::IsNullOrWhiteSpace($line)) { continue }
                try {
                    $evt = $line | ConvertFrom-Json -ErrorAction SilentlyContinue
                } catch {
                    continue
                }
                if (-not $evt) { continue }
                if ($evt.type -ne 'tool_call' -or $evt.name -ne 'runSubagent') { continue }

                $dispatchAgentName = ''
                $dispatchDesc      = ''
                $dispatchPrompt    = ''
                $dispatchTs        = if ($evt.ts) { [string]$evt.ts } else { '' }

                if ($evt.attrs -and $evt.attrs.args) {
                    try {
                        $argsStr = [string]$evt.attrs.args
                        $argsObj = $argsStr | ConvertFrom-Json -ErrorAction SilentlyContinue
                        if ($argsObj) {
                            if ($argsObj.agentName)   { $dispatchAgentName = [string]$argsObj.agentName }
                            if ($argsObj.description) { $dispatchDesc = [string]$argsObj.description }
                            if ($argsObj.prompt)      { $dispatchPrompt = Truncate-String -Text ([string]$argsObj.prompt) -Max $DISPATCH_PROMPT_MAX }
                        }
                    } catch {
                        # args 解析失败，跳过
                    }
                }

                if ($AgentFilter -and $dispatchAgentName -notlike $AgentFilter) { continue }

                $dispatches.Add([PSCustomObject]@{
                    workspaceId = $workspaceId
                    sessionId   = $sessionDir.Name
                    agentName   = $dispatchAgentName
                    description = $dispatchDesc
                    prompt      = $dispatchPrompt
                    timestamp   = $dispatchTs
                })
            }
        }
    }

    Write-Host "[info] 提取 $($dispatches.Count) 条主控调度记录" -ForegroundColor Cyan
}

# ── 聚合 summary ──────────────────────────────────────
$byAgent     = @{}
$agentSizes  = @{}
$byWorkspace = @{}
$flagCounts  = @{ nestedDispatch = 0; askQuestions = 0; killTerminal = 0; todoList = 0 }
$timestamps  = [System.Collections.Generic.List[string]]::new()

foreach ($inv in $invocations) {
    $an = $inv.agentName
    if ($byAgent.ContainsKey($an)) { $byAgent[$an]++ } else { $byAgent[$an] = 1 }
    if (-not $agentSizes.ContainsKey($an)) {
        $agentSizes[$an] = [System.Collections.Generic.List[double]]::new()
    }
    $agentSizes[$an].Add($inv.logSizeKB)

    $wid = $inv.workspaceId
    if ($byWorkspace.ContainsKey($wid)) { $byWorkspace[$wid]++ } else { $byWorkspace[$wid] = 1 }

    if ($inv.hasNestedDispatch) { $flagCounts['nestedDispatch']++ }
    if ($inv.hasAskQuestions)   { $flagCounts['askQuestions']++ }
    if ($inv.hasKillTerminal)   { $flagCounts['killTerminal']++ }
    if ($inv.hasTodoList)       { $flagCounts['todoList']++ }

    if ($inv.timestamp) { $timestamps.Add($inv.timestamp) }
}

# 按 agent 构建 byAgent 详情
$byAgentDetail = @{}
foreach ($an in $byAgent.Keys) {
    $sizes = $agentSizes[$an]
    $avg = 0
    if ($sizes.Count -gt 0) {
        $avg = [math]::Round(($sizes | Measure-Object -Average).Average, 1)
    }
    $byAgentDetail[$an] = [PSCustomObject]@{
        count     = $byAgent[$an]
        avgSizeKB = $avg
    }
}

# 时间范围
$timeRange = [PSCustomObject]@{ earliest = ''; latest = '' }
if ($timestamps.Count -gt 0) {
    $sorted = $timestamps | Sort-Object
    $timeRange = [PSCustomObject]@{
        earliest = $sorted[0]
        latest   = $sorted[$sorted.Count - 1]
    }
}

$summary = [PSCustomObject]@{
    totalInvocations   = $invocations.Count
    timeRange          = $timeRange
    byAgent            = $byAgentDetail
    byWorkspace        = $byWorkspace
    flaggedInvocations = [PSCustomObject]@{
        nestedDispatch = $flagCounts['nestedDispatch']
        askQuestions   = $flagCounts['askQuestions']
        killTerminal   = $flagCounts['killTerminal']
        todoList       = $flagCounts['todoList']
    }
}

# ── 输出 ──────────────────────────────────────────────
$resultObj = [ordered]@{
    summary     = $summary
    invocations = @($invocations)
}
if ($IncludeMainLog) {
    $resultObj['dispatches'] = @($dispatches)
}
$result = [PSCustomObject]$resultObj

$json = $result | ConvertTo-Json -Depth 10

if ($OutputPath) {
    $parentDir = Split-Path $OutputPath -Parent
    if ($parentDir -and -not (Test-Path $parentDir)) {
        New-Item -Path $parentDir -ItemType Directory -Force | Out-Null
    }
    [System.IO.File]::WriteAllText($OutputPath, $json, [System.Text.Encoding]::UTF8)
    Write-Host "[done] 已输出 $($invocations.Count) 条记录到 $OutputPath" -ForegroundColor Green
} else {
    $json
}
