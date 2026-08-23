#!/usr/bin/env node
import {
  chmodSync,
  closeSync,
  createReadStream,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  watch,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { appendLedgerEvent, buildDossier, renderDossierHtml, sha256Json } from './lib/dossier.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ASSETS = join(HERE, 'web');
const DEFAULT_PORT = 19433;
const DEFAULT_IDLE_TIMEOUT_MS = 48 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 1024 * 1024;
const COOKIE_NAME = 'wi_web_key';

function fail(message, code = 1) {
  console.error(`server: ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith('--')) {
      positional.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) flags[key] = true;
    else {
      flags[key] = next;
      i += 1;
    }
  }
  return { positional, flags };
}

function atomicJson(pathname, value, mode = 0o600) {
  mkdirSync(dirname(pathname), { recursive: true });
  const temporary = `${pathname}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode });
  renameSync(temporary, pathname);
  try { chmodSync(pathname, mode); } catch { /* Windows ACLs are the effective boundary. */ }
}

function atomicText(pathname, value, mode = 0o600) {
  mkdirSync(dirname(pathname), { recursive: true });
  const temporary = `${pathname}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  writeFileSync(temporary, value, { encoding: 'utf8', mode });
  renameSync(temporary, pathname);
  try { chmodSync(pathname, mode); } catch { /* Windows ACLs are the effective boundary. */ }
}

function resolveIssueDir(input) {
  if (!input) fail('缺少 --issue-dir。', 2);
  const issueDir = resolve(input);
  if (!existsSync(issueDir) || !statSync(issueDir).isDirectory()) fail(`issue 目录不存在：${issueDir}`, 2);
  return issueDir;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left ?? ''), 'utf8');
  const b = Buffer.from(String(right ?? ''), 'utf8');
  if (a.length !== b.length) {
    const padded = Buffer.alloc(a.length);
    timingSafeEqual(a, padded);
    return false;
  }
  return timingSafeEqual(a, b);
}

function repoRootFrom(issueDir) {
  let current = issueDir;
  for (;;) {
    if (existsSync(join(current, '.git'))) return current;
    const parent = dirname(current);
    if (parent === current) return dirname(dirname(dirname(issueDir)));
    current = parent;
  }
}

function readJson(pathname, fallback = null) {
  try { return JSON.parse(readFileSync(pathname, 'utf8')); }
  catch { return fallback; }
}

function reconcileState(state) {
  if (!state || !Array.isArray(state.rounds)) return state;
  if (!state.rounds.some((round) => round.status === 'pending')) state.open_ambiguities = 0;
  return state;
}

async function probe(info) {
  if (!info?.url || !info?.token) return false;
  try {
    const url = new URL('/api/state', info.url);
    url.searchParams.set('key', info.token);
    const response = await fetch(url, {
      signal: AbortSignal.timeout(800),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function openBrowser(url) {
  let command;
  let args;
  if (process.platform === 'win32') {
    command = 'cmd.exe';
    args = ['/d', '/s', '/c', 'start', '', url];
  } else if (process.platform === 'darwin') {
    command = 'open';
    args = [url];
  } else {
    command = 'xdg-open';
    args = [url];
  }
  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
}

async function start(issueDir, flags) {
  const webDir = join(issueDir, 'web');
  mkdirSync(join(webDir, 'submissions'), { recursive: true });
  mkdirSync(join(webDir, 'consumed'), { recursive: true });
  mkdirSync(join(webDir, 'assets'), { recursive: true });

  const infoPath = join(webDir, 'server-info');
  const existing = readJson(infoPath);
  if (await probe(existing)) {
    const reused = { ...existing, reused: true };
    if (flags.open) openBrowser(existing.url);
    console.log(JSON.stringify(reused));
    return;
  }

  rmSync(infoPath, { force: true });
  rmSync(join(webDir, 'server-stopped'), { force: true });
  const token = randomBytes(32).toString('hex');
  const tokenPath = join(webDir, '.session-token');
  atomicText(tokenPath, `${token}\n`);

  const repoRoot = repoRootFrom(issueDir);
  const stickyDir = join(repoRoot, '.aes-workflow', 'workflow-interview-web');
  const stickyPath = join(stickyDir, '.last-port');
  mkdirSync(stickyDir, { recursive: true });
  const stickyPort = Number.parseInt(readFileIfPresent(stickyPath), 10);
  const requestedPort = Number.parseInt(String(flags.port ?? process.env.WI_WEB_PORT ?? stickyPort ?? DEFAULT_PORT), 10);
  const port = Number.isInteger(requestedPort) && requestedPort >= 0 && requestedPort <= 65535
    ? requestedPort
    : DEFAULT_PORT;

  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'serve', '--issue-dir', issueDir, '--port', String(port)], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: { ...process.env },
  });
  child.unref();

  let info = null;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await delay(50);
    info = readJson(infoPath);
    if (info?.type === 'server-started' && await probe(info)) break;
    info = null;
  }
  if (!info) fail('服务未在 5 秒内启动；检查 web/server-error.log。');
  atomicText(stickyPath, `${info.port}\n`);
  if (flags.open) openBrowser(info.url);
  console.log(JSON.stringify({ ...info, reused: false }));
}

function readFileIfPresent(pathname) {
  try { return readFileSync(pathname, 'utf8').trim(); }
  catch { return ''; }
}

function jsonResponse(response, status, body, extraHeaders = {}) {
  const payload = `${JSON.stringify(body)}\n`;
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  });
  response.end(payload);
}

function parseCookies(header) {
  const cookies = {};
  for (const part of String(header ?? '').split(';')) {
    const at = part.indexOf('=');
    if (at < 0) continue;
    try { cookies[part.slice(0, at).trim()] = decodeURIComponent(part.slice(at + 1).trim()); }
    catch { /* Malformed cookie values never authenticate. */ }
  }
  return cookies;
}

function authorized(request, url, token) {
  const queryKey = url.searchParams.get('key');
  if (queryKey && safeEqual(queryKey, token)) return true;
  const cookie = parseCookies(request.headers.cookie)[COOKIE_NAME];
  return Boolean(cookie && safeEqual(cookie, token));
}

function requestOriginAllowed(request, port) {
  const origin = request.headers.origin;
  if (!origin) return true;
  return origin === `http://127.0.0.1:${port}` || origin === `http://localhost:${port}`;
}

function contentType(pathname) {
  return ({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
  })[extname(pathname).toLowerCase()] ?? 'application/octet-stream';
}

function serveFile(response, pathname, headers = {}) {
  const info = statSync(pathname);
  response.writeHead(200, {
    'Content-Type': contentType(pathname),
    'Content-Length': info.size,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  createReadStream(pathname).pipe(response);
}

function readBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let total = 0;
    request.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        rejectBody(new Error('body_too_large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try { resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { rejectBody(new Error('invalid_json')); }
    });
    request.on('error', rejectBody);
  });
}

function validateAndNormalizeSubmission(body, state) {
  if (!body || typeof body !== 'object' || typeof body.round !== 'string' || !Array.isArray(body.answers)) {
    return { status: 400, body: { ok: false, error: 'invalid_request' } };
  }
  const round = state?.rounds?.find((candidate) => candidate.id === body.round && candidate.status === 'pending');
  if (!round) return { status: 400, body: { ok: false, error: 'invalid_round', round: body.round } };

  const itemById = new Map((round.items ?? []).map((item) => [item.q_id, item]));
  const answerById = new Map();
  for (const raw of body.answers) {
    if (!raw || typeof raw !== 'object' || typeof raw.q_id !== 'string' || answerById.has(raw.q_id)) {
      return { status: 400, body: { ok: false, error: 'invalid_answers' } };
    }
    const item = itemById.get(raw.q_id);
    if (!item) return { status: 400, body: { ok: false, error: 'invalid_answers' } };
    answerById.set(raw.q_id, raw);
  }

  const missing = [];
  const normalized = [];
  let truncated = false;
  for (const item of round.items ?? []) {
    let answer = answerById.get(item.q_id);
    if (!answer && item.tier === 'default') answer = { q_id: item.q_id, type: 'accept' };
    if (!answer) {
      if (item.tier === 'ask' && item.required !== false) missing.push(item.q_id);
      if (item.tier === 'confirm') missing.push(item.q_id);
      continue;
    }

    const type = answer.type;
    if (item.tier === 'default' && !['accept', 'veto'].includes(type)) {
      return { status: 400, body: { ok: false, error: 'invalid_answers' } };
    }
    if (item.tier === 'confirm' && !['confirm', 'veto'].includes(type)) {
      return { status: 400, body: { ok: false, error: 'invalid_answers' } };
    }
    if (item.tier === 'ask') {
      const responseType = item.response?.type ?? 'single_select';
      const optionKeys = new Set((item.options ?? []).map((option) => option.key));
      if (responseType === 'single_select') {
        if (type === 'choice' && optionKeys.has(answer.choice)) normalized.push({ q_id: item.q_id, type, choice: answer.choice });
        else if (type === 'custom' && item.allow_custom !== false && typeof answer.text === 'string' && answer.text.trim()) {
          const text = answer.text.slice(0, 2000);
          truncated ||= text.length !== answer.text.length;
          normalized.push({ q_id: item.q_id, type, text });
        } else return { status: 400, body: { ok: false, error: 'invalid_answers' } };
        continue;
      }
      if (responseType === 'multi_select') {
        if (type !== 'multi' || !Array.isArray(answer.choices)) return { status: 400, body: { ok: false, error: 'invalid_answers' } };
        const choices = [...new Set(answer.choices)];
        if (choices.length !== answer.choices.length || choices.some((choice) => !optionKeys.has(choice))) return { status: 400, body: { ok: false, error: 'invalid_answers' } };
        const custom = typeof answer.custom === 'string' ? answer.custom.trim().slice(0, 2000) : '';
        if (answer.custom !== undefined && item.allow_custom === false) return { status: 400, body: { ok: false, error: 'invalid_answers' } };
        truncated ||= typeof answer.custom === 'string' && custom.length !== answer.custom.trim().length;
        const count = choices.length + (custom ? 1 : 0);
        const min = item.response?.min_selections ?? (item.required === false ? 0 : 1);
        const max = item.response?.max_selections ?? (item.options?.length ?? 0) + (item.allow_custom === false ? 0 : 1);
        const exclusive = new Set(item.response?.exclusive_keys ?? []);
        if (count < min || count > max || (choices.some((choice) => exclusive.has(choice)) && count > 1)) return { status: 400, body: { ok: false, error: 'invalid_answers' } };
        normalized.push({ q_id: item.q_id, type: 'multi', choices, ...(custom ? { custom } : {}) });
        continue;
      }
      if (responseType === 'boolean') {
        if (type !== 'boolean' || typeof answer.value !== 'boolean') return { status: 400, body: { ok: false, error: 'invalid_answers' } };
        normalized.push({ q_id: item.q_id, type, value: answer.value });
        continue;
      }
      if (responseType === 'short_text' || responseType === 'long_text') {
        if (type !== 'text' || typeof answer.value !== 'string' || !answer.value.trim()) return { status: 400, body: { ok: false, error: 'invalid_answers' } };
        const maxLength = responseType === 'short_text' ? Math.min(item.response?.max_length ?? 500, 2000) : Math.min(item.response?.max_length ?? 2000, 8000);
        const value = answer.value.trim().slice(0, maxLength);
        truncated ||= value.length !== answer.value.trim().length;
        normalized.push({ q_id: item.q_id, type: 'text', value });
        continue;
      }
      if (responseType === 'number') {
        if (type !== 'number' || !Number.isFinite(answer.value)) return { status: 400, body: { ok: false, error: 'invalid_answers' } };
        if (Number.isFinite(item.response?.min) && answer.value < item.response.min) return { status: 400, body: { ok: false, error: 'invalid_answers' } };
        if (Number.isFinite(item.response?.max) && answer.value > item.response.max) return { status: 400, body: { ok: false, error: 'invalid_answers' } };
        normalized.push({ q_id: item.q_id, type, value: answer.value, ...(item.response?.unit ? { unit: item.response.unit } : {}) });
        continue;
      }
      if (responseType === 'date_time') {
        if (type !== 'date_time' || typeof answer.value !== 'string' || !answer.value.trim() || answer.value.length > 80) return { status: 400, body: { ok: false, error: 'invalid_answers' } };
        normalized.push({ q_id: item.q_id, type, value: answer.value });
        continue;
      }
      if (responseType === 'ranking') {
        if (type !== 'ranking' || !Array.isArray(answer.choices)) return { status: 400, body: { ok: false, error: 'invalid_answers' } };
        const choices = [...new Set(answer.choices)];
        const minRanked = item.response?.min_ranked ?? item.options?.length ?? 0;
        if (choices.length !== answer.choices.length || choices.length < minRanked || choices.some((choice) => !optionKeys.has(choice))) return { status: 400, body: { ok: false, error: 'invalid_answers' } };
        normalized.push({ q_id: item.q_id, type, choices });
        continue;
      }
      if (responseType === 'evidence') {
        if (type !== 'evidence' || !Array.isArray(answer.values)) return { status: 400, body: { ok: false, error: 'invalid_answers' } };
        const values = answer.values.map((value) => typeof value === 'string' ? value.trim().slice(0, 2000) : '').filter(Boolean);
        if (values.length === 0 || values.length > 20) return { status: 400, body: { ok: false, error: 'invalid_answers' } };
        truncated ||= values.some((value, index) => value.length !== String(answer.values[index] ?? '').trim().length);
        normalized.push({ q_id: item.q_id, type, values });
        continue;
      }
      return { status: 400, body: { ok: false, error: 'invalid_answers' } };
    }
    if (type === 'veto') {
      if (typeof answer.text !== 'string' || !answer.text.trim()) {
        return { status: 400, body: { ok: false, error: 'invalid_answers' } };
      }
      const text = answer.text.slice(0, 2000);
      truncated ||= text.length !== answer.text.length;
      normalized.push({ q_id: item.q_id, type, text });
    } else {
      normalized.push({ q_id: item.q_id, type });
    }
  }
  if (missing.length > 0) return { status: 422, body: { ok: false, error: 'missing_required', q_ids: missing } };
  return { status: 200, round, answers: normalized, truncated };
}

function websocketFrame(value) {
  const payload = Buffer.from(JSON.stringify(value), 'utf8');
  if (payload.length < 126) return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  if (payload.length <= 0xffff) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
    return Buffer.concat([header, payload]);
  }
  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(payload.length), 2);
  return Buffer.concat([header, payload]);
}

async function serve(issueDir, flags) {
  const webDir = join(issueDir, 'web');
  const token = readFileIfPresent(join(webDir, '.session-token'));
  if (!/^[a-f0-9]{64}$/.test(token)) fail('缺少合法的 web/.session-token。');
  const requestedPort = Number.parseInt(String(flags.port ?? DEFAULT_PORT), 10);
  const idleTimeout = Number.parseInt(process.env.WI_WEB_IDLE_TIMEOUT_MS ?? String(DEFAULT_IDLE_TIMEOUT_MS), 10);
  const clients = new Set();
  let actualPort = null;
  let idleTimer = null;
  let watcher = null;
  let shuttingDown = false;
  let lastStateNotice = 0;

  const broadcast = (message) => {
    const frame = websocketFrame(message);
    for (const socket of clients) {
      if (socket.destroyed) clients.delete(socket);
      else socket.write(frame);
    }
  };

  const touch = () => {
    if (!Number.isFinite(idleTimeout) || idleTimeout <= 0) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => shutdown('idle-timeout'), idleTimeout);
  };

  const server = createServer(async (request, response) => {
    touch();
    const url = new URL(request.url ?? '/', `http://127.0.0.1:${actualPort ?? requestedPort}`);

    if (request.method === 'GET' && url.pathname === '/' && url.searchParams.has('key')) {
      if (!safeEqual(url.searchParams.get('key'), token)) {
        jsonResponse(response, 403, { ok: false, error: 'session_key_required' });
        return;
      }
      response.writeHead(303, {
        Location: '/',
        'Set-Cookie': `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/`,
        'Cache-Control': 'no-store',
      });
      response.end();
      return;
    }

    if (!authorized(request, url, token)) {
      jsonResponse(response, 403, { ok: false, error: 'session_key_required' });
      return;
    }
    if (!requestOriginAllowed(request, actualPort)) {
      jsonResponse(response, 403, { ok: false, error: 'origin_forbidden' });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/state') {
      const state = reconcileState(readJson(join(webDir, 'state.json'), {
        schema_version: 2,
        slug: basename(issueDir),
        phases: [],
        open_ambiguities: 0,
        rounds: [],
        locked: [],
        final: null,
      }));
      jsonResponse(response, 200, { ok: true, state, dossier: buildDossier(issueDir) });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/export') {
      const dossier = buildDossier(issueDir, { embedAssets: true });
      const html = renderDossierHtml(dossier);
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${basename(issueDir)}-decision-dossier.html"`,
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'",
      });
      response.end(html);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/submit') {
      let body;
      try { body = await readBody(request); }
      catch (error) {
        jsonResponse(response, error.message === 'body_too_large' ? 413 : 400, { ok: false, error: error.message });
        return;
      }
      const statePath = join(webDir, 'state.json');
      const state = readJson(statePath);
      const submissionPath = typeof body?.round === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(body.round)
        ? join(webDir, 'submissions', `${body.round}.json`)
        : null;
      if (submissionPath && existsSync(submissionPath)) {
        const first = readJson(submissionPath, {});
        jsonResponse(response, 409, {
          ok: false,
          error: 'duplicate_round',
          round: body.round,
          first_received_at: first.received_at ?? null,
        });
        return;
      }
      const result = validateAndNormalizeSubmission(body, state);
      if (result.status !== 200) {
        jsonResponse(response, result.status, result.body);
        return;
      }

      const receivedAt = new Date().toISOString();
      const submission = {
        schema_version: 2,
        round: body.round,
        stage: result.round.stage,
        round_revision: result.round.revision ?? 1,
        round_digest: result.round.digest ?? sha256Json(result.round),
        received_at: receivedAt,
        actor: { type: 'person', id: 'local-user' },
        answers: result.answers,
        truncated: result.truncated,
      };
      atomicJson(submissionPath, submission);
      appendLedgerEvent(webDir, {
        type: 'round_submitted',
        actor: submission.actor,
        entity: { kind: 'submission', id: body.round, revision: submission.round_revision, digest: sha256Json(submission) },
        data: submission,
      });
      const roundInState = state.rounds.find((candidate) => candidate.id === body.round);
      roundInState.status = 'submitted';
      roundInState.submitted_at = receivedAt;
      reconcileState(state);
      atomicJson(statePath, state);
      broadcast({ type: 'submitted', round: body.round });
      jsonResponse(response, 200, {
        ok: true,
        round: body.round,
        received_at: receivedAt,
        ...(result.truncated ? { truncated: true } : {}),
      });
      return;
    }

    if (request.method === 'GET' && url.pathname.startsWith('/files/')) {
      let rawName;
      try { rawName = decodeURIComponent(url.pathname.slice('/files/'.length)); }
      catch {
        jsonResponse(response, 404, { ok: false, error: 'not_found' });
        return;
      }
      if (!rawName || rawName !== basename(rawName) || rawName.startsWith('.') || rawName.includes('/') || rawName.includes('\\')) {
        jsonResponse(response, 404, { ok: false, error: 'not_found' });
        return;
      }
      const assetsDir = resolve(webDir, 'assets');
      const target = resolve(assetsDir, rawName);
      if (!target.startsWith(`${assetsDir}${sep}`) || !existsSync(target)) {
        jsonResponse(response, 404, { ok: false, error: 'not_found' });
        return;
      }
      const info = lstatSync(target);
      if (!info.isFile() || info.isSymbolicLink()) {
        jsonResponse(response, 404, { ok: false, error: 'not_found' });
        return;
      }
      serveFile(response, target, { 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; font-src 'self'" });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/shutdown') {
      jsonResponse(response, 200, { ok: true, stopped: true });
      setImmediate(() => shutdown('explicit'));
      return;
    }

    const staticFiles = {
      '/': 'index.html',
      '/app.mjs': 'app.mjs',
      '/style.css': 'style.css',
    };
    if (request.method === 'GET' && staticFiles[url.pathname]) {
      serveFile(response, join(WEB_ASSETS, staticFiles[url.pathname]), {
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-src 'self'; connect-src 'self' ws:; base-uri 'none'; form-action 'none'",
        'Referrer-Policy': 'no-referrer',
      });
      return;
    }
    jsonResponse(response, 404, { ok: false, error: 'not_found' });
  });

  const shutdown = (reason) => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearTimeout(idleTimer);
    watcher?.close();
    for (const socket of clients) socket.destroy();
    clients.clear();
    atomicJson(join(webDir, 'server-stopped'), { reason, stopped_at: new Date().toISOString(), pid: process.pid });
    rmSync(join(webDir, 'server-info'), { force: true });
    rmSync(join(webDir, '.session-token'), { force: true });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  };

  server.on('upgrade', (request, socket) => {
    touch();
    const url = new URL(request.url ?? '/', `http://127.0.0.1:${actualPort}`);
    if (url.pathname !== '/ws' || !authorized(request, url, token) || !requestOriginAllowed(request, actualPort)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    const key = request.headers['sec-websocket-key'];
    if (!key || request.headers.upgrade?.toLowerCase() !== 'websocket') {
      socket.destroy();
      return;
    }
    const accept = createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
    socket.write([
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '\r\n',
    ].join('\r\n'));
    clients.add(socket);
    socket.on('close', () => clients.delete(socket));
    socket.on('error', () => clients.delete(socket));
    socket.on('data', () => touch());
    socket.write(websocketFrame({ type: 'connected' }));
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && requestedPort !== 0) {
      server.listen(0, '127.0.0.1');
      return;
    }
    atomicText(join(webDir, 'server-error.log'), `${new Date().toISOString()} ${error.code ?? 'ERROR'} ${error.message}\n`);
    process.exit(1);
  });

  server.on('listening', () => {
    actualPort = server.address().port;
    const info = {
      type: 'server-started',
      port: actualPort,
      url: `http://127.0.0.1:${actualPort}/?key=${token}`,
      token,
      web_dir: webDir,
      pid: process.pid,
      started_at: new Date().toISOString(),
    };
    atomicJson(join(webDir, 'server-info'), info);
    watcher = watch(webDir, { persistent: false }, (_event, filename) => {
      if (filename !== 'state.json') return;
      const now = Date.now();
      if (now - lastStateNotice < 40) return;
      lastStateNotice = now;
      broadcast({ type: 'state-updated' });
    });
    touch();
  });

  process.on('SIGTERM', () => shutdown('sigterm'));
  process.on('SIGINT', () => shutdown('sigint'));
  server.listen(requestedPort, '127.0.0.1');
}

const { positional, flags } = parseArgs(process.argv.slice(2));
const command = positional[0];
const issueDir = resolveIssueDir(flags['issue-dir']);

if (command === 'start') await start(issueDir, flags);
else if (command === 'serve') await serve(issueDir, flags);
else fail('用法：server.mjs start --issue-dir <dir> [--port N] [--open]', 2);
