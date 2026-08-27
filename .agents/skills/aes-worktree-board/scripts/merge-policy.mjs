#!/usr/bin/env node
// riskProfile → mergePolicy 四档 merge gate（契约 D-1 / AC-005）。
// 关键设计：riskProfile 由 Issue 自报，而自报环节正是不可信处，所以 Master 必须按
// 改动路径做兜底校验 —— 自报低于路径推导出的档位时，以路径为准并留下 escalation 证据。
import { storeError } from './job-store.mjs';

export const RISK_PROFILES = Object.freeze(['low', 'medium', 'high', 'critical']);
export const MERGE_POLICIES = Object.freeze(['AUTO_MERGE', 'HUMAN_GATE', 'PR_ONLY']);

const RISK_ORDER = Object.freeze(Object.fromEntries(RISK_PROFILES.map((value, index) => [value, index])));

// 四档映射（强约束）：low/medium 机械门后自动 merge；high 机械门全绿仍停 humanGate；
// critical 拒绝直接 merge、仅走 PR。
const POLICY_BY_RISK = Object.freeze({
  low: 'AUTO_MERGE',
  medium: 'AUTO_MERGE',
  high: 'HUMAN_GATE',
  critical: 'PR_ONLY',
});

// 触及权限、identity、数据格式迁移、安全边界、公共 API 的改动不得自报低于 high。
// 每条规则都必须能指名它兜住的是哪一类风险，否则就是无法解释的黑箱升级。
export const ESCALATION_RULES = Object.freeze([
  { id: 'ESC-identity', minimum: 'high', reason: 'GitHub identity / 账号绑定', pattern: /(^|\/)(github-identity|identity)[^/]*\.(mjs|js|ts)$/i },
  { id: 'ESC-permission', minimum: 'high', reason: '权限与授权边界', pattern: /(permission|authz|authorization|acl|scope)/i },
  { id: 'ESC-secrets', minimum: 'critical', reason: '凭据与密钥', pattern: /(secret|credential|token|password|\.env(\.|$)|private[-_]?key)/i },
  { id: 'ESC-security', minimum: 'high', reason: '安全边界', pattern: /(security|sandbox|sanitiz|escape|csp|origin-check)/i },
  { id: 'ESC-schema', minimum: 'high', reason: '数据格式与迁移', pattern: /(schema|migration|migrate|runtime-store|registry)/i },
  { id: 'ESC-public-api', minimum: 'high', reason: '公共 API 契约', pattern: /(^|\/)(api|public|server)[^/]*\.(mjs|js|ts)$/i },
  { id: 'ESC-ci', minimum: 'high', reason: 'CI 与发布管线', pattern: /(^|\/)(\.github\/workflows|build-release|release)[^/]*/i },
]);

export function assertRiskProfile(value) {
  if (!RISK_PROFILES.includes(value)) {
    throw storeError('BAD_RISK_PROFILE', `riskProfile 非闭集取值: ${value}`, { allowed: RISK_PROFILES });
  }
  return value;
}

export function maxRisk(a, b) {
  return RISK_ORDER[a] >= RISK_ORDER[b] ? a : b;
}

// 纯函数：给定自报档位与改动路径集合，推导出实际生效的档位与 policy。
export function resolveMergePolicy({ declaredRisk, changedPaths = [], waiver = null }) {
  assertRiskProfile(declaredRisk);
  const triggered = [];
  let effectiveRisk = declaredRisk;
  for (const rule of ESCALATION_RULES) {
    const hits = changedPaths.filter((path) => rule.pattern.test(String(path).replaceAll('\\', '/')));
    if (!hits.length) continue;
    triggered.push({ id: rule.id, minimum: rule.minimum, reason: rule.reason, paths: hits.slice(0, 5) });
    effectiveRisk = maxRisk(effectiveRisk, rule.minimum);
  }
  const escalated = effectiveRisk !== declaredRisk;
  const policy = POLICY_BY_RISK[effectiveRisk];
  const result = {
    declaredRisk,
    effectiveRisk,
    escalated,
    triggeredRules: triggered,
    mergePolicy: policy,
    autoMergeAllowed: policy === 'AUTO_MERGE',
    requiresHumanGate: policy === 'HUMAN_GATE',
    prOnly: policy === 'PR_ONLY',
    waiver: null,
  };
  if (waiver) result.waiver = applyWaiver(result, waiver);
  return result;
}

// waiver 只能由用户留下结构化记录，且永远不能把 critical 降到可直接 merge。
// 「任何降低验收标准的豁免必须由用户留结构化 waiver」不等于「waiver 可以取消 PR-only」。
export function applyWaiver(resolution, waiver) {
  for (const key of ['reason', 'authorizedBy', 'scope']) {
    if (typeof waiver?.[key] !== 'string' || !waiver[key].trim()) {
      throw storeError('WAIVER_REJECTED', `waiver.${key} 缺失，豁免不生效`, { field: key });
    }
  }
  if (waiver.authorizedBy !== 'human') {
    throw storeError('WAIVER_REJECTED', 'waiver.authorizedBy 必须是 human；Agent 不得自我豁免', {
      actual: waiver.authorizedBy,
    });
  }
  if (resolution.effectiveRisk === 'critical') {
    throw storeError('WAIVER_REJECTED', 'critical 档拒绝直接 merge，waiver 不能覆盖 PR-only', {
      effectiveRisk: resolution.effectiveRisk,
    });
  }
  return { ...waiver, appliedTo: resolution.effectiveRisk };
}

// 机械门：merge 前必须 fresh 校验的全部条件。任一不满足即不 merge。
// 顺序固定，便于把「卡在第几关」写进 typed disposition。
export function evaluateMechanicalGate({
  slotOk, slotReason, commitFresh, commitReason, integrationOk, integrationReason,
  acceptance = [], review = null, qa = null, candidateCommit = null,
}) {
  const checks = [];
  const push = (id, ok, detail) => checks.push({ id, outcome: ok ? 'PASS' : 'FAIL', detail });

  push('GATE-slot', Boolean(slotOk), slotReason || 'slot 仍持有本 job 的 lease 且未被隔离');
  push('GATE-commit', Boolean(commitFresh), commitReason || 'candidate commit 与 registry 记录一致');
  push('GATE-integration', Boolean(integrationOk), integrationReason || 'integration branch 处于预期 HEAD');

  const unmetAc = acceptance.filter((entry) => entry.outcome !== 'PASS');
  push('GATE-acceptance', acceptance.length > 0 && !unmetAc.length,
    acceptance.length ? `${acceptance.length - unmetAc.length}/${acceptance.length} AC PASS` : 'AC 列表为空，拒绝放行');

  // review/QA 必须绑定 candidate commit；commit 前进使旧证据失效（E5）。
  // truthy 的 commitSha 不够 —— 必须与 candidateCommit 精确相等，否则旧 commit 的
  // 证据可以给新 commit 背书（gate 是最后防线，不假设上游状态机没被绕过）。
  const reviewBound = review && review.outcome === 'PASS'
    && candidateCommit && review.commitSha === candidateCommit;
  push('GATE-review', Boolean(reviewBound), review
    ? `review outcome=${review.outcome} commit=${review.commitSha || 'NOT_BOUND'} candidate=${candidateCommit || 'NOT_RUN'}`
    : 'review 证据缺失');

  // runtime=NOT_RUN 不得伪装 PASS（不变清单）。
  const qaOk = qa && qa.outcome === 'PASS'
    && candidateCommit && qa.commitSha === candidateCommit
    && !(qa.checks || []).some((check) => check.outcome === 'NOT_RUN')
    && !(qa.unexecuted || []).length;
  push('GATE-qa', Boolean(qaOk), qa
    ? `qa outcome=${qa.outcome} commit=${qa.commitSha || 'NOT_BOUND'} candidate=${candidateCommit || 'NOT_RUN'} unexecuted=${(qa.unexecuted || []).length}`
    : 'QA 证据缺失');

  const failed = checks.filter((check) => check.outcome === 'FAIL');
  return { checks, allGreen: !failed.length, failed };
}

// 最终放行判定：机械门 + 分档 gate。high 档「机械门全绿仍必须停 humanGate」在这里体现。
export function decideMerge({ mechanical, policy, humanApproval = null }) {
  if (!mechanical.allGreen) {
    return {
      decision: 'BLOCKED_MECHANICAL',
      mayMerge: false,
      reason: `机械门未全绿: ${mechanical.failed.map((check) => check.id).join(', ')}`,
      failedChecks: mechanical.failed,
    };
  }
  if (policy.prOnly) {
    return {
      decision: 'PR_ONLY',
      mayMerge: false,
      reason: `effectiveRisk=${policy.effectiveRisk} 拒绝直接 merge，只走 PR`,
      escalated: policy.escalated,
    };
  }
  if (policy.requiresHumanGate) {
    if (!humanApproval) {
      return {
        decision: 'AWAITING_HUMAN_GATE',
        mayMerge: false,
        reason: `effectiveRisk=${policy.effectiveRisk}：机械门全绿仍需人工批准`,
        escalated: policy.escalated,
      };
    }
    if (humanApproval.outcome !== 'PASS') {
      return {
        decision: 'HUMAN_GATE_REJECTED',
        mayMerge: false,
        reason: `人工门 outcome=${humanApproval.outcome}`,
      };
    }
    return {
      decision: 'APPROVED_BY_HUMAN',
      mayMerge: true,
      reason: `人工门通过（${humanApproval.resumeToken}）`,
      escalated: policy.escalated,
    };
  }
  return {
    decision: 'AUTO_MERGE',
    mayMerge: true,
    reason: `effectiveRisk=${policy.effectiveRisk} 机械门全绿，自动 merge`,
    escalated: policy.escalated,
  };
}
