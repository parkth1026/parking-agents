#!/usr/bin/env node
// v4 scenario 的共享真实 Git fixture：临时主仓 + 若干真实 worktree。
// ACQ-001/002/005 都选了「真实临时 worktree / 真实 Git」档，所以这里不用 mock Git，
// 而是造真仓 —— 断言才有资格声称覆盖了 identity 漂移与 dirty 隔离这类真实失败形态。
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { HEADLESS_CHILD_OPTIONS } from './headless.mjs';

export function git(cwd, args, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, { ...HEADLESS_CHILD_OPTIONS, cwd, encoding: 'utf8' });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`git ${args.join(' ')} 失败于 ${cwd}: ${result.stderr || result.stdout}`);
  }
  return result;
}

export function gitOut(cwd, args) {
  return String(git(cwd, args).stdout || '').trim();
}

function initRepo(path, branch) {
  mkdirSync(path, { recursive: true });
  git(path, ['init', '-b', branch]);
  git(path, ['config', 'user.email', 'selftest@aes.local']);
  git(path, ['config', 'user.name', 'aes-selftest']);
  git(path, ['config', 'commit.gpgsign', 'false']);
  writeFileSync(join(path, 'README.md'), 'baseline\n');
  git(path, ['add', '.']);
  git(path, ['commit', '-m', 'baseline']);
  return gitOut(path, ['rev-parse', 'HEAD']);
}

// workers: [{ id, dirty?, foreignRepo?, behind? }]
export function makeFixture(label, { workers = [{ id: 'worker-1' }], integrationBranch = 'dev', issueRepo = 'owner/repo' } = {}) {
  const root = mkdtempSync(join(tmpdir(), `aes-v4-${label}-`));
  const repoRoot = join(root, 'main');
  const baseline = initRepo(repoRoot, integrationBranch);
  // 三段构造，顺序有意义：先把所有 worktree 建成 clean 且同步，再制造「落后」，
  // 最后才写 dirty 文件 —— 否则推进 integration 会把所有 slot 一起变成落后，
  // 而重新同步又会抹掉本该保留的 dirty 现场。
  const slots = [];
  for (const worker of workers) {
    const path = join(root, worker.id);
    // identity 漂移：路径存在、是 Git worktree，但属于另一个仓。
    if (worker.foreignRepo) initRepo(path, integrationBranch);
    else git(repoRoot, ['worktree', 'add', '-b', worker.id, path, integrationBranch]);
    slots.push({
      slotId: worker.id,
      worktreePath: path,
      projectId: `project-${worker.id}`,
      branch: worker.id,
      enabled: worker.enabled !== false,
      concurrency: 1,
      capabilities: ['code', 'test'],
    });
  }

  const behind = workers.filter((worker) => worker.behind && !worker.foreignRepo);
  if (behind.length) {
    writeFileSync(join(repoRoot, 'integration-advance.txt'), 'integration moved on\n');
    git(repoRoot, ['add', '.']);
    git(repoRoot, ['commit', '-m', 'advance integration']);
    const head = gitOut(repoRoot, ['rev-parse', integrationBranch]);
    // 只有显式标记 behind 的 slot 留在旧 HEAD，其余追平。
    for (const worker of workers) {
      if (worker.foreignRepo || worker.behind) continue;
      git(join(root, worker.id), ['reset', '--hard', head]);
    }
  }

  for (const worker of workers) {
    if (worker.dirty && !worker.foreignRepo) {
      writeFileSync(join(root, worker.id, 'user-scratch.txt'), '用户现场，不许动\n');
    }
  }
  return {
    root,
    repoRoot,
    baseline,
    integrationBranch,
    issueRepo,
    slots,
    slotsPath: join(root, 'runner-slots.local.json'),
    v4Dir: join(root, 'runtime-v4'),
    repoIdentity: { root: repoRoot, integrationBranch, issueRepo },
    worktreeOf(id) { return join(root, id); },
    cleanup() { rmSync(root, { recursive: true, force: true, maxRetries: 5 }); },
  };
}

// 在 worker worktree 上造一个真实 candidate commit。
export function makeCandidate(fixture, slotId, { file = 'feature.txt', content = 'candidate\n', message = 'candidate work' } = {}) {
  const path = fixture.worktreeOf(slotId);
  writeFileSync(join(path, file), content);
  git(path, ['add', '.']);
  git(path, ['commit', '-m', message]);
  return gitOut(path, ['rev-parse', 'HEAD']);
}

// 让 integration 与 candidate 在同一文件上分叉，制造真实 merge conflict。
export function makeConflict(fixture, slotId, file = 'feature.txt') {
  writeFileSync(join(fixture.repoRoot, file), 'integration 侧的版本\n');
  git(fixture.repoRoot, ['add', '.']);
  git(fixture.repoRoot, ['commit', '-m', 'integration side change']);
  return makeCandidate(fixture, slotId, { file, content: 'worker 侧的版本\n', message: 'worker side change' });
}

export function issuePayload({
  number = 45, repo = 'owner/repo', title = 'test issue', riskProfile = 'low',
  labels = ['ready-for-agent'], acceptanceCriteria, contract = {}, omit = [],
} = {}) {
  const full = {
    goal: '把 identity 绑定收紧到 repo + account',
    workflowRole: 'implement',
    acceptanceCriteria: acceptanceCriteria || [
      { id: 'AC-1', text: '错误账号 fail closed', evidenceClass: 'automated' },
    ],
    dependencies: [],
    riskProfile,
    allowedSideEffects: ['edit-worktree', 'run-tests', 'create-commit'],
    humanGates: [],
    executionPolicy: 'for-agent',
    ...contract,
  };
  for (const key of omit) delete full[key];
  return {
    repo, number, title, url: `https://github.com/${repo}/issues/${number}`,
    state: 'OPEN', labels, contract: full,
  };
}

export const SCRIPT_DIR = resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
