#!/usr/bin/env node
// Goal Contract 的机械验收入口：collect / dispatch / server / layout。
import assert from 'node:assert/strict';
import { execFile, spawn, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectStatus, DEFAULT_RUNTIME_DIR, listWorktrees, loadConfig, SKILL_DIR,
} from './collect.mjs';

const pExecFile = promisify(execFile);
const SCRIPT_DIR = resolve(SKILL_DIR, 'scripts');
const SELF = fileURLToPath(import.meta.url);
const ROOT = resolve(SKILL_DIR, '..', '..', '..');

function tempDirectory(label) {
  return mkdtempSync(join(tmpdir(), `aes-worktree-board-${label}-`));
}

function cleanTemp(path) {
  if (path && existsSync(path) && path.startsWith(resolve(tmpdir()))) rmSync(path, { recursive: true, force: true });
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
    cleanTemp(runtimeDir);
  }
}

function worktreeDirty(path) {
  const result = spawnSync('git', ['-C', path, 'status', '--porcelain'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim().length > 0;
}

function dispatchSync(args, runtimeDir) {
  return spawnSync(process.execPath, [join(SCRIPT_DIR, 'dispatch.mjs'), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, AES_WORKTREE_BOARD_RUNTIME_DIR: runtimeDir },
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
    child.on('exit', (code) => resolveExit(code));
  });
}

function startServer(runtimeDir, extraEnv = {}) {
  const child = spawn(process.execPath, [join(SCRIPT_DIR, 'server.mjs'), '--port', '0'], {
    cwd: ROOT,
    env: { ...process.env, AES_WORKTREE_BOARD_RUNTIME_DIR: runtimeDir, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return Promise.race([
    new Promise((resolveServer, reject) => {
      let output = '';
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        output += chunk;
        const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)\//);
        if (match) resolveServer({ child, origin: `http://127.0.0.1:${match[1]}` });
      });
      child.on('error', reject);
      child.on('exit', (code) => reject(new Error(`server 提前退出: ${code}`)));
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('server 启动超时')), 10_000)),
  ]);
}

async function waitTask(origin, taskId) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const response = await fetch(`${origin}/api/task/${taskId}`);
    if (response.ok) {
      const value = await response.json();
      if (value.task.status !== 'running') return value;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`任务 ${taskId} 未在期限内结束`);
}

async function dispatchDomain() {
  const runtimeDir = tempDirectory('dispatch');
  let dirtyFile = null;
  let server = null;
  try {
    const { siblings } = await listWorktrees();
    const target = siblings.find((entry) => !worktreeDirty(entry.path));
    assert.ok(target, '需要一个干净的同级空闲 worktree 执行真实 dirty 握手');
    const name = basename(target.path);
    const short = name.replace(/^.*-(dev\d+)$/, '$1');
    const unique = `${process.pid}-${Date.now()}`;

    const clean = dispatchSync([short, '--agent', 'test', '--task-id', `selftest-clean-${unique}`, '冒烟'], runtimeDir);
    assert.equal(clean.status, 0, clean.stderr);
    const cleanLines = clean.stdout.trim().split(/\r?\n/).map(JSON.parse);
    assert.equal(cleanLines.length, 2);
    assert.deepEqual(Object.keys(cleanLines[0]), ['ok', 'taskId', 'worktree', 'pid', 'log']);
    assert.deepEqual(Object.keys(cleanLines[1]), ['ok', 'taskId', 'exitCode', 'log']);
    assert.equal(cleanLines[0].worktree, name);
    assert.equal(cleanLines[1].exitCode, 0);

    dirtyFile = join(target.path, `.aes-worktree-board-selftest-${unique}.tmp`);
    assert.ok(resolve(dirtyFile).startsWith(`${resolve(target.path)}${process.platform === 'win32' ? '\\' : '/'}`));
    writeFileSync(dirtyFile, 'selftest dirty handshake\n');

    const refused = dispatchSync([short, '--agent', 'test', '--task-id', `selftest-refused-${unique}`, 'dirty'], runtimeDir);
    assert.equal(refused.status, 3);
    const refusedJson = parseJsonLine(refused.stderr);
    assert.equal(refusedJson.code, 'DIRTY');
    assert.ok(refusedJson.dirty.untracked >= 1);

    const confirmed = spawn(process.execPath, [
      join(SCRIPT_DIR, 'dispatch.mjs'), short, '--agent', 'test', '--confirm-dirty',
      '--task-id', `selftest-confirmed-${unique}`, 'dirty confirmed',
    ], {
      cwd: ROOT,
      env: { ...process.env, AES_WORKTREE_BOARD_RUNTIME_DIR: runtimeDir },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const firstLine = JSON.parse(await waitForLine(confirmed));
    assert.equal(firstLine.ok, true);
    const locked = dispatchSync([
      short, '--agent', 'test', '--confirm-dirty', '--task-id', `selftest-locked-${unique}`, 'locked',
    ], runtimeDir);
    assert.equal(locked.status, 2);
    assert.equal(parseJsonLine(locked.stderr).code, 'LOCKED');
    assert.equal(await waitForExit(confirmed), 0);

    server = await startServer(runtimeDir);
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
    for (const extension of ['json', 'log', 'prompt.txt']) {
      assert.ok(existsSync(join(runtimeDir, 'tasks', `${payload.taskId}.${extension}`)), `缺少任务三件套 .${extension}`);
    }
  } finally {
    if (server?.child && !server.child.killed) server.child.kill();
    if (dirtyFile && existsSync(dirtyFile)) unlinkSync(dirtyFile);
    cleanTemp(runtimeDir);
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
    if (server?.child && !server.child.killed) server.child.kill();
    cleanTemp(runtimeDir);
  }
}

function layoutDomain() {
  const required = [
    'SKILL.md', 'board.html', 'board.config.json',
    'scripts/collect.mjs', 'scripts/assess.mjs', 'scripts/dispatch.mjs',
    'scripts/server.mjs', 'scripts/selftest.mjs',
  ];
  for (const path of required) assert.ok(existsSync(join(SKILL_DIR, path)), `缺少 ${path}`);
  assert.equal(existsSync(join(ROOT, 'worktree-board')), false, '顶级 worktree-board/ 必须不存在');
  const diff = spawnSync('git', ['diff', '--quiet', '--', 'run.toml', '.gitignore'], { cwd: ROOT });
  assert.equal(diff.status, 0, 'run.toml 与 .gitignore 必须恢复原样');
  assert.equal(existsSync(join(homedir(), '.claude', 'skills', 'aes-worktree-board')), false, '用户级 skill 副本必须不存在');
  const launch = JSON.parse(readFileSync(join(ROOT, '.claude', 'launch.json'), 'utf8'));
  assert.deepEqual(launch.configurations[0].runtimeArgs, ['.claude/skills/aes-worktree-board/scripts/server.mjs']);
  const config = loadConfig();
  for (const key of ['mainBranch', 'issueRepo', 'port', 'defaultAgent', 'agents']) {
    assert.ok(Object.hasOwn(config, key), `board.config.json 缺少既有字段 ${key}`);
  }
  const scripts = ['collect.mjs', 'assess.mjs', 'dispatch.mjs', 'server.mjs', 'selftest.mjs'];
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
    cleanTemp(assessRuntime);
  }
}

const domains = {
  collect: collectDomain,
  dispatch: dispatchDomain,
  server: serverDomain,
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
