#!/usr/bin/env node
// aes-qg.mjs — AES-QG/1 客观保证等级标准引擎（标准所有者：aes-gate 技能）。
// 职责（normative 文本见 ../references/aes-qg.md）：
//   §2 机械判级 classifyCheck｜§4 gate-policy 解析校验｜§5 累计执行与 GateReceipt
//   §6 五维 evidence identity 复用｜§7 release 独立裁决｜§9 legacy 迁移分类｜§10 消费合同
// 消费方：aes-qa（aes.qa.receipt/v3 原子引用 GateReceipt）与 aes-worktree-board/GATE-qa。
// 零第三方依赖：Node 内置模块 + scripts/vendor/toml。本文件自包含，不 import collect.mjs，
// 避免 collect（采集面）↔ 本引擎（标准面）循环依赖。
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { delimiter, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const parseToml = require('./vendor/toml/index.cjs').parse;

export const STANDARD_VERSION = 'AES-QG/1';
export const POLICY_SCHEMA = 'aes-gate-policy/v1';
export const RECEIPT_SCHEMA = 'aes.gate.receipt/v1';
export const LEVEL_RECEIPT_SCHEMA = 'aes.gate.level-receipt/v1';
export const LEVEL_NAMES = Object.freeze(Array.from({ length: 6 }, (_, i) => `AES-QG-L${i}`));
const FULL_LEVEL_RE = /^AES-QG-L[0-5]$/;
const BARE_LEVEL_RE = /^L[0-5]$/;
const RUN_ACTION_ID = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/;
const RUN_KINDS = ['task', 'open', 'test', 'gate'];
const RESERVED_IDS = ['list', 'show', 'doctor', 'help', 'run'];
export const GATE_DIR_NAME = '.aes-gate';
export const RUNS_DIR_NAME = 'runs';
const DEFAULT_TIMEOUT_MS = 300_000;

export function levelIndex(level) {
  return typeof level === 'string' && FULL_LEVEL_RE.test(level) ? Number(level.slice(-1)) : -1;
}
// 人类可读 display 形式：`AES-QG L3`（确认版 example-run 的行格式；机器字段保持 `AES-QG-L3`）
export function displayLevel(level) {
  return typeof level === 'string' ? level.replace(/^AES-QG-(L[0-5])$/, 'AES-QG $1') : level;
}
export function isFullLevelNamespace(value) {
  return typeof value === 'string' && FULL_LEVEL_RE.test(value) && !BARE_LEVEL_RE.test(value);
}
export function isBareLevel(value) {
  return typeof value === 'string' && BARE_LEVEL_RE.test(value);
}

// ---------------------------------------------------------------------------
// §2 机械判级：等级 = testObject / assertionScope / artifactFidelity 三轴等级的最小值。
// 名称（含 E2E/full/release）、耗时、测试数量、网络策略、证据方式、人工/自动都不是判级输入。
// ---------------------------------------------------------------------------

export const CLASSIFICATION_AXES = Object.freeze({
  testObject: Object.freeze({
    source: 0, config: 0, schema: 0, 'build-graph': 0,
    'isolated-component': 1,
    'collaborating-components': 2,
    'assembled-candidate': 3,
    'release-candidate-artifact': 4,
    'installed-distributable-artifact': 5,
  }),
  assertionScope: Object.freeze({
    'static-conformance': 0,
    'component-behavior': 1,
    'integration-contract': 2,
    'system-smoke': 3,
    'system-e2e-regression': 4,
    'operational-acceptance': 5,
  }),
  artifactFidelity: Object.freeze({
    'static-artifact': 0,
    'controlled-standins': 1,
    'real-boundary': 2,
    'assembled-process': 3,
    'release-artifact': 4,
    'installed-artifact': 5,
  }),
});

// 输入里被显式忽略的键：它们属于正交维度，出现与否不改变判级（AC-001 反例面）。
export const IGNORED_CLASSIFICATION_KEYS = Object.freeze([
  'name', 'label', 'tags', 'durationMs', 'testCount', 'networkPolicy', 'network',
  'evidenceMode', 'manual', 'automated', 'live', 'screenshot',
  'security', 'performance', 'accessibility', 'compatibility', 'reliability',
]);

export function classifyCheck(claim) {
  if (!claim || typeof claim !== 'object') {
    return { classification: 'UNCLASSIFIED', reason: '判级输入必须是对象' };
  }
  const indices = {};
  const unknown = [];
  for (const axis of Object.keys(CLASSIFICATION_AXES)) {
    const value = claim[axis];
    const table = CLASSIFICATION_AXES[axis];
    if (typeof value !== 'string' || !(value in table)) unknown.push(axis);
    else indices[axis] = table[value];
  }
  if (unknown.length > 0) {
    return { classification: 'UNCLASSIFIED', reason: `轴取值不在闭集或缺失：${unknown.join(', ')}` };
  }
  const min = Math.min(indices.testObject, indices.assertionScope, indices.artifactFidelity);
  // 单项只产生 classifiedAt；achievedLevel 属于累计 receipt（§5），此处不存在。
  return { classifiedAt: LEVEL_NAMES[min], axes: { ...indices } };
}

// ---------------------------------------------------------------------------
// digests：canonical JSON 序列化 + sha256（内容寻址）
// ---------------------------------------------------------------------------

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
export function digestOf(content) { return `sha256:${createHash('sha256').update(content).digest('hex')}`; }
export function digestJson(value) { return digestOf(canonicalJson(value)); }
export function canonicalReceiptDigest(receipt) { return digestJson(receipt); }

// ---------------------------------------------------------------------------
// run.toml 读取与校验（与 collect.mjs parseRunToml 同规则；自包含副本，注册真源仍是 run.toml）
// ---------------------------------------------------------------------------

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
    if (!RUN_KINDS.includes(a.kind)) errors.push(`action ${a.id} kind 非法：${a.kind}`);
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

export function loadRunToml(repoRoot) {
  const p = join(repoRoot, 'run.toml');
  if (!existsSync(p)) return null;
  return parseRunToml(readFileSync(p, 'utf8'));
}

// ---------------------------------------------------------------------------
// §4 gate-policy.toml（aes-gate-policy/v1）：只引用 run action id，绝不复制命令定义
// ---------------------------------------------------------------------------

export function parsePolicyText(text) {
  const errors = [];
  let raw = null;
  try {
    raw = parseToml(text);
  } catch (error) {
    return { raw: null, policy: null, errors: [`gate-policy.toml 不是合法 TOML：${error.message}`] };
  }
  if (raw.schema !== POLICY_SCHEMA) errors.push(`schema 必须是 ${POLICY_SCHEMA}，实际：${raw.schema ?? 'NOT_SET'}`);
  if (raw.standard !== STANDARD_VERSION) errors.push(`standard 必须是 ${STANDARD_VERSION}，实际：${raw.standard ?? 'NOT_SET'}`);
  const supportedThrough = raw.supported_through ?? null;
  if (!isFullLevelNamespace(supportedThrough)) errors.push(`supported_through 必须是完整 AES-QG-Lx，实际：${supportedThrough ?? 'NOT_SET'}`);
  const migration = raw.migration ?? 'terminal';
  if (!['staged', 'terminal'].includes(migration)) errors.push(`migration 只允许 staged|terminal，实际：${migration}`);

  const rawLevels = Array.isArray(raw.levels) ? raw.levels : [];
  const levels = rawLevels.map((l) => ({
    level: l.level ?? null, action: l.action ?? null,
    subject: l.subject ?? null, environment_class: l.environment_class ?? null,
    network_policy: l.network_policy ?? null, size_class: l.size_class ?? null,
    artifact_paths: Array.isArray(l.artifact_paths) ? l.artifact_paths : [],
  }));
  if (rawLevels.length === 0) errors.push('缺 [[levels]]（至少 L0）');
  for (const [i, l] of rawLevels.entries()) {
    if (!isFullLevelNamespace(l.level)) errors.push(`levels[${i}].level 必须是完整 AES-QG-Lx，实际：${l.level ?? 'NOT_SET'}`);
    if (typeof l.action !== 'string' || l.action === '') errors.push(`levels[${i}].action 缺失`);
    for (const banned of ['run', 'argv']) {
      if (l[banned] !== undefined) errors.push(`levels[${i}] 不得含 ${banned}（policy 只引用 action id，不复制命令定义）`);
    }
    if (l.artifact_paths !== undefined && !Array.isArray(l.artifact_paths)) errors.push(`levels[${i}].artifact_paths 必须是数组`);
  }
  const supportedIdx = levelIndex(supportedThrough);
  if (supportedIdx >= 0) {
    const sortedIdx = levels.map((l) => levelIndex(l.level)).sort((a, b) => a - b);
    const expected = Array.from({ length: supportedIdx + 1 }, (_, i) => i);
    if (sortedIdx.length !== expected.length || sortedIdx.some((v, i) => v !== expected[i])) {
      errors.push(`levels 必须从 AES-QG-L0 连续到 supported_through=${supportedThrough}，不跳级不重复不越界`);
    }
  }

  const rawProfiles = Array.isArray(raw.profiles) ? raw.profiles : [];
  const profileIds = new Set();
  const profiles = rawProfiles.map((p) => ({ id: p.id ?? null, action: p.action ?? null, target_level: p.target_level ?? null }));
  for (const [i, p] of rawProfiles.entries()) {
    if (typeof p.id !== 'string' || p.id === '') errors.push(`profiles[${i}].id 缺失`);
    else if (profileIds.has(p.id)) errors.push(`profiles id 重复：${p.id}`);
    else profileIds.add(p.id);
    if (typeof p.action !== 'string' || p.action === '') errors.push(`profiles[${i}].action 缺失`);
    if (!isFullLevelNamespace(p.target_level)) errors.push(`profiles[${i}].target_level 必须显式写完整 AES-QG-Lx，实际：${p.target_level ?? 'NOT_SET'}`);
    else if (levelIndex(p.target_level) > supportedIdx) errors.push(`profiles[${i}].target_level=${p.target_level} 超出 supported_through=${supportedThrough}`);
    for (const banned of ['run', 'argv']) {
      if (p[banned] !== undefined) errors.push(`profiles[${i}] 不得含 ${banned}（policy 只引用 action id，不复制命令定义）`);
    }
  }

  const rawRelease = Array.isArray(raw.release_profiles) ? raw.release_profiles : [];
  const releaseIds = new Set();
  const releaseProfiles = rawRelease.map((r) => ({
    id: r.id ?? null,
    required_level: r.required_level ?? null,
    required_quality_attributes: Array.isArray(r.required_quality_attributes) ? r.required_quality_attributes : [],
    required_evidence_modes: Array.isArray(r.required_evidence_modes) ? r.required_evidence_modes : [],
    require_provenance: r.require_provenance === true,
  }));
  for (const [i, r] of rawRelease.entries()) {
    if (typeof r.id !== 'string' || r.id === '') errors.push(`release_profiles[${i}].id 缺失`);
    else if (releaseIds.has(r.id)) errors.push(`release_profiles id 重复：${r.id}`);
    else releaseIds.add(r.id);
    if (!isFullLevelNamespace(r.required_level)) errors.push(`release_profiles[${i}].required_level 必须是完整 AES-QG-Lx，实际：${r.required_level ?? 'NOT_SET'}`);
  }

  const policy = errors.length > 0 ? null : {
    schema: POLICY_SCHEMA, standard: STANDARD_VERSION, supportedThrough, migration,
    levels, profiles, releaseProfiles,
  };
  return { raw, policy, errors };
}

// policy ↔ run.toml 交叉校验（外键：action id 必须存在且 kind="gate"）
export function validatePolicyAgainstRun(policy, runToml) {
  const errors = [];
  const byId = new Map((runToml?.actions ?? []).map((a) => [a.id, a]));
  const ref = (action, where) => {
    const a = byId.get(action);
    if (!a) errors.push(`${where} 引用的 action "${action}" 不在 run.toml`);
    else if (a.kind !== 'gate') errors.push(`${where} 引用的 action "${action}" kind=${a.kind}，必须是 kind="gate"`);
  };
  for (const l of policy.levels) ref(l.action, `levels[${l.level}]`);
  for (const p of policy.profiles) ref(p.action, `profiles[${p.id}]`);
  return errors;
}

export function loadPolicy(repoRoot, runToml) {
  const p = join(repoRoot, 'gate-policy.toml');
  if (!existsSync(p)) return { present: false, phase: 'legacy' };
  const { policy, errors } = parsePolicyText(readFileSync(p, 'utf8'));
  if (!policy) return { present: true, phase: 'invalid', errors };
  const runErrors = validatePolicyAgainstRun(policy, runToml);
  if (runErrors.length > 0) return { present: true, phase: 'invalid', errors: runErrors };
  return { present: true, phase: policy.migration, policy, policyDigest: digestOf(readFileSync(p, 'utf8')) };
}

// ---------------------------------------------------------------------------
// §6 五维 evidence identity
// ---------------------------------------------------------------------------

export const IDENTITY_DIMS = Object.freeze([
  'candidateCommitSha', 'artifactDigest', 'gateDefinitionDigest', 'policyDigest', 'environmentDigest',
]);

export function environmentIdentity() {
  return { node: process.version, platform: process.platform, arch: process.arch };
}
export function environmentDigest() { return digestJson(environmentIdentity()); }

export function gateDefinitionDigest(policy, runToml) {
  const byId = new Map((runToml?.actions ?? []).map((a) => [a.id, a]));
  const ids = [...new Set([...policy.levels.map((l) => l.action), ...policy.profiles.map((p) => p.action)])].sort();
  return digestJson(ids.map((id) => {
    const a = byId.get(id);
    return a ? { id: a.id, kind: a.kind, run: a.run } : { id, missing: true };
  }));
}

export function artifactDigestOf(repoRoot, policy) {
  const paths = [...new Set(policy.levels.flatMap((l) => l.artifact_paths || []))].sort();
  if (paths.length === 0) return { digest: 'none', missing: [] };
  const missing = paths.filter((p) => !existsSync(join(repoRoot, p)));
  if (missing.length > 0) return { digest: null, missing };
  const parts = paths.map((p) => `${p}:${digestOf(readFileSync(join(repoRoot, p)))}`);
  return { digest: digestOf(parts.join('\n')), missing: [] };
}

export function identityChanges(stored, current) {
  return IDENTITY_DIMS.filter((dim) => canonicalJson(stored?.[dim]) !== canonicalJson(current?.[dim]));
}
export function reuseEligible(stored, current) {
  return Boolean(stored && current) && identityChanges(stored, current).length === 0;
}

// ---------------------------------------------------------------------------
// §5 累计聚合与 GateReceipt（aes.gate.receipt/v1）
// ---------------------------------------------------------------------------

// levelOutcomes：L0..requested 逐级执行/复用结果（outcome 仅 PASS|FAILED）。
export function aggregateLevels({ requestedLevel, levelOutcomes }) {
  const reqIdx = levelIndex(requestedLevel);
  const levels = [];
  let failedAt = null;
  for (let i = 0; i <= reqIdx; i++) {
    if (failedAt !== null) {
      levels.push({ level: LEVEL_NAMES[i], outcome: 'NOT_REACHED' });
      continue;
    }
    const r = levelOutcomes[i] ?? null;
    if (!r || r.outcome === 'FAILED') {
      failedAt = LEVEL_NAMES[i];
      levels.push({ level: LEVEL_NAMES[i], outcome: 'FAILED', ...(r?.runId ? { runId: r.runId } : {}) });
    } else {
      levels.push(r.disposition === 'reused'
        ? { level: LEVEL_NAMES[i], outcome: 'PASS', disposition: 'reused', receiptDigest: r.receiptDigest }
        : { level: LEVEL_NAMES[i], outcome: 'PASS', disposition: 'executed', runId: r.runId });
    }
  }
  let achievedLevel = null;
  for (const e of levels) {
    if (e.outcome === 'PASS') achievedLevel = e.level;
    else break;
  }
  const outcome = failedAt !== null ? 'FAILED' : 'PASS';
  return {
    levels,
    achievedLevel: outcome === 'PASS' ? requestedLevel : achievedLevel,
    outcome,
    failedAt,
  };
}

export function buildGateReceipt({ requestedLevel, aggregate, candidate, identity, profile = null }) {
  return {
    schemaVersion: RECEIPT_SCHEMA,
    standardVersion: STANDARD_VERSION,
    requestedLevel,
    achievedLevel: aggregate.achievedLevel,
    outcome: aggregate.outcome,
    ...(profile ? { profile: { id: profile.id, targetLevel: profile.target_level } } : {}),
    candidate,
    identity,
    levels: aggregate.levels,
    ...(aggregate.outcome === 'FAILED'
      ? { failureClass: 'ASSERTION_FAILED', failedAt: aggregate.failedAt }
      : {}),
    qualifiesForRelease: false,
    releasePolicy: null,
  };
}

export function buildBlockedReceipt({ requestedLevel, supportedThrough, candidate, identity }) {
  return {
    schemaVersion: RECEIPT_SCHEMA,
    standardVersion: STANDARD_VERSION,
    requestedLevel,
    achievedLevel: null,
    outcome: 'BLOCKED',
    failureClass: 'BLOCKED_CAPABILITY',
    detail: `policy supportedThrough=${supportedThrough}; requested=${requestedLevel}`,
    candidate,
    identity,
    levels: [],
    unexecuted: [requestedLevel],
    qualifiesForRelease: false,
    releasePolicy: null,
  };
}

const OUTCOMES = Object.freeze(['PASS', 'BLOCKED', 'FAILED']);
const LEVEL_OUTCOMES = Object.freeze(['PASS', 'FAILED', 'NOT_REACHED']);

export function validateGateReceipt(receipt) {
  const errors = [];
  const bad = (m) => errors.push(m);
  if (receipt?.schemaVersion !== RECEIPT_SCHEMA) bad(`schemaVersion 必须是 ${RECEIPT_SCHEMA}`);
  if (receipt?.standardVersion !== STANDARD_VERSION) bad(`standardVersion 必须是 ${STANDARD_VERSION}`);
  if (!isFullLevelNamespace(receipt?.requestedLevel)) bad(`requestedLevel 必须是完整 AES-QG-Lx，实际：${receipt?.requestedLevel ?? 'NOT_SET'}`);
  if (receipt?.achievedLevel !== null && !isFullLevelNamespace(receipt?.achievedLevel)) bad(`achievedLevel 必须是完整 AES-QG-Lx 或 null，实际：${receipt?.achievedLevel ?? 'NOT_SET'}`);
  if (!OUTCOMES.includes(receipt?.outcome)) bad(`outcome 闭集 ${OUTCOMES.join('|')}，实际：${receipt?.outcome ?? 'NOT_SET'}`);
  if (!Array.isArray(receipt?.levels)) bad('levels 必须是数组');
  else {
    let expect = 0;
    let sawTerminal = false; // FAILED 之后的等级只能 NOT_REACHED（失败截断阶梯）
    for (const [i, e] of receipt.levels.entries()) {
      if (!isFullLevelNamespace(e.level)) bad(`levels[${i}].level 必须是完整 AES-QG-Lx，实际：${e.level ?? 'NOT_SET'}`);
      else if (levelIndex(e.level) !== expect) bad(`levels[${i}].level=${e.level} 破坏 L0 起连续性`);
      expect += 1;
      if (!LEVEL_OUTCOMES.includes(e.outcome)) bad(`levels[${i}].outcome 闭集 ${LEVEL_OUTCOMES.join('|')}，实际：${e.outcome ?? 'NOT_SET'}`);
      if (sawTerminal && e.outcome !== 'NOT_REACHED') bad(`levels[${i}] 在 FAILED 之后必须是 NOT_REACHED，实际：${e.outcome}`);
      if (e.outcome === 'FAILED') sawTerminal = true;
      if (e.outcome === 'NOT_REACHED' && e.disposition !== undefined) bad(`levels[${i}] NOT_REACHED 不得带 disposition`);
      if (e.disposition !== undefined && !['executed', 'reused'].includes(e.disposition)) bad(`levels[${i}].disposition 闭集 executed|reused，实际：${e.disposition}`);
      if (e.disposition === 'reused') {
        if (typeof e.receiptDigest !== 'string' || !/^sha256:[0-9a-f]{64}$/i.test(e.receiptDigest)) bad(`levels[${i}] reused 必须带合法 receiptDigest`);
      }
    }
    // 最高连续 PASS 必须与 achievedLevel 一致
    let highest = null;
    for (const e of receipt.levels) {
      if (e.outcome === 'PASS') highest = e.level; else break;
    }
    if (highest !== (receipt.achievedLevel ?? null)) {
      bad(`achievedLevel=${receipt.achievedLevel ?? 'null'} 与 levels 最高连续 PASS=${highest ?? 'null'} 不一致`);
    }
  }
  if (receipt?.outcome === 'PASS' && receipt.achievedLevel !== receipt.requestedLevel) {
    bad('outcome=PASS 时 achievedLevel 必须等于 requestedLevel');
  }
  if (receipt?.outcome === 'FAILED') {
    if (receipt.failureClass !== 'ASSERTION_FAILED') bad('FAILED 必须 failureClass=ASSERTION_FAILED');
    if (!isFullLevelNamespace(receipt.failedAt)) bad('FAILED 必须带 failedAt=AES-QG-Lx');
    else if (!Array.isArray(receipt.levels) || !receipt.levels.some((e) => e.level === receipt.failedAt && e.outcome === 'FAILED')) bad('failedAt 必须对应 levels 中 FAILED 的那一级');
  }
  if (receipt?.outcome === 'BLOCKED') {
    if (receipt.failureClass !== 'BLOCKED_CAPABILITY') bad('BLOCKED 必须 failureClass=BLOCKED_CAPABILITY');
    if (!Array.isArray(receipt.unexecuted) || receipt.unexecuted.length === 0) bad('BLOCKED 必须带非空 unexecuted');
  }
  if (receipt?.releasePolicy !== null && receipt.releasePolicy !== undefined) {
    const rp = receipt.releasePolicy;
    if (!rp || typeof rp.id !== 'string' || !rp.id) bad('releasePolicy.id 缺失');
    if (!['QUALIFIED', 'BLOCKED'].includes(rp?.verdict)) bad(`releasePolicy.verdict 闭集 QUALIFIED|BLOCKED，实际：${rp?.verdict ?? 'NOT_SET'}`);
    if (rp?.verdict === 'QUALIFIED' && receipt.qualifiesForRelease !== true) bad('verdict=QUALIFIED 时 qualifiesForRelease 必须=true');
  }
  if (receipt?.qualifiesForRelease === true && receipt.outcome !== 'PASS') bad('非 PASS 不得 qualifiesForRelease=true');
  return errors;
}

// ---------------------------------------------------------------------------
// §7 release qualification（独立裁决：L5 不自动放行发布）
// ---------------------------------------------------------------------------

export function evaluateReleaseQualification({ receipt, releaseProfile, evidence }) {
  const provided = evidence || {};
  const levelOk = receipt.outcome === 'PASS'
    && receipt.achievedLevel !== null
    && levelIndex(receipt.achievedLevel) >= levelIndex(releaseProfile.required_level);
  const missingQualityAttributes = releaseProfile.required_quality_attributes
    .filter((a) => !(provided.qualityAttributes ?? []).includes(a));
  const missingEvidenceModes = releaseProfile.required_evidence_modes
    .filter((m) => !(provided.evidenceModes ?? []).includes(m));
  const missingProvenance = releaseProfile.require_provenance && provided.provenance !== true ? ['provenance'] : [];
  const missing = {
    qualityAttributes: missingQualityAttributes,
    evidenceModes: missingEvidenceModes,
    provenance: missingProvenance,
  };
  const verdict = levelOk && missingQualityAttributes.length === 0 && missingEvidenceModes.length === 0 && missingProvenance.length === 0
    ? 'QUALIFIED' : 'BLOCKED';
  return { qualifiesForRelease: verdict === 'QUALIFIED', verdict, missing, levelOk };
}

// ---------------------------------------------------------------------------
// §9 legacy 迁移分类
// ---------------------------------------------------------------------------

// 名称启发式映射候选——永远 UNCONFIRMED，用户确认前不参与任何判级。
// 裸 `gate` 按 example-run 场景 7 的确认版输出给 L4 候选（历史裸 gate 语义不可证明，只能提议）。
export function legacyMappingCandidate(actionId) {
  const id = String(actionId).toLowerCase();
  if (id === 'gate') return { to: 'AES-QG-L4', status: 'UNCONFIRMED', why: 'bare gate 历史语义不可证明，默认只提议 L4（system E2E regression）候选' };
  const rules = [
    [/install|upgrade|compat|lifecycle|uninstall/, 'AES-QG-L5'],
    [/e2e|end-to-end|endtoend|release/, 'AES-QG-L4'],
    [/smoke|assembl|bootstrap/, 'AES-QG-L3'],
    [/integration|integ|ipc|adapter/, 'AES-QG-L2'],
    [/unit|component/, 'AES-QG-L1'],
    [/lint|type|format|check|schema|static|build|parse/, 'AES-QG-L0'],
  ];
  for (const [re, to] of rules) if (re.test(id)) return { to, status: 'UNCONFIRMED', why: `名称启发式（${re.source}），需用户确认` };
  return null;
}

export function classifyLegacyGates(runToml) {
  const gates = (runToml?.actions ?? []).filter((a) => a.kind === 'gate');
  return gates.map((a) => {
    const candidate = legacyMappingCandidate(a.id);
    return {
      action: a.id,
      classification: 'legacy-unqualified',
      bare: a.id === 'gate',
      ...(candidate ? { mappingCandidates: [candidate] } : { mappingCandidates: [] }),
    };
  });
}

// collect 集成入口（B10）：policy 合规 / legacy 分类 / 裸 gate 拒绝提示
export function analyzeGateStandard(repoRoot, runToml, statusOf = null) {
  if (!runToml) return null;
  const loaded = loadPolicy(repoRoot, runToml);
  if (!loaded.present) {
    const legacyGates = classifyLegacyGates(runToml);
    const lines = [];
    for (const g of legacyGates) {
      const status = statusOf ? statusOf(g.action) : null;
      lines.push(`legacy gate discovered: action=${g.action}${status ? ` status=${status}` : ''} classification=${g.classification}`);
      for (const c of g.mappingCandidates) lines.push(`mapping candidate: ${g.action} -> ${c.to} (${c.status})`);
    }
    if (legacyGates.length > 0) lines.push('no AES-QG achievedLevel emitted until gate-policy.toml is confirmed');
    return {
      phase: 'legacy', standardVersion: STANDARD_VERSION, legacyGates,
      bareGatePresent: legacyGates.some((g) => g.bare), lines,
    };
  }
  if (loaded.phase === 'invalid') {
    return {
      phase: 'invalid', standardVersion: STANDARD_VERSION,
      errors: loaded.errors, lines: [`gate-policy.toml invalid: ${loaded.errors.length} error(s)`, ...loaded.errors.map((e) => `  - ${e}`)],
    };
  }
  const bareGatePresent = runToml.actions.some((a) => a.id === 'gate');
  const latest = readLatestGateReceipt(repoRoot);
  const lines = [
    `[AES-QG] policy ${loaded.phase}: supportedThrough=${loaded.policy.supportedThrough} digest=${loaded.policyDigest.slice(0, 14)}...`,
    ...(bareGatePresent ? ['bare gate action=gate present: engine refuses to execute it (exit 64); delete it at migration terminal'] : []),
    latest?.receipt
      ? `latest AES-QG run: run=${latest.runId} requested=${latest.receipt.requestedLevel} achieved=${latest.receipt.achievedLevel ?? 'none'} outcome=${latest.receipt.outcome}`
      : 'no AES-QG run yet (execute gate.lx to produce aes.gate.receipt/v1)',
  ];
  return {
    phase: loaded.phase, standardVersion: STANDARD_VERSION,
    policy: {
      supportedThrough: loaded.policy.supportedThrough,
      migration: loaded.policy.migration,
      profiles: loaded.policy.profiles.map((p) => ({ id: p.id, action: p.action, targetLevel: p.target_level })),
      releaseProfiles: loaded.policy.releaseProfiles.map((r) => ({ id: r.id, requiredLevel: r.required_level })),
    },
    policyDigest: loaded.policyDigest,
    gateDefinitionDigest: gateDefinitionDigest(loaded.policy, runToml),
    latestAchievedLevel: latest?.receipt?.achievedLevel ?? null,
    bareGatePresent, lines,
  };
}

// ---------------------------------------------------------------------------
// 执行器：spawn（Windows .cmd 经 cmd.exe 中转——与 collect.mjs resolveSpawnTarget 同法，
// CVE-2024-27980 后 Node 禁止无 shell 直接 spawn .cmd/.bat；此处为自包含副本）
// ---------------------------------------------------------------------------

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
function quoteForCmd(part) { return /[\s"]/.test(part) ? `"${part.replace(/"/gu, '\\"')}"` : part; }
function resolveSpawnTarget(argv, cwd) {
  if (process.platform !== 'win32') return { file: argv[0], args: argv.slice(1) };
  const resolved = executableCandidates(argv[0], cwd).find((candidate) => {
    try { statSync(candidate); return true; } catch { return false; }
  });
  if (resolved && /\.(cmd|bat)$/iu.test(resolved)) {
    return { file: 'cmd.exe', args: ['/d', '/s', '/c', argv.map(quoteForCmd).join(' ')] };
  }
  return { file: resolved ?? argv[0], args: argv.slice(1) };
}
export function runGateAction(argv, cwd, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const { file, args } = resolveSpawnTarget(argv, cwd);
  const res = spawnSync(file, args, { cwd, shell: false, timeout: timeoutMs, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (res.error && (res.error.code === 'ENOENT' || res.error.code === 'EINVAL')) {
    return { exitCode: null, note: `命令不可执行（${res.error.code}）` };
  }
  if ((res.error && res.error.code === 'ETIMEDOUT') || res.signal === 'SIGTERM') {
    return { exitCode: null, note: `超时（>${Math.round(timeoutMs / 1000)}s，不确定归 FAILED）` };
  }
  if (res.error) return { exitCode: null, note: `启动失败：${res.error.message}` };
  return { exitCode: res.status, note: '' };
}

// ---------------------------------------------------------------------------
// run 目录与复用扫描（内容寻址）
// ---------------------------------------------------------------------------

function runsDirOf(repoRoot) { return join(repoRoot, GATE_DIR_NAME, RUNS_DIR_NAME); }

// 最新一次 AES-QG 运行的累计 receipt（collect/看板只读投影用）
export function readLatestGateReceipt(repoRoot) {
  for (const { runId, dir } of listRuns(runsDirOf(repoRoot))) {
    const f = join(dir, 'gate-receipt.json');
    if (!existsSync(f)) continue;
    try { return { runId, receipt: JSON.parse(readFileSync(f, 'utf8')) }; } catch { return { runId, receipt: null }; }
  }
  return null;
}

function listRuns(runsDir) {
  if (!existsSync(runsDir)) return [];
  return readdirSync(runsDir)
    .map((name) => /^run-(\d+)$/.exec(name))
    .filter(Boolean)
    .map((m) => ({ runId: m[0], n: Number(m[1]), dir: join(runsDir, m[0]) }))
    .sort((a, b) => b.n - a.n);
}

export function loadPriorLevelReceipts(repoRoot, excludeRunId = null) {
  const out = [];
  for (const { runId, dir } of listRuns(runsDirOf(repoRoot))) {
    if (runId === excludeRunId) continue;
    for (const level of LEVEL_NAMES) {
      const f = join(dir, `level-${level}.json`);
      if (!existsSync(f)) continue;
      try { out.push({ runId, file: f, receipt: JSON.parse(readFileSync(f, 'utf8')) }); } catch { /* 坏文件忽略，不造假 */ }
    }
  }
  return out;
}

function shortDigest(value) {
  const s = String(value ?? 'none');
  return s.startsWith('sha256:') ? `${s.slice(0, 11)}...` : s;
}

// ---------------------------------------------------------------------------
// 主执行流程
// ---------------------------------------------------------------------------

function gitOut(repoRoot, args) {
  const r = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8', shell: false });
  return r.status === 0 ? String(r.stdout).trim() : null;
}

export async function executeRequest({
  repoRoot, request, timeoutMs = DEFAULT_TIMEOUT_MS, releaseProfileId = null, evidencePath = null,
} = {}) {
  const human = [];
  const stderrLines = [];
  let stat = null;
  try { stat = statSync(repoRoot); } catch { /* below */ }
  if (!stat || !stat.isDirectory()) {
    stderrLines.push(`[AES-QG] BLOCKED：目标不可读：${repoRoot}`);
    return { exitCode: 2, receipt: null, human, stderrLines };
  }
  const runToml = loadRunToml(repoRoot);
  if (!runToml) {
    stderrLines.push('[AES-QG] BLOCKED：run.toml 缺失或不合法（action 注册真源不存在）');
    return { exitCode: 2, receipt: null, human, stderrLines };
  }
  const loaded = loadPolicy(repoRoot, runToml);
  if (loaded.present && loaded.phase === 'invalid') {
    stderrLines.push('[AES-QG] BLOCKED：gate-policy.toml 不合规——不执行任何门：');
    for (const e of loaded.errors) stderrLines.push(`  - ${e}`);
    return { exitCode: 2, receipt: null, human, stderrLines };
  }

  // 裸 gate：只要标准在管（policy 已确认）或未确认（legacy），都拒绝歧义，不执行任何门。
  if (request === 'gate' || request === undefined || request === null || request === '') {
    stderrLines.push('ERROR [AES-QG] ambiguous gate action');
    if (loaded.present) {
      stderrLines.push('Choose an objective level: gate.l0 ... gate.l5');
      const ps = loaded.policy.profiles.map((p) => p.action);
      stderrLines.push(ps.length > 0 ? `Or choose a declared profile: ${ps.join(' / ')}` : 'Or choose a declared profile: (none declared)');
    } else {
      stderrLines.push('No confirmed gate-policy.toml: this gate is legacy-unqualified; run collect to draft policy candidates');
    }
    stderrLines.push('No gate was executed.');
    return { exitCode: 64, receipt: null, human, stderrLines };
  }

  if (!loaded.present) {
    stderrLines.push('[AES-QG] BLOCKED：无已确认 gate-policy.toml——repository gate 为 legacy-unqualified，不产生 AES-QG 等级结论');
    return { exitCode: 2, receipt: null, human, stderrLines };
  }
  const { policy } = loaded;

  // 请求解析：gate.lN 标准等级｜gate.<profile> 展开 target_level｜其余用法错误
  let requestedLevel = null;
  let profile = null;
  const levelMatch = /^gate\.l([0-5])$/.exec(request);
  if (levelMatch) requestedLevel = LEVEL_NAMES[Number(levelMatch[1])];
  else {
    profile = policy.profiles.find((p) => p.action === request) ?? null;
    if (profile) requestedLevel = profile.target_level;
    else {
      stderrLines.push(`ERROR [AES-QG] unknown gate request: ${request}`);
      stderrLines.push('Choose an objective level: gate.l0 ... gate.l5');
      stderrLines.push('No gate was executed.');
      return { exitCode: 64, receipt: null, human, stderrLines };
    }
  }

  const supportedIdx = levelIndex(policy.supportedThrough);
  const commitSha = gitOut(repoRoot, ['rev-parse', 'HEAD']);
  if (!commitSha) {
    stderrLines.push('[AES-QG] BLOCKED：目标不是可用 git 仓库（无法解析 candidate SHA）');
    return { exitCode: 2, receipt: null, human, stderrLines };
  }
  const dirty = (() => {
    const s = gitOut(repoRoot, ['status', '--porcelain=v1']);
    return s !== null && s !== '';
  })();

  const candidateCommon = { commitSha, worktreeDirty: dirty };
  const identityCommon = { candidateCommitSha: commitSha, policyVersion: POLICY_SCHEMA };

  // 能力不足：BLOCKED_CAPABILITY（不是测试 FAIL，也不是 N/A PASS）
  if (levelIndex(requestedLevel) > supportedIdx) {
    const art = artifactDigestOf(repoRoot, policy);
    const identity = { ...identityCommon, artifactDigest: art.digest ?? 'missing', gateDefinitionDigest: gateDefinitionDigest(policy, runToml), policyDigest: loaded.policyDigest, environmentDigest: environmentDigest() };
    const receipt = buildBlockedReceipt({
      requestedLevel, supportedThrough: policy.supportedThrough,
      candidate: { ...candidateCommon, artifactDigest: art.digest === 'none' ? null : art.digest },
      identity,
    });
    const runId = nextRunId(repoRoot);
    const runDir = join(runsDirOf(repoRoot), runId);
    mkdirSync(runDir, { recursive: true });
    const receiptPath = join(runDir, 'gate-receipt.json');
    writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    stderrLines.push(`BLOCKED_CAPABILITY: requested=${requestedLevel} supportedThrough=${policy.supportedThrough}`);
    stderrLines.push(`No ${displayLevel(requestedLevel)} PASS claim was emitted.`);
    return { exitCode: 2, receipt, human, stderrLines, receiptPath };
  }

  const art = artifactDigestOf(repoRoot, policy);
  if (art.missing.length > 0) {
    stderrLines.push(`[AES-QG] BLOCKED：policy 声明的 artifact 缺失：${art.missing.join(', ')}`);
    return { exitCode: 2, receipt: null, human, stderrLines };
  }
  const identity = {
    ...identityCommon,
    artifactDigest: art.digest,
    gateDefinitionDigest: gateDefinitionDigest(policy, runToml),
    policyDigest: loaded.policyDigest,
    environmentDigest: environmentDigest(),
  };
  const candidate = { ...candidateCommon, artifactDigest: art.digest === 'none' ? null : art.digest };

  const runId = nextRunId(repoRoot);
  const runDir = join(runsDirOf(repoRoot), runId);
  mkdirSync(runDir, { recursive: true });
  writeFileSync(join(runDir, 'request.json'), `${JSON.stringify({
    request, resolvedLevel: requestedLevel, ...(profile ? { profile: profile.id } : {}), identity, requestedAt: new Date().toISOString(),
  }, null, 2)}\n`, 'utf8');

  human.push(`[${STANDARD_VERSION}] requested=${requestedLevel} candidate=${commitSha.slice(0, 7)}`);
  if (profile) human.push(`[gate profile] id=${profile.id} target=${requestedLevel} policy=${shortDigest(loaded.policyDigest)}`);

  // 累计 L0..requested：先按五维 identity 找可复用 PASS 证据，否则执行
  const priors = loadPriorLevelReceipts(repoRoot, runId);
  const levelOutcomes = [];
  let stop = false;
  for (let i = 0; i <= levelIndex(requestedLevel); i++) {
    const level = LEVEL_NAMES[i];
    const action = policy.levels.find((l) => levelIndex(l.level) === i)?.action;
    const runAction = runToml.actions.find((a) => a.id === action);
    if (stop || !runAction) {
      levelOutcomes.push({ outcome: 'FAILED', runId: null });
      continue;
    }
    const priorMatch = priors.find((p) => p.receipt.level === level && p.receipt.outcome === 'PASS'
      && reuseEligible(p.receipt.identity, identity));
    if (priorMatch) {
      levelOutcomes.push({ outcome: 'PASS', disposition: 'reused', receiptDigest: digestJson(priorMatch.receipt) });
      human.push(`[${displayLevel(level)}] PASS reused receipt=${shortDigest(digestJson(priorMatch.receipt))}`);
      continue;
    }
    for (const p of priors.filter((x) => x.receipt.level === level)) {
      const dims = identityChanges(p.receipt.identity, identity);
      if (dims.length > 0) {
        human.push(`[${displayLevel(level)}] STALE_EVIDENCE ${dims.join('+')} changed ${shortDigest(p.receipt.identity[dims[0]])} -> ${shortDigest(identity[dims[0]])}`);
        human.push(`[${displayLevel(level)}] re-executing`);
      }
      break;
    }
    const r = runGateAction(runAction.run, repoRoot, timeoutMs);
    const levelReceipt = {
      schemaVersion: LEVEL_RECEIPT_SCHEMA,
      standardVersion: STANDARD_VERSION,
      level, action, runId,
      outcome: r.exitCode === 0 ? 'PASS' : 'FAILED',
      exitCode: r.exitCode,
      ...(r.note ? { note: r.note } : {}),
      command: runAction.run,
      executedAt: new Date().toISOString(),
      identity,
    };
    writeFileSync(join(runDir, `level-${level}.json`), `${JSON.stringify(levelReceipt, null, 2)}\n`, 'utf8');
    if (r.exitCode === 0) {
      levelOutcomes.push({ outcome: 'PASS', disposition: 'executed', runId });
      human.push(`[${displayLevel(level)}] PASS executed run=${runId}`);
    } else {
      levelOutcomes.push({ outcome: 'FAILED', runId });
      human.push(`[${displayLevel(level)}] FAILED${r.note ? `（${r.note}）` : `（exit=${r.exitCode}）`} run=${runId}`);
      stop = true;
    }
  }

  const aggregate = aggregateLevels({ requestedLevel, levelOutcomes });
  let receipt = buildGateReceipt({ requestedLevel, aggregate, candidate, identity, profile });

  // release qualification：独立裁决，L5 PASS 不自动放行
  let releaseLines = [];
  if (releaseProfileId) {
    const rp = policy.releaseProfiles.find((x) => x.id === releaseProfileId);
    if (!rp) {
      stderrLines.push(`[AES-QG] BLOCKED：未知 release profile：${releaseProfileId}`);
      return { exitCode: 2, receipt: null, human, stderrLines };
    }
    let evidence = {};
    if (evidencePath) {
      try { evidence = JSON.parse(readFileSync(evidencePath, 'utf8')); } catch {
        stderrLines.push('[AES-QG] BLOCKED：--evidence 不是合法 JSON 文件');
        return { exitCode: 2, receipt: null, human, stderrLines };
      }
    }
    const verdict = evaluateReleaseQualification({ receipt, releaseProfile: rp, evidence });
    receipt = {
      ...receipt,
      qualifiesForRelease: verdict.qualifiesForRelease,
      releasePolicy: { id: rp.id, verdict: verdict.verdict, missing: verdict.missing },
    };
    releaseLines = [
      `${displayLevel(requestedLevel)} ${receipt.outcome}`,
      `release profile ${rp.id}: ${verdict.verdict}`,
      ...(verdict.missing.qualityAttributes.length + verdict.missing.evidenceModes.length + verdict.missing.provenance.length > 0
        ? [`missing orthogonal evidence: ${[...verdict.missing.qualityAttributes, ...verdict.missing.evidenceModes, ...verdict.missing.provenance].join(', ')}`]
        : []),
      `release-qualified=${verdict.qualifiesForRelease}`,
    ];
  }

  const receiptPath = join(runDir, 'gate-receipt.json');
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  try {
    writeFileSync(join(repoRoot, GATE_DIR_NAME, 'level-board.html'), renderLevelBoard(receipt, policy), 'utf8');
  } catch { /* 看板失败不影响 receipt 语义 */ }

  if (releaseProfileId) {
    human.push(...releaseLines);
  } else if (receipt.outcome === 'PASS') {
    human.push(`${displayLevel(requestedLevel)} PASS:${profile ? ` profile=${profile.id};` : ''} achieved=${requestedLevel.slice(-2)}; release-qualified=false`);
  } else {
    human.push(`${displayLevel(requestedLevel)} FAILED: achieved=${receipt.achievedLevel ?? 'none'}; failedAt=${receipt.failedAt}`);
  }
  human.push(`GateReceipt: ${join(GATE_DIR_NAME, RUNS_DIR_NAME, runId, 'gate-receipt.json').replaceAll('\\', '/')}`);

  return { exitCode: receipt.outcome === 'PASS' ? 0 : 1, receipt, human, stderrLines, receiptPath, runId };
}


function nextRunId(repoRoot) {
  const runs = listRuns(runsDirOf(repoRoot));
  return `run-${(runs[0]?.n ?? 0) + 1}`;
}

// ---------------------------------------------------------------------------
// Gate Board（等级看板）：receipt 的纯投影，零 JS、零外链、断网可读
// ---------------------------------------------------------------------------

export function renderLevelBoard(receipt, policy = null) {
  const template = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'level-board.template.html'), 'utf8');
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const boundary = ['Static conformance', 'Component behavior', 'Component integration', 'System smoke', 'System E2E', 'Operational acceptance'];
  const achievedIdx = receipt.achievedLevel ? levelIndex(receipt.achievedLevel) : -1;
  const failedIdx = receipt.failedAt ? levelIndex(receipt.failedAt) : -1;
  const rows = LEVEL_NAMES.map((level, i) => {
    const entry = (receipt.levels ?? []).find((e) => e.level === level);
    const action = policy?.levels?.[i]?.action ?? `gate.l${i}`;
    let pill; let disposition = '—'; let idCell = '—';
    if (entry) {
      if (entry.outcome === 'PASS') {
        pill = '<span class="pill pass">PASS</span>';
        if (entry.disposition === 'reused') { disposition = 'reused'; idCell = `<span class="mono muted">${esc(shortDigest(entry.receiptDigest))}</span>`; }
        else { disposition = 'executed'; idCell = `<span class="mono muted">${esc(entry.runId ?? '')}</span>`; }
      } else if (entry.outcome === 'FAILED') {
        pill = '<span class="pill fail">FAILED</span>';
        disposition = 'executed';
        idCell = `<span class="mono muted">${esc(entry.runId ?? '')}</span>`;
      } else {
        pill = '<span class="pill blocked">NOT REACHED</span>';
      }
    } else if (receipt.outcome === 'BLOCKED') {
      pill = '<span class="pill blocked">NOT REACHED</span>';
    } else if (i === failedIdx) {
      pill = '<span class="pill fail">FAILED</span>';
    } else if (i <= achievedIdx) {
      pill = '<span class="pill pass">PASS</span>';
    } else {
      pill = '<span class="pill blocked">NOT REACHED</span>';
    }
    return `<tr><td class="mono">${esc(action)}</td><td>${boundary[i]}</td><td>${pill}</td><td>${esc(disposition)}</td><td>${idCell}</td></tr>`;
  }).join('\n      ');
  const supported = policy?.supportedThrough && isFullLevelNamespace(policy.supportedThrough)
    ? `through L${levelIndex(policy.supportedThrough)}`
    : (receipt.requestedLevel && isFullLevelNamespace(receipt.requestedLevel) ? `through L${levelIndex(receipt.requestedLevel)}` : '—');
  const release = receipt.releasePolicy
    ? { QUALIFIED: 'QUALIFIED', BLOCKED: 'BLOCKED' }[receipt.releasePolicy.verdict] ?? '—'
    : (receipt.qualifiesForRelease === true ? 'QUALIFIED' : '—');
  const note = receipt.releasePolicy
    ? (receipt.releasePolicy.verdict === 'QUALIFIED'
      ? `<strong>release profile ${esc(receipt.releasePolicy.id)}：QUALIFIED。</strong>等级与正交证据均满足所选 profile。`
      : `<strong>为什么 release 仍 BLOCKED：</strong>profile=${esc(receipt.releasePolicy.id)}，缺 ${[
        ...receipt.releasePolicy.missing?.qualityAttributes ?? [],
        ...receipt.releasePolicy.missing?.evidenceModes ?? [],
        ...receipt.releasePolicy.missing?.provenance ?? [],
      ].join('、') || '等级'}。${esc('AES-QG')} L${Math.max(levelIndex(receipt.requestedLevel), 0)} PASS 不会被界面包装成发布资格。`)
    : `<strong>release 未评估：</strong>${esc('AES-QG')} 等级结论与发布资格分离；未选择 release profile 时 release-qualified 恒为 false。`;
  return template
    .replaceAll('<!--PROJECT-->', esc(receipt.identity?.candidateCommitSha?.slice(0, 7) ?? '—'))
    .replaceAll('<!--STANDARD-->', esc(receipt.standardVersion))
    .replaceAll('<!--SUPPORTED-->', esc(supported))
    .replaceAll('<!--ACHIEVED-->', esc(receipt.achievedLevel ? displayLevel(receipt.achievedLevel) : 'NONE'))
    .replaceAll('<!--RELEASE-->', esc(release))
    .replaceAll('<!--LEVELS-->', rows)
    .replaceAll('<!--NOTE-->', note);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function usage() {
  console.log(`用法：node aes-qg.mjs --repo <路径> <request> [--timeout <秒>] [--json]
                [--release-profile <id> [--evidence <evidence.json>]]
  request: gate.l0 ... gate.l5 | gate.<profile-action> | gate（拒绝歧义，退出 64）
退出码：0=PASS；1=ASSERTION_FAILED；2=BLOCKED（capability/policy/目标不可读）；64=用法或歧义。`);
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
  };
  if (args.includes('--help') || args.includes('-h')) { usage(); return 0; }
  const known = new Set(['--repo', '--timeout', '--json', '--release-profile', '--evidence', '--help', '-h']);
  const positional = args.filter((a, i) => !a.startsWith('--') && !known.has(args[i - 1]));
  const unknown = args.filter((a, i) => a.startsWith('--') && !known.has(a) && !known.has(args[i - 1]));
  if (unknown.length > 0 || positional.length > 1) { usage(); console.error(`参数错误：${unknown.join(' ')} 位置参数：${positional.join(' ')}`); return 64; }
  const repoRoot = resolve(opt('--repo') || process.cwd());
  const request = positional[0] ?? 'gate';
  const timeoutMs = Number(opt('--timeout')) > 0 ? Number(opt('--timeout')) * 1000 : DEFAULT_TIMEOUT_MS;
  const result = await executeRequest({
    repoRoot, request, timeoutMs,
    releaseProfileId: opt('--release-profile'), evidencePath: opt('--evidence'),
  });
  for (const line of result.human) console.log(line);
  for (const line of result.stderrLines) console.error(line);
  if (args.includes('--json') && result.receipt) console.log(JSON.stringify(result.receipt));
  return result.exitCode;
}

// 同 collect.mjs：junction/符号链接安装下 argv[1]（链接路径）≠ import.meta.url（真实路径），
// 两侧 realpath 后比较，否则守卫恒假、main 永不执行（静默 exit 0）。
const invokedAsSelf = (() => {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (invokedAsSelf) {
  main().then((code) => process.exit(code)).catch((error) => {
    console.error(`[AES-QG] 内部错误：${error.stack || error.message}`);
    process.exit(1);
  });
}
