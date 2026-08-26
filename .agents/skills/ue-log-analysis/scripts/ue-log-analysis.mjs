#!/usr/bin/env node
// ue-log-analysis.mjs — UE 运行日志结构化体检：帧号/空窗/错误/噪声/时间线
// 口径与取舍见 ../references/design.md。零 npm 依赖，Node >= 18。

import { readFileSync } from 'node:fs';
import { argv, exit } from 'node:process';

const USAGE = `用法: node ue-log-analysis.mjs <command> <logfile> [options]

命令:
  frames    帧号体检: 帧 0 占比、最大帧、帧停滞段、FPS 分桶与骤降
  gaps      时间空窗: 相邻行间隔超阈值的静默段, 附前后上下文
  errors    错误频次: 按 log-error-summary 口径归并, 次数降序
  noise     噪声聚类: 归一后重复 >= N 次的行模式(刷屏定位)
  timeline  时间线: 里程碑(启动/LoadMap/首帧/退出形态) + 空窗标注
  summary   一键体检: 全部子命令拼成 markdown 报告

选项:
  --json          机器可读输出(默认人读表格)
  --min-ms <n>    gaps 空窗阈值毫秒(默认 3000)
  --min-count <n> noise 聚类最小次数(默认 10)
  --context <n>   gaps 前后上下文行数(默认 3)

退出码: 0=正常(含"未发现问题") 2=参数/文件错误`;

// ---------- 解析 ----------

const LINE_RE =
  /^\[(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2}):(\d{3})\]\[\s*(\d+)\]\s?(.*)$/;

/** 解析整个日志为数组; 无前缀行 time/frame 沿用上一带前缀行(挂靠), mark 标记 */
function parseLines(text) {
  const out = [];
  let prevT = null;
  let carryT = null;
  let carryF = null;
  const rawLines = text.split(/\r?\n/);
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    if (raw === '') continue;
    const m = LINE_RE.exec(raw);
    if (m) {
      const [, , , , h, mi, s, ms, frame, body] = m;
      let t =
        Number(h) * 3600000 + Number(mi) * 60000 + Number(s) * 1000 + Number(ms);
      if (prevT !== null && t < prevT) t += 86400000; // 跨天顺延
      prevT = t;
      carryT = t;
      carryF = Number(frame);
      out.push({
        line: i + 1, timeMs: t, frame: carryF, body, raw,
        tsText: `${h}:${mi}:${s}.${ms}`, prefixed: true,
      });
    } else {
      out.push({
        line: i + 1, timeMs: carryT, frame: carryF, body: raw, raw,
        tsText: carryT === null ? '-' : '', prefixed: false,
      });
    }
  }
  return out;
}

// ---------- 归一(错误签名/噪声口径) ----------

/** log-error-summary 同口径: 数字→N, 引号串→str, 取前 80 字符 */
function errorSignature(line) {
  const sig = line
    .replace(/"[^"]*"/g, 'str')
    .replace(/'[^']*'/g, 'str')
    .replace(/\d+/g, 'N');
  return sig.length > 80 ? sig.slice(0, 80) : sig;
}

/** 噪声归一: 数字→N, 引号串→str, 压空白, 取前 100 字符 */
function noiseSignature(s) {
  const sig = s
    .replace(/"[^"]*"/g, 'str')
    .replace(/'[^']*'/g, 'str')
    .replace(/\d+/g, 'N')
    .replace(/\s+/g, ' ')
    .trim();
  return sig.length > 100 ? sig.slice(0, 100) : sig;
}

function fmtMs(ms) {
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function pct(n, d) {
  return d === 0 ? '0%' : `${((n / d) * 100).toFixed(1)}%`;
}

function trimLine(e) {
  const s = (e.raw || '').slice(0, 160);
  return s + ((e.raw || '').length > 160 ? '…' : '');
}

// ---------- frames ----------

function cmdFrames(lines, asJson) {
  const parsed = lines.filter((e) => e.prefixed);
  const framed = parsed.filter((e) => e.frame > 0);
  const frame0 = parsed.length - framed.length;
  const maxFrame = parsed.reduce((a, e) => Math.max(a, e.frame), 0);

  // 帧停滞段: 相邻带前缀行时间走 >=2000ms 且帧号不变
  const stalls = [];
  for (let i = 1; i < parsed.length; i++) {
    const a = parsed[i - 1];
    const b = parsed[i];
    if (b.frame === a.frame && b.timeMs - a.timeMs >= 2000) {
      const last = stalls[stalls.length - 1];
      if (last && last.end === a) {
        last.end = b;
        last.durMs = b.timeMs - last.start;
      } else {
        stalls.push({ start: a, end: b, frame: a.frame, durMs: b.timeMs - a.timeMs });
      }
    }
  }

  // FPS 分桶(2s/桶), 只统计帧号递增区间
  const buckets = [];
  let cur = null;
  for (const e of parsed) {
    if (!cur || e.timeMs - cur.start >= 2000 || e.frame < cur.lastFrame) {
      if (cur && cur.end - cur.start > 500) buckets.push(cur);
      cur = { start: e.timeMs, end: e.timeMs, firstFrame: e.frame, lastFrame: e.frame };
    } else {
      cur.end = e.timeMs;
      cur.lastFrame = e.frame;
    }
  }
  if (cur && cur.end - cur.start > 500) buckets.push(cur);
  for (const b of buckets) {
    b.fps = b.end === b.start ? null : ((b.lastFrame - b.firstFrame) * 1000) / (b.end - b.start);
  }

  // 骤降: 前期基准(前 5 个有效桶中位 fps)的 40% 以下, 且后续 2s 未恢复
  const valid = buckets.filter((b) => b.fps !== null && b.fps > 0);
  const baseline = median(valid.slice(0, 5).map((b) => b.fps));
  const drops = [];
  for (let i = 0; i < valid.length; i++) {
    if (baseline && valid[i].fps < baseline * 0.4) {
      const j = drops[drops.length - 1];
      if (j && j.endIdx === i - 1) {
        j.endIdx = i;
        j.end = valid[i].end;
      } else {
        drops.push({ start: valid[i].start, end: valid[i].end, fps: valid[i].fps, endIdx: i });
      }
    }
  }

  // 判活: 日志最后 10% 时段内帧号仍在增长
  const lastT = parsed.length ? parsed[parsed.length - 1].timeMs : 0;
  const tailStart = lastT - Math.max((lastT - (parsed[0]?.timeMs ?? 0)) * 0.1, 1000);
  const tail = parsed.filter((e) => e.timeMs >= tailStart);
  const tailGrew =
    tail.length >= 2 && tail[tail.length - 1].frame > tail[0].frame;

  const verdict = maxFrame === 0
    ? '游戏线程从未出帧(全程帧 0)——卡在启动/同步加载阶段'
    : tailGrew
      ? `存活: 帧号增长至日志结束(最大帧 ${maxFrame})`
      : `帧号停止增长(最大帧 ${maxFrame}, 最后增长于 ${fmtMs(lastT)})——疑似中途卡死`;

  const data = {
    totalLines: lines.length,
    parsedLines: parsed.length,
    frame0Lines: frame0,
    frame0Pct: pct(frame0, parsed.length),
    maxFrame,
    alive: tailGrew,
    verdict,
    stalls: stalls.map((s) => ({
      from: fmtMs(s.start.timeMs), to: fmtMs(s.end.timeMs),
      durMs: s.durMs, frame: s.frame,
    })),
    fpsBuckets: buckets.map((b) => ({
      at: fmtMs(b.start), fps: b.fps === null ? null : Number(b.fps.toFixed(1)),
      fromFrame: b.firstFrame, toFrame: b.lastFrame,
    })),
    fpsDrops: drops.map((d) => ({
      from: fmtMs(d.start), to: fmtMs(d.end), fps: Number(d.fps.toFixed(1)),
      baseline: Number(baseline.toFixed(1)),
    })),
  };
  if (asJson) return data;

  const L = [];
  L.push('# 帧号体检');
  L.push(`- 总行数 ${data.totalLines}(带前缀 ${data.parsedLines})`);
  L.push(`- 帧 0 行数: ${frame0}(${data.frame0Pct})  最大帧号: ${maxFrame}`);
  L.push(`- 判定: ${verdict}`);
  if (data.stalls.length) {
    L.push('- 帧停滞段(时间走/帧号不走 >=2s):');
    for (const s of data.stalls) L.push(`    ${s.from} → ${s.to}(${(s.durMs / 1000).toFixed(1)}s) 帧号恒 ${s.frame}`);
  }
  if (data.fpsBuckets.length) {
    L.push('- FPS 分桶(2s): ' + data.fpsBuckets.map((b) => `${b.at}=${b.fps ?? '-'}`).join('  '));
  }
  if (data.fpsDrops.length) {
    L.push(`- FPS 骤降(基准 ${data.fpsDrops[0].baseline} 的 40% 以下):`);
    for (const d of data.fpsDrops) L.push(`    ${d.from} → ${d.to} 跌至 ${d.fps} fps`);
  }
  return L.join('\n');
}

function median(arr) {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)];
}

// ---------- gaps ----------

function findGaps(lines, minMs) {
  const parsed = lines.filter((e) => e.prefixed);
  const gaps = [];
  for (let i = 1; i < parsed.length; i++) {
    const dt = parsed[i].timeMs - parsed[i - 1].timeMs;
    if (dt >= minMs) {
      gaps.push({ before: parsed[i - 1], after: parsed[i], durMs: dt });
    }
  }
  return gaps;
}

function cmdGaps(lines, asJson, opts) {
  const gaps = findGaps(lines, opts.minMs);
  const data = {
    minMs: opts.minMs,
    count: gaps.length,
    gaps: gaps.map((g) => ({
      from: fmtMs(g.before.timeMs), to: fmtMs(g.after.timeMs),
      durMs: g.durMs,
      before: ctxLines(lines, g.before, opts.context, -1),
      after: ctxLines(lines, g.after, opts.context, +1),
    })),
  };
  if (asJson) return data;
  if (!gaps.length) return `# 时间空窗\n- 未发现 >= ${opts.minMs}ms 的静默段`;
  const L = [`# 时间空窗(>= ${opts.minMs}ms, 共 ${gaps.length} 处)`];
  for (const g of data.gaps) {
    L.push(`\n## ${g.from} → ${g.to}(${(g.durMs / 1000).toFixed(1)}s)`);
    L.push('  前:');
    for (const c of g.before) L.push(`    ${c}`);
    L.push('  后:');
    for (const c of g.after) L.push(`    ${c}`);
  }
  return L.join('\n');
}

/** 取某行前/后 n 条带摘要的上下文(含无前缀行, 按行号邻居) */
function ctxLines(lines, anchor, n, dir) {
  const out = [];
  let idx = lines.indexOf(anchor);
  for (let k = 0; k < n && idx >= 0 && idx < lines.length; k++) {
    out.push(`L${lines[idx].line} ${trimLine(lines[idx])}`);
    idx += dir;
  }
  return out;
}

// ---------- errors ----------

function cmdErrors(lines, asJson) {
  const groups = new Map();
  for (const e of lines) {
    if (!/error/i.test(e.raw)) continue;
    const sig = errorSignature(e.raw);
    const g = groups.get(sig) || {
      count: 0, first: e, last: e, sample: trimLine(e),
    };
    g.count++;
    g.last = e;
    groups.set(sig, g);
  }
  const rows = [...groups.values()].sort((a, b) => b.count - a.count);
  const data = {
    totalErrorLines: rows.reduce((a, r) => a + r.count, 0),
    distinctPatterns: rows.length,
    rows: rows.map((r) => ({
      count: r.count, sample: r.sample,
      first: { at: fmtMs(r.first.timeMs ?? 0), line: r.first.line, frame: r.first.frame },
      last: { at: fmtMs(r.last.timeMs ?? 0), line: r.last.line, frame: r.last.frame },
    })),
  };
  if (asJson) return data;
  if (!rows.length) return '# 错误频次\n- 未发现含 error 字样的行';
  const L = [`# 错误频次(共 ${data.totalErrorLines} 行, ${rows.length} 类, 按次数降序)`, '',
    '| 次数 | 首次 | 末次 | 样例 |', '| --- | --- | --- | --- |'];
  for (const r of data.rows) {
    L.push(`| ${r.count} | ${r.first.at} (L${r.first.line}) | ${r.last.at} (L${r.last.line}) | ${r.sample.replace(/\|/g, '\\|')} |`);
  }
  return L.join('\n');
}

// ---------- noise ----------

function cmdNoise(lines, asJson, opts) {
  const groups = new Map();
  for (const e of lines) {
    const sig = noiseSignature(e.body);
    const g = groups.get(sig) || { count: 0, first: e };
    g.count++;
    groups.set(sig, g);
  }
  const rows = [...groups.entries()]
    .filter(([, g]) => g.count >= opts.minCount)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20);
  const data = {
    minCount: opts.minCount,
    patterns: rows.map(([sig, g]) => ({
      count: g.count, firstAt: fmtMs(g.first.timeMs ?? 0), signature: sig,
    })),
  };
  if (asJson) return data;
  if (!rows.length) return `# 噪声聚类\n- 未发现重复 >= ${opts.minCount} 次的行模式`;
  const L = [`# 噪声聚类(重复 >= ${opts.minCount} 次, top ${rows.length})`, '',
    '| 次数 | 首现 | 归一签名 |', '| --- | --- | --- |'];
  for (const r of data.patterns) {
    L.push(`| ${r.count} | ${r.firstAt} | ${r.signature.replace(/\|/g, '\\|')} |`);
  }
  return L.join('\n');
}

// ---------- timeline ----------

const MILESTONES = [
  { re: /LogInit: Display: Starting Game/i, label: '启动游戏' },
  { re: /LogLoad: LoadMap:/i, label: 'LoadMap' },
  { re: /UEngine::Browse Started Browse/i, label: 'Browse' },
  { re: /RequestLevel\(([^)]+)\)/i, label: '关卡流送', capture: true },
  { re: /LogWorld: BeginTearingDown/i, label: '世界拆除' },
  { re: /LogExit: Exiting/i, label: '正常退出' },
  { re: /Fatal error|Critical error|Unhandled Exception|=== Critical error ===/i, label: '致命错误' },
  { re: /Device removed|DXGI_ERROR_DEVICE|GPU hang|D3D12.*device.*removed/i, label: 'GPU 设备异常' },
  { re: /KeepAlive|heartbeat/i, label: '心跳' },
  { re: /Waited for PSO creation/i, label: 'PSO 等待' },
];

function cmdTimeline(lines, asJson, opts) {
  const events = [];
  const counters = new Map();
  for (const e of lines.filter((x) => x.prefixed)) {
    for (const m of MILESTONES) {
      if (m.re.test(e.raw)) {
        const detail = m.capture ? (m.re.exec(e.raw)?.[1] ?? '') : '';
        events.push({ at: fmtMs(e.timeMs), label: m.label, detail, line: e.line, frame: e.frame });
        const key = m.label;
        if (!counters.has(key)) counters.set(key, { label: key, count: 0, first: e, last: e, re: m.re });
        const c = counters.get(key);
        c.count++;
        c.last = e;
        break;
      }
    }
  }
  // 首帧
  const firstFrame = lines.find((e) => e.prefixed && e.frame >= 1);
  if (firstFrame) {
    events.push({ at: fmtMs(firstFrame.timeMs), label: '首帧', detail: '', line: firstFrame.line, frame: firstFrame.frame });
  }
  events.sort((a, b) => (a.at < b.at ? -1 : 1));

  // 终止形态: 尾部 5 行内有无退出/崩溃标记
  const tail = lines.slice(-5).map((e) => e.raw).join('\n');
  let ending = '戛然而止(无正常退出/崩溃记录——被杀、断电或日志拷贝截止)';
  if (/LogExit: Exiting/i.test(tail)) ending = '正常退出(LogExit)';
  else if (/Fatal error|Critical error|Unhandled Exception/i.test(tail)) ending = '崩溃终止(尾部含致命错误)';

  const heartbeat = counters.get('心跳');
  const hb = heartbeat
    ? { count: heartbeat.count, intervalMs: heartbeat.last.timeMs - heartbeat.first.timeMs, firstAt: fmtMs(heartbeat.first.timeMs), lastAt: fmtMs(heartbeat.last.timeMs) }
    : null;
  const pso = counters.get('PSO 等待');
  const gaps = findGaps(lines, opts.minMs).map((g) => ({ from: fmtMs(g.before.timeMs), durMs: g.durMs }));

  const data = {
    milestones: events,
    ending,
    heartbeat: hb,
    psoWaits: pso ? { count: pso.count, firstAt: fmtMs(pso.first.timeMs), lastAt: fmtMs(pso.last.timeMs) } : null,
    levelStreamCount: counters.get('关卡流送')?.count ?? 0,
    gaps,
  };
  if (asJson) return data;
  const L = ['# 时间线'];
  for (const e of events.slice(0, 60)) {
    L.push(`- ${e.at} [${String(e.frame).padStart(4)}] ${e.label}${e.detail ? `: ${e.detail}` : ''} (L${e.line})`);
  }
  if (data.levelStreamCount) L.push(`- 关卡流送合计 ${data.levelStreamCount} 次`);
  if (data.psoWaits) L.push(`- PSO 同步等待合计 ${data.psoWaits.count} 次(${data.psoWaits.firstAt} → ${data.psoWaits.lastAt})`);
  if (hb) L.push(`- 心跳 ${hb.count} 次(${hb.firstAt} → ${hb.lastAt}, 跨度 ${(hb.intervalMs / 1000).toFixed(0)}s)`);
  if (gaps.length) {
    L.push(`- 空窗(>= ${opts.minMs}ms): ` + gaps.map((g) => `${g.from}(+${(g.durMs / 1000).toFixed(1)}s)`).join('  '));
  }
  L.push(`- 终止形态: ${ending}`);
  return L.join('\n');
}

// ---------- summary ----------

function cmdSummary(lines, opts) {
  const parts = [
    cmdFrames(lines, false),
    '',
    cmdTimeline(lines, false, opts),
    '',
    cmdErrors(lines, false),
    '',
    cmdNoise(lines, false, opts),
    '',
    cmdGaps(lines, false, opts),
  ];
  return parts.join('\n');
}

// ---------- main ----------

function fail(msg) {
  console.error(msg);
  exit(2);
}

const args = argv.slice(2);
const command = args[0];
const file = args[1];
const opts = { json: false, minMs: 3000, minCount: 10, context: 3 };
for (let i = 2; i < args.length; i++) {
  const a = args[i];
  if (a === '--json') opts.json = true;
  else if (a === '--min-ms') opts.minMs = Number(args[++i]);
  else if (a === '--min-count') opts.minCount = Number(args[++i]);
  else if (a === '--context') opts.context = Number(args[++i]);
  else fail(`未知参数: ${a}\n${USAGE}`);
}
if (!command || !file || !/^(frames|gaps|errors|noise|timeline|summary)$/.test(command)) {
  fail(USAGE);
}

let text;
try {
  text = readFileSync(file, 'utf8');
} catch (err) {
  fail(`无法读取日志文件 ${file}: ${err.message}`);
}
const lines = parseLines(text);

let result;
switch (command) {
  case 'frames': result = cmdFrames(lines, opts.json); break;
  case 'gaps': result = cmdGaps(lines, opts.json, opts); break;
  case 'errors': result = cmdErrors(lines, opts.json); break;
  case 'noise': result = cmdNoise(lines, opts.json, opts); break;
  case 'timeline': result = cmdTimeline(lines, opts.json, opts); break;
  case 'summary': result = cmdSummary(lines, opts); break;
}

if (opts.json) console.log(JSON.stringify(result, null, 2));
else console.log(result);
exit(0);
