#!/usr/bin/env node
/**
 * session.mjs — issue 目录的唯一写入者
 *
 * manifest.json 的 schema 只存在于这个文件里。三份子技能的 SKILL.md 都不复述它，
 * Agent 一律通过子命令更新，不用 Edit/Write 直接改 manifest.json。
 *
 *   init <slug> [--request <原话>]        建/读 issue 目录（幂等）
 *   round <dir> <json>                    追加一行到 rounds.jsonl（先过 schema 校验）
 *   stage <dir> <stage> <status> [flags]  推进阶段状态（done/skipped 先过结构闸门）
 *   verify <dir> [--write]                跑 contract.md 里全部 [A] 档命令
 *   rebuild <dir>                         从目录扫描重建 manifest
 *   finalize <dir>                        校验 + 冒烟 + 交接闸门 + 生成交接指令
 *   list                                  现扫全部 issue，输出一张表
 *
 * 退出码：0 成功 / 1 有问题需要处理 / 2 用法或路径错
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join, resolve, basename, relative, isAbsolute } from 'node:path';
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

// ─────────────────────────────── 阶段闸门校验 ───────────────────────────────
//
// 只验结构，不验质量：节齐不齐、行合不合 schema、文件在不在是机器能判的；问得好不好、
// mock 像不像只有用户能判，写进脚本只会造出为过检而写的仪式。产出方自查自报是自陈，
// 同一份检查在 stage done 时强制执行才是判据——和 finalize 拦 UNRUNNABLE、拦残留风险
// 对不上账是同一个信任模型。闸门只查本阶段自己的产物，不查上游阶段状态：子技能允许
// 被单独调用，上游门禁由编排器负责。

const ROUND_TIERS = ['default', 'confirm', 'ask'];
const ASSESS_DIMS = ['意图', '结果', '边界', '约束', '现状'];
const CONTEXT_SECTIONS = ['任务陈述', '用户提出的方案', '意图假设', '已查事实', '验证基建候选池', '四分类'];
const IMPACT_SURFACES = ['用户可见界面', '可观察行为', '可运行输出', '对外接口报文', '用户配置', '历史兼容性', '架构与依赖'];

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
    if (obj.options !== undefined) {
      if (!Array.isArray(obj.options) || obj.options.length === 0) {
        errs.push('options 要是非空数组。');
      } else {
        let sum = 0;
        let shapeOk = true;
        obj.options.forEach((o, i) => {
          if (!o || typeof o !== 'object' || !o.key || !o.text || typeof o.pct !== 'number') {
            shapeOk = false;
            errs.push(`options[${i}] 每项要有 key、text 和数字 pct。`);
          } else {
            sum += o.pct;
          }
        });
        // pct 是主观估计，卡整不卡准：±2 容差消掉凑整摩擦，整体给虚照样挡。
        if (shapeOk && Math.abs(sum - 100) > 2) {
          errs.push(`options 的 pct 加和是 ${sum}，要落在 100±2 内——百分比先决定分诊档位，给虚了会把该问的误分进默认区。`);
        }
      }
    }
  } else if (typeof obj.item !== 'string' || !obj.item.trim()) {
    errs.push(`${obj.tier} 行要带 item（定了什么）。`);
  }
  return errs;
}

function validateContextFile(dir) {
  const p = join(dir, '1-interview', 'context.md');
  if (!existsSync(p)) return ['1-interview/context.md 不存在。'];
  const content = readFileSync(p, 'utf8');
  const errs = [];
  for (const name of CONTEXT_SECTIONS) {
    if (!new RegExp(`^##\\s+${name}`, 'm').test(content)) {
      errs.push(`context.md 缺「## ${name}」一节。`);
    }
  }
  return errs;
}

function validateRoundsFile(dir) {
  const p = roundsPath(dir);
  if (!existsSync(p)) return ['1-interview/rounds.jsonl 不存在。'];
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

function validateAssessment(assessment) {
  if (!assessment || typeof assessment !== 'object') {
    return [`缺五维自评。用 --assessment 交齐：${ASSESS_DIMS.join('、')}。`];
  }
  const errs = [];
  for (const dim of ASSESS_DIMS) {
    if (!(dim in assessment)) errs.push(`自评缺维度「${dim}」。`);
    else if (assessment[dim] === '未定') errs.push(`自评维度「${dim}」停在「未定」，不能报 done。`);
  }
  return errs;
}

function validateImpactSurfaceFile(dir) {
  const p = join(dir, '2-prototype', 'impact-surface.md');
  if (!existsSync(p)) return ['2-prototype/impact-surface.md 不存在。'];
  const content = readFileSync(p, 'utf8');
  const errs = [];
  for (const s of IMPACT_SURFACES) {
    if (!content.includes(s)) {
      errs.push(`impact-surface.md 没提到影响面「${s}」。七面逐面扫，判「无」也要写下来。`);
    }
  }
  return errs;
}

/**
 * 架构与依赖是否判了「有」。判读取该面名后第一个 有/无（表格单元格或冒号后，
 * 兼容 **有** 加粗、面名加粗、判「有」写法）。判不出（只写字没写判定）不算
 * 「有」——闸门挡结构不挡判读质量。
 */
function architectureJudgedPresent(dir) {
  const p = join(dir, '2-prototype', 'impact-surface.md');
  if (!existsSync(p)) return false;
  const re = /架构与依赖\*{0,2}(?:\s*\|+\s*|\s*[：:]\s*)\*{0,2}(?:判\s*[「'\[]?\s*)?\*{0,2}(有|无)/;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    if (!line.includes('架构与依赖')) continue;
    const m = line.match(re);
    if (m && m[1] === '有') return true;
  }
  return false;
}

/** artifacts 名到确认版文件的映射；未知名字按 2-prototype/<name>[.md|.html] 找。 */
function missingArtifacts(dir, names) {
  const errs = [];
  for (const name of names) {
    const candidates = name === 'mock' ? ['mock.html'] : [`${name}.md`, `${name}.html`, name];
    if (!candidates.some((f) => existsSync(join(dir, '2-prototype', f)))) {
      errs.push(`--artifacts 列了「${name}」，但 2-prototype/ 下找不到对应文件（找过 ${candidates.join('、')}）。`);
    }
  }
  return errs;
}

/** rebuild 用：扫 2-prototype/ 根下的对照物（除影响面清单外的 .md/.html），名字去扩展名。 */
function scanArtifacts(dir) {
  const p = join(dir, '2-prototype');
  if (!existsSync(p)) return [];
  return readdirSync(p)
    .filter((f) => statSync(join(p, f)).isFile() && /\.(md|html)$/i.test(f) && !/^impact-surface\.md$/i.test(f))
    .map((f) => f.replace(/\.(md|html)$/i, ''));
}

function gateDone(dir, stage, gate, m) {
  if (stage === '1-interview') {
    return [
      ...validateContextFile(dir),
      ...validateRoundsFile(dir),
      ...validateAssessment(gate.self_assessment),
    ];
  }
  if (stage === '2-prototype') {
    const errs = validateImpactSurfaceFile(dir);
    // 影响面清单是扫描记录，不是给用户确认过的对照物——拿它填 --artifacts 是凑数。
    const artifacts = [];
    for (const n of gate.artifacts_confirmed || []) {
      if (/^impact-surface(\.md)?$/i.test(n)) {
        errs.push(`--artifacts 列了「${n}」，但影响面清单不是对照物，凑不了数。`);
      } else {
        artifacts.push(n);
      }
    }
    if (artifacts.length === 0) {
      errs.push('done 至少要用 --artifacts 列一份确认版对照物。七面全「无」该报 needs_reinterview；差异极小且用户文字确认过才是 skipped。');
    } else {
      errs.push(...missingArtifacts(dir, artifacts));
    }
    // 判「有」必出架构视图——这条承诺不靠自觉：判了「有」而清单没有 diagram.html，当场拦。
    // 名字按去扩展名比较（diagram / diagram.html 都认）；锚定 .html 本尊在盘，
    // 拿 diagram.md 顶名不算图（mock 特例同款思路，不动开放命名本体）。
    const diagramListed = artifacts.some((n) => n.replace(/\.(md|html)$/i, '').toLowerCase() === 'diagram');
    if (architectureJudgedPresent(dir) && !(diagramListed && existsSync(join(dir, '2-prototype', 'diagram.html')))) {
      errs.push('架构与依赖判「有」，--artifacts 必须包含 diagram（diagram.html 架构视图，diagram.md 顶名不算图）。确无拓扑变化就回 impact-surface.md 改判「无」，判「无」也要写下来。');
    }
    return errs;
  }
  // 3-contract：先 finalize 后 done。顺序反了，或 finalize 之后又改了契约，这道闸就是空的。
  const cpath = contractPath(dir);
  if (!existsSync(cpath)) return ['3-contract/contract.md 不存在。'];
  const errs = [];
  const v = m.validation;
  if (!v || v.status !== 'valid') {
    errs.push('finalize 还没通过（manifest.validation.status ≠ valid）。先跑 finalize 再报 done。');
  } else if (statSync(cpath).mtimeMs > Date.parse(v.ran_at) + 2000) {
    errs.push('contract.md 在上次 finalize 之后又改过。重跑 finalize，别让改动绕过校验和冒烟。');
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
  const schemaErrs = validateRoundObj(obj);
  if (schemaErrs.length > 0) {
    for (const e of schemaErrs) console.error(`round: ${e}`);
    die('这行不合 rounds.jsonl 的 schema（字段表见 aes-interview 的 SKILL.md），没有写入。', 1);
  }
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

  // 阶段闸门：done 不是自报的。产出方自查自报是自陈，这里当场验结构才是判据。
  if (status === 'done') {
    const gateErrs = gateDone(dir, stage, gate, m);
    if (gateErrs.length > 0) {
      for (const e of gateErrs) console.error(`gate: ${e}`);
      die(`${stage} 的阶段闸门没过，done 没有写入。挡的是结构不是质量，逐条补齐再来。`, 1);
    }
  }
  // 跳过是一次下注，finalize 会拿 reason 跟契约「残留风险」对账，没写理由就没法对。
  // skipped 的语义只在对照物阶段成立：差异极小且用户文字确认过。访谈或契约被跳过，
  // 工作流就没有产出了，却照样能点亮 ready——那是 done 闸门旁边的旁门，一并堵上。
  if (status === 'skipped') {
    if (stage !== '2-prototype') {
      die(`${stage} 不能 skipped：跳过访谈或契约，这个流程就没有产出了。走不下去用 needs_reinterview 打回。`, 1);
    }
    if (typeof gate.reason !== 'string' || !gate.reason.trim()) {
      die('skipped 必须带 --reason 写清为什么跳、赌的是什么。', 1);
    }
    // skipped 的前提是七面扫过了、只是差异极小——扫过的证据就是 impact-surface.md 在盘。
    const skipErrs = validateImpactSurfaceFile(dir);
    if (skipErrs.length > 0) {
      for (const e of skipErrs) console.error(`gate: ${e}`);
      die('skipped 不豁免七面扫描。理由写进 impact-surface.md（见 aes-prototype 的 SKILL.md），再来跳。', 1);
    }
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
 * 抽出 contract.md 里全部 Verify 行，连档位一起。
 *
 * 只有 [A] 会被真的执行：[B] 要 fixture 就位，[C] 是人工步骤，[D] 的判据写在自然语言里
 * 抽不干净，硬跑剩下三档只会制造假绿。但四档都要**数出来**——非 [A] 的那几条正是长时程
 * 执行里没有任何东西能反驳「我做完了」的地方，得让人看见有多少。
 */
function extractVerifyLines(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let currentAc = null;
  for (const line of lines) {
    const ac = /^\s*-\s*(AC-\d{3})\s*:/.exec(line);
    if (ac) currentAc = ac[1];
    const v = /^\s*-\s*Verify\s*:\s*\[([ABCD])\]\s*(.+)$/.exec(line);
    if (!v) continue;
    const cmd = /`([^`]+)`/.exec(v[2]);
    out.push({
      ac: currentAc || '(未编号)',
      tier: v[1],
      command: cmd ? cmd[1] : null,
      raw: v[2].trim(),
    });
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
    console.log(`契约里没有 [A] 档 Verify，无可执行项（另有 ${manual.length} 条非 [A] 档，本命令不跑）。`);
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
  if (manual.length > 0) {
    report.push(`另有 ${manual.length} 条非 [A] 档没跑：${manual.map((v) => `${v.ac} [${v.tier}]`).join('、')}`);
  }
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
  // skipped 是人裁决过的状态，盘上本来就没有对应产物，重扫不该把它冲掉。
  const keep = (s, next) => (gates[s]?.status === 'skipped' ? 'skipped' : next);

  // 判 done 用和 stage done 同一批结构校验，判定口径不分叉。
  // 只有五维自评例外：它只活在 manifest 里、盘上没有，rebuild 不因它降级；
  // 正常流转时 stage done 的闸门会查它。
  const interviewOk = validateContextFile(dir).length === 0 && validateRoundsFile(dir).length === 0;
  gates['1-interview'] = { ...(gates['1-interview'] || {}), status: keep('1-interview', interviewOk ? 'done' : 'in_progress') };

  // 对照物判定和 gateDone 同一口径（开放命名）：manifest 记过的清单先用 missingArtifacts
  // 复核；清单丢了（manifest 损坏重建）就扫目录，根下除影响面清单外的 .md/.html 都算。
  const recorded = (gates['2-prototype']?.artifacts_confirmed || [])
    .filter((n) => !/^impact-surface(\.md)?$/i.test(n));
  const confirmed = recorded.length > 0 && missingArtifacts(dir, recorded).length === 0
    ? recorded
    : scanArtifacts(dir);
  // 与 done 闸门同口径：判「有」而对照物缺 diagram.html 本尊，rebuild 同样不判 done。
  const archNeedsDiagram = architectureJudgedPresent(dir)
    && !(confirmed.some((n) => n.replace(/\.(md|html)$/i, '').toLowerCase() === 'diagram')
      && existsSync(join(dir, '2-prototype', 'diagram.html')));
  if (validateImpactSurfaceFile(dir).length === 0 && confirmed.length > 0 && !archNeedsDiagram) {
    gates['2-prototype'] = { ...(gates['2-prototype'] || {}), status: keep('2-prototype', 'done'), artifacts_confirmed: confirmed };
  } else {
    if (archNeedsDiagram) {
      console.log('2-prototype：架构与依赖判「有」但对照物缺 diagram.html，不判 done（与 done 闸门同口径）。');
    }
    gates['2-prototype'] = {
      ...(gates['2-prototype'] || {}),
      status: keep('2-prototype', has('2-prototype', 'impact-surface.md') ? 'in_progress' : 'pending'),
    };
  }

  const contractOk = has('3-contract', 'contract.md') && m.validation?.status === 'valid';
  gates['3-contract'] = {
    ...(gates['3-contract'] || {}),
    status: keep('3-contract', contractOk ? 'done' : (has('3-contract', 'contract.md') ? 'in_progress' : 'pending')),
  };

  m.slug = slug;
  m.stage_gates = gates;
  m.stage = STAGES.find((s) => !['done', 'skipped'].includes(gates[s].status)) || STAGES[STAGES.length - 1];
  // ready 是「三阶段全闭」的推论，rebuild 重算 gates 后必须跟着回落——闸门被降级时
  // 它若残留，list 会拿着 ready 的旧结论误导续跑判断。
  if (m.status === 'ready' && STAGES.some((s) => !['done', 'skipped'].includes(gates[s].status))) {
    m.status = 'in_progress';
  }

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
  console.log(`档位分布：[A] ${tiers.A} / [B] ${tiers.B} / [C] ${tiers.C} / [D] ${tiers.D}`);
  if (manual.length > 0) {
    console.log(`以下 ${manual.length} 条无法自动判定，长时程执行里只有执行 Agent 的自陈：`);
    for (const v of manual) console.log(`  ${v.ac} [${v.tier}] ${v.raw.slice(0, 64)}`);
    console.log('  这不是错。但它们不会在 /goal 每轮的完成审计里被反驳，交接时要当面说清哪几条得人来看。');
  }
  if (verifies.length > 0 && tiers.A === 0) {
    console.log('WARNING: 一条 [A] 档都没有。完成判定全部依赖自陈，长时程执行等于没有终止条件。');
    console.log('         回去看有没有哪条能升到 [A]；确实一条都升不了，就跟用户说清这次靠人验收。');
  }

  // 残留风险对账：manifest 记着赌过的东西，契约里却没有这一节时直接拒。
  // 契约会被单独拿走，manifest 不会跟着走——这一节缺失时，最先丢的就是它。
  const skippedStages = STAGES.filter((s) => m.stage_gates?.[s]?.status === 'skipped');
  if ((m.residual_risk || skippedStages.length > 0) && extractSection(md, '残留风险') === null) {
    console.error('\n这次访谈留了没问清的东西，但契约里没有「残留风险」这一节：');
    if (m.residual_risk) console.error(`  manifest 记着：${m.residual_risk}`);
    for (const s of skippedStages) {
      console.error(`  ${s} 被跳过：${m.stage_gates[s].reason || '未写理由'}`);
    }
    console.error('补一节写清没问清什么、错了会怎样，再 finalize。');
    failed = true;
  }

  // 4. 交接指令现场生成，不落盘：契约改了它就该跟着变。
  const goal = extractSection(md, '目标');
  const oneline = ((goal || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0] || '')
    .replace(/[。.！!]+$/, '');
  // 「自主边界」写了才进这一句：它决定执行 Agent 计划外情况下停不停手，是每 turn 重注入
  // 的 objective 里唯一值得多花的字符。没写就不提，免得指向一节不存在的内容。
  const autonomy = extractSection(md, '自主边界') === null
    ? ''
    : '计划外的事按该文档「自主边界」节自行判断。';
  const handoff = `/goal 完成 ${cpath} 定义的目标：${oneline}。验收以该文档「验收条件」节全部 Verify 通过、「强约束」节全部保持为准。${autonomy}`;
  console.log('\n─── 交接指令 ───');
  console.log(handoff);
  if (handoff.length > GOAL_OBJECTIVE_LIMIT) {
    console.error(`\n交接指令 ${handoff.length} 字符，超过 codex create_goal 的 ${GOAL_OBJECTIVE_LIMIT} 上限。`);
    console.error('压缩契约「目标」节那一句话，别指望 codex 截断——它会直接拒收。');
    failed = true;
  }

  m.validation.verify_tiers = tiers;
  if (m.validation.status === 'valid' && !failed) {
    m.status = 'ready';
    m.next_action = `契约已就绪，把交接指令发给执行 Agent。契约：${cpath}`;
  }
  writeManifest(dir, m);
  return failed ? 1 : 0;
}

// ─────────────────────────────── list ───────────────────────────────

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
      rows.push([name, m.stage || '?', m.status || '?', (m.goal_oneline || m.original_request || '').slice(0, 40)]);
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
