#Requires -Version 5.1
# UeErrorSolver.psm1 — Jenkins CI 构建错误诊断与修复工具集

# ============================================================
# Phase 0: 配置
# ============================================================

function Read-SkillConfig {
    <#
    .SYNOPSIS
        读取 skill 配置文件并返回配置对象。
    .PARAMETER ConfigPath
        配置文件路径，默认为模块目录上级的 config.json。
    .OUTPUTS
        PSCustomObject — 解析后的配置对象。
    .EXAMPLE
        $cfg = Read-SkillConfig
        $cfg = Read-SkillConfig -ConfigPath "D:\my\config.json"
    #>
    [CmdletBinding()]
    param(
        [string]$ConfigPath = (Join-Path $PSScriptRoot '..\config.json')
    )

    $resolved = [System.IO.Path]::GetFullPath($ConfigPath)
    if (-not (Test-Path $resolved)) {
        throw "Config file not found: $resolved"
    }

    $raw = Get-Content -Path $resolved -Raw -Encoding UTF8
    try {
        $obj = $raw | ConvertFrom-Json
    }
    catch {
        throw "Invalid JSON in config file '$resolved': $_"
    }
    return $obj
}

function Resolve-ConfigPath {
    <#
    .SYNOPSIS
        将 ~/…、./…、绝对路径统一解析为规范化绝对路径。
    .PARAMETER Path
        待解析的路径字符串。
    .PARAMETER BaseDir
        相对路径的基准目录，默认为模块目录上级。
    .OUTPUTS
        System.String — 规范化的绝对路径。
    .EXAMPLE
        Resolve-ConfigPath -Path '~/wiki'
        Resolve-ConfigPath -Path './data' -BaseDir 'D:\project'
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Path,

        [string]$BaseDir = (Join-Path $PSScriptRoot '..')
    )

    if ($Path -match '^~[/\\]') {
        $Path = $Path -replace '^~[/\\]', "$HOME\"
    }
    elseif ($Path -match '^\.[/\\]') {
        $Path = Join-Path $BaseDir ($Path -replace '^\.[/\\]', '')
    }

    $Path = $Path -replace '/', '\'
    return [System.IO.Path]::GetFullPath($Path)
}

function Assert-ConfigPaths {
    <#
    .SYNOPSIS
        验证配置中的关键目录路径存在，rawDir 不存在时自动创建。
    .PARAMETER Config
        Read-SkillConfig 返回的配置对象，需包含 gitRepos、wikiDir、rawDir 属性。
    .OUTPUTS
        PSCustomObject — 包含 resolved 路径的新对象。
    .EXAMPLE
        $cfg = Read-SkillConfig | Assert-ConfigPaths
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [PSCustomObject]$Config
    )

    $result = $Config.PSObject.Copy()

    # Resolve top-level path: gitRepos
    if (-not $Config.PSObject.Properties['gitRepos']) {
        throw "Config missing required property: gitRepos"
    }
    $result.gitRepos = Resolve-ConfigPath -Path $Config.gitRepos

    # Resolve nested paths: knowledgeBase.wikiDir, knowledgeBase.rawDir
    if (-not $Config.PSObject.Properties['knowledgeBase']) {
        throw "Config missing required property: knowledgeBase"
    }
    $kb = $Config.knowledgeBase
    if (-not $kb.PSObject.Properties['wikiDir'] -or -not $kb.PSObject.Properties['rawDir']) {
        throw "Config knowledgeBase missing wikiDir or rawDir"
    }
    $resolvedKb = [PSCustomObject]@{
        wikiDir = Resolve-ConfigPath -Path $kb.wikiDir
        rawDir  = Resolve-ConfigPath -Path $kb.rawDir
    }
    $result | Add-Member -NotePropertyName 'knowledgeBase' -NotePropertyValue $resolvedKb -Force

    if (-not (Test-Path $result.gitRepos)) {
        throw "gitRepos directory not found: $($result.gitRepos)"
    }
    if (-not (Test-Path $resolvedKb.wikiDir)) {
        Write-Warning "wikiDir directory not found: $($resolvedKb.wikiDir)"
    }
    if (-not (Test-Path $resolvedKb.rawDir)) {
        New-Item -ItemType Directory -Path $resolvedKb.rawDir -Force | Out-Null
        Write-Verbose "Created rawDir: $($resolvedKb.rawDir)"
    }

    return $result
}

function New-TempWorkDir {
    <#
    .SYNOPSIS
        返回临时工作目录路径，不存在则自动创建。
    .OUTPUTS
        System.String — 临时工作目录的绝对路径。
    .EXAMPLE
        $tmp = New-TempWorkDir
    #>
    [CmdletBinding()]
    param()

    $dir = Join-Path $env:TEMP 'ue-error-solver'
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    return $dir
}

# ============================================================
# Phase 1: Jenkins + 日志
# ============================================================

function Parse-JenkinsBuildUrl {
    <#
    .SYNOPSIS
        解析 Jenkins 构建 URL 或短名+编号，返回结构化信息。
    .PARAMETER BuildRef
        完整 Jenkins URL 或 "jobName#123" / "jobName 123" 短格式。
    .PARAMETER BaseUrl
        Jenkins 基础 URL，短名格式时必须提供。
    .OUTPUTS
        PSCustomObject — BaseUrl, JobPath, BuildNumber, JobShort。
    .EXAMPLE
        Parse-JenkinsBuildUrl -BuildRef 'https://ci.example.com/job/MyProject/job/Build/42'
        Parse-JenkinsBuildUrl -BuildRef 'MyProject#42' -BaseUrl 'https://ci.example.com'
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$BuildRef,

        [string]$BaseUrl
    )

    # 完整 URL 模式
    if ($BuildRef -match '^(https?://[^/]+)(/.+?)/(\d+)/?(?:console(?:Full)?)?$') {
        $base    = $Matches[1]
        $jobPath = $Matches[2]
        $buildNo = [int]$Matches[3]
        $short   = ($jobPath -split '/job/' | Where-Object { $_ })[-1]
        return [PSCustomObject]@{
            BaseUrl     = $base
            JobPath     = $jobPath
            BuildNumber = $buildNo
            JobShort    = $short
        }
    }

    # 短名格式: "name#123" 或 "name 123"
    if ($BuildRef -match '^(.+?)[# ]+(\d+)$') {
        $name    = $Matches[1].Trim()
        $buildNo = [int]$Matches[2]
        if (-not $BaseUrl) {
            throw "BaseUrl is required for short-name format: '$BuildRef'"
        }
        return [PSCustomObject]@{
            BaseUrl     = $BaseUrl.TrimEnd('/')
            JobPath     = $null
            BuildNumber = $buildNo
            JobShort    = $name
        }
    }

    throw "Cannot parse Jenkins build input: '$BuildRef'"
}

function Extract-RepoCheckouts {
    <#
    .SYNOPSIS
        从 Jenkins 日志中提取所有 git 仓库的 checkout 信息。
    .DESCRIPTION
        解析 Jenkins git 插件输出，提取每个仓库的 remote URL、分支、commit hash。
        用于确定修复分支的正确起始点。
    .PARAMETER Log
        完整的 Jenkins 控制台日志文本。
    .OUTPUTS
        PSCustomObject[] — 每个元素包含 RepoUrl, RepoName, Branch, Commit, LocalPath。
    .EXAMPLE
        $checkouts = Extract-RepoCheckouts -Log $log
        $checkouts | Where-Object RepoName -eq 'AesWorld'
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Log
    )

    $lines = $Log -split "`n"
    $results = [System.Collections.Generic.List[PSCustomObject]]::new()
    $currentUrl = $null
    $currentPath = $null

    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i].TrimEnd("`r")

        # 匹配 git config remote.origin.url
        if ($line -match '>\s*git config remote\.origin\.url\s+(https?://\S+)') {
            $currentUrl = $Matches[1]
        }
        # 匹配 Running in (workspace path)
        elseif ($line -match 'Running in\s+(\S+)') {
            $currentPath = $Matches[1]
        }
        # 匹配 Checking out Revision + branch
        elseif ($line -match 'Checking out Revision\s+([0-9a-f]{40})\s+\(refs/remotes/origin/([^)]+)\)') {
            $commit = $Matches[1]
            $branch = $Matches[2]
            $repoName = if ($currentUrl -match '/([^/]+?)(?:\.git)?$') { $Matches[1] } else { $currentUrl }

            $results.Add([PSCustomObject]@{
                RepoUrl   = $currentUrl
                RepoName  = $repoName
                Branch    = $branch
                Commit    = $commit
                LocalPath = $currentPath
            })
        }
    }

    return $results.ToArray()
}

function Find-JenkinsJob {
    <#
    .SYNOPSIS
        通过 Jenkins API 递归搜索匹配的 job。
    .PARAMETER BaseUrl
        Jenkins 基础 URL。
    .PARAMETER SearchTerm
        模糊搜索关键词。
    .OUTPUTS
        System.String[] — 匹配的 job 路径数组。
    .EXAMPLE
        Find-JenkinsJob -BaseUrl 'https://ci.example.com' -SearchTerm 'Build'
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$BaseUrl,

        [Parameter(Mandatory)]
        [string]$SearchTerm
    )

    $BaseUrl = $BaseUrl.TrimEnd('/')
    $results = [System.Collections.Generic.List[string]]::new()

    $authArgs = @()
    if ($env:JENKINS_USER -and $env:JENKINS_TOKEN) {
        $authArgs = @('-u', "${env:JENKINS_USER}:${env:JENKINS_TOKEN}")
    }

    function Recurse-Jobs([string]$apiUrl, [string]$prefix) {
        $args_ = @('-s', '-f', $apiUrl) + $authArgs
        $json = & curl.exe @args_ 2>$null
        if (-not $json) { return }

        try { $data = $json | ConvertFrom-Json } catch { return }

        if ($data.jobs) {
            foreach ($job in $data.jobs) {
                $jobPath = "$prefix/job/$($job.name)"
                if ($job.name -like "*$SearchTerm*") {
                    $results.Add($jobPath)
                }
                if ($job._class -match 'Folder|Org') {
                    Recurse-Jobs "$BaseUrl${jobPath}/api/json?tree=jobs[name,_class]" $jobPath
                }
            }
        }
    }

    Recurse-Jobs "$BaseUrl/api/json?tree=jobs[name,_class]" ''
    return $results.ToArray()
}

function Get-JenkinsConsoleLog {
    <#
    .SYNOPSIS
        下载 Jenkins 构建的控制台日志。
    .PARAMETER BaseUrl
        Jenkins 基础 URL。
    .PARAMETER JobPath
        Job 的路径（如 /job/MyProject/job/Build）。
    .PARAMETER BuildNumber
        构建编号。
    .OUTPUTS
        System.String — 完整控制台日志文本。
    .EXAMPLE
        Get-JenkinsConsoleLog -BaseUrl 'https://ci.example.com' -JobPath '/job/MyProject/job/Build' -BuildNumber 42
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$BaseUrl,

        [Parameter(Mandatory)]
        [string]$JobPath,

        [Parameter(Mandatory)]
        [int]$BuildNumber
    )

    $BaseUrl = $BaseUrl.TrimEnd('/')
    $url = "${BaseUrl}${JobPath}/${BuildNumber}/consoleText"

    $authArgs = @()
    if ($env:JENKINS_USER -and $env:JENKINS_TOKEN) {
        $authArgs = @('-u', "${env:JENKINS_USER}:${env:JENKINS_TOKEN}")
    }

    $args_ = @('-s', '-f', $url) + $authArgs
    $log = & curl.exe @args_ 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to download console log from $url (exit code $LASTEXITCODE)"
    }

    return ($log -join "`r`n")
}

function Get-JenkinsBuildResult {
    <#
    .SYNOPSIS
        查询 Jenkins 构建结果元数据。
    .PARAMETER BaseUrl
        Jenkins 基础 URL。
    .PARAMETER JobPath
        Job 路径。
    .PARAMETER BuildNumber
        构建编号。
    .OUTPUTS
        PSCustomObject — Result, Timestamp, Duration。
    .EXAMPLE
        Get-JenkinsBuildResult -BaseUrl 'https://ci.example.com' -JobPath '/job/Build' -BuildNumber 42
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$BaseUrl,

        [Parameter(Mandatory)]
        [string]$JobPath,

        [Parameter(Mandatory)]
        [int]$BuildNumber
    )

    $BaseUrl = $BaseUrl.TrimEnd('/')
    $url = "${BaseUrl}${JobPath}/${BuildNumber}/api/json?tree=result,timestamp,duration"

    $authArgs = @()
    if ($env:JENKINS_USER -and $env:JENKINS_TOKEN) {
        $authArgs = @('-u', "${env:JENKINS_USER}:${env:JENKINS_TOKEN}")
    }

    $args_ = @('-s', '-f', $url) + $authArgs
    $json = & curl.exe @args_ 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to query build result from $url (exit code $LASTEXITCODE)"
    }

    $data = ($json -join '') | ConvertFrom-Json
    return [PSCustomObject]@{
        Result    = $data.result
        Timestamp = $data.timestamp
        Duration  = $data.duration
    }
}

function Save-JenkinsLog {
    <#
    .SYNOPSIS
        将 Jenkins 日志保存到磁盘，大日志自动保存过滤版本。
    .PARAMETER Log
        完整日志文本。
    .PARAMETER JobShort
        Job 短名。
    .PARAMETER BuildNumber
        构建编号。
    .PARAMETER TmpDir
        临时工作目录。
    .OUTPUTS
        System.String — 保存的文件路径。
    .EXAMPLE
        Save-JenkinsLog -Log $log -JobShort 'Build' -BuildNumber 42 -TmpDir $tmp
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Log,

        [Parameter(Mandatory)]
        [string]$JobShort,

        [Parameter(Mandatory)]
        [int]$BuildNumber,

        [Parameter(Mandatory)]
        [string]$TmpDir
    )

    if (-not (Test-Path $TmpDir)) {
        New-Item -ItemType Directory -Path $TmpDir -Force | Out-Null
    }

    $ts = Get-Date -Format 'yyyyMMdd_HHmmss'
    $safeName = $JobShort -replace '[^a-zA-Z0-9_-]', '_'
    $fileName = "${safeName}_${BuildNumber}_${ts}.log"
    $filePath = Join-Path $TmpDir $fileName

    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($filePath, $Log, $utf8NoBom)

    # 大日志(>500KB)：额外保存过滤版本
    if ($Log.Length -gt 512000) {
        $filterPattern = 'error|fatal|warning|LNK|ExitCode|FAILED|Error:|Exception'
        $filtered = ($Log -split "`n" | Where-Object { $_ -match $filterPattern }) -join "`r`n"
        $filteredPath = Join-Path $TmpDir "${safeName}_${BuildNumber}_${ts}_filtered.log"
        [System.IO.File]::WriteAllText($filteredPath, $filtered, $utf8NoBom)
        Write-Verbose "Large log detected ($('{0:N0}' -f $Log.Length) bytes). Filtered version saved to $filteredPath"
    }

    return $filePath
}

function Extract-ErrorBlocks {
    <#
    .SYNOPSIS
        从构建日志中提取结构化错误块。
    .PARAMETER Log
        完整日志文本。
    .OUTPUTS
        PSCustomObject[] — 每个元素包含 Lines, ErrorCode, FilePath, LineNumber, Type。
    .EXAMPLE
        $errors = Extract-ErrorBlocks -Log $log
        $errors | Where-Object Type -eq 'Compilation'
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Log
    )

    $patterns = @{
        Compilation    = 'error C\d+:|error CS\d+:|fatal error C\d+:|error:.*\[-W'
        Linker         = 'LNK\d+:|unresolved external symbol'
        UBT            = 'UnrealBuildTool|UnrealHeaderTool|UBT ERROR|UHT ERROR'
        Cook           = 'LogCook: Error|Cook failed|Package.*failed'
        Infrastructure = 'OutOfMemoryException|IOException|disk full|network (error|failure|unreachable)|timeout(?!=\d)|timed out'
    }

    $lines = $Log -split "`n"
    $results = [System.Collections.Generic.List[PSCustomObject]]::new()
    $i = 0

    while ($i -lt $lines.Count) {
        $line = $lines[$i].TrimEnd("`r")
        $matchedType = $null

        foreach ($kvp in $patterns.GetEnumerator()) {
            if ($line -match $kvp.Value) {
                $matchedType = $kvp.Key
                break
            }
        }

        if ($matchedType) {
            $block = [System.Collections.Generic.List[string]]::new()
            $block.Add($line)

            # 收集后续 note/| /^ 续行
            $j = $i + 1
            while ($j -lt $lines.Count) {
                $next = $lines[$j].TrimEnd("`r")
                if ($next -match '^\s*(note:|  \||\s*\^)' -or $next -match '^\s+referenced by') {
                    $block.Add($next)
                    $j++
                }
                else { break }
            }

            # 提取错误代码
            $errorCode = $null
            if ($line -match '((?:fatal )?error C\d+)') { $errorCode = $Matches[1] }
            elseif ($line -match '(error CS\d+)') { $errorCode = $Matches[1] }
            elseif ($line -match '(LNK\d+)') { $errorCode = $Matches[1] }
            elseif ($line -match '(error:.*?\[-W[^\]]+\])') { $errorCode = $Matches[1] }

            # 提取文件路径和行号
            $filePath = $null
            $lineNum  = 0
            if ($line -match '([a-zA-Z]:\\[^(]+?)\((\d+)') {
                $filePath = $Matches[1]
                $lineNum  = [int]$Matches[2]
            }
            elseif ($line -match '([a-zA-Z]:\\[^:]+?):(\d+)') {
                $filePath = $Matches[1]
                $lineNum  = [int]$Matches[2]
            }

            $results.Add([PSCustomObject]@{
                Lines      = $block.ToArray()
                ErrorCode  = $errorCode
                FilePath   = $filePath
                LineNumber = $lineNum
                Type       = $matchedType
            })

            $i = $j
        }
        else {
            $i++
        }
    }

    return $results.ToArray()
}

function Extract-BuildCommand {
    <#
    .SYNOPSIS
        从日志中提取 UBT/Build 命令行。
    .PARAMETER Log
        完整日志文本。
    .OUTPUTS
        System.String — 提取到的命令行字符串，未找到则返回 $null。
    .EXAMPLE
        $cmd = Extract-BuildCommand -Log $log
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Log
    )

    $lines = $Log -split "`n"
    foreach ($line in $lines) {
        $trimmed = $line.TrimEnd("`r").Trim()
        if ($trimmed -match 'UnrealBuildTool\.(exe|dll)|RunUBT\.bat|Build\.bat') {
            return $trimmed
        }
    }
    return $null
}

# ============================================================
# Phase 2: 源码 + 知识库
# ============================================================

function Resolve-ErrorFileInRepo {
    <#
    .SYNOPSIS
        将 CI 路径映射到本地 git 仓库中的文件。
    .PARAMETER ErrorPath
        CI 机器上的绝对路径（如 D:\ws_twe_ue5.5_ci\Project\Plugins\G\...）。
    .PARAMETER GitRepos
        本地 git 仓库根目录。
    .OUTPUTS
        PSCustomObject — LocalPath, RepoRoot, RelativePath, Found。
    .EXAMPLE
        Resolve-ErrorFileInRepo -ErrorPath 'D:\ws_ci\Project\Plugins\G\MyPlugin\Source\Foo.cpp' -GitRepos 'D:\repos'
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$ErrorPath,

        [Parameter(Mandatory)]
        [string]$GitRepos
    )

    # 提取 Plugins 以下的相对路径
    $relative = $null
    if ($ErrorPath -match '(?i)Plugins[/\\](.+)$') {
        $relative = $Matches[1] -replace '/', '\'
    }
    elseif ($ErrorPath -match '(?i)Source[/\\](.+)$') {
        $relative = "Source\$($Matches[1] -replace '/', '\')"
    }

    if (-not $relative) {
        return [PSCustomObject]@{
            LocalPath    = $null
            RepoRoot     = $null
            RelativePath = $null
            Found        = $false
        }
    }

    # 在 GitRepos 下递归搜索
    $candidates = Get-ChildItem -Path $GitRepos -Recurse -File -Filter (Split-Path $relative -Leaf) -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -like "*$relative" }

    if ($candidates) {
        $found = ($candidates | Select-Object -First 1).FullName
        # 推断 RepoRoot：往上找 .git
        $dir = Split-Path $found -Parent
        $repoRoot = $null
        while ($dir -and $dir.Length -gt 3) {
            if (Test-Path (Join-Path $dir '.git')) {
                $repoRoot = $dir
                break
            }
            $dir = Split-Path $dir -Parent
        }

        return [PSCustomObject]@{
            LocalPath    = $found
            RepoRoot     = $repoRoot
            RelativePath = $relative
            Found        = $true
        }
    }

    return [PSCustomObject]@{
        LocalPath    = $null
        RepoRoot     = $null
        RelativePath = $relative
        Found        = $false
    }
}

function Get-SourceContext {
    <#
    .SYNOPSIS
        读取源文件指定行前后的上下文代码。
    .PARAMETER FilePath
        源文件绝对路径。
    .PARAMETER LineNumber
        目标行号（1-based）。
    .PARAMETER ContextLines
        上下文行数（前后各取），默认 15。
    .OUTPUTS
        System.String — 带行号的代码片段。
    .EXAMPLE
        Get-SourceContext -FilePath 'D:\repo\Foo.cpp' -LineNumber 42
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$FilePath,

        [Parameter(Mandatory)]
        [int]$LineNumber,

        [int]$ContextLines = 15
    )

    if (-not (Test-Path $FilePath)) {
        throw "Source file not found: $FilePath"
    }

    $allLines = Get-Content -Path $FilePath -Encoding UTF8
    $start = [Math]::Max(0, $LineNumber - 1 - $ContextLines)
    $end   = [Math]::Min($allLines.Count - 1, $LineNumber - 1 + $ContextLines)

    $snippet = [System.Text.StringBuilder]::new()
    for ($i = $start; $i -le $end; $i++) {
        $marker = if ($i -eq ($LineNumber - 1)) { '>>>' } else { '   ' }
        [void]$snippet.AppendLine("$marker $($i + 1): $($allLines[$i])")
    }

    return $snippet.ToString()
}

function Get-FileGitHistory {
    <#
    .SYNOPSIS
        获取文件的 git 提交历史。
    .PARAMETER RepoRoot
        Git 仓库根目录。
    .PARAMETER FilePath
        文件绝对路径。
    .PARAMETER Count
        返回的提交条数，默认 10。
    .OUTPUTS
        System.String — git log 输出。
    .EXAMPLE
        Get-FileGitHistory -RepoRoot 'D:\repo' -FilePath 'D:\repo\Source\Foo.cpp'
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$RepoRoot,

        [Parameter(Mandatory)]
        [string]$FilePath,

        [int]$Count = 10
    )

    $relPath = $FilePath
    if ($FilePath.StartsWith($RepoRoot)) {
        $relPath = $FilePath.Substring($RepoRoot.Length).TrimStart('\', '/')
    }

    $output = & git -C $RepoRoot log --oneline "-$Count" -- $relPath 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "git log failed in $RepoRoot for $relPath : $output"
    }

    return ($output -join "`r`n")
}

function Search-KnowledgeBase {
    <#
    .SYNOPSIS
        在知识库中搜索匹配内容。
    .PARAMETER WikiDir
        Wiki 目录路径。
    .PARAMETER RawDir
        Raw 数据目录路径。
    .PARAMETER SearchTerms
        搜索关键词数组。
    .OUTPUTS
        PSCustomObject[] — FilePath, MatchedLine, SearchTerm。
    .EXAMPLE
        Search-KnowledgeBase -WikiDir 'D:\wiki' -RawDir 'D:\raw' -SearchTerms @('C2061', 'LNK2019')
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$WikiDir,

        [Parameter(Mandatory)]
        [string]$RawDir,

        [Parameter(Mandatory)]
        [string[]]$SearchTerms
    )

    $results = [System.Collections.Generic.List[PSCustomObject]]::new()

    # 收集搜索目录
    $searchDirs = @()
    if (Test-Path $WikiDir) { $searchDirs += $WikiDir }
    if (Test-Path $RawDir)  { $searchDirs += $RawDir }
    $detailsDir = Join-Path (Split-Path $RawDir -Parent) 'details'
    if (Test-Path $detailsDir) { $searchDirs += $detailsDir }

    foreach ($dir in $searchDirs) {
        $mdFiles = Get-ChildItem -Path $dir -Recurse -Filter '*.md' -File -ErrorAction SilentlyContinue
        foreach ($file in $mdFiles) {
            $content = Get-Content -Path $file.FullName -Encoding UTF8 -ErrorAction SilentlyContinue
            if (-not $content) { continue }

            foreach ($term in $SearchTerms) {
                $matched = $content | Where-Object { $_ -match [regex]::Escape($term) } | Select-Object -First 3
                foreach ($m in $matched) {
                    $results.Add([PSCustomObject]@{
                        FilePath    = $file.FullName
                        MatchedLine = $m.Trim()
                        SearchTerm  = $term
                    })
                }
            }
        }
    }

    return $results.ToArray()
}

# ============================================================
# Phase 4-6: 修复 + 提交 + 知识积累
# ============================================================

function Invoke-LocalBuild {
    <#
    .SYNOPSIS
        在仓库目录下执行构建命令。
    .PARAMETER RepoRoot
        Git 仓库根目录。
    .PARAMETER BuildCommand
        要执行的构建命令字符串。
    .OUTPUTS
        PSCustomObject — ExitCode, Output, Success。
    .EXAMPLE
        Invoke-LocalBuild -RepoRoot 'D:\repo' -BuildCommand 'Build.bat Win64 Development'
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$RepoRoot,

        [Parameter(Mandatory)]
        [string]$BuildCommand
    )

    $prevDir = Get-Location
    try {
        Set-Location $RepoRoot
        $output = & cmd.exe /c $BuildCommand 2>&1
        $exitCode = $LASTEXITCODE
        return [PSCustomObject]@{
            ExitCode = $exitCode
            Output   = ($output -join "`r`n")
            Success  = ($exitCode -eq 0)
        }
    }
    finally {
        Set-Location $prevDir
    }
}

function New-FixBranch {
    <#
    .SYNOPSIS
        基于 CI 构建的源分支/commit 创建修复分支。
    .DESCRIPTION
        从 Jenkins 日志中解析的源分支和 commit 出发，确保本地仓库
        是基于同一起点创建修复分支（而非从本地 master/dev 头创建）。
    .PARAMETER RepoRoot
        Git 仓库根目录。
    .PARAMETER SourceBranch
        CI 构建的源分支名（如 dev, release）。
    .PARAMETER SourceCommit
        CI 构建的源 commit hash（可选，若提供则精确定位）。
    .PARAMETER FixBranchName
        修复分支名（如 fix/iwyu-missing-includes-524）。
    .OUTPUTS
        PSCustomObject — Success, BranchName, BaseCommit, Error。
    .EXAMPLE
        New-FixBranch -RepoRoot 'D:\Git\AesWorld' -SourceBranch 'dev' -SourceCommit '2edacbdc7' -FixBranchName 'fix/iwyu-524'
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$RepoRoot,

        [Parameter(Mandatory)]
        [string]$SourceBranch,

        [string]$SourceCommit,

        [Parameter(Mandatory)]
        [string]$FixBranchName
    )

    try {
        # 1) fetch 最新源分支（必须成功）
        $fetchOut = & git -C $RepoRoot fetch origin "${SourceBranch}:refs/remotes/origin/${SourceBranch}" 2>&1
        if ($LASTEXITCODE -ne 0 -and $fetchOut -notmatch 'already exists') {
            return [PSCustomObject]@{
                Success    = $false
                BranchName = $null
                BaseCommit = $null
                Error      = "fetch origin/$SourceBranch 失败（无法保证基于最新代码修复）: $($fetchOut -join ' ')"
                IsNew      = $false
            }
        }

        # 2) 检查 CI commit 与 origin/<branch> HEAD 的领先/落后关系
        #    设计原则：修复必须基于"最新 dev"，CI commit 只用来确认上下文一致
        $latestHead = (& git -C $RepoRoot rev-parse "origin/$SourceBranch" 2>&1).Trim()
        $behindCount = 0
        $aheadCount = 0
        if ($SourceCommit) {
            $behindCount = [int]((& git -C $RepoRoot rev-list --count "$SourceCommit..origin/$SourceBranch" 2>&1).Trim())
            $aheadCount = [int]((& git -C $RepoRoot rev-list --count "origin/$SourceBranch..$SourceCommit" 2>&1).Trim())
        }

        # 3) 决定起始点：默认用 origin/<SourceBranch> 最新 HEAD
        #    仅当 SourceCommit 与 origin/HEAD 完全一致时（CI 是最新构建）才用 SourceCommit
        $base = "origin/$SourceBranch"
        $baseDescription = "origin/$SourceBranch (latest HEAD: $($latestHead.Substring(0,8)))"
        if ($SourceCommit -and $behindCount -eq 0 -and $aheadCount -eq 0) {
            $base = $SourceCommit
            $baseDescription = "CI commit $SourceCommit (与 origin/$SourceBranch HEAD 一致)"
        } elseif ($SourceCommit -and $behindCount -gt 0) {
            Write-Warning "CI commit $($SourceCommit.Substring(0,8)) 落后 origin/$SourceBranch HEAD $behindCount 个 commit。将基于最新 HEAD 创建修复分支，确保 MR 不冲突。"
            Write-Host "  落后的 commits:"
            $logOut = & git -C $RepoRoot log --oneline "$SourceCommit..origin/$SourceBranch" 2>&1 | Select-Object -First 5
            $logOut | ForEach-Object { Write-Host "    $_" }
            if ($behindCount -gt 5) { Write-Host "    ... (+$($behindCount - 5) more)" }
        }

        # 4) 检查分支是否已存在
        $existingBranch = & git -C $RepoRoot branch --list $FixBranchName 2>&1
        if ($existingBranch -match $FixBranchName) {
            & git -C $RepoRoot checkout $FixBranchName 2>&1 | Out-Null
            $hash = (& git -C $RepoRoot rev-parse HEAD 2>&1).Trim()
            Write-Host "Fix branch '$FixBranchName' 已存在，HEAD=$($hash.Substring(0,8))"
            return [PSCustomObject]@{
                Success    = $true
                BranchName = $FixBranchName
                BaseCommit = $hash
                BaseDescription = $baseDescription
                Error      = $null
                IsNew      = $false
            }
        }

        # 5) 创建并切换到修复分支（基于最新 HEAD）
        $branchOut = & git -C $RepoRoot checkout -b $FixBranchName $base 2>&1
        if ($LASTEXITCODE -ne 0) {
            return [PSCustomObject]@{
                Success    = $false
                BranchName = $null
                BaseCommit = $null
                Error      = "Failed to create branch: $($branchOut -join ' ')"
                IsNew      = $false
            }
        }

        $hash = (& git -C $RepoRoot rev-parse HEAD 2>&1).Trim()
        Write-Host "Fix branch '$FixBranchName' 已创建，base=$baseDescription, HEAD=$($hash.Substring(0,8))"
        return [PSCustomObject]@{
            Success    = $true
            BranchName = $FixBranchName
            BaseCommit = $hash
            BaseDescription = $baseDescription
            Error      = $null
            IsNew      = $true
        }
    }
    catch {
        return [PSCustomObject]@{
            Success    = $false
            BranchName = $null
            BaseCommit = $null
            Error      = $_.Exception.Message
            IsNew      = $false
        }
    }
}

function Submit-GitChanges {
    <#
    .SYNOPSIS
        安全地提交并推送 git 变更。禁止 --force。
    .PARAMETER RepoRoot
        Git 仓库根目录。
    .PARAMETER Files
        要提交的文件路径数组。
    .PARAMETER Message
        提交消息。
    .OUTPUTS
        PSCustomObject — Success, CommitHash, Error。
    .EXAMPLE
        Submit-GitChanges -RepoRoot 'D:\repo' -Files @('Source\Foo.cpp') -Message 'fix: C2061'
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$RepoRoot,

        [Parameter(Mandatory)]
        [string[]]$Files,

        [Parameter(Mandatory)]
        [string]$Message
    )

    if ($Message -match '--force') {
        return [PSCustomObject]@{ Success = $false; CommitHash = $null; Error = 'Force push is forbidden' }
    }

    try {
        foreach ($f in $Files) {
            & git -C $RepoRoot add $f 2>&1 | Out-Null
        }

        $commitOut = & git -C $RepoRoot commit -m $Message 2>&1
        if ($LASTEXITCODE -ne 0) {
            return [PSCustomObject]@{ Success = $false; CommitHash = $null; Error = "git commit failed: $($commitOut -join ' ')" }
        }

        $hash = (& git -C $RepoRoot rev-parse HEAD 2>&1).Trim()
        $branch = (& git -C $RepoRoot rev-parse --abbrev-ref HEAD 2>&1).Trim()

        $pushOut = & git -C $RepoRoot push -u origin $branch 2>&1
        if ($LASTEXITCODE -ne 0) {
            return [PSCustomObject]@{ Success = $false; CommitHash = $hash; Error = "git push failed: $(($pushOut | ForEach-Object { $_.ToString() }) -join ' ')" }
        }

        return [PSCustomObject]@{ Success = $true; CommitHash = $hash; Branch = $branch; Error = $null }
    }
    catch {
        return [PSCustomObject]@{ Success = $false; CommitHash = $null; Error = $_.Exception.Message }
    }
}

function New-GitLabMergeRequest {
    <#
    .SYNOPSIS
        通过 GitLab API 创建 Merge Request。
    .DESCRIPTION
        从 git remote URL 自动推断 GitLab 实例和项目路径。
        认证优先级：GITLAB_PRIVATE_TOKEN 环境变量 > git credential manager。
    .PARAMETER RepoRoot
        Git 仓库根目录（用于推断 GitLab 项目路径和提取凭据）。
    .PARAMETER SourceBranch
        MR 源分支名。
    .PARAMETER TargetBranch
        MR 目标分支名（默认 dev）。
    .PARAMETER Title
        MR 标题。
    .PARAMETER Description
        MR 描述（Markdown）。
    .OUTPUTS
        PSCustomObject — Success, MRUrl, MRId, Error。
    .EXAMPLE
        New-GitLabMergeRequest -RepoRoot 'D:\Git\AesWorld' -SourceBranch 'fix/xxx' -Title 'fix: xxx'
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$RepoRoot,

        [Parameter(Mandatory)]
        [string]$SourceBranch,

        [string]$TargetBranch = 'dev',

        [Parameter(Mandatory)]
        [string]$Title,

        [string]$Description = '',

        [switch]$RemoveSourceBranch
    )

    try {
        # 从 remote URL 推断 GitLab base URL 和项目路径
        $remoteUrl = (& git -C $RepoRoot remote get-url origin 2>&1).Trim()
        if ($remoteUrl -match '^(https?://[^/]+)/(.+?)(?:\.git)?$') {
            $gitlabBase = $Matches[1]
            $projectPath = $Matches[2]
        }
        else {
            return [PSCustomObject]@{ Success = $false; MRUrl = $null; MRId = $null; Error = "Cannot parse GitLab URL from remote: $remoteUrl" }
        }

        # 解析 host 用于 credential 查询
        $parsedUri = [System.Uri]$remoteUrl
        $gitHost = $parsedUri.Host

        # 认证：优先用 GITLAB_PRIVATE_TOKEN，否则从 git credential manager 提取
        $authArgs = @()
        if ($env:GITLAB_PRIVATE_TOKEN) {
            $authArgs = @('-H', "PRIVATE-TOKEN: $env:GITLAB_PRIVATE_TOKEN")
            Write-Verbose "Using GITLAB_PRIVATE_TOKEN for auth"
        }
        else {
            # 从 git credential manager 提取凭据
            $credInput = "protocol=$($parsedUri.Scheme)`nhost=$gitHost`n`n"
            $credLines = $credInput | git credential fill 2>&1
            $username = $null
            $password = $null
            foreach ($line in $credLines) {
                if ($line -match '^username=(.+)$') { $username = $Matches[1] }
                if ($line -match '^password=(.+)$') { $password = $Matches[1] }
            }
            if ($username -and $password) {
                $authArgs = @('-u', "${username}:${password}")
                Write-Verbose "Using git credential manager for auth (user: $username)"
            }
            else {
                return [PSCustomObject]@{
                    Success = $false
                    MRUrl   = $null
                    MRId    = $null
                    Error   = "No authentication available. Set GITLAB_PRIVATE_TOKEN or configure git credential manager for $gitHost."
                }
            }
        }

        $encodedProject = [System.Uri]::EscapeDataString($projectPath)
        $apiUrl = "$gitlabBase/api/v4/projects/$encodedProject/merge_requests"

        # 构建请求体
        $bodyObj = @{
            source_branch = $SourceBranch
            target_branch = $TargetBranch
            title         = $Title
        }
        if ($Description) { $bodyObj.description = $Description }
        if ($PSBoundParameters.ContainsKey('RemoveSourceBranch')) { $bodyObj.remove_source_branch = [bool]$RemoveSourceBranch }
        # -Depth 10 防止嵌套对象被截断；不使用 -Compress 以避免 PS 5.1 转义不全
        $bodyJson = $bodyObj | ConvertTo-Json -Depth 10

        # 使用 curl.exe 调用 API（避免 PowerShell HTTP 客户端被拦截）
        # 将 JSON 写入临时文件再用 @file 引用，规避命令行长度限制和 shell 转义问题
        $bodyFile = Join-Path $env:TEMP ("gl_mr_body_" + [System.Guid]::NewGuid().ToString("N") + ".json")
        [System.IO.File]::WriteAllText($bodyFile, $bodyJson, [System.Text.UTF8Encoding]::new($false))
        try {
            $allArgs = @('-s', '-w', "`n%{http_code}", '-X', 'POST', $apiUrl) + $authArgs + @('-H', 'Content-Type: application/json', '--data-binary', "@$bodyFile")
            $resp = & curl.exe @allArgs 2>&1
        } finally {
            Remove-Item $bodyFile -Force -ErrorAction SilentlyContinue
        }

        # 解析响应（最后一行是 HTTP 状态码）
        $respText = ($resp | ForEach-Object { $_.ToString() }) -join "`n"
        $respLines = $respText -split "`n"
        $httpCode = $respLines[-1].Trim()
        $respBody = ($respLines[0..($respLines.Count - 2)]) -join "`n"

        if ($httpCode -match '^2\d\d$') {
            $mr = $respBody | ConvertFrom-Json
            return [PSCustomObject]@{
                Success = $true
                MRUrl   = $mr.web_url
                MRId    = $mr.iid
                Error   = $null
            }
        }
        else {
            $errMsg = $respBody
            try { $errMsg = ($respBody | ConvertFrom-Json).message -join '; ' } catch {}

            # API 认证失败时，回退生成手动 MR URL
            $manualUrl = $null
            if ($httpCode -eq '401' -or $httpCode -eq '403') {
                $encodedSource = [System.Uri]::EscapeDataString($SourceBranch)
                $encodedTarget = [System.Uri]::EscapeDataString($TargetBranch)
                $manualUrl = "$gitlabBase/$projectPath/-/merge_requests/new?merge_request%5Bsource_branch%5D=$encodedSource&merge_request%5Btarget_branch%5D=$encodedTarget"
            }

            return [PSCustomObject]@{
                Success   = $false
                MRUrl     = $manualUrl
                MRId      = $null
                Error     = "GitLab API returned HTTP $httpCode`: $errMsg"
                ManualUrl = $manualUrl
            }
        }
    }
    catch {
        return [PSCustomObject]@{
            Success = $false
            MRUrl   = $null
            MRId    = $null
            Error   = $_.Exception.Message
        }
    }
}

function Save-KnowledgeEntry {
    <#
    .SYNOPSIS
        保存错误知识条目到知识库。
    .PARAMETER RawDir
        Raw 数据目录路径。
    .PARAMETER JobShort
        Job 短名。
    .PARAMETER BuildNumber
        构建编号。
    .PARAMETER ErrorCode
        错误代码（如 C2061、LNK2019）。
    .PARAMETER ShortDesc
        简短描述。
    .PARAMETER Content
        完整的知识条目内容（Markdown）。
    .OUTPUTS
        System.String — 保存的文件路径。
    .EXAMPLE
        Save-KnowledgeEntry -RawDir 'D:\raw' -JobShort 'Build' -BuildNumber 42 -ErrorCode 'C2061' -ShortDesc 'missing include' -Content '...'
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$RawDir,

        [Parameter(Mandatory)]
        [string]$JobShort,

        [Parameter(Mandatory)]
        [int]$BuildNumber,

        [Parameter(Mandatory)]
        [string]$ErrorCode,

        [Parameter(Mandatory)]
        [string]$ShortDesc,

        [Parameter(Mandatory)]
        [string]$Content
    )

    $detailsDir = Join-Path $RawDir 'details'
    if (-not (Test-Path $detailsDir)) {
        New-Item -ItemType Directory -Path $detailsDir -Force | Out-Null
    }

    # 检查是否有重复条目（同错误代码+类似描述）
    $existing = Get-ChildItem -Path $detailsDir -Filter '*.md' -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match [regex]::Escape($ErrorCode) }

    foreach ($ex in $existing) {
        $header = Get-Content -Path $ex.FullName -TotalCount 5 -Encoding UTF8 -ErrorAction SilentlyContinue
        $headerText = $header -join ' '
        if ($headerText -match [regex]::Escape($ShortDesc)) {
            # 追加更新
            $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
            $appendix = "`r`n`r`n---`r`n## Update: ${JobShort}#${BuildNumber} ($(Get-Date -Format 'yyyy-MM-dd'))`r`n`r`n${Content}"
            [System.IO.File]::AppendAllText($ex.FullName, $appendix, $utf8NoBom)
            Write-Verbose "Updated existing entry: $($ex.FullName)"
            return $ex.FullName
        }
    }

    # 新建条目
    $safeCode = $ErrorCode -replace '[^a-zA-Z0-9_-]', '_'
    $safeDesc = ($ShortDesc -replace '[^a-zA-Z0-9_-]', '_').Substring(0, [Math]::Min($ShortDesc.Length, 40))
    $ts = Get-Date -Format 'yyyyMMdd'
    $fileName = "${safeCode}_${safeDesc}_${ts}.md"
    $filePath = Join-Path $detailsDir $fileName

    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    $fileContent = "# ${ErrorCode}: ${ShortDesc}`r`n`r`n" +
                   "- **Job**: ${JobShort}#${BuildNumber}`r`n" +
                   "- **Date**: $(Get-Date -Format 'yyyy-MM-dd HH:mm')`r`n`r`n" +
                   $Content
    [System.IO.File]::WriteAllText($filePath, $fileContent, $utf8NoBom)

    return $filePath
}

# ============================================================
# Phase 0.5: 环境前置检查
# ============================================================

function Test-EnvironmentReadiness {
    <#
    .SYNOPSIS
        Phase 0.5 环境前置检查：验证 config、gitRepos、仓库可用性。
        避免 LLM 绕过 config 在 tmp 目录重新 clone 仓库。
    .DESCRIPTION
        检查清单：
        1. config.json 存在且 JSON 合法
        2. config.gitRepos 目录存在
        3. 错误日志提到的仓库名在 $gitRepos/<RepoName> 下存在（缺失时给出 clone 指引）
        4. 本地仓库 origin remote 与 CI GitLab 一致
    .PARAMETER Config
        Read-SkillConfig 返回的配置对象。
    .PARAMETER RepoNames
        需要检查的仓库名数组（从错误日志里提取，如 @('AesWorld')）。
    .PARAMETER ExpectedRemoteUrl
        期望的 remote URL 片段（可选，用于校验 origin 是否指向正确的 GitLab）。
    .OUTPUTS
        PSCustomObject — Ready (bool), Errors (array), Warnings (array), MissingRepos (array)。
    .EXAMPLE
        $cfg = Read-SkillConfig
        $check = Test-EnvironmentReadiness -Config $cfg -RepoNames @('AesWorld')
        if (-not $check.Ready) { Write-Error $check.Errors; exit 1 }
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [PSCustomObject]$Config,

        [string[]]$RepoNames = @(),

        [string]$ExpectedRemoteUrl
    )

    $errors = @()
    $warnings = @()
    $missingRepos = @()

    # 检查 1: config 必须有 gitRepos
    if (-not $Config.PSObject.Properties['gitRepos']) {
        $errors += "Config missing required property: gitRepos"
        return [PSCustomObject]@{
            Ready        = $false
            Errors       = $errors
            Warnings     = $warnings
            MissingRepos = $missingRepos
        }
    }

    $gitReposRoot = Resolve-ConfigPath -Path $Config.gitRepos

    # 检查 2: gitRepos 目录存在
    if (-not (Test-Path $gitReposRoot)) {
        $errors += "gitRepos directory not found: $gitReposRoot"
        return [PSCustomObject]@{
            Ready        = $false
            Errors       = $errors
            Warnings     = $warnings
            MissingRepos = $missingRepos
        }
    }

    # 检查 3: 每个 RepoName 在 gitRepos 下存在
    foreach ($repo in $RepoNames) {
        $repoPath = Join-Path $gitReposRoot $repo
        if (-not (Test-Path $repoPath)) {
            $missingRepos += $repo
            $warnings += "Repo '$repo' not found under gitRepos ($gitReposRoot). To set up, run: git clone <GitLab URL>/$repo.git `"$repoPath`""
        }
        else {
            # 检查 4: origin remote 校验
            $remoteUrl = (& git -C $repoPath remote get-url origin 2>&1).ToString().Trim()
            if ($LASTEXITCODE -ne 0) {
                $warnings += "Repo '$repo' has no 'origin' remote configured."
            }
            elseif ($ExpectedRemoteUrl -and ($remoteUrl -notmatch [regex]::Escape($ExpectedRemoteUrl))) {
                $warnings += "Repo '$repo' origin ($remoteUrl) does not match expected ($ExpectedRemoteUrl)."
            }
        }
    }

    $ready = ($errors.Count -eq 0) -and ($missingRepos.Count -eq 0)

    return [PSCustomObject]@{
        Ready        = $ready
        Errors       = $errors
        Warnings     = $warnings
        MissingRepos = $missingRepos
        GitReposRoot = $gitReposRoot
    }
}

function Assert-LocalBuildPassed {
    <#
    .SYNOPSIS
        Phase 5 前置硬性门禁：断言本地编译已通过。
        若用户明确豁免，需传入 -UserWaived 才允许跳过。
    .PARAMETER BuildResult
        Invoke-LocalBuild 返回的对象。
    .PARAMETER UserWaived
        用户明确豁免（开关）。True 时不抛错，但仍记录警告。
    .OUTPUTS
        bool — 是否允许进入 Phase 5。
    .EXAMPLE
        $result = Invoke-LocalBuild -RepoRoot $repo -BuildCommand $cmd
        if (-not (Assert-LocalBuildPassed -BuildResult $result)) { exit 1 }
        Assert-LocalBuildPassed -BuildResult $result -UserWaived  # 用户豁免
    #>
    [CmdletBinding()]
    param(
        [PSCustomObject]$BuildResult,

        [switch]$UserWaived
    )

    if ($UserWaived) {
        Write-Warning "User waived local build verification. Phase 5 proceeding without compile check."
        return $true
    }

    if (-not $BuildResult) {
        Write-Error "Cannot enter Phase 5: Invoke-LocalBuild was not run. Run it first or pass -UserWaived to skip."
        return $false
    }

    if (-not $BuildResult.Success) {
        Write-Error "Cannot enter Phase 5: local build failed (ExitCode=$($BuildResult.ExitCode)). Fix the error or pass -UserWaived to skip."
        return $false
    }

    return $true
}

function Assert-FilesInGitRepos {
    <#
    .SYNOPSIS
        Phase 5 前置硬性门禁：断言要提交的文件都在 $config.gitRepos 下，
        防止 LLM 在 tmp/clone 副本里修改后提交。
    .PARAMETER Files
        待提交的文件绝对路径数组。
    .PARAMETER GitReposRoot
        $config.gitRepos 解析后的绝对路径。
    .OUTPUTS
        bool — 是否所有文件都在 gitRepos 下。
    .EXAMPLE
        $ok = Assert-FilesInGitRepos -Files @('D:\Git\AesWorld\Source\Foo.cpp') -GitReposRoot 'D:\Git'
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string[]]$Files,

        [Parameter(Mandatory)]
        [string]$GitReposRoot
    )

    $normalizedRoot = (Resolve-Path $GitReposRoot).Path.TrimEnd('\', '/')

    foreach ($f in $Files) {
        try {
            $resolved = (Resolve-Path $f -ErrorAction Stop).Path
        }
        catch {
            Write-Error "File not found: $f"
            return $false
        }
        if ($resolved -notlike "$normalizedRoot*") {
            Write-Error "Refusing to commit file outside gitRepos: $resolved (gitRepos root: $normalizedRoot). Use the canonical checkout under $normalizedRoot instead of a tmp/clone."
            return $false
        }
    }
    return $true
}

# ============================================================
# 模块导出
# ============================================================

Export-ModuleMember -Function @(
    'Read-SkillConfig',
    'Resolve-ConfigPath',
    'Assert-ConfigPaths',
    'Test-EnvironmentReadiness',
    'Assert-LocalBuildPassed',
    'Assert-FilesInGitRepos',
    'New-TempWorkDir',
    'Parse-JenkinsBuildUrl',
    'Extract-RepoCheckouts',
    'Find-JenkinsJob',
    'Get-JenkinsConsoleLog',
    'Get-JenkinsBuildResult',
    'Save-JenkinsLog',
    'Extract-ErrorBlocks',
    'Extract-BuildCommand',
    'Resolve-ErrorFileInRepo',
    'Get-SourceContext',
    'Get-FileGitHistory',
    'Search-KnowledgeBase',
    'Invoke-LocalBuild',
    'New-FixBranch',
    'Submit-GitChanges',
    'New-GitLabMergeRequest',
    'Save-KnowledgeEntry'
)
