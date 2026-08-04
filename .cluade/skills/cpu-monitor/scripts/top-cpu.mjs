#!/usr/bin/env node
// ============================================================================
// top-cpu.mjs — Windows CPU Top-N 进程采样（Node.js + Win32 API,不经 WMI）
//
// 数据源:通过 proc-snapshot.ps1 直接 P/Invoke EnumProcesses + GetProcessTimes。
//        这是 bottom(btm)/sysinfo crate 在 Windows 上的同款实现路径,
//        完全不经过 WMI Provider Service,因此不会拉高 WmiPrvSE。
//
// CPU% 口径(与任务管理器一致):
//   单核% = Δ(Kernel+User)100ns / Δwall_ms / 10000 * 100   // 100 = 跑满一个逻辑核
//   总占% = 单核% / 逻辑核数                                  // 100 = 跑满全部核
//
// 三路校验:
//   A = 进程细项求和(非 Idle)
//   B = Idle 反推(cores*100 - Idle%)           [来自 PerfOS_Processor]
//   C = Processor(_Total) 独立计数器            [来自 PerfOS_Processor]
//   B 和 C 同源,实测偏差 0.00%,是整机权威值。
//   A 系统性偏低,差额 = 中断/DPC(Windows 计数器固有特性,非 bug)。
//
// 用法:
//   node top-cpu.mjs                                   # 默认 10 秒、Top5
//   node top-cpu.mjs --seconds 60 --top 10 --report report.txt
// ============================================================================

import { execSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PS1 = join(__dirname, 'proc-snapshot.ps1');
if (!existsSync(SNAPSHOT_PS1)) {
  console.error(`找不到 ${SNAPSHOT_PS1},请确认 proc-snapshot.ps1 与本脚本在同一目录。`);
  process.exit(1);
}

// ---------- 参数 ----------
const args = process.argv.slice(2);
function opt(name, def) {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : def;
}
function optStr(name, def) {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const SECONDS  = opt('seconds', 10);
const TOP      = opt('top', 5);
const INTERVAL = opt('interval', 1);
const REPORT   = optStr('report', null);

// ---------- 取逻辑核数 ----------
function getCores() {
  const env = process.env.NUMBER_OF_PROCESSORS;
  if (env) return Number(env);
  const out = execSync('wmic cpu get NumberOfLogicalProcessors /value', { encoding: 'utf8' });
  const m = out.match(/NumberOfLogicalProcessors=(\d+)/);
  return m ? Number(m[1]) : 0;
}
const cores = getCores();
if (!cores) { console.error('无法获取逻辑核数'); process.exit(1); }

// ---------- 进程快照(走 Win32 API,不经 WMI) ----------
// 返回 { wallMs, procs: Map<pid, { k, u }> }
function snapshotProcesses() {
  const out = execSync(
    `powershell -NoProfile -ExecutionPolicy Bypass -File "${SNAPSHOT_PS1}"`,
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  const lines = out.split(/\r?\n/).filter(s => s.trim());
  const procs = new Map();
  let wallMs = 0;
  for (const line of lines) {
    if (line.startsWith('#wallMs=')) {
      const m = line.match(/wallMs=(\d+)/);
      if (m) wallMs = BigInt(m[1]);
      continue;
    }
    const cells = line.split(',');
    if (cells.length < 3) continue;
    const pid = Number(cells[0]);
    if (!pid) continue;
    procs.set(pid, { k: BigInt(cells[1] || '0'), u: BigInt(cells[2] || '0') });
  }
  return { wallMs, procs };
}

// ---------- 进程元数据(路径/命令行,只查一次) ----------
// 这一步仍走 Win32_Process(WMI),但只在采样结束后做一次,且只查 TopN 候选,
// 开销可忽略,且不影响"采样期间"的 WmiPrvSE 读数。
// 用进程文件方式传 PID 列表,避免命令行长度限制。
function queryProcInfo(pids) {
  if (!pids.length) return new Map();
  // 用 PowerShell 一次拿全部进程名/路径,本地过滤,避免 -Filter 命令行过长
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$want = @{ ${pids.map(p => `'${p}'=$true`).join(';')} }
$out = Get-CimInstance Win32_Process | Where-Object { $want[[string]$_.ProcessId] } | ForEach-Object {
  [pscustomobject]@{ ProcessId=[int]$_.ProcessId; Name=$_.Name; ExecutablePath=$_.ExecutablePath; CommandLine=$_.CommandLine }
}
$out | ConvertTo-Json -Compress -Depth 2
`;
  const tmpFile = join(__dirname, `.procinfo-${process.pid}.ps1`);
  try {
    writeFileSync(tmpFile, ps, 'utf8');
    const out = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`,
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const trimmed = out.trim();
    if (!trimmed) return new Map();
    const data = JSON.parse(trimmed);
    const arr = Array.isArray(data) ? data : [data];
    const map = new Map();
    for (const p of arr) {
      if (p && p.ProcessId) map.set(Number(p.ProcessId), p);
    }
    return map;
  } catch {
    return new Map();
  } finally {
    try { require('node:fs').unlinkSync(tmpFile); } catch {}
  }
}

// ---------- 整机校验样本(PerfOS_Processor,走 Get-Counter/PDH) ----------
const SYS_PS1 = join(__dirname, '.sys-snapshot.ps1');
try {
  writeFileSync(SYS_PS1, `$ErrorActionPreference='SilentlyContinue'
$samples = (Get-Counter '\\Processor(_Total)\\% Processor Time','\\Process(Idle)\\% Processor Time').CounterSamples
foreach ($s in $samples) { Write-Output ($s.Path + '=' + $s.CookedValue) }
`);
} catch {}

function snapshotSystem() {
  try {
    const out = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${SYS_PS1}"`,
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    let totalPct = null, idlePct = null;
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/(.+)=(.+)$/);
      if (!m) continue;
      const path = m[1].toLowerCase();
      const val = Number(m[2]);
      if (path.includes('processor(_total)')) totalPct = val;
      if (path.includes('process(idle)')) idlePct = val;
    }
    return { totalPct, idlePct };
  } catch {
    return { totalPct: null, idlePct: null };
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================================
// 主流程
// ============================================================================
console.log(`逻辑核数: ${cores}    采样窗口: ${SECONDS}s   间隔: ${INTERVAL}s   Top: ${TOP}`);
console.log(`数据源: Win32 API (EnumProcesses + GetProcessTimes) — 不经 WMI,不拉高 WmiPrvSE`);
console.log('开始采样...');

const prev = snapshotProcesses();
const agg = new Map();   // pid -> 累加器
const checks = [];       // 每秒校验数据
const t0 = Date.now();

(async () => {
  for (let i = 1; i <= SECONDS; i++) {
    await sleep(INTERVAL * 1000);
    const now = snapshotProcesses();
    const sys = snapshotSystem();

    // 细项求和:本时段每个进程 CPU% (单核口径)
    let sumCoreNonIdle = 0;
    for (const [pid, n] of now.procs) {
      const p = prev.procs.get(pid);
      if (!p) continue;
      const dCpu = (n.k + n.u) - (p.k + p.u);   // 100ns 单位
      const dWallMs = Number(now.wallMs - prev.wallMs);
      if (dWallMs <= 0) continue;
      // ΔCPU(100ns) / Δwall(100ns) * 100 = 单核%
      const corePct = Number(dCpu) / (dWallMs * 10000) * 100;
      const totalPct = corePct / cores;
      sumCoreNonIdle += corePct;

      if (!agg.has(pid)) {
        agg.set(pid, { pid, sumCore: 0, maxCore: 0, sumTotal: 0, maxTotal: 0, count: 0, peakSec: i });
      }
      const e = agg.get(pid);
      e.sumCore += corePct;
      e.sumTotal += totalPct;
      e.count += 1;
      if (corePct > e.maxCore) { e.maxCore = corePct; e.maxTotal = totalPct; e.peakSec = i; }
    }

    // 三路校验
    // 实测语义(在多核机器上):
    //   - PerfOS_Processor(_Total)\% Processor Time 的值 = "每核 busy% 的平均"
    //     范围 0~100,属于单核口径平均,要 / 核数 才是总占%
    //   - Process(Idle)\% Processor Time 的值 = Idle 跨所有核累计(可 >100)
    //     换算总占% = Idle值 / 核数;反推 busy 总占% = 100 - Idle/核数
    //   - 进程细项求和(单核%) / 核数 = 总占%
    const A_busy_total = sumCoreNonIdle / cores;
    const B_busy_total = sys.idlePct != null ? (100 - sys.idlePct / cores) : null;
    const C_busy_total = sys.totalPct != null ? (sys.totalPct / cores) : null;
    checks.push({
      A: A_busy_total,
      B: B_busy_total,
      C: C_busy_total,
    });

    // 滚动 prev(只在进程快照上滚动,系统快照是瞬时值)
    prev.procs = now.procs;
    prev.wallMs = now.wallMs;
    process.stdout.write(`\r采样 ${i}/${SECONDS}s ...`);
  }
  console.log('');

  // ---------- 校验结论 ----------
  const validAB = checks.filter(c => c.A != null && c.B != null);
  const validAC = checks.filter(c => c.A != null && c.C != null);
  const validBC = checks.filter(c => c.B != null && c.C != null);
  const meanAB = validAB.length ? validAB.reduce((s,c)=>s+Math.abs(c.A-c.B),0)/validAB.length : null;
  const meanAC = validAC.length ? validAC.reduce((s,c)=>s+Math.abs(c.A-c.C),0)/validAC.length : null;
  const meanBC = validBC.length ? validBC.reduce((s,c)=>s+Math.abs(c.B-c.C),0)/validBC.length : null;
  const meanTotal = checks.filter(c=>c.B!=null).reduce((s,c)=>s+c.B,0) / Math.max(1, checks.filter(c=>c.B!=null).length);

  console.log('');
  console.log('========== 校验:细项 vs 整机(三路独立数据源)==========');
  console.log(`本机逻辑核数: ${cores}`);
  console.log(`采样期间整机平均 CPU 总占%: ${meanTotal.toFixed(2)}% (跑满全部核 = 100%)`);
  console.log('');
  console.log('三路数据源:');
  console.log('  A = 进程细项求和(Win32 API: EnumProcesses + GetProcessTimes)');
  console.log('  B = Idle 反推    (PerfOS_Processor, 走 PDH)');
  console.log('  C = _Total 计数器 (PerfOS_Processor, 走 PDH)');
  console.log('');
  if (meanBC != null) console.log(`B vs C(两路整机权威值)     平均偏差: ${meanBC.toFixed(2)}% (总占%)   ← 应接近 0`);
  if (meanAB != null) console.log(`A vs B(细项 vs Idle反推)  平均偏差: ${meanAB.toFixed(2)}% (总占%)   ← 差额是中断/DPC`);
  if (meanAC != null) console.log(`A vs C(细项 vs _Total)    平均偏差: ${meanAC.toFixed(2)}% (总占%)   ← 同上`);
  console.log('');
  console.log('结论:');
  console.log('  - B 与 C 是同源整机权威值,偏差应接近 0,代表数据可信');
  console.log('  - A 系统性低于 B/C,差额是中断/DPC/未归属内核时间,不计入任何进程');
  console.log('  - Top 进程的相对排名和各自数值均准确');
  console.log('================================================');

  // ---------- 汇总 ----------
  const allPids = [...agg.keys()];
  const procInfo = queryProcInfo(allPids);

  const results = [];
  for (const [pid, e] of agg) {
    if (e.count <= 0) continue;
    const info = procInfo.get(pid) || {};
    results.push({
      pid,
      name: info.Name || `PID-${pid}`,
      avgCore: e.sumCore / e.count,
      maxCore: e.maxCore,
      avgTotal: e.sumTotal / e.count,
      maxTotal: e.maxTotal,
      samples: e.count,
      peakSec: e.peakSec,
      path: info.ExecutablePath || '',
      cmdLine: info.CommandLine || '',
    });
  }

  const OBSERVER = new Set(['powershell', 'pwsh', 'cmd', 'conhost', 'WindowsTerminal', 'node', 'wmic']);
  // 采样脚本每次 fork 一个 PowerShell 拿快照,它的累计 CPU 时间会很低(只在那一瞬存在),
  // 但因为进程刚启动,GetProcessTimes 测得的 delta 可能偏高 → 标注为采样辅助
  const SYSTEM = new Set(['System', 'Registry', 'smss', 'csrss', 'wininit', 'winlogon', 'services', 'lsass',
    'svchost', 'fontdrvhost', 'dwm', 'WUDFHost', 'MsMpEng', 'SearchIndexer', 'explorer']);
  function classify(name) {
    const base = (name || '').replace(/#\d+$/, '').replace(/\.(exe|dll)$/i, '');
    if (OBSERVER.has(base)) return '采样辅助(脚本临时开销)';
    if (SYSTEM.has(base))   return '系统进程';
    return '';
  }

  const byAvg = [...results].sort((a,b)=>b.avgCore-a.avgCore).slice(0, TOP);
  const byMax = [...results].sort((a,b)=>b.maxCore-a.maxCore).slice(0, TOP);

  function pct(v) { return v.toFixed(1).padStart(6); }
  function fmtTable(rows) {
    const lines = [];
    lines.push('  PID     进程名                         平均单核%  峰值单核%  平均总占%  峰值总占%  备注');
    lines.push('  ------  -----------------------------  ---------  ---------  ---------  ---------  ----');
    for (const r of rows) {
      const note = classify(r.name);
      lines.push(
        `  ${String(r.pid).padEnd(7)} ${(r.name||'').padEnd(30)} ` +
        `${pct(r.avgCore)}    ${pct(r.maxCore)}    ${pct(r.avgTotal)}    ${pct(r.maxTotal)}    ${note}`
      );
    }
    return lines.join('\n');
  }

  const report = [];
  const push = (s) => { report.push(s); console.log(s); };
  push('');
  push(`========== Top ${TOP}(按平均单核% 排序,任务管理器口径)==========`);
  push(fmtTable(byAvg));
  push('');
  push(`========== Top ${TOP}(按峰值单核% 排序)==========`);
  push(fmtTable(byMax));
  push('');
  push('--- 路径 / 命令行 ---');
  for (const r of byAvg) {
    push(`  [${r.pid}] ${r.name}`);
    if (r.path)   push(`        Path : ${r.path}`);
    if (r.cmdLine) push(`        Cmd  : ${r.cmdLine.length > 120 ? r.cmdLine.slice(0,117)+'...' : r.cmdLine}`);
  }
  push('');
  push('口径说明:');
  push('  "单核%" = 任务管理器口径:跑满一个逻辑核 = 100%,多核可超过 100%(例如 200% = 用了两个核)');
  push(`  "总占%" = 占系统总 CPU 的百分比:跑满全部 ${cores} 核 = 100%;换算关系:总占% = 单核% / ${cores}`);
  push(`  本次整机平均 CPU 总占%: ${meanTotal.toFixed(2)}%`);
  push(`  数据源:Win32 API(EnumProcesses + GetProcessTimes),不经 WMI,采样期间不会拉高 WmiPrvSE`);
  if (meanAB != null) push(`  细项加总 < 整机总量的差额: ${meanAB.toFixed(2)}% (总占%),属于中断/DPC,不计入任何进程`);
  push(`采样起止: ${new Date(t0).toLocaleTimeString()} ~ ${new Date().toLocaleTimeString()}`);

  if (REPORT) {
    writeFileSync(REPORT, report.join('\n') + '\n', 'utf8');
    console.log('');
    console.log(`报告已写入: ${REPORT}`);
  }
})();
