#!/usr/bin/env node
// 可恢复控制平面的单一 CLI：Task Registry、事件 inbox、状态机、三维 verdict、
// BLOCK 熔断和全局停止。宿主 create_thread/wait_threads 仍由主 agent 调用，本脚本只登记事实。
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listWorktrees, resolveWorktreeTarget, RUNTIME_DIR } from './collect.mjs';
import { HEADLESS_CHILD_OPTIONS } from './headless.mjs';
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
export const EXECUTOR_FINAL_SCHEMA = 'aes.worktree-board.executor-final/v1';
export const GOAL_SCHEMA = 'aes.worktree-board.goal/v1';
export const GOAL_EXECUTION_MODES = Object.freeze(['continuous', 'one-task-per-worker']);
export const ACTION_TYPES = Object.freeze([
  'UNCLASSIFIED_FINAL', 'CREATE_REVIEWER', 'RETURN_TO_EXECUTOR', 'EVALUATE_MERGE_GATE',
  'HOST_MERGE', 'POST_MERGE_VERIFY', 'CLAIM_NEXT_ISSUE', 'WAIT_THREADS', 'STOP',
]);
const ACTION_RECEIPT_STATUSES = Object.freeze(['started', 'succeeded', 'failed', 'observed']);

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
const CLI_MERGE_GATE = Symbol('cli-merge-gate');
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
function stableDigest(value) {
  return createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

function actionId(type, identity) {
  return `A-${type.toLowerCase().replaceAll('_', '-')}-${stableDigest(identity)}`;
}

function labelNames(issue) {
  return (issue?.labels || []).map((label) => typeof label === 'string' ? label : label?.name).filter(Boolean);
}

function workerInGoalScope(registry, worktree) {
  return registry.goal?.state !== 'active'
    || registry.goal.workers.some((candidate) => canonicalWorktreeId(candidate) === canonicalWorktreeId(worktree));
}

function eligibleAutonomousIssues(status) {
  return (status?.graph?.issues || [])
    .filter((issue) => {
      const labels = labelNames(issue);
      return issue.state === 'OPEN' && issue.derived?.status === 'frontier'
        && labels.includes('ready-for-agent')
        && !labels.some((label) => ['ready-for-human', 'needs-info', 'needs-triage', 'wontfix'].includes(label));
    })
    .sort((left, right) => left.number - right.number);
}

function runGit(cwd, args, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, {
    ...HEADLESS_CHILD_OPTIONS, cwd, encoding: 'utf8', timeout: 30_000,
  });
  if (!allowFailure && result.status !== 0) {
    throw controlError('GIT_RECONCILIATION_FAILED', `git ${args.join(' ')} 失败 (exit ${result.status}): ${String(result.stderr || result.stdout).trim().slice(0, 300)}`);
  }
  return {
    status: result.status,
    stdout: String(result.stdout || '').replace(/\r\n/g, '\n').trim(),
    stderr: String(result.stderr || '').replace(/\r\n/g, '\n').trim(),
  };
}

function gitValue(cwd, args) {
  return runGit(cwd, args).stdout;
}

function resolveCommitObject(cwd, commitSha, errorCode = 'GIT_COMMIT_REQUIRED') {
  const result = runGit(cwd, ['rev-parse', '--verify', `${commitSha}^{commit}`], { allowFailure: true });
  if (result.status !== 0 || !result.stdout) {
    throw controlError(errorCode, `${commitSha || '(空)'} 不是可解析的 Git commit object`);
  }
  return result.stdout;
}

function resolveCommitObjectIfPossible(cwd, commitSha) {
  if (!cwd || !commitSha || !existsSync(cwd)) return null;
  const result = runGit(cwd, ['rev-parse', '--verify', `${commitSha}^{commit}`], { allowFailure: true });
  return result.status === 0 && result.stdout ? result.stdout : null;
}

function compareCommitObjects(cwd, observed, registered) {
  const observedObject = resolveCommitObjectIfPossible(cwd, observed);
  const registeredObject = resolveCommitObjectIfPossible(cwd, registered);
  return {
    equal: observedObject && registeredObject ? observedObject === registeredObject : observed === registered,
    observed: observedObject || observed,
    registered: registeredObject || registered,
  };
}

function repositoryContext(runtimeDir, task) {
  const status = readJson(join(runtimeDir, 'status.json'), null);
  const repoRoot = status?.repo?.root ? resolve(status.repo.root) : null;
  const integrationBranch = status?.repo?.mainBranch || null;
  const worker = (status?.worktrees || []).find((candidate) => canonicalWorktreeId(candidate.name) === task.worktree);
  const worktreePath = worker?.path ? resolve(worker.path) : null;
  if (!repoRoot || !integrationBranch || !worktreePath || !existsSync(repoRoot) || !existsSync(worktreePath)) {
    throw controlError('FRESH_GIT_STATUS_REQUIRED', `Task ${task.taskId} 缺少可读取的 fresh repo/worktree status`, {
      repoRoot, integrationBranch, worktreePath,
    });
  }
  return { status, repoRoot, integrationBranch, worker, worktreePath };
}

function reconcileRecoveryFollowUp(runtimeDir, task, submittedCommit) {
  const context = repositoryContext(runtimeDir, task);
  const followUpCommit = resolveCommitObject(context.worktreePath, submittedCommit, 'RECOVERY_COMMIT_NOT_FOUND');
  const workerHead = resolveCommitObject(context.worktreePath, 'HEAD');
  const blockedCommit = resolveCommitObject(
    context.worktreePath, task.recovery.requiresNewCommitFrom, 'RECOVERY_BLOCKED_COMMIT_NOT_FOUND',
  );
  if (followUpCommit !== workerHead) {
    throw controlError('RECOVERY_HEAD_MISMATCH', `recovery follow-up ${followUpCommit} 必须等于原 executor worktree live HEAD ${workerHead}`);
  }
  if (followUpCommit === blockedCommit) {
    throw controlError('FOLLOW_UP_COMMIT_REQUIRED', `handoff recovery 后必须产生不同于 blocked commit ${blockedCommit} 的新 commit`);
  }
  const descendant = runGit(context.worktreePath, ['merge-base', '--is-ancestor', blockedCommit, followUpCommit], { allowFailure: true });
  if (descendant.status !== 0) {
    throw controlError('RECOVERY_DESCENDANT_REQUIRED', `${followUpCommit} 必须是 blocked commit ${blockedCommit} 的新 descendant`);
  }
  return { followUpCommit, workerHead, blockedCommit };
}

function assertCleanMergeCandidate(context, commitSha) {
  const result = runGit(context.repoRoot, ['merge-tree', '--write-tree', context.integrationBranch, commitSha], { allowFailure: true });
  if (result.status !== 0) {
    throw controlError('MERGE_CHECK_FAILED', `commit ${commitSha} 与 ${context.integrationBranch} 的 live merge-tree 非 clean`, {
      stderr: result.stderr.slice(0, 300),
    });
  }
}

function reconcileMergeGate(runtimeDir, task, action, payload) {
  const context = repositoryContext(runtimeDir, task);
  const workerHead = resolveCommitObject(context.worktreePath, 'HEAD');
  const reviewedCommit = resolveCommitObject(context.worktreePath, task.commitSha, 'REVIEWED_COMMIT_NOT_FOUND');
  const integrationHead = resolveCommitObject(context.repoRoot, context.integrationBranch);
  const receiptWorkerHead = resolveCommitObject(context.worktreePath, payload.headSha, 'RECEIPT_WORKER_HEAD_NOT_FOUND');
  const receiptIntegrationHead = resolveCommitObject(context.repoRoot, payload.integrationHead, 'RECEIPT_INTEGRATION_HEAD_NOT_FOUND');
  if (resolveCommitObject(context.worktreePath, action.commitSha, 'ACTION_COMMIT_NOT_FOUND') !== reviewedCommit
    || workerHead !== reviewedCommit) {
    throw controlError('MERGE_HEAD_MISMATCH', `merge gate 必须绑定 reviewed commit ${task.commitSha}，action=${action.commitSha}，live HEAD=${workerHead}`);
  }
  if (receiptWorkerHead !== workerHead || receiptIntegrationHead !== integrationHead
    || payload.integrationBranch !== context.integrationBranch || payload.mergeCheck !== 'clean') {
    throw controlError('FRESH_MERGE_RECEIPT_REQUIRED', 'merge gate receipt 必须精确绑定 live worktree/integration HEAD、integration branch 与 mergeCheck=clean', {
      workerHead, integrationHead, integrationBranch: context.integrationBranch,
    });
  }
  assertCleanMergeCandidate(context, reviewedCommit);
  return { context, workerHead, integrationHead, reviewedCommit };
}

function assertIntegrationBranch(context) {
  const branch = gitValue(context.repoRoot, ['branch', '--show-current']);
  if (branch !== context.integrationBranch) {
    throw controlError('INTEGRATION_BRANCH_MISMATCH', `HOST_MERGE 必须在 ${context.integrationBranch} 执行，当前为 ${branch || '(detached)'}`);
  }
  return branch;
}

function verifyMergeCommit(context, task, started, payload) {
  assertIntegrationBranch(context);
  const workerHead = resolveCommitObject(context.worktreePath, 'HEAD');
  const reviewedCommit = resolveCommitObject(context.worktreePath, task.commitSha, 'REVIEWED_COMMIT_NOT_FOUND');
  if (workerHead !== reviewedCommit || started.workerHead !== reviewedCommit || started.commitSha !== task.commitSha) {
    throw controlError('WORKER_HEAD_MOVED_AFTER_REVIEW', `HOST_MERGE receipt 前 worker HEAD 必须仍为 reviewed commit ${reviewedCommit}，实际 ${workerHead}`);
  }
  const liveHead = resolveCommitObject(context.repoRoot, 'HEAD');
  const receiptPreHead = resolveCommitObject(context.repoRoot, payload.preHead, 'RECEIPT_PRE_HEAD_NOT_FOUND');
  const receiptPostHead = resolveCommitObject(context.repoRoot, payload.postHead, 'RECEIPT_POST_HEAD_NOT_FOUND');
  const receiptMergeCommit = resolveCommitObject(context.repoRoot, payload.mergeCommit, 'RECEIPT_MERGE_COMMIT_NOT_FOUND');
  if (payload.integrationBranch !== context.integrationBranch
    || receiptPreHead !== started.preHead
    || receiptPostHead !== liveHead
    || receiptMergeCommit !== liveHead) {
    throw controlError('MERGE_RECEIPT_MISMATCH', 'HOST_MERGE receipt 未绑定 live integration branch/preHead/postHead', {
      integrationBranch: context.integrationBranch, preHead: started.preHead, liveHead,
    });
  }
  const parts = gitValue(context.repoRoot, ['rev-list', '--parents', '-n', '1', liveHead]).split(/\s+/);
  if (parts.length !== 3 || parts[1] !== started.preHead || parts[2] !== reviewedCommit) {
    throw controlError('TRUE_TWO_PARENT_MERGE_REQUIRED', `${liveHead} 必须恰为 commit + 两个 parent，第一父为 ${started.preHead}，第二父为 reviewed commit ${reviewedCommit}`);
  }
  const ancestor = runGit(context.repoRoot, ['merge-base', '--is-ancestor', reviewedCommit, liveHead], { allowFailure: true });
  if (ancestor.status !== 0) throw controlError('MERGED_COMMIT_NOT_INCLUDED', `merge commit ${liveHead} 未包含 executor commit ${task.commitSha}`);
  return liveHead;
}

function validateExecutorFinal(payload) {
  const errors = [];
  if (payload?.schemaVersion !== EXECUTOR_FINAL_SCHEMA) errors.push(`schemaVersion 必须为 ${EXECUTOR_FINAL_SCHEMA}`);
  if (payload?.outcome !== 'COMMITTED') errors.push('outcome 必须为 COMMITTED');
  if (typeof payload?.commitSha !== 'string' || !payload.commitSha.trim()) errors.push('commitSha 必须为非空字符串');
  if (typeof payload?.tests?.summary !== 'string' || !payload.tests.summary.trim()) errors.push('tests.summary 必须为非空字符串');
  if (!Array.isArray(payload?.tests?.commands)) errors.push('tests.commands 必须为数组');
  if (Array.isArray(payload?.tests?.commands)) {
    for (const [index, command] of payload.tests.commands.entries()) {
      if (typeof command?.command !== 'string' || !command.command.trim() || !Number.isInteger(command?.exitCode)) {
        errors.push(`tests.commands[${index}] 必须包含 command 与整数 exitCode`);
      } else if (command.exitCode !== 0) {
        errors.push(`COMMITTED final 的 tests.commands[${index}].exitCode 必须为 0`);
      }
    }
  }
  for (const field of ['unexecuted', 'manualTestDebt']) {
    if (!Array.isArray(payload?.[field])) errors.push(`${field} 必须为数组`);
    else for (const [index, item] of payload[field].entries()) {
      if (typeof item?.scope !== 'string' || !item.scope.trim() || typeof item?.reason !== 'string' || !item.reason.trim()) {
        errors.push(`${field}[${index}] 必须包含非空 scope 与 reason`);
      }
    }
  }
  if (payload?.suggestedNextState !== 'committed') errors.push('suggestedNextState 必须为 committed');
  if (Array.isArray(payload?.tests?.commands) && payload.tests.commands.length === 0
    && Array.isArray(payload?.unexecuted) && payload.unexecuted.length === 0) {
    errors.push('tests.commands 与 unexecuted 不得同时为空');
  }
  return { ok: errors.length === 0, errors };
}
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
function deadLettersPath(runtimeDir) { return join(runtimeDir, 'dead-letters.jsonl'); }
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

function appendTransition(runtimeDir, task, from, to, {
  eventId = null, actor = 'orchestrator', source = 'internal', reason = null, evidence = [],
} = {}) {
  appendJsonLineAtomic(transitionsPath(runtimeDir), {
    ts: now(), taskId: task.taskId, from, to, eventId, actor, source, reason, evidence,
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

function successfulTaskAction(registry, type, task, predicate = () => true, statuses = ['succeeded']) {
  return Object.values(registry.actions).find((action) => action.type === type && action.taskId === task.taskId
    && predicate(action) && statuses.includes(registry.actionReceipts[action.actionId]?.latestStatus));
}

function assertTransitionEvidence(registry, task, to, candidate) {
  if (['committed', 'reviewing', 'approved', 'merge-ready', 'merged'].includes(to) && !candidate.commitSha) {
    throw controlError('COMMIT_EVIDENCE_REQUIRED', `${to} 要求 commitSha`);
  }
  if (['committed', 'reviewing', 'approved', 'merge-ready', 'merged'].includes(to)) {
    const finalEvidence = candidate.executorFinalEvidence;
    if (finalEvidence?.schemaVersion !== EXECUTOR_FINAL_SCHEMA || finalEvidence.outcome !== 'COMMITTED'
      || finalEvidence.commitSha !== candidate.commitSha || !finalEvidence.eventId) {
      throw controlError('EXECUTOR_FINAL_EVIDENCE_REQUIRED', `${to} 要求与当前 commit 绑定的 ${EXECUTOR_FINAL_SCHEMA}`);
    }
  }
  if (['reviewing', 'approved', 'merge-ready', 'merged'].includes(to)) {
    const reviewer = candidate.reviewTaskId ? registry.tasks[candidate.reviewTaskId] : null;
    const createAction = successfulTaskAction(registry, 'CREATE_REVIEWER', task, (action) => (
      action.commitSha === candidate.commitSha && action.parentTaskId === task.taskId
    ));
    if (!reviewer || reviewer.role !== 'reviewer' || reviewer.parentTaskId !== task.taskId
      || reviewer.worktree !== task.worktree || reviewer.reviewCommit !== candidate.commitSha
      || !createAction) {
      throw controlError('CREATE_REVIEWER_RECEIPT_REQUIRED', `${to} 要求 reviewer.reviewCommit 与当前 commit 一致且 CREATE_REVIEWER receipt=succeeded`);
    }
  }
  if (['approved', 'merge-ready', 'merged'].includes(to)) {
    const evidence = candidate.reviewEvidence || null;
    const reviewer = evidence?.reviewTaskId ? registry.tasks[evidence.reviewTaskId] : null;
    if (!evidence?.eventId || evidence.verdict !== 'APPROVE'
      || evidence.commitSha !== candidate.commitSha
      || !reviewer || reviewer.role !== 'reviewer'
      || reviewer.parentTaskId !== task.taskId || reviewer.worktree !== task.worktree
      || reviewer.reviewCommit !== candidate.commitSha) {
      throw controlError('REVIEW_EVIDENCE_REQUIRED', `${to} 要求与当前 commit 绑定的独立 reviewer APPROVE 事件`);
    }
    if (candidate.verdict.code !== 'PASS') throw controlError('CODE_REVIEW_REQUIRED', `${to} 要求 code=PASS`);
  }
  if (['merge-ready', 'merged'].includes(to)) {
    if (candidate.verdict.delivery !== 'MERGE_READY') throw controlError('DELIVERY_VERDICT_REQUIRED', `${to} 要求 delivery=MERGE_READY`);
    assertEffectiveVerdict(task, candidate.verdict);
    const gateAction = successfulTaskAction(registry, 'EVALUATE_MERGE_GATE', task, (action) => action.commitSha === candidate.commitSha);
    if (!gateAction || candidate.mergeGateReceipt?.actionId !== gateAction.actionId
      || candidate.mergeGateReceipt.commitSha !== candidate.commitSha) {
      throw controlError('MERGE_GATE_RECEIPT_REQUIRED', `${to} 要求绑定当前 commit 的 EVALUATE_MERGE_GATE receipt`);
    }
  }
  if (to === 'merged' && !candidate.mergeCommit) {
    throw controlError('MERGE_COMMIT_REQUIRED', 'merged 要求 mergeCommit');
  }
  if (to === 'merged') {
    const mergeAction = successfulTaskAction(registry, 'HOST_MERGE', task, (action) => action.commitSha === candidate.commitSha, ['succeeded', 'observed']);
    const postAction = successfulTaskAction(registry, 'POST_MERGE_VERIFY', task, (action) => action.mergeCommit === candidate.mergeCommit);
    const verification = candidate.postMergeVerification;
    const run = verification?.verificationRunId ? registry.verificationRuns[verification.verificationRunId] : null;
    if (!mergeAction || candidate.hostMergeReceipt?.actionId !== mergeAction.actionId
      || candidate.hostMergeReceipt.mergeCommit !== candidate.mergeCommit
      || !postAction || verification?.actionId !== postAction.actionId
      || !run || run.status !== 'passed' || run.actionId !== postAction.actionId
      || run.mergeCommit !== candidate.mergeCommit) {
      throw controlError('POST_MERGE_RECEIPT_REQUIRED', 'merged 要求真实 HOST_MERGE receipt 与 passed verificationRun 绑定的 POST_MERGE_VERIFY receipt');
    }
  }
}

function nextActionForState(task) {
  if (task.state === 'merged') return 'CLAIM_NEXT_ISSUE';
  if (task.state === 'parked') return 'PARKED';
  if (task.state === 'handoff-required') return 'HANDOFF_REQUIRED';
  if (task.state === 'committed') return 'CREATE_REVIEWER';
  if (task.state === 'approved') return 'EVALUATE_MERGE_GATE';
  if (task.state === 'merge-ready') return task.hostMergeReceipt ? 'POST_MERGE_VERIFY' : 'HOST_MERGE';
  return 'WAIT_THREADS';
}

function resolvePendingUnclassifiedFinals(registry, task, resolution) {
  task.consumedEventIds ||= [];
  let resolved = 0;
  for (const record of Object.values(registry.unclassifiedFinals)) {
    if (record.taskId !== task.taskId || record.status !== 'pending') continue;
    record.status = 'resolved';
    record.resolution = resolution;
    record.resolvedAt = now();
    if (!task.consumedEventIds.includes(record.eventId)) task.consumedEventIds.push(record.eventId);
    resolved += 1;
  }
  delete task.unclassifiedFinal;
  if (resolved > 0) task.nextAction = nextActionForState(task);
  return resolved;
}

function applyTransition(registry, runtimeDir, task, to, details = {}) {
  const from = task.state;
  assertTransition(from, to);
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
  task.lastProgressAt = timestamp;
  applyTaskTiming(task, from, to, timestamp);
  task.nextAction = nextActionForState({ ...task, state: to });
  if (details.commitSha) task.commitSha = details.commitSha;
  if (details.mergeCommit) task.mergeCommit = details.mergeCommit;
  if (details.reviewTaskId) task.reviewTaskId = details.reviewTaskId;
  if (to === 'merged' && registry.leases[task.worktree]?.owner === task.taskId) delete registry.leases[task.worktree];
  if (['parked', 'handoff-required'].includes(to)) resolvePendingUnclassifiedFinals(registry, task, `lane-${to}`);
  appendTransition(runtimeDir, task, from, to, details);
  refreshOrchestrationProjection(registry, runtimeDir);
  return { from, to };
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
    const issueSnapshot = readJson(join(runtimeDir, 'status.json'), null)?.graph?.issues?.find((candidate) => candidate.number === issue);
    const issueLabels = labelNames(issueSnapshot);
    const requestedInteractionClass = options['interaction-class'] || options.interactionClass || null;
    if (issueLabels.includes('needs-manual-test') && requestedInteractionClass && requestedInteractionClass !== 'needs-manual-test') {
      throw controlError('INTERACTION_CLASS_CONFLICT', `Issue #${issue} 带 needs-manual-test，不能覆盖为 ${requestedInteractionClass}`);
    }
    const interactionClass = issueLabels.includes('needs-manual-test')
      ? 'needs-manual-test'
      : requestedInteractionClass || 'autonomous';
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
      const existingReviewer = Object.values(registry.tasks).find((task) => task.role === 'reviewer'
        && task.parentTaskId === parentTaskId && task.reviewCommit === parent.commitSha);
      if (existingReviewer) {
        throw controlError('REVIEW_ALREADY_REGISTERED', `${parentTaskId} 的 commit ${parent.commitSha} 已登记 reviewer ${existingReviewer.taskId}`, {
          reviewerTaskId: existingReviewer.taskId, threadId: existingReviewer.threadId,
        });
      }
      generation = parent.generation;
      const ordinal = Object.values(registry.tasks).filter((task) => task.parentTaskId === parentTaskId && task.role === 'reviewer').length + 1;
      taskId = options['task-id'] || options.taskId || `${parentTaskId}-review-${ordinal}`;
    } else {
      const existingIssueTask = Object.values(registry.tasks).find((candidate) => candidate.role === 'executor'
        && candidate.issue === issue && candidate.worktree !== worktree && candidate.state !== 'merged');
      if (existingIssueTask) {
        throw controlError('ISSUE_ALREADY_ACTIVE', `Issue #${issue} 已由 ${existingIssueTask.worktree} 的 ${existingIssueTask.taskId} 占用`, {
          taskId: existingIssueTask.taskId, worktree: existingIssueTask.worktree, state: existingIssueTask.state,
        });
      }
      const previous = latestExecutorForWorktree(registry, worktree);
      if (previous && previous.agent !== 'test' && ['parked', 'handoff-required'].includes(previous.state) && !previous.retryable) {
        throw controlError('LANE_CLOSED', `${worktree} 当前为 ${previous.state}，禁止后续派发`, { taskId: previous.taskId });
      }
      if (existingLease) {
        throw controlError('LOCKED', `${worktree} 已由 ${existingLease.owner} 持有租约`, {
          worktree, leaseOwner: existingLease.owner, acquiredAt: existingLease.acquiredAt,
        });
      }
      const reservation = registry.claimReservations[String(issue)];
      if (reservation && reservation.worktree !== worktree && ['pending', 'succeeded'].includes(reservation.status)) {
        throw controlError('ISSUE_CLAIM_RESERVED', `Issue #${issue} 已由 ${reservation.worktree} 的 ${reservation.actionId} 保留`, reservation);
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
      reviewCommit: role === 'reviewer' ? registry.tasks[parentTaskId].commitSha : null,
      state: 'dispatching', phase: options.phase || 'dispatching',
      interactionClass,
      modelTier, routingReason, cursor: null, lastEventId: null, consumedEventIds: [],
      headSha: options['head-sha'] || null, commitSha: null, mergeCommit: null,
      verdict: { code: null, runtime: null, delivery: null }, reviewTaskId: null, reviewEvidence: null,
      executorFinalEvidence: null, hostMergeReceipt: null, postMergeVerification: null,
      circuitEpoch: 0, blockCount: 0, blockLedger: [], recoveryLedger: [], lastProgressAt: timestamp,
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
    refreshOrchestrationProjection(registry, runtimeDir);
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
    refreshOrchestrationProjection(registry, runtimeDir);
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

function transitionTaskInternal(taskId, to, details = {}, runtimeDir = RUNTIME_DIR, capability = null) {
  return updateRegistry(runtimeDir, (registry) => {
    const task = taskById(registry, taskId);
    if (to === 'merged' && capability !== CLI_MERGE_GATE) {
      throw controlError('MERGE_GATE_REQUIRED', 'merged 只能由主 agent 在 merge gate 后通过 CLI --merge-commit 登记');
    }
    if (to === 'merged' && !details.mergeCommit) {
      throw controlError('MERGE_GATE_REQUIRED', 'merged 只能由主 agent 在 merge gate 后通过 CLI --merge-commit 登记');
    }
    if (to === 'merged' && (details.actor || 'orchestrator') !== 'orchestrator') {
      throw controlError('MERGE_GATE_REQUIRED', '只有 orchestrator 主 agent 可以登记 merged');
    }
    const transition = applyTransition(registry, runtimeDir, task, to, {
      ...details,
      actor: details.actor || 'orchestrator',
      source: capability === CLI_MERGE_GATE ? 'cli' : 'internal',
    });
    return { result: 'transitioned', taskId, ...transition, nextAction: task.nextAction };
  });
}

export function transitionTask(taskId, to, details = {}, runtimeDir = RUNTIME_DIR) {
  return transitionTaskInternal(taskId, to, details, runtimeDir);
}

function transitionTaskFromCli(taskId, to, details = {}, runtimeDir = RUNTIME_DIR) {
  return transitionTaskInternal(taskId, to, details, runtimeDir, CLI_MERGE_GATE);
}

export function releaseParkedLane(taskId, options, runtimeDir = RUNTIME_DIR) {
  const authorizationId = String(requireValue(options, 'authorization-id')).trim();
  const authorization = String(requireValue(options, 'authorization')).trim();
  const reason = String(requireValue(options, 'reason')).trim();
  if (!authorizationId || !authorization || !reason) {
    throw controlError('HUMAN_AUTHORIZATION_REQUIRED', 'task release 要求非空 authorization-id、authorization 与 reason');
  }
  const authorizationDigest = stableDigest(authorization);
  const releaseId = `LR-${stableDigest([taskId, authorizationId])}`;
  return updateRegistry(runtimeDir, (registry) => {
    const task = taskById(registry, taskId);
    const existing = task.laneRelease || null;
    if (existing) {
      if (existing.authorizationId !== authorizationId || existing.authorizationDigest !== authorizationDigest) {
        throw controlError('AUTHORIZATION_CONFLICT', `authorization-id ${authorizationId} 已绑定不同 lane release 授权`);
      }
      refreshOrchestrationProjection(registry, runtimeDir);
      return { result: 'already-released', taskId, releaseId: existing.releaseId, state: task.state, release: existing };
    }
    if (task.role !== 'executor' || task.state !== 'parked') {
      throw controlError('LANE_RELEASE_NOT_ALLOWED', `${taskId} 当前为 ${task.state}，只有 parked executor 可释放 lane`);
    }
    if (registry.leases[task.worktree]?.owner !== task.taskId) {
      throw controlError('LANE_LEASE_REQUIRED', `${taskId} 释放前必须仍持有 ${task.worktree} writer lease`);
    }
    const relatedActive = Object.values(registry.tasks).filter((candidate) => (
      candidate.taskId !== task.taskId
      && (candidate.parentTaskId === task.taskId || candidate.taskId === task.reviewTaskId)
      && !TERMINAL_OR_PAUSED.includes(candidate.state)
    ));
    if (relatedActive.length) {
      throw controlError('RELATED_TASK_ACTIVE', `${taskId} 仍有 reviewer/关联 Task 活跃，不能释放 writer lease`, {
        taskIds: relatedActive.map((candidate) => candidate.taskId),
      });
    }
    const context = repositoryContext(runtimeDir, task);
    const dirty = runGit(context.worktreePath, ['status', '--porcelain']).stdout;
    if (dirty) {
      throw controlError('DIRTY_WORKTREE_REQUIRES_DECISION', `${task.worktree} 仍有未提交修改，不能释放 writer lease`, {
        worktree: task.worktree, status: dirty.slice(0, 1000),
      });
    }
    const timestamp = now();
    const releasedHead = resolveCommitObject(context.worktreePath, 'HEAD', 'LANE_HEAD_REQUIRED');
    const release = {
      schemaVersion: 'aes.worktree-board.lane-release/v1', releaseId, taskId,
      worktree: task.worktree, issue: task.issue, generation: task.generation,
      releasedHead, authorizationId, authorizationDigest, authorization, reason, releasedAt: timestamp,
    };
    task.laneRelease = release;
    task.laneAvailable = true;
    task.retryable = true;
    task.nextAction = 'CLAIM_NEXT_ISSUE';
    task.updatedAt = timestamp;
    task.lastProgressAt = timestamp;
    delete registry.leases[task.worktree];
    appendTransition(runtimeDir, task, 'parked', 'parked', {
      actor: 'orchestrator', source: 'cli', reason: `explicit parked lane release ${authorizationId}`,
      evidence: [`release:${releaseId}`, `authorization:${authorizationId}`, `releasedHead:${releasedHead}`],
    });
    refreshOrchestrationProjection(registry, runtimeDir);
    return { result: 'released', taskId, releaseId, state: task.state, worktree: task.worktree, releasedHead, release };
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
  const rejected = new Set(Object.keys(registry.deadLetters));
  const unique = new Map();
  for (const event of readJsonLines(inboxPath(runtimeDir))) {
    if (!consumed.has(event.eventId) && !rejected.has(event.eventId) && !unique.has(event.eventId)) unique.set(event.eventId, event);
  }
  const cursors = {};
  for (const task of Object.values(registry.tasks)) {
    if (task.threadId && task.cursor) cursors[task.threadId] = task.cursor;
    for (const [threadId, cursor] of Object.entries(task.threadCursors || {})) cursors[threadId] = cursor;
  }
  return { pending: [...unique.values()], cursors, orchestration: registry.orchestration.state };
}

export function rejectInboxEvent(eventId, options, runtimeDir = RUNTIME_DIR) {
  const reason = String(requireValue(options, 'reason')).trim();
  const replacementEventId = String(requireValue(options, 'replacement-event-id')).trim();
  const authorizationId = String(requireValue(options, 'authorization-id')).trim();
  const authorization = String(requireValue(options, 'authorization')).trim();
  if (reason !== 'SUPERSEDED_REVIEW_BINDING') {
    throw controlError('REJECT_REASON_NOT_ALLOWED', 'inbox reject 只允许 SUPERSEDED_REVIEW_BINDING，禁止任意吞掉合法事件');
  }
  const authorizationDigest = stableDigest(authorization);
  return updateRegistry(runtimeDir, (registry) => {
    const events = readJsonLines(inboxPath(runtimeDir));
    const event = events.find((candidate) => candidate.eventId === eventId);
    const replacement = events.find((candidate) => candidate.eventId === replacementEventId);
    if (!event) throw controlError('UNKNOWN_EVENT', `未知 eventId: ${eventId}`);
    if (!replacement) throw controlError('UNKNOWN_REPLACEMENT_EVENT', `未知 replacement eventId: ${replacementEventId}`);
    const eventDigest = stableDigest(event);
    const existing = registry.deadLetters[eventId];
    if (existing) {
      if (existing.reason !== reason || existing.replacementEventId !== replacementEventId
        || existing.authorizationId !== authorizationId || existing.authorizationDigest !== authorizationDigest
        || existing.eventDigest !== eventDigest) {
        throw controlError('DEAD_LETTER_CONFLICT', `${eventId} 已绑定不同 dead-letter receipt`);
      }
      refreshOrchestrationProjection(registry, runtimeDir);
      return { result: 'already-rejected', eventId, deadLetter: existing };
    }
    const eventTask = taskById(registry, event.taskId);
    const replacementTask = taskById(registry, replacement.taskId);
    const misboundReviewer = eventTask.role === 'reviewer'
      && eventTask.taskId === event.sourceTaskId
      && replacementTask.role === 'executor'
      && eventTask.parentTaskId === replacementTask.taskId
      && eventTask.issue === replacementTask.issue
      && eventTask.worktree === replacementTask.worktree;
    const task = misboundReviewer ? replacementTask : eventTask;
    const consumed = new Set(task.consumedEventIds || []);
    if (consumed.has(eventId)) throw controlError('EVENT_ALREADY_CONSUMED', `${eventId} 已消费，不能 dead-letter`);
    if (!consumed.has(replacementEventId)) {
      throw controlError('CONSUMED_REPLACEMENT_REQUIRED', `${replacementEventId} 必须已由同 Task 合法消费`);
    }
    const reviewer = registry.tasks[event.sourceTaskId];
    const originalVerdict = String(event.payload?.verdict || '').toUpperCase();
    const replacementVerdict = String(replacement.payload?.verdict || '').toUpperCase();
    if ((!misboundReviewer && event.taskId !== replacement.taskId) || event.sourceTaskId !== replacement.sourceTaskId
      || event.threadId !== replacement.threadId || !['final', 'verdict'].includes(event.kind)
      || !['final', 'verdict'].includes(replacement.kind) || !['APPROVE', 'PASS', 'BLOCK'].includes(originalVerdict)
      || originalVerdict !== replacementVerdict || String(replacement.receivedAt) <= String(event.receivedAt)
      || !reviewer || reviewer.role !== 'reviewer' || reviewer.parentTaskId !== task.taskId) {
      throw controlError('INVALID_SUPERSEDED_REVIEW_BINDING', 'dead-letter 只接受同 reviewer/thread/verdict 的较早无效绑定，且必须有较晚已消费 replacement');
    }
    if (replacement.payload?.commitSha !== task.commitSha || reviewer.reviewCommit !== task.commitSha
      || (!misboundReviewer && event.payload?.commitSha === task.commitSha)) {
      throw controlError('VALID_REVIEW_EVENT_REJECTED', 'replacement 必须精确匹配 task/reviewer commit，原事件必须因字符串绑定不匹配而无效');
    }
    const context = repositoryContext(runtimeDir, task);
    const originalCommit = resolveCommitObject(context.worktreePath, event.payload?.commitSha, 'REJECTED_COMMIT_NOT_FOUND');
    const replacementCommit = resolveCommitObject(context.worktreePath, replacement.payload?.commitSha, 'REPLACEMENT_COMMIT_NOT_FOUND');
    const taskCommit = resolveCommitObject(context.worktreePath, task.commitSha, 'TASK_COMMIT_NOT_FOUND');
    if (originalCommit !== replacementCommit || replacementCommit !== taskCommit) {
      throw controlError('REPLACEMENT_GIT_OBJECT_MISMATCH', '原事件、replacement 与 Task 必须解析到同一 Git commit object');
    }
    const deadLetter = {
      schemaVersion: 'aes.worktree-board.dead-letter/v1', eventId, replacementEventId,
      taskId: task.taskId, reviewerTaskId: reviewer.taskId, threadId: event.threadId,
      reason, canonicalCommit: taskCommit, eventDigest, authorizationId, authorizationDigest,
      authorization, rejectedAt: now(),
    };
    registry.deadLetters[eventId] = deadLetter;
    appendJsonLineAtomic(deadLettersPath(runtimeDir), deadLetter);
    refreshOrchestrationProjection(registry, runtimeDir);
    return { result: 'rejected', eventId, deadLetter };
  });
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
    || reviewer.reviewCommit !== task.commitSha || reviewer.reviewCommit !== commit
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

function markReviewerVerdict(registry, runtimeDir, reviewer, event, verdict) {
  if (!reviewer || reviewer.role !== 'reviewer') {
    throw controlError('REVIEWER_TASK_REQUIRED', '最终 reviewer verdict 必须绑定 reviewer Task');
  }
  const normalizedVerdict = String(verdict || event.payload?.verdict || '').toUpperCase();
  if (!['APPROVE', 'PASS', 'BLOCK'].includes(normalizedVerdict)) {
    throw controlError('INVALID_REVIEWER_VERDICT', `reviewer verdict 非法: ${normalizedVerdict || '(空)'}`);
  }
  const code = normalizedVerdict === 'BLOCK' ? 'BLOCK' : 'PASS';
  const runtime = RUNTIME_VERDICTS.includes(event.payload?.runtime)
    ? event.payload.runtime
    : reviewer.verdict?.runtime || null;
  reviewer.verdict = { ...reviewer.verdict, code, runtime, delivery: 'PARKED' };
  reviewer.reviewVerdictEvidence = {
    schemaVersion: 'aes.worktree-board.reviewer-verdict/v1',
    eventId: event.eventId, threadId: event.threadId, commitSha: event.payload?.commitSha || reviewer.reviewCommit,
    verdict: normalizedVerdict, recordedAt: now(),
  };
  reviewer.cursor = event.payload?.cursor || event.eventId;
  reviewer.threadCursors ||= {};
  reviewer.threadCursors[event.threadId] = reviewer.cursor;
  reviewer.lastEventId = event.eventId;
  if (TERMINAL_OR_PAUSED.includes(reviewer.state)) {
    reviewer.updatedAt = now();
    return { result: 'already-terminal', transition: null };
  }
  const from = reviewer.state;
  const transition = applyTransition(registry, runtimeDir, reviewer, 'parked', {
    actor: 'orchestrator', source: 'event', phase: 'qa-complete', eventId: event.eventId,
    reason: `reviewer final ${normalizedVerdict} 已由父 executor Task 消费`,
    evidence: [`thread:${event.threadId}`, `parent:${reviewer.parentTaskId}`],
  });
  return { result: 'parked', transition: { from, to: transition.to } };
}

function applyBlockRecord(registry, runtimeDir, task, event, { commit, finding, findingPath = null }) {
  const reviewer = validateBlockEvent(registry, task, event, commit);
  task.blockLedger ||= [];
  task.circuitEpoch ||= 0;
  if (task.state === 'handoff-required' || task.blockCount >= 3) {
    throw controlError('CIRCUIT_OPEN', `${task.taskId} 已熔断，禁止继续记录或派发`);
  }
  const duplicateVerdict = task.blockLedger.some((entry) => entry.commit === commit && entry.verdict === 'BLOCK');
  if (task.state !== 'reviewing' && !duplicateVerdict) {
    throw controlError('INVALID_BLOCK_STATE', `最终 reviewer BLOCK 只能在 reviewing 记录，当前为 ${task.state}`);
  }
  markReviewerVerdict(registry, runtimeDir, reviewer, event, 'BLOCK');
  consumeRecordedEvent(task, event);
  if (duplicateVerdict) {
    refreshOrchestrationProjection(registry, runtimeDir);
    return { result: 'duplicate-verdict', blockCount: task.blockCount, state: task.state, transition: null };
  }
  task.blockLedger.push({
    commit, verdict: 'BLOCK', eventId: event.eventId, reviewTaskId: reviewer.taskId,
    circuitEpoch: task.circuitEpoch, at: now(),
  });
  task.blockCount = task.blockLedger.filter((entry) => Number(entry.circuitEpoch || 0) === task.circuitEpoch).length;
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
    refreshOrchestrationProjection(registry, runtimeDir);
    return { result: 'recorded', blockCount: task.blockCount, state: task.state, transition: { from, to: 'fixing' } };
  }
  task.state = 'handoff-required';
  applyTaskTiming(task, from, task.state, timestamp);
  resolvePendingUnclassifiedFinals(registry, task, 'lane-handoff-required');
  task.phase = 'awaiting-human';
  task.nextAction = `人工交接，见 runtime/handoff/${task.taskId}.md`;
  const handoffPath = join(runtimeDir, 'handoff', `${task.taskId}.md`);
  const orchestrateScript = fileURLToPath(import.meta.url);
  writeTextAtomic(handoffPath, `# Handoff: ${task.taskId}\n\n- Issue: #${task.issue}\n- Worktree: ${task.worktree}\n- HEAD/follow-up commit: ${commit}\n- circuitEpoch: ${task.circuitEpoch}\n- blockCount: ${task.blockCount}\n- runtime evidence: ${task.verdict.runtime || 'NOT_RUN (未记录)'}\n- Current state: handoff-required\n\n## Final reviewer finding\n\n${finding}\n\n## Resume conditions\n\n人工明确授权后，使用受审计命令恢复同一 Task：\n\n    node "${orchestrateScript}" handoff recover --task ${task.taskId} --authorization-id <decision-id> --authorization "<用户授权原文>"\n\n不得手改 registry、不得创建新 fix Task。恢复后必须由原 executor 产生不同于 ${commit} 的新 follow-up commit，才能重新 review。\n`);
  appendTransition(runtimeDir, task, from, 'handoff-required', {
    eventId: event.eventId, actor: 'orchestrator', reason: 'third final BLOCK on a new follow-up commit',
    evidence: [findingPath || `thread:${event.threadId}`],
  });
  refreshOrchestrationProjection(registry, runtimeDir);
  return {
    result: 'circuit-broken', blockCount: task.blockCount, state: task.state,
    handoffBundle: handoffPath, transition: { from, to: 'handoff-required' },
  };
}

function consumeExecutorFinal(registry, runtimeDir, task, event, sourceTask) {
  if (sourceTask.role !== 'executor' || sourceTask.taskId !== task.taskId || event.kind !== 'final') return null;
  const validation = validateExecutorFinal(event.payload);
  if (!validation.ok) {
    const record = registry.unclassifiedFinals[event.eventId] || {
      eventId: event.eventId,
      taskId: task.taskId,
      threadId: event.threadId,
      receivedAt: event.receivedAt,
      firstObservedAt: now(),
      summary: event.payload?.summary || null,
      errors: validation.errors,
      status: 'pending',
    };
    registry.unclassifiedFinals[event.eventId] = record;
    task.unclassifiedFinal = record;
    task.nextAction = 'UNCLASSIFIED_FINAL';
    task.updatedAt = now();
    if (['parked', 'handoff-required'].includes(task.state)) {
      resolvePendingUnclassifiedFinals(registry, task, `lane-${task.state}`);
      consumeRecordedEvent(task, event);
      refreshOrchestrationProjection(registry, runtimeDir);
      return {
        result: 'consumed', eventId: event.eventId, taskId: task.taskId,
        transition: null, nextAction: 'terminal-noop', resolution: `lane-${task.state}`,
      };
    }
    refreshOrchestrationProjection(registry, runtimeDir);
    return {
      result: 'unclassified-final', eventId: event.eventId, taskId: task.taskId,
      code: 'UNCLASSIFIED_FINAL', errors: validation.errors, consumed: false, nextAction: 'UNCLASSIFIED_FINAL',
    };
  }
  if (TERMINAL_OR_PAUSED.includes(task.state)) {
    if (task.commitSha && event.payload.commitSha !== task.commitSha) {
      throw controlError('EXECUTOR_FINAL_COMMIT_MISMATCH', `terminal Task 当前 commit ${task.commitSha} 与 replacement final ${event.payload.commitSha} 不一致`);
    }
    resolvePendingUnclassifiedFinals(registry, task, `replacement-typed-final:${event.eventId}`);
    consumeRecordedEvent(task, event);
    task.updatedAt = now();
    refreshOrchestrationProjection(registry, runtimeDir);
    return { result: 'consumed', eventId: event.eventId, taskId: task.taskId, transition: null, nextAction: 'terminal-noop' };
  }
  if (!['dispatching', 'executing', 'self-qa', 'committed'].includes(task.state)) {
    throw controlError('INVALID_EXECUTOR_FINAL_STATE', `executor final 不能从 ${task.state} 推进`, { taskId: task.taskId });
  }
  const finalCommitSha = task.recovery?.requiresNewCommit
    ? reconcileRecoveryFollowUp(runtimeDir, task, event.payload.commitSha).followUpCommit
    : event.payload.commitSha;
  if (task.commitSha && task.state === 'committed' && task.commitSha !== event.payload.commitSha) {
    throw controlError('EXECUTOR_FINAL_COMMIT_MISMATCH', `Task 当前 commit ${task.commitSha} 与 final ${event.payload.commitSha} 不一致`);
  }
  task.executorFinalEvidence = {
    schemaVersion: event.payload.schemaVersion,
    eventId: event.eventId,
    threadId: event.threadId,
    outcome: event.payload.outcome,
    commitSha: finalCommitSha,
    tests: event.payload.tests,
    unexecuted: event.payload.unexecuted,
    manualTestDebt: event.payload.manualTestDebt,
    recordedAt: now(),
  };
  resolvePendingUnclassifiedFinals(registry, task, `replacement-typed-final:${event.eventId}`);
  const transitions = [];
  const path = task.state === 'dispatching'
    ? ['executing', 'self-qa', 'committed']
    : task.state === 'executing'
      ? ['self-qa', 'committed']
      : task.state === 'self-qa' ? ['committed'] : [];
  for (const to of path) {
    transitions.push(applyTransition(registry, runtimeDir, task, to, {
      actor: 'executor-final', eventId: event.eventId,
      reason: `typed executor final ${event.payload.schemaVersion}`,
      commitSha: to === 'committed' ? finalCommitSha : undefined,
      evidence: [`thread:${event.threadId}`, `event:${event.eventId}`],
    }));
  }
  task.commitSha = finalCommitSha;
  task.headSha = finalCommitSha;
  if (task.recovery?.requiresNewCommit) {
    task.recovery.requiresNewCommit = false;
    task.recovery.resumedCommit = finalCommitSha;
    task.recovery.resumedAt = now();
  }
  task.nextAction = 'CREATE_REVIEWER';
  consumeRecordedEvent(task, event);
  task.updatedAt = now();
  refreshOrchestrationProjection(registry, runtimeDir);
  return {
    result: 'consumed', eventId: event.eventId, taskId: task.taskId,
    transition: transitions.at(-1) || null, transitions, nextAction: 'CREATE_REVIEWER',
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
    const executorFinal = consumeExecutorFinal(registry, runtimeDir, task, event, sourceTask);
    if (executorFinal) return executorFinal;
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
        if (!reviewedCommit || reviewedCommit !== task.commitSha || sourceTask.reviewCommit !== task.commitSha) {
          throw controlError('REVIEW_COMMIT_MISMATCH', `reviewer APPROVE 必须绑定当前 commit ${task.commitSha || '(未记录)'}`);
        }
        task.verdict.code = 'PASS';
        task.reviewTaskId = sourceTask.taskId;
        task.reviewEvidence = {
          reviewTaskId: sourceTask.taskId, eventId, threadId: event.threadId,
          commitSha: reviewedCommit, verdict: 'APPROVE', recordedAt: now(),
        };
        markReviewerVerdict(registry, runtimeDir, sourceTask, event, 'APPROVE');
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
      task.nextAction = nextActionForState(task);
      applyTaskTiming(task, from, to, transitionTimestamp);
      transition = { from, to };
      nextAction = to === 'approved' ? 'merge-gate' : 'continue';
      appendTransition(runtimeDir, task, from, to, {
        eventId, actor: 'orchestrator', source: 'event', reason: event.payload?.summary || `${event.kind} consumed`, evidence: [`thread:${event.threadId}`],
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
    refreshOrchestrationProjection(registry, runtimeDir);
    return { result: 'consumed', eventId, taskId: task.taskId, transition, nextAction };
  });
}

export function reconcileReviewerTask(taskId, runtimeDir = RUNTIME_DIR) {
  return updateRegistry(runtimeDir, (registry) => {
    const reviewer = taskById(registry, taskId);
    if (reviewer.role !== 'reviewer' || !reviewer.parentTaskId) {
      throw controlError('REVIEWER_TASK_REQUIRED', `${taskId} 不是具有关联父 executor 的 reviewer Task`);
    }
    const parent = taskById(registry, reviewer.parentTaskId);
    const approval = parent.reviewEvidence?.reviewTaskId === reviewer.taskId
      ? parent.reviewEvidence : null;
    const block = (parent.blockLedger || []).find((entry) => entry.reviewTaskId === reviewer.taskId);
    const evidence = approval || block;
    const expectedVerdict = approval ? 'APPROVE' : block ? 'BLOCK' : null;
    if (!evidence || !expectedVerdict) {
      throw controlError('REVIEWER_RECONCILIATION_EVIDENCE_REQUIRED', `${taskId} 缺少父 executor 已消费的最终 reviewer 证据`);
    }
    if (approval && !['approved', 'merge-ready', 'merged'].includes(parent.state)) {
      throw controlError('REVIEWER_RECONCILIATION_PARENT_STATE', `${taskId} 的 APPROVE 证据要求父 Task 已进入 approved/merge-ready/merged`);
    }
    if (block && !['fixing', 'handoff-required'].includes(parent.state)) {
      throw controlError('REVIEWER_RECONCILIATION_PARENT_STATE', `${taskId} 的 BLOCK 证据要求父 Task 已进入 fixing/handoff-required`);
    }
    const event = readJsonLines(inboxPath(runtimeDir)).find((candidate) => candidate.eventId === evidence.eventId);
    if (!event || !parent.consumedEventIds?.includes(event.eventId)) {
      throw controlError('REVIEWER_RECONCILIATION_EVENT_REQUIRED', `${taskId} 的最终 verdict event 尚未由父 Task 消费`);
    }
    const sourceTask = assertThreadTaskRelationship(registry, parent, event.threadId);
    if (sourceTask.taskId !== reviewer.taskId || !['final', 'verdict'].includes(event.kind)
      || String(event.payload?.verdict || '').toUpperCase() !== expectedVerdict
      || event.payload?.commitSha !== reviewer.reviewCommit) {
      throw controlError('REVIEWER_RECONCILIATION_BINDING', `${taskId} 的父证据、reviewer thread、verdict 和 commit 未精确绑定`);
    }
    const marked = markReviewerVerdict(registry, runtimeDir, reviewer, event, expectedVerdict);
    refreshOrchestrationProjection(registry, runtimeDir);
    return { result: marked.result === 'already-terminal' ? 'already-reconciled' : 'reconciled', taskId, state: reviewer.state, verdict: reviewer.verdict, transition: marked.transition };
  });
}

export function setVerdict(taskId, verdict, runtimeDir = RUNTIME_DIR) {
  return updateRegistry(runtimeDir, (registry) => {
    const task = taskById(registry, taskId);
    if (['approved', 'merge-ready', 'merged'].includes(task.state)) {
      throw controlError('VERDICT_LOCKED_AFTER_REVIEW', `Task ${taskId} 已到 ${task.state}，verdict 只能由绑定 receipt 的动作保持，不得用旧入口改写`);
    }
    const code = verdict.code || null;
    const runtime = verdict.runtime || null;
    const delivery = verdict.delivery || null;
    if (code && !VERDICT_CODES.includes(code)) throw controlError('INVALID_VERDICT', `code 只接受 ${VERDICT_CODES.join('|')}`);
    if (runtime && !RUNTIME_VERDICTS.includes(runtime)) throw controlError('INVALID_VERDICT', `runtime 只接受 ${RUNTIME_VERDICTS.join('|')}`);
    if (delivery && !DELIVERY_VERDICTS.includes(delivery)) throw controlError('INVALID_VERDICT', `delivery 只接受 ${DELIVERY_VERDICTS.join('|')}`);
    if (delivery === 'MERGE_READY') {
      throw controlError('MERGE_GATE_RECEIPT_REQUIRED', '旧 verdict set 不得写 delivery=MERGE_READY；只能由 EVALUATE_MERGE_GATE succeeded receipt 原子写入');
    }
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
    refreshOrchestrationProjection(registry, runtimeDir);
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

export function recoverHandoff(taskId, options, runtimeDir = RUNTIME_DIR) {
  const authorizationId = String(requireValue(options, 'authorization-id')).trim();
  const authorization = String(requireValue(options, 'authorization')).trim();
  if (!authorizationId || !authorization) throw controlError('HUMAN_AUTHORIZATION_REQUIRED', 'handoff recover 要求非空 authorization-id 与用户授权原文');
  const authorizationDigest = stableDigest(authorization);
  const recoveryId = `HR-${stableDigest([taskId, authorizationId])}`;
  return updateRegistry(runtimeDir, (registry) => {
    const task = taskById(registry, taskId);
    task.recoveryLedger ||= [];
    const existing = task.recoveryLedger.find((entry) => entry.authorizationId === authorizationId);
    if (existing) {
      if (existing.authorizationDigest !== authorizationDigest) {
        throw controlError('AUTHORIZATION_CONFLICT', `authorization-id ${authorizationId} 已绑定不同授权原文`);
      }
      refreshOrchestrationProjection(registry, runtimeDir);
      return { result: 'already-recovered', taskId, recoveryId: existing.recoveryId, state: task.state, recovery: existing };
    }
    if (task.role !== 'executor' || task.state !== 'handoff-required') {
      throw controlError('HANDOFF_RECOVERY_NOT_ALLOWED', `${taskId} 当前为 ${task.state}，只有 handoff-required executor 可由人工授权恢复`);
    }
    if (registry.leases[task.worktree]?.owner !== task.taskId) {
      throw controlError('HANDOFF_LEASE_REQUIRED', `${taskId} 恢复前必须仍持有 ${task.worktree} writer lease`);
    }
    const timestamp = now();
    const blockedCommit = task.commitSha;
    const from = task.state;
    const recovery = {
      schemaVersion: 'aes.worktree-board.handoff-recovery/v1', recoveryId, authorizationId,
      authorizationDigest, authorization, blockedCommit, fromCircuitEpoch: Number(task.circuitEpoch || 0),
      toCircuitEpoch: Number(task.circuitEpoch || 0) + 1, authorizedAt: timestamp,
    };
    task.recoveryLedger.push(recovery);
    task.circuitEpoch = recovery.toCircuitEpoch;
    task.blockCount = 0;
    task.state = 'executing';
    task.phase = 'human-authorized-recovery';
    task.nextAction = 'WAIT_THREADS';
    task.startedAt = timestamp;
    task.finishedAt = null;
    task.updatedAt = timestamp;
    task.lastProgressAt = timestamp;
    task.retryable = false;
    task.commitSha = null;
    task.executorFinalEvidence = null;
    task.reviewTaskId = null;
    task.reviewEvidence = null;
    task.mergeCommit = null;
    task.mergeGateReceipt = null;
    task.hostMergeStarted = null;
    task.hostMergeReceipt = null;
    task.postMergeVerification = null;
    task.verdict = { code: null, runtime: null, delivery: null };
    task.recovery = {
      recoveryId, authorizationId, requiresNewCommitFrom: blockedCommit,
      requiresNewCommit: true, recoveredAt: timestamp,
    };
    const previousOrchestration = { ...registry.orchestration };
    registry.orchestration = {
      ...registry.orchestration, state: 'running', reason: 'human-authorized-handoff-recovery',
      recordedAt: null, evaluatedAt: timestamp, resumedAt: timestamp,
      lastStop: previousOrchestration.state === 'stopped'
        ? {
          reason: previousOrchestration.reason, recordedAt: previousOrchestration.recordedAt,
          evaluatedAt: previousOrchestration.evaluatedAt,
        }
        : previousOrchestration.lastStop || null,
    };
    if (registry.goal?.state === 'complete') {
      registry.goal.completionHistory ||= [];
      registry.goal.completionHistory.push({ completedAt: registry.goal.completedAt, reopenedAt: timestamp, recoveryId });
      registry.goal.state = 'active';
      registry.goal.completedAt = null;
      registry.goal.reopenedAt = timestamp;
    }
    appendTransition(runtimeDir, task, from, 'executing', {
      actor: 'human-authorized-recovery', reason: `authorized recovery ${authorizationId}`,
      evidence: [`recovery:${recoveryId}`, `authorization:${authorizationId}`, `authorization-digest:${authorizationDigest}`],
    });
    refreshOrchestrationProjection(registry, runtimeDir);
    return { result: 'recovered', taskId, recoveryId, state: task.state, circuitEpoch: task.circuitEpoch, recovery };
  });
}

function latestExecutors(registry) {
  const latest = new Map();
  for (const task of Object.values(registry.tasks)) {
    if (task.role !== 'executor') continue;
    const current = latest.get(task.worktree);
    if (!current || task.generation > current.generation
      || (task.generation === current.generation && String(task.updatedAt) > String(current.updatedAt))) {
      latest.set(task.worktree, task);
    }
  }
  return latest;
}

function receiptSucceeded(registry, id) {
  return registry.actionReceipts[id]?.latestStatus === 'succeeded';
}

function typedAction(type, identity, details = {}) {
  if (!ACTION_TYPES.includes(type)) throw controlError('INVALID_ACTION_TYPE', `未知 action type: ${type}`);
  return { schemaVersion: 'aes.worktree-board.next-action/v1', actionId: actionId(type, identity), type, ...details };
}

function deriveActionCandidates(registry, runtimeDir, status) {
  const actions = [];
  const consumed = new Set(Object.values(registry.tasks).flatMap((task) => task.consumedEventIds || []));
  const rejected = new Set(Object.keys(registry.deadLetters));
  const pendingEvents = readJsonLines(inboxPath(runtimeDir)).filter((event, index, all) => (
    !consumed.has(event.eventId)
    && !rejected.has(event.eventId)
    && workerInGoalScope(registry, registry.tasks[event.taskId]?.worktree)
    && all.findIndex((candidate) => candidate.eventId === event.eventId) === index
  ));
  for (const record of Object.values(registry.unclassifiedFinals).filter((entry) => entry.status === 'pending'
    && workerInGoalScope(registry, registry.tasks[entry.taskId]?.worktree))) {
    actions.push(typedAction('UNCLASSIFIED_FINAL', [record.eventId, record.taskId], {
      taskId: record.taskId, eventId: record.eventId, threadId: record.threadId,
      reason: 'executor final 未通过版本化 schema，事件保持 pending 且未推进 cursor', errors: record.errors,
    }));
  }

  const latest = latestExecutors(registry);
  const realLatest = [...latest.values()].filter((task) => task.agent !== 'test' && task.worktree !== 'test'
    && workerInGoalScope(registry, task.worktree));
  const qaOnly = (registry.goal?.executionMode || 'continuous') === 'one-task-per-worker';
  for (const task of realLatest.sort((left, right) => left.taskId.localeCompare(right.taskId))) {
    const workerSnapshot = (status?.worktrees || []).find((worker) => canonicalWorktreeId(worker.name) === task.worktree);
    const headComparison = workerSnapshot?.head && task.headSha
      ? compareCommitObjects(workerSnapshot.path ? resolve(workerSnapshot.path) : null, workerSnapshot.head, task.headSha)
      : null;
    if (['dispatching', 'executing', 'self-qa', 'fixing'].includes(task.state)
      && headComparison && !headComparison.equal
      && !task.executorFinalEvidence) {
      actions.push(typedAction('UNCLASSIFIED_FINAL', ['git-reconcile', task.taskId, headComparison.observed], {
        taskId: task.taskId, worktree: task.worktree, observedHead: headComparison.observed,
        registeredHead: headComparison.registered, reason: 'GIT_HEAD_ADVANCED_WITHOUT_TYPED_FINAL',
      }));
    }
    if (task.state === 'committed') {
      const existingReviewer = Object.values(registry.tasks).find((candidate) => candidate.role === 'reviewer'
        && candidate.parentTaskId === task.taskId && candidate.reviewCommit === task.commitSha);
      const action = typedAction('CREATE_REVIEWER', [task.taskId, task.commitSha], {
        taskId: task.taskId, worktree: task.worktree, issue: task.issue, commitSha: task.commitSha,
        parentTaskId: task.taskId, modelTier: 'luna-max', existingReviewerTaskId: existingReviewer?.taskId || null,
        reason: existingReviewer
          ? 'reviewer 已登记但 receipt 未完成；恢复时复用现有 Task，禁止重复创建'
          : qaOnly ? 'executor typed final 已 committed，需独立 aes-qa 验证；不执行 code-review/simplify'
            : 'executor typed final 已 committed，需独立 code/spec review',
      });
      if (!receiptSucceeded(registry, action.actionId)) actions.push(action);
    } else if (task.state === 'fixing') {
      const action = typedAction('RETURN_TO_EXECUTOR', [task.taskId, task.blockCount, task.commitSha], {
        taskId: task.taskId, worktree: task.worktree, issue: task.issue, threadId: task.threadId,
        blockCount: task.blockCount, commitSha: task.commitSha, reason: 'reviewer BLOCK，回原 executor 修复并产生新 commit',
      });
      if (!receiptSucceeded(registry, action.actionId)) actions.push(action);
    } else if (task.state === 'approved') {
      const workerSnapshot = (status?.worktrees || []).find((worker) => canonicalWorktreeId(worker.name) === task.worktree);
      const action = typedAction('EVALUATE_MERGE_GATE', [task.taskId, task.commitSha], {
        taskId: task.taskId, worktree: task.worktree, issue: task.issue, commitSha: task.commitSha,
        observedHead: workerSnapshot?.head || null, mergeCheck: workerSnapshot?.mergeCheck || null,
        reviewEvidence: task.reviewEvidence, reason: 'reviewer APPROVE，fresh Git/registry/verdict evidence 缺一不可',
      });
      if (!receiptSucceeded(registry, action.actionId)) actions.push(action);
    }
  }

  const mergeInFlight = realLatest.find((task) => task.state === 'merge-ready' && task.hostMergeReceipt && !task.postMergeVerification);
  const startedMergeAction = Object.values(registry.actions).find((action) => action.type === 'HOST_MERGE'
    && registry.actionReceipts[action.actionId]?.latestStatus === 'started'
    && workerInGoalScope(registry, registry.tasks[action.taskId]?.worktree));
  if (mergeInFlight) {
    const action = typedAction('POST_MERGE_VERIFY', [mergeInFlight.taskId, mergeInFlight.hostMergeReceipt.mergeCommit], {
      taskId: mergeInFlight.taskId, worktree: mergeInFlight.worktree, issue: mergeInFlight.issue,
      mergeCommit: mergeInFlight.hostMergeReceipt.mergeCommit,
      reason: 'HOST_MERGE 已登记，必须在 integration branch 复验后才可 merged',
    });
    if (!receiptSucceeded(registry, action.actionId)) actions.push(action);
  } else if (startedMergeAction) {
    actions.push({ ...startedMergeAction, resume: true, reason: 'root 重启时恢复唯一 integration merge mutex 持有者' });
  } else {
    const mergeQueue = realLatest
      .filter((task) => task.state === 'merge-ready' && !task.hostMergeReceipt)
      .sort((left, right) => String(left.updatedAt).localeCompare(String(right.updatedAt)) || left.taskId.localeCompare(right.taskId));
    const task = mergeQueue[0];
    if (task) {
      const action = typedAction('HOST_MERGE', [task.taskId, task.commitSha, status?.repo?.mainBranch || 'integration'], {
        taskId: task.taskId, worktree: task.worktree, issue: task.issue, commitSha: task.commitSha,
        integrationBranch: status?.repo?.mainBranch || null, queuePosition: 1, queueLength: mergeQueue.length,
        reason: 'integration merge mutex 只发出队首 HOST_MERGE；worker 不得自行 merge',
      });
      if (!receiptSucceeded(registry, action.actionId)) actions.push(action);
    }
  }

  const claimedIssues = new Set(Object.values(registry.tasks)
    .filter((task) => task.role === 'executor')
    .map((task) => task.issue));
  const reservedIssues = new Set();
  const reservedWorkers = new Set();
  for (const reservation of Object.values(registry.claimReservations)) {
    if (!['pending', 'succeeded'].includes(reservation.status)) continue;
    reservedIssues.add(reservation.issue);
    reservedWorkers.add(reservation.worktree);
    if (reservation.status === 'pending') {
      const existingAction = registry.actions[reservation.actionId];
      if (existingAction && workerInGoalScope(registry, reservation.worktree)
        && !receiptSucceeded(registry, existingAction.actionId)) {
        actions.push({ ...existingAction, resume: true, reason: 'root 重启恢复既有 Issue claim reservation；禁止跨 worker 重复认领' });
      }
    }
  }
  const eligible = eligibleAutonomousIssues(status)
    .filter((issue) => !claimedIssues.has(issue.number) && !reservedIssues.has(issue.number));
  let issueIndex = 0;
  if ((registry.goal?.executionMode || 'continuous') === 'continuous') {
    const initialWorkers = (registry.goal?.workers || []).map((worktree) => canonicalWorktreeId(worktree))
      .filter((worktree) => !latest.has(worktree))
      .map((worktree) => ({ taskId: null, worktree, issue: null, generation: 0, state: 'unregistered' }));
    const claimable = realLatest.filter((candidate) => candidate.state === 'merged'
      || (candidate.state === 'parked' && candidate.laneAvailable === true && !registry.leases[candidate.worktree]))
      .concat(initialWorkers)
      .filter((candidate) => !reservedWorkers.has(candidate.worktree))
      .sort((left, right) => left.worktree.localeCompare(right.worktree));
    for (const task of claimable) {
      const issue = eligible[issueIndex++];
      if (!issue) break;
      const action = typedAction('CLAIM_NEXT_ISSUE', [task.taskId || `initial:${task.worktree}`, issue.number], {
        taskId: task.taskId, worktree: task.worktree, completedIssue: task.issue, issue: issue.number,
        issueTitle: issue.title, interactionClass: labelNames(issue).includes('needs-manual-test') ? 'needs-manual-test' : 'autonomous',
        reason: 'writer 租约已释放，为同一 worker 领取最高优先级 eligible autonomous Issue',
      });
      if (!receiptSucceeded(registry, action.actionId)) actions.push(action);
    }
  }

  const blockingTypes = new Set(['UNCLASSIFIED_FINAL', 'CREATE_REVIEWER', 'RETURN_TO_EXECUTOR', 'EVALUATE_MERGE_GATE', 'HOST_MERGE', 'POST_MERGE_VERIFY', 'CLAIM_NEXT_ISSUE']);
  if (!actions.some((action) => blockingTypes.has(action.type))) {
    const waiting = realLatest.filter((task) => ['dispatching', 'executing', 'self-qa', 'reviewing'].includes(task.state));
    const needsAnotherIssue = (registry.goal?.executionMode || 'continuous') === 'continuous' && eligible.length > 0;
    if (pendingEvents.length || waiting.length || needsAnotherIssue) {
      const targets = waiting.map((task) => ({ taskId: task.taskId, threadId: task.threadId, state: task.state }));
      actions.push(typedAction('WAIT_THREADS', [targets, pendingEvents.map((event) => event.eventId)], {
        targets, pendingEventIds: pendingEvents.map((event) => event.eventId), repeatable: true,
        reason: pendingEvents.length
          ? '先 drain 全部 pending inbox，再 bounded wait'
          : needsAnotherIssue && !waiting.length
            ? 'eligible autonomous Issue 仍存在，但当前没有可领取的 writer lane'
            : 'bounded wait 后重新 reconcile',
      }));
    } else {
      const requiredWorkers = registry.goal?.state === 'active'
        ? registry.goal.workers
        : (status?.worktrees || []).map((worker) => canonicalWorktreeId(worker.name)).filter((worker) => worker !== 'test');
      const missingWorkers = requiredWorkers.filter((worker) => !latest.has(worker));
      if (missingWorkers.length) {
        actions.push(typedAction('WAIT_THREADS', ['unregistered-lanes', missingWorkers], {
          targets: missingWorkers.map((worktree) => ({ worktree, taskId: null, threadId: null, state: 'unregistered' })),
          pendingEventIds: [], repeatable: true,
          reason: 'Goal worker 尚未登记 Task，必须先领取 Issue 或显式收敛 lane',
        }));
      } else if ((!needsAnotherIssue || (registry.goal?.executionMode || 'continuous') === 'one-task-per-worker')
        && realLatest.every((task) => TERMINAL_OR_PAUSED.includes(task.state))) {
        actions.push(typedAction('STOP', [registry.goal?.goalId || 'one-shot', realLatest.map((task) => [task.taskId, task.state])], {
          reason: 'pending inbox 为空、无活动/merge/post-merge 线路、无 eligible autonomous Issue，所有 lane 均已收敛',
        }));
      }
    }
  }
  return actions;
}

function materializeActions(registry, actions) {
  for (const action of actions) {
    registry.actions[action.actionId] ||= { ...action, createdAt: now() };
    if (action.type !== 'CLAIM_NEXT_ISSUE') continue;
    const key = String(action.issue);
    const current = registry.claimReservations[key];
    if (current && current.actionId !== action.actionId && ['pending', 'succeeded'].includes(current.status)) {
      throw controlError('ISSUE_CLAIM_RESERVED', `Issue #${action.issue} 已由 ${current.actionId} 保留`, current);
    }
    registry.claimReservations[key] ||= {
      schemaVersion: 'aes.worktree-board.claim-reservation/v1', issue: action.issue,
      actionId: action.actionId, worktree: action.worktree, status: 'pending', reservedAt: now(),
    };
  }
}

function setStoppedProjection(registry) {
  registry.orchestration.goalState = registry.goal?.state || 'not-created';
  registry.orchestration.nextAction = null;
  registry.orchestration.nextActions = [];
  registry.orchestration.mergeQueue = [];
  registry.orchestration.unclassifiedFinalCount = Object.values(registry.unclassifiedFinals).filter((entry) => entry.status === 'pending').length;
  registry.orchestration.whyNotComplete = [];
}

function refreshOrchestrationProjection(registry, runtimeDir, status = readJson(join(runtimeDir, 'status.json'), null)) {
  if (registry.orchestration.state === 'stopped') {
    setStoppedProjection(registry);
    registry.orchestration.evaluatedAt = now();
    return [];
  }
  const actions = deriveActionCandidates(registry, runtimeDir, status);
  materializeActions(registry, actions);
  const mergeQueue = [...latestExecutors(registry).values()]
    .filter((task) => task.agent !== 'test' && task.worktree !== 'test' && task.state === 'merge-ready'
      && workerInGoalScope(registry, task.worktree))
    .sort((left, right) => String(left.updatedAt).localeCompare(String(right.updatedAt)) || left.taskId.localeCompare(right.taskId))
    .map((task, index) => ({
      position: index + 1, taskId: task.taskId, worktree: task.worktree, commitSha: task.commitSha,
      phase: task.hostMergeReceipt ? 'post-merge-verification' : 'awaiting-host-merge',
    }));
  registry.orchestration = {
    ...registry.orchestration,
    evaluatedAt: now(),
    goalState: registry.goal?.state || 'not-created',
    nextAction: actions[0] || null,
    nextActions: actions,
    mergeQueue,
    unclassifiedFinalCount: Object.values(registry.unclassifiedFinals).filter((entry) => entry.status === 'pending').length,
    whyNotComplete: actions.filter((action) => action.type !== 'STOP').map((action) => `${action.type}:${action.reason}`),
  };
  return actions;
}

export function nextActions(runtimeDir = RUNTIME_DIR) {
  return updateRegistry(runtimeDir, (registry) => {
    const status = readJson(join(runtimeDir, 'status.json'), null);
    const actions = refreshOrchestrationProjection(registry, runtimeDir, status);
    return { result: 'next-actions', goal: registry.goal, actions };
  });
}

function recordActionReceipt(registry, action, status, payload) {
  const digest = stableDigest({ status, payload });
  const current = registry.actionReceipts[action.actionId] || { actionId: action.actionId, type: action.type, receipts: [] };
  if (current.receipts.some((receipt) => receipt.digest === digest)) return { current, duplicate: true };
  if (current.latestStatus === 'succeeded') throw controlError('RECEIPT_ALREADY_SUCCEEDED', `${action.actionId} 已有 succeeded receipt`);
  const receipt = { receiptId: `R-${action.actionId.slice(2)}-${digest}`, status, payload, digest, recordedAt: now() };
  current.receipts.push(receipt);
  current.latestStatus = status;
  current.latestReceiptId = receipt.receiptId;
  registry.actionReceipts[action.actionId] = current;
  registry.orchestration.lastAction = { actionId: action.actionId, type: action.type, status, receiptId: receipt.receiptId, at: receipt.recordedAt };
  return { current, receipt, duplicate: false };
}

export function receiveActionReceipt(actionIdValue, status, payload = {}, runtimeDir = RUNTIME_DIR) {
  if (!ACTION_RECEIPT_STATUSES.includes(status)) throw controlError('INVALID_RECEIPT_STATUS', `status 只接受 ${ACTION_RECEIPT_STATUSES.join('|')}`);
  return updateRegistry(runtimeDir, (registry) => {
    const action = registry.actions[actionIdValue];
    if (!action) throw controlError('UNKNOWN_ACTION', `未知 action: ${actionIdValue}；先运行 next-actions`);
    const recorded = recordActionReceipt(registry, action, status, payload);
    if (recorded.duplicate) {
      refreshOrchestrationProjection(registry, runtimeDir);
      return { result: 'already-recorded', actionId: actionIdValue, receiptId: recorded.current.latestReceiptId };
    }
    if (action.type === 'HOST_MERGE' && status === 'started') {
      const other = Object.entries(registry.actionReceipts).find(([id, receipt]) => id !== actionIdValue
        && registry.actions[id]?.type === 'HOST_MERGE' && receipt.latestStatus === 'started');
      if (other) throw controlError('MERGE_MUTEX_LOCKED', `integration merge mutex 已由 ${other[0]} 持有`);
      const task = taskById(registry, action.taskId);
      assertTransitionEvidence(registry, task, 'merge-ready', { ...task, verdict: { ...task.verdict } });
      const context = repositoryContext(runtimeDir, task);
      assertIntegrationBranch(context);
      const preHead = resolveCommitObject(context.repoRoot, 'HEAD');
      const receiptPreHead = resolveCommitObject(context.repoRoot, payload.preHead, 'RECEIPT_PRE_HEAD_NOT_FOUND');
      const reviewedCommit = resolveCommitObject(context.worktreePath, task.commitSha, 'REVIEWED_COMMIT_NOT_FOUND');
      const actionCommit = resolveCommitObject(context.worktreePath, action.commitSha, 'ACTION_COMMIT_NOT_FOUND');
      const workerHead = resolveCommitObject(context.worktreePath, 'HEAD');
      if (actionCommit !== reviewedCommit || workerHead !== reviewedCommit
        || payload.integrationBranch !== context.integrationBranch || receiptPreHead !== preHead) {
        throw controlError('HOST_MERGE_START_MISMATCH', 'HOST_MERGE started receipt 必须绑定当前 task commit、integration branch 与 live preHead', {
          taskCommit: task.commitSha, reviewedCommit, workerHead, integrationBranch: context.integrationBranch, preHead,
        });
      }
      assertCleanMergeCandidate(context, reviewedCommit);
      task.hostMergeStarted = {
        actionId: action.actionId, receiptId: recorded.receipt.receiptId,
        integrationBranch: context.integrationBranch, preHead, commitSha: task.commitSha,
        reviewedCommit, workerHead, startedAt: now(),
      };
    }
    if (action.type === 'HOST_MERGE' && status === 'observed') {
      const task = taskById(registry, action.taskId);
      assertTransitionEvidence(registry, task, 'merge-ready', { ...task, verdict: { ...task.verdict } });
      const context = repositoryContext(runtimeDir, task);
      const reviewedCommit = resolveCommitObject(context.worktreePath, task.commitSha, 'REVIEWED_COMMIT_NOT_FOUND');
      const workerHead = resolveCommitObject(context.worktreePath, 'HEAD');
      const preHead = resolveCommitObject(context.repoRoot, payload.preHead, 'OBSERVED_PRE_HEAD_NOT_FOUND');
      const mergeCommit = verifyMergeCommit(context, task, {
        preHead, commitSha: task.commitSha, reviewedCommit, workerHead,
      }, {
        ...payload,
        postHead: payload.postHead || payload.mergeCommit,
        mergeCommit: payload.mergeCommit || payload.postHead,
      });
      task.hostMergeStarted = {
        actionId: action.actionId, receiptId: recorded.receipt.receiptId,
        integrationBranch: context.integrationBranch, preHead, commitSha: task.commitSha,
        reviewedCommit, workerHead, startedAt: payload.startedAt || now(), observedAt: now(),
      };
      task.mergeCommit = mergeCommit;
      task.hostMergeReceipt = {
        actionId: action.actionId, receiptId: recorded.receipt.receiptId,
        integrationBranch: context.integrationBranch, preHead,
        commitSha: task.commitSha, reviewedCommit, workerHead,
        mergeCommit, postHead: mergeCommit, observedAt: now(),
      };
    }
    if (status === 'succeeded') {
      const task = action.taskId ? taskById(registry, action.taskId) : null;
      if (action.type === 'UNCLASSIFIED_FINAL') {
        throw controlError('UNCLASSIFIED_FINAL_REQUIRES_REPLACEMENT', 'UNCLASSIFIED_FINAL 不接受任意 resolution；必须消费合法 replacement typed-final，或显式收敛到 parked/handoff-required');
      } else if (action.type === 'CREATE_REVIEWER') {
        const reviewer = taskById(registry, payload.reviewerTaskId);
        if (reviewer.role !== 'reviewer' || reviewer.parentTaskId !== task.taskId || reviewer.worktree !== task.worktree) {
          throw controlError('INVALID_REVIEW_RECEIPT', 'CREATE_REVIEWER receipt 必须绑定已登记的关联 reviewer Task');
        }
        if (action.commitSha !== task.commitSha || reviewer.reviewCommit !== task.commitSha) {
          throw controlError('REVIEW_COMMIT_MISMATCH', 'CREATE_REVIEWER receipt 必须满足 reviewer.reviewCommit === task.commitSha === action.commitSha');
        }
        if (task.state === 'committed') applyTransition(registry, runtimeDir, task, 'reviewing', {
          actor: 'action-receipt', reason: 'CREATE_REVIEWER succeeded', reviewTaskId: reviewer.taskId,
          evidence: [`action:${action.actionId}`, `reviewer:${reviewer.taskId}`],
        });
      } else if (action.type === 'RETURN_TO_EXECUTOR') {
        if (action.threadId !== task.threadId || payload.threadId !== task.threadId) {
          throw controlError('RETURN_THREAD_MISMATCH', `RETURN_TO_EXECUTOR 必须绑定原 executor thread ${task.threadId}`);
        }
        if (task.state === 'fixing') applyTransition(registry, runtimeDir, task, 'executing', {
          actor: 'action-receipt', reason: 'RETURN_TO_EXECUTOR succeeded', evidence: [`action:${action.actionId}`],
        });
      } else if (action.type === 'EVALUATE_MERGE_GATE') {
        const effective = { code: payload.code, runtime: payload.runtime, delivery: payload.delivery };
        if (effective.code !== 'PASS' || effective.delivery !== 'MERGE_READY' || !RUNTIME_VERDICTS.includes(effective.runtime)) {
          throw controlError('INVALID_MERGE_GATE_RECEIPT', 'merge gate succeeded 必须携带 code=PASS、合法 runtime、delivery=MERGE_READY');
        }
        if (task.interactionClass === 'needs-manual-test' && effective.runtime === 'NOT_RUN'
          && !(task.executorFinalEvidence?.manualTestDebt || []).length) {
          throw controlError('MANUAL_TEST_DEBT_REQUIRED', 'needs-manual-test + runtime=NOT_RUN 必须显式记录 manualTestDebt');
        }
        assertEffectiveVerdict(task, effective);
        const reconciled = reconcileMergeGate(runtimeDir, task, action, payload);
        task.verdict = effective;
        task.mergeGateReceipt = {
          actionId: action.actionId, receiptId: recorded.receipt.receiptId, commitSha: task.commitSha,
          reviewedCommit: reconciled.reviewedCommit,
          integrationBranch: reconciled.context.integrationBranch,
          workerHead: reconciled.workerHead, integrationHead: reconciled.integrationHead,
          mergeCheck: 'clean', recordedAt: now(),
        };
        applyTransition(registry, runtimeDir, task, 'merge-ready', {
          actor: 'action-receipt', reason: 'EVALUATE_MERGE_GATE succeeded', evidence: [`action:${action.actionId}`, `mergeCheck:${payload.mergeCheck}`],
        });
      } else if (action.type === 'HOST_MERGE') {
        if (!task.hostMergeStarted || task.hostMergeStarted.actionId !== action.actionId) {
          throw controlError('HOST_MERGE_START_REQUIRED', 'HOST_MERGE succeeded 前必须有同 action 的 live started receipt');
        }
        const context = repositoryContext(runtimeDir, task);
        const mergeCommit = verifyMergeCommit(context, task, task.hostMergeStarted, payload);
        task.mergeCommit = mergeCommit;
        task.hostMergeReceipt = {
          actionId: action.actionId, receiptId: recorded.receipt.receiptId,
          integrationBranch: context.integrationBranch, preHead: task.hostMergeStarted.preHead,
          commitSha: task.commitSha, reviewedCommit: task.hostMergeStarted.reviewedCommit,
          workerHead: task.hostMergeStarted.workerHead, mergeCommit, postHead: mergeCommit, mergedAt: now(),
        };
      } else if (action.type === 'POST_MERGE_VERIFY') {
        const run = registry.verificationRuns[payload.verificationRunId];
        if (!run || run.status !== 'passed' || run.actionId !== action.actionId || run.taskId !== task.taskId
          || run.mergeCommit !== action.mergeCommit || !run.results?.length) {
          throw controlError('POST_MERGE_EVIDENCE_REQUIRED', 'POST_MERGE_VERIFY succeeded 只接受 action verify 实际执行生成的 passed verificationRunId');
        }
        if (!task.hostMergeReceipt?.mergeCommit || task.hostMergeReceipt.mergeCommit !== action.mergeCommit) {
          throw controlError('MERGE_RECEIPT_MISMATCH', 'post-merge verification 必须绑定当前 HOST_MERGE receipt');
        }
        const context = repositoryContext(runtimeDir, task);
        assertIntegrationBranch(context);
        const liveHead = gitValue(context.repoRoot, ['rev-parse', 'HEAD']);
        if (liveHead !== action.mergeCommit || run.postVerificationHead !== liveHead) {
          throw controlError('POST_MERGE_HEAD_MISMATCH', 'verificationRun 与 live integration HEAD 不一致');
        }
        task.postMergeVerification = {
          actionId: action.actionId, receiptId: recorded.receipt.receiptId,
          verificationRunId: run.verificationRunId, results: run.results, recordedAt: now(),
        };
        applyTransition(registry, runtimeDir, task, 'merged', {
          actor: 'action-receipt', reason: 'POST_MERGE_VERIFY succeeded', mergeCommit: action.mergeCommit,
          evidence: [`action:${action.actionId}`, `verificationRun:${run.verificationRunId}`],
        });
      } else if (action.type === 'CLAIM_NEXT_ISSUE') {
        const nextTask = taskById(registry, payload.nextTaskId);
        if (nextTask.role !== 'executor' || nextTask.worktree !== action.worktree || nextTask.issue !== action.issue
          || (task && nextTask.generation <= task.generation)) {
          throw controlError('INVALID_CLAIM_RECEIPT', 'CLAIM_NEXT_ISSUE receipt 必须绑定同 worker、目标 Issue 的新 executor Task');
        }
        const reservation = registry.claimReservations[String(action.issue)];
        if (!reservation || reservation.actionId !== action.actionId || reservation.worktree !== action.worktree) {
          throw controlError('CLAIM_RESERVATION_REQUIRED', 'CLAIM_NEXT_ISSUE receipt 缺少同 Issue/action/worktree reservation');
        }
        reservation.status = 'succeeded';
        reservation.taskId = nextTask.taskId;
        reservation.receiptId = recorded.receipt.receiptId;
        reservation.succeededAt = now();
      } else if (action.type === 'STOP') {
        const remaining = deriveActionCandidates(registry, runtimeDir, readJson(join(runtimeDir, 'status.json'), null))
          .filter((candidate) => candidate.type !== 'STOP');
        if (remaining.length) throw controlError('STOP_CONDITION_CHANGED', 'STOP receipt 前条件已变化，必须重新 reconcile', { remaining: remaining.map((candidate) => candidate.type) });
        registry.orchestration.state = 'stopped';
        registry.orchestration.reason = 'goal-completion-conditions-satisfied';
        registry.orchestration.recordedAt ||= now();
        if (registry.goal?.state === 'active') {
          registry.goal.state = 'complete';
          registry.goal.completedAt = now();
        }
      }
    }
    if (action.type !== 'STOP' || status !== 'succeeded') refreshOrchestrationProjection(registry, runtimeDir);
    else setStoppedProjection(registry);
    return { result: 'receipt-recorded', actionId: actionIdValue, type: action.type, status, receipt: recorded.receipt };
  });
}

function normalizeVerificationCommands(commands) {
  if (!Array.isArray(commands) || !commands.length) {
    throw controlError('VERIFICATION_COMMANDS_REQUIRED', 'action verify 需要非空 commands 数组');
  }
  return commands.map((command, index) => {
    if (typeof command?.file !== 'string' || !command.file.trim()
      || !Array.isArray(command.args) || command.args.some((arg) => typeof arg !== 'string')) {
      throw controlError('INVALID_VERIFICATION_COMMAND', `commands[${index}] 必须包含 file 与字符串 args 数组`);
    }
    return {
      file: command.file,
      args: command.args,
      label: typeof command.label === 'string' && command.label.trim()
        ? command.label.trim()
        : `${command.file} ${command.args.join(' ')}`.trim(),
      timeoutMs: Math.min(600_000, Math.max(1_000, Number(command.timeoutMs) || 120_000)),
    };
  });
}

export function runPostMergeVerification(actionIdValue, commands, runtimeDir = RUNTIME_DIR) {
  const normalized = normalizeVerificationCommands(commands);
  const prepared = updateRegistry(runtimeDir, (registry) => {
    const action = registry.actions[actionIdValue];
    if (!action || action.type !== 'POST_MERGE_VERIFY') {
      throw controlError('INVALID_VERIFY_ACTION', `${actionIdValue} 不是已登记的 POST_MERGE_VERIFY action`);
    }
    const task = taskById(registry, action.taskId);
    const context = repositoryContext(runtimeDir, task);
    assertIntegrationBranch(context);
    const liveHead = gitValue(context.repoRoot, ['rev-parse', 'HEAD']);
    if (liveHead !== action.mergeCommit || task.hostMergeReceipt?.mergeCommit !== liveHead) {
      throw controlError('POST_MERGE_HEAD_MISMATCH', `action verify 必须在 live merge commit ${action.mergeCommit} 上执行`);
    }
    const verificationRunId = `V-${stableDigest([actionIdValue, action.mergeCommit, normalized])}`;
    const existing = registry.verificationRuns[verificationRunId];
    if (existing?.status === 'passed') {
      return { action, task, context, verificationRunId, alreadyPassed: true };
    }
    registry.verificationRuns[verificationRunId] = {
      schemaVersion: 'aes.worktree-board.verification-run/v1', verificationRunId,
      actionId: actionIdValue, taskId: task.taskId, mergeCommit: action.mergeCommit,
      integrationBranch: context.integrationBranch, repoRoot: context.repoRoot,
      preVerificationHead: liveHead, commands: normalized, status: 'running', startedAt: now(), results: [],
    };
    return { action, task, context, verificationRunId, alreadyPassed: false };
  });
  if (!prepared.alreadyPassed) {
    const results = [];
    for (const command of normalized) {
      const startedAt = Date.now();
      const result = spawnSync(command.file, command.args, {
        ...HEADLESS_CHILD_OPTIONS,
        cwd: prepared.context.repoRoot,
        encoding: 'utf8',
        timeout: command.timeoutMs,
      });
      const exitCode = Number.isInteger(result.status) ? result.status : 1;
      results.push({
        label: command.label, file: command.file, args: command.args, exitCode,
        durationMs: Date.now() - startedAt,
        stdoutDigest: stableDigest(String(result.stdout || '')),
        stderrDigest: stableDigest(String(result.stderr || result.error?.message || '')),
      });
      if (exitCode !== 0) break;
    }
    const completed = updateRegistry(runtimeDir, (registry) => {
      const run = registry.verificationRuns[prepared.verificationRunId];
      const task = taskById(registry, prepared.task.taskId);
      const context = repositoryContext(runtimeDir, task);
      assertIntegrationBranch(context);
      const postVerificationHead = gitValue(context.repoRoot, ['rev-parse', 'HEAD']);
      run.results = results;
      run.postVerificationHead = postVerificationHead;
      run.finishedAt = now();
      run.status = results.length === normalized.length && results.every((result) => result.exitCode === 0)
        && postVerificationHead === run.mergeCommit ? 'passed' : 'failed';
      return { status: run.status, postVerificationHead };
    });
    if (completed.status !== 'passed') {
      return {
        result: 'verification-failed', verificationRunId: prepared.verificationRunId,
        results, postVerificationHead: completed.postVerificationHead, exitCode: 1,
      };
    }
  }
  const receipt = receiveActionReceipt(actionIdValue, 'succeeded', {
    verificationRunId: prepared.verificationRunId,
  }, runtimeDir);
  return { result: 'verification-passed', verificationRunId: prepared.verificationRunId, receipt };
}

export function startGoal(options = {}, runtimeDir = RUNTIME_DIR) {
  return updateRegistry(runtimeDir, (registry) => {
    const status = readJson(join(runtimeDir, 'status.json'), null);
    if (!status?.repo?.root || !status?.repo?.mainBranch || !status?.repo?.issueRepo) {
      throw controlError('FRESH_STATUS_REQUIRED', '创建 Goal 前必须先 collect，锁定目标仓、integration branch 与 Issue repo');
    }
    const workers = String(requireValue(options, 'workers')).split(',').map((worker) => canonicalWorktreeId(worker.trim())).filter(Boolean).sort();
    const manualTestPolicy = options['manual-test-policy'] || 'needs-manual-test may merge with runtime=NOT_RUN only when debt is explicit';
    const permissions = options.permissions || 'no worktree create/delete/reset/clean; no worker merge; root host merge only';
    const executionMode = options['execution-mode'] || options.executionMode || 'continuous';
    if (!GOAL_EXECUTION_MODES.includes(executionMode)) {
      throw controlError('INVALID_GOAL_EXECUTION_MODE', `execution-mode 只接受 ${GOAL_EXECUTION_MODES.join('|')}`);
    }
    const identity = [status.repo.root, status.repo.mainBranch, status.repo.issueRepo, workers, manualTestPolicy, permissions];
    const goalId = `G-${stableDigest(identity)}`;
    if (registry.goal?.state === 'active') {
      if (registry.goal.goalId === goalId) {
        refreshOrchestrationProjection(registry, runtimeDir, status);
        return { result: 'already-active', goal: registry.goal };
      }
      throw controlError('GOAL_ALREADY_ACTIVE', `已有 active Goal ${registry.goal.goalId}`);
    }
    const timestamp = now();
    registry.goal = {
      schemaVersion: GOAL_SCHEMA, goalId, state: 'active', createdAt: timestamp,
      targetRepo: status.repo.root, integrationBranch: status.repo.mainBranch, issueRepo: status.repo.issueRepo,
      workers, manualTestPolicy, permissions, executionMode,
      objective: [
        `Outcome: 持续编排 ${workers.join(', ')} 的 executor final -> independent review -> serial ${status.repo.mainBranch} merge -> post-merge verification -> next eligible Issue。`,
        `Constraints: ${permissions}; manual policy: ${manualTestPolicy}.`,
        'Verification: fresh registry + inbox + Git + Issue frontier 同时证明 pending=0、无活动/merge/post-merge 线路、无 eligible autonomous Issue、全部 lane 收敛后才 complete。',
      ].join('\n'),
      completionCriteria: [
        'pending inbox empty', 'no active/reviewing/fixing/merge-ready/post-merge lane',
        'no eligible autonomous Issue', 'all lanes merged|parked|handoff-required',
      ],
    };
    registry.orchestration.state = 'running';
    registry.orchestration.reason = 'explicit-goal-active';
    registry.orchestration.goalState = 'active';
    refreshOrchestrationProjection(registry, runtimeDir, status);
    return { result: 'goal-started', goal: registry.goal };
  });
}

export function setGoalExecutionMode(mode, options, runtimeDir = RUNTIME_DIR) {
  const executionMode = String(mode || '').trim();
  const authorizationId = String(requireValue(options, 'authorization-id')).trim();
  const authorization = String(requireValue(options, 'authorization')).trim();
  const reason = String(requireValue(options, 'reason')).trim();
  if (!GOAL_EXECUTION_MODES.includes(executionMode)) {
    throw controlError('INVALID_GOAL_EXECUTION_MODE', `execution-mode 只接受 ${GOAL_EXECUTION_MODES.join('|')}`);
  }
  if (!authorizationId || !authorization || !reason) {
    throw controlError('HUMAN_AUTHORIZATION_REQUIRED', 'goal set-mode 要求非空 authorization-id、authorization 与 reason');
  }
  const authorizationDigest = stableDigest(authorization);
  return updateRegistry(runtimeDir, (registry) => {
    if (!registry.goal) throw controlError('GOAL_REQUIRED', 'goal set-mode 要求已有 active Goal');
    const existing = registry.goal.executionMode || 'continuous';
    const previous = registry.goal.modeHistory?.at(-1) || null;
    if (previous?.authorizationId === authorizationId) {
      if (previous.authorizationDigest !== authorizationDigest || previous.executionMode !== executionMode) {
        throw controlError('AUTHORIZATION_CONFLICT', `authorization-id ${authorizationId} 已绑定不同 Goal execution mode`);
      }
      refreshOrchestrationProjection(registry, runtimeDir);
      return { result: 'already-set', executionMode, cancelledReservations: [], goal: registry.goal };
    }
    const timestamp = now();
    const cancelledReservations = [];
    if (executionMode === 'one-task-per-worker') {
      for (const reservation of Object.values(registry.claimReservations)) {
        if (reservation.status !== 'pending' || reservation.taskId) continue;
        reservation.status = 'cancelled';
        reservation.cancelledAt = timestamp;
        reservation.cancelledReason = reason;
        reservation.cancelledBy = authorizationId;
        cancelledReservations.push(reservation.issue);
      }
    }
    registry.goal.executionMode = executionMode;
    registry.goal.modeHistory ||= [];
    registry.goal.modeHistory.push({
      executionMode, previousExecutionMode: existing, authorizationId, authorizationDigest,
      authorization, reason, cancelledReservations, changedAt: timestamp,
    });
    registry.orchestration.reason = `goal-execution-mode-${executionMode}`;
    registry.orchestration.evaluatedAt = timestamp;
    refreshOrchestrationProjection(registry, runtimeDir);
    return { result: 'mode-set', executionMode, previousExecutionMode: existing, cancelledReservations, goal: registry.goal };
  });
}

export function evaluateStop({ write = false } = {}, runtimeDir = RUNTIME_DIR) {
  return withRuntimeLock(runtimeDir, () => {
    const registry = readRegistry(runtimeDir);
    if (registry.orchestration.state === 'stopped') {
      if (write) {
        setStoppedProjection(registry);
        registry.orchestration.evaluatedAt = now();
        writeJsonAtomic(join(runtimeDir, 'registry.json'), registry);
      }
      return { result: 'stopped', reason: registry.orchestration.reason, lanes: {}, written: write, alreadyStopped: true };
    }
    const snapshot = readJson(join(runtimeDir, 'status.json'), null);
    const latest = latestExecutors(registry);
    const lanes = Object.fromEntries([...latest].map(([worktree, task]) => [shortWorker(worktree), task.agent === 'test' ? 'excluded' : task.state]));
    for (const worker of snapshot?.worktrees || []) {
      const workerId = canonicalWorktreeId(worker.name);
      lanes[workerId] ||= workerId === 'test' ? 'excluded' : 'unregistered';
    }
    const actions = deriveActionCandidates(registry, runtimeDir, snapshot);
    const remaining = actions.filter((action) => action.type !== 'STOP');
    if (remaining.length || !actions.some((action) => action.type === 'STOP')) {
      return {
        result: 'advanceable', lanes,
        advanceable: remaining,
        pendingInbox: pendingInbox(runtimeDir).pending.length,
        eligibleFrontier: eligibleAutonomousIssues(snapshot).map((issue) => issue.number),
        exitCode: 1,
      };
    }
    const timestamp = now();
    if (write) {
      registry.orchestration = {
        ...registry.orchestration,
        state: 'stopped', reason: 'goal-completion-conditions-satisfied', recordedAt: registry.orchestration.recordedAt || timestamp, evaluatedAt: timestamp,
      };
      if (registry.goal?.state === 'active') {
        registry.goal.state = 'complete';
        registry.goal.completedAt = timestamp;
      }
      setStoppedProjection(registry);
      writeJsonAtomic(join(runtimeDir, 'registry.json'), registry);
    }
    return { result: 'stopped', reason: 'goal-completion-conditions-satisfied', lanes, written: write };
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
  if (matches.length === 1) return canonicalWorktreeId(basename(matches[0].path));
  // #67: canonical 短名只覆盖 devN/test。嵌套 worker 的 basename（parking-agents-worker-1）
  // 不在该闭集内，因此再走一次与 dispatch/server 同一口径的 basename 解析，
  // 让短名与完整 basename 收敛到同一个 worker identity。
  if (!matches.length) {
    const resolved = resolveWorktreeTarget(siblings, value);
    if (resolved.target) return canonicalWorktreeId(basename(resolved.target.path));
  }
  throw controlError('UNKNOWN_WORKTREE', `worktree "${value}" 不在本仓既有 worktree 列表中`, {
    requested, available: siblings.map((entry) => basename(entry.path)),
  });
}

async function main(argv = process.argv.slice(2), runtimeDir = RUNTIME_DIR) {
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
  if (command === 'task' && action === 'release') return releaseParkedLane(requireValue(options, 'task'), options, runtimeDir);
  if (command === 'task' && action === 'reconcile-reviewer') return reconcileReviewerTask(requireValue(options, 'task'), runtimeDir);
  if (command === 'transition') return transitionTaskFromCli(requireValue(options, 'task'), requireValue(options, 'to'), {
    reason: options.reason || null, actor: options.actor || 'orchestrator', eventId: options['event-id'] || null,
    phase: options.phase, nextAction: options['next-action'], commitSha: options.commit,
    mergeCommit: options['merge-commit'], reviewTaskId: options['review-task'],
  }, runtimeDir);
  if (command === 'inbox' && action === 'put') return putInboxEvent(options, runtimeDir);
  if (command === 'inbox' && action === 'pending') return pendingInbox(runtimeDir);
  if (command === 'inbox' && action === 'reject') return rejectInboxEvent(requireValue(options, 'event-id'), options, runtimeDir);
  if (command === 'consume') return consumeEvent(requireValue(options, 'event-id'), runtimeDir);
  if (command === 'next-actions') return nextActions(runtimeDir);
  if (command === 'action' && action === 'receipt') {
    let payload = {};
    if (options['payload-file']) payload = JSON.parse(readFileSync(resolve(options['payload-file']), 'utf8'));
    else if (options.payload) payload = JSON.parse(options.payload);
    return receiveActionReceipt(requireValue(options, 'action-id'), requireValue(options, 'status'), payload, runtimeDir);
  }
  if (command === 'action' && action === 'verify') {
    const commandsFile = resolve(requireValue(options, 'commands-file'));
    return runPostMergeVerification(requireValue(options, 'action-id'), JSON.parse(readFileSync(commandsFile, 'utf8')), runtimeDir);
  }
  if (command === 'handoff' && action === 'recover') return recoverHandoff(requireValue(options, 'task'), options, runtimeDir);
  if (command === 'goal' && action === 'start') return startGoal(options, runtimeDir);
  if (command === 'goal' && action === 'set-mode') return setGoalExecutionMode(requireValue(options, 'mode'), options, runtimeDir);
  if (command === 'verdict' && action === 'set') return setVerdict(requireValue(options, 'task'), {
    code: options.code, runtime: options.runtime, delivery: options.delivery,
  }, runtimeDir);
  if (command === 'block' && action === 'record') return recordBlock(requireValue(options, 'task'), options, runtimeDir);
  if (command === 'stop' && action === 'eval') return evaluateStop({ write: Boolean(options.write) }, runtimeDir);
  throw controlError('BAD_REQUEST', '用法: orchestrate.mjs task create|task heartbeat|task attach-thread|task release|task reconcile-reviewer|inbox put|inbox pending|inbox reject|consume|next-actions|action receipt|action verify|handoff recover|goal start|goal set-mode|transition|verdict set|block record|stop eval');
}

function isMainModule() {
  try {
    return realpathSync.native(resolve(process.argv[1] || ''))
      === realpathSync.native(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
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
