import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  watch,
  writeFileSync,
  renameSync,
} from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export const CONTINUATION_MODES = Object.freeze(['current_turn_deferred', 'manual_followup']);
export const CONTINUATION_STATUSES = Object.freeze([
  'arming',
  'awaiting_submission',
  'submitted',
  'resuming',
  'manual_recovery_required',
  'consumed',
]);
export const RECEIPT_STAGES = Object.freeze(['persisted', 'agent_resumed', 'consumed']);
export const USER_ACTIONS = Object.freeze(['submit', 'send_message', 'none']);
export const DEFAULT_LEASE_TTL_MS = 48 * 60 * 60 * 1000;
export const DEFAULT_HISTORY_WINDOW = 3;
export const RECOVERY_PAYLOAD_SCHEMA_VERSION = 1;

const LOCK_TIMEOUT_MS = 5_000;
const STALE_LOCK_MS = 30_000;
const RESERVED_PROJECTION_FIELDS = new Set(['continuation', 'mode', 'receipt_stage', 'next_user_action', 'generation', 'lease']);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function readJson(pathname, fallback = null) {
  try { return JSON.parse(readFileSync(pathname, 'utf8')); }
  catch { return fallback; }
}

export function writePrivateJson(pathname, value, mode = 0o600) {
  mkdirSync(dirname(pathname), { recursive: true });
  const temporary = `${pathname}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode });
  let renamed = false;
  try {
    for (let attempt = 0; attempt < 25; attempt += 1) {
      try {
        renameSync(temporary, pathname);
        renamed = true;
        break;
      } catch (error) {
        if (!['EPERM', 'EBUSY'].includes(error.code) || attempt === 24) throw error;
        // Windows can briefly hold the destination while a reader closes it.
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 8);
      }
    }
    try { chmodSync(pathname, mode); } catch { /* Windows ACLs are the effective boundary. */ }
  } finally {
    if (!renamed) rmSync(temporary, { force: true });
  }
}

export function continuationPaths(issueDirInput) {
  const issueDir = resolve(issueDirInput);
  const webDir = join(issueDir, 'web');
  const runtimeDir = join(webDir, 'runtime');
  return {
    issueDir,
    webDir,
    runtimeDir,
    lockDir: join(runtimeDir, '.continuation-lock'),
    leasePath: join(runtimeDir, 'continuation-lease.json'),
    receiptPath: join(runtimeDir, 'continuation-receipt.json'),
    consumptionPath: join(runtimeDir, 'consumption-records.jsonl'),
    submissionsDir: join(webDir, 'submissions'),
    consumedDir: join(webDir, 'consumed'),
    statePath: join(webDir, 'state.json'),
    serverStoppedPath: join(webDir, 'server-stopped'),
  };
}

function ensureRuntime(paths) {
  mkdirSync(paths.runtimeDir, { recursive: true });
  mkdirSync(paths.submissionsDir, { recursive: true });
  mkdirSync(paths.consumedDir, { recursive: true });
}

export async function withContinuationLock(issueDirInput, callback) {
  const paths = continuationPaths(issueDirInput);
  ensureRuntime(paths);
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  while (true) {
    try {
      mkdirSync(paths.lockDir);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        if (Date.now() - statSync(paths.lockDir).mtimeMs > STALE_LOCK_MS) {
          rmSync(paths.lockDir, { recursive: true, force: true });
          continue;
        }
      } catch { /* The owner may have released the lock between stat and remove. */ }
      if (Date.now() >= deadline) throw new Error('continuation_runtime_lock_timeout');
      await delay(10);
    }
  }
  try { return await callback(paths); }
  finally { rmSync(paths.lockDir, { recursive: true, force: true }); }
}

function validRoundId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value);
}

const RECOVERY_ITEM_FIELDS = Object.freeze([
  'q_id',
  'tier',
  'question',
  'line',
  'required',
  'response',
  'options',
  'known_facts',
  'irreversible',
  'source_refs',
  'triggered_by',
]);

function compactRoundItem(item) {
  return Object.fromEntries(RECOVERY_ITEM_FIELDS
    .filter((field) => item?.[field] !== undefined)
    .map((field) => [field, item[field]]));
}

function loadState(paths) {
  return readJson(paths.statePath, {
    schema_version: 2,
    slug: basename(paths.issueDir),
    rounds: [],
  });
}

export function sanitizeStateProjection(state) {
  if (!state || typeof state !== 'object') return state;
  const clean = Object.fromEntries(Object.entries(state).filter(([key]) => !RESERVED_PROJECTION_FIELDS.has(key)));
  if (Array.isArray(state.rounds)) {
    clean.rounds = state.rounds.map((round) => Object.fromEntries(
      Object.entries(round ?? {}).filter(([key]) => !RESERVED_PROJECTION_FIELDS.has(key)),
    ));
  }
  return clean;
}

function roundContext(paths, roundId) {
  const state = loadState(paths);
  const round = Array.isArray(state.rounds) ? state.rounds.find((candidate) => candidate.id === roundId) : null;
  const roundDigest = round?.digest ?? sha256Json({ ...round, digest: undefined, id: roundId });
  return {
    sessionSlug: state.slug ?? basename(paths.issueDir),
    round,
    revision: Number.isInteger(round?.revision) ? round.revision : 1,
    digest: roundDigest,
  };
}

function submissionPath(paths, roundId) {
  if (!validRoundId(roundId)) return null;
  return join(paths.submissionsDir, `${roundId}.json`);
}

function consumedPath(paths, roundId) {
  if (!validRoundId(roundId)) return null;
  return join(paths.consumedDir, `${roundId}.json`);
}

export function readSubmissionFile(issueDirInput, roundId) {
  const paths = continuationPaths(issueDirInput);
  const pathname = submissionPath(paths, roundId);
  if (!pathname || !existsSync(pathname)) return null;
  const submission = readJson(pathname);
  if (!submission || typeof submission !== 'object' || submission.round !== roundId || !Array.isArray(submission.answers)) return null;
  return submission;
}

export function readConsumedMarker(issueDirInput, roundId) {
  const paths = continuationPaths(issueDirInput);
  const pathname = consumedPath(paths, roundId);
  return pathname && existsSync(pathname) ? readJson(pathname) : null;
}

function isoNow(now = Date.now()) {
  return new Date(now).toISOString();
}

function parseTime(value) {
  const time = Date.parse(String(value ?? ''));
  return Number.isFinite(time) ? time : null;
}

function leaseMatches(receipt, lease, now = Date.now()) {
  if (!receipt || !lease) return false;
  if (receipt.mode !== 'current_turn_deferred') return false;
  if (lease.state !== 'active' && lease.state !== 'resumed' && lease.state !== 'consumed') return false;
  if (receipt.generation !== lease.generation || receipt.round !== lease.round) return false;
  if (receipt.revision !== lease.revision || receipt.digest !== lease.digest) return false;
  const expiresAt = parseTime(lease.expires_at);
  return expiresAt !== null && expiresAt > now;
}

function serverStoppedAfter(paths, receipt) {
  const stopped = readJson(paths.serverStoppedPath);
  if (!stopped?.stopped_at) return false;
  const stoppedAt = parseTime(stopped.stopped_at);
  const receiptAt = parseTime(receipt?.updated_at);
  return stoppedAt !== null && (receiptAt === null || stoppedAt >= receiptAt);
}

function correlation(receipt) {
  if (!receipt || !Number.isInteger(receipt.generation) || typeof receipt.round !== 'string') return undefined;
  return {
    session_slug: receipt.session_slug,
    round: receipt.round,
    revision: receipt.revision,
    digest: String(receipt.digest ?? '').startsWith('sha256:') ? receipt.digest : `sha256:${receipt.digest}`,
    generation: receipt.generation,
  };
}

function currentRound(paths, state, receipt) {
  const rounds = Array.isArray(state?.rounds) ? state.rounds : [];
  const receiptRound = receipt?.round ? rounds.find((round) => round.id === receipt.round) : null;
  const outstanding = rounds
    .filter((round) => existsSync(submissionPath(paths, round.id)) && !existsSync(consumedPath(paths, round.id)))
    .sort((left, right) => (left.no ?? 0) - (right.no ?? 0));
  if (outstanding.length > 0) return outstanding.at(0);
  const pending = rounds.filter((round) => round.status === 'pending').sort((left, right) => (left.no ?? 0) - (right.no ?? 0));
  if (pending.length > 0) return pending.at(0);
  if (receiptRound && !existsSync(consumedPath(paths, receiptRound.id))) return receiptRound;
  if (receiptRound) return receiptRound;
  const consumed = rounds.filter((round) => existsSync(consumedPath(paths, round.id)))
    .sort((left, right) => (left.no ?? 0) - (right.no ?? 0));
  return consumed.at(-1) ?? null;
}

function orderedRounds(state) {
  return (Array.isArray(state?.rounds) ? state.rounds : [])
    .slice()
    .sort((left, right) => (left.no ?? 0) - (right.no ?? 0) || String(left.id).localeCompare(String(right.id)));
}

function currentRoundIndex(rounds, currentRoundId) {
  const explicit = rounds.findIndex((round) => round.id === currentRoundId);
  if (explicit >= 0) return explicit;
  const pending = rounds.findIndex((round) => round.status === 'pending');
  return pending >= 0 ? pending : Math.max(rounds.length - 1, 0);
}

export function projectHistoryWindow(stateInput, currentRoundId = undefined, previousCount = DEFAULT_HISTORY_WINDOW) {
  const state = sanitizeStateProjection(stateInput ?? {});
  const rounds = orderedRounds(state);
  if (rounds.length === 0) {
    return {
      ...state,
      rounds: [],
      history_window: { current_round: null, previous_rounds: previousCount, older_available: false, older_before: null, total_rounds: 0 },
    };
  }
  const index = currentRoundIndex(rounds, currentRoundId);
  const start = Math.max(0, index - previousCount);
  const selected = rounds.slice(start, index + 1);
  const selectedIds = new Set(selected.map((round) => round.id));
  const projected = {
    ...state,
    rounds: selected,
  };
  if (Array.isArray(state.locked)) {
    projected.locked = state.locked.filter((item) => !item?.round || selectedIds.has(item.round));
  }
  return {
    ...projected,
    history_window: {
      current_round: rounds[index].id,
      previous_rounds: previousCount,
      older_available: start > 0,
      // Cursor is exclusive: ask for rows before the oldest visible row so the
      // boundary row immediately preceding the window is included.
      older_before: start > 0 ? selected[0].id : null,
      total_rounds: rounds.length,
    },
  };
}

export function readHistoryPage(stateInput, { before = undefined, limit = DEFAULT_HISTORY_WINDOW } = {}) {
  const state = sanitizeStateProjection(stateInput ?? {});
  const rounds = orderedRounds(state);
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 20) : DEFAULT_HISTORY_WINDOW;
  const beforeIndex = before === undefined ? rounds.length : rounds.findIndex((round) => round.id === before);
  const end = beforeIndex < 0 ? rounds.length : beforeIndex;
  const start = Math.max(0, end - safeLimit);
  return {
    rounds: rounds.slice(start, end),
    history_window: {
      before: before ?? null,
      limit: safeLimit,
      older_available: start > 0,
      // Cursor is exclusive; keep the oldest returned row as the next cursor.
      older_before: start > 0 ? rounds[start].id : null,
      total_rounds: rounds.length,
    },
  };
}

export function readAgentRecoveryPayload(issueDirInput, roundId = undefined) {
  const paths = continuationPaths(issueDirInput);
  const state = sanitizeStateProjection(loadState(paths));
  const { receipt } = readRuntimeFiles(issueDirInput);
  const round = roundId === undefined
    ? currentRound(paths, state, receipt)
    : state.rounds?.find((candidate) => candidate.id === roundId);
  if (!round || !validRoundId(round.id)) throw new Error('recovery_round_not_found');
  const submission = readJson(submissionPath(paths, round.id));
  if (!submission || !Array.isArray(submission.answers)) throw new Error('recovery_submission_missing');
  if (readJson(consumedPath(paths, round.id))) throw new Error('recovery_submission_consumed');
  return {
    schema_version: RECOVERY_PAYLOAD_SCHEMA_VERSION,
    kind: 'agent-recovery-payload',
    session_slug: state.slug ?? basename(paths.issueDir),
    round: round.id,
    revision: Number.isInteger(submission.round_revision) ? submission.round_revision : (round.revision ?? 1),
    digest: submission.round_digest ?? round.digest ?? sha256Json(round),
    questions: (round.items ?? []).map(compactRoundItem),
    answers: submission.answers,
  };
}

export function readTargetedHistory(issueDirInput, roundId, qId = undefined) {
  if (!validRoundId(roundId)) throw new Error('history_round_invalid');
  const paths = continuationPaths(issueDirInput);
  const state = sanitizeStateProjection(loadState(paths));
  const round = state.rounds?.find((candidate) => candidate.id === roundId);
  if (!round) throw new Error('history_round_not_found');
  if (qId !== undefined && !validRoundId(qId)) throw new Error('history_q_id_invalid');
  const items = (round.items ?? []).filter((item) => qId === undefined || item.q_id === qId).map(compactRoundItem);
  if (qId !== undefined && items.length === 0) throw new Error('history_q_id_not_found');
  const submission = readJson(submissionPath(paths, roundId));
  return {
    schema_version: RECOVERY_PAYLOAD_SCHEMA_VERSION,
    kind: 'targeted-history',
    session_slug: state.slug ?? basename(paths.issueDir),
    round: {
      id: round.id,
      no: round.no,
      stage: round.stage,
      title: round.title,
      revision: round.revision ?? submission?.round_revision ?? 1,
      digest: round.digest ?? submission?.round_digest ?? sha256Json(round),
      questions: items,
    },
    answers: (submission?.answers ?? []).filter((answer) => qId === undefined || answer.q_id === qId),
  };
}

function reasonFor(paths, receipt, lease, now) {
  if (receipt?.mode === 'manual_followup' && receipt.reason) return receipt.reason;
  if (serverStoppedAfter(paths, receipt)) return 'server_stopped';
  const expiry = parseTime(lease?.expires_at);
  if (expiry !== null && expiry <= now) return 'lease_expired';
  if (receipt?.reason) return receipt.reason;
  if (receipt) return 'continuation_not_ready';
  return 'legacy_state_without_runtime_receipt';
}

export function readRuntimeFiles(issueDirInput) {
  const paths = continuationPaths(issueDirInput);
  return {
    receipt: readJson(paths.receiptPath),
    lease: readJson(paths.leasePath),
  };
}

export function readPublicContinuation(issueDirInput, stateInput = undefined, now = Date.now()) {
  const paths = continuationPaths(issueDirInput);
  const state = sanitizeStateProjection(stateInput ?? loadState(paths));
  const { receipt, lease } = readRuntimeFiles(issueDirInput);
  const round = currentRound(paths, state, receipt);
  if (!round) return null;

  const submission = readJson(submissionPath(paths, round.id));
  const marker = readJson(consumedPath(paths, round.id));
  const receiptForRound = receipt?.round === round.id ? receipt : null;
  const leaseForRound = lease?.round === round.id ? lease : null;
  const deferred = leaseMatches(receiptForRound, leaseForRound, now) && !serverStoppedAfter(paths, receiptForRound);
  const mode = deferred || receiptForRound?.mode === 'current_turn_deferred'
    ? 'current_turn_deferred'
    : 'manual_followup';
  const reason = deferred ? undefined : reasonFor(paths, receiptForRound, leaseForRound, now);
  const base = {
    round: round.id,
    mode,
    updated_at: receiptForRound?.updated_at ?? submission?.received_at ?? state.updated_at ?? isoNow(now),
  };
  const safeCorrelation = correlation(receiptForRound);

  if (marker) {
    return {
      ...base,
      status: 'consumed',
      receipt_stage: 'consumed',
      next_user_action: 'none',
      ...(safeCorrelation ? { correlation: safeCorrelation } : {}),
    };
  }

  if (submission) {
    if (deferred) {
      const resumed = receiptForRound?.receipt_stage === 'agent_resumed' || receiptForRound?.status === 'resuming';
      return {
        ...base,
        status: resumed ? 'resuming' : 'submitted',
        receipt_stage: resumed ? 'agent_resumed' : 'persisted',
        next_user_action: 'none',
        ...(resumed && safeCorrelation ? { correlation: safeCorrelation } : {}),
      };
    }
    return {
      ...base,
      mode: 'manual_followup',
      status: 'manual_recovery_required',
      receipt_stage: 'persisted',
      next_user_action: 'send_message',
      reason,
    };
  }

  if (deferred) {
    const status = receiptForRound?.status === 'arming' ? 'arming' : 'awaiting_submission';
    return {
      ...base,
      status,
      next_user_action: 'submit',
    };
  }
  return {
    ...base,
    mode: 'manual_followup',
    status: 'awaiting_submission',
    next_user_action: 'submit',
    reason,
  };
}

export function submissionIdentity(issueDirInput, submission) {
  const paths = continuationPaths(issueDirInput);
  const state = loadState(paths);
  const digest = String(submission?.round_digest ?? sha256Json(submission));
  const revision = Number.isInteger(submission?.round_revision) ? submission.round_revision : 1;
  const identity = {
    session_slug: submission?.session_slug ?? state.slug ?? basename(paths.issueDir),
    round: submission?.round,
    revision,
    digest,
  };
  return { ...identity, key: sha256Json(identity) };
}

function leaseForAuthority(authority) {
  return {
    session_slug: authority.sessionSlug,
    round: authority.round,
    revision: authority.revision,
    digest: authority.digest,
    generation: authority.generation,
  };
}

function assertOwned(authority, lease, { allowExpired = false } = {}) {
  if (!lease || lease.session_slug !== authority.sessionSlug || lease.round !== authority.round
    || lease.revision !== authority.revision || lease.digest !== authority.digest
    || lease.generation !== authority.generation || lease.owner_nonce !== authority.ownerNonce) {
    const error = new Error('stale_continuation_owner');
    error.code = 'STALE_CONTINUATION_OWNER';
    throw error;
  }
  if (!allowExpired && parseTime(lease.expires_at) <= Date.now()) {
    const error = new Error('continuation_lease_expired');
    error.code = 'CONTINUATION_LEASE_EXPIRED';
    throw error;
  }
}

function receiptForAuthority(authority, patch = {}) {
  return {
    schema_version: 1,
    session_slug: authority.sessionSlug,
    round: authority.round,
    revision: authority.revision,
    digest: authority.digest,
    generation: authority.generation,
    mode: 'current_turn_deferred',
    status: 'arming',
    ...patch,
    updated_at: patch.updated_at ?? isoNow(),
  };
}

export async function armDeferredContinuation(issueDirInput, roundId, options = {}) {
  if (!validRoundId(roundId)) throw new Error('round_id_invalid');
  const paths = continuationPaths(issueDirInput);
  const context = roundContext(paths, roundId);
  const leaseTtlMs = options.leaseTtlMs ?? DEFAULT_LEASE_TTL_MS;
  if (!Number.isFinite(leaseTtlMs) || leaseTtlMs < 1) throw new Error('lease_ttl_invalid');
  return withContinuationLock(issueDirInput, (lockedPaths) => {
    ensureRuntime(lockedPaths);
    const previousLease = readJson(lockedPaths.leasePath);
    const previousReceipt = readJson(lockedPaths.receiptPath);
    const generation = Math.max(Number(previousLease?.generation) || 0, Number(previousReceipt?.generation) || 0) + 1;
    const ownerNonce = randomBytes(32).toString('hex');
    const acquiredAt = Date.now();
    const authority = {
      issueDir: lockedPaths.issueDir,
      webDir: lockedPaths.webDir,
      sessionSlug: context.sessionSlug,
      round: roundId,
      revision: context.revision,
      digest: context.digest,
      generation,
      ownerNonce,
      leaseTtlMs,
    };
    writePrivateJson(lockedPaths.leasePath, {
      schema_version: 1,
      ...leaseForAuthority(authority),
      owner_nonce: ownerNonce,
      owner_pid: process.pid,
      state: 'active',
      acquired_at: isoNow(acquiredAt),
      expires_at: isoNow(acquiredAt + leaseTtlMs),
    });
    writePrivateJson(lockedPaths.receiptPath, receiptForAuthority(authority, {
      status: 'arming',
      receipt_stage: null,
      reason: null,
      updated_at: isoNow(acquiredAt),
    }));
    return authority;
  });
}

export async function updateDeferredReceipt(authority, patch, { allowExpired = false } = {}) {
  return withContinuationLock(authority.issueDir, (paths) => {
    const lease = readJson(paths.leasePath);
    assertOwned(authority, lease, { allowExpired });
    const previous = readJson(paths.receiptPath, receiptForAuthority(authority));
    const next = receiptForAuthority(authority, {
      ...previous,
      ...patch,
      mode: 'current_turn_deferred',
      updated_at: isoNow(),
    });
    writePrivateJson(paths.receiptPath, next);
    return next;
  });
}

export async function failDeferredContinuation(authority, reason = 'continuation_unavailable') {
  return withContinuationLock(authority.issueDir, (paths) => {
    const lease = readJson(paths.leasePath);
    assertOwned(authority, lease, { allowExpired: true });
    const hasSubmission = Boolean(readJson(submissionPath(paths, authority.round)));
    const nextLease = { ...lease, state: 'released', released_at: isoNow(), release_reason: reason };
    const previous = readJson(paths.receiptPath, receiptForAuthority(authority));
    const nextReceipt = {
      ...previous,
      mode: 'manual_followup',
      status: hasSubmission ? 'manual_recovery_required' : 'awaiting_submission',
      ...(hasSubmission ? { receipt_stage: 'persisted' } : { receipt_stage: null }),
      reason,
      next_user_action: hasSubmission ? 'send_message' : 'submit',
      updated_at: isoNow(),
    };
    writePrivateJson(paths.leasePath, nextLease);
    writePrivateJson(paths.receiptPath, nextReceipt);
    return nextReceipt;
  });
}

export class ContinuationWaitError extends Error {
  constructor(message, code, exitCode = 1) {
    super(message);
    this.name = 'ContinuationWaitError';
    this.code = code;
    this.exitCode = exitCode;
  }
}

function readValidSubmission(paths, roundId) {
  const pathname = submissionPath(paths, roundId);
  if (!pathname || !existsSync(pathname)) return null;
  const submission = readJson(pathname);
  if (!submission || submission.round !== roundId || !Array.isArray(submission.answers)) return null;
  return submission;
}

/**
 * Wait for the durable inbox without acquiring or mutating continuation authority.
 * This is the compatibility/manual transport path; it must never create a
 * current_turn_deferred projection on behalf of an ordinary CLI process.
 */
export function waitForSubmissionTransport(issueDirInput, roundId, options = {}) {
  if (!validRoundId(roundId)) throw new Error('round_id_invalid');
  const timeoutMs = options.timeoutMs ?? null;
  const watchFactory = options.watchFactory;
  const signal = options.signal;
  const paths = continuationPaths(issueDirInput);
  return new Promise((resolvePromise, rejectPromise) => {
    let watcher = null;
    let timer = null;
    let settled = false;
    let inspecting = false;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      watcher?.close();
      watcher = null;
      signal?.removeEventListener('abort', onAbort);
    };
    const rejectWith = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      rejectPromise(error);
    };
    const finish = (submission) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolvePromise(submission);
    };
    const inspect = () => {
      if (settled || inspecting) return;
      inspecting = true;
      try {
        const submission = readValidSubmission(paths, roundId);
        if (submission) finish(submission);
      } catch (error) {
        rejectWith(new ContinuationWaitError('submission_read_failed', 'submission_read_failed'));
      } finally {
        inspecting = false;
      }
    };
    const onAbort = () => rejectWith(new ContinuationWaitError('wait_cancelled', 'wait_cancelled', 130));
    try {
      ensureRuntime(paths);
      const factory = watchFactory ?? watch;
      // Establish the watch before the first existence check to close the
      // rename/event race without acquiring continuation authority.
      watcher = factory(paths.submissionsDir, { persistent: true }, (event, filename) => {
        const name = Buffer.isBuffer(filename) ? filename.toString('utf8') : String(filename ?? '');
        if (name && name !== `${roundId}.json`) return;
        inspect();
      });
      if (signal?.aborted) return onAbort();
      signal?.addEventListener('abort', onAbort, { once: true });
      if (timeoutMs !== null) {
        if (!Number.isFinite(timeoutMs) || timeoutMs < 1) throw new Error('timeout_invalid');
        timer = setTimeout(() => rejectWith(new ContinuationWaitError(`timeout ${timeoutMs}ms`, 'wait_timeout', 2)), timeoutMs);
      }
      inspect();
    } catch (error) {
      rejectWith(new ContinuationWaitError('wait_setup_failed', 'wait_setup_failed'));
    }
  });
}

export function waitForDeferredSubmission(authority, options = {}) {
  const timeoutMs = options.timeoutMs ?? null;
  const watchFactory = options.watchFactory;
  const signal = options.signal;
  return new Promise((resolvePromise, rejectPromise) => {
    let watcher = null;
    let timer = null;
    let leaseTimer = null;
    let settled = false;
    let inspecting = false;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (leaseTimer) clearTimeout(leaseTimer);
      watcher?.close();
      watcher = null;
      signal?.removeEventListener('abort', onAbort);
    };
    const rejectWith = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      rejectPromise(error);
    };
    const fallback = async (reason, error = null) => {
      try { await failDeferredContinuation(authority, reason); }
      catch (failure) { if (!error) error = failure; }
      if (error && !(error instanceof ContinuationWaitError)) {
        const wrapped = new ContinuationWaitError(reason, reason);
        wrapped.cause = error;
        error = wrapped;
      }
      rejectWith(error ?? new ContinuationWaitError(reason, reason));
    };
    const finish = async (submission) => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        await updateDeferredReceipt(authority, { status: 'submitted', receipt_stage: 'persisted', reason: null });
        resolvePromise(submission);
      } catch (error) {
        try { await failDeferredContinuation(authority, error.code === 'STALE_CONTINUATION_OWNER' ? 'stale_owner' : 'resume_receipt_failed'); }
        catch { /* Preserve the original failure for the host. */ }
        rejectPromise(error);
      }
    };
    const inspect = async () => {
      if (settled || inspecting) return;
      inspecting = true;
      try {
        const paths = continuationPaths(authority.issueDir);
        const submission = readValidSubmission(paths, authority.round);
        if (submission) await finish(submission);
        else if (parseTime(readJson(paths.leasePath)?.expires_at) <= Date.now()) {
          await fallback('lease_expired', new ContinuationWaitError('continuation_lease_expired', 'lease_expired'));
        }
      } catch (error) {
        await fallback(error.code === 'STALE_CONTINUATION_OWNER' ? 'stale_owner' : 'submission_read_failed', error);
      } finally {
        inspecting = false;
      }
    };
    const onAbort = () => { void fallback('wait_cancelled', new ContinuationWaitError('wait_cancelled', 'wait_cancelled', 130)); };
    try {
      const paths = continuationPaths(authority.issueDir);
      ensureRuntime(paths);
      const factory = watchFactory ?? watch;
      // The watch is established before the first submission existence check. This closes the rename/event race.
      watcher = factory(paths.submissionsDir, { persistent: true }, (event, filename) => {
        const name = Buffer.isBuffer(filename) ? filename.toString('utf8') : String(filename ?? '');
        if (name && name !== `${authority.round}.json`) return;
        void inspect();
      });
      if (signal?.aborted) return onAbort();
      signal?.addEventListener('abort', onAbort, { once: true });
      const expiresAt = parseTime(readJson(paths.leasePath)?.expires_at);
      if (expiresAt !== null) {
        const remaining = Math.max(1, expiresAt - Date.now());
        leaseTimer = setTimeout(() => {
          void fallback('lease_expired', new ContinuationWaitError('continuation_lease_expired', 'lease_expired'));
        }, remaining);
      }
      void updateDeferredReceipt(authority, { status: 'awaiting_submission', receipt_stage: null, reason: null })
        .then(() => inspect())
        .catch((error) => fallback('wait_setup_failed', error));
      if (timeoutMs !== null) {
        if (!Number.isFinite(timeoutMs) || timeoutMs < 1) throw new Error('timeout_invalid');
        timer = setTimeout(() => { void fallback('wait_timeout', new ContinuationWaitError(`timeout ${timeoutMs}ms`, 'wait_timeout', 2)); }, timeoutMs);
      }
    } catch (error) {
      void fallback('wait_setup_failed', error);
    }
  });
}

export async function resumeDeferredContinuation(authority) {
  const runtime = readRuntimeFiles(authority.issueDir);
  if (runtime.receipt?.round !== authority.round || runtime.receipt?.receipt_stage !== 'persisted') {
    const error = new Error('continuation_not_persisted');
    error.code = 'CONTINUATION_NOT_PERSISTED';
    throw error;
  }
  return updateDeferredReceipt(authority, { status: 'resuming', receipt_stage: 'agent_resumed', reason: null });
}

export function readConsumptionRecords(issueDirInput) {
  const paths = continuationPaths(issueDirInput);
  if (!existsSync(paths.consumptionPath)) return [];
  return readFileSync(paths.consumptionPath, 'utf8').split(/\r?\n/).filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

function appendConsumptionRecordLocked(paths, record) {
  mkdirSync(dirname(paths.consumptionPath), { recursive: true });
  appendFileSync(paths.consumptionPath, `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600 });
  try { chmodSync(paths.consumptionPath, 0o600); } catch { /* Windows ACLs are the effective boundary. */ }
}

export async function claimConsumption(issueDirInput, roundId) {
  return withContinuationLock(issueDirInput, (paths) => {
    const submission = readValidSubmission(paths, roundId);
    if (!submission) throw new Error(`submission_not_found:${roundId}`);
    const identity = submissionIdentity(paths.issueDir, submission);
    const records = readConsumptionRecords(paths.issueDir);
    const existing = records.find((record) => record.key === identity.key);
    if (existing) return { ok: true, replay: true, status: existing.status, identity, submission };
    const conflict = records.find((record) => record.session_slug === identity.session_slug && record.round === identity.round && record.revision === identity.revision && record.digest !== identity.digest);
    if (conflict) throw new Error(`consumption_identity_conflict:${roundId}`);
    const record = { ...identity, status: 'processing', claimed_at: isoNow() };
    appendConsumptionRecordLocked(paths, record);
    return { ok: true, replay: false, status: 'processing', identity, submission };
  });
}

export async function commitConsumption(issueDirInput, identity, generation = null) {
  return withContinuationLock(issueDirInput, (paths) => {
    const records = readConsumptionRecords(paths.issueDir);
    const existing = records.find((record) => record.key === identity.key && record.status === 'committed');
    if (!existing) appendConsumptionRecordLocked(paths, { ...identity, status: 'committed', committed_at: isoNow(), ...(generation === null ? {} : { generation }) });
    return { ok: true, replay: Boolean(existing), status: 'committed', identity };
  });
}

export async function recordConsumed(issueDirInput, roundId, { appendLedger, generation = null } = {}) {
  return withContinuationLock(issueDirInput, (paths) => {
    const submission = readValidSubmission(paths, roundId);
    if (!submission) throw new Error(`submission_not_found:${roundId}`);
    const identity = submissionIdentity(paths.issueDir, submission);
    const markerPath = consumedPath(paths, roundId);
    let marker = markerPath && readJson(markerPath);
    if (marker?.idempotency_key && marker.idempotency_key !== identity.key) throw new Error(`consumption_identity_conflict:${roundId}`);
    const records = readConsumptionRecords(paths.issueDir);
    const committed = records.find((record) => record.key === identity.key && record.status === 'committed');
    const markerNeedsIdentity = marker && !marker.idempotency_key;
    if (!marker || markerNeedsIdentity) {
      marker = {
        ...(marker ?? {}),
        schema_version: 2,
        round: roundId,
        submission: basename(submissionPath(paths, roundId)),
        consumed_at: marker?.consumed_at ?? committed?.committed_at ?? isoNow(),
        session_slug: identity.session_slug,
        revision: identity.revision,
        digest: identity.digest,
        idempotency_key: identity.key,
        ...(generation === null ? {} : { generation }),
      };
      writePrivateJson(markerPath, marker);
    }
    if (!records.some((record) => record.key === identity.key && record.status === 'committed')) {
      appendConsumptionRecordLocked(paths, {
        ...identity,
        status: 'committed',
        committed_at: marker.consumed_at,
        ...(generation === null ? {} : { generation }),
      });
    }
    const existingLedger = typeof appendLedger?.find === 'function' ? appendLedger.find(marker) : null;
    if (!existingLedger && typeof appendLedger?.append === 'function') appendLedger.append(marker);
    return { ok: true, round: roundId, consumed: true, replay: Boolean(committed || existingLedger), marker, identity };
  });
}

export function continuationGeneration(issueDirInput, roundId) {
  const { receipt } = readRuntimeFiles(issueDirInput);
  return receipt?.round === roundId && Number.isInteger(receipt.generation) ? receipt.generation : null;
}
