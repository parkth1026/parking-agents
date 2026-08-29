#!/usr/bin/env node
// ue-log-analysis.mjs — UE 运行日志结构化体检：帧号/空窗/错误/噪声/时间线
// 口径与取舍见 ../references/design.md。零 npm 依赖，Node >= 18。

import { readFileSync, readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { argv, exit } from 'node:process';

const USAGE = `用法: node ue-log-analysis.mjs <command> <logfile|dir> [options]

命令:
  frames    帧号体检: 帧 0 占比、最大帧、冻结段、FPS 骤降、回绕检测、挣扎段、逐小时判活谱
  gaps      时间空窗: 相邻行间隔超阈值的静默段, 附前后上下文
  errors    错误频次: 按 log-error-summary 口径归并, 次数降序; --kb 时标注模式库命中
  noise     噪声聚类: 归一后重复 >= N 次的行模式(刷屏定位)
  timeline  时间线: 里程碑(启动/LoadMap/首帧/退出形态) + 空窗标注
  env       环境指纹: 命令行(LogInit 或 CSV 元数据回退) + 参数/开关解析 + CSV 元数据
  inventory 目录清单: 每日志文件的打开/终态/参数 + 崩溃重试循环聚类抽样
  diff      A/B 对比: 两份日志的判活分岔 + 错误谱共享/独有事实表(归因素材)
  summary   一键体检: 全部子命令拼成 markdown 报告

选项:
  --json          机器可读输出(默认人读表格)
  --min-ms <n>    gaps 空窗阈值毫秒(默认 3000)
  --min-count <n> noise 聚类最小次数(默认 10)
  --context <n>   gaps 前后上下文行数(默认 3)
  --kb <dir>      errors 的模式库目录(patterns/): 签名精确匹配或 match 正则命中即标注

退出码: 0=正常(含"未发现问题") 2=参数/文件错误`;

// ---------- 解析 ----------

const LINE_RE =
  /^\[(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2}):(\d{3})\]\[\s*(\d+)\]\s?(.*)$/;
// log.Timestamp 其余档位: 2=SinceStart("[%07.2f]" 自启动秒数) 4=Timecode("[HH:MM:SS:FF]")
const LINE_RE_SINCE = /^\[(\d{1,7}\.\d{2})\]\[\s*(\d+)\]\s?(.*)$/;
const LINE_RE_TC = /^\[(\d{2}):(\d{2}):(\d{2}):(\d{2})\]\[\s*(\d+)\]\s?(.*)$/;

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
    let m = LINE_RE.exec(raw);
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
    } else if ((m = LINE_RE_SINCE.exec(raw)) !== null) {
      // SinceStart: 相对 GStartTime 的秒数, timeMs 自 0 起算(判活/间隔分析不受影响)
      const [, sec, frame, body] = m;
      const t = Math.round(Number(sec) * 1000);
      prevT = t; carryT = t; carryF = Number(frame);
      out.push({
        line: i + 1, timeMs: t, frame: carryF, body, raw,
        tsText: `+${sec}s`, prefixed: true,
      });
    } else if ((m = LINE_RE_TC.exec(raw)) !== null) {
      // Timecode: HH:MM:SS:FF, 帧字段按 ~30fps 折算毫秒(近似, 判活不受影响)
      const [, h, mi, s, ff, frame, body] = m;
      let t = Number(h) * 3600000 + Number(mi) * 60000 + Number(s) * 1000 + Number(ff) * 33;
      if (prevT !== null && t < prevT) t += 86400000;
      prevT = t; carryT = t; carryF = Number(frame);
      out.push({
        line: i + 1, timeMs: t, frame: carryF, body, raw,
        tsText: `${h}:${mi}:${s}`, prefixed: true,
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

  // 帧号回绕检测: UE5 原生按 mod 1000 打印帧号(log.Timestamp), 单调日志不可能出现 >500 的大幅回跳
  let backwardJumps = 0;
  for (let i = 1; i < parsed.length; i++) {
    if (parsed[i].frame - parsed[i - 1].frame < -500) backwardJumps++;
  }
  const wrapDetected = backwardJumps >= 2;

  // 解绕: 相邻行最小增量累加(日志间隔 >500 帧时为下限估计)
  const reals = new Array(parsed.length);
  let real = parsed.length ? parsed[0].frame : 0;
  let realMax = real;
  for (let i = 0; i < parsed.length; i++) {
    if (i > 0) {
      const d = (((parsed[i].frame - parsed[i - 1].frame + 500) % 1000) + 1000) % 1000 - 500;
      real += d;
    }
    reals[i] = real;
    if (real > realMax) realMax = real;
  }

  // 最后一次帧号变化(判活的精确时点)
  let lastGrowthIdx = -1;
  for (let i = 1; i < parsed.length; i++) {
    if (parsed[i].frame !== parsed[i - 1].frame) lastGrowthIdx = i;
  }
  const lastGrowthAt = lastGrowthIdx >= 0 ? parsed[lastGrowthIdx].timeMs : null;

  // 冻结段: 帧号恒定的极大连续段(>=2s), 心跳行不切段
  const stalls = [];
  let runStart = null;
  let runEnd = null;
  let runFrame = null;
  const closeRun = () => {
    if (runEnd && runEnd.timeMs - runStart.timeMs >= 2000) {
      stalls.push({ start: runStart, end: runEnd, frame: runFrame, durMs: runEnd.timeMs - runStart.timeMs });
    }
  };
  for (const e of parsed) {
    if (e.frame !== runFrame) {
      closeRun();
      runStart = e; runEnd = e; runFrame = e.frame;
    } else {
      runEnd = e;
    }
  }
  closeRun();

  // 逐小时判活谱: 每小时帧变化次数(0 = 该小时游戏线程无帧推进)
  const hourly = [];
  if (parsed.length) {
    const t0 = parsed[0].timeMs;
    for (let i = 1; i < parsed.length; i++) {
      if (parsed[i].frame !== parsed[i - 1].frame) {
        const h = Math.floor((parsed[i].timeMs - t0) / 3600000);
        const b = hourly[hourly.length - 1];
        if (!b || b.hour !== h) hourly.push({ hour: h, changes: 1 });
        else b.changes++;
      }
    }
    const lastH = Math.floor((parsed[parsed.length - 1].timeMs - t0) / 3600000);
    const top = hourly[hourly.length - 1];
    if (!top || top.hour !== lastH) hourly.push({ hour: lastH, changes: 0 });
  }

  // FPS 分桶(2s/桶), 基于解绕帧号, 只统计递增区间
  const buckets = [];
  let cur = null;
  for (let i = 0; i < parsed.length; i++) {
    const e = parsed[i];
    if (!cur || e.timeMs - cur.start >= 2000 || reals[i] < cur.lastReal) {
      if (cur && cur.end - cur.start > 500) buckets.push(cur);
      cur = { start: e.timeMs, end: e.timeMs, firstReal: reals[i], lastReal: reals[i] };
    } else {
      cur.end = e.timeMs;
      cur.lastReal = reals[i];
    }
  }
  if (cur && cur.end - cur.start > 500) buckets.push(cur);
  for (const b of buckets) {
    b.fps = b.end === b.start ? null : ((b.lastReal - b.firstReal) * 1000) / (b.end - b.start);
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

  // 判活: 日志最后 10% 时段内帧号仍有变化(回绕+稀疏日志下方向不可靠, 用变化计数)
  const lastT = parsed.length ? parsed[parsed.length - 1].timeMs : 0;
  const tailStart = lastT - Math.max((lastT - (parsed[0]?.timeMs ?? 0)) * 0.1, 1000);
  let tailChanges = 0;
  for (let i = 1; i < parsed.length; i++) {
    if (parsed[i].timeMs >= tailStart && parsed[i].frame !== parsed[i - 1].frame) tailChanges++;
  }
  const tailGrew = tailChanges > 0;
  const tailFrozenMs = lastGrowthAt === null ? null : lastT - lastGrowthAt;

  // 挣扎段(冻结前兆): 密接对(<=2s, 无回绕歧义)测得 0<fps<=5, 持续>=5s,
  // 且结束于最后一次帧变化 10s 内(即随后冻结)。稀疏心跳对因 mod 1000 歧义不参与——宁漏勿误。
  const struggleRuns = [];
  let stStart = null;
  let stEnd = null;
  const flushStruggle = () => {
    if (stStart !== null && stEnd - stStart >= 5000) struggleRuns.push({ start: stStart, end: stEnd });
    stStart = null; stEnd = null;
  };
  for (let i = 1; i < parsed.length; i++) {
    const a = parsed[i - 1];
    const b = parsed[i];
    const dt = b.timeMs - a.timeMs;
    if (dt === 0) continue; // 同毫秒对: 中性, 不切段
    if (dt > 2000) { flushStruggle(); continue; } // 稀疏对不参与
    const d = (((b.frame - a.frame + 500) % 1000) + 1000) % 1000 - 500;
    const fps = d > 0 ? (d * 1000) / dt : 0;
    if (d > 0 && fps <= 5) {
      if (stStart === null) stStart = a.timeMs;
      stEnd = b.timeMs;
    } else {
      flushStruggle();
    }
  }
  flushStruggle();
  const struggleSegments = struggleRuns
    .filter((s) => lastGrowthAt !== null && Math.abs(s.end - lastGrowthAt) <= 10000)
    .map((s) => ({ from: fmtMs(s.start), to: fmtMs(s.end), durMs: s.end - s.start }));

  let verdict = maxFrame === 0
    ? (parsed.length === 0
      ? '未识别到任何带前缀行——检查 log.Timestamp 模式(0=None 无时间戳)或确认是 UE 日志'
      : '游戏线程从未出帧(全程帧 0)——卡在启动/同步加载阶段')
    : tailGrew
      ? `存活: 帧号增长至日志结束(最大帧 ${maxFrame})`
      : tailFrozenMs !== null && tailFrozenMs >= 60000
        ? `帧号停止增长: 最后变化于 ${fmtMs(lastGrowthAt)}, 之后冻结 ${(tailFrozenMs / 1000).toFixed(0)}s 直至日志结束——游戏线程卡死, 期间其他线程仍可打日志`
        : `帧号停止增长(最大帧 ${maxFrame}, 最后变化于 ${fmtMs(lastGrowthAt)})——疑似中途卡死`;
  if (struggleSegments.length) verdict += '; 冻结前存在挣扎段(低fps仍出帧)——冻结前兆';

  const data = {
    totalLines: lines.length,
    parsedLines: parsed.length,
    frame0Lines: frame0,
    frame0Pct: pct(frame0, parsed.length),
    maxFrame,
    frameWrap: wrapDetected
      ? { detected: true, backwardJumps, realMaxFrame: realMax, note: '检测到帧号 mod 1000 回绕(UE5 原生): 最大帧号与 FPS 跨回绕段为下限估计; 冻结段判定不受影响(帧号恒定=无帧推进)' }
      : { detected: false, backwardJumps: 0, realMaxFrame: maxFrame },
    alive: tailGrew,
    lastGrowthAt: lastGrowthAt === null ? null : fmtMs(lastGrowthAt),
    tailFrozenMs,
    struggleSegments,
    verdict,
    hourlyChanges: hourly,
    stalls: stalls.map((s) => ({
      from: fmtMs(s.start.timeMs), to: fmtMs(s.end.timeMs),
      durMs: s.durMs, frame: s.frame,
    })),
    fpsBuckets: buckets.map((b) => ({
      at: fmtMs(b.start), fps: b.fps === null ? null : Number(b.fps.toFixed(1)),
      fromFrame: b.firstReal, toFrame: b.lastReal,
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
  if (wrapDetected) {
    L.push(`- 帧号回绕: ${backwardJumps} 次大回跳(UE5 原生 mod 1000), 估算真实最大帧 >= ${realMax}; 跨回绕的 FPS 为下限, 冻结段判定不受影响`);
  }
  L.push(`- 判定: ${verdict}`);
  if (data.hourlyChanges.length > 1) {
    L.push('- 判活谱(逐小时帧变化次数, 0=该小时无帧推进): ' + data.hourlyChanges.map((h) => `${h.hour}h=${h.changes}`).join('  '));
  }
  if (data.stalls.length) {
    L.push('- 冻结段(帧号恒定 >=2s, 心跳不切段):');
    for (const s of data.stalls) L.push(`    ${s.from} → ${s.to}(${(s.durMs / 1000).toFixed(1)}s) 帧号恒 ${s.frame}`);
  }
  if (struggleSegments.length) {
    L.push('- 挣扎段(低fps仍出帧, 紧邻冻结=前兆; 稀疏心跳不参与):');
    for (const s of struggleSegments) L.push(`    ${s.from} → ${s.to}(${(s.durMs / 1000).toFixed(1)}s)`);
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

// ---------- pattern kb ----------

/** 与 validate-patterns.mjs 同口径的极简 frontmatter 解析 */
function unquoteYaml(v) {
  if (v.startsWith('"')) return v.replace(/^"|"$/g, '').replace(/\\/g, '\\');
  return v.replace(/^'|'$/g, '');
}

function loadPatternKB(dir) {
  const kb = [];
  let files = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  } catch {
    return kb;
  }
  for (const f of files) {
    const text = readFileSync(join(dir, f), 'utf8');
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    if (!m) continue;
    const fm = {};
    let listKey = null;
    for (const line of m[1].split(/\r?\n/)) {
      const li = /^\s*-\s+(.*)$/.exec(line);
      if (li && listKey) { fm[listKey].push(unquoteYaml(li[1].trim())); continue; }
      const kv = /^([A-Za-z-]+):\s*(.*)$/.exec(line);
      if (kv) {
        const [, k, v] = kv;
        if (v === '' || v === '[]') {
          if (k === 'aliases' || k === 'sources') { fm[k] = []; listKey = k; }
          else fm[k] = '';
        } else if (k === 'aliases' || k === 'sources') {
          fm[k] = [unquoteYaml(v)]; listKey = k;
        } else { fm[k] = unquoteYaml(v); listKey = null; }
      }
    }
    if (!fm.name) continue;
    kb.push({
      file: f, name: fm.name,
      signature: fm.signature ?? null,
      aliases: fm.aliases ?? [],
      match: fm.match ? new RegExp(fm.match) : null,
    });
  }
  return kb;
}

/** 组级匹配: 精确签名(signature/aliases)或 match 正则命中样例行 */
function matchPattern(kb, sig, sampleRaw) {
  for (const e of kb) {
    if ((e.signature && e.signature === sig) || (e.aliases && e.aliases.includes(sig))) return e;
    if (e.match && e.match.test(sampleRaw)) return e;
  }
  return null;
}

// ---------- errors ----------

function cmdErrors(lines, asJson, opts = {}) {
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
  // 模式库匹配: 精确签名(signature/aliases)或 match 正则命中首行
  const kb = opts.kb ? loadPatternKB(opts.kb) : null;
  const matched = new Map();
  if (kb) {
    for (const [sig, g] of groups) {
      const hit = matchPattern(kb, sig, g.first.raw);
      if (hit) matched.set(sig, hit);
    }
  }
  const rows = [...groups.entries()].map(([sig, g]) => ({ sig, ...g })).sort((a, b) => b.count - a.count);
  const data = {
    totalErrorLines: rows.reduce((a, r) => a + r.count, 0),
    distinctPatterns: rows.length,
    kb: kb ? { dir: opts.kb, hits: matched.size, misses: rows.length - matched.size } : null,
    rows: rows.map((r) => ({
      count: r.count, sample: r.sample,
      pattern: matched.get(r.sig)?.name ?? null,
      first: { at: fmtMs(r.first.timeMs ?? 0), line: r.first.line, frame: r.first.frame },
      last: { at: fmtMs(r.last.timeMs ?? 0), line: r.last.line, frame: r.last.frame },
    })),
  };
  if (asJson) return data;
  if (!rows.length) return '# 错误频次\n- 未发现含 error 字样的行';
  const L = [`# 错误频次(共 ${data.totalErrorLines} 行, ${rows.length} 类, 按次数降序)`, ''];
  if (kb) {
    L.push('| 次数 | 模式 | 首次 | 末次 | 样例 |', '| --- | --- | --- | --- | --- |');
  } else {
    L.push('| 次数 | 首次 | 末次 | 样例 |', '| --- | --- | --- | --- |');
  }
  for (const r of data.rows) {
    const cells = [String(r.count)];
    if (kb) cells.push(r.pattern ? `${r.pattern}` : '');
    cells.push(`${r.first.at} (L${r.first.line})`, `${r.last.at} (L${r.last.line})`, r.sample.replace(/\|/g, '\\|'));
    L.push(`| ${cells.join(' | ')} |`);
  }
  if (kb) {
    L.push(`- 模式库(${opts.kb})命中 ${data.kb.hits}/${rows.length} 类; 未命中 ${data.kb.misses} 类`
      + (data.kb.misses ? '——未命中者为候选入库项: 铸前先 grep patterns/ 错误原句并跑 validate-patterns' : ''));
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

// ---------- env ----------

const CMDLINE_LOGINIT_RE = /LogInit:\s+(Filtered )?Command Line:\s?(.*)$/;
const CMDLINE_CSV_RE = /LogCsvProfiler: Display: Metadata set : commandline=(.+)$/;
const CSV_META_RE = /LogCsvProfiler: Display: Metadata set : ([A-Za-z0-9]+)="(.*)"\s*$/;

/** 命令行提取: 首选 LogInit 行; RHI 早死日志回退 CSV 元数据(值被再包一层引号) */
function extractCommandLine(rawLines) {
  for (const raw of rawLines) {
    const m = CMDLINE_LOGINIT_RE.exec(raw);
    if (m) return { commandLine: m[2].trim(), source: 'loginit', filtered: !!m[1] };
  }
  for (const raw of rawLines) {
    const m = CMDLINE_CSV_RE.exec(raw);
    if (m) {
      const v = m[1].trim().replace(/^"+/, '').replace(/"+$/, '').trim();
      return { commandLine: v, source: 'csv-metadata', filtered: false };
    }
  }
  return { commandLine: null, source: null, filtered: false };
}

function extractCsvMetadata(rawLines) {
  const meta = {};
  for (const raw of rawLines) {
    const m = CSV_META_RE.exec(raw);
    if (m && m[1] !== 'commandline') meta[m[1]] = m[2];
  }
  return meta;
}

/** 解析命令行 token: -Key=Value / -Flag / 裸 Key=Value(如 ResX=200, -Resolution 子键) */
function parseCommandLineParams(cmd) {
  const params = {};
  const flags = [];
  if (!cmd) return { params, flags };
  for (const tok of cmd.split(/\s+/)) {
    if (!tok) continue;
    if (tok.startsWith('-')) {
      const eq = tok.indexOf('=');
      if (eq > 0) params[tok.slice(1, eq)] = tok.slice(eq + 1);
      else flags.push(tok.slice(1));
    } else if (tok.includes('=')) {
      const eq = tok.indexOf('=');
      const k = tok.slice(0, eq);
      if (!(k in params)) params[k] = tok.slice(eq + 1);
    }
  }
  return { params, flags };
}

function envFingerprint(rawLines) {
  const { commandLine, source, filtered } = extractCommandLine(rawLines);
  const metadata = extractCsvMetadata(rawLines);
  const { params, flags } = parseCommandLineParams(commandLine);
  return { commandLine, source, filtered, params, flags, metadata };
}

function cmdEnv(lines, asJson) {
  const fp = envFingerprint(lines.map((e) => e.raw));
  if (asJson) return fp;
  const L = ['# 环境指纹'];
  if (!fp.commandLine) {
    L.push('- 未找到命令行(既无 LogInit: Command Line, 也无 LogCsvProfiler commandline 元数据)');
    return L.join('\n');
  }
  L.push(`- 命令行来源: ${fp.source}${fp.filtered ? ' (Filtered——敏感参数被引擎过滤)' : ''}`);
  L.push(`- 命令行: ${fp.commandLine}`);
  const keys = Object.keys(fp.params).sort();
  if (keys.length) {
    L.push(`- 参数(${keys.length}):`);
    for (const k of keys) L.push(`    ${k} = ${fp.params[k]}`);
  }
  if (fp.flags.length) L.push(`- 开关: ${fp.flags.sort().join(' ')}`);
  const metaKeys = Object.keys(fp.metadata).sort();
  if (metaKeys.length) {
    L.push('- CSV 元数据:');
    for (const k of metaKeys) L.push(`    ${k} = ${fp.metadata[k]}`);
  }
  return L.join('\n');
}

// ---------- inventory ----------

const INV_HEAD_BYTES = 65536;
const INV_TAIL_BYTES = 16384;
const OPEN_TIME_RE = /Log file open, (\d{2})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})/;
const TS_FRAME_RE = /\[(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2}):(\d{3})\]\[\s*(\d+)\]/g;

function collectLogFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.log$/i.test(name)) out.push(p);
    }
  };
  walk(dir);
  return out.sort();
}

/** 只读头 64KB + 尾 16KB, 扛上万文件目录 */
function readHeadTail(file, size) {
  const fd = openSync(file, 'r');
  try {
    const headLen = Math.min(size, INV_HEAD_BYTES);
    const headBuf = Buffer.alloc(headLen);
    readSync(fd, headBuf, 0, headLen, 0);
    const head = headBuf.toString('utf8');
    let tail = head;
    if (size > INV_HEAD_BYTES) {
      const tailLen = Math.min(size - INV_HEAD_BYTES, INV_TAIL_BYTES);
      const tailBuf = Buffer.alloc(tailLen);
      readSync(fd, tailBuf, 0, tailLen, size - tailLen);
      tail = tailBuf.toString('utf8');
    }
    return { head, tail };
  } finally {
    closeSync(fd);
  }
}

function classifyEndState(tail) {
  if (/Failed to choose a D3D12 Adapter/.test(tail)) return 'rhi-adapter-fail';
  if (/Fatal error|Critical error|Unhandled Exception/.test(tail)) return 'fatal';
  if (/Ensure condition failed/.test(tail)) return 'ensure';
  if (/LogExit: Exiting/.test(tail)) return 'clean-exit';
  if (/KeepAlive|pong/i.test(tail)) return 'abrupt-heartbeat';
  return 'abrupt';
}

function extractDeathReason(tail) {
  const req = /FPlatformMisc::RequestExit(?:WithStatus)?\(([^)]+)\)/.exec(tail);
  if (req) return req[1].trim();
  if (/Failed to choose a D3D12 Adapter/.test(tail)) return 'Failed to choose a D3D12 Adapter';
  if (/Fatal error|Critical error|Unhandled Exception/.test(tail)) return 'fatal error';
  return classifyEndState(tail);
}

function parseOpenTime(head) {
  const m = OPEN_TIME_RE.exec(head);
  if (!m) return null;
  const [, mm, dd, yy, h, mi, s] = m;
  return {
    ms: Date.UTC(2000 + Number(yy), Number(mm) - 1, Number(dd), Number(h), Number(mi), Number(s)),
    text: `${mm}/${dd}/${yy} ${h}:${mi}:${s}`,
  };
}

function lastTsFrame(tail) {
  let last = null;
  TS_FRAME_RE.lastIndex = 0;
  let m;
  while ((m = TS_FRAME_RE.exec(tail)) !== null) last = m;
  if (!last) return null;
  return { text: `${last[2]}-${last[3]} ${last[4]}:${last[5]}:${last[6]}`, frame: Number(last[8]) };
}

function cmdInventory(dir, asJson) {
  const files = collectLogFiles(dir);
  const recs = [];
  for (const f of files) {
    const st = statSync(f);
    const { head, tail } = readHeadTail(f, st.size);
    const rawLines = head.split(/\r?\n/);
    const open = parseOpenTime(head);
    const fp = envFingerprint(rawLines);
    const last = lastTsFrame(tail);
    recs.push({
      file: f, name: f.slice(dir.length + 1), size: st.size,
      openMs: open ? open.ms : null, open: open ? open.text : null,
      lastTs: last ? last.text : null, lastFrame: last ? last.frame : null,
      endState: classifyEndState(tail), deathReason: extractDeathReason(tail),
      graphicsAdapter: fp.params.GraphicsAdapter ?? null,
      taskId: fp.params.TaskId ? String(fp.params.TaskId).slice(0, 8) : null,
    });
  }
  recs.sort((a, b) => (a.openMs ?? 0) - (b.openMs ?? 0) || a.file.localeCompare(b.file));

  // 崩溃重试循环聚类: 按打开时间排序后, 相邻文件 间隔<=15s + 大小同类(±5%) + 终态相同
  const sameSizeClass = (a, b) => Math.abs(a.size - b.size) <= Math.max(1536, 0.05 * Math.max(a.size, b.size));
  const clusters = [];
  let curFiles = [];
  const closeCluster = () => {
    if (curFiles.length >= 3) {
      const intervals = [];
      for (let i = 1; i < curFiles.length; i++) intervals.push(curFiles[i].openMs - curFiles[i - 1].openMs);
      intervals.sort((x, y) => x - y);
      clusters.push({
        count: curFiles.length,
        from: curFiles[0].open, to: curFiles[curFiles.length - 1].open,
        medianIntervalMs: intervals[Math.floor(intervals.length / 2)],
        endState: curFiles[0].endState,
        deathReason: curFiles[0].deathReason,
        graphicsAdapter: curFiles[0].graphicsAdapter,
        sampleFile: curFiles[0].name,
        files: curFiles.map((r) => r.name),
      });
      for (const r of curFiles) r.inCluster = true;
    }
    curFiles = [];
  };
  for (const r of recs) {
    if (r.openMs === null) { closeCluster(); continue; }
    const prev = curFiles[curFiles.length - 1];
    if (prev && r.openMs - prev.openMs <= 15000 && sameSizeClass(prev, r) && r.endState === prev.endState) {
      curFiles.push(r);
    } else {
      closeCluster();
      curFiles = [r];
    }
  }
  closeCluster();
  const others = recs.filter((r) => !r.inCluster);

  const data = {
    dir, totalFiles: files.length,
    clusters,
    clusterFileCount: clusters.reduce((a, c) => a + c.count, 0),
    others: others.map(({ file, inCluster, openMs, deathReason, ...rest }) => rest),
  };
  if (asJson) return data;

  const L = [`# 目录清单(${files.length} 个日志, ${clusters.length} 个崩溃重试循环簇, 簇内 ${data.clusterFileCount} 个)`];
  if (clusters.length) {
    L.push('', '## 崩溃重试循环(等大小+固定间隔+同终态, 抽样死因即可, 别逐个分析)', '',
      '| 个数 | 起 | 止 | 中位间隔 | adapter | 死因(抽样) | 样例 |', '| --- | --- | --- | --- | --- | --- | --- |');
    for (const c of clusters) {
      L.push(`| ${c.count} | ${c.from} | ${c.to} | ${(c.medianIntervalMs / 1000).toFixed(1)}s | ${c.graphicsAdapter ?? '-'} | ${String(c.deathReason).slice(0, 60).replace(/\|/g, '\\|')} | ${c.sampleFile} |`);
    }
  }
  if (others.length) {
    L.push('', `## 非循环日志(${others.length})`, '',
      '| 文件 | 大小 | 打开 | 最后时间 | 末帧 | 终态 | adapter |', '| --- | --- | --- | --- | --- | --- | --- |');
    for (const r of others.slice(0, 40)) {
      L.push(`| ${r.name} | ${r.size} | ${r.open ?? '-'} | ${r.lastTs ?? '-'} | ${r.lastFrame ?? '-'} | ${r.endState} | ${r.graphicsAdapter ?? '-'} |`);
    }
    if (others.length > 40) L.push(`| … 其余 ${others.length - 40} 个省略 |`);
  }
  return L.join('\n');
}

// ---------- diff ----------

function errorSigMap(lines) {
  const m = new Map();
  for (const e of lines) {
    if (!/error/i.test(e.raw)) continue;
    const sig = errorSignature(e.raw);
    const g = m.get(sig) || { count: 0, sample: trimLine(e), first: e };
    g.count++;
    m.set(sig, g);
  }
  return m;
}

function framesBrief(file, lines) {
  const f = cmdFrames(lines, true);
  const longest = f.stalls.reduce((a, s) => Math.max(a, s.durMs), 0);
  return {
    file,
    verdict: f.verdict,
    alive: f.alive,
    maxFrame: f.maxFrame,
    frameWrapDetected: f.frameWrap.detected,
    lastGrowthAt: f.lastGrowthAt,
    tailFrozenMs: f.tailFrozenMs,
    longestStallMs: longest,
    errorPatterns: errorSigMap(lines).size,
  };
}

function cmdDiff(fileA, fileB, linesA, linesB, asJson) {
  const briefA = framesBrief(fileA, linesA);
  const briefB = framesBrief(fileB, linesB);
  const mapA = errorSigMap(linesA);
  const mapB = errorSigMap(linesB);

  const deathSide = briefA.alive === false && briefB.alive === true
    ? 'A' : briefB.alive === false && briefA.alive === true ? 'B' : null;

  const shared = [];
  const aOnly = [];
  const bOnly = [];
  for (const [sig, g] of mapA) {
    if (mapB.has(sig)) shared.push({ countA: g.count, countB: mapB.get(sig).count, sample: g.sample });
    else aOnly.push({ count: g.count, sample: g.sample, deathCandidate: deathSide === 'A' });
  }
  for (const [sig, g] of mapB) {
    if (!mapA.has(sig)) bOnly.push({ count: g.count, sample: g.sample, deathCandidate: deathSide === 'B' });
  }
  const byCount = (x, y) => y.count - x.count;
  shared.sort((x, y) => y.countA - x.countA);
  aOnly.sort(byCount);
  bOnly.sort(byCount);

  const hint = '共享模式: 存活份携带仍出帧 => 降级为非致死候选(环境/卫生债); '
    + '致死候选 = 仅冻结侧独有且与冻结时点相关。结论用实锤/强假设/待澄清三档, 单侧信息降 weak。';

  const data = { a: briefA, b: briefB, deathSide, shared, aOnly, bOnly, hint };
  if (asJson) return data;

  const L = ['# A/B 对比(事实表, 归因按 method.md 由分析者完成)', '',
    `| 侧 | verdict | 存活 | 最大帧 | 最长冻结 | 错误类数 |`, `| --- | --- | --- | --- | --- | --- |`];
  for (const [tag, b] of [['A', briefA], ['B', briefB]]) {
    L.push(`| ${tag}: ${b.file.split(/[\\/]/).pop()} | ${b.verdict.slice(0, 50)} | ${b.alive ? '是' : '否'} | ${b.maxFrame} | ${(b.longestStallMs / 1000).toFixed(1)}s | ${b.errorPatterns} |`);
  }
  if (deathSide) L.push(`- 判活分岔: **${deathSide} 侧冻结**——其独有错误模式为致死候选(deathCandidate)`);
  else L.push('- 判活无分岔: 两侧同活/同死, 错误谱差异只反映环境差异');
  const sect = (title, rows, countKey) => {
    if (!rows.length) return;
    L.push('', `## ${title}(${rows.length})`, '', '| 次数 | 样例 | 候选 |', '| --- | --- | --- |');
    for (const r of rows.slice(0, 10)) {
      const dc = r.deathCandidate !== undefined ? (r.deathCandidate ? '致死候选' : '-') : '-';
      L.push(`| ${countKey === 'both' ? `${r.countA}/${r.countB}` : r.count} | ${r.sample.replace(/\|/g, '\\|')} | ${dc} |`);
    }
  };
  sect(`共享错误模式`, shared, 'both');
  sect(`仅 A 有`, aOnly);
  sect(`仅 B 有`, bOnly);
  L.push('', `> ${hint}`);
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
    cmdEnv(lines, false),
    '',
    cmdFrames(lines, false),
    '',
    cmdTimeline(lines, false, opts),
    '',
    cmdErrors(lines, false, opts),
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
const positionals = [];
for (let i = 2; i < args.length; i++) {
  const a = args[i];
  if (a === '--json') opts.json = true;
  else if (a === '--min-ms') opts.minMs = Number(args[++i]);
  else if (a === '--min-count') opts.minCount = Number(args[++i]);
  else if (a === '--context') opts.context = Number(args[++i]);
  else if (a === '--kb') opts.kb = args[++i];
  else positionals.push(a);
}
if (!command || !file || !/^(frames|gaps|errors|noise|timeline|env|inventory|diff|summary)$/.test(command)) {
  fail(USAGE);
}
if (positionals.length && command !== 'diff') fail(`未知参数: ${positionals.join(' ')}\n${USAGE}`);

let result;
if (command === 'inventory') {
  let st;
  try {
    st = statSync(file);
  } catch (err) {
    fail(`无法访问目录 ${file}: ${err.message}`);
  }
  if (!st.isDirectory()) fail(`inventory 需要目录参数: ${file}`);
  result = cmdInventory(file, opts.json);
} else if (command === 'diff') {
  const fileB = positionals[0];
  if (!fileB) fail(`diff 需要两个日志文件: ${USAGE}`);
  const readSafe = (f) => {
    try {
      return readFileSync(f, 'utf8');
    } catch (err) {
      fail(`无法读取日志文件 ${f}: ${err.message}`);
    }
  };
  const linesA = parseLines(readSafe(file));
  const linesB = parseLines(readSafe(fileB));
  result = cmdDiff(file, fileB, linesA, linesB, opts.json);
} else {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (err) {
    fail(`无法读取日志文件 ${file}: ${err.message}`);
  }
  const lines = parseLines(text);
  switch (command) {
    case 'frames': result = cmdFrames(lines, opts.json); break;
    case 'gaps': result = cmdGaps(lines, opts.json, opts); break;
    case 'errors': result = cmdErrors(lines, opts.json, opts); break;
    case 'noise': result = cmdNoise(lines, opts.json, opts); break;
    case 'timeline': result = cmdTimeline(lines, opts.json, opts); break;
    case 'env': result = cmdEnv(lines, opts.json); break;
    case 'summary': result = cmdSummary(lines, opts); break;
  }
}

if (opts.json) console.log(JSON.stringify(result, null, 2));
else console.log(result);
exit(0);
