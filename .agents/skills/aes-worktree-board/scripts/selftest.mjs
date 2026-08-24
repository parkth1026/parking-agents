#!/usr/bin/env node
// Goal Contract 的机械验收入口：collect / dispatch / server / repo-root / layout。
import assert from 'node:assert/strict';
import { execFile, spawn, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  collectStatus, DEFAULT_RUNTIME_DIR, listWorktrees, loadIssueFixture, loadConfig, SKILL_DIR,
} from './collect.mjs';
import { resolveCommand } from './command.mjs';
import { HEADLESS_CHILD_OPTIONS } from './headless.mjs';
import {
  consumeEvent, CONTROL_STATES, createTask, evaluateStop, heartbeatTask, pendingInbox, putInboxEvent,
  EXECUTOR_FINAL_SCHEMA, nextActions, receiveActionReceipt, recordBlock, runPostMergeVerification, setVerdict, startGoal,
  TASK_STATES, transitionTask,
} from './orchestrate.mjs';
import { readJson, readJsonLines, readRegistry, writeJsonAtomic } from './runtime-store.mjs';

const pExecFile = promisify(execFile);
const SCRIPT_DIR = resolve(SKILL_DIR, 'scripts');
const SELF = fileURLToPath(import.meta.url);
const ROOT = resolve(SKILL_DIR, '..', '..', '..');
const ISSUE_FIXTURE = join(SKILL_DIR, 'fixtures', 'aes-agent-issues.json');

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
    ...HEADLESS_CHILD_OPTIONS,
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
  const result = spawnSync('git', args, { ...HEADLESS_CHILD_OPTIONS, cwd, encoding: 'utf8' });
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
  // #14: runtimeDir 为空表示走真默认链（目标仓根），不得继承外部 runtime 覆盖。
  delete env.AES_WORKTREE_BOARD_RUNTIME_DIR;
  if (runtimeDir) env.AES_WORKTREE_BOARD_RUNTIME_DIR = runtimeDir;
  return { ...env, ...extraEnv };
}

// #14: 技能目录 runtime 只许读不许写；用递归 mtime 快照证明整个域期间零写入。
function runtimeTreeSnapshot(dir) {
  const entries = [];
  if (!existsSync(dir)) return entries;
  const walk = (current, prefix) => {
    for (const entry of readdirSync(current, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const fullPath = join(current, entry.name);
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      entries.push(entry.isDirectory()
        ? `${relative}/`
        : `${relative}:${statSync(fullPath).mtimeMs}`);
      if (entry.isDirectory()) walk(fullPath, relative);
    }
  };
  walk(dir, '');
  return entries;
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
  const { stdout } = await pExecFile('gh', args, {
    ...HEADLESS_CHILD_OPTIONS,
    timeout: 60_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

async function collectDomain() {
  const runtimeDir = tempDirectory('collect');
  try {
    const fixtureIssues = loadIssueFixture(ISSUE_FIXTURE);
    const fixtureByNumber = new Map(fixtureIssues.map((issue) => [issue.number, issue]));
    const status = await collectStatus({ runtimeDir, issuesFixture: ISSUE_FIXTURE });
    assert.equal(status.schemaVersion, 3);
    assert.equal(status.graph.issues.length, fixtureIssues.length, 'issues 数必须等于完整离线 fixture');

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
        assert.equal(
          fixtureByNumber.get(issue.number)?.reopenedBeforeClose,
          true,
          `#${issue.number} fixture 没有 reopened 历史`,
        );
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

// 显式 live smoke：允许 GitHub/授权/Issue 变化令它失败，不进入 run-tests 默认门禁。
async function collectLiveDomain() {
  const runtimeDir = tempDirectory('collect-live');
  try {
    const status = await collectStatus({ runtimeDir });
    const config = loadConfig();
    const allIssues = await ghJson([
      'issue', 'list', '--repo', config.issueRepo, '--state', 'all', '--limit', '1000', '--json', 'number',
    ]);
    assert.equal(status.schemaVersion, 3);
    assert.equal(status.graph.issues.length, allIssues.length, 'live issues 数必须等于 gh 全量 OPEN+CLOSED');
  } finally {
    await cleanTemp(runtimeDir);
  }
}

async function fixtureDomain() {
  const runtimeDir = tempDirectory('issues-fixture');
  let server = null;
  try {
    const fixtureIssues = loadIssueFixture(ISSUE_FIXTURE);
    const status = await collectStatus({ runtimeDir, issuesFixture: ISSUE_FIXTURE });
    assert.equal(status.graph.issues.length, fixtureIssues.length, 'fixture 与 graph.issue 数量不一致');
    assert.ok(status.graph.issues.length >= 60, '页面 fixture 应保留完整 issue 星图，而不是最小样本');
    assert.equal(status.graph.stats.total, fixtureIssues.length);
    assert.equal(
      status.graph.stats.open + status.graph.stats.closed,
      fixtureIssues.length,
      'fixture OPEN/CLOSED 统计不闭合',
    );
    const issue61 = status.graph.issues.find((issue) => issue.number === 61);
    assert.ok(issue61, 'fixture 必须包含当前 frontier 的 #61');
    assert.deepEqual(issue61.blockedBy, [58, 59, 60]);
    assert.equal(issue61.derived.status, 'blocked');

    const snapshot = readFileSync(join(runtimeDir, 'status.js'), 'utf8');
    assert.match(snapshot, /window\.WORKBOARD/);
    assert.match(snapshot, /"number":61/);

    server = await startServer(runtimeDir, { AES_WORKTREE_BOARD_ISSUES_FIXTURE: ISSUE_FIXTURE });
    let response = await fetch(`${server.origin}/`);
    assert.equal(response.status, 200);
    const page = await response.text();
    assert.match(page, /id="graph"/);
    assert.match(page, /runtime\/status\.js/);

    response = await fetch(`${server.origin}/api/status?fast=1`);
    assert.equal(response.status, 200);
    const served = await response.json();
    assert.equal(served.graph.issues.length, fixtureIssues.length);
    assert.equal(served.graph.issues.find((issue) => issue.number === 61).derived.status, 'blocked');
  } finally {
    if (server?.child && server.child.exitCode === null) {
      const stopped = waitForExit(server.child);
      server.child.kill();
      await stopped;
    }
    await cleanTemp(runtimeDir);
  }
}

function worktreeDirty(path) {
  const result = spawnSync('git', ['-C', path, 'status', '--porcelain'], {
    ...HEADLESS_CHILD_OPTIONS,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim().length > 0;
}

function dispatchSync(args, runtimeDir, repoRoot = ROOT, cwd = repoRoot) {
  return spawnSync(process.execPath, [join(SCRIPT_DIR, 'dispatch.mjs'), ...args], {
    ...HEADLESS_CHILD_OPTIONS,
    cwd,
    encoding: 'utf8',
    env: boardEnv(runtimeDir, { AES_WORKTREE_BOARD_REPO_ROOT: repoRoot }),
    timeout: 30_000,
  });
}

function orchestrateSync(args, runtimeDir, extraEnv = {}) {
  return spawnSync(process.execPath, [join(SCRIPT_DIR, 'orchestrate.mjs'), ...args], {
    ...HEADLESS_CHILD_OPTIONS,
    cwd: ROOT,
    encoding: 'utf8',
    env: boardEnv(runtimeDir, extraEnv),
    timeout: 30_000,
  });
}

function runNode(args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, args, {
      ...HEADLESS_CHILD_OPTIONS,
      cwd: options.cwd || ROOT,
      env: options.env || process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (status) => resolveRun({ status, stdout, stderr }));
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

function startServer(runtimeDir, extraEnv = {}, cwd = ROOT, { observeDispatch = false, observerDir = runtimeDir } = {}) {
  const env = boardEnv(runtimeDir, extraEnv);
  let observer = null;
  const args = [join(SCRIPT_DIR, 'server.mjs'), '--port', '0'];
  if (observeDispatch) {
    assert.ok(observerDir, 'observeDispatch 需要显式 observerDir（默认 runtime 链下 runtimeDir 为空）');
    observer = createDispatchObserver(observerDir);
    args.unshift('--import', pathToFileURL(observer.observerPath).href);
    env.AES_WORKTREE_BOARD_DISPATCH_PID_FILE = observer.pidPath;
  }
  const child = spawn(process.execPath, args, {
    ...HEADLESS_CHILD_OPTIONS,
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

async function authorizedDispatch(server, body) {
  if (!server.boardToken) {
    const page = await (await fetch(`${server.origin}/`)).text();
    const match = page.match(/<meta name="board-token" content="([^"]+)">/);
    assert.ok(match, 'server 页面没有注入 board token');
    server.boardToken = match[1];
  }
  return fetch(`${server.origin}/api/dispatch`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: server.origin,
      'x-board-token': server.boardToken,
    },
    body: JSON.stringify(body),
  });
}

function probeServerStartup(cwd, env, timeoutMs = 750) {
  return new Promise((resolveProbe, reject) => {
    const child = spawn(process.execPath, [join(SCRIPT_DIR, 'server.mjs'), '--port', '0'], {
      ...HEADLESS_CHILD_OPTIONS,
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => {
      if (child.exitCode === null) child.kill();
    }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolveProbe({ status: code, stdout, stderr });
    });
  });
}

async function repoRootDomain() {
  const fixture = repositoryFixture('repo-root');
  const runtimeDir = join(fixture.root, 'runtime');
  let server = null;
  try {
    const skillRuntimeBefore = runtimeTreeSnapshot(join(SKILL_DIR, 'runtime'));
    const collectRuntime = join(fixture.root, 'collect-runtime');
    const collected = spawnSync(process.execPath, [join(SCRIPT_DIR, 'collect.mjs'), '--no-gh'], {
      ...HEADLESS_CHILD_OPTIONS,
      cwd: fixture.main,
      env: boardEnv(collectRuntime),
      encoding: 'utf8',
    });
    assert.equal(collected.status, 0, collected.stderr);
    assertFixtureStatus(collectRuntime, fixture);

    const overrideRuntime = join(fixture.root, 'override-runtime');
    const overridden = spawnSync(process.execPath, [join(SCRIPT_DIR, 'collect.mjs'), '--no-gh'], {
      ...HEADLESS_CHILD_OPTIONS,
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
      ...HEADLESS_CHILD_OPTIONS,
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
      ...HEADLESS_CHILD_OPTIONS,
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

    const invalidServer = await probeServerStartup(
      nonGit,
      boardEnv(join(fixture.root, 'invalid-server-runtime')),
    );
    const invalidServerOutput = [invalidServer.stdout || '', invalidServer.stderr || '']
      .join('\n')
      .replace(/\\/g, '/');
    assert.equal(
      invalidServer.status,
      1,
      '非 Git 目标启动必须快速失败而不是监听: ' + invalidServerOutput,
    );
    assert.ok(!invalidServerOutput.includes('http://127.0.0.1:'), invalidServerOutput);
    assert.ok(
      invalidServerOutput.toLowerCase().includes(expectedInvalidRoot.toLowerCase()),
      '启动错误必须包含解析路径 ' + expectedInvalidRoot + ': ' + invalidServerOutput,
    );

    server = await startServer(
      runtimeDir,
      { AES_WORKTREE_BOARD_REPO_ROOT: fixture.main },
      ROOT,
      { observeDispatch: true },
    );
    const response = await authorizedDispatch(server, {
      worktree: basename(fixture.sibling), prompt: 'cross-repo server dispatch', agent: 'test',
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

    // #14: 跨仓隔离 —— 默认 runtime 各归各仓，同名 worktree 并发派发互不误判，技能目录不再承载运行时数据。
    const peer = repositoryFixture('repo-root-peer');
    let serverFixture = null;
    let serverPeer = null;
    const observerDirA = tempDirectory('cross-repo-obs-a');
    const observerDirB = tempDirectory('cross-repo-obs-b');
    try {
      const defaultEnv = boardEnv(null);
      const runtimeOf = (main) => join(main, '.aes-worktree-board', 'runtime');

      for (const repo of [fixture, peer]) {
        const defaultCollected = spawnSync(process.execPath, [join(SCRIPT_DIR, 'collect.mjs'), '--no-gh'], {
          ...HEADLESS_CHILD_OPTIONS,
          cwd: repo.main,
          encoding: 'utf8',
          env: defaultEnv,
        });
        assert.equal(defaultCollected.status, 0, defaultCollected.stderr);
        assertFixtureStatus(runtimeOf(repo.main), repo);
      }

      // 同名 worktree + 同 taskId：A 运行中 B 直发必须成功（旧共享目录会 LOCKED 或任务 id 冲突）。
      const dispatchA = spawn(process.execPath, [
        join(SCRIPT_DIR, 'dispatch.mjs'), basename(fixture.sibling), '--agent', 'test',
        '--task-id', 'cross-repo-same-id', 'cross-repo direct A',
      ], {
        ...HEADLESS_CHILD_OPTIONS,
        cwd: fixture.main,
        env: defaultEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      assert.equal(JSON.parse(await waitForLine(dispatchA)).ok, true);
      const dispatchB = spawnSync(process.execPath, [
        join(SCRIPT_DIR, 'dispatch.mjs'), basename(peer.sibling), '--agent', 'test',
        '--task-id', 'cross-repo-same-id', 'cross-repo direct B',
      ], {
        ...HEADLESS_CHILD_OPTIONS,
        cwd: peer.main,
        encoding: 'utf8',
        env: defaultEnv,
        timeout: 30_000,
      });
      assert.equal(dispatchB.status, 0, dispatchB.stderr);
      assert.equal(parseJsonLine(dispatchB.stdout).ok, true);
      assert.equal(await waitForExit(dispatchA), 0);
      for (const repo of [fixture, peer]) {
        const task = JSON.parse(readFileSync(join(runtimeOf(repo.main), 'tasks', 'cross-repo-same-id.json'), 'utf8'));
        assert.equal(task.status, 'done');
        assert.equal(resolve(task.path), resolve(repo.sibling), '任务三件套必须各归各仓，不得混写');
        for (const extension of ['json', 'log', 'prompt.txt']) {
          assert.ok(
            existsSync(join(runtimeOf(repo.main), 'tasks', `cross-repo-same-id.${extension}`)),
            `缺少任务三件套 .${extension}`,
          );
        }
      }

      // 跨 server 实例：同名 worktree 并发派发，.requests 与 PID 锁互不可见。
      serverFixture = await startServer(null, {}, fixture.main, { observeDispatch: true, observerDir: observerDirA });
      let isolationResponse = await authorizedDispatch(serverFixture, {
        worktree: basename(fixture.sibling), prompt: 'cross-repo server A', agent: 'test',
      });
      assert.equal(isolationResponse.status, 202);
      const payloadA = await isolationResponse.json();
      await waitTaskRunning(serverFixture.origin, payloadA.taskId);
      serverPeer = await startServer(null, {}, peer.main, { observeDispatch: true, observerDir: observerDirB });
      isolationResponse = await authorizedDispatch(serverPeer, {
        worktree: basename(peer.sibling), prompt: 'cross-repo server B', agent: 'test',
      });
      assert.equal(
        isolationResponse.status,
        202,
        'A 仓任务运行中，B 仓同名 worktree 派发不得被跨仓误判为 LOCKED',
      );
      const payloadB = await isolationResponse.json();
      const wrapperA = await waitForDispatchWrapper(serverFixture.dispatchPidFile, payloadA.taskId);
      const wrapperB = await waitForDispatchWrapper(serverPeer.dispatchPidFile, payloadB.taskId);
      const finishedA = await waitTask(serverFixture.origin, payloadA.taskId);
      const finishedB = await waitTask(serverPeer.origin, payloadB.taskId);
      assert.equal(resolve(finishedA.task.path), resolve(fixture.sibling));
      assert.equal(resolve(finishedB.task.path), resolve(peer.sibling));
      assert.ok(existsSync(join(runtimeOf(fixture.main), '.requests')), 'A 的 prompt 暂存必须落在 A 仓 runtime');
      assert.ok(existsSync(join(runtimeOf(peer.main), '.requests')), 'B 的 prompt 暂存必须落在 B 仓 runtime');
      await waitForProcessExit(wrapperA.pid, 30_000);
      await waitForProcessExit(wrapperB.pid, 30_000);
    } finally {
      for (const isolationServer of [serverFixture, serverPeer]) {
        if (isolationServer?.child && isolationServer.child.exitCode === null) {
          const stopped = waitForExit(isolationServer.child);
          isolationServer.child.kill();
          await stopped;
        }
      }
      await cleanTemp(observerDirA).catch(() => {});
      await cleanTemp(observerDirB).catch(() => {});
      await cleanRepositoryFixture(peer);
    }
    assert.deepEqual(
      runtimeTreeSnapshot(join(SKILL_DIR, 'runtime')),
      skillRuntimeBefore,
      '技能目录 runtime 在默认选址链下必须零写入',
    );
  } finally {
    if (server?.child && server.child.exitCode === null) {
      const stopped = waitForExit(server.child);
      server.child.kill();
      await stopped;
    }
    await cleanRepositoryFixture(fixture);
  }
}

async function waitForTaskStatus(origin, taskId, isTarget, timeoutLabel) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const response = await fetch(`${origin}/api/task/${taskId}`);
    if (response.ok) {
      const value = await response.json();
      if (isTarget(value.task.status)) return value;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`任务 ${taskId} 未在期限内${timeoutLabel}`);
}

async function waitTask(origin, taskId) {
  const finished = await waitForTaskStatus(origin, taskId, (status) => status !== 'running', '结束');
  await waitForProcessExit(finished.task.pid);
  return finished;
}

function waitTaskRunning(origin, taskId) {
  return waitForTaskStatus(origin, taskId, (status) => status === 'running', '进入 running');
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
      const probe = spawnSync(resolved[0], resolved.slice(1), {
        ...HEADLESS_CHILD_OPTIONS,
        encoding: 'utf8',
        env: commandEnv,
      });
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
      ...HEADLESS_CHILD_OPTIONS,
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
    let response = await authorizedDispatch(server, { worktree: short, prompt: 'server dirty', agent: 'test' });
    assert.equal(response.status, 409);
    let payload = await response.json();
    assert.deepEqual(Object.keys(payload), ['ok', 'error', 'code', 'dirty', 'hint']);
    assert.equal(payload.code, 'DIRTY');

    response = await authorizedDispatch(server, {
      worktree: short, prompt: 'server dirty confirmed', agent: 'test', confirmDirty: true,
    });
    assert.equal(response.status, 202);
    payload = await response.json();
    assert.deepEqual(Object.keys(payload), ['ok', 'taskId', 'logPath']);
    assert.match(payload.logPath.replace(/\\/g, '/'), new RegExp(`/tasks/${payload.taskId}\\.log$`));
    const dispatchWrapper = await waitForDispatchWrapper(server.dispatchPidFile, payload.taskId);

    response = await authorizedDispatch(server, {
      worktree: short, prompt: '不能绕锁', agent: 'test', confirmDirty: true,
    });
    assert.equal(response.status, 409);
    const lockedPayload = await response.json();
    assert.deepEqual(Object.keys(lockedPayload), ['ok', 'code', 'worktree', 'leaseOwner', 'acquiredAt']);
    assert.equal(lockedPayload.code, 'LOCKED');
    assert.equal(lockedPayload.leaseOwner, payload.taskId);
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

    response = await authorizedDispatch(server, {});
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

// #13: 每个脚本里的子进程启动点必须显式声明窗口策略（统一 helper 或显式 windowsHide）。
const SPAWN_CALL_PATTERN = /(?<![.\w])(?:pExecFile|spawnSync|execFileSync|execFile|spawn)\s*\(/g;

function extractBalancedArguments(source, openIndex) {
  let depth = 0;
  let quote = null;
  let index = openIndex;
  while (index < source.length) {
    const character = source[index];
    if (quote) {
      if (character === '\\') { index += 2; continue; }
      if (character === quote) quote = null;
      index += 1; continue;
    }
    if (character === '\'' || character === '"' || character === '`') { quote = character; index += 1; continue; }
    if (character === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
      continue;
    }
    if (character === '(') depth += 1;
    else if (character === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex + 1, index);
    }
    index += 1;
  }
  return null;
}

function assertHeadlessChildOptionsCoverage() {
  const paths = [
    ...readdirSync(SCRIPT_DIR).filter((name) => name.endsWith('.mjs')).map((name) => join(SCRIPT_DIR, name)),
    join(SKILL_DIR, 'run-tests.mjs'),
  ];
  for (const path of paths) {
    const fileName = path === join(SKILL_DIR, 'run-tests.mjs') ? 'run-tests.mjs' : basename(path);
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(SPAWN_CALL_PATTERN)) {
      const argumentsText = extractBalancedArguments(source, match.index + match[0].length - 1);
      assert.ok(argumentsText, `${fileName}: 无法解析 "${match[0].trim()}…" 调用的参数边界`);
      assert.match(
        argumentsText,
        /HEADLESS_CHILD_OPTIONS|windowsHide/,
        `${fileName}: 子进程启动点 "${match[0].trim()}…" 必须使用统一 headless 窗口策略（scripts/headless.mjs）`,
      );
    }
  }
}

const WINDOW_SAMPLER_PS = String.raw`param([string]$RootPidsCsv, [int]$DurationMs)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;
public static class WindowSampler {
  private static List<string> _windows;
  private static bool Collect(IntPtr hWnd, IntPtr lParam) {
    if (IsWindowVisible(hWnd)) {
      uint pid;
      GetWindowThreadProcessId(hWnd, out pid);
      StringBuilder sb = new StringBuilder(512);
      GetWindowText(hWnd, sb, 512);
      if (sb.Length > 0) { _windows.Add(pid.ToString() + "\t" + sb.ToString()); }
    }
    return true;
  }
  public static List<string> VisibleWindows() {
    _windows = new List<string>();
    EnumWindows(Collect, IntPtr.Zero);
    return _windows;
  }
  private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lp);
  [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr hWnd, StringBuilder sb, int max);
}
'@
function Normalize([string]$s) {
  return ((($s -replace '"', '') -replace '\s+', ' ').Trim()).ToLowerInvariant()
}
# Windows 11 会把新控制台 delegate 给 Windows Terminal：窗口属于终端进程而非目标进程树，
# 唯一稳定归属信号是窗口标题（终端会把标题设为命令行），因此按 pid 与规范化命令行双向匹配。
$roots = @($RootPidsCsv -split ',' | ForEach-Object { [uint32]::Parse($_) })
$tab = [char]9
$conflicts = New-Object System.Collections.Generic.List[string]
$deadline = [DateTime]::UtcNow.AddMilliseconds($DurationMs)
while ([DateTime]::UtcNow -lt $deadline -and $conflicts.Count -eq 0) {
  $procs = Get-CimInstance Win32_Process -Property ProcessId, ParentProcessId, CommandLine
  $tree = New-Object 'System.Collections.Generic.HashSet[uint32]'
  $queue = New-Object System.Collections.Generic.Queue[uint32]
  foreach ($root in $roots) { if ($tree.Add($root)) { $queue.Enqueue($root) } }
  while ($queue.Count -gt 0) {
    $current = $queue.Dequeue()
    foreach ($proc in $procs) {
      if ([uint32]$proc.ParentProcessId -eq $current -and $tree.Add([uint32]$proc.ProcessId)) {
        $queue.Enqueue([uint32]$proc.ProcessId)
      }
    }
  }
  $treeCommandLines = @()
  foreach ($proc in $procs) {
    if ($tree.Contains([uint32]$proc.ProcessId) -and $proc.CommandLine) {
      $normalized = Normalize $proc.CommandLine
      if ($normalized.Length -ge 8) { $treeCommandLines += $normalized }
    }
  }
  foreach ($window in [WindowSampler]::VisibleWindows()) {
    $parts = $window -split $tab, 2
    $windowPid = [uint32]$parts[0]
    $matched = $tree.Contains($windowPid)
    if (-not $matched) {
      $title = Normalize $parts[1]
      if ($title.Length -ge 8) {
        foreach ($line in $treeCommandLines) {
          if ($title.Contains($line) -or $line.Contains($title)) { $matched = $true; break }
        }
      }
    }
    if ($matched) { $conflicts.Add($window) }
  }
  if ($conflicts.Count -eq 0) { Start-Sleep -Milliseconds 300 }
}
foreach ($line in $conflicts) { Write-Output $line }
`;

function sampleVisibleConsoleWindows(samplerPath, rootPids, durationMs) {
  return new Promise((resolveSample, reject) => {
    const child = spawn('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', samplerPath,
      rootPids.join(','), String(durationMs),
    ], { ...HEADLESS_CHILD_OPTIONS, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let errorOutput = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { errorOutput += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`窗口采样器退出 ${code}: ${errorOutput.trim()}`));
        return;
      }
      resolveSample(output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
    });
  });
}

async function windowsHideDomain() {
  assertHeadlessChildOptionsCoverage();
  if (process.platform !== 'win32') return;
  const runtimeDir = tempDirectory('windows-hide');
  let server = null;
  try {
    const samplerPath = join(runtimeDir, 'visible-window-sampler.ps1');
    // BOM 必须带：无 BOM 的 UTF-8 会被 Windows PowerShell 按 ANSI 解析，中文注释乱码会破坏脚本语句。
    writeFileSync(samplerPath, `\ufeff${WINDOW_SAMPLER_PS}`);

    // 灵敏度反证：detached 控制台程序显式不隐藏窗口时，必须新建可见控制台并被采样器捕获。
    // ping 拉长到 8 秒：采样器冷启动（powershell + Add-Type）约需 2-3 秒，复现窗口必须活过冷启动期。
    const negativeProbe = spawn('cmd.exe', ['/d', '/s', '/c', 'ping -n 8 127.0.0.1 >nul'], {
      detached: true,
      stdio: 'ignore',
      // 复现 #13 根因，验证采样器确实看得见这类窗口；只有本自检域会出现这一个受控窗口。
      windowsHide: false,
    });
    negativeProbe.unref();
    const caughtWindows = await sampleVisibleConsoleWindows(samplerPath, [negativeProbe.pid], 10_000);
    await waitForProcessExit(negativeProbe.pid, 20_000);
    assert.ok(caughtWindows.length > 0, '采样器灵敏度自检失败：未捕获 detached 未隐藏的复现控制台窗口');

    // 正向链：detached Node 再启动 cmd，全部走 HEADLESS_CHILD_OPTIONS，树内不得出现可见窗口。
    const chainPidFile = join(runtimeDir, 'chain-cmd.pid');
    const chainScriptPath = join(runtimeDir, 'headless-chain.mjs');
    const headlessImport = `import { HEADLESS_CHILD_OPTIONS } from ${JSON.stringify(pathToFileURL(join(SCRIPT_DIR, 'headless.mjs')).href)};`;
    writeFileSync(chainScriptPath, `
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
${headlessImport}
const child = spawn('cmd.exe', ['/d', '/s', '/c', 'ping -n 4 127.0.0.1 >nul'], {
  ...HEADLESS_CHILD_OPTIONS,
  stdio: 'ignore',
});
writeFileSync(process.env.AES_WORKTREE_BOARD_CHAIN_PID_FILE, String(child.pid));
`);
    const chain = spawn(process.execPath, [chainScriptPath], {
      ...HEADLESS_CHILD_OPTIONS,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, AES_WORKTREE_BOARD_CHAIN_PID_FILE: chainPidFile },
    });
    await waitForExit(chain);
    assert.ok(existsSync(chainPidFile), 'headless 链未写出 cmd pid 文件');
    const chainCmdPid = Number(readFileSync(chainPidFile, 'utf8'));
    const cleanWindows = await sampleVisibleConsoleWindows(samplerPath, [chain.pid, chainCmdPid], 5_000);
    await waitForProcessExit(chainCmdPid, 15_000);
    assert.deepEqual(cleanWindows, [], `headless 链出现可见窗口: ${cleanWindows.join(' | ')}`);

    // 真实链：server API 的 CLI fallback dispatch（server → detached dispatch → agent）全程无可见窗口。
    const fixture = repositoryFixture('windows-hide');
    try {
      const fixtureRuntime = join(fixture.root, 'runtime');
      server = await startServer(fixtureRuntime, { AES_WORKTREE_BOARD_REPO_ROOT: fixture.main });
      const sampling = sampleVisibleConsoleWindows(samplerPath, [server.child.pid], 15_000);
      const response = await authorizedDispatch(server, {
        worktree: basename(fixture.sibling),
        prompt: 'windows-hide real chain',
        agent: 'test',
      });
      assert.equal(response.status, 202);
      const payload = await response.json();
      const finished = await waitTask(server.origin, payload.taskId);
      assert.equal(finished.task.status, 'done');
      const dispatchedWindows = await sampling;
      assert.deepEqual(dispatchedWindows, [], `server dispatch 链出现可见窗口: ${dispatchedWindows.join(' | ')}`);
      const stopped = waitForExit(server.child);
      server.child.kill();
      await stopped;
      server = null;
    } finally {
      if (server?.child && server.child.exitCode === null) {
        const stopped = waitForExit(server.child);
        server.child.kill();
        await stopped;
      }
      await cleanRepositoryFixture(fixture);
    }
  } finally {
    await cleanTemp(runtimeDir);
  }
}

async function orchestrationStorageCompatibility() {
  const runtimeDir = tempDirectory('orchestration-storage-compat');
  try {
    const first = await collectStatus({ runtimeDir, issuesFixture: ISSUE_FIXTURE });
    const worker = first.worktrees[0];
    assert.ok(worker, 'storage fixture 需要一个同级 worktree');
    first.schemaVersion = 2;
    worker.assessment = {
      currentTask: 'v2-assessment-preserved', done: null, merge: 'not-yet', reason: 'v2 seed',
      assessedAt: '2100-01-01T00:00:00.000Z', assessedBy: 'selftest', stale: false,
    };
    delete first.orchestration;
    delete first.transitions;
    writeJsonAtomic(join(runtimeDir, 'status.json'), first);
    const created = createTask({
      issue: 61, worktree: worker.name, role: 'executor', 'thread-id': 'T-storage',
      model: 'luna-max', 'routing-reason': 'storage compatibility fixture',
    }, runtimeDir);
    transitionTask(created.taskId, 'parked', { reason: 'storage terminal preservation probe' }, runtimeDir);
    const frozenAt = readRegistry(runtimeDir).tasks[created.taskId].finishedAt;
    assert.ok(frozenAt, 'parked 必须冻结 worker 工作周期');
    const collected = await collectStatus({ runtimeDir, issuesFixture: ISSUE_FIXTURE });
    assert.equal(collected.schemaVersion, 3);
    const persistedWorker = collected.worktrees.find((item) => item.name === worker.name);
    assert.equal(persistedWorker.assessment.currentTask, 'v2-assessment-preserved');
    assert.equal(persistedWorker.task.state, 'parked');
    assert.equal(persistedWorker.task.finishedAt, frozenAt, 'collect 不得漂移已冻结的结束时间');
    assert.equal(readRegistry(runtimeDir).tasks[created.taskId].state, 'parked');
    const collectedAgain = await collectStatus({ runtimeDir, issuesFixture: ISSUE_FIXTURE });
    assert.equal(
      collectedAgain.worktrees.find((item) => item.name === worker.name).task.finishedAt,
      frozenAt,
      '重复 collect 后终态耗时必须保持稳定',
    );
    const legacyRegistry = readJson(join(runtimeDir, 'registry.json'));
    delete legacyRegistry.tasks[created.taskId].startedAt;
    delete legacyRegistry.tasks[created.taskId].finishedAt;
    writeJsonAtomic(join(runtimeDir, 'registry.json'), legacyRegistry);
    const normalizedLegacy = readRegistry(runtimeDir).tasks[created.taskId];
    assert.equal(normalizedLegacy.startedAt, normalizedLegacy.createdAt, '旧 TaskRecord 用 createdAt 补 startedAt');
    assert.equal(normalizedLegacy.finishedAt, normalizedLegacy.updatedAt, '旧终态 TaskRecord 用 updatedAt 补 finishedAt');
    assert.doesNotThrow(() => JSON.parse(readFileSync(join(runtimeDir, 'status.json'), 'utf8')));
    const snapshotBoard = join(runtimeDir, 'board.html');
    assert.ok(existsSync(snapshotBoard), 'collect 必须在目标 runtime 生成可直接打开的快照页面');
    const snapshotSource = readFileSync(snapshotBoard, 'utf8');
    assert.match(snapshotSource, /<script src="status\.js"><\/script>/, 'runtime 快照页面必须读取同目录 status.js');
    assert.doesNotMatch(snapshotSource, /<script src="runtime\/status\.js"><\/script>/, 'runtime 快照不得回读技能目录历史 runtime');
  } finally {
    await cleanTemp(runtimeDir);
  }
}

async function orchestrationAtomicConcurrency() {
  const runtimeDir = tempDirectory('orchestration-storage-race');
  try {
    const writer = join(runtimeDir, 'writer.mjs');
    const storeUrl = pathToFileURL(join(SCRIPT_DIR, 'runtime-store.mjs')).href;
    writeFileSync(writer, `
import { updateRegistry } from ${JSON.stringify(storeUrl)};
const runtimeDir = process.argv[2];
const count = Number(process.argv[3]);
for (let index = 0; index < count; index += 1) {
  updateRegistry(runtimeDir, (registry) => { registry.concurrentCounter = (registry.concurrentCounter || 0) + 1; });
}
`);
    let finished = false;
    const executions = Promise.all(Array.from({ length: 4 }, () => runNode([writer, runtimeDir, '60'])))
      .then((results) => { finished = true; return results; });
    while (!finished) {
      const path = join(runtimeDir, 'registry.json');
      if (existsSync(path)) assert.doesNotThrow(() => JSON.parse(readFileSync(path, 'utf8')), '并发读取不得看到 torn JSON');
      await waitMilliseconds(2);
    }
    const results = await executions;
    for (const result of results) assert.equal(result.status, 0, result.stderr);
    assert.equal(readRegistry(runtimeDir).concurrentCounter, 240, '互斥更新不得丢写');
    assert.equal(readdirSync(runtimeDir).some((name) => name.endsWith('.tmp')), false, '不得遗留 tmp 文件');
  } finally {
    await cleanTemp(runtimeDir);
  }
}

async function orchestrationPreflightLeaseAndState() {
  const runtimeDir = tempDirectory('orchestration-lifecycle-preflight');
  const raceRuntime = tempDirectory('orchestration-lifecycle-race');
  try {
    const availableWorker = basename((await listWorktrees()).siblings[0].path);
    let result = orchestrateSync([
      'task', 'create', '--issue', '17', '--worktree', 'dev4', '--role', 'executor', '--agent', 'claude',
    ], runtimeDir);
    assert.equal(result.status, 2);
    assert.equal(parseJsonLine(result.stderr).code, 'FALLBACK_AUTH_REQUIRED');
    assert.equal(Object.keys(readRegistry(runtimeDir).tasks).length, 0, '未授权 fallback 不得落记录');

    result = orchestrateSync([
      'task', 'create', '--issue', '17', '--worktree', availableWorker, '--role', 'executor',
      '--thread-id', 'T-real-thread', '--model', 'luna-max', '--routing-reason', 'AC clear',
    ], runtimeDir);
    assert.equal(result.status, 0, result.stderr);
    const created = parseJsonLine(result.stdout);
    assert.equal(created.task.threadId, 'T-real-thread');
    assert.equal(created.task.taskKind, 'desktop-thread');
    assert.equal(created.task.modelTier, 'luna-max');
    assert.equal(created.task.startedAt, created.task.createdAt, 'Task 登记时开始 worker 工作周期');
    assert.equal(created.task.finishedAt, null);
    const originalStartedAt = created.task.startedAt;
    heartbeatTask(created.taskId, runtimeDir);
    assert.equal(readRegistry(runtimeDir).tasks[created.taskId].startedAt, originalStartedAt, 'heartbeat 不得重置开始时间');
    transitionTask(created.taskId, 'executing', {}, runtimeDir);
    assert.equal(readRegistry(runtimeDir).tasks[created.taskId].startedAt, originalStartedAt, '普通活动态转移不得重置开始时间');
    transitionTask(created.taskId, 'parked', {}, runtimeDir);
    const parked = readRegistry(runtimeDir).tasks[created.taskId];
    assert.ok(parked.finishedAt, 'parked 必须记录结束时间');
    await waitMilliseconds(5);
    transitionTask(created.taskId, 'executing', {}, runtimeDir);
    const resumed = readRegistry(runtimeDir).tasks[created.taskId];
    assert.ok(resumed.startedAt > originalStartedAt, 'parked 恢复必须开始新的 worker 工作周期');
    assert.equal(resumed.finishedAt, null, 'parked 恢复必须清空结束时间');

    const queuedRuntime = tempDirectory('orchestration-lifecycle-client-thread');
    try {
      const queued = createTask({
        issue: 19, worktree: 'dev5', role: 'executor', 'client-thread-id': 'C-queued',
        model: 'luna-max', 'routing-reason': 'queued Desktop fixture',
      }, queuedRuntime);
      assert.equal(queued.task.taskKind, 'desktop-thread', 'clientThreadId 也必须识别为 Desktop Task');
      result = orchestrateSync([
        'task', 'attach-thread', '--task', queued.taskId, '--thread-id', 'T-attached',
        '--host-id', 'host-1', '--project-id', 'project-1',
      ], queuedRuntime);
      assert.equal(result.status, 0, result.stderr);
      const attached = readRegistry(queuedRuntime).tasks[queued.taskId];
      assert.equal(attached.threadId, 'T-attached');
      assert.equal(attached.clientThreadId, 'C-queued');
      assert.equal(attached.hostId, 'host-1');
      assert.equal(attached.projectId, 'project-1');
    } finally {
      await cleanTemp(queuedRuntime);
    }

    const reviewRuntime = tempDirectory('orchestration-lifecycle-reviewer-lease');
    try {
      const executorCreated = createTask({
        issue: 17, worktree: 'dev4', role: 'executor', 'thread-id': 'T-executor',
        model: 'luna-max', 'routing-reason': 'reviewer lease fixture',
      }, reviewRuntime);
      const executor = executorCreated.task;
      putTypedFinal(reviewRuntime, executorCreated, 'T-executor', 'E-reviewer-lease-final', 'executor-commit');
      const reviewer = createTask({
        issue: 17, worktree: 'parking-agents-dev4', role: 'reviewer',
        'parent-task-id': executor.taskId, 'thread-id': 'T-reviewer',
        model: 'sol-high', 'routing-reason': 'independent review fixture',
      }, reviewRuntime);
      assert.equal(reviewer.task.generation, executor.generation, '关联 reviewer 必须加入 executor 同一 generation');
      assert.equal(readRegistry(reviewRuntime).leases.dev4.owner, executor.taskId, 'reviewer 不得夺取 writer 租约');
      assert.equal(readRegistry(reviewRuntime).tasks[reviewer.taskId].parentTaskId, executor.taskId);

      assert.throws(
        () => createTask({
          issue: 20, worktree: 'parking-agents-dev4', role: 'executor', 'thread-id': 'T-alias-bypass',
          model: 'luna-max', 'routing-reason': 'alias collision probe',
        }, reviewRuntime),
        (error) => error.code === 'LOCKED',
        'dev4 与 parking-agents-dev4 必须命中同一物理租约',
      );
    } finally {
      await cleanTemp(reviewRuntime);
    }

    const projectionRuntime = tempDirectory('orchestration-lifecycle-timing-projection');
    try {
      const executorCreated = createTask({
        issue: 17, worktree: availableWorker, role: 'executor', 'thread-id': 'T-projection-executor',
        model: 'luna-max', 'routing-reason': 'timing projection fixture',
      }, projectionRuntime);
      putTypedFinal(projectionRuntime, executorCreated, 'T-projection-executor', 'E-projection-final', 'projection-commit');
      const reviewer = createTask({
        issue: 17, worktree: availableWorker, role: 'reviewer', 'parent-task-id': executorCreated.taskId,
        'thread-id': 'T-projection-reviewer', model: 'sol-high', 'routing-reason': 'projection reviewer fixture',
      }, projectionRuntime);
      const projected = await collectStatus({ runtimeDir: projectionRuntime, issuesFixture: ISSUE_FIXTURE });
      const projectedWorker = projected.worktrees.find((item) => item.name === availableWorker);
      assert.equal(projectedWorker.task.taskId, executorCreated.taskId, 'reviewer 不得替换 worker 的 executor 计时真源');
      assert.notEqual(projectedWorker.task.taskId, reviewer.taskId);
      assert.equal(projectedWorker.mode, 'running', 'registry 活动 executor 必须把 worker 投影为 running');
    } finally {
      await cleanTemp(projectionRuntime);
    }

    const unknownRuntime = tempDirectory('orchestration-lifecycle-unknown-worktree');
    try {
      result = orchestrateSync([
        'task', 'create', '--issue', '20', '--worktree', 'definitely-missing-worker', '--role', 'executor',
        '--thread-id', 'T-missing-worker', '--model', 'luna-max', '--routing-reason', 'must reject',
      ], unknownRuntime);
      assert.equal(result.status, 2);
      assert.equal(parseJsonLine(result.stderr).code, 'UNKNOWN_WORKTREE');
      assert.equal(Object.keys(readRegistry(unknownRuntime).tasks).length, 0);
    } finally {
      await cleanTemp(unknownRuntime);
    }

    const before = readFileSync(join(runtimeDir, 'registry.json'), 'utf8');
    result = orchestrateSync(['transition', '--task', created.taskId, '--to', 'merged', '--reason', 'illegal shortcut'], runtimeDir);
    assert.equal(result.status, 2);
    assert.equal(parseJsonLine(result.stderr).code, 'INVALID_TRANSITION');
    assert.equal(readFileSync(join(runtimeDir, 'registry.json'), 'utf8'), before, '非法转移必须零状态变化');

    const args = (thread) => [
      join(SCRIPT_DIR, 'orchestrate.mjs'), 'task', 'create', '--issue', '18', '--worktree', availableWorker,
      '--role', 'executor', '--thread-id', thread, '--model', 'sol-high', '--routing-reason', 'race probe',
    ];
    const env = boardEnv(raceRuntime);
    const raced = await Promise.all([runNode(args('T-race-a'), { env }), runNode(args('T-race-b'), { env })]);
    assert.deepEqual(raced.map((item) => item.status).sort(), [0, 2]);
    const loser = raced.find((item) => item.status === 2);
    assert.equal(parseJsonLine(loser.stderr).code, 'LOCKED');
    const registry = readRegistry(raceRuntime);
    assert.equal(Object.keys(registry.tasks).length, 1);
    const raceWorker = Object.keys(registry.leases)[0];
    assert.equal(registry.leases[raceWorker].generation, 1);
  } finally {
    await cleanTemp(runtimeDir);
    await cleanTemp(raceRuntime);
  }
}

function advanceToReview(taskId, runtimeDir, prefix = 'commit') {
  const task = readRegistry(runtimeDir).tasks[taskId];
  assert.ok(['dispatching', 'executing', 'fixing'].includes(task.state));
  const commit = `${prefix}-2`;
  putTypedFinal(runtimeDir, { taskId }, task.threadId, `E-${taskId}-${prefix}-${task.blockCount || 0}-final`, commit);
  return commit;
}

async function orchestrationInboxIdempotency() {
  const runtimeDir = tempDirectory('orchestration-lifecycle-inbox');
  try {
    const created = createTask({
      issue: 17, worktree: 'dev4', role: 'executor', 'thread-id': 'T-inbox',
      model: 'luna-max', 'routing-reason': 'inbox fixture',
    }, runtimeDir);
    advanceToReview(created.taskId, runtimeDir);
    const reviewer = createTask({
      issue: 17, worktree: 'dev4', role: 'reviewer', 'parent-task-id': created.taskId,
      'thread-id': 'T-review', model: 'sol-high', 'routing-reason': 'inbox reviewer fixture',
    }, runtimeDir);
    const createReviewer = actionOf(runtimeDir, 'CREATE_REVIEWER', created.taskId);
    receiveActionReceipt(createReviewer.actionId, 'succeeded', { reviewerTaskId: reviewer.taskId }, runtimeDir);
    assert.equal(reviewer.task.parentTaskId, created.taskId);
    assert.throws(
      () => putInboxEvent({
        thread: 'T-unrelated', task: created.taskId, kind: 'verdict', 'event-id': 'E-foreign',
        payload: JSON.stringify({ summary: 'foreign approval', verdict: 'APPROVE', cursor: 'foreign-cursor' }),
      }, runtimeDir),
      (error) => error.code === 'THREAD_TASK_MISMATCH',
      'foreign thread 不得给显式 Task 注入 verdict/cursor',
    );
    putInboxEvent({
      thread: 'T-review', task: created.taskId, kind: 'commentary', 'event-id': 'E-commentary-approve-bypass',
      payload: JSON.stringify({
        summary: 'ordinary poll must not approve', to: 'approved', cursor: 'commentary-cursor', commitSha: 'commit-2',
      }),
    }, runtimeDir);
    assert.throws(
      () => consumeEvent('E-commentary-approve-bypass', runtimeDir),
      (error) => error.code === 'INVALID_REVIEW_EVENT',
      'commentary/progress payload.to 不得伪造最终 reviewer APPROVE',
    );
    for (let index = 1; index <= 4; index += 1) {
      putInboxEvent({
        thread: 'T-review', task: created.taskId, kind: 'commentary', 'event-id': `E-poll-${index}`,
        payload: JSON.stringify({ summary: `poll ${index}`, cursor: `cursor-${index}` }),
      }, runtimeDir);
    }
    putInboxEvent({
      thread: 'T-review', task: created.taskId, kind: 'verdict', 'event-id': 'E-wake',
      payload: JSON.stringify({
        summary: 'reviewer approved', verdict: 'APPROVE', cursor: 'cursor-final', commitSha: 'commit-2',
      }),
    }, runtimeDir);
    assert.equal(pendingInbox(runtimeDir).pending.length, 6, 'wake、全部 polls 与被拒绝事件都必须留在 pending');
    for (let index = 1; index <= 4; index += 1) consumeEvent(`E-poll-${index}`, runtimeDir);
    const consumed = consumeEvent('E-wake', runtimeDir);
    assert.deepEqual(consumed.transition, { from: 'reviewing', to: 'approved' });
    const transitionCount = readJsonLines(join(runtimeDir, 'transitions.jsonl')).length;
    const duplicate = consumeEvent('E-wake', runtimeDir);
    assert.equal(duplicate.result, 'already-consumed');
    assert.equal(readJsonLines(join(runtimeDir, 'transitions.jsonl')).length, transitionCount, '重复事件不得追加转移');
    const pending = pendingInbox(runtimeDir);
    assert.deepEqual(pending.pending.map((event) => event.eventId), ['E-commentary-approve-bypass']);
    assert.equal(pending.cursors['T-review'], 'cursor-final');
  } finally {
    await cleanTemp(runtimeDir);
  }
}

async function orchestrationCircuitAndLateEvent() {
  const runtimeDir = tempDirectory('orchestration-governance-circuit');
  try {
    const finding = join(runtimeDir, 'finding.md');
    writeFileSync(finding, 'final reviewer finding');
    const created = createTask({
      issue: 56, worktree: 'dev1', role: 'executor', 'thread-id': 'T-block',
      model: 'sol-high', 'routing-reason': 'high risk review',
    }, runtimeDir);
    putTypedFinal(runtimeDir, created, 'T-block', 'E-block-final-a1', 'a1');
    const reviewer = hostCreateReviewer(runtimeDir, created, 1);
    putInboxEvent({
      thread: 'T-block', task: created.taskId, kind: 'verdict', 'event-id': 'E-executor-self-block',
      payload: JSON.stringify({ verdict: 'BLOCK', commitSha: 'a1', cursor: 'self-block-cursor' }),
    }, runtimeDir);
    assert.throws(
      () => consumeEvent('E-executor-self-block', runtimeDir),
      (error) => error.code === 'REVIEW_EVIDENCE_REQUIRED',
      'executor 自己的 thread 不得伪造独立 reviewer BLOCK',
    );
    const queueBlock = (reviewTask, eventId, commit) => putInboxEvent({
      thread: reviewTask.task.threadId, task: created.taskId, kind: 'verdict', 'event-id': eventId,
      payload: JSON.stringify({
        summary: `reviewer BLOCK ${commit}`, verdict: 'BLOCK', commitSha: commit, cursor: `cursor-${eventId}`,
      }),
    }, runtimeDir);
    queueBlock(reviewer, 'E-b1', 'a1');
    const consumedBlock = consumeEvent('E-b1', runtimeDir);
    assert.equal(consumedBlock.result, 'consumed');
    assert.equal(consumedBlock.blockResult, 'recorded');
    assert.deepEqual(consumedBlock.transition, { from: 'reviewing', to: 'fixing' });
    assert.equal(consumedBlock.blockCount, 1);
    let block = recordBlock(created.taskId, {
      commit: 'a1', 'event-id': 'E-b1', 'finding-file': finding,
    }, runtimeDir);
    assert.equal(block.result, 'duplicate-verdict');
    assert.equal(pendingInbox(runtimeDir).pending.some((event) => event.eventId === 'E-b1'), false, 'block record 后事件必须完成消费');
    queueBlock(reviewer, 'E-b1-duplicate', 'a1');
    const duplicateConsumed = consumeEvent('E-b1-duplicate', runtimeDir);
    assert.equal(duplicateConsumed.result, 'consumed');
    assert.equal(duplicateConsumed.blockResult, 'duplicate-verdict');
    assert.equal(duplicateConsumed.blockCount, 1);
    let returned = actionOf(runtimeDir, 'RETURN_TO_EXECUTOR', created.taskId);
    receiveActionReceipt(returned.actionId, 'succeeded', {}, runtimeDir);
    putTypedFinal(runtimeDir, created, 'T-block', 'E-block-final-b2', 'b2');
    const reviewer2 = hostCreateReviewer(runtimeDir, created, 2);
    queueBlock(reviewer2, 'E-b2', 'b2');
    recordBlock(created.taskId, {
      commit: 'b2', 'event-id': 'E-b2', 'finding-file': finding,
    }, runtimeDir);
    returned = actionOf(runtimeDir, 'RETURN_TO_EXECUTOR', created.taskId);
    receiveActionReceipt(returned.actionId, 'succeeded', {}, runtimeDir);
    putTypedFinal(runtimeDir, created, 'T-block', 'E-block-final-c3', 'c3');
    const reviewer3 = hostCreateReviewer(runtimeDir, created, 3);
    queueBlock(reviewer3, 'E-b3', 'c3');
    block = recordBlock(created.taskId, {
      commit: 'c3', 'event-id': 'E-b3', 'finding-file': finding,
    }, runtimeDir);
    assert.equal(block.result, 'circuit-broken');
    assert.equal(block.blockCount, 3);
    assert.equal(readRegistry(runtimeDir).tasks[created.taskId].state, 'handoff-required');
    assert.ok(readRegistry(runtimeDir).tasks[created.taskId].finishedAt, 'handoff-required 必须冻结 worker 工作周期');
    assert.ok(existsSync(block.handoffBundle));
    assert.match(readFileSync(block.handoffBundle, 'utf8'), /Issue: #56|final reviewer finding|Resume conditions/);

    putInboxEvent({
      thread: 'T-block', task: created.taskId, kind: 'progress', 'event-id': 'E-late',
      payload: JSON.stringify({ summary: 'late event', to: 'executing' }),
    }, runtimeDir);
    const late = consumeEvent('E-late', runtimeDir);
    assert.equal(late.nextAction, 'terminal-noop');
    assert.equal(readRegistry(runtimeDir).tasks[created.taskId].state, 'handoff-required', 'late event 不得复活终态');
    assert.throws(
      () => createTask({
        issue: 56, worktree: 'dev1', role: 'reviewer', 'parent-task-id': created.taskId,
        'thread-id': 'T-after-circuit', model: 'sol-high', 'routing-reason': 'must reject',
      }, runtimeDir),
      (error) => ['LANE_CLOSED', 'LOCKED'].includes(error.code),
    );
  } finally {
    await cleanTemp(runtimeDir);
  }
}

async function orchestrationVerdictDimensions() {
  const runtimeDir = tempDirectory('orchestration-governance-verdict');
  try {
    const autonomous = createTask({
      issue: 17, worktree: 'dev4', role: 'executor', 'thread-id': 'T-verdict-a',
      model: 'luna-max', 'routing-reason': 'autonomous fixture', 'interaction-class': 'autonomous',
    }, runtimeDir);
    setVerdict(autonomous.taskId, { code: 'PASS', runtime: 'NOT_RUN' }, runtimeDir);
    assert.throws(
      () => setVerdict(autonomous.taskId, { runtime: 'PASS' }, runtimeDir),
      (error) => error.code === 'RUNTIME_EVIDENCE_IMMUTABLE',
    );
    assert.throws(
      () => setVerdict(autonomous.taskId, { delivery: 'MERGE_READY' }, runtimeDir),
      (error) => error.code === 'MERGE_GATE_RECEIPT_REQUIRED',
      '旧 verdict set 不得写 MERGE_READY',
    );
    transitionTask(autonomous.taskId, 'executing', {}, runtimeDir);
    transitionTask(autonomous.taskId, 'self-qa', {}, runtimeDir);
    assert.throws(
      () => transitionTask(autonomous.taskId, 'committed', { commitSha: 'injected-commit' }, runtimeDir),
      (error) => error.code === 'EXECUTOR_FINAL_EVIDENCE_REQUIRED',
      '旧 transition 不得注入 commit 绕过 executor-final',
    );
    assert.equal(readRegistry(runtimeDir).tasks[autonomous.taskId].state, 'self-qa');
    assert.ok(readRegistry(runtimeDir).leases.dev4, '旁路失败不得释放 lease');
  } finally {
    await cleanTemp(runtimeDir);
  }
}

function continuousStatus(runtimeDir, workers, issues, options = {}) {
  const repoRoot = options.repoRoot || 'C:/fixture/repo';
  const mainBranch = options.mainBranch || 'main';
  const mainHead = options.mainHead || 'main-head';
  writeJsonAtomic(join(runtimeDir, 'status.json'), {
    schemaVersion: 3,
    repo: { root: repoRoot, name: 'repo', mainBranch, mainHead, issueRepo: 'owner/repo' },
    orchestration: { state: 'running' },
    graph: {
      issues: issues.map((issue) => ({
        number: issue.number, title: issue.title || `Issue ${issue.number}`, state: issue.state || 'OPEN',
        labels: issue.labels || ['ready-for-agent'], blockedBy: [],
        derived: { status: issue.status || 'frontier', degree: 0, warn: false },
      })),
      edges: [], stats: { total: issues.length, open: issues.length, closed: 0, frontier: issues.filter((issue) => (issue.status || 'frontier') === 'frontier').length },
    },
    worktrees: workers.map((worker) => typeof worker === 'string'
      ? { name: worker, path: options.workerPaths?.[worker] || null, head: options.workerHeads?.[worker] || 'base-head', task: null }
      : { task: null, ...worker }),
    transitions: [],
  });
}

function executorFinal(commitSha, { manual = false } = {}) {
  return {
    schemaVersion: EXECUTOR_FINAL_SCHEMA,
    outcome: 'COMMITTED',
    commitSha,
    tests: { summary: 'targeted host-shaped regression passed', commands: [{ command: 'node targeted.mjs', exitCode: 0 }] },
    unexecuted: [],
    manualTestDebt: manual ? [{ scope: 'Desktop visual acceptance', reason: 'integration merge policy permits deferred manual test' }] : [],
    suggestedNextState: 'committed',
  };
}

function putTypedFinal(runtimeDir, task, threadId, eventId, commitSha, options = {}) {
  putInboxEvent({
    thread: threadId, task: task.taskId, kind: 'final', 'event-id': eventId,
    payload: JSON.stringify(executorFinal(commitSha, options)),
  }, runtimeDir);
  return consumeEvent(eventId, runtimeDir);
}

function actionOf(runtimeDir, type, taskId = undefined) {
  const actions = nextActions(runtimeDir).actions.filter((action) => action.type === type);
  const action = taskId ? actions.find((candidate) => candidate.taskId === taskId) : actions[0];
  assert.ok(action, `缺少 ${type}${taskId ? ` for ${taskId}` : ''}: ${JSON.stringify(actions)}`);
  return action;
}

function hostCreateReviewer(runtimeDir, task, ordinal) {
  const create = actionOf(runtimeDir, 'CREATE_REVIEWER', task.taskId);
  const parent = readRegistry(runtimeDir).tasks[task.taskId];
  const reviewer = createTask({
    issue: parent.issue, worktree: parent.worktree, role: 'reviewer', 'parent-task-id': task.taskId,
    'thread-id': `T-${parent.worktree}-review-${ordinal}`, model: 'sol-high', 'routing-reason': 'host-shaped independent review',
  }, runtimeDir);
  const receipt = receiveActionReceipt(create.actionId, 'succeeded', { reviewerTaskId: reviewer.taskId }, runtimeDir);
  assert.equal(receipt.type, 'CREATE_REVIEWER');
  assert.equal(readRegistry(runtimeDir).tasks[task.taskId].state, 'reviewing');
  return reviewer;
}

function hostApprove(runtimeDir, task, reviewer, eventId) {
  putInboxEvent({
    thread: reviewer.task.threadId, task: task.taskId, kind: 'verdict', 'event-id': eventId,
    payload: JSON.stringify({ verdict: 'APPROVE', commitSha: readRegistry(runtimeDir).tasks[task.taskId].commitSha, summary: 'APPROVE current commit' }),
  }, runtimeDir);
  const consumed = consumeEvent(eventId, runtimeDir);
  assert.deepEqual(consumed.transition, { from: 'reviewing', to: 'approved' });
}

async function orchestrationContinuousHostChain() {
  const runtimeDir = tempDirectory('orchestration-continuous-host-chain');
  const fixture = repositoryFixture('orchestration-continuous-host-git');
  try {
    writeFileSync(join(fixture.sibling, 'issue43.txt'), 'issue 43\n');
    gitSync(fixture.sibling, ['add', 'issue43.txt']);
    gitSync(fixture.sibling, ['commit', '-m', 'issue 43 implementation']);
    const commitSha = gitSync(fixture.sibling, ['rev-parse', 'HEAD']);
    const mainHead = gitSync(fixture.main, ['rev-parse', 'HEAD']);
    continuousStatus(runtimeDir, [{ name: 'dev43', path: fixture.sibling, branch: 'fixture-dev', head: commitSha }], [
      { number: 43, status: 'claimed', labels: ['ready-for-agent', 'needs-manual-test'] },
      { number: 44, status: 'frontier', labels: ['ready-for-agent'] },
    ], { repoRoot: fixture.main, mainHead });
    const task = createTask({
      issue: 43, worktree: 'dev43', role: 'executor', 'thread-id': 'T-dev43-executor',
      model: 'luna-max', 'routing-reason': 'continuous full-chain fixture',
      'head-sha': mainHead,
    }, runtimeDir);
    assert.equal(task.task.interactionClass, 'needs-manual-test', 'Issue label 必须自动锁定 manual-test policy，不能依赖 host 漏传参数');
    assert.equal(readRegistry(runtimeDir).goal, null, 'one-shot Task/next-actions 不得隐式创建 Goal');
    nextActions(runtimeDir);
    assert.equal(readRegistry(runtimeDir).goal, null);
    const goal = startGoal({ workers: 'dev43', 'manual-test-policy': 'needs-manual-test + explicit debt permits runtime=NOT_RUN' }, runtimeDir);
    assert.equal(goal.goal.state, 'active');
    assert.match(goal.goal.objective, /Outcome:|Constraints:|Verification:/);

    const finalResult = putTypedFinal(runtimeDir, task, 'T-dev43-executor', 'E-final-43', commitSha, { manual: true });
    assert.equal(finalResult.nextAction, 'CREATE_REVIEWER');
    assert.deepEqual(finalResult.transitions.map((transition) => transition.to), ['executing', 'self-qa', 'committed']);
    assert.equal(readRegistry(runtimeDir).tasks[task.taskId].executorFinalEvidence.commitSha, commitSha);
    assert.throws(
      () => transitionTask(task.taskId, 'reviewing', {}, runtimeDir),
      (error) => error.code === 'CREATE_REVIEWER_RECEIPT_REQUIRED',
      '旧 transition 不得跳过 CREATE_REVIEWER receipt',
    );

    const reviewer = hostCreateReviewer(runtimeDir, task, 1);
    hostApprove(runtimeDir, task, reviewer, 'E-approve-43');
    const gate = actionOf(runtimeDir, 'EVALUATE_MERGE_GATE', task.taskId);
    assert.throws(
      () => receiveActionReceipt(gate.actionId, 'succeeded', {
        code: 'PASS', runtime: 'NOT_RUN', delivery: 'MERGE_READY', mergeCheck: 'clean',
        headSha: commitSha, integrationHead: 'fake-integration-head', integrationBranch: 'main',
      }, runtimeDir),
      (error) => error.code === 'FRESH_MERGE_RECEIPT_REQUIRED',
      '伪造 integration HEAD 不得通过 merge gate',
    );
    receiveActionReceipt(gate.actionId, 'succeeded', {
      code: 'PASS', runtime: 'NOT_RUN', delivery: 'MERGE_READY', mergeCheck: 'clean',
      headSha: commitSha, integrationHead: mainHead, integrationBranch: 'main',
    }, runtimeDir);
    assert.equal(readRegistry(runtimeDir).tasks[task.taskId].state, 'merge-ready');
    assert.throws(
      () => setVerdict(task.taskId, { runtime: 'FAIL' }, runtimeDir),
      (error) => error.code === 'VERDICT_LOCKED_AFTER_REVIEW',
      'merge-ready 后旧 verdict set 不得改写已绑定 receipt 的 verdict',
    );
    assert.throws(
      () => transitionTask(task.taskId, 'merged', { mergeCommit: 'fake-merge' }, runtimeDir),
      (error) => error.code === 'POST_MERGE_RECEIPT_REQUIRED',
      '旧 transition 不得跳过 HOST_MERGE/post-merge receipt 释放 lease',
    );
    const legacyMergeCli = orchestrateSync([
      'transition', '--task', task.taskId, '--to', 'merged', '--merge-commit', 'fake-merge',
    ], runtimeDir);
    assert.equal(legacyMergeCli.status, 2);
    assert.equal(parseJsonLine(legacyMergeCli.stderr).code, 'POST_MERGE_RECEIPT_REQUIRED');
    assert.ok(readRegistry(runtimeDir).leases.dev43);

    const merge = actionOf(runtimeDir, 'HOST_MERGE', task.taskId);
    receiveActionReceipt(merge.actionId, 'started', { integrationBranch: 'main', preHead: mainHead }, runtimeDir);
    const duplicateStarted = receiveActionReceipt(merge.actionId, 'started', { integrationBranch: 'main', preHead: mainHead }, runtimeDir);
    assert.equal(duplicateStarted.result, 'already-recorded');
    const resumed = actionOf(runtimeDir, 'HOST_MERGE', task.taskId);
    assert.equal(resumed.actionId, merge.actionId, 'root 重启必须恢复同一 HOST_MERGE 幂等 key');
    assert.equal(resumed.resume, true);
    assert.throws(
      () => receiveActionReceipt(merge.actionId, 'succeeded', {
        integrationBranch: 'main', preHead: mainHead, postHead: 'fake-sha', mergeCommit: 'fake-sha',
      }, runtimeDir),
      (error) => ['GIT_RECONCILIATION_FAILED', 'MERGE_RECEIPT_MISMATCH'].includes(error.code),
      '伪造 merge SHA 不得生成 HOST_MERGE receipt',
    );
    gitSync(fixture.main, ['merge', '--no-ff', 'fixture-dev', '-m', 'merge issue 43']);
    const mergeCommit = gitSync(fixture.main, ['rev-parse', 'HEAD']);
    receiveActionReceipt(merge.actionId, 'succeeded', {
      integrationBranch: 'main', preHead: mainHead, postHead: mergeCommit, mergeCommit,
    }, runtimeDir);

    const verify = actionOf(runtimeDir, 'POST_MERGE_VERIFY', task.taskId);
    assert.throws(
      () => receiveActionReceipt(verify.actionId, 'succeeded', {
        tests: [{ command: 'never-ran', exitCode: 0 }],
      }, runtimeDir),
      (error) => error.code === 'POST_MERGE_EVIDENCE_REQUIRED',
      '任意 exitCode=0 JSON 不得冒充实际 post-merge execution',
    );
    const failedVerification = runPostMergeVerification(verify.actionId, [{
      file: process.execPath, args: ['-e', 'process.exit(7)'], label: 'real failing post-merge probe',
    }], runtimeDir);
    assert.equal(failedVerification.result, 'verification-failed');
    assert.equal(readRegistry(runtimeDir).tasks[task.taskId].state, 'merge-ready');
    assert.ok(readRegistry(runtimeDir).leases.dev43, '真实命令失败不得释放 lease');
    const commandsFile = join(runtimeDir, 'post-merge-commands.json');
    writeFileSync(commandsFile, JSON.stringify([{
      file: process.execPath, args: ['-e', 'process.exit(0)'], label: 'real post-merge node probe',
    }]));
    const verifiedCli = orchestrateSync([
      'action', 'verify', '--action-id', verify.actionId, '--commands-file', commandsFile,
    ], runtimeDir);
    assert.equal(verifiedCli.status, 0, verifiedCli.stderr);
    assert.equal(parseJsonLine(verifiedCli.stdout).result, 'verification-passed');
    assert.equal(readRegistry(runtimeDir).tasks[task.taskId].state, 'merged');
    assert.equal(readRegistry(runtimeDir).leases.dev43, undefined);

    const claim = actionOf(runtimeDir, 'CLAIM_NEXT_ISSUE', task.taskId);
    assert.equal(claim.issue, 44);
    const nextTask = createTask({
      issue: 44, worktree: 'dev43', role: 'executor', 'thread-id': 'T-dev43-next',
      model: 'luna-max', 'routing-reason': 'claimed by continuous host loop',
    }, runtimeDir);
    const claimReceipt = receiveActionReceipt(claim.actionId, 'succeeded', { nextTaskId: nextTask.taskId }, runtimeDir);
    assert.equal(claimReceipt.type, 'CLAIM_NEXT_ISSUE');
    assert.equal(receiveActionReceipt(claim.actionId, 'succeeded', { nextTaskId: nextTask.taskId }, runtimeDir).result, 'already-recorded');
    assert.equal(readRegistry(runtimeDir).tasks[nextTask.taskId].issue, 44);
    assert.equal(readRegistry(runtimeDir).goal.state, 'active', '单 lane 继续执行时 Goal 不得提前 complete');
  } finally {
    await cleanTemp(runtimeDir);
    await cleanRepositoryFixture(fixture);
  }
}

async function orchestrationUnclassifiedFinal() {
  const runtimeDir = tempDirectory('orchestration-continuous-unclassified');
  try {
    continuousStatus(runtimeDir, ['dev-unclassified'], []);
    const task = createTask({
      issue: 43, worktree: 'dev-unclassified', role: 'executor', 'thread-id': 'T-unclassified',
      model: 'luna-max', 'routing-reason': 'unclassified final fixture', 'head-sha': 'base-head',
    }, runtimeDir);
    putInboxEvent({
      thread: 'T-unclassified', task: task.taskId, kind: 'final', 'event-id': 'E-unstructured-final',
      payload: JSON.stringify({ summary: 'done, tests passed, commit abc' }),
    }, runtimeDir);
    const first = consumeEvent('E-unstructured-final', runtimeDir);
    assert.equal(first.code, 'UNCLASSIFIED_FINAL');
    assert.equal(first.consumed, false);
    assert.equal(readRegistry(runtimeDir).tasks[task.taskId].state, 'dispatching');
    assert.equal(pendingInbox(runtimeDir).pending.length, 1, '无结构 final 必须保持 pending');
    const second = consumeEvent('E-unstructured-final', runtimeDir);
    assert.equal(second.code, 'UNCLASSIFIED_FINAL');
    assert.equal(Object.keys(readRegistry(runtimeDir).unclassifiedFinals).length, 1, '重复 reconcile 不得复制未分类记录');
    const action = actionOf(runtimeDir, 'UNCLASSIFIED_FINAL', task.taskId);
    assert.equal(action.eventId, 'E-unstructured-final');
    assert.equal(readRegistry(runtimeDir).orchestration.unclassifiedFinalCount, 1);
    assert.throws(
      () => receiveActionReceipt(action.actionId, 'succeeded', { resolution: 'ignore it' }, runtimeDir),
      (error) => error.code === 'UNCLASSIFIED_FINAL_REQUIRES_REPLACEMENT',
      '任意 resolution 不得吞掉 pending final',
    );
    assert.equal(pendingInbox(runtimeDir).pending.length, 1);
    const replacement = putTypedFinal(runtimeDir, task, 'T-unclassified', 'E-typed-replacement', 'replacement-commit');
    assert.equal(replacement.nextAction, 'CREATE_REVIEWER');
    assert.equal(pendingInbox(runtimeDir).pending.length, 0, '合法 replacement typed-final 才能消费旧 unclassified event');
    assert.equal(readRegistry(runtimeDir).unclassifiedFinals['E-unstructured-final'].resolution, 'replacement-typed-final:E-typed-replacement');
  } finally {
    await cleanTemp(runtimeDir);
  }
}

async function orchestrationHostBlockCircuit() {
  const runtimeDir = tempDirectory('orchestration-continuous-block-circuit');
  try {
    continuousStatus(runtimeDir, ['dev-block'], []);
    const task = createTask({
      issue: 43, worktree: 'dev-block', role: 'executor', 'thread-id': 'T-dev-block-executor',
      model: 'sol-high', 'routing-reason': 'host-shaped BLOCK fixture',
    }, runtimeDir);
    let firstReviewer = null;
    for (let ordinal = 1; ordinal <= 3; ordinal += 1) {
      const commit = `block-commit-${ordinal}`;
      putTypedFinal(runtimeDir, task, 'T-dev-block-executor', `E-block-final-${ordinal}`, commit);
      if (ordinal === 2) {
        const create = actionOf(runtimeDir, 'CREATE_REVIEWER', task.taskId);
        assert.throws(
          () => receiveActionReceipt(create.actionId, 'succeeded', { reviewerTaskId: firstReviewer.taskId }, runtimeDir),
          (error) => error.code === 'REVIEW_COMMIT_MISMATCH',
          '旧 commit reviewer 不得完成新 CREATE_REVIEWER action',
        );
      }
      const reviewer = hostCreateReviewer(runtimeDir, task, ordinal);
      if (ordinal === 1) firstReviewer = reviewer;
      if (ordinal === 2) {
        for (const verdict of ['APPROVE', 'BLOCK']) {
          const eventId = `E-old-reviewer-${verdict.toLowerCase()}`;
          putInboxEvent({
            thread: firstReviewer.task.threadId, task: task.taskId, kind: 'verdict', 'event-id': eventId,
            payload: JSON.stringify({ verdict, commitSha: commit, summary: `old reviewer replay ${verdict}` }),
          }, runtimeDir);
          assert.throws(
            () => consumeEvent(eventId, runtimeDir),
            (error) => ['REVIEW_COMMIT_MISMATCH', 'REVIEW_EVIDENCE_REQUIRED'].includes(error.code),
            `旧 reviewer 不得 ${verdict} 新 follow-up commit`,
          );
        }
      }
      putInboxEvent({
        thread: reviewer.task.threadId, task: task.taskId, kind: 'verdict', 'event-id': `E-block-verdict-${ordinal}`,
        payload: JSON.stringify({ verdict: 'BLOCK', commitSha: commit, summary: `must fix ${ordinal}` }),
      }, runtimeDir);
      const blocked = consumeEvent(`E-block-verdict-${ordinal}`, runtimeDir);
      assert.equal(blocked.blockCount, ordinal);
      if (ordinal < 3) {
        assert.equal(blocked.nextAction, 'return-to-executor');
        const returned = actionOf(runtimeDir, 'RETURN_TO_EXECUTOR', task.taskId);
        receiveActionReceipt(returned.actionId, 'succeeded', { threadId: 'T-dev-block-executor' }, runtimeDir);
        assert.equal(readRegistry(runtimeDir).tasks[task.taskId].state, 'executing');
      }
    }
    const finalTask = readRegistry(runtimeDir).tasks[task.taskId];
    assert.equal(finalTask.state, 'handoff-required');
    assert.equal(finalTask.blockCount, 3);
    assert.deepEqual(finalTask.blockLedger.map((entry) => entry.commit), ['block-commit-1', 'block-commit-2', 'block-commit-3']);
  } finally {
    await cleanTemp(runtimeDir);
  }
}

async function orchestrationMergeQueueAndRuntimeBoundary() {
  const runtimeDir = tempDirectory('orchestration-continuous-merge-queue');
  const failRuntime = tempDirectory('orchestration-continuous-runtime-fail');
  const frontierRuntime = tempDirectory('orchestration-continuous-frontier-stop');
  const claimRuntime = tempDirectory('orchestration-continuous-claim-reservation');
  const mergeFixture = repositoryFixture('orchestration-continuous-merge-queue-git');
  try {
    writeFileSync(join(mergeFixture.sibling, 'parallel.txt'), 'parallel\n');
    gitSync(mergeFixture.sibling, ['add', 'parallel.txt']);
    gitSync(mergeFixture.sibling, ['commit', '-m', 'parallel implementation']);
    const sharedCommit = gitSync(mergeFixture.sibling, ['rev-parse', 'HEAD']);
    const mainHead = gitSync(mergeFixture.main, ['rev-parse', 'HEAD']);
    continuousStatus(runtimeDir, [
      { name: 'dev-a', path: mergeFixture.sibling, branch: 'fixture-dev', head: sharedCommit },
      { name: 'dev-b', path: mergeFixture.sibling, branch: 'fixture-dev', head: sharedCommit },
    ], [], { repoRoot: mergeFixture.main, mainHead });
    const ready = [];
    for (const [index, worktree] of ['dev-a', 'dev-b'].entries()) {
      const task = createTask({
        issue: 50 + index, worktree, role: 'executor', 'thread-id': `T-${worktree}-executor`,
        model: 'sol-high', 'routing-reason': 'parallel approve fixture',
      }, runtimeDir);
      putTypedFinal(runtimeDir, task, `T-${worktree}-executor`, `E-${worktree}-final`, sharedCommit);
      const reviewer = hostCreateReviewer(runtimeDir, task, 1);
      hostApprove(runtimeDir, task, reviewer, `E-${worktree}-approve`);
      const gate = actionOf(runtimeDir, 'EVALUATE_MERGE_GATE', task.taskId);
      receiveActionReceipt(gate.actionId, 'succeeded', {
        code: 'PASS', runtime: 'NOT_RUN', delivery: 'MERGE_READY', mergeCheck: 'clean',
        headSha: sharedCommit, integrationHead: mainHead, integrationBranch: 'main',
      }, runtimeDir);
      ready.push(task);
    }
    let actions = nextActions(runtimeDir).actions;
    assert.equal(actions.filter((action) => action.type === 'HOST_MERGE').length, 1, '多 worker APPROVE 只允许一个 integration merge 队首');
    const firstMerge = actions.find((action) => action.type === 'HOST_MERGE');
    receiveActionReceipt(firstMerge.actionId, 'started', { integrationBranch: 'main', preHead: mainHead }, runtimeDir);
    gitSync(mergeFixture.main, ['merge', '--no-ff', 'fixture-dev', '-m', 'merge first parallel lane']);
    const firstMergeCommit = gitSync(mergeFixture.main, ['rev-parse', 'HEAD']);
    receiveActionReceipt(firstMerge.actionId, 'succeeded', {
      integrationBranch: 'main', preHead: mainHead, postHead: firstMergeCommit, mergeCommit: firstMergeCommit,
    }, runtimeDir);
    actions = nextActions(runtimeDir).actions;
    assert.equal(actions.filter((action) => action.type === 'HOST_MERGE').length, 0, 'post-merge verification 前不得放出第二个 merge');
    const firstVerify = actions.find((action) => action.type === 'POST_MERGE_VERIFY');
    runPostMergeVerification(firstVerify.actionId, [{
      file: process.execPath, args: ['-e', 'process.exit(0)'], label: 'first queue post-merge verification',
    }], runtimeDir);
    actions = nextActions(runtimeDir).actions;
    assert.equal(actions.filter((action) => action.type === 'HOST_MERGE').length, 1, '第一条 post-merge 完成后才释放下一条 merge');
    assert.notEqual(actions.find((action) => action.type === 'HOST_MERGE').taskId, firstMerge.taskId);

    continuousStatus(failRuntime, ['dev-fail'], []);
    const task = createTask({
      issue: 60, worktree: 'dev-fail', role: 'executor', 'thread-id': 'T-dev-fail-executor',
      model: 'sol-high', 'routing-reason': 'runtime FAIL boundary', 'interaction-class': 'needs-manual-test',
    }, failRuntime);
    putTypedFinal(failRuntime, task, 'T-dev-fail-executor', 'E-fail-final', 'commit-fail', { manual: true });
    const reviewer = hostCreateReviewer(failRuntime, task, 1);
    hostApprove(failRuntime, task, reviewer, 'E-fail-approve');
    const gate = actionOf(failRuntime, 'EVALUATE_MERGE_GATE', task.taskId);
    assert.throws(
      () => receiveActionReceipt(gate.actionId, 'succeeded', {
        code: 'PASS', runtime: 'FAIL', delivery: 'MERGE_READY', mergeCheck: 'clean', headSha: 'commit-fail',
      }, failRuntime),
      (error) => error.code === 'RUNTIME_BLOCKS_DELIVERY',
      'needs-manual-test 不得把 runtime FAIL 绕成 merge-ready',
    );
    assert.equal(readRegistry(failRuntime).tasks[task.taskId].state, 'approved');
    assert.equal(readRegistry(failRuntime).actionReceipts[gate.actionId], undefined, '失败 receipt 不得污染幂等账本');

    continuousStatus(frontierRuntime, ['dev-frontier'], [{ number: 77, status: 'frontier', labels: ['ready-for-agent'] }]);
    const parked = createTask({
      issue: 70, worktree: 'dev-frontier', role: 'executor', 'thread-id': 'T-frontier-parked',
      model: 'luna-max', 'routing-reason': 'frontier stop boundary',
    }, frontierRuntime);
    transitionTask(parked.taskId, 'parked', { reason: 'explicit manual pause' }, frontierRuntime);
    const stop = evaluateStop({ write: true }, frontierRuntime);
    assert.equal(stop.result, 'advanceable');
    assert.ok(stop.eligibleFrontier.includes(77));
    assert.equal(readRegistry(frontierRuntime).orchestration.state, 'running', 'eligible frontier 存在时不得 stop/complete');

    continuousStatus(claimRuntime, ['dev-claim-a', 'dev-claim-b'], [
      { number: 99, status: 'frontier', labels: ['ready-for-agent'] },
    ]);
    startGoal({ workers: 'dev-claim-a,dev-claim-b' }, claimRuntime);
    const firstClaim = actionOf(claimRuntime, 'CLAIM_NEXT_ISSUE');
    const restartedClaim = actionOf(claimRuntime, 'CLAIM_NEXT_ISSUE');
    assert.equal(restartedClaim.actionId, firstClaim.actionId, 'root restart 必须恢复同一 claim reservation/actionId');
    assert.equal(restartedClaim.issue, 99);
    const otherWorker = firstClaim.worktree === 'dev-claim-a' ? 'dev-claim-b' : 'dev-claim-a';
    assert.throws(
      () => createTask({
        issue: 99, worktree: otherWorker, role: 'executor', 'thread-id': 'T-cross-worker-claim',
        model: 'luna-max', 'routing-reason': 'must be rejected by reservation',
      }, claimRuntime),
      (error) => error.code === 'ISSUE_CLAIM_RESERVED',
      'stale frontier 不得让另一 worker 重复认领同一 Issue',
    );
    const claimedTask = createTask({
      issue: 99, worktree: firstClaim.worktree, role: 'executor', 'thread-id': 'T-reserved-claim',
      model: 'luna-max', 'routing-reason': 'reservation owner claim',
    }, claimRuntime);
    receiveActionReceipt(firstClaim.actionId, 'succeeded', { nextTaskId: claimedTask.taskId }, claimRuntime);
    assert.equal(readRegistry(claimRuntime).claimReservations['99'].status, 'succeeded');
    assert.equal(nextActions(claimRuntime).actions.some((action) => action.type === 'CLAIM_NEXT_ISSUE' && action.issue === 99), false,
      'receipt succeeded 后 stale snapshot 也不得重发 #99 claim');
  } finally {
    await cleanTemp(runtimeDir);
    await cleanTemp(failRuntime);
    await cleanTemp(frontierRuntime);
    await cleanTemp(claimRuntime);
    await cleanRepositoryFixture(mergeFixture);
  }
}

async function orchestrationGlobalStop() {
  const runtimeDir = tempDirectory('orchestration-governance-stop');
  try {
    const first = createTask({
      issue: 14, worktree: 'dev3', role: 'executor', 'thread-id': 'T-stop-a',
      model: 'luna-max', 'routing-reason': 'stop fixture',
    }, runtimeDir);
    let evaluated = evaluateStop({ write: true }, runtimeDir);
    assert.equal(evaluated.result, 'advanceable');
    assert.equal(evaluated.exitCode, 1);
    assert.equal(readRegistry(runtimeDir).orchestration.state, 'running', '--write 在有可推进线路时不得生效');
    transitionTask(first.taskId, 'parked', { reason: 'waiting for user' }, runtimeDir);
    const second = createTask({
      issue: 56, worktree: 'dev1', role: 'executor', 'thread-id': 'T-stop-b',
      model: 'sol-high', 'routing-reason': 'stop fixture',
    }, runtimeDir);
    transitionTask(second.taskId, 'handoff-required', { reason: 'manual handoff probe' }, runtimeDir);
    createTask({
      issue: 0, worktree: 'test', role: 'executor', agent: 'test', model: 'luna-max', 'routing-reason': 'excluded test lane',
    }, runtimeDir);
    writeJsonAtomic(join(runtimeDir, 'status.json'), {
      schemaVersion: 3,
      worktrees: [{ name: 'dev3' }, { name: 'dev1' }, { name: 'dev-idle' }, { name: 'test' }],
    });
    evaluated = evaluateStop({ write: true }, runtimeDir);
    assert.equal(evaluated.result, 'advanceable');
    assert.ok(evaluated.advanceable.some((action) => action.type === 'WAIT_THREADS'
      && action.targets.some((lane) => lane.worktree === 'dev-idle' && lane.state === 'unregistered')));
    const idle = createTask({
      issue: 99, worktree: 'dev-idle', role: 'executor', 'thread-id': 'T-stop-idle',
      model: 'luna-max', 'routing-reason': 'register every real lane before stop',
    }, runtimeDir);
    transitionTask(idle.taskId, 'parked', { reason: 'explicitly classified idle lane' }, runtimeDir);
    evaluated = evaluateStop({ write: true }, runtimeDir);
    assert.equal(evaluated.result, 'stopped');
    assert.equal(evaluated.lanes.test, 'excluded');
    assert.equal(readRegistry(runtimeDir).orchestration.state, 'stopped');
    const collected = await collectStatus({ runtimeDir, issuesFixture: ISSUE_FIXTURE });
    assert.equal(collected.orchestration.state, 'stopped');
    assert.equal(readRegistry(runtimeDir).orchestration.state, 'stopped', 'collect 不得改写 stop');
  } finally {
    await cleanTemp(runtimeDir);
  }

  let inconsistent = null;
  for (let attempt = 0; attempt < 8 && !inconsistent; attempt += 1) {
    const raceRuntime = tempDirectory(`orchestration-governance-stop-race-${attempt}`);
    try {
      const parked = createTask({
        issue: 1, worktree: 'dev-old', role: 'executor', 'thread-id': `T-old-${attempt}`,
        model: 'luna-max', 'routing-reason': 'stop race parked lane',
      }, raceRuntime);
      transitionTask(parked.taskId, 'parked', { reason: 'stop race seed' }, raceRuntime);
      const writer = join(raceRuntime, 'create-active.mjs');
      const orchestrateUrl = pathToFileURL(join(SCRIPT_DIR, 'orchestrate.mjs')).href;
      writeFileSync(writer, `
import { createTask } from ${JSON.stringify(orchestrateUrl)};
createTask({
  issue: 2, worktree: 'dev-new', role: 'executor', 'thread-id': 'T-new',
  model: 'luna-max', 'routing-reason': 'stop race active lane',
}, process.argv[2]);
`);
      const lock = join(raceRuntime, '.control.lock');
      mkdirSync(lock);
      writeFileSync(join(lock, 'owner.json'), '{}\n');
      const createRun = runNode([writer, raceRuntime]);
      await waitMilliseconds(10);
      const stopRun = runNode([
        join(SCRIPT_DIR, 'orchestrate.mjs'), 'stop', 'eval', '--write',
      ], { env: boardEnv(raceRuntime) });
      await waitMilliseconds(185);
      rmSync(lock, { recursive: true, force: true });
      const [createdResult, stoppedResult] = await Promise.all([createRun, stopRun]);
      const registry = readRegistry(raceRuntime);
      const active = Object.values(registry.tasks).find((task) => !['merged', 'parked', 'handoff-required'].includes(task.state));
      if (registry.orchestration.state === 'stopped' && active) {
        inconsistent = {
          attempt, createStatus: createdResult.status, stopStatus: stoppedResult.status,
          activeTask: active.taskId, activeState: active.state,
        };
      }
    } finally {
      await cleanTemp(raceRuntime);
    }
  }
  assert.equal(inconsistent, null, `stop 与 task create 不得产生 stopped+active: ${JSON.stringify(inconsistent)}`);
}

async function orchestrationServerBoundary() {
  const fixture = repositoryFixture('orchestration-boundary-server');
  const runtimeDir = join(fixture.root, 'runtime');
  let server = null;
  try {
    server = await startServer(runtimeDir, { AES_WORKTREE_BOARD_REPO_ROOT: fixture.main });
    let response = await fetch(`${server.origin}/api/dispatch`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: server.origin }, body: '{}',
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { ok: false, code: 'MISSING_TOKEN' });
    const page = await (await fetch(`${server.origin}/`)).text();
    const token = page.match(/<meta name="board-token" content="([^"]+)">/)?.[1];
    assert.ok(token);
    response = await fetch(`${server.origin}/api/dispatch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example', 'x-board-token': token },
      body: '{}',
    });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { ok: false, code: 'FORBIDDEN_ORIGIN', origin: 'https://evil.example' });
    response = await authorizedDispatch(server, {
      worker: basename(fixture.sibling), prompt: 'boundary authorized', agent: 'test',
    });
    assert.equal(response.status, 202);
    const payload = await response.json();
    assert.match(payload.taskId, /^tk-.+-\d+-g\d+$/, 'server success 必须返回 registry generation taskId');
    await waitTask(server.origin, payload.taskId);
  } finally {
    if (server?.child && server.child.exitCode === null) {
      const stopped = waitForExit(server.child);
      server.child.kill();
      await stopped;
    }
    await cleanRepositoryFixture(fixture);
  }

  const failureFixture = repositoryFixture('orchestration-boundary-wrapper-failure');
  const failureRuntime = join(failureFixture.root, 'runtime');
  let failureServer = null;
  try {
    const configDir = join(failureFixture.main, '.aes-worktree-board');
    mkdirSync(configDir);
    writeFileSync(join(configDir, 'board.config.json'), JSON.stringify({
      agents: { broken: ['aes-worktree-board-command-that-does-not-exist'] },
    }));
    failureServer = await startServer(
      failureRuntime,
      { AES_WORKTREE_BOARD_REPO_ROOT: failureFixture.main },
      failureFixture.main,
      { observeDispatch: true, observerDir: failureRuntime },
    );
    const response = await authorizedDispatch(failureServer, {
      worker: basename(failureFixture.sibling), prompt: 'wrapper preflight failure #17', agent: 'broken',
      fallbackAuthorized: '用户明确授权此 fallback 负向测试',
    });
    assert.equal(response.status, 202);
    const payload = await response.json();
    const wrapper = await waitForDispatchWrapper(failureServer.dispatchPidFile, payload.taskId);
    await waitForProcessExit(wrapper.pid, 15_000);
    let task = null;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      task = readRegistry(failureRuntime).tasks[payload.taskId] || null;
      if (task?.state === 'parked') break;
      await waitMilliseconds(50);
    }
    assert.equal(task?.state, 'parked', 'wrapper preflight failure 必须收敛为 parked');
    assert.equal(task?.retryable, true, '尚未启动 agent 的失败必须允许安全重试');
    assert.equal(readRegistry(failureRuntime).leases[task.worktree], undefined, 'preflight failure 不得遗留 writer 租约');
  } finally {
    if (failureServer?.child && failureServer.child.exitCode === null) {
      const stopped = waitForExit(failureServer.child);
      failureServer.child.kill();
      await stopped;
    }
    await cleanRepositoryFixture(failureFixture);
  }

  const asyncFixture = repositoryFixture('orchestration-boundary-async-spawn-error');
  const asyncRuntime = join(asyncFixture.root, 'runtime');
  try {
    const taskId = 'async-spawn-error';
    createTask({
      issue: 18, worktree: basename(asyncFixture.sibling), role: 'executor', agent: 'broken',
      'task-id': taskId, 'fallback-authorized': '用户明确授权异步 spawn 负向测试',
      model: 'luna-max', 'routing-reason': 'async spawn error fixture',
    }, asyncRuntime);
    const observer = join(asyncRuntime, 'force-spawn-error.mjs');
    writeFileSync(observer, `
import { createRequire, syncBuiltinESMExports } from 'node:module';
const require = createRequire(import.meta.url);
const childProcess = require('node:child_process');
const originalSpawn = childProcess.spawn;
childProcess.spawn = function forceAsyncSpawnError(_file, argv, options) {
  return originalSpawn.call(this, 'aes-worktree-board-missing-agent.exe', argv, options);
};
syncBuiltinESMExports();
`);
    const config = JSON.stringify({ agents: { broken: [process.execPath, '-e', 'process.exit(0)'] } });
    const result = spawnSync(process.execPath, [
      '--import', pathToFileURL(observer).href,
      join(SCRIPT_DIR, 'dispatch.mjs'), basename(asyncFixture.sibling),
      '--agent', 'broken', '--task-id', taskId, '--registered',
      '--fallback-authorized', '用户明确授权异步 spawn 负向测试', 'async spawn probe',
    ], {
      ...HEADLESS_CHILD_OPTIONS,
      cwd: asyncFixture.main,
      encoding: 'utf8',
      timeout: 30_000,
      env: boardEnv(asyncRuntime, {
        AES_WORKTREE_BOARD_REPO_ROOT: asyncFixture.main,
        AES_WORKTREE_BOARD_CONFIG: config,
      }),
    });
    assert.notEqual(result.status, 0, '强制 async spawn error 必须失败');
    const task = readRegistry(asyncRuntime).tasks[taskId];
    assert.equal(task.state, 'parked');
    assert.equal(task.retryable, true);
    assert.equal(readRegistry(asyncRuntime).leases[task.worktree], undefined);
    assert.equal(
      readJsonLines(join(asyncRuntime, 'transitions.jsonl')).some((entry) => entry.taskId === taskId && entry.to === 'executing'),
      false,
      'pid 无效的 spawn 不得先伪造 executing',
    );
  } finally {
    await cleanRepositoryFixture(asyncFixture);
  }
}

async function orchestrationConfigPreflight() {
  const fixture = repositoryFixture('orchestration-boundary-config');
  const runtimeDir = join(fixture.root, 'runtime');
  const liveRuntime = tempDirectory('orchestration-boundary-issue-repo');
  try {
    const configDir = join(fixture.main, '.aes-worktree-board');
    mkdirSync(configDir);
    writeFileSync(join(configDir, 'board.config.json'), JSON.stringify({ mainBranch: 'missing-main', issueRepo: 'invalid/missing' }));
    let result = spawnSync(process.execPath, [join(SCRIPT_DIR, 'collect.mjs'), '--no-gh'], {
      ...HEADLESS_CHILD_OPTIONS, cwd: fixture.main, encoding: 'utf8', env: boardEnv(runtimeDir),
    });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /mainBranch.*missing-main/);
    result = spawnSync(process.execPath, [join(SCRIPT_DIR, 'collect.mjs'), '--no-gh'], {
      ...HEADLESS_CHILD_OPTIONS,
      cwd: fixture.main,
      encoding: 'utf8',
      env: boardEnv(runtimeDir, { AES_WORKTREE_BOARD_MAIN_BRANCH: 'main' }),
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readJson(join(runtimeDir, 'status.json')).repo.mainBranch, 'main', 'env 必须覆盖目标仓 config');

    result = spawnSync(process.execPath, [join(SCRIPT_DIR, 'collect.mjs')], {
      ...HEADLESS_CHILD_OPTIONS,
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 30_000,
      env: boardEnv(liveRuntime, { AES_WORKTREE_BOARD_ISSUE_REPO: 'parkth1026/aes-worktree-board-definitely-missing' }),
    });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /issueRepo.*aes-worktree-board-definitely-missing/);
  } finally {
    await cleanRepositoryFixture(fixture);
    await cleanTemp(liveRuntime);
  }
}

async function orchestrationContractMarkers() {
  assert.equal(CONTROL_STATES.length, 15);
  assert.equal(TASK_STATES.length, 14);
  assert.ok(CONTROL_STATES.includes('orchestration-stop'));
  assert.ok(!TASK_STATES.includes('orchestration-stop'));
  const skill = readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8');
  for (const marker of [
    'Desktop `create_thread`', 'registry.json', 'inbox pending', '三维 verdict',
    'runtime=NOT_RUN', 'stop eval --write', '--fallback-authorized', 'Map / List',
    'aes.worktree-board.executor-final/v1', 'next-actions', 'action receipt', 'action verify',
    'claim reservation', 'verificationRun', 'CLAIM_NEXT_ISSUE',
  ]) assert.match(skill, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(skill, /派发 headless 任务/);
  assert.doesNotMatch(skill, /只给合并建议，不执行 merge/);

  const board = readFileSync(join(SKILL_DIR, 'board.html'), 'utf8');
  for (const marker of ['id="orch-pill"', 'GOAL', 'nextAction', '未分类 final', 'task-state', 'registry-section', 'transition-history', 'workerTiming', '本轮开始', 'fallback-authorized', 'id="v2-note"', '>Map<', '>List<']) {
    assert.match(board, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  // 星图既有高保真核心必须原样存在；控制面只允许在确认的 DOM 挂点增量渲染。
  for (const invariant of [
    "8 + 1.4 * degree", "9 + 1.4 * degree", "5 + 1.1 * degree", "3.5 + .8 * degree",
    '--orange:#C15F3C', '--purple:#7C6BAE', 'stroke:#DFD8C7', 'stroke:#CE9A83', 'claimed-pulse', 'worker-flag',
  ]) assert.match(board, new RegExp(invariant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const prototypeDiff = spawnSync('git', ['diff', '--quiet', '--', '.aes-workflow/grilling/2026-08-24-aes-worktree-board-upgrade/2-prototype'], {
    ...HEADLESS_CHILD_OPTIONS, cwd: ROOT,
  });
  assert.equal(prototypeDiff.status, 0, '确认版 2-prototype 不得修改');
}

async function orchestrationDomain() {
  const scenarioIndex = process.argv.indexOf('--scenario');
  const requested = scenarioIndex >= 0 ? process.argv[scenarioIndex + 1] : null;
  const cases = [
    { group: 'storage', name: 'v2-compat-assessment-terminal', run: orchestrationStorageCompatibility },
    { group: 'storage', name: 'atomic-concurrency', run: orchestrationAtomicConcurrency },
    { group: 'lifecycle', name: 'preflight-lease-state', run: orchestrationPreflightLeaseAndState },
    { group: 'lifecycle', name: 'inbox-idempotency', run: orchestrationInboxIdempotency },
    { group: 'governance', name: 'circuit-late-event', run: orchestrationCircuitAndLateEvent },
    { group: 'governance', name: 'verdict-dimensions', run: orchestrationVerdictDimensions },
    { group: 'governance', name: 'global-stop', run: orchestrationGlobalStop },
    { group: 'continuous', name: 'host-final-review-merge-next', run: orchestrationContinuousHostChain },
    { group: 'continuous', name: 'unclassified-final', run: orchestrationUnclassifiedFinal },
    { group: 'continuous', name: 'host-block-circuit', run: orchestrationHostBlockCircuit },
    { group: 'continuous', name: 'merge-queue-runtime-boundary', run: orchestrationMergeQueueAndRuntimeBoundary },
    { group: 'boundary', name: 'server-origin-token', run: orchestrationServerBoundary },
    { group: 'boundary', name: 'config-preflight', run: orchestrationConfigPreflight },
    { group: 'contract', name: 'skill-board-contract', run: orchestrationContractMarkers },
  ];
  const selected = requested ? cases.filter((testCase) => testCase.group === requested) : cases;
  assert.ok(selected.length, `未知 orchestration scenario: ${requested}; 可用 storage|lifecycle|governance|continuous|boundary|contract`);
  let passed = 0;
  for (const testCase of selected) {
    try {
      await testCase.run();
      passed += 1;
    } catch (cause) {
      throw new Error(`orchestration/${testCase.group}/${testCase.name} 失败: ${cause.stack || cause.message}`, { cause });
    }
  }
  return { scenario: requested || 'all', scenarios: selected.length, passed };
}

async function layoutDomain() {
  const required = [
    'SKILL.md', 'board.html', 'board.config.json', 'run-tests.mjs', 'references/design.md',
    'scripts/collect.mjs', 'scripts/capture-issues-fixture.mjs', 'scripts/assess.mjs', 'scripts/check-issue-graph.mjs', 'scripts/command.mjs', 'scripts/dispatch.mjs',
    'scripts/headless.mjs', 'scripts/orchestrate.mjs', 'scripts/runtime-store.mjs',
    'scripts/server.mjs', 'scripts/selftest.mjs',
  ];
  for (const path of required) assert.ok(existsSync(join(SKILL_DIR, path)), `缺少 ${path}`);
  assert.equal(existsSync(join(ROOT, 'worktree-board')), false, '顶级 worktree-board/ 必须不存在');
  const diff = spawnSync('git', ['diff', '--quiet', '--', 'run.toml', '.gitignore'], {
    ...HEADLESS_CHILD_OPTIONS,
    cwd: ROOT,
  });
  assert.equal(diff.status, 0, 'run.toml 与 .gitignore 必须恢复原样');
  const skillSource = readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8');
  assert.match(skillSource, /\.agents\/skills\/aes-worktree-board/);
  assert.doesNotMatch(skillSource, /\.claude\/skills\/aes-worktree-board/);
  assert.match(skillSource, /AES_WORKTREE_BOARD_REPO_ROOT/);
  const config = loadConfig();
  for (const key of ['mainBranch', 'issueRepo', 'port', 'defaultAgent', 'agents']) {
    assert.ok(Object.hasOwn(config, key), `board.config.json 缺少既有字段 ${key}`);
  }
  const scripts = ['collect.mjs', 'assess.mjs', 'check-issue-graph.mjs', 'command.mjs', 'dispatch.mjs', 'headless.mjs', 'orchestrate.mjs', 'runtime-store.mjs', 'server.mjs', 'selftest.mjs'];
  for (const script of scripts) {
    const source = readFileSync(join(SCRIPT_DIR, script), 'utf8');
    for (const match of source.matchAll(/from ['"]([^'"]+)['"]/g)) {
      assert.ok(match[1].startsWith('node:') || match[1].startsWith('./'), `${script} 含 npm 依赖 ${match[1]}`);
    }
  }
  // #14: runtime 默认选址跟随目标仓根（与 REPO_ROOT 同一条 env/cwd 解析链），技能目录不再是默认。
  assert.equal(
    DEFAULT_RUNTIME_DIR,
    join(resolve(process.env.AES_WORKTREE_BOARD_REPO_ROOT || process.cwd()), '.aes-worktree-board', 'runtime'),
  );
  assert.notEqual(DEFAULT_RUNTIME_DIR, join(SKILL_DIR, 'runtime'), '技能目录不得再承载默认 runtime');
  assert.ok(existsSync(ISSUE_FIXTURE), '缺少全量 issue 页面 fixture');

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
      ...HEADLESS_CHILD_OPTIONS,
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, AES_WORKTREE_BOARD_RUNTIME_DIR: assessRuntime },
    });
    assert.equal(assessment.status, 0, assessment.stderr);
    const result = parseJsonLine(assessment.stdout);
    assert.equal(result.assessment.merge, 'not-yet');
    assert.match(result.assessment.reason, /需先补 issue/);

    const rejected = spawnSync(process.execPath, [
      join(SCRIPT_DIR, 'assess.mjs'), 'missing-worker', '--merge', 'not-yet',
    ], {
      ...HEADLESS_CHILD_OPTIONS,
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, AES_WORKTREE_BOARD_RUNTIME_DIR: assessRuntime },
    });
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /missing-worker/);
    assert.equal(existsSync(join(assessRuntime, '.control.lock')), false, 'assess 失败不得遗留 runtime 锁');
  } finally {
    await cleanTemp(assessRuntime);
  }
}

const domains = {
  collect: collectDomain,
  'collect-live': collectLiveDomain,
  fixture: fixtureDomain,
  dispatch: dispatchDomain,
  server: serverDomain,
  'repo-root': repoRootDomain,
  layout: layoutDomain,
  'windows-hide': windowsHideDomain,
  orchestration: orchestrationDomain,
};
const domain = process.argv[2];
if (!domains[domain]) {
  console.error(`用法: node ${basename(SELF)} <${Object.keys(domains).join('|')}>`);
  process.exit(2);
}
try {
  const detail = await domains[domain]();
  console.log(JSON.stringify({ ok: true, domain, ...(detail || {}) }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, domain, error: error.stack || error.message }));
  process.exit(1);
}
