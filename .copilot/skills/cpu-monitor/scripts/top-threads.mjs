#!/usr/bin/env node
// ============================================================================
// top-threads.mjs — Windows 线程级 CPU Top-N 采样(Node.js + Win32 API)
//
// 数据源:thread-snapshot.ps1 -> P/Invoke Toolhelp32 + GetThreadTimes
//        完全不经过 WMI,不会拉高 WmiPrvSE。
//
// CPU% 口径:
//   单核% = Δ(Kernel+User)100ns / Δwall_ms / 10000 * 100   // 100 = 跑满一个核
//   总占% = 单核% / 逻辑核数
//
// 注意:线程级数据"细项求和"会小于进程级,因为大量短生命周期线程
//      (尤其 churn 频繁的浏览器/IDE)在两次采样之间产生又消失。
//
// 用法:
//   node top-threads.mjs                            # 默认 10 秒、Top20
//   node top-threads.mjs --seconds 20 --top 30 --report threads.txt
// ============================================================================

import { execSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const THREAD_PS1 = join(__dirname, 'thread-snapshot.ps1');
if (!existsSync(THREAD_PS1)) {
  console.error(`找不到 ${THREAD_PS1}`);
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
const SECONDS = opt('seconds', 10);
const TOP     = opt('top', 20);
const INTERVAL = opt('interval', 1);
const REPORT  = optStr('report', null);

// 逻辑核数
const cores = Number(process.env.NUMBER_OF_PROCESSORS) || 0;
if (!cores) { console.error('无法获取逻辑核数'); process.exit(1); }

// ---------- 线程快照 ----------
function snapshotThreads() {
  const out = execSync(
    `powershell -NoProfile -ExecutionPolicy Bypass -File "${THREAD_PS1}"`,
    { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }
  );
  const lines = out.split(/\r?\n/).filter(s => s.trim());
  const threads = new Map();  // tid -> { pid, name, k, u }
  let wallMs = 0n;
  let totalCount = 0, sampledCount = 0;
  for (const line of lines) {
    if (line.startsWith('#wallMs=')) {
      const m = line.match(/wallMs=(\d+)/);
      if (m) wallMs = BigInt(m[1]);
      const m2 = line.match(/count=(\d+)/);
      if (m2) totalCount = Number(m2[1]);
      const m3 = line.match(/sampled=(\d+)/);
      if (m3) sampledCount = Number(m3[1]);
      continue;
    }
    // 新格式: tid,pid,name,kernel100ns,user100ns (name 可能含逗号,但进程名一般没有)
    const c = line.split(',');
    if (c.length < 5) continue;
    const tid = Number(c[0]);
    const pid = Number(c[1]);
    const name = c[2] || '';
    if (!tid) continue;
    threads.set(tid, { tid, pid, name, k: BigInt(c[3] || '0'), u: BigInt(c[4] || '0') });
  }
  return { wallMs, threads, totalCount, sampledCount };
}

// ---------- PID -> 进程名映射(查一次) ----------
function buildPidNameMap(pids) {
  if (!pids.length) return new Map();
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$want = @{ ${pids.map(p => `'${p}'=$true`).join(';')} }
Get-CimInstance Win32_Process | Where-Object { $want[[string]$_.ProcessId] } | ForEach-Object {
  Write-Output ("{0}|{1}|{2}" -f $_.ProcessId, $_.Name, $_.ExecutablePath)
}
`;
  const tmpFile = join(__dirname, `.pidname-${process.pid}.ps1`);
  try {
    writeFileSync(tmpFile, ps, 'utf8');
    const out = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`,
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const map = new Map();
    for (const line of out.split(/\r?\n/)) {
      const idx = line.indexOf('|');
      if (idx < 0) continue;
      const pid = Number(line.slice(0, idx));
      const rest = line.slice(idx + 1);
      const idx2 = rest.indexOf('|');
      const name = idx2 >= 0 ? rest.slice(0, idx2) : rest;
      const path = idx2 >= 0 ? rest.slice(idx2 + 1) : '';
      if (pid) map.set(pid, { name, path });
    }
    return map;
  } catch {
    return new Map();
  } finally {
    try { require('node:fs').unlinkSync(tmpFile); } catch {}
  }
}

// 给定线程,反查它的"线程名/调用栈"信息(可选,管理员才能拿全)
// 这里不做栈回溯(需要 ETW/xperf),只标注是否是采样辅助进程的线程
const OBSERVER_PATTERNS = [/powershell/i, /pwsh/i, /node/i, /conhost/i, /WindowsTerminal/i];
function classifyObserver(procName) {
  return OBSERVER_PATTERNS.some(re => re.test(procName || '')) ? '采样辅助' : '';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

console.log(`逻辑核数: ${cores}    采样窗口: ${SECONDS}s   间隔: ${INTERVAL}s   Top: ${TOP}`);
console.log(`数据源: Win32 API(CreateToolhelp32Snapshot + GetThreadTimes)— 不经 WMI`);
console.log('开始采样...');

const prev = snapshotThreads();
const agg = new Map();   // tid -> 累加器
const pidSeen = new Set();
const pidLatestName = new Map();   // pid -> 最新进程名
const t0 = Date.now();

(async () => {
  for (let i = 1; i <= SECONDS; i++) {
    await sleep(INTERVAL * 1000);
    const now = snapshotThreads();

    for (const [tid, n] of now.threads) {
      const p = prev.threads.get(tid);
      if (!p) continue;
      const dCpu = (n.k + n.u) - (p.k + p.u);
      const dWallMs = Number(now.wallMs - prev.wallMs);
      if (dWallMs <= 0) continue;
      const corePct = Number(dCpu) / (dWallMs * 10000) * 100;  // 单核%
      const totalPct = corePct / cores;

      pidSeen.add(n.pid);
      // 累积每个 PID 的最新进程名(用最近一次采样的为准)
      if (n.name) pidLatestName.set(n.pid, n.name);
      if (!agg.has(tid)) {
        agg.set(tid, { tid, pid: n.pid, name: n.name || '', sumCore: 0, maxCore: 0, sumTotal: 0, maxTotal: 0, count: 0, peakSec: i });
      }
      const e = agg.get(tid);
      e.pid = n.pid;
      if (n.name) e.name = n.name;
      e.sumCore += corePct;
      e.sumTotal += totalPct;
      e.count += 1;
      if (corePct > e.maxCore) { e.maxCore = corePct; e.maxTotal = totalPct; e.peakSec = i; }
    }

    prev.threads = now.threads;
    prev.wallMs = now.wallMs;
    process.stdout.write(`\r采样 ${i}/${SECONDS}s ...`);
  }
  console.log('');

  // 拿 PID -> 路径(只查见过的 PID,且只为了路径补充)
  const pidPathMap = buildPidNameMap([...pidSeen]);

  // 汇总
  const results = [];
  for (const [tid, e] of agg) {
    if (e.count <= 0) continue;
    const name = e.name || pidLatestName.get(e.pid) || `PID-${e.pid}`;
    const path = (pidPathMap.get(e.pid) || {}).path || '';
    results.push({
      tid: e.tid,
      pid: e.pid,
      name,
      path,
      avgCore: e.sumCore / e.count,
      maxCore: e.maxCore,
      avgTotal: e.sumTotal / e.count,
      maxTotal: e.maxTotal,
      samples: e.count,
      peakSec: e.peakSec,
      note: classifyObserver(name),
    });
  }

  // 按 PID 聚合:每个进程的高 CPU 线程数(诊断用)
  const byPid = new Map();
  for (const r of results) {
    if (!byPid.has(r.pid)) byPid.set(r.pid, { pid: r.pid, name: r.name, path: r.path, sumAvg: 0, threadCount: 0 });
    const x = byPid.get(r.pid);
    x.sumAvg += r.avgCore;
    x.threadCount += 1;
  }
  const topProcesses = [...byPid.values()]
    .map(x => ({ ...x, avgCore: x.sumAvg }))
    .sort((a, b) => b.avgCore - a.avgCore)
    .slice(0, 10);

  const byAvg = [...results].sort((a,b)=>b.avgCore-a.avgCore).slice(0, TOP);
  const byMax = [...results].sort((a,b)=>b.maxCore-a.maxCore).slice(0, TOP);

  function pct(v) { return v.toFixed(1).padStart(6); }
  function fmtThreads(rows, label) {
    const lines = [];
    lines.push(`========== ${label} ==========`);
    lines.push('  TID      PID     进程名                         平均单核%  峰值单核%  平均总占%  峰值总占%  备注');
    lines.push('  -------  -------  -----------------------------  ---------  ---------  ---------  ---------  ----');
    for (const r of rows) {
      lines.push(
        `  ${String(r.tid).padEnd(8)} ${String(r.pid).padEnd(8)} ${(r.name||'').padEnd(30)} ` +
        `${pct(r.avgCore)}    ${pct(r.maxCore)}    ${pct(r.avgTotal)}    ${pct(r.maxTotal)}    ${r.note}`
      );
    }
    return lines.join('\n');
  }

  const report = [];
  const push = s => { report.push(s); console.log(s); };
  push('');
  push('============ 线程级 Top ' + TOP + ' ============');
  push('');
  push(fmtThreads(byAvg, `按平均单核% 排序(任务管理器口径)`));
  push('');
  push(fmtThreads(byMax, `按峰值单核% 排序`));
  push('');

  // 进程聚合视图
  push('============ 进程聚合(各进程线程 Top 累计)============');
  push('  PID     进程名                         线程数  累计平均单核%  累计平均总占%  路径');
  push('  ------  -----------------------------  -----  ------------  ------------  ----');
  for (const p of topProcesses) {
    push(`  ${String(p.pid).padEnd(7)} ${(p.name||'').padEnd(30)} ${String(p.threadCount).padEnd(6)} ${pct(p.avgCore)}        ${pct(p.avgCore/cores)}        ${p.path||''}`);
  }
  push('');

  push('口径说明:');
  push('  "单核%" = 任务管理器口径:跑满一个逻辑核 = 100%,多核可超过 100%');
  push(`  "总占%" = 占系统总 CPU:跑满全部 ${cores} 核 = 100%;换算关系:总占% = 单核% / ${cores}`);
  push('  线程级数据会略小于进程级,因为短生命周期线程在两次采样间产生又消失,无法计入');
  push('  单线程 >50% 单核% 持续,通常意味着该线程在做 CPU 密集计算(编译/转码/死循环等)');
  push(`采样起止: ${new Date(t0).toLocaleTimeString()} ~ ${new Date().toLocaleTimeString()}`);

  if (REPORT) {
    writeFileSync(REPORT, report.join('\n') + '\n', 'utf8');
    console.log('');
    console.log(`报告已写入: ${REPORT}`);
  }
})();
