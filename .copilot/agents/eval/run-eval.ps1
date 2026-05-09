# DEPRECATED: This script has been replaced by the Node.js version (.js). Use the .js version instead.
#Requires -Version 5.1
<#
.SYNOPSIS
    对 subagent 行为数据运行声明式断言测试。

.DESCRIPTION
    从 extract-outputs.ps1 的 JSON 输出中读取 subagent invocation 数据，
    加载 YAML 测试用例，逐条运行断言，输出带格式的评估报告。

.EXAMPLE
    # 先提取数据
    .\extract-outputs.ps1 -OutputPath .\eval-data.json
    # 再跑测试
    .\run-eval.ps1 -DataPath .\eval-data.json

    # 只测 Worker
    .\run-eval.ps1 -DataPath .\eval-data.json -AgentFilter Worker -Detail

    # JSON 输出
    .\run-eval.ps1 -DataPath .\eval-data.json -Json
#>
param(
    [Parameter(Mandatory)]
    [string]$DataPath,          # extract-outputs.ps1 输出的 JSON 文件路径
    [string]$TestDir,           # 测试用例目录（默认 $PSScriptRoot\test-cases）
    [string]$AgentFilter,       # 可选，只跑特定 agent 的测试
    [switch]$Detail,            # 显示失败示例详情
    [switch]$Json               # 以 JSON 格式输出结果（供程序消费）
)

$ErrorActionPreference = 'Stop'

if (-not $TestDir) {
    $TestDir = Join-Path $PSScriptRoot 'test-cases'
}

# ── 加载评估数据 ──────────────────────────────────────
if (-not (Test-Path $DataPath)) {
    Write-Error "数据文件不存在: $DataPath"
    return
}

try {
    $rawJson = [System.IO.File]::ReadAllText((Resolve-Path $DataPath).Path, [System.Text.Encoding]::UTF8)
    $data = $rawJson | ConvertFrom-Json -ErrorAction Stop
} catch {
    Write-Error "无法解析数据文件: $_"
    return
}

if (-not $data.invocations) {
    Write-Error "数据文件缺少 invocations 字段"
    return
}

# ── 简易 YAML 解析器（零依赖，纯正则逐行） ───────────
function Parse-TestYaml {
    param([string]$Path)

    $lines = [System.IO.File]::ReadAllLines($Path)
    $agent = ''
    $tests = [System.Collections.Generic.List[hashtable]]::new()
    $currentTest = $null
    $inList = $false
    $listKey = ''
    $listItems = $null

    foreach ($line in $lines) {
        # 跳过注释和空行
        if ($line -match '^\s*#' -or [string]::IsNullOrWhiteSpace($line)) { continue }

        # 结束前一个 list（如果遇到非 list-item 行）
        if ($inList -and $line -notmatch '^\s+-\s+') {
            if ($currentTest -and $listKey -and $listItems) {
                $currentTest[$listKey] = [array]$listItems
            }
            $inList = $false
            $listKey = ''
            $listItems = $null
        }

        # 顶层 agent 字段
        if ($line -match '^agent:\s*(.+)$') {
            $agent = $Matches[1].Trim().Trim('"').Trim("'")
            continue
        }

        # tests: 头（跳过）
        if ($line -match '^tests:\s*$') { continue }

        # 新测试项: "  - name: ..."
        if ($line -match '^\s+-\s+name:\s*(.+)$') {
            if ($currentTest) { $tests.Add($currentTest) }
            $currentTest = @{ name = $Matches[1].Trim().Trim('"').Trim("'") }
            continue
        }

        # 测试属性: "    key: value" 或 "    key:"（list 开始）
        if ($currentTest -and $line -match '^\s{4,}(\w[\w_]*):\s*(.*)$') {
            $key = $Matches[1].Trim()
            $val = $Matches[2].Trim()

            if ([string]::IsNullOrEmpty($val)) {
                # 可能是 list 的开始
                $inList = $true
                $listKey = $key
                $listItems = [System.Collections.Generic.List[string]]::new()
                continue
            }

            # 去引号
            $val = $val.Trim('"').Trim("'")

            # 布尔值
            if ($val -eq 'true')  { $currentTest[$key] = $true;  continue }
            if ($val -eq 'false') { $currentTest[$key] = $false; continue }

            # 数值（整数或浮点）
            $numVal = 0.0
            if ([double]::TryParse($val, [ref]$numVal) -and $val -match '^\d+\.?\d*$') {
                $currentTest[$key] = $numVal
                continue
            }

            $currentTest[$key] = $val
            continue
        }

        # 单层 list item: "      - item"
        if ($inList -and $line -match '^\s+-\s+(.+)$') {
            $listItems.Add($Matches[1].Trim().Trim('"').Trim("'"))
            continue
        }
    }

    # 收尾
    if ($inList -and $currentTest -and $listKey -and $listItems) {
        $currentTest[$listKey] = [array]$listItems
    }
    if ($currentTest) { $tests.Add($currentTest) }

    return @{ agent = $agent; tests = [array]$tests }
}

# ── 加载测试用例 ──────────────────────────────────────
if (-not (Test-Path $TestDir)) {
    Write-Error "测试用例目录不存在: $TestDir"
    return
}

$yamlFiles = @(Get-ChildItem $TestDir -Filter '*.yaml' -ErrorAction SilentlyContinue) +
             @(Get-ChildItem $TestDir -Filter '*.yml'  -ErrorAction SilentlyContinue)

if ($yamlFiles.Count -eq 0) {
    Write-Error "未找到测试用例文件 (*.yaml / *.yml) in $TestDir"
    return
}

$testSuites = [System.Collections.Generic.List[hashtable]]::new()
foreach ($yf in $yamlFiles) {
    try {
        $suite = Parse-TestYaml -Path $yf.FullName
        if ($suite.agent -and $suite.tests.Count -gt 0) {
            $testSuites.Add($suite)
        }
    } catch {
        Write-Warning "跳过无法解析的测试文件: $($yf.Name) — $_"
    }
}

if ($testSuites.Count -eq 0) {
    Write-Error "未解析到有效的测试套件"
    return
}

# ── 严重级别 → 通过阈值 ──────────────────────────────
$severityThresholds = @{
    'critical' = 1.0
    'high'     = 0.90
    'medium'   = 0.80
    'low'      = 0.50
}

function Get-PassThreshold {
    param([string]$Severity)
    if (-not $Severity) { return 0.80 }
    $sev = $Severity.ToLower()
    if ($severityThresholds.ContainsKey($sev)) { return $severityThresholds[$sev] }
    return 0.80
}

# ── 断言执行（8 种 check_type） ──────────────────────
function Test-Invocation {
    param(
        [PSCustomObject]$Invocation,
        [hashtable]$TestCase
    )

    $checkType = $TestCase['check_type']
    $value     = $TestCase['value']
    $out       = if ($Invocation.output) { [string]$Invocation.output } else { '' }

    # toolCalls 是 hashtable (name → count)，从 JSON 反序列化后是 PSCustomObject
    $toolCallsObj = $Invocation.toolCalls

    switch ($checkType) {
        'output_regex' {
            if (-not $value) { return $false }
            return [bool]($out -match $value)
        }
        'output_contains' {
            if (-not $value) { return $false }
            return $out.Contains([string]$value)
        }
        'output_not_contains' {
            if (-not $value) { return $true }
            return -not $out.Contains([string]$value)
        }
        'trace_has_tool' {
            if (-not $value) { return $false }
            if ($toolCallsObj -is [hashtable]) {
                return $toolCallsObj.ContainsKey($value)
            }
            # PSCustomObject from JSON deserialization
            $members = @($toolCallsObj.PSObject.Properties | ForEach-Object { $_.Name })
            return $members -contains $value
        }
        'trace_no_tool' {
            if (-not $value) { return $true }
            if ($toolCallsObj -is [hashtable]) {
                return -not $toolCallsObj.ContainsKey($value)
            }
            $members = @($toolCallsObj.PSObject.Properties | ForEach-Object { $_.Name })
            return $members -notcontains $value
        }
        'log_size_max' {
            $maxKb = [double]$value
            return $Invocation.logSizeKB -le $maxKb
        }
        'log_size_min' {
            $minKb = [double]$value
            return $Invocation.logSizeKB -ge $minKb
        }
        'flag_absent' {
            # value 是 flag 名称（如 hasNestedDispatch），检查其值为 $false
            if (-not $value) { return $true }
            $flagVal = $Invocation.$value
            return -not [bool]$flagVal
        }
        'tool_error_absent' {
            # 断言指定类别的工具错误不应出现
            if (-not $value) { return $true }
            $errCats = $Invocation.toolErrorCategories
            if (-not $errCats) { return $true }
            if ($errCats -is [hashtable]) {
                return -not $errCats.ContainsKey($value)
            }
            # PSCustomObject
            $members = @($errCats.PSObject.Properties | ForEach-Object { $_.Name })
            return $members -notcontains $value
        }
        'tool_success_rate_min' {
            # 断言工具调用成功率不低于某值（百分比）
            $minRate = [double]$value
            $rate = $Invocation.toolSuccessRate
            if ($null -eq $rate) {
                # 没有工具调用时视为通过
                return ($Invocation.totalToolCalls -eq 0)
            }
            return [double]$rate -ge $minRate
        }
        'code_changes_max' {
            # 断言代码变更不超过某数量（文件创建 + 文件修改）
            $maxChanges = [int]$value
            $changes = $Invocation.codeChanges
            if (-not $changes) { return $true }
            $total = 0
            if ($changes.filesCreated)  { $total += [int]$changes.filesCreated }
            if ($changes.filesModified) { $total += [int]$changes.filesModified }
            return $total -le $maxChanges
        }
        default {
            Write-Warning "未知的 check_type: $checkType"
            return $false
        }
    }
}

# ── 执行评估 ──────────────────────────────────────────
$agentResults = [ordered]@{}
$allTestResults = [System.Collections.Generic.List[hashtable]]::new()
$totalAgents = 0

foreach ($suite in $testSuites) {
    $agent = $suite.agent
    if ($AgentFilter -and $agent -ne $AgentFilter) { continue }

    $agentInvocations = @($data.invocations | Where-Object { $_.agentName -eq $agent })
    $invCount = $agentInvocations.Count

    # 没有匹配的 invocation 时跳过（不报错）
    if ($invCount -eq 0) { continue }

    $totalAgents++

    if (-not $agentResults.Contains($agent)) {
        $agentResults[$agent] = @{
            invocationCount = $invCount
            tests           = [System.Collections.Generic.List[hashtable]]::new()
        }
    }

    foreach ($test in $suite.tests) {
        $passCount = 0
        $failExamples = [System.Collections.Generic.List[hashtable]]::new()

        foreach ($inv in $agentInvocations) {
            $passed = Test-Invocation -Invocation $inv -TestCase $test
            if ($passed) {
                $passCount++
            } else {
                if ($failExamples.Count -lt 3) {
                    $failExamples.Add(@{
                        logFile = $inv.logFile
                        output  = if ($inv.output) { [string]$inv.output } else { '' }
                    })
                }
            }
        }

        $rate = if ($invCount -gt 0) { $passCount / $invCount } else { 0 }
        $sev = if ($test['severity']) { [string]$test['severity'] } else { 'medium' }
        $threshold = Get-PassThreshold -Severity $sev
        $testPassed = $rate -ge $threshold

        $testResult = @{
            agent        = $agent
            name         = $test['name']
            check_type   = $test['check_type']
            severity     = $sev
            passCount    = $passCount
            total        = $invCount
            rate         = $rate
            threshold    = $threshold
            passed       = $testPassed
            failExamples = [array]$failExamples
        }

        $agentResults[$agent].tests.Add($testResult)
        $allTestResults.Add($testResult)
    }
}

# ── 统计汇总 ──────────────────────────────────────────
$totalTests    = $allTestResults.Count
$totalPassed   = @($allTestResults | Where-Object { $_.passed }).Count
$deadRules     = @($allTestResults | Where-Object { $_.rate -lt 0.10 }).Count
$weakRules     = @($allTestResults | Where-Object { $_.rate -ge 0.10 -and $_.rate -lt 0.50 }).Count
$effectiveRules = @($allTestResults | Where-Object { $_.rate -ge 0.80 }).Count

$totalInv = if ($data.summary -and $data.summary.totalInvocations) {
    $data.summary.totalInvocations
} else {
    @($data.invocations).Count
}

# ── JSON 输出模式 ─────────────────────────────────────
if ($Json) {
    $jsonOutput = [ordered]@{
        agents  = [ordered]@{}
        summary = [ordered]@{
            totalTests      = $totalTests
            passedThreshold = $totalPassed
            deadRules       = $deadRules
            weakRules       = $weakRules
            effectiveRules  = $effectiveRules
        }
    }

    foreach ($agent in $agentResults.Keys) {
        $ar = $agentResults[$agent]
        $agentTests = [System.Collections.Generic.List[ordered]]::new()
        foreach ($tr in $ar.tests) {
            $agentTests.Add([ordered]@{
                name       = $tr.name
                check_type = $tr.check_type
                severity   = $tr.severity
                passed     = $tr.passCount
                total      = $tr.total
                rate       = [math]::Round($tr.rate, 4)
                result     = if ($tr.passed) { 'PASS' } else { 'FAIL' }
            })
        }
        $jsonOutput.agents[$agent] = [ordered]@{
            invocations = $ar.invocationCount
            tests       = [array]$agentTests
        }
    }

    $jsonOutput | ConvertTo-Json -Depth 10
    return
}

# ── 终端报告输出 ──────────────────────────────────────
# Unicode box drawing characters (PS 5.1 compatible)
$borderH  = [string][char]0x2550
$borderTL = [char]0x2554
$borderTR = [char]0x2557
$borderBL = [char]0x255A
$borderBR = [char]0x255D
$borderV  = [char]0x2551
$thinH    = [string][char]0x2501

$boxWidth = 54

function Pad-Right {
    param([string]$Text, [int]$Width)
    if ($Text.Length -ge $Width) { return $Text }
    return $Text + (' ' * ($Width - $Text.Length))
}

$topBorder = $borderTL + ($borderH * $boxWidth) + $borderTR
$botBorder = $borderBL + ($borderH * $boxWidth) + $borderBR

$line1 = Pad-Right '  Parking Agents — Behavioral Eval Report' $boxWidth
$line2 = Pad-Right "  Data: $(Split-Path $DataPath -Leaf) ($totalInv invocations)" $boxWidth
$line3 = Pad-Right "  Test cases: $totalAgents agents, $totalTests tests" $boxWidth

Write-Host ''
Write-Host $topBorder
Write-Host "$borderV$line1$borderV"
Write-Host "$borderV$line2$borderV"
Write-Host "$borderV$line3$borderV"
Write-Host $botBorder
Write-Host ''

# Emoji via [char] for PS 5.1 compat
$checkMark = [char]0x2705  # ✅
$crossMark = [char]0x274C  # ❌
$warnMark  = [char]0x26A0  # ⚠
$arrowDown = [char]0x2190  # ←
$treeT     = [char]0x251C  # ├
$treeL     = [char]0x2514  # └
$treeV     = [char]0x2502  # │
$thinBar   = [char]0x2501  # ━

foreach ($agent in $agentResults.Keys) {
    $ar = $agentResults[$agent]
    $invCount = $ar.invocationCount

    $sectionHeader = "$thinBar$thinBar$thinBar $agent ($invCount invocations) "
    $pad = [math]::Max(0, 54 - $sectionHeader.Length)
    $sectionHeader += ([string]$thinBar) * $pad
    Write-Host $sectionHeader
    Write-Host ''

    foreach ($tr in $ar.tests) {
        $pctVal = $tr.rate * 100
        $pctStr = '{0:F1}%' -f $pctVal
        $countStr = "$($tr.passCount)/$($tr.total)"
        $sevStr = "[$($tr.severity)]"

        # Determine icon and color
        if ($tr.passed) {
            $icon = "$checkMark PASS"
            $color = 'Green'
        } else {
            # Distinguish FAIL vs WARN: if rate >= threshold * 0.9 (close), still FAIL
            $icon = "$crossMark FAIL"
            $color = 'Red'
            # Show as WARN if rate is close to threshold but not critical
            if ($tr.rate -ge ($tr.threshold * 0.9) -and $tr.severity -ne 'critical') {
                $icon = "$warnMark WARN"
                $color = 'Yellow'
            }
        }

        $nameStr = $tr.name
        $namePad = [math]::Max(1, 24 - $nameStr.Length)
        $sevPad  = [math]::Max(1, 12 - $sevStr.Length)

        $line = "  $icon  $nameStr$(' ' * $namePad)$sevStr$(' ' * $sevPad)$countStr ($pctStr)"
        if (-not $tr.passed) {
            $thresholdPct = '{0:F0}%' -f ($tr.threshold * 100)
            $line += " $arrowDown threshold $thresholdPct"
        }

        Write-Host $line -ForegroundColor $color

        # -Detail 模式：显示失败示例
        if (-not $tr.passed -and $Detail -and $tr.failExamples.Count -gt 0) {
            $exCount = $tr.failExamples.Count
            for ($i = 0; $i -lt $exCount; $i++) {
                $ex = $tr.failExamples[$i]
                $exNum = $i + 1
                $logName = if ($ex.logFile) { Split-Path $ex.logFile -Leaf } else { '(unknown)' }
                $connector = if ($i -lt $exCount - 1) { $treeT } else { $treeL }
                $cont      = if ($i -lt $exCount - 1) { $treeV } else { ' ' }

                Write-Host "    $connector$([char]0x2500) Example ${exNum}: $logName" -ForegroundColor DarkGray
                if ($ex.output) {
                    $snippet = $ex.output
                    if ($snippet.Length -gt 80) { $snippet = $snippet.Substring(0, 80) + '...' }
                    Write-Host "    $cont   Output: `"$snippet`"" -ForegroundColor DarkGray
                }
            }
        }
    }
    Write-Host ''
}

# ── 总览 ──────────────────────────────────────────────
$summaryBorder = ($borderH * $boxWidth + $borderH * 2)
Write-Host $summaryBorder
Write-Host ''

Write-Host ([char]::ConvertFromUtf32(0x1F4CA)) "Rule Health Summary:" -NoNewline
Write-Host ''
Write-Host "  Dead rules    (<10% pass rate):  $deadRules"
Write-Host "  Weak rules    (10-50%):          $weakRules"
Write-Host "  Effective     (>80%):            $effectiveRules"
Write-Host ''

$trophy = [char]::ConvertFromUtf32(0x1F3C6)
Write-Host "$trophy Overall: $totalPassed/$totalTests rules passed threshold"
Write-Host ''
