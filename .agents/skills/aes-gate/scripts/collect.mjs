#!/usr/bin/env node
// aes-gate 采集与检测入口：读 run.toml（注册真源）+ 补扫 CI/hooks/本地链 → 逐门实跑定红绿
// → 六维评分 → 缺口清单 → 写 .aes-gate/gate-registry.json（history 追加）+ 渲染看板 + 落盘报告。
// 评分与档位规则的依据见 ../references/weights.md；接口契约见 ../references/api.md。
// 用法：
//   node collect.mjs [--repo <路径>] [--timeout <秒>]      # 批量检测（默认，落盘报告+registry+看板）
//   node collect.mjs --handoff [--repo <路径>] [--json]     # aes-qa 精简回传：跑检测但不落盘任何文件
//   node collect.mjs --self-test                            # 内置正反样例自测，不碰真实仓库
// 退出码：0=检测完成（红门不改退出码，红门进报告置顶）；2=BLOCKED（目标不可读/非 git 仓）；1=内部错误。
import { spawnSync } from 'node:child_process';
import {
  accessSync, constants, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const parseToml = require('./vendor/toml/index.cjs').parse;

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const SKILL_DIR = dirname(SCRIPT_DIR);
// 目标仓根：--repo > AES_GATE_REPO_ROOT > 当前目录。技能目录本身不是目标仓。
export const repoRootFrom = (explicit) => resolve(explicit || process.env.AES_GATE_REPO_ROOT || process.cwd());
const GATE_DIR_NAME = '.aes-gate';
const DEFAULT_TIMEOUT_MS = 300_000;

export const TIERS = ['hard', 'partial', 'paper'];
export const TIER_LABEL = { hard: '硬门禁', partial: '部分', paper: '纸面' };
const STATUS_LABEL = { green: '绿', red: '红', missing: '缺失', stale: '疑似过时' };

// ---------------------------------------------------------------------------
// 1) run.toml：注册真源（run/v1 标准，见 aes-standardize-repo/references/run-standard.md）
// ---------------------------------------------------------------------------

const RUN_ACTION_ID = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/;
const RUN_KINDS = ['task', 'open', 'test', 'gate'];
const RESERVED_IDS = ['list', 'show', 'doctor', 'help', 'run'];

export function parseRunToml(text, sourcePath = 'run.toml') {
  let raw;
  try {
    raw = parseToml(text);
  } catch (error) {
    const e = new Error(`${sourcePath} 不是合法 TOML：${error.message}`);
    e.code = 'BAD_TOML';
    throw e;
  }
  const errors = [];
  if (!raw.project || typeof raw.project.id !== 'string') errors.push('缺 [project].id');
  if (!Array.isArray(raw.actions) || raw.actions.length === 0) errors.push('缺 [[actions]]（至少一项）');
  const seen = new Set();
  const actions = Array.isArray(raw.actions) ? raw.actions : [];
  for (const a of actions) {
    if (typeof a.id !== 'string' || !RUN_ACTION_ID.test(a.id)) errors.push(`action id 非法：${a.id}`);
    else if (RESERVED_IDS.includes(a.id)) errors.push(`action id 是保留字：${a.id}`);
    else if (seen.has(a.id)) errors.push(`action id 重复：${a.id}`);
    else seen.add(a.id);
    if (!RUN_KINDS.includes(a.kind)) errors.push(`action ${a.id} kind 非法：${a.kind}（只允许 ${RUN_KINDS.join('/')}）`);
    if (!Array.isArray(a.run) || a.run.length === 0 || a.run.some((x) => typeof x !== 'string' || x === '')) {
      errors.push(`action ${a.id} run 必须是非空字符串数组`);
    }
    if (typeof a.name !== 'string' || a.name === '') errors.push(`action ${a.id} name 非空`);
  }
  if (errors.length > 0) {
    const e = new Error(`${sourcePath} 不满足 run/v1：\n  - ${errors.join('\n  - ')}`);
    e.code = 'BAD_RUN_SCHEMA';
    throw e;
  }
  return { project: raw.project, actions };
}

// ---------------------------------------------------------------------------
// 2) 补扫：CI / hooks / 本地链 / evals / 约定级登记（全部只读）
// ---------------------------------------------------------------------------

function listYaml(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
}

function detectCi(root) {
  const workflows = listYaml(join(root, '.github', 'workflows'));
  const files = [];
  for (const f of workflows) files.push(join('.github', 'workflows', f));
  if (existsSync(join(root, '.gitlab-ci.yml'))) files.push('.gitlab-ci.yml');
  if (existsSync(join(root, 'Jenkinsfile'))) files.push('Jenkinsfile');
  return { present: files.length > 0, files };
}

function detectHooks(root) {
  const found = [];
  const gitHooks = join(root, '.git', 'hooks');
  if (existsSync(gitHooks)) {
    for (const f of readdirSync(gitHooks)) {
      if (!f.endsWith('.sample')) { found.push(`.git/hooks/${f}`); }
    }
  }
  if (existsSync(join(root, '.husky'))) found.push('.husky/');
  if (existsSync(join(root, '.pre-commit-config.yaml'))) found.push('.pre-commit-config.yaml');
  return { present: found.length > 0, files: found };
}

function readPackageJson(root) {
  const p = join(root, 'package.json');
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function detectRatchet(root, gates) {
  if (gates.some((g) => /ratchet|棘轮/i.test(`${g.id} ${g.command || ''}`))) return true;
  return ['ratchet-baseline.json', '.aes-gate/ratchet-baseline.json'].some((p) => existsSync(join(root, p)));
}

function detectProtectionRegistry(root) {
  // branch protection 无法离线核实；组装 G1 后由用户确认、agent 登记，collect 只信登记文件。
  const p = join(root, GATE_DIR_NAME, 'protection.json');
  if (!existsSync(p)) return null;
  try {
    const obj = JSON.parse(readFileSync(p, 'utf8'));
    return obj.verified === true ? obj : null;
  } catch { return null; }
}

function loadConventions(root) {
  const p = join(root, GATE_DIR_NAME, 'conventions.json');
  if (!existsSync(p)) return [];
  try {
    const arr = JSON.parse(readFileSync(p, 'utf8'));
    return Array.isArray(arr) ? arr.filter((c) => c && typeof c.id === 'string' && typeof c.text === 'string') : [];
  } catch { return []; }
}

// ---------------------------------------------------------------------------
// 3) 逐门实跑：退出码显式读取（spawnSync status），有界超时，超时/不确定归红
// ---------------------------------------------------------------------------

// Windows 执行解析：抄 aes-standardize-repo assets/run/scripts/run.mjs 的 resolveSpawnTarget
// （cross-spawn 同法），适配点=去掉 doctor 面只留 spawn 面。
// 为什么：npm/npx 实为 .cmd，Node 18.20+/20.12+ 禁止无 shell 直接 spawn .cmd/.bat
// （CVE-2024-27980），EINVAL 即此坑；仅当解析到 .cmd/.bat 时经 cmd.exe 中转，argv 语义不变。
function executableCandidates(command, cwd) {
  if (command.toLowerCase() === 'node') return [process.execPath];
  if (isAbsolute(command) || command.includes('/') || command.includes('\\')) return [resolve(cwd, command)];
  const extensions = process.platform === 'win32'
    ? (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
    : [''];
  const hasExtension = process.platform === 'win32' && extensions.some((e) => command.toLowerCase().endsWith(e.toLowerCase()));
  const names = hasExtension ? [command] : extensions.map((e) => `${command}${e.toLowerCase()}`);
  return (process.env.PATH ?? '').split(delimiter).filter(Boolean).flatMap((dir) => names.map((name) => join(dir, name)));
}

function quoteForCmd(part) {
  return /[\s"]/.test(part) ? `"${part.replace(/"/gu, '\\"')}"` : part;
}

function resolveSpawnTarget(argv, cwd) {
  if (process.platform !== 'win32') return { file: argv[0], args: argv.slice(1) };
  const resolved = executableCandidates(argv[0], cwd).find((candidate) => {
    try { accessSync(candidate, constants.F_OK); return true; } catch { return false; }
  });
  if (resolved && /\.(cmd|bat)$/iu.test(resolved)) {
    return { file: 'cmd.exe', args: ['/d', '/s', '/c', argv.map(quoteForCmd).join(' ')] };
  }
  return { file: resolved ?? argv[0], args: argv.slice(1) };
}

export function runGate(argv, cwd, timeoutMs) {
  const started = Date.now();
  const { file, args } = resolveSpawnTarget(argv, cwd);
  const res = spawnSync(file, args, {
    cwd, shell: false, timeout: timeoutMs, encoding: 'utf8',
    // 子进程输出不进本表：证据=退出码+耗时，全文留给门自身日志。
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const durationMs = Date.now() - started;
  if (res.error && (res.error.code === 'ENOENT' || res.error.code === 'EINVAL')) {
    const stale = res.error.code === 'ENOENT';
    return {
      exitCode: null, durationMs, outcome: stale ? 'stale' : 'red',
      note: stale ? '命令不存在（注册还在、实体没了→疑似过时待人审）' : `命令不可执行（${res.error.code}，归红）`,
    };
  }
  if (res.error && res.error.code === 'ETIMEDOUT' || res.signal === 'SIGTERM') {
    return { exitCode: null, durationMs, outcome: 'red', note: `超时（>${Math.round(timeoutMs / 1000)}s，不确定归红）` };
  }
  if (res.error) {
    return { exitCode: null, durationMs, outcome: 'red', note: `启动失败：${res.error.message}` };
  }
  return { exitCode: res.status, durationMs, outcome: res.status === 0 ? 'green' : 'red', note: '' };
}

// ---------------------------------------------------------------------------
// 4) 六维评分（规则依据 ../references/weights.md；总分 110，档位由保护结构决定、不看总分）
// ---------------------------------------------------------------------------

const PROTECTION_SCORE = { 'ci-protected': 30, ci: 15, hooks: 2, manual: 0.5, none: 0 };

function commandText(gates) {
  // 命令+note（scan 门 note 承载链内容全文）都进匹配面：链内检查（如 check:repo）也算覆盖面。
  return gates.map((g) => `${g.id} ${(g.command || []).join(' ')} ${g.note || ''}`).join('\n');
}

export function scoreGates({ gates, ci, hooks, ratchet, registryHistoryLen, conventions, extraText = '' }) {
  const text = commandText(gates) + '\n' + extraText;
  const bestProtection = gates.reduce((best, g) => {
    const rank = { none: 0, manual: 1, hooks: 2, ci: 3, 'ci-protected': 4 };
    return rank[g.protection] > rank[best] ? g.protection : best;
  }, 'none');

  // 阻断强制性 /30：取最高保护档（hooks 官方坐实 --no-verify 可绕过→2；本地命令链手动→0.5）
  const blocking = PROTECTION_SCORE[bestProtection];

  // 覆盖广度 /20：测试链 4 + 结构一致性 3 + 生成物漂移 3 + lint 2 + typecheck 2 + 覆盖率 2 + 架构边界 4
  let coverage = 0;
  const coverageHits = [];
  if (/test/i.test(text)) { coverage += 4; coverageHits.push('测试链+4'); }
  if (/check:repo|check-skill|check[-.]structure|guard-structure|结构/.test(text)) { coverage += 3; coverageHits.push('结构一致性+3'); }
  if (/build-release\S*\s+--check|--check\b.*build|check-clean|drift/.test(text)) { coverage += 3; coverageHits.push('生成物漂移+3'); }
  if (/\blint\b|eslint|biome|prettier --check/.test(text)) { coverage += 2; coverageHits.push('lint+2'); }
  if (/typecheck|tsc --noEmit/.test(text)) { coverage += 2; coverageHits.push('typecheck+2'); }
  if (/coverage|c8 |nyc |lcov/.test(text)) { coverage += 2; coverageHits.push('覆盖率+2'); }
  if (/boundary|import-edge|fitness|verify-tui/.test(text)) { coverage += 4; coverageHits.push('架构边界+4'); }

  // 分层反馈 /15：单一全量链 3；多动作可选择性执行 8；CI 按路径/lane 分层 15
  const distinctCommands = new Set(gates
    .filter((g) => (g.kind === 'test' || g.kind === 'gate') && Array.isArray(g.command) && g.command.length > 0)
    .map((g) => g.command.join(' ')));
  let layering = 0;
  if (distinctCommands.size >= 1) layering = 3;
  let layeringNote = '单一全量链+3';
  if (distinctCommands.size >= 2) { layering = 8; layeringNote = '多门可选择性执行+8'; }

  // 有效性证据 /20：实跑记录 3 + 出处 3 + selftest 6 + 登记簿 4 + 历史≥2 可比 3 + 诚实降级 1
  const ran = gates.filter((g) => g.lastRun && g.lastRun.exitCode !== null);
  const runnable = gates.filter((g) => Array.isArray(g.command) && g.command.length > 0);
  let evidence = 0;
  const evidenceHits = [];
  if (runnable.length > 0 && ran.length === runnable.length) { evidence += 3; evidenceHits.push('逐门实跑退出码+3'); }
  if (gates.every((g) => g.evidence)) { evidence += 3; evidenceHits.push('证据带文件出处+3'); }
  if (/self-?test/.test(text)) { evidence += 6; evidenceHits.push('门带 selftest+6'); }
  if (registryHistoryLen > 0) { evidence += 4; evidenceHits.push('登记簿在场+4'); }
  if (registryHistoryLen >= 2) { evidence += 3; evidenceHits.push('历史≥2 可对比+3'); }
  evidence += 1; evidenceHits.push('BLOCKED/stale 语义可用+1');

  // AI 门禁 /15：光谱制取最高档（eval 命令在场 2 < 协议约定 5 < 结构化证据 10 < CI gating 15）
  let ai = 0;
  let aiNote = '无 AI 门禁';
  // ai 档由调用方补充（evals 探测结果），此处先按命令面判：
  // 调用方会在结果上覆盖 ai 维（见 detect() 内 evals 段）。

  // 持续演进 /10：棘轮 4 + 登记簿 3 + 豁免清单 3
  let evolution = 0;
  const evolutionHits = [];
  if (ratchet) { evolution += 4; evolutionHits.push('棘轮+4'); }
  if (registryHistoryLen > 0) { evolution += 3; evolutionHits.push('登记簿+3'); }
  if (gates.some((g) => /exempt|豁免/.test(`${g.id} ${(g.command || []).join(' ')}`))) { evolution += 3; evolutionHits.push('豁免清单+3'); }

  const dims = { blocking, coverage, layering, evidence, ai, evolution };
  const total = Object.values(dims).reduce((a, b) => a + b, 0);
  const tier = bestProtection === 'ci-protected' ? 'hard' : (bestProtection === 'ci' ? 'partial' : 'paper');
  return {
    dims, total, tier, bestProtection,
    notes: { coverageHits, evidenceHits, evolutionHits, layeringNote, aiNote },
  };
}

// ---------------------------------------------------------------------------
// 5) 缺口清单（机械判定；语义缺口由 agent 按 SKILL.md 流程复核补充，须带证据）
// ---------------------------------------------------------------------------

export function detectGaps({ hasRunToml, ci, hooks, gates, ratchet, evals }) {
  const gaps = [];
  if (!hasRunToml) {
    gaps.push({
      id: 'G0', risk: 'P0', owner: 'aes-standardize-repo', assemblable: false, pattern: null,
      what: '无 run 标准（run.toml 缺失）——门禁没有注册真源',
      advice: '建议链路：先走 aes-standardize-repo 登记既有命令，再由 aes-gate 组装补门禁；未注册门禁仍会被扫描记录、标「未注册」',
    });
  }
  if (!ci.present) {
    gaps.push({
      id: 'G1', risk: 'P0', owner: 'aes-gate:assemble', assemblable: true, pattern: 'aggregate-check',
      what: '无 CI 阻断，红代码可直进默认分支',
      advice: '组装模式=aggregate-check（required checks + branch protection 为硬前提）',
    });
  }
  const hasStructureGate = gates.some((g) => /guard-structure|check:repo|check-skill|check[-.]structure/.test(`${g.id} ${(g.command || []).join(' ')}`) && g.source === 'run.toml');
  if (!hasStructureGate) {
    gaps.push({
      id: 'G2', risk: 'P1', owner: 'aes-gate:assemble', assemblable: true, pattern: 'structure-guard',
      what: '无注册为独立门的结构守卫（目录/约定无机器断言的门）',
      advice: '链内检查不能替代门禁可见性；组装模式=structure-guard',
    });
  }
  if (!ratchet) {
    gaps.push({
      id: 'G3', risk: 'P2', owner: 'aes-gate:assemble', assemblable: true, pattern: 'ratchet',
      what: '无棘轮（指标无只许收紧机制）',
      advice: '组装模式=ratchet（基线+泄压阀：豁免须记录、只许缩小）',
    });
  }
  if (!evals.wired) {
    gaps.push({
      id: 'G4', risk: 'P2', owner: 'gate-builder（出界）', assemblable: false, pattern: null,
      what: `无 AI/eval 门禁${evals.command ? '（eval 命令在场但未接线为门）' : ''}`,
      advice: '归通用 gate-builder，不在本技能组装范围',
    });
  }
  return gaps;
}

// ---------------------------------------------------------------------------
// 6) 主检测流程
// ---------------------------------------------------------------------------

export async function detect(repoRoot, { timeoutMs = DEFAULT_TIMEOUT_MS, runGates = true } = {}) {
  const blockers = [];
  let stat = null;
  try { stat = statSync(repoRoot); } catch { blockers.push(`目标目录不可读：${repoRoot}`); }
  if (stat && !stat.isDirectory()) blockers.push('目标不是目录');
  if (stat && stat.isDirectory() && !existsSync(join(repoRoot, '.git'))) blockers.push('目标不是 git 仓库（缺 .git）');
  if (blockers.length > 0) {
    const e = new Error(blockers.join('；'));
    e.code = 'BLOCKED';
    e.exitCode = 2;
    throw e;
  }

  const at = () => new Date().toISOString();
  const git = (args) => {
    const r = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8', shell: false });
    return r.status === 0 ? r.stdout.trim() : null;
  };
  const project = (() => {
    const url = git(['remote', 'get-url', 'origin']);
    const m = url && url.match(/[/:]([^/:]+\/[^/]+?)(?:\.git)?$/);
    return m ? m[1] : repoRoot.split(/[\\/]/).pop();
  })();
  const commit = git(['rev-parse', '--short', 'HEAD']);

  // 6.1 注册真源
  let runToml = null;
  const runTomlPath = join(repoRoot, 'run.toml');
  if (existsSync(runTomlPath)) {
    runToml = parseRunToml(readFileSync(runTomlPath, 'utf8'));
  }

  // 6.2 补扫
  const ci = detectCi(repoRoot);
  const hooks = detectHooks(repoRoot);
  const pkg = readPackageJson(repoRoot);
  const evals = {
    command: pkg && pkg.scripts && (pkg.scripts.evals ? 'npm run evals' : null) || null,
    dir: existsSync(join(repoRoot, '.agents', 'evals')),
    get wired() { return false; }, // 机械默认不接线；agent 复核可在报告补充语义判断（带证据）
  };
  const conventions = loadConventions(repoRoot);
  const protectionRegistry = detectProtectionRegistry(repoRoot);

  // 6.3 门清单：run.toml 注册门（id=action id）+ 扫描门（source=scan）+ 哨位门（missing 可见性）
  const gates = [];
  const runResults = [];
  const runOne = (gate) => {
    if (!runGates || !gate.command) return { exitCode: null, durationMs: null, outcome: null, note: '' };
    const r = runGate(gate.command, repoRoot, timeoutMs);
    runResults.push({ id: gate.id, command: gate.command.join(' '), ...r });
    return r;
  };

  // 验证面动作（kind=test/gate）都实跑进门清单；kind=task/open 是任务面，不进。
  for (const action of runToml ? runToml.actions.filter((a) => a.kind === 'gate' || a.kind === 'test') : []) {
    const inCi = ci.files.some((f) => {
      const p = join(repoRoot, f);
      try { return readFileSync(p, 'utf8').includes(action.id); } catch { return false; }
    });
    const protection = inCi ? (protectionRegistry ? 'ci-protected' : 'ci') : 'manual';
    const r = runOne({ id: action.id, command: action.run });
    gates.push({
      id: action.id, runAction: action.id, source: 'run.toml', kind: 'gate',
      command: action.run, evidence: `run.toml [[actions]] id=${action.id}`,
      status: r.outcome || 'missing', protection,
      lastRun: r.exitCode === null && !r.outcome ? null : { at: at(), exitCode: r.exitCode, durationMs: r.durationMs },
      note: r.note,
    });
  }

  // 扫描门：npm test 未注册也记录（标「未注册」，mock 口径 local.npm-test）
  const hasTestAction = runToml && runToml.actions.some((a) => a.kind === 'test');
  if (!hasTestAction && pkg && pkg.scripts && typeof pkg.scripts.test === 'string' && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
    const r = runOne({ id: 'local.npm-test', command: ['npm', 'test'] });
    gates.push({
      id: 'local.npm-test', runAction: null, source: 'scan', kind: 'test',
      command: ['npm', 'test'], evidence: 'package.json scripts.test（未注册进 run.toml）',
      status: r.outcome || 'missing', protection: 'manual',
      lastRun: r.exitCode === null && !r.outcome ? null : { at: at(), exitCode: r.exitCode, durationMs: r.durationMs },
      note: `${r.note}${r.note ? '；' : ''}链内容：${pkg.scripts.test.slice(0, 200)}`,
    });
  }

  // 哨位门：期待在场的关键门位，缺了即 missing（可见性，不实跑）
  const sentinel = (id, what, present, evidence, protection = 'none') => {
    if (gates.some((g) => g.id === id)) return;
    gates.push({
      id, runAction: null, source: 'sentinel', kind: id.split('.')[0], command: null,
      evidence, status: present ? 'green' : 'missing', protection,
      lastRun: null, note: what,
    });
  };
  sentinel('ci.required', 'CI 聚合 required check', ci.present, ci.present ? ci.files.join(', ') : 'CI 配置不存在（.github/workflows 等）', ci.present ? (protectionRegistry ? 'ci-protected' : 'ci') : 'none');
  sentinel('hooks.pre-commit', '本地钩子（官方坐实可 --no-verify 绕过，只作 shift-left 参考）', hooks.present, hooks.present ? hooks.files.join(', ') : '.git/hooks 无自定义 / 无 .husky / 无 .pre-commit-config.yaml');
  const registryPath = join(repoRoot, GATE_DIR_NAME, 'gate-registry.json');
  sentinel('gate.registry', '登记簿（本技能运行产物）', existsSync(registryPath), existsSync(registryPath) ? registryPath : '首轮采集后建立');

  const ratchet = detectRatchet(repoRoot, gates);
  sentinel('ratchet.lines', '棘轮（指标只许收紧）', ratchet, ratchet ? '棘轮门或基线文件在场' : '无 ratchet 门/基线文件');
  sentinel('evals.wired', 'AI/eval 门禁（advisory→evidence→gating 光谱）', evals.wired, evals.command ? `${evals.command} 在场但未接线为门（agent 复核）` : '无 eval 命令');

  // 6.4 评分
  const prevRegistry = existsSync(registryPath) ? safeJson(registryPath) : null;
  const historyLen = prevRegistry && Array.isArray(prevRegistry.history) ? prevRegistry.history.length : 0;
  // 覆盖匹配面含 package.json scripts 全文：链内检查（check:repo/build --check）也是覆盖面，
  // note 里的链内容有展示截断，不作为匹配源。
  const scriptsText = pkg && pkg.scripts ? Object.entries(pkg.scripts).map(([k, v]) => `${k}: ${v}`).join('\n') : '';
  const score = scoreGates({ gates, ci, hooks, ratchet, registryHistoryLen: historyLen, conventions, extraText: scriptsText });
  // AI 维光谱复核（eval 命令在场 2 档；其余档需 agent 语义判定，机械面保守）
  if (evals.command || evals.dir) {
    score.dims.ai = 2;
    score.notes.aiNote = 'eval 命令在场未接线+2（advisory 以下）';
    score.total = Object.values(score.dims).reduce((a, b) => a + b, 0);
  }

  // 6.5 缺口
  const gaps = detectGaps({ hasRunToml: !!runToml, ci, hooks, gates, ratchet, evals });

  return {
    meta: { project, commit, repoRoot, collectedAt: at(), command: process.argv.join(' '), exitCode: 0 },
    runToml, ci, hooks, evals: { command: evals.command, dir: evals.dir }, conventions,
    gates, runResults, score, gaps, prevRegistry,
  };
}

function safeJson(p) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } }

// ---------------------------------------------------------------------------
// 7) registry 组装、schema 自校验（api.md 一、gate-registry v1）
// ---------------------------------------------------------------------------

export function buildRegistry(result) {
  const { meta, gates, conventions, gaps, score } = result;
  const prevHistory = result.prevRegistry && Array.isArray(result.prevRegistry.history) ? result.prevRegistry.history : [];
  return {
    version: 1,
    project: meta.project,
    collectedAt: meta.collectedAt,
    gates: gates.map((g) => ({
      id: g.id, runAction: g.runAction ?? null, source: g.source, kind: g.kind,
      command: g.command, evidence: g.evidence, status: g.status, protection: g.protection,
      lastRun: g.lastRun, note: g.note ?? '',
    })),
    conventions,
    gaps: gaps.map((g) => ({
      id: g.id, risk: g.risk, owner: g.owner, assemblable: g.assemblable,
      pattern: g.pattern ?? null, linkedRunAction: null,
      what: g.what, advice: g.advice ?? '',
    })),
    score: { total: score.total, tier: score.tier, dims: score.dims },
    history: [...prevHistory, {
      at: meta.collectedAt, total: score.total, tier: score.tier,
      gateCount: gates.length, gapCount: gaps.length,
    }],
  };
}

export function validateRegistry(obj) {
  const errors = [];
  const str = (v) => typeof v === 'string';
  if (obj.version !== 1) errors.push('version 必须=1');
  if (!str(obj.project)) errors.push('project 缺失');
  if (!str(obj.collectedAt)) errors.push('collectedAt 缺失');
  if (!Array.isArray(obj.gates)) errors.push('gates 必须是数组');
  else for (const g of obj.gates) {
    if (!str(g.id)) errors.push('gate.id 缺失');
    if (!['green', 'red', 'missing', 'stale'].includes(g.status)) errors.push(`gate ${g.id} status 非法：${g.status}`);
    if (!['none', 'manual', 'ci', 'ci-protected'].includes(g.protection)) errors.push(`gate ${g.id} protection 非法：${g.protection}`);
    if (!['run.toml', 'scan', 'sentinel'].includes(g.source)) errors.push(`gate ${g.id} source 非法：${g.source}`);
  }
  if (!Array.isArray(obj.conventions)) errors.push('conventions 必须是数组');
  if (!Array.isArray(obj.gaps)) errors.push('gaps 必须是数组');
  else for (const g of obj.gaps) {
    if (!['P0', 'P1', 'P2'].includes(g.risk)) errors.push(`gap ${g.id} risk 非法：${g.risk}`);
  }
  if (!obj.score || typeof obj.score.total !== 'number' || !TIERS.includes(obj.score.tier)) errors.push('score 非法');
  if (!obj.score || typeof obj.score.dims?.blocking !== 'number') errors.push('score.dims 非法');
  if (!Array.isArray(obj.history) || obj.history.length === 0) errors.push('history 必须非空数组（追加式）');
  return errors;
}

// ---------------------------------------------------------------------------
// 8) 呈现：handoff markdown（api.md 二、三结局）/ 报告六节 / 看板投影
// ---------------------------------------------------------------------------

const fmtGateRow = (g) => {
  const cmd = g.command ? '`' + g.command.join(' ') + '`' : '—';
  const run = g.lastRun ? `（exit=${g.lastRun.exitCode}，${STATUS_LABEL[g.status]}实跑 ${Math.round((g.lastRun.durationMs || 0) / 1000)}s）` : '';
  return `| ${g.id} | ${g.source === 'run.toml' ? 'run.toml·' + g.kind : g.source === 'scan' ? '本地链·未注册' : '哨位'} | ${cmd} | ${g.evidence} | ${STATUS_LABEL[g.status]}${run} |`;
};

export function renderHandoff(result) {
  const { gates, score, gaps, meta, prevRegistry } = result;
  const lines = [];
  lines.push('## gate 盘点表');
  lines.push('| 门 id | 类型 | 命令/位置 | 证据 | 状态 |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const g of gates) lines.push(fmtGateRow(g));
  const prev = prevRegistry && prevRegistry.history && prevRegistry.history.length > 0
    ? prevRegistry.history[prevRegistry.history.length - 1] : null;
  const delta = prev ? `，上次 ${prev.total}（${TIER_LABEL[prev.tier]}），差 ${round1(score.total - prev.total)}` : '';
  lines.push('');
  lines.push(`## 评分：${round1(score.total)}/110 · ${TIER_LABEL[score.tier]}${prev ? delta : '（首测无历史基线）'}`);
  const reds = gates.filter((g) => g.status === 'red' || g.status === 'stale');
  lines.push('');
  lines.push(`## 红门置顶：${reds.length === 0 ? '无红门' : reds.map((g) => `${g.id}（${STATUS_LABEL[g.status]}${g.note ? '：' + g.note : ''}）`).join('｜')}`);
  lines.push('');
  lines.push(`## 缺口清单（=移交单）：${gaps.length === 0 ? '（空——表头仍在，证明扫过）' : ''}`);
  for (const g of gaps) {
    lines.push(`- **${g.id} ${g.risk}** ${g.what}${g.assemblable ? `｜可组装·${g.pattern}` : '｜出界'}｜归属：${g.owner}`);
  }
  lines.push('');
  lines.push(`> 局限：低分≠有风险（防 Goodhart）；档位由保护结构决定、不看总分。采集：${meta.project}@${meta.commit || '?'} ${meta.collectedAt}`);
  return lines.join('\n');
}

function round1(n) { return Math.round(n * 10) / 10; }

export function renderReport(result) {
  const { meta, gates, runResults, score, gaps, conventions, prevRegistry } = result;
  const ts = meta.collectedAt.replace(/[:T]/g, '-').slice(0, 19);
  const L = [];
  L.push(`# gate 体检报告 · ${meta.project}`);
  L.push('');
  L.push(`- 采集：\`${meta.command}\`（退出码以显式读取为准）｜commit \`${meta.commit || '?'}\`｜时间 ${meta.collectedAt}`);
  L.push(`- 注册真源：run.toml${result.runToml ? `（${result.runToml.actions.length} 个动作，其中门 ${result.runToml.actions.filter((a) => a.kind === 'gate').length} 个）` : ' **缺失**（G0 置顶）'}`);
  L.push('');
  L.push('## 1. 盘点');
  L.push('| 门 id | 类型 | 命令/位置 | 证据 | 状态 |');
  L.push('| --- | --- | --- | --- | --- |');
  for (const g of gates) L.push(fmtGateRow(g));
  L.push('');
  L.push(`CI：${result.ci.present ? result.ci.files.join(', ') : '无'}｜hooks：${result.hooks.present ? result.hooks.files.join(', ') : '无'}｜evals：${result.evals.command || '无命令'}`);
  L.push('');
  L.push('## 2. 实跑红绿（退出码显式读取，超时/不确定归红）');
  if (runResults.length === 0) L.push('（无可实跑的门——全部为哨位/缺失）');
  for (const r of runResults) {
    L.push(`- \`${r.command}\` → exit=${r.exitCode === null ? 'null' : r.exitCode}（${Math.round(r.durationMs / 1000)}s）${r.note ? '｜' + r.note : ''}`);
  }
  const reds = gates.filter((g) => g.status === 'red' || g.status === 'stale');
  if (reds.length > 0) L.push(`- **红门置顶**：${reds.map((g) => `${g.id}（${STATUS_LABEL[g.status]}）`).join('、')}——红着的门=没有门`);
  L.push('');
  L.push('## 3. 六维评分');
  L.push('| 维度 | 得分 | 满分 | 依据 |');
  L.push('| --- | --- | --- | --- |');
  const dimRows = [
    ['阻断强制性', score.dims.blocking, 30, `最高保护档=${score.bestProtection}`],
    ['覆盖广度', score.dims.coverage, 20, score.notes.coverageHits.join('，') || '无命中'],
    ['分层反馈', score.dims.layering, 15, score.notes.layeringNote],
    ['有效性证据', score.dims.evidence, 20, score.notes.evidenceHits.join('，')],
    ['AI 门禁', score.dims.ai, 15, score.notes.aiNote],
    ['持续演进', score.dims.evolution, 10, score.notes.evolutionHits.join('，') || '无命中'],
  ];
  for (const [name, v, max, why] of dimRows) L.push(`| ${name} | ${round1(v)} | ${max} | ${why} |`);
  L.push(`| **总分** | **${round1(score.total)}** | **110** | 档位=${TIER_LABEL[score.tier]}（由保护结构决定，不看总分） |`);
  L.push('');
  L.push('## 4. 历史对比');
  const hist = prevRegistry && prevRegistry.history ? prevRegistry.history : [];
  if (hist.length === 0) L.push('首测无基线——下一轮起此处显示与上次差值。');
  else {
    const last = hist[hist.length - 1];
    L.push(`上次：${round1(last.total)}（${TIER_LABEL[last.tier]}，${last.at}）→ 本次 ${round1(score.total)}，差 ${round1(score.total - last.total)}。`);
  }
  L.push('');
  L.push('## 5. 缺口清单（=移交单）');
  if (gaps.length === 0) L.push('（空——各哨位门均在场。表头保留证明扫过。）');
  for (const g of gaps) {
    L.push(`### ${g.id} ${g.risk}｜${g.what}`);
    L.push(`- 可组装：${g.assemblable ? `是（模式 ${g.pattern}）` : '否'}｜归属：${g.owner}`);
    if (g.advice) L.push(`- 处置：${g.advice}`);
  }
  L.push('');
  L.push('## 6. 约定级检查与局限');
  if (conventions.length === 0) L.push('约定级登记为空（`.aes-gate/conventions.json` 不存在——首次盘点请按 SKILL.md 整理 AGENTS.md 约定写入）。');
  for (const c of conventions) L.push(`- ${c.id}：${c.text}（机器断言：${c.machineEnforced ? '有' : '无'}，不计分）`);
  L.push('');
  L.push('> 局限声明：低分≠有风险，分数是体检参考不是 KPI（防 Goodhart）；branch protection 离线不可核实，ci-protected 以 `.aes-gate/protection.json` 人工登记为准；语义缺口由 agent 复核补充、须带证据。');
  return { name: `report-${ts}.md`, body: L.join('\n') + '\n' };
}

// ---------------------------------------------------------------------------
// 9) 看板投影：模板占位替换（页面零 JS、不推导状态，registry 是唯一数据真源）
// ---------------------------------------------------------------------------

export function renderBoard(registry) {
  const template = readFileSync(join(SKILL_DIR, 'assets', 'board.template.html'), 'utf8');
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const { score, gates, gaps, conventions, history } = registry;
  const dimDefs = [
    ['阻断强制性', 'blocking', 30], ['覆盖广度', 'coverage', 20], ['分层反馈', 'layering', 15],
    ['有效性证据', 'evidence', 20], ['AI 门禁', 'ai', 15], ['持续演进', 'evolution', 10],
  ];
  const dimsHtml = dimDefs.map(([name, key, max]) => {
    const v = score.dims[key] || 0;
    const pct = Math.max(0, Math.min(100, Math.round((v / max) * 100)));
    return `<div class="dim"><span class="name">${name}</span><span class="bar"><i style="width:${pct}%"></i></span><span class="val">${round1(v)} / ${max}</span></div>`;
  }).join('\n      ');
  const gateRows = gates.map((g) => {
    const run = g.lastRun ? `${registry.collectedAt.slice(0, 16).replace('T', ' ')} 实测 exit=${g.lastRun.exitCode}` : '—';
    return `<tr>
        <td><span class="id">${esc(g.id)}</span><div class="ev">${esc(g.note || '')}</div></td>
        <td>${esc(g.source === 'run.toml' ? 'run.toml·' + g.kind : g.source === 'scan' ? '本地链·未注册' : '哨位')}</td>
        <td>${g.command ? `<code>${esc(g.command.join(' '))}</code>` : '—'}</td>
        <td><span class="st ${g.status}">${STATUS_LABEL[g.status]}</span></td>
        <td class="prot${g.protection === 'manual' || g.protection === 'none' ? ' paper' : ''}">${esc(g.protection)}</td>
        <td>${run}<br><span class="ev">${esc(g.evidence)}</span></td>
      </tr>`;
  }).join('\n      ');
  const gapRows = gaps.map((g) => `<div class="gap ${g.risk.toLowerCase()}"><span class="tag">${g.risk}</span><span class="what">${esc(g.what)}${g.assemblable ? `<span class="asm">可组装·${esc(g.pattern)}</span>` : ''}</span><span class="owner">${esc(g.owner)}</span></div>`).join('\n      ');
  const convRows = conventions.length > 0
    ? conventions.map((c) => `· ${esc(c.text)}（机器断言：${c.machineEnforced ? '有' : '无'}）`).join('\n      ')
    : '（空——.aes-gate/conventions.json 不存在，约定级不计分）';
  const histRows = history.map((h) => `<tr><td>${h.at.slice(0, 16).replace('T', ' ')}</td><td>${round1(h.total)}</td><td>${TIER_LABEL[h.tier]}</td><td>${h.gateCount}</td><td>${h.gapCount}</td></tr>`).join('\n      ');
  return template
    .replaceAll('<!--PROJECT-->', esc(registry.project))
    .replaceAll('<!--TIER-->', TIER_LABEL[score.tier])
    .replaceAll('<!--SCORE-->', `${round1(score.total)} / 110`)
    .replaceAll('<!--COLLECTED-AT-->', registry.collectedAt.slice(0, 16).replace('T', ' '))
    .replaceAll('<!--DIMS-->', dimsHtml)
    .replaceAll('<!--GATES-->', gateRows)
    .replaceAll('<!--GAPS-->', gapRows || '<p class="note">（空——各哨位门均在场）</p>')
    .replaceAll('<!--CONVENTIONS-->', convRows)
    .replaceAll('<!--HISTORY-->', histRows);
}

// ---------------------------------------------------------------------------
// 10) self-test：内置正反样例（临时目录夹具，不碰真实仓库）
// ---------------------------------------------------------------------------

export async function selfTest() {
  let pass = 0; let fail = 0;
  const check = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
  };

  // S1 TOML 正例（fixtures/run.toml）
  const fixture = readFileSync(join(SKILL_DIR, 'fixtures', 'run.toml'), 'utf8');
  const parsed = parseRunToml(fixture);
  check('S1 run.toml 正例解析：2 动作、1 门', parsed.actions.length === 2 && parsed.actions.filter((a) => a.kind === 'gate').length === 1);
  check('S1 门 id 进动词域且非保留字', parsed.actions[1].id === 'gate.fixture' && !RESERVED_IDS.includes(parsed.actions[1].id));

  // S2 run/v1 反例
  for (const [label, bad] of [
    ['保留字 id', '[project]\nid="a/b"\n\n[[actions]]\nid="list"\nname="L"\nkind="gate"\nrun=["true"]'],
    ['非法 kind', '[project]\nid="a/b"\n\n[[actions]]\nid="x"\nname="X"\nkind="wall"\nrun=["true"]'],
    ['run 空数组', '[project]\nid="a/b"\n\n[[actions]]\nid="x"\nname="X"\nkind="gate"\nrun=[]'],
    ['坏 TOML', '[project]\nid="a/b" [[actions]'],
  ]) {
    let threw = null;
    try { parseRunToml(bad, `反例(${label})`); } catch (e) { threw = e; }
    check(`S2 反例拒绝：${label}`, threw !== null);
  }

  // S3 临时仓：红绿门实跑（退出码显式读取）
  const tmp = mkdtempSync(join(tmpdir(), 'aes-gate-selftest-'));
  try {
    mkdirSync(join(tmp, '.git'), { recursive: true });
    writeFileSync(join(tmp, 'run.toml'), [
      '[project]', 'id = "selftest/fixture"', '',
      '[[actions]]', 'id = "test.green"', 'name = "Green"', 'kind = "test"', 'run = ["node", "-e", "process.exit(0)"]', '',
      '[[actions]]', 'id = "gate.red"', 'name = "Red"', 'kind = "gate"', 'run = ["node", "-e", "process.exit(3)"]', '',
    ].join('\n'));
    const result = await detect(tmp, { timeoutMs: 15_000 });
    const green = result.gates.find((g) => g.id === 'test.green');
    const red = result.gates.find((g) => g.id === 'gate.red');
    check('S3 绿门 exit=0', green && green.status === 'green' && green.lastRun.exitCode === 0);
    check('S3 红门 exit=3（显式读取）', red && red.status === 'red' && red.lastRun.exitCode === 3);
    if (process.platform === 'win32') {
      // Windows 面：.cmd 经 cmd.exe 中转（run.mjs 同法），退出码须原样透传
      const r = runGate(['npm', '--version'], tmp, 15_000);
      check('S3 win32 npm.cmd 中转退出码 0', r.outcome === 'green' && r.exitCode === 0, JSON.stringify(r));
    }
    check('S3 无 CI→G1 缺口 P0 可组装', result.gaps.some((g) => g.id === 'G1' && g.risk === 'P0' && g.assemblable === true && g.pattern === 'aggregate-check'));
    check('S3 无 run.toml 缺失→无 G0', !result.gaps.some((g) => g.id === 'G0'));
    check('S3 档位=paper（本地 manual 最高）', result.score.tier === 'paper' && result.score.dims.blocking === 0.5);
    const registry = buildRegistry(result);
    check('S3 registry schema 自校验通过', validateRegistry(registry).length === 0, validateRegistry(registry).join('；'));
    check('S3 history 追加一行', registry.history.length === 1 && registry.history[0].gateCount === registry.gates.length);
    // 二轮：history 追加不覆盖
    mkdirSync(join(tmp, GATE_DIR_NAME), { recursive: true });
    writeFileSync(join(tmp, GATE_DIR_NAME, 'gate-registry.json'), JSON.stringify(registry));
    const result2 = await detect(tmp, { timeoutMs: 15_000 });
    const registry2 = buildRegistry(result2);
    check('S3 二轮 history 追加为 2（不覆盖）', registry2.history.length === 2);
    check('S3 二轮历史对比非首测', renderHandoff(result2).includes('上次') || renderHandoff(result2).includes('差'));

    // S4 handoff 结构（api.md 结局 1 逐节）
    const handoff = renderHandoff(result2);
    check('S4 handoff 含盘点表头', handoff.includes('## gate 盘点表') && handoff.includes('| 门 id | 类型 | 命令/位置 | 证据 | 状态 |'));
    check('S4 handoff 含评分行', /## 评分：[\d.]+\/110 · (硬门禁|部分|纸面)/.test(handoff));
    check('S4 handoff 含红门置顶节', handoff.includes('## 红门置顶：') && handoff.includes('gate.red'));
    check('S4 handoff 缺口清单含 G1', handoff.includes('G1 P0') && handoff.includes('可组装·aggregate-check'));

    // S5 看板：占位符全替换、零外链
    const board = renderBoard(registry2);
    check('S5 看板无未替换占位符', !/<!--(PROJECT|TIER|SCORE|DIMS|GATES|GAPS|CONVENTIONS|HISTORY|COLLECTED-AT)-->/.test(board));
    check('S5 看板零外链（http/src=）', !/(src="http|href="http|https?:\/\/)/.test(board));

    // S6 BLOCKED：非 git 目录
    const bare = mkdtempSync(join(tmpdir(), 'aes-gate-bare-'));
    try {
      let blocked = null;
      try { await detect(bare); } catch (e) { blocked = e; }
      check('S6 非 git 仓→BLOCKED 退出码 2', blocked && blocked.code === 'BLOCKED' && blocked.exitCode === 2);
    } finally { rmSync(bare, { recursive: true, force: true }); }

    // S7 空缺口（表头必须出现）——伪造一个全配置仓的哨位即可验证渲染分支
    const emptyGapRender = renderHandoff({ ...result2, gaps: [], prevRegistry: registry });
    check('S7 空缺口时表头仍在', emptyGapRender.includes('## 缺口清单（=移交单）：（空——表头仍在，证明扫过）'));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  console.log(`\n[self-test] ${pass} passed, ${fail} failed`);
  return fail === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function usage() {
  console.log(`用法：node collect.mjs [--repo <路径>] [--timeout <秒>] [--handoff] [--json] [--self-test]
  默认       批量检测：落盘 .aes-gate/report-<ts>.md + gate-registry.json + board.html
  --handoff  aes-qa 精简回传：跑检测（含红绿）但不落盘，stdout 出 markdown 盘点表+缺口清单
  --json     与 --handoff 组合：stdout 出 registry JSON（机器可读）
  --self-test 内置正反样例自测`);
}

async function main() {
  const args = process.argv.slice(2);
  const known = new Set(['--repo', '--timeout', '--handoff', '--json', '--self-test', '--help', '-h']);
  const unknown = args.filter((a, i) => a.startsWith('--') && !known.has(a) && !known.has(args[i - 1]));
  if (unknown.length > 0) { usage(); console.error(`未知参数：${unknown.join(' ')}`); return 64; }
  const flag = (name) => args.includes(name);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
  };
  if (flag('--help') || flag('-h')) { usage(); return 0; }
  if (flag('--self-test')) return selfTest();

  const repoRoot = repoRootFrom(opt('--repo'));
  const timeoutMs = (Number(opt('--timeout')) > 0 ? Number(opt('--timeout')) * 1000 : DEFAULT_TIMEOUT_MS);
  const result = await detect(repoRoot, { timeoutMs });
  const registry = buildRegistry(result);
  const schemaErrors = validateRegistry(registry);
  if (schemaErrors.length > 0) {
    console.error(`[aes-gate] registry schema 校验失败（不写盘）：\n  - ${schemaErrors.join('\n  - ')}`);
    return 1;
  }

  if (flag('--handoff')) {
    if (flag('--json')) console.log(JSON.stringify(registry));
    else console.log(renderHandoff(result));
    return 0;
  }

  const gateDir = join(repoRoot, GATE_DIR_NAME);
  mkdirSync(gateDir, { recursive: true });
  const report = renderReport(result);
  writeFileSync(join(gateDir, report.name), report.body, 'utf8');
  writeFileSync(join(gateDir, 'gate-registry.json'), JSON.stringify(registry, null, 2) + '\n', 'utf8');
  // 写后重读自校验（api.md：registry 是唯一数据真源，坏数据不落地）
  const reread = safeJson(join(gateDir, 'gate-registry.json'));
  const rereadErrors = reread ? validateRegistry(reread) : ['重读失败'];
  if (rereadErrors.length > 0) {
    console.error(`[aes-gate] 写后重读校验失败：${rereadErrors.join('；')}`);
    return 1;
  }
  writeFileSync(join(gateDir, 'board.html'), renderBoard(registry), 'utf8');
  console.log(`[aes-gate] 检测完成：${registry.gates.length} 门（红 ${registry.gates.filter((g) => g.status === 'red').length}）｜评分 ${round1(registry.score.total)}/110 ${TIER_LABEL[registry.score.tier]}｜缺口 ${registry.gaps.length} 条`);
  console.log(`[aes-gate] 已写入 ${join(GATE_DIR_NAME, report.name)} / gate-registry.json / board.html`);
  return 0;
}

// 直接执行时跑 main；被 import（run-tests/self-test 复用）时不跑。
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code)).catch((error) => {
    if (error.code === 'BLOCKED') {
      console.error(`[aes-gate] BLOCKED：${error.message}——不产出半份报告`);
      process.exit(error.exitCode || 2);
    }
    console.error(`[aes-gate] 内部错误：${error.stack || error.message}`);
    process.exit(1);
  });
}
