#!/usr/bin/env node
// 零依赖本地看板服务；固定绑定 127.0.0.1，不暴露到局域网。
import { execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { promisify } from 'node:util';
import {
  closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, statSync, unlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  collectStatus, listWorktrees, loadConfig, RUNTIME_DIR, SKILL_DIR, TASKS_DIR,
} from './collect.mjs';
import { HEADLESS_CHILD_OPTIONS } from './headless.mjs';
import { canonicalWorktreeId, completeFallbackDispatch, registerFallbackDispatch } from './orchestrate.mjs';
import { readRegistry, withRuntimeLock, writeTextAtomic } from './runtime-store.mjs';

const pExecFile = promisify(execFile);
const config = loadConfig();
const requestedPort = process.argv.find((argument, index) => process.argv[index - 1] === '--port');
const port = Number(requestedPort ?? config.port ?? 8321);
const boardToken = `btk_${randomBytes(24).toString('hex')}`;

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function badRequest(response, error) {
  return sendJson(response, 400, { ok: false, error, code: 'BAD_REQUEST' });
}

function readBody(request, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('body too large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function tailFile(path, bytes = 8 * 1024) {
  if (!existsSync(path)) return '';
  const size = statSync(path).size;
  const start = Math.max(0, size - bytes);
  const descriptor = openSync(path, 'r');
  try {
    const buffer = Buffer.alloc(size - start);
    readSync(descriptor, buffer, 0, buffer.length, start);
    return buffer.toString('utf8');
  } finally {
    closeSync(descriptor);
  }
}

async function dirtyCount(path) {
  const { stdout } = await pExecFile('git', ['-C', path, 'status', '--porcelain'], HEADLESS_CHILD_OPTIONS);
  const output = stdout.replace(/\r\n/g, '\n').trimEnd();
  const lines = output ? output.split('\n') : [];
  return {
    modified: lines.filter((line) => !line.startsWith('??')).length,
    untracked: lines.filter((line) => line.startsWith('??')).length,
  };
}

async function handleDispatch(request, response) {
  let payload;
  try {
    payload = JSON.parse(await readBody(request));
  } catch {
    return badRequest(response, '请求体必须是合法 JSON');
  }
  const worktree = payload.worker || payload.worktree;
  const { prompt } = payload;
  const agent = payload.agent || config.defaultAgent;
  if (!worktree || typeof prompt !== 'string' || !prompt.trim()) {
    return badRequest(response, '需要 worktree 与非空 prompt');
  }
  if (!config.agents[agent]) return badRequest(response, `未知 agent "${agent}"`);

  const { main, siblings } = await listWorktrees();
  const target = siblings.find((entry) => {
    const name = entry.path.split('/').pop();
    return name === worktree || name.endsWith(`-${worktree}`);
  });
  if (!target) return badRequest(response, `worktree "${worktree}" 不在同级列表中`);
  const targetName = target.path.split('/').pop();
  const worktreeId = canonicalWorktreeId(targetName);

  const lease = readRegistry(RUNTIME_DIR).leases[worktreeId];
  if (lease) {
    return sendJson(response, 409, {
      ok: false,
      code: 'LOCKED',
      worktree: worktreeId,
      leaseOwner: lease.owner,
      acquiredAt: lease.acquiredAt,
    });
  }
  const dirty = await dirtyCount(target.path);
  if (!payload.confirmDirty && dirty.modified + dirty.untracked > 0) {
    return sendJson(response, 409, {
      ok: false,
      error: 'dirty_confirm_required',
      code: 'DIRTY',
      dirty,
      hint: '该 worktree 可能有人正在干活；带 confirmDirty:true 重试即执行',
    });
  }

  let taskId;
  try {
    const registration = registerFallbackDispatch({
      worktree: worktreeId,
      agent,
      prompt,
      fallbackAuthorized: payload.fallbackAuthorized || null,
    });
    taskId = registration.taskId;
  } catch (error) {
    if (error.code === 'LOCKED') {
      return sendJson(response, 409, {
        ok: false, code: 'LOCKED', worktree: worktreeId,
        leaseOwner: error.details?.leaseOwner, acquiredAt: error.details?.acquiredAt,
      });
    }
    if (error.exitCode === 2) return sendJson(response, 400, { ok: false, error: error.message, code: error.code });
    throw error;
  }
  const requestDir = join(RUNTIME_DIR, '.requests');
  const requestPath = join(requestDir, `${taskId}.txt`);
  mkdirSync(requestDir, { recursive: true });
  withRuntimeLock(RUNTIME_DIR, () => writeTextAtomic(requestPath, prompt));
  const args = [
    join(SKILL_DIR, 'scripts', 'dispatch.mjs'), targetName,
    '--agent', agent, '--task-id', taskId, '--prompt-file', requestPath, '--delete-prompt-file', '--registered',
  ];
  if (payload.fallbackAuthorized) args.push('--fallback-authorized', payload.fallbackAuthorized);
  if (payload.confirmDirty) args.push('--confirm-dirty');
  const child = spawn(process.execPath, args, {
    ...HEADLESS_CHILD_OPTIONS,
    detached: true,
    stdio: 'ignore',
    cwd: SKILL_DIR,
    env: { ...process.env, AES_WORKTREE_BOARD_REPO_ROOT: main.path },
  });
  child.on('error', () => {
    withRuntimeLock(RUNTIME_DIR, () => {
      if (existsSync(requestPath)) unlinkSync(requestPath);
    });
    try { completeFallbackDispatch(taskId, { exitCode: 1, preflightFailure: true, error: 'dispatch wrapper spawn failed' }); } catch { /* registry 保留原始错误优先 */ }
  });
  child.on('close', (code) => {
    if (code === 0) return;
    try { completeFallbackDispatch(taskId, { exitCode: code ?? 1, preflightFailure: true, error: `dispatch wrapper exit ${code}` }); } catch { /* wrapper 已收敛时保持其证据 */ }
  });
  child.unref();

  return sendJson(response, 202, { ok: true, taskId, logPath: join(TASKS_DIR, `${taskId}.log`) });
}

function dispatchSecurity(request, response) {
  const token = request.headers['x-board-token'];
  if (!token || token !== boardToken) {
    sendJson(response, 401, { ok: false, code: 'MISSING_TOKEN' });
    return false;
  }
  const host = request.headers.host;
  const expectedOrigin = `http://${host}`;
  const source = request.headers.origin || request.headers.referer || '';
  let sourceOrigin = '';
  try { sourceOrigin = new URL(source).origin; } catch { sourceOrigin = ''; }
  if (!host?.startsWith('127.0.0.1:') || sourceOrigin !== expectedOrigin) {
    sendJson(response, 403, { ok: false, code: 'FORBIDDEN_ORIGIN', origin: request.headers.origin || sourceOrigin || null });
    return false;
  }
  return true;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  try {
    if (request.method === 'GET' && url.pathname === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      const page = readFileSync(join(SKILL_DIR, 'board.html'), 'utf8')
        .replace('__WORKBOARD_STATUS__', '/runtime/status.js')
        .replace('</head>', `<meta name="board-token" content="${boardToken}">\n</head>`);
      return response.end(page);
    }
    if (request.method === 'GET' && ['/runtime/status.js', '/status.js'].includes(url.pathname)) {
      const snapshotPath = join(RUNTIME_DIR, 'status.js');
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      return response.end(existsSync(snapshotPath) ? readFileSync(snapshotPath) : 'window.WORKBOARD=null;');
    }
    if (request.method === 'GET' && url.pathname === '/api/status') {
      const status = await collectStatus({ skipGh: url.searchParams.get('fast') === '1' });
      return sendJson(response, 200, status);
    }
    if (request.method === 'POST' && url.pathname === '/api/dispatch') {
      if (!dispatchSecurity(request, response)) return undefined;
      return await handleDispatch(request, response);
    }
    const taskMatch = url.pathname.match(/^\/api\/task\/([\w.-]+)$/);
    if (request.method === 'GET' && taskMatch) {
      const taskPath = join(TASKS_DIR, `${taskMatch[1]}.json`);
      if (!existsSync(taskPath)) return sendJson(response, 404, { ok: false, error: '任务不存在' });
      const task = JSON.parse(readFileSync(taskPath, 'utf8'));
      return sendJson(response, 200, { ok: true, task, logTail: tailFile(task.log) });
    }
    return sendJson(response, 404, { ok: false, error: 'not found' });
  } catch (error) {
    return sendJson(response, 500, {
      ok: false,
      message: String(error.message).slice(0, 300),
      code: 'INTERNAL',
    });
  }
});

await listWorktrees();

server.listen(port, '127.0.0.1', () => {
  const address = server.address();
  const actualPort = typeof address === 'object' ? address.port : port;
  console.log(`worktree 看板: http://127.0.0.1:${actualPort}/  （仅本机可访问）`);
});
