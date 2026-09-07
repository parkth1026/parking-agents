#!/usr/bin/env node
// run-tests.mjs — aes-gate 的回归测试（升级/改动后必跑）
// 两种形态：
//   1) 无参：T1-T6 资源/黑盒回归 + AES-QG 四个契约 case（human 输出）
//   2) --contract aes-qg --case <level-classification|policy-execution|receipt-identity-board|legacy-migration> [--json]
//      契约模式：stdout 出单条 JSON 结果（aes.aes-qg-contract-result/v1），退出码 0=PASS/1=FAIL/64=用法错误
// 惯例：check() 计数器 + 黑盒执行（spawnSync 跑脚本/命令再比对输出）；fixtures/ 放可重放输入。
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  aggregateLevels, buildGateReceipt, classifyCheck, evaluateReleaseQualification,
  IDENTITY_DIMS, identityChanges, isBareLevel, isFullLevelNamespace,
  levelIndex, renderLevelBoard, reuseEligible, validateGateReceipt, LEVEL_NAMES,
} from './scripts/aes-qg.mjs';

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const COLLECT = join(SKILL_DIR, 'scripts', 'collect.mjs');
const ENGINE = join(SKILL_DIR, 'scripts', 'aes-qg.mjs');

let pass = 0;
let fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}
function run(args, opts = {}) {
  const r = spawnSync('node', [COLLECT, ...args], { encoding: 'utf8', timeout: 120_000, ...opts });
  if (r.error) { const e = new Error(r.error.message); e.status = 1; throw e; }
  if (r.status !== 0) { const e = new Error(r.stderr || r.stdout || `exit ${r.status}`); e.status = r.status; throw e; }
  return r.stdout;
}
function runCode(args, opts = {}) {
  try { run(args, opts); return 0; } catch (e) { return e.status ?? 1; }
}

// ---------------------------------------------------------------------------
// AES-QG 契约用例公共设施
// ---------------------------------------------------------------------------

function runEngine(args) {
  const r = spawnSync(process.execPath, [ENGINE, ...args], { encoding: 'utf8', timeout: 120_000 });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function makeRepo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'aes-qg-case-'));
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  const git = (args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  git(['init', '-q']);
  git(['config', 'user.email', 'aes-gate-test@example.com']);
  git(['config', 'user.name', 'aes-gate-test']);
  git(['add', '-A']);
  git(['commit', '-qm', 'init']);
  return dir;
}

const gateAction = (id, ok = true, marker = '') => [
  '[[actions]]', `id = "${id}"`, `name = "${id}"`, 'kind = "gate"',
  `run = ["node", "-e", "process.exit(${ok ? 0 : 1})${marker}"]`, '',
].join('\n');

function runTomlText({ gateIds = [], failIds = [], markL0 = false } = {}) {
  const parts = ['[project]', 'id = "fixture/gate-repo"', '',
    '[[actions]]', 'id = "test.regression"', 'name = "Regression"', 'kind = "test"',
    'run = ["node", "-e", "process.exit(0)"]', ''];
  for (const id of gateIds) {
    parts.push(gateAction(id, !failIds.includes(id), id === 'gate.l0' && markL0 ? '/*v1*/' : ''));
  }
  return parts.join('\n');
}

function policyText({
  supportedThrough = 'AES-QG-L3',
  levelIdx = [0, 1, 2, 3],
  profiles = [['quick', 'AES-QG-L1'], ['mid', 'AES-QG-L3']],
  releaseProfiles = [['desktop-release', 'AES-QG-L3', ['functional', 'security'], ['automated', 'live'], true]],
  migration = 'terminal',
  artifactAt = [],
  levelActionOverride = {},
} = {}) {
  const L = ['schema = "aes-gate-policy/v1"', 'standard = "AES-QG/1"',
    `supported_through = "${supportedThrough}"`, `migration = "${migration}"`, ''];
  for (const i of levelIdx) {
    L.push('[[levels]]', `level = "AES-QG-L${i}"`, `action = "${levelActionOverride[i] ?? `gate.l${i}`}"`,
      'subject = "fixture"', 'environment_class = "hermetic"', 'network_policy = "none"', 'size_class = "small"',
      ...(artifactAt.includes(i) ? ['artifact_paths = ["dist/app.txt"]'] : []), '');
  }
  for (const [id, target] of profiles) {
    L.push('[[profiles]]', `id = "${id}"`, `action = "gate.${id}"`, `target_level = "${target}"`, '');
  }
  for (const [id, level, attrs, modes, prov] of releaseProfiles) {
    L.push('[[release_profiles]]', `id = "${id}"`, `required_level = "${level}"`,
      `required_quality_attributes = ${JSON.stringify(attrs)}`,
      `required_evidence_modes = ${JSON.stringify(modes)}`,
      `require_provenance = ${prov}`, '');
  }
  return L.join('\n');
}

function runsOf(dir) {
  const runsDir = join(dir, '.aes-gate', 'runs');
  return existsSync(runsDir) ? readdirSync(runsDir).filter((f) => /^run-\d+$/.test(f)).sort() : [];
}
function readReceipt(dir, runId) {
  return JSON.parse(readFileSync(join(dir, '.aes-gate', 'runs', runId, 'gate-receipt.json'), 'utf8'));
}

function makeCase(name, fn) {
  return async () => {
    const assertions = [];
    const c = (n, cond, detail = '') => assertions.push({
      name: n, outcome: cond ? 'PASS' : 'FAIL', ...(cond || !detail ? {} : { detail }),
    });
    let repos = [];
    const track = (d) => { repos.push(d); return d; };
    try {
      await fn(c, track);
    } catch (error) {
      assertions.push({ name: 'case threw', outcome: 'FAIL', detail: error.stack || String(error) });
    } finally {
      for (const d of repos) rmSync(d, { recursive: true, force: true });
    }
    const failures = assertions.filter((a) => a.outcome === 'FAIL');
    return {
      schema: 'aes.aes-qg-contract-result/v1', contract: 'aes-qg', case: name,
      outcome: failures.length ? 'FAIL' : 'PASS',
      passed: assertions.length - failures.length, total: assertions.length, failures,
    };
  };
}

// ---------------------------------------------------------------------------
// case 1：level-classification（AC-001）
// ---------------------------------------------------------------------------

const caseLevelClassification = makeCase('level-classification', async (c) => {
  // 六级正例：三轴同层
  const positives = [
    [{ testObject: 'source', assertionScope: 'static-conformance', artifactFidelity: 'static-artifact' }, 'AES-QG-L0'],
    [{ testObject: 'config', assertionScope: 'static-conformance', artifactFidelity: 'static-artifact' }, 'AES-QG-L0'],
    [{ testObject: 'isolated-component', assertionScope: 'component-behavior', artifactFidelity: 'controlled-standins' }, 'AES-QG-L1'],
    [{ testObject: 'collaborating-components', assertionScope: 'integration-contract', artifactFidelity: 'real-boundary' }, 'AES-QG-L2'],
    [{ testObject: 'assembled-candidate', assertionScope: 'system-smoke', artifactFidelity: 'assembled-process' }, 'AES-QG-L3'],
    [{ testObject: 'release-candidate-artifact', assertionScope: 'system-e2e-regression', artifactFidelity: 'release-artifact' }, 'AES-QG-L4'],
    [{ testObject: 'installed-distributable-artifact', assertionScope: 'operational-acceptance', artifactFidelity: 'installed-artifact' }, 'AES-QG-L5'],
  ];
  for (const [claim, expected] of positives) {
    const r = classifyCheck(claim);
    c(`正例 ${expected}（${claim.testObject}）`, r.classifiedAt === expected && isFullLevelNamespace(r.classifiedAt),
      `实际：${r.classifiedAt ?? r.classification}`);
  }
  // 近邻反例：等级=三轴最小值，任何单轴拉高都不能整体抬级
  const negatives = [
    [{ testObject: 'installed-distributable-artifact', assertionScope: 'component-behavior', artifactFidelity: 'controlled-standins' }, 'AES-QG-L1'],
    [{ testObject: 'release-candidate-artifact', assertionScope: 'static-conformance', artifactFidelity: 'static-artifact' }, 'AES-QG-L0'],
    [{ testObject: 'assembled-candidate', assertionScope: 'integration-contract', artifactFidelity: 'real-boundary' }, 'AES-QG-L2'],
    [{ testObject: 'collaborating-components', assertionScope: 'operational-acceptance', artifactFidelity: 'installed-artifact' }, 'AES-QG-L2'],
    [{ testObject: 'isolated-component', assertionScope: 'system-e2e-regression', artifactFidelity: 'release-artifact' }, 'AES-QG-L1'],
    [{ testObject: 'source', assertionScope: 'operational-acceptance', artifactFidelity: 'installed-artifact' }, 'AES-QG-L0'],
  ];
  for (const [claim, expected] of negatives) {
    const r = classifyCheck(claim);
    c(`近邻反例 →${expected}（scope=${claim.assertionScope}）`, r.classifiedAt === expected, `实际：${r.classifiedAt ?? r.classification}`);
  }
  // 名称/耗时/数量不能抬级：满身 E2E/full/release 标签 + L1 轴 → 仍是 L1
  const labeled = classifyCheck({
    name: 'Full E2E Release Suite', tags: ['e2e', 'full', 'release', 'L5'],
    durationMs: 987_654, testCount: 5000, networkPolicy: 'declared-endpoints',
    testObject: 'isolated-component', assertionScope: 'component-behavior', artifactFidelity: 'controlled-standins',
  });
  c('名称 E2E/full/release + 耗时 + 数量不能抬级（仍 L1）', labeled.classifiedAt === 'AES-QG-L1');
  // 正交维度：证据方式与质量属性不改变判级
  for (const mode of ['automated', 'live', 'manual', 'screenshot']) {
    const r = classifyCheck({
      evidenceMode: mode, security: 'checked', performance: 'measured',
      accessibility: 'audited', compatibility: 'matrix', reliability: 'soaked',
      testObject: 'collaborating-components', assertionScope: 'integration-contract', artifactFidelity: 'real-boundary',
    });
    c(`正交 evidence mode=${mode} 不改变等级（仍 L2）`, r.classifiedAt === 'AES-QG-L2');
  }
  // 未知/缺失轴 → UNCLASSIFIED，不猜
  c('未知轴值 → UNCLASSIFIED', classifyCheck({ testObject: 'mystery', assertionScope: 'component-behavior', artifactFidelity: 'controlled-standins' }).classification === 'UNCLASSIFIED');
  c('缺失轴 → UNCLASSIFIED', classifyCheck({ testObject: 'source' }).classification === 'UNCLASSIFIED');
  // 单项只产生 classifiedAt：没有 achievedLevel 字段
  const single = classifyCheck({ testObject: 'source', assertionScope: 'static-conformance', artifactFidelity: 'static-artifact' });
  c('单项判级只产生 classifiedAt（无 achievedLevel）', single.classifiedAt === 'AES-QG-L0' && !('achievedLevel' in single));
  // namespace：完整 vs 裸
  c('完整 namespace 接受 AES-QG-L3', isFullLevelNamespace('AES-QG-L3') && levelIndex('AES-QG-L3') === 3);
  for (const bad of ['L3', 'slsa-L3', 'AES-QG-L6', 'AES-QG-l3', 'AES-QG-Lx', '']) {
    c(`非完整 namespace 拒绝：${bad || '(空)'}`, !isFullLevelNamespace(bad));
  }
  c('裸 L3 识别为 bare（levelIndex=-1）', isBareLevel('L3') && levelIndex('L3') === -1);
});

// ---------------------------------------------------------------------------
// case 2：policy-execution（AC-002）
// ---------------------------------------------------------------------------

const casePolicyExecution = makeCase('policy-execution', async (c, track) => {
  const gateIds = ['gate.l0', 'gate.l1', 'gate.l2', 'gate.l3', 'gate.quick', 'gate.mid', 'gate'];
  const repoA = track(makeRepo({
    'run.toml': runTomlText({ gateIds }),
    'gate-policy.toml': policyText(),
  }));

  // 完整 policy + 标准等级：gate.l2 累计 L0-L2 全 PASS
  const a1 = runEngine(['--repo', repoA, 'gate.l2', '--json']);
  const receiptA1 = a1.stdout.trim().split(/\r?\n/).filter((l) => l.startsWith('{')).map((l) => JSON.parse(l)).pop();
  c('gate.l2 退出码 0', a1.status === 0, `stderr: ${a1.stderr}`);
  c('gate.l2 receipt PASS achieved=L2', receiptA1?.outcome === 'PASS' && receiptA1?.achievedLevel === 'AES-QG-L2'
    && receiptA1?.requestedLevel === 'AES-QG-L2');
  c('gate.l2 累计 L0-L2 三级全 PASS executed', receiptA1?.levels?.length === 3
    && receiptA1.levels.every((e) => e.outcome === 'PASS' && e.disposition === 'executed'));
  c('gate.l2 receipt 通过 schema 校验', validateGateReceipt(receiptA1).length === 0, validateGateReceipt(receiptA1).join('；'));
  c('人类输出首行含标准版本与 candidate', a1.stdout.includes('[AES-QG/1] requested=AES-QG-L2 candidate='));
  c('人类输出逐级 PASS 行', a1.stdout.includes('[AES-QG L0] PASS executed') && a1.stdout.includes('[AES-QG L2] PASS executed'));
  c('人类输出末行 achieved 结论', a1.stdout.includes('AES-QG L2 PASS: achieved=L2; release-qualified=false'));
  c('run.toml 是唯一命令真源：receipt 不复制 argv', !JSON.stringify(receiptA1).includes('"run":'));

  // 累计 + profile：gate.mid 展开 target L3，低层复用
  const before = runsOf(repoA).length;
  const a2 = runEngine(['--repo', repoA, 'gate.mid', '--json']);
  const receiptA2 = a2.stdout.trim().split(/\r?\n/).filter((l) => l.startsWith('{')).map((l) => JSON.parse(l)).pop();
  c('gate.mid 退出码 0', a2.status === 0, `stderr: ${a2.stderr}`);
  c('profile 显式展开 targetLevel=L3', receiptA2?.requestedLevel === 'AES-QG-L3'
    && receiptA2?.profile?.id === 'mid' && receiptA2?.profile?.targetLevel === 'AES-QG-L3');
  c('profile 低层 L0-L2 reused、L3 executed', receiptA2?.levels?.slice(0, 3).every((e) => e.disposition === 'reused' && /^sha256:[0-9a-f]{64}$/.test(e.receiptDigest))
    && receiptA2?.levels?.[3]?.disposition === 'executed');
  c('profile 行输出', a2.stdout.includes('[gate profile] id=mid target=AES-QG-L3 policy=sha256:'));
  c('profile 名不是证据：receipt 只认标准等级', receiptA2.achievedLevel === 'AES-QG-L3');
  c('复用产生新 run（L3 执行）', runsOf(repoA).length === before + 1);

  // unsupported：BLOCKED_CAPABILITY，不执行任何门
  const beforeB = runsOf(repoA).length;
  const a3 = runEngine(['--repo', repoA, 'gate.l4']);
  c('gate.l4 unsupported → 退出码 2', a3.status === 2);
  c('BLOCKED_CAPABILITY 文案', a3.stderr.includes('BLOCKED_CAPABILITY: requested=AES-QG-L4 supportedThrough=AES-QG-L3'));
  c('不产生任何等级 PASS 声明', a3.stderr.includes('No AES-QG L4 PASS claim was emitted.'));
  const blockedRuns = runsOf(repoA).slice(beforeB);
  c('BLOCKED 不执行任何门（无 level 文件）', blockedRuns.length === 1
    && readdirSync(join(repoA, '.aes-gate', 'runs', blockedRuns[0])).every((f) => f !== 'gate-receipt.json' ? !f.startsWith('level-') : true));
  const blockedReceipt = readReceipt(repoA, blockedRuns[0]);
  c('BLOCKED receipt：outcome=BLOCKED failureClass=BLOCKED_CAPABILITY unexecuted=[L4]',
    blockedReceipt.outcome === 'BLOCKED' && blockedReceipt.failureClass === 'BLOCKED_CAPABILITY'
    && JSON.stringify(blockedReceipt.unexecuted) === '["AES-QG-L4"]' && blockedReceipt.achievedLevel === null);
  c('BLOCKED receipt 通过 schema 校验', validateGateReceipt(blockedReceipt).length === 0, validateGateReceipt(blockedReceipt).join('；'));

  // 裸 gate：迁移终态拒绝歧义，不执行任何门
  const beforeD = runsOf(repoA).length;
  const a4 = runEngine(['--repo', repoA, 'gate']);
  c('裸 gate → 退出码 64', a4.status === 64);
  c('裸 gate 拒绝歧义文案', a4.stderr.includes('ERROR [AES-QG] ambiguous gate action')
    && a4.stderr.includes('Choose an objective level: gate.l0 ... gate.l5')
    && a4.stderr.includes('gate.quick / gate.mid'));
  c('裸 gate 不执行任何门（无新 run）', a4.stderr.includes('No gate was executed.') && runsOf(repoA).length === beforeD);

  // 缺级 policy：L0,L1,L3 跳过 L2 → 拒绝，不执行
  const repoGap = track(makeRepo({
    'run.toml': runTomlText({ gateIds: ['gate.l0', 'gate.l1', 'gate.l3'] }),
    'gate-policy.toml': policyText({ levelIdx: [0, 1, 3], profiles: [], releaseProfiles: [] }),
  }));
  const g1 = runEngine(['--repo', repoGap, 'gate.l1']);
  c('缺级 policy → 退出码 2 且拒绝执行', g1.status === 2 && g1.stderr.includes('连续') && runsOf(repoGap).length === 0);

  // argv 不复制：policy 里出现 run 数组 → 拒绝
  const argvCopyPolicy = policyText({ profiles: [], releaseProfiles: [] })
    .replace('[[levels]]\nlevel = "AES-QG-L0"\naction = "gate.l0"', '[[levels]]\nlevel = "AES-QG-L0"\naction = "gate.l0"\nrun = ["node", "-e", "process.exit(0)"]');
  const repoArgv = track(makeRepo({
    'run.toml': runTomlText({ gateIds: ['gate.l0', 'gate.l1'] }),
    'gate-policy.toml': argvCopyPolicy,
  }));
  const g2 = runEngine(['--repo', repoArgv, 'gate.l0']);
  c('policy 复制 argv → 退出码 2 拒绝', g2.status === 2 && g2.stderr.includes('不复制命令定义') && runsOf(repoArgv).length === 0);

  // 外键：policy 引用不存在的 action
  const repoGhost = track(makeRepo({
    'run.toml': runTomlText({ gateIds: ['gate.l0'] }),
    'gate-policy.toml': policyText({ levelIdx: [0, 1], supportedThrough: 'AES-QG-L1', levelActionOverride: { 1: 'gate.ghost' }, profiles: [], releaseProfiles: [] }),
  }));
  const g3 = runEngine(['--repo', repoGhost, 'gate.l0']);
  c('policy 引用不存在 action → 退出码 2', g3.status === 2 && g3.stderr.includes('gate.ghost') && g3.stderr.includes('run.toml'));

  // profile target 超出 supported_through
  const repoOver = track(makeRepo({
    'run.toml': runTomlText({ gateIds: ['gate.l0', 'gate.quick'] }),
    'gate-policy.toml': policyText({ levelIdx: [0], profiles: [['quick', 'AES-QG-L3']], releaseProfiles: [] }),
  }));
  const g4 = runEngine(['--repo', repoOver, 'gate.quick']);
  c('profile target 超支持上限 → 退出码 2', g4.status === 2 && g4.stderr.includes('AES-QG-L3') && g4.stderr.includes('supported_through'));

  // 未知请求 → 64
  const g5 = runEngine(['--repo', repoA, 'gate.l9']);
  c('gate.l9 → 退出码 64（不执行）', g5.status === 64 && g5.stderr.includes('unknown gate request'));
});

// ---------------------------------------------------------------------------
// case 3：receipt-identity-board（AC-003）
// ---------------------------------------------------------------------------

const caseReceiptIdentityBoard = makeCase('receipt-identity-board', async (c, track) => {
  // —— 五维 identity 逐项篡改（in-process 闭面）——
  const base = {
    candidateCommitSha: 'a'.repeat(40), artifactDigest: 'none',
    gateDefinitionDigest: 'sha256:' + '1'.repeat(64), policyDigest: 'sha256:' + '2'.repeat(64),
    environmentDigest: 'sha256:' + '3'.repeat(64),
  };
  c('基线 identity 自匹配可复用', reuseEligible(base, { ...base }));
  for (const dim of IDENTITY_DIMS) {
    const tampered = { ...base };
    tampered[dim] = dim === 'artifactDigest' ? 'sha256:' + 'f'.repeat(64) : `${tampered[dim]}x`;
    const changed = identityChanges(base, tampered);
    c(`篡改 ${dim} → 拒绝复用且只报该维`, !reuseEligible(base, tampered) && changed.length === 1 && changed[0] === dim);
  }
  c('五维之外字段不参与 identity（policyVersion 随 policyDigest 维承载）',
    identityChanges({ ...base, policyVersion: 'aes-gate-policy/v1' }, { ...base, policyVersion: 'aes-gate-policy/v2' }).length === 0);

  // —— 结局闭集与聚合一致性（in-process）——
  const agg = aggregateLevels({
    requestedLevel: 'AES-QG-L4',
    levelOutcomes: [
      { outcome: 'PASS', disposition: 'executed', runId: 'run-1' },
      { outcome: 'PASS', disposition: 'reused', receiptDigest: 'sha256:' + 'a'.repeat(64) },
      { outcome: 'PASS', disposition: 'executed', runId: 'run-2' },
      { outcome: 'FAILED', runId: 'run-2' },
    ],
  });
  c('连续聚合：L3 失败 → achieved=L2 outcome=FAILED', agg.outcome === 'FAILED'
    && agg.achievedLevel === 'AES-QG-L2' && agg.failedAt === 'AES-QG-L3');
  c('失败级以上 NOT_REACHED（不带 disposition）', agg.levels[4].level === 'AES-QG-L4'
    && agg.levels[4].outcome === 'NOT_REACHED' && agg.levels[4].disposition === undefined);
  c('reused 项保留 receiptDigest', agg.levels[1].disposition === 'reused' && agg.levels[1].receiptDigest.startsWith('sha256:'));
  const e1 = aggregateLevels({ requestedLevel: 'AES-QG-L4', levelOutcomes: [{ outcome: 'FAILED', runId: 'run-3' }] });
  c('E1：L0 失败 → achieved=null，绝不报告高级 PASS', e1.outcome === 'FAILED' && e1.achievedLevel === null
    && e1.levels.slice(1).every((e) => e.outcome === 'NOT_REACHED'));
  const receipt = buildGateReceipt({
    requestedLevel: 'AES-QG-L4', aggregate: agg,
    candidate: { commitSha: 'a'.repeat(40), worktreeDirty: false, artifactDigest: null },
    identity: base,
  });
  c('FAILED receipt 通过 schema 校验', validateGateReceipt(receipt).length === 0, validateGateReceipt(receipt).join('；'));

  // 反例：闭集外取值 / 缺级跨越 / 伪装
  const badOutcome = { ...receipt, outcome: 'SUCCESS' };
  c('outcome=SUCCESS 拒绝（闭集）', validateGateReceipt(badOutcome).some((e) => e.includes('outcome')));
  const badLevelOutcome = JSON.parse(JSON.stringify(receipt)); badLevelOutcome.levels[2].outcome = 'SKIPPED';
  c('level outcome=SKIPPED 拒绝', validateGateReceipt(badLevelOutcome).some((e) => e.includes('SKIPPED') || e.includes('outcome')));
  const notRunAsPass = JSON.parse(JSON.stringify(receipt)); notRunAsPass.levels[4] = { level: 'AES-QG-L4', outcome: 'PASS' };
  c('NOT_REACHED 改写 PASS 被聚合一致性拒绝', validateGateReceipt(notRunAsPass).length > 0);
  const reusedNoDigest = JSON.parse(JSON.stringify(receipt)); delete reusedNoDigest.levels[1].receiptDigest;
  c('reused 缺 receiptDigest 拒绝', validateGateReceipt(reusedNoDigest).some((e) => e.includes('receiptDigest')));
  const inflated = JSON.parse(JSON.stringify(aggregateLevels({
    requestedLevel: 'AES-QG-L3',
    levelOutcomes: [{ outcome: 'PASS', disposition: 'executed', runId: 'r' }, { outcome: 'PASS', disposition: 'executed', runId: 'r' }, { outcome: 'PASS', disposition: 'executed', runId: 'r' }, { outcome: 'PASS', disposition: 'executed', runId: 'r' }],
  })));
  const inflatedReceipt = buildGateReceipt({ requestedLevel: 'AES-QG-L3', aggregate: inflated, candidate: { commitSha: 'a'.repeat(40), worktreeDirty: false, artifactDigest: null }, identity: base });
  inflatedReceipt.achievedLevel = 'AES-QG-L4';
  c('achievedLevel 虚抬（与最高连续 PASS 不一致）拒绝', validateGateReceipt(inflatedReceipt).some((e) => e.includes('不一致')));

  // —— STALE_EVIDENCE 端到端（CLI，逐维触发）——
  const repoC = track(makeRepo({
    'run.toml': runTomlText({ gateIds: ['gate.l0', 'gate.l1'], markL0: true }),
    'gate-policy.toml': policyText({ levelIdx: [0, 1], supportedThrough: 'AES-QG-L1', artifactAt: [1], profiles: [], releaseProfiles: [] }),
    'dist/app.txt': 'artifact-bytes-v1',
  }));
  const c0 = runEngine(['--repo', repoC, 'gate.l1', '--json']);
  c('基线 gate.l1 PASS', c0.status === 0);
  const again = runEngine(['--repo', repoC, 'gate.l1', '--json']);
  const receiptAgain = again.stdout.trim().split(/\r?\n/).filter((l) => l.startsWith('{')).map((l) => JSON.parse(l)).pop();
  c('同 identity 立即复用：全 reused', again.status === 0
    && receiptAgain.levels.every((e) => e.disposition === 'reused' && e.receiptDigest));
  c('reused digest 与历史 level receipt 内容寻址一致', receiptAgain.levels.every((e) => e.receiptDigest.length === 71));

  // policy digest 变化（E2）
  writeFileSync(join(repoC, 'gate-policy.toml'), policyText({ levelIdx: [0, 1], supportedThrough: 'AES-QG-L1', artifactAt: [1], profiles: [], releaseProfiles: [] }) + '\n# drift\n');
  const c1 = runEngine(['--repo', repoC, 'gate.l1', '--json']);
  const receiptC1 = c1.stdout.trim().split(/\r?\n/).filter((l) => l.startsWith('{')).map((l) => JSON.parse(l)).pop();
  c('E2 policyDigest 变化 → STALE_EVIDENCE + 全部重执行', c1.stdout.includes('STALE_EVIDENCE policyDigest changed')
    && c1.stdout.includes('re-executing') && receiptC1.levels.every((e) => e.disposition === 'executed'));
  const r1 = runEngine(['--repo', repoC, 'gate.l1', '--json']);
  const receiptR1 = r1.stdout.trim().split(/\r?\n/).filter((l) => l.startsWith('{')).map((l) => JSON.parse(l)).pop();
  c('E2 后新基线再次全 reused', receiptR1.levels.every((e) => e.disposition === 'reused'));

  // artifact digest 变化（E3）：同源码 SHA、制品字节变化
  writeFileSync(join(repoC, 'dist', 'app.txt'), 'artifact-bytes-v2');
  const c2 = runEngine(['--repo', repoC, 'gate.l1']);
  c('E3 artifactDigest 变化 → STALE_EVIDENCE + 重执行', c2.stdout.includes('STALE_EVIDENCE artifactDigest changed')
    && !c2.stdout.includes('reused receipt'));

  // gate-definition digest 变化：policy 引用的 gate.l0 argv 改动（marker 精确定位）
  runEngine(['--repo', repoC, 'gate.l1']);
  writeFileSync(join(repoC, 'run.toml'), readFileSync(join(repoC, 'run.toml'), 'utf8').replace('/*v1*/', '/*v2*/'));
  const c3 = runEngine(['--repo', repoC, 'gate.l1']);
  c('gateDefinitionDigest 变化 → STALE_EVIDENCE + 重执行', c3.stdout.includes('STALE_EVIDENCE gateDefinitionDigest changed'));

  // candidate SHA 变化
  spawnSync('git', ['commit', '--allow-empty', '-qm', 'advance'], { cwd: repoC, encoding: 'utf8' });
  const c4 = runEngine(['--repo', repoC, 'gate.l1']);
  c('candidateCommitSha 变化 → STALE_EVIDENCE + 重执行', c4.stdout.includes('STALE_EVIDENCE candidateCommitSha changed'));

  // —— FAILED 流端到端 ——
  const repoE = track(makeRepo({
    'run.toml': runTomlText({ gateIds: ['gate.l0', 'gate.l1'], failIds: ['gate.l1'] }),
    'gate-policy.toml': policyText({ levelIdx: [0, 1], supportedThrough: 'AES-QG-L1', profiles: [], releaseProfiles: [] }),
  }));
  const e2run = runEngine(['--repo', repoE, 'gate.l1', '--json']);
  const e2receipt = e2run.stdout.trim().split(/\r?\n/).filter((l) => l.startsWith('{')).map((l) => JSON.parse(l)).pop();
  c('L1 断言失败 → 退出码 1，achieved=L0', e2run.status === 1 && e2receipt.outcome === 'FAILED'
    && e2receipt.failureClass === 'ASSERTION_FAILED' && e2receipt.failedAt === 'AES-QG-L1'
    && e2receipt.achievedLevel === 'AES-QG-L0');
  const repoF = track(makeRepo({
    'run.toml': runTomlText({ gateIds: ['gate.l0', 'gate.l1'], failIds: ['gate.l0'] }),
    'gate-policy.toml': policyText({ levelIdx: [0, 1], supportedThrough: 'AES-QG-L1', profiles: [], releaseProfiles: [] }),
  }));
  const fRun = runEngine(['--repo', repoF, 'gate.l1', '--json']);
  const fReceipt = fRun.stdout.trim().split(/\r?\n/).filter((l) => l.startsWith('{')).map((l) => JSON.parse(l)).pop();
  c('L0 失败（E1）→ achieved=null，L1 NOT_REACHED', fRun.status === 1 && fReceipt.achievedLevel === null
    && fReceipt.levels[1].outcome === 'NOT_REACHED');

  // —— Gate Board：receipt 纯投影 ——
  const passAgg = aggregateLevels({
    requestedLevel: 'AES-QG-L4',
    levelOutcomes: LEVEL_NAMES.slice(0, 5).map((_, i) => ({ outcome: 'PASS', disposition: i < 2 ? 'reused' : 'executed', ...(i < 2 ? { receiptDigest: 'sha256:' + String(i).repeat(64) } : { runId: `run-10${i}` }) })),
  });
  const passReceipt = buildGateReceipt({
    requestedLevel: 'AES-QG-L4', aggregate: passAgg,
    candidate: { commitSha: '7d9c0b4'.padEnd(40, '0'), worktreeDirty: false, artifactDigest: 'sha256:' + '5f'.repeat(32) },
    identity: base,
  });
  passReceipt.releasePolicy = {
    id: 'desktop-release', verdict: 'BLOCKED',
    missing: { qualityAttributes: ['security'], evidenceModes: ['live'], provenance: [] },
  };
  const boardPass = renderLevelBoard(passReceipt, {
    supportedThrough: 'AES-QG-L5',
    levels: LEVEL_NAMES.map((_, i) => ({ action: `gate.l${i}` })),
  });
  c('Board 关键状态：标准/achieved/release 卡片', boardPass.includes('AES-QG/1') && boardPass.includes('<div class="value">AES-QG L4</div>')
    && boardPass.includes('<div class="value">BLOCKED</div>') && boardPass.includes('through L5'));
  c('Board 六行 action 与边界列', ['gate.l0', 'gate.l1', 'gate.l2', 'gate.l3', 'gate.l4', 'gate.l5'].every((a) => boardPass.includes(`<td class="mono">${a}</td>`))
    && boardPass.includes('Static conformance') && boardPass.includes('Operational acceptance'));
  c('Board PASS/NOT REACHED 关键状态', (boardPass.match(/pill pass/g) || []).length === 5 && boardPass.includes('NOT REACHED'));
  c('Board 执行列 reused/executed 与 identity 列', boardPass.includes('>reused<') && boardPass.includes('>executed<') && boardPass.includes('run-102'));
  c('Board release BLOCKED 注记不被包装成发布资格', boardPass.includes('为什么 release 仍 BLOCKED'));
  c('Board 零 JS、零外链', !/<script/i.test(boardPass) && !/https?:\/\//.test(boardPass));
  c('Board 无未替换占位符', !/<!--(PROJECT|STANDARD|SUPPORTED|ACHIEVED|RELEASE|LEVELS|NOTE)-->/.test(boardPass));
  const boardLower = renderLevelBoard(buildGateReceipt({
    requestedLevel: 'AES-QG-L2',
    aggregate: aggregateLevels({ requestedLevel: 'AES-QG-L2', levelOutcomes: [{ outcome: 'PASS', disposition: 'executed', runId: 'r' }, { outcome: 'PASS', disposition: 'executed', runId: 'r' }, { outcome: 'PASS', disposition: 'executed', runId: 'r' }] }),
    candidate: { commitSha: 'a'.repeat(40), worktreeDirty: false, artifactDigest: null }, identity: base,
  }), null);
  c('Board 只投影 receipt：achieved=L2 时 L3-L5 行 NOT REACHED', boardLower.includes('<div class="value">AES-QG L2</div>')
    && (boardLower.match(/NOT REACHED/g) || []).length === 3);
  const boardBlocked = renderLevelBoard({
    schemaVersion: 'aes.gate.receipt/v1', standardVersion: 'AES-QG/1', requestedLevel: 'AES-QG-L4',
    achievedLevel: null, outcome: 'BLOCKED', failureClass: 'BLOCKED_CAPABILITY', detail: 'x',
    candidate: {}, identity: base, levels: [], unexecuted: ['AES-QG-L4'], qualifiesForRelease: false, releasePolicy: null,
  }, null);
  c('Board BLOCKED receipt：achieved=NONE + NOT REACHED', boardBlocked.includes('<div class="value">NONE</div>') && boardBlocked.includes('NOT REACHED'));
  const boardFailed = renderLevelBoard(receipt, null);
  c('Board FAILED receipt：FAILED pill + achieved=L2', boardFailed.includes('>FAILED</span>') && boardFailed.includes('<div class="value">AES-QG L2</div>'));

  // —— release qualification：L 等级与正交证据分别裁决 ——
  const l5Receipt = buildGateReceipt({
    requestedLevel: 'AES-QG-L5',
    aggregate: aggregateLevels({ requestedLevel: 'AES-QG-L5', levelOutcomes: LEVEL_NAMES.map(() => ({ outcome: 'PASS', disposition: 'executed', runId: 'r' })) }),
    candidate: { commitSha: 'a'.repeat(40), worktreeDirty: false, artifactDigest: null }, identity: base,
  });
  const releaseProfile = { id: 'desktop-release', required_level: 'AES-QG-L5', required_quality_attributes: ['functional', 'security', 'compatibility'], required_evidence_modes: ['automated', 'live'], require_provenance: true };
  const verdict = evaluateReleaseQualification({ receipt: l5Receipt, releaseProfile, evidence: { qualityAttributes: ['functional'], evidenceModes: ['automated'], provenance: false } });
  c('L5 PASS 不自动放行发布（缺 security/compatibility/live/provenance → BLOCKED）',
    l5Receipt.outcome === 'PASS' && verdict.qualifiesForRelease === false && verdict.verdict === 'BLOCKED'
    && verdict.missing.qualityAttributes.join(',') === 'security,compatibility'
    && verdict.missing.evidenceModes.join(',') === 'live' && verdict.missing.provenance.join(',') === 'provenance');
  const verdictOk = evaluateReleaseQualification({ receipt: l5Receipt, releaseProfile, evidence: { qualityAttributes: ['functional', 'security', 'compatibility'], evidenceModes: ['automated', 'live'], provenance: true } });
  c('正交证据齐全 + L5 → QUALIFIED', verdictOk.qualifiesForRelease === true);
  c('receipt 默认 qualifiesForRelease=false', l5Receipt.qualifiesForRelease === false && l5Receipt.releasePolicy === null);
});

// ---------------------------------------------------------------------------
// case 4：legacy-migration（AC-005）
// ---------------------------------------------------------------------------

const caseLegacyMigration = makeCase('legacy-migration', async (c, track) => {
  const fixtureRoot = join(SKILL_DIR, 'fixtures', 'legacy-repo');
  const legacy = track(mkdtempSync(join(tmpdir(), 'aes-qg-legacy-')));
  cpSync(fixtureRoot, legacy, { recursive: true });
  spawnSync('git', ['init', '-q'], { cwd: legacy, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.email', 't@e.com'], { cwd: legacy, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.name', 't'], { cwd: legacy, encoding: 'utf8' });
  spawnSync('git', ['add', '-A'], { cwd: legacy, encoding: 'utf8' });
  spawnSync('git', ['commit', '-qm', 'legacy init'], { cwd: legacy, encoding: 'utf8' });

  const oldReportPath = join(legacy, '.aes-gate', 'report-2026-01-01.md');
  const oldReportBytes = readFileSync(oldReportPath);
  const oldRunTomlBytes = readFileSync(join(legacy, 'run.toml'));

  // legacy 阶段：collect 识别 legacy-unqualified + UNCONFIRMED 映射候选
  const collect1 = spawnSync('node', [COLLECT, '--repo', legacy], { encoding: 'utf8', timeout: 120_000 });
  c('legacy collect 退出码 0', collect1.status === 0, collect1.stderr);
  const out1 = collect1.stdout;
  c('legacy gate discovered（bare gate，status=green）', out1.includes('legacy gate discovered: action=gate status=green classification=legacy-unqualified'));
  c('legacy gate discovered（e2e-check）', out1.includes('legacy gate discovered: action=gate.e2e status=green classification=legacy-unqualified'));
  c('映射候选 UNCONFIRMED（bare→L4，e2e→L4，unit→L1）',
    out1.includes('mapping candidate: gate -> AES-QG-L4 (UNCONFIRMED)')
    && out1.includes('mapping candidate: gate.e2e -> AES-QG-L4 (UNCONFIRMED)')
    && out1.includes('mapping candidate: gate.unit -> AES-QG-L1 (UNCONFIRMED)'));
  c('明示不产生 achievedLevel', out1.includes('no AES-QG achievedLevel emitted until gate-policy.toml is confirmed'));
  c('不回填：输出无任何 AES-QG 等级 PASS 声明', !/AES-QG-L\d (PASS|achieved)/.test(out1)
    && !out1.includes('"achievedLevel":"AES-QG-'));
  c('旧报告原字节保留', oldReportBytes.equals(readFileSync(oldReportPath)));
  c('run.toml 原字节保留', oldRunTomlBytes.equals(readFileSync(join(legacy, 'run.toml'))));
  const reportFiles = () => readdirSync(join(legacy, '.aes-gate')).filter((f) => /^report-/.test(f));
  c('历史报告不被改写（只新增本轮 report）', reportFiles().includes('report-2026-01-01.md') && reportFiles().length === 2);

  // legacy 阶段：引擎对裸 gate / 旧 action 一律 fail closed
  const bare = runEngine(['--repo', legacy, 'gate']);
  c('legacy 裸 gate → 64 + legacy-unqualified + 不执行', bare.status === 64
    && bare.stderr.includes('legacy-unqualified') && bare.stderr.includes('No gate was executed.')
    && runsOf(legacy).length === 0);
  const oldAction = runEngine(['--repo', legacy, 'gate.e2e']);
  c('legacy 旧 action 请求 → 2（不产生等级结论）', oldAction.status === 2 && oldAction.stderr.includes('legacy-unqualified')
    && runsOf(legacy).length === 0);

  // staged 阶段：确认 policy 后标准 action 生效，裸 gate 仍拒绝
  writeFileSync(join(legacy, 'gate-policy.toml'), policyText({
    levelIdx: [0], supportedThrough: 'AES-QG-L0', profiles: [], releaseProfiles: [], migration: 'staged',
    levelActionOverride: { 0: 'gate.unit' },
  }));
  const stagedBare = runEngine(['--repo', legacy, 'gate']);
  c('staged 裸 gate → 64 不执行任何门', stagedBare.status === 64 && stagedBare.stderr.includes('No gate was executed.')
    && stagedBare.stderr.includes('ambiguous'));
  const stagedRun = runEngine(['--repo', legacy, 'gate.l0', '--json']);
  const stagedReceipt = stagedRun.stdout.trim().split(/\r?\n/).filter((l) => l.startsWith('{')).map((l) => JSON.parse(l)).pop();
  c('staged gate.l0 → PASS L0（经确认的映射 action）', stagedRun.status === 0
    && stagedReceipt?.achievedLevel === 'AES-QG-L0');
  c('policy 确认不触碰旧证据字节', oldReportBytes.equals(readFileSync(oldReportPath)));

  // terminal 阶段：残留裸 gate 仍拒绝；删除后标准 action 不受影响
  writeFileSync(join(legacy, 'gate-policy.toml'), policyText({
    levelIdx: [0], supportedThrough: 'AES-QG-L0', profiles: [], releaseProfiles: [], migration: 'terminal',
    levelActionOverride: { 0: 'gate.unit' },
  }));
  const terminalBare = runEngine(['--repo', legacy, 'gate']);
  c('terminal 残留裸 gate → 64 不执行任何门', terminalBare.status === 64 && terminalBare.stderr.includes('No gate was executed.'));
  // 删除裸 gate（迁移终态建议）：直接重写 run.toml 去掉 bare gate
  writeFileSync(join(legacy, 'run.toml'), [
    '[project]', 'id = "legacy/fixture-repo"', '',
    gateAction('test.keep').replace('id = "test.keep"', 'id = "gate.unit"'),
  ].join('\n'));
  const terminalRun = runEngine(['--repo', legacy, 'gate.l0']);
  c('terminal 删除裸 gate 后标准 action 正常', terminalRun.status === 0);
  c('旧报告在整个迁移过程中原字节不变', oldReportBytes.equals(readFileSync(oldReportPath)));

  // 可重放：legacy fixture 上两次 collect 的标准面结论一致
  const replay = track(mkdtempSync(join(tmpdir(), 'aes-qg-replay-')));
  cpSync(fixtureRoot, replay, { recursive: true });
  spawnSync('git', ['init', '-q'], { cwd: replay, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.email', 't@e.com'], { cwd: replay, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.name', 't'], { cwd: replay, encoding: 'utf8' });
  spawnSync('git', ['add', '-A'], { cwd: replay, encoding: 'utf8' });
  spawnSync('git', ['commit', '-qm', 'legacy init'], { cwd: replay, encoding: 'utf8' });
  const stdLines = (out) => out.split(/\r?\n/).filter((l) => /^(legacy gate discovered|mapping candidate|no AES-QG)/.test(l)).sort();
  const r1 = spawnSync('node', [COLLECT, '--repo', replay], { encoding: 'utf8', timeout: 120_000 });
  const r2 = spawnSync('node', [COLLECT, '--repo', replay], { encoding: 'utf8', timeout: 120_000 });
  c('两次采集 legacy 结论可重放（逐行一致）', r1.status === 0 && r2.status === 0
    && JSON.stringify(stdLines(r1.stdout)) === JSON.stringify(stdLines(r2.stdout))
    && stdLines(r1.stdout).length === 7);
  c('重放不产生任何等级结论', !/AES-QG-L\d PASS/.test(r1.stdout + r2.stdout));
});

const CONTRACT_CASES = {
  'level-classification': caseLevelClassification,
  'policy-execution': casePolicyExecution,
  'receipt-identity-board': caseReceiptIdentityBoard,
  'legacy-migration': caseLegacyMigration,
};
const CONTRACT = 'aes-qg';

// ---------------------------------------------------------------------------
// 契约模式入口（--contract aes-qg --case X [--json]）与默认全量回归
// ---------------------------------------------------------------------------

function parseTestArgs(argv) {
  const opt = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
  };
  return { contract: opt('--contract'), caseName: opt('--case'), json: argv.includes('--json') };
}

function emitPayload(payload, json) {
  if (json) process.stdout.write(`${JSON.stringify(payload)}\n`);
  else process.stdout.write(`${payload.outcome} ${payload.case}: ${payload.passed}/${payload.total} assertions passed\n`);
}

async function contractMode({ contract, caseName, json }) {
  if (contract !== CONTRACT || (caseName !== null && !CONTRACT_CASES[caseName])) {
    emitPayload({
      schema: 'aes.aes-qg-contract-result/v1', contract, case: caseName,
      outcome: 'USAGE_ERROR', error: contract !== CONTRACT ? 'unsupported contract' : 'unsupported case',
      passed: 0, total: 0, failures: [],
    }, true);
    return 64;
  }
  if (caseName) {
    const payload = await CONTRACT_CASES[caseName]();
    emitPayload(payload, json);
    return payload.outcome === 'PASS' ? 0 : 1;
  }
  const results = [];
  for (const [name, fn] of Object.entries(CONTRACT_CASES)) results.push(await fn());
  const failures = results.flatMap((r) => r.failures);
  emitPayload({
    schema: 'aes.aes-qg-contract-suite-result/v1', contract: CONTRACT,
    outcome: failures.length ? 'FAIL' : 'PASS',
    passed: results.reduce((s, r) => s + r.passed, 0),
    total: results.reduce((s, r) => s + r.total, 0),
    cases: results.map(({ case: cAse, outcome, passed, total }) => ({ case: cAse, outcome, passed, total })),
    failures,
  }, json);
  return failures.length ? 1 : 0;
}

const testArgs = parseTestArgs(process.argv.slice(2));
if (testArgs.contract !== null || testArgs.caseName !== null) {
  contractMode(testArgs).then((code) => process.exit(code));
} else {
  // ---- T1 资源存在性 ----
  check('T1 SKILL.md 存在且声明 name', existsSync(join(SKILL_DIR, 'SKILL.md'))
    && /^name:\s*aes-gate$/m.test(readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8')));
  for (const ref of ['weights.md', 'pattern-library.md', 'api.md', 'design.md', 'aes-qg.md']) {
    check(`T1 references/${ref} 存在且非占位`, existsSync(join(SKILL_DIR, 'references', ref))
      && !readFileSync(join(SKILL_DIR, 'references', ref), 'utf8').includes('[TODO'));
  }
  check('T1 看板模板存在且零外链', existsSync(join(SKILL_DIR, 'assets', 'board.template.html'))
    && !/https?:\/\//.test(readFileSync(join(SKILL_DIR, 'assets', 'board.template.html'), 'utf8')));
  check('T1 等级看板模板存在且零 JS 零外链', existsSync(join(SKILL_DIR, 'assets', 'level-board.template.html'))
    && !/<script/i.test(readFileSync(join(SKILL_DIR, 'assets', 'level-board.template.html'), 'utf8'))
    && !/https?:\/\//.test(readFileSync(join(SKILL_DIR, 'assets', 'level-board.template.html'), 'utf8')));
  check('T1 scripts 全 .mjs 零依赖（无 package.json/node_modules）', readdirSync(join(SKILL_DIR, 'scripts'))
    .every((f) => f === 'vendor' || f.endsWith('.mjs')) && !existsSync(join(SKILL_DIR, 'scripts', 'node_modules')));

  // ---- T2 self-test 黑盒（正反样例全绿） ----
  check('T2 collect --self-test 退出码 0', runCode(['--self-test']) === 0);

  // ---- T3 handoff 端到端（临时仓；结构断言对齐 api.md 结局 1） ----
  const tmp = mkdtempSync(join(tmpdir(), 'aes-gate-runtests-'));
  try {
    mkdirSync(join(tmp, '.git'), { recursive: true });
    writeFileSync(join(tmp, 'run.toml'), [
      '[project]', 'id = "t/fixture"', '',
      '[[actions]]', 'id = "test.ok"', 'name = "Ok"', 'kind = "test"', 'run = ["node", "-e", "process.exit(0)"]', '',
    ].join('\n'));
    const out = run(['--handoff', '--repo', tmp]);
    check('T3 handoff 不落盘（.aes-gate 不存在）', !existsSync(join(tmp, '.aes-gate')));
    check('T3 handoff 四节结构（盘点表/评分/红门置顶/缺口清单）',
      out.includes('## gate 盘点表') && /## 评分：[\d.]+\/110 · (硬门禁|部分|纸面)/.test(out)
      && out.includes('## 红门置顶：') && out.includes('## 缺口清单（=移交单）'));
    check('T3 缺口条目可辩护（带风险级/组装性/归属）', /G1 P0.*可组装·aggregate-check.*归属：aes-gate:assemble/.test(out.replace(/\n/g, ' ')));
    check('T3 首测无基线明示', out.includes('首测无历史基线'));

    // 默认模式：落盘三件 + 退出码 0
    const code = runCode(['--repo', tmp]);
    const gateDir = join(tmp, '.aes-gate');
    const files = existsSync(gateDir) ? readdirSync(gateDir) : [];
    check('T3 默认模式退出码 0 且落盘三件', code === 0 && files.includes('gate-registry.json')
      && files.includes('board.html') && files.some((f) => /^report-.*\.md$/.test(f)), JSON.stringify(files));
    const registry = JSON.parse(readFileSync(join(gateDir, 'gate-registry.json'), 'utf8'));
    check('T3 registry 门 id=action id（runAction 引用）', registry.gates.some((g) => g.id === 'test.ok' && g.runAction === 'test.ok'));
    check('T3 registry 不复制命令定义（gates[].command 仅引用 run argv，缺口含 G0 无 run 标准则否）',
      registry.gates.every((g) => !g.command || Array.isArray(g.command)));
    check('T3 registry 含 AES-QG legacy 面（无门→空 legacy 列表）', registry.aesQg?.phase === 'legacy' && Array.isArray(registry.aesQg.legacyGates));
    check('T3 history 追加一行', Array.isArray(registry.history) && registry.history.length === 1);
    const board = readFileSync(join(gateDir, 'board.html'), 'utf8');
    check('T3 board 零 JS 零外链', !/<script/i.test(board) && !/https?:\/\//.test(board));
    check('T3 board 无未替换占位符', !/<!--(PROJECT|TIER|SCORE|DIMS|GATES|GAPS|CONVENTIONS|HISTORY|COLLECTED-AT)-->/.test(board));

    // 二轮：history 追加为 2、handoff 显示差值
    runCode(['--repo', tmp]);
    const registry2 = JSON.parse(readFileSync(join(gateDir, 'gate-registry.json'), 'utf8'));
    check('T3 二轮 history=2（追加不覆盖）', registry2.history.length === 2);
    const out2 = run(['--handoff', '--repo', tmp]);
    check('T3 二轮 handoff 含历史对比', out2.includes('上次') && /差 [-\d.]+/.test(out2));
    check('T3 二轮 handoff 仍不新增 report 文件', readdirSync(gateDir).filter((f) => /^report-/.test(f)).length === 1);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  // ---- T4 BLOCKED：非 git 仓退出码 2、stderr 不产表 ----
  const bare = mkdtempSync(join(tmpdir(), 'aes-gate-bare-'));
  try {
    let stderr = '';
    let code = 0;
    try {
      run(['--handoff', '--repo', bare]);
    } catch (e) {
      code = e.status ?? 1;
      stderr = e.stderr?.toString() || e.message || '';
    }
    check('T4 非 git 仓 → 退出码 2 + BLOCKED 提示', code === 2 && stderr.includes('BLOCKED'));
  } finally {
    rmSync(bare, { recursive: true, force: true });
  }

  // ---- T5 未知参数 → 退出码 64 ----
  check('T5 未知参数退出码 64', runCode(['--nonsense']) === 64);

  // ---- T6 本技能自身资源一致（design.md AC 表在、契约文件互引） ----
  const design = readFileSync(join(SKILL_DIR, 'references', 'design.md'), 'utf8');
  check('T6 design.md 验收条件表 AC-1…AC-5 在场', ['AC-1', 'AC-2', 'AC-3', 'AC-4', 'AC-5'].every((ac) => design.includes(ac)));

  // ---- T7 AES-QG 契约四 case（human 输出） ----
  for (const [name, fn] of Object.entries(CONTRACT_CASES)) {
    const payload = await fn();
    check(`T7 契约 ${name} 全绿`, payload.outcome === 'PASS',
      payload.failures.map((f) => `${f.name}: ${f.detail ?? ''}`).join('；').slice(0, 400));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
