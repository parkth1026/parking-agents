# DEPRECATED: This script has been replaced by the Node.js version (.js). Use the .js version instead.
#Requires -Version 5.1
<#
.SYNOPSIS
    生成 LLM 语义分析 HTML 报告（定性分析部分）。

.DESCRIPTION
    读取 facets-cache 和 insight-narratives 数据，生成单文件暗色主题 HTML 报告，
    包含目标分布、成果分析、满意度、摩擦分析、叙事洞察等 LLM 语义分析维度。
    不包含量化指标（工具、Token、时间、代码变更等）。

.EXAMPLE
    .\generate-qual-report.ps1 -DataPath .\insight-data.json
    .\generate-qual-report.ps1 -DataPath .\insight-data.json -FacetsPath .\facets-cache -NarrativesPath .\insight-narratives.json
#>
param(
    [Parameter(Mandatory)][string]$DataPath,
    [string]$FacetsPath = 'facets-cache',
    [string]$NarrativesPath = '',
    [string]$OutputPath = 'insight-qual-report.html',
    [string]$Title = 'VS Code Copilot Insight Report — LLM 语义分析'
)

$ErrorActionPreference = 'Stop'

# ── 加载数据（仅用于 header 上下文）──────────────────
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

$meta = $data.meta
$sessions = @($data.sessions)
$agg = $data.aggregated
$now = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

# ── 加载分面数据 ──────────────────────────────────────
$facetsData = @()
$hasFacets = $false
if (Test-Path $FacetsPath) {
    $facetsFiles = Get-ChildItem -Path $FacetsPath -Filter "*.json" -ErrorAction SilentlyContinue
    foreach ($ff in $facetsFiles) {
        $facetsData += (Get-Content $ff.FullName -Raw | ConvertFrom-Json)
    }
    if ($facetsData.Count -gt 0) { $hasFacets = $true }
}

# ── 加载叙事数据 ──────────────────────────────────────
$narratives = $null
$hasNarratives = $false
if ($NarrativesPath -and (Test-Path $NarrativesPath)) {
    $narratives = Get-Content $NarrativesPath -Raw | ConvertFrom-Json
    $hasNarratives = $true
}

# ── 检查是否有数据可展示 ─────────────────────────────
if (-not $hasFacets -and -not $hasNarratives) {
    Write-Warning "无 facets 数据也无 narratives 数据，报告将仅包含警告提示。"
}

# ── 聚合分面统计 ──────────────────────────────────────
$goalDistribution = @{}
$outcomeDistribution = @{}
$satisfactionDistribution = @{}
$frictionDistribution = @{}
$sessionTypeDistribution = @{}
$helpfulnessDistribution = @{}
if ($hasFacets) {
    foreach ($f in $facetsData) {
        $fc = $f.facets
        if (-not $fc) { $fc = $f }
        # goalCategories is an array of category strings
        if ($fc.goalCategories) {
            foreach ($cat in $fc.goalCategories) {
                $k = "$cat"
                if ($goalDistribution.ContainsKey($k)) { $goalDistribution[$k]++ } else { $goalDistribution[$k] = 1 }
            }
        }
        # outcome is a single string like "mostly_achieved"
        if ($fc.outcome) {
            $k = "$($fc.outcome)"
            if ($outcomeDistribution.ContainsKey($k)) { $outcomeDistribution[$k]++ } else { $outcomeDistribution[$k] = 1 }
        }
        # userSatisfaction is an object with .overall string
        if ($fc.userSatisfaction) {
            $satKey = if ($fc.userSatisfaction.overall) { "$($fc.userSatisfaction.overall)" } else { "$($fc.userSatisfaction)" }
            if ($satisfactionDistribution.ContainsKey($satKey)) { $satisfactionDistribution[$satKey]++ } else { $satisfactionDistribution[$satKey] = 1 }
        }
        # frictionCounts is an object with keys like wrong_approach=1, hallucination=0, etc.
        if ($fc.frictionCounts) {
            $fricProps = if ($fc.frictionCounts -is [hashtable]) { $fc.frictionCounts.GetEnumerator() } else { $fc.frictionCounts.PSObject.Properties }
            foreach ($fp in $fricProps) {
                $fName = if ($fp.Key) { $fp.Key } else { $fp.Name }
                $fVal  = if ($fp.Key) { $fp.Value } else { $fp.Value }
                if ([int]$fVal -gt 0) {
                    if ($frictionDistribution.ContainsKey($fName)) { $frictionDistribution[$fName] += [int]$fVal } else { $frictionDistribution[$fName] = [int]$fVal }
                }
            }
        }
        # sessionType is a single string
        if ($fc.sessionType) {
            $k = "$($fc.sessionType)"
            if ($sessionTypeDistribution.ContainsKey($k)) { $sessionTypeDistribution[$k]++ } else { $sessionTypeDistribution[$k] = 1 }
        }
        # claudeHelpfulness is a single string
        if ($fc.claudeHelpfulness) {
            $k = "$($fc.claudeHelpfulness)"
            if ($helpfulnessDistribution.ContainsKey($k)) { $helpfulnessDistribution[$k]++ } else { $helpfulnessDistribution[$k] = 1 }
        }
    }
}

# ── HTML 辅助函数 ─────────────────────────────────────
function HE {
    param([string]$Text)
    if (-not $Text) { return '' }
    return $Text.Replace('&','&amp;').Replace('<','&lt;').Replace('>','&gt;').Replace('"','&quot;')
}

function Format-Number {
    param([long]$N)
    if ($N -ge 1000000000) { return "$([math]::Round($N/1000000000, 1))B" }
    if ($N -ge 1000000)    { return "$([math]::Round($N/1000000, 1))M" }
    if ($N -ge 1000)       { return "$([math]::Round($N/1000, 1))K" }
    return [string]$N
}

function BarPct {
    param([double]$Value, [double]$Max)
    if ($Max -le 0) { return 0 }
    return [math]::Min(100, [math]::Round(($Value / $Max) * 100))
}

function Get-DictEntries {
    param($Dict)
    if (-not $Dict) { return @() }
    if ($Dict -is [hashtable]) {
        return @($Dict.GetEnumerator() | ForEach-Object { [PSCustomObject]@{ Name = $_.Key; Value = $_.Value } })
    }
    return @($Dict.PSObject.Properties | ForEach-Object { [PSCustomObject]@{ Name = $_.Name; Value = $_.Value } })
}

# ── 计算时间跨度 ─────────────────────────────────────
$timeSpan = ''
if ($sessions.Count -gt 0) {
    $startTimes = @($sessions | Where-Object { $_.startTime } | ForEach-Object {
        try { [DateTimeOffset]::Parse($_.startTime) } catch { $null }
    } | Where-Object { $_ })
    if ($startTimes.Count -gt 0) {
        $earliest = ($startTimes | Sort-Object | Select-Object -First 1).ToString('yyyy-MM-dd')
        $latest   = ($startTimes | Sort-Object | Select-Object -Last 1).ToString('yyyy-MM-dd')
        $timeSpan = "$earliest ~ $latest"
    }
}

# ── 构建 HTML ─────────────────────────────────────────
$sb = [System.Text.StringBuilder]::new(50000)

[void]$sb.AppendLine(@"
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>$(HE $Title)</title>
<style>
:root {
  --bg: #1a1a2e;
  --bg2: #16213e;
  --bg3: #0f3460;
  --bg4: #1a1a3e;
  --fg: #e4e4e4;
  --fg2: #8892b0;
  --fg3: #a8b2d1;
  --accent: #64ffda;
  --accent2: #82aaff;
  --accent3: #c792ea;
  --green: #a3d9a5;
  --yellow: #ffe082;
  --red: #ff7979;
  --orange: #ffab70;
  --blue: #82aaff;
  --purple: #c792ea;
  --cyan: #64ffda;
  --border: #233554;
  --radius: 8px;
  --shadow: 0 4px 14px rgba(0,0,0,0.4);
  --glow: 0 0 20px rgba(100,255,218,0.1);
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--fg);
  font-family: 'Segoe UI', 'Inter', system-ui, -apple-system, sans-serif;
  line-height: 1.7;
  padding: 24px;
  max-width: 1440px;
  margin: 0 auto;
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

/* ── Header ── */
.header {
  text-align: center;
  padding: 32px 0 24px;
  border-bottom: 2px solid var(--border);
  margin-bottom: 32px;
  position: relative;
}
.header::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translateX(-50%);
  width: 120px;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
}
.header h1 {
  font-size: 2em;
  font-weight: 700;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 8px;
}
.header .subtitle {
  color: var(--fg2);
  font-size: 0.9em;
}
.header .badge {
  display: inline-block;
  background: var(--bg3);
  border: 1px solid var(--accent3);
  color: var(--accent3);
  padding: 4px 14px;
  border-radius: 20px;
  font-size: 0.8em;
  font-weight: 600;
  margin-top: 10px;
}

/* ── Stats Cards ── */
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin: 24px 0;
}
.stat-card {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  text-align: center;
  box-shadow: var(--shadow);
  transition: transform 0.2s, box-shadow 0.2s;
}
.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--glow);
}
.stat-card .label {
  color: var(--fg2);
  font-size: 0.75em;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
}
.stat-card .value {
  font-size: 2em;
  font-weight: 700;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.stat-card .sub {
  color: var(--fg2);
  font-size: 0.8em;
  margin-top: 2px;
}

/* ── Section ── */
.section {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px;
  margin: 24px 0;
  box-shadow: var(--shadow);
}
.section h2 {
  font-size: 1.3em;
  font-weight: 600;
  color: var(--accent2);
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 8px;
}
.section h2 .icon { font-size: 1.2em; }
.section h3 {
  font-size: 1em;
  color: var(--fg3);
  margin: 20px 0 10px;
}

/* ── Bar Chart ── */
.bar-chart { margin: 12px 0; }
.bar-row {
  display: flex;
  align-items: center;
  margin: 6px 0;
  transition: background 0.15s;
  padding: 2px 4px;
  border-radius: 4px;
}
.bar-row:hover { background: rgba(100,255,218,0.04); }
.bar-label {
  width: 200px;
  min-width: 140px;
  font-size: 0.85em;
  color: var(--fg3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bar-container {
  flex: 1;
  background: rgba(255,255,255,0.04);
  border-radius: 4px;
  height: 24px;
  position: relative;
  margin: 0 12px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s cubic-bezier(0.4,0,0.2,1);
  min-width: 2px;
  position: relative;
}
.bar-fill::after {
  content: '';
  position: absolute;
  top: 0; right: 0;
  width: 20px;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15));
  border-radius: 0 4px 4px 0;
}
.bar-value {
  font-size: 0.85em;
  color: var(--fg2);
  min-width: 70px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* ── Quadrant Grid ── */
.quadrant-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 16px 0;
}
.quadrant-card {
  background: var(--bg3);
  border-radius: var(--radius);
  padding: 16px 16px 16px 20px;
  border-left: 4px solid var(--border);
  font-size: 0.9em;
  line-height: 1.6;
}
.quadrant-card h4 { margin-bottom: 8px; font-size: 0.95em; }
.quadrant-card p { color: var(--fg3); }
.qc-green  { border-left-color: #a3d9a5; }
.qc-green h4  { color: #a3d9a5; }
.qc-red    { border-left-color: #ff7979; }
.qc-red h4    { color: #ff7979; }
.qc-purple { border-left-color: #c792ea; }
.qc-purple h4 { color: #c792ea; }
.qc-golden { border-left-color: #ffe082; }
.qc-golden h4 { color: #ffe082; }

/* ── Narrative Card ── */
.narrative-card {
  background: var(--bg3);
  border-radius: var(--radius);
  padding: 16px 16px 16px 20px;
  border-left: 4px solid var(--border);
  margin: 12px 0;
  font-size: 0.9em;
  line-height: 1.6;
}
.narrative-card h3 { margin-bottom: 8px; color: var(--fg); }
.narrative-card p { color: var(--fg3); margin: 4px 0; }
.nc-green  { border-left-color: #a3d9a5; }
.nc-red    { border-left-color: #ff7979; }
.nc-purple { border-left-color: #c792ea; }
.nc-golden { border-left-color: #ffe082; }
.nc-rainbow { border-image: linear-gradient(180deg, #ff7979, #ffab70, #ffe082, #a3d9a5, #82aaff, #c792ea) 1; }

/* ── Warning ── */
.warning-box {
  background: var(--bg3);
  border: 1px solid var(--yellow);
  border-left: 4px solid var(--yellow);
  border-radius: var(--radius);
  padding: 20px 24px;
  margin: 24px 0;
  color: var(--yellow);
  font-size: 0.95em;
  text-align: center;
}

/* ── Footer ── */
.footer {
  margin-top: 40px;
  padding: 20px 0;
  border-top: 1px solid var(--border);
  color: var(--fg2);
  font-size: 0.75em;
  text-align: center;
}

/* ── Nav TOC ── */
.nav-toc {
  position: fixed;
  left: 0;
  top: 0;
  height: 100vh;
  width: 200px;
  background: rgba(22,33,62,0.95);
  border-right: 1px solid var(--border);
  z-index: 100;
  padding: 48px 12px 12px;
  overflow-y: auto;
  transform: translateX(-100%);
  transition: transform 0.3s ease;
  backdrop-filter: blur(10px);
}
.nav-toc.open { transform: translateX(0); }
.nav-toc a {
  display: block;
  padding: 6px 8px;
  color: var(--fg2);
  font-size: 0.75em;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
  text-decoration: none;
}
.nav-toc a:hover { background: var(--bg3); color: var(--accent); }
.nav-toggle {
  position: fixed;
  left: 8px;
  top: 8px;
  z-index: 101;
  background: var(--bg2);
  border: 1px solid var(--border);
  color: var(--fg2);
  padding: 6px 10px;
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 0.8em;
  transition: background 0.15s;
}
.nav-toggle:hover { background: var(--bg3); color: var(--accent); }

/* ── Responsive ── */
@media (max-width: 768px) {
  body { padding: 12px; }
  .bar-label { width: 120px; min-width: 80px; }
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .quadrant-grid { grid-template-columns: 1fr; }
  .nav-toc { width: 160px; }
}
</style>
</head>
<body>
<button class="nav-toggle" onclick="toggleNav()">&#x2630;</button>
<nav class="nav-toc" id="navToc">
  <a href="#sec-header">&#x1F4CA; 概览</a>
  <a href="#sec-glance">&#x1F52D; 总览</a>
  <a href="#sec-goals">&#x1F3AF; 目标分布</a>
  <a href="#sec-outcomes">&#x1F4C8; 成果分析</a>
  <a href="#sec-satisfaction">&#x1F60A; 满意度</a>
  <a href="#sec-friction">&#x26A1; 摩擦分析</a>
  <a href="#sec-narratives">&#x1F4D6; 叙事洞察</a>
</nav>
"@)

# ── Header ────────────────────────────────────────────
$facetsCount = $facetsData.Count
$totalSessions = $agg.totalSessions
[void]$sb.AppendLine(@"
<div class="header" id="sec-header">
  <h1>$(HE $Title)</h1>
  <div class="subtitle">
    扫描日期: $($meta.scanDate) &nbsp;&bull;&nbsp;
    Sessions: $totalSessions &nbsp;&bull;&nbsp;
    时间跨度: $(HE $timeSpan) &nbsp;&bull;&nbsp;
    数据量: $($meta.totalSizeMB) MB
  </div>
  <div class="badge">LLM 语义分析 &middot; 基于 facets-cache</div>
  <div class="subtitle" style="margin-top:8px">已分析 $facetsCount / $totalSessions sessions</div>
</div>
"@)

# ── No-data warning ──────────────────────────────────
if (-not $hasFacets -and -not $hasNarratives) {
    [void]$sb.AppendLine(@"
<div class="warning-box">
  &#x26A0; 未找到 facets 或 narratives 数据。<br>
  请先运行 <code>analyze-facets.ps1</code> 生成 facets-cache，或提供 narratives JSON 文件。
</div>
"@)
}

# ── Section: At a Glance ─────────────────────────────
if ($hasNarratives -and $narratives.atAGlance) {
    $glance = $narratives.atAGlance
    [void]$sb.AppendLine('<div class="section" id="sec-glance"><h2><span class="icon">&#x1F52D;</span> At a Glance</h2>')
    [void]$sb.AppendLine('<div class="quadrant-grid">')
    if ($glance.worksWell) {
        [void]$sb.AppendLine("<div class=`"quadrant-card qc-green`"><h4>&#x1F7E2; 你做得好的</h4><p>$(HE $glance.worksWell)</p></div>")
    }
    if ($glance.needsAttention) {
        [void]$sb.AppendLine("<div class=`"quadrant-card qc-red`"><h4>&#x1F534; 需要注意的</h4><p>$(HE $glance.needsAttention)</p></div>")
    }
    if ($glance.suggestions) {
        [void]$sb.AppendLine("<div class=`"quadrant-card qc-purple`"><h4>&#x1F7E3; 建议尝试</h4><p>$(HE $glance.suggestions)</p></div>")
    }
    if ($glance.horizon) {
        [void]$sb.AppendLine("<div class=`"quadrant-card qc-golden`"><h4>&#x1F7E1; 展望</h4><p>$(HE $glance.horizon)</p></div>")
    }
    [void]$sb.AppendLine('</div></div>')
}

# ── Section: 目标分布 ─────────────────────────────────
if ($hasFacets -and $goalDistribution.Count -gt 0) {
    $goalLabels = @{
        'feature_work'='&#x1F195; 功能开发'; 'bug_fix'='&#x1F41B; 修复 Bug'; 'refactoring'='&#x267B; 重构'
        'testing'='&#x1F9EA; 测试'; 'documentation'='&#x1F4DD; 文档'; 'devops_infra'='&#x2699; DevOps'
        'code_review'='&#x1F440; 代码审查'; 'learning_exploration'='&#x1F4DA; 学习探索'
        'data_analysis'='&#x1F4CA; 数据分析'; 'design_architecture'='&#x1F3D7; 架构设计'
        'migration_upgrade'='&#x1F504; 迁移升级'; 'performance_optimization'='&#x26A1; 性能优化'; 'security'='&#x1F512; 安全'
    }
    $goalEntries = @($goalDistribution.GetEnumerator() | Sort-Object Value -Descending)
    $maxGoal = ($goalEntries | Select-Object -First 1).Value
    [void]$sb.AppendLine('<div class="section" id="sec-goals"><h2><span class="icon">&#x1F3AF;</span> 目标分布</h2><div class="bar-chart">')
    foreach ($g in $goalEntries) {
        $label = if ($goalLabels.ContainsKey($g.Key)) { $goalLabels[$g.Key] } else { HE $g.Key }
        $pct = BarPct -Value $g.Value -Max $maxGoal
        [void]$sb.AppendLine("<div class=`"bar-row`"><div class=`"bar-label`">$label</div><div class=`"bar-container`"><div class=`"bar-fill`" style=`"width:${pct}%;background:var(--accent2)`"></div></div><div class=`"bar-value`">$($g.Value)</div></div>")
    }
    [void]$sb.AppendLine('</div></div>')
}

# ── Section: 成果分析 ─────────────────────────────────
if ($hasFacets -and $outcomeDistribution.Count -gt 0) {
    $outcomeLabels = [ordered]@{
        'fully_achieved'     = @{ label = '&#x2705; 完全达成';    color = '#a3d9a5' }
        'mostly_achieved'    = @{ label = '&#x1F7E2; 大部分达成'; color = '#7fdbca' }
        'partially_achieved' = @{ label = '&#x1F7E1; 部分达成';   color = '#ffe082' }
        'barely_started'     = @{ label = '&#x1F7E0; 刚刚开始';   color = '#ffab70' }
        'abandoned'          = @{ label = '&#x1F534; 放弃';        color = '#ff7979' }
    }
    $outcomeEntries = @()
    foreach ($oKey in $outcomeLabels.Keys) {
        if ($outcomeDistribution.ContainsKey($oKey)) {
            $outcomeEntries += [PSCustomObject]@{ Key = $oKey; Value = $outcomeDistribution[$oKey] }
        }
    }
    # include any keys not in predefined list
    foreach ($oKey in $outcomeDistribution.Keys) {
        if (-not $outcomeLabels.Contains($oKey)) {
            $outcomeEntries += [PSCustomObject]@{ Key = $oKey; Value = $outcomeDistribution[$oKey] }
        }
    }
    if ($outcomeEntries.Count -gt 0) {
        $maxOutcome = ($outcomeEntries | Sort-Object Value -Descending | Select-Object -First 1).Value
        [void]$sb.AppendLine('<div class="section" id="sec-outcomes"><h2><span class="icon">&#x1F4C8;</span> 成果分析</h2><div class="bar-chart">')
        foreach ($o in $outcomeEntries) {
            $info = if ($outcomeLabels.Contains($o.Key)) { $outcomeLabels[$o.Key] } else { @{ label = (HE $o.Key); color = '#8892b0' } }
            $pct = BarPct -Value $o.Value -Max $maxOutcome
            [void]$sb.AppendLine("<div class=`"bar-row`"><div class=`"bar-label`">$($info.label)</div><div class=`"bar-container`"><div class=`"bar-fill`" style=`"width:${pct}%;background:$($info.color)`"></div></div><div class=`"bar-value`">$($o.Value)</div></div>")
        }
        [void]$sb.AppendLine('</div></div>')
    }
}

# ── Section: 满意度分析 ───────────────────────────────
if ($hasFacets -and $satisfactionDistribution.Count -gt 0) {
    $satLabels = @{
        'highly_satisfied'    = @{ label = '&#x1F929; 非常满意';   color = '#a3d9a5' }
        'impressed'           = @{ label = '&#x1F60D; 印象深刻';   color = '#7fdbca' }
        'satisfied'           = @{ label = '&#x1F60A; 满意';       color = '#82aaff' }
        'neutral'             = @{ label = '&#x1F610; 中性';       color = '#8892b0' }
        'slightly_frustrated' = @{ label = '&#x1F615; 轻微不满';   color = '#ffab70' }
        'frustrated'          = @{ label = '&#x1F624; 不满';       color = '#ff7979' }
        'very_frustrated'     = @{ label = '&#x1F621; 非常不满';   color = '#e74c3c' }
        'confused'            = @{ label = '&#x1F635; 困惑';       color = '#c792ea' }
    }
    $satEntries = @($satisfactionDistribution.GetEnumerator() | Sort-Object Value -Descending)
    $maxSat = ($satEntries | Select-Object -First 1).Value
    [void]$sb.AppendLine('<div class="section" id="sec-satisfaction"><h2><span class="icon">&#x1F60A;</span> 满意度分析</h2><div class="bar-chart">')
    foreach ($se in $satEntries) {
        $info = if ($satLabels.ContainsKey($se.Key)) { $satLabels[$se.Key] } else { @{ label = (HE $se.Key); color = '#8892b0' } }
        $pct = BarPct -Value $se.Value -Max $maxSat
        [void]$sb.AppendLine("<div class=`"bar-row`"><div class=`"bar-label`">$($info.label)</div><div class=`"bar-container`"><div class=`"bar-fill`" style=`"width:${pct}%;background:$($info.color)`"></div></div><div class=`"bar-value`">$($se.Value)</div></div>")
    }
    [void]$sb.AppendLine('</div></div>')
}

# ── Section: 摩擦分析 ─────────────────────────────────
if ($hasFacets -and $frictionDistribution.Count -gt 0) {
    $fricLabels = @{
        'wrong_approach'='方向错误'; 'hallucination'='幻觉'; 'ignored_instruction'='忽略指令'
        'repetitive_error'='重复犯错'; 'context_lost'='丢失上下文'; 'slow_response'='响应缓慢'
        'tool_failure'='工具失败'; 'incomplete_solution'='不完整方案'; 'wrong_file_edit'='编辑错误文件'
        'unnecessary_changes'='不必要的修改'; 'poor_code_quality'='代码质量差'; 'misunderstood_request'='误解需求'
    }
    $fricEntries = @($frictionDistribution.GetEnumerator() | Sort-Object Value -Descending)
    $maxFric = ($fricEntries | Select-Object -First 1).Value
    [void]$sb.AppendLine('<div class="section" id="sec-friction"><h2><span class="icon">&#x26A1;</span> 摩擦分析</h2><div class="bar-chart">')
    foreach ($fe in $fricEntries) {
        $label = if ($fricLabels.ContainsKey($fe.Key)) { $fricLabels[$fe.Key] } else { HE $fe.Key }
        $pct = BarPct -Value $fe.Value -Max $maxFric
        [void]$sb.AppendLine("<div class=`"bar-row`"><div class=`"bar-label`">$(HE $label)</div><div class=`"bar-container`"><div class=`"bar-fill`" style=`"width:${pct}%;background:var(--red)`"></div></div><div class=`"bar-value`">$($fe.Value)</div></div>")
    }
    [void]$sb.AppendLine('</div></div>')
}

# ── Section: 叙事洞察 ─────────────────────────────────
if ($hasNarratives) {
    [void]$sb.AppendLine('<div class="section" id="sec-narratives"><h2><span class="icon">&#x1F4D6;</span> 叙事洞察</h2>')
    $narrativeFields = @(
        @{ key = 'projectAreas';    title = '&#x1F3AF; 项目领域'; css = '' }
        @{ key = 'interactionStyle';title = '&#x1F4AC; 交互风格'; css = '' }
        @{ key = 'whatWorks';       title = '&#x2728; 做得好的'; css = 'nc-green' }
        @{ key = 'frictionAnalysis';title = '&#x26A1; 摩擦分析'; css = 'nc-red' }
        @{ key = 'suggestions';     title = '&#x1F4A1; 改进建议'; css = 'nc-purple' }
        @{ key = 'onTheHorizon';    title = '&#x1F52E; 展望';     css = 'nc-golden' }
        @{ key = 'funEnding';       title = '&#x1F389; 彩蛋';     css = 'nc-rainbow' }
    )
    foreach ($nf in $narrativeFields) {
        $val = $narratives.($nf.key)
        if (-not $val) { continue }
        $cssClass = if ($nf.css) { "narrative-card $($nf.css)" } else { 'narrative-card' }
        [void]$sb.AppendLine("<div class=`"$cssClass`"><h3>$($nf.title)</h3>")
        if ($val -is [array]) {
            foreach ($p in $val) { [void]$sb.AppendLine("<p>$(HE "$p")</p>") }
        } else {
            $paragraphs = "$val" -split "`n"
            foreach ($p in $paragraphs) {
                $trimmed = $p.Trim()
                if ($trimmed) { [void]$sb.AppendLine("<p>$(HE $trimmed)</p>") }
            }
        }
        [void]$sb.AppendLine('</div>')
    }
    [void]$sb.AppendLine('</div>')
}

# ── Footer ────────────────────────────────────────────
$dataFileName = Split-Path $DataPath -Leaf
[void]$sb.AppendLine(@"
<div class="footer">
  <p>数据来源: $(HE $dataFileName) &nbsp;&bull;&nbsp; Facets: $facetsCount sessions &nbsp;&bull;&nbsp; Narratives: $(if ($hasNarratives) { '✓' } else { '✗' })</p>
  <p>生成命令: <code>generate-qual-report.ps1 -DataPath $(HE $dataFileName)</code></p>
  <p>Parking Agents Insight Toolkit (Qual Only) &nbsp;&bull;&nbsp; $now</p>
</div>

<script>
function toggleNav() {
  var nav = document.getElementById('navToc');
  nav.classList.toggle('open');
}
</script>
</body>
</html>
"@)

# ── 写出 ──────────────────────────────────────────────
$html = $sb.ToString()
$parentDir = Split-Path $OutputPath -Parent
if ($parentDir -and -not (Test-Path $parentDir)) {
    New-Item -Path $parentDir -ItemType Directory -Force | Out-Null
}
[System.IO.File]::WriteAllText($OutputPath, $html, [System.Text.Encoding]::UTF8)

$sizeKB = [math]::Round($html.Length / 1024, 1)
Write-Host "[done] HTML 报告已生成 (Qual Only): $OutputPath ($sizeKB KB)" -ForegroundColor Green
