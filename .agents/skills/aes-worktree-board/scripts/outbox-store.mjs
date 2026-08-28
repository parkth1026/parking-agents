#!/usr/bin/env node
import { join, resolve } from 'node:path';
import { appendJsonLineAtomic, readJsonLines, withRuntimeLock } from './runtime-store.mjs';
import { nowIso, shortDigest, storeError } from './job-store.mjs';

export const OUTBOX_SCHEMA = 'aes.worktree-board.outbox-entry/v1';
export const OUTBOX_STATES = Object.freeze(['pending', 'succeeded', 'abandoned', 'acknowledged']);
const ATTEMPT_OUTCOMES = Object.freeze(['SUCCEEDED', 'FAILED']);
export function outboxPath(dir) { return join(resolve(dir), 'outbox.jsonl'); }

function assertString(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw storeError('OUTBOX_ENTRY_INVALID', `outbox ${field} 必须为非空字符串`, { field });
}

function assertTime(value, field) {
  assertString(value, field);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw storeError('OUTBOX_ENTRY_INVALID', `outbox ${field} 必须为 canonical ISO 时间`, { field });
}

function validateAttempt(attempt, index) {
  if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt)) throw storeError('OUTBOX_ENTRY_INVALID', `attempts[${index}] 必须为对象`);
  assertTime(attempt.at, `attempts[${index}].at`);
  if (!ATTEMPT_OUTCOMES.includes(attempt.outcome)) throw storeError('OUTBOX_ENTRY_INVALID', `attempts[${index}].outcome 非闭集值`);
  if (attempt.outcome === 'SUCCEEDED' && attempt.error !== null) throw storeError('OUTBOX_ENTRY_INVALID', `attempts[${index}] 成功时 error 必须为 null`);
  if (attempt.outcome === 'FAILED') {
    if (!attempt.error || typeof attempt.error !== 'object' || Array.isArray(attempt.error)) throw storeError('OUTBOX_ENTRY_INVALID', `attempts[${index}] 失败时必须含 error`);
    assertString(attempt.error.code, `attempts[${index}].error.code`);
    if (typeof attempt.error.stderr !== 'string') throw storeError('OUTBOX_ENTRY_INVALID', `attempts[${index}].error.stderr 必须为字符串`);
  }
}

export function validateOutboxEntry(entry) {
  if (!entry || entry.schemaVersion !== OUTBOX_SCHEMA) throw storeError('OUTBOX_SCHEMA_MISMATCH', `outbox schemaVersion 必须为 ${OUTBOX_SCHEMA}`);
  assertString(entry.entryId, 'entryId');
  assertString(entry.kind, 'kind');
  assertTime(entry.createdAt, 'createdAt');
  if (entry.jobId !== undefined) assertString(entry.jobId, 'jobId');
  if (!OUTBOX_STATES.includes(entry.state)) throw storeError('OUTBOX_ENTRY_INVALID', `未知 outbox state: ${entry.state}`);
  if (!Array.isArray(entry.attempts)) throw storeError('OUTBOX_ENTRY_INVALID', 'outbox attempts 必须为数组');
  entry.attempts.forEach(validateAttempt);
  if (entry.inFlight) {
    assertString(entry.inFlight.owner, 'inFlight.owner');
    if (!Number.isInteger(entry.inFlight.pid) || entry.inFlight.pid <= 0) throw storeError('OUTBOX_ENTRY_INVALID', 'inFlight.pid 必须为正整数');
    assertTime(entry.inFlight.leasedAt, 'inFlight.leasedAt');
    assertTime(entry.inFlight.expiresAt, 'inFlight.expiresAt');
    const leasedAt = Date.parse(entry.inFlight.leasedAt);
    const expiresAt = Date.parse(entry.inFlight.expiresAt);
    if (!Number.isFinite(leasedAt) || !Number.isFinite(expiresAt) || expiresAt < leasedAt) {
      throw storeError('OUTBOX_ENTRY_INVALID', 'inFlight 时间必须为合法且递增的 ISO 时间');
    }
  }
  if (entry.state === 'pending') {
  } else if (entry.inFlight) {
    throw storeError('OUTBOX_ENTRY_INVALID', `${entry.state} 终态不得残留 inFlight`);
  } else if (entry.state === 'succeeded') {
    if (!entry.attempts.length || entry.attempts.at(-1).outcome !== 'SUCCEEDED') throw storeError('OUTBOX_ENTRY_INVALID', 'succeeded 必须以成功 attempt 结算');
    assertTime(entry.settledAt, 'settledAt');
  }
  if (entry.state === 'abandoned' || entry.state === 'acknowledged') {
    if (entry.attempts.length < 3 || entry.attempts.at(-1).outcome !== 'FAILED') throw storeError('OUTBOX_ENTRY_INVALID', `${entry.state} 必须保留至少三次且末次失败的 attempts`);
    assertString(entry.abandonReason, 'abandonReason');
    assertTime(entry.settledAt, 'settledAt');
  }
  if (entry.state === 'acknowledged') {
    assertString(entry.reason, 'reason');
    assertTime(entry.acknowledgedAt, 'acknowledgedAt');
    assertString(entry.acknowledgedBy, 'acknowledgedBy');
  }
  return entry;
}

function validateIssueClose(entry, expectedRepo = null) {
  assertString(entry.jobId, 'jobId');
  if (!Number.isInteger(entry.issue)) throw storeError('OUTBOX_ENTRY_INVALID', 'issue-close issue 必须为整数');
  assertString(entry.repo, 'repo');
  assertString(entry.commentDigest, 'commentDigest');
  if (!entry.payload || typeof entry.payload.comment !== 'string' || entry.payload.closeIssue !== true) throw storeError('OUTBOX_ENTRY_INVALID', 'issue-close payload 非法');
  if (expectedRepo && entry.repo.toLowerCase() !== expectedRepo.toLowerCase()) {
    throw storeError('OUTBOX_REPO_MISMATCH', `outbox entry repo ${entry.repo} 与已授权仓库 ${expectedRepo} 不一致`, { entryId: entry.entryId, entryRepo: entry.repo, authorizedRepo: expectedRepo });
  }
}

const OUTBOX_HANDLERS = Object.freeze({ 'issue-close': validateIssueClose });

export function preflightOutbox(dir, expectedRepo = null) {
  const entries = readOutbox(dir).filter((entry) => entry.state === 'pending');
  for (const entry of entries) {
    const validate = OUTBOX_HANDLERS[entry.kind];
    if (!validate) throw storeError('UNSUPPORTED_OUTBOX_KIND', `outbox kind 尚无 handler: ${entry.kind}`, { entryId: entry.entryId, kind: entry.kind });
    validate(entry, expectedRepo);
  }
  return entries;
}

export function readOutboxHistory(dir) { return readJsonLines(outboxPath(dir)); }

export function readOutbox(dir) {
  const latest = new Map();
  for (const row of readOutboxHistory(dir)) latest.set(validateOutboxEntry(row).entryId, row);
  return [...latest.values()];
}

function append(dir, entry) {
  validateOutboxEntry(entry);
  appendJsonLineAtomic(outboxPath(dir), entry);
  return entry;
}

function enqueueIssueCloseUnlocked(dir, input) {
  const existing = readOutbox(dir).find((entry) => entry.jobId === input.jobId && entry.commentDigest === input.commentDigest);
  if (existing) return { entry: existing, enqueued: false };
  const entry = {
    schemaVersion: OUTBOX_SCHEMA,
    entryId: `ob-${input.jobId}-${shortDigest(`${input.jobId}:${input.commentDigest}`)}`,
    kind: 'issue-close', jobId: input.jobId, issue: input.issue, repo: input.repo,
    commentDigest: input.commentDigest, payload: { comment: input.comment, closeIssue: true },
    state: 'pending', attempts: [], createdAt: nowIso(),
  };
  append(dir, entry);
  return { entry, enqueued: true };
}

export function enqueueIssueClose(dir, input) {
  return withRuntimeLock(dir, () => enqueueIssueCloseUnlocked(dir, input));
}

export async function flushOutbox(dir, gh, options = {}) {
  const owner = options.owner || `flush-${process.pid}-${shortDigest(`${Date.now()}:${Math.random()}`)}`;
  const leaseMs = options.leaseMs || 30_000;
  const now = options.now || (() => new Date());
  const isOwnerAlive = options.isOwnerAlive || ((pid) => {
    try { process.kill(pid, 0); return true; } catch { return false; }
  });
  const claimed = withRuntimeLock(dir, () => {
    const at = now();
    preflightOutbox(dir, options.expectedRepo || null);
    const entries = readOutbox(dir).filter((entry) => entry.state === 'pending' && (
      !entry.inFlight || (Date.parse(entry.inFlight.expiresAt) <= at.getTime() && !isOwnerAlive(entry.inFlight.pid))
    ));
    for (const entry of entries) append(dir, {
      ...entry, inFlight: { owner, pid: process.pid, leasedAt: at.toISOString(), expiresAt: new Date(at.getTime() + leaseMs).toISOString() },
    });
    return entries.map((entry) => entry.entryId);
  });
  if (options.afterClaim) await options.afterClaim(claimed);
  const results = [];
  for (const entryId of claimed) {
    const entry = readOutbox(dir).find((candidate) => candidate.entryId === entryId);
    const at = now().toISOString();
    try {
      await gh(['issue', 'comment', String(entry.issue), '--body', entry.payload.comment]);
      if (entry.payload.closeIssue) await gh(['issue', 'close', String(entry.issue)]);
      withRuntimeLock(dir, () => {
        const current = readOutbox(dir).find((candidate) => candidate.entryId === entryId);
        if (current.inFlight?.owner !== owner) return;
        append(dir, { ...current, state: 'succeeded', inFlight: null, attempts: [...current.attempts, { at, outcome: 'SUCCEEDED', error: null }], settledAt: at });
      });
      results.push({ entryId: entry.entryId, issue: entry.issue, outcome: 'SUCCEEDED' });
    } catch (error) {
      const attempt = { at, outcome: 'FAILED', error: { code: error.code || 'GH_COMMAND_FAILED', stderr: String(error.details?.stderr || error.message || '').slice(0, 400) } };
      const attempts = [...entry.attempts, attempt];
      const abandoned = attempts.length >= 3;
      withRuntimeLock(dir, () => {
        const current = readOutbox(dir).find((candidate) => candidate.entryId === entryId);
        if (current.inFlight?.owner !== owner) return;
        append(dir, { ...current, state: abandoned ? 'abandoned' : 'pending', inFlight: null, attempts, ...(abandoned ? { abandonReason: 'ISSUE_UNREACHABLE', settledAt: at } : {}) });
      });
      results.push(abandoned
        ? { entryId: entry.entryId, issue: entry.issue, outcome: 'ABANDONED', abandonReason: 'ISSUE_UNREACHABLE', attempts: attempts.length }
        : { entryId: entry.entryId, issue: entry.issue, outcome: 'FAILED', attempt: attempts.length, error: attempt.error });
    }
  }
  const entries = readOutbox(dir);
  const counts = results.reduce((summary, entry) => {
    summary[entry.outcome] += 1;
    return summary;
  }, { SUCCEEDED: 0, FAILED: 0, ABANDONED: 0 });
  return {
    ok: true, flushed: counts.SUCCEEDED,
    skipped: entries.filter((entry) => entry.state === 'succeeded').length - counts.SUCCEEDED,
    failed: counts.FAILED, abandoned: counts.ABANDONED,
    remaining: entries.filter((entry) => entry.state === 'pending').length, entries: results,
  };
}

export function acknowledgeOutbox(dir, entryId, reason, actor = 'operator') {
  if (typeof reason !== 'string' || !reason.trim()) throw storeError('REASON_REQUIRED', 'outbox acknowledge 必须提供 --reason');
  return withRuntimeLock(dir, () => {
    const entry = readOutbox(dir).find((candidate) => candidate.entryId === entryId);
    if (!entry) throw storeError('UNKNOWN_OUTBOX_ENTRY', `无此 outbox entry: ${entryId}`, { entryId });
    if (entry.state === 'acknowledged') return { ok: true, outcome: 'ALREADY_ACKNOWLEDGED', entryId, issue: entry.issue, acknowledgedAt: entry.acknowledgedAt, acknowledgedBy: entry.acknowledgedBy, reason: entry.reason };
    if (entry.state !== 'abandoned') return { ok: false, code: 'NOT_ABANDONED', entryId, state: entry.state };
    const acknowledged = { ...entry, state: 'acknowledged', acknowledgedAt: nowIso(), acknowledgedBy: actor, reason: reason.trim() };
    append(dir, acknowledged);
    return { ok: true, outcome: 'ACKNOWLEDGED', entryId, issue: entry.issue, acknowledgedAt: acknowledged.acknowledgedAt, acknowledgedBy: actor, reason: acknowledged.reason };
  });
}

export function outboxStatus(dir) {
  const entries = readOutbox(dir);
  return { ok: true, counts: Object.fromEntries(OUTBOX_STATES.map((state) => [state, entries.filter((entry) => entry.state === state).length])), entries };
}

export function outboxWarning(dir, now = Date.now()) {
  const pending = readOutbox(dir).filter((entry) => entry.state === 'pending');
  if (!pending.length) return null;
  const oldest = Math.min(...pending.map((entry) => Date.parse(entry.createdAt)));
  return { pending: pending.length, oldestAgeMs: Math.max(0, now - oldest) };
}
