#!/usr/bin/env node
'use strict';

/**
 * generate-insight-report.js
 * 读取 analyze-insight.js 的输出 JSON，生成交互式 HTML 报告。
 *
 * 生成单文件暗色主题 HTML 报告，包含 Token 消耗、工具使用热力图、
 * 时间分布、代码变更、异常检测等多维度可视化。
 * 零外部依赖，CSS + JS 全内联。
 *
 * Usage:
 *   node generate-insight-report.js --data-path ./reports/insight-data.json
 *   node generate-insight-report.js --data-path ./reports/insight-data.json --output-path ./reports/report.html --title "Weekly Insight"
 */

const fs = require('fs');
const path = require('path');

// ── CLI 参数解析 ─────────────────────────────────────
function parseArgs(argv) {
    const args = {
        dataPath: null,
        outputPath: null,
        title: null,
        facetsPath: 'reports/facets-cache',
        narrativesPath: '',
        turnsPath: '',
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
            case '--facets-path':
                args.facetsPath = argv[++i];
                break;
            case '--narratives-path':
                args.narrativesPath = argv[++i];
                break;
            case '--turns-path':
                args.turnsPath = argv[++i];
                break;
            default:
                if (!args.dataPath && !arg.startsWith('-')) {
                    args.dataPath = arg;
                }
                break;
        }
    }
    return args;
}

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

function formatLocalDate(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function formatLocalDateTime(d) {
    return `${formatLocalDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function barPct(value, max) {
    if (max <= 0) return 0;
    return Math.min(100, Math.round((value / max) * 100));
}

/** 提取对象属性为 { name, value } 数组 */
function getDictEntries(dict) {
    if (!dict) return [];
    if (typeof dict !== 'object') return [];
    return Object.entries(dict).map(([name, value]) => ({ name, value }));
}

// ── Phase 4: 学习曲线辅助函数 ─────────────────────────

function enumToScore(val, map) {
    if (val == null) return null;
    const v = String(val).toLowerCase().replace(/[\s-]+/g, '_');
    return map[v] != null ? map[v] : null;
}

function calcPQI(facets) {
    const fp = facets.firstPrompt || '';
    const len = Math.min(Math.max(fp.length - 20, 0), 180);
    const promptLengthScore = (len / 180) * 100;

    const outcomeMap = { fully_achieved: 100, mostly_achieved: 75, partially_achieved: 50, barely_started: 25, abandoned: 0 };
    const outcomeScore = enumToScore(facets.outcome, outcomeMap);

    const alignMap = { high: 100, medium: 60, low: 30, misaligned: 0 };
    const alignment = facets.aiFeedbackUtilization && facets.aiFeedbackUtilization.promptResponseAlignment;
    const alignmentScore = enumToScore(alignment, alignMap);

    const effMap = { high: 100, medium: 60, low: 20 };
    const eff = facets.turnAnalysis && facets.turnAnalysis.turnEfficiency;
    const efficiencyScore = enumToScore(eff, effMap);

    let sum = 0, wSum = 0;
    if (outcomeScore != null) { sum += 40 * outcomeScore; wSum += 40; }
    if (alignmentScore != null) { sum += 25 * alignmentScore; wSum += 25; }
    if (efficiencyScore != null) { sum += 20 * efficiencyScore; wSum += 20; }
    sum += 15 * promptLengthScore; wSum += 15;
    return wSum > 0 ? sum / wSum : 0;
}

function calcARI(facets) {
    const adoptMap = { high: 100, medium: 50, low: 10 };
    const adopt = facets.aiFeedbackUtilization && facets.aiFeedbackUtilization.suggestionAdoptionRate;
    const adoptionScore = enumToScore(adopt, adoptMap);

    const flowMap = { linear: 100, iterative: 70, branching: 40, stuck_loop: 10 };
    const flow = facets.conversationDynamics && facets.conversationDynamics.conversationFlow;
    const flowScore = enumToScore(flow, flowMap);

    // reaction score from turnBreakdown
    let reactionScore = null;
    const tb = facets.turnAnalysis && facets.turnAnalysis.turnBreakdown;
    if (Array.isArray(tb) && tb.length > 0) {
        const accepted = tb.filter(t => t.userReaction === 'accepted').length;
        reactionScore = (accepted / tb.length) * 100;
    } else if (adoptionScore != null) {
        reactionScore = adoptionScore;
    }

    let sum = 0, wSum = 0;
    if (adoptionScore != null) { sum += 50 * adoptionScore; wSum += 50; }
    if (flowScore != null) { sum += 25 * flowScore; wSum += 25; }
    if (reactionScore != null) { sum += 25 * reactionScore; wSum += 25; }
    return wSum > 0 ? sum / wSum : 0;
}

function calcSAT(facets) {
    const satMap = { very_frustrated: 0, frustrated: 20, slightly_frustrated: 40, neutral: 60, satisfied: 80, highly_satisfied: 100 };
    const sat = facets.userSatisfaction;
    const overall = sat && typeof sat === 'object' ? sat.overall : sat;
    const score = enumToScore(overall, satMap);
    return score != null ? score : 50;
}

function linearSlope(arr) {
    const n = arr.length;
    if (n < 2) return 0;
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) {
        sx += i; sy += arr[i]; sxy += i * arr[i]; sxx += i * i;
    }
    const denom = n * sxx - sx * sx;
    return denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
}

function buildLearningCurveData(sessions, facetsMap) {
    const WS_MIN_SESSIONS = 3;
    const wsGroups = {};
    const allPoints = [];

    for (const s of sessions) {
        const sid = s.sessionId;
        const fc = facetsMap[sid];
        if (!fc) continue;
        let ws = s.workspaceName || 'unknown';
        const date = s.startDate || (s.startTime ? s.startTime.slice(0, 10) : null);
        if (!date) continue;

        const pqi = calcPQI(fc);
        const ari = calcARI(fc);
        const sat = calcSAT(fc);
        const fd = typeof fc.frictionDensity === 'number' ? fc.frictionDensity : 0;
        const frictionTypes = fc.frictionCounts && typeof fc.frictionCounts === 'object' ? Object.assign({}, fc.frictionCounts) : {};
        const point = { sessionId: sid, date, ws, pqi, ari, sat, fd, frictionTypes, startTime: s.startTime || '' };
        allPoints.push(point);
        if (!wsGroups[ws]) wsGroups[ws] = [];
        wsGroups[ws].push(point);
    }

    // Merge small workspaces into "other"
    const merged = {};
    for (const [ws, pts] of Object.entries(wsGroups)) {
        if (pts.length < WS_MIN_SESSIONS) {
            if (!merged['other']) merged['other'] = [];
            merged['other'].push(...pts);
        } else {
            merged[ws] = pts;
        }
    }

    function aggregateDaily(points) {
        const byDate = {};
        for (const p of points) {
            if (!byDate[p.date]) byDate[p.date] = [];
            byDate[p.date].push(p);
        }
        const dates = Object.keys(byDate).sort();
        return dates.map(d => {
            const arr = byDate[d];
            const n = arr.length;
            const avg = (key) => arr.reduce((s, p) => s + p[key], 0) / n;
            // aggregate friction types
            const ft = {};
            for (const p of arr) {
                for (const [k, v] of Object.entries(p.frictionTypes)) {
                    ft[k] = (ft[k] || 0) + Number(v);
                }
            }
            return { date: d, sessionCount: n, pqi: avg('pqi'), ari: avg('ari'), sat: avg('sat'), fd: avg('fd'), frictionTypes: ft };
        });
    }

    const workspaces = {};
    for (const [ws, pts] of Object.entries(merged)) {
        pts.sort((a, b) => a.startTime.localeCompare(b.startTime));
        const daily = aggregateDaily(pts);
        const trend = {
            pqi: linearSlope(daily.map(d => d.pqi)),
            ari: linearSlope(daily.map(d => d.ari)),
            sat: linearSlope(daily.map(d => d.sat)),
            fd: linearSlope(daily.map(d => d.fd)),
        };
        workspaces[ws] = { daily, trend, sessionCount: pts.length };
    }

    const overallDaily = aggregateDaily(allPoints);
    const overallTrend = {
        pqi: linearSlope(overallDaily.map(d => d.pqi)),
        ari: linearSlope(overallDaily.map(d => d.ari)),
        sat: linearSlope(overallDaily.map(d => d.sat)),
        fd: linearSlope(overallDaily.map(d => d.fd)),
    };

    return { workspaces, overall: { daily: overallDaily, trend: overallTrend } };
}

// ── Phase 4: SVG 渲染函数 ─────────────────────────────

function renderLCLineChart(dailyData, title) {
    if (!dailyData || dailyData.length < 2) return '';
    const W = 720, H = 220, PAD = { top: 30, right: 20, bottom: 40, left: 45 };
    const cw = W - PAD.left - PAD.right;
    const ch = H - PAD.top - PAD.bottom;
    const n = dailyData.length;
    const metrics = [
        { key: 'pqi', color: '#82aaff', label: 'PQI' },
        { key: 'ari', color: '#a3d9a5', label: 'ARI' },
        { key: 'sat', color: '#ffcb6b', label: 'SAT' },
        { key: 'fd',  color: '#ff7979', label: 'FD×100', scale: 100 },
    ];

    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px;height:auto;font-family:sans-serif">`;
    // grid
    for (let i = 0; i <= 4; i++) {
        const y = PAD.top + ch - (i / 4) * ch;
        svg += `<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="#333" stroke-dasharray="4,4"/>`;
        svg += `<text x="${PAD.left - 6}" y="${y + 4}" fill="#8892b0" font-size="10" text-anchor="end">${i * 25}</text>`;
    }
    // x labels
    for (let i = 0; i < n; i++) {
        const x = PAD.left + (i / Math.max(n - 1, 1)) * cw;
        const label = dailyData[i].date.slice(5); // MM-DD
        svg += `<text x="${x}" y="${H - 6}" fill="#8892b0" font-size="9" text-anchor="middle">${label}</text>`;
    }
    // title
    if (title) {
        svg += `<text x="${W / 2}" y="16" fill="#e4e4e4" font-size="13" text-anchor="middle" font-weight="600">${he(title)}</text>`;
    }
    // lines
    for (const m of metrics) {
        const pts = dailyData.map((d, i) => {
            const val = m.scale ? Math.min(d[m.key] * m.scale, 100) : d[m.key];
            const x = PAD.left + (i / Math.max(n - 1, 1)) * cw;
            const y = PAD.top + ch - (val / 100) * ch;
            return { x, y, val };
        });
        const line = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        svg += `<polyline points="${line}" fill="none" stroke="${m.color}" stroke-width="2" stroke-linejoin="round"/>`;
        for (const p of pts) {
            svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${m.color}" stroke="#161b22" stroke-width="1.5"><title>${m.label}: ${p.val.toFixed(1)}</title></circle>`;
        }
    }
    svg += '</svg>';

    // legend
    let legend = '<div style="display:flex;gap:16px;font-size:0.82em;margin:6px 0;flex-wrap:wrap">';
    for (const m of metrics) {
        legend += `<span style="display:inline-flex;align-items:center;gap:4px"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:${m.color}"></span>${m.label}</span>`;
    }
    legend += '</div>';

    return `<div class="lc-chart-wrap">${svg}${legend}</div>`;
}

function renderLCStackedArea(dailyData) {
    if (!dailyData || dailyData.length < 2) return '';
    // collect all friction types
    const typeSet = new Set();
    for (const d of dailyData) {
        for (const k of Object.keys(d.frictionTypes || {})) typeSet.add(k);
    }
    const types = [...typeSet];
    if (types.length === 0) return '';

    const colors = ['#ff7979', '#ffcb6b', '#82aaff', '#c792ea', '#a3d9a5', '#ffab70', '#64ffda', '#f78c6c'];
    const W = 720, H = 180, PAD = { top: 24, right: 20, bottom: 36, left: 45 };
    const cw = W - PAD.left - PAD.right;
    const ch = H - PAD.top - PAD.bottom;
    const n = dailyData.length;

    // compute cumulative stacks
    const stacks = types.map(() => []);
    let maxY = 0;
    for (let i = 0; i < n; i++) {
        let cum = 0;
        for (let t = 0; t < types.length; t++) {
            cum += Number(dailyData[i].frictionTypes[types[t]]) || 0;
            stacks[t][i] = cum;
        }
        if (cum > maxY) maxY = cum;
    }
    if (maxY === 0) return '';

    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px;height:auto;font-family:sans-serif">`;
    svg += `<text x="${W / 2}" y="16" fill="#e4e4e4" font-size="12" text-anchor="middle">摩擦类型演变</text>`;
    // grid
    for (let i = 0; i <= 4; i++) {
        const y = PAD.top + ch - (i / 4) * ch;
        svg += `<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="#333" stroke-dasharray="4,4"/>`;
        svg += `<text x="${PAD.left - 6}" y="${y + 4}" fill="#8892b0" font-size="10" text-anchor="end">${Math.round(maxY * i / 4)}</text>`;
    }
    // x labels
    for (let i = 0; i < n; i++) {
        const x = PAD.left + (i / Math.max(n - 1, 1)) * cw;
        svg += `<text x="${x}" y="${H - 6}" fill="#8892b0" font-size="9" text-anchor="middle">${dailyData[i].date.slice(5)}</text>`;
    }
    // areas (draw from top stack down so earlier layers are on bottom)
    for (let t = types.length - 1; t >= 0; t--) {
        const c = colors[t % colors.length];
        let d = 'M';
        for (let i = 0; i < n; i++) {
            const x = PAD.left + (i / Math.max(n - 1, 1)) * cw;
            const y = PAD.top + ch - (stacks[t][i] / maxY) * ch;
            d += `${i === 0 ? '' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        }
        // bottom edge
        const base = t > 0 ? stacks[t - 1] : new Array(n).fill(0);
        for (let i = n - 1; i >= 0; i--) {
            const x = PAD.left + (i / Math.max(n - 1, 1)) * cw;
            const y = PAD.top + ch - (base[i] / maxY) * ch;
            d += `L${x.toFixed(1)},${y.toFixed(1)}`;
        }
        d += 'Z';
        svg += `<path d="${d}" fill="${c}" fill-opacity="0.6"><title>${types[t]}</title></path>`;
    }
    svg += '</svg>';

    // legend
    let legend = '<div style="display:flex;gap:12px;font-size:0.78em;margin:6px 0;flex-wrap:wrap">';
    for (let t = 0; t < types.length; t++) {
        legend += `<span style="display:inline-flex;align-items:center;gap:3px"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${colors[t % colors.length]};opacity:0.7"></span>${he(types[t])}</span>`;
    }
    legend += '</div>';

    return `<div class="lc-chart-wrap" style="margin-top:16px">${svg}${legend}</div>`;
}

function renderLCTrendCards(trend, label) {
    const items = [
        { key: 'pqi', name: 'Prompt 质量', color: '#82aaff', betterUp: true },
        { key: 'ari', name: '采纳率', color: '#a3d9a5', betterUp: true },
        { key: 'sat', name: '满意度', color: '#ffcb6b', betterUp: true },
        { key: 'fd',  name: '摩擦密度', color: '#ff7979', betterUp: false },
    ];
    let html = '';
    if (label) html += `<h3 style="margin-bottom:10px">${he(label)}</h3>`;
    html += '<div class="lc-trend-grid">';
    for (const it of items) {
        const slope = trend[it.key] || 0;
        const improving = it.betterUp ? slope > 0 : slope < 0;
        const arrow = slope > 0.01 ? '↑' : slope < -0.01 ? '↓' : '→';
        const cssClass = Math.abs(slope) < 0.01 ? '' : improving ? 'lc-trend-up' : 'lc-trend-down';
        const valColor = Math.abs(slope) < 0.01 ? '#8892b0' : improving ? '#a3d9a5' : '#ff7979';
        html += `<div class="stat-card ${cssClass}" style="border-bottom:3px solid ${valColor}">
  <div class="label">${he(it.name)}</div>
  <div class="value" style="font-size:1.4em;background:none;-webkit-text-fill-color:${valColor};color:${valColor}">${arrow} ${Math.abs(slope).toFixed(2)}</div>
  <div class="sub">每日斜率</div>
</div>`;
    }
    html += '</div>';
    return html;
}

// ── 主函数 ────────────────────────────────────────────
function main() {
    const args = parseArgs(process.argv);

    if (!args.dataPath) {
        console.error('Usage: node generate-insight-report.js --data-path <insight-data.json> [--output-path <report.html>] [--title <title>] [--facets-path <dir>] [--narratives-path <file>]');
        process.exit(1);
    }

    const outputPath = args.outputPath || 'reports/insight-report.html';
    const title = args.title || 'VS Code Copilot Insight Report';

    // ── 加载数据 ──────────────────────────────────────
    if (!fs.existsSync(args.dataPath)) {
        console.error(`数据文件不存在: ${args.dataPath}`);
        process.exit(1);
    }
    let data;
    try {
        const rawJson = fs.readFileSync(args.dataPath, 'utf-8').replace(/^\uFEFF/, '');
        data = JSON.parse(rawJson);
    } catch (e) {
        console.error(`无法解析数据文件: ${e.message}`);
        process.exit(1);
    }

    const meta = data.meta;
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    const agg = data.aggregated;
    const now = formatLocalDateTime(new Date());

    // ── 加载分面数据 ──────────────────────────────────
    let facetsData = [];
    let hasFacets = false;
    const facetsMap = {};
    if (fs.existsSync(args.facetsPath)) {
        try {
            const files = fs.readdirSync(args.facetsPath).filter(f => f.endsWith('.json'));
            for (const f of files) {
                const content = fs.readFileSync(path.join(args.facetsPath, f), 'utf-8').replace(/^\uFEFF/, '');
                const parsed = JSON.parse(content);
                facetsData.push(parsed);
                const sid = f.replace(/\.json$/, '');
                facetsMap[sid] = parsed.facets || parsed;
            }
        } catch (_) { /* ignore */ }
        if (facetsData.length > 0) hasFacets = true;
    }

    // ── 加载叙事数据 ──────────────────────────────────
    let narratives = null;
    let hasNarratives = false;
    if (args.narrativesPath && fs.existsSync(args.narrativesPath)) {
        try {
            narratives = JSON.parse(fs.readFileSync(args.narrativesPath, 'utf-8').replace(/^\uFEFF/, ''));
            hasNarratives = true;
        } catch (_) { /* ignore */ }
    }

    // ── 加载 Turn 数据 ────────────────────────────────
    const turnsPath = args.turnsPath || path.join(path.dirname(args.dataPath), 'conversation-turns');
    let turnDataMap = {};
    if (fs.existsSync(turnsPath)) {
        const turnFiles = fs.readdirSync(turnsPath).filter(f => f.endsWith('.summary.json'));
        for (const f of turnFiles) {
            try {
                const td = JSON.parse(fs.readFileSync(path.join(turnsPath, f), 'utf-8'));
                const id = f.replace('.summary.json', '');
                turnDataMap[id] = td;
            } catch (_) { /* ignore */ }
        }
        console.log(`[report] Loaded ${Object.keys(turnDataMap).length} turn summaries`);
    }
    const hasTurnData = Object.keys(turnDataMap).length > 0;

    // ── 聚合分面统计 ──────────────────────────────────
    const goalDistribution = {};
    const outcomeDistribution = {};
    const satisfactionDistribution = {};
    const frictionDistribution = {};
    const sessionTypeDistribution = {};
    const helpfulnessDistribution = {};
    const correctionDistribution = {};
    const emotionQuotes = [];
    let totalInterruptions = 0;
    let totalFrictionDensitySum = 0;
    let frictionDensityCount = 0;

    if (hasFacets) {
        for (const f of facetsData) {
            const fc = f.facets || f;
            if (fc.goalCategories) {
                if (Array.isArray(fc.goalCategories)) {
                    // Legacy array format: each entry counts as 1
                    for (const cat of fc.goalCategories) {
                        const k = String(cat);
                        goalDistribution[k] = (goalDistribution[k] || 0) + 1;
                    }
                } else if (typeof fc.goalCategories === 'object') {
                    // New weighted object format: {category: count}
                    for (const [cat, weight] of Object.entries(fc.goalCategories)) {
                        const w = Number(weight) || 1;
                        goalDistribution[cat] = (goalDistribution[cat] || 0) + w;
                    }
                }
            }
            if (fc.outcome) {
                const k = String(fc.outcome);
                outcomeDistribution[k] = (outcomeDistribution[k] || 0) + 1;
            }
            if (fc.userSatisfaction) {
                const satKey = fc.userSatisfaction.overall
                    ? String(fc.userSatisfaction.overall)
                    : String(fc.userSatisfaction);
                satisfactionDistribution[satKey] = (satisfactionDistribution[satKey] || 0) + 1;
            }
            if (fc.frictionCounts) {
                for (const [fName, fVal] of Object.entries(fc.frictionCounts)) {
                    const v = Number(fVal) || 0;
                    if (v > 0) {
                        frictionDistribution[fName] = (frictionDistribution[fName] || 0) + v;
                    }
                }
            }
            if (fc.sessionType) {
                const k = String(fc.sessionType);
                sessionTypeDistribution[k] = (sessionTypeDistribution[k] || 0) + 1;
            }
            if (fc.claudeHelpfulness) {
                const k = String(fc.claudeHelpfulness);
                helpfulnessDistribution[k] = (helpfulnessDistribution[k] || 0) + 1;
            }
            // New fields
            if (fc.userInterruptions) {
                totalInterruptions += Number(fc.userInterruptions) || 0;
            }
            if (fc.correctionEvents && typeof fc.correctionEvents === 'object') {
                for (const [cName, cVal] of Object.entries(fc.correctionEvents)) {
                    const v = Number(cVal) || 0;
                    if (v > 0) {
                        correctionDistribution[cName] = (correctionDistribution[cName] || 0) + v;
                    }
                }
            }
            if (fc.emotionEscalation && Array.isArray(fc.emotionEscalation)) {
                for (const q of fc.emotionEscalation) {
                    if (q && emotionQuotes.length < 20) {
                        emotionQuotes.push(String(q));
                    }
                }
            }
            if (typeof fc.frictionDensity === 'number') {
                totalFrictionDensitySum += fc.frictionDensity;
                frictionDensityCount++;
            }
        }
    }

    // ── Phase 4: 学习曲线数据聚合 ─────────────────────
    let lcData = null;
    if (hasFacets && sessions.length >= 3) {
        lcData = buildLearningCurveData(sessions, facetsMap);
    }

    // ── 计算响应时间分布桶 ────────────────────────────
    const rtBuckets = [0, 0, 0, 0, 0, 0, 0];
    const rtLabels = ['&lt;1s', '1-5s', '5-15s', '15-30s', '30-60s', '1-5min', '&gt;5min'];
    for (const s of sessions) {
        if (s.userResponseTimes && Array.isArray(s.userResponseTimes)) {
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

    // ── 聚合 Git 操作和 Diff 数据 ─────────────────────
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

    // ── 计算时间跨度 ─────────────────────────────────
    let timeSpan = '';
    if (sessions.length > 0) {
        const startTimes = sessions
            .filter(s => s.startTime)
            .map(s => { try { return new Date(s.startTime); } catch (_) { return null; } })
            .filter(d => d && !isNaN(d.getTime()));
        if (startTimes.length > 0) {
            startTimes.sort((a, b) => a - b);
            const earliest = formatLocalDate(startTimes[0]);
            const latest = formatLocalDate(startTimes[startTimes.length - 1]);
            timeSpan = `${earliest} ~ ${latest}`;
        }
    }

    // ── 聚合 Turn 数据 ────────────────────────────────
    let aggTotalTurns = 0, aggAnsweredQ = 0;
    let aggTruncated = 0, aggTotalResponses = 0;
    const agentCallCounts = {};
    const allQAPairs = [];
    const sessionWorkspaceMap = {};
    for (const s of sessions) {
        if (s.sessionId) {
            sessionWorkspaceMap[s.sessionId] = { workspace: s.workspaceName || '', date: s.startTime || '' };
        }
    }
    if (hasTurnData) {
        for (const [sid, summary] of Object.entries(turnDataMap)) {
            aggTotalTurns += summary.totalTurns || 0;
            aggTruncated += summary.stats ? (summary.stats.truncatedResponses || 0) : 0;
            aggTotalResponses += summary.stats ? (summary.stats.totalResponses || 0) : 0;
            for (const t of (summary.turnSummaries || [])) {
                if (t.askQuestions) {
                    for (const aq of t.askQuestions) {
                        const answerKeys = Object.keys(aq.answers || {});
                        for (let i = 0; i < aq.questions.length; i++) {
                            const q = aq.questions[i];
                            const header = answerKeys[i];
                            const ans = header ? aq.answers[header] : null;
                            const answered = ans && !ans.skipped;
                            if (answered) aggAnsweredQ++;
                            allQAPairs.push({ question: q, answer: ans, answered: !!answered, sessionId: sid, turnId: t.turnId });
                        }
                    }
                }
                if (t.subagents) {
                    for (const sa of t.subagents) {
                        agentCallCounts[sa.agent] = (agentCallCounts[sa.agent] || 0) + 1;
                    }
                }
            }
        }
    }

    // ── 构建 HTML ─────────────────────────────────────
    const parts = [];

    // Facet 定义：报告里每一个可独立筛选查看的板块。
    // id 对应各 section 的 DOM id 后缀（"sec-" + id），emoji/label 用于导航和筛选下拉框的展示文案。
    const FACET_DEFS = [
        { id: 'glance', emoji: '&#x1F52D;', label: '总览' },
        { id: 'dynamics', emoji: '&#x1F504;', label: '对话动力学' },
        { id: 'agents', emoji: '&#x1F916;', label: 'Agent 分布' },
        { id: 'session-types', emoji: '&#x1F4CA;', label: '会话类型' },
        { id: 'tools', emoji: '&#x1F527;', label: '工具分析' },
        { id: 'tokens', emoji: '&#x1F4CA;', label: 'Token 消耗' },
        { id: 'time', emoji: '&#x23F0;', label: '时间分布' },
        { id: 'errors', emoji: '&#x26A0;', label: '工具错误' },
        { id: 'highlights', emoji: '&#x2B50;', label: '亮点与问题' },
        { id: 'goals', emoji: '&#x1F3AF;', label: '目标分布' },
        { id: 'outcomes', emoji: '&#x1F4C8;', label: '成果分析' },
        { id: 'satisfaction', emoji: '&#x1F60A;', label: '满意度' },
        { id: 'friction', emoji: '&#x26A1;', label: '摩擦分析' },
        { id: 'deep', emoji: '&#x1F50E;', label: '深度分析' },
        { id: 'learning-curve', emoji: '&#x1F4C8;', label: '学习曲线' },
        { id: 'narratives', emoji: '&#x1F4D6;', label: '叙事洞察' },
        { id: 'response', emoji: '&#x23F1;', label: '响应时间' },
        { id: 'code', emoji: '&#x1F4DD;', label: '代码变更' },
        { id: 'lang', emoji: '&#x1F4BB;', label: '语言分布' },
        { id: 'anomaly', emoji: '&#x1F50D;', label: '异常检测' },
        { id: 'ws', emoji: '&#x1F4C2;', label: 'Workspace' },
        { id: 'ws-deep', emoji: '&#x1F9E0;', label: 'Workspace 深度分析' },
        { id: 'prompt-eff', emoji: '&#x1F4DD;', label: 'Prompt 有效性' },
        { id: 'sessions', emoji: '&#x1F4CB;', label: 'Session 列表' },
    ];
    const navLinks = FACET_DEFS.map(f => `  <a href="#sec-${f.id}" data-facet="${f.id}" onclick="jumpToFacet('${f.id}')">${f.emoji} ${he(f.label)}</a>`).join('\n');
    const facetOptions = FACET_DEFS.map(f => `<option value="${f.id}">${he(f.label)}</option>`).join('\n    ');

    parts.push(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${he(title)}</title>
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
.quadrant-card ul { margin: 0; padding: 0 0 0 6px; list-style: none; }
.quadrant-card ul li { padding: 3px 0; color: var(--fg3); font-size: 0.92em; line-height: 1.5; }
.quadrant-card ul li::before { content: '▸ '; color: var(--fg2); }
.qc-green  { border-left-color: #a3d9a5; }
.qc-green h4  { color: #a3d9a5; }
.qc-red    { border-left-color: #ff7979; }
.qc-red h4    { color: #ff7979; }
.qc-amber  { border-left-color: #ffe082; }
.qc-amber h4  { color: #ffe082; }
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

/* ── Session List ── */
.sl-wrap { overflow-x: auto; }
.sl-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.82em; }
.sl-table th { background: var(--bg3); color: var(--accent2); font-weight: 600; padding: 10px 10px; border-bottom: 2px solid var(--border); cursor: pointer; user-select: none; white-space: nowrap; position: sticky; top: 0; z-index: 1; }
.sl-table th:hover { color: var(--accent); }
.sl-table th .sort-ind { font-size: 0.7em; margin-left: 2px; color: var(--fg2); }
.sl-table td { padding: 8px 10px; border-bottom: 1px solid var(--border); background: var(--bg4); vertical-align: middle; }
.sl-table tbody tr.sl-row { cursor: pointer; transition: background 0.12s; }
.sl-table tbody tr.sl-row:hover td { background: rgba(100,255,218,0.06); }
.sl-table tbody tr.sl-detail { display: none; }
.sl-table tbody tr.sl-detail.open { display: table-row; }
.sl-table tbody tr.sl-detail td { background: var(--bg3); padding: 14px 18px; }
.sl-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.sl-detail-block h4 { color: var(--accent2); font-size: 0.9em; margin-bottom: 4px; }
.sl-detail-block p, .sl-detail-block ul { color: var(--fg3); font-size: 0.88em; margin: 2px 0; }
.sl-detail-block ul { padding-left: 16px; }
.sl-prompt { color: var(--fg3); font-style: italic; max-width: 700px; word-break: break-word; }
.outcome-badge { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 0.78em; font-weight: 600; }
.ob-fully    { background: rgba(163,217,165,0.2); color: #a3d9a5; }
.ob-mostly   { background: rgba(127,219,202,0.2); color: #7fdbca; }
.ob-partial  { background: rgba(255,224,130,0.2); color: #ffe082; }
.ob-barely   { background: rgba(255,171,112,0.2); color: #ffab70; }
.ob-abandoned{ background: rgba(255,121,121,0.2); color: #ff7979; }
.ob-unknown  { background: rgba(136,146,176,0.15); color: #8892b0; }
.collapse-content.open.sl-content { max-height: none; overflow: visible; }

/* ── Highlight Cards (亮点与问题) ── */
.highlight-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 16px 0;
}
.highlight-col h3 {
  font-size: 1em;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.highlight-col h3.hl-green { color: #a3d9a5; }
.highlight-col h3.hl-red { color: #ff7979; }
.hl-card {
  background: var(--bg3);
  border-radius: var(--radius);
  padding: 12px 14px 12px 18px;
  margin: 8px 0;
  font-size: 0.88em;
  line-height: 1.5;
  color: var(--fg3);
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.hl-card .hl-icon { font-size: 1.2em; flex-shrink: 0; margin-top: 1px; }
.hl-card-green { border-left: 4px solid #a3d9a5; }
.hl-card-red { border-left: 4px solid #ff7979; }

/* ── Copy Button ── */
.copy-wrap { position: relative; }
.copy-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  background: var(--bg2);
  border: 1px solid var(--border);
  color: var(--fg2);
  padding: 3px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75em;
  transition: background 0.15s, color 0.15s;
  z-index: 2;
}
.copy-btn:hover { background: var(--bg3); color: var(--accent); }
.copy-btn.copied { color: var(--green); border-color: var(--green); }
.narrative-card pre {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 12px 14px;
  overflow-x: auto;
  font-size: 0.9em;
  line-height: 1.5;
  margin: 8px 0;
  color: var(--fg);
  font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
}
.narrative-card blockquote {
  border-left: 3px solid var(--accent3);
  padding: 6px 12px;
  margin: 8px 0;
  color: var(--fg3);
  font-style: italic;
  background: rgba(199,146,234,0.06);
  border-radius: 0 4px 4px 0;
}

/* ── Session Type Pie ── */
.pie-wrap {
  display: flex;
  align-items: center;
  gap: 32px;
  margin: 16px 0;
  flex-wrap: wrap;
}
.pie-chart {
  width: 180px;
  height: 180px;
  border-radius: 50%;
  flex-shrink: 0;
  position: relative;
}
.pie-center {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 80px; height: 80px;
  border-radius: 50%;
  background: var(--bg2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8em;
  color: var(--fg2);
  text-align: center;
  line-height: 1.2;
}
.pie-legend {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.85em;
}
.pie-legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fg3);
}
.pie-legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  body { padding: 12px; }
  .bar-label { width: 120px; min-width: 80px; }
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .hourly-grid { grid-template-columns: repeat(12, 1fr); }
  table { font-size: 0.75em; }
  th, td { padding: 4px 6px; }
  .quadrant-grid { grid-template-columns: 1fr; }
  .highlight-grid { grid-template-columns: 1fr; }
  .nav-toc { width: 160px; }
  .histogram { height: 120px; }
}

/* ── Workspace Deep Analysis ── */
.ws-deep-card {
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin: 12px 0;
  overflow: hidden;
}
.ws-deep-header {
  padding: 14px 18px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.15s;
  user-select: none;
}
.ws-deep-header:hover { background: rgba(100,255,218,0.04); }
.ws-deep-header h3 { color: var(--accent2); margin: 0; font-size: 1em; }
.ws-deep-body {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.35s ease-out, padding 0.35s;
  padding: 0 18px;
}
.ws-deep-body.open {
  max-height: 5000px;
  padding: 12px 18px 18px;
}
.ws-deep-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  margin: 10px 0;
}
.ws-deep-stat {
  background: var(--bg4);
  border-radius: 6px;
  padding: 10px;
  text-align: center;
}
.ws-deep-stat .wds-label { font-size: 0.7em; color: var(--fg2); text-transform: uppercase; letter-spacing: 0.5px; }
.ws-deep-stat .wds-val { font-size: 1.3em; font-weight: 700; color: var(--accent); }
.ws-summary-bar {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin: 16px 0;
}
.ws-summary-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 6px 14px;
  font-size: 0.82em;
}
.ws-summary-chip .dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ── Prompt Effectiveness ── */
.pe-section-green { border-left: 4px solid #a3d9a5; background: rgba(163,217,165,0.04); border-radius: var(--radius); padding: 16px 18px; margin: 14px 0; }
.pe-section-red { border-left: 4px solid #ff7979; background: rgba(255,121,121,0.04); border-radius: var(--radius); padding: 16px 18px; margin: 14px 0; }
.pe-section-blue { border-left: 4px solid #82aaff; background: rgba(130,170,255,0.04); border-radius: var(--radius); padding: 16px 18px; margin: 14px 0; }
.pe-section-green h3 { color: #a3d9a5; margin-bottom: 10px; }
.pe-section-red h3 { color: #ff7979; margin-bottom: 10px; }
.pe-section-blue h3 { color: #82aaff; margin-bottom: 10px; }
.pe-prompt-card {
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px 14px;
  margin: 8px 0;
  font-size: 0.85em;
  line-height: 1.5;
}
.pe-prompt-card .pe-prompt-text {
  color: var(--fg3);
  font-style: italic;
  margin-bottom: 6px;
  word-break: break-word;
}
.pe-prompt-card .pe-badges { display: flex; flex-wrap: wrap; gap: 6px; }
.pe-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 0.75em;
  font-weight: 600;
}
.pe-badge-green { background: rgba(163,217,165,0.2); color: #a3d9a5; }
.pe-badge-red { background: rgba(255,121,121,0.2); color: #ff7979; }
.pe-badge-blue { background: rgba(130,170,255,0.2); color: #82aaff; }
.pe-badge-yellow { background: rgba(255,224,130,0.2); color: #ffe082; }
.pe-badge-purple { background: rgba(199,146,234,0.2); color: #c792ea; }
.pe-suggestion-card {
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px 16px;
  margin: 8px 0;
}
.pe-suggestion-card .pe-type-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 0.72em;
  font-weight: 700;
  margin-bottom: 6px;
}
.pe-type-claude { background: rgba(100,255,218,0.2); color: #64ffda; }
.pe-type-skill { background: rgba(199,146,234,0.2); color: #c792ea; }
.pe-type-agent { background: rgba(255,171,112,0.2); color: #ffab70; }
.pe-suggestion-card .pe-content { color: var(--fg3); font-size: 0.88em; line-height: 1.5; }
.pe-pattern-list { list-style: none; padding: 0; margin: 8px 0; }
.pe-pattern-list li { padding: 4px 0; color: var(--fg3); font-size: 0.88em; }
.pe-pattern-list li::before { content: '\\25B8 '; color: var(--fg2); }

/* Learning Curve */
.lc-chart-wrap { margin: 16px 0; overflow-x: auto; }
.lc-trend-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px,1fr)); gap: 12px; margin: 12px 0; }

/* ── Facet Filter ── */
.facet-filter-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 0 0 24px;
}
.facet-filter-bar label {
  color: var(--fg2);
  font-size: 0.85em;
}
.facet-select {
  background: var(--bg2);
  border: 1px solid var(--border);
  color: var(--fg);
  padding: 8px 14px;
  border-radius: var(--radius);
  font-size: 0.9em;
  min-width: 220px;
  cursor: pointer;
}
.facet-select:hover { border-color: var(--accent); }
.facet-select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 2px rgba(100,255,218,0.15); }
.facet-empty-msg { color: var(--fg2); font-size: 0.9em; padding: 8px 0 4px; }
</style>
</head>
<body>
<button class="nav-toggle" onclick="toggleNav()">&#x2630;</button>
<nav class="nav-toc" id="navToc">
  <a href="#sec-header">&#x1F4CA; 概览</a>
${navLinks}
</nav>
`);

    // ── Header ────────────────────────────────────────
    const totalTokensStr = formatNumber((agg.totalInputTokens || 0) + (agg.totalOutputTokens || 0));
    parts.push(`<div class="header" id="sec-header">
  <h1>${he(title)}</h1>
  <div class="subtitle">
    扫描日期: ${he(meta.scanDate)} &nbsp;&bull;&nbsp;
    Sessions: ${agg.totalSessions} &nbsp;&bull;&nbsp;
    时间跨度: ${he(timeSpan)} &nbsp;&bull;&nbsp;
    数据量: ${meta.totalSizeMB} MB
  </div>
</div>
`);

    // ── Facet 筛选下拉框 ────────────────────────────────
    parts.push(`<div class="facet-filter-bar">
  <label for="facetSelect">&#x1F4C2; 查看板块：</label>
  <select id="facetSelect" class="facet-select" onchange="applyFacetFilter(this.value)">
    <option value="all">全部内容</option>
    ${facetOptions}
  </select>
</div>
`);

    // ── Stats Cards ───────────────────────────────────
    const totalMsgs = (agg.totalUserMessages || 0) + (agg.totalAssistantMessages || 0);
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

    // ── Section: At a Glance (right after stats) ─────
    if (hasNarratives && narratives.atAGlance) {
        const glance = narratives.atAGlance;
        // Support both old (worksWell/needsAttention/suggestions/horizon) and new (working/hindering/quickWins/ambitious) field names
        const working = glance.working || glance.workingWell || glance.worksWell;
        const hindering = glance.hindering || glance.needsAttention;
        const quickWins = glance.quickWins || glance.suggestions;
        const ambitious = glance.ambitious || glance.longTermGoals || glance.horizon;

        const renderItems = (items) => {
            if (!items) return '';
            const arr = Array.isArray(items) ? items : String(items).split('\n').filter(l => l.trim());
            if (arr.length === 0) return '';
            return '<ul>' + arr.map(i => `<li>${he(String(i).replace(/^[-•▸]\s*/, ''))}</li>`).join('') + '</ul>';
        };

        parts.push('<div class="section" id="sec-glance"><h2><span class="icon">&#x1F52D;</span> At a Glance</h2>');
        parts.push('<div class="quadrant-grid">');
        parts.push(`<div class="quadrant-card qc-green"><h4>&#x2705; 做得好的</h4>${renderItems(working) || '<p style="color:var(--fg3)">—</p>'}</div>`);
        parts.push(`<div class="quadrant-card qc-red"><h4>&#x26A0;&#xFE0F; 需要注意</h4>${renderItems(hindering) || '<p style="color:var(--fg3)">—</p>'}</div>`);
        parts.push(`<div class="quadrant-card qc-amber"><h4>&#x1F4A1; Quick Wins</h4>${renderItems(quickWins) || '<p style="color:var(--fg3)">—</p>'}</div>`);
        parts.push(`<div class="quadrant-card qc-purple"><h4>&#x1F52E; 远期机会</h4>${renderItems(ambitious) || '<p style="color:var(--fg3)">—</p>'}</div>`);
        parts.push('</div></div>');
    }

    // ── Section: 对话动力学总览 ──────────────────────
    {
        parts.push('<div class="section" id="sec-dynamics"><h2><span class="icon">&#x1F504;</span> 对话动力学总览</h2>');
        if (!hasTurnData) {
            parts.push('<p style="color:var(--fg2)">Turn 数据不可用。请使用 <code>--extract-turns</code> 参数重新运行 analyze-insight.js 以生成 Turn 数据。</p>');
        } else {
            const avgTurnsPerSession = Object.keys(turnDataMap).length > 0
                ? (aggTotalTurns / Object.keys(turnDataMap).length).toFixed(1) : '0';
            const totalQuestions = allQAPairs.length;
            const answeredQuestions = allQAPairs.filter(q => q.answered).length;
            const questionAnswerRate = totalQuestions > 0
                ? ((answeredQuestions / totalQuestions) * 100).toFixed(0) : '0';
            const completeResponses = aggTotalResponses - aggTruncated;
            const completeRate = aggTotalResponses > 0
                ? ((completeResponses / aggTotalResponses) * 100).toFixed(1) : '100';
            const truncatedRate = aggTotalResponses > 0
                ? ((aggTruncated / aggTotalResponses) * 100).toFixed(1) : '0';

            parts.push(`<div class="stats-row">
  <div class="stat-card"><div class="label">总回合数</div><div class="value">${formatNumber(aggTotalTurns)}</div></div>
  <div class="stat-card"><div class="label">平均回合/会话</div><div class="value">${avgTurnsPerSession}</div></div>
  <div class="stat-card"><div class="label">AI 提问次数</div><div class="value">${totalQuestions}</div></div>
  <div class="stat-card"><div class="label">问题回答率</div><div class="value">${questionAnswerRate}%</div></div>
</div>`);

            parts.push('<h3>&#x1F5E3;&#xFE0F; AI 提问 vs 用户回答</h3>');
            parts.push(`<p style="color:var(--fg3)">AI 通过 askQuestions 共提问 ${totalQuestions} 次，用户回答了 ${answeredQuestions} 次 (${questionAnswerRate}%)。</p>`);

            const interestingQA = allQAPairs.filter(q => q.answered).slice(0, 5);
            if (interestingQA.length > 0) {
                for (const qa of interestingQA) {
                    const wsInfo = sessionWorkspaceMap[qa.sessionId] || {};
                    const ansText = qa.answer
                        ? ((qa.answer.selected || []).join(', ') + (qa.answer.freeText ? ' — ' + qa.answer.freeText : ''))
                        : '';
                    const qText = String(qa.question).length > 200 ? String(qa.question).substring(0, 200) + '…' : String(qa.question);
                    parts.push(`<div style="background:var(--bg3);border-radius:8px;padding:16px;margin-bottom:12px;border-left:3px solid #60a5fa">
  <div style="color:#93c5fd;margin-bottom:8px"><strong>AI 问：</strong>${he(qText)}</div>
  <div style="color:#86efac"><strong>用户答：</strong>${he(ansText)}</div>
  <div style="color:var(--fg2);font-size:0.8em;margin-top:4px">Session: ${he(wsInfo.workspace)} &middot; ${he(wsInfo.date)}</div>
</div>`);
                }
            }

            parts.push('<h3>&#x1F4CA; AI 响应完整性</h3>');
            parts.push(`<div style="display:flex;gap:24px;align-items:center;margin-bottom:16px">
  <div style="width:300px;height:24px;background:var(--bg3);border-radius:12px;overflow:hidden;display:flex">
    <div style="width:${completeRate}%;background:#22c55e"></div>
    <div style="width:${truncatedRate}%;background:#ef4444"></div>
  </div>
  <div style="color:var(--fg2)">${completeResponses} 完整 / ${aggTruncated} 被截断 (${truncatedRate}%)</div>
</div>`);
            parts.push('<p style="color:var(--fg2);font-size:0.9em">VS Code debug log 有 5011 字符的硬截断限制。被截断的 AI 响应可能影响分析准确性。</p>');

            const dynAgentEntries = Object.entries(agentCallCounts).sort((a, b) => b[1] - a[1]);
            if (dynAgentEntries.length > 0) {
                const maxAC = dynAgentEntries[0][1];
                parts.push('<h3>&#x1F916; 子代理调用分布</h3><div class="bar-chart">');
                for (const [agent, count] of dynAgentEntries) {
                    const pct = barPct(count, maxAC);
                    parts.push(`<div class="bar-row">
  <div class="bar-label">${he(agent)}</div>
  <div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:#8b5cf6"></div></div>
  <div class="bar-value">${count}</div>
</div>`);
                }
                parts.push('</div>');
            }
        }
        parts.push('</div>');
    }

    // ── Section: Agent 使用分布 ───────────────────────
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

    // ── Section: 会话类型分布 ─────────────────────────
    if (hasFacets && Object.keys(sessionTypeDistribution).length > 0) {
        const stEntries = Object.entries(sessionTypeDistribution)
            .sort((a, b) => b[1] - a[1]);
        const stTotal = stEntries.reduce((s, e) => s + e[1], 0);
        const stColors = {
            focused_coding: '#64ffda', exploration: '#82aaff', debugging: '#ff7979',
            planning: '#c792ea', review: '#ffe082', mixed: '#ffab70',
        };
        // Build conic-gradient
        let conicParts = [];
        let cumPct = 0;
        for (const [key, val] of stEntries) {
            const pct = (val / stTotal) * 100;
            const color = stColors[key] || '#8892b0';
            conicParts.push(`${color} ${cumPct.toFixed(1)}% ${(cumPct + pct).toFixed(1)}%`);
            cumPct += pct;
        }
        const conicGrad = `conic-gradient(${conicParts.join(', ')})`;
        const stLabels = {
            focused_coding: '专注编码', exploration: '探索', debugging: '调试',
            planning: '规划', review: '审查', mixed: '混合',
        };

        parts.push(`<div class="section" id="sec-session-types"><h2><span class="icon">&#x1F4CA;</span> 会话类型分布</h2>`);
        parts.push(`<div class="pie-wrap">`);
        parts.push(`<div class="pie-chart" style="background:${conicGrad}"><div class="pie-center">${stTotal}<br>sessions</div></div>`);
        parts.push(`<div class="pie-legend">`);
        for (const [key, val] of stEntries) {
            const color = stColors[key] || '#8892b0';
            const label = stLabels[key] || key;
            const pctStr = ((val / stTotal) * 100).toFixed(1);
            parts.push(`<div class="pie-legend-item"><div class="pie-legend-dot" style="background:${color}"></div>${he(label)} — ${val} (${pctStr}%)</div>`);
        }
        parts.push(`</div></div></div>`);
    }

    // ── Section: 工具使用热力图 ───────────────────────
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
                const sLabel = s.workspaceName || (s.sessionId || '').substring(0, 8);
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
        const successPct = agg.avgToolSuccessRate || 0;
        parts.push(`<h3>工具成功率: ${successPct}%</h3>`);
        const successColor = successPct >= 95 ? 'var(--green)' : (successPct >= 80 ? 'var(--yellow)' : 'var(--red)');
        parts.push(`<div class="bar-chart">
<div class="bar-row">
  <div class="bar-label">整体成功率</div>
  <div class="bar-container"><div class="bar-fill" style="width:${successPct}%;background:${successColor}"></div></div>
  <div class="bar-value">${successPct}% (${(agg.totalToolCalls || 0) - (agg.totalToolErrors || 0)}/${agg.totalToolCalls || 0})</div>
</div>
</div>
`);

        parts.push('</div>');
    }

    // ── Section: Token 消耗分析 ──────────────────────
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

    // ── Section: 时间分布 ────────────────────────────
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
        } catch (_) { /* ignore */ }
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

    // ── Section: 工具错误分析 ────────────────────────
    const errEntries = getDictEntries(agg.toolErrorCategoriesAggregated)
        .sort((a, b) => Number(b.value) - Number(a.value));
    parts.push('<div class="section" id="sec-errors"><h2><span class="icon">&#x26A0;</span> 工具错误分析</h2>');
    if (errEntries.length > 0) {
        const maxErr = Number(errEntries[0].value);
        const errColors = {
            CommandFailed: '#ff7979', EditFailed: '#ffab70', FileNotFound: '#ffe082',
            FileChanged: '#c792ea', FileTooLarge: '#82aaff', UserRejected: '#a3d9a5', Other: '#8892b0',
        };
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

    // ── Section: At a Glance (moved to after stats cards) ──

    // ── Section: 亮点与问题 ──────────────────────────
    {
        // Collect top 3 highlights (green) and top 3 issues (red)
        const highlights = [];
        const issues = [];

        // From narratives
        if (hasNarratives) {
            if (narratives.whatWorks) {
                const lines = String(narratives.whatWorks).split('\n').filter(l => l.trim());
                for (const l of lines) {
                    if (highlights.length < 3 && l.trim().length > 5) highlights.push(l.trim());
                }
            }
            if (narratives.frictionAnalysis) {
                const lines = String(narratives.frictionAnalysis).split('\n').filter(l => l.trim());
                for (const l of lines) {
                    if (issues.length < 3 && l.trim().length > 5) issues.push(l.trim());
                }
            }
        }

        // Fallback: from facets aggregation
        if (highlights.length === 0 && hasFacets) {
            for (const f of facetsData) {
                const fc = f.facets || f;
                if (fc.primarySuccess && highlights.length < 3) {
                    highlights.push(String(fc.primarySuccess).substring(0, 120));
                }
            }
        }
        if (issues.length === 0 && hasFacets) {
            const topFriction = Object.entries(frictionDistribution)
                .sort((a, b) => b[1] - a[1]).slice(0, 3);
            for (const [k, v] of topFriction) {
                issues.push(`${k}: ${v} 次`);
            }
        }

        if (highlights.length > 0 || issues.length > 0) {
            parts.push('<div class="section" id="sec-highlights"><h2><span class="icon">&#x2B50;</span> 亮点与问题</h2>');
            parts.push('<div class="highlight-grid">');

            // Green column
            parts.push('<div class="highlight-col"><h3 class="hl-green">&#x2705; Top Impressive</h3>');
            if (highlights.length > 0) {
                for (const h of highlights) {
                    parts.push(`<div class="hl-card hl-card-green"><span class="hl-icon">&#x1F31F;</span><span>${he(h)}</span></div>`);
                }
            } else {
                parts.push('<div class="hl-card hl-card-green"><span class="hl-icon">&#x2014;</span><span>无亮点数据</span></div>');
            }
            parts.push('</div>');

            // Red column
            parts.push('<div class="highlight-col"><h3 class="hl-red">&#x26A0; Top Issues</h3>');
            if (issues.length > 0) {
                for (const iss of issues) {
                    parts.push(`<div class="hl-card hl-card-red"><span class="hl-icon">&#x1F6A8;</span><span>${he(iss)}</span></div>`);
                }
            } else {
                parts.push('<div class="hl-card hl-card-red"><span class="hl-icon">&#x2014;</span><span>无问题数据</span></div>');
            }
            parts.push('</div>');

            parts.push('</div></div>');
        }
    }

    // ── Section: 目标分布 ─────────────────────────────
    if (hasFacets && Object.keys(goalDistribution).length > 0) {
        const goalLabels = {
            feature_work: '&#x1F195; 功能开发', bug_fix: '&#x1F41B; 修复 Bug', refactoring: '&#x267B; 重构',
            testing: '&#x1F9EA; 测试', documentation: '&#x1F4DD; 文档', devops_infra: '&#x2699; DevOps',
            code_review: '&#x1F440; 代码审查', learning_exploration: '&#x1F4DA; 学习探索',
            data_analysis: '&#x1F4CA; 数据分析', design_architecture: '&#x1F3D7; 架构设计',
            migration_upgrade: '&#x1F504; 迁移升级', performance_optimization: '&#x26A1; 性能优化', security: '&#x1F512; 安全',
        };
        const goalEntries = Object.entries(goalDistribution)
            .map(([k, v]) => ({ key: k, value: v }))
            .sort((a, b) => b.value - a.value);
        const maxGoal = goalEntries[0].value;
        parts.push('<div class="section" id="sec-goals"><h2><span class="icon">&#x1F3AF;</span> 目标分布</h2><div class="bar-chart">');
        for (const g of goalEntries) {
            const label = goalLabels[g.key] || he(g.key);
            const pct = barPct(g.value, maxGoal);
            parts.push(`<div class="bar-row"><div class="bar-label">${label}</div><div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:var(--accent2)"></div></div><div class="bar-value">${g.value}</div></div>`);
        }
        parts.push('</div></div>');
    }

    // ── Section: 成果分析 ─────────────────────────────
    if (hasFacets && Object.keys(outcomeDistribution).length > 0) {
        const outcomeLabels = {
            fully_achieved: { label: '&#x2705; 完全达成', color: '#a3d9a5' },
            mostly_achieved: { label: '&#x1F7E2; 大部分达成', color: '#7fdbca' },
            partially_achieved: { label: '&#x1F7E1; 部分达成', color: '#ffe082' },
            barely_started: { label: '&#x1F7E0; 刚刚开始', color: '#ffab70' },
            abandoned: { label: '&#x1F534; 放弃', color: '#ff7979' },
        };
        // Ordered: predefined keys first, then any extras
        const orderedKeys = ['fully_achieved', 'mostly_achieved', 'partially_achieved', 'barely_started', 'abandoned'];
        const outcomeEntries = [];
        for (const oKey of orderedKeys) {
            if (outcomeDistribution[oKey] !== undefined) {
                outcomeEntries.push({ key: oKey, value: outcomeDistribution[oKey] });
            }
        }
        for (const oKey of Object.keys(outcomeDistribution)) {
            if (!orderedKeys.includes(oKey)) {
                outcomeEntries.push({ key: oKey, value: outcomeDistribution[oKey] });
            }
        }
        if (outcomeEntries.length > 0) {
            const maxOutcome = Math.max(...outcomeEntries.map(o => o.value));
            parts.push('<div class="section" id="sec-outcomes"><h2><span class="icon">&#x1F4C8;</span> 成果分析</h2><div class="bar-chart">');
            for (const o of outcomeEntries) {
                const info = outcomeLabels[o.key] || { label: he(o.key), color: '#8892b0' };
                const pct = barPct(o.value, maxOutcome);
                parts.push(`<div class="bar-row"><div class="bar-label">${info.label}</div><div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:${info.color}"></div></div><div class="bar-value">${o.value}</div></div>`);
            }
            parts.push('</div></div>');
        }
    }

    // ── Section: 满意度分析 ───────────────────────────
    if (hasFacets && Object.keys(satisfactionDistribution).length > 0) {
        const satLabels = {
            highly_satisfied: { label: '&#x1F929; 非常满意', color: '#a3d9a5' },
            impressed: { label: '&#x1F60D; 印象深刻', color: '#7fdbca' },
            satisfied: { label: '&#x1F60A; 满意', color: '#82aaff' },
            neutral: { label: '&#x1F610; 中性', color: '#8892b0' },
            slightly_frustrated: { label: '&#x1F615; 轻微不满', color: '#ffab70' },
            frustrated: { label: '&#x1F624; 不满', color: '#ff7979' },
            very_frustrated: { label: '&#x1F621; 非常不满', color: '#e74c3c' },
            confused: { label: '&#x1F635; 困惑', color: '#c792ea' },
        };
        const satEntries = Object.entries(satisfactionDistribution)
            .map(([k, v]) => ({ key: k, value: v }))
            .sort((a, b) => b.value - a.value);
        const maxSat = satEntries[0].value;
        parts.push('<div class="section" id="sec-satisfaction"><h2><span class="icon">&#x1F60A;</span> 满意度分析</h2><div class="bar-chart">');
        for (const se of satEntries) {
            const info = satLabels[se.key] || { label: he(se.key), color: '#8892b0' };
            const pct = barPct(se.value, maxSat);
            parts.push(`<div class="bar-row"><div class="bar-label">${info.label}</div><div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:${info.color}"></div></div><div class="bar-value">${se.value}</div></div>`);
        }
        parts.push('</div></div>');
    }

    // ── Section: 摩擦分析 ─────────────────────────────
    if (hasFacets && Object.keys(frictionDistribution).length > 0) {
        const fricLabels = {
            wrong_approach: '方向错误', hallucination: '幻觉', ignored_instruction: '忽略指令',
            repetitive_error: '重复犯错', context_lost: '丢失上下文', slow_response: '响应缓慢',
            tool_failure: '工具失败', incomplete_solution: '不完整方案', wrong_file_edit: '编辑错误文件',
            unnecessary_changes: '不必要的修改', poor_code_quality: '代码质量差', misunderstood_request: '误解需求',
        };
        const fricEntries = Object.entries(frictionDistribution)
            .map(([k, v]) => ({ key: k, value: v }))
            .sort((a, b) => b.value - a.value);
        const maxFric = fricEntries[0].value;
        parts.push('<div class="section" id="sec-friction"><h2><span class="icon">&#x26A1;</span> 摩擦分析</h2><div class="bar-chart">');
        for (const fe of fricEntries) {
            const label = fricLabels[fe.key] || he(fe.key);
            const pct = barPct(fe.value, maxFric);
            parts.push(`<div class="bar-row"><div class="bar-label">${he(label)}</div><div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:var(--red)"></div></div><div class="bar-value">${fe.value}</div></div>`);
        }
        parts.push('</div></div>');
    }

    // ── Section: 深度语义分析（新字段） ──────────────
    if (hasFacets) {
        const hasNewData = totalInterruptions > 0 || Object.keys(correctionDistribution).length > 0 || emotionQuotes.length > 0 || frictionDensityCount > 0;
        if (hasNewData) {
            parts.push('<div class="section" id="sec-deep"><h2><span class="icon">&#x1F50E;</span> 深度语义分析</h2>');

            // Friction Density + Interruptions stats
            const avgFrictionDensity = frictionDensityCount > 0 ? (totalFrictionDensitySum / frictionDensityCount).toFixed(2) : '—';
            parts.push(`<div class="stats-row">
  <div class="stat-card"><div class="label">用户中断次数</div><div class="value">${totalInterruptions}</div><div class="sub">跨所有 session 总计</div></div>
  <div class="stat-card"><div class="label">平均摩擦密度</div><div class="value">${avgFrictionDensity}</div><div class="sub">摩擦事件 / 消息数</div></div>
</div>`);

            // Correction Events bar chart
            if (Object.keys(correctionDistribution).length > 0) {
                const corrLabels = {
                    business_misunderstanding: '业务理解偏差', test_quality_complaint: '测试质量抱怨',
                    execution_deviation: '执行偏离指令', overengineering: '过度工程化',
                };
                const corrEntries = Object.entries(correctionDistribution)
                    .map(([k, v]) => ({ key: k, value: v }))
                    .sort((a, b) => b.value - a.value);
                const maxCorr = corrEntries[0].value;
                parts.push('<h3>用户纠正事件</h3><div class="bar-chart">');
                for (const ce of corrEntries) {
                    const label = corrLabels[ce.key] || he(ce.key);
                    const pct = barPct(ce.value, maxCorr);
                    parts.push(`<div class="bar-row"><div class="bar-label">${he(label)}</div><div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:var(--orange)"></div></div><div class="bar-value">${ce.value}</div></div>`);
                }
                parts.push('</div>');
            }

            // Emotion Escalation quotes
            if (emotionQuotes.length > 0) {
                parts.push('<h3>情绪升级引用</h3>');
                for (const q of emotionQuotes) {
                    parts.push(`<div class="anomaly-item anomaly-warn" style="font-style:italic">&ldquo;${he(q)}&rdquo;</div>`);
                }
            }

            parts.push('</div>');
        }
    }

    // ── Section: 学习曲线分析 ─────────────────────────
    if (lcData) {
        parts.push('<div class="section" id="sec-learning-curve"><h2><span class="icon">&#x1F4C8;</span> 学习曲线分析</h2>');
        parts.push('<p style="color:var(--fg2);margin-bottom:12px">跨会话指标趋势：PQI（Prompt质量）、ARI（采纳率）、SAT（满意度）、FD（摩擦密度×100）</p>');
        // Overall trend cards
        parts.push(renderLCTrendCards(lcData.overall.trend, '总体趋势'));
        // Overall line chart
        parts.push(renderLCLineChart(lcData.overall.daily, '总体指标趋势'));
        // Per-workspace
        const wsNames = Object.keys(lcData.workspaces).sort((a, b) => (lcData.workspaces[b].sessionCount || 0) - (lcData.workspaces[a].sessionCount || 0));
        for (const ws of wsNames) {
            const wsData = lcData.workspaces[ws];
            parts.push(`<h3 style="margin-top:24px">${he(ws)} <span style="color:var(--fg2);font-size:0.8em">(${wsData.sessionCount} sessions)</span></h3>`);
            parts.push(renderLCTrendCards(wsData.trend));
            parts.push(renderLCLineChart(wsData.daily, ws + ' 指标趋势'));
            parts.push(renderLCStackedArea(wsData.daily));
        }
        parts.push('</div>');
    }

    // ── Section: 叙事洞察 ─────────────────────────────
    if (hasNarratives) {
        parts.push('<div class="section" id="sec-narratives"><h2><span class="icon">&#x1F4D6;</span> 叙事洞察</h2>');
        const narrativeFields = [
            { key: 'projectAreas', title: '&#x1F3AF; 项目领域', css: '' },
            { key: 'interactionStyle', title: '&#x1F4AC; 交互风格', css: '' },
            { key: 'whatWorks', title: '&#x2728; 做得好的', css: 'nc-green' },
            { key: 'frictionAnalysis', title: '&#x26A1; 摩擦分析', css: 'nc-red' },
            { key: 'repeatedPatterns', title: '&#x1F504; 高频行为模式', css: 'nc-golden' },
            { key: 'suggestions', title: '&#x1F4A1; 改进建议', css: 'nc-purple' },
            { key: 'onTheHorizon', title: '&#x1F52E; 展望', css: 'nc-golden' },
            { key: 'funEnding', title: '&#x1F389; 彩蛋', css: 'nc-rainbow' },
        ];

        /** Render narrative text with markdown blockquotes and fenced code blocks */
        function renderNarrativeHtml(text, fieldKey) {
            const lines = String(text).split('\n');
            const out = [];
            let inCodeBlock = false;
            let codeLines = [];
            let codeLang = '';
            let codeBlockId = 0;
            for (const line of lines) {
                const trimmed = line.trim();
                if (!inCodeBlock && trimmed.startsWith('```')) {
                    inCodeBlock = true;
                    codeLang = trimmed.substring(3).trim();
                    codeLines = [];
                    continue;
                }
                if (inCodeBlock && trimmed.startsWith('```')) {
                    inCodeBlock = false;
                    const cbId = `cb_${fieldKey}_${codeBlockId++}`;
                    const codeText = codeLines.join('\n');
                    out.push(`<div class="copy-wrap"><button class="copy-btn" onclick="copyCode(this,'${cbId}')">&#x1F4CB; Copy</button><pre id="${cbId}">${he(codeText)}</pre></div>`);
                    continue;
                }
                if (inCodeBlock) {
                    codeLines.push(line);
                    continue;
                }
                if (trimmed.startsWith('> ')) {
                    out.push(`<blockquote>${he(trimmed.substring(2))}</blockquote>`);
                } else if (trimmed) {
                    out.push(`<p>${he(trimmed)}</p>`);
                }
            }
            // Flush unclosed code block
            if (inCodeBlock && codeLines.length > 0) {
                const cbId = `cb_${fieldKey}_${codeBlockId++}`;
                const codeText = codeLines.join('\n');
                out.push(`<div class="copy-wrap"><button class="copy-btn" onclick="copyCode(this,'${cbId}')">&#x1F4CB; Copy</button><pre id="${cbId}">${he(codeText)}</pre></div>`);
            }
            return out.join('\n');
        }

        for (const nf of narrativeFields) {
            const val = narratives[nf.key];
            if (!val) continue;
            const cssClass = nf.css ? `narrative-card ${nf.css}` : 'narrative-card';
            parts.push(`<div class="${cssClass}"><h3>${nf.title}</h3>`);
            if (Array.isArray(val)) {
                for (const p of val) {
                    parts.push(renderNarrativeHtml(String(p), nf.key));
                }
            } else {
                parts.push(renderNarrativeHtml(String(val), nf.key));
            }
            parts.push('</div>');
        }
        parts.push('</div>');
    }

    // ── Section: 响应时间分布 ─────────────────────────
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

    // ── Section: 代码变更统计 ────────────────────────
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
        const maxWsMsg = Number((wsCodeEntries[0].value || {}).userMessages || 0);
        parts.push('<h3>按 Workspace 的活跃度</h3><div class="bar-chart">');
        for (const w of wsCodeEntries) {
            const pct = barPct(Number((w.value || {}).userMessages || 0), maxWsMsg);
            parts.push(`<div class="bar-row">
  <div class="bar-label">${he(w.name)}</div>
  <div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:var(--accent)"></div></div>
  <div class="bar-value">${(w.value || {}).sessions || 0} sessions / ${(w.value || {}).userMessages || 0} msgs</div>
</div>
`);
        }
        parts.push('</div>');
    }
    parts.push('</div>');

    // ── Section: 语言分布 ────────────────────────────
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

    // ── Section: 异常检测 ────────────────────────────
    parts.push('<div class="section" id="sec-anomaly"><h2><span class="icon">&#x1F50D;</span> 异常检测</h2>');

    // 超长 session
    const longSessions = sessions
        .filter(s => (s.durationMinutes || 0) > 120)
        .sort((a, b) => (b.durationMinutes || 0) - (a.durationMinutes || 0))
        .slice(0, 10);
    parts.push(`<div class="collapse-toggle" onclick="toggleCollapse(this)">
  <span>&#x23F1; 超长 Session (&gt;2h): ${longSessions.length} 个</span>
  <span class="arrow">&#x25B6;</span>
</div>
<div class="collapse-content">
`);
    if (longSessions.length > 0) {
        for (const ls of longSessions) {
            const durStr = Math.round(ls.durationMinutes || 0);
            const wsName = ls.workspaceName || '';
            parts.push(`<div class="anomaly-item anomaly-warn">${he(wsName)} — ${durStr} 分钟 — ${ls.userMessageCount || 0} 用户消息</div>`);
        }
    } else {
        parts.push('<div class="anomaly-item anomaly-ok">无超长 session</div>');
    }
    parts.push('</div>');

    // 高错误率 session
    const highErrSessions = sessions
        .filter(s => (s.toolSuccessRate || 100) < 90 && (s.toolErrors || 0) > 0)
        .sort((a, b) => (a.toolSuccessRate || 100) - (b.toolSuccessRate || 100))
        .slice(0, 10);
    parts.push(`<div class="collapse-toggle" onclick="toggleCollapse(this)">
  <span>&#x274C; 高错误率 Session (&lt;90% 成功率): ${highErrSessions.length} 个</span>
  <span class="arrow">&#x25B6;</span>
</div>
<div class="collapse-content">
`);
    if (highErrSessions.length > 0) {
        for (const hes of highErrSessions) {
            const wsName = hes.workspaceName || '';
            parts.push(`<div class="anomaly-item">${he(wsName)} — 成功率 ${hes.toolSuccessRate}% — ${hes.toolErrors} 个错误</div>`);
        }
    } else {
        parts.push('<div class="anomaly-item anomaly-ok">所有 session 工具成功率均 ≥ 90%</div>');
    }
    parts.push('</div>');

    // 超大数据 session（token > 100M）
    const bigTokenSessions = sessions
        .filter(s => ((s.inputTokens || 0) + (s.outputTokens || 0)) > 100000000)
        .sort((a, b) => ((b.inputTokens || 0) + (b.outputTokens || 0)) - ((a.inputTokens || 0) + (a.outputTokens || 0)))
        .slice(0, 10);
    parts.push(`<div class="collapse-toggle" onclick="toggleCollapse(this)">
  <span>&#x1F4E6; 超大 Token Session (&gt;100M): ${bigTokenSessions.length} 个</span>
  <span class="arrow">&#x25B6;</span>
</div>
<div class="collapse-content">
`);
    if (bigTokenSessions.length > 0) {
        for (const bt of bigTokenSessions) {
            const totalT = formatNumber((bt.inputTokens || 0) + (bt.outputTokens || 0));
            const wsName = bt.workspaceName || '';
            parts.push(`<div class="anomaly-item anomaly-warn">${he(wsName)} — ${totalT} tokens — ${bt.llmCalls || 0} LLM calls</div>`);
        }
    } else {
        parts.push('<div class="anomaly-item anomaly-ok">无超大 Token session</div>');
    }
    parts.push('</div>');

    parts.push('</div>');

    // ── Section: Workspace 概览 ──────────────────────
    const wsOverview = getDictEntries(agg.byWorkspace)
        .sort((a, b) => Number((b.value || {}).inputTokens || 0) - Number((a.value || {}).inputTokens || 0));
    if (wsOverview.length > 0) {
        parts.push('<div class="section" id="sec-ws"><h2><span class="icon">&#x1F4C2;</span> Workspace 概览</h2><div class="ws-grid">');

        for (const w of wsOverview) {
            const wsSessions = (w.value || {}).sessions || 0;
            const wsMsgs = (w.value || {}).userMessages || 0;
            const wsTokens = formatNumber(Number((w.value || {}).inputTokens || 0));

            // 查找该 workspace 的 top subagent
            const wsSessionObjs = sessions.filter(s => s.workspaceName === w.name);
            const wsSubagents = {};
            for (const ws of wsSessionObjs) {
                for (const sa of getDictEntries(ws.subagentNames)) {
                    wsSubagents[sa.name] = (wsSubagents[sa.name] || 0) + Number(sa.value);
                }
            }
            let topAgent = '';
            const saKeys = Object.entries(wsSubagents).sort((a, b) => b[1] - a[1]);
            if (saKeys.length > 0) topAgent = saKeys[0][0];

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

    // ── Section: Workspace 深度分析 ──────────────────
    if (hasFacets && wsOverview.length > 0) {
        // Build per-workspace aggregated facets
        const wsSessionMap = {};
        for (const s of sessions) {
            const wsName = s.workspaceName || '(unknown)';
            if (!wsSessionMap[wsName]) wsSessionMap[wsName] = [];
            wsSessionMap[wsName].push(s);
        }

        const wsDeepData = [];
        for (const [wsName, wsSessions] of Object.entries(wsSessionMap)) {
            const wsGoals = {};
            const wsSat = {};
            const wsFriction = {};
            const wsCorrections = {};
            const wsEmotions = [];
            let wsTotalTokens = 0;
            let wsTotalMsgs = 0;
            let wsFrictionDensitySum = 0;
            let wsFrictionDensityN = 0;

            for (const ws of wsSessions) {
                wsTotalTokens += (Number(ws.inputTokens) || 0) + (Number(ws.outputTokens) || 0);
                wsTotalMsgs += (Number(ws.userMessageCount) || 0) + (Number(ws.assistantMessageCount) || 0);
                const fc = facetsMap[ws.sessionId];
                if (!fc) continue;
                // Goals
                if (fc.goalCategories) {
                    if (typeof fc.goalCategories === 'object' && !Array.isArray(fc.goalCategories)) {
                        for (const [k, v] of Object.entries(fc.goalCategories)) {
                            wsGoals[k] = (wsGoals[k] || 0) + (Number(v) || 1);
                        }
                    } else if (Array.isArray(fc.goalCategories)) {
                        for (const c of fc.goalCategories) wsGoals[String(c)] = (wsGoals[String(c)] || 0) + 1;
                    }
                }
                // Satisfaction
                if (fc.userSatisfaction) {
                    const satKey = fc.userSatisfaction.overall ? String(fc.userSatisfaction.overall) : String(fc.userSatisfaction);
                    wsSat[satKey] = (wsSat[satKey] || 0) + 1;
                }
                // Friction
                if (fc.frictionCounts) {
                    for (const [fk, fv] of Object.entries(fc.frictionCounts)) {
                        const v = Number(fv) || 0;
                        if (v > 0) wsFriction[fk] = (wsFriction[fk] || 0) + v;
                    }
                }
                // Corrections
                if (fc.correctionEvents && typeof fc.correctionEvents === 'object') {
                    for (const [ck, cv] of Object.entries(fc.correctionEvents)) {
                        const v = Number(cv) || 0;
                        if (v > 0) wsCorrections[ck] = (wsCorrections[ck] || 0) + v;
                    }
                }
                // Emotions
                if (fc.emotionEscalation && Array.isArray(fc.emotionEscalation)) {
                    for (const q of fc.emotionEscalation) {
                        if (q && wsEmotions.length < 5) wsEmotions.push(String(q));
                    }
                }
                // Friction density
                if (typeof fc.frictionDensity === 'number') {
                    wsFrictionDensitySum += fc.frictionDensity;
                    wsFrictionDensityN++;
                }
            }

            const totalFriction = Object.values(wsFriction).reduce((s, v) => s + v, 0);
            const avgFD = wsFrictionDensityN > 0 ? (wsFrictionDensitySum / wsFrictionDensityN) : 0;
            wsDeepData.push({
                name: wsName,
                sessionCount: wsSessions.length,
                totalMsgs: wsTotalMsgs,
                totalTokens: wsTotalTokens,
                goals: wsGoals,
                satisfaction: wsSat,
                friction: wsFriction,
                corrections: wsCorrections,
                emotions: wsEmotions,
                avgFrictionDensity: avgFD,
                totalFriction: totalFriction,
            });
        }

        // Sort by session count descending
        wsDeepData.sort((a, b) => b.sessionCount - a.sessionCount);

        parts.push('<div class="section" id="sec-ws-deep"><h2><span class="icon">&#x1F9E0;</span> Workspace 深度分析</h2>');

        // Summary bar: most friction vs most success
        const wsMaxFriction = wsDeepData.reduce((best, w) => w.totalFriction > (best ? best.totalFriction : -1) ? w : best, null);
        const wsMinFriction = wsDeepData.reduce((best, w) => w.totalFriction < (best ? best.totalFriction : Infinity) ? w : best, null);
        parts.push('<div class="ws-summary-bar">');
        if (wsMaxFriction && wsMaxFriction.totalFriction > 0) {
            parts.push(`<div class="ws-summary-chip"><div class="dot" style="background:#ff7979"></div>最多摩擦: ${he(wsMaxFriction.name)} (${wsMaxFriction.totalFriction})</div>`);
        }
        if (wsMinFriction) {
            parts.push(`<div class="ws-summary-chip"><div class="dot" style="background:#a3d9a5"></div>最少摩擦: ${he(wsMinFriction.name)} (${wsMinFriction.totalFriction})</div>`);
        }
        // Find workspace with most satisfied sessions
        let wsBestSat = null;
        let wsBestSatCount = 0;
        for (const w of wsDeepData) {
            const goodSat = (w.satisfaction['highly_satisfied'] || 0) + (w.satisfaction['satisfied'] || 0) + (w.satisfaction['impressed'] || 0);
            if (goodSat > wsBestSatCount) { wsBestSatCount = goodSat; wsBestSat = w; }
        }
        if (wsBestSat) {
            parts.push(`<div class="ws-summary-chip"><div class="dot" style="background:#64ffda"></div>最高满意: ${he(wsBestSat.name)} (${wsBestSatCount})</div>`);
        }
        parts.push('</div>');

        // Per-workspace collapsible cards
        for (let wi = 0; wi < wsDeepData.length; wi++) {
            const w = wsDeepData[wi];
            parts.push(`<div class="ws-deep-card">
  <div class="ws-deep-header" onclick="var b=this.nextElementSibling;b.classList.toggle('open');this.querySelector('.arrow').classList.toggle('open')">
    <h3>${he(w.name)}</h3>
    <span style="display:flex;align-items:center;gap:12px">
      <span style="font-size:0.8em;color:var(--fg2)">${w.sessionCount} sessions &middot; ${formatNumber(w.totalTokens)} tokens</span>
      <span class="arrow">&#x25B6;</span>
    </span>
  </div>
  <div class="ws-deep-body">`);

            // Stats row
            const wAvgFD = w.avgFrictionDensity.toFixed(2);
            parts.push(`<div class="ws-deep-stats">
  <div class="ws-deep-stat"><div class="wds-label">Sessions</div><div class="wds-val">${w.sessionCount}</div></div>
  <div class="ws-deep-stat"><div class="wds-label">总消息</div><div class="wds-val">${formatNumber(w.totalMsgs)}</div></div>
  <div class="ws-deep-stat"><div class="wds-label">总 Token</div><div class="wds-val">${formatNumber(w.totalTokens)}</div></div>
  <div class="ws-deep-stat"><div class="wds-label">摩擦密度</div><div class="wds-val">${wAvgFD}</div></div>
  <div class="ws-deep-stat"><div class="wds-label">总摩擦事件</div><div class="wds-val">${w.totalFriction}</div></div>
</div>`);

            // Goal categories
            const wGoalEntries = Object.entries(w.goals).sort((a, b) => b[1] - a[1]);
            if (wGoalEntries.length > 0) {
                const wMaxGoal = wGoalEntries[0][1];
                parts.push('<h4 style="color:var(--fg3);margin:10px 0 6px;font-size:0.9em">目标分布</h4><div class="bar-chart">');
                for (const [gk, gv] of wGoalEntries) {
                    const pct = barPct(gv, wMaxGoal);
                    parts.push(`<div class="bar-row"><div class="bar-label">${he(gk)}</div><div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:var(--accent2)"></div></div><div class="bar-value">${gv}</div></div>`);
                }
                parts.push('</div>');
            }

            // Satisfaction distribution
            const wSatEntries = Object.entries(w.satisfaction).sort((a, b) => b[1] - a[1]);
            if (wSatEntries.length > 0) {
                const wMaxSat = wSatEntries[0][1];
                parts.push('<h4 style="color:var(--fg3);margin:10px 0 6px;font-size:0.9em">满意度</h4><div class="bar-chart">');
                for (const [sk, sv] of wSatEntries) {
                    const pct = barPct(sv, wMaxSat);
                    const satColor = (sk === 'highly_satisfied' || sk === 'satisfied' || sk === 'impressed') ? 'var(--green)' : (sk === 'frustrated' || sk === 'very_frustrated') ? 'var(--red)' : 'var(--accent2)';
                    parts.push(`<div class="bar-row"><div class="bar-label">${he(sk)}</div><div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:${satColor}"></div></div><div class="bar-value">${sv}</div></div>`);
                }
                parts.push('</div>');
            }

            // Friction distribution
            const wFricEntries = Object.entries(w.friction).sort((a, b) => b[1] - a[1]);
            if (wFricEntries.length > 0) {
                const wMaxFric = wFricEntries[0][1];
                parts.push('<h4 style="color:var(--fg3);margin:10px 0 6px;font-size:0.9em">摩擦事件</h4><div class="bar-chart">');
                for (const [fk, fv] of wFricEntries) {
                    const pct = barPct(fv, wMaxFric);
                    parts.push(`<div class="bar-row"><div class="bar-label">${he(fk)}</div><div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:var(--red)"></div></div><div class="bar-value">${fv}</div></div>`);
                }
                parts.push('</div>');
            }

            // Correction events
            const wCorrEntries = Object.entries(w.corrections).sort((a, b) => b[1] - a[1]);
            if (wCorrEntries.length > 0) {
                parts.push('<h4 style="color:var(--fg3);margin:10px 0 6px;font-size:0.9em">纠正事件</h4><div class="bar-chart">');
                const wMaxCorr = wCorrEntries[0][1];
                for (const [ck, cv] of wCorrEntries) {
                    const pct = barPct(cv, wMaxCorr);
                    parts.push(`<div class="bar-row"><div class="bar-label">${he(ck)}</div><div class="bar-container"><div class="bar-fill" style="width:${pct}%;background:var(--orange)"></div></div><div class="bar-value">${cv}</div></div>`);
                }
                parts.push('</div>');
            }

            // Emotion escalation quotes
            if (w.emotions.length > 0) {
                parts.push('<h4 style="color:var(--fg3);margin:10px 0 6px;font-size:0.9em">情绪升级引用</h4>');
                for (const eq of w.emotions) {
                    parts.push(`<div class="anomaly-item anomaly-warn" style="font-style:italic">&ldquo;${he(eq)}&rdquo;</div>`);
                }
            }

            parts.push('</div></div>');
        }

        parts.push('</div>');
    }

    // ── Section: 用户 Prompt 有效性分析 ──────────────
    if (hasFacets && facetsData.length > 0) {
        const effectivePrompts = [];
        const ineffectivePrompts = [];
        const allInstructions = [];

        for (const f of facetsData) {
            const fc = f.facets || f;
            const sid = f.sessionId || fc.sessionId || '';
            const prompt = fc.firstPrompt || '';
            const outcome = fc.outcome || '';
            const satRaw = fc.userSatisfaction;
            const satOverall = satRaw ? (satRaw.overall ? String(satRaw.overall) : String(satRaw)) : '';
            const frictionTotal = fc.frictionCounts ? Object.values(fc.frictionCounts).reduce((s, v) => s + (Number(v) || 0), 0) : 0;
            const goals = fc.goalCategories || {};
            const goalStr = typeof goals === 'object' && !Array.isArray(goals)
                ? Object.entries(goals).sort((a, b) => b[1] - a[1]).map(([k]) => k).join(', ')
                : (Array.isArray(goals) ? goals.join(', ') : '');

            // Classify
            const isGoodOutcome = outcome === 'fully_achieved' || outcome === 'mostly_achieved';
            const isGoodSat = satOverall === 'highly_satisfied' || satOverall === 'satisfied' || satOverall === 'impressed';
            const isBadOutcome = outcome === 'barely_started' || outcome === 'abandoned' || outcome === 'not_achieved';
            const isHighFriction = frictionTotal >= 3;

            if (prompt) {
                if (isGoodOutcome && isGoodSat) {
                    effectivePrompts.push({ prompt, outcome, satisfaction: satOverall, goals: goalStr, sid });
                } else if (isBadOutcome || isHighFriction) {
                    ineffectivePrompts.push({ prompt, outcome, satisfaction: satOverall, friction: frictionTotal, goals: goalStr, sid });
                }
            }

            // Collect instructions
            if (fc.userInstructionsToClaude && Array.isArray(fc.userInstructionsToClaude)) {
                for (const inst of fc.userInstructionsToClaude) {
                    if (inst && String(inst).trim()) {
                        allInstructions.push({ text: String(inst).trim(), goals: goalStr, sid });
                    }
                }
            }
        }

        parts.push('<div class="section" id="sec-prompt-eff"><h2><span class="icon">&#x1F4DD;</span> 用户 Prompt 有效性分析</h2>');

        // Sub-section a: 高效 Prompt 模式
        parts.push('<div class="pe-section-green"><h3>&#x2705; 高效 Prompt 模式</h3>');
        if (effectivePrompts.length > 0) {
            // Extract common patterns
            const patternSignals = {
                explicit_constraints: 0,
                step_by_step: 0,
                context_provision: 0,
                specific_file_refs: 0,
                clear_goal: 0,
                examples_given: 0,
            };
            for (const ep of effectivePrompts) {
                const p = ep.prompt.toLowerCase();
                if (p.includes('不要') || p.includes('不得') || p.includes('禁止') || p.includes('must not') || p.includes('constraint') || p.includes('限制')) patternSignals.explicit_constraints++;
                if (p.includes('步骤') || p.includes('step') || p.includes('1.') || p.includes('第一') || p.includes('首先')) patternSignals.step_by_step++;
                if (p.includes('文件') || p.includes('file') || p.includes('.js') || p.includes('.ts') || p.includes('.py') || p.includes('.md')) patternSignals.specific_file_refs++;
                if (p.includes('背景') || p.includes('context') || p.includes('当前') || p.includes('现有') || p.includes('because')) patternSignals.context_provision++;
                if (p.length > 50) patternSignals.clear_goal++;
                if (p.includes('例如') || p.includes('example') || p.includes('比如') || p.includes('e.g.')) patternSignals.examples_given++;
            }
            const activePatterns = Object.entries(patternSignals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
            const patternLabels = {
                explicit_constraints: '明确约束条件',
                step_by_step: '分步骤描述',
                context_provision: '提供上下文背景',
                specific_file_refs: '指定具体文件',
                clear_goal: '详细目标描述',
                examples_given: '提供示例',
            };
            if (activePatterns.length > 0) {
                parts.push('<p style="color:var(--fg3);font-size:0.85em;margin-bottom:8px">常见高效模式：</p><ul class="pe-pattern-list">');
                for (const [pk, pv] of activePatterns) {
                    parts.push(`<li>${he(patternLabels[pk] || pk)} — 出现 ${pv} 次</li>`);
                }
                parts.push('</ul>');
            }
            for (const ep of effectivePrompts.slice(0, 10)) {
                const truncPrompt = ep.prompt.length > 300 ? ep.prompt.substring(0, 300) + '…' : ep.prompt;
                parts.push(`<div class="pe-prompt-card">
  <div class="pe-prompt-text">&ldquo;${he(truncPrompt)}&rdquo;</div>
  <div class="pe-badges">
    <span class="pe-badge pe-badge-green">${he(ep.outcome)}</span>
    <span class="pe-badge pe-badge-green">${he(ep.satisfaction)}</span>
    ${ep.goals ? '<span class="pe-badge pe-badge-yellow">' + he(ep.goals) + '</span>' : ''}
  </div>
</div>`);
            }
            if (effectivePrompts.length > 10) {
                parts.push(`<p style="color:var(--fg2);font-size:0.8em;margin-top:6px">还有 ${effectivePrompts.length - 10} 个高效 prompt 未显示</p>`);
            }
        } else {
            parts.push('<p style="color:var(--fg2)">无符合条件的高效 prompt 数据</p>');
        }
        parts.push('</div>');

        // Sub-section b: 低效 Prompt 模式
        parts.push('<div class="pe-section-red"><h3>&#x26A0; 低效 Prompt 模式</h3>');
        if (ineffectivePrompts.length > 0) {
            // Identify missing elements
            const missingSignals = {
                vague_goal: 0,
                missing_context: 0,
                too_short: 0,
                no_constraints: 0,
                no_file_refs: 0,
            };
            for (const ip of ineffectivePrompts) {
                const p = ip.prompt.toLowerCase();
                if (ip.prompt.length < 30) missingSignals.too_short++;
                if (!p.includes('文件') && !p.includes('file') && !p.includes('.js') && !p.includes('.ts') && !p.includes('.py')) missingSignals.no_file_refs++;
                if (!p.includes('背景') && !p.includes('context') && !p.includes('当前') && !p.includes('现有') && !p.includes('because')) missingSignals.missing_context++;
                if (!p.includes('不要') && !p.includes('不得') && !p.includes('constraint') && !p.includes('限制') && !p.includes('must')) missingSignals.no_constraints++;
                if (ip.prompt.length < 60) missingSignals.vague_goal++;
            }
            const activeMissing = Object.entries(missingSignals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
            const missingLabels = {
                vague_goal: '目标模糊 / 描述过简',
                missing_context: '缺少上下文背景',
                too_short: 'Prompt 过短',
                no_constraints: '缺少约束条件',
                no_file_refs: '未指定文件',
            };
            if (activeMissing.length > 0) {
                parts.push('<p style="color:var(--fg3);font-size:0.85em;margin-bottom:8px">常见缺失要素：</p><ul class="pe-pattern-list">');
                for (const [mk, mv] of activeMissing) {
                    parts.push(`<li>${he(missingLabels[mk] || mk)} — 出现 ${mv} 次</li>`);
                }
                parts.push('</ul>');
            }
            for (const ip of ineffectivePrompts.slice(0, 10)) {
                const truncPrompt = ip.prompt.length > 300 ? ip.prompt.substring(0, 300) + '…' : ip.prompt;
                parts.push(`<div class="pe-prompt-card">
  <div class="pe-prompt-text">&ldquo;${he(truncPrompt)}&rdquo;</div>
  <div class="pe-badges">
    <span class="pe-badge pe-badge-red">${he(ip.outcome || 'unknown')}</span>
    ${ip.satisfaction ? '<span class="pe-badge pe-badge-red">' + he(ip.satisfaction) + '</span>' : ''}
    <span class="pe-badge pe-badge-yellow">摩擦: ${ip.friction}</span>
    ${ip.goals ? '<span class="pe-badge pe-badge-yellow">' + he(ip.goals) + '</span>' : ''}
  </div>
</div>`);
            }
            if (ineffectivePrompts.length > 10) {
                parts.push(`<p style="color:var(--fg2);font-size:0.8em;margin-top:6px">还有 ${ineffectivePrompts.length - 10} 个低效 prompt 未显示</p>`);
            }
        } else {
            parts.push('<p style="color:var(--fg2)">无符合条件的低效 prompt 数据</p>');
        }
        parts.push('</div>');

        // Sub-section c: 建议固化到 CLAUDE.md / Skills / Agents
        parts.push('<div class="pe-section-blue"><h3>&#x1F4CC; 建议固化到 CLAUDE.md / Skills / Agents</h3>');
        if (allInstructions.length > 0) {
            // Group by theme using keyword matching
            const themes = {};
            const themeKeywords = {
                code_style: ['格式', '风格', 'style', 'format', 'indent', '缩进', 'naming', '命名', 'lint'],
                error_handling: ['错误', 'error', 'exception', '异常', 'catch', 'try', 'validation', '校验'],
                testing: ['测试', 'test', 'spec', 'assert', 'coverage', '覆盖'],
                architecture: ['架构', 'architecture', '模式', 'pattern', '设计', 'design', '抽象', 'abstract'],
                workflow: ['流程', 'workflow', '步骤', 'step', '先', '后', '然后', 'before', 'after'],
                output_format: ['输出', 'output', '格式', '返回', 'return', 'response', '回复'],
                language_preference: ['中文', '英文', 'chinese', 'english', '语言', 'language'],
                tool_usage: ['工具', 'tool', '终端', 'terminal', '命令', 'command', '浏览器', 'browser'],
                general: [],
            };
            for (const inst of allInstructions) {
                const lower = inst.text.toLowerCase();
                let matched = false;
                for (const [theme, keywords] of Object.entries(themeKeywords)) {
                    if (theme === 'general') continue;
                    for (const kw of keywords) {
                        if (lower.includes(kw)) {
                            if (!themes[theme]) themes[theme] = [];
                            themes[theme].push(inst);
                            matched = true;
                            break;
                        }
                    }
                    if (matched) break;
                }
                if (!matched) {
                    if (!themes['general']) themes['general'] = [];
                    themes['general'].push(inst);
                }
            }
            const themeLabels = {
                code_style: '代码风格', error_handling: '错误处理', testing: '测试策略',
                architecture: '架构设计', workflow: '工作流程', output_format: '输出格式',
                language_preference: '语言偏好', tool_usage: '工具使用', general: '通用偏好',
            };

            for (const [theme, insts] of Object.entries(themes)) {
                if (!insts || insts.length === 0) continue;
                // Determine suggestion type
                let suggestedType, typeLabel, typeCss;
                if (theme === 'workflow' && insts.length >= 3) {
                    suggestedType = 'Agent';
                    typeLabel = 'Agent';
                    typeCss = 'pe-type-agent';
                } else if ((theme === 'testing' || theme === 'architecture' || theme === 'error_handling') && insts.length >= 2) {
                    suggestedType = 'Skill';
                    typeLabel = 'Skill';
                    typeCss = 'pe-type-skill';
                } else {
                    suggestedType = 'CLAUDE.md';
                    typeLabel = 'CLAUDE.md';
                    typeCss = 'pe-type-claude';
                }
                parts.push(`<div class="pe-suggestion-card">
  <span class="pe-type-badge ${typeCss}">${he(typeLabel)}</span>
  <span style="font-weight:600;color:var(--fg);margin-left:8px">${he(themeLabels[theme] || theme)}</span>
  <div class="pe-content" style="margin-top:8px"><ul class="pe-pattern-list">`);
                // Deduplicate instructions
                const seen = new Set();
                for (const inst of insts) {
                    const key = inst.text.substring(0, 100);
                    if (seen.has(key)) continue;
                    seen.add(key);
                    const truncText = inst.text.length > 200 ? inst.text.substring(0, 200) + '…' : inst.text;
                    parts.push(`<li>${he(truncText)}</li>`);
                }
                parts.push('</ul></div></div>');
            }
        } else {
            parts.push('<p style="color:var(--fg2)">无用户明确指令数据</p>');
        }
        parts.push('</div>');

        parts.push('</div>');
    }

    // ── Section: Session 详情列表 ─────────────────────
    if (sessions.length > 0) {
        const outcomeInfo = {
            fully_achieved:     { label: '完全达成', css: 'ob-fully' },
            mostly_achieved:    { label: '大部分达成', css: 'ob-mostly' },
            partially_achieved: { label: '部分达成', css: 'ob-partial' },
            barely_started:     { label: '刚刚开始', css: 'ob-barely' },
            abandoned:          { label: '放弃', css: 'ob-abandoned' },
        };
        const satIcons = {
            highly_satisfied: '&#x1F929;', impressed: '&#x1F60D;',
            satisfied: '&#x1F60A;', neutral: '&#x1F610;',
            slightly_frustrated: '&#x1F615;', frustrated: '&#x1F624;',
            very_frustrated: '&#x1F621;', confused: '&#x1F635;',
        };

        parts.push(`<div class="section" id="sec-sessions">
<h2><span class="icon">&#x1F4CB;</span> Session 详情列表</h2>
<div class="collapse-toggle" onclick="toggleCollapse(this)">
  <span>展开 / 收起 (${sessions.length} sessions)</span>
  <span class="arrow">&#x25B6;</span>
</div>
<div class="collapse-content sl-content">
<div class="sl-wrap"><table class="sl-table" id="slTable">
<thead><tr>
  <th onclick="slSort(0)">Session <span class="sort-ind">&#x25B2;&#x25BC;</span></th>
  <th onclick="slSort(1)">Workspace <span class="sort-ind">&#x25B2;&#x25BC;</span></th>
  <th onclick="slSort(2)">开始时间 <span class="sort-ind">&#x25B2;&#x25BC;</span></th>
  <th onclick="slSort(3)">时长 <span class="sort-ind">&#x25B2;&#x25BC;</span></th>
  <th onclick="slSort(4)">消息 <span class="sort-ind">&#x25B2;&#x25BC;</span></th>
  <th onclick="slSort(5)">工具调用 <span class="sort-ind">&#x25B2;&#x25BC;</span></th>
  <th>概要</th>
  <th onclick="slSort(7)">成果 <span class="sort-ind">&#x25B2;&#x25BC;</span></th>
  <th onclick="slSort(8)">满意度 <span class="sort-ind">&#x25B2;&#x25BC;</span></th>
</tr></thead>
<tbody>
`);
        const sortedSessions = [...sessions].sort((a, b) => (b.startTime || '').localeCompare(a.startTime || ''));

        for (let si = 0; si < sortedSessions.length; si++) {
            const s = sortedSessions[si];
            const sid8 = (s.sessionId || '').substring(0, 8);
            const fc = facetsMap[s.sessionId] || {};

            let sTotalTools = 0;
            if (s.toolCounts) {
                for (const v of Object.values(s.toolCounts)) sTotalTools += Number(v) || 0;
            }

            const summary = s.firstPrompt
                ? (s.firstPrompt.length > 80 ? s.firstPrompt.substring(0, 80) + '…' : s.firstPrompt)
                : '—';

            const outcomeKey = fc.outcome ? String(fc.outcome) : '';
            const oi = outcomeInfo[outcomeKey] || { label: outcomeKey || '—', css: 'ob-unknown' };

            const satRaw = fc.userSatisfaction;
            const satKey = satRaw ? (satRaw.overall ? String(satRaw.overall) : String(satRaw)) : '';
            const satIcon = satIcons[satKey] || (satKey ? he(satKey) : '—');

            const totalMsgsS = (s.userMessageCount || 0) + (s.assistantMessageCount || 0);

            parts.push(`<tr class="sl-row" onclick="slToggle(${si})" data-sort-0="${he(sid8)}" data-sort-1="${he(s.workspaceName || '')}" data-sort-2="${he(s.startTime || '')}" data-sort-3="${s.durationMinutes || 0}" data-sort-4="${totalMsgsS}" data-sort-5="${sTotalTools}" data-sort-7="${he(outcomeKey)}" data-sort-8="${he(satKey)}">
  <td title="${he(s.sessionId || '')}">${he(sid8)}</td>
  <td>${he(s.workspaceName || '—')}</td>
  <td>${he(s.startTime || '—')}</td>
  <td>${s.durationMinutes || 0} min</td>
  <td>${totalMsgsS}</td>
  <td>${sTotalTools}</td>
  <td title="${he(s.firstPrompt || '')}">${he(summary)}</td>
  <td><span class="outcome-badge ${oi.css}">${he(oi.label)}</span></td>
  <td>${satIcon}</td>
</tr>`);

            // Detail row
            let goalHtml = '—';
            if (fc.goalCategories) {
                if (typeof fc.goalCategories === 'object' && !Array.isArray(fc.goalCategories)) {
                    const items = Object.entries(fc.goalCategories)
                        .sort((a, b) => Number(b[1]) - Number(a[1]))
                        .map(([k, v]) => `<li>${he(k)}: ${v}</li>`).join('');
                    goalHtml = `<ul>${items}</ul>`;
                } else if (Array.isArray(fc.goalCategories)) {
                    const items = fc.goalCategories.map(c => `<li>${he(String(c))}</li>`).join('');
                    goalHtml = `<ul>${items}</ul>`;
                }
            }

            let frictionHtml = '—';
            if (fc.frictionCounts && typeof fc.frictionCounts === 'object') {
                const fe = Object.entries(fc.frictionCounts)
                    .filter(([, v]) => Number(v) > 0)
                    .sort((a, b) => Number(b[1]) - Number(a[1]));
                if (fe.length > 0) {
                    frictionHtml = `<ul>${fe.map(([k, v]) => `<li>${he(k)}: ${v}</li>`).join('')}</ul>`;
                }
            }

            let emotionHtml = '—';
            if (fc.emotionEscalation && Array.isArray(fc.emotionEscalation) && fc.emotionEscalation.length > 0) {
                emotionHtml = fc.emotionEscalation.slice(0, 3)
                    .map(q => `<p style="font-style:italic">&ldquo;${he(String(q))}&rdquo;</p>`).join('');
            }

            const promptHtml = s.firstPrompt ? he(s.firstPrompt) : '—';

            // Turn visualization
            let turnHtml = '';
            if (hasTurnData) {
                const turnSummary = turnDataMap[s.sessionId];
                if (turnSummary && turnSummary.turnSummaries && turnSummary.turnSummaries.length > 0) {
                    const tss = turnSummary.turnSummaries;
                    const totalDur = tss.reduce((sum, t) => sum + (t.durSec || 1), 0) || 1;
                    turnHtml += '<div style="margin-bottom:16px">';
                    turnHtml += `<h4 style="color:var(--accent2);font-size:0.9em;margin-bottom:8px">对话回合 (${turnSummary.totalTurns} turns)</h4>`;
                    turnHtml += '<div style="display:flex;gap:2px;height:32px;margin-bottom:8px;overflow:hidden;border-radius:4px">';
                    for (const t of tss) {
                        const durPct = Math.max(0.5, ((t.durSec || 1) / totalDur) * 100);
                        let tColor = '#334155';
                        if (t.userMessage) tColor = '#22c55e';
                        if (t.askQuestions && t.askQuestions.length > 0) tColor = '#60a5fa';
                        if (t.subagents && t.subagents.length > 0) tColor = '#8b5cf6';
                        const tTitle = he('T' + t.turnId + ': ' + ((t.userMessage || t.aiResponse || '').substring(0, 60)));
                        turnHtml += `<div style="flex:${durPct.toFixed(1)};min-width:4px;background:${tColor};cursor:default" title="${tTitle}"></div>`;
                    }
                    turnHtml += '</div>';
                    turnHtml += '<div style="display:flex;gap:16px;font-size:0.7em;color:var(--fg2);margin-bottom:12px">';
                    turnHtml += '<span>&#x1F7E2; 用户消息</span><span>&#x1F535; AI 提问</span><span>&#x1F7E3; 子代理</span><span>&#x26AA; 其他</span>';
                    turnHtml += '</div>';
                    const sQAs = [];
                    for (const t of tss) {
                        if (t.askQuestions) {
                            for (const aq of t.askQuestions) {
                                const aKeys = Object.keys(aq.answers || {});
                                for (let qi = 0; qi < aq.questions.length; qi++) {
                                    const hdr = aKeys[qi];
                                    const a = hdr ? aq.answers[hdr] : null;
                                    const aStr = a ? ((a.selected || []).join(', ') + (a.freeText ? ' — ' + a.freeText : '')) : '(跳过)';
                                    sQAs.push({ q: aq.questions[qi], a: aStr });
                                }
                            }
                        }
                    }
                    if (sQAs.length > 0) {
                        turnHtml += `<details><summary style="cursor:pointer;color:#93c5fd;font-size:0.85em">&#x1F4AC; AI 提问交互 (${sQAs.length})</summary><div style="margin-top:8px">`;
                        for (const qa of sQAs) {
                            const qStr = qa.q.length > 200 ? qa.q.substring(0, 200) + '…' : qa.q;
                            turnHtml += '<div style="background:var(--bg);padding:8px 12px;border-radius:6px;margin-bottom:6px;border-left:2px solid #3b82f6">';
                            turnHtml += `<div style="color:#93c5fd;font-size:0.85em">Q: ${he(qStr)}</div>`;
                            turnHtml += `<div style="color:#86efac;font-size:0.85em">A: ${he(qa.a)}</div>`;
                            turnHtml += '</div>';
                        }
                        turnHtml += '</div></details>';
                    }
                    turnHtml += '</div>';
                }
            }

            parts.push(`<tr class="sl-detail" id="slDetail${si}">
  <td colspan="9">
    ${turnHtml}
    <div class="sl-detail-grid">
      <div class="sl-detail-block"><h4>&#x1F4AC; First Prompt</h4><p class="sl-prompt">${promptHtml}</p></div>
      <div class="sl-detail-block"><h4>&#x1F3AF; 目标分类</h4>${goalHtml}</div>
      <div class="sl-detail-block"><h4>&#x26A1; 摩擦事件</h4>${frictionHtml}</div>
      <div class="sl-detail-block"><h4>&#x1F4A2; 情绪引用</h4>${emotionHtml}</div>
    </div>
  </td>
</tr>`);
        }

        parts.push('</tbody></table></div></div></div>');
    }

    // ── Facet 兜底：没有渲染出内容的 facet 仍需在下拉框里可选，────
    // ── 选中后显示"暂无数据"提示，而不是让筛选后的页面一片空白 ──
    for (const f of FACET_DEFS) {
        const marker = `id="sec-${f.id}"`;
        const rendered = parts.some(p => typeof p === 'string' && p.indexOf(marker) !== -1);
        if (!rendered) {
            parts.push(`<div class="section facet-empty" id="sec-${f.id}" style="display:none">
  <h2><span class="icon">${f.emoji}</span> ${he(f.label)}</h2>
  <p class="facet-empty-msg">暂无数据。</p>
</div>
`);
        }
    }

    // ── Footer ────────────────────────────────────────
    const dataFileName = path.basename(args.dataPath);
    parts.push(`<div class="footer">
  <p>数据来源: ${he(dataFileName)} &nbsp;&bull;&nbsp; 扫描 ${meta.totalFiles} 个文件 &nbsp;&bull;&nbsp; 耗时 ${meta.scanDurationMs} ms</p>
  <p>生成命令: <code>node generate-insight-report.js --data-path ${he(dataFileName)}</code></p>
  <p>Parking Agents Insight Toolkit &nbsp;&bull;&nbsp; ${now}</p>
</div>

<script>
function toggleNav() {
  var nav = document.getElementById('navToc');
  nav.classList.toggle('open');
}
// ── Facet 筛选 ──────────────────────────────────────
var FACET_IDS = ${JSON.stringify(FACET_DEFS.map(f => f.id))};
function applyFacetFilter(val) {
  FACET_IDS.forEach(function(id) {
    var el = document.getElementById('sec-' + id);
    if (!el) return;
    el.style.display = (val === 'all' || id === val) ? '' : 'none';
  });
  var sel = document.getElementById('facetSelect');
  if (sel && sel.value !== val) sel.value = val;
  try { localStorage.setItem('insightFacetFilter', val); } catch (e) { /* ignore */ }
}
function jumpToFacet(id) {
  // 从侧边导航跳转到某个 facet 时，先把筛选框切到该 facet，
  // 避免该板块被当前筛选状态隐藏导致锚点跳转后仍然看不到内容。
  applyFacetFilter(id);
}
document.addEventListener('DOMContentLoaded', function() {
  var sel = document.getElementById('facetSelect');
  if (!sel) return;
  var saved = 'all';
  try { saved = localStorage.getItem('insightFacetFilter') || 'all'; } catch (e) { /* ignore */ }
  if (saved !== 'all' && !sel.querySelector('option[value="' + saved + '"]')) saved = 'all';
  sel.value = saved;
  applyFacetFilter(saved);
});
function copyCode(btn, id) {
  var el = document.getElementById(id);
  if (!el) return;
  var text = el.textContent || el.innerText;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() {
      btn.textContent = '\\u2713 Copied';
      btn.classList.add('copied');
      setTimeout(function() { btn.innerHTML = '&#x1F4CB; Copy'; btn.classList.remove('copied'); }, 1500);
    });
  } else {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    btn.textContent = '\\u2713 Copied';
    btn.classList.add('copied');
    setTimeout(function() { btn.innerHTML = '&#x1F4CB; Copy'; btn.classList.remove('copied'); }, 1500);
  }
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
function slToggle(idx) {
  var el = document.getElementById('slDetail' + idx);
  if (el) el.classList.toggle('open');
}
var slSortDir = {};
function slSort(col) {
  var table = document.getElementById('slTable');
  if (!table) return;
  var tbody = table.querySelector('tbody');
  var children = Array.from(tbody.children);
  var rows = [];
  for (var i = 0; i < children.length; i += 2) {
    rows.push({ main: children[i], detail: children[i + 1] });
  }
  var dir = slSortDir[col] === 'asc' ? 'desc' : 'asc';
  slSortDir[col] = dir;
  rows.sort(function(a, b) {
    var va = a.main.getAttribute('data-sort-' + col) || '';
    var vb = b.main.getAttribute('data-sort-' + col) || '';
    var na = parseFloat(va), nb = parseFloat(vb);
    if (!isNaN(na) && !isNaN(nb)) { return dir === 'asc' ? na - nb : nb - na; }
    return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });
  for (var j = 0; j < rows.length; j++) {
    tbody.appendChild(rows[j].main);
    tbody.appendChild(rows[j].detail);
  }
}
</script>
</body>
</html>
`);

    // ── 写出 ──────────────────────────────────────────
    const html = parts.join('\n');
    const parentDir = path.dirname(outputPath);
    if (parentDir && !fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, html, 'utf-8');

    const sizeKB = (Buffer.byteLength(html, 'utf-8') / 1024).toFixed(1);
    console.log(`[done] HTML 报告已生成: ${outputPath} (${sizeKB} KB)`);
}

main();
