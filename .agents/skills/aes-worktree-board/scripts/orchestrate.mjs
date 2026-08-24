#!/usr/bin/env node
// 可恢复控制平面的单一 CLI：Task Registry、事件 inbox、状态机、三维 verdict、
// BLOCK 熔断和全局停止。宿主 create_thread/wait_threads 仍由主 agent 调用，本脚本只登记事实。
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listWorktrees, RUNTIME_DIR } from './collect.mjs';
import {
  appendJsonLineAtomic, canonicalWorktreeKey, readJson, readJsonLines, readRegistry, updateRegistry,
  TERMINAL_TASK_STATES, withRuntimeLock, writeJsonAtomic, writeTextAtomic,
} from './runtime-store.mjs';

export const TASK_STATES = Object.freeze([
  'discovered', 'classified', 'claimed', 'dispatching', 'executing', 'self-qa', 'committed',
  'reviewing', 'approved', 'fixing', 'merge-ready', 'merged', 'parked', 'handoff-required',
]);
// 锁定材料称“15 态”：14 个 Task 态 + 1 个全局控制态。orchestration-stop 不可写入 Task.state。
export const CONTROL_STATES = Object.freeze([...TASK_STATES, 'orchestration-stop']);
export const TERMINAL_OR_PAUSED = TERMINAL_TASK_STATES;
export const VERDICT_CODES = Object.freeze(['PASS', 'BLOCK']);
export const RUNTIME_VERDICTS = Object.freeze(['PASS', 'NOT_RUN', 'BLOCKED', 'FAIL']);
export const DELIVERY_VERDICTS = Object.freeze(['MERGE_READY', 'PARKED', 'HANDOFF_REQUIRED', 'BLOCKED']);

const BASE_TRANSITIONS = {
  discovered: ['classified'],
  classified: ['claimed'],
  claimed: ['dispatching'],
  dispatching: ['executing'],
  executing: ['self-qa'],
  'self-qa': ['committed'],
  committed: ['reviewing'],
  reviewing: ['approved', 'fixing'],
  fixing: ['executing'],
  approved: ['merge-ready'],
  'merge-ready': ['merged'],
  parked: ['executing'],
  merged: [],
  'handoff-required': [],
};
const ACTIVE_STATES = TASK_STATES.filter((state) => !TERMINAL_OR_PAUSED.includes(state));
export const TRANSITIONS = Object.freeze(Object.fromEntries(TASK_STATES.map((state) => [
  state,
  Object.freeze([...new Set([
    ...(BASE_TRANSITIONS[state] || []),
    ...(ACTIVE_STATES.includes(state) ? ['parked', 'handoff-required'] : []),
  ])]),
])));

function controlError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  error.exitCode = 2;
  return error;
}

function now() { return new Date().toISOString(); }
function applyTaskTiming(task, from, to, timestamp) {
  if (from === 'parked' && to === 'executing') {
    task.startedAt = timestamp;
    task.finishedAt = null;
  } else if (TERMINAL_OR_PAUSED.includes(to)) {
    task.finishedAt = timestamp;
  }
}
export function canonicalWorktreeId(value) {
  try {
    return canonicalWorktreeKey(value);
  } catch (error) {
    throw controlError(error.code || 'BAD_WORKTREE', error.message);
  }
}

function shortWorker(worktree) { return canonicalWorktreeId(worktree); }
function transitionsPath(runtimeDir) { return join(runtimeDir, 'transitions.jsonl'); }
function inboxPath(runtimeDir) { return join(runtimeDir, 'inbox.jsonl'); }
function heartbeatPath(runtimeDir, worktree) { return join(runtimeDir, 'heartbeats', `${worktree}.json`); }

function requireValue(options, name) {
  const value = options[name];
  if (value === undefined || value === null || value === '') throw controlError('BAD_REQUEST', `缺少 --${name}`);
  return value;
}

function latestExecutorForWorktree(registry, worktree) {
  return Object.values(registry.tasks)
    .filter((task) => task.worktree === worktree && task.role === 'executor')
    .sort((left, right) => right.generation - left.generation || String(right.updatedAt).localeCompare(String(left.updatedAt)))[0] || null;
}

function taskById(registry, taskId) {
  const task = registry.tasks[taskId];
  if (!task) throw controlError('UNKNOWN_TASK', `未知 Task: ${taskId}`, { taskId });
  return task;
}

function appendTransition(runtimeDir, task, from, to, { eventId = null, actor = 'orchestrator', reason = null, evidence = [] } = {}) {
  appendJsonLineAtomic(transitionsPath(runtimeDir), {
    ts: now(), taskId: task.taskId, from, to, eventId, actor, reason, evidence,
  });
}

function assertTransition(from, to) {
  if (!TASK_STATES.includes(to)) throw controlError('INVALID_STATE', `非法 Task 状态: ${to}`, { allowed: TASK_STATES });
  const allowed = TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw controlError('INVALID_TRANSITION', `${from} 不能转移到 ${to}；合法去向: ${allowed.join(', ') || '(无)'}`, {
      from, to, allowed,
    });
  }
}

function assertEffectiveVerdict(task, verdict) {
  if (verdict.delivery !== 'MERGE_READY') return;
  if (verdict.code !== 'PASS') {
    throw controlError('CODE_REVIEW_REQUIRED', 'delivery=MERGE_READY 要求 code=PASS');
  }
  if (!verdict.runtime) {
    throw controlError('RUNTIME_EVIDENCE_REQUIRED', 'delivery=MERGE_READY 要求显式 runtime evidence');
  }
  if (['BLOCKED', 'FAIL'].includes(verdict.runtime)) {
    throw controlError('RUNTIME_BLOCKS_DELIVERY', `runtime=${verdict.runtime} 时不得标记 MERGE_READY`);
  }
  if (task.requiresRuntime && verdict.runtime !== 'PASS') {
    throw controlError('RUNTIME_REQUIRED', '该 Issue 要求真机证据，只有 runtime=PASS 才可标记 MERGE_READY');
  }
}

function assertTransitionEvidence(registry, task, to, candidate) {
  if (['committed', 'reviewing', 'approved', 'merge-ready', 'merged'].includes(to) && !candidate.commitSha) {
    throw controlError('COMMIT_EVIDENCE_REQUIRED', `${to} 要求 commitSha`);
  }
  if (['approved', 'merge-ready', 'merged'].includes(to)) {
    const evidence = candidate.reviewEvidence || null;
    const reviewer = evidence?.reviewTaskId ? registry.tasks[evidence.reviewTaskId] : null;
    if (!evidence?.eventId || evidence.verdict !== 'APPROVE'
      || evidence.commitSha !== candidate.commitSha
      || !reviewer || reviewer.role !== 'reviewer'
      || reviewer.parentTaskId !== task.taskId || reviewer.worktree !== task.worktree) {
      throw controlError('REVIEW_EVIDENCE_REQUIRED', `${to} 要求与当前 commit 绑定的独立 reviewer APPROVE 事件`);
    }
    if (candidate.verdict.code !== 'PASS') throw controlError('CODE_REVIEW_REQUIRED', `${to} 要求 code=PASS`);
  }
  if (['merge-ready', 'merged'].includes(to)) assertEffectiveVerdict(task, candidate.verdict);
  if (to === 'merged' && !candidate.mergeCommit) {
    throw controlError('MERGE_COMMIT_REQUIRED', 'merged 要求 mergeCommit');
  }
}

function taskGeneration(registry, worktree) {
  return Math.max(0, ...Object.values(registry.tasks).filter((task) => task.worktree === worktree).map((task) => Number(task.generation) || 0)) + 1;
}

export function createTask(options, runtimeDir = RUNTIME_DIR) {
  const issue = Number(requireValue(options, 'issue'));
  const worktree = canonicalWorktreeId(requireValue(options, 'worktree'));
  const role = String(options.role || 'executor');
  const threadId = options['thread-id'] || options.threadId || null;
  const clientThreadId = options['client-thread-id'] || options.clientThreadId || null;
  const agent = options.agent || null;
  const fallbackAuthorized = options['fallback-authorized'] || options.fallbackAuthorized || null;
  if (!Number.isInteger(issue) || issue < 0) throw controlError('BAD_REQUEST', '--issue 必须是非负整数');
  if (!['executor', 'reviewer'].includes(role)) throw controlError('BAD_REQUEST', '--role 只接受 executor|reviewer');
  const taskKind = threadId || clientThreadId ? 'desktop-thread' : 'cli-fallback';
  if (taskKind === 'cli-fallback' && agent !== 'test' && !fallbackAuthorized) {
    throw controlError(
      'FALLBACK_AUTH_REQUIRED',
      'cli-fallback 需显式授权：加 --fallback-authorized "<用户原话>"；正常路径是 Desktop create_thread。',
    );
  }
  const modelTier = options.model || options.modelTier || 'luna-max';
  if (!['luna-max', 'sol-high'].includes(modelTier)) throw controlError('BAD_REQUEST', '--model 只接受 luna-max|sol-high');
  const routingReason = options['routing-reason'] || options.routingReason || (agent === 'test' ? 'test fixture' : 'cli-fallback explicit authorization');
  return updateRegistry(runtimeDir, (registry) => {
    if (registry.orchestration.state === 'stopped') {
      throw controlError('ORCHESTRATION_STOPPED', '全局编排已停止；先由人工明确恢复，禁止新建 Task');
    }
    for (const identity of [threadId, clientThreadId].filter(Boolean)) {
      const duplicate = Object.values(registry.tasks).find((task) => task.threadId === identity || task.clientThreadId === identity);
      if (duplicate) throw controlError('THREAD_IN_USE', `${identity} 已关联 Task ${duplicate.taskId}`);
    }
    const existingLease = registry.leases[worktree];
    const parentTaskId = options['parent-task-id'] || options.parentTaskId || null;
    let generation;
    let taskId;
    if (role === 'reviewer') {
      if (!parentTaskId) throw controlError('PARENT_TASK_REQUIRED', 'reviewer Task 必须带 --parent-task-id');
      const parent = taskById(registry, parentTaskId);
      if (parent.role !== 'executor' || parent.worktree !== worktree || parent.issue !== issue) {
        throw controlError('INVALID_REVIEW_PARENT', 'reviewer 必须关联同 Issue、同 worktree 的 executor Task');
      }
      if (['parked', 'handoff-required', 'merged'].includes(parent.state)) {
        throw controlError('LANE_CLOSED', `${worktree} 当前为 ${parent.state}，禁止后续 reviewer 派发`, { taskId: parent.taskId });
      }
      if (!['committed', 'reviewing'].includes(parent.state)) {
        throw controlError('REVIEW_NOT_READY', `executor ${parentTaskId} 当前为 ${parent.state}，尚不可登记 reviewer`);
      }
      if (!existingLease || existingLease.owner !== parentTaskId) {
        throw controlError('PARENT_LEASE_MISMATCH', `executor ${parentTaskId} 未持有 ${worktree} writer 租约`);
      }
      generation = parent.generation;
      const ordinal = Object.values(registry.tasks).filter((task) => task.parentTaskId === parentTaskId && task.role === 'reviewer').length + 1;
      taskId = options['task-id'] || options.taskId || `${parentTaskId}-review-${ordinal}`;
    } else {
      const previous = latestExecutorForWorktree(registry, worktree);
      if (previous && previous.agent !== 'test' && ['parked', 'handoff-required'].includes(previous.state) && !previous.retryable) {
        throw controlError('LANE_CLOSED', `${worktree} 当前为 ${previous.state}，禁止后续派发`, { taskId: previous.taskId });
      }
      if (existingLease) {
        throw controlError('LOCKED', `${worktree} 已由 ${existingLease.owner} 持有租约`, {
          worktree, leaseOwner: existingLease.owner, acquiredAt: existingLease.acquiredAt,
        });
      }
      generation = taskGeneration(registry, worktree);
      taskId = options['task-id'] || options.taskId || `tk-${shortWorker(worktree)}-${issue}-g${generation}`;
    }
    if (registry.tasks[taskId]) throw controlError('TASK_EXISTS', `Task 已存在: ${taskId}`);
    const timestamp = now();
    const task = {
      taskId, taskKind, threadId, clientThreadId,
      hostId: options['host-id'] || null, projectId: options['project-id'] || null,
      issue, worktree, role, parentTaskId, generation,
      state: 'dispatching', phase: options.phase || 'dispatching',
      interactionClass: options['interaction-class'] || 'autonomous',
      modelTier, routingReason, cursor: null, lastEventId: null, consumedEventIds: [],
      headSha: options['head-sha'] || null, commitSha: null, mergeCommit: null,
      verdict: { code: null, runtime: null, delivery: null }, reviewTaskId: null, reviewEvidence: null,
      blockCount: 0, blockLedger: [], lastProgressAt: timestamp,
      nextAction: options['next-action'] || 'wait for registered thread events',
      fallbackAuthorized, requiresRuntime: options['requires-runtime'] === true || options['requires-runtime'] === 'true',
      agent, createdAt: timestamp, startedAt: timestamp, finishedAt: null, updatedAt: timestamp,
    };
    registry.tasks[taskId] = task;
    if (role === 'executor') registry.leases[worktree] = { owner: taskId, generation, acquiredAt: timestamp };
    writeTextAtomic(heartbeatPath(runtimeDir, worktree), `${JSON.stringify({ taskId, generation, at: timestamp })}\n`);
    appendTransition(runtimeDir, task, 'claimed', 'dispatching', {
      actor: 'orchestrator', reason: taskKind === 'desktop-thread' ? 'Desktop create_thread registered' : 'authorized cli-fallback registered',
      evidence: threadId ? [`thread:${threadId}`] : [],
    });
    return { result: 'created', taskId, state: task.state, lease: role === 'executor' ? worktree : null, task };
  });
}

export function attachTaskThread(taskId, options, runtimeDir = RUNTIME_DIR) {
  const threadId = String(requireValue(options, 'thread-id'));
  return updateRegistry(runtimeDir, (registry) => {
    const task = taskById(registry, taskId);
    if (task.taskKind !== 'desktop-thread') throw controlError('NOT_DESKTOP_TASK', `${taskId} 不是 Desktop Task`);
    if (task.threadId && task.threadId !== threadId) {
      throw controlError('THREAD_ALREADY_ATTACHED', `${taskId} 已绑定 ${task.threadId}`);
    }
    const duplicate = Object.values(registry.tasks).find((candidate) => candidate.taskId !== taskId && candidate.threadId === threadId);
    if (duplicate) throw controlError('THREAD_IN_USE', `${threadId} 已关联 Task ${duplicate.taskId}`);
    task.threadId = threadId;
    task.hostId = options['host-id'] || task.hostId;
    task.projectId = options['project-id'] || task.projectId;
    task.updatedAt = now();
    return { result: 'thread-attached', taskId, threadId, clientThreadId: task.clientThreadId };
  });
}

export function heartbeatTask(taskId, runtimeDir = RUNTIME_DIR) {
  return updateRegistry(runtimeDir, (registry) => {
    const task = taskById(registry, taskId);
    const timestamp = now();
    task.lastProgressAt = timestamp;
    task.updatedAt = timestamp;
    writeTextAtomic(heartbeatPath(runtimeDir, task.worktree), `${JSON.stringify({ taskId, generation: task.generation, at: timestamp })}\n`);
    return { result: 'heartbeat', taskId, at: timestamp };
  });
}

export function transitionTask(taskId, to, details = {}, runtimeDir = RUNTIME_DIR) {
  return updateRegistry(runtimeDir, (registry) => {
    const task = taskById(registry, taskId);
    const from = task.state;
    assertTransition(from, to);
    if (to === 'merged' && (!details.mergeCommit || details.source !== 'cli')) {
      throw controlError('MERGE_GATE_REQUIRED', 'merged 只能由主 agent 在 merge gate 后通过 CLI --merge-commit 登记');
    }
    if (to === 'merged' && (details.actor || 'orchestrator') !== 'orchestrator') {
      throw controlError('MERGE_GATE_REQUIRED', '只有 orchestrator 主 agent 可以登记 merged');
    }
    const candidate = {
      ...task,
      commitSha: details.commitSha || task.commitSha,
      mergeCommit: details.mergeCommit || task.mergeCommit,
      reviewTaskId: details.reviewTaskId || task.reviewTaskId,
      verdict: { ...task.verdict },
    };
    assertTransitionEvidence(registry, task, to, candidate);
    const timestamp = now();
    task.state = to;
    task.phase = details.phase || to;
    task.updatedAt = timestamp;
    task.lastProgressAt = task.updatedAt;
    applyTaskTiming(task, from, to, timestamp);
    task.nextAction = details.nextAction ?? task.nextAction;
    if (details.commitSha) task.commitSha = details.commitSha;
    if (details.mergeCommit) task.mergeCommit = details.mergeCommit;
    if (details.reviewTaskId) task.reviewTaskId = details.reviewTaskId;
    if (to === 'merged' && registry.leases[task.worktree]?.owner === taskId) delete registry.leases[task.worktree];
    appendTransition(runtimeDir, task, from, to, details);
    return { result: 'transitioned', taskId, from, to, nextAction: task.nextAction };
  });
}

function payloadSummary(payload) {
  if (typeof payload?.summary === 'string') return payload.summary;
  return JSON.stringify(payload || {});
}

export function eventIdFor(threadId, kind, payload) {
  return `E-${createHash('sha1').update(`${threadId}${kind}${payloadSummary(payload)}`).digest('hex').slice(0, 12)}`;
}

function taskForThread(registry, threadId) {
  return Object.values(registry.tasks).find((task) => task.threadId === threadId || task.clientThreadId === threadId) || null;
}

function assertThreadTaskRelationship(registry, task, threadId) {
  const sourceTask = taskForThread(registry, threadId);
  if (!sourceTask) throw controlError('THREAD_TASK_MISMATCH', `thread ${threadId} 未关联任何 Task，不能写入 ${task.taskId}`);
  if (sourceTask.taskId === task.taskId) return sourceTask;
  if (sourceTask.role === 'reviewer' && sourceTask.parentTaskId === task.taskId) return sourceTask;
  throw controlError('THREAD_TASK_MISMATCH', `thread ${threadId} 属于 ${sourceTask.taskId}，不能写入 ${task.taskId}`, {
    threadId, sourceTaskId: sourceTask.taskId, taskId: task.taskId,
  });
}

export function putInboxEvent(options, runtimeDir = RUNTIME_DIR) {
  const threadId = String(requireValue(options, 'thread'));
  const kind = String(requireValue(options, 'kind'));
  if (!['final', 'commentary', 'verdict', 'progress'].includes(kind)) throw controlError('BAD_REQUEST', '--kind 非法');
  let payload = {};
  if (options['payload-file']) payload = JSON.parse(readFileSync(resolve(options['payload-file']), 'utf8'));
  else if (options.payload) payload = JSON.parse(options.payload);
  else if (options.summary) payload = { summary: options.summary };
  const eventId = options['event-id'] || payload.eventId || eventIdFor(threadId, kind, payload);
  return updateRegistry(runtimeDir, (registry) => {
    let taskId = options.task || options['task-id'] || payload.taskId || null;
    if (!taskId) {
      taskId = taskForThread(registry, threadId)?.taskId || null;
    }
    if (!taskId) throw controlError('UNKNOWN_TASK', `thread ${threadId} 未关联 Task；请加 --task`);
    const task = taskById(registry, taskId);
    const sourceTask = assertThreadTaskRelationship(registry, task, threadId);
    appendJsonLineAtomic(inboxPath(runtimeDir), {
      eventId, threadId, taskId, sourceTaskId: sourceTask.taskId, kind, receivedAt: now(), payload,
    });
    return { result: 'queued', eventId, taskId };
  });
}

export function pendingInbox(runtimeDir = RUNTIME_DIR) {
  const registry = readRegistry(runtimeDir);
  const consumed = new Set(Object.values(registry.tasks).flatMap((task) => task.consumedEventIds || []));
  const unique = new Map();
  for (const event of readJsonLines(inboxPath(runtimeDir))) {
    if (!consumed.has(event.eventId) && !unique.has(event.eventId)) unique.set(event.eventId, event);
  }
  const cursors = {};
  for (const task of Object.values(registry.tasks)) {
    if (task.threadId && task.cursor) cursors[task.threadId] = task.cursor;
    for (const [threadId, cursor] of Object.entries(task.threadCursors || {})) cursors[threadId] = cursor;
  }
  return { pending: [...unique.values()], cursors, orchestration: registry.orchestration.state };
}

function desiredTransition(event) {
  if (event.payload?.to) return event.payload.to;
  const verdict = String(event.payload?.verdict || '').toUpperCase();
  if (verdict === 'APPROVE' || verdict === 'PASS') return 'approved';
  if (verdict === 'BLOCK') return 'fixing';
  return null;
}

function validateBlockEvent(registry, task, event, commit) {
  if (!event || event.taskId !== task.taskId) {
    throw controlError('REVIEW_EVIDENCE_REQUIRED', `BLOCK ${event?.eventId || '(无事件)'} 必须先由关联 reviewer 入箱`);
  }
  const reviewer = assertThreadTaskRelationship(registry, task, event.threadId);
  const eventVerdict = String(event.payload?.verdict || '').toUpperCase();
  if (reviewer.role !== 'reviewer' || reviewer.parentTaskId !== task.taskId
    || !['final', 'verdict'].includes(event.kind) || eventVerdict !== 'BLOCK'
    || event.payload?.commitSha !== commit) {
    throw controlError('REVIEW_EVIDENCE_REQUIRED', `BLOCK ${event.eventId} 不是当前 commit ${commit} 的最终 reviewer verdict`);
  }
  return reviewer;
}

function consumeRecordedEvent(task, event) {
  task.consumedEventIds ||= [];
  if (!task.consumedEventIds.includes(event.eventId)) task.consumedEventIds.push(event.eventId);
  task.cursor = event.payload?.cursor || event.eventId;
  task.threadCursors ||= {};
  task.threadCursors[event.threadId] = task.cursor;
  task.lastEventId = event.eventId;
}

function applyBlockRecord(registry, runtimeDir, task, event, { commit, finding, findingPath = null }) {
  const reviewer = validateBlockEvent(registry, task, event, commit);
  consumeRecordedEvent(task, event);
  task.blockLedger ||= [];
  if (task.blockLedger.some((entry) => entry.commit === commit && entry.verdict === 'BLOCK')) {
    return { result: 'duplicate-verdict', blockCount: task.blockCount, state: task.state, transition: null };
  }
  if (task.state === 'handoff-required' || task.blockCount >= 3) {
    throw controlError('CIRCUIT_OPEN', `${task.taskId} 已熔断，禁止继续记录或派发`);
  }
  if (task.state !== 'reviewing') {
    throw controlError('INVALID_BLOCK_STATE', `最终 reviewer BLOCK 只能在 reviewing 记录，当前为 ${task.state}`);
  }
  task.blockLedger.push({ commit, verdict: 'BLOCK', eventId: event.eventId, reviewTaskId: reviewer.taskId, at: now() });
  task.blockCount = task.blockLedger.length;
  task.commitSha = commit;
  task.verdict.code = 'BLOCK';
  task.verdict.delivery = task.blockCount >= 3 ? 'HANDOFF_REQUIRED' : 'BLOCKED';
  const timestamp = now();
  task.updatedAt = timestamp;
  const from = task.state;
  if (task.blockCount < 3) {
    task.state = 'fixing';
    task.phase = 'fixing';
    task.nextAction = 'return to original executor with reviewer finding';
    appendTransition(runtimeDir, task, from, 'fixing', {
      eventId: event.eventId, actor: 'reviewer', reason: `final BLOCK ${task.blockCount}/3 on ${commit}`,
      evidence: [findingPath || `thread:${event.threadId}`],
    });
    return { result: 'recorded', blockCount: task.blockCount, state: task.state, transition: { from, to: 'fixing' } };
  }
  task.state = 'handoff-required';
  applyTaskTiming(task, from, task.state, timestamp);
  task.phase = 'awaiting-human';
  task.nextAction = `人工交接，见 runtime/handoff/${task.taskId}.md`;
  const handoffPath = join(runtimeDir, 'handoff', `${task.taskId}.md`);
  writeTextAtomic(handoffPath, `# Handoff: ${task.taskId}\n\n- Issue: #${task.issue}\n- Worktree: ${task.worktree}\n- HEAD/follow-up commit: ${commit}\n- blockCount: ${task.blockCount}\n- runtime evidence: ${task.verdict.runtime || 'NOT_RUN (未记录)'}\n- Current state: handoff-required\n\n## Final reviewer finding\n\n${finding}\n\n## Resume conditions\n\n人工确认 finding 的处置方式，明确允许解除熔断后，才可 transition 恢复；当前不会自动创建 Task、merge、reset 或删除现场。\n`);
  appendTransition(runtimeDir, task, from, 'handoff-required', {
    eventId: event.eventId, actor: 'orchestrator', reason: 'third final BLOCK on a new follow-up commit',
    evidence: [findingPath || `thread:${event.threadId}`],
  });
  return {
    result: 'circuit-broken', blockCount: task.blockCount, state: task.state,
    handoffBundle: handoffPath, transition: { from, to: 'handoff-required' },
  };
}

export function consumeEvent(eventId, runtimeDir = RUNTIME_DIR) {
  return updateRegistry(runtimeDir, (registry) => {
    const event = readJsonLines(inboxPath(runtimeDir)).find((candidate) => candidate.eventId === eventId);
    if (!event) throw controlError('UNKNOWN_EVENT', `未知 eventId: ${eventId}`, { eventId });
    const task = taskById(registry, event.taskId);
    const sourceTask = assertThreadTaskRelationship(registry, task, event.threadId);
    const eventTransition = desiredTransition(event);
    if (event.payload?.mergeCommit || eventTransition === 'merged') {
      throw controlError('MERGE_GATE_REQUIRED', 'executor/reviewer event 不得登记 merged 或携带 mergeCommit；必须由主 agent 通过 --merge-commit 完成 merge gate');
    }
    if ((task.consumedEventIds || []).includes(eventId)) return { result: 'already-consumed', eventId };
    const to = eventTransition;
    let transition = null;
    let nextAction = 'continue-wait';
    const explicitVerdict = String(event.payload?.verdict || '').toUpperCase();
    if (to === 'fixing' || explicitVerdict === 'BLOCK') {
      const block = applyBlockRecord(registry, runtimeDir, task, event, {
        commit: event.payload?.commitSha,
        finding: event.payload?.finding || event.payload?.summary || 'reviewer BLOCK event',
      });
      return {
        result: 'consumed', eventId, taskId: task.taskId, transition: block.transition,
        nextAction: block.state === 'handoff-required' ? 'handoff-required' : block.result === 'duplicate-verdict' ? 'continue-wait' : 'return-to-executor',
        blockResult: block.result, blockCount: block.blockCount,
      };
    }
    if (to && !TERMINAL_OR_PAUSED.includes(task.state)) {
      const from = task.state;
      assertTransition(from, to);
      if (to === 'approved') {
        const explicitVerdict = String(event.payload?.verdict || '').toUpperCase();
        if (!['final', 'verdict'].includes(event.kind) || !['APPROVE', 'PASS'].includes(explicitVerdict)) {
          throw controlError('INVALID_REVIEW_EVENT', 'approved 只接受 reviewer final/verdict 的显式 APPROVE|PASS');
        }
        if (sourceTask.role !== 'reviewer' || sourceTask.parentTaskId !== task.taskId) {
          throw controlError('REVIEW_EVIDENCE_REQUIRED', 'APPROVE 必须来自已关联的独立 reviewer Task');
        }
        const reviewedCommit = event.payload?.commitSha || null;
        if (!reviewedCommit || reviewedCommit !== task.commitSha) {
          throw controlError('REVIEW_COMMIT_MISMATCH', `reviewer APPROVE 必须绑定当前 commit ${task.commitSha || '(未记录)'}`);
        }
        task.verdict.code = 'PASS';
        task.reviewTaskId = sourceTask.taskId;
        task.reviewEvidence = {
          reviewTaskId: sourceTask.taskId, eventId, threadId: event.threadId,
          commitSha: reviewedCommit, verdict: 'APPROVE', recordedAt: now(),
        };
      }
      const candidate = {
        ...task,
        commitSha: event.payload?.commitSha || task.commitSha,
        verdict: { ...task.verdict },
      };
      assertTransitionEvidence(registry, task, to, candidate);
      const transitionTimestamp = now();
      task.state = to;
      task.phase = to;
      if (event.payload?.commitSha) task.commitSha = event.payload.commitSha;
      applyTaskTiming(task, from, to, transitionTimestamp);
      transition = { from, to };
      nextAction = to === 'approved' ? 'merge-gate' : 'continue';
      appendTransition(runtimeDir, task, from, to, {
        eventId, actor: 'orchestrator', reason: event.payload?.summary || `${event.kind} consumed`, evidence: [`thread:${event.threadId}`],
      });
    } else if (TERMINAL_OR_PAUSED.includes(task.state)) {
      nextAction = 'terminal-noop';
    }
    task.consumedEventIds ||= [];
    task.consumedEventIds.push(eventId);
    task.cursor = event.payload?.cursor || eventId;
    task.threadCursors ||= {};
    task.threadCursors[event.threadId] = task.cursor;
    task.lastEventId = eventId;
    task.updatedAt = now();
    return { result: 'consumed', eventId, taskId: task.taskId, transition, nextAction };
  });
}

export function setVerdict(taskId, verdict, runtimeDir = RUNTIME_DIR) {
  return updateRegistry(runtimeDir, (registry) => {
    const task = taskById(registry, taskId);
    const code = verdict.code || null;
    const runtime = verdict.runtime || null;
    const delivery = verdict.delivery || null;
    if (code && !VERDICT_CODES.includes(code)) throw controlError('INVALID_VERDICT', `code 只接受 ${VERDICT_CODES.join('|')}`);
    if (runtime && !RUNTIME_VERDICTS.includes(runtime)) throw controlError('INVALID_VERDICT', `runtime 只接受 ${RUNTIME_VERDICTS.join('|')}`);
    if (delivery && !DELIVERY_VERDICTS.includes(delivery)) throw controlError('INVALID_VERDICT', `delivery 只接受 ${DELIVERY_VERDICTS.join('|')}`);
    if (task.verdict.runtime === 'NOT_RUN' && runtime === 'PASS') {
      throw controlError('RUNTIME_EVIDENCE_IMMUTABLE', 'runtime=NOT_RUN 不得改写为 PASS；必须保留真实证据状态');
    }
    const effective = {
      code: code ?? task.verdict.code,
      runtime: runtime ?? task.verdict.runtime,
      delivery: delivery ?? task.verdict.delivery,
    };
    assertEffectiveVerdict(task, effective);
    task.verdict = effective;
    task.updatedAt = now();
    return { result: 'verdict-set', taskId, verdict: task.verdict };
  });
}

export function recordBlock(taskId, options, runtimeDir = RUNTIME_DIR) {
  const commit = String(requireValue(options, 'commit'));
  const eventId = options['event-id'] || eventIdFor(taskId, 'verdict', { verdict: 'BLOCK', commit });
  const findingPath = options['finding-file'] ? resolve(options['finding-file']) : null;
  const finding = findingPath && existsSync(findingPath) ? readFileSync(findingPath, 'utf8') : '未提供 finding 文件';
  return updateRegistry(runtimeDir, (registry) => {
    const task = taskById(registry, taskId);
    const event = readJsonLines(inboxPath(runtimeDir)).find((candidate) => candidate.eventId === eventId);
    const result = applyBlockRecord(registry, runtimeDir, task, event, {
      commit, finding, findingPath,
    });
    const { transition, ...publicResult } = result;
    return publicResult;
  });
}

export function evaluateStop({ write = false } = {}, runtimeDir = RUNTIME_DIR) {
  return withRuntimeLock(runtimeDir, () => {
    const registry = readRegistry(runtimeDir);
    const latest = new Map();
    for (const task of Object.values(registry.tasks)) {
      if (task.role === 'reviewer') continue;
      const current = latest.get(task.worktree);
      if (!current || task.generation > current.generation || String(task.updatedAt) > String(current.updatedAt)) latest.set(task.worktree, task);
    }
    const lanes = {};
    const advanceable = [];
    for (const [worktree, task] of latest) {
      if (task.agent === 'test' || /(^|-)test$/i.test(worktree)) {
        lanes[shortWorker(worktree)] = 'excluded';
        continue;
      }
      lanes[shortWorker(worktree)] = task.state;
      if (!TERMINAL_OR_PAUSED.includes(task.state)) advanceable.push({ worktree, taskId: task.taskId, state: task.state });
    }
    const snapshot = readJson(join(runtimeDir, 'status.json'), null);
    for (const worker of snapshot?.worktrees || []) {
      const workerId = canonicalWorktreeId(worker.name);
      if (workerId === 'test') {
        lanes[workerId] ||= 'excluded';
        continue;
      }
      if (!latest.has(workerId)) {
        lanes[workerId] = 'unregistered';
        advanceable.push({ worktree: workerId, taskId: null, state: 'unregistered' });
      }
    }
    if (!Object.keys(lanes).some((key) => lanes[key] !== 'excluded')) advanceable.push({ worktree: null, taskId: null, state: 'no-registered-lanes' });
    if (advanceable.length) return { result: 'advanceable', lanes, advanceable, exitCode: 1 };
    const timestamp = now();
    if (write) {
      registry.orchestration = {
        state: 'stopped', reason: 'no-advanceable-lane', recordedAt: registry.orchestration.recordedAt || timestamp, evaluatedAt: timestamp,
      };
      writeJsonAtomic(join(runtimeDir, 'registry.json'), registry);
    }
    return { result: 'stopped', reason: 'no-advanceable-lane', lanes, written: write };
  });
}

export function registerFallbackDispatch({ worktree, taskId, agent, prompt, fallbackAuthorized = null }, runtimeDir = RUNTIME_DIR) {
  const issueMatch = String(prompt).match(/#(\d{1,6})/);
  return createTask({
    issue: issueMatch ? Number(issueMatch[1]) : 0,
    worktree,
    role: 'executor',
    agent,
    'task-id': taskId,
    model: 'luna-max',
    'routing-reason': agent === 'test' ? 'test fixture' : 'explicit cli-fallback authorization',
    'fallback-authorized': fallbackAuthorized,
  }, runtimeDir);
}

export function markFallbackStarted(taskId, pid, runtimeDir = RUNTIME_DIR) {
  return transitionTask(taskId, 'executing', { actor: 'dispatch-wrapper', reason: `spawned pid ${pid}` }, runtimeDir);
}

export function completeFallbackDispatch(taskId, { exitCode, preflightFailure = false, error = null }, runtimeDir = RUNTIME_DIR) {
  return updateRegistry(runtimeDir, (registry) => {
    const task = taskById(registry, taskId);
    const from = task.state;
    if (TERMINAL_OR_PAUSED.includes(from)) return { result: 'already-terminal', taskId, state: from };
    const safePreflightFailure = Boolean(preflightFailure && from === 'dispatching');
    const timestamp = now();
    task.state = 'parked';
    task.phase = exitCode === 0 ? 'awaiting-orchestrator-inspection' : 'cli-fallback-failed';
    task.verdict.delivery = 'PARKED';
    task.nextAction = exitCode === 0 ? 'inspect fallback output before further delivery action' : `inspect failed fallback exit ${exitCode}`;
    task.retryable = safePreflightFailure;
    task.error = error ? String(error).slice(0, 300) : task.error || null;
    task.updatedAt = timestamp;
    applyTaskTiming(task, from, task.state, timestamp);
    // test 与尚未启动 agent 的 preflight failure 都未留下 writer，释放租约；真实已启动 fallback 继续保护现场。
    if ((task.agent === 'test' || safePreflightFailure) && registry.leases[task.worktree]?.owner === taskId) delete registry.leases[task.worktree];
    appendTransition(runtimeDir, task, from, 'parked', { actor: 'dispatch-wrapper', reason: task.nextAction });
    return { result: 'parked', taskId, state: task.state };
  });
}

function parseArguments(argv) {
  const options = {};
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) positional.push(value);
    else {
      const key = value.slice(2);
      if (['write', 'requires-runtime'].includes(key)) options[key] = true;
      else options[key] = argv[++index];
    }
  }
  return { options, positional };
}

async function resolveExistingWorktree(value) {
  const requested = canonicalWorktreeId(value);
  const { siblings } = await listWorktrees();
  const matches = siblings.filter((entry) => canonicalWorktreeId(basename(entry.path)) === requested);
  if (matches.length !== 1) {
    throw controlError('UNKNOWN_WORKTREE', `worktree "${value}" 不在同级既有列表中`, {
      requested, available: siblings.map((entry) => basename(entry.path)),
    });
  }
  return canonicalWorktreeId(basename(matches[0].path));
}

export async function main(argv = process.argv.slice(2), runtimeDir = RUNTIME_DIR) {
  const { options, positional } = parseArguments(argv);
  const [command, action] = positional;
  if (command === 'task' && action === 'create') {
    const hasDesktopIdentity = options['thread-id'] || options['client-thread-id'];
    if (!hasDesktopIdentity && options.agent !== 'test' && !options['fallback-authorized']) {
      throw controlError('FALLBACK_AUTH_REQUIRED', 'cli-fallback 需显式授权：加 --fallback-authorized "<用户原话>"；正常路径是 Desktop create_thread。');
    }
    options.worktree = await resolveExistingWorktree(requireValue(options, 'worktree'));
    return createTask(options, runtimeDir);
  }
  if (command === 'task' && action === 'heartbeat') return heartbeatTask(requireValue(options, 'task'), runtimeDir);
  if (command === 'task' && action === 'attach-thread') return attachTaskThread(requireValue(options, 'task'), options, runtimeDir);
  if (command === 'transition') return transitionTask(requireValue(options, 'task'), requireValue(options, 'to'), {
    reason: options.reason || null, actor: options.actor || 'orchestrator', eventId: options['event-id'] || null,
    phase: options.phase, nextAction: options['next-action'], commitSha: options.commit,
    mergeCommit: options['merge-commit'], reviewTaskId: options['review-task'], source: 'cli',
  }, runtimeDir);
  if (command === 'inbox' && action === 'put') return putInboxEvent(options, runtimeDir);
  if (command === 'inbox' && action === 'pending') return pendingInbox(runtimeDir);
  if (command === 'consume') return consumeEvent(requireValue(options, 'event-id'), runtimeDir);
  if (command === 'verdict' && action === 'set') return setVerdict(requireValue(options, 'task'), {
    code: options.code, runtime: options.runtime, delivery: options.delivery,
  }, runtimeDir);
  if (command === 'block' && action === 'record') return recordBlock(requireValue(options, 'task'), options, runtimeDir);
  if (command === 'stop' && action === 'eval') return evaluateStop({ write: Boolean(options.write) }, runtimeDir);
  throw controlError('BAD_REQUEST', '用法: orchestrate.mjs task create|task heartbeat|task attach-thread|inbox put|inbox pending|consume|transition|verdict set|block record|stop eval');
}

if (resolve(process.argv[1] || '') === resolve(fileURLToPath(import.meta.url))) {
  try {
    const result = await main();
    const exitCode = result.exitCode || 0;
    if (Object.hasOwn(result, 'exitCode')) delete result.exitCode;
    console.log(JSON.stringify(result));
    process.exitCode = exitCode;
  } catch (error) {
    console.error(JSON.stringify({ result: 'error', code: error.code || 'INTERNAL', message: error.message, ...(error.details || {}) }));
    process.exitCode = error.exitCode || 1;
  }
}
