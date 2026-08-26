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
import { readV4Registry, readReceipts, readTransitions } from './job-store.mjs';
import {
  defaultSlotsFromWorktrees, discoverWorktrees, initSlots, loadSlotsConfig, normalizePath,
  projectRunners, validateSlotsConfig,
} from './runner-slots.mjs';
import { HUMAN_REQUEST_SCHEMA } from './human-request.mjs';
import { resolveMergePolicy } from './merge-policy.mjs';
import * as master from './master.mjs';
import {
  gitOut, issuePayload, makeCandidate, makeConflict, makeFixture, SCRIPT_DIR,
} from './selftest-fixture.mjs';

const MASTER_CLI = join(SCRIPT_DIR, 'master.mjs');

function writeSlots(fixture, slots = fixture.slots) {
  return initSlots({ path: fixture.slotsPath, repoIdentity: fixture.repoIdentity, slots, force: true });
}

function base(fixture) {
  return { dir: fixture.v4Dir, slotsPath: fixture.slotsPath };
}

// 「重启 Master」在这里是字面意义的：另一个 Node 进程，只能看见落盘状态。
function freshProcess(fixture, args, { expectStatus = 0 } = {}) {
  const result = spawnSync(process.execPath, [MASTER_CLI, ...args, '--dir', fixture.v4Dir, '--slots', fixture.slotsPath], {
    ...HEADLESS_CHILD_OPTIONS, encoding: 'utf8', cwd: fixture.repoRoot,
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

function passingReview(jobId, commitSha) {
  return {
    schemaVersion: 'aes.issue-worker.stage-result/v1',
    jobId, stage: 'code-review', commitSha, outcome: 'PASS', findings: [],
    evidence: [{ kind: 'standards', result: 'PASS' }, { kind: 'spec', result: 'PASS' }],
    mayAdvance: true,
  };
}

function passingQa(jobId, commitSha) {
  return {
    schemaVersion: 'aes.qa.receipt/v1',
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
function driveToReadyToMerge(fixture, issue, { slotId } = {}) {
  const claim = master.masterClaim({ ...base(fixture), issue, slotId });
  assert.equal(claim.outcome, 'CLAIMED', `claim 失败: ${JSON.stringify(claim)}`);
  const candidate = makeCandidate(fixture, claim.slotId, { file: `feature-${issue.number}.txt` });
  master.recordCandidate({ ...base(fixture), jobId: claim.jobId, commitSha: candidate });
  master.recordStageResult({ ...base(fixture), jobId: claim.jobId, stage: 'review', payload: passingReview(claim.jobId, candidate) });
  master.recordStageResult({ ...base(fixture), jobId: claim.jobId, stage: 'qa', payload: passingQa(claim.jobId, candidate) });
  const terminal = master.masterTerminal({
    ...base(fixture),
    payload: readyTerminal(
      { jobId: claim.jobId, attemptId: claim.attemptId, issue: issue.number, baseCommit: claim.workOrder.runner.baseCommit },
      candidate, claim.workOrder.issue.contractDigest,
    ),
  });
  assert.equal(terminal.state, 'ready-to-merge');
  return { jobId: claim.jobId, attemptId: claim.attemptId, candidate, slotId: claim.slotId, claim };
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

    const first = makeCandidate(fixture, claim.slotId, { file: 'r1.txt' });
    master.recordCandidate({ ...base(fixture), jobId, commitSha: first });
    master.recordStageResult({ ...base(fixture), jobId, stage: 'review', payload: passingReview(jobId, first) });

    // candidate 前进使旧 review/QA 失效（E5）。
    const second = makeCandidate(fixture, claim.slotId, { file: 'r2.txt' });
    const advanced = master.recordCandidate({ ...base(fixture), jobId, commitSha: second });
    assert.equal(advanced.invalidated.length, 1, 'candidate 前进必须使旧 review 失效');
    assert.equal(advanced.invalidated[0].commitSha, first);
    assert.equal(readV4Registry(fixture.v4Dir).attempts[claim.attemptId].review, null);

    // 绑定旧 commit 的证据必须被拒收，不得推进。
    const stale = master.recordStageResult({ ...base(fixture), jobId, stage: 'review', payload: passingReview(jobId, first) });
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
    assert.equal(unknown.requiredReplacementSchema, 'aes.issue-worker.stage-result/v1');

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
    assert.deepEqual(calls, ['issue comment', 'issue close']);
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
  await mergePolicyTiers();
  await deliveryHappyPath();
  await postMergeVerificationFailure();
  await mergeConflictDisposition();
  await serialMergeEnforcement();
  await legacyArchiveStable();
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

    // fresh 校验：slot / commit / integration / AC / review / QA 六项都必须在门里。
    const gate = master.evaluateGate({ ...base(fixture), jobId: job.jobId });
    const ids = gate.mechanical.checks.map((check) => check.id);
    assert.deepEqual(ids, ['GATE-slot', 'GATE-commit', 'GATE-integration', 'GATE-acceptance', 'GATE-review', 'GATE-qa']);
    assert.equal(gate.mechanical.allGreen, true);

    const merged = master.masterMerge({ ...base(fixture), jobId: job.jobId });
    assert.equal(merged.ok, true);
    const verify = master.postMergeVerify({
      ...base(fixture), jobId: job.jobId,
      commands: [{ command: process.execPath, args: ['-e', 'process.exit(0)'] }],
    });
    assert.equal(verify.outcome, 'PASS');

    const calls = [];
    const closed = await master.masterClose({
      ...base(fixture), jobId: job.jobId,
      gh: async (args) => { calls.push(args[1]); return { stdout: '' }; },
    });
    assert.equal(closed.outcome, 'CLOSED');
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
    const candidate = makeConflict(fixture, claim.slotId);
    master.recordCandidate({ ...base(fixture), jobId: claim.jobId, commitSha: candidate });
    master.recordStageResult({ ...base(fixture), jobId: claim.jobId, stage: 'review', payload: passingReview(claim.jobId, candidate) });
    master.recordStageResult({ ...base(fixture), jobId: claim.jobId, stage: 'qa', payload: passingQa(claim.jobId, candidate) });
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
