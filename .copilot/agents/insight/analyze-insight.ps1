# DEPRECATED: This script has been replaced by the Node.js version (.js). Use the .js version instead.
#Requires -Version 5.1
<#
.SYNOPSIS
    从 VS Code Copilot debug-logs 提取定量统计数据，输出结构化 JSON。

.DESCRIPTION
    扫描所有 workspace 的 debug-logs JSONL 文件，解析事件流，
    提取 session 级别的 token、工具调用、错误分类、代码变更、
    时间分布等定量指标。纯本地计算，不调用 LLM。

.EXAMPLE
    .\analyze-insight.ps1 -OutputPath .\insight-data.json
    .\analyze-insight.ps1 -OutputPath .\insight-data.json -DaysBack 7
    .\analyze-insight.ps1 -OutputPath .\insight-data.json -WorkspacePath "D:\GIT\my-project"
#>
param(
    [Parameter(Mandatory)]
    [string]$OutputPath,        # 输出 JSON 路径
    [string]$WorkspacePath,     # 可选，筛选指定 workspace
    [string]$SessionId,         # 可选，筛选指定 session
    [int]$MaxFiles = 0,         # 可选，限制处理文件数（0=不限）
    [int]$DaysBack = 30,        # 只分析最近 N 天的数据
    [switch]$ExtractTranscripts,  # 可选，提取压缩 session 文稿
    [string]$TranscriptOutputPath = 'session-transcripts',  # 文稿输出目录
    [string]$CachePath = 'insight-cache'  # 增量缓存目录
)

$ErrorActionPreference = 'Stop'
$sw = [System.Diagnostics.Stopwatch]::StartNew()

# ── 常量 ──────────────────────────────────────────────
$USER_RESPONSE_MIN_SEC = 2
$USER_RESPONSE_MAX_SEC = 3600

# 语言扩展名映射
$LANG_MAP = @{
    '.ts'    = 'typescript';  '.tsx'   = 'typescript'
    '.js'    = 'javascript';  '.jsx'   = 'javascript'
    '.py'    = 'python'
    '.cs'    = 'csharp'
    '.java'  = 'java'
    '.go'    = 'go'
    '.rs'    = 'rust'
    '.rb'    = 'ruby'
    '.php'   = 'php'
    '.swift' = 'swift'
    '.kt'    = 'kotlin'
    '.c'     = 'c';          '.h'     = 'c'
    '.cpp'   = 'cpp';        '.cc'    = 'cpp'; '.cxx' = 'cpp'; '.hpp' = 'cpp'
    '.ps1'   = 'powershell'; '.psm1'  = 'powershell'
    '.sh'    = 'shell';      '.bash'  = 'shell'; '.zsh' = 'shell'
    '.md'    = 'markdown'
    '.json'  = 'json'
    '.yaml'  = 'yaml';       '.yml'   = 'yaml'
    '.html'  = 'html';       '.htm'   = 'html'
    '.css'   = 'css';        '.scss'  = 'css'; '.less' = 'css'
    '.sql'   = 'sql'
    '.xml'   = 'xml'
    '.vue'   = 'vue'
    '.svelte'= 'svelte'
    '.dart'  = 'dart'
    '.lua'   = 'lua'
    '.r'     = 'r'
}

# 工具错误分类模式（有序：具体模式优先匹配）
$ERROR_PATTERNS = [ordered]@{
    'EditFailed'      = @('string to replace', 'not found in file', 'oldString', 'does not match', 'multiple locations', 'did not match', 'matches multiple')
    'FileNotFound'    = @('file not found', 'does not exist', 'ENOENT', 'no such file', 'not found:', 'path not found', 'could not find', 'cannot find')
    'FileExists'      = @('file already exists', 'already exists', 'EEXIST')
    'FileChanged'     = @('modified since', 'changed since', 'has been modified', 'file has changed', 'file changed')
    'FileTooLarge'    = @('exceeds maximum', 'too large', 'file size exceeds', 'too big', 'content too large')
    'CommandFailed'   = @('exited with code', 'exit code', 'command failed', 'non-zero exit', 'non zero')
    'Timeout'         = @('timeout', 'timed out', 'time out', 'deadline exceeded')
    'PermissionDenied'= @('permission denied', 'access denied', 'EACCES', 'unauthorized', 'forbidden')
    'ValidationError' = @('syntax error', 'malformed', 'parse error', 'is not valid', 'invalid argument', 'invalid path', 'invalid file')
    'UserRejected'    = @('rejected', 'cancelled', 'canceled', 'user declined', 'user aborted', 'user denied')
}

function Classify-ToolError {
    param([string]$ErrorText)
    if (-not $ErrorText) { return 'Other' }
    $lower = $ErrorText.ToLower()
    foreach ($category in $ERROR_PATTERNS.Keys) {
        foreach ($pattern in $ERROR_PATTERNS[$category]) {
            if ($lower.Contains($pattern)) { return $category }
        }
    }
    return 'Other'
}

function Detect-Language {
    <# 从文件路径扩展名检测编程语言 #>
    param([string]$FilePath)
    if (-not $FilePath) { return $null }
    $ext = [System.IO.Path]::GetExtension($FilePath).ToLower()
    if ($LANG_MAP.ContainsKey($ext)) { return $LANG_MAP[$ext] }
    return $null
}

function Extract-FilePath-FromArgs {
    <# 从工具调用参数中提取 filePath #>
    param($ArgsObj)
    if (-not $ArgsObj) { return $null }
    $argsStr = [string]$ArgsObj
    try {
        $parsed = $argsStr | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($parsed.filePath) { return [string]$parsed.filePath }
        if ($parsed.path)     { return [string]$parsed.path }
        # multi_replace_string_in_file
        if ($parsed.replacements -and $parsed.replacements.Count -gt 0) {
            return [string]$parsed.replacements[0].filePath
        }
    } catch {}
    return $null
}

function Try-ReadWorkspaceJson {
    <# 尝试读取 workspace.json 获取 workspace 路径 #>
    param([string]$WsDir)
    $wsJsonPath = Join-Path $WsDir 'workspace.json'
    if (Test-Path $wsJsonPath) {
        try {
            $wsJson = [System.IO.File]::ReadAllText($wsJsonPath) | ConvertFrom-Json -ErrorAction SilentlyContinue
            if ($wsJson.folder) {
                $uri = [string]$wsJson.folder
                # file:///D%3A/GIT/xxx → D:\GIT\xxx
                if ($uri -match '^file:///') {
                    $decoded = [System.Uri]::UnescapeDataString($uri.Substring(8))
                    return $decoded.Replace('/', '\')
                }
                return $uri
            }
        } catch {}
    }
    return $null
}

# ── 定位 workspace 目录 ──────────────────────────────
$debugLogsRoot = Join-Path $env:APPDATA 'Code\User\workspaceStorage'
if (-not (Test-Path $debugLogsRoot)) {
    Write-Error "Debug logs 根目录不存在: $debugLogsRoot"
    return
}

$cutoffDate = (Get-Date).AddDays(-$DaysBack)

if ($WorkspacePath) {
    if (Test-Path $WorkspacePath) {
        $workspaceDirs = @(Get-Item $WorkspacePath)
    } else {
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

Write-Host "[info] 扫描 $($workspaceDirs.Count) 个 workspace 目录..." -ForegroundColor Cyan

# ── 收集 session 目录 ────────────────────────────────
# 每个 session 目录包含 main.jsonl + runSubagent-*.jsonl
$sessionEntries = [System.Collections.Generic.List[PSCustomObject]]::new()

foreach ($wsDir in $workspaceDirs) {
    $logsDir = Join-Path $wsDir.FullName 'GitHub.copilot-chat\debug-logs'
    if (-not (Test-Path $logsDir)) { continue }

    $workspaceId = $wsDir.Name
    $workspaceFolderPath = Try-ReadWorkspaceJson -WsDir $wsDir.FullName

    $sessionDirs = @(Get-ChildItem $logsDir -Directory -ErrorAction SilentlyContinue)
    if ($SessionId) {
        $sessionDirs = @($sessionDirs | Where-Object { $_.Name -eq $SessionId })
    }

    foreach ($sDir in $sessionDirs) {
        # 日期过滤：用目录最后修改时间
        if ($sDir.LastWriteTime -lt $cutoffDate) { continue }

        $mainFile = Join-Path $sDir.FullName 'main.jsonl'
        if (-not (Test-Path $mainFile)) { continue }

        $subagentFiles = @(Get-ChildItem $sDir.FullName -Filter 'runSubagent-*.jsonl' -ErrorAction SilentlyContinue)

        $sessionEntries.Add([PSCustomObject]@{
            SessionDir        = $sDir
            SessionId         = $sDir.Name
            WorkspaceId       = $workspaceId
            WorkspacePath     = $workspaceFolderPath
            WorkspaceName     = if ($workspaceFolderPath) { Split-Path $workspaceFolderPath -Leaf } else { $workspaceId.Substring(0, [Math]::Min(8, $workspaceId.Length)) }
            MainFile          = $mainFile
            SubagentFiles     = $subagentFiles
        })
    }
}

# 限制处理数
if ($MaxFiles -gt 0 -and $sessionEntries.Count -gt $MaxFiles) {
    Write-Host "[info] Session 数 $($sessionEntries.Count) 超过上限 $MaxFiles，只处理最近的" -ForegroundColor Yellow
    $sessionEntries = [System.Collections.Generic.List[PSCustomObject]]::new(
        @($sessionEntries | Sort-Object { $_.SessionDir.LastWriteTime } -Descending | Select-Object -First $MaxFiles)
    )
}

# 统计总文件大小
$totalSizeBytes = 0
foreach ($se in $sessionEntries) {
    $totalSizeBytes += (Get-Item $se.MainFile).Length
    foreach ($sf in $se.SubagentFiles) { $totalSizeBytes += $sf.Length }
}
$totalFiles = $sessionEntries.Count
foreach ($se in $sessionEntries) { $totalFiles += $se.SubagentFiles.Count }

Write-Host "[info] 待处理 $($sessionEntries.Count) 个 session，$totalFiles 个文件，总计 $([math]::Round($totalSizeBytes/1MB, 1)) MB" -ForegroundColor Cyan

# ── 缓存目录 ─────────────────────────────────────────
if (-not [System.IO.Path]::IsPathRooted($CachePath)) {
    $resolvedParent = Split-Path $OutputPath -Parent
    if ($resolvedParent) { $CachePath = Join-Path $resolvedParent $CachePath }
}
if (-not (Test-Path $CachePath)) {
    New-Item -Path $CachePath -ItemType Directory -Force | Out-Null
}

# ── 解析每个 session ─────────────────────────────────
$sessions = [System.Collections.Generic.List[PSCustomObject]]::new()
$sessionIdx = 0
$transcriptFilesWritten = 0
$cachedCount = 0
$newCount = 0

foreach ($se in $sessionEntries) {
    $sessionIdx++
    if ($sessionIdx % 5 -eq 0) {
        Write-Host "[progress] $sessionIdx / $($sessionEntries.Count) sessions ..." -ForegroundColor DarkGray
    }

    # === 缓存检查 ===
    $cacheFile = Join-Path $CachePath "$($se.SessionId).json"
    $sourceLastWrite = (Get-Item $se.MainFile).LastWriteTimeUtc
    if ((Test-Path $cacheFile)) {
        $cacheLastWrite = (Get-Item $cacheFile).LastWriteTimeUtc
        if ($cacheLastWrite -ge $sourceLastWrite) {
            try {
                $cachedData = Get-Content $cacheFile -Raw | ConvertFrom-Json
                $sessions.Add($cachedData)
                $cachedCount++
                continue
            } catch {
                Write-Host "[warn] 缓存文件损坏，重新处理: $($se.SessionId)" -ForegroundColor Yellow
            }
        }
    }

    # === 解析 main.jsonl ===
    $userMsgCount       = 0
    $assistantMsgCount  = 0
    $inputTokens        = [long]0
    $outputTokens       = [long]0
    $models             = @{}
    $toolCounts         = @{}
    $toolErrors         = 0
    $toolErrorCats      = @{}
    $subagentCalls      = 0
    $subagentNames      = @{}
    $filesCreated       = 0
    $filesModified      = 0
    $replacements       = 0
    $userInterruptions  = 0
    $languages          = @{}
    $messageHours       = [System.Collections.Generic.List[int]]::new()
    $firstPrompt        = ''
    $firstTs            = $null
    $lastTs             = $null
    $userMsgTimestamps  = [System.Collections.Generic.List[string]]::new()
    $assistantMsgTimestamps = [System.Collections.Generic.List[string]]::new()
    $llmCalls           = 0

    # ── 新增追踪变量 ──
    $gitOperations      = @{ commits = 0; pushes = 0; merges = 0; stashes = 0 }
    $diffLines          = @{ added = 0; removed = 0 }
    $usesMcp            = $false
    $usesWebSearch      = $false
    $usesWebFetch       = $false
    $usesBrowser        = $false
    $transcriptUserMsgs   = [System.Collections.Generic.List[string]]::new()
    $transcriptToolErrs   = [System.Collections.Generic.List[string]]::new()
    $transcriptAskQs      = [System.Collections.Generic.List[string]]::new()
    $transcriptAssistMsgs = [System.Collections.Generic.List[string]]::new()

    $reader = $null
    try {
        $reader = [System.IO.StreamReader]::new($se.MainFile, [System.Text.Encoding]::UTF8)
        while ($null -ne ($line = $reader.ReadLine())) {
            if ([string]::IsNullOrWhiteSpace($line)) { continue }
            try {
                $evt = $line | ConvertFrom-Json -ErrorAction SilentlyContinue
            } catch { continue }
            if (-not $evt) { continue }

            # 时间戳追踪
            if ($evt.ts) {
                if (-not $firstTs) { $firstTs = $evt.ts }
                $lastTs = $evt.ts
            }

            switch ($evt.type) {
                'user_message' {
                    $userMsgCount++
                    if ($evt.ts) {
                        $userMsgTimestamps.Add([string]$evt.ts)
                        try {
                            $hr = ([DateTimeOffset]::FromUnixTimeMilliseconds([long]$evt.ts)).LocalDateTime.Hour
                            $messageHours.Add($hr)
                        } catch {}
                    }
                    if (-not $firstPrompt -and $evt.attrs -and $evt.attrs.content) {
                        $content = [string]$evt.attrs.content
                        $firstPrompt = if ($content.Length -gt 200) { $content.Substring(0, 200) + '...' } else { $content }
                    }
                    # 中断检测
                    if ($evt.attrs -and $evt.attrs.content) {
                        $c = [string]$evt.attrs.content
                        if ($c -match '\[Request interrupted' -or $c -match 'cancelled') {
                            $userInterruptions++
                        }
                    }
                    # Transcript: user message
                    if ($ExtractTranscripts -and $evt.attrs -and $evt.attrs.content) {
                        $timeTag = if ($evt.ts) { try { ([DateTimeOffset]::FromUnixTimeMilliseconds([long]$evt.ts)).LocalDateTime.ToString('HH:mm') } catch { '??:??' } } else { '??:??' }
                        $txt = [string]$evt.attrs.content
                        if ($txt.Length -gt 500) { $txt = $txt.Substring(0, 500) + '...' }
                        $transcriptUserMsgs.Add("[$timeTag] $txt")
                    }
                }
                'agent_response' {
                    $assistantMsgCount++
                    if ($evt.ts) {
                        $assistantMsgTimestamps.Add([string]$evt.ts)
                        try {
                            $hr = ([DateTimeOffset]::FromUnixTimeMilliseconds([long]$evt.ts)).LocalDateTime.Hour
                            $messageHours.Add($hr)
                        } catch {}
                    }
                    # Transcript: assistant message (first 200 chars)
                    if ($ExtractTranscripts -and $evt.attrs -and $evt.attrs.content) {
                        $timeTag = if ($evt.ts) { try { ([DateTimeOffset]::FromUnixTimeMilliseconds([long]$evt.ts)).LocalDateTime.ToString('HH:mm') } catch { '??:??' } } else { '??:??' }
                        $txt = [string]$evt.attrs.content
                        if ($txt.Length -gt 200) { $txt = $txt.Substring(0, 200) + '...' }
                        $transcriptAssistMsgs.Add("[$timeTag] $txt")
                    }
                }
                'llm_request' {
                    $llmCalls++
                    if ($evt.attrs) {
                        # Token 统计
                        if ($evt.attrs.inputTokens)  { $inputTokens  += [long]$evt.attrs.inputTokens }
                        if ($evt.attrs.outputTokens) { $outputTokens += [long]$evt.attrs.outputTokens }
                        if ($evt.attrs.usage) {
                            if ($evt.attrs.usage.input_tokens)  { $inputTokens  += [long]$evt.attrs.usage.input_tokens }
                            if ($evt.attrs.usage.output_tokens) { $outputTokens += [long]$evt.attrs.usage.output_tokens }
                        }
                        # 模型统计
                        $modelName = $null
                        if ($evt.attrs.model) { $modelName = [string]$evt.attrs.model }
                        if ($modelName) {
                            $modelTokens = [long]0
                            if ($evt.attrs.inputTokens)            { $modelTokens = [long]$evt.attrs.inputTokens }
                            elseif ($evt.attrs.usage -and $evt.attrs.usage.input_tokens) { $modelTokens = [long]$evt.attrs.usage.input_tokens }
                            if ($models.ContainsKey($modelName)) { $models[$modelName] += $modelTokens }
                            else { $models[$modelName] = $modelTokens }
                        }
                    }
                }
                'tool_call' {
                    $toolName = if ($evt.name) { [string]$evt.name } else { 'unknown' }
                    if ($toolCounts.ContainsKey($toolName)) { $toolCounts[$toolName]++ }
                    else { $toolCounts[$toolName] = 1 }

                    # Subagent 调用
                    if ($toolName -eq 'runSubagent') {
                        $subagentCalls++
                        if ($evt.attrs -and $evt.attrs.args) {
                            try {
                                $argsObj = [string]$evt.attrs.args | ConvertFrom-Json -ErrorAction SilentlyContinue
                                $saName = ''
                                if ($argsObj.agentName) { $saName = [string]$argsObj.agentName }
                                elseif ($argsObj.agent) { $saName = [string]$argsObj.agent }
                                if ($saName) {
                                    if ($subagentNames.ContainsKey($saName)) { $subagentNames[$saName]++ }
                                    else { $subagentNames[$saName] = 1 }
                                }
                            } catch {}
                        }
                    }

                    # 代码变更统计
                    if ($toolName -eq 'create_file') { $filesCreated++ }
                    if ($toolName -eq 'replace_string_in_file') { $filesModified++; $replacements++ }
                    if ($toolName -eq 'multi_replace_string_in_file') {
                        $filesModified++
                        if ($evt.attrs -and $evt.attrs.args) {
                            try {
                                $argsObj = [string]$evt.attrs.args | ConvertFrom-Json -ErrorAction SilentlyContinue
                                if ($argsObj.replacements) { $replacements += @($argsObj.replacements).Count }
                            } catch { $replacements++ }
                        }
                    }

                    # Git 操作检测
                    if ($toolName -eq 'run_in_terminal' -and $evt.attrs -and $evt.attrs.args) {
                        try {
                            $cmdObj = [string]$evt.attrs.args | ConvertFrom-Json -ErrorAction SilentlyContinue
                            $cmdStr = ''
                            if ($cmdObj.command) { $cmdStr = ([string]$cmdObj.command).ToLower() }
                            if ($cmdStr -match 'git\s+commit')  { $gitOperations.commits++ }
                            if ($cmdStr -match 'git\s+push')    { $gitOperations.pushes++ }
                            if ($cmdStr -match 'git\s+(merge|rebase)') { $gitOperations.merges++ }
                            if ($cmdStr -match 'git\s+stash')   { $gitOperations.stashes++ }
                        } catch {}
                    }

                    # Diff 行数统计
                    if ($toolName -eq 'replace_string_in_file' -and $evt.attrs -and $evt.attrs.args) {
                        try {
                            $diffObj = [string]$evt.attrs.args | ConvertFrom-Json -ErrorAction SilentlyContinue
                            if ($diffObj.oldString -and $diffObj.newString) {
                                $oldLines = ([string]$diffObj.oldString).Split("`n").Count
                                $newLines = ([string]$diffObj.newString).Split("`n").Count
                                if ($newLines -gt $oldLines) { $diffLines.added += ($newLines - $oldLines) }
                                else { $diffLines.removed += ($oldLines - $newLines) }
                            }
                        } catch {}
                    }
                    if ($toolName -eq 'multi_replace_string_in_file' -and $evt.attrs -and $evt.attrs.args) {
                        try {
                            $diffObj = [string]$evt.attrs.args | ConvertFrom-Json -ErrorAction SilentlyContinue
                            if ($diffObj.replacements) {
                                foreach ($rep in @($diffObj.replacements)) {
                                    if ($rep.oldString -and $rep.newString) {
                                        $oldLines = ([string]$rep.oldString).Split("`n").Count
                                        $newLines = ([string]$rep.newString).Split("`n").Count
                                        if ($newLines -gt $oldLines) { $diffLines.added += ($newLines - $oldLines) }
                                        else { $diffLines.removed += ($oldLines - $newLines) }
                                    }
                                }
                            }
                        } catch {}
                    }

                    # Feature 使用检测
                    if ($toolName.StartsWith('mcp_')) { $usesMcp = $true }
                    if ($toolName -eq 'fetch_webpage') { $usesWebFetch = $true }
                    if ($toolName -match 'browser|playwright') { $usesBrowser = $true }
                    if ($toolName -match 'search' -and $toolName -match 'web|bing|google') { $usesWebSearch = $true }

                    # Transcript: askQuestions
                    if ($ExtractTranscripts -and $toolName -eq 'vscode_askQuestions' -and $evt.attrs -and $evt.attrs.args) {
                        $timeTag = if ($evt.ts) { try { ([DateTimeOffset]::FromUnixTimeMilliseconds([long]$evt.ts)).LocalDateTime.ToString('HH:mm') } catch { '??:??' } } else { '??:??' }
                        try {
                            $aqObj = [string]$evt.attrs.args | ConvertFrom-Json -ErrorAction SilentlyContinue
                            $summary = if ($aqObj.questions) { ($aqObj.questions | ForEach-Object { $_.question }) -join '; ' } else { '[questions]' }
                            if ($summary.Length -gt 300) { $summary = $summary.Substring(0, 300) + '...' }
                            $transcriptAskQs.Add("[$timeTag] askQuestions: $summary")
                        } catch {
                            $transcriptAskQs.Add("[$timeTag] askQuestions: [parse error]")
                        }
                    }

                    # 语言检测
                    if ($evt.attrs -and $evt.attrs.args) {
                        $fp = Extract-FilePath-FromArgs -ArgsObj $evt.attrs.args
                        if ($fp) {
                            $lang = Detect-Language -FilePath $fp
                            if ($lang) {
                                if ($languages.ContainsKey($lang)) { $languages[$lang]++ }
                                else { $languages[$lang] = 1 }
                            }
                        }
                    }

                    # 工具错误
                    if ($evt.status -eq 'error') {
                        $toolErrors++
                        $errText = ''
                        if ($evt.attrs -and $evt.attrs.result) { $errText = [string]$evt.attrs.result }
                        elseif ($evt.attrs -and $evt.attrs.error) { $errText = [string]$evt.attrs.error }
                        $cat = Classify-ToolError -ErrorText $errText
                        if ($toolErrorCats.ContainsKey($cat)) { $toolErrorCats[$cat]++ }
                        else { $toolErrorCats[$cat] = 1 }
                        # Transcript: tool error
                        if ($ExtractTranscripts) {
                            $timeTag = if ($evt.ts) { try { ([DateTimeOffset]::FromUnixTimeMilliseconds([long]$evt.ts)).LocalDateTime.ToString('HH:mm') } catch { '??:??' } } else { '??:??' }
                            $snippet = if ($errText.Length -gt 150) { $errText.Substring(0, 150) + '...' } else { $errText }
                            $transcriptToolErrs.Add("[$timeTag] ${toolName}: $snippet")
                        }
                    }
                }
                'child_session_ref' {
                    # subagent session 映射（统计从这里也可以补充）
                    if ($evt.attrs -and $evt.attrs.agentName) {
                        $saName = [string]$evt.attrs.agentName
                        if (-not $subagentNames.ContainsKey($saName)) {
                            $subagentNames[$saName] = 0
                        }
                    }
                }
            }
        }
    } catch {
        Write-Host "[warn] 解析 main.jsonl 失败: $($se.MainFile) — $_" -ForegroundColor Yellow
    } finally {
        if ($reader) { $reader.Close(); $reader.Dispose() }
    }

    # === 解析 subagent JSONL 文件（补充工具/错误/代码变更统计） ===
    foreach ($saFile in $se.SubagentFiles) {
        $saReader = $null
        try {
            $saReader = [System.IO.StreamReader]::new($saFile.FullName, [System.Text.Encoding]::UTF8)
            while ($null -ne ($saLine = $saReader.ReadLine())) {
                if ([string]::IsNullOrWhiteSpace($saLine)) { continue }
                try {
                    $saEvt = $saLine | ConvertFrom-Json -ErrorAction SilentlyContinue
                } catch { continue }
                if (-not $saEvt) { continue }

                if ($saEvt.type -eq 'llm_request' -and $saEvt.attrs) {
                    $llmCalls++
                    if ($saEvt.attrs.inputTokens)  { $inputTokens  += [long]$saEvt.attrs.inputTokens }
                    if ($saEvt.attrs.outputTokens) { $outputTokens += [long]$saEvt.attrs.outputTokens }
                    if ($saEvt.attrs.usage) {
                        if ($saEvt.attrs.usage.input_tokens)  { $inputTokens  += [long]$saEvt.attrs.usage.input_tokens }
                        if ($saEvt.attrs.usage.output_tokens) { $outputTokens += [long]$saEvt.attrs.usage.output_tokens }
                    }
                    if ($saEvt.attrs.model) {
                        $mn = [string]$saEvt.attrs.model
                        $mt = [long]0
                        if ($saEvt.attrs.inputTokens)            { $mt = [long]$saEvt.attrs.inputTokens }
                        elseif ($saEvt.attrs.usage -and $saEvt.attrs.usage.input_tokens) { $mt = [long]$saEvt.attrs.usage.input_tokens }
                        if ($models.ContainsKey($mn)) { $models[$mn] += $mt }
                        else { $models[$mn] = $mt }
                    }
                }

                if ($saEvt.type -eq 'tool_call') {
                    $tn = if ($saEvt.name) { [string]$saEvt.name } else { 'unknown' }
                    if ($toolCounts.ContainsKey($tn)) { $toolCounts[$tn]++ }
                    else { $toolCounts[$tn] = 1 }

                    if ($tn -eq 'create_file') { $filesCreated++ }
                    if ($tn -eq 'replace_string_in_file') { $filesModified++; $replacements++ }
                    if ($tn -eq 'multi_replace_string_in_file') {
                        $filesModified++
                        if ($saEvt.attrs -and $saEvt.attrs.args) {
                            try {
                                $argsObj = [string]$saEvt.attrs.args | ConvertFrom-Json -ErrorAction SilentlyContinue
                                if ($argsObj.replacements) { $replacements += @($argsObj.replacements).Count }
                            } catch { $replacements++ }
                        }
                    }

                    # Git 操作检测 (subagent)
                    if ($tn -eq 'run_in_terminal' -and $saEvt.attrs -and $saEvt.attrs.args) {
                        try {
                            $cmdObj = [string]$saEvt.attrs.args | ConvertFrom-Json -ErrorAction SilentlyContinue
                            $cmdStr = ''
                            if ($cmdObj.command) { $cmdStr = ([string]$cmdObj.command).ToLower() }
                            if ($cmdStr -match 'git\s+commit')  { $gitOperations.commits++ }
                            if ($cmdStr -match 'git\s+push')    { $gitOperations.pushes++ }
                            if ($cmdStr -match 'git\s+(merge|rebase)') { $gitOperations.merges++ }
                            if ($cmdStr -match 'git\s+stash')   { $gitOperations.stashes++ }
                        } catch {}
                    }

                    # Diff 行数统计 (subagent)
                    if ($tn -eq 'replace_string_in_file' -and $saEvt.attrs -and $saEvt.attrs.args) {
                        try {
                            $diffObj = [string]$saEvt.attrs.args | ConvertFrom-Json -ErrorAction SilentlyContinue
                            if ($diffObj.oldString -and $diffObj.newString) {
                                $oldLines = ([string]$diffObj.oldString).Split("`n").Count
                                $newLines = ([string]$diffObj.newString).Split("`n").Count
                                if ($newLines -gt $oldLines) { $diffLines.added += ($newLines - $oldLines) }
                                else { $diffLines.removed += ($oldLines - $newLines) }
                            }
                        } catch {}
                    }
                    if ($tn -eq 'multi_replace_string_in_file' -and $saEvt.attrs -and $saEvt.attrs.args) {
                        try {
                            $diffObj = [string]$saEvt.attrs.args | ConvertFrom-Json -ErrorAction SilentlyContinue
                            if ($diffObj.replacements) {
                                foreach ($rep in @($diffObj.replacements)) {
                                    if ($rep.oldString -and $rep.newString) {
                                        $oldLines = ([string]$rep.oldString).Split("`n").Count
                                        $newLines = ([string]$rep.newString).Split("`n").Count
                                        if ($newLines -gt $oldLines) { $diffLines.added += ($newLines - $oldLines) }
                                        else { $diffLines.removed += ($oldLines - $newLines) }
                                    }
                                }
                            }
                        } catch {}
                    }

                    # Feature 使用检测 (subagent)
                    if ($tn.StartsWith('mcp_')) { $usesMcp = $true }
                    if ($tn -eq 'fetch_webpage') { $usesWebFetch = $true }
                    if ($tn -match 'browser|playwright') { $usesBrowser = $true }
                    if ($tn -match 'search' -and $tn -match 'web|bing|google') { $usesWebSearch = $true }

                    if ($saEvt.attrs -and $saEvt.attrs.args) {
                        $fp = Extract-FilePath-FromArgs -ArgsObj $saEvt.attrs.args
                        if ($fp) {
                            $lang = Detect-Language -FilePath $fp
                            if ($lang) {
                                if ($languages.ContainsKey($lang)) { $languages[$lang]++ }
                                else { $languages[$lang] = 1 }
                            }
                        }
                    }

                    if ($saEvt.status -eq 'error') {
                        $toolErrors++
                        $errText = ''
                        if ($saEvt.attrs -and $saEvt.attrs.result) { $errText = [string]$saEvt.attrs.result }
                        elseif ($saEvt.attrs -and $saEvt.attrs.error) { $errText = [string]$saEvt.attrs.error }
                        $cat = Classify-ToolError -ErrorText $errText
                        if ($toolErrorCats.ContainsKey($cat)) { $toolErrorCats[$cat]++ }
                        else { $toolErrorCats[$cat] = 1 }
                        # Transcript: tool error (subagent)
                        if ($ExtractTranscripts) {
                            $timeTag = if ($saEvt.ts) { try { ([DateTimeOffset]::FromUnixTimeMilliseconds([long]$saEvt.ts)).LocalDateTime.ToString('HH:mm') } catch { '??:??' } } else { '??:??' }
                            $snippet = if ($errText.Length -gt 150) { $errText.Substring(0, 150) + '...' } else { $errText }
                            $transcriptToolErrs.Add("[$timeTag] ${tn}: $snippet")
                        }
                    }
                }
            }
        } catch {
            Write-Host "[warn] 解析 subagent 日志失败: $($saFile.Name) — $_" -ForegroundColor Yellow
        } finally {
            if ($saReader) { $saReader.Close(); $saReader.Dispose() }
        }
    }

    # === 计算 session 级指标 ===

    # 会话时长（分钟）
    $durationMinutes = 0
    if ($firstTs -and $lastTs) {
        try {
            $startTime = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$firstTs)
            $endTime   = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$lastTs)
            $durationMinutes = [math]::Round(($endTime - $startTime).TotalMinutes, 1)
        } catch {}
    }

    # 工具成功率
    $totalToolCalls = 0
    foreach ($v in $toolCounts.Values) { $totalToolCalls += $v }
    $toolSuccessRate = 100.0
    if ($totalToolCalls -gt 0) {
        $toolSuccessRate = [math]::Round((($totalToolCalls - $toolErrors) / $totalToolCalls) * 100, 1)
    }

    # 用户响应时间：assistant→user 消息时间差
    $userResponseTimes = [System.Collections.Generic.List[double]]::new()
    if ($assistantMsgTimestamps.Count -gt 0 -and $userMsgTimestamps.Count -gt 0) {
        # 按时间排序所有消息
        $allMsgs = [System.Collections.Generic.List[PSCustomObject]]::new()
        foreach ($ts in $userMsgTimestamps) {
            try {
                $allMsgs.Add([PSCustomObject]@{ Time = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$ts); Role = 'user' })
            } catch {}
        }
        foreach ($ts in $assistantMsgTimestamps) {
            try {
                $allMsgs.Add([PSCustomObject]@{ Time = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$ts); Role = 'assistant' })
            } catch {}
        }
        $sorted = @($allMsgs | Sort-Object Time)
        for ($i = 0; $i -lt $sorted.Count - 1; $i++) {
            if ($sorted[$i].Role -eq 'assistant' -and $sorted[$i + 1].Role -eq 'user') {
                $diffSec = ($sorted[$i + 1].Time - $sorted[$i].Time).TotalSeconds
                if ($diffSec -ge $USER_RESPONSE_MIN_SEC -and $diffSec -le $USER_RESPONSE_MAX_SEC) {
                    $userResponseTimes.Add([math]::Round($diffSec, 1))
                }
            }
        }
    }

    # 构建 session 对象
    $sessionObj = [ordered]@{
        sessionId          = $se.SessionId
        workspacePath      = $se.WorkspacePath
        workspaceName      = $se.WorkspaceName
        startTime          = if ($firstTs) { try { ([DateTimeOffset]::FromUnixTimeMilliseconds([long]$firstTs)).ToString('o') } catch { '' } } else { '' }
        durationMinutes    = $durationMinutes
        userMessageCount   = $userMsgCount
        assistantMessageCount = $assistantMsgCount
        llmCalls           = $llmCalls
        toolCounts         = $toolCounts
        toolErrors         = $toolErrors
        toolErrorCategories = $toolErrorCats
        toolSuccessRate    = $toolSuccessRate
        inputTokens        = $inputTokens
        outputTokens       = $outputTokens
        models             = $models
        subagentCalls      = $subagentCalls
        subagentNames      = $subagentNames
        codeChanges        = [ordered]@{
            filesCreated   = $filesCreated
            filesModified  = $filesModified
            replacements   = $replacements
        }
        userInterruptions  = $userInterruptions
        userResponseTimes  = @($userResponseTimes)
        messageHours       = @($messageHours)
        firstPrompt        = $firstPrompt
        languages          = $languages
        gitOperations      = $gitOperations
        diffLines          = $diffLines
        featureUsage       = [ordered]@{
            usesMcp        = $usesMcp
            usesWebSearch  = $usesWebSearch
            usesWebFetch   = $usesWebFetch
            usesBrowser    = $usesBrowser
        }
        isSubstantive      = ($userMsgCount -ge 2 -or $durationMinutes -ge 1)
        multiClauding      = $false
    }

    # ── 输出 session 文稿 ──
    if ($ExtractTranscripts -and ($transcriptUserMsgs.Count -gt 0 -or $transcriptToolErrs.Count -gt 0)) {
        $sb = [System.Text.StringBuilder]::new(4096)
        [void]$sb.AppendLine("=== Session: $($se.SessionId) ===")
        [void]$sb.AppendLine("Workspace: $(if ($se.WorkspacePath) { $se.WorkspacePath } else { $se.WorkspaceId })")
        [void]$sb.AppendLine("Duration: ${durationMinutes}min | Messages: ${userMsgCount}/${assistantMsgCount}")
        [void]$sb.AppendLine()

        if ($transcriptUserMsgs.Count -gt 0) {
            [void]$sb.AppendLine('--- User Messages ---')
            foreach ($m in $transcriptUserMsgs) { [void]$sb.AppendLine($m) }
            [void]$sb.AppendLine()
        }

        if ($transcriptToolErrs.Count -gt 0) {
            [void]$sb.AppendLine('--- Tool Errors ---')
            foreach ($m in $transcriptToolErrs) { [void]$sb.AppendLine($m) }
            [void]$sb.AppendLine()
        }

        if ($transcriptAskQs.Count -gt 0) {
            [void]$sb.AppendLine('--- Key Interactions ---')
            foreach ($m in $transcriptAskQs) { [void]$sb.AppendLine($m) }
            [void]$sb.AppendLine()
        }

        if ($transcriptAssistMsgs.Count -gt 0) {
            [void]$sb.AppendLine('--- Assistant Highlights ---')
            $maxAssist = [Math]::Min($transcriptAssistMsgs.Count, 5)
            for ($ai = 0; $ai -lt $maxAssist; $ai++) { [void]$sb.AppendLine($transcriptAssistMsgs[$ai]) }
            if ($transcriptAssistMsgs.Count -gt 5) { [void]$sb.AppendLine("... (+$($transcriptAssistMsgs.Count - 5) more)") }
            [void]$sb.AppendLine()
        }

        $txDir = $TranscriptOutputPath
        if (-not [System.IO.Path]::IsPathRooted($txDir)) {
            $parentDir = Split-Path $OutputPath -Parent
            if (-not [string]::IsNullOrEmpty($parentDir)) {
                $txDir = Join-Path $parentDir $txDir
            }
        }
        if (-not (Test-Path $txDir)) {
            New-Item -Path $txDir -ItemType Directory -Force | Out-Null
        }
        $txFile = Join-Path $txDir "$($se.SessionId).txt"
        $transcriptContent = $sb.ToString()
        [System.IO.File]::WriteAllText($txFile, $transcriptContent, [System.Text.Encoding]::UTF8)
        $transcriptFilesWritten++

        # Compute transcript hash (MD5)
        $md5 = [System.Security.Cryptography.MD5]::Create()
        $hashBytes = $md5.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($transcriptContent))
        $md5.Dispose()
        $sessionObj.transcriptHash = [System.BitConverter]::ToString($hashBytes).Replace('-','').ToLower()
    }

    # === 写入缓存 ===
    try {
        [PSCustomObject]$sessionObj | ConvertTo-Json -Depth 10 | Set-Content $cacheFile -Encoding UTF8
    } catch {
        Write-Host "[warn] 写入缓存失败: $($se.SessionId) — $_" -ForegroundColor Yellow
    }
    $newCount++

    $sessions.Add([PSCustomObject]$sessionObj)
}

Write-Host "[info] 解析完成，共 $($sessions.Count) 个 session (Cached: $cachedCount, New: $newCount, Total: $($sessions.Count))" -ForegroundColor Cyan

# ── Multi-clauding 检测 ──────────────────────────────
$sortedByTime = @($sessions | Where-Object {
    $st = [string]$_.startTime
    -not [string]::IsNullOrWhiteSpace($st)
} | Sort-Object { [string]$_.startTime })

for ($i = 0; $i -lt $sortedByTime.Count - 1; $i++) {
    try {
        $startIStr = [string]$sortedByTime[$i].startTime
        $startNextStr = [string]$sortedByTime[$i + 1].startTime
        if ([string]::IsNullOrWhiteSpace($startIStr) -or [string]::IsNullOrWhiteSpace($startNextStr)) { continue }

        $startI = [DateTimeOffset]::Parse($startIStr)
        $startNext = [DateTimeOffset]::Parse($startNextStr)

        $durI = [double]0
        try { $durI = [double]$sortedByTime[$i].durationMinutes } catch { $durI = 0 }
        if ($durI -lt 0.5) { $durI = 0.5 }  # 最短假设 0.5 分钟
        $endI = $startI.AddMinutes($durI)

        $gapMinutes = ($startNext - $endI).TotalMinutes
        # 重叠（gap < 0）或间隔 < 2 分钟即视为 multi-clauding
        if ($gapMinutes -lt 2) {
            $sortedByTime[$i].multiClauding = $true
            $sortedByTime[$i + 1].multiClauding = $true
        }
    } catch {
        # startTime 解析失败，跳过此对
    }
}
$multiClaudingCount = @($sessions | Where-Object { $_.multiClauding -eq $true }).Count

if ($ExtractTranscripts -and $transcriptFilesWritten -gt 0) {
    Write-Host "[info] 文稿已输出: $transcriptFilesWritten 个文件" -ForegroundColor Cyan
}

# ── 聚合数据 ─────────────────────────────────────────
$totalUserMessages     = [long]0
$totalAssistantMessages = [long]0
$totalInputTokens      = [long]0
$totalOutputTokens     = [long]0
$totalLLMCalls         = [long]0
$totalToolCalls        = [long]0
$totalToolErrors       = 0
$totalSubagentCalls    = 0
$totalFilesCreated     = 0
$totalFilesModified    = 0
$totalReplacements     = 0
$toolCountsAgg         = @{}
$toolErrorCatsAgg      = @{}
$subagentDistAgg       = @{}
$modelDistAgg          = @{}
$languageDistAgg       = @{}
$hourlyDist            = @(0) * 24
$byWorkspace           = @{}
$allDurations          = [System.Collections.Generic.List[double]]::new()
$allResponseTimes      = [System.Collections.Generic.List[double]]::new()
$activeDays            = [System.Collections.Generic.HashSet[string]]::new()
$successRates          = [System.Collections.Generic.List[double]]::new()

foreach ($s in $sessions) {
    $totalUserMessages     += $s.userMessageCount
    $totalAssistantMessages += $s.assistantMessageCount
    $totalInputTokens      += $s.inputTokens
    $totalOutputTokens     += $s.outputTokens
    $totalLLMCalls         += $s.llmCalls
    $totalToolErrors       += $s.toolErrors
    $totalSubagentCalls    += $s.subagentCalls
    $totalFilesCreated     += $s.codeChanges.filesCreated
    $totalFilesModified    += $s.codeChanges.filesModified
    $totalReplacements     += $s.codeChanges.replacements

    if ($s.durationMinutes -gt 0) { $allDurations.Add($s.durationMinutes) }
    foreach ($rt in $s.userResponseTimes) { $allResponseTimes.Add($rt) }
    if ($s.toolSuccessRate -lt 100.1) { $successRates.Add($s.toolSuccessRate) }

    # 活跃天数
    if ($s.startTime) {
        try {
            $day = ([DateTimeOffset]::Parse([string]$s.startTime)).ToString('yyyy-MM-dd')
            [void]$activeDays.Add($day)
        } catch {}
    }

    # 工具聚合
    if ($s.toolCounts) {
        $props = if ($s.toolCounts -is [hashtable]) {
            $s.toolCounts.GetEnumerator() | ForEach-Object { [PSCustomObject]@{ Name = $_.Key; Value = $_.Value } }
        } else { $s.toolCounts.PSObject.Properties }
        foreach ($p in $props) {
            $totalToolCalls += [int]$p.Value
            if ($toolCountsAgg.ContainsKey($p.Name)) { $toolCountsAgg[$p.Name] += [int]$p.Value }
            else { $toolCountsAgg[$p.Name] = [int]$p.Value }
        }
    }

    # 错误类别聚合
    if ($s.toolErrorCategories) {
        $props = if ($s.toolErrorCategories -is [hashtable]) {
            $s.toolErrorCategories.GetEnumerator() | ForEach-Object { [PSCustomObject]@{ Name = $_.Key; Value = $_.Value } }
        } else { $s.toolErrorCategories.PSObject.Properties }
        foreach ($p in $props) {
            if ($toolErrorCatsAgg.ContainsKey($p.Name)) { $toolErrorCatsAgg[$p.Name] += [int]$p.Value }
            else { $toolErrorCatsAgg[$p.Name] = [int]$p.Value }
        }
    }

    # Subagent 分布聚合
    if ($s.subagentNames) {
        $props = if ($s.subagentNames -is [hashtable]) {
            $s.subagentNames.GetEnumerator() | ForEach-Object { [PSCustomObject]@{ Name = $_.Key; Value = $_.Value } }
        } else { $s.subagentNames.PSObject.Properties }
        foreach ($p in $props) {
            if ($subagentDistAgg.ContainsKey($p.Name)) { $subagentDistAgg[$p.Name] += [int]$p.Value }
            else { $subagentDistAgg[$p.Name] = [int]$p.Value }
        }
    }

    # 模型分布聚合
    if ($s.models) {
        $props = if ($s.models -is [hashtable]) {
            $s.models.GetEnumerator() | ForEach-Object { [PSCustomObject]@{ Name = $_.Key; Value = $_.Value } }
        } else { $s.models.PSObject.Properties }
        foreach ($p in $props) {
            if ($modelDistAgg.ContainsKey($p.Name)) { $modelDistAgg[$p.Name] += [long]$p.Value }
            else { $modelDistAgg[$p.Name] = [long]$p.Value }
        }
    }

    # 语言分布聚合
    if ($s.languages) {
        $props = if ($s.languages -is [hashtable]) {
            $s.languages.GetEnumerator() | ForEach-Object { [PSCustomObject]@{ Name = $_.Key; Value = $_.Value } }
        } else { $s.languages.PSObject.Properties }
        foreach ($p in $props) {
            if ($languageDistAgg.ContainsKey($p.Name)) { $languageDistAgg[$p.Name] += [int]$p.Value }
            else { $languageDistAgg[$p.Name] = [int]$p.Value }
        }
    }

    # 小时分布
    foreach ($h in $s.messageHours) {
        if ($h -ge 0 -and $h -lt 24) { $hourlyDist[$h]++ }
    }

    # 按 workspace 聚合
    $wsName = if ($s.workspaceName) { $s.workspaceName } else { 'unknown' }
    if (-not $byWorkspace.ContainsKey($wsName)) {
        $byWorkspace[$wsName] = @{ sessions = 0; userMessages = 0; inputTokens = [long]0 }
    }
    $byWorkspace[$wsName].sessions++
    $byWorkspace[$wsName].userMessages += $s.userMessageCount
    $byWorkspace[$wsName].inputTokens += $s.inputTokens
}

# 计算统计值
$daysActive = $activeDays.Count
$messagesPerDay = if ($daysActive -gt 0) { [math]::Round($totalUserMessages / $daysActive, 2) } else { 0 }
$avgSessionDuration = if ($allDurations.Count -gt 0) {
    [math]::Round(($allDurations | Measure-Object -Average).Average, 1)
} else { 0 }

# 中位数响应时间
$medianResponseTime = 0
$avgResponseTime = 0
if ($allResponseTimes.Count -gt 0) {
    $sortedRT = @($allResponseTimes | Sort-Object)
    $mid = [math]::Floor($sortedRT.Count / 2)
    $medianResponseTime = if ($sortedRT.Count % 2 -eq 0) {
        [math]::Round(($sortedRT[$mid - 1] + $sortedRT[$mid]) / 2, 1)
    } else { $sortedRT[$mid] }
    $avgResponseTime = [math]::Round(($allResponseTimes | Measure-Object -Average).Average, 1)
}

$avgToolSuccessRate = if ($successRates.Count -gt 0) {
    [math]::Round(($successRates | Measure-Object -Average).Average, 1)
} else { 100.0 }

# 转换 byWorkspace 为可序列化格式
$byWorkspaceOut = [ordered]@{}
foreach ($k in ($byWorkspace.Keys | Sort-Object)) {
    $byWorkspaceOut[$k] = [ordered]@{
        sessions     = $byWorkspace[$k].sessions
        userMessages = $byWorkspace[$k].userMessages
        inputTokens  = $byWorkspace[$k].inputTokens
    }
}

$sw.Stop()

# ── 构建输出 ─────────────────────────────────────────
$output = [ordered]@{
    meta = [ordered]@{
        scanDate       = (Get-Date -Format 'yyyy-MM-dd')
        totalFiles     = $totalFiles
        totalSizeMB    = [math]::Round($totalSizeBytes / 1MB, 0)
        daysBack       = $DaysBack
        scanDurationMs = $sw.ElapsedMilliseconds
    }
    sessions = @($sessions)
    aggregated = [ordered]@{
        totalSessions             = $sessions.Count
        totalUserMessages         = $totalUserMessages
        totalAssistantMessages    = $totalAssistantMessages
        totalInputTokens          = $totalInputTokens
        totalOutputTokens         = $totalOutputTokens
        totalLLMCalls             = $totalLLMCalls
        totalToolCalls            = $totalToolCalls
        totalToolErrors           = $totalToolErrors
        avgToolSuccessRate        = $avgToolSuccessRate
        totalSubagentCalls        = $totalSubagentCalls
        totalFilesCreated         = $totalFilesCreated
        totalFilesModified        = $totalFilesModified
        totalReplacements         = $totalReplacements
        daysActive                = $daysActive
        messagesPerDay            = $messagesPerDay
        avgSessionDuration        = $avgSessionDuration
        medianResponseTime        = $medianResponseTime
        avgResponseTime           = $avgResponseTime
        toolCountsAggregated      = $toolCountsAgg
        toolErrorCategoriesAggregated = $toolErrorCatsAgg
        subagentDistribution      = $subagentDistAgg
        modelDistribution         = $modelDistAgg
        languageDistribution      = $languageDistAgg
        hourlyDistribution        = $hourlyDist
        byWorkspace               = $byWorkspaceOut
        multiClaudingSessions     = $multiClaudingCount
    }
}

# ── 输出 ─────────────────────────────────────────────
$json = $output | ConvertTo-Json -Depth 10 -Compress:$false
$parentDir = Split-Path $OutputPath -Parent
if ($parentDir -and -not (Test-Path $parentDir)) {
    New-Item -Path $parentDir -ItemType Directory -Force | Out-Null
}
[System.IO.File]::WriteAllText($OutputPath, $json, [System.Text.Encoding]::UTF8)

Write-Host "[done] Insight 数据已输出: $OutputPath ($([math]::Round($json.Length/1024, 1)) KB)" -ForegroundColor Green
Write-Host "[stat] $($sessions.Count) sessions, $totalToolCalls tool calls, $($sw.ElapsedMilliseconds) ms" -ForegroundColor Cyan
