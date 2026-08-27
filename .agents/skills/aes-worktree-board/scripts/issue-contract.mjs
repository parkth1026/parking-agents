#!/usr/bin/env node
// 最小 Issue Contract 校验（B5 / E3）：contract-complete 是无人值守 claim 的前置门。
// 缺目标、workflow role、AC、依赖、风险/人工门或副作用边界时不 claim，回流 needs-info，
// 且不计为 worker failure —— 这是「合同不完整」而不是「实现失败」。
import { digestOf, storeError } from './job-store.mjs';

export const WORK_ORDER_SCHEMA = 'aes.issue-worker.work-order/v1';
export const REJECTION_SCHEMA = 'aes.issue-worker.work-order-rejection/v1';
export const WORKFLOW_ROLES = Object.freeze(['implement', 'diagnose', 'research', 'review', 'design']);
export const EXECUTION_POLICIES = Object.freeze(['for-agent', 'for-human']);
export const EVIDENCE_CLASSES = Object.freeze(['automated', 'live', 'manual']);
export const SIDE_EFFECTS = Object.freeze([
  'edit-worktree', 'run-tests', 'create-commit', 'read-github', 'write-github', 'network', 'install-deps',
]);
export const MODEL_TIERS = Object.freeze(['economy', 'standard', 'frontier']);

// 契约要求的六个必填域。顺序即报错时 missing[] 的顺序，便于回流报文稳定可断言。
const REQUIRED_SECTIONS = Object.freeze([
  'goal', 'workflowRole', 'acceptanceCriteria', 'dependencies', 'riskProfile', 'allowedSideEffects',
]);

function labelNames(issue) {
  return (issue?.labels || []).map((label) => (typeof label === 'string' ? label : label?.name)).filter(Boolean);
}

// 明确 ready-for-human 的 Issue 不进入无人值守 claim（不变清单）。
export function isAutonomousCandidate(issue) {
  const labels = labelNames(issue);
  if (labels.includes('ready-for-human')) return { eligible: false, reason: 'ready-for-human 不进入无人值守 claim' };
  if (!labels.includes('ready-for-agent')) return { eligible: false, reason: '缺少 ready-for-agent 标签' };
  if (issue.state !== 'OPEN') return { eligible: false, reason: `Issue 状态为 ${issue.state}` };
  return { eligible: true, reason: null };
}

// 真实 GitHub Issue 的正文是 markdown，不是结构化对象。这里把约定的六个小节抽出来，
// 抽不到就留空让上面的校验判 missing —— 解析器绝不"尽力理解"，宁可判合同不完整。
const SECTION_PATTERNS = Object.freeze({
  goal: /^##\s*目标\s*$/m,
  workflowRole: /^##\s*workflow\s*role\s*$/im,
  acceptanceCriteria: /^##\s*验收条件\s*$/m,
  dependencies: /^##\s*依赖\s*$/m,
  risk: /^##\s*风险\s*$/m,
  allowedSideEffects: /^##\s*允许的副作用\s*$/m,
  humanGates: /^##\s*人工门\s*$/m,
});

// 契约小节字段名与 SECTION_PATTERNS 的 key 并非逐一同名（risk 小节对应 riskProfile
// 字段）；重复检测报出的 invalid.field 要跟 parseIssueContract 里已有的字段名对齐，
// 不能引入第二套命名。导出供 selftest 复用同一份映射，避免两处手抄失步。
export const SECTION_FIELD_NAMES = Object.freeze({
  goal: 'goal',
  workflowRole: 'workflowRole',
  acceptanceCriteria: 'acceptanceCriteria',
  dependencies: 'dependencies',
  risk: 'riskProfile',
  allowedSideEffects: 'allowedSideEffects',
  humanGates: 'humanGates',
});

function sectionBody(body, pattern) {
  const match = pattern.exec(body);
  if (!match) return null;
  const start = match.index + match[0].length;
  const rest = body.slice(start);
  const next = /^##\s+/m.exec(rest);
  return (next ? rest.slice(0, next.index) : rest).trim();
}

// pattern.exec() 只取第一个匹配 —— 同名小节重复时，第二份（往往才是真正想表达的
// 契约内容）会被静默丢弃，且完全没有信号提示"取错了"。这里独立统计每个小节标题
// 出现的次数：一旦 >1，无论内容长什么样，一律 fail closed 判 DUPLICATE_SECTION，
// 不去猜哪一份才是"真的"。
function countSectionOccurrences(body, pattern) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const global = new RegExp(pattern.source, flags);
  return [...body.matchAll(global)].length;
}

function findDuplicateSections(body) {
  const duplicates = [];
  for (const [key, pattern] of Object.entries(SECTION_PATTERNS)) {
    if (countSectionOccurrences(body, pattern) > 1) duplicates.push(SECTION_FIELD_NAMES[key]);
  }
  return duplicates;
}

export function parseIssueBody(body) {
  const text = String(body || '');
  const goal = sectionBody(text, SECTION_PATTERNS.goal);
  const roleText = sectionBody(text, SECTION_PATTERNS.workflowRole);
  const acText = sectionBody(text, SECTION_PATTERNS.acceptanceCriteria);
  const depsText = sectionBody(text, SECTION_PATTERNS.dependencies);
  const riskText = sectionBody(text, SECTION_PATTERNS.risk);
  const effectsText = sectionBody(text, SECTION_PATTERNS.allowedSideEffects);
  const gatesText = sectionBody(text, SECTION_PATTERNS.humanGates);
  const duplicateSections = findDuplicateSections(text);

  const contract = {};
  if (goal) contract.goal = goal;
  if (roleText) {
    const role = roleText.split(/\s+/)[0]?.trim().toLowerCase();
    if (role) contract.workflowRole = role;
  }
  if (acText !== null) {
    // 形如 `- **AC-1**（automated）：文本`
    const criteria = [];
    for (const line of acText.split(/\r?\n/)) {
      const match = /^[-*]\s*\*{0,2}(AC-[\w.]+)\*{0,2}\s*[（(]\s*(\w+)\s*[)）]\s*[:：]\s*(.+)$/.exec(line.trim());
      if (match) criteria.push({ id: match[1], evidenceClass: match[2].toLowerCase(), text: match[3].trim() });
    }
    if (criteria.length) contract.acceptanceCriteria = criteria;
  }
  if (depsText !== null) {
    // 「无。」是显式的空依赖声明；未写这一节才算 missing。
    contract.dependencies = /^无[。.]?$/.test(depsText)
      ? []
      : [...depsText.matchAll(/#(\d+)/g)].map((match) => Number(match[1]));
  }
  if (riskText) {
    const match = /riskProfile\s*[:：]\s*\*{0,2}(low|medium|high|critical)\*{0,2}/i.exec(riskText);
    if (match) contract.riskProfile = match[1].toLowerCase();
  }
  if (effectsText !== null) {
    const effects = effectsText.split(/\r?\n/)
      .map((line) => /^[-*]\s*([a-z-]+)\s*$/.exec(line.trim())?.[1])
      .filter(Boolean);
    if (effects.length) contract.allowedSideEffects = effects;
  }
  // 人工门只认列表项。散文（「无。全部 AC 可自动验证。」）不是门，
  // 否则一句说明性文字就会平白多出一个人工触点。
  contract.humanGates = gatesText
    ? gatesText.split(/\r?\n/)
      .map((line) => /^[-*]\s+(.+)$/.exec(line.trim())?.[1]?.trim())
      .filter(Boolean)
    : [];
  if (duplicateSections.length) contract.duplicateSections = duplicateSections;
  return contract;
}

// 解析 Issue body 中的结构化契约块。缺失的域一律进 missing，绝不从自然语言猜测补全
// （已锁定约定：未知 schema、缺字段、非闭集值必须 fail closed）。
export function parseIssueContract(issue) {
  // 已经是结构化对象就直接用；否则从真实 GitHub Issue 的 markdown 正文里抽。
  const contract = issue?.contract && typeof issue.contract === 'object'
    ? issue.contract
    : parseIssueBody(issue?.body);
  const missing = [];
  const invalid = [];

  // 重复小节先于逐字段校验判 invalid：静默取错比"看起来缺字段"更危险，必须
  // 在结果里留下明确证据（DUPLICATE_SECTION），不能被后面的字段校验掩盖。
  for (const field of Array.isArray(contract.duplicateSections) ? contract.duplicateSections : []) {
    invalid.push({ field, reason: 'DUPLICATE_SECTION' });
  }

  const goal = typeof contract.goal === 'string' ? contract.goal.trim() : '';
  if (!goal) missing.push('goal');

  const workflowRole = contract.workflowRole;
  if (!workflowRole) missing.push('workflowRole');
  else if (!WORKFLOW_ROLES.includes(workflowRole)) invalid.push({ field: 'workflowRole', allowed: WORKFLOW_ROLES });

  const acceptanceCriteria = Array.isArray(contract.acceptanceCriteria) ? contract.acceptanceCriteria : null;
  if (!acceptanceCriteria || !acceptanceCriteria.length) missing.push('acceptanceCriteria');
  else {
    for (const criterion of acceptanceCriteria) {
      if (typeof criterion?.id !== 'string' || typeof criterion?.text !== 'string' || !criterion.text.trim()) {
        invalid.push({ field: 'acceptanceCriteria', reason: 'AC 需要 id 与非空 text' });
        break;
      }
      if (!EVIDENCE_CLASSES.includes(criterion.evidenceClass)) {
        invalid.push({ field: 'acceptanceCriteria.evidenceClass', allowed: EVIDENCE_CLASSES });
        break;
      }
    }
  }

  // dependencies 必须显式声明（空数组是合法答案，undefined 不是）。
  if (!Array.isArray(contract.dependencies)) missing.push('dependencies');

  if (!contract.riskProfile) missing.push('riskProfile');

  const allowedSideEffects = Array.isArray(contract.allowedSideEffects) ? contract.allowedSideEffects : null;
  if (!allowedSideEffects) missing.push('allowedSideEffects');
  else if (allowedSideEffects.some((effect) => !SIDE_EFFECTS.includes(effect))) {
    invalid.push({ field: 'allowedSideEffects', allowed: SIDE_EFFECTS });
  }

  // humanGates 是可选的，但一旦出现必须是数组；未声明视为空。
  const humanGates = contract.humanGates === undefined ? [] : contract.humanGates;
  if (!Array.isArray(humanGates)) invalid.push({ field: 'humanGates', reason: 'humanGates 必须是数组' });

  const executionPolicy = contract.executionPolicy || 'for-agent';
  if (!EXECUTION_POLICIES.includes(executionPolicy)) {
    invalid.push({ field: 'executionPolicy', allowed: EXECUTION_POLICIES });
  }

  return {
    complete: !missing.length && !invalid.length,
    missing,
    invalid,
    contract: {
      goal,
      workflowRole,
      acceptanceCriteria: acceptanceCriteria || [],
      dependencies: Array.isArray(contract.dependencies) ? contract.dependencies : [],
      riskProfile: contract.riskProfile || null,
      allowedSideEffects: allowedSideEffects || [],
      humanGates: Array.isArray(humanGates) ? humanGates : [],
      executionPolicy,
    },
  };
}

// contractDigest 绑定 AC 与副作用边界的精确内容。Issue 正文改动使 digest 变化，
// 从而使旧 review/QA 的 spec 轴证据失效 —— 与 candidate commit 前进同样的失效语义。
export function contractDigestOf(parsed) {
  return digestOf({
    goal: parsed.contract.goal,
    workflowRole: parsed.contract.workflowRole,
    acceptanceCriteria: parsed.contract.acceptanceCriteria.map((ac) => ({ id: ac.id, text: ac.text, evidenceClass: ac.evidenceClass })),
    dependencies: parsed.contract.dependencies,
    allowedSideEffects: [...parsed.contract.allowedSideEffects].sort(),
    humanGates: parsed.contract.humanGates,
  });
}

export function buildRejection({ issue, missing, invalid }) {
  return {
    schemaVersion: REJECTION_SCHEMA,
    jobId: null,
    issue,
    code: 'ISSUE_CONTRACT_INCOMPLETE',
    missing,
    invalid,
    disposition: 'NEEDS_INFO',
    ownerSessionCreated: false,
  };
}

export function assertContractComplete(issue) {
  const eligibility = isAutonomousCandidate(issue);
  if (!eligibility.eligible) {
    throw storeError('ISSUE_NOT_AUTONOMOUS', eligibility.reason, { issue: issue.number });
  }
  const parsed = parseIssueContract(issue);
  if (!parsed.complete) {
    const error = storeError('ISSUE_CONTRACT_INCOMPLETE', `Issue #${issue.number} 合同不完整`, {
      rejection: buildRejection({ issue: issue.number, missing: parsed.missing, invalid: parsed.invalid }),
    });
    error.rejection = error.details.rejection;
    throw error;
  }
  return parsed;
}

// IssueWorkOrder 组装。模型只用语义档，具体型号由 provider adapter 决定（本轮新增不变量）。
export function buildWorkOrder({
  jobId, attemptId, issue, parsed, contractDigest, runner, modelTier = 'standard', reason = '', budgets = {},
}) {
  if (!MODEL_TIERS.includes(modelTier)) {
    throw storeError('BAD_MODEL_TIER', `modelTier 必须是语义档之一: ${MODEL_TIERS.join('/')}`, { modelTier });
  }
  return {
    schemaVersion: WORK_ORDER_SCHEMA,
    jobId,
    attemptId,
    issue: {
      repo: issue.repo,
      number: issue.number,
      url: issue.url,
      title: issue.title,
      contractDigest,
      workflowRole: parsed.contract.workflowRole,
      executionPolicy: parsed.contract.executionPolicy,
      acceptanceCriteria: parsed.contract.acceptanceCriteria,
      dependencies: parsed.contract.dependencies,
      allowedSideEffects: parsed.contract.allowedSideEffects,
      humanGates: parsed.contract.humanGates,
    },
    runner: {
      slotId: runner.slotId,
      worktreePath: runner.worktreePath,
      baseCommit: runner.baseCommit,
    },
    routing: { modelTier, reason, upgradeAllowed: modelTier !== 'frontier' },
    budgets: {
      wallClockSeconds: budgets.wallClockSeconds ?? 7200,
      reviewLoops: budgets.reviewLoops ?? 3,
      qaLoops: budgets.qaLoops ?? 3,
      environmentRetries: budgets.environmentRetries ?? 2,
      modelUpgrades: budgets.modelUpgrades ?? 1,
    },
  };
}
