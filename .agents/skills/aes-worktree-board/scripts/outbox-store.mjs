#!/usr/bin/env node
import { join, resolve } from 'node:path';
import { appendJsonLineAtomic, readJsonLines, withRuntimeLock } from './runtime-store.mjs';
import { nowIso, shortDigest, storeError } from './job-store.mjs';

export const OUTBOX_SCHEMA = 'aes.worktree-board.outbox-entry/v1';
export const OUTBOX_STATES = Object.freeze(['pending', 'succeeded', 'abandoned', 'acknowledged']);
export function outboxPath(dir) { return join(resolve(dir), 'outbox.jsonl'); }

function assertString(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw storeError('OUTBOX_ENTRY_INVALID', `outbox ${field} 必须为非空字符串`, { field });
}

export function validateOutboxEntry(entry) {
  if (!entry || entry.schemaVersion !== OUTBOX_SCHEMA) throw storeError('OUTBOX_SCHEMA_MISMATCH', `outbox schemaVersion 必须为 ${OUTBOX_SCHEMA}`);
  assertString(entry.entryId, 'entryId');
  if (entry.kind !== 'issue-close') throw storeError('OUTBOX_ENTRY_INVALID', `未知 outbox kind: ${entry.kind}`);
  assertString(entry.jobId, 'jobId');
  if (!Number.isInteger(entry.issue)) throw storeError('OUTBOX_ENTRY_INVALID', 'outbox issue 必须为整数');
  if (!OUTBOX_STATES.includes(entry.state)) throw storeError('OUTBOX_ENTRY_INVALID', `未知 outbox state: ${entry.state}`);
  if (!Array.isArray(entry.attempts)) throw storeError('OUTBOX_ENTRY_INVALID', 'outbox attempts 必须为数组');
  if (entry.inFlight) {
    assertString(entry.inFlight.owner, 'inFlight.owner');
    if (!Number.isInteger(entry.inFlight.pid) || entry.inFlight.pid <= 0) throw storeError('OUTBOX_ENTRY_INVALID', 'inFlight.pid 必须为正整数');
    const leasedAt = Date.parse(entry.inFlight.leasedAt);
    const expiresAt = Date.parse(entry.inFlight.expiresAt);
    if (!Number.isFinite(leasedAt) || !Number.isFinite(expiresAt) || expiresAt < leasedAt) {
      throw storeError('OUTBOX_ENTRY_INVALID', 'inFlight 时间必须为合法且递增的 ISO 时间');
    }
  }
  if (entry.state === 'pending') {
    assertString(entry.repo, 'repo');
    assertString(entry.commentDigest, 'commentDigest');
    if (!entry.payload || typeof entry.payload.comment !== 'string' || entry.payload.closeIssue !== true) {
      throw storeError('OUTBOX_ENTRY_INVALID', 'pending outbox payload 必须含 comment 与 closeIssue=true');
    }
    assertString(entry.createdAt, 'createdAt');
  }
  if (entry.state === 'acknowledged') {
    assertString(entry.reason, 'reason');
    assertString(entry.acknowledgedAt, 'acknowledgedAt');
    assertString(entry.acknowledgedBy, 'acknowledgedBy');
  }
  return entry;
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
    if (entry.state === 'acknowledged') return { ok: true, outcome: 'ALREADY_ACKNOWLEDGED', entryId, issue: entry.issue, reason: entry.reason };
    if (entry.state !== 'abandoned') return { ok: false, code: 'NOT_ABANDONED', entryId, state: entry.state };
    const acknowledged = { ...entry, state: 'acknowledged', acknowledgedAt: nowIso(), acknowledgedBy: actor, reason: reason.trim() };
    append(dir, acknowledged);
    return { ok: true, outcome: 'ACKNOWLEDGED', entryId, issue: entry.issue, acknowledgedBy: actor, reason: acknowledged.reason };
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
