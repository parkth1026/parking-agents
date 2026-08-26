#!/usr/bin/env node
// 人工态统一载荷（契约 D-2）：三个人工态终点必须携带完整 humanRequest。
// 缺 resumeToken 的报文 schema 拒收且不推进状态 —— 恢复能力只依赖持久状态，
// resumeToken 就是「人工答复如何找回原 job」的唯一锚点，缺了它人工态无法无损续跑。
import { digestOf, HUMAN_STATES, nowIso, storeError } from './job-store.mjs';

export const HUMAN_REQUEST_SCHEMA = 'aes.worktree-board.human-request/v1';
// 闭集沿用外部评审建议（契约 D-2）。非闭集值一律拒收，不从自然语言补猜。
export const HUMAN_REQUEST_KINDS = Object.freeze([
  'decision', 'manual_validation', 'permission', 'external_access', 'risk_approval',
]);
export const HUMAN_RESPONSE_OUTCOMES = Object.freeze(['PASS', 'FAIL', 'WAIVED', 'ABANDON']);

// 人工态 → 允许的 kind。permission 态不能伪装成普通 decision，反之亦然。
const STATE_KINDS = Object.freeze({
  'awaiting-human': ['decision', 'manual_validation', 'risk_approval', 'external_access'],
  'blocked-permission': ['permission', 'external_access'],
  'contract-conflict': ['decision', 'risk_approval'],
});

export function resumeTokenFor({ jobId, attemptId, state, kind }) {
  if (!jobId || !state) throw storeError('BAD_RESUME_TOKEN', 'resumeToken 需要 jobId 与 state');
  return `hr-${jobId}-${state}-${digestOf({ jobId, attemptId: attemptId || null, state, kind }).slice(7, 19)}`;
}

// 唯一校验入口。任何写入 registry 的人工态载荷都必须先过这里。
export function validateHumanRequest(payload, { state = null } = {}) {
  if (!payload || typeof payload !== 'object') {
    throw storeError('HUMAN_REQUEST_SCHEMA_REJECTED', 'humanRequest 载荷缺失', { field: 'humanRequest' });
  }
  if (payload.schemaVersion !== HUMAN_REQUEST_SCHEMA) {
    throw storeError('HUMAN_REQUEST_SCHEMA_REJECTED', `humanRequest schemaVersion 必须为 ${HUMAN_REQUEST_SCHEMA}`, {
      field: 'schemaVersion', actual: payload.schemaVersion || null,
    });
  }
  if (!HUMAN_REQUEST_KINDS.includes(payload.kind)) {
    throw storeError('HUMAN_REQUEST_SCHEMA_REJECTED', `humanRequest.kind 非闭集取值: ${payload.kind}`, {
      field: 'kind', allowed: HUMAN_REQUEST_KINDS,
    });
  }
  if (typeof payload.prompt !== 'string' || !payload.prompt.trim()) {
    throw storeError('HUMAN_REQUEST_SCHEMA_REJECTED', 'humanRequest.prompt 必须是非空字符串', { field: 'prompt' });
  }
  if (!Array.isArray(payload.requiredEvidence) || payload.requiredEvidence.some((item) => typeof item !== 'string' || !item.trim())) {
    throw storeError('HUMAN_REQUEST_SCHEMA_REJECTED', 'humanRequest.requiredEvidence 必须是非空字符串数组', {
      field: 'requiredEvidence',
    });
  }
  // 缺 resumeToken 的人工态报文 schema 拒收（本轮新增不变量）。
  if (typeof payload.resumeToken !== 'string' || !payload.resumeToken.trim()) {
    throw storeError('HUMAN_REQUEST_SCHEMA_REJECTED', 'humanRequest.resumeToken 缺失，人工态报文拒收', {
      field: 'resumeToken',
    });
  }
  if (state) {
    if (!HUMAN_STATES.includes(state)) {
      throw storeError('HUMAN_REQUEST_SCHEMA_REJECTED', `${state} 不是人工态终点`, { field: 'state', allowed: HUMAN_STATES });
    }
    if (!STATE_KINDS[state].includes(payload.kind)) {
      throw storeError('HUMAN_REQUEST_SCHEMA_REJECTED', `人工态 ${state} 不接受 kind=${payload.kind}`, {
        field: 'kind', state, allowed: STATE_KINDS[state],
      });
    }
  }
  return payload;
}

export function buildHumanRequest({
  jobId, attemptId = null, state, kind, prompt, requiredEvidence = [], context = {},
}) {
  const payload = {
    schemaVersion: HUMAN_REQUEST_SCHEMA,
    jobId,
    attemptId,
    state,
    kind,
    prompt,
    requiredEvidence,
    resumeToken: resumeTokenFor({ jobId, attemptId, state, kind }),
    context,
    createdAt: nowIso(),
  };
  return validateHumanRequest(payload, { state });
}

// 人工答复必须凭 resumeToken 找回原 job；token 不匹配即拒收，不按 jobId 模糊匹配。
export function validateHumanResponse(request, response) {
  if (!response || typeof response !== 'object') {
    throw storeError('HUMAN_RESPONSE_REJECTED', '人工答复载荷缺失');
  }
  if (!HUMAN_RESPONSE_OUTCOMES.includes(response.outcome)) {
    throw storeError('HUMAN_RESPONSE_REJECTED', `人工答复 outcome 非闭集取值: ${response.outcome}`, {
      allowed: HUMAN_RESPONSE_OUTCOMES,
    });
  }
  if (response.resumeToken !== request.resumeToken) {
    throw storeError('HUMAN_RESPONSE_REJECTED', 'resumeToken 不匹配，拒绝推进状态', {
      expected: request.resumeToken, actual: response.resumeToken || null,
    });
  }
  // 人工验收不得由 Agent 代答（不变清单）：答复必须显式声明作者是人。
  if (response.actor !== 'human') {
    throw storeError('HUMAN_RESPONSE_REJECTED', '人工态答复的 actor 必须是 human，Agent 不得代答', {
      actual: response.actor || null,
    });
  }
  // 任何降低验收标准的豁免必须由用户留结构化 waiver（本轮新增不变量）。
  if (response.outcome === 'WAIVED') {
    const waiver = response.waiver;
    for (const key of ['reason', 'loweredCriteria', 'authorizedBy']) {
      if (typeof waiver?.[key] !== 'string' || !waiver[key].trim()) {
        throw storeError('HUMAN_RESPONSE_REJECTED', `WAIVED 需要结构化 waiver.${key}`, { field: key });
      }
    }
  }
  return response;
}
