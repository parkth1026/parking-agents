#!/usr/bin/env node
// AC-003 离线半：历史 trajectory replay。
//
// 语料是脱敏后的「历史上出过什么错」，断言是「新控制面不再复现」。因此 fixture 里
// 存的是步骤与期望，不是快照 diff —— 快照会随实现细节漂移，而失败形态不会。
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readReceipts, readV4Registry } from './job-store.mjs';
import { initSlots } from './runner-slots.mjs';
import * as master from './master.mjs';
import { makeWayfinder } from './discovery.mjs';
import { gitOut, issuePayload, makeCandidate, makeConflict, makeFixture } from './selftest-fixture.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const TRAJECTORY_DIR = resolve(join(SCRIPT_DIR, '..', 'fixtures', 'trajectories'));
export const TRAJECTORY_SCHEMA = 'aes.worktree-board.trajectory-replay/v1';

// 历史问题闭集。契约点名的七类必须被 5 条语料完全覆盖，覆盖度本身也是断言。
export const FAILURE_CLASSES = Object.freeze([
  'premature-complete', 'mechanical-review', 'idle-lane', 'wrong-parent-event',
  'timeout-env-pollution', 'merge-conflict', 'orphan-reviewer',
]);

function base(fixture) {
  return { dir: fixture.v4Dir, slotsPath: fixture.slotsPath };
}

// ------------------------------------------------------------------ 步骤解释器

async function runStep(world, step) {
  const { fixture } = world;
  const shared = base(fixture);
  switch (step.action) {
    case 'start':
      return master.masterStart(shared);
    case 'claim': {
      const issue = issuePayload({ number: step.issue, riskProfile: step.riskProfile || 'low', ...(step.issueOverrides || {}) });
      const result = master.masterClaim({ ...shared, issue, slotId: step.slot });
      if (result.jobId) world.jobs[step.as || `job-${step.issue}`] = result;
      return result;
    }
    case 'candidate': {
      const job = world.jobs[step.job];
      const commit = step.conflict
        ? makeConflict(fixture, job.slotId)
        : makeCandidate(fixture, job.slotId, { file: step.file || `t-${step.job}.txt`, content: `${step.content || 'work'}\n` });
      // commit 一律按 job 归档；`as` 只是步骤结果的标签，两者不可混用。
      world.commits[step.job] = commit;
      return master.recordCandidate({ ...shared, jobId: job.jobId, commitSha: commit });
    }
    case 'review': {
      const job = world.jobs[step.job];
      return master.recordStageResult({
        ...shared, jobId: job.jobId, stage: 'review',
        payload: {
          schemaVersion: step.schemaVersion || 'aes.issue-worker.stage-result/v1',
          jobId: step.forgeJobId || job.jobId,
          attemptId: step.forgeAttemptId || undefined,
          stage: 'code-review',
          commitSha: step.commitOverride ? world.commits[step.commitOverride] : world.commits[step.job],
          outcome: step.outcome,
          failureClass: step.failureClass,
          findings: step.findings || [],
          mayAdvance: step.outcome === 'PASS',
        },
      });
    }
    case 'qa': {
      const job = world.jobs[step.job];
      return master.recordStageResult({
        ...shared, jobId: job.jobId, stage: 'qa',
        payload: {
          schemaVersion: 'aes.qa.receipt/v1',
          jobId: job.jobId,
          commitSha: world.commits[step.job],
          outcome: step.outcome,
          failureClass: step.failureClass,
          environment: { kind: step.environmentKind || 'local-live', identityDigest: 'sha256:env-replay' },
          checks: step.checks || [{ id: 'QA-1', kind: 'automated', outcome: step.outcome }],
          unexecuted: step.unexecuted || [],
        },
      });
    }
    case 'budget':
      return master.checkBudget({ ...shared, jobId: world.jobs[step.job].jobId, budgets: step.budgets });
    case 'terminal': {
      const job = world.jobs[step.job];
      const payload = {
        schemaVersion: 'aes.issue-worker.goal-terminal/v1',
        jobId: job.jobId, attemptId: job.attemptId, outcome: step.outcome, issue: job.workOrder.issue.number,
      };
      if (step.outcome === 'READY_TO_MERGE') {
        Object.assign(payload, {
          contractDigest: job.workOrder.issue.contractDigest,
          baseCommit: job.workOrder.runner.baseCommit,
          candidateCommit: world.commits[step.job],
          acceptance: [{ id: 'AC-1', outcome: 'PASS', evidenceRefs: ['review:R-1', 'qa:QA-1'] }],
        });
      }
      if (step.outcome === 'BUDGET_EXHAUSTED') {
        Object.assign(payload, {
          candidateCommit: world.commits[step.job],
          budget: step.budget || { kind: 'reviewLoops', limit: 3, used: 3 },
          remainingBlockers: step.remainingBlockers || [],
          recommendedMasterActions: step.recommendedMasterActions || ['NEW_ATTEMPT_FRONTIER_MODEL', 'AWAITING_HUMAN'],
        });
      }
      return master.masterTerminal({ ...shared, payload });
    }
    case 'merge':
      return master.masterMerge({ ...shared, jobId: world.jobs[step.job].jobId });
    case 'verify':
      return master.postMergeVerify({
        ...shared, jobId: world.jobs[step.job].jobId,
        commands: [{ command: process.execPath, args: ['-e', `process.exit(${step.exit ?? 0})`] }],
      });
    case 'close':
      return master.masterClose({
        ...shared, jobId: world.jobs[step.job].jobId,
        gh: async (args) => { world.ghCalls.push(args.slice(0, 2).join(' ')); return { stdout: '' }; },
      });
    case 'release':
      return master.releaseAndSync({ ...shared, jobId: world.jobs[step.job]?.jobId, slotId: step.slot });
    case 'reconcile':
      return master.masterReconcile(shared);
    case 'stop-eval':
      return master.evaluateStop({ ...shared, frontierCount: step.frontier ?? 0 });
    case 'interrupt':
      return master.attemptInterrupt({ ...shared, jobId: world.jobs[step.job].jobId, reason: step.reason });
    case 'attempt-new': {
      const result = master.attemptNew({ ...shared, jobId: world.jobs[step.job].jobId, slotId: step.slot });
      world.jobs[step.job].attemptId = result.attemptId;
      return result;
    }
    case 'discovery':
      return master.masterDiscovery({
        ...shared,
        wayfinder: world.wayfinder,
        payload: {
          schemaVersion: 'aes.issue-worker.discovered-work/v1',
          jobId: world.jobs[step.job].jobId, currentIssue: step.currentIssue,
          relationship: step.relationship, title: step.title, problem: step.problem || step.title,
          evidence: step.evidence || [], dedupeHints: step.dedupeHints || [step.title.toLowerCase()],
        },
      });
    case 'dirty-slot':
      writeFileSync(join(fixture.worktreeOf(step.slot), 'user-scratch.txt'), '用户现场\n');
      return { ok: true, slot: step.slot };
    default:
      throw new Error(`未知 trajectory step: ${step.action}`);
  }
}

// ------------------------------------------------------------------ 期望校验器

function checkExpectation(world, expectation) {
  const registry = readV4Registry(world.fixture.v4Dir);
  const label = `${world.trajectory.trajectoryId}/${expectation.id}`;
  switch (expectation.check) {
    case 'job-state': {
      const job = registry.jobs[world.jobs[expectation.job].jobId];
      assert.equal(job.state, expectation.equals, `${label}: ${expectation.why}`);
      return;
    }
    case 'step-field': {
      const result = world.results[expectation.step];
      assert.ok(result !== undefined, `${label}: 步骤 ${expectation.step} 无结果`);
      const actual = expectation.path.split('.').reduce((value, key) => (value == null ? value : value[key]), result);
      assert.deepEqual(actual, expectation.equals, `${label}: ${expectation.why}（实际 ${JSON.stringify(actual)}）`);
      return;
    }
    case 'all-slots-explained': {
      const reconcile = world.results[expectation.step];
      assert.equal(reconcile.unexplainedSlots, 0, `${label}: ${expectation.why}`);
      for (const slot of reconcile.slots) {
        assert.ok(slot.reason, `${label}: slot ${slot.slotId} 缺少可解释原因`);
        if (!slot.lease && slot.state !== 'idle') {
          assert.ok(slot.recovery, `${label}: 非空闲且未租出的 slot ${slot.slotId} 必须给出恢复命令`);
        }
      }
      return;
    }
    case 'merge-commit-count': {
      const log = gitOut(world.fixture.repoRoot, ['log', '--merges', '--format=%H', world.fixture.integrationBranch]);
      const count = log ? log.split(/\r?\n/).filter(Boolean).length : 0;
      assert.equal(count, expectation.equals, `${label}: ${expectation.why}`);
      return;
    }
    case 'receipt-kinds': {
      const kinds = new Set(readReceipts(world.fixture.v4Dir).map((entry) => entry.kind));
      for (const kind of expectation.present || []) {
        assert.ok(kinds.has(kind), `${label}: 缺少 ${kind} receipt（${expectation.why}）`);
      }
      for (const kind of expectation.absent || []) {
        assert.equal(kinds.has(kind), false, `${label}: 不应出现 ${kind} receipt（${expectation.why}）`);
      }
      return;
    }
    case 'budget-usage': {
      const job = registry.jobs[world.jobs[expectation.job].jobId];
      const attempt = registry.attempts[job.currentAttemptId];
      assert.equal(attempt.budgetUsage?.[expectation.key] ?? 0, expectation.equals, `${label}: ${expectation.why}`);
      return;
    }
    case 'human-requests-open': {
      const open = Object.values(registry.humanRequests).filter((request) => request.open);
      assert.equal(open.length, expectation.equals, `${label}: ${expectation.why}`);
      return;
    }
    case 'attempt-count': {
      const job = registry.jobs[world.jobs[expectation.job].jobId];
      assert.equal(job.attemptIds.length, expectation.equals, `${label}: ${expectation.why}`);
      return;
    }
    case 'worktree-clean': {
      const status = gitOut(world.fixture.repoRoot, ['status', '--porcelain=v1']);
      assert.equal(status, '', `${label}: ${expectation.why}`);
      return;
    }
    case 'file-preserved': {
      const path = join(world.fixture.worktreeOf(expectation.slot), expectation.file);
      assert.equal(readFileSync(path, 'utf8'), expectation.content, `${label}: ${expectation.why}`);
      return;
    }
    case 'slot-lease-held': {
      const runner = registry.runners[expectation.slot];
      assert.equal(Boolean(runner.lease), expectation.equals, `${label}: ${expectation.why}`);
      return;
    }
    default:
      throw new Error(`未知 trajectory expectation: ${expectation.check}`);
  }
}

// ------------------------------------------------------------------ 单条 replay

export async function replayTrajectory(trajectory) {
  const fixture = makeFixture(`traj-${trajectory.trajectoryId.slice(0, 6)}`, {
    workers: trajectory.setup.workers,
  });
  try {
    initSlots({ path: fixture.slotsPath, repoIdentity: fixture.repoIdentity, slots: fixture.slots, force: true });
    const ghCalls = [];
    const existingIssues = [];
    let nextIssue = 900;
    const world = {
      fixture, trajectory, jobs: {}, commits: {}, results: {}, ghCalls,
      wayfinder: makeWayfinder({
        repo: fixture.issueRepo,
        gh: async (args) => {
          ghCalls.push(args.slice(0, 2).join(' '));
          if (args[1] === 'create') {
            nextIssue += 1;
            existingIssues.push({ number: nextIssue, title: args[3], state: 'OPEN' });
            return { stdout: `https://github.com/${fixture.issueRepo}/issues/${nextIssue}\n` };
          }
          if (args[1] === 'list') return { stdout: JSON.stringify([]) };
          return { stdout: 'ok\n' };
        },
      }),
    };

    for (const [index, step] of trajectory.steps.entries()) {
      const label = step.as || `${step.action}-${index}`;
      try {
        world.results[label] = await runStep(world, step);
      } catch (error) {
        if (step.expectThrow) {
          world.results[label] = { threw: true, code: error.code || 'INTERNAL', message: error.message };
        } else {
          throw new Error(`${trajectory.trajectoryId} 步骤 ${label} 抛错: ${error.stack || error.message}`, { cause: error });
        }
      }
      if (step.expectThrow) {
        assert.equal(world.results[label].threw, true,
          `${trajectory.trajectoryId}/${label}: 期望抛出 ${step.expectThrow} 但未抛出`);
        assert.equal(world.results[label].code, step.expectThrow,
          `${trajectory.trajectoryId}/${label}: 期望错误码 ${step.expectThrow}`);
      }
    }

    for (const expectation of trajectory.expectations) checkExpectation(world, expectation);
    return { trajectoryId: trajectory.trajectoryId, steps: trajectory.steps.length, expectations: trajectory.expectations.length };
  } finally {
    fixture.cleanup();
  }
}

// ------------------------------------------------------------------ scenario 入口

export async function trajectoryReplayScenario() {
  const files = readdirSync(TRAJECTORY_DIR).filter((name) => name.endsWith('.json')).sort();
  assert.equal(files.length, 5, `D-01 必须恰好 5 条 trajectory fixture，实际 ${files.length}`);

  const covered = new Set();
  const results = [];
  for (const file of files) {
    const trajectory = JSON.parse(readFileSync(join(TRAJECTORY_DIR, file), 'utf8'));
    assert.equal(trajectory.schemaVersion, TRAJECTORY_SCHEMA, `${file} schemaVersion 不符`);
    // 脱敏是 D-01 的硬要求：语料里不得出现真实仓库路径或账号。
    assert.equal(trajectory.provenance?.desensitized, true, `${file} 必须标记为已脱敏`);
    const raw = JSON.stringify(trajectory);
    assert.doesNotMatch(raw, /parkth1026|G:\\|G:\//i, `${file} 含未脱敏的真实标识`);
    assert.ok(trajectory.historicalFailure?.classes?.length, `${file} 必须声明覆盖的历史失败类`);
    for (const failureClass of trajectory.historicalFailure.classes) {
      assert.ok(FAILURE_CLASSES.includes(failureClass), `${file} 含未知失败类 ${failureClass}`);
      covered.add(failureClass);
    }
    assert.ok(trajectory.expectations.length, `${file} 必须有期望`);
    results.push(await replayTrajectory(trajectory));
  }

  // 契约点名的七类历史问题必须被完全覆盖，一类不落。
  const missing = FAILURE_CLASSES.filter((failureClass) => !covered.has(failureClass));
  assert.deepEqual(missing, [], `以下历史失败类未被任何 trajectory 覆盖: ${missing.join(', ')}`);
  return { trajectories: results.length, coveredClasses: covered.size, results };
}
