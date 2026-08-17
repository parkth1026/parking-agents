#!/usr/bin/env node
/**
 * session.mjs — issue 目录的唯一写入者
 *
 * manifest.json 的 schema 只存在于这个文件里。三份子技能的 SKILL.md 都不复述它，
 * Agent 一律通过子命令更新，不用 Edit/Write 直接改 manifest.json。
 *
 *   init <slug> [--request <原话>]        建/读 issue 目录（幂等）
 *   round <dir> <json>                    追加一行到 rounds.jsonl
 *   stage <dir> <stage> <status> [flags]  推进阶段状态
 *   verify <dir> [--write]                跑 contract.md 里全部 [A] 档命令
 *   rebuild <dir>                         从目录扫描重建 manifest
 *   finalize <dir>                        校验 + 冒烟 + 生成交接指令
 *   list [--stage <s>] [--status <s>] [--group]
 *                                          现扫全部 issue，输出一张表。
 *                                          --stage/--status 过滤（可叠加）；
 *                                          --group 按 stage 分组显示。
 *                                          不加任何 flag 时输出格式和以前完全一样
 *                                          （有外部脚本在 parse 这份纯文本，默认不能变）。
 *
 * 退出码：0 成功 / 1 有问题需要处理 / 2 用法或路径错
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SCHEMA_VERSION = 1;
const STAGES = ['1-interview', '2-prototype', '3-contract'];
const STATUSES = ['pending', 'in_progress', 'done', 'skipped', 'needs_reinterview'];
/** codex `/goal` 的 objective 上限，超了 create_goal 直接拒收。 */
const GOAL_OBJECTIVE_LIMIT = 4000;

const HERE = dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────── 基础设施 ───────────────────────────────

function die(msg, code = 2) {
  console.error(`session: ${msg}`);
  process.exit(code);
}

function iso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function repoRoot() {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, '.git'))) return dir;
    const up = dirname(dir);
    if (up === dir) return process.cwd();
    dir = up;
  }
}

function grillingRoot() {
  return join(repoRoot(), '.aes-workflow', 'grilling');
}

function manifestPath(dir) {
  return join(dir, 'manifest.json');
}

function roundsPath(dir) {
  return join(dir, '1-interview', 'rounds.jsonl');
}

function contractPath(dir) {
  return join(dir, '3-contract', 'contract.md');
}

function readManifest(dir) {
  const p = manifestPath(dir);
  if (!existsSync(p)) die(`${p} 不存在。先跑 init。`);
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    die(`${p} 不是合法 JSON（${e.message}）。跑 rebuild 重建。`);
  }
}

/** 唯一的 manifest 写入路径：读 → 改 → 写 .tmp → rename。 */
function writeManifest(dir, manifest) {
  manifest.schema_version = SCHEMA_VERSION;
  manifest.updated_at = iso();
  const p = manifestPath(dir);
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  renameSync(tmp, p);
}

function blankManifest(slug) {
  const now = iso();
  return {
    schema_version: SCHEMA_VERSION,
    slug,
    created_at: now,
    updated_at: now,
    original_request: null,
    goal_oneline: null,
    target: null,
    stage: STAGES[0],
    next_action: '跑 /aes-interview 调查事实并批量问清歧义。',
    stage_gates: {
      '1-interview': { status: 'pending' },
      '2-prototype': { status: 'pending' },
      '3-contract': { status: 'pending' },
    },
    validation: null,
    blocked: [],
    residual_risk: null,
    status: 'in_progress',
  };
}

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i += 1;
    }
  }
  return flags;
}

function resolveIssueDir(arg) {
  if (!arg) die('缺少 issue 目录参数。');
  const direct = resolve(arg);
  if (existsSync(direct)) return direct;
  const bySlug = join(grillingRoot(), arg);
  if (existsSync(bySlug)) return bySlug;
  die(`找不到 issue 目录：${arg}`);
}

// ─────────────────────────────── init ───────────────────────────────

function cmdInit(argv) {
  const slug = argv[0];
  if (!slug || slug.startsWith('--')) die('用法：init <date>-<任务词组> [--request <原话>]');
  const flags = parseFlags(argv.slice(1));
  const dir = join(grillingRoot(), slug);

  const fresh = !existsSync(manifestPath(dir));
  for (const sub of ['1-interview', '2-prototype', '3-contract']) {
    mkdirSync(join(dir, sub), { recursive: true });
  }

  // 幂等：已存在就只读出当前状态，一个字节都不覆盖。
  const manifest = fresh ? blankManifest(slug) : readManifest(dir);
  if (fresh || (typeof flags.request === 'string' && !manifest.original_request)) {
    if (typeof flags.request === 'string') manifest.original_request = flags.request;
    writeManifest(dir, manifest);
  }

  console.log(`dir:   ${dir}`);
  console.log(`slug:  ${manifest.slug}`);
  console.log(`stage: ${manifest.stage}  (${fresh ? '新建' : '已存在，续跑'})`);
  for (const s of STAGES) console.log(`  ${s}: ${manifest.stage_gates[s].status}`);
  if (manifest.next_action) console.log(`next:  ${manifest.next_action}`);
  return 0;
}

// ─────────────────────────────── round ───────────────────────────────

function cmdRound(argv) {
  const dir = resolveIssueDir(argv[0]);
  const raw = argv[1];
  if (!raw) die('用法：round <dir> \'<一行 JSON>\'');
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    die(`round 的参数不是合法 JSON：${e.message}`);
  }
  if (!obj.ts) obj.ts = iso();
  mkdirSync(dirname(roundsPath(dir)), { recursive: true });
  // 追加一行是单次 O_APPEND 写，短行天然原子；这是并发点上唯一安全的写法。
  appendFileSync(roundsPath(dir), `${JSON.stringify(obj)}\n`, 'utf8');
  console.log(`appended → ${roundsPath(dir)}`);
  return 0;
}

// ─────────────────────────────── stage ───────────────────────────────

function cmdStage(argv) {
  const dir = resolveIssueDir(argv[0]);
  const stage = argv[1];
  const status = argv[2];
  if (!STAGES.includes(stage)) die(`阶段名必须是 ${STAGES.join(' / ')}`);
  if (!STATUSES.includes(status)) die(`状态必须是 ${STATUSES.join(' / ')}`);
  const flags = parseFlags(argv.slice(3));

  const m = readManifest(dir);
  const gate = m.stage_gates[stage] || {};
  gate.status = status;
  if (status === 'done' || status === 'skipped') gate.closed_at = iso();
  if (typeof flags.assessment === 'string') {
    try {
      gate.self_assessment = JSON.parse(flags.assessment);
    } catch {
      die('--assessment 必须是合法 JSON，例如 \'{"意图":"已定","结果":"已定"}\'');
    }
  }
  if (typeof flags.artifacts === 'string') {
    gate.artifacts_confirmed = flags.artifacts.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (typeof flags.reason === 'string') gate.reason = flags.reason;
  m.stage_gates[stage] = gate;

  if (typeof flags.next === 'string') m.next_action = flags.next;
  if (typeof flags.goal === 'string') m.goal_oneline = flags.goal;
  if (typeof flags.target === 'string') m.target = flags.target;
  if (typeof flags.request === 'string') m.original_request = flags.request;
  if (typeof flags['residual-risk'] === 'string') m.residual_risk = flags['residual-risk'];
  if (typeof flags.blocked === 'string') {
    m.blocked = flags.blocked.split('|').map((s) => s.trim()).filter(Boolean);
  }

  // 当前阶段推进到下一个未完成的阶段；needs_reinterview 打回第一阶段。
  if (status === 'needs_reinterview') {
    m.stage = STAGES[0];
    m.stage_gates[STAGES[0]].status = 'in_progress';
    // 回退时旧的 next_action 一定是陈旧的——它指向的正是刚被打回的那一步。
    if (typeof flags.next !== 'string') {
      m.next_action = `${stage} 撞出新歧义，回 /aes-interview 问清：${flags.reason || '见该阶段产物'}`;
    }
  } else if (status === 'done' || status === 'skipped') {
    const next = STAGES.find((s) => !['done', 'skipped'].includes(m.stage_gates[s].status));
    m.stage = next || stage;
    if (!next) m.status = 'ready';
  } else {
    m.stage = stage;
  }

  writeManifest(dir, m);
  console.log(`${stage} → ${status}；当前阶段 ${m.stage}`);
  if (m.next_action) console.log(`next: ${m.next_action}`);
  return 0;
}

// ─────────────────────────────── verify ───────────────────────────────

/**
 * 抽出 contract.md 里全部 [A] 档 Verify 命令。
 * 只抽 [A]：[B] 要 fixture 就位，[C] 是人工步骤，[D] 的判据写在自然语言里抽不干净。
 * 硬抽剩下三档只会制造假绿。
 */
function extractTierACommands(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let currentAc = null;
  for (const line of lines) {
    const ac = /^\s*-\s*(AC-\d{3})\s*:/.exec(line);
    if (ac) currentAc = ac[1];
    const v = /^\s*-\s*Verify\s*:\s*\[A\]\s*(.+)$/.exec(line);
    if (!v) continue;
    const cmd = /`([^`]+)`/.exec(v[1]);
    out.push({ ac: currentAc || '(未编号)', command: cmd ? cmd[1] : null, raw: v[1].trim() });
  }
  return out;
}

/** 区分「跑起来了但失败」和「根本跑不起来」——后者说明 AC 写错了。 */
function classify(res) {
  if (res.error) return 'unrunnable';
  const stderr = `${res.stderr || ''}`;
  if (res.status === 127 || res.status === 9009) return 'unrunnable';
  if (/not recognized as an internal or external command|command not found|: not found|无法将.+项识别为/i.test(stderr)) {
    return 'unrunnable';
  }
  return res.status === 0 ? 'green' : 'red';
}

function cmdVerify(argv) {
  const dir = resolveIssueDir(argv[0]);
  const flags = parseFlags(argv.slice(1));
  const cpath = contractPath(dir);
  if (!existsSync(cpath)) die(`${cpath} 不存在，没有可跑的验收条件。`);

  const items = extractTierACommands(readFileSync(cpath, 'utf8'));
  if (items.length === 0) {
    console.log('契约里没有 [A] 档 Verify，无可执行项。');
    return 0;
  }

  const cwd = repoRoot();
  const report = [`# verify @ ${iso()}`, `# cwd: ${cwd}`, ''];
  const tally = { green: 0, red: 0, unrunnable: 0 };

  for (const item of items) {
    if (!item.command) {
      tally.unrunnable += 1;
      report.push(`[UNRUNNABLE] ${item.ac}  抽不出命令（反引号里没东西）：${item.raw}`);
      continue;
    }
    const res = spawnSync(item.command, { cwd, shell: true, encoding: 'utf8', timeout: 300000 });
    const verdict = classify(res);
    tally[verdict] += 1;
    const label = { green: 'PASS', red: 'FAIL', unrunnable: 'UNRUNNABLE' }[verdict];
    report.push(`[${label}] ${item.ac}  exit=${res.status ?? 'n/a'}  $ ${item.command}`);
    const tail = `${res.stderr || res.stdout || ''}`.trim().split(/\r?\n/).slice(-3);
    for (const l of tail) if (l) report.push(`         ${l}`);
  }

  report.push('', `绿 ${tally.green} / 红 ${tally.red} / 跑不起来 ${tally.unrunnable}`);
  const text = report.join('\n');
  console.log(text);

  if (flags.write) {
    const out = join(dir, '3-contract', 'verify.txt');
    writeFileSync(out, `${text}\n`, 'utf8');
    console.log(`\n→ ${out}`);
  }

  if (tally.unrunnable > 0) {
    console.error('\n有 [A] 档命令根本跑不起来。这不是「功能还没做」，是 AC 写错了：');
    console.error('命令名、包名或脚本名不存在。回去改 contract.md，别让执行 Agent 撞上它。');
    return 1;
  }
  return 0;
}

// ─────────────────────────────── rebuild ───────────────────────────────

function cmdRebuild(argv) {
  const dir = resolveIssueDir(argv[0]);
  const slug = basename(dir);
  let m;
  try {
    m = JSON.parse(readFileSync(manifestPath(dir), 'utf8'));
  } catch {
    m = blankManifest(slug);
    console.log('manifest 缺失或损坏，从目录扫描重建（original_request 等纯记录字段无法恢复）。');
  }

  const has = (...p) => existsSync(join(dir, ...p));
  const gates = m.stage_gates || {};

  const interviewDone = has('1-interview', 'context.md') && has('1-interview', 'rounds.jsonl');
  gates['1-interview'] = { ...(gates['1-interview'] || {}), status: interviewDone ? 'done' : 'in_progress' };

  const confirmed = ['behavior', 'api-mock', 'example-run', 'mock']
    .filter((n) => has('2-prototype', n === 'mock' ? 'mock.html' : `${n}.md`));
  if (has('2-prototype', 'impact-surface.md')) {
    gates['2-prototype'] = { ...(gates['2-prototype'] || {}), status: 'done', artifacts_confirmed: confirmed };
  } else {
    gates['2-prototype'] = { ...(gates['2-prototype'] || {}), status: 'pending' };
  }

  gates['3-contract'] = { ...(gates['3-contract'] || {}), status: has('3-contract', 'contract.md') ? 'done' : 'pending' };

  m.slug = slug;
  m.stage_gates = gates;
  m.stage = STAGES.find((s) => !['done', 'skipped'].includes(gates[s].status)) || STAGES[STAGES.length - 1];

  const rounds = existsSync(roundsPath(dir))
    ? readFileSync(roundsPath(dir), 'utf8').split(/\r?\n/).filter(Boolean).length
    : 0;

  writeManifest(dir, m);
  console.log(`重建完成：stage=${m.stage}，rounds.jsonl ${rounds} 行`);
  for (const s of STAGES) console.log(`  ${s}: ${gates[s].status}`);
  return 0;
}

// ─────────────────────────────── finalize ───────────────────────────────

function extractSection(md, heading) {
  const re = new RegExp(`^##\\s+${heading}\\s*$`, 'm');
  const start = re.exec(md);
  if (!start) return null;
  const rest = md.slice(start.index + start[0].length);
  const end = /^##\s+/m.exec(rest);
  return (end ? rest.slice(0, end.index) : rest).trim();
}

function cmdFinalize(argv) {
  const dir = resolveIssueDir(argv[0]);
  const cpath = contractPath(dir);
  if (!existsSync(cpath)) die(`${cpath} 不存在。`);
  const md = readFileSync(cpath, 'utf8');
  const m = readManifest(dir);
  let failed = false;

  // 1. 结构校验
  const validator = join(HERE, 'validate-goal-contract.mjs');
  const vres = spawnSync(process.execPath, [validator, cpath], { encoding: 'utf8' });
  process.stdout.write(vres.stdout || '');
  process.stderr.write(vres.stderr || '');
  const warnings = `${vres.stdout || ''}`.split(/\r?\n/).filter((l) => /WARNING/.test(l));
  const acCount = (md.match(/^\s*-\s*AC-\d{3}\s*:/gm) || []).length;
  m.validation = {
    status: vres.status === 0 ? 'valid' : 'invalid',
    ac_count: acCount,
    warnings,
    ran_at: iso(),
  };
  if (vres.status !== 0) failed = true;

  // 2. [A] 档冒烟。此刻期望全红——红是对的，跑不起来才是错的。
  console.log('\n─── [A] 档冒烟 ───');
  const smoke = cmdVerify([dir, '--write']);
  if (smoke !== 0) failed = true;

  // 3. 交接指令现场生成，不落盘：契约改了它就该跟着变。
  const goal = extractSection(md, '目标');
  const oneline = ((goal || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0] || '')
    .replace(/[。.！!]+$/, '');
  const handoff = `/goal 完成 ${cpath} 定义的目标：${oneline}。验收以该文档「验收条件」节全部 Verify 通过、「强约束」节全部保持为准。`;
  console.log('\n─── 交接指令 ───');
  console.log(handoff);
  if (handoff.length > GOAL_OBJECTIVE_LIMIT) {
    console.error(`\n交接指令 ${handoff.length} 字符，超过 codex create_goal 的 ${GOAL_OBJECTIVE_LIMIT} 上限。`);
    console.error('压缩契约「目标」节那一句话，别指望 codex 截断——它会直接拒收。');
    failed = true;
  }

  if (m.validation.status === 'valid' && !failed) {
    m.status = 'ready';
    m.next_action = `契约已就绪，把交接指令发给执行 Agent。契约：${cpath}`;
  }
  writeManifest(dir, m);
  return failed ? 1 : 0;
}

// ─────────────────────────────── list ───────────────────────────────

/** 扫描 grillingRoot() 下所有 issue，读出 list 需要的四个字段。 */
function scanIssueRows() {
  const root = grillingRoot();
  if (!existsSync(root)) return { root, rows: null };
  const rows = [];
  for (const name of readdirSync(root)) {
    const dir = join(root, name);
    if (!statSync(dir).isDirectory() || !existsSync(manifestPath(dir))) continue;
    try {
      const m = JSON.parse(readFileSync(manifestPath(dir), 'utf8'));
      rows.push({
        name,
        stage: m.stage || '?',
        status: m.status || '?',
        desc: (m.goal_oneline || m.original_request || '').slice(0, 40),
      });
    } catch {
      rows.push({ name, stage: '(manifest 损坏)', status: '-', desc: '跑 rebuild' });
    }
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return { root, rows };
}

function padRows(rows, cols) {
  const w = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c]).length)));
  return { w };
}

/** 旧格式原样保留：外部有脚本按固定列宽/列顺序 parse 这份纯文本输出，默认行为不能变。 */
function printFlat(rows) {
  const { w } = padRows(rows, ['name', 'stage', 'status']);
  for (const r of rows) {
    console.log(`${r.name.padEnd(w[0])}  ${r.stage.padEnd(w[1])}  ${r.status.padEnd(w[2])}  ${r.desc}`);
  }
}

/** --group：按 stage 分组，组内保持原来的排序和列格式，组头带数量。 */
function printGrouped(rows) {
  const order = [...STAGES, ...[...new Set(rows.map((r) => r.stage))].filter((s) => !STAGES.includes(s))];
  const { w } = padRows(rows, ['name', 'status']);
  for (const stage of order) {
    const group = rows.filter((r) => r.stage === stage);
    if (group.length === 0) continue;
    console.log(`── ${stage} (${group.length}) ──`);
    for (const r of group) {
      console.log(`  ${r.name.padEnd(w[0])}  ${r.status.padEnd(w[1])}  ${r.desc}`);
    }
  }
}

function cmdList(argv) {
  const flags = parseFlags(argv || []);
  if (typeof flags.stage === 'string' && !STAGES.includes(flags.stage)) {
    die(`--stage 必须是 ${STAGES.join(' / ')}`);
  }

  const { root, rows: allRows } = scanIssueRows();
  if (allRows === null) {
    console.log(`${root} 还不存在，没有任何 issue。`);
    return 0;
  }

  let rows = allRows;
  if (typeof flags.stage === 'string') rows = rows.filter((r) => r.stage === flags.stage);
  if (typeof flags.status === 'string') rows = rows.filter((r) => r.status === flags.status);

  if (rows.length === 0) {
    console.log(allRows.length === 0 ? '没有任何 issue。' : '没有符合筛选条件的 issue。');
    return 0;
  }

  if (flags.group) {
    printGrouped(rows);
  } else {
    printFlat(rows);
  }
  return 0;
}

// ─────────────────────────────── dispatch ───────────────────────────────

const [sub, ...rest] = process.argv.slice(2);
const table = {
  init: cmdInit,
  round: cmdRound,
  stage: cmdStage,
  verify: cmdVerify,
  rebuild: cmdRebuild,
  finalize: cmdFinalize,
  list: cmdList,
};

if (!sub || !table[sub]) {
  console.error('用法：session.mjs <init|round|stage|verify|rebuild|finalize|list> [args]');
  process.exit(2);
}
process.exit(table[sub](rest));
