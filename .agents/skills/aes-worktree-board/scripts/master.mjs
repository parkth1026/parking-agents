#!/usr/bin/env node
// Master 控制面（目标 A）：claim → dispatch → terminal → 分档 merge gate → post-merge verify
// → 幂等 close → 释放 slot；以及重启 reconcile。
//
// 恢复的核心设计：registry 记录「意图」，Git 记录「事实」。任何 merge 前先落 mergeIntent，
// 重启后 reconcile 用 `git merge-base --is-ancestor` 去问 Git 到底 merge 没 merge，
// 而不是相信可能在崩溃前没写完的状态位。这是「无重复 merge / 无假完成」的真正依据。
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_CHILD_OPTIONS } from './headless.mjs';
import {
  appendInbox, appendReceipt, appendTransition, attemptIdFor, currentAttempt, digestOf,
  HUMAN_STATES, jobIdFor, jobOf, nowIso, readV4Registry, sealLegacyRuntime,
  setJobState, storeError, updateV4Registry, V4_DIR,
} from './job-store.mjs';
import {
  assertStartable, defaultSlotsFromWorktrees, initSlots, loadSlotsConfig, projectRunners,
  slotById, SLOTS_PATH, syncSlotBaseline, updateSlots,
} from './runner-slots.mjs';
import { assertContractComplete, buildWorkOrder, contractDigestOf } from './issue-contract.mjs';
import { buildHumanRequest, validateHumanRequest, validateHumanResponse } from './human-request.mjs';
import { decideMerge, evaluateMechanicalGate, resolveMergePolicy } from './merge-policy.mjs';
import { disposeDiscovery, makeWayfinder } from './discovery.mjs';
import {
  acknowledgeEntry, enqueueIssueClose, flushOutbox, outboxStatus, outboxWarning,
} from './outbox.mjs';

export const TERMINAL_SCHEMA = 'aes.issue-worker.goal-terminal/v1';
export const DELIVERY_SCHEMA = 'aes.worktree-board.delivery-receipt/v1';
export const TERMINAL_OUTCOMES = Object.freeze([
  'READY_TO_MERGE', 'BUDGET_EXHAUSTED', 'AWAITING_HUMAN', 'BLOCKED_DEPENDENCY',
  'CONTRACT_CONFLICT', 'BLOCKED_PERMISSION',
]);
// stage-result / qa-receipt 的 v1→v2 是纯加法演进（AC-007 + #65 合流）：v1 语义永久
// 保持原样——不要求 baseCommit，也不要求 reviewerSessionId；历史 trajectory replay
// 语料就是真实的 v1 报文，不得改写。v2 起两票要求合并生效：review 类 v2 报文必须
// 同时携带 baseCommit 与 reviewerSessionId（都 fail closed）；qa 类 v2 只要求
// baseCommit（reviewerSessionId 不适用于 qa）。产品代码同时接受两版，按报文自带
// schemaVersion 分派，不做「探测环境/回放就放行」的特权判断——分派唯一依据是
// 报文自己声明的版本号。
export const STAGE_RESULT_SCHEMA_V1 = 'aes.issue-worker.stage-result/v1';
export const STAGE_RESULT_SCHEMA_V2 = 'aes.issue-worker.stage-result/v2';
export const QA_RECEIPT_SCHEMA_V1 = 'aes.qa.receipt/v1';
export const QA_RECEIPT_SCHEMA_V2 = 'aes.qa.receipt/v2';
export const REVIEWER_INDEPENDENCE_VALUES = Object.freeze(['same-session', 'independent', 'unknown']);
const ACCEPTED_STAGE_RESULT_SCHEMAS = Object.freeze([STAGE_RESULT_SCHEMA_V1, STAGE_RESULT_SCHEMA_V2]);
const ACCEPTED_QA_RECEIPT_SCHEMAS = Object.freeze([QA_RECEIPT_SCHEMA_V1, QA_RECEIPT_SCHEMA_V2]);

function git(cwd, args) {
  return spawnSync('git', args, { ...HEADLESS_CHILD_OPTIONS, cwd, encoding: 'utf8' });
}

function gitOut(cwd, args) {
  const result = git(cwd, args);
  if (result.status !== 0) return null;
  return String(result.stdout || '').trim();
}

// 「merge 是否真的发生」的唯一权威判定。registry 状态位不参与。
export function isAncestor(repoRoot, candidate, branch) {
  if (!candidate) return false;
  const result = git(repoRoot, ['merge-base', '--is-ancestor', candidate, branch]);
  return result.status === 0;
}

function changedPathsBetween(repoRoot, base, candidate) {
  const out = gitOut(repoRoot, ['diff', '--name-only', `${base}...${candidate}`]);
  return out ? out.split(/\r?\n/).filter(Boolean) : [];
}

function ctx(options = {}) {
  const dir = resolve(options.dir || process.env.AES_WORKTREE_BOARD_V4_DIR || V4_DIR);
  const slotsPath = resolve(options.slotsPath || process.env.AES_WORKTREE_BOARD_SLOTS_PATH || SLOTS_PATH);
  const config = loadSlotsConfig(slotsPath);
  return {
    dir,
    slotsPath,
    config,
    // identity 锚点：所有 slot 的 git-common-dir 都必须指回这里。
    repoRoot: resolve(config.repoIdentity.root),
    // host merge 发生地：检出了 integration branch 的那个 worktree。
    hostRoot: resolve(config.hostWorktree || config.repoIdentity.root),
  };
}

// ---------------------------------------------------------------- attempt helpers

// 测试辅助：设置 attempt 的 ownerThreadId。
export function setAttemptOwnerThreadId(options = {}) {
  const { dir } = ctx(options);
  return updateV4Registry(dir, (registry) => {
    const attempt = currentAttempt(registry, options.jobId);
    if (!attempt) throw storeError('NO_CURRENT_ATTEMPT', `job ${options.jobId} 无当前 attempt`, { jobId: options.jobId });
    attempt.ownerThreadId = options.ownerThreadId;
    return { ok: true, jobId: options.jobId, attemptId: attempt.attemptId, ownerThreadId: attempt.ownerThreadId };
  });
}

// ---------------------------------------------------------------- start / status

export function masterStart(options = {}) {
  const { dir, slotsPath, config } = ctx(options);
  // E1: slot 配置为空 → Master Goal 不启动，非零退出。
  const enabled = assertStartable(config, { path: slotsPath });
  if (options.legacyRuntimeDir) sealLegacyRuntime(dir, options.legacyRuntimeDir);
  return updateV4Registry(dir, (registry) => {
    registry.runners = projectRunners(config, registry, options.probeOverride ? { probe: options.probeOverride } : {});
    registry.master = {
      ...registry.master,
      state: 'running',
      goalId: registry.master.goalId || `goal-${digestOf({ slotsPath, at: nowIso() }).slice(7, 19)}`,
      startedAt: nowIso(),
      generation: (registry.master.generation || 0) + 1,
    };
    appendTransition(dir, { kind: 'master', to: 'running', generation: registry.master.generation });
    return {
      ok: true,
      goalId: registry.master.goalId,
      generation: registry.master.generation,
      slots: enabled.length,
      runners: Object.fromEntries(Object.entries(registry.runners).map(([id, runner]) => [id, runner.state])),
    };
  });
}

export function masterStatus(options = {}) {
  const { dir, config } = ctx(options);
  const registry = readV4Registry(dir);
  const runners = projectRunners(config, registry, options.probeOverride ? { probe: options.probeOverride } : {});
  return {
    ok: true,
    master: registry.master,
    runners,
    jobs: Object.fromEntries(Object.entries(registry.jobs).map(([id, job]) => [id, job.state])),
    mergeQueue: registry.mergeQueue,
    humanRequests: Object.keys(registry.humanRequests).length,
  };
}

// ---------------------------------------------------------------- claim / dispatch

export function masterClaim(options = {}) {
  const { dir, config } = ctx(options);
  const issue = options.issue;
  if (!issue || !Number.isInteger(issue.number)) throw storeError('BAD_ISSUE', 'claim 需要含整数 number 的 issue 载荷');

  // B5/E3: 合同不完整不创建 owner session，只回流 needs-info，不计 worker failure。
  let parsed;
  try {
    parsed = assertContractComplete(issue);
  } catch (error) {
    if (error.code === 'ISSUE_CONTRACT_INCOMPLETE') {
      appendInbox(dir, { kind: 'contract-rejection', issue: issue.number, rejection: error.rejection });
      return { ok: false, ...error.rejection, workerFailure: false };
    }
    throw error;
  }

  const contractDigest = contractDigestOf(parsed);
  const jobId = jobIdFor({ repo: issue.repo, issue: issue.number, contractDigest });

  return updateV4Registry(dir, (registry) => {
    registry.runners = projectRunners(config, registry, options.probeOverride ? { probe: options.probeOverride } : {});

    // E7: 同一 Issue 已被 claim 时不重复领取；返回既有 job 而不是新建。
    const existing = registry.jobs[jobId];
    if (existing && !['abandoned'].includes(existing.state)) {
      return { ok: true, outcome: 'ALREADY_CLAIMED', jobId, state: existing.state, idempotent: true };
    }

    const free = Object.values(registry.runners).filter((runner) => runner.claimable);
    if (!free.length) {
      // E2: 所有 slot 不可用时不 claim，输出每个 slot 的原因和恢复命令，不标 complete。
      return {
        ok: false,
        code: 'NO_CLAIMABLE_SLOT',
        jobId: null,
        slots: Object.values(registry.runners).map((runner) => ({
          slotId: runner.slotId, state: runner.state, reason: runner.reason, recovery: runner.recovery,
        })),
      };
    }
    const runner = options.slotId
      ? registry.runners[options.slotId]
      : free[0];
    if (!runner || !runner.claimable) {
      throw storeError('SLOT_NOT_CLAIMABLE', `slot ${options.slotId} 不可领取: ${runner?.reason || 'unknown'}`, {
        slotId: options.slotId, state: runner?.state || null,
      });
    }

    const attemptId = attemptIdFor(jobId, 1);
    const baseCommit = options.baseCommit || runner.integrationHead || runner.head;
    registry.jobs[jobId] = {
      jobId,
      repo: issue.repo,
      issue: issue.number,
      title: issue.title,
      url: issue.url || null,
      contractDigest,
      acceptanceCriteria: parsed.contract.acceptanceCriteria,
      declaredRisk: parsed.contract.riskProfile,
      humanGates: parsed.contract.humanGates,
      state: 'dispatched',
      attemptIds: [attemptId],
      currentAttemptId: attemptId,
      humanRequestId: null,
      slotId: runner.slotId,
      baseCommit,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    registry.attempts[attemptId] = {
      attemptId,
      jobId,
      ordinal: 1,
      slotId: runner.slotId,
      ownerThreadId: options.ownerThreadId || null,
      state: 'dispatched',
      baseCommit,
      candidateCommit: null,
      review: null,
      qa: null,
      startedAt: nowIso(),
      endedAt: null,
      handoffBundle: null,
    };
    registry.runners[runner.slotId].lease = { jobId, attemptId, acquiredAt: nowIso() };
    registry.runners[runner.slotId].state = 'leased';
    registry.runners[runner.slotId].claimable = false;

    const workOrder = buildWorkOrder({
      jobId,
      attemptId,
      issue,
      parsed,
      contractDigest,
      runner: { slotId: runner.slotId, worktreePath: runner.worktreePath, baseCommit },
      modelTier: options.modelTier || 'standard',
      reason: options.routingReason || '',
      budgets: options.budgets || {},
    });
    appendTransition(dir, { kind: 'job', jobId, from: null, to: 'dispatched', reason: 'claim' });
    appendReceipt(dir, { kind: 'work-order', jobId, attemptId, workOrder });
    return { ok: true, outcome: 'CLAIMED', jobId, attemptId, slotId: runner.slotId, workOrder };
  });
}

// ---------------------------------------------------------------- attempt 层恢复

// B15: 优先恢复原 thread；确认不可恢复才凭 handoff bundle 新建 attempt。
// 旧 attempt 与证据保留，新 attempt 不覆盖旧 attempt（不变清单）。
export function attemptInterrupt(options = {}) {
  const { dir } = ctx(options);
  const jobId = options.jobId;
  return updateV4Registry(dir, (registry) => {
    const job = jobOf(registry, jobId);
    const attempt = currentAttempt(registry, jobId);
    if (!attempt) throw storeError('NO_CURRENT_ATTEMPT', `job ${jobId} 无当前 attempt`, { jobId });
    attempt.state = 'interrupted';
    attempt.interruptedAt = nowIso();
    attempt.interruptReason = options.reason || 'owner thread 中断';
    // handoff bundle 是「不可恢复时」新建 attempt 的唯一输入：live worktree + commit + 证据引用。
    attempt.handoffBundle = {
      schemaVersion: 'aes.issue-worker.handoff-bundle/v1',
      jobId,
      fromAttemptId: attempt.attemptId,
      slotId: attempt.slotId,
      baseCommit: attempt.baseCommit,
      candidateCommit: attempt.candidateCommit,
      reviewRef: attempt.review ? { commitSha: attempt.review.commitSha, outcome: attempt.review.outcome } : null,
      qaRef: attempt.qa ? { commitSha: attempt.qa.commitSha, outcome: attempt.qa.outcome } : null,
      createdAt: nowIso(),
    };
    appendTransition(dir, { kind: 'attempt', jobId, attemptId: attempt.attemptId, to: 'interrupted', reason: attempt.interruptReason });
    return { ok: true, jobId, attemptId: attempt.attemptId, state: attempt.state, handoffBundle: attempt.handoffBundle, jobState: job.state };
  });
}

export function attemptResume(options = {}) {
  const { dir } = ctx(options);
  const jobId = options.jobId;
  return updateV4Registry(dir, (registry) => {
    const attempt = currentAttempt(registry, jobId);
    if (!attempt) throw storeError('NO_CURRENT_ATTEMPT', `job ${jobId} 无当前 attempt`, { jobId });
    if (attempt.state !== 'interrupted') {
      return { ok: true, outcome: 'NOOP', jobId, attemptId: attempt.attemptId, state: attempt.state };
    }
    attempt.state = attempt.candidateCommit ? 'reviewing' : 'implementing';
    attempt.resumedAt = nowIso();
    appendTransition(dir, { kind: 'attempt', jobId, attemptId: attempt.attemptId, to: attempt.state, reason: 'resume-original-thread' });
    return { ok: true, outcome: 'RESUMED_ORIGINAL', jobId, attemptId: attempt.attemptId, state: attempt.state };
  });
}

export function attemptNew(options = {}) {
  const { dir, config } = ctx(options);
  const jobId = options.jobId;
  return updateV4Registry(dir, (registry) => {
    const job = jobOf(registry, jobId);
    const previous = currentAttempt(registry, jobId);
    if (previous && previous.state !== 'interrupted' && !options.force) {
      throw storeError('ATTEMPT_STILL_LIVE', `attempt ${previous.attemptId} 未确认不可恢复，拒绝新建 attempt`, {
        jobId, attemptId: previous.attemptId, state: previous.state,
      });
    }
    const previousSlotId = previous?.slotId || job.slotId || null;
    const slotId = options.slotId || previousSlotId;
    const migrating = slotId !== previousSlotId;

    // #78 缺陷二：改派到新 slot 时，baseCommit 必须取新 slot 的实时 HEAD，不能继承
    // claim 那一刻的 job.baseCommit —— 新 slot 可能早已 release 同步到更新的
    // integration HEAD。继承陈旧 base 会让 reviewer 按 base..candidate 取 diff 时把
    // 别的 job 已合入的改动算进本 job，QA 的「在什么基线上验证」也随之失真，而
    // GATE-commit 只比对 candidate、从不校验 base，兜不住这一层。
    // 同 slot 续跑则不改 base：worktree 就是上一个 attempt 的现场（HEAD 可能已是
    // candidate 本身），claim 时记录的 base 仍然是事实。
    let baseCommit = job.baseCommit;
    let baseCommitAdvancedFrom = null;
    if (migrating) {
      // allowlist 外的 slot 直接 fail closed（slotById 抛 UNKNOWN_SLOT）。
      const slot = slotById(config, slotId);
      const liveHead = gitOut(resolve(slot.worktreePath), ['rev-parse', 'HEAD']);
      if (!liveHead) {
        throw storeError('SLOT_HEAD_UNRESOLVED', `无法解析 slot ${slotId} 的实时 HEAD，拒绝新建 attempt`, {
          jobId, slotId, worktreePath: slot.worktreePath,
        });
      }
      if (liveHead !== baseCommit) baseCommitAdvancedFrom = baseCommit;
      baseCommit = liveHead;
    }

    if (previous) previous.state = 'superseded';
    const ordinal = job.attemptIds.length + 1;
    const attemptId = attemptIdFor(jobId, ordinal);
    const bundle = previous?.handoffBundle || null;
    registry.attempts[attemptId] = {
      attemptId,
      jobId,
      ordinal,
      slotId,
      ownerThreadId: options.ownerThreadId || null,
      state: 'dispatched',
      baseCommit,
      // 从 handoff bundle 续跑：live worktree 上的 candidate commit 保留，证据不保留
      // （candidate 前进后旧 review/QA 已失效，新 attempt 必须重新绑定）。
      candidateCommit: bundle?.candidateCommit || null,
      review: null,
      qa: null,
      startedAt: nowIso(),
      endedAt: null,
      resumedFrom: bundle ? bundle.fromAttemptId : null,
      handoffBundle: null,
    };
    job.attemptIds.push(attemptId);
    job.currentAttemptId = attemptId;
    job.slotId = slotId;
    // registry 记录的 base 必须与 executor 实际工作的基线一致，否则 gate 的
    // changedPaths / GATE-review-base / GATE-qa-base 全部基于错误前提。
    job.baseCommit = baseCommit;
    job.updatedAt = nowIso();

    // #78 缺陷一：改派后释放旧 slot 的租约，否则同一 job 同时持有两个 slot lease，
    // 干净的旧 slot 会被一条早已迁走的 job 永久占住。仅当旧租约确属本 job 才释放 ——
    // 旧 slot 可能已被别的 job 合法租用（例如本 job 的租约早先被外力清理），不误伤。
    let releasedSlotId = null;
    if (migrating && previousSlotId && registry.runners[previousSlotId]?.lease?.jobId === jobId) {
      releaseSlot(registry, previousSlotId, { reason: `job ${jobId} 改派至 ${slotId}，旧租约释放`, keepJob: true });
      releasedSlotId = previousSlotId;
    }
    if (registry.runners[slotId]) {
      registry.runners[slotId].lease = { jobId, attemptId, acquiredAt: nowIso() };
      registry.runners[slotId].state = 'leased';
      registry.runners[slotId].claimable = false;
    }
    appendTransition(dir, {
      kind: 'attempt', jobId, attemptId, to: 'dispatched', reason: 'new-attempt-from-handoff',
      baseCommit, baseCommitAdvancedFrom, releasedSlotId,
    });
    return {
      ok: true, outcome: 'NEW_ATTEMPT', jobId, attemptId, ordinal, slotId,
      baseCommit, baseCommitAdvancedFrom, releasedSlotId,
      resumedFrom: registry.attempts[attemptId].resumedFrom,
      preservedAttempts: job.attemptIds.length,
      integrationBranch: config.repoIdentity.integrationBranch,
    };
  });
}

// candidate commit 前进使旧 review/QA/acceptance 失效（E5 / 不变清单 / #72）。
export function recordCandidate(options = {}) {
  const { dir } = ctx(options);
  return updateV4Registry(dir, (registry) => {
    const job = jobOf(registry, options.jobId);
    const attempt = currentAttempt(registry, options.jobId);
    if (!attempt) throw storeError('NO_CURRENT_ATTEMPT', `job ${options.jobId} 无当前 attempt`, { jobId: options.jobId });
    const previous = attempt.candidateCommit;
    const invalidated = [];
    if (previous && previous !== options.commitSha) {
      if (attempt.review) invalidated.push({ kind: 'review', commitSha: attempt.review.commitSha });
      if (attempt.qa) invalidated.push({ kind: 'qa', commitSha: attempt.qa.commitSha });
      // #72：job.acceptance 与 review/qa 同构失效 —— AC 结论是在旧 candidate 上取得的，
      // candidate 前进后不能继续给新 commit 背书。此前只靠 GATE-commit 拦截过期 terminal
      // 间接兜住，acceptance 这一层自己没有失效语义；任何使 terminal 与 candidate 重新
      // 对齐的路径都会让旧 AC 结论直接放行。
      if (Array.isArray(job.acceptance) && job.acceptance.length) {
        invalidated.push({ kind: 'acceptance', commitSha: job.acceptanceCommit || null });
        job.acceptance = null;
        job.acceptanceCommit = null;
      }
      attempt.review = null;
      attempt.qa = null;
    }
    attempt.candidateCommit = options.commitSha;
    attempt.state = 'reviewing';
    appendTransition(dir, {
      kind: 'attempt', jobId: options.jobId, attemptId: attempt.attemptId,
      to: 'reviewing', reason: 'candidate-advanced', commitSha: options.commitSha, invalidated,
    });
    return { ok: true, jobId: options.jobId, attemptId: attempt.attemptId, candidateCommit: options.commitSha, invalidated };
  });
}

// B11: stage 失败必须分类。分类决定烧哪一本预算 —— 环境污染与真实缺陷共用一本
// 预算，正是历史上「三次机械 BLOCK 后 handoff」把环境问题误判成实现问题的根因。
export const FAILURE_CLASSES = Object.freeze(['must-fix', 'retryable', 'environment']);
const BUDGET_BY_CLASS = Object.freeze({ 'must-fix': 'reviewLoops', retryable: null, environment: 'environmentRetries' });

function emptyBudgetUsage() {
  return { reviewLoops: 0, qaLoops: 0, environmentRetries: 0, modelUpgrades: 0 };
}

// E4: review/QA 未知 schema 时不推进 cursor/commit gate，StageResult 保持 pending。
export function recordStageResult(options = {}) {
  const { dir } = ctx(options);
  const payload = options.payload;
  // qa 与 review 各自的 v1/v2 接受集：review v2 起同时强制 baseCommit（AC-007）与
  // reviewerSessionId（#65）；qa v2 只强制 baseCommit（reviewerSessionId 不适用于 qa）。
  const isQa = options.stage === 'qa';
  const accepted = isQa ? ACCEPTED_QA_RECEIPT_SCHEMAS : ACCEPTED_STAGE_RESULT_SCHEMAS;
  const latest = isQa ? QA_RECEIPT_SCHEMA_V2 : STAGE_RESULT_SCHEMA_V2;
  return updateV4Registry(dir, (registry) => {
    const attempt = currentAttempt(registry, options.jobId);
    if (!attempt) throw storeError('NO_CURRENT_ATTEMPT', `job ${options.jobId} 无当前 attempt`, { jobId: options.jobId });
    if (!payload || !accepted.includes(payload.schemaVersion)) {
      appendInbox(dir, {
        kind: 'unclassified-stage-result', jobId: options.jobId, stage: options.stage,
        consumed: false, requiredReplacementSchema: latest,
      });
      return {
        ok: false, code: 'UNCLASSIFIED_STAGE_RESULT', stage: options.stage,
        consumed: false, requiredReplacementSchema: latest, acceptedSchemas: accepted, pending: true,
      };
    }
    // 孤儿证据：receipt 必须绑定到本 job 与本 attempt，不接受「挂在别处的 reviewer」。
    if (payload.jobId !== options.jobId) {
      return {
        ok: false, code: 'ORPHAN_STAGE_RESULT', stage: options.stage,
        expectedJobId: options.jobId, actualJobId: payload.jobId || null, consumed: false, pending: true,
      };
    }
    if (payload.attemptId && payload.attemptId !== attempt.attemptId) {
      return {
        ok: false, code: 'WRONG_PARENT_STAGE_RESULT', stage: options.stage,
        expectedAttemptId: attempt.attemptId, actualAttemptId: payload.attemptId, consumed: false, pending: true,
      };
    }
    // 证据必须绑定当前 candidate commit，否则是过期证据。
    if (!payload.commitSha || payload.commitSha !== attempt.candidateCommit) {
      return {
        ok: false, code: 'STALE_EVIDENCE', stage: options.stage,
        expectedCommit: attempt.candidateCommit, actualCommit: payload.commitSha || null, pending: true,
      };
    }
    // 证据必须记录取证时的 base commit（AC-1）。只有 v2 承诺了这个字段——v1 语义保持
    // 原样，不对 v1 报文强制 baseCommit（向下兼容；历史 trajectory replay 依赖这条）。
    if (payload.schemaVersion === latest && !payload.baseCommit) {
      return {
        ok: false, code: 'MISSING_BASE_COMMIT', stage: options.stage,
        jobId: options.jobId, consumed: false, pending: true,
      };
    }

    // AC-1: v2 起 review stage-result 必须携带 reviewer 侧会话标识字段，缺失时 fail closed。
    // v1 是历史轨迹夹具锁定证据的原始语义，不追溯要求（否则 trajectory-replay 场景本身
    // 就无法通过——那是它存在的意义：暴露 schema 变更对历史证据的破坏，不是被绕过的障碍）。
    if (options.stage === 'review' && payload.schemaVersion === STAGE_RESULT_SCHEMA_V2 && !payload.reviewerSessionId) {
      return {
        ok: false, code: 'MISSING_REVIEWER_SESSION_ID', stage: options.stage,
        consumed: false, pending: true,
      };
    }

    attempt.budgetUsage ||= emptyBudgetUsage();
    let failureClass = null;
    if (payload.outcome !== 'PASS' && payload.outcome !== 'AWAITING_HUMAN') {
      failureClass = payload.failureClass || 'must-fix';
      if (!FAILURE_CLASSES.includes(failureClass)) {
        return {
          ok: false, code: 'UNCLASSIFIED_STAGE_FAILURE', stage: options.stage,
          allowed: FAILURE_CLASSES, actual: payload.failureClass || null, consumed: false, pending: true,
        };
      }
      const bucket = options.stage === 'qa' && failureClass === 'must-fix' ? 'qaLoops' : BUDGET_BY_CLASS[failureClass];
      if (bucket) attempt.budgetUsage[bucket] += 1;
    }

    // AC-2: 机械推导 reviewerIndependence，忽略报文自述该字段。
    // fail-closed 口径：任何一侧标识缺失都判定不出「独立」，如实记 unknown——
    // 不把「无法证明独立」偷换成「独立」（v1 legacy 无 reviewerSessionId、或
    // ownerThreadId 未记录，都落在这一分支，不再默认给 independent）。
    let reviewerIndependence = null;
    if (options.stage === 'review') {
      if (!payload.reviewerSessionId || !attempt.ownerThreadId) {
        reviewerIndependence = 'unknown';
      } else {
        reviewerIndependence = payload.reviewerSessionId === attempt.ownerThreadId ? 'same-session' : 'independent';
      }
    }

    if (options.stage === 'qa') attempt.qa = payload.outcome === 'PASS' ? payload : null;
    else {
      if (payload.outcome === 'PASS') {
        attempt.review = payload;
        attempt.reviewerSessionId = payload.reviewerSessionId || null;
        attempt.reviewerIndependence = reviewerIndependence;
      } else {
        attempt.review = null;
      }
    }
    attempt.lastStage = { stage: options.stage, outcome: payload.outcome, failureClass, commitSha: payload.commitSha };
    attempt.state = options.stage === 'qa' ? 'qa' : 'reviewing';
    appendReceipt(dir, { kind: options.stage, jobId: options.jobId, attemptId: attempt.attemptId, payload });
    return {
      ok: true, stage: options.stage, jobId: options.jobId, outcome: payload.outcome,
      commitSha: payload.commitSha, failureClass, budgetUsage: { ...attempt.budgetUsage },
      reviewerIndependence,
    };
  });
}

// 预算检查是 owner 侧的决策依据，Master 只负责如实记账并告诉它超没超。
export function checkBudget(options = {}) {
  const { dir } = ctx(options);
  const registry = readV4Registry(dir);
  const attempt = currentAttempt(registry, options.jobId);
  if (!attempt) throw storeError('NO_CURRENT_ATTEMPT', `job ${options.jobId} 无当前 attempt`, { jobId: options.jobId });
  const limits = { reviewLoops: 3, qaLoops: 3, environmentRetries: 2, modelUpgrades: 1, ...(options.budgets || {}) };
  const usage = attempt.budgetUsage || emptyBudgetUsage();
  const exceeded = Object.keys(limits).filter((key) => usage[key] >= limits[key]);
  return {
    ok: true, jobId: options.jobId, attemptId: attempt.attemptId, usage, limits, exceeded,
    exhausted: exceeded.length > 0,
    kind: exceeded[0] || null,
  };
}

// ---------------------------------------------------------------- terminal 入站

export function masterTerminal(options = {}) {
  const { dir } = ctx(options);
  const payload = options.payload;
  if (payload?.schemaVersion !== TERMINAL_SCHEMA) {
    throw storeError('UNCLASSIFIED_TERMINAL', `WorkerGoalTerminal schemaVersion 必须为 ${TERMINAL_SCHEMA}`, {
      actual: payload?.schemaVersion || null,
    });
  }
  if (!TERMINAL_OUTCOMES.includes(payload.outcome)) {
    throw storeError('UNCLASSIFIED_TERMINAL', `terminal outcome 非闭集取值: ${payload.outcome}`, {
      allowed: TERMINAL_OUTCOMES,
    });
  }
  return updateV4Registry(dir, (registry) => {
    const job = jobOf(registry, payload.jobId);
    const attempt = currentAttempt(registry, payload.jobId);
    appendInbox(dir, { kind: 'terminal', jobId: payload.jobId, outcome: payload.outcome });

    if (payload.outcome === 'READY_TO_MERGE') {
      if (payload.contractDigest !== job.contractDigest) {
        return { ok: false, code: 'CONTRACT_DIGEST_MISMATCH', jobId: job.jobId, expected: job.contractDigest, actual: payload.contractDigest };
      }
      // terminal 不是 candidate 前进通道：commit 前进只能走 recordCandidate（那里才有
      // 证据失效语义）。直接放行不一致的 candidateCommit 等于让旧 review/QA 给新 commit 背书。
      if (!payload.candidateCommit || payload.candidateCommit !== attempt.candidateCommit) {
        return {
          ok: false, code: 'CANDIDATE_MISMATCH', jobId: job.jobId,
          expected: attempt.candidateCommit || null, actual: payload.candidateCommit || null,
          requiredAction: 'RECORD_CANDIDATE_FIRST', pending: true,
        };
      }
      attempt.state = 'ready-to-merge';
      job.acceptance = payload.acceptance || [];
      // #72：记录 AC 结论的取证 commit（上方已校验 payload.candidateCommit 与当前
      // candidate 一致）。GATE-acceptance 据此判断新鲜度，不再依赖 GATE-commit 兜底。
      job.acceptanceCommit = payload.candidateCommit;
      job.terminal = payload;
      setJobState(registry, job.jobId, 'ready-to-merge', { reason: 'worker READY_TO_MERGE', dir });
      // 串行 merge：进队列，且同一 job 只入队一次（重启后 reconcile 也依赖这个不变量）。
      if (!registry.mergeQueue.includes(job.jobId)) registry.mergeQueue.push(job.jobId);
      return { ok: true, jobId: job.jobId, state: job.state, queuePosition: registry.mergeQueue.indexOf(job.jobId) };
    }

    if (HUMAN_STATES.includes(mapTerminalToState(payload.outcome))) {
      const state = mapTerminalToState(payload.outcome);
      // 三个人工态终点必须携带完整 humanRequest；缺 resumeToken 的报文拒收且不推进状态。
      const request = validateHumanRequest(payload.humanRequest, { state });
      registry.humanRequests[request.resumeToken] = { ...request, jobId: job.jobId, state, open: true };
      job.humanRequestId = request.resumeToken;
      attempt.state = 'closed';
      attempt.endedAt = nowIso();
      // AWAITING_HUMAN 释放 writer slot（已锁定约定），但 job 不终结。
      releaseSlot(registry, job.slotId, { reason: `job ${job.jobId} 进入 ${state}`, keepJob: true });
      setJobState(registry, job.jobId, state, { reason: payload.outcome, dir });
      return { ok: true, jobId: job.jobId, state, resumeToken: request.resumeToken, writerLease: 'RELEASED' };
    }

    if (payload.outcome === 'BUDGET_EXHAUSTED') {
      attempt.state = 'failed';
      attempt.endedAt = nowIso();
      job.budget = payload.budget || null;
      setJobState(registry, job.jobId, 'budget-exhausted', { reason: 'worker BUDGET_EXHAUSTED', dir });
      return {
        ok: true, jobId: job.jobId, state: job.state, budget: payload.budget || null,
        recommendedMasterActions: payload.recommendedMasterActions || ['NEW_ATTEMPT_FRONTIER_MODEL', 'AWAITING_HUMAN'],
      };
    }

    // BLOCKED_DEPENDENCY：依赖 Issue 可继续进入其他 slot，不必立即找用户（B13）。
    attempt.state = 'closed';
    attempt.endedAt = nowIso();
    releaseSlot(registry, job.slotId, { reason: `job ${job.jobId} blocked-dependency`, keepJob: true });
    setJobState(registry, job.jobId, 'blocked-dependency', { reason: 'worker BLOCKED_DEPENDENCY', dir });
    return { ok: true, jobId: job.jobId, state: job.state, blockedBy: payload.blockedBy || null };
  });
}

function mapTerminalToState(outcome) {
  if (outcome === 'AWAITING_HUMAN') return 'awaiting-human';
  if (outcome === 'CONTRACT_CONFLICT') return 'contract-conflict';
  if (outcome === 'BLOCKED_PERMISSION') return 'blocked-permission';
  return null;
}

function releaseSlot(registry, slotId, { reason, keepJob = false } = {}) {
  const runner = registry.runners[slotId];
  if (!runner) return null;
  runner.lease = null;
  // 释放不等于立刻可领取：下一轮 projectRunners 会重新探测 dirty/drift/baseline。
  runner.state = 'idle';
  runner.claimable = false;
  runner.needsBaselineSync = true;
  runner.reason = reason || '已释放，等待 baseline 同步后方可领取';
  if (!keepJob) runner.lastJobId = null;
  return runner;
}

// ---------------------------------------------------------------- 人工门

export function openHumanRequest(options = {}) {
  const { dir } = ctx(options);
  // #76：分档 gate 让 high 停下来，就是为了让人看着证据做判断；证据清单为空的请求
  // 等于让人盲签。humanRequest schema 是 v1、语义冻结（空数组在 schema 层合法，
  // 收紧 schema 会追溯性判历史报文不合格），所以收紧发生在 Master 主动创建这一侧：
  // requiredEvidence 为空直接 fail closed，而不是静默开出一个没有证据摘要的人工门。
  const requiredEvidence = options.requiredEvidence || [];
  if (!Array.isArray(requiredEvidence) || !requiredEvidence.length) {
    throw storeError('EMPTY_REQUIRED_EVIDENCE', 'humanRequest.requiredEvidence 为空：人工门请求必须携带证据清单', {
      jobId: options.jobId, kind: options.kind || null,
    });
  }
  return updateV4Registry(dir, (registry) => {
    const job = jobOf(registry, options.jobId);
    const attempt = currentAttempt(registry, options.jobId);
    const request = buildHumanRequest({
      jobId: job.jobId,
      attemptId: attempt?.attemptId || null,
      state: options.state,
      kind: options.kind,
      prompt: options.prompt,
      requiredEvidence: options.requiredEvidence || [],
      context: options.context || {},
    });
    registry.humanRequests[request.resumeToken] = { ...request, jobId: job.jobId, state: options.state, open: true };
    job.humanRequestId = request.resumeToken;
    setJobState(registry, job.jobId, options.state, { reason: `humanRequest ${request.kind}`, dir });
    appendReceipt(dir, { kind: 'human-request', jobId: job.jobId, request });
    return { ok: true, jobId: job.jobId, state: job.state, humanRequest: request };
  });
}

export function respondHumanRequest(options = {}) {
  const { dir } = ctx(options);
  return updateV4Registry(dir, (registry) => {
    const request = registry.humanRequests[options.resumeToken];
    if (!request) {
      throw storeError('UNKNOWN_RESUME_TOKEN', `无此 resumeToken: ${options.resumeToken}`, { resumeToken: options.resumeToken });
    }
    const response = validateHumanResponse(request, options.response);
    request.open = false;
    request.response = response;
    request.respondedAt = nowIso();
    const job = jobOf(registry, request.jobId);
    appendReceipt(dir, { kind: 'human-response', jobId: job.jobId, resumeToken: request.resumeToken, outcome: response.outcome });

    if (response.outcome === 'ABANDON') {
      setJobState(registry, job.jobId, 'abandoned', { reason: '人工放弃', dir });
      return { ok: true, jobId: job.jobId, state: job.state };
    }
    if (response.outcome === 'FAIL') {
      // 人工 FAIL 后同 job 分配新 slot/attempt，不复活已被复用的旧 worktree 状态（已锁定约定）。
      setJobState(registry, job.jobId, 'queued', { reason: '人工 FAIL，等待新 attempt', dir });
      return { ok: true, jobId: job.jobId, state: job.state, nextAction: 'NEW_ATTEMPT' };
    }
    // PASS / WAIVED：若这是 merge 前的 humanGate，job 回到 ready-to-merge 继续 delivery。
    if (request.kind === 'risk_approval' && job.terminal) {
      job.humanGateApproval = { resumeToken: request.resumeToken, outcome: 'PASS', waiver: response.waiver || null };
      setJobState(registry, job.jobId, 'ready-to-merge', { reason: '人工门通过', dir });
      if (!registry.mergeQueue.includes(job.jobId)) registry.mergeQueue.push(job.jobId);
      return { ok: true, jobId: job.jobId, state: job.state, nextAction: 'MERGE' };
    }
    setJobState(registry, job.jobId, 'queued', { reason: '人工答复通过，等待续跑', dir });
    return { ok: true, jobId: job.jobId, state: job.state, nextAction: 'RESUME' };
  });
}

// ---------------------------------------------------------------- merge gate

export function evaluateGate(options = {}) {
  const { dir, config, hostRoot } = ctx(options);
  const registry = readV4Registry(dir);
  const job = jobOf(registry, options.jobId);
  const attempt = currentAttempt(registry, options.jobId);
  const runner = registry.runners[job.slotId] || null;
  const integrationBranch = config.repoIdentity.integrationBranch;
  const integrationHead = options.integrationHead ?? gitOut(hostRoot, ['rev-parse', integrationBranch]);

  const changedPaths = options.changedPaths
    || (attempt?.candidateCommit && job.baseCommit
      ? changedPathsBetween(hostRoot, job.baseCommit, attempt.candidateCommit)
      : []);
  const policy = resolveMergePolicy({ declaredRisk: job.declaredRisk, changedPaths });

  const mechanical = evaluateMechanicalGate({
    slotOk: Boolean(runner && runner.lease?.jobId === job.jobId && !runner.state.startsWith('QUARANTINED_')),
    slotReason: runner ? `slot ${runner.slotId} state=${runner.state}` : 'slot 记录缺失',
    commitFresh: Boolean(attempt?.candidateCommit && job.terminal?.candidateCommit === attempt.candidateCommit),
    commitReason: `candidate=${attempt?.candidateCommit || 'NOT_RUN'} terminal=${job.terminal?.candidateCommit || 'NOT_RUN'}`,
    integrationOk: Boolean(integrationHead),
    integrationReason: `integration ${integrationBranch}=${integrationHead || 'UNRESOLVED'}`,
    acceptance: job.acceptance || [],
    acceptanceCommit: job.acceptanceCommit || null,
    review: attempt?.review || null,
    qa: attempt?.qa || null,
    candidateCommit: attempt?.candidateCommit || null,
    baseCommit: job.baseCommit || null,
    integrationHead,
  });

  const decision = decideMerge({ mechanical, policy, humanApproval: job.humanGateApproval || null });
  return {
    ok: true, jobId: job.jobId, policy, mechanical, decision,
    candidateCommit: attempt?.candidateCommit || null, integrationHead, changedPaths,
    // 可观测性，不是第七道门：机械门恒为六项，mayMerge 不受它影响。
    outboxWarning: outboxWarning(dir),
  };
}

// merge 被拆成三个可独立调用的阶段，让「崩溃发生在哪一步」成为可精确复现的测试输入，
// 而不需要在生产代码里埋 crash hook。masterMerge 只是这三步的组合。
//
// 阶段一：在锁内登记 merge 意图并占用串行槽位。崩溃在此之后、git merge 之前时，
// reconcile 用 git ancestry 判定 merge 未发生，把 job 退回 ready-to-merge。
export function openMergeIntent(options = {}) {
  const { dir, config } = ctx(options);
  const gate = options.gate || evaluateGate(options);
  return updateV4Registry(dir, (registry) => {
    const busy = Object.values(registry.jobs).find((job) => job.state === 'merging' && job.jobId !== options.jobId);
    if (busy) {
      throw storeError('MERGE_NOT_SERIAL', `已有 job 正在 merge: ${busy.jobId}`, { busy: busy.jobId });
    }
    const job = jobOf(registry, options.jobId);
    const attempt = currentAttempt(registry, options.jobId);
    const record = {
      jobId: job.jobId,
      candidateCommit: attempt.candidateCommit,
      integrationBranch: config.repoIdentity.integrationBranch,
      integrationHeadBefore: gate.integrationHead,
      decision: gate.decision.decision,
      effectiveRisk: gate.policy.effectiveRisk,
      openedAt: nowIso(),
    };
    job.mergeIntent = record;
    setJobState(registry, job.jobId, 'merging', { reason: `merge intent ${gate.decision.decision}`, dir });
    appendReceipt(dir, { kind: 'merge-intent', ...record });
    return record;
  });
}

// 阶段二：真实 merge（锁外，因为可能耗时）。--no-ff 保留 job 边界。
export function runIntegrationMerge(options = {}) {
  const { hostRoot } = ctx(options);
  const intent = options.intent;
  const merge = git(hostRoot, ['merge', '--no-ff', '-m',
    `merge(${intent.integrationBranch}): job ${intent.jobId} candidate ${String(intent.candidateCommit).slice(0, 8)}`,
    intent.candidateCommit]);
  return {
    merged: merge.status === 0,
    mergeCommit: merge.status === 0 ? gitOut(hostRoot, ['rev-parse', 'HEAD']) : null,
    detail: merge.status === 0 ? null : String(merge.stderr || merge.stdout || '').slice(0, 600),
  };
}

// 阶段三：把 Git 事实写回 registry。
export function finalizeMerge(options = {}) {
  const { dir, config, hostRoot } = ctx(options);
  const { intent, merged, mergeCommit, detail } = options.result;
  return updateV4Registry(dir, (registry) => {
    const job = jobOf(registry, intent.jobId);
    if (!merged) {
      // merge conflict：不 close、不释放 slot、保留失败证据进 typed disposition。
      git(hostRoot, ['merge', '--abort']);
      job.mergeIntent = { ...intent, closedAt: nowIso(), outcome: 'CONFLICT' };
      setJobState(registry, job.jobId, 'ready-to-merge', { reason: 'merge conflict', dir });
      appendReceipt(dir, { kind: 'merge-failed', jobId: job.jobId, reason: 'MERGE_CONFLICT', detail });
      return { ok: false, code: 'MERGE_CONFLICT', jobId: job.jobId, disposition: 'AWAITING_FIX', detail };
    }
    job.mergeIntent = { ...intent, closedAt: nowIso(), outcome: 'MERGED', mergeCommit };
    registry.deliveries[job.jobId] = {
      schemaVersion: DELIVERY_SCHEMA,
      jobId: job.jobId,
      issue: job.issue,
      candidateCommit: intent.candidateCommit,
      mergeCommit,
      integrationBranch: config.repoIdentity.integrationBranch,
      postMergeVerification: null,
      issueClose: null,
      runnerRelease: null,
    };
    setJobState(registry, job.jobId, 'merged', { reason: 'host merge 完成', dir });
    registry.mergeQueue = registry.mergeQueue.filter((id) => id !== job.jobId);
    appendReceipt(dir, { kind: 'merge', jobId: job.jobId, mergeCommit, candidateCommit: intent.candidateCommit });
    return { ok: true, jobId: job.jobId, mergeCommit, candidateCommit: intent.candidateCommit, state: 'merged' };
  });
}

// 串行 merge 的组合入口。high 档在这里被挡成 humanGate，critical 走 PR-only。
export function masterMerge(options = {}) {
  const { dir } = ctx(options);
  const gate = evaluateGate(options);
  if (!gate.decision.mayMerge) {
    if (gate.decision.decision === 'AWAITING_HUMAN_GATE') {
      return openHumanRequest({
        ...options,
        state: 'awaiting-human',
        kind: 'risk_approval',
        prompt: `Issue #${readV4Registry(dir).jobs[options.jobId].issue} effectiveRisk=${gate.policy.effectiveRisk}，机械门全绿，需人工批准合并`,
        requiredEvidence: [
          `candidate commit ${gate.candidateCommit}`,
          'review/QA receipt 绑定同一 commit',
          ...gate.policy.triggeredRules.map((rule) => `${rule.id}: ${rule.reason}`),
        ],
        context: { gate: gate.decision, policy: gate.policy },
      });
    }
    return { ok: false, jobId: options.jobId, ...gate.decision, policy: gate.policy, mechanical: gate.mechanical };
  }
  const intent = openMergeIntent({ ...options, gate });
  const result = runIntegrationMerge({ ...options, intent });
  return finalizeMerge({ ...options, result: { intent, ...result } });
}

// E8: merge 成功但 post-merge verification 失败 → 不 close、不释放 slot、保留证据。
export function postMergeVerify(options = {}) {
  const { dir, hostRoot } = ctx(options);
  const commands = options.commands || [];
  if (!commands.length) throw storeError('VERIFICATION_COMMANDS_REQUIRED', 'post-merge verification 需要非空命令数组');
  const runs = [];
  let allPassed = true;
  for (const command of commands) {
    const result = options.runner
      ? options.runner(command)
      : spawnSync(command.command, command.args || [], {
        ...HEADLESS_CHILD_OPTIONS, cwd: options.cwd || hostRoot, encoding: 'utf8', timeout: command.timeoutMs || 600_000,
      });
    const passed = result.status === 0;
    if (!passed) allPassed = false;
    runs.push({
      command: `${command.command} ${(command.args || []).join(' ')}`.trim(),
      status: result.status,
      outcome: passed ? 'PASS' : 'FAIL',
      stderr: passed ? null : String(result.stderr || result.stdout || '').slice(0, 600),
    });
  }
  return updateV4Registry(dir, (registry) => {
    const job = jobOf(registry, options.jobId);
    const delivery = registry.deliveries[job.jobId];
    if (!delivery) throw storeError('NO_DELIVERY', `job ${job.jobId} 尚未 merge`, { jobId: job.jobId });
    delivery.postMergeVerification = {
      outcome: allPassed ? 'PASS' : 'FAIL',
      runId: `verify-${String(delivery.mergeCommit).slice(0, 8)}`,
      runs,
      recordedAt: nowIso(),
    };
    appendReceipt(dir, { kind: 'post-merge-verify', jobId: job.jobId, outcome: delivery.postMergeVerification.outcome, runs });
    if (!allPassed) {
      setJobState(registry, job.jobId, 'merged', { reason: 'post-merge verification 失败，保留 merge commit 与证据', dir });
      return {
        ok: false, code: 'POST_MERGE_VERIFICATION_FAILED', jobId: job.jobId,
        disposition: 'HOLD_SLOT_AND_ISSUE', mergeCommit: delivery.mergeCommit,
        issueClosed: false, slotReleased: false, runs,
      };
    }
    setJobState(registry, job.jobId, 'closing', { reason: 'post-merge verification 通过', dir });
    return { ok: true, jobId: job.jobId, outcome: 'PASS', runId: delivery.postMergeVerification.runId };
  });
}

// E9: close 幂等 —— 已关闭且证据 comment digest 相同视为 already-succeeded。
export async function masterClose(options = {}) {
  const { dir, config } = ctx(options);
  const registry = readV4Registry(dir);
  const job = jobOf(registry, options.jobId);
  const delivery = registry.deliveries[job.jobId];
  if (!delivery) throw storeError('NO_DELIVERY', `job ${job.jobId} 尚未 merge`, { jobId: job.jobId });
  if (delivery.postMergeVerification?.outcome !== 'PASS') {
    return { ok: false, code: 'VERIFICATION_NOT_PASSED', jobId: job.jobId, issueClosed: false };
  }
  const body = buildCloseComment(job, delivery);
  const commentDigest = digestOf(body);
  if (delivery.issueClose?.commentDigest === commentDigest
    && ['CLOSED', 'LOCAL_CLOSED'].includes(delivery.issueClose.outcome)) {
    const existing = enqueueIssueClose(dir, {
      jobId: job.jobId, issue: job.issue, repo: config.repoIdentity.issueRepo,
      comment: body, commentDigest,
    });
    return {
      ok: true, outcome: 'ALREADY_SUCCEEDED', jobId: job.jobId, issue: job.issue,
      commentDigest, outbox: existing,
    };
  }
  // #142：close 不联网。registry 落账即终局，GitHub 侧动作入出站队列。
  // gh 在不在，这条命令的返回结构逐字段相同——「GitHub 挂了交付照样落地」
  // 是拓扑保证的，不是靠 try/catch 兜的。
  const enqueued = enqueueIssueClose(dir, {
    jobId: job.jobId,
    issue: job.issue,
    repo: config.repoIdentity.issueRepo,
    comment: body,
    commentDigest,
  });

  const result = updateV4Registry(dir, (writable) => {
    const target = writable.deliveries[job.jobId];
    target.issueClose = { outcome: 'LOCAL_CLOSED', commentDigest, closedAt: nowIso() };
    const released = releaseSlot(writable, job.slotId, { reason: `job ${job.jobId} 已交付，等待 baseline 同步` });
    target.runnerRelease = {
      slotId: job.slotId,
      outcome: released ? 'BASELINE_PENDING' : 'SLOT_MISSING',
      head: target.mergeCommit,
    };
    setJobState(writable, job.jobId, 'closed', { reason: 'Issue 幂等关闭', dir });
    appendReceipt(dir, { kind: 'delivery', jobId: job.jobId, delivery: target });
    return { ok: true, outcome: 'CLOSED', jobId: job.jobId, issue: job.issue, commentDigest, delivery: target };
  });
  return { ...result, outbox: enqueued };
}

function buildCloseComment(job, delivery) {
  return [
    `已交付：${job.jobId}`,
    `candidate: ${delivery.candidateCommit}`,
    `merge: ${delivery.mergeCommit} → ${delivery.integrationBranch}`,
    `post-merge verification: ${delivery.postMergeVerification?.outcome}`,
    '',
    ...(job.acceptance || []).map((entry) => `- ${entry.id}: ${entry.outcome} (${(entry.evidenceRefs || []).join(', ')})`),
  ].join('\n');
}

function defaultGh(repo) {
  return async (args) => {
    const configured = process.env.AES_WORKTREE_BOARD_GH_COMMAND;
    const base = configured ? JSON.parse(configured) : ['gh'];
    const result = spawnSync(base[0], [...base.slice(1), ...args, '--repo', repo], {
      ...HEADLESS_CHILD_OPTIONS, encoding: 'utf8',
    });
    if (result.status !== 0) {
      throw storeError('GH_COMMAND_FAILED', `gh ${args[0]} ${args[1]} 失败`, {
        stderr: String(result.stderr || '').slice(0, 400),
      });
    }
    return result;
  };
}

// baseline 恢复：交付后把 slot 同步回 integration HEAD 才重新可领取（B3/B19）。
export function releaseAndSync(options = {}) {
  const { dir, config } = ctx(options);
  const slot = slotById(config, options.slotId);
  const sync = options.syncOverride
    ? options.syncOverride(slot)
    : syncSlotBaseline(slot, {
      integrationBranch: config.repoIdentity.integrationBranch,
      expectedRoot: config.repoIdentity.root,
    });
  return updateV4Registry(dir, (registry) => {
    registry.runners = projectRunners(config, registry, options.probeOverride ? { probe: options.probeOverride } : {});
    const runner = registry.runners[options.slotId];
    const delivery = options.jobId ? registry.deliveries[options.jobId] : null;
    if (delivery) delivery.runnerRelease = { slotId: options.slotId, outcome: 'BASELINE_READY', head: sync.head };
    appendTransition(dir, { kind: 'runner', slotId: options.slotId, to: runner?.state || 'unknown', reason: 'baseline 同步' });
    return { ok: true, slotId: options.slotId, sync, state: runner?.state || null, claimable: Boolean(runner?.claimable) };
  });
}

// ---------------------------------------------------------------- discovery

export async function masterDiscovery(options = {}) {
  const { dir, config } = ctx(options);
  const wayfinder = options.wayfinder || makeWayfinder({
    gh: options.gh || defaultGh(config.repoIdentity.issueRepo),
    repo: config.repoIdentity.issueRepo,
  });
  const registry = readV4Registry(dir);
  const disposition = await disposeDiscovery({ registry, dir, payload: options.payload, wayfinder });
  return updateV4Registry(dir, (writable) => {
    writable.discoveries[disposition.discoveryId] = registry.discoveries[disposition.discoveryId];
    if (disposition.currentJobDisposition !== 'CONTINUE' && writable.jobs[options.payload.jobId]) {
      const next = disposition.currentJobDisposition === 'BLOCKED_DEPENDENCY' ? 'blocked-dependency' : 'contract-conflict';
      if (writable.jobs[options.payload.jobId].state !== next) {
        setJobState(writable, options.payload.jobId, next, { reason: `discovery ${disposition.discoveryId}`, dir });
      }
    }
    return disposition;
  });
}

// ---------------------------------------------------------------- 重启 reconcile

// 目标 A 的核心可验收点：Master 死亡后重启，仅凭 registry/inbox/receipts + Git 恢复。
// 输出必须对每个 slot 与 job 给出可解释状态，且不得产生重复 merge / 丢失 job / 假完成。
export function masterReconcile(options = {}) {
  const { dir, config, hostRoot } = ctx(options);
  const integrationBranch = config.repoIdentity.integrationBranch;
  const ancestorCheck = options.isAncestor || ((candidate) => isAncestor(hostRoot, candidate, integrationBranch));

  return updateV4Registry(dir, (registry) => {
    registry.runners = projectRunners(config, registry, options.probeOverride ? { probe: options.probeOverride } : {});
    const actions = [];
    const jobExplanations = [];

    for (const job of Object.values(registry.jobs)) {
      const attempt = job.currentAttemptId ? registry.attempts[job.currentAttemptId] : null;

      if (job.state === 'merging') {
        // 中断点 3 的判定核心：问 Git，不问状态位。
        const candidate = job.mergeIntent?.candidateCommit || attempt?.candidateCommit;
        const reallyMerged = ancestorCheck(candidate);
        if (reallyMerged) {
          const mergeCommit = job.mergeIntent?.mergeCommit
            || gitOut(hostRoot, ['rev-parse', integrationBranch]);
          registry.deliveries[job.jobId] ||= {
            schemaVersion: DELIVERY_SCHEMA,
            jobId: job.jobId,
            issue: job.issue,
            candidateCommit: candidate,
            mergeCommit,
            integrationBranch,
            postMergeVerification: null,
            issueClose: null,
            runnerRelease: null,
          };
          setJobState(registry, job.jobId, 'merged', { reason: 'reconcile: git ancestry 证实 merge 已发生', dir });
          registry.mergeQueue = registry.mergeQueue.filter((id) => id !== job.jobId);
          actions.push({ jobId: job.jobId, action: 'ADOPT_EXISTING_MERGE', mergeCommit });
        } else {
          setJobState(registry, job.jobId, 'ready-to-merge', { reason: 'reconcile: git ancestry 证实 merge 未发生', dir });
          if (!registry.mergeQueue.includes(job.jobId)) registry.mergeQueue.push(job.jobId);
          actions.push({ jobId: job.jobId, action: 'REQUEUE_FOR_MERGE' });
        }
      } else if (job.state === 'ready-to-merge') {
        // 中断点 2：可能 merge 其实已经完成但状态位没写（更早崩溃）。仍以 Git 为准。
        const candidate = attempt?.candidateCommit;
        if (candidate && ancestorCheck(candidate)) {
          setJobState(registry, job.jobId, 'merged', { reason: 'reconcile: candidate 已在 integration 中', dir });
          registry.mergeQueue = registry.mergeQueue.filter((id) => id !== job.jobId);
          actions.push({ jobId: job.jobId, action: 'ADOPT_EXISTING_MERGE' });
        } else {
          // 已经正确排好队的 job 同样要出现在动作列表里。
          // 只报「纠正性」动作会让 reconcile 的输出无法回答「下一步做什么」——
          // 一个就绪且排好队的 job 会安静地不产生任何动作，驱动方于是看不到它。
          const requeued = !registry.mergeQueue.includes(job.jobId);
          if (requeued) registry.mergeQueue.push(job.jobId);
          actions.push({ jobId: job.jobId, action: 'REQUEUE_FOR_MERGE', requeued });
        }
      } else if (job.state === 'merged' || job.state === 'closing') {
        // 中断点 4：merge 成功但 close 前中断。close 幂等，直接续跑，不重复 merge。
        const delivery = registry.deliveries[job.jobId];
        if (delivery?.postMergeVerification?.outcome === 'PASS' && !delivery.issueClose) {
          actions.push({ jobId: job.jobId, action: 'RESUME_CLOSE' });
        } else if (!delivery?.postMergeVerification) {
          actions.push({ jobId: job.jobId, action: 'RESUME_POST_MERGE_VERIFY' });
        } else if (delivery.postMergeVerification.outcome === 'FAIL') {
          actions.push({ jobId: job.jobId, action: 'HOLD_FAILED_VERIFICATION' });
        }
      } else if (job.state === 'dispatched') {
        // 中断点 1：owner thread 状态未知。优先恢复原 thread，不直接新建 attempt。
        const runner = registry.runners[job.slotId];
        if (!runner || runner.lease?.jobId !== job.jobId) {
          if (runner && !runner.state.startsWith('QUARANTINED_')) {
            runner.lease = { jobId: job.jobId, attemptId: job.currentAttemptId, acquiredAt: nowIso() };
            runner.state = 'leased';
            runner.claimable = false;
            actions.push({ jobId: job.jobId, action: 'REATTACH_LEASE', slotId: job.slotId });
          } else {
            actions.push({ jobId: job.jobId, action: 'AWAIT_SLOT_RECOVERY', slotId: job.slotId, slotState: runner?.state || 'MISSING' });
          }
        } else {
          actions.push({ jobId: job.jobId, action: 'PROBE_OWNER_THREAD', attemptId: job.currentAttemptId });
        }
      } else if (HUMAN_STATES.includes(job.state)) {
        // 中断点 4'：awaiting-human。载荷必须仍然合法，否则是不可解释状态，必须报告而不是猜。
        const request = job.humanRequestId ? registry.humanRequests[job.humanRequestId] : null;
        try {
          validateHumanRequest(request, { state: job.state });
          actions.push({ jobId: job.jobId, action: 'AWAIT_HUMAN', resumeToken: request.resumeToken, kind: request.kind });
        } catch (error) {
          actions.push({ jobId: job.jobId, action: 'UNEXPLAINED_HUMAN_STATE', code: error.code, detail: error.message });
        }
      } else if (job.state === 'budget-exhausted' || job.state === 'blocked-dependency') {
        actions.push({ jobId: job.jobId, action: 'AWAIT_MASTER_POLICY', state: job.state });
      } else if (job.state === 'queued') {
        actions.push({ jobId: job.jobId, action: 'DISPATCH_NEW_ATTEMPT' });
      }

      jobExplanations.push({
        jobId: job.jobId,
        issue: job.issue,
        state: job.state,
        attemptId: job.currentAttemptId,
        attempts: job.attemptIds.length,
        slotId: job.slotId,
        candidateCommit: attempt?.candidateCommit || null,
        explained: true,
      });
    }

    // 每个 slot 都必须有可解释状态（B21）。
    // #78：残留租约是不可解释状态 —— lease 指向的 job 当前并不落在这个 slot
    // （job.slotId 指向别处，即同一 jobId 持有多个 slot 租约的残留侧），或 job 根本
    // 不存在（孤儿租约）。改派后旧租约残留会把干净 slot 永久占住，且 status 看不出
    // 这是残留；这里如实报 unexplained，不替系统圆场。
    const slotExplanations = Object.values(registry.runners).map((runner) => {
      const lease = runner.lease || null;
      const leasedJob = lease ? registry.jobs[lease.jobId] || null : null;
      const staleLease = Boolean(lease && (!leasedJob || leasedJob.slotId !== runner.slotId));
      const staleDetail = staleLease
        ? `残留租约：job ${lease.jobId} ${leasedJob ? `当前登记在 ${leasedJob.slotId}` : '不存在于 registry'}`
        : null;
      return {
        slotId: runner.slotId,
        state: runner.state,
        reason: staleLease ? [runner.reason, staleDetail].filter(Boolean).join('；') : runner.reason,
        recovery: staleLease
          ? '人工确认 job 已迁移/终结后清理该 slot 的残留租约（编排不自动清理，避免误伤在途 job）'
          : (runner.recovery || null),
        lease,
        staleLease,
        explained: Boolean(runner.reason) && !staleLease,
      };
    });

    registry.master.lastReconcileAt = nowIso();
    registry.master.state = 'running';
    // mergeQueue 去重：重启后同一 job 不得出现两次，否则会被 merge 两遍。
    registry.mergeQueue = [...new Set(registry.mergeQueue)];
    appendTransition(dir, { kind: 'master', to: 'reconciled', actions: actions.length });

    return {
      ok: true,
      generation: registry.master.generation,
      actions,
      jobs: jobExplanations,
      slots: slotExplanations,
      mergeQueue: registry.mergeQueue,
      unexplainedJobs: jobExplanations.filter((entry) => !entry.explained).length,
      unexplainedSlots: slotExplanations.filter((entry) => !entry.explained).length,
      duplicateMergeRisk: registry.mergeQueue.length !== new Set(registry.mergeQueue).size,
    };
  });
}

// reconcile 算出的动作里，哪些是 Master 能自己执行完的。
// 其余（探测 owner thread、等 slot 恢复、等人工、等策略）都需要本进程之外的输入，
// next-step 只能跳过它们并如实说明 —— 沉默跳过会让「无可推进」这个结论不可解释。
const MACHINE_ACTIONABLE = Object.freeze({
  REQUEUE_FOR_MERGE: 'merge',
  RESUME_POST_MERGE_VERIFY: 'verify',
  RESUME_CLOSE: 'close',
});

// 把 reconcile 的结论直接执行掉一步。无人值守循环因此不需要调用方自己解析
// reconcile 输出再拼装命令 —— 那层拼装既没有测试覆盖，也是重启后行为漂移的来源。
export async function masterNextStep(options = {}) {
  const { dir } = ctx(options);
  const reconciled = masterReconcile(options);
  const registry = readV4Registry(dir);

  const skipped = [];
  let target = null;
  for (const action of reconciled.actions) {
    const job = registry.jobs[action.jobId];
    // 人工态永远不由 next-step 推进：等人就是等人，不是「暂时没轮到」。
    if (job && HUMAN_STATES.includes(job.state)) {
      skipped.push({ jobId: action.jobId, action: action.action, reason: `人工态 ${job.state}，只能由人工答复推进` });
      continue;
    }
    const kind = MACHINE_ACTIONABLE[action.action];
    if (!kind) {
      skipped.push({ jobId: action.jobId, action: action.action, reason: '需要本进程之外的输入' });
      continue;
    }
    if (kind === 'verify' && !options.commands) {
      skipped.push({ jobId: action.jobId, action: action.action, reason: '缺少 post-merge verification 命令' });
      continue;
    }
    target = { ...action, kind, job };
    break;
  }

  if (!target) {
    return {
      ok: true, outcome: 'NOOP', reason: '没有可由 Master 自行推进的 job',
      skipped, jobs: reconciled.jobs.length,
    };
  }

  const shared = { ...options, jobId: target.jobId };
  let result;
  if (target.kind === 'merge') result = masterMerge(shared);
  else if (target.kind === 'verify') result = postMergeVerify({ ...shared, commands: options.commands });
  else result = await masterClose(shared);

  return {
    ok: result.ok !== false,
    outcome: 'ADVANCED',
    jobId: target.jobId,
    action: target.action,
    kind: target.kind,
    result,
    skipped,
  };
}

// B21: fresh runner registry + job queue + inbox + Issue graph 同时为空/terminal 才 STOP。
export function evaluateStop(options = {}) {
  const { dir, config } = ctx(options);
  const registry = readV4Registry(dir);
  const runners = projectRunners(config, registry, options.probeOverride ? { probe: options.probeOverride } : {});
  const liveJobs = Object.values(registry.jobs).filter((job) => !['closed', 'abandoned'].includes(job.state));
  const openHuman = Object.values(registry.humanRequests).filter((request) => request.open);
  const busySlots = Object.values(runners).filter((runner) => runner.lease);
  const frontier = options.frontierCount ?? 0;
  const mayStop = !liveJobs.length && !busySlots.length && !registry.mergeQueue.length && frontier === 0;
  return {
    ok: true,
    mayStop,
    reason: mayStop ? 'registry / merge queue / frontier 同时为空' : 'still-live',
    liveJobs: liveJobs.map((job) => ({ jobId: job.jobId, state: job.state })),
    openHumanRequests: openHuman.map((request) => ({ resumeToken: request.resumeToken, kind: request.kind })),
    busySlots: busySlots.map((runner) => runner.slotId),
    mergeQueue: registry.mergeQueue,
    frontier,
  };
}

// ---------------------------------------------------------------- CLI

// #76：CLI 参数是闭集，未知参数 fail closed —— 与产品「未知 schema、缺字段、非闭集值
// 必须 fail closed」的既有口径一致，参数层不例外。静默丢弃曾让 `--required-evidence`
// 全部蒸发、human open 送出证据为空的盲签请求且 ok:true。
const FLAG_OPTIONS = Object.freeze(['force', 'json']);
// 可重复累积的参数：值语义是列表（与报文字段对齐），重复出现是合法输入。
const REPEATABLE_OPTIONS = Object.freeze(['evidence']);
const KNOWN_OPTIONS = Object.freeze(new Set([
  ...FLAG_OPTIONS, ...REPEATABLE_OPTIONS,
  'dir', 'slots', 'paths', 'repo', 'prefix', 'host', 'branch', 'issue-repo',
  'legacy-runtime', 'commands-file', 'frontier',
  'issue', 'issue-file', 'slot', 'model-tier', 'budgets',
  'job', 'commit', 'payload', 'payload-file', 'commands',
  'resume-token', 'response', 'response-file',
  'state', 'kind', 'prompt', 'reason',
  'entry', 'actor',
]));

function parseArguments(argv) {
  const options = {};
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      positional.push(value);
      continue;
    }
    const key = value.slice(2);
    if (!KNOWN_OPTIONS.has(key)) {
      throw storeError('UNKNOWN_OPTION', `未知参数 --${key}，拒绝执行（未知参数不静默丢弃）`, {
        key,
        // 近似参数给出指路：报文字段叫 requiredEvidence，CLI 参数却叫 --evidence，
        // 这个不对称正是 #76 的诱因，报错必须替用户把路指对。
        hint: key === 'required-evidence' ? '证据清单请使用可重复的 --evidence' : null,
      });
    }
    if (FLAG_OPTIONS.includes(key)) {
      options[key] = true;
      continue;
    }
    const raw = argv[++index];
    if (raw === undefined) throw storeError('BAD_REQUEST', `参数 --${key} 缺少值`, { key });
    if (REPEATABLE_OPTIONS.includes(key)) {
      (options[key] ||= []).push(raw);
      continue;
    }
    // 非累积参数重复出现：静默 last-wins 会无声吞掉前面的值，fail closed。
    if (key in options) {
      throw storeError('DUPLICATE_OPTION', `参数 --${key} 重复出现，拒绝静默取最后一个值`, {
        key, previous: options[key], duplicate: raw,
      });
    }
    options[key] = raw;
  }
  return { options, positional };
}

// --evidence 支持两种形态并可重复累积：纯字符串（一条证据），或 JSON 数组字符串
// （历史形态，向下兼容）。以 [ 开头却解析失败的输入直接报错，不静默当作普通字符串吞掉。
function evidenceListFrom(values = []) {
  const list = [];
  for (const value of values) {
    if (String(value).trimStart().startsWith('[')) {
      let parsed;
      try {
        parsed = JSON.parse(value);
      } catch (error) {
        throw storeError('BAD_EVIDENCE', `--evidence 的 JSON 数组解析失败: ${error.message}`, { value });
      }
      if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string' || !item.trim())) {
        throw storeError('BAD_EVIDENCE', '--evidence 的 JSON 形态必须是非空字符串数组', { value });
      }
      list.push(...parsed);
    } else {
      list.push(value);
    }
  }
  return list;
}

function payloadFrom(options, key = 'payload') {
  if (options[`${key}-file`]) return JSON.parse(readFileSync(resolve(options[`${key}-file`]), 'utf8'));
  if (options[key]) return JSON.parse(options[key]);
  throw storeError('BAD_REQUEST', `需要 --${key} 或 --${key}-file`);
}

// runner init/update 必须在 ctx() 之前处理：ctx() 会 loadSlotsConfig，
// 而这两条命令的存在意义恰恰是「配置还不存在时把它造出来」。
function runnerCommand(action, options) {
  const paths = String(requireValue(options, 'paths')).split(',').map((value) => value.trim()).filter(Boolean);
  const slots = defaultSlotsFromWorktrees(paths, {
    repoRoot: options.repo || process.cwd(),
    prefix: options.prefix || 'worker',
  });
  if (!slots.length) {
    throw storeError('RUNNER_SLOTS_EMPTY', '--paths 未给出任何有效 worker worktree', {
      repo: options.repo || process.cwd(),
    });
  }
  const shape = {
    path: options.slots,
    hostWorktree: options.host || null,
    repoIdentity: {
      root: options.repo || process.cwd(),
      integrationBranch: options.branch || 'dev',
      issueRepo: requireValue(options, 'issue-repo'),
    },
    slots,
  };
  return action === 'update' ? updateSlots(shape) : initSlots(shape);
}

function requireValue(options, key) {
  const value = options[key];
  if (!value) throw storeError('BAD_REQUEST', `缺少必需参数 --${key}`, { key });
  return value;
}

async function main(argv = process.argv.slice(2)) {
  const { options, positional } = parseArguments(argv);
  const [command, action] = positional;
  const shared = { dir: options.dir, slotsPath: options.slots };

  if (command === 'runner' && (action === 'init' || action === 'update')) {
    return runnerCommand(action, options);
  }
  if (command === 'start') return masterStart({ ...shared, legacyRuntimeDir: options['legacy-runtime'] });
  if (command === 'status') return masterStatus(shared);
  if (command === 'reconcile') return masterReconcile(shared);
  if (command === 'next-step') {
    return masterNextStep({
      ...shared,
      commands: options['commands-file'] ? JSON.parse(readFileSync(resolve(options['commands-file']), 'utf8')) : null,
    });
  }
  if (command === 'stop' && action === 'eval') {
    return evaluateStop({ ...shared, frontierCount: Number(options.frontier || 0) });
  }
  if (command === 'claim') {
    return masterClaim({
      ...shared, issue: payloadFrom(options, 'issue'), slotId: options.slot,
      modelTier: options['model-tier'], budgets: options.budgets ? JSON.parse(options.budgets) : {},
    });
  }
  if (command === 'candidate') return recordCandidate({ ...shared, jobId: options.job, commitSha: options.commit });
  if (command === 'stage') {
    return recordStageResult({ ...shared, jobId: options.job, stage: action, payload: payloadFrom(options) });
  }
  if (command === 'terminal') return masterTerminal({ ...shared, payload: payloadFrom(options) });
  if (command === 'gate') return evaluateGate({ ...shared, jobId: options.job });
  if (command === 'merge') return masterMerge({ ...shared, jobId: options.job });
  if (command === 'verify') {
    return postMergeVerify({ ...shared, jobId: options.job, commands: payloadFrom(options, 'commands') });
  }
  if (command === 'close') return masterClose({ ...shared, jobId: options.job });
  if (command === 'outbox') {
    // 走同一条 ctx() 解析链：dir 的 env override 与 slots 配置口径必须与其余子命令一致，
    // 否则 outbox 会在另一个 registry 目录上自说自话（#131 偏差 4 的同族陷阱）。
    const { dir, config } = ctx(shared);
    if (action === 'flush') {
      return flushOutbox(dir, { gh: options.gh || defaultGh(config.repoIdentity.issueRepo) });
    }
    if (action === 'status') return outboxStatus(dir);
    if (action === 'acknowledge') {
      return acknowledgeEntry(dir, {
        entryId: options.entry, reason: options.reason, actor: options.actor || 'human',
      });
    }
    throw storeError('BAD_REQUEST', '用法: outbox flush|outbox status|outbox acknowledge');
  }
  if (command === 'release') return releaseAndSync({ ...shared, jobId: options.job, slotId: options.slot });
  if (command === 'discovery') return masterDiscovery({ ...shared, payload: payloadFrom(options) });
  if (command === 'attempt' && action === 'interrupt') {
    return attemptInterrupt({ ...shared, jobId: options.job, reason: options.reason });
  }
  if (command === 'attempt' && action === 'resume') return attemptResume({ ...shared, jobId: options.job });
  if (command === 'attempt' && action === 'new') {
    return attemptNew({ ...shared, jobId: options.job, slotId: options.slot, force: Boolean(options.force) });
  }
  if (command === 'human' && action === 'open') {
    return openHumanRequest({
      ...shared, jobId: options.job, state: options.state, kind: options.kind, prompt: options.prompt,
      // 重复 --evidence 累积；为空时 openHumanRequest 自会 fail closed（#76）。
      requiredEvidence: evidenceListFrom(options.evidence),
    });
  }
  if (command === 'human' && action === 'respond') {
    return respondHumanRequest({ ...shared, resumeToken: options['resume-token'], response: payloadFrom(options, 'response') });
  }
  throw storeError('BAD_REQUEST', '用法: master.mjs runner init|runner update|start|status|reconcile|next-step|stop eval|claim|candidate|stage review|stage qa|terminal|gate|merge|verify|close|outbox flush|outbox status|outbox acknowledge|release|discovery|attempt interrupt|attempt resume|attempt new|human open|human respond');
}

if (resolve(process.argv[1] || '') === resolve(fileURLToPath(import.meta.url))) {
  try {
    const result = await main();
    console.log(JSON.stringify(result));
    process.exitCode = result.ok === false ? 1 : 0;
  } catch (error) {
    console.error(JSON.stringify({
      ok: false, code: error.code || 'INTERNAL', message: error.message, ...(error.details || {}),
    }));
    process.exitCode = error.exitCode || 1;
  }
}
