#!/usr/bin/env node
// AC-001 / AC-002 / AC-004 / AC-005 的 scenario 实现。
// 全部跑在真实临时 Git 仓上；GitHub 侧全程 fake，不写真实仓库。
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { HEADLESS_CHILD_OPTIONS } from './headless.mjs';
import { readV4Registry, readReceipts, readTransitions, updateV4Registry } from './job-store.mjs';
import {
  defaultSlotsFromWorktrees, discoverWorktrees, initSlots, loadSlotsConfig, normalizePath,
  projectRunners, validateSlotsConfig,
} from './runner-slots.mjs';
import { HUMAN_REQUEST_SCHEMA } from './human-request.mjs';
import { decideMerge, evaluateMechanicalGate, resolveMergePolicy } from './merge-policy.mjs';
import * as master from './master.mjs';
import { readOutbox, readOutboxHistory } from './outbox-store.mjs';
import {
  git, gitOut, issuePayload, makeCandidate, makeConflict, makeFixture, SCRIPT_DIR,
} from './selftest-fixture.mjs';

const MASTER_CLI = join(SCRIPT_DIR, 'master.mjs');

function writeSlots(fixture, slots = fixture.slots) {
  return initSlots({ path: fixture.slotsPath, repoIdentity: fixture.repoIdentity, slots, force: true });
}

function base(fixture) {
  return { dir: fixture.v4Dir, slotsPath: fixture.slotsPath };
}

// 「重启 Master」在这里是字面意义的：另一个 Node 进程，只能看见落盘状态。
function freshProcess(fixture, args, { expectStatus = 0, env = {} } = {}) {
  const result = spawnSync(process.execPath, [MASTER_CLI, ...args, '--dir', fixture.v4Dir, '--slots', fixture.slotsPath], {
    ...HEADLESS_CHILD_OPTIONS, encoding: 'utf8', cwd: fixture.repoRoot, env: { ...process.env, ...env },
  });
  if (expectStatus === 'nonzero') {
    assert.notEqual(result.status, 0,
      `master ${args.join(' ')} 期望非零退出，实际 0: ${result.stdout}`);
  } else {
    assert.equal(result.status, expectStatus,
      `master ${args.join(' ')} 期望退出码 ${expectStatus}，实际 ${result.status}: ${result.stderr || result.stdout}`);
  }
  const text = result.status === 0 ? result.stdout : result.stderr || result.stdout;
  return JSON.parse(String(text).trim().split(/\r?\n/).pop());
}

// v2：#65 + AC-007 合流后的默认现行格式——review 类同时携带 baseCommit（AC-007，
// GATE-review-base 对它生效）与 reviewerSessionId（#65，缺失 fail closed）。
function passingReview(jobId, commitSha, baseCommit, reviewerSessionId = 'reviewer-default') {
  return {
    schemaVersion: master.STAGE_RESULT_SCHEMA_V2,
    jobId, stage: 'code-review', commitSha, baseCommit, outcome: 'PASS', findings: [],
    evidence: [{ kind: 'standards', result: 'PASS' }, { kind: 'spec', result: 'PASS' }],
    mayAdvance: true,
    reviewerSessionId,
  };
}

// qa 类 v2 只强制 baseCommit——reviewerSessionId 不适用于 qa。
function passingQa(jobId, commitSha, baseCommit) {
  return {
    schemaVersion: master.QA_RECEIPT_SCHEMA_V2,
    jobId, commitSha, baseCommit, outcome: 'PASS',
    environment: { kind: 'local-live', identityDigest: 'sha256:env-test' },
    checks: [{ id: 'QA-1', kind: 'automated', outcome: 'PASS', command: 'node run-tests.mjs' }],
    unexecuted: [], manualDebt: [],
  };
}

// v1：历史轨迹夹具锁定证据的原始语义，不带 baseCommit / reviewerSessionId，永远合法——
// GATE-review-base/qa-base 与 MISSING_REVIEWER_SESSION_ID 对它都豁免（向下兼容）。
function passingReviewV1(jobId, commitSha) {
  return {
    schemaVersion: master.STAGE_RESULT_SCHEMA_V1,
    jobId, stage: 'code-review', commitSha, outcome: 'PASS', findings: [],
    evidence: [{ kind: 'standards', result: 'PASS' }, { kind: 'spec', result: 'PASS' }],
    mayAdvance: true,
  };
}

function passingQaV1(jobId, commitSha) {
  return {
    schemaVersion: master.QA_RECEIPT_SCHEMA_V1,
    jobId, commitSha, outcome: 'PASS',
    environment: { kind: 'local-live', identityDigest: 'sha256:env-test' },
    checks: [{ id: 'QA-1', kind: 'automated', outcome: 'PASS', command: 'node run-tests.mjs' }],
    unexecuted: [], manualDebt: [],
  };
}

function readyTerminal(job, commitSha, contractDigest) {
  return {
    schemaVersion: 'aes.issue-worker.goal-terminal/v1',
    jobId: job.jobId, attemptId: job.attemptId, outcome: 'READY_TO_MERGE',
    issue: job.issue, contractDigest, baseCommit: job.baseCommit, candidateCommit: commitSha,
    acceptance: [{ id: 'AC-1', outcome: 'PASS', evidenceRefs: ['review:R-1', 'qa:QA-1'] }],
    reviewReceipt: 'review-R-1', qaReceipt: 'qa-QA-1',
    unresolvedMustFix: [], unexecutedRequiredChecks: [],
  };
}

// 把一个 job 从 claim 推到 READY_TO_MERGE。返回 jobId 与 candidate。
function driveToReadyToMerge(fixture, issue, { slotId, ownerThreadId = 'owner-session-1', reviewerSessionId } = {}) {
  const claim = master.masterClaim({ ...base(fixture), issue, slotId });
  assert.equal(claim.outcome, 'CLAIMED', `claim 失败: ${JSON.stringify(claim)}`);
  const baseCommit = claim.workOrder.runner.baseCommit;

  // 设置 ownerThreadId 用于独立性测试（直接修改 registry）
  master.setAttemptOwnerThreadId({ ...base(fixture), jobId: claim.jobId, ownerThreadId });

  const candidate = makeCandidate(fixture, claim.slotId, { file: `feature-${issue.number}.txt` });
  master.recordCandidate({ ...base(fixture), jobId: claim.jobId, commitSha: candidate });

  // 使用提供的或默认的 reviewer session id：如果没指定，就用 ownerThreadId 来测试 same-session
  const actualReviewerSessionId = reviewerSessionId || ownerThreadId;
  master.recordStageResult({ ...base(fixture), jobId: claim.jobId, stage: 'review', payload: passingReview(claim.jobId, candidate, baseCommit, actualReviewerSessionId) });
  master.recordStageResult({ ...base(fixture), jobId: claim.jobId, stage: 'qa', payload: passingQa(claim.jobId, candidate, baseCommit) });
  const terminal = master.masterTerminal({
    ...base(fixture),
    payload: readyTerminal(
      { jobId: claim.jobId, attemptId: claim.attemptId, issue: issue.number, baseCommit },
      candidate, claim.workOrder.issue.contractDigest,
    ),
  });
  assert.equal(terminal.state, 'ready-to-merge');
  return { jobId: claim.jobId, attemptId: claim.attemptId, candidate, slotId: claim.slotId, claim, baseCommit };
}

function driveToClosing(fixture, issueNumber) {
  writeSlots(fixture);
  master.masterStart({ ...base(fixture) });
  const job = driveToReadyToMerge(fixture, issuePayload({ number: issueNumber }));
  assert.equal(master.masterMerge({ ...base(fixture), jobId: job.jobId }).ok, true);
  assert.equal(master.postMergeVerify({
    ...base(fixture), jobId: job.jobId,
    commands: [{ command: process.execPath, args: ['-e', 'process.exit(0)'] }],
  }).outcome, 'PASS');
  return job;
}

export async function outboxCloseScenario() {
  const fixture = makeFixture('outbox-close', { workers: [{ id: 'worker-1' }] });
  try {
    const job = driveToClosing(fixture, 601);
    let calls = 0;
    const closed = await master.masterClose({
      ...base(fixture), jobId: job.jobId,
      gh: async () => { calls += 1; throw new Error('close 不得调用 gh'); },
    });
    assert.equal(calls, 0, 'close 命令内 gh 调用次数必须为 0');
    assert.equal(closed.outcome, 'CLOSED');
    assert.equal(readV4Registry(fixture.v4Dir).jobs[job.jobId].state, 'closed');
    assert.equal(readV4Registry(fixture.v4Dir).runners['worker-1'].lease, null);
    assert.equal(readOutbox(fixture.v4Dir)[0].state, 'pending');

    const repeated = await master.masterClose({
      ...base(fixture), jobId: job.jobId,
      gh: async () => { calls += 1; return { stdout: '' }; },
    });
    assert.equal(calls, 0, '幂等 close 同样不得调用 gh');
    assert.equal(repeated.outbox.enqueued, false);
    assert.equal(readOutbox(fixture.v4Dir).length, 1, '幂等 close 不得重复入队');
    assert.deepEqual(Object.keys(closed).sort(), ['commentDigest', 'delivery', 'issue', 'jobId', 'ok', 'outbox', 'outcome'].sort());
  } finally {
    fixture.cleanup();
  }
}

export async function outboxFlushScenario() {
  const fixture = makeFixture('outbox-flush', { workers: [{ id: 'worker-1' }] });
  try {
    const job = driveToClosing(fixture, 602);
    await master.masterClose({ ...base(fixture), jobId: job.jobId });
    let fail = true;
    const gh = async () => {
      if (fail) { const error = new Error('HTTP 503'); error.code = 'GH_COMMAND_FAILED'; throw error; }
      return { stdout: '' };
    };
    const first = await master.masterOutboxFlush({ ...base(fixture), gh });
    assert.equal(first.ok, true); assert.equal(first.failed, 1); assert.equal(first.entries[0].attempt, 1);
    const second = await master.masterOutboxFlush({ ...base(fixture), gh });
    assert.equal(second.failed, 1); assert.equal(second.entries[0].attempt, 2);
    const third = await master.masterOutboxFlush({ ...base(fixture), gh });
    assert.equal(third.abandoned, 1); assert.equal(third.entries[0].attempts, 3);
    const skipped = await master.masterOutboxFlush({ ...base(fixture), gh });
    assert.equal(skipped.failed, 0); assert.equal(skipped.abandoned, 0); assert.equal(skipped.remaining, 0);

    const successFixture = makeFixture('outbox-flush-success', { workers: [{ id: 'worker-1' }] });
    try {
      const successJob = driveToClosing(successFixture, 603);
      await master.masterClose({ ...base(successFixture), jobId: successJob.jobId });
      fail = false;
      let successCalls = 0;
      const concurrentGh = async () => { successCalls += 1; await new Promise((resolveWait) => setTimeout(resolveWait, 10)); return { stdout: '' }; };
      const concurrent = await Promise.all([
        master.masterOutboxFlush({ ...base(successFixture), gh: concurrentGh }),
        master.masterOutboxFlush({ ...base(successFixture), gh: concurrentGh }),
      ]);
      assert.deepEqual(concurrent.map((result) => result.flushed).sort(), [0, 1], '并发 flush 只能有一个领取 pending 条目');
      assert.equal(successCalls, 2, '同一 issue-close 只能发送一次 comment + close');
      assert.equal(concurrent[0].remaining + concurrent[1].remaining, 0);
      const idempotent = await master.masterOutboxFlush({ ...base(successFixture), gh: async () => { throw new Error('succeeded 不得重送'); } });
      assert.equal(idempotent.flushed, 0); assert.equal(idempotent.skipped, 1);
      const emptyFixture = makeFixture('outbox-flush-empty', { workers: [{ id: 'worker-1' }] });
      try {
        writeSlots(emptyFixture);
        const empty = freshProcess(emptyFixture, ['outbox', 'flush'], { env: { AES_WORKTREE_BOARD_GH_COMMAND: JSON.stringify([process.execPath, '-e', 'process.exit(9)']) } });
        assert.deepEqual(empty, { ok: true, flushed: 0, skipped: 0, failed: 0, abandoned: 0, remaining: 0, entries: [] });
      } finally { emptyFixture.cleanup(); }
    } finally { successFixture.cleanup(); }
  } finally {
    fixture.cleanup();
  }
}

export async function outboxAckScenario() {
  const fixture = makeFixture('outbox-ack', { workers: [{ id: 'worker-1' }] });
  try {
    const job = driveToClosing(fixture, 604);
    const closed = await master.masterClose({ ...base(fixture), jobId: job.jobId });
    const entryId = closed.outbox.entryId;
    const notAbandoned = master.masterOutboxAcknowledge({ ...base(fixture), entryId, reason: 'too early' });
    assert.equal(notAbandoned.code, 'NOT_ABANDONED');
    const missing = freshProcess(fixture, ['outbox', 'acknowledge', '--entry', entryId], { expectStatus: 'nonzero' });
    assert.equal(missing.code, 'REASON_REQUIRED');
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await master.masterOutboxFlush({ ...base(fixture), gh: async () => { throw new Error('unreachable'); } });
    }
    const acknowledged = master.masterOutboxAcknowledge({ ...base(fixture), entryId, reason: 'merge abc123 已落地；Issue 永久不可达' });
    assert.equal(acknowledged.outcome, 'ACKNOWLEDGED');
    const again = master.masterOutboxAcknowledge({ ...base(fixture), entryId, reason: '不同文案不得覆盖首次签收' });
    assert.equal(again.outcome, 'ALREADY_ACKNOWLEDGED');
    assert.equal(readOutbox(fixture.v4Dir)[0].state, 'acknowledged');
    assert.ok(readOutboxHistory(fixture.v4Dir).some((entry) => entry.state === 'abandoned'), 'abandoned 历史行必须仍可读');
  } finally { fixture.cleanup(); }
}

export async function outboxGateScenario() {
  const fixture = makeFixture('outbox-gate', { workers: [{ id: 'worker-1' }, { id: 'worker-2' }] });
  try {
    writeSlots(fixture);
    master.masterStart({ ...base(fixture) });
    const gateJob = driveToReadyToMerge(fixture, issuePayload({ number: 605 }), { slotId: 'worker-1', reviewerSessionId: 'reviewer-independent' });
    const before = master.evaluateGate({ ...base(fixture), jobId: gateJob.jobId });
    assert.equal(before.outboxWarning, null);
    const closeJob = driveToReadyToMerge(fixture, issuePayload({ number: 606 }), { slotId: 'worker-2', reviewerSessionId: 'reviewer-independent-2' });
    assert.equal(master.masterMerge({ ...base(fixture), jobId: closeJob.jobId }).ok, true);
    master.postMergeVerify({ ...base(fixture), jobId: closeJob.jobId, commands: [{ command: process.execPath, args: ['-e', 'process.exit(0)'] }] });
    const closed = await master.masterClose({ ...base(fixture), jobId: closeJob.jobId });
    const withPending = master.evaluateGate({ ...base(fixture), jobId: gateJob.jobId, integrationHead: before.integrationHead });
    assert.equal(withPending.outboxWarning.pending, 1);
    assert.deepEqual(withPending.mechanical, before.mechanical);
    assert.deepEqual(withPending.decision, before.decision);
    for (let attempt = 0; attempt < 3; attempt += 1) await master.masterOutboxFlush({ ...base(fixture), gh: async () => { throw new Error('gone'); } });
    master.masterOutboxAcknowledge({ ...base(fixture), entryId: closed.outbox.entryId, reason: 'merge abc123 已落地；Issue 永久不可达' });
    const acknowledged = master.evaluateGate({ ...base(fixture), jobId: gateJob.jobId, integrationHead: before.integrationHead });
    assert.equal(acknowledged.outboxWarning, null);
    assert.deepEqual(acknowledged.mechanical, before.mechanical);
    assert.equal(acknowledged.decision.mayMerge, before.decision.mayMerge);
  } finally { fixture.cleanup(); }
}

// ============================================================ AC-001 runner-lifecycle

export async function runnerLifecycleScenario() {
  const fixture = makeFixture('runner', {
    workers: [
      { id: 'worker-1' },
      { id: 'worker-2', dirty: true },
      { id: 'worker-3', foreignRepo: true },
      { id: 'worker-4', behind: true },
    ],
  });
  try {
    // --- runner init 幂等 + Git 忽略 ---
    const created = writeSlots(fixture);
    assert.equal(created.outcome, 'CREATED', '首次生成 slot allowlist');
    const again = initSlots({ path: fixture.slotsPath, repoIdentity: fixture.repoIdentity, slots: fixture.slots });
    assert.equal(again.outcome, 'NOOP', '重复 runner init 必须是幂等 NOOP');
    // 配置文件名落在仓库 .gitignore 覆盖的 .aes-worktree-board/ 下（本仓 .gitignore 已整目录忽略）。
    const ignoreRules = readFileSync(join(process.cwd(), '.gitignore'), 'utf8');
    assert.match(ignoreRules, /\.aes-worktree-board/, 'runner slot 配置目录必须被 Git 忽略');
    assert.match(loadSlotsConfig(fixture.slotsPath).schemaVersion, /runner-slots\/v1$/);

    // 不同内容且未加 force → 拒绝静默改写。
    assert.throws(() => initSlots({
      path: fixture.slotsPath,
      repoIdentity: fixture.repoIdentity,
      slots: fixture.slots.slice(0, 1),
    }), (error) => error.code === 'RUNNER_SLOTS_CONFLICT');

    // --- 嵌套 worker 目录的自动发现（#52）---
    await nestedWorktreeDiscovery();
    // --- runner init / update CLI（#51）---
    // 库函数早就有，但操作者只能从命令行进来；没有 CLI 入口等于这条能力对人不存在。
    await runnerCliContract();

    // --- 四类 slot 状态 ---
    const config = loadSlotsConfig(fixture.slotsPath);
    const runners = projectRunners(config, { runners: {} });
    assert.equal(runners['worker-1'].state, 'idle');
    assert.equal(runners['worker-1'].claimable, true, 'clean 且同步的 slot 必须可领取');
    assert.equal(runners['worker-2'].state, 'QUARANTINED_DIRTY', 'dirty slot 必须隔离');
    assert.equal(runners['worker-2'].claimable, false);
    assert.equal(runners['worker-3'].state, 'QUARANTINED_CONFIG_DRIFT', 'identity 漂移必须隔离');
    assert.equal(runners['worker-3'].claimable, false);
    assert.ok(runners['worker-3'].reason.includes('identity 漂移'));
    // behind 的 slot 不是隔离，但未同步到 integration HEAD 前也不允许 claim（B3）。
    assert.equal(runners['worker-4'].state, 'idle');
    assert.equal(runners['worker-4'].claimable, false, '未同步 baseline 的 slot 不得 claim');
    assert.equal(runners['worker-4'].needsBaselineSync, true);
    for (const runner of Object.values(runners)) {
      assert.ok(runner.reason, `slot ${runner.slotId} 必须有可解释原因`);
    }

    // --- dirty slot 绝不被 reset/clean，其余 slot 继续调度 ---
    const dirtyFile = join(fixture.worktreeOf('worker-2'), 'user-scratch.txt');
    const before = { content: readFileSync(dirtyFile, 'utf8'), size: statSync(dirtyFile).size };
    master.masterStart({ ...base(fixture) });
    const claim = master.masterClaim({ ...base(fixture), issue: issuePayload({ number: 101 }) });
    assert.equal(claim.outcome, 'CLAIMED');
    assert.equal(claim.slotId, 'worker-1', '隔离的 slot 不得被选中，健康 slot 继续调度');
    assert.ok(existsSync(dirtyFile), 'dirty 文件必须仍然存在');
    assert.equal(readFileSync(dirtyFile, 'utf8'), before.content, 'dirty 文件内容不得被改写');
    assert.equal(
      gitOut(fixture.worktreeOf('worker-2'), ['status', '--porcelain=v1', '--untracked-files=all']).includes('user-scratch.txt'),
      true, 'dirty 状态必须原样保留',
    );

    // --- terminal 释放后必须同步 baseline 才允许再次 claim ---
    const drift = fixture.worktreeOf('worker-4');
    assert.notEqual(gitOut(drift, ['rev-parse', 'HEAD']), gitOut(fixture.repoRoot, ['rev-parse', 'dev']));
    const synced = master.releaseAndSync({ ...base(fixture), slotId: 'worker-4' });
    assert.equal(synced.sync.outcome, 'SYNCED');
    assert.equal(gitOut(drift, ['rev-parse', 'HEAD']), gitOut(fixture.repoRoot, ['rev-parse', 'dev']),
      'baseline 同步后 worker branch 必须等于 integration HEAD');
    assert.equal(synced.claimable, true, '同步后 slot 才重新可领取');

    // dirty slot 即使被显式要求同步也必须拒绝（永不覆盖用户现场）。
    assert.throws(() => master.releaseAndSync({ ...base(fixture), slotId: 'worker-2' }),
      (error) => error.code === 'SLOT_NOT_SYNCABLE');
    assert.equal(readFileSync(dirtyFile, 'utf8'), before.content, '拒绝同步后现场仍然完好');

    // --- E1: slot 配置为空 → Master Goal 拒绝启动，非零退出 ---
    const emptyFixture = makeFixture('runner-empty', { workers: [] });
    try {
      initSlots({ path: emptyFixture.slotsPath, repoIdentity: emptyFixture.repoIdentity, slots: [], force: true });
      const failure = freshProcess(emptyFixture, ['start'], { expectStatus: 'nonzero' });
      assert.equal(failure.code, 'RUNNER_SLOTS_EMPTY');
      assert.equal(existsSync(join(emptyFixture.v4Dir, 'registry.json')), false, '拒绝启动时不得留下 registry');
    } finally {
      emptyFixture.cleanup();
    }

    // --- E2: 全部 slot 不可用时不 claim，且逐个给出恢复命令 ---
    const blockedFixture = makeFixture('runner-blocked', {
      workers: [{ id: 'worker-1', dirty: true }, { id: 'worker-2', foreignRepo: true }],
    });
    try {
      writeSlots(blockedFixture);
      master.masterStart({ ...base(blockedFixture) });
      const blocked = master.masterClaim({ ...base(blockedFixture), issue: issuePayload({ number: 102 }) });
      assert.equal(blocked.ok, false);
      assert.equal(blocked.code, 'NO_CLAIMABLE_SLOT');
      assert.equal(blocked.slots.length, 2);
      for (const slot of blocked.slots) assert.ok(slot.recovery, `slot ${slot.slotId} 必须给出恢复命令`);
    } finally {
      blockedFixture.cleanup();
    }
  } finally {
    fixture.cleanup();
  }
}

// #52: worker worktree 放在子目录里时也必须被发现。
// 历史口径只认与主仓同级的目录，于是本机把 worker 收进 <repo>-worker/ 之后
// 自动发现结果为空 —— 目录摆放方式不该决定一个 worktree 是不是本仓的 worktree。
async function nestedWorktreeDiscovery() {
  const root = mkdtempSync(join(tmpdir(), 'aes-nested-'));
  const repo = join(root, 'main');
  const nested = join(root, 'main-worker');
  const foreign = join(root, 'main-worker', 'other-repo');
  try {
    mkdirSync(repo, { recursive: true });
    mkdirSync(nested, { recursive: true });
    const git = (cwd, args) => {
      const result = spawnSync('git', args, { ...HEADLESS_CHILD_OPTIONS, cwd, encoding: 'utf8' });
      assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr || result.stdout}`);
      return String(result.stdout || '').trim();
    };
    git(repo, ['init', '-b', 'dev']);
    git(repo, ['config', 'user.email', 'selftest@aes.local']);
    git(repo, ['config', 'user.name', 'aes-selftest']);
    writeFileSync(join(repo, 'README.md'), 'nested fixture\n');
    git(repo, ['add', '.']);
    git(repo, ['commit', '-m', 'baseline']);
    // 三个 worker 全部放在子目录里，与主仓不同级。
    for (const id of ['w1', 'w2', 'w3']) git(repo, ['worktree', 'add', '-b', id, join(nested, id), 'dev']);
    // 同一子目录下再放一个「别的仓」，它必须被排除。
    mkdirSync(foreign, { recursive: true });
    git(foreign, ['init', '-b', 'dev']);
    git(foreign, ['config', 'user.email', 'selftest@aes.local']);
    git(foreign, ['config', 'user.name', 'aes-selftest']);
    writeFileSync(join(foreign, 'README.md'), 'foreign\n');
    git(foreign, ['add', '.']);
    git(foreign, ['commit', '-m', 'foreign baseline']);

    // AC-1: 嵌套布局下全部 worker 都被发现。
    const discovered = discoverWorktrees(repo);
    const slots = defaultSlotsFromWorktrees(discovered, { repoRoot: repo });
    const names = slots.map((slot) => basename(slot.worktreePath)).sort();
    assert.deepEqual(names, ['w1', 'w2', 'w3'], `嵌套 worker 必须全部被发现，实际 ${JSON.stringify(names)}`);
    assert.equal(new Set(slots.map((slot) => slot.slotId)).size, 3, 'slotId 必须唯一');
    assert.ok(slots.every((slot) => slot.enabled && slot.concurrency === 1), 'slot 默认值必须完整');
    assert.equal(validateSlotsConfig({
      schemaVersion: 'aes.worktree-board.runner-slots/v1',
      repoIdentity: { root: repo, integrationBranch: 'dev', issueRepo: 'owner/repo' },
      slots,
    }, { path: join(root, 'slots.json') }).slots.length, 3, '推导出的 slot 必须通过 schema 校验');

    // AC-2: 排除主仓自身与不属于本仓的路径。
    assert.equal(slots.some((slot) => normalizePath(slot.worktreePath) === normalizePath(repo)), false,
      '主仓自身不得成为 worker slot');
    const withForeign = defaultSlotsFromWorktrees([...discovered, foreign], { repoRoot: repo });
    assert.equal(withForeign.length, 3, '别的仓的 worktree 必须被排除');
    assert.equal(withForeign.some((slot) => normalizePath(slot.worktreePath) === normalizePath(foreign)), false);
    // 重复路径不得产生重复 slot。
    assert.equal(defaultSlotsFromWorktrees([...discovered, ...discovered], { repoRoot: repo }).length, 3,
      '重复输入不得产生重复 slot');
  } finally {
    const remove = (path) => spawnSync('git', ['-C', repo, 'worktree', 'remove', '--force', path],
      { ...HEADLESS_CHILD_OPTIONS, encoding: 'utf8' });
    for (const id of ['w1', 'w2', 'w3']) remove(join(nested, id));
    rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  }
}

// #51: runner init / update 的 CLI 契约。全程走真实子进程，不调库函数 ——
// 这条 AC 要证明的恰恰是「命令行进得来」。
async function runnerCliContract() {
  const fixture = makeFixture('runner-cli', { workers: [{ id: 'worker-1' }, { id: 'worker-2' }] });
  try {
    const paths = ['worker-1', 'worker-2'].map((id) => fixture.worktreeOf(id)).join(',');
    const runnerCli = (action, extra = []) => {
      const result = spawnSync(process.execPath, [
        MASTER_CLI, 'runner', action,
        '--repo', fixture.repoRoot,
        '--branch', fixture.integrationBranch,
        '--issue-repo', fixture.issueRepo,
        '--paths', paths,
        '--slots', fixture.slotsPath,
        ...extra,
      ], { ...HEADLESS_CHILD_OPTIONS, encoding: 'utf8', cwd: fixture.repoRoot });
      return { status: result.status, payload: JSON.parse(String(result.stdout || result.stderr).trim().split(/\r?\n/).pop()) };
    };

    // AC-1: 生成合法 allowlist，重复运行是幂等 NOOP。
    const created = runnerCli('init');
    assert.equal(created.status, 0, `runner init 应成功: ${JSON.stringify(created.payload)}`);
    assert.equal(created.payload.outcome, 'CREATED');
    assert.equal(created.payload.slots, 2);
    const config = loadSlotsConfig(fixture.slotsPath);
    assert.equal(config.schemaVersion, 'aes.worktree-board.runner-slots/v1');
    assert.equal(config.repoIdentity.integrationBranch, fixture.integrationBranch);
    assert.equal(config.slots.length, 2);

    const again = runnerCli('init');
    assert.equal(again.status, 0);
    assert.equal(again.payload.outcome, 'NOOP', '重复 runner init 必须是幂等 NOOP');

    // AC-2: 内容不同时 init 拒绝，update 放行。
    const conflicting = ['--paths', fixture.worktreeOf('worker-1')];
    const rejected = spawnSync(process.execPath, [
      MASTER_CLI, 'runner', 'init', '--repo', fixture.repoRoot, '--branch', fixture.integrationBranch,
      '--issue-repo', fixture.issueRepo, '--slots', fixture.slotsPath, ...conflicting,
    ], { ...HEADLESS_CHILD_OPTIONS, encoding: 'utf8', cwd: fixture.repoRoot });
    assert.notEqual(rejected.status, 0, 'runner init 遇到不同配置必须非零退出');
    assert.equal(JSON.parse(String(rejected.stderr).trim()).code, 'RUNNER_SLOTS_CONFLICT');
    assert.equal(loadSlotsConfig(fixture.slotsPath).slots.length, 2, '被拒绝的 init 不得改写既有配置');

    const updated = spawnSync(process.execPath, [
      MASTER_CLI, 'runner', 'update', '--repo', fixture.repoRoot, '--branch', fixture.integrationBranch,
      '--issue-repo', fixture.issueRepo, '--slots', fixture.slotsPath, ...conflicting,
    ], { ...HEADLESS_CHILD_OPTIONS, encoding: 'utf8', cwd: fixture.repoRoot });
    assert.equal(updated.status, 0, `runner update 应成功: ${updated.stderr}`);
    assert.equal(JSON.parse(String(updated.stdout).trim()).outcome, 'UPDATED');
    assert.equal(loadSlotsConfig(fixture.slotsPath).slots.length, 1, 'update 必须真的生效');

    // 缺必需参数时 fail closed，不从环境猜。
    const missing = spawnSync(process.execPath, [
      MASTER_CLI, 'runner', 'init', '--repo', fixture.repoRoot, '--slots', fixture.slotsPath,
    ], { ...HEADLESS_CHILD_OPTIONS, encoding: 'utf8', cwd: fixture.repoRoot });
    assert.notEqual(missing.status, 0, '缺 --issue-repo / --paths 时必须拒绝');
  } finally {
    fixture.cleanup();
  }
}

// ============================================================ AC-002 recovery

export async function recoveryScenario() {
  // --- 第一部分：job / attempt 层中断恢复 ---
  const fixture = makeFixture('recovery', { workers: [{ id: 'worker-1' }, { id: 'worker-2' }] });
  try {
    writeSlots(fixture);
    master.masterStart({ ...base(fixture) });
    const issue = issuePayload({ number: 201 });
    const claim = master.masterClaim({ ...base(fixture), issue });
    const jobId = claim.jobId;

    const baseCommit = claim.workOrder.runner.baseCommit;
    const first = makeCandidate(fixture, claim.slotId, { file: 'r1.txt' });
    master.recordCandidate({ ...base(fixture), jobId, commitSha: first });
    // 设置 ownerThreadId 以便测试 reviewerIndependence
    master.setAttemptOwnerThreadId({ ...base(fixture), jobId, ownerThreadId: 'owner-recovery' });
    master.recordStageResult({ ...base(fixture), jobId, stage: 'review', payload: passingReview(jobId, first, baseCommit, 'owner-recovery') });

    // candidate 前进使旧 review/QA 失效（E5）。
    const second = makeCandidate(fixture, claim.slotId, { file: 'r2.txt' });
    const advanced = master.recordCandidate({ ...base(fixture), jobId, commitSha: second });
    assert.equal(advanced.invalidated.length, 1, 'candidate 前进必须使旧 review 失效');
    assert.equal(advanced.invalidated[0].commitSha, first);
    assert.equal(readV4Registry(fixture.v4Dir).attempts[claim.attemptId].review, null);

    // 绑定旧 commit 的证据必须被拒收，不得推进。
    const stale = master.recordStageResult({ ...base(fixture), jobId, stage: 'review', payload: passingReview(jobId, first, baseCommit) });
    assert.equal(stale.ok, false);
    assert.equal(stale.code, 'STALE_EVIDENCE');
    assert.equal(stale.pending, true);

    // E4: 未知 schema 的 StageResult 不推进，保持 pending 并要求合法 replacement。
    const unknown = master.recordStageResult({
      ...base(fixture), jobId, stage: 'review',
      payload: { schemaVersion: 'aes.issue-worker.stage-result/v0', jobId, commitSha: second, outcome: 'PASS' },
    });
    assert.equal(unknown.code, 'UNCLASSIFIED_STAGE_RESULT');
    assert.equal(unknown.consumed, false);
    // v0 从未存在过，两个在役版本都不认——requiredReplacementSchema 指向最新（v2）；
    // v1 本身仍是被接受的合法历史语义（见下方 reviewer-independence 场景）。
    assert.equal(unknown.requiredReplacementSchema, master.STAGE_RESULT_SCHEMA_V2);
    assert.deepEqual(unknown.acceptedSchemas, [master.STAGE_RESULT_SCHEMA_V1, master.STAGE_RESULT_SCHEMA_V2]);

    // v1（历史 schema，无 baseCommit / reviewerSessionId）仍必须被接受——向下兼容不是可选项。
    const legacyV1 = master.recordStageResult({ ...base(fixture), jobId, stage: 'review', payload: passingReviewV1(jobId, second) });
    assert.equal(legacyV1.ok, true, 'v1 报文必须仍被接受（向下兼容）');
    assert.equal(readV4Registry(fixture.v4Dir).attempts[claim.attemptId].review.baseCommit, undefined,
      'v1 报文不携带 baseCommit，落盘也不应凭空补上');

    // v2 报文缺 baseCommit 必须 fail closed（AC-1），不得推进、不得清空既有证据。
    const missingBase = master.recordStageResult({
      ...base(fixture), jobId, stage: 'review',
      payload: { schemaVersion: master.STAGE_RESULT_SCHEMA_V2, jobId, commitSha: second, outcome: 'PASS', reviewerSessionId: 'owner-recovery' },
    });
    assert.equal(missingBase.ok, false);
    assert.equal(missingBase.code, 'MISSING_BASE_COMMIT');
    assert.ok(readV4Registry(fixture.v4Dir).attempts[claim.attemptId].review, 'fail closed 不清空既有 v1 证据');

    // v2 报文缺 reviewerSessionId 必须 fail closed（#65 AC-1），不得推进、不得清空既有证据。
    const missingReviewer = master.recordStageResult({
      ...base(fixture), jobId, stage: 'review',
      payload: { schemaVersion: master.STAGE_RESULT_SCHEMA_V2, jobId, commitSha: second, outcome: 'PASS', baseCommit },
    });
    assert.equal(missingReviewer.ok, false);
    assert.equal(missingReviewer.code, 'MISSING_REVIEWER_SESSION_ID');
    assert.ok(readV4Registry(fixture.v4Dir).attempts[claim.attemptId].review, 'fail closed 不清空既有 v1 证据');

    // owner thread 中断：优先恢复原 thread。
    const interrupted = master.attemptInterrupt({ ...base(fixture), jobId, reason: 'owner thread 无响应' });
    assert.equal(interrupted.state, 'interrupted');
    assert.ok(interrupted.handoffBundle.candidateCommit === second, 'handoff bundle 必须绑定 live candidate');
    const resumed = master.attemptResume({ ...base(fixture), jobId });
    assert.equal(resumed.outcome, 'RESUMED_ORIGINAL', '必须优先恢复原 thread，而不是直接新建 attempt');

    // 未确认不可恢复时拒绝新建 attempt。
    assert.throws(() => master.attemptNew({ ...base(fixture), jobId }), (error) => error.code === 'ATTEMPT_STILL_LIVE');

    // 确认不可恢复后，凭 handoff bundle 新建 attempt：jobId 稳定、attemptId 唯一、旧 attempt 保留。
    master.attemptInterrupt({ ...base(fixture), jobId, reason: '确认不可恢复' });
    const next = master.attemptNew({ ...base(fixture), jobId, slotId: 'worker-2' });
    assert.equal(next.jobId, jobId, 'jobId 必须跨 attempt 稳定');
    assert.notEqual(next.attemptId, claim.attemptId, 'attemptId 必须唯一');
    assert.equal(next.resumedFrom, claim.attemptId);
    assert.equal(next.preservedAttempts, 2, '旧 attempt 不得被覆盖');
    const registryAfter = readV4Registry(fixture.v4Dir);
    assert.equal(registryAfter.attempts[claim.attemptId].state, 'superseded');
    assert.ok(registryAfter.attempts[claim.attemptId].handoffBundle, '旧 attempt 的证据引用必须保留');
    assert.equal(registryAfter.attempts[next.attemptId].review, null, '新 attempt 不继承已失效证据');
  } finally {
    fixture.cleanup();
  }

  // --- 第二部分：Master 层四个中断点，每个都用全新进程恢复 ---
  await masterRestartAtDispatch();
  await masterRestartBeforeMerge();
  await masterRestartAfterMergeBeforeClose();
  await masterRestartDuringAwaitingHuman();

  // --- 第三部分：humanRequest 载荷 ---
  await humanRequestPayloadContract();
}

async function masterRestartAtDispatch() {
  const fixture = makeFixture('recovery-dispatch', { workers: [{ id: 'worker-1' }] });
  try {
    writeSlots(fixture);
    freshProcess(fixture, ['start']);
    const claim = master.masterClaim({ ...base(fixture), issue: issuePayload({ number: 211 }) });
    // 模拟 Master 在 dispatch 之后立即死亡：不做任何后续写入，直接换进程 reconcile。
    const reconcile = freshProcess(fixture, ['reconcile']);
    assert.equal(reconcile.unexplainedJobs, 0, '无法解释的 job 数必须为 0');
    assert.equal(reconcile.unexplainedSlots, 0, '无法解释的 slot 数必须为 0');
    assert.equal(reconcile.jobs.length, 1, 'job 不得丢失');
    assert.equal(reconcile.jobs[0].jobId, claim.jobId);
    assert.equal(reconcile.jobs[0].state, 'dispatched');
    const action = reconcile.actions.find((entry) => entry.jobId === claim.jobId);
    assert.equal(action.action, 'PROBE_OWNER_THREAD', '重启后应先探测原 owner thread，而不是假完成或重派');
    assert.equal(reconcile.mergeQueue.length, 0, '未就绪的 job 不得进入 merge 队列');
  } finally {
    fixture.cleanup();
  }
}

async function masterRestartBeforeMerge() {
  const fixture = makeFixture('recovery-premerge', { workers: [{ id: 'worker-1' }] });
  try {
    writeSlots(fixture);
    freshProcess(fixture, ['start']);
    const job = driveToReadyToMerge(fixture, issuePayload({ number: 221 }));
    const headBefore = gitOut(fixture.repoRoot, ['rev-parse', 'dev']);

    const reconcile = freshProcess(fixture, ['reconcile']);
    assert.equal(reconcile.jobs[0].state, 'ready-to-merge');
    assert.equal(reconcile.mergeQueue.filter((id) => id === job.jobId).length, 1, 'merge 队列中同一 job 只能出现一次');
    assert.equal(reconcile.duplicateMergeRisk, false);
    assert.equal(gitOut(fixture.repoRoot, ['rev-parse', 'dev']), headBefore, 'reconcile 不得自行 merge');

    // 再 reconcile 一次也不得让队列膨胀。
    const twice = freshProcess(fixture, ['reconcile']);
    assert.equal(twice.mergeQueue.filter((id) => id === job.jobId).length, 1);
  } finally {
    fixture.cleanup();
  }
}

async function masterRestartAfterMergeBeforeClose() {
  const fixture = makeFixture('recovery-postmerge', { workers: [{ id: 'worker-1' }] });
  try {
    writeSlots(fixture);
    freshProcess(fixture, ['start']);
    const job = driveToReadyToMerge(fixture, issuePayload({ number: 231 }));

    // 精确复现「git merge 已完成，但 registry 还停在 merging」：
    // 在子进程里只跑到阶段二就退出，最后一段 registry 写入永远不会发生。
    const crasher = join(fixture.root, 'crash-after-merge.mjs');
    writeFileSync(crasher, [
      `import { openMergeIntent, runIntegrationMerge } from ${JSON.stringify(pathToFileURL(MASTER_CLI).href)};`,
      `const shared = { dir: ${JSON.stringify(fixture.v4Dir)}, slotsPath: ${JSON.stringify(fixture.slotsPath)}, jobId: ${JSON.stringify(job.jobId)} };`,
      'const intent = openMergeIntent(shared);',
      'const result = runIntegrationMerge({ ...shared, intent });',
      'console.log(JSON.stringify({ merged: result.merged, mergeCommit: result.mergeCommit }));',
      'process.exit(137);',
    ].join('\n'));
    const crashed = spawnSync(process.execPath, [crasher], {
      ...HEADLESS_CHILD_OPTIONS, encoding: 'utf8', cwd: fixture.repoRoot,
    });
    assert.equal(crashed.status, 137,
      `崩溃复现进程必须以非正常码退出: ${crashed.stderr || crashed.stdout}`);
    const crashOut = JSON.parse(String(crashed.stdout).trim());
    assert.equal(crashOut.merged, true, 'git merge 必须已经真实发生');

    const stranded = readV4Registry(fixture.v4Dir);
    assert.equal(stranded.jobs[job.jobId].state, 'merging', '崩溃后 registry 应停在 merging');
    assert.equal(stranded.deliveries[job.jobId], undefined, '崩溃点在 delivery 落盘之前');
    const mergeCountBefore = countMergeCommits(fixture, job.candidate);
    assert.equal(mergeCountBefore, 1);

    // 全新进程重启：只凭 registry + Git ancestry 判定 merge 已发生。
    const reconcile = freshProcess(fixture, ['reconcile']);
    const action = reconcile.actions.find((entry) => entry.jobId === job.jobId);
    assert.equal(action.action, 'ADOPT_EXISTING_MERGE', '必须认领既有 merge，而不是重新 merge');
    assert.equal(reconcile.jobs[0].state, 'merged');
    assert.equal(reconcile.mergeQueue.includes(job.jobId), false, '已 merge 的 job 必须离开队列');
    assert.equal(countMergeCommits(fixture, job.candidate), 1, '重启后不得产生第二个 merge commit');

    // 续跑 verify + close，全流程不重复 merge。
    const verify = master.postMergeVerify({
      ...base(fixture), jobId: job.jobId,
      commands: [{ command: process.execPath, args: ['-e', 'process.exit(0)'] }],
    });
    assert.equal(verify.ok, true);
    const calls = [];
    const closed = await master.masterClose({
      ...base(fixture), jobId: job.jobId,
      gh: async (args) => { calls.push(`${args[0]} ${args[1]}`); return { stdout: '' }; },
    });
    assert.equal(closed.outcome, 'CLOSED');
    assert.deepEqual(calls, [], 'recovery close 也不得调用 gh');
    assert.equal(readOutbox(fixture.v4Dir)[0].state, 'pending');
    assert.equal(countMergeCommits(fixture, job.candidate), 1);

    // 关闭后再 reconcile：不得把已完成的 job 重新排队（无假完成、无重复 merge）。
    const after = freshProcess(fixture, ['reconcile']);
    assert.equal(after.jobs[0].state, 'closed');
    assert.equal(after.mergeQueue.length, 0);
    assert.equal(after.actions.length, 0);
  } finally {
    fixture.cleanup();
  }
}

function countMergeCommits(fixture, candidate) {
  const log = gitOut(fixture.repoRoot, ['log', '--merges', '--format=%H %s', 'dev']);
  if (!log) return 0;
  return log.split(/\r?\n/).filter((line) => line.includes(String(candidate).slice(0, 8))).length;
}

async function masterRestartDuringAwaitingHuman() {
  const fixture = makeFixture('recovery-human', { workers: [{ id: 'worker-1' }] });
  try {
    writeSlots(fixture);
    freshProcess(fixture, ['start']);
    const claim = master.masterClaim({ ...base(fixture), issue: issuePayload({ number: 241 }) });
    const candidate = makeCandidate(fixture, claim.slotId, { file: 'human.txt' });
    master.recordCandidate({ ...base(fixture), jobId: claim.jobId, commitSha: candidate });

    const opened = master.openHumanRequest({
      ...base(fixture), jobId: claim.jobId, state: 'awaiting-human', kind: 'manual_validation',
      prompt: '请在 700×1000 竖屏下确认工作台展开动作正确',
      requiredEvidence: ['700x1000 截图', `candidate ${candidate}`],
    });
    assert.equal(opened.state, 'awaiting-human');
    const token = opened.humanRequest.resumeToken;

    const reconcile = freshProcess(fixture, ['reconcile']);
    const action = reconcile.actions.find((entry) => entry.jobId === claim.jobId);
    assert.equal(action.action, 'AWAIT_HUMAN');
    assert.equal(action.resumeToken, token, '重启后必须凭持久 resumeToken 找回人工态');
    assert.equal(reconcile.jobs[0].state, 'awaiting-human');
    assert.equal(reconcile.unexplainedJobs, 0);

    // AWAITING_HUMAN 永不因超时变 PASS：反复 reconcile 也只会停在原地。
    for (let index = 0; index < 3; index += 1) {
      const loop = freshProcess(fixture, ['reconcile']);
      assert.equal(loop.jobs[0].state, 'awaiting-human', '人工态不得因反复 reconcile 自行推进');
    }

    // Agent 不得代答。
    assert.throws(() => master.respondHumanRequest({
      ...base(fixture), resumeToken: token,
      response: { outcome: 'PASS', resumeToken: token, actor: 'agent' },
    }), (error) => error.code === 'HUMAN_RESPONSE_REJECTED');
    // token 不匹配不得推进。
    assert.throws(() => master.respondHumanRequest({
      ...base(fixture), resumeToken: token,
      response: { outcome: 'PASS', resumeToken: 'hr-wrong', actor: 'human' },
    }), (error) => error.code === 'HUMAN_RESPONSE_REJECTED');
    assert.equal(readV4Registry(fixture.v4Dir).jobs[claim.jobId].state, 'awaiting-human', '被拒答复不得推进状态');

    const responded = master.respondHumanRequest({
      ...base(fixture), resumeToken: token,
      response: { outcome: 'PASS', resumeToken: token, actor: 'human' },
    });
    assert.equal(responded.ok, true);
  } finally {
    fixture.cleanup();
  }
}

async function humanRequestPayloadContract() {
  const fixture = makeFixture('human-payload', { workers: [{ id: 'worker-1' }] });
  try {
    writeSlots(fixture);
    master.masterStart({ ...base(fixture) });
    const states = [
      { state: 'awaiting-human', kind: 'manual_validation', outcome: 'AWAITING_HUMAN', issue: 301 },
      { state: 'blocked-permission', kind: 'permission', outcome: 'BLOCKED_PERMISSION', issue: 302 },
      { state: 'contract-conflict', kind: 'decision', outcome: 'CONTRACT_CONFLICT', issue: 303 },
    ];
    for (const entry of states) {
      const claim = master.masterClaim({ ...base(fixture), issue: issuePayload({ number: entry.issue }) });
      const complete = {
        schemaVersion: HUMAN_REQUEST_SCHEMA,
        jobId: claim.jobId, attemptId: claim.attemptId, state: entry.state, kind: entry.kind,
        prompt: `需要人工处理 #${entry.issue}`,
        requiredEvidence: ['证据 A'],
        resumeToken: `hr-${claim.jobId}-${entry.state}-token`,
        context: {},
      };
      // 缺 resumeToken 的人工态报文 schema 拒收，且状态不推进。
      const { resumeToken, ...withoutToken } = complete;
      assert.throws(() => master.masterTerminal({
        ...base(fixture),
        payload: {
          schemaVersion: 'aes.issue-worker.goal-terminal/v1', jobId: claim.jobId, attemptId: claim.attemptId,
          outcome: entry.outcome, issue: entry.issue, humanRequest: withoutToken,
        },
      }), (error) => {
        assert.equal(error.code, 'HUMAN_REQUEST_SCHEMA_REJECTED');
        assert.equal(error.details.field, 'resumeToken');
        return true;
      });
      assert.equal(readV4Registry(fixture.v4Dir).jobs[claim.jobId].state, 'dispatched',
        '缺 resumeToken 的报文不得推进状态');

      // kind 与人工态不匹配也拒收。
      assert.throws(() => master.masterTerminal({
        ...base(fixture),
        payload: {
          schemaVersion: 'aes.issue-worker.goal-terminal/v1', jobId: claim.jobId, attemptId: claim.attemptId,
          outcome: entry.outcome, issue: entry.issue,
          humanRequest: { ...complete, kind: entry.state === 'blocked-permission' ? 'decision' : 'permission' },
        },
      }), (error) => error.code === 'HUMAN_REQUEST_SCHEMA_REJECTED');

      const accepted = master.masterTerminal({
        ...base(fixture),
        payload: {
          schemaVersion: 'aes.issue-worker.goal-terminal/v1', jobId: claim.jobId, attemptId: claim.attemptId,
          outcome: entry.outcome, issue: entry.issue, humanRequest: complete,
        },
      });
      assert.equal(accepted.state, entry.state);
      assert.equal(accepted.resumeToken, complete.resumeToken);
      assert.equal(accepted.writerLease, 'RELEASED', '人工态必须释放 writer slot');
      const stored = readV4Registry(fixture.v4Dir).humanRequests[complete.resumeToken];
      for (const field of ['kind', 'prompt', 'requiredEvidence', 'resumeToken']) {
        assert.ok(stored[field] !== undefined, `humanRequest 必须携带 ${field}`);
      }
    }
  } finally {
    fixture.cleanup();
  }
}

// ============================================================ AC-004 discovered-work

export async function discoveredWorkScenario() {
  const fixture = makeFixture('discovery', { workers: [{ id: 'worker-1' }] });
  try {
    writeSlots(fixture);
    master.masterStart({ ...base(fixture) });
    const claim = master.masterClaim({ ...base(fixture), issue: issuePayload({ number: 401 }) });

    // fake-gh：记录全部调用，保证不写真实 GitHub。
    const calls = [];
    let nextIssueNumber = 500;
    const existingIssues = [];
    const gh = async (args) => {
      calls.push(args);
      if (args[0] === 'issue' && args[1] === 'create') {
        nextIssueNumber += 1;
        existingIssues.push({ number: nextIssueNumber, title: args[3], state: 'OPEN' });
        return { stdout: `https://github.com/owner/repo/issues/${nextIssueNumber}\n` };
      }
      if (args[0] === 'issue' && args[1] === 'list') {
        const search = String(args[args.indexOf('--search') + 1] || '').toLowerCase();
        return { stdout: JSON.stringify(existingIssues.filter((issue) => search.split(/\s+/).some((term) => term && issue.title.toLowerCase().includes(term)))) };
      }
      return { stdout: 'ok\n' };
    };
    const wayfinder = (await import('./discovery.mjs')).makeWayfinder({ gh, repo: 'owner/repo' });

    const payloadFor = (relationship, title) => ({
      schemaVersion: 'aes.issue-worker.discovered-work/v1',
      discoveryId: null, jobId: claim.jobId, attemptId: claim.attemptId, currentIssue: 401,
      relationship, title, problem: `${relationship} 的问题描述`,
      evidence: ['scripts/collect.mjs'], suggestedWorkflow: 'diagnose',
      dedupeHints: [title.toLowerCase(), relationship.toLowerCase()],
    });

    // 四类关系全覆盖。
    const inScope = await master.masterDiscovery({ ...base(fixture), wayfinder, payload: payloadFor('IN_CURRENT_SCOPE', 'stale comment in scope') });
    assert.equal(inScope.outcome, 'ABSORBED_INTO_CURRENT_JOB');
    assert.equal(inScope.currentJobDisposition, 'CONTINUE');
    assert.equal(inScope.issue, 401, '当前范围内的发现只评论当前 Issue');

    const nonBlocking = await master.masterDiscovery({ ...base(fixture), wayfinder, payload: payloadFor('NON_BLOCKING', 'stale issueRepo config') });
    assert.equal(nonBlocking.outcome, 'ISSUE_CREATED');
    assert.equal(nonBlocking.currentJobDisposition, 'CONTINUE', '非阻塞时当前 job 不停');
    assert.ok(nonBlocking.issue > 500);
    assert.equal(readV4Registry(fixture.v4Dir).jobs[claim.jobId].state, 'dispatched');

    const blocking = await master.masterDiscovery({ ...base(fixture), wayfinder, payload: payloadFor('BLOCKING_DEPENDENCY', 'missing baseline sync api') });
    assert.equal(blocking.outcome, 'BLOCKING_EDGE_CREATED');
    assert.equal(blocking.blockingEdgeCreated, true);
    assert.equal(blocking.currentJobDisposition, 'BLOCKED_DEPENDENCY');
    assert.equal(readV4Registry(fixture.v4Dir).jobs[claim.jobId].state, 'blocked-dependency');

    const conflict = await master.masterDiscovery({ ...base(fixture), wayfinder, payload: payloadFor('CONTRACT_CONFLICT', 'AC-2 contradicts AC-5') });
    assert.equal(conflict.outcome, 'ESCALATED_TO_HUMAN');
    assert.equal(conflict.currentJobDisposition, 'CONTRACT_CONFLICT');

    // digest 去重幂等：同一问题重复上报不重复创建。
    const createCallsBefore = calls.filter((args) => args[1] === 'create').length;
    const repeat = await master.masterDiscovery({ ...base(fixture), wayfinder, payload: payloadFor('NON_BLOCKING', 'stale issueRepo config') });
    assert.equal(repeat.idempotent, true, '同一 discovery digest 必须幂等');
    assert.equal(repeat.discoveryId, nonBlocking.discoveryId);
    assert.equal(repeat.issue, nonBlocking.issue);
    assert.equal(calls.filter((args) => args[1] === 'create').length, createCallsBefore, '幂等命中不得再次写 GitHub');

    // 命中既有 Issue 时关联而不是新建。
    existingIssues.push({ number: 777, title: 'runner drawer regression', state: 'OPEN' });
    const linked = await master.masterDiscovery({ ...base(fixture), wayfinder, payload: payloadFor('NON_BLOCKING', 'runner drawer regression') });
    assert.equal(linked.outcome, 'LINKED_TO_EXISTING');
    assert.equal(linked.issue, 777);

    // create / comment / edge 三类都必须有 receipt。
    const receipts = readReceipts(fixture.v4Dir).filter((entry) => entry.kind === 'wayfinder');
    const actions = new Set(receipts.map((entry) => entry.action));
    for (const action of ['create', 'comment', 'edge']) {
      assert.ok(actions.has(action), `缺少 ${action} 的 receipt`);
    }

    // worker 不得直接创建 Issue。
    await assert.rejects(master.masterDiscovery({
      ...base(fixture), wayfinder,
      payload: { ...payloadFor('NON_BLOCKING', 'worker created this'), createdIssue: 999 },
    }), (error) => error.code === 'WORKER_EXCEEDED_SCOPE');

    // 未知 relationship fail closed。
    await assert.rejects(master.masterDiscovery({
      ...base(fixture), wayfinder,
      payload: { ...payloadFor('NON_BLOCKING', 'bad relationship'), relationship: 'MAYBE_RELATED' },
    }), (error) => error.code === 'UNCLASSIFIED_DISCOVERY');

    // 全程 fake-gh：所有调用都经过注入的 gh，没有触达真实 GitHub 的路径。
    assert.ok(calls.length > 0);
    for (const args of calls) assert.equal(args[0], 'issue', 'discovery 只允许 issue 子命令');
  } finally {
    fixture.cleanup();
  }
}

// ============================================================ AC-005 delivery-merge

export async function deliveryMergeScenario() {
  await nextStepDriver();
  await mergePolicyTiers();
  await deliveryHappyPath();
  await evidenceBindingBypass();
  await postMergeVerificationFailure();
  await mergeConflictDisposition();
  await serialMergeEnforcement();
  await legacyArchiveStable();
}

// #53: next-step 把 reconcile 已经算出的动作直接执行掉一步。
// 全程走真实 CLI 子进程 —— 这条能力的价值就在于「无人值守循环不必自己拼装命令」，
// 用库函数测等于绕过了要证明的东西。
async function nextStepDriver() {
  const fixture = makeFixture('next-step', { workers: [{ id: 'worker-1' }, { id: 'worker-2' }] });
  const commandsFile = join(fixture.root, 'verify-commands.json');
  writeFileSync(commandsFile, JSON.stringify([{ command: process.execPath, args: ['-e', 'process.exit(0)'] }]));
  // close 只落 registry + outbox，不得触达真实 GitHub；注入桩用于证明调用次数为零。
  const ghTrace = join(fixture.root, 'gh-trace.jsonl');
  const ghScript = join(fixture.root, 'fake-gh.mjs');
  writeFileSync(ghScript, [
    "import { appendFileSync } from 'node:fs';",
    `appendFileSync(${JSON.stringify(ghTrace)}, JSON.stringify(process.argv.slice(2)) + '\\n');`,
    "process.exit(9);",
  ].join('\n'));
  const ghEnv = { AES_WORKTREE_BOARD_GH_COMMAND: JSON.stringify([process.execPath, ghScript]) };
  try {
    writeSlots(fixture);
    freshProcess(fixture, ['start']);

    // 空 registry：没有任何可推进项。
    const idle = freshProcess(fixture, ['next-step'], { env: ghEnv });
    assert.equal(idle.outcome, 'NOOP', '无 job 时必须是 NOOP');

    const job = driveToReadyToMerge(fixture, issuePayload({ number: 561 }), { slotId: 'worker-1' });
    const headBefore = gitOut(fixture.repoRoot, ['rev-parse', 'dev']);

    // AC-1: 推进恰好一个 job，返回 typed 结果。
    const merged = freshProcess(fixture, ['next-step'], { env: ghEnv });
    assert.equal(merged.outcome, 'ADVANCED');
    assert.equal(merged.jobId, job.jobId);
    assert.equal(merged.kind, 'merge');
    assert.notEqual(gitOut(fixture.repoRoot, ['rev-parse', 'dev']), headBefore, 'merge 必须真的发生');
    assert.equal(readV4Registry(fixture.v4Dir).jobs[job.jobId].state, 'merged');

    // 缺 verification 命令时不猜：如实跳过并说明原因。
    const withoutCommands = freshProcess(fixture, ['next-step'], { env: ghEnv });
    assert.equal(withoutCommands.outcome, 'NOOP');
    assert.ok(withoutCommands.skipped.some((entry) => /verification 命令/.test(entry.reason)),
      'next-step 必须说明为什么没推进，而不是沉默 NOOP');

    const verified = freshProcess(fixture, ['next-step', '--commands-file', commandsFile], { env: ghEnv });
    assert.equal(verified.kind, 'verify');
    const closed = freshProcess(fixture, ['next-step', '--commands-file', commandsFile], { env: ghEnv });
    assert.equal(closed.kind, 'close');
    assert.equal(readV4Registry(fixture.v4Dir).jobs[job.jobId].state, 'closed');
    assert.equal(existsSync(ghTrace), false, 'close 命令内不得调用 gh');
    assert.equal(readOutbox(fixture.v4Dir).length, 1, 'close 必须把 GitHub 副作用入队');

    // AC-2: 全部终态后回到 NOOP，退出码 0，且不再改动 integration。
    const headAfter = gitOut(fixture.repoRoot, ['rev-parse', 'dev']);
    const done = freshProcess(fixture, ['next-step', '--commands-file', commandsFile], { env: ghEnv });
    assert.equal(done.outcome, 'NOOP');
    assert.equal(gitOut(fixture.repoRoot, ['rev-parse', 'dev']), headAfter, 'NOOP 不得产生任何 Git 副作用');

    // AC-3: 人工态永不被 next-step 推进。
    // 前一个 job 合并后 integration 已前移，worker-2 必须先同步 baseline 才可领取（B3）。
    master.releaseAndSync({ ...base(fixture), slotId: 'worker-2' });
    const humanJob = driveToReadyToMerge(fixture, issuePayload({ number: 562 }), { slotId: 'worker-2' });
    master.openHumanRequest({
      ...base(fixture), jobId: humanJob.jobId, state: 'awaiting-human', kind: 'manual_validation',
      prompt: '需要人工确认', requiredEvidence: ['截图'],
    });
    const headBeforeHuman = gitOut(fixture.repoRoot, ['rev-parse', 'dev']);
    for (let index = 0; index < 3; index += 1) {
      const blocked = freshProcess(fixture, ['next-step', '--commands-file', commandsFile], { env: ghEnv });
      assert.equal(blocked.outcome, 'NOOP', '人工态不得被 next-step 推进');
      assert.ok(blocked.skipped.some((entry) => entry.jobId === humanJob.jobId && /人工态/.test(entry.reason)),
        '跳过人工态必须给出可解释原因');
    }
    assert.equal(gitOut(fixture.repoRoot, ['rev-parse', 'dev']), headBeforeHuman, '人工态期间不得 merge');
    assert.equal(readV4Registry(fixture.v4Dir).jobs[humanJob.jobId].state, 'awaiting-human');
  } finally {
    fixture.cleanup();
  }
}

// 四档 mergePolicy + riskProfile 自报按路径兜底。
async function mergePolicyTiers() {
  assert.equal(resolveMergePolicy({ declaredRisk: 'low', changedPaths: ['docs/readme.md'] }).mergePolicy, 'AUTO_MERGE');
  assert.equal(resolveMergePolicy({ declaredRisk: 'medium', changedPaths: ['src/ui.mjs'] }).mergePolicy, 'AUTO_MERGE');
  assert.equal(resolveMergePolicy({ declaredRisk: 'high', changedPaths: ['docs/readme.md'] }).mergePolicy, 'HUMAN_GATE');
  assert.equal(resolveMergePolicy({ declaredRisk: 'critical', changedPaths: ['docs/readme.md'] }).mergePolicy, 'PR_ONLY');

  // 自报 low 但改了 identity → 兜底升到 high，且能指名是哪条规则。
  const escalated = resolveMergePolicy({ declaredRisk: 'low', changedPaths: ['scripts/github-identity.mjs'] });
  assert.equal(escalated.effectiveRisk, 'high');
  assert.equal(escalated.escalated, true);
  assert.equal(escalated.mergePolicy, 'HUMAN_GATE');
  assert.ok(escalated.triggeredRules.some((rule) => rule.id === 'ESC-identity'));

  for (const [path, expected] of [
    ['src/permission-check.mjs', 'high'],
    ['config/.env.production', 'critical'],
    ['scripts/runtime-store.mjs', 'high'],
    ['.github/workflows/ci.yml', 'high'],
  ]) {
    const resolved = resolveMergePolicy({ declaredRisk: 'low', changedPaths: [path] });
    assert.equal(resolved.effectiveRisk, expected, `${path} 应兜底为 ${expected}`);
  }

  // waiver 不能把 critical 降到可直接 merge。
  assert.throws(() => resolveMergePolicy({
    declaredRisk: 'critical', changedPaths: [],
    waiver: { reason: '临时', authorizedBy: 'human', scope: 'this-job' },
  }), (error) => error.code === 'WAIVER_REJECTED');
  // Agent 不得自我豁免。
  assert.throws(() => resolveMergePolicy({
    declaredRisk: 'high', changedPaths: [],
    waiver: { reason: '临时', authorizedBy: 'agent', scope: 'this-job' },
  }), (error) => error.code === 'WAIVER_REJECTED');

  // high 档在真实 Master 上必须停在 humanGate，即使机械门全绿。
  const fixture = makeFixture('merge-high', { workers: [{ id: 'worker-1' }] });
  try {
    writeSlots(fixture);
    master.masterStart({ ...base(fixture) });
    const job = driveToReadyToMerge(fixture, issuePayload({ number: 501, riskProfile: 'high' }));
    const gate = master.evaluateGate({ ...base(fixture), jobId: job.jobId });
    assert.equal(gate.mechanical.allGreen, true, '机械门应全绿');
    assert.equal(gate.decision.decision, 'AWAITING_HUMAN_GATE', 'high 档机械门全绿仍必须停在 humanGate');
    const headBefore = gitOut(fixture.repoRoot, ['rev-parse', 'dev']);
    const attempted = master.masterMerge({ ...base(fixture), jobId: job.jobId });
    assert.equal(attempted.state, 'awaiting-human');
    assert.equal(gitOut(fixture.repoRoot, ['rev-parse', 'dev']), headBefore, 'humanGate 未批准前不得 merge');

    // 人工批准后才放行。
    const approved = master.respondHumanRequest({
      ...base(fixture), resumeToken: attempted.humanRequest.resumeToken,
      response: { outcome: 'PASS', resumeToken: attempted.humanRequest.resumeToken, actor: 'human' },
    });
    assert.equal(approved.nextAction, 'MERGE');
    const merged = master.masterMerge({ ...base(fixture), jobId: job.jobId });
    assert.equal(merged.ok, true);
    assert.notEqual(gitOut(fixture.repoRoot, ['rev-parse', 'dev']), headBefore);
  } finally {
    fixture.cleanup();
  }

  // critical 档拒绝直接 merge，只走 PR。
  const criticalFixture = makeFixture('merge-critical', { workers: [{ id: 'worker-1' }] });
  try {
    writeSlots(criticalFixture);
    master.masterStart({ ...base(criticalFixture) });
    const job = driveToReadyToMerge(criticalFixture, issuePayload({ number: 502, riskProfile: 'critical' }));
    const headBefore = gitOut(criticalFixture.repoRoot, ['rev-parse', 'dev']);
    const blocked = master.masterMerge({ ...base(criticalFixture), jobId: job.jobId });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.decision, 'PR_ONLY');
    assert.equal(gitOut(criticalFixture.repoRoot, ['rev-parse', 'dev']), headBefore, 'critical 档不得直接 merge');
  } finally {
    criticalFixture.cleanup();
  }
}

async function deliveryHappyPath() {
  const fixture = makeFixture('delivery-happy', { workers: [{ id: 'worker-1' }] });
  try {
    writeSlots(fixture);
    master.masterStart({ ...base(fixture) });
    const job = driveToReadyToMerge(fixture, issuePayload({ number: 511 }));

    // fresh 校验：slot / commit / integration / AC / review(+base) / QA(+base) 都必须在门里。
    // review-base / qa-base 是 AC-007 新增的 integration-base 新鲜度检查。
    const gate = master.evaluateGate({ ...base(fixture), jobId: job.jobId });
    const ids = gate.mechanical.checks.map((check) => check.id);
    assert.deepEqual(ids, [
      'GATE-slot', 'GATE-commit', 'GATE-integration', 'GATE-acceptance',
      'GATE-review', 'GATE-review-base', 'GATE-qa', 'GATE-qa-base',
    ]);
    assert.equal(gate.mechanical.allGreen, true);

    const merged = master.masterMerge({ ...base(fixture), jobId: job.jobId });
    assert.equal(merged.ok, true);
    const verify = master.postMergeVerify({
      ...base(fixture), jobId: job.jobId,
      commands: [{ command: process.execPath, args: ['-e', 'process.exit(0)'] }],
    });
    assert.equal(verify.outcome, 'PASS');

    const closed = await master.masterClose({
      ...base(fixture), jobId: job.jobId,
      gh: async () => { throw new Error('close 不得调用 gh'); },
    });
    assert.equal(closed.outcome, 'CLOSED');
    assert.equal(closed.outbox.state, 'pending');
    // close 幂等：相同 comment digest 视为 already-succeeded，且不再调用 gh。
    const again = await master.masterClose({
      ...base(fixture), jobId: job.jobId,
      gh: async () => { throw new Error('幂等 close 不得再次调用 gh'); },
    });
    assert.equal(again.outcome, 'ALREADY_SUCCEEDED');
    assert.equal(again.commentDigest, closed.commentDigest);

    // 释放并同步 baseline 后 slot 才重新可领取。
    const registry = readV4Registry(fixture.v4Dir);
    assert.equal(registry.runners['worker-1'].lease, null, 'close 后必须释放 lease');
    assert.equal(registry.runners['worker-1'].claimable, false, '未同步 baseline 前不得可领取');
    const released = master.releaseAndSync({ ...base(fixture), jobId: job.jobId, slotId: 'worker-1' });
    assert.equal(released.claimable, true);
    assert.equal(
      readV4Registry(fixture.v4Dir).deliveries[job.jobId].runnerRelease.outcome, 'BASELINE_READY',
    );
  } finally {
    fixture.cleanup();
  }
}

// 证据绑定旁路：review/QA 绑定旧 commit 时，新 commit 不得带着旧证据过门。
// 两层各测各的 —— terminal 层拒收不一致报文；gate 层即便 registry 被绕过也 BLOCK。
async function evidenceBindingBypass() {
  const fixture = makeFixture('delivery-binding', { workers: [{ id: 'worker-1' }] });
  try {
    writeSlots(fixture);
    master.masterStart({ ...base(fixture) });
    const issue = issuePayload({ number: 541 });
    const claim = master.masterClaim({ ...base(fixture), issue });
    const first = makeCandidate(fixture, claim.slotId, { file: 'binding-1.txt' });
    master.recordCandidate({ ...base(fixture), jobId: claim.jobId, commitSha: first });
    // 本测试只关心 commit 绑定旁路（#84），与 baseCommit（AC-007）/ reviewerSessionId
    // （#65）无关，用 v1 证据保持聚焦——v1 在 GATE-review-base/qa-base 与
    // MISSING_REVIEWER_SESSION_ID 上都天然豁免，不干扰这里的断言。
    master.recordStageResult({ ...base(fixture), jobId: claim.jobId, stage: 'review', payload: passingReviewV1(claim.jobId, first) });
    master.recordStageResult({ ...base(fixture), jobId: claim.jobId, stage: 'qa', payload: passingQaV1(claim.jobId, first) });

    // worker 又推了新 commit，却不走 recordCandidate 而直接在 terminal 里报新 SHA：
    // 必须拒收，不得让 first 的 review/QA 给 second 背书。
    const second = makeCandidate(fixture, claim.slotId, { file: 'binding-2.txt' });
    const terminalPayload = readyTerminal(
      { jobId: claim.jobId, attemptId: claim.attemptId, issue: issue.number, baseCommit: claim.workOrder.runner.baseCommit },
      second, claim.workOrder.issue.contractDigest,
    );
    const rejected = master.masterTerminal({ ...base(fixture), payload: terminalPayload });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.code, 'CANDIDATE_MISMATCH');
    assert.equal(rejected.expected, first);
    assert.equal(rejected.actual, second);
    assert.equal(rejected.requiredAction, 'RECORD_CANDIDATE_FIRST');
    const registry = readV4Registry(fixture.v4Dir);
    assert.equal(registry.attempts[claim.attemptId].candidateCommit, first, 'terminal 不得推进 candidate');
    assert.notEqual(registry.jobs[claim.jobId].state, 'ready-to-merge', '拒收报文不得推进 job 状态');
    assert.ok(!registry.mergeQueue.includes(claim.jobId), '拒收报文不得入 merge queue');

    // 正路仍然通：recordCandidate 前进（作废旧证据）→ 重新绑定 second → terminal 接受。
    const advanced = master.recordCandidate({ ...base(fixture), jobId: claim.jobId, commitSha: second });
    assert.equal(advanced.invalidated.length, 2, 'candidate 前进必须作废旧 review+QA');
    master.recordStageResult({ ...base(fixture), jobId: claim.jobId, stage: 'review', payload: passingReviewV1(claim.jobId, second) });
    master.recordStageResult({ ...base(fixture), jobId: claim.jobId, stage: 'qa', payload: passingQaV1(claim.jobId, second) });
    const accepted = master.masterTerminal({ ...base(fixture), payload: terminalPayload });
    assert.equal(accepted.state, 'ready-to-merge');
    const gate = master.evaluateGate({ ...base(fixture), jobId: claim.jobId });
    assert.equal(gate.mechanical.allGreen, true, '重新绑定后机械门必须全绿');

    // gate 层最后防线：即便上游状态机被绕过（直接拿旧证据 + 新 candidate 进门），
    // GATE-review / GATE-qa 也必须因 commit 不相等而 FAIL。
    const mechanical = evaluateMechanicalGate({
      slotOk: true, commitFresh: true, integrationOk: true,
      acceptance: [{ id: 'AC-1', outcome: 'PASS' }],
      review: passingReviewV1(claim.jobId, first),
      qa: passingQaV1(claim.jobId, first),
      candidateCommit: second,
    });
    const outcomes = Object.fromEntries(mechanical.checks.map((check) => [check.id, check.outcome]));
    assert.equal(outcomes['GATE-review'], 'FAIL', '绑定旧 commit 的 review 不得过门');
    assert.equal(outcomes['GATE-qa'], 'FAIL', '绑定旧 commit 的 QA 不得过门');
    const decision = decideMerge({ mechanical, policy: resolveMergePolicy({ declaredRisk: 'low' }) });
    assert.equal(decision.decision, 'BLOCKED_MECHANICAL');

    // candidateCommit 缺失时同样不得放行 —— 「无从比对」不等于「比对通过」。
    const unbound = evaluateMechanicalGate({
      slotOk: true, commitFresh: true, integrationOk: true,
      acceptance: [{ id: 'AC-1', outcome: 'PASS' }],
      review: passingReviewV1(claim.jobId, first),
      qa: passingQaV1(claim.jobId, first),
      candidateCommit: null,
    });
    assert.equal(unbound.allGreen, false, 'candidateCommit 缺失时机械门不得全绿');
  } finally {
    fixture.cleanup();
  }
}

// E8: merge 成功但 post-merge verification 失败 → 不 close、不释放 slot、保留失败证据。
async function postMergeVerificationFailure() {
  const fixture = makeFixture('delivery-verify-fail', { workers: [{ id: 'worker-1' }] });
  try {
    writeSlots(fixture);
    master.masterStart({ ...base(fixture) });
    const job = driveToReadyToMerge(fixture, issuePayload({ number: 521 }));
    const merged = master.masterMerge({ ...base(fixture), jobId: job.jobId });
    assert.equal(merged.ok, true);

    const failed = master.postMergeVerify({
      ...base(fixture), jobId: job.jobId,
      commands: [{ command: process.execPath, args: ['-e', 'process.exit(3)'] }],
    });
    assert.equal(failed.ok, false);
    assert.equal(failed.code, 'POST_MERGE_VERIFICATION_FAILED');
    assert.equal(failed.issueClosed, false);
    assert.equal(failed.slotReleased, false);
    assert.equal(failed.disposition, 'HOLD_SLOT_AND_ISSUE');
    assert.equal(failed.mergeCommit, merged.mergeCommit, 'merge commit 必须保留');

    const registry = readV4Registry(fixture.v4Dir);
    assert.ok(registry.runners['worker-1'].lease, 'verification 失败时 slot 不得释放');
    assert.equal(registry.deliveries[job.jobId].postMergeVerification.outcome, 'FAIL');
    assert.ok(registry.deliveries[job.jobId].postMergeVerification.runs[0].stderr !== undefined);

    // 未通过 verification 时 close 必须拒绝。
    const closed = await master.masterClose({
      ...base(fixture), jobId: job.jobId, gh: async () => { throw new Error('不得调用'); },
    });
    assert.equal(closed.ok, false);
    assert.equal(closed.code, 'VERIFICATION_NOT_PASSED');
    assert.equal(closed.issueClosed, false);

    // 重启后仍然停在失败态，不得被当成完成。
    const reconcile = freshProcess(fixture, ['reconcile']);
    const action = reconcile.actions.find((entry) => entry.jobId === job.jobId);
    assert.equal(action.action, 'HOLD_FAILED_VERIFICATION');
  } finally {
    fixture.cleanup();
  }
}

async function mergeConflictDisposition() {
  const fixture = makeFixture('delivery-conflict', { workers: [{ id: 'worker-1' }] });
  try {
    writeSlots(fixture);
    master.masterStart({ ...base(fixture) });
    const issue = issuePayload({ number: 531 });
    const claim = master.masterClaim({ ...base(fixture), issue });
    const baseCommit = claim.workOrder.runner.baseCommit;
    const candidate = makeConflict(fixture, claim.slotId);
    master.recordCandidate({ ...base(fixture), jobId: claim.jobId, commitSha: candidate });
    master.setAttemptOwnerThreadId({ ...base(fixture), jobId: claim.jobId, ownerThreadId: 'owner-conflict' });
    master.recordStageResult({ ...base(fixture), jobId: claim.jobId, stage: 'review', payload: passingReview(claim.jobId, candidate, baseCommit, 'owner-conflict') });
    master.recordStageResult({ ...base(fixture), jobId: claim.jobId, stage: 'qa', payload: passingQa(claim.jobId, candidate, baseCommit) });
    master.masterTerminal({
      ...base(fixture),
      payload: readyTerminal(
        { jobId: claim.jobId, attemptId: claim.attemptId, issue: 531, baseCommit: claim.workOrder.runner.baseCommit },
        candidate, claim.workOrder.issue.contractDigest,
      ),
    });

    const headBefore = gitOut(fixture.repoRoot, ['rev-parse', 'dev']);
    const result = master.masterMerge({ ...base(fixture), jobId: claim.jobId });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'MERGE_CONFLICT');
    assert.equal(result.disposition, 'AWAITING_FIX');
    assert.ok(result.detail, 'merge conflict 必须保留失败证据');
    assert.equal(gitOut(fixture.repoRoot, ['rev-parse', 'dev']), headBefore, 'conflict 后 integration 必须回到原位');
    assert.equal(gitOut(fixture.repoRoot, ['status', '--porcelain=v1']), '', 'conflict 后不得留下半合并现场');
    const registry = readV4Registry(fixture.v4Dir);
    assert.equal(registry.jobs[claim.jobId].state, 'ready-to-merge');
    assert.ok(registry.runners['worker-1'].lease, 'conflict 不得释放 slot');
    assert.ok(readReceipts(fixture.v4Dir).some((entry) => entry.kind === 'merge-failed'));
  } finally {
    fixture.cleanup();
  }
}

async function serialMergeEnforcement() {
  const fixture = makeFixture('delivery-serial', { workers: [{ id: 'worker-1' }, { id: 'worker-2' }] });
  try {
    writeSlots(fixture);
    master.masterStart({ ...base(fixture) });
    const first = driveToReadyToMerge(fixture, issuePayload({ number: 541 }), { slotId: 'worker-1' });
    const second = driveToReadyToMerge(fixture, issuePayload({ number: 542 }), { slotId: 'worker-2' });

    // 第一个 job 占住串行 merge 槽位（只开 intent，不完成）。
    master.openMergeIntent({ ...base(fixture), jobId: first.jobId });
    assert.throws(() => master.openMergeIntent({ ...base(fixture), jobId: second.jobId }),
      (error) => error.code === 'MERGE_NOT_SERIAL');
    assert.equal(readV4Registry(fixture.v4Dir).jobs[second.jobId].state, 'ready-to-merge');

    // 完成第一个后第二个才能进。
    const result = master.runIntegrationMerge({ ...base(fixture), intent: readV4Registry(fixture.v4Dir).jobs[first.jobId].mergeIntent });
    master.finalizeMerge({ ...base(fixture), result: { intent: readV4Registry(fixture.v4Dir).jobs[first.jobId].mergeIntent, ...result } });
    const secondMerge = master.masterMerge({ ...base(fixture), jobId: second.jobId });
    assert.equal(secondMerge.ok, true);
  } finally {
    fixture.cleanup();
  }
}

// AC-4: integration 前进使旧 base 上取得的 stage 证据失效（AC-007）。
// 链路：旧 base 取证 → integration 前进 → 门禁判 STALE → 重新取证 → 放行。
export async function integrationBaseAdvanceStaleEvidence() {
  const fixture = makeFixture('integration-base-advance', { workers: [{ id: 'worker-1' }] });
  try {
    writeSlots(fixture);
    master.masterStart({ ...base(fixture) });

    const issue = issuePayload({ number: 551 });
    const claim = master.masterClaim({ ...base(fixture), issue });
    const jobId = claim.jobId;
    const oldBaseCommit = claim.workOrder.runner.baseCommit;

    // 第一部分：在旧 base 上取得 review/QA 证据。
    const candidate = makeCandidate(fixture, claim.slotId, { file: 'ac4.txt' });
    master.recordCandidate({ ...base(fixture), jobId, commitSha: candidate });
    const reviewResult = master.recordStageResult({
      ...base(fixture), jobId, stage: 'review', payload: passingReview(jobId, candidate, oldBaseCommit),
    });
    assert.equal(reviewResult.ok, true, 'review 在旧 base 上应该通过');

    const qaResult = master.recordStageResult({
      ...base(fixture), jobId, stage: 'qa', payload: passingQa(jobId, candidate, oldBaseCommit),
    });
    assert.equal(qaResult.ok, true, 'QA 在旧 base 上应该通过');

    // 准备 terminal 来激活 gate 的其他检查。
    const terminalResult = master.masterTerminal({
      ...base(fixture),
      payload: readyTerminal(
        { jobId, attemptId: claim.attemptId, issue: issue.number, baseCommit: oldBaseCommit },
        candidate, claim.workOrder.issue.contractDigest,
      ),
    });
    assert.equal(terminalResult.state, 'ready-to-merge', 'terminal 应该将 job 推送到 ready-to-merge');

    // 此时 gate 应该通过（证据绑定当前 base）。
    const gateBeforeAdvance = master.evaluateGate({ ...base(fixture), jobId });
    assert.equal(gateBeforeAdvance.mechanical.allGreen, true, '旧 base 证据应该通过 gate');

    // 第二部分：模拟 integration 前进。这里直接更新 registry 中 job 的 baseCommit。
    // 真实场景中这是因为其他 PR 合入了 integration branch。
    const newBaseCommit = makeCandidate(fixture, claim.slotId, { file: 'unrelated.txt' });
    const updated = updateV4Registry(fixture.v4Dir, (registry) => {
      const job = registry.jobs[jobId];
      const oldBase = job.baseCommit;
      job.baseCommit = newBaseCommit;
      return { oldBase, newBase: newBaseCommit };
    });
    assert.equal(updated.oldBase, oldBaseCommit);

    // 第三部分：gate 应该判 review/QA 为 STALE（baseCommit 不匹配）。
    const gateAfterAdvance = master.evaluateGate({ ...base(fixture), jobId });
    const failedChecks = gateAfterAdvance.mechanical.failed.map((c) => c.id);
    assert.ok(failedChecks.includes('GATE-review-base'), 'review baseCommit 不匹配应该拒绝放行');
    assert.ok(failedChecks.includes('GATE-qa-base'), 'QA baseCommit 不匹配应该拒绝放行');
    assert.equal(gateAfterAdvance.mechanical.allGreen, false, 'STALE 证据应该拒绝 gate');

    // 验证证据本身未被清空（AC-3）。
    const registry = readV4Registry(fixture.v4Dir);
    const attempt = registry.attempts[claim.attemptId];
    assert.ok(attempt.review, 'STALE 判定不应该清空 review 证据');
    assert.ok(attempt.qa, 'STALE 判定不应该清空 QA 证据');

    // 第四部分：在新 base 上重新取得证据。
    const newReviewResult = master.recordStageResult({
      ...base(fixture), jobId, stage: 'review', payload: passingReview(jobId, candidate, newBaseCommit),
    });
    assert.equal(newReviewResult.ok, true, 'review 在新 base 上应该通过');

    const newQaResult = master.recordStageResult({
      ...base(fixture), jobId, stage: 'qa', payload: passingQa(jobId, candidate, newBaseCommit),
    });
    assert.equal(newQaResult.ok, true, 'QA 在新 base 上应该通过');

    // 第五部分：重新 gate，应该全绿放行。
    const gateFinal = master.evaluateGate({ ...base(fixture), jobId });
    assert.equal(gateFinal.mechanical.allGreen, true, '新 base 证据应该通过 gate');
    assert.ok(gateFinal.decision.mayMerge, '新 base 证据应该允许 merge');
  } finally {
    fixture.cleanup();
  }
}

// stage-result / qa-receipt 的 v1→v2 向下兼容（AC-007 的兼容性缺口，回填）：
// - v1（历史 schema，无 baseCommit）必须仍能推进全流程直到 merge——这是
//   历史 trajectory replay 依赖的不变量，不是可选行为。
// - v2 缺 baseCommit 必须 fail closed（AC-1）。
// - v2 的 baseCommit 与当前 job base 不一致时必须判 STALE（AC-2），
//   v1 对同一 mismatch 免疫（它从未声明过这个字段，不能回溯性地判它不合格）。
export async function stageResultSchemaBackwardCompat() {
  const fixture = makeFixture('schema-compat', { workers: [{ id: 'worker-1' }, { id: 'worker-2' }] });
  try {
    writeSlots(fixture);
    master.masterStart({ ...base(fixture) });

    // 两个 job 都先 claim：merge job-1 会推进 integration HEAD，
    // 事后才 claim worker-2 会撞上「未同步 baseline 不可领取」，与本测试意图无关。
    const issueV1 = issuePayload({ number: 561 });
    const claimV1 = master.masterClaim({ ...base(fixture), issue: issueV1, slotId: 'worker-1' });
    const issueV2 = issuePayload({ number: 562 });
    const claimV2 = master.masterClaim({ ...base(fixture), issue: issueV2, slotId: 'worker-2' });
    const oldBase = claimV2.workOrder.runner.baseCommit;

    // --- 分支一：纯 v1 证据必须能走完整条链路到 merge。 ---
    const candidateV1 = makeCandidate(fixture, claimV1.slotId, { file: 'compat-v1.txt' });
    master.recordCandidate({ ...base(fixture), jobId: claimV1.jobId, commitSha: candidateV1 });

    const reviewV1 = master.recordStageResult({
      ...base(fixture), jobId: claimV1.jobId, stage: 'review', payload: passingReviewV1(claimV1.jobId, candidateV1),
    });
    assert.equal(reviewV1.ok, true, 'v1 review 必须被接受');
    const qaV1 = master.recordStageResult({
      ...base(fixture), jobId: claimV1.jobId, stage: 'qa', payload: passingQaV1(claimV1.jobId, candidateV1),
    });
    assert.equal(qaV1.ok, true, 'v1 QA 必须被接受');

    const terminalV1 = master.masterTerminal({
      ...base(fixture),
      payload: readyTerminal(
        { jobId: claimV1.jobId, attemptId: claimV1.attemptId, issue: issueV1.number, baseCommit: claimV1.workOrder.runner.baseCommit },
        candidateV1, claimV1.workOrder.issue.contractDigest,
      ),
    });
    assert.equal(terminalV1.state, 'ready-to-merge');

    const gateV1 = master.evaluateGate({ ...base(fixture), jobId: claimV1.jobId });
    const v1Checks = Object.fromEntries(gateV1.mechanical.checks.map((c) => [c.id, c.outcome]));
    assert.equal(v1Checks['GATE-review-base'], 'PASS', 'v1 证据在 GATE-review-base 上应豁免通过');
    assert.equal(v1Checks['GATE-qa-base'], 'PASS', 'v1 证据在 GATE-qa-base 上应豁免通过');
    assert.equal(gateV1.mechanical.allGreen, true, 'v1 全套证据应该通过机械门');
    assert.ok(gateV1.decision.mayMerge, 'v1 全套证据应该允许 merge（向下兼容不变量）');

    const mergedV1 = master.masterMerge({ ...base(fixture), jobId: claimV1.jobId });
    assert.equal(mergedV1.ok, true, 'v1 证据必须能真实 merge 成功');

    // --- 分支二：v2 证据下，integration 前进后旧 baseCommit 必须判 STALE；
    //     同样的 mismatch 对 v1 不生效，用以对照两版本语义的差异是设计出来的，不是漏洞。 ---
    const candidateV2 = makeCandidate(fixture, claimV2.slotId, { file: 'compat-v2.txt' });
    master.recordCandidate({ ...base(fixture), jobId: claimV2.jobId, commitSha: candidateV2 });
    master.recordStageResult({
      ...base(fixture), jobId: claimV2.jobId, stage: 'review', payload: passingReview(claimV2.jobId, candidateV2, oldBase),
    });
    master.recordStageResult({
      ...base(fixture), jobId: claimV2.jobId, stage: 'qa', payload: passingQa(claimV2.jobId, candidateV2, oldBase),
    });

    // 模拟 integration 前进（同 integrationBaseAdvanceStaleEvidence 的手法）。
    const newBase = makeCandidate(fixture, claimV2.slotId, { file: 'compat-unrelated.txt' });
    updateV4Registry(fixture.v4Dir, (registry) => { registry.jobs[claimV2.jobId].baseCommit = newBase; });

    const gateV2Stale = master.evaluateGate({ ...base(fixture), jobId: claimV2.jobId });
    const v2Checks = Object.fromEntries(gateV2Stale.mechanical.checks.map((c) => [c.id, c.outcome]));
    assert.equal(v2Checks['GATE-review-base'], 'FAIL', 'v2 证据在 base 前进后必须判 STALE（不豁免）');
    assert.equal(v2Checks['GATE-qa-base'], 'FAIL', 'v2 QA 证据在 base 前进后必须判 STALE（不豁免）');
    assert.equal(gateV2Stale.mechanical.allGreen, false, 'v2 STALE 证据必须拒绝放行');
  } finally {
    fixture.cleanup();
  }
}

// v3 legacy runtime 只读封存：hash 不变，且不推导出任何 job/attempt。
async function legacyArchiveStable() {
  const fixture = makeFixture('legacy', { workers: [{ id: 'worker-1' }] });
  try {
    writeSlots(fixture);
    const legacyDir = join(fixture.root, 'runtime-v3');
    const legacyRegistry = {
      schemaVersion: 3,
      tasks: { 'T-1': { worktree: 'dev1', state: 'merged' } },
      leases: {}, actions: {}, goal: null,
    };
    mkdirSync(legacyDir, { recursive: true });
    writeFileSync(join(legacyDir, 'registry.json'), JSON.stringify(legacyRegistry, null, 2));
    const beforeHash = hashFile(join(legacyDir, 'registry.json'));

    const started = master.masterStart({ ...base(fixture), legacyRuntimeDir: legacyDir });
    assert.equal(started.ok, true);
    const registry = readV4Registry(fixture.v4Dir);
    assert.equal(registry.legacyArchive.readOnly, true);
    assert.equal(registry.legacyArchive.derivedJobs, false, 'legacy 不得反向推导 job/attempt');
    assert.equal(Object.keys(registry.jobs).length, 0, 'legacy 封存不得产生 job');
    assert.equal(Object.keys(registry.attempts).length, 0);
    assert.equal(hashFile(join(legacyDir, 'registry.json')), beforeHash, 'legacy 文件 hash 必须不变');

    // 重复封存幂等。
    const sealedAt = registry.legacyArchive.sealedAt;
    master.masterStart({ ...base(fixture), legacyRuntimeDir: legacyDir });
    assert.equal(readV4Registry(fixture.v4Dir).legacyArchive.sealedAt, sealedAt, '同一 digest 重复封存必须幂等');
    assert.equal(hashFile(join(legacyDir, 'registry.json')), beforeHash);

    // append-only 审计：transitions 只增不减。
    const transitions = readTransitions(fixture.v4Dir);
    assert.ok(transitions.length >= 2);
    assert.ok(transitions.every((entry) => entry.at));
  } finally {
    fixture.cleanup();
  }
}

function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

// AC-1 ~ AC-5: reviewer 独立性机械判据
export async function reviewerIndependenceScenario() {
  const fixture = makeFixture('reviewer-independence', {
    workers: [{ id: 'worker-1' }, { id: 'worker-2' }, { id: 'worker-3' }],
  });
  try {
    writeSlots(fixture);
    master.masterStart({ ...base(fixture) });

    // 场景 1: same-session review（owner 与 reviewer 同 session）
    const sameSessionJob = driveToReadyToMerge(
      fixture, issuePayload({ number: 601 }),
      { slotId: 'worker-1', ownerThreadId: 'session-A', reviewerSessionId: 'session-A' }
    );
    const sameSessionRegistry = readV4Registry(fixture.v4Dir);
    const sameSessionAttempt = sameSessionRegistry.attempts[sameSessionJob.attemptId];
    assert.equal(sameSessionAttempt.reviewerIndependence, 'same-session', 'same-session 必须被推导');
    assert.equal(sameSessionAttempt.reviewerSessionId, 'session-A', 'reviewer session id 必须被记录');
    const sameSessionReceipts = readReceipts(fixture.v4Dir)
      .filter((entry) => entry.attemptId === sameSessionJob.attemptId && entry.kind === 'review');
    assert.ok(sameSessionReceipts.length > 0, 'review receipt 必须被记录');

    // 场景 2: independent review（owner 与 reviewer 不同 session）
    const independentJob = driveToReadyToMerge(
      fixture, issuePayload({ number: 602 }),
      { slotId: 'worker-2', ownerThreadId: 'session-B', reviewerSessionId: 'reviewer-C' }
    );
    const independentRegistry = readV4Registry(fixture.v4Dir);
    const independentAttempt = independentRegistry.attempts[independentJob.attemptId];
    assert.equal(independentAttempt.reviewerIndependence, 'independent', 'independent 必须被推导');
    assert.equal(independentAttempt.reviewerSessionId, 'reviewer-C', 'reviewer session id 必须被记录');

    // 场景 3: ownerThreadId 未记录（无法判定）→ 必须如实记 unknown，不得默认 independent。
    // fail-closed 口径：owner 侧标识缺失时，「无法证明独立」不能偷换成「独立」。
    const unknownOwnerJob = driveToReadyToMerge(
      fixture, issuePayload({ number: 603 }),
      { slotId: 'worker-3', ownerThreadId: null, reviewerSessionId: 'reviewer-D' }
    );
    const unknownOwnerRegistry = readV4Registry(fixture.v4Dir);
    const unknownOwnerAttempt = unknownOwnerRegistry.attempts[unknownOwnerJob.attemptId];
    assert.equal(unknownOwnerAttempt.reviewerIndependence, 'unknown', 'ownerThreadId 缺失时必须记 unknown，不得默认 independent');

    // AC-3: 三种情况都不阻断 merge gate
    const sameSessionGate = master.evaluateGate({ ...base(fixture), jobId: sameSessionJob.jobId });
    assert.equal(sameSessionGate.mechanical.allGreen, true, 'same-session 不得阻断 merge gate');
    const independentGate = master.evaluateGate({ ...base(fixture), jobId: independentJob.jobId });
    assert.equal(independentGate.mechanical.allGreen, true, 'independent 不得阻断 merge gate');
    const unknownOwnerGate = master.evaluateGate({ ...base(fixture), jobId: unknownOwnerJob.jobId });
    assert.equal(unknownOwnerGate.mechanical.allGreen, true, 'unknown 不得阻断 merge gate');

    // AC-4: same-session 在 receipt 中显式标记
    const sameSessionReceiptPayload = sameSessionReceipts[0].payload;
    assert.ok(sameSessionReceiptPayload, 'receipt 必须包含 payload');

  } finally {
    fixture.cleanup();
  }
}

// AC-1: v2 起缺失 reviewerSessionId 时 schema fail closed；v1 legacy 无此要求（向后兼容）。
export async function missingReviewerSessionIdScenario() {
  const fixture = makeFixture('missing-reviewer-id', { workers: [{ id: 'worker-1' }] });
  try {
    writeSlots(fixture);
    master.masterStart({ ...base(fixture) });
    const issue = issuePayload({ number: 610 });
    const claim = master.masterClaim({ ...base(fixture), issue });
    master.setAttemptOwnerThreadId({ ...base(fixture), jobId: claim.jobId, ownerThreadId: 'owner-1' });

    const candidate = makeCandidate(fixture, claim.slotId, { file: 'test.txt' });
    master.recordCandidate({ ...base(fixture), jobId: claim.jobId, commitSha: candidate });

    // v2 报文缺失 reviewerSessionId → fail closed。带上 baseCommit 使其满足 AC-007
    // 的必填项，本测试才能精确定位到 reviewerSessionId 这一个缺口（否则会先撞上
    // MISSING_BASE_COMMIT，测不到这里想测的东西）。
    const badReviewV2 = {
      schemaVersion: 'aes.issue-worker.stage-result/v2',
      jobId: claim.jobId, stage: 'code-review', commitSha: candidate, outcome: 'PASS',
      findings: [], evidence: [], mayAdvance: true,
      baseCommit: claim.workOrder.runner.baseCommit,
      // 缺少 reviewerSessionId
    };
    const result = master.recordStageResult({ ...base(fixture), jobId: claim.jobId, stage: 'review', payload: badReviewV2 });
    assert.equal(result.ok, false, 'v2 缺失 reviewerSessionId 必须 fail closed');
    assert.equal(result.code, 'MISSING_REVIEWER_SESSION_ID', '必须报 MISSING_REVIEWER_SESSION_ID');

    // v1 报文同样缺失 reviewerSessionId → 必须被接受（向后兼容历史证据），
    // 但 reviewerIndependence 推导为 'unknown'，不得被判定为 same-session 或 independent。
    const legacyReview = passingReviewV1(claim.jobId, candidate);
    const accepted = master.recordStageResult({ ...base(fixture), jobId: claim.jobId, stage: 'review', payload: legacyReview });
    assert.equal(accepted.ok, true, 'v1 legacy 报文缺失 reviewerSessionId 必须被接受（不追溯要求）');
    assert.equal(accepted.reviewerIndependence, 'unknown', 'v1 无 reviewerSessionId 时必须如实记 unknown，不得默认 independent');
    const registry = readV4Registry(fixture.v4Dir);
    assert.equal(registry.attempts[claim.attemptId].reviewerIndependence, 'unknown');
  } finally {
    fixture.cleanup();
  }
}

// #72：job.acceptance 不得靠 GATE-commit 兜底 —— candidate 前进时 acceptance 与
// review/qa 同构失效，且 GATE-acceptance 自己校验取证 commit 等于当前 candidate。
export async function acceptanceInvalidationScenario() {
  const fixture = makeFixture('acceptance-stale', { workers: [{ id: 'worker-1' }] });
  try {
    writeSlots(fixture);
    master.masterStart({ ...base(fixture) });
    const issue = issuePayload({ number: 571 });
    const job = driveToReadyToMerge(fixture, issue);

    // terminal 落盘时必须记录 acceptance 的取证 commit。
    let registry = readV4Registry(fixture.v4Dir);
    assert.equal(registry.jobs[job.jobId].acceptanceCommit, job.candidate, 'terminal 必须记录 acceptance 的取证 commit');
    assert.equal(master.evaluateGate({ ...base(fixture), jobId: job.jobId }).mechanical.allGreen, true);

    // candidate 前进：review / qa / acceptance 三者一起失效。
    const second = makeCandidate(fixture, job.slotId, { file: 'acceptance-2.txt' });
    const advanced = master.recordCandidate({ ...base(fixture), jobId: job.jobId, commitSha: second });
    assert.deepEqual(advanced.invalidated.map((entry) => entry.kind).sort(), ['acceptance', 'qa', 'review'],
      'candidate 前进必须同时作废 acceptance（不只 review/qa）');
    registry = readV4Registry(fixture.v4Dir);
    assert.equal(registry.jobs[job.jobId].acceptance, null, 'job.acceptance 必须被作废');
    assert.equal(registry.jobs[job.jobId].acceptanceCommit, null, '取证 commit 必须一并作废');

    // acceptance 失效后 GATE-acceptance 必须自己 FAIL，而不是报 5/5 PASS 让 GATE-commit 兜。
    const staleGate = master.evaluateGate({ ...base(fixture), jobId: job.jobId });
    const staleOutcomes = Object.fromEntries(staleGate.mechanical.checks.map((check) => [check.id, check.outcome]));
    assert.equal(staleOutcomes['GATE-acceptance'], 'FAIL', 'acceptance 失效后 GATE-acceptance 必须自己 FAIL');

    // gate 最后防线：即便上游状态机被绕过（AC 全 PASS 但取证 commit 是旧的），
    // GATE-acceptance 也必须因 acceptanceCommit != candidateCommit 而 FAIL。
    const bypass = evaluateMechanicalGate({
      slotOk: true, commitFresh: true, integrationOk: true,
      acceptance: [{ id: 'AC-1', outcome: 'PASS' }],
      acceptanceCommit: job.candidate,
      review: passingReviewV1(job.jobId, second),
      qa: passingQaV1(job.jobId, second),
      candidateCommit: second,
    });
    assert.equal(Object.fromEntries(bypass.checks.map((check) => [check.id, check.outcome]))['GATE-acceptance'], 'FAIL',
      '旧 commit 上取得的 AC 结论不得给新 candidate 放行');
    assert.equal(decideMerge({ mechanical: bypass, policy: resolveMergePolicy({ declaredRisk: 'low' }) }).decision,
      'BLOCKED_MECHANICAL');

    // 取证 commit 缺失同样 FAIL ——「无从比对」不等于「比对通过」。
    const unbound = evaluateMechanicalGate({
      slotOk: true, commitFresh: true, integrationOk: true,
      acceptance: [{ id: 'AC-1', outcome: 'PASS' }],
      acceptanceCommit: null,
      review: passingReviewV1(job.jobId, second),
      qa: passingQaV1(job.jobId, second),
      candidateCommit: second,
    });
    assert.equal(Object.fromEntries(unbound.checks.map((check) => [check.id, check.outcome]))['GATE-acceptance'], 'FAIL',
      'acceptance 取证 commit 缺失不得放行');

    // 正路重新走一遍：新证据 + 新 terminal → acceptance 重新绑定新 commit，gate 全绿。
    master.recordStageResult({
      ...base(fixture), jobId: job.jobId, stage: 'review',
      payload: passingReview(job.jobId, second, job.baseCommit, 'owner-session-1'),
    });
    master.recordStageResult({
      ...base(fixture), jobId: job.jobId, stage: 'qa', payload: passingQa(job.jobId, second, job.baseCommit),
    });
    const terminal = master.masterTerminal({
      ...base(fixture),
      payload: readyTerminal(
        { jobId: job.jobId, attemptId: job.attemptId, issue: issue.number, baseCommit: job.baseCommit },
        second, job.claim.workOrder.issue.contractDigest,
      ),
    });
    assert.equal(terminal.state, 'ready-to-merge');
    assert.equal(readV4Registry(fixture.v4Dir).jobs[job.jobId].acceptanceCommit, second, '重新取证后绑定新 commit');
    assert.equal(master.evaluateGate({ ...base(fixture), jobId: job.jobId }).mechanical.allGreen, true,
      '重新取证后机械门必须全绿');
  } finally {
    fixture.cleanup();
  }
}

// #76：human open 的证据清单不得静默为空。近似参数（--required-evidence）与未知参数
// fail closed；重复 --evidence 累积成数组；requiredEvidence 为空必须显式失败。
export async function humanOpenEvidenceScenario() {
  const fixture = makeFixture('human-evidence', { workers: [{ id: 'worker-1' }] });
  try {
    writeSlots(fixture);
    freshProcess(fixture, ['start']);
    const claim = master.masterClaim({ ...base(fixture), issue: issuePayload({ number: 581 }) });
    const humanArgs = ['human', 'open', '--job', claim.jobId, '--state', 'awaiting-human',
      '--kind', 'risk_approval', '--prompt', '需要人工批准合并'];

    // #76 主缺陷复现路径：--required-evidence 曾被静默丢弃且 ok:true。现在必须报错退出。
    const unknown = freshProcess(fixture, [...humanArgs, '--required-evidence', '机械门六项全绿'], { expectStatus: 'nonzero' });
    assert.equal(unknown.code, 'UNKNOWN_OPTION', '近似参数必须 fail closed，不得静默丢弃');
    assert.ok(/--evidence/.test(unknown.hint || ''), '报错必须指路到正确参数 --evidence');
    assert.equal(readV4Registry(fixture.v4Dir).jobs[claim.jobId].state, 'dispatched', '未知参数不得推进状态');

    // 证据清单为空必须显式失败：人工门没有证据本身就可疑，不得开出盲签请求。
    const empty = freshProcess(fixture, humanArgs, { expectStatus: 'nonzero' });
    assert.equal(empty.code, 'EMPTY_REQUIRED_EVIDENCE');
    const afterEmpty = readV4Registry(fixture.v4Dir);
    assert.equal(afterEmpty.jobs[claim.jobId].state, 'dispatched', '空证据请求不得推进状态');
    assert.equal(Object.keys(afterEmpty.humanRequests).length, 0, '失败的 human open 不得留下 humanRequest');

    // 库函数同口径（CLI 只是入口之一，收紧必须发生在创建侧）。
    assert.throws(() => master.openHumanRequest({
      ...base(fixture), jobId: claim.jobId, state: 'awaiting-human', kind: 'risk_approval',
      prompt: '需要人工批准合并', requiredEvidence: [],
    }), (error) => error.code === 'EMPTY_REQUIRED_EVIDENCE');

    // 重复 --evidence 累积成数组，且历史 JSON 数组形态继续可用（两者可混用）。
    const opened = freshProcess(fixture, [...humanArgs,
      '--evidence', '机械门六项全绿',
      '--evidence', '["Master 独立复跑 10/10","被测代码零改动"]']);
    assert.deepEqual(opened.humanRequest.requiredEvidence,
      ['机械门六项全绿', 'Master 独立复跑 10/10', '被测代码零改动'],
      '重复 --evidence 与 JSON 数组形态必须都累积进 requiredEvidence');
    assert.equal(opened.state, 'awaiting-human');

    // 非累积参数重复出现 fail closed，不得静默 last-wins。
    const duplicated = freshProcess(fixture, ['gate', '--job', claim.jobId, '--job', claim.jobId], { expectStatus: 'nonzero' });
    assert.equal(duplicated.code, 'DUPLICATE_OPTION');

    // 以 [ 开头但不是合法 JSON 数组的 --evidence 必须报错，不得静默当普通字符串。
    const badJson = freshProcess(fixture, [...humanArgs, '--evidence', '["未闭合'], { expectStatus: 'nonzero' });
    assert.equal(badJson.code, 'BAD_EVIDENCE');
  } finally {
    fixture.cleanup();
  }
}

// #78：attemptNew 改派必须释放旧 slot 租约（仅当确属本 job）、新 attempt 绑定新 slot
// 的实时 HEAD 而非陈旧 job.baseCommit；reconcile 的 unexplainedSlots 覆盖残留双租约。
export async function attemptReassignScenario() {
  const fixture = makeFixture('attempt-reassign', {
    workers: [{ id: 'worker-1' }, { id: 'worker-2' }, { id: 'worker-3' }],
  });
  try {
    writeSlots(fixture);
    master.masterStart({ ...base(fixture) });
    const claim = master.masterClaim({ ...base(fixture), issue: issuePayload({ number: 591 }), slotId: 'worker-1' });
    const jobId = claim.jobId;
    const staleBase = claim.workOrder.runner.baseCommit;

    // 复现实测现场：别的 job 合入使 integration 前进，worker-2 已 release 同步到新 HEAD，
    // 而 job.baseCommit 还停在 claim 那一刻的旧值。
    writeFileSync(join(fixture.repoRoot, 'other-job.txt'), 'merged by another job\n');
    git(fixture.repoRoot, ['add', '.']);
    git(fixture.repoRoot, ['commit', '-m', 'other job merged']);
    const liveHead = gitOut(fixture.repoRoot, ['rev-parse', 'dev']);
    git(fixture.worktreeOf('worker-2'), ['reset', '--hard', liveHead]);
    assert.notEqual(liveHead, staleBase);

    master.attemptInterrupt({ ...base(fixture), jobId, reason: 'slot 被外部占用' });
    const next = master.attemptNew({ ...base(fixture), jobId, slotId: 'worker-2' });

    // 缺陷二：新 attempt 的 baseCommit 必须是新 slot 的实时 HEAD，不是继承的旧值。
    assert.equal(next.baseCommit, liveHead, '新 attempt 必须绑定新 slot 的实时 HEAD');
    assert.equal(next.baseCommitAdvancedFrom, staleBase, 'base 前进必须留下可审计的旧值');
    let registry = readV4Registry(fixture.v4Dir);
    assert.equal(registry.attempts[next.attemptId].baseCommit, liveHead);
    assert.equal(registry.jobs[jobId].baseCommit, liveHead, 'job.baseCommit 必须跟随实际执行基线');

    // 缺陷一：旧 slot 的租约必须释放，同一 job 不得同时持有两个 slot 租约。
    assert.equal(next.releasedSlotId, 'worker-1');
    assert.equal(registry.runners['worker-1'].lease, null, '改派后旧 slot 租约必须释放');
    assert.equal(registry.runners['worker-2'].lease.jobId, jobId);
    assert.equal(Object.values(registry.runners).filter((runner) => runner.lease?.jobId === jobId).length, 1,
      '同一 job 在改派后只允许持有一个 slot 租约');

    // 只释放确属本 job 的租约：旧 slot 已被别的 job 租走时不得误伤。
    updateV4Registry(fixture.v4Dir, (writable) => {
      writable.runners['worker-2'].lease = {
        jobId: 'job-foreign', attemptId: 'job-foreign#attempt-1', acquiredAt: '2026-01-01T00:00:00.000Z',
      };
    });
    master.attemptInterrupt({ ...base(fixture), jobId, reason: '再次改派' });
    const third = master.attemptNew({ ...base(fixture), jobId, slotId: 'worker-3' });
    registry = readV4Registry(fixture.v4Dir);
    assert.equal(registry.runners['worker-2'].lease.jobId, 'job-foreign', '不属本 job 的租约不得被释放');
    assert.equal(third.releasedSlotId, null);
    assert.equal(registry.runners['worker-3'].lease.jobId, jobId);
    assert.equal(third.baseCommit, gitOut(fixture.worktreeOf('worker-3'), ['rev-parse', 'HEAD']),
      '改派目标的实时 HEAD 才是新 attempt 的 base');

    // allowlist 外的 slot 与无法解析 HEAD 的 slot 都 fail closed。
    master.attemptInterrupt({ ...base(fixture), jobId, reason: '误改派' });
    assert.throws(() => master.attemptNew({ ...base(fixture), jobId, slotId: 'worker-9' }),
      (error) => error.code === 'UNKNOWN_SLOT');
    rmSync(fixture.worktreeOf('worker-1'), { recursive: true, force: true, maxRetries: 5 });
    assert.throws(() => master.attemptNew({ ...base(fixture), jobId, slotId: 'worker-1' }),
      (error) => error.code === 'SLOT_HEAD_UNRESOLVED');

    // reconcile：残留双租约（同 jobId 多 lease）必须落进 unexplainedSlots，不得沉默。
    updateV4Registry(fixture.v4Dir, (writable) => {
      writable.runners['worker-2'].lease = { jobId, attemptId: claim.attemptId, acquiredAt: '2026-01-01T00:00:00.000Z' };
    });
    const reconcile = freshProcess(fixture, ['reconcile']);
    const residual = reconcile.slots.find((slot) => slot.slotId === 'worker-2');
    assert.equal(residual.explained, false, '同 job 双租约的残留侧必须是不可解释状态');
    assert.equal(residual.staleLease, true);
    assert.ok(/残留租约/.test(residual.reason), '残留租约必须在 reason 里点名');
    assert.ok(reconcile.unexplainedSlots >= 1, '残留租约必须计入 unexplainedSlots');
    const holder = reconcile.slots.find((slot) => slot.slotId === 'worker-3');
    assert.equal(holder.explained, true, '真正持有 job 的 slot 仍是可解释状态');
  } finally {
    fixture.cleanup();
  }
}
