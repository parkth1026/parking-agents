#!/usr/bin/env node
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  watch,
  writeFileSync,
} from 'node:fs';
import { randomBytes } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';
import { appendLedgerEvent, sha256Json } from './lib/ledger.mjs';

function die(message, code = 1) {
  console.error(`wait-submit: ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) flags[key] = true;
    else {
      flags[key] = next;
      i += 1;
    }
  }
  return flags;
}

function issueDirFrom(value) {
  if (!value) die('缺少 --issue-dir。', 2);
  const directory = resolve(value);
  if (!existsSync(directory) || !statSync(directory).isDirectory()) die(`issue 目录不存在：${directory}`, 2);
  return directory;
}

function safeRound(value) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value ?? '')) die('round id 不合法。', 2);
  return value;
}

function readSubmission(pathname) {
  try {
    const parsed = JSON.parse(readFileSync(pathname, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || typeof parsed.round !== 'string' || !Array.isArray(parsed.answers)) {
      die(`${pathname} 不是合法提交。`);
    }
    return parsed;
  } catch (error) {
    die(`读取提交失败：${error.message}`);
  }
}

function atomicJson(pathname, value) {
  mkdirSync(dirname(pathname), { recursive: true });
  const temporary = `${pathname}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  renameSync(temporary, pathname);
  try { chmodSync(pathname, 0o600); } catch { /* Windows ACLs are the effective boundary. */ }
}

const flags = parseArgs(process.argv.slice(2));
const issueDir = issueDirFrom(flags['issue-dir']);
const webDir = join(issueDir, 'web');
const submissionsDir = join(webDir, 'submissions');
const consumedDir = join(webDir, 'consumed');
mkdirSync(submissionsDir, { recursive: true });
mkdirSync(consumedDir, { recursive: true });

if (flags.scan) {
  const pending = readdirSync(submissionsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name.slice(0, -5))
    .filter((round) => !existsSync(join(consumedDir, `${round}.json`)))
    .sort()
    .map((round) => readSubmission(join(submissionsDir, `${round}.json`)));
  console.log(JSON.stringify({ ok: true, pending }));
  process.exit(0);
}

if (flags['mark-consumed']) {
  const round = safeRound(String(flags['mark-consumed']));
  const submissionPath = join(submissionsDir, `${round}.json`);
  if (!existsSync(submissionPath)) die(`找不到提交：${round}`);
  const markerPath = join(consumedDir, `${round}.json`);
  if (!existsSync(markerPath)) {
    const marker = {
      schema_version: 2,
      round,
      submission: basename(submissionPath),
      consumed_at: new Date().toISOString(),
    };
    atomicJson(markerPath, marker);
    appendLedgerEvent(webDir, {
      type: 'submission_consumed',
      actor: { type: 'software-agent', id: 'agent' },
      entity: { kind: 'consumed-submission', id: round, digest: sha256Json(marker) },
      data: marker,
    });
  }
  console.log(JSON.stringify({ ok: true, round, consumed: true }));
  process.exit(0);
}

const round = safeRound(String(flags.round ?? ''));
const submissionPath = join(submissionsDir, `${round}.json`);
if (existsSync(submissionPath)) {
  console.log(JSON.stringify(readSubmission(submissionPath)));
  process.exit(0);
}

const timeoutMs = flags['timeout-ms'] === undefined ? null : Number.parseInt(String(flags['timeout-ms']), 10);
if (timeoutMs !== null && (!Number.isFinite(timeoutMs) || timeoutMs < 1)) die('--timeout-ms 要是正整数。', 2);

let settled = false;
const watcher = watch(submissionsDir, { persistent: true }, (_event, filename) => {
  if (settled || filename !== `${round}.json` || !existsSync(submissionPath)) return;
  settled = true;
  clearTimeout(timer);
  watcher.close();
  console.log(JSON.stringify(readSubmission(submissionPath)));
  process.exit(0);
});

const timer = timeoutMs === null ? null : setTimeout(() => {
  if (settled) return;
  settled = true;
  watcher.close();
  console.error(`wait-submit: timeout ${timeoutMs}ms (${round})`);
  process.exit(2);
}, timeoutMs);

process.on('SIGINT', () => {
  watcher.close();
  process.exit(130);
});
