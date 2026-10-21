#!/usr/bin/env node
/**
 * session.mjs — issue 目录的唯一写入者
 *
 * manifest.json 的 schema 只存在于这个文件里。三份子技能的 SKILL.md 都不复述它，
 * Agent 一律通过子命令更新，不用 Edit/Write 直接改 manifest.json。
 *
 *   init <slug> [--request <原话>]        建/读 issue 目录（幂等）
 *   round <dir> <json>                    追加一行到 rounds.jsonl（先过 schema 校验）
 *   stage <dir> <stage> <status> [flags]  记录职责状态（检查记录与引用有效性）
 *   verify <dir> [--write]                跑 contract.md 里全部 [A] 档段（含内嵌）；
 *                                         --write 落 verify-evidence.txt，不碰冒烟快照
 *   rebuild <dir>                         恢复已有状态，不由文件存在推断确认
 *   finalize <dir>                        校验 + 冒烟 + 交接闸门 + 生成交接指令
 *   list                                  现扫全部 issue，输出一张表
 *
 * 退出码：0 成功 / 1 有问题需要处理 / 2 用法或路径错
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join, resolve, basename, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { contractDigests, validationIsCurrent } from './lib/validation.mjs';

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

// ─────────────────────────────── 阶段闸门校验 ───────────────────────────────
//
// 阶段完成是宿主对已知授权与内容的声明；校验器只检查记录和所引用的工件，
// 不从文件名、自评分或问法推断用户确认。

const ROUND_TIERS = ['default', 'confirm', 'ask'];
/** 结构化应答类型，与 workflow-interview-web 的发布 schema 同源（web-protocol.md）。 */
const RESPONSE_TYPES = ['single_select', 'multi_select', 'boolean', 'short_text', 'long_text', 'number', 'date_time', 'ranking', 'evidence'];

function validateRoundObj(obj) {
  const errs = [];
  if (!STAGES.includes(obj.stage)) {
    errs.push(`stage 要是 ${STAGES.join(' / ')} 之一，现在是 ${JSON.stringify(obj.stage ?? null)}。`);
  }
  if (obj.round === undefined || obj.round === null || Number.isNaN(Number(obj.round))) {
    errs.push('round 要写这是第几轮（数字）。');
  }
  if (!ROUND_TIERS.includes(obj.tier)) {
    errs.push(`tier 要是 ${ROUND_TIERS.join(' / ')} 之一，现在是 ${JSON.stringify(obj.tier ?? null)}。`);
  } else if (obj.tier === 'ask') {
    if (typeof obj.question !== 'string' || !obj.question.trim()) errs.push('ask 行要带 question。');
    const responseType = obj.response?.type ?? 'single_select';
    if (obj.response !== undefined) {
      if (!obj.response || typeof obj.response !== 'object' || Array.isArray(obj.response)) {
        errs.push('response 要是对象。');
      } else if (!RESPONSE_TYPES.includes(responseType)) {
        errs.push(`response.type 要是 ${RESPONSE_TYPES.join(' / ')} 之一，现在是 ${JSON.stringify(responseType)}。`);
      }
    }
    if (obj.options !== undefined) {
      if (!Array.isArray(obj.options) || obj.options.length === 0) {
        errs.push('options 要是非空数组。');
      } else {
        obj.options.forEach((o, i) => {
          if (!o || typeof o !== 'object' || !o.key || !o.text) {
            errs.push(`options[${i}] 每项要有 key 和 text。`);
            return;
          }
          if (o.pct !== undefined && !Number.isFinite(o.pct)) {
            errs.push(`options[${i}] 的 pct 要是数字。`);
          }
        });
      }
    }
  } else if (typeof obj.item !== 'string' || !obj.item.trim()) {
    errs.push(`${obj.tier} 行要带 item（定了什么）。`);
  }
  return errs;
}

function validateRoundsFile(dir) {
  const p = roundsPath(dir);
  if (!existsSync(p)) return [];
  const errs = [];
  readFileSync(p, 'utf8').split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      errs.push(`rounds.jsonl 第 ${i + 1} 行不是合法 JSON。`);
      return;
    }
    for (const e of validateRoundObj(obj)) errs.push(`rounds.jsonl 第 ${i + 1} 行：${e}`);
  });
  return errs;
}

/** artifacts 名到确认版文件的映射；未知名字按 2-prototype/<name>[.md|.html] 找。 */
function missingArtifacts(dir, names) {
  const errs = [];
  for (const name of names) {
    const candidates = [name, `${name}.md`, `${name}.html`];
    if (!candidates.some((f) => existsSync(join(dir, '2-prototype', f)))) {
      errs.push(`--artifacts 列了「${name}」，但 2-prototype/ 下找不到对应文件（找过 ${candidates.join('、')}）。`);
    }
  }
  return errs;
}

function gateDone(dir, stage, gate, m) {
  if (stage === '1-interview') {
    return validateRoundsFile(dir);
  }
  if (stage === '2-prototype') {
    return missingArtifacts(dir, gate.artifacts_confirmed || []);
  }
  // 3-contract：先 finalize 后 done。顺序反了，或 finalize 之后又改了契约，这道闸就是空的。
  const cpath = contractPath(dir);
  if (!existsSync(cpath)) return ['3-contract/contract.md 不存在。'];
  const errs = [];
  const v = m.validation;
  if (!v || v.status !== 'valid' || v.stale) {
    errs.push('finalize 还没通过（manifest.validation.status ≠ valid）。先跑 finalize 再报 done。');
  } else {
    if (!validationIsCurrent(dir, v)) errs.push('契约在上次 finalize 之后又改过。重跑 finalize。');
  }
  return errs;
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
  // min/max 是文档写法，落盘统一成 min_selections/max_selections（与 web publish 同规则），
  // 两名并存且不一致直接拒——静默取其一等于替用户改了约束。
  if (obj.response?.type === 'multi_select') {
    for (const [documented, canonical] of [['min', 'min_selections'], ['max', 'max_selections']]) {
      if (obj.response[documented] === undefined) continue;
      if (obj.response[canonical] === undefined) obj.response[canonical] = obj.response[documented];
      else if (obj.response[canonical] !== obj.response[documented]) {
        die(`response.${documented} 与 ${canonical} 同时存在且不一致，没有写入。`, 1);
      }
      delete obj.response[documented];
    }
  }
  const schemaErrs = validateRoundObj(obj);
  if (schemaErrs.length > 0) {
    for (const e of schemaErrs) console.error(`round: ${e}`);
    die('这行不合 rounds.jsonl 的 schema（字段表见 workflow-interview/references/session.md），没有写入。', 1);
  }
  mkdirSync(dirname(roundsPath(dir)), { recursive: true });
  // 追加一行是单次 O_APPEND 写，短行天然原子；这是并发点上唯一安全的写法。
  appendFileSync(roundsPath(dir), `${JSON.stringify(obj)}\n`, 'utf8');
  console.log(`appended → ${roundsPath(dir)}`);
  return 0;
}

// ─────────────────────────────── stage ───────────────────────────────

function contractIsBlocked(dir) {
  const path = join(dir, '3-contract', 'contract.md');
  return existsSync(path) && /^- Status:\s*Blocked\s*$/mi.test(readFileSync(path, 'utf8'));
}

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

  // done 声明内容已对齐；机器检查记录有效，不检查固定材料是否齐套。
  if (status === 'done') {
    const gateErrs = gateDone(dir, stage, gate, m);
    if (gateErrs.length > 0) {
      for (const e of gateErrs) console.error(`gate: ${e}`);
      die(`${stage} 的记录或引用无效，done 没有写入。`, 1);
    }
  }
  // 不单独制作对照物不等于存在风险；实际未解决的风险用 residual-risk 记录。
  if (status === 'skipped') {
    if (stage !== '2-prototype') {
      die(`${stage} 不能 skipped：跳过访谈或契约，这个流程就没有产出了。走不下去用 needs_reinterview 打回。`, 1);
    }
    if (typeof gate.reason !== 'string' || !gate.reason.trim()) {
      die('skipped 必须带 --reason 写清为什么跳、赌的是什么。', 1);
    }
    const skipErrs = missingArtifacts(dir, gate.artifacts_confirmed || []);
    if (skipErrs.length > 0) die(skipErrs.join('\n'), 1);
  }

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
    // 打回撤销的不只是阶段：顶层 ready 和 validation 描述的都是被打回前的那份契约。
    // 残留着，list 和续跑判断就会拿旧结论误导（2026-08-31 实锤：打回后 status 仍 ready、
    // validation 仍是打回前的存量）。ready 回落、validation 标 stale（不删历史）。
    if (m.status === 'ready' || m.status === 'blocked') m.status = 'in_progress';
    if (m.validation) {
      m.validation.stale = true;
      m.validation.stale_reason = flags.reason || `${stage} 被打回`;
    }
    delete gate.closed_at;
    gate.reverted_at = iso();
    // 回退时旧的 next_action 一定是陈旧的——它指向的正是刚被打回的那一步。
    if (typeof flags.next !== 'string') {
      m.next_action = `${stage} 撞出新歧义，回 /aes-interview 问清：${flags.reason || '见该阶段产物'}`;
    }
  } else if (status === 'done' || status === 'skipped') {
    const next = STAGES.find((s) => !['done', 'skipped'].includes(m.stage_gates[s].status));
    m.stage = next || stage;
    if (!next) m.status = contractIsBlocked(dir) ? 'blocked'
      : (validationIsCurrent(dir, m.validation) ? 'ready' : 'in_progress');
  } else {
    m.stage = stage;
    if (m.status === 'ready') m.status = 'in_progress';
  }

  writeManifest(dir, m);
  console.log(`${stage} → ${status}；当前阶段 ${m.stage}`);
  if (m.next_action) console.log(`next: ${m.next_action}`);
  return 0;
}

// ─────────────────────────────── verify ───────────────────────────────

/**
 * 抽出 contract.md 里全部 Verify 行，按行内 [X] 标记切段。
 *
 * 一行 Verify 可以挂多档（「[C] 人工步骤…；[A] `命令` → 退出码」）：首档是主档，
 * 后续标记是内嵌段。只有 [A] 段会被真的执行（含内嵌）：[B] 要 fixture 就位、[C] 是
 * 人工步骤、[D] 的判据写在自然语言里抽不干净，硬跑剩下三档只会制造假绿。但四档都要
 * **数出来**——非 [A] 的段正是长时程执行里没有任何东西能反驳「我做完了」的地方。
 * 只认首档会让内嵌 [A] 既不被冒烟也不被点名，报告上却与通过长得一模一样（首档遮蔽）。
 */
function extractVerifyLines(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let currentAc = null;
  for (const line of lines) {
    const ac = /^\s*-\s*(AC-\d{3})\s*:/.exec(line);
    if (ac) currentAc = ac[1];
    const v = /^\s*-\s*Verify\s*:\s*(.+)$/.exec(line);
    if (!v) continue;
    const rest = v[1];
    const marks = [...rest.matchAll(/\[([ABCD])\]/g)];
    // 首个档位标记必须在行首——没标档位的行由 validate-goal-contract.mjs 拦，这里不猜。
    if (marks.length === 0 || marks[0].index !== 0) continue;
    for (let i = 0; i < marks.length; i += 1) {
      const segStart = marks[i].index + marks[i][0].length;
      const segEnd = i + 1 < marks.length ? marks[i + 1].index : rest.length;
      const seg = rest.slice(segStart, segEnd).trim();
      const cmd = /`([^`]+)`/.exec(seg);
      out.push({
        ac: currentAc || '(未编号)',
        tier: marks[i][1],
        command: cmd ? cmd[1] : null,
        raw: seg,
        embedded: i > 0,
      });
    }
  }
  return out;
}

function tallyTiers(verifies) {
  const tiers = { A: 0, B: 0, C: 0, D: 0 };
  for (const v of verifies) tiers[v.tier] += 1;
  return tiers;
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

  const verifies = extractVerifyLines(readFileSync(cpath, 'utf8'));
  const items = verifies.filter((v) => v.tier === 'A');
  const manual = verifies.filter((v) => v.tier !== 'A');
  if (items.length === 0) {
    console.log(`契约里没有 [A] 档 Verify 段，无可执行项（另有 ${manual.length} 段非 [A] 档，本命令不跑）。`);
    return 0;
  }

  const cwd = repoRoot();
  const report = [`# verify @ ${iso()}`, `# cwd: ${cwd}`, ''];
  const tally = { green: 0, red: 0, unrunnable: 0 };

  for (const item of items) {
    const acLabel = item.embedded ? `${item.ac} [A·内嵌]` : item.ac;
    if (!item.command) {
      tally.unrunnable += 1;
      report.push(`[UNRUNNABLE] ${acLabel}  抽不出命令（段内反引号里没东西）：${item.raw}`);
      continue;
    }
    const res = spawnSync(item.command, { cwd, shell: true, encoding: 'utf8', timeout: 300000 });
    const verdict = classify(res);
    tally[verdict] += 1;
    const label = { green: 'PASS', red: 'FAIL', unrunnable: 'UNRUNNABLE' }[verdict];
    report.push(`[${label}] ${acLabel}  exit=${res.status ?? 'n/a'}  $ ${item.command}`);
    const tail = `${res.stderr || res.stdout || ''}`.trim().split(/\r?\n/).slice(-3);
    for (const l of tail) if (l) report.push(`         ${l}`);
  }

  report.push('', `绿 ${tally.green} / 红 ${tally.red} / 跑不起来 ${tally.unrunnable}`);
  if (manual.length > 0) {
    report.push(`另有 ${manual.length} 段非 [A] 档没跑：${manual.map((v) => `${v.ac} [${v.tier}]${v.embedded ? '·内嵌' : ''}`).join('、')}`);
  }
  const text = report.join('\n');
  console.log(text);

  if (flags.write) {
    // 冒烟快照（finalize 时跑，期望全红）与完成证据（实现后复验，期望转绿）语义相反，
    // 共用一个文件只会互相覆盖——红态证据最后只剩 git 史。分开落盘，谁也不覆盖谁。
    const out = join(dir, '3-contract', flags.smoke ? 'verify.txt' : 'verify-evidence.txt');
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

  // 文件存在只证明有材料，不能恢复丢失的用户确认。
  const gates = m.stage_gates || {};
  for (const stage of STAGES) {
    const gate = gates[stage] || { status: 'pending' };
    if (['done', 'skipped'].includes(gate.status)) {
      const errors = stage === '2-prototype'
        ? missingArtifacts(dir, gate.artifacts_confirmed || [])
        : gateDone(dir, stage, gate, m);
      if (errors.length) {
        gate.status = 'in_progress';
        console.log(stage + '：' + errors.join('；'));
      }
    }
    gates[stage] = gate;
  }
  m.slug = slug;
  m.stage_gates = gates;
  m.stage = STAGES.find((stage) => !['done', 'skipped'].includes(gates[stage].status)) || STAGES.at(-1);
  m.status = STAGES.every((stage) => ['done', 'skipped'].includes(gates[stage].status))
    && validationIsCurrent(dir, m.validation)
    ? (contractIsBlocked(dir) ? 'blocked' : 'ready') : 'in_progress';
  if (m.status !== 'ready' && m.status !== 'blocked') m.next_action = '核对已有授权与未完成内容；不要从文件存在推断确认。';

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

/** 人验软闸用：Verify 段是否疑似以人的确认为通过条件——人称词与认可词邻近共现，
 *  或「等/待……确认」句式。「用户确认版」是合法语境（确认版对照物），先剔除再判。
 *  词级检测必带误伤，只点名不拒绝；真正的防线在 shape 文档的起草规则。 */
const HUMAN_GATE_RE = /(用户|员工|人工|客户|真人|评审人?|主管|领导|老板)[^；;\n]{0,12}(确认|签字|审批|同意|点头)|(等|待)[^；;\n]{0,8}(确认|签字|审批|回复)/;

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
    contract_digests: contractDigests(dir),
    ran_at: iso(),
  };
  if (vres.status !== 0) failed = true;

  // 2. 冒烟检查命令入口；非零退出仍需结合失败原因判断，不能证明业务断言有效。
  console.log('\n─── [A] 档冒烟 ───');
  const smoke = cmdVerify([dir, '--write', '--smoke']);
  if (smoke !== 0) failed = true;
  // smoke 只在「命令根本跑不起来」时非 0（红是此刻的合法预期）。结构过了但冒烟崩了
  // 时 status 不能停在 valid——done 闸门只认 valid，残留 valid 等于给失败留了旁门
  // （2026-08-31 语料实锤：finalize 失败仍 valid → stage done 照样可过）。
  if (smoke !== 0) m.validation.status = 'invalid';

  // 3. 交接可执行性闸门。
  //    codex `/goal` 交接之后，执行 Agent 手上只有「一句话 + 一个路径」。所以路径读不到、
  //    完成判定全靠自陈、访谈里赌掉的风险没跟着走，这三件事一旦过了这道门就再无人可拦。
  console.log('\n─── 交接可执行性 ───');

  const root = repoRoot();
  // 用 relative 判包含：Windows 上盘符大小写不定（G:\ vs g:\），startsWith 会误报出仓。
  const rel = relative(root, cpath);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    console.log(`WARNING: 契约不在仓库根 ${root} 之下。`);
    console.log('         执行 Agent 的工作区通常就是仓库根。路径读不到时它不会报错，会只凭 objective');
    console.log('         那一句话硬编——表面在跑，实际整份契约失效。挪进仓库，或确认它访问得到这个路径。');
  }

  const verifies = extractVerifyLines(md);
  const tiers = tallyTiers(verifies);
  const manual = verifies.filter((v) => v.tier !== 'A');
  const acsWithA = new Set(verifies.filter((v) => v.tier === 'A').map((v) => v.ac));
  console.log(`档位分布（按段计，含内嵌）：[A] ${tiers.A} / [B] ${tiers.B} / [C] ${tiers.C} / [D] ${tiers.D}`);
  if (manual.length > 0) {
    console.log(`以下 ${manual.length} 段不由 finalize 自动执行，需要按约定核对相应证据：`);
    for (const v of manual) console.log(`  ${v.ac} [${v.tier}]${v.embedded ? '·内嵌' : ''} ${v.raw.slice(0, 64)}`);
    console.log('  档位不代表证据强弱；交接时说明已取得和未取得的证据，以及人工决定责任。');
  }
  // 人验软闸：Verify 段以人的确认为通过条件（用户/员工确认、签字、审批）。/goal 的
  // 完成审计永远无法判定它——烧 turn 到三连闸 blocked，或执行 Agent 假自陈完成。
  // 词级检测必带误伤（「用户确认版对照物」是合法语境），所以只点名不拒绝。
  const humanGated = verifies.filter((v) => !/确认版/.test(v.raw) && HUMAN_GATE_RE.test(v.raw));
  if (humanGated.length > 0) {
    console.log(`WARNING: 以下 ${humanGated.length} 段疑似以人的确认为通过条件：`);
    for (const v of humanGated) console.log(`  ${v.ac} [${v.tier}]${v.embedded ? '·内嵌' : ''} ${v.raw.slice(0, 64)}`);
    console.log('  /goal 的完成审计无法判定人的确认：烧 turn 到三连闸 blocked，或假自陈完成。');
    console.log('  需真人决定的要求保留待人验；可用真实确认凭证承接，或改用会话式交接，不得自行移出完成条件。');
  }
  if (verifies.length > 0 && acsWithA.size === 0) {
    console.log('提示：没有 [A] 命令段；finalize 不执行这些验证，请核对可复核证据与待验责任。');
    console.log('         验证方式由任务承诺决定，不为档位补命令；需真人确认的不能由 Agent 代答。');
    console.log('         只有既有授权允许交付后复核时才如此安排；否则保留未满足要求。');
  }

  // 不从 mock 文件名或提问关键词推断验收口径；口径由已有授权与契约明确。
  if (m.residual_risk && extractSection(md, '残留风险') === null) {
    console.error('manifest 记有残留风险，但契约未携带：' + m.residual_risk);
    failed = true;
  }

  // 4. 交接指令现场生成，不落盘：契约改了它就该跟着变。
  const goal = extractSection(md, '目标');
  const oneline = (goal || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean).join(' ')
    .replace(/[。.！!]+$/, '');
  // 「自主边界」写了才进这一句：它决定执行 Agent 计划外情况下停不停手，是每 turn 重注入
  // 的 objective 里唯一值得多花的字符。没写就不提，免得指向一节不存在的内容。
  const autonomy = extractSection(md, '自主边界') === null
    ? ''
    : '计划外的事按该文档「自主边界」节自行判断。';
  const handoff = `/goal 完成 ${cpath} 定义的目标：${oneline}。先读完整契约及引用，结合原始背景、范围和确认的对照物理解期望结果。完成须有证据支持目标、全部已确认验收条件及强约束；Verify 全过不能覆盖已发现的目标偏差。围绕目标和实际影响选择验证，考虑准备、执行、诊断和维护的时间成本；不擅自降低已确认的要求。${autonomy}`;
  console.log('\n─── 交接指令 ───');
  if (handoff.length > GOAL_OBJECTIVE_LIMIT) {
    console.log(`按 ${cpath} 执行。先完整阅读契约及引用，按会话式交接模板完成目标、全部已确认验收条件及强约束；不要以 Verify 全过覆盖已发现的目标偏差。`);
    console.log(`WARNING: /goal 指令 ${handoff.length} 字符，超过本地 ${GOAL_OBJECTIVE_LIMIT} 字符兼容限制，已改用会话式交接；契约内容未删减。`);
  } else {
    console.log(handoff);
  }

  // 已授权安排在交付后的人工复核作为用户待办列出，不代替尚未满足的完成条件。
  const postReview = extractSection(md, '交付后人工复核');
  if (postReview) {
    const items = postReview.split(/\r?\n/).filter((line) => /^-\s+/.test(line));
    if (items.length > 0) {
      console.log('\n─── 交付后人工复核（用户待办，不属于执行 Agent 完成判定）───');
      for (const line of items) console.log(line.replace(/^-\s+/, '').trim());
      console.log('  交给用户本人；此安排应已有授权，清单存在不表示其中要求已经满足。');
    }
  }

  m.validation.verify_tiers = tiers;
  if (m.validation.status === 'valid' && !failed) {
    const blocked = /^- Status:\s*Blocked\s*$/mi.test(md);
    m.blocked = blocked
      ? (extractSection(md, '挡着的事') || '').split(/\r?\n/)
        .filter((line) => /^-\s+/.test(line))
        .map((line) => line.replace(/^-\s+/, '').trim())
      : [];
    const closed = STAGES.every((stage) => ['done', 'skipped'].includes(m.stage_gates?.[stage]?.status));
    m.status = blocked ? 'blocked' : (closed ? 'ready' : 'in_progress');
    m.next_action = blocked
      ? `契约已校验，但仍有阻塞项；解除后重新核验再交接。契约：${cpath}`
      : `契约机器校验已通过；核对已有授权后用 stage done 声明交接就绪。契约：${cpath}`;
    // 重新走完全部闸门的这份 validation 是现行的，打回标记随之解除。
    delete m.validation.stale;
    delete m.validation.stale_reason;
  } else {
    // 失败分支同步提示：否则 status 残留 ready、next_action 还是旧的「发给执行 Agent」，
    // list 裸显 ready 误导交接（2026-10-20 语料：done 后修订、重 finalize 失败的场景）。
    m.validation.status = 'invalid';
    m.status = 'in_progress';
    m.next_action = `finalize 未通过：按上方失败项修正契约后重跑。契约：${cpath}`;
  }
  writeManifest(dir, m);
  return failed ? 1 : 0;
}

// ─────────────────────────────── list ───────────────────────────────

/** list 用：契约相对上次 finalize 是否已过期。定位为提示不是判据——mtime 受
 *  checkout/合并触碰污染（2026-08-31 语料：八份契约同毫秒批量假偏移）。 */
function contractStaleNote(dir, m) {
  if (!m.validation || !m.validation.status) return '';
  if (m.validation.stale) return '⚠已打回待修订';
  // 非 valid（含 invalid）也要可见：否则残留 ready 在列表里裸奔（与 finalize 失败分支的
  // next_action 修复同案）。
  if (m.validation.status !== 'valid') return '⚠finalize未通过';
  if (!validationIsCurrent(dir, m.validation)) return '⚠契约改动晚于finalize';
  return '';
}

function cmdList() {
  const root = grillingRoot();
  if (!existsSync(root)) {
    console.log(`${root} 还不存在，没有任何 issue。`);
    return 0;
  }
  const rows = [];
  for (const name of readdirSync(root)) {
    const dir = join(root, name);
    if (!statSync(dir).isDirectory() || !existsSync(manifestPath(dir))) continue;
    try {
      const m = JSON.parse(readFileSync(manifestPath(dir), 'utf8'));
      rows.push([name, m.stage || '?', (m.status || '?') + contractStaleNote(dir, m), (m.goal_oneline || m.original_request || '').slice(0, 40)]);
    } catch {
      rows.push([name, '(manifest 损坏)', '-', '跑 rebuild']);
    }
  }
  if (rows.length === 0) {
    console.log('没有任何 issue。');
    return 0;
  }
  rows.sort((a, b) => a[0].localeCompare(b[0]));
  const w = [0, 1, 2].map((i) => Math.max(...rows.map((r) => r[i].length)));
  for (const r of rows) {
    console.log(`${r[0].padEnd(w[0])}  ${r[1].padEnd(w[1])}  ${r[2].padEnd(w[2])}  ${r[3]}`);
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
