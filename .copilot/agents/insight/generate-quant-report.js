#!/usr/bin/env node
'use strict';

/**
 * generate-quant-report.js
 * 读取 analyze-insight.js 的输出 JSON，生成仅包含客观/定量数据的 HTML 报告。
 *
 * 生成单文件暗色主题 HTML 报告，包含 Token 消耗、工具使用热力图、
 * 时间分布、代码变更、异常检测等多维度可视化。
 * 不包含任何 LLM 生成的定性分析（分面、叙事等）。
 * 零外部依赖，CSS + JS 全内联。
 *
 * Usage:
 *   node generate-quant-report.js --data-path ./reports/insight-data.json
 *   node generate-quant-report.js --data-path ./reports/insight-data.json --output-path ./reports/quant.html --title "Weekly Quant"
 */

const fs = require('fs');
const path = require('path');

// ── 本地时区日期格式化 ────────────────────────────────
function formatLocalDate(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function formatLocalDateTime(d) {
    return `${formatLocalDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

// ── CLI 参数解析 ─────────────────────────────────────
function parseArgs(argv) {
    const args = {
        dataPath: null,
        outputPath: 'reports/insight-quant-report.html',
        title: 'VS Code Copilot Insight Report — 客观数据',
    };

    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        switch (arg) {
            case '--data-path':
                args.dataPath = argv[++i];
                break;
            case '--output-path':
                args.outputPath = argv[++i];
                break;
            case '--title':
                args.title = argv[++i];
                break;
            default:
                console.log(`[warn] 未知参数: ${arg}`);
        }
    }

    if (!args.dataPath) {
        console.error('[error] 必须指定 --data-path <path>');
        process.exit(1);
    }

    return args;
}

const args = parseArgs(process.argv);

// ── 加载数据 ──────────────────────────────────────────
if (!fs.existsSync(args.dataPath)) {
    console.error(`数据文件不存在: ${args.dataPath}`);
    process.exit(1);
}

let data;
try {
    const rawJson = fs.readFileSync(path.resolve(args.dataPath), 'utf-8');
    data = JSON.parse(rawJson);
} catch (e) {
    console.error(`无法解析数据文件: ${e.message}`);
    process.exit(1);
}

const meta = data.meta;
const sessions = Array.isArray(data.sessions) ? data.sessions : [];
const agg = data.aggregated;
const now = formatLocalDateTime(new Date());

// ── 计算响应时间分布桶 ────────────────────────────────
const rtBuckets = [0, 0, 0, 0, 0, 0, 0];
const rtLabels = ['&lt;1s', '1-5s', '5-15s', '15-30s', '30-60s', '1-5min', '&gt;5min'];
for (const s of sessions) {
    if (s.userResponseTimes) {
        for (const rt of s.userResponseTimes) {
            const v = Number(rt);
            if (v < 1) rtBuckets[0]++;
            else if (v < 5) rtBuckets[1]++;
            else if (v < 15) rtBuckets[2]++;
            else if (v < 30) rtBuckets[3]++;
            else if (v < 60) rtBuckets[4]++;
            else if (v < 300) rtBuckets[5]++;
            else rtBuckets[6]++;
        }
    }
}

// ── 聚合 Git 操作和 Diff 数据 ─────────────────────────
const totalGitOps = { commits: 0, pushes: 0, merges: 0, stashes: 0 };
const totalDiffLines = { added: 0, removed: 0 };
for (const s of sessions) {
    if (s.gitOperations) {
        totalGitOps.commits += Number(s.gitOperations.commits) || 0;
        totalGitOps.pushes += Number(s.gitOperations.pushes) || 0;
        totalGitOps.merges += Number(s.gitOperations.merges) || 0;
        totalGitOps.stashes += Number(s.gitOperations.stashes) || 0;
    }
    if (s.diffLines) {
        totalDiffLines.added += Number(s.diffLines.added) || 0;
        totalDiffLines.removed += Number(s.diffLines.removed) || 0;
    }
}
const totalGitOpsCount = totalGitOps.commits + totalGitOps.pushes + totalGitOps.merges + totalGitOps.stashes;

// ── HTML 辅助函数 ─────────────────────────────────────
function he(text) {
    if (!text) return '';
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatNumber(n) {
    n = Number(n) || 0;
    if (n >= 1000000000) return (n / 1000000000).toFixed(1) + 'B';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
}

function barPct(value, max) {
    if (max <= 0) return 0;
    return Math.min(100, Math.round((value / max) * 100));
}

// 提取字典属性的通用方法
function getDictEntries(dict) {
    if (!dict) return [];
    if (typeof dict !== 'object') return [];
    return Object.entries(dict).map(([name, value]) => ({ name, value }));
}

// ── 计算时间跨度 ─────────────────────────────────────
let timeSpan = '';
if (sessions.length > 0) {
    const startTimes = sessions
        .filter(s => s.startTime)
        .map(s => { try { return new Date(s.startTime); } catch { return null; } })
        .filter(d => d && !isNaN(d.getTime()));
    if (startTimes.length > 0) {
        startTimes.sort((a, b) => a - b);
        const fmt = d => formatLocalDate(d);
        const earliest = fmt(startTimes[0]);
        const latest = fmt(startTimes[startTimes.length - 1]);
        timeSpan = `${earliest} ~ ${latest}`;
    }
}

// ── 构建 HTML ─────────────────────────────────────────
const parts = [];

parts.push(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${he(args.title)}</title>
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
.header .subtitle-badge {
  display: inline-block;
  margin-top: 8px;
  padding: 4px 14px;
  border-radius: 12px;
  background: rgba(100,255,218,0.1);
  border: 1px solid rgba(100,255,218,0.3);
  color: var(--accent);
  font-size: 0.8em;
  letter-spacing: 0.5px;
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
  <a href="#sec-response">&#x23F1; 响应时间</a>
  <a href="#sec-code">&#x1F4DD; 代码变更</a>
  <a href="#sec-lang">&#x1F4BB; 语言分布</a>
  <a href="#sec-anomaly">&#x1F50D; 异常检测</a>
  <a href="#sec-ws">&#x1F4C2; Workspace</a>
</nav>
`);

// ── Header ────────────────────────────────────────────
const totalTokensStr = formatNumber(agg.totalInputTokens + agg.totalOutputTokens);
parts.push(`<div class="header" id="sec-header">
  <h1>${he(args.title)}</h1>
  <div class="subtitle">
    扫描日期: ${meta.scanDate} &nbsp;&bull;&nbsp;
    Sessions: ${agg.totalSessions} &nbsp;&bull;&nbsp;
    时间跨度: ${he(timeSpan)} &nbsp;&bull;&nbsp;
    数据量: ${meta.totalSizeMB} MB
  </div>
  <div class="subtitle-badge">仅客观数据 &middot; 零 LLM 成本</div>
</div>
`);

// ── Stats Cards ───────────────────────────────────────
const totalMsgs = agg.totalUserMessages + agg.totalAssistantMessages;
parts.push(`<div class="stats-row">
  <div class="stat-card">
    <div class="label">总消息数</div>
    <div class="value">${formatNumber(totalMsgs)}</div>
    <div class="sub">用户 ${formatNumber(agg.totalUserMessages)} / 助手 ${formatNumber(agg.totalAssistantMessages)}</div>
  </div>
  <div class="stat-card">
    <div class="label">总 Token</div>
    <div class="value">${totalTokensStr}</div>
    <div class="sub">输入 ${formatNumber(agg.totalInputTokens)} / 输出 ${formatNumber(agg.totalOutputTokens)}</div>
  </div>
  <div class="stat-card">
    <div class="label">活跃天数</div>
    <div class="value">${agg.daysActive}</div>
    <div class="sub">平均 ${agg.messagesPerDay} 消息/天</div>
  </div>
  <div class="stat-card">
    <div class="label">平均会话时长</div>
    <div class="value">${agg.avgSessionDuration} min</div>
    <div class="sub">中位响应 ${agg.medianResponseTime}s</div>
  </div>
  <div class="stat-card">
    <div class="label">并行 Session</div>
    <div class="value">${agg.multiClaudingSessions}</div>
    <div class="sub">Multi-Clauding</div>
  </div>
</div>
`);

// ── Section: Agent 使用分布 ───────────────────────────
const subagentEntries = getDictEntries(agg.subagentDistribution)
    .sort((a, b) => Number(b.value) - Number(a.value));

if (subagentEntries.length > 0) {
    const maxSA = Number(subagentEntries[0].value);
    parts.push('<div class="section" id="sec-agents"><h2><span class="icon">&#x1F916;</span> Agent 使用分布</h2>');

    // 水平 Bar Chart
    const saColors = ['#64ffda', '#82aaff', '#c792ea', '#ffab70', '#ff7979', '#ffe082', '#a3d9a5', '#7fdbca'];
    parts.push('<h3>调用次数</h3><div class="bar-chart">');
    subagentEntries.forEach((e, idx) => {
        const pct = barPct(Number(e.value), maxSA);
        const color = saColors[idx % saColors.length];
        parts.push(`<div class="bar-row">
  <div class="bar-label">${he(e.name)}</div>
  <div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
  <div class="bar-value">${e.value}</div>
</div>
`);
    });
    parts.push('</div>');

    // 比例条
    let totalSACalls = 0;
    for (const e of subagentEntries) totalSACalls += Number(e.value);
    if (totalSACalls > 0) {
        parts.push('<h3>调用比例</h3><div class="proportion-bar">');
        subagentEntries.forEach((e, idx) => {
            const flex = Math.max(1, Math.round((Number(e.value) / totalSACalls) * 100));
            const color = saColors[idx % saColors.length];
            const label = flex >= 8 ? e.name : '';
            parts.push(`<div class="proportion-segment" style="flex:${flex};background:${color}" title="${he(e.name)}: ${e.value}">${label}</div>`);
        });
        parts.push('</div><div class="proportion-legend">');
        subagentEntries.forEach((e, idx) => {
            const color = saColors[idx % saColors.length];
            const pctStr = ((Number(e.value) / totalSACalls) * 100).toFixed(1);
            parts.push(`<div class="legend-item"><div class="legend-dot" style="background:${color}"></div>${he(e.name)} (${pctStr}%)</div>`);
        });
        parts.push('</div>');
    }
    parts.push('</div>');
}

// ── Section: 工具使用热力图 ───────────────────────────
const toolEntries = getDictEntries(agg.toolCountsAggregated)
    .sort((a, b) => Number(b.value) - Number(a.value));

if (toolEntries.length > 0) {
    parts.push('<div class="section" id="sec-tools"><h2><span class="icon">&#x1F527;</span> 工具使用分析</h2>');

    // 工具调用 Top 20 bar
    const topTools = toolEntries.slice(0, 20);
    const maxTool = Number(topTools[0].value);

    parts.push('<h3>工具调用排行（Top 20）</h3><div class="bar-chart">');
    for (const t of topTools) {
        const pct = barPct(Number(t.value), maxTool);
        parts.push(`<div class="bar-row">
  <div class="bar-label">${he(t.name)}</div>
  <div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:var(--accent2)"></div></div>
  <div class="bar-value">${formatNumber(Number(t.value))}</div>
</div>
`);
    }
    parts.push('</div>');

    // 热力图：session × tool（取前 15 个工具，前 20 个 session）
    const topToolNames = topTools.slice(0, 15).map(t => t.name);
    const recentSessions = [...sessions]
        .sort((a, b) => (b.startTime || '').localeCompare(a.startTime || ''))
        .slice(0, 20);

    if (recentSessions.length > 0 && topToolNames.length > 0) {
        parts.push('<h3>Session × 工具 热力图（最近 20 个 session）</h3>');
        parts.push('<div style="overflow-x:auto"><table>');
        let headerRow = '<tr><th>Session</th>';
        for (const tn of topToolNames) {
            const short = tn.length > 14 ? tn.substring(0, 12) + '..' : tn;
            headerRow += `<th title="${he(tn)}">${he(short)}</th>`;
        }
        headerRow += '</tr>';
        parts.push(headerRow);

        // 计算热力图最大值
        let heatMax = 1;
        for (const s of recentSessions) {
            const tc = getDictEntries(s.toolCounts);
            for (const e of tc) {
                if (Number(e.value) > heatMax) heatMax = Number(e.value);
            }
        }

        for (const s of recentSessions) {
            const sLabel = s.workspaceName || (s.sessionId ? s.sessionId.substring(0, Math.min(8, s.sessionId.length)) : '');
            let row = `<tr><td title="${he(s.sessionId)}"><strong>${he(sLabel)}</strong></td>`;
            const tcMap = {};
            for (const e of getDictEntries(s.toolCounts)) {
                tcMap[e.name] = Number(e.value);
            }
            for (const tn of topToolNames) {
                const cnt = tcMap[tn] || 0;
                let level;
                if (cnt === 0) level = 0;
                else if (cnt <= heatMax * 0.1) level = 1;
                else if (cnt <= heatMax * 0.3) level = 2;
                else if (cnt <= heatMax * 0.5) level = 3;
                else if (cnt <= heatMax * 0.8) level = 4;
                else level = 5;
                row += `<td class="heat-${level}" title="${cnt}">${cnt}</td>`;
            }
            row += '</tr>';
            parts.push(row);
        }
        parts.push('</table></div>');
    }

    // 工具成功率
    const successPct = agg.avgToolSuccessRate;
    const successColor = successPct >= 95 ? 'var(--green)' : successPct >= 80 ? 'var(--yellow)' : 'var(--red)';
    parts.push(`<h3>工具成功率: ${successPct}%</h3>`);
    parts.push(`<div class="bar-chart">
<div class="bar-row">
  <div class="bar-label">整体成功率</div>
  <div class="bar-container"><div class="bar-fill" style="width:${successPct}%;background:${successColor}"></div></div>
  <div class="bar-value">${successPct}% (${agg.totalToolCalls - agg.totalToolErrors}/${agg.totalToolCalls})</div>
</div>
</div>
`);

    parts.push('</div>');
}

// ── Section: Token 消耗分析 ──────────────────────────
parts.push('<div class="section" id="sec-tokens"><h2><span class="icon">&#x1F4CA;</span> Token 消耗分析</h2>');

// 按模型分布
const modelEntries = getDictEntries(agg.modelDistribution)
    .sort((a, b) => Number(b.value) - Number(a.value));
if (modelEntries.length > 0) {
    const maxModel = Number(modelEntries[0].value);
    const modelColors = ['#64ffda', '#82aaff', '#c792ea', '#ffab70', '#ffe082'];
    parts.push('<h3>按模型的 Token 分布</h3><div class="bar-chart">');
    modelEntries.forEach((m, idx) => {
        const pct = barPct(Number(m.value), maxModel);
        const color = modelColors[idx % modelColors.length];
        parts.push(`<div class="bar-row">
  <div class="bar-label">${he(m.name)}</div>
  <div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
  <div class="bar-value">${formatNumber(Number(m.value))}</div>
</div>
`);
    });
    parts.push('</div>');
}

// 按 workspace 分布
const wsEntries = getDictEntries(agg.byWorkspace)
    .sort((a, b) => Number((b.value || {}).inputTokens || 0) - Number((a.value || {}).inputTokens || 0))
    .slice(0, 15);
if (wsEntries.length > 0) {
    let maxWsTokens = Number((wsEntries[0].value || {}).inputTokens || 0);
    if (maxWsTokens <= 0) maxWsTokens = 1;
    parts.push('<h3>按 Workspace 的 Token 分布（Top 15）</h3><div class="bar-chart">');
    for (const w of wsEntries) {
        const tokens = Number((w.value || {}).inputTokens || 0);
        const pct = barPct(tokens, maxWsTokens);
        parts.push(`<div class="bar-row">
  <div class="bar-label">${he(w.name)}</div>
  <div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:var(--accent3)"></div></div>
  <div class="bar-value">${formatNumber(tokens)}</div>
</div>
`);
    }
    parts.push('</div>');
}

// Input/Output 比率
const totalIn = Number(agg.totalInputTokens) || 0;
const totalOut = Number(agg.totalOutputTokens) || 0;
const totalAll = totalIn + totalOut;
if (totalAll > 0) {
    const inPct = ((totalIn / totalAll) * 100).toFixed(1);
    const outPct = ((totalOut / totalAll) * 100).toFixed(1);
    parts.push(`<h3>Input / Output 比率</h3>
<div class="proportion-bar">
  <div class="proportion-segment" style="flex:${Math.max(1, Number(inPct))};background:var(--accent2)">Input ${inPct}%</div>
  <div class="proportion-segment" style="flex:${Math.max(1, Number(outPct))};background:var(--accent3)">Output ${outPct}%</div>
</div>
`);
}
parts.push('</div>');

// ── Section: 时间分布 ────────────────────────────────
parts.push('<div class="section" id="sec-time"><h2><span class="icon">&#x23F0;</span> 时间分布</h2>');

// 24 小时活动热力图
const hourly = Array.isArray(agg.hourlyDistribution) ? agg.hourlyDistribution : [];
let maxHour = 1;
for (const h of hourly) { if (Number(h) > maxHour) maxHour = Number(h); }

const hourColors = ['#1a1a2e', '#0d2137', '#0f3460', '#1a5276', '#217dbb', '#3498db'];
parts.push('<h3>24 小时活动分布</h3><div class="hourly-grid">');
for (let i = 0; i < 24; i++) {
    const val = i < hourly.length ? Number(hourly[i]) : 0;
    let level;
    if (val === 0) level = 0;
    else if (val <= maxHour * 0.1) level = 1;
    else if (val <= maxHour * 0.3) level = 2;
    else if (val <= maxHour * 0.5) level = 3;
    else if (val <= maxHour * 0.8) level = 4;
    else level = 5;
    const bgColor = hourColors[level];
    const textColor = level >= 4 ? '#fff' : 'var(--fg2)';
    parts.push(`<div class="hour-cell" style="background:${bgColor};color:${textColor}" title="${i}:00 — ${val} 条消息">${val}</div>`);
}
parts.push('</div><div class="hour-label">');
for (let i = 0; i < 24; i++) {
    parts.push(`<span>${i}h</span>`);
}
parts.push('</div>');

// 日历热力图（按天聚合）
const dayMap = {};
for (const s of sessions) {
    if (!s.startTime) continue;
    try {
        const day = formatLocalDate(new Date(s.startTime));
        dayMap[day] = (dayMap[day] || 0) + (s.userMessageCount || 0);
    } catch { /* skip */ }
}
const sortedDays = Object.keys(dayMap).sort();
if (sortedDays.length > 1) {
    let maxDayVal = 1;
    for (const v of Object.values(dayMap)) { if (Number(v) > maxDayVal) maxDayVal = Number(v); }

    parts.push('<h3>每日活动量</h3><div class="bar-chart">');
    for (const day of sortedDays) {
        const val = dayMap[day];
        const pct = barPct(val, maxDayVal);
        parts.push(`<div class="bar-row">
  <div class="bar-label">${day}</div>
  <div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:var(--cyan)"></div></div>
  <div class="bar-value">${val} 消息</div>
</div>
`);
    }
    parts.push('</div>');
}
parts.push('</div>');

// ── Section: 工具错误分析 ────────────────────────────
const errEntries = getDictEntries(agg.toolErrorCategoriesAggregated)
    .sort((a, b) => Number(b.value) - Number(a.value));
parts.push('<div class="section" id="sec-errors"><h2><span class="icon">&#x26A0;</span> 工具错误分析</h2>');
if (errEntries.length > 0) {
    const maxErr = Number(errEntries[0].value);
    const errColors = { CommandFailed: '#ff7979', EditFailed: '#ffab70', FileNotFound: '#ffe082', FileChanged: '#c792ea', FileTooLarge: '#82aaff', UserRejected: '#a3d9a5', Other: '#8892b0' };
    parts.push('<h3>错误类别分布</h3><div class="bar-chart">');
    for (const e of errEntries) {
        const pct = barPct(Number(e.value), maxErr);
        const color = errColors[e.name] || '#8892b0';
        parts.push(`<div class="bar-row">
  <div class="bar-label">${he(e.name)}</div>
  <div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
  <div class="bar-value">${e.value}</div>
</div>
`);
    }
    parts.push('</div>');
} else {
    parts.push('<p style="color:var(--green);text-align:center;padding:20px">&#x2705; 无工具错误记录</p>');
}
parts.push('</div>');

// ── Section: 响应时间分布 ─────────────────────────────
const rtMax = Math.max(...rtBuckets);
if (rtMax > 0) {
    parts.push('<div class="section" id="sec-response"><h2><span class="icon">&#x23F1;</span> 响应时间分布</h2>');
    parts.push('<div class="histogram">');
    const rtColors = ['#a3d9a5', '#7fdbca', '#82aaff', '#ffe082', '#ffab70', '#ff7979', '#e74c3c'];
    for (let i = 0; i < 7; i++) {
        const heightPct = Math.round((rtBuckets[i] / rtMax) * 100);
        const color = rtColors[i];
        parts.push(`<div class="hist-bar-wrap"><div class="hist-bar" style="height:${heightPct}%;background:${color}"><span class="hist-count">${rtBuckets[i]}</span></div><div class="hist-label">${rtLabels[i]}</div></div>`);
    }
    parts.push('</div>');
    parts.push(`<p style="text-align:center;color:var(--fg2);font-size:0.8em;margin-top:8px">中位数: ${agg.medianResponseTime}s &#x2022; 平均: ${agg.avgResponseTime}s</p>`);
    parts.push('</div>');
}

// ── Section: 代码变更统计 ────────────────────────────
parts.push(`<div class="section" id="sec-code">
  <h2><span class="icon">&#x1F4DD;</span> 代码变更统计</h2>
  <div class="stats-row">
    <div class="stat-card"><div class="label">文件创建</div><div class="value">${agg.totalFilesCreated}</div></div>
    <div class="stat-card"><div class="label">文件修改</div><div class="value">${agg.totalFilesModified}</div></div>
    <div class="stat-card"><div class="label">替换操作</div><div class="value">${agg.totalReplacements}</div></div>
  </div>
`);

// Git 操作统计
if (totalGitOpsCount > 0) {
    parts.push(`  <h3>Git 操作</h3>
  <div class="stats-row">
    <div class="stat-card"><div class="label">Commits</div><div class="value">${totalGitOps.commits}</div></div>
    <div class="stat-card"><div class="label">Pushes</div><div class="value">${totalGitOps.pushes}</div></div>
    <div class="stat-card"><div class="label">Merges</div><div class="value">${totalGitOps.merges}</div></div>
    <div class="stat-card"><div class="label">Stashes</div><div class="value">${totalGitOps.stashes}</div></div>
  </div>
`);
}

// Diff 行数统计
if ((totalDiffLines.added + totalDiffLines.removed) > 0) {
    parts.push(`  <h3>代码行变更</h3>
  <div class="stats-row">
    <div class="stat-card"><div class="label">新增行</div><div class="value" style="-webkit-text-fill-color:var(--green)">+${formatNumber(totalDiffLines.added)}</div></div>
    <div class="stat-card"><div class="label">删除行</div><div class="value" style="-webkit-text-fill-color:var(--red)">-${formatNumber(totalDiffLines.removed)}</div></div>
  </div>
`);
}

// 按 workspace 的代码变更
const wsCodeEntries = getDictEntries(agg.byWorkspace)
    .filter(w => Number((w.value || {}).userMessages || 0) > 0)
    .sort((a, b) => Number((b.value || {}).userMessages || 0) - Number((a.value || {}).userMessages || 0))
    .slice(0, 10);
if (wsCodeEntries.length > 0) {
    const maxWsMsg = Number(wsCodeEntries[0].value.userMessages);
    parts.push('<h3>按 Workspace 的活跃度</h3><div class="bar-chart">');
    for (const w of wsCodeEntries) {
        const pct = barPct(Number(w.value.userMessages), maxWsMsg);
        parts.push(`<div class="bar-row">
  <div class="bar-label">${he(w.name)}</div>
  <div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:var(--accent)"></div></div>
  <div class="bar-value">${w.value.sessions} sessions / ${w.value.userMessages} msgs</div>
</div>
`);
    }
    parts.push('</div>');
}
parts.push('</div>');

// ── Section: 语言分布 ────────────────────────────────
const langEntries = getDictEntries(agg.languageDistribution)
    .sort((a, b) => Number(b.value) - Number(a.value));
if (langEntries.length > 0) {
    const maxLang = Number(langEntries[0].value);
    const langColors = ['#64ffda', '#82aaff', '#c792ea', '#ffab70', '#ffe082', '#a3d9a5', '#ff7979', '#7fdbca'];
    parts.push('<div class="section" id="sec-lang"><h2><span class="icon">&#x1F4BB;</span> 编程语言分布</h2><div class="bar-chart">');
    langEntries.forEach((l, idx) => {
        const pct = barPct(Number(l.value), maxLang);
        const color = langColors[idx % langColors.length];
        parts.push(`<div class="bar-row">
  <div class="bar-label">${he(l.name)}</div>
  <div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
  <div class="bar-value">${l.value}</div>
</div>
`);
    });
    parts.push('</div></div>');
}

// ── Section: 异常检测 ────────────────────────────────
parts.push('<div class="section" id="sec-anomaly"><h2><span class="icon">&#x1F50D;</span> 异常检测</h2>');

// 超长 session
const longSessions = sessions
    .filter(s => s.durationMinutes > 120)
    .sort((a, b) => b.durationMinutes - a.durationMinutes)
    .slice(0, 10);
parts.push(`<div class="collapse-toggle" onclick="toggleCollapse(this)">
  <span>&#x23F1; 超长 Session (&gt;2h): ${longSessions.length} 个</span>
  <span class="arrow">&#x25B6;</span>
</div>
<div class="collapse-content">
`);
if (longSessions.length > 0) {
    for (const ls of longSessions) {
        const durStr = Math.round(ls.durationMinutes);
        const wsName = ls.workspaceName || '';
        parts.push(`<div class="anomaly-item anomaly-warn">${he(wsName)} — ${durStr} 分钟 — ${ls.userMessageCount} 用户消息</div>`);
    }
} else {
    parts.push('<div class="anomaly-item anomaly-ok">无超长 session</div>');
}
parts.push('</div>');

// 高错误率 session
const highErrSessions = sessions
    .filter(s => s.toolSuccessRate < 90 && (s.toolErrors > 0))
    .sort((a, b) => a.toolSuccessRate - b.toolSuccessRate)
    .slice(0, 10);
parts.push(`<div class="collapse-toggle" onclick="toggleCollapse(this)">
  <span>&#x274C; 高错误率 Session (&lt;90% 成功率): ${highErrSessions.length} 个</span>
  <span class="arrow">&#x25B6;</span>
</div>
<div class="collapse-content">
`);
if (highErrSessions.length > 0) {
    for (const he_ of highErrSessions) {
        const wsName = he_.workspaceName || '';
        parts.push(`<div class="anomaly-item">${he(wsName)} — 成功率 ${he_.toolSuccessRate}% — ${he_.toolErrors} 个错误</div>`);
    }
} else {
    parts.push('<div class="anomaly-item anomaly-ok">所有 session 工具成功率均 ≥ 90%</div>');
}
parts.push('</div>');

// 超大数据 session（token > 100M）
const bigTokenSessions = sessions
    .filter(s => (s.inputTokens + s.outputTokens) > 100000000)
    .sort((a, b) => (b.inputTokens + b.outputTokens) - (a.inputTokens + a.outputTokens))
    .slice(0, 10);
parts.push(`<div class="collapse-toggle" onclick="toggleCollapse(this)">
  <span>&#x1F4E6; 超大 Token Session (&gt;100M): ${bigTokenSessions.length} 个</span>
  <span class="arrow">&#x25B6;</span>
</div>
<div class="collapse-content">
`);
if (bigTokenSessions.length > 0) {
    for (const bt of bigTokenSessions) {
        const totalT = formatNumber(bt.inputTokens + bt.outputTokens);
        const wsName = bt.workspaceName || '';
        parts.push(`<div class="anomaly-item anomaly-warn">${he(wsName)} — ${totalT} tokens — ${bt.llmCalls} LLM calls</div>`);
    }
} else {
    parts.push('<div class="anomaly-item anomaly-ok">无超大 Token session</div>');
}
parts.push('</div>');

parts.push('</div>');

// ── Section: Workspace 概览 ──────────────────────────
const wsOverview = getDictEntries(agg.byWorkspace)
    .sort((a, b) => Number((b.value || {}).inputTokens || 0) - Number((a.value || {}).inputTokens || 0));
if (wsOverview.length > 0) {
    parts.push('<div class="section" id="sec-ws"><h2><span class="icon">&#x1F4C2;</span> Workspace 概览</h2><div class="ws-grid">');

    for (const w of wsOverview) {
        const wsSessions = w.value.sessions;
        const wsMsgs = w.value.userMessages;
        const wsTokens = formatNumber(Number(w.value.inputTokens));

        // 查找该 workspace 的 top subagent
        const wsSessionObjs = sessions.filter(s => s.workspaceName === w.name);
        const wsSubagents = {};
        for (const ws of wsSessionObjs) {
            for (const sa of getDictEntries(ws.subagentNames)) {
                wsSubagents[sa.name] = (wsSubagents[sa.name] || 0) + Number(sa.value);
            }
        }
        let topAgent = '';
        const wsSubEntries = Object.entries(wsSubagents);
        if (wsSubEntries.length > 0) {
            wsSubEntries.sort((a, b) => b[1] - a[1]);
            topAgent = wsSubEntries[0][0];
        }

        // Feature usage badges
        let wsMcp = false, wsWeb = false, wsBrowser = false;
        for (const ws of wsSessionObjs) {
            if (ws.featureUsage) {
                if (ws.featureUsage.usesMcp) wsMcp = true;
                if (ws.featureUsage.usesWebSearch || ws.featureUsage.usesWebFetch) wsWeb = true;
                if (ws.featureUsage.usesBrowser) wsBrowser = true;
            }
        }
        let badgesHtml = '';
        if (wsMcp) badgesHtml += '<span class="feature-badge active">MCP</span>';
        if (wsWeb) badgesHtml += '<span class="feature-badge active">WebSearch</span>';
        if (wsBrowser) badgesHtml += '<span class="feature-badge active">Browser</span>';
        if (badgesHtml) badgesHtml = `<div style='margin-top:6px'>${badgesHtml}</div>`;

        parts.push(`<div class="ws-card">
  <div class="ws-name">${he(w.name)}</div>
  <div class="ws-stat"><span>Sessions</span><span class="ws-stat-val">${wsSessions}</span></div>
  <div class="ws-stat"><span>用户消息</span><span class="ws-stat-val">${wsMsgs}</span></div>
  <div class="ws-stat"><span>Input Tokens</span><span class="ws-stat-val">${wsTokens}</span></div>
  <div class="ws-stat"><span>主要 Agent</span><span class="ws-stat-val">${he(topAgent)}</span></div>
  ${badgesHtml}
</div>
`);
    }
    parts.push('</div></div>');
}

// ── Footer ────────────────────────────────────────────
const dataFileName = path.basename(args.dataPath);
parts.push(`<div class="footer">
  <p>数据来源: ${he(dataFileName)} &nbsp;&bull;&nbsp; 扫描 ${meta.totalFiles} 个文件 &nbsp;&bull;&nbsp; 耗时 ${meta.scanDurationMs} ms</p>
  <p>生成命令: <code>generate-quant-report.js --data-path ${he(dataFileName)}</code></p>
  <p>Parking Agents Insight Toolkit (Quant Only) &nbsp;&bull;&nbsp; ${now}</p>
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
`);

// ── 写出 ──────────────────────────────────────────────
const html = parts.join('\n');
const outputDir = path.dirname(path.resolve(args.outputPath));
if (outputDir && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}
fs.writeFileSync(path.resolve(args.outputPath), html, 'utf-8');

const sizeKB = (Buffer.byteLength(html, 'utf-8') / 1024).toFixed(1);
console.log(`[done] HTML 报告已生成: ${args.outputPath} (${sizeKB} KB)`);
