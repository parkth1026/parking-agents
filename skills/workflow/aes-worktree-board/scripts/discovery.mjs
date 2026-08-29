#!/usr/bin/env node
// DISCOVERED_WORK 四类关系 → Master 去重 → Wayfinder 回流（AC-004 / B12–B14）。
// 已锁定约定：DISCOVERED_WORK 不得直接创建 Issue；只有 Master→Wayfinder disposition
// 能产生外部写入。本模块因此把「worker 提交发现」与「Master 处置」在类型上分开。
import { appendReceipt, digestOf, nowIso, storeError } from './job-store.mjs';

export const DISCOVERY_SCHEMA = 'aes.issue-worker.discovered-work/v1';
export const DISPOSITION_SCHEMA = 'aes.worktree-board.discovery-disposition/v1';
export const RELATIONSHIPS = Object.freeze([
  'IN_CURRENT_SCOPE', 'NON_BLOCKING', 'BLOCKING_DEPENDENCY', 'CONTRACT_CONFLICT',
]);
export const DISPOSITION_OUTCOMES = Object.freeze([
  'ABSORBED_INTO_CURRENT_JOB', 'ISSUE_CREATED', 'LINKED_TO_EXISTING', 'BLOCKING_EDGE_CREATED', 'ESCALATED_TO_HUMAN',
]);
export const JOB_DISPOSITIONS = Object.freeze(['CONTINUE', 'BLOCKED_DEPENDENCY', 'CONTRACT_CONFLICT']);

// 四类关系各自的处置意图。每一类都必须有明确的「当前 job 还能不能走」答案，
// 否则 worker 一发现问题就会把整条流水线拖成人工态（这正是历史上的失败模式）。
const RELATIONSHIP_PLAN = Object.freeze({
  IN_CURRENT_SCOPE: { outcome: 'ABSORBED_INTO_CURRENT_JOB', jobDisposition: 'CONTINUE', externalWrite: 'comment' },
  NON_BLOCKING: { outcome: 'ISSUE_CREATED', jobDisposition: 'CONTINUE', externalWrite: 'create' },
  BLOCKING_DEPENDENCY: { outcome: 'BLOCKING_EDGE_CREATED', jobDisposition: 'BLOCKED_DEPENDENCY', externalWrite: 'edge' },
  CONTRACT_CONFLICT: { outcome: 'ESCALATED_TO_HUMAN', jobDisposition: 'CONTRACT_CONFLICT', externalWrite: 'comment' },
});

export function validateDiscovery(payload) {
  if (payload?.schemaVersion !== DISCOVERY_SCHEMA) {
    throw storeError('UNCLASSIFIED_DISCOVERY', `DISCOVERED_WORK schemaVersion 必须为 ${DISCOVERY_SCHEMA}`, {
      actual: payload?.schemaVersion || null,
    });
  }
  if (!RELATIONSHIPS.includes(payload.relationship)) {
    throw storeError('UNCLASSIFIED_DISCOVERY', `relationship 非闭集取值: ${payload.relationship}`, {
      allowed: RELATIONSHIPS,
    });
  }
  for (const key of ['jobId', 'title', 'problem']) {
    if (typeof payload[key] !== 'string' || !payload[key].trim()) {
      throw storeError('UNCLASSIFIED_DISCOVERY', `DISCOVERED_WORK.${key} 缺失`, { field: key });
    }
  }
  if (!Number.isInteger(payload.currentIssue)) {
    throw storeError('UNCLASSIFIED_DISCOVERY', 'DISCOVERED_WORK.currentIssue 必须是整数', { field: 'currentIssue' });
  }
  if (!Array.isArray(payload.dedupeHints) || !payload.dedupeHints.length) {
    throw storeError('UNCLASSIFIED_DISCOVERY', 'DISCOVERED_WORK.dedupeHints 必须非空，否则无法幂等去重', {
      field: 'dedupeHints',
    });
  }
  // worker 不得直接创建 Issue：报文里出现已创建的 issue 号就是越界证据。
  if (payload.createdIssue !== undefined) {
    throw storeError('WORKER_EXCEEDED_SCOPE', 'worker 不得直接创建 Issue；DISCOVERED_WORK 不接受 createdIssue', {
      field: 'createdIssue',
    });
  }
  return payload;
}

// digest 只由「问题本身」决定，不含 jobId/attemptId/时间戳 —— 同一问题被不同 job
// 在不同时间重复发现时必须命中同一条记录（E6 幂等）。
export function discoveryDigest(payload) {
  const normalizedHints = [...new Set(payload.dedupeHints.map((hint) => String(hint).trim().toLowerCase()))].sort();
  return `dw-${digestOf({
    relationship: payload.relationship,
    title: String(payload.title).trim().toLowerCase(),
    hints: normalizedHints,
  }).slice(7, 19)}`;
}

// Wayfinder 适配器接口：create / comment / edge 三种外部写入，各自返回 receipt。
// 注入式设计让 selftest 可以全程 fake-gh，不写真实 GitHub（AC-004 强约束）。
export function makeWayfinder({ gh, repo }) {
  return {
    async createIssue({ title, body, labels = [] }) {
      const result = await gh(['issue', 'create', '--title', title, '--body', body,
        ...labels.flatMap((label) => ['--label', label])]);
      const number = Number(String(result.stdout || '').match(/(\d+)\s*$/)?.[1] || 0) || null;
      return { kind: 'create', repo, issue: number, raw: String(result.stdout || '').trim() };
    },
    async comment({ issue, body }) {
      const result = await gh(['issue', 'comment', String(issue), '--body', body]);
      return { kind: 'comment', repo, issue, digest: digestOf(body), raw: String(result.stdout || '').trim() };
    },
    async blockingEdge({ blocked, blocker }) {
      const body = `blocked-by #${blocker}`;
      const result = await gh(['issue', 'comment', String(blocked), '--body', body]);
      return { kind: 'edge', repo, blocked, blocker, digest: digestOf(body), raw: String(result.stdout || '').trim() };
    },
    async searchExisting(hints) {
      const query = hints.join(' ');
      const result = await gh(['issue', 'list', '--search', query, '--state', 'all', '--json', 'number,title,state']);
      try {
        return JSON.parse(String(result.stdout || '[]'));
      } catch {
        return [];
      }
    },
  };
}

// Master 侧唯一处置入口。幂等：同一 digest 第二次进来只返回既有 disposition，
// 不重复创建 Issue、不重复写 receipt（E6）。
export async function disposeDiscovery({
  registry, dir, payload, wayfinder, dedupeSearch = true,
}) {
  validateDiscovery(payload);
  const discoveryId = discoveryDigest(payload);
  const existing = registry.discoveries[discoveryId];
  if (existing) {
    return {
      schemaVersion: DISPOSITION_SCHEMA,
      discoveryId,
      outcome: existing.outcome,
      wayfinderActionId: existing.wayfinderActionId,
      issue: existing.issue,
      blockingEdgeCreated: existing.blockingEdgeCreated,
      currentJobDisposition: existing.currentJobDisposition,
      idempotent: true,
    };
  }

  const plan = RELATIONSHIP_PLAN[payload.relationship];
  const actionId = `wf-action-${discoveryId.slice(3)}`;
  let issue = null;
  let outcome = plan.outcome;
  let blockingEdgeCreated = false;
  let receipt = null;

  // 先搜既有 Issue：命中就关联而不是新建（E6：通过 discovery digest/Issue search 幂等关联）。
  let matched = null;
  if (dedupeSearch && plan.externalWrite === 'create') {
    const candidates = await wayfinder.searchExisting(payload.dedupeHints);
    matched = candidates.find((candidate) => candidate.state === 'OPEN') || candidates[0] || null;
  }

  if (plan.externalWrite === 'create' && matched) {
    receipt = await wayfinder.comment({
      issue: matched.number,
      body: buildDiscoveryBody(payload, { linkedTo: matched.number }),
    });
    issue = matched.number;
    outcome = 'LINKED_TO_EXISTING';
  } else if (plan.externalWrite === 'create') {
    receipt = await wayfinder.createIssue({
      title: payload.title,
      body: buildDiscoveryBody(payload),
      labels: ['needs-triage'],
    });
    issue = receipt.issue;
  } else if (plan.externalWrite === 'edge') {
    // blocking dependency：先确保依赖 Issue 存在，再建边。依赖 Issue 可继续进入其他 slot（B13）。
    const candidates = dedupeSearch ? await wayfinder.searchExisting(payload.dedupeHints) : [];
    const blocker = candidates.find((candidate) => candidate.state === 'OPEN');
    if (blocker) {
      issue = blocker.number;
    } else {
      const created = await wayfinder.createIssue({
        title: payload.title, body: buildDiscoveryBody(payload), labels: ['needs-triage'],
      });
      issue = created.issue;
      appendReceipt(dir, { kind: 'wayfinder', discoveryId, actionId, action: 'create', result: created });
    }
    receipt = await wayfinder.blockingEdge({ blocked: payload.currentIssue, blocker: issue });
    blockingEdgeCreated = true;
  } else {
    receipt = await wayfinder.comment({
      issue: payload.currentIssue,
      body: buildDiscoveryBody(payload),
    });
    issue = payload.currentIssue;
  }

  appendReceipt(dir, { kind: 'wayfinder', discoveryId, actionId, action: plan.externalWrite, result: receipt });

  const record = {
    discoveryId,
    schemaVersion: DISPOSITION_SCHEMA,
    jobId: payload.jobId,
    attemptId: payload.attemptId || null,
    relationship: payload.relationship,
    outcome,
    wayfinderActionId: actionId,
    issue,
    blockingEdgeCreated,
    currentJobDisposition: plan.jobDisposition,
    recordedAt: nowIso(),
  };
  registry.discoveries[discoveryId] = record;

  return { ...record, idempotent: false };
}

function buildDiscoveryBody(payload, { linkedTo = null } = {}) {
  const lines = [
    `来源: ${payload.jobId} / Issue #${payload.currentIssue}`,
    `关系: ${payload.relationship}`,
    '',
    payload.problem,
  ];
  if (payload.evidence?.length) {
    lines.push('', '证据:', ...payload.evidence.map((item) => `- ${item}`));
  }
  if (payload.suggestedWorkflow) lines.push('', `建议 workflow: ${payload.suggestedWorkflow}`);
  if (linkedTo) lines.push('', `已关联到既有 Issue #${linkedTo}，不新建。`);
  return lines.join('\n');
}
