#!/usr/bin/env node
// Goal Contract 的机械验收入口：collect / dispatch / server / repo-root / layout。
import assert from 'node:assert/strict';
import { execFile, spawn, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  collectStatus, DEFAULT_RUNTIME_DIR, loadConfig, SKILL_DIR,
} from './collect.mjs';
import { resolveCommand } from './command.mjs';

const pExecFile = promisify(execFile);
const SCRIPT_DIR = resolve(SKILL_DIR, 'scripts');
const SELF = fileURLToPath(import.meta.url);
const ROOT = resolve(SKILL_DIR, '..', '..', '..');

function tempDirectory(label) {
  return mkdtempSync(join(tmpdir(), `aes-worktree-board-${label}-`));
}

function boundedTempPath(path) {
  const tempRoot = resolve(tmpdir());
  const target = resolve(path);
  const comparableTempRoot = process.platform === 'win32' ? tempRoot.toLowerCase() : tempRoot;
  const comparableTarget = process.platform === 'win32' ? target.toLowerCase() : target;
  if (comparableTarget === comparableTempRoot || !comparableTarget.startsWith(`${comparableTempRoot}${sep}`)) {
    throw new Error(`拒绝清理 TEMP 之外的路径: ${target}`);
  }
  return target;
}

function pathWithin(parent, child) {
  const parentKey = process.platform === 'win32' ? resolve(parent).toLowerCase() : resolve(parent);
  const childKey = process.platform === 'win32' ? resolve(child).toLowerCase() : resolve(child);
  return childKey.startsWith(`${parentKey}${sep}`);
}

function waitMilliseconds(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function cleanTemp(path) {
  const target = boundedTempPath(path);
  assert.match(basename(target), /^aes-worktree-board-/,
    `拒绝清理非本 selftest fixture: ${target}`);
  let lastError = null;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      rmSync(target, { recursive: true, force: true, maxRetries: 0 });
    } catch (error) {
      lastError = error;
      if (!['EPERM', 'EBUSY', 'ENOTEMPTY'].includes(error.code)) throw error;
    }
    if (!existsSync(target)) return;
    await waitMilliseconds(100);
  }
  const detail = lastError ? ` (${lastError.code}: ${lastError.message})` : '';
  throw new Error(`临时 fixture 清理失败，路径仍存在: ${target}${detail}`);
}

async function cleanRepositoryFixture(fixture) {
  const root = boundedTempPath(fixture.root);
  const main = boundedTempPath(fixture.main);
  const sibling = boundedTempPath(fixture.sibling);
  assert.equal(pathWithin(root, main), true, `fixture main 越出临时根目录: ${main}`);
  assert.equal(pathWithin(root, sibling), true, `fixture sibling 越出临时根目录: ${sibling}`);
  const removal = spawnSync('git', ['-C', main, 'worktree', 'remove', '--force', sibling], {
    encoding: 'utf8',
  });
  if (removal.status !== 0) {
    const detail = `${removal.stdout || ''}${removal.stderr || ''}`.trim();
    throw new Error(`临时 Git worktree 移除失败 (exit ${removal.status}): ${detail}`);
  }
  assert.equal(existsSync(sibling), false, `临时 Git worktree 仍存在: ${sibling}`);
  await cleanTemp(root);
  assert.equal(existsSync(root), false, `临时 fixture 根目录仍存在: ${root}`);
}

function gitSync(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.replace(/\r\n/g, '\n').trimEnd();
}

function repositoryFixture(label) {
  const root = tempDirectory(label);
  const main = join(root, 'fixture-main');
  const sibling = join(root, 'fixture-dev');
  mkdirSync(main);
  gitSync(main, ['init', '-b', 'main']);
  gitSync(main, ['config', 'user.email', 'selftest@example.invalid']);
  gitSync(main, ['config', 'user.name', 'AES Worktree Board Selftest']);
  writeFileSync(join(main, 'fixture.txt'), 'fixture\n');
  gitSync(main, ['add', 'fixture.txt']);
  gitSync(main, ['commit', '-m', 'fixture']);
  gitSync(main, ['worktree', 'add', '-b', 'fixture-dev', sibling]);
  return { root, main, sibling };
}

function boardEnv(runtimeDir, extraEnv = {}) {
  const env = { ...process.env };
  delete env.AES_WORKTREE_BOARD_REPO_ROOT;
  return { ...env, AES_WORKTREE_BOARD_RUNTIME_DIR: runtimeDir, ...extraEnv };
}

function assertFixtureStatus(runtimeDir, fixture) {
  const status = JSON.parse(readFileSync(join(runtimeDir, 'status.json'), 'utf8'));
  assert.equal(resolve(status.repo.root), resolve(fixture.main));
  assert.deepEqual(status.worktrees.map((worker) => worker.name), [basename(fixture.sibling)]);
  return status;
}

function parseJsonLine(text) {
  const line = String(text).split(/\r?\n/).find((value) => value.trim().startsWith('{'));
  assert.ok(line, `缺少 JSON 行: ${text}`);
  return JSON.parse(line);
}

async function ghJson(args) {
  const { stdout } = await pExecFile('gh', args, { timeout: 60_000, maxBuffer: 32 * 1024 * 1024 });
  return JSON.parse(stdout);
}

async function collectDomain() {
  const runtimeDir = tempDirectory('collect');
  try {
    const status = await collectStatus({ runtimeDir });
    const config = loadConfig();
    const allIssues = await ghJson([
      'issue', 'list', '--repo', config.issueRepo, '--state', 'all', '--limit', '1000', '--json', 'number',
    ]);
    assert.equal(status.schemaVersion, 2);
    assert.equal(status.graph.issues.length, allIssues.length, 'issues 数必须等于 gh 全量 OPEN+CLOSED');

    const byNumber = new Map(status.graph.issues.map((issue) => [issue.number, issue]));
    const allowedStatuses = new Set(['frontier', 'claimed', 'blocked', 'resolved']);
    const degrees = new Map(status.graph.issues.map((issue) => [issue.number, 0]));
    for (const edge of status.graph.edges) {
      assert.ok(byNumber.has(edge.from) && byNumber.has(edge.to), '依赖边端点必须都在 graph.issues');
      assert.equal(edge.satisfied, byNumber.get(edge.from).state === 'CLOSED');
      degrees.set(edge.from, degrees.get(edge.from) + 1);
      degrees.set(edge.to, degrees.get(edge.to) + 1);
    }
    for (const issue of status.graph.issues) {
      assert.ok(allowedStatuses.has(issue.derived.status), `非法 derived.status: ${issue.derived.status}`);
      assert.equal(issue.derived.degree, degrees.get(issue.number), `#${issue.number} degree 不自洽`);
      const blocked = issue.blockedBy.some((number) => byNumber.get(number)?.state !== 'CLOSED');
      const expected = issue.state === 'CLOSED'
        ? 'resolved'
        : issue.claimedBy
          ? 'claimed'
          : blocked ? 'blocked' : 'frontier';
      assert.equal(issue.derived.status, expected, `#${issue.number} derived.status 推导错误`);
      if (issue.derived.warn) {
        assert.equal(issue.state, 'CLOSED', 'warn 只能出现在 CLOSED issue');
        const pages = await ghJson([
          'api', '--paginate', '--slurp', `repos/${config.issueRepo}/issues/${issue.number}/timeline`,
          '-H', 'Accept: application/vnd.github+json',
        ]);
        assert.ok(pages.flat().some((event) => event.event === 'reopened'), `#${issue.number} 没有 reopened 历史`);
      }
    }

    for (const worker of status.worktrees) {
      assert.ok(['running', 'manual', 'idle'].includes(worker.mode));
      assert.ok(['issue', 'none'].includes(worker.position.kind));
      const expectedMode = worker.activeTask ? 'running' : worker.position.kind === 'issue' ? 'manual' : 'idle';
      assert.equal(worker.mode, expectedMode, `${worker.name} mode 推导错误`);
    }

    const stats = status.graph.stats;
    assert.deepEqual(stats, {
      total: status.graph.issues.length,
      open: status.graph.issues.filter((issue) => issue.state === 'OPEN').length,
      closed: status.graph.issues.filter((issue) => issue.state === 'CLOSED').length,
      frontier: status.graph.issues.filter((issue) => issue.derived.status === 'frontier').length,
      edges: status.graph.edges.length,
      warned: status.graph.issues.filter((issue) => issue.derived.warn).length,
    });

    const statusPath = join(runtimeDir, 'status.json');
    const persisted = JSON.parse(readFileSync(statusPath, 'utf8'));
    const target = persisted.worktrees[0];
    assert.ok(target, '至少需要一个同级 worktree 才能验证 assessment 保留');
    target.assessment = {
      currentTask: 'selftest-assessment-preserved',
      done: null,
      merge: 'not-yet',
      reason: 'selftest',
      assessedAt: '1970-01-01T00:00:00.000Z',
      assessedBy: 'selftest',
      stale: false,
    };
    writeFileSync(statusPath, `${JSON.stringify(persisted, null, 2)}\n`);
    let recollected = await collectStatus({ skipGh: true, runtimeDir });
    let assessment = recollected.worktrees.find((worker) => worker.name === target.name).assessment;
    assert.equal(assessment.currentTask, 'selftest-assessment-preserved');
    assert.equal(assessment.stale, true, '旧于 commit/task end 的 assessment 应 stale');
    assessment.assessedAt = '2100-01-01T00:00:00.000Z';
    writeFileSync(statusPath, `${JSON.stringify(recollected, null, 2)}\n`);
    recollected = await collectStatus({ skipGh: true, runtimeDir });
    assessment = recollected.worktrees.find((worker) => worker.name === target.name).assessment;
    assert.equal(assessment.stale, false, '新于 commit/task end 的 assessment 不应 stale');
  } finally {
    await cleanTemp(runtimeDir);
  }
}

function worktreeDirty(path) {
  const result = spawnSync('git', ['-C', path, 'status', '--porcelain'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim().length > 0;
}

function dispatchSync(args, runtimeDir, repoRoot = ROOT, cwd = repoRoot) {
  return spawnSync(process.execPath, [join(SCRIPT_DIR, 'dispatch.mjs'), ...args], {
    cwd,
    encoding: 'utf8',
    env: boardEnv(runtimeDir, { AES_WORKTREE_BOARD_REPO_ROOT: repoRoot }),
    timeout: 30_000,
  });
}

function waitForLine(child) {
  return new Promise((resolveLine, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('等待子进程首行超时')), 10_000);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const index = output.indexOf('\n');
      if (index >= 0) {
        clearTimeout(timer);
        resolveLine(output.slice(0, index));
      }
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (!output.includes('\n')) reject(new Error(`子进程在首行前退出: ${code}`));
    });
  });
}

function waitForExit(child) {
  return new Promise((resolveExit, reject) => {
    child.on('error', reject);
    // Windows may still hold the fixture cwd or inherited handles after exit;
    // close means the child and its stdio resources have been released.
    child.on('close', (code) => resolveExit(code));
  });
}

function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

async function waitForProcessExit(pid, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!processAlive(pid)) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`子进程 ${pid} 未在 ${timeoutMs}ms 内退出`);
}

function createDispatchObserver(runtimeDir) {
  mkdirSync(runtimeDir, { recursive: true });
  const observerPath = join(runtimeDir, '.dispatch-observer.mjs');
  const pidPath = join(runtimeDir, '.dispatch-pids.jsonl');
  writeFileSync(observerPath, `
import { appendFileSync } from 'node:fs';
import { createRequire, syncBuiltinESMExports } from 'node:module';

const require = createRequire(import.meta.url);
const childProcess = require('node:child_process');
const originalSpawn = childProcess.spawn;
childProcess.spawn = function observedSpawn(file, argv, options) {
  const child = originalSpawn.call(this, file, argv, options);
  const args = Array.isArray(argv) ? argv.map(String) : [];
  const isDispatch = options?.detached && args.some((value) => value.toLowerCase().endsWith('dispatch.mjs'));
  if (isDispatch) {
    const taskIndex = args.indexOf('--task-id');
    const taskId = taskIndex >= 0 ? args[taskIndex + 1] : null;
    appendFileSync(
      process.env.AES_WORKTREE_BOARD_DISPATCH_PID_FILE,
      JSON.stringify({ pid: child.pid, taskId }) + '\\n',
    );
  }
  return child;
};
syncBuiltinESMExports();
`);
  return { observerPath, pidPath };
}

function observedDispatches(pidPath) {
  if (!existsSync(pidPath)) return [];
  return readFileSync(pidPath, 'utf8').split(/\r?\n/).filter(Boolean).flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
}

async function waitForDispatchWrapper(pidPath, taskId) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const record = observedDispatches(pidPath).find((value) => value.taskId === taskId);
    if (record) return record;
    await waitMilliseconds(100);
  }
  throw new Error(`未观察到 detached dispatch wrapper: taskId=${taskId}; pidFile=${pidPath}; records=${JSON.stringify(observedDispatches(pidPath))}`);
}

function startServer(runtimeDir, extraEnv = {}, cwd = ROOT, { observeDispatch = false } = {}) {
  const env = boardEnv(runtimeDir, extraEnv);
  let observer = null;
  const args = [join(SCRIPT_DIR, 'server.mjs'), '--port', '0'];
  if (observeDispatch) {
    observer = createDispatchObserver(runtimeDir);
    args.unshift('--import', pathToFileURL(observer.observerPath).href);
    env.AES_WORKTREE_BOARD_DISPATCH_PID_FILE = observer.pidPath;
  }
  const child = spawn(process.execPath, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return Promise.race([
    new Promise((resolveServer, reject) => {
      let output = '';
      let errorOutput = '';
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        output += chunk;
        const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)\//);
        if (match) resolveServer({ child, origin: `http://127.0.0.1:${match[1]}`, dispatchPidFile: observer?.pidPath });
      });
      child.stderr.on('data', (chunk) => {
        errorOutput += chunk;
      });
      child.on('error', reject);
      child.on('exit', (code) => reject(new Error(`server 提前退出: ${code}; stdout=${output}; stderr=${errorOutput}`)));
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('server 启动超时')), 10_000)),
  ]);
}

async function repoRootDomain() {
  const fixture = repositoryFixture('repo-root');
  const runtimeDir = join(fixture.root, 'runtime');
  let server = null;
  try {
    const collectRuntime = join(fixture.root, 'collect-runtime');
    const collected = spawnSync(process.execPath, [join(SCRIPT_DIR, 'collect.mjs'), '--no-gh'], {
      cwd: fixture.main,
      env: boardEnv(collectRuntime),
      encoding: 'utf8',
    });
    assert.equal(collected.status, 0, collected.stderr);
    assertFixtureStatus(collectRuntime, fixture);

    const overrideRuntime = join(fixture.root, 'override-runtime');
    const overridden = spawnSync(process.execPath, [join(SCRIPT_DIR, 'collect.mjs'), '--no-gh'], {
      cwd: ROOT,
      env: boardEnv(overrideRuntime, { AES_WORKTREE_BOARD_REPO_ROOT: fixture.main }),
      encoding: 'utf8',
    });
    assert.equal(overridden.status, 0, overridden.stderr);
    assertFixtureStatus(overrideRuntime, fixture);

    const directRuntime = join(fixture.root, 'direct-runtime');
    const direct = spawnSync(process.execPath, [
      join(SCRIPT_DIR, 'dispatch.mjs'), basename(fixture.sibling), '--agent', 'test',
      '--task-id', 'cross-repo-direct', 'cross-repo direct dispatch',
    ], {
      cwd: ROOT,
      env: boardEnv(directRuntime, { AES_WORKTREE_BOARD_REPO_ROOT: fixture.main }),
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(direct.status, 0, direct.stderr);
    const directLines = direct.stdout.trim().split(/\r?\n/).map(JSON.parse);
    assert.equal(directLines[0].worktree, basename(fixture.sibling));
    assert.equal(resolve(JSON.parse(readFileSync(
      join(directRuntime, 'tasks', 'cross-repo-direct.json'), 'utf8',
    )).path), resolve(fixture.sibling));

    const nonGit = join(fixture.root, 'not-a-git-worktree');
    mkdirSync(nonGit);
    const invalid = spawnSync(process.execPath, [join(SCRIPT_DIR, 'collect.mjs'), '--no-gh'], {
      cwd: nonGit,
      env: boardEnv(join(fixture.root, 'invalid-runtime')),
      encoding: 'utf8',
    });
    assert.notEqual(invalid.status, 0, '非 Git 目标路径必须失败');
    const expectedInvalidRoot = resolve(nonGit).replace(/\\/g, '/');
    assert.match(
      invalid.stderr.replace(/\\/g, '/'),
      new RegExp(expectedInvalidRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    );

    server = await startServer(
      runtimeDir,
      { AES_WORKTREE_BOARD_REPO_ROOT: fixture.main },
      ROOT,
      { observeDispatch: true },
    );
    const response = await fetch(`${server.origin}/api/dispatch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ worktree: basename(fixture.sibling), prompt: 'cross-repo server dispatch', agent: 'test' }),
    });
    const payload = await response.json();
    assert.equal(response.status, 202, JSON.stringify(payload));
    const dispatchWrapper = await waitForDispatchWrapper(server.dispatchPidFile, payload.taskId);
    const finished = await waitTask(server.origin, payload.taskId);
    assert.equal(finished.task.status, 'done');
    assert.equal(resolve(finished.task.path), resolve(fixture.sibling));
    await waitForProcessExit(dispatchWrapper.pid, 30_000);
    const status = await waitStatus(runtimeDir, fixture.main);
    assert.deepEqual(status.worktrees.map((worker) => worker.name), [basename(fixture.sibling)]);
  } finally {
    if (server?.child && server.child.exitCode === null) {
      const stopped = waitForExit(server.child);
      server.child.kill();
      await stopped;
    }
    await cleanRepositoryFixture(fixture);
  }
}

async function waitTask(origin, taskId) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const response = await fetch(`${origin}/api/task/${taskId}`);
    if (response.ok) {
      const value = await response.json();
      if (value.task.status !== 'running') {
        await waitForProcessExit(value.task.pid);
        return value;
      }
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`任务 ${taskId} 未在期限内结束`);
}

async function waitStatus(runtimeDir, expectedRoot, notBefore = null) {
  const statusPath = join(runtimeDir, 'status.json');
  let lastObserved = { state: 'missing' };
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (existsSync(statusPath)) {
      try {
        const status = JSON.parse(readFileSync(statusPath, 'utf8'));
        lastObserved = {
          state: 'read',
          root: status.repo?.root || null,
          generatedAt: status.generatedAt || null,
        };
        const freshEnough = !notBefore || Date.parse(status.generatedAt) >= Date.parse(notBefore);
        if (resolve(status.repo.root) === resolve(expectedRoot) && freshEnough) return status;
      } catch (error) {
        lastObserved = { state: 'unreadable', error: `${error.code || 'parse'}: ${error.message}` };
      }
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(
    `目标仓快照未在期限内写入: ${expectedRoot}; statusPath=${statusPath}; lastObserved=${JSON.stringify(lastObserved)}`,
  );
}

async function dispatchDomain() {
  const fixture = repositoryFixture('dispatch');
  const runtimeDir = join(fixture.root, 'runtime');
  let server = null;
  try {
    const target = { path: fixture.sibling };
    assert.equal(worktreeDirty(target.path), false, '隔离 fixture 必须从干净 worktree 开始');
    const name = basename(fixture.sibling);
    const short = name.replace(/^.*-(dev\d+)$/, '$1');
    const unique = `${process.pid}-${Date.now()}`;

    if (process.platform === 'win32') {
      const shimDir = join(fixture.root, 'command-shim');
      mkdirSync(shimDir);
      writeFileSync(join(shimDir, 'board-probe'), 'extensionless shim must not be spawned\n');
      writeFileSync(join(shimDir, 'board-probe.cmd'), '@echo command-resolution:%*\r\n');
      const commandEnv = { ...process.env, PATH: `${shimDir};${process.env.PATH}` };
      const resolved = resolveCommand(['board-probe', 'ok'], { platform: 'win32', env: commandEnv });
      assert.match(resolved[4], /board-probe\.cmd$/i);
      const probe = spawnSync(resolved[0], resolved.slice(1), { encoding: 'utf8', env: commandEnv });
      assert.equal(probe.status, 0, probe.stderr);
      assert.match(probe.stdout, /command-resolution:ok/);
    }

    const clean = dispatchSync(
      [short, '--agent', 'test', '--task-id', `selftest-clean-${unique}`, '冒烟'],
      runtimeDir,
      fixture.main,
      ROOT,
    );
    assert.equal(clean.status, 0, clean.stderr);
    const cleanLines = clean.stdout.trim().split(/\r?\n/).map(JSON.parse);
    assert.equal(cleanLines.length, 2);
    assert.deepEqual(Object.keys(cleanLines[0]), ['ok', 'taskId', 'worktree', 'pid', 'log']);
    assert.deepEqual(Object.keys(cleanLines[1]), ['ok', 'taskId', 'exitCode', 'log']);
    assert.equal(cleanLines[0].worktree, name);
    assert.equal(cleanLines[1].exitCode, 0);

    const dirtyFile = join(target.path, `.aes-worktree-board-selftest-${unique}.tmp`);
    assert.ok(resolve(dirtyFile).startsWith(`${resolve(target.path)}${process.platform === 'win32' ? '\\' : '/'}`));
    writeFileSync(dirtyFile, 'selftest dirty handshake\n');

    const refused = dispatchSync(
      [short, '--agent', 'test', '--task-id', `selftest-refused-${unique}`, 'dirty'],
      runtimeDir,
      fixture.main,
      ROOT,
    );
    assert.equal(refused.status, 3);
    const refusedJson = parseJsonLine(refused.stderr);
    assert.equal(refusedJson.code, 'DIRTY');
    assert.ok(refusedJson.dirty.untracked >= 1);

    const confirmed = spawn(process.execPath, [
      join(SCRIPT_DIR, 'dispatch.mjs'), short, '--agent', 'test', '--confirm-dirty',
      '--task-id', `selftest-confirmed-${unique}`, 'dirty confirmed',
    ], {
      cwd: ROOT,
      env: boardEnv(runtimeDir, { AES_WORKTREE_BOARD_REPO_ROOT: fixture.main }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const firstLine = JSON.parse(await waitForLine(confirmed));
    assert.equal(firstLine.ok, true);
    const locked = dispatchSync([
      short, '--agent', 'test', '--confirm-dirty', '--task-id', `selftest-locked-${unique}`, 'locked',
    ], runtimeDir, fixture.main, ROOT);
    assert.equal(locked.status, 2);
    assert.equal(parseJsonLine(locked.stderr).code, 'LOCKED');
    assert.equal(await waitForExit(confirmed), 0);

    server = await startServer(
      runtimeDir,
      { AES_WORKTREE_BOARD_REPO_ROOT: fixture.main },
      ROOT,
      { observeDispatch: true },
    );
    let response = await fetch(`${server.origin}/api/dispatch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ worktree: short, prompt: 'server dirty', agent: 'test' }),
    });
    assert.equal(response.status, 409);
    let payload = await response.json();
    assert.deepEqual(Object.keys(payload), ['ok', 'error', 'code', 'dirty', 'hint']);
    assert.equal(payload.code, 'DIRTY');

    response = await fetch(`${server.origin}/api/dispatch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ worktree: short, prompt: 'server dirty confirmed', agent: 'test', confirmDirty: true }),
    });
    assert.equal(response.status, 202);
    payload = await response.json();
    assert.deepEqual(Object.keys(payload), ['ok', 'taskId', 'worktree', 'agent']);
    assert.equal(payload.worktree, name);
    const dispatchWrapper = await waitForDispatchWrapper(server.dispatchPidFile, payload.taskId);

    response = await fetch(`${server.origin}/api/dispatch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ worktree: short, prompt: '不能绕锁', agent: 'test', confirmDirty: true }),
    });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'LOCKED');
    const finished = await waitTask(server.origin, payload.taskId);
    assert.equal(finished.task.status, 'done');
    assert.match(finished.logTail, /prompt received: server dirty confirmed/);
    await waitForProcessExit(dispatchWrapper.pid, 30_000);
    await waitStatus(runtimeDir, fixture.main, finished.task.endedAt);
    for (const extension of ['json', 'log', 'prompt.txt']) {
      assert.ok(existsSync(join(runtimeDir, 'tasks', `${payload.taskId}.${extension}`)), `缺少任务三件套 .${extension}`);
    }
  } finally {
    if (server?.child && server.child.exitCode === null) {
      const stopped = waitForExit(server.child);
      server.child.kill();
      await stopped;
    }
    await cleanRepositoryFixture(fixture);
  }
}

async function serverDomain() {
  const runtimeDir = tempDirectory('server');
  let server = null;
  try {
    const marker = join(runtimeDir, 'gh-called.txt');
    const shimDir = join(runtimeDir, 'shim');
    mkdirSync(join(runtimeDir, 'tasks'), { recursive: true });
    mkdirSync(shimDir, { recursive: true });
    const config = loadConfig();
    const seed = {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      repo: { root: ROOT.replace(/\\/g, '/'), name: basename(ROOT), mainBranch: config.mainBranch, mainHead: 'seed', issueRepo: config.issueRepo },
      graph: {
        issues: [{ number: 999999, title: 'fast-cache-sentinel', state: 'CLOSED', url: null, blockedBy: [], claimedBy: null, derived: { status: 'resolved', degree: 0, warn: true } }],
        edges: [], stats: { total: 1, open: 0, closed: 1, frontier: 0, edges: 0, warned: 1 },
      },
      worktrees: [],
    };
    writeFileSync(join(runtimeDir, 'status.json'), `${JSON.stringify(seed, null, 2)}\n`);
    writeFileSync(join(runtimeDir, 'status.js'), `window.WORKBOARD = ${JSON.stringify(seed)};\n`);
    const task = { id: 'server-selftest-task', worktree: 'none', status: 'done', log: join(runtimeDir, 'tasks', 'server-selftest-task.log') };
    writeFileSync(join(runtimeDir, 'tasks', `${task.id}.json`), `${JSON.stringify(task, null, 2)}\n`);
    writeFileSync(task.log, 'server-selftest-log-tail');
    if (process.platform === 'win32') {
      writeFileSync(join(shimDir, 'gh.cmd'), `@echo called>"${marker}"\r\n@exit /b 99\r\n`);
    } else {
      const shim = join(shimDir, 'gh');
      writeFileSync(shim, `#!/bin/sh\necho called > '${marker}'\nexit 99\n`);
      chmodSync(shim, 0o755);
    }
    server = await startServer(runtimeDir, { PATH: `${shimDir}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}` });

    let response = await fetch(`${server.origin}/`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /AES 需求星图|Worktree/);

    response = await fetch(`${server.origin}/api/status?fast=1`);
    assert.equal(response.status, 200);
    const status = await response.json();
    assert.equal(status.graph.issues[0].title, 'fast-cache-sentinel');
    assert.equal(status.graph.issues[0].derived.warn, true);
    assert.equal(existsSync(marker), false, 'fast=1 不得调用 gh');

    response = await fetch(`${server.origin}/api/task/${task.id}`);
    assert.equal(response.status, 200);
    const taskPayload = await response.json();
    assert.equal(taskPayload.task.id, task.id);
    assert.match(taskPayload.logTail, /server-selftest-log-tail/);

    response = await fetch(`${server.origin}/api/task/not-found`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { ok: false, error: '任务不存在' });

    response = await fetch(`${server.origin}/api/dispatch`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'BAD_REQUEST');
  } finally {
    if (server?.child && server.child.exitCode === null) {
      const stopped = waitForExit(server.child);
      server.child.kill();
      await stopped;
    }
    await cleanTemp(runtimeDir);
  }
}

async function layoutDomain() {
  const required = [
    'SKILL.md', 'board.html', 'board.config.json',
    'scripts/collect.mjs', 'scripts/assess.mjs', 'scripts/command.mjs', 'scripts/dispatch.mjs',
    'scripts/server.mjs', 'scripts/selftest.mjs',
  ];
  for (const path of required) assert.ok(existsSync(join(SKILL_DIR, path)), `缺少 ${path}`);
  assert.equal(existsSync(join(ROOT, 'worktree-board')), false, '顶级 worktree-board/ 必须不存在');
  const diff = spawnSync('git', ['diff', '--quiet', '--', 'run.toml', '.gitignore'], { cwd: ROOT });
  assert.equal(diff.status, 0, 'run.toml 与 .gitignore 必须恢复原样');
  const skillSource = readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8');
  assert.match(skillSource, /\.agents\/skills\/aes-worktree-board/);
  assert.doesNotMatch(skillSource, /\.claude\/skills\/aes-worktree-board/);
  assert.match(skillSource, /AES_WORKTREE_BOARD_REPO_ROOT/);
  const config = loadConfig();
  for (const key of ['mainBranch', 'issueRepo', 'port', 'defaultAgent', 'agents']) {
    assert.ok(Object.hasOwn(config, key), `board.config.json 缺少既有字段 ${key}`);
  }
  const scripts = ['collect.mjs', 'assess.mjs', 'command.mjs', 'dispatch.mjs', 'server.mjs', 'selftest.mjs'];
  for (const script of scripts) {
    const source = readFileSync(join(SCRIPT_DIR, script), 'utf8');
    for (const match of source.matchAll(/from ['"]([^'"]+)['"]/g)) {
      assert.ok(match[1].startsWith('node:') || match[1].startsWith('./'), `${script} 含 npm 依赖 ${match[1]}`);
    }
  }
  assert.equal(DEFAULT_RUNTIME_DIR, join(SKILL_DIR, 'runtime'));

  const assessRuntime = tempDirectory('layout-assess');
  try {
    writeFileSync(join(assessRuntime, 'status.json'), JSON.stringify({
      schemaVersion: 2,
      worktrees: [{ name: 'aes-agents-v2-devx', ahead: 1, trail: [], assessment: null }],
    }));
    const assessment = spawnSync(process.execPath, [
      join(SCRIPT_DIR, 'assess.mjs'), 'devx', '--merge', 'recommend', '--done', 'true',
      '--task', '独立任务', '--reason', '其他条件满足',
    ], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, AES_WORKTREE_BOARD_RUNTIME_DIR: assessRuntime },
    });
    assert.equal(assessment.status, 0, assessment.stderr);
    const result = parseJsonLine(assessment.stdout);
    assert.equal(result.assessment.merge, 'not-yet');
    assert.match(result.assessment.reason, /需先补 issue/);
  } finally {
    await cleanTemp(assessRuntime);
  }
}

const domains = {
  collect: collectDomain,
  dispatch: dispatchDomain,
  server: serverDomain,
  'repo-root': repoRootDomain,
  layout: layoutDomain,
};
const domain = process.argv[2];
if (!domains[domain]) {
  console.error(`用法: node ${basename(SELF)} <${Object.keys(domains).join('|')}>`);
  process.exit(2);
}
try {
  await domains[domain]();
  console.log(JSON.stringify({ ok: true, domain }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, domain, error: error.stack || error.message }));
  process.exit(1);
}
