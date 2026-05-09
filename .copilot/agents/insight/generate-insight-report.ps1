# DEPRECATED: This script has been replaced by the Node.js version (.js). Use the .js version instead.
#Requires -Version 5.1
<#
.SYNOPSIS
    读取 analyze-insight.ps1 的输出 JSON，生成交互式 HTML 报告。

.DESCRIPTION
    生成单文件暗色主题 HTML 报告，包含 Token 消耗、工具使用热力图、
    时间分布、代码变更、异常检测等多维度可视化。
    零外部依赖，CSS + JS 全内联。

.EXAMPLE
    .\generate-insight-report.ps1 -DataPath .\insight-data.json
    .\generate-insight-report.ps1 -DataPath .\insight-data.json -OutputPath .\report.html -Title "Weekly Insight"
#>
param(
    [Parameter(Mandatory)]
    [string]$DataPath,          # insight 数据 JSON 路径
    [string]$OutputPath,        # 输出 HTML 路径
    [string]$Title,             # 报告标题
    [string]$FacetsPath = 'facets-cache',    # 分面缓存目录
    [string]$NarrativesPath = ''             # insight-narratives.json 路径
)

$ErrorActionPreference = 'Stop'

if (-not $OutputPath) { $OutputPath = 'insight-report.html' }
if (-not $Title)      { $Title = 'VS Code Copilot Insight Report' }

# ── 加载数据 ──────────────────────────────────────────
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

# ── 计算响应时间分布桶 ────────────────────────────────
$rtBuckets = @(0, 0, 0, 0, 0, 0, 0)
$rtLabels  = @('&lt;1s', '1-5s', '5-15s', '15-30s', '30-60s', '1-5min', '&gt;5min')
foreach ($s in $sessions) {
    if ($s.userResponseTimes) {
        foreach ($rt in $s.userResponseTimes) {
            $v = [double]$rt
            if     ($v -lt 1)   { $rtBuckets[0]++ }
            elseif ($v -lt 5)   { $rtBuckets[1]++ }
            elseif ($v -lt 15)  { $rtBuckets[2]++ }
            elseif ($v -lt 30)  { $rtBuckets[3]++ }
            elseif ($v -lt 60)  { $rtBuckets[4]++ }
            elseif ($v -lt 300) { $rtBuckets[5]++ }
            else                { $rtBuckets[6]++ }
        }
    }
}

# ── 聚合 Git 操作和 Diff 数据 ─────────────────────────
$totalGitOps = @{ commits = 0; pushes = 0; merges = 0; stashes = 0 }
$totalDiffLines = @{ added = 0; removed = 0 }
foreach ($s in $sessions) {
    if ($s.gitOperations) {
        $totalGitOps.commits += [int]$s.gitOperations.commits
        $totalGitOps.pushes  += [int]$s.gitOperations.pushes
        $totalGitOps.merges  += [int]$s.gitOperations.merges
        $totalGitOps.stashes += [int]$s.gitOperations.stashes
    }
    if ($s.diffLines) {
        $totalDiffLines.added   += [int]$s.diffLines.added
        $totalDiffLines.removed += [int]$s.diffLines.removed
    }
}
$totalGitOpsCount = $totalGitOps.commits + $totalGitOps.pushes + $totalGitOps.merges + $totalGitOps.stashes

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

# 提取字典属性的通用方法
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
$sb = [System.Text.StringBuilder]::new(100000)

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

/* ── Table ── */
table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin: 12px 0;
  font-size: 0.85em;
}
th, td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  text-align: left;
}
th {
  background: var(--bg3);
  color: var(--accent2);
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 1;
}
th:first-child { border-radius: var(--radius) 0 0 0; }
th:last-child { border-radius: 0 var(--radius) 0 0; }
td { background: var(--bg4); }
tr:hover td { background: rgba(100,255,218,0.06); }

/* ── Heatmap ── */
.heat-0 { background: var(--bg4) !important; color: var(--fg2); }
.heat-1 { background: #0d2137 !important; }
.heat-2 { background: #0f3460 !important; }
.heat-3 { background: #1a5276 !important; }
.heat-4 { background: #217dbb !important; color: #fff; }
.heat-5 { background: #3498db !important; color: #fff; }
td.heat-1, td.heat-2, td.heat-3, td.heat-4, td.heat-5 { text-align: center; }

/* ── Hourly Grid ── */
.hourly-grid {
  display: grid;
  grid-template-columns: repeat(24, 1fr);
  gap: 3px;
  margin: 12px 0;
}
.hour-cell {
  aspect-ratio: 1;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7em;
  transition: transform 0.15s;
  cursor: default;
}
.hour-cell:hover { transform: scale(1.15); }
.hour-label {
  display: grid;
  grid-template-columns: repeat(24, 1fr);
  gap: 3px;
  margin-top: 4px;
}
.hour-label span {
  text-align: center;
  font-size: 0.65em;
  color: var(--fg2);
}

/* ── Proportion Bar ── */
.proportion-bar {
  display: flex;
  height: 32px;
  border-radius: 4px;
  overflow: hidden;
  margin: 12px 0;
}
.proportion-segment {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75em;
  font-weight: 600;
  color: #fff;
  min-width: 30px;
  transition: flex 0.3s;
}
.proportion-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 8px 0;
  font-size: 0.8em;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

/* ── Collapsible ── */
.collapse-toggle {
  cursor: pointer;
  user-select: none;
  background: var(--bg3);
  padding: 10px 16px;
  border-radius: var(--radius);
  margin: 6px 0;
  border: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.15s;
}
.collapse-toggle:hover { background: var(--bg4); }
.collapse-content {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.35s ease-out, padding 0.35s;
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 var(--radius) var(--radius);
  background: var(--bg4);
  padding: 0 16px;
}
.collapse-content.open {
  max-height: 2000px;
  padding: 12px 16px;
}
.arrow { transition: transform 0.3s; display: inline-block; }
.arrow.open { transform: rotate(90deg); }

/* ── Anomaly ── */
.anomaly-item {
  background: var(--bg3);
  padding: 8px 12px;
  margin: 6px 0;
  border-radius: 4px;
  border-left: 3px solid var(--red);
  font-size: 0.85em;
}
.anomaly-warn { border-left-color: var(--yellow); }
.anomaly-ok { border-left-color: var(--green); }

/* ── Workspace Card ── */
.ws-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin: 16px 0;
}
.ws-card {
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  transition: transform 0.2s, border-color 0.2s;
}
.ws-card:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
}
.ws-card .ws-name {
  font-weight: 600;
  color: var(--accent2);
  font-size: 1.05em;
  margin-bottom: 8px;
}
.ws-card .ws-stat {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
  font-size: 0.85em;
  color: var(--fg3);
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.ws-card .ws-stat-val { color: var(--fg); font-weight: 500; }

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

/* ── Histogram ── */
.histogram {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 180px;
  margin: 16px 0;
  padding: 0 8px;
}
.hist-bar-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
}
.hist-bar {
  width: 100%;
  max-width: 80px;
  background: var(--accent2);
  border-radius: 4px 4px 0 0;
  min-height: 2px;
  transition: height 0.4s;
  position: relative;
}
.hist-bar .hist-count {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.75em;
  color: var(--fg2);
  white-space: nowrap;
}
.hist-label {
  margin-top: 6px;
  font-size: 0.7em;
  color: var(--fg2);
  text-align: center;
  white-space: nowrap;
}

/* ── Feature Badge ── */
.feature-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.7em;
  font-weight: 600;
  margin: 2px;
  background: var(--bg4);
  border: 1px solid var(--border);
  color: var(--fg2);
}
.feature-badge.active { border-color: var(--accent); color: var(--accent); }

/* ── Responsive ── */
@media (max-width: 768px) {
  body { padding: 12px; }
  .bar-label { width: 120px; min-width: 80px; }
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .hourly-grid { grid-template-columns: repeat(12, 1fr); }
  table { font-size: 0.75em; }
  th, td { padding: 4px 6px; }
  .quadrant-grid { grid-template-columns: 1fr; }
  .nav-toc { width: 160px; }
  .histogram { height: 120px; }
}
</style>
</head>
<body>
<button class="nav-toggle" onclick="toggleNav()">&#x2630;</button>
<nav class="nav-toc" id="navToc">
  <a href="#sec-header">&#x1F4CA; 概览</a>
  <a href="#sec-agents">&#x1F916; Agent 分布</a>
  <a href="#sec-tools">&#x1F527; 工具分析</a>
  <a href="#sec-tokens">&#x1F4CA; Token 消耗</a>
  <a href="#sec-time">&#x23F0; 时间分布</a>
  <a href="#sec-errors">&#x26A0; 工具错误</a>
  <a href="#sec-glance">&#x1F52D; 总览</a>
  <a href="#sec-goals">&#x1F3AF; 目标分布</a>
  <a href="#sec-outcomes">&#x1F4C8; 成果分析</a>
  <a href="#sec-satisfaction">&#x1F60A; 满意度</a>
  <a href="#sec-friction">&#x26A1; 摩擦分析</a>
  <a href="#sec-narratives">&#x1F4D6; 叙事洞察</a>
  <a href="#sec-response">&#x23F1; 响应时间</a>
  <a href="#sec-code">&#x1F4DD; 代码变更</a>
  <a href="#sec-lang">&#x1F4BB; 语言分布</a>
  <a href="#sec-anomaly">&#x1F50D; 异常检测</a>
  <a href="#sec-ws">&#x1F4C2; Workspace</a>
</nav>
"@)

# ── Header ────────────────────────────────────────────
$totalTokensStr = Format-Number -N ($agg.totalInputTokens + $agg.totalOutputTokens)
[void]$sb.AppendLine(@"
<div class="header" id="sec-header">
  <h1>$(HE $Title)</h1>
  <div class="subtitle">
    扫描日期: $($meta.scanDate) &nbsp;&bull;&nbsp;
    Sessions: $($agg.totalSessions) &nbsp;&bull;&nbsp;
    时间跨度: $(HE $timeSpan) &nbsp;&bull;&nbsp;
    数据量: $($meta.totalSizeMB) MB
  </div>
</div>
"@)

# ── Stats Cards ───────────────────────────────────────
$totalMsgs = $agg.totalUserMessages + $agg.totalAssistantMessages
[void]$sb.AppendLine(@"
<div class="stats-row">
  <div class="stat-card">
    <div class="label">总消息数</div>
    <div class="value">$(Format-Number -N $totalMsgs)</div>
    <div class="sub">用户 $(Format-Number -N $agg.totalUserMessages) / 助手 $(Format-Number -N $agg.totalAssistantMessages)</div>
  </div>
  <div class="stat-card">
    <div class="label">总 Token</div>
    <div class="value">$totalTokensStr</div>
    <div class="sub">输入 $(Format-Number -N $agg.totalInputTokens) / 输出 $(Format-Number -N $agg.totalOutputTokens)</div>
  </div>
  <div class="stat-card">
    <div class="label">活跃天数</div>
    <div class="value">$($agg.daysActive)</div>
    <div class="sub">平均 $($agg.messagesPerDay) 消息/天</div>
  </div>
  <div class="stat-card">
    <div class="label">平均会话时长</div>
    <div class="value">$($agg.avgSessionDuration) min</div>
    <div class="sub">中位响应 $($agg.medianResponseTime)s</div>
  </div>
  <div class="stat-card">
    <div class="label">并行 Session</div>
    <div class="value">$($agg.multiClaudingSessions)</div>
    <div class="sub">Multi-Clauding</div>
  </div>
</div>
"@)

# ── Section: Agent 使用分布 ───────────────────────────
$subagentEntries = @(Get-DictEntries $agg.subagentDistribution | Sort-Object { [int]$_.Value } -Descending)
if ($subagentEntries.Count -gt 0) {
    $maxSA = ($subagentEntries | Select-Object -First 1).Value

    [void]$sb.AppendLine('<div class="section" id="sec-agents"><h2><span class="icon">&#x1F916;</span> Agent 使用分布</h2>')

    # 水平 Bar Chart
    [void]$sb.AppendLine('<h3>调用次数</h3><div class="bar-chart">')
    $saColors = @('#64ffda', '#82aaff', '#c792ea', '#ffab70', '#ff7979', '#ffe082', '#a3d9a5', '#7fdbca')
    $saIdx = 0
    foreach ($e in $subagentEntries) {
        $pct = BarPct -Value ([int]$e.Value) -Max ([int]$maxSA)
        $color = $saColors[$saIdx % $saColors.Count]
        [void]$sb.AppendLine(@"
<div class="bar-row">
  <div class="bar-label">$(HE $e.Name)</div>
  <div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:$color"></div></div>
  <div class="bar-value">$($e.Value)</div>
</div>
"@)
        $saIdx++
    }
    [void]$sb.AppendLine('</div>')

    # 比例条
    $totalSACalls = 0
    foreach ($e in $subagentEntries) { $totalSACalls += [int]$e.Value }
    if ($totalSACalls -gt 0) {
        [void]$sb.AppendLine('<h3>调用比例</h3><div class="proportion-bar">')
        $saIdx = 0
        foreach ($e in $subagentEntries) {
            $flex = [math]::Max(1, [math]::Round(([int]$e.Value / $totalSACalls) * 100))
            $color = $saColors[$saIdx % $saColors.Count]
            $label = if ($flex -ge 8) { "$($e.Name)" } else { '' }
            [void]$sb.Append("<div class=`"proportion-segment`" style=`"flex:$flex;background:$color`" title=`"$(HE $e.Name): $($e.Value)`">$label</div>")
            $saIdx++
        }
        [void]$sb.AppendLine('</div><div class="proportion-legend">')
        $saIdx = 0
        foreach ($e in $subagentEntries) {
            $color = $saColors[$saIdx % $saColors.Count]
            $pctStr = [math]::Round(([int]$e.Value / $totalSACalls) * 100, 1)
            [void]$sb.Append("<div class=`"legend-item`"><div class=`"legend-dot`" style=`"background:$color`"></div>$(HE $e.Name) (${pctStr}%)</div>")
            $saIdx++
        }
        [void]$sb.AppendLine('</div>')
    }
    [void]$sb.AppendLine('</div>')
}

# ── Section: 工具使用热力图 ───────────────────────────
$toolEntries = @(Get-DictEntries $agg.toolCountsAggregated | Sort-Object { [int]$_.Value } -Descending)
if ($toolEntries.Count -gt 0) {
    [void]$sb.AppendLine('<div class="section" id="sec-tools"><h2><span class="icon">&#x1F527;</span> 工具使用分析</h2>')

    # 工具调用 Top 20 bar
    $topTools = @($toolEntries | Select-Object -First 20)
    $maxTool = [int]($topTools | Select-Object -First 1).Value

    [void]$sb.AppendLine('<h3>工具调用排行（Top 20）</h3><div class="bar-chart">')
    foreach ($t in $topTools) {
        $pct = BarPct -Value ([int]$t.Value) -Max $maxTool
        [void]$sb.AppendLine(@"
<div class="bar-row">
  <div class="bar-label">$(HE $t.Name)</div>
  <div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:var(--accent2)"></div></div>
  <div class="bar-value">$(Format-Number -N ([int]$t.Value))</div>
</div>
"@)
    }
    [void]$sb.AppendLine('</div>')

    # 热力图：session × tool（取前 15 个工具，前 20 个 session）
    $topToolNames = @($topTools | Select-Object -First 15 | ForEach-Object { $_.Name })
    $recentSessions = @($sessions | Sort-Object { $_.startTime } -Descending | Select-Object -First 20)

    if ($recentSessions.Count -gt 0 -and $topToolNames.Count -gt 0) {
        [void]$sb.AppendLine('<h3>Session × 工具 热力图（最近 20 个 session）</h3>')
        [void]$sb.AppendLine('<div style="overflow-x:auto"><table>')
        [void]$sb.Append('<tr><th>Session</th>')
        foreach ($tn in $topToolNames) {
            $short = if ($tn.Length -gt 14) { $tn.Substring(0, 12) + '..' } else { $tn }
            [void]$sb.Append("<th title=`"$(HE $tn)`">$(HE $short)</th>")
        }
        [void]$sb.AppendLine('</tr>')

        # 计算热力图最大值
        $heatMax = 1
        foreach ($s in $recentSessions) {
            $tc = Get-DictEntries $s.toolCounts
            foreach ($e in $tc) { if ([int]$e.Value -gt $heatMax) { $heatMax = [int]$e.Value } }
        }

        foreach ($s in $recentSessions) {
            $sLabel = if ($s.workspaceName) { $s.workspaceName } else { $s.sessionId.Substring(0, [Math]::Min(8, $s.sessionId.Length)) }
            [void]$sb.Append("<tr><td title=`"$(HE $s.sessionId)`"><strong>$(HE $sLabel)</strong></td>")
            $tcMap = @{}
            foreach ($e in (Get-DictEntries $s.toolCounts)) { $tcMap[$e.Name] = [int]$e.Value }
            foreach ($tn in $topToolNames) {
                $cnt = if ($tcMap.ContainsKey($tn)) { $tcMap[$tn] } else { 0 }
                $level = if ($cnt -eq 0) { 0 }
                         elseif ($cnt -le ($heatMax * 0.1)) { 1 }
                         elseif ($cnt -le ($heatMax * 0.3)) { 2 }
                         elseif ($cnt -le ($heatMax * 0.5)) { 3 }
                         elseif ($cnt -le ($heatMax * 0.8)) { 4 }
                         else { 5 }
                [void]$sb.Append("<td class=`"heat-$level`" title=`"$cnt`">$cnt</td>")
            }
            [void]$sb.AppendLine('</tr>')
        }
        [void]$sb.AppendLine('</table></div>')
    }

    # 工具成功率
    [void]$sb.AppendLine("<h3>工具成功率: $($agg.avgToolSuccessRate)%</h3>")
    $successPct = $agg.avgToolSuccessRate
    $successColor = if ($successPct -ge 95) { 'var(--green)' } elseif ($successPct -ge 80) { 'var(--yellow)' } else { 'var(--red)' }
    [void]$sb.AppendLine(@"
<div class="bar-chart">
<div class="bar-row">
  <div class="bar-label">整体成功率</div>
  <div class="bar-container"><div class="bar-fill" style="width:${successPct}%;background:$successColor"></div></div>
  <div class="bar-value">${successPct}% ($($agg.totalToolCalls - $agg.totalToolErrors)/$($agg.totalToolCalls))</div>
</div>
</div>
"@)

    [void]$sb.AppendLine('</div>')
}

# ── Section: Token 消耗分析 ──────────────────────────
[void]$sb.AppendLine('<div class="section" id="sec-tokens"><h2><span class="icon">&#x1F4CA;</span> Token 消耗分析</h2>')

# 按模型分布
$modelEntries = @(Get-DictEntries $agg.modelDistribution | Sort-Object { [long]$_.Value } -Descending)
if ($modelEntries.Count -gt 0) {
    $maxModel = [long]($modelEntries | Select-Object -First 1).Value
    [void]$sb.AppendLine('<h3>按模型的 Token 分布</h3><div class="bar-chart">')
    $modelColors = @('#64ffda', '#82aaff', '#c792ea', '#ffab70', '#ffe082')
    $mIdx = 0
    foreach ($m in $modelEntries) {
        $pct = BarPct -Value ([long]$m.Value) -Max $maxModel
        $color = $modelColors[$mIdx % $modelColors.Count]
        [void]$sb.AppendLine(@"
<div class="bar-row">
  <div class="bar-label">$(HE $m.Name)</div>
  <div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:$color"></div></div>
  <div class="bar-value">$(Format-Number -N ([long]$m.Value))</div>
</div>
"@)
        $mIdx++
    }
    [void]$sb.AppendLine('</div>')
}

# 按 workspace 分布
$wsEntries = @(Get-DictEntries $agg.byWorkspace | Sort-Object { [long]$_.Value.inputTokens } -Descending | Select-Object -First 15)
if ($wsEntries.Count -gt 0) {
    $maxWsTokens = [long]($wsEntries | Select-Object -First 1).Value.inputTokens
    if ($maxWsTokens -le 0) { $maxWsTokens = 1 }
    [void]$sb.AppendLine('<h3>按 Workspace 的 Token 分布（Top 15）</h3><div class="bar-chart">')
    foreach ($w in $wsEntries) {
        $tokens = [long]$w.Value.inputTokens
        $pct = BarPct -Value $tokens -Max $maxWsTokens
        [void]$sb.AppendLine(@"
<div class="bar-row">
  <div class="bar-label">$(HE $w.Name)</div>
  <div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:var(--accent3)"></div></div>
  <div class="bar-value">$(Format-Number -N $tokens)</div>
</div>
"@)
    }
    [void]$sb.AppendLine('</div>')
}

# Input/Output 比率
$totalIn  = [long]$agg.totalInputTokens
$totalOut = [long]$agg.totalOutputTokens
$totalAll = $totalIn + $totalOut
if ($totalAll -gt 0) {
    $inPct  = [math]::Round(($totalIn / $totalAll) * 100, 1)
    $outPct = [math]::Round(($totalOut / $totalAll) * 100, 1)
    [void]$sb.AppendLine(@"
<h3>Input / Output 比率</h3>
<div class="proportion-bar">
  <div class="proportion-segment" style="flex:$([math]::Max(1,$inPct));background:var(--accent2)">Input ${inPct}%</div>
  <div class="proportion-segment" style="flex:$([math]::Max(1,$outPct));background:var(--accent3)">Output ${outPct}%</div>
</div>
"@)
}
[void]$sb.AppendLine('</div>')

# ── Section: 时间分布 ────────────────────────────────
[void]$sb.AppendLine('<div class="section" id="sec-time"><h2><span class="icon">&#x23F0;</span> 时间分布</h2>')

# 24 小时活动热力图
$hourly = @($agg.hourlyDistribution)
$maxHour = 1
foreach ($h in $hourly) { if ([int]$h -gt $maxHour) { $maxHour = [int]$h } }

[void]$sb.AppendLine('<h3>24 小时活动分布</h3><div class="hourly-grid">')
$hourColors = @('#1a1a2e', '#0d2137', '#0f3460', '#1a5276', '#217dbb', '#3498db')
for ($i = 0; $i -lt 24; $i++) {
    $val = if ($i -lt $hourly.Count) { [int]$hourly[$i] } else { 0 }
    $level = if ($val -eq 0) { 0 }
             elseif ($val -le ($maxHour * 0.1)) { 1 }
             elseif ($val -le ($maxHour * 0.3)) { 2 }
             elseif ($val -le ($maxHour * 0.5)) { 3 }
             elseif ($val -le ($maxHour * 0.8)) { 4 }
             else { 5 }
    $bgColor = $hourColors[$level]
    $textColor = if ($level -ge 4) { '#fff' } else { 'var(--fg2)' }
    [void]$sb.Append("<div class=`"hour-cell`" style=`"background:$bgColor;color:$textColor`" title=`"${i}:00 — $val 条消息`">$val</div>")
}
[void]$sb.AppendLine('</div><div class="hour-label">')
for ($i = 0; $i -lt 24; $i++) {
    [void]$sb.Append("<span>${i}h</span>")
}
[void]$sb.AppendLine('</div>')

# 日历热力图（按天聚合）
$dayMap = @{}
foreach ($s in $sessions) {
    if (-not $s.startTime) { continue }
    try {
        $day = ([DateTimeOffset]::Parse($s.startTime)).ToString('yyyy-MM-dd')
        if ($dayMap.ContainsKey($day)) { $dayMap[$day] += $s.userMessageCount }
        else { $dayMap[$day] = $s.userMessageCount }
    } catch {}
}
if ($dayMap.Count -gt 1) {
    $sortedDays = @($dayMap.Keys | Sort-Object)
    $maxDayVal = 1
    foreach ($v in $dayMap.Values) { if ([int]$v -gt $maxDayVal) { $maxDayVal = [int]$v } }

    [void]$sb.AppendLine('<h3>每日活动量</h3><div class="bar-chart">')
    foreach ($day in $sortedDays) {
        $val = $dayMap[$day]
        $pct = BarPct -Value $val -Max $maxDayVal
        [void]$sb.AppendLine(@"
<div class="bar-row">
  <div class="bar-label">$day</div>
  <div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:var(--cyan)"></div></div>
  <div class="bar-value">$val 消息</div>
</div>
"@)
    }
    [void]$sb.AppendLine('</div>')
}
[void]$sb.AppendLine('</div>')

# ── Section: 工具错误分析 ────────────────────────────
$errEntries = @(Get-DictEntries $agg.toolErrorCategoriesAggregated | Sort-Object { [int]$_.Value } -Descending)
[void]$sb.AppendLine('<div class="section" id="sec-errors"><h2><span class="icon">&#x26A0;</span> 工具错误分析</h2>')
if ($errEntries.Count -gt 0) {
    $maxErr = [int]($errEntries | Select-Object -First 1).Value
    [void]$sb.AppendLine('<h3>错误类别分布</h3><div class="bar-chart">')
    $errColors = @{ 'CommandFailed'='#ff7979'; 'EditFailed'='#ffab70'; 'FileNotFound'='#ffe082'; 'FileChanged'='#c792ea'; 'FileTooLarge'='#82aaff'; 'UserRejected'='#a3d9a5'; 'Other'='#8892b0' }
    foreach ($e in $errEntries) {
        $pct = BarPct -Value ([int]$e.Value) -Max $maxErr
        $color = if ($errColors.ContainsKey($e.Name)) { $errColors[$e.Name] } else { '#8892b0' }
        [void]$sb.AppendLine(@"
<div class="bar-row">
  <div class="bar-label">$(HE $e.Name)</div>
  <div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:$color"></div></div>
  <div class="bar-value">$($e.Value)</div>
</div>
"@)
    }
    [void]$sb.AppendLine('</div>')
} else {
    [void]$sb.AppendLine('<p style="color:var(--green);text-align:center;padding:20px">&#x2705; 无工具错误记录</p>')
}
[void]$sb.AppendLine('</div>')

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

# ── Section: 响应时间分布 ─────────────────────────────
$rtMax = ($rtBuckets | Measure-Object -Maximum).Maximum
if ($rtMax -gt 0) {
    [void]$sb.AppendLine('<div class="section" id="sec-response"><h2><span class="icon">&#x23F1;</span> 响应时间分布</h2>')
    [void]$sb.AppendLine('<div class="histogram">')
    $rtColors = @('#a3d9a5', '#7fdbca', '#82aaff', '#ffe082', '#ffab70', '#ff7979', '#e74c3c')
    for ($i = 0; $i -lt 7; $i++) {
        $heightPct = [math]::Round(($rtBuckets[$i] / $rtMax) * 100)
        $color = $rtColors[$i]
        [void]$sb.AppendLine("<div class=`"hist-bar-wrap`"><div class=`"hist-bar`" style=`"height:${heightPct}%;background:$color`"><span class=`"hist-count`">$($rtBuckets[$i])</span></div><div class=`"hist-label`">$($rtLabels[$i])</div></div>")
    }
    [void]$sb.AppendLine('</div>')
    [void]$sb.AppendLine("<p style=`"text-align:center;color:var(--fg2);font-size:0.8em;margin-top:8px`">中位数: $($agg.medianResponseTime)s &#x2022; 平均: $($agg.avgResponseTime)s</p>")
    [void]$sb.AppendLine('</div>')
}

# ── Section: 代码变更统计 ────────────────────────────
[void]$sb.AppendLine(@"
<div class="section" id="sec-code">
  <h2><span class="icon">&#x1F4DD;</span> 代码变更统计</h2>
  <div class="stats-row">
    <div class="stat-card"><div class="label">文件创建</div><div class="value">$($agg.totalFilesCreated)</div></div>
    <div class="stat-card"><div class="label">文件修改</div><div class="value">$($agg.totalFilesModified)</div></div>
    <div class="stat-card"><div class="label">替换操作</div><div class="value">$($agg.totalReplacements)</div></div>
  </div>
"@)

# Git 操作统计
if ($totalGitOpsCount -gt 0) {
    [void]$sb.AppendLine(@"
  <h3>Git 操作</h3>
  <div class="stats-row">
    <div class="stat-card"><div class="label">Commits</div><div class="value">$($totalGitOps.commits)</div></div>
    <div class="stat-card"><div class="label">Pushes</div><div class="value">$($totalGitOps.pushes)</div></div>
    <div class="stat-card"><div class="label">Merges</div><div class="value">$($totalGitOps.merges)</div></div>
    <div class="stat-card"><div class="label">Stashes</div><div class="value">$($totalGitOps.stashes)</div></div>
  </div>
"@)
}

# Diff 行数统计
if (($totalDiffLines.added + $totalDiffLines.removed) -gt 0) {
    [void]$sb.AppendLine(@"
  <h3>代码行变更</h3>
  <div class="stats-row">
    <div class="stat-card"><div class="label">新增行</div><div class="value" style="-webkit-text-fill-color:var(--green)">+$(Format-Number -N $totalDiffLines.added)</div></div>
    <div class="stat-card"><div class="label">删除行</div><div class="value" style="-webkit-text-fill-color:var(--red)">-$(Format-Number -N $totalDiffLines.removed)</div></div>
  </div>
"@)
}

# 按 workspace 的代码变更
$wsCodeEntries = @(Get-DictEntries $agg.byWorkspace | Where-Object { [int]$_.Value.userMessages -gt 0 } | Sort-Object { [int]$_.Value.userMessages } -Descending | Select-Object -First 10)
if ($wsCodeEntries.Count -gt 0) {
    [void]$sb.AppendLine('<h3>按 Workspace 的活跃度</h3><div class="bar-chart">')
    $maxWsMsg = [int]($wsCodeEntries | Select-Object -First 1).Value.userMessages
    foreach ($w in $wsCodeEntries) {
        $pct = BarPct -Value ([int]$w.Value.userMessages) -Max $maxWsMsg
        [void]$sb.AppendLine(@"
<div class="bar-row">
  <div class="bar-label">$(HE $w.Name)</div>
  <div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:var(--accent)"></div></div>
  <div class="bar-value">$($w.Value.sessions) sessions / $($w.Value.userMessages) msgs</div>
</div>
"@)
    }
    [void]$sb.AppendLine('</div>')
}
[void]$sb.AppendLine('</div>')

# ── Section: 语言分布 ────────────────────────────────
$langEntries = @(Get-DictEntries $agg.languageDistribution | Sort-Object { [int]$_.Value } -Descending)
if ($langEntries.Count -gt 0) {
    $maxLang = [int]($langEntries | Select-Object -First 1).Value
    [void]$sb.AppendLine('<div class="section" id="sec-lang"><h2><span class="icon">&#x1F4BB;</span> 编程语言分布</h2><div class="bar-chart">')
    $langColors = @('#64ffda', '#82aaff', '#c792ea', '#ffab70', '#ffe082', '#a3d9a5', '#ff7979', '#7fdbca')
    $lIdx = 0
    foreach ($l in $langEntries) {
        $pct = BarPct -Value ([int]$l.Value) -Max $maxLang
        $color = $langColors[$lIdx % $langColors.Count]
        [void]$sb.AppendLine(@"
<div class="bar-row">
  <div class="bar-label">$(HE $l.Name)</div>
  <div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:$color"></div></div>
  <div class="bar-value">$($l.Value)</div>
</div>
"@)
        $lIdx++
    }
    [void]$sb.AppendLine('</div></div>')
}

# ── Section: 异常检测 ────────────────────────────────
[void]$sb.AppendLine('<div class="section" id="sec-anomaly"><h2><span class="icon">&#x1F50D;</span> 异常检测</h2>')

# 超长 session
$longSessions = @($sessions | Where-Object { $_.durationMinutes -gt 120 } | Sort-Object durationMinutes -Descending | Select-Object -First 10)
[void]$sb.AppendLine(@"
<div class="collapse-toggle" onclick="toggleCollapse(this)">
  <span>&#x23F1; 超长 Session (&gt;2h): $($longSessions.Count) 个</span>
  <span class="arrow">&#x25B6;</span>
</div>
<div class="collapse-content">
"@)
if ($longSessions.Count -gt 0) {
    foreach ($ls in $longSessions) {
        $durStr = [math]::Round($ls.durationMinutes, 0)
        $wsName = if ($ls.workspaceName) { $ls.workspaceName } else { '' }
        [void]$sb.AppendLine("<div class=`"anomaly-item anomaly-warn`">$(HE $wsName) — ${durStr} 分钟 — $($ls.userMessageCount) 用户消息</div>")
    }
} else {
    [void]$sb.AppendLine('<div class="anomaly-item anomaly-ok">无超长 session</div>')
}
[void]$sb.AppendLine('</div>')

# 高错误率 session
$highErrSessions = @($sessions | Where-Object { $_.toolSuccessRate -lt 90 -and ($_.toolErrors -gt 0) } | Sort-Object toolSuccessRate | Select-Object -First 10)
[void]$sb.AppendLine(@"
<div class="collapse-toggle" onclick="toggleCollapse(this)">
  <span>&#x274C; 高错误率 Session (&lt;90% 成功率): $($highErrSessions.Count) 个</span>
  <span class="arrow">&#x25B6;</span>
</div>
<div class="collapse-content">
"@)
if ($highErrSessions.Count -gt 0) {
    foreach ($he in $highErrSessions) {
        $wsName = if ($he.workspaceName) { $he.workspaceName } else { '' }
        [void]$sb.AppendLine("<div class=`"anomaly-item`">$(HE $wsName) — 成功率 $($he.toolSuccessRate)% — $($he.toolErrors) 个错误</div>")
    }
} else {
    [void]$sb.AppendLine('<div class="anomaly-item anomaly-ok">所有 session 工具成功率均 ≥ 90%</div>')
}
[void]$sb.AppendLine('</div>')

# 超大数据 session（token > 100M）
$bigTokenSessions = @($sessions | Where-Object { ($_.inputTokens + $_.outputTokens) -gt 100000000 } | Sort-Object { $_.inputTokens + $_.outputTokens } -Descending | Select-Object -First 10)
[void]$sb.AppendLine(@"
<div class="collapse-toggle" onclick="toggleCollapse(this)">
  <span>&#x1F4E6; 超大 Token Session (&gt;100M): $($bigTokenSessions.Count) 个</span>
  <span class="arrow">&#x25B6;</span>
</div>
<div class="collapse-content">
"@)
if ($bigTokenSessions.Count -gt 0) {
    foreach ($bt in $bigTokenSessions) {
        $totalT = Format-Number -N ($bt.inputTokens + $bt.outputTokens)
        $wsName = if ($bt.workspaceName) { $bt.workspaceName } else { '' }
        [void]$sb.AppendLine("<div class=`"anomaly-item anomaly-warn`">$(HE $wsName) — $totalT tokens — $($bt.llmCalls) LLM calls</div>")
    }
} else {
    [void]$sb.AppendLine('<div class="anomaly-item anomaly-ok">无超大 Token session</div>')
}
[void]$sb.AppendLine('</div>')

[void]$sb.AppendLine('</div>')

# ── Section: Workspace 概览 ──────────────────────────
$wsOverview = @(Get-DictEntries $agg.byWorkspace | Sort-Object { [long]$_.Value.inputTokens } -Descending)
if ($wsOverview.Count -gt 0) {
    [void]$sb.AppendLine('<div class="section" id="sec-ws"><h2><span class="icon">&#x1F4C2;</span> Workspace 概览</h2><div class="ws-grid">')

    foreach ($w in $wsOverview) {
        $wsSessions = $w.Value.sessions
        $wsMsgs     = $w.Value.userMessages
        $wsTokens   = Format-Number -N ([long]$w.Value.inputTokens)

        # 查找该 workspace 的 top subagent
        $wsSessionObjs = @($sessions | Where-Object { $_.workspaceName -eq $w.Name })
        $wsSubagents = @{}
        foreach ($ws in $wsSessionObjs) {
            $saEntries = Get-DictEntries $ws.subagentNames
            foreach ($sa in $saEntries) {
                if ($wsSubagents.ContainsKey($sa.Name)) { $wsSubagents[$sa.Name] += [int]$sa.Value }
                else { $wsSubagents[$sa.Name] = [int]$sa.Value }
            }
        }
        $topAgent = ''
        if ($wsSubagents.Count -gt 0) {
            $topAgent = ($wsSubagents.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1).Key
        }

        # Feature usage badges
        $wsMcp = $false; $wsWeb = $false; $wsBrowser = $false
        foreach ($ws in $wsSessionObjs) {
            if ($ws.featureUsage) {
                if ($ws.featureUsage.usesMcp) { $wsMcp = $true }
                if ($ws.featureUsage.usesWebSearch -or $ws.featureUsage.usesWebFetch) { $wsWeb = $true }
                if ($ws.featureUsage.usesBrowser) { $wsBrowser = $true }
            }
        }
        $badgesHtml = ''
        if ($wsMcp)     { $badgesHtml += '<span class="feature-badge active">MCP</span>' }
        if ($wsWeb)     { $badgesHtml += '<span class="feature-badge active">WebSearch</span>' }
        if ($wsBrowser) { $badgesHtml += '<span class="feature-badge active">Browser</span>' }
        if ($badgesHtml) { $badgesHtml = "<div style='margin-top:6px'>$badgesHtml</div>" }

        [void]$sb.AppendLine(@"
<div class="ws-card">
  <div class="ws-name">$(HE $w.Name)</div>
  <div class="ws-stat"><span>Sessions</span><span class="ws-stat-val">$wsSessions</span></div>
  <div class="ws-stat"><span>用户消息</span><span class="ws-stat-val">$wsMsgs</span></div>
  <div class="ws-stat"><span>Input Tokens</span><span class="ws-stat-val">$wsTokens</span></div>
  <div class="ws-stat"><span>主要 Agent</span><span class="ws-stat-val">$(HE $topAgent)</span></div>
  $badgesHtml
</div>
"@)
    }
    [void]$sb.AppendLine('</div></div>')
}

# ── Footer ────────────────────────────────────────────
$dataFileName = Split-Path $DataPath -Leaf
[void]$sb.AppendLine(@"
<div class="footer">
  <p>数据来源: $(HE $dataFileName) &nbsp;&bull;&nbsp; 扫描 $($meta.totalFiles) 个文件 &nbsp;&bull;&nbsp; 耗时 $($meta.scanDurationMs) ms</p>
  <p>生成命令: <code>generate-insight-report.ps1 -DataPath $(HE $dataFileName)</code></p>
  <p>Parking Agents Insight Toolkit &nbsp;&bull;&nbsp; $now</p>
</div>

<script>
function toggleNav() {
  var nav = document.getElementById('navToc');
  nav.classList.toggle('open');
}
function toggleCollapse(el) {
  var content = el.nextElementSibling;
  var arrow = el.querySelector('.arrow');
  if (content.classList.contains('open')) {
    content.classList.remove('open');
    arrow.classList.remove('open');
  } else {
    content.classList.add('open');
    arrow.classList.add('open');
  }
}
// 自动展开有异常的折叠区
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.collapse-content').forEach(function(el) {
    var hasAnomaly = el.querySelector('.anomaly-item:not(.anomaly-ok)');
    if (hasAnomaly) {
      el.classList.add('open');
      var arrow = el.previousElementSibling.querySelector('.arrow');
      if (arrow) arrow.classList.add('open');
    }
  });
});
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
Write-Host "[done] HTML 报告已生成: $OutputPath ($sizeKB KB)" -ForegroundColor Green
