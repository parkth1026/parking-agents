#!/usr/bin/env node
'use strict';

/**
 * generate-qual-report.js
 * 生成 LLM 语义分析 HTML 报告（定性分析部分）。
 *
 * 读取 facets-cache 和 insight-narratives 数据，生成单文件暗色主题 HTML 报告，
 * 包含目标分布、成果分析、满意度、摩擦分析、叙事洞察等 LLM 语义分析维度。
 * 不包含量化指标（工具、Token、时间、代码变更等）。
 *
 * Usage:
 *   node generate-qual-report.js --data-path ./insight-data.json
 *   node generate-qual-report.js --data-path ./insight-data.json --facets-path ./facets-cache --narratives-path ./insight-narratives.json
 */

const fs = require('fs');
const path = require('path');

// ── CLI 参数解析 ─────────────────────────────────────
function parseArgs(argv) {
    const args = {
        dataPath: null,
        facetsPath: 'facets-cache',
        narrativesPath: '',
        outputPath: 'insight-qual-report.html',
        title: 'VS Code Copilot Insight Report — LLM 语义分析',
    };

    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        switch (arg) {
            case '--data-path':
                args.dataPath = argv[++i];
                break;
            case '--facets-path':
                args.facetsPath = argv[++i];
                break;
            case '--narratives-path':
                args.narrativesPath = argv[++i];
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

// ── HTML 辅助函数 ─────────────────────────────────────
function he(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function barPct(value, max) {
    if (max <= 0) return 0;
    return Math.min(100, Math.round((value / max) * 100));
}

// ── 加载数据（仅用于 header 上下文）──────────────────
if (!fs.existsSync(args.dataPath)) {
    console.error(`数据文件不存在: ${args.dataPath}`);
    process.exit(1);
}

let data;
try {
    const rawJson = fs.readFileSync(args.dataPath, 'utf-8');
    data = JSON.parse(rawJson);
} catch (e) {
    console.error(`无法解析数据文件: ${e.message}`);
    process.exit(1);
}

const meta = data.meta;
const sessions = Array.isArray(data.sessions) ? data.sessions : [];
const agg = data.aggregated;
const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');

// ── 加载分面数据 ──────────────────────────────────────
const facetsData = [];
let hasFacets = false;
if (fs.existsSync(args.facetsPath)) {
    const stat = fs.statSync(args.facetsPath);
    if (stat.isDirectory()) {
        const files = fs.readdirSync(args.facetsPath).filter(f => f.endsWith('.json'));
        for (const f of files) {
            try {
                const content = fs.readFileSync(path.join(args.facetsPath, f), 'utf-8');
                facetsData.push(JSON.parse(content));
            } catch (_) { /* skip malformed */ }
        }
    }
    if (facetsData.length > 0) hasFacets = true;
}

// ── 加载叙事数据 ──────────────────────────────────────
let narratives = null;
let hasNarratives = false;
if (args.narrativesPath && fs.existsSync(args.narrativesPath)) {
    try {
        narratives = JSON.parse(fs.readFileSync(args.narrativesPath, 'utf-8'));
        hasNarratives = true;
    } catch (_) { /* skip */ }
}

// ── 检查是否有数据可展示 ─────────────────────────────
if (!hasFacets && !hasNarratives) {
    console.warn('无 facets 数据也无 narratives 数据，报告将仅包含警告提示。');
}

// ── 聚合分面统计 ──────────────────────────────────────
const goalDistribution = {};
const outcomeDistribution = {};
const satisfactionDistribution = {};
const frictionDistribution = {};
const sessionTypeDistribution = {};
const helpfulnessDistribution = {};

if (hasFacets) {
    for (const f of facetsData) {
        const fc = f.facets || f;

        // goalCategories is an array of category strings
        if (fc.goalCategories && Array.isArray(fc.goalCategories)) {
            for (const cat of fc.goalCategories) {
                const k = String(cat);
                goalDistribution[k] = (goalDistribution[k] || 0) + 1;
            }
        }

        // outcome is a single string like "mostly_achieved"
        if (fc.outcome) {
            const k = String(fc.outcome);
            outcomeDistribution[k] = (outcomeDistribution[k] || 0) + 1;
        }

        // userSatisfaction is an object with .overall string
        if (fc.userSatisfaction) {
            const satKey = fc.userSatisfaction.overall
                ? String(fc.userSatisfaction.overall)
                : String(fc.userSatisfaction);
            satisfactionDistribution[satKey] = (satisfactionDistribution[satKey] || 0) + 1;
        }

        // frictionCounts is an object with keys like wrong_approach=1, hallucination=0, etc.
        if (fc.frictionCounts && typeof fc.frictionCounts === 'object') {
            for (const [fName, fVal] of Object.entries(fc.frictionCounts)) {
                const n = parseInt(fVal, 10);
                if (n > 0) {
                    frictionDistribution[fName] = (frictionDistribution[fName] || 0) + n;
                }
            }
        }

        // sessionType is a single string
        if (fc.sessionType) {
            const k = String(fc.sessionType);
            sessionTypeDistribution[k] = (sessionTypeDistribution[k] || 0) + 1;
        }

        // claudeHelpfulness is a single string
        if (fc.claudeHelpfulness) {
            const k = String(fc.claudeHelpfulness);
            helpfulnessDistribution[k] = (helpfulnessDistribution[k] || 0) + 1;
        }
    }
}

// ── 计算时间跨度 ─────────────────────────────────────
let timeSpan = '';
if (sessions.length > 0) {
    const startTimes = sessions
        .filter(s => s.startTime)
        .map(s => { try { return new Date(s.startTime); } catch (_) { return null; } })
        .filter(d => d && !isNaN(d.getTime()));
    if (startTimes.length > 0) {
        startTimes.sort((a, b) => a - b);
        const fmt = d => d.toISOString().slice(0, 10);
        const earliest = fmt(startTimes[0]);
        const latest = fmt(startTimes[startTimes.length - 1]);
        timeSpan = `${earliest} ~ ${latest}`;
    }
}

// ── 排序辅助 ─────────────────────────────────────────
function sortedEntries(obj, desc = true) {
    return Object.entries(obj).sort((a, b) => desc ? b[1] - a[1] : a[1] - b[1]);
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
`);

// ── Header ────────────────────────────────────────────
const facetsCount = facetsData.length;
const totalSessions = agg.totalSessions;
parts.push(`<div class="header" id="sec-header">
  <h1>${he(args.title)}</h1>
  <div class="subtitle">
    扫描日期: ${meta.scanDate} &nbsp;&bull;&nbsp;
    Sessions: ${totalSessions} &nbsp;&bull;&nbsp;
    时间跨度: ${he(timeSpan)} &nbsp;&bull;&nbsp;
    数据量: ${meta.totalSizeMB} MB
  </div>
  <div class="badge">LLM 语义分析 &middot; 基于 facets-cache</div>
  <div class="subtitle" style="margin-top:8px">已分析 ${facetsCount} / ${totalSessions} sessions</div>
</div>
`);

// ── No-data warning ──────────────────────────────────
if (!hasFacets && !hasNarratives) {
    parts.push(`<div class="warning-box">
  &#x26A0; 未找到 facets 或 narratives 数据。<br>
  请先运行 <code>analyze-facets.ps1</code> 生成 facets-cache，或提供 narratives JSON 文件。
</div>
`);
}

// ── Section: At a Glance ─────────────────────────────
if (hasNarratives && narratives.atAGlance) {
    const glance = narratives.atAGlance;
    parts.push('<div class="section" id="sec-glance"><h2><span class="icon">&#x1F52D;</span> At a Glance</h2>');
    parts.push('<div class="quadrant-grid">');
    if (glance.worksWell) {
        parts.push(`<div class="quadrant-card qc-green"><h4>&#x1F7E2; 你做得好的</h4><p>${he(glance.worksWell)}</p></div>`);
    }
    if (glance.needsAttention) {
        parts.push(`<div class="quadrant-card qc-red"><h4>&#x1F534; 需要注意的</h4><p>${he(glance.needsAttention)}</p></div>`);
    }
    if (glance.suggestions) {
        parts.push(`<div class="quadrant-card qc-purple"><h4>&#x1F7E3; 建议尝试</h4><p>${he(glance.suggestions)}</p></div>`);
    }
    if (glance.horizon) {
        parts.push(`<div class="quadrant-card qc-golden"><h4>&#x1F7E1; 展望</h4><p>${he(glance.horizon)}</p></div>`);
    }
    parts.push('</div></div>');
}

// ── Section: 目标分布 ─────────────────────────────────
if (hasFacets && Object.keys(goalDistribution).length > 0) {
    const goalLabels = {
        'feature_work': '&#x1F195; 功能开发',
        'bug_fix': '&#x1F41B; 修复 Bug',
        'refactoring': '&#x267B; 重构',
        'testing': '&#x1F9EA; 测试',
        'documentation': '&#x1F4DD; 文档',
        'devops_infra': '&#x2699; DevOps',
        'code_review': '&#x1F440; 代码审查',
        'learning_exploration': '&#x1F4DA; 学习探索',
        'data_analysis': '&#x1F4CA; 数据分析',
        'design_architecture': '&#x1F3D7; 架构设计',
        'migration_upgrade': '&#x1F504; 迁移升级',
        'performance_optimization': '&#x26A1; 性能优化',
        'security': '&#x1F512; 安全',
    };
    const goalEntries = sortedEntries(goalDistribution);
    const maxGoal = goalEntries[0][1];
    parts.push('<div class="section" id="sec-goals"><h2><span class="icon">&#x1F3AF;</span> 目标分布</h2><div class="bar-chart">');
    for (const [key, value] of goalEntries) {
        const label = goalLabels[key] || he(key);
        const pct = barPct(value, maxGoal);
        parts.push(`<div class="bar-row"><div class="bar-label">${label}</div><div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:var(--accent2)"></div></div><div class="bar-value">${value}</div></div>`);
    }
    parts.push('</div></div>');
}

// ── Section: 成果分析 ─────────────────────────────────
if (hasFacets && Object.keys(outcomeDistribution).length > 0) {
    const outcomeLabels = {
        'fully_achieved':     { label: '&#x2705; 完全达成',    color: '#a3d9a5' },
        'mostly_achieved':    { label: '&#x1F7E2; 大部分达成', color: '#7fdbca' },
        'partially_achieved': { label: '&#x1F7E1; 部分达成',   color: '#ffe082' },
        'barely_started':     { label: '&#x1F7E0; 刚刚开始',   color: '#ffab70' },
        'abandoned':          { label: '&#x1F534; 放弃',        color: '#ff7979' },
    };
    const orderedKeys = ['fully_achieved', 'mostly_achieved', 'partially_achieved', 'barely_started', 'abandoned'];
    const outcomeEntries = [];
    for (const oKey of orderedKeys) {
        if (outcomeDistribution[oKey] !== undefined) {
            outcomeEntries.push([oKey, outcomeDistribution[oKey]]);
        }
    }
    // include any keys not in predefined list
    for (const oKey of Object.keys(outcomeDistribution)) {
        if (!orderedKeys.includes(oKey)) {
            outcomeEntries.push([oKey, outcomeDistribution[oKey]]);
        }
    }
    if (outcomeEntries.length > 0) {
        const maxOutcome = Math.max(...outcomeEntries.map(e => e[1]));
        parts.push('<div class="section" id="sec-outcomes"><h2><span class="icon">&#x1F4C8;</span> 成果分析</h2><div class="bar-chart">');
        for (const [key, value] of outcomeEntries) {
            const info = outcomeLabels[key] || { label: he(key), color: '#8892b0' };
            const pct = barPct(value, maxOutcome);
            parts.push(`<div class="bar-row"><div class="bar-label">${info.label}</div><div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:${info.color}"></div></div><div class="bar-value">${value}</div></div>`);
        }
        parts.push('</div></div>');
    }
}

// ── Section: 满意度分析 ───────────────────────────────
if (hasFacets && Object.keys(satisfactionDistribution).length > 0) {
    const satLabels = {
        'highly_satisfied':    { label: '&#x1F929; 非常满意',   color: '#a3d9a5' },
        'impressed':           { label: '&#x1F60D; 印象深刻',   color: '#7fdbca' },
        'satisfied':           { label: '&#x1F60A; 满意',       color: '#82aaff' },
        'neutral':             { label: '&#x1F610; 中性',       color: '#8892b0' },
        'slightly_frustrated': { label: '&#x1F615; 轻微不满',   color: '#ffab70' },
        'frustrated':          { label: '&#x1F624; 不满',       color: '#ff7979' },
        'very_frustrated':     { label: '&#x1F621; 非常不满',   color: '#e74c3c' },
        'confused':            { label: '&#x1F635; 困惑',       color: '#c792ea' },
    };
    const satEntries = sortedEntries(satisfactionDistribution);
    const maxSat = satEntries[0][1];
    parts.push('<div class="section" id="sec-satisfaction"><h2><span class="icon">&#x1F60A;</span> 满意度分析</h2><div class="bar-chart">');
    for (const [key, value] of satEntries) {
        const info = satLabels[key] || { label: he(key), color: '#8892b0' };
        const pct = barPct(value, maxSat);
        parts.push(`<div class="bar-row"><div class="bar-label">${info.label}</div><div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:${info.color}"></div></div><div class="bar-value">${value}</div></div>`);
    }
    parts.push('</div></div>');
}

// ── Section: 摩擦分析 ─────────────────────────────────
if (hasFacets && Object.keys(frictionDistribution).length > 0) {
    const fricLabels = {
        'wrong_approach': '方向错误',
        'hallucination': '幻觉',
        'ignored_instruction': '忽略指令',
        'repetitive_error': '重复犯错',
        'context_lost': '丢失上下文',
        'slow_response': '响应缓慢',
        'tool_failure': '工具失败',
        'incomplete_solution': '不完整方案',
        'wrong_file_edit': '编辑错误文件',
        'unnecessary_changes': '不必要的修改',
        'poor_code_quality': '代码质量差',
        'misunderstood_request': '误解需求',
    };
    const fricEntries = sortedEntries(frictionDistribution);
    const maxFric = fricEntries[0][1];
    parts.push('<div class="section" id="sec-friction"><h2><span class="icon">&#x26A1;</span> 摩擦分析</h2><div class="bar-chart">');
    for (const [key, value] of fricEntries) {
        const label = fricLabels[key] || he(key);
        const pct = barPct(value, maxFric);
        parts.push(`<div class="bar-row"><div class="bar-label">${he(label)}</div><div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:var(--red)"></div></div><div class="bar-value">${value}</div></div>`);
    }
    parts.push('</div></div>');
}

// ── Section: 叙事洞察 ─────────────────────────────────
if (hasNarratives) {
    parts.push('<div class="section" id="sec-narratives"><h2><span class="icon">&#x1F4D6;</span> 叙事洞察</h2>');
    const narrativeFields = [
        { key: 'projectAreas',     title: '&#x1F3AF; 项目领域', css: '' },
        { key: 'interactionStyle', title: '&#x1F4AC; 交互风格', css: '' },
        { key: 'whatWorks',        title: '&#x2728; 做得好的',  css: 'nc-green' },
        { key: 'frictionAnalysis', title: '&#x26A1; 摩擦分析',  css: 'nc-red' },
        { key: 'suggestions',      title: '&#x1F4A1; 改进建议', css: 'nc-purple' },
        { key: 'onTheHorizon',     title: '&#x1F52E; 展望',     css: 'nc-golden' },
        { key: 'funEnding',        title: '&#x1F389; 彩蛋',     css: 'nc-rainbow' },
    ];
    for (const nf of narrativeFields) {
        const val = narratives[nf.key];
        if (!val) continue;
        const cssClass = nf.css ? `narrative-card ${nf.css}` : 'narrative-card';
        parts.push(`<div class="${cssClass}"><h3>${nf.title}</h3>`);
        if (Array.isArray(val)) {
            for (const p of val) {
                parts.push(`<p>${he(String(p))}</p>`);
            }
        } else {
            const paragraphs = String(val).split('\n');
            for (const p of paragraphs) {
                const trimmed = p.trim();
                if (trimmed) parts.push(`<p>${he(trimmed)}</p>`);
            }
        }
        parts.push('</div>');
    }
    parts.push('</div>');
}

// ── Footer ────────────────────────────────────────────
const dataFileName = path.basename(args.dataPath);
parts.push(`<div class="footer">
  <p>数据来源: ${he(dataFileName)} &nbsp;&bull;&nbsp; Facets: ${facetsCount} sessions &nbsp;&bull;&nbsp; Narratives: ${hasNarratives ? '✓' : '✗'}</p>
  <p>生成命令: <code>generate-qual-report.js --data-path ${he(dataFileName)}</code></p>
  <p>Parking Agents Insight Toolkit (Qual Only) &nbsp;&bull;&nbsp; ${now}</p>
</div>

<script>
function toggleNav() {
  var nav = document.getElementById('navToc');
  nav.classList.toggle('open');
}
</script>
</body>
</html>
`);

// ── 写出 ──────────────────────────────────────────────
const html = parts.join('\n');
const parentDir = path.dirname(args.outputPath);
if (parentDir && !fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
}
fs.writeFileSync(args.outputPath, html, 'utf-8');

const sizeKB = (Buffer.byteLength(html, 'utf-8') / 1024).toFixed(1);
console.log(`[done] HTML 报告已生成 (Qual Only): ${args.outputPath} (${sizeKB} KB)`);
