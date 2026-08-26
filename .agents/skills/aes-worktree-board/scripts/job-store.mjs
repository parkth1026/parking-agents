#!/usr/bin/env node
// v4 编排状态真源：runner / job / attempt / humanRequest / discovery / delivery 分层。
// v3 runtime 只读封存（B22）：本模块只记录其路径与 hash 引用，绝不读取内容推导 job/attempt。
// registry.json 是当前状态真源；inbox/transitions/receipts 保持 append-only 审计（不变清单）。
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  appendJsonLineAtomic, readJson, readJsonLines, withRuntimeLock, writeJsonAtomic,
} from './runtime-store.mjs';

export const REGISTRY_SCHEMA = 'aes.worktree-board.registry/v4';
export const REPO_ROOT = resolve(process.env.AES_WORKTREE_BOARD_REPO_ROOT || process.cwd());
export const DEFAULT_V4_DIR = join(REPO_ROOT, '.aes-worktree-board', 'runtime-v4');
export const V4_DIR = resolve(process.env.AES_WORKTREE_BOARD_V4_DIR || DEFAULT_V4_DIR);

// Master 视角的 job 生命周期。终态之外的任何状态都必须能被 reconcile 解释。
export const JOB_STATES = Object.freeze([
  'queued', 'dispatched', 'ready-to-merge', 'merging', 'merged', 'closing', 'closed',
  'awaiting-human', 'blocked-dependency', 'contract-conflict', 'blocked-permission',
  'budget-exhausted', 'abandoned',
]);
export const JOB_TERMINAL_STATES = Object.freeze(['closed', 'abandoned']);
// 三个人工态终点，必须携带完整 humanRequest 载荷（强约束）。
export const HUMAN_STATES = Object.freeze(['awaiting-human', 'blocked-permission', 'contract-conflict']);
export const ATTEMPT_STATES = Object.freeze([
  'dispatched', 'implementing', 'reviewing', 'qa', 'ready-to-merge',
  'interrupted', 'superseded', 'closed', 'failed',
]);
export const RUNNER_STATES = Object.freeze([
  'idle', 'leased', 'draining', 'QUARANTINED_DIRTY', 'QUARANTINED_CONFIG_DRIFT', 'QUARANTINED_MISSING',
]);
export const QUARANTINE_STATES = Object.freeze(
  RUNNER_STATES.filter((state) => state.startsWith('QUARANTINED_')),
);

export function storeError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  error.exitCode = 2;
  return error;
}

export function nowIso() { return new Date().toISOString(); }

export function digestOf(value) {
  return `sha256:${createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')}`;
}

export function shortDigest(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex').slice(0, 6);
}

// jobId 必须跨 attempt 稳定：只由 repo+issue+contractDigest 决定，不含时间戳或 attempt 序号。
export function jobIdFor({ repo, issue, contractDigest }) {
  if (!repo || !Number.isInteger(issue)) throw storeError('BAD_JOB_IDENTITY', 'jobId 需要 repo 与整数 issue');
  return `job-${issue}-${shortDigest({ repo, issue, contractDigest: contractDigest || null })}`;
}

export function attemptIdFor(jobId, ordinal) {
  return `${jobId}#attempt-${ordinal}`;
}

export function registryPath(dir = V4_DIR) { return join(resolve(dir), 'registry.json'); }
export function inboxPath(dir = V4_DIR) { return join(resolve(dir), 'inbox.jsonl'); }
export function transitionsPath(dir = V4_DIR) { return join(resolve(dir), 'transitions.jsonl'); }
export function receiptsPath(dir = V4_DIR) { return join(resolve(dir), 'receipts.jsonl'); }

export function emptyRegistry(now = nowIso()) {
  return {
    schemaVersion: REGISTRY_SCHEMA,
    master: {
      state: 'stopped', goalId: null, startedAt: null, lastReconcileAt: null, generation: 0,
    },
    runners: {},
    jobs: {},
    attempts: {},
    humanRequests: {},
    discoveries: {},
    deliveries: {},
    mergeQueue: [],
    legacyArchive: null,
    createdAt: now,
  };
}

export function readV4Registry(dir = V4_DIR) {
  const registry = readJson(registryPath(dir), null) || emptyRegistry();
  if (registry.schemaVersion !== REGISTRY_SCHEMA) {
    throw storeError('REGISTRY_SCHEMA_MISMATCH', `registry schemaVersion 必须为 ${REGISTRY_SCHEMA}，实际 ${registry.schemaVersion}`);
  }
  registry.master ||= emptyRegistry().master;
  registry.runners ||= {};
  registry.jobs ||= {};
  registry.attempts ||= {};
  registry.humanRequests ||= {};
  registry.discoveries ||= {};
  registry.deliveries ||= {};
  registry.mergeQueue ||= [];
  return registry;
}

export function updateV4Registry(dir, mutate) {
  const root = resolve(dir || V4_DIR);
  return withRuntimeLock(root, () => {
    const registry = readV4Registry(root);
    const result = mutate(registry);
    writeJsonAtomic(registryPath(root), registry);
    return result;
  });
}

// append-only 审计三条流。写入永不覆盖既有行（不变清单：旧 session 与失败记录不删除）。
export function appendTransition(dir, record) {
  appendJsonLineAtomic(transitionsPath(dir || V4_DIR), { at: nowIso(), ...record });
}

export function appendReceipt(dir, record) {
  appendJsonLineAtomic(receiptsPath(dir || V4_DIR), { at: nowIso(), ...record });
}

export function appendInbox(dir, record) {
  appendJsonLineAtomic(inboxPath(dir || V4_DIR), { at: nowIso(), ...record });
}

export function readTransitions(dir = V4_DIR) { return readJsonLines(transitionsPath(dir)); }
export function readReceipts(dir = V4_DIR) { return readJsonLines(receiptsPath(dir)); }
export function readInbox(dir = V4_DIR) { return readJsonLines(inboxPath(dir)); }

// v3 只读封存：只保存路径与内容 hash，不解析、不反向推导（B22 / api-mock 已锁定约定）。
export function sealLegacyRuntime(dir, legacyRuntimeDir) {
  const legacyRegistry = join(resolve(legacyRuntimeDir), 'registry.json');
  const archive = {
    schemaVersion: 'aes.worktree-board.legacy-archive/v1',
    path: resolve(legacyRuntimeDir),
    registryPath: existsSync(legacyRegistry) ? legacyRegistry : null,
    registryDigest: existsSync(legacyRegistry) ? digestOf(readFileSync(legacyRegistry, 'utf8')) : null,
    readOnly: true,
    derivedJobs: false,
    sealedAt: nowIso(),
  };
  return updateV4Registry(dir, (registry) => {
    // 幂等：同一 digest 重复封存不改变 sealedAt，避免审计流噪声。
    if (registry.legacyArchive && registry.legacyArchive.registryDigest === archive.registryDigest) {
      return { ok: true, outcome: 'NOOP', archive: registry.legacyArchive };
    }
    registry.legacyArchive = archive;
    return { ok: true, outcome: 'SEALED', archive };
  });
}

export function jobOf(registry, jobId) {
  const job = registry.jobs[jobId];
  if (!job) throw storeError('UNKNOWN_JOB', `registry 无此 job: ${jobId}`, { jobId });
  return job;
}

export function attemptOf(registry, attemptId) {
  const attempt = registry.attempts[attemptId];
  if (!attempt) throw storeError('UNKNOWN_ATTEMPT', `registry 无此 attempt: ${attemptId}`, { attemptId });
  return attempt;
}

export function currentAttempt(registry, jobId) {
  const job = jobOf(registry, jobId);
  return job.currentAttemptId ? registry.attempts[job.currentAttemptId] || null : null;
}

export function setJobState(registry, jobId, next, { reason = null, actor = 'master', dir = null } = {}) {
  if (!JOB_STATES.includes(next)) throw storeError('BAD_JOB_STATE', `未知 job state: ${next}`, { jobId, next });
  const job = jobOf(registry, jobId);
  const from = job.state;
  job.state = next;
  job.updatedAt = nowIso();
  if (dir) appendTransition(dir, { kind: 'job', jobId, from, to: next, reason, actor });
  return { jobId, from, to: next };
}
