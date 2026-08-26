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

// 解析 Issue body 中的结构化契约块。缺失的域一律进 missing，绝不从自然语言猜测补全
// （已锁定约定：未知 schema、缺字段、非闭集值必须 fail closed）。
export function parseIssueContract(issue) {
  const contract = issue?.contract && typeof issue.contract === 'object' ? issue.contract : {};
  const missing = [];
  const invalid = [];

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
