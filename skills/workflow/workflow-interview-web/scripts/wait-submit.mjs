#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { appendLedgerEvent, readLedger, sha256Json } from './lib/dossier.mjs';
import {
  ContinuationWaitError,
  claimConsumption,
  continuationPaths,
  readAgentRecoveryPayload,
  readTargetedHistory,
  readSubmissionFile,
  recordConsumed,
  waitForSubmissionTransport,
} from './lib/continuation.mjs';

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

function readSubmissionOrDie(issueDir, round) {
  const submission = readSubmissionFile(issueDir, round);
  if (!submission) die(`找不到合法提交：${round}`);
  return submission;
}

function pendingSubmissions(issueDir) {
  const paths = continuationPaths(issueDir);
  let state = { rounds: [] };
  try { state = JSON.parse(readFileSync(paths.statePath, 'utf8')); } catch { /* state may be created just after the inbox. */ }
  const roundNumbers = new Map((state.rounds ?? []).map((round) => [round.id, round.no ?? Number.MAX_SAFE_INTEGER]));
  mkdirSync(paths.submissionsDir, { recursive: true });
  mkdirSync(paths.consumedDir, { recursive: true });
  const pending = readdirSync(paths.submissionsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name.slice(0, -5))
    .filter((round) => !existsSync(join(paths.consumedDir, `${round}.json`)))
    .map((round) => readSubmissionOrDie(issueDir, round))
    .sort((left, right) => (roundNumbers.get(left.round) ?? Number.MAX_SAFE_INTEGER)
      - (roundNumbers.get(right.round) ?? Number.MAX_SAFE_INTEGER)
      || String(left.round).localeCompare(String(right.round)));
  return pending;
}

function pendingIdentity(submission) {
  return {
    schema_version: submission.schema_version,
    round: submission.round,
    stage: submission.stage,
    round_revision: submission.round_revision,
    round_digest: submission.round_digest,
    received_at: submission.received_at,
    truncated: submission.truncated,
    answer_count: Array.isArray(submission.answers) ? submission.answers.length : 0,
  };
}

function scan(issueDir, oldestOnly = false) {
  const all = pendingSubmissions(issueDir);
  const pending = oldestOnly ? all.slice(0, 1).map(pendingIdentity) : all;
  console.log(JSON.stringify({
    ok: true,
    pending,
    ...(oldestOnly ? { pending_count: all.length, has_more: all.length > 1 } : {}),
  }));
}

async function markConsumed(issueDir, round) {
  const paths = continuationPaths(issueDir);
  const result = await recordConsumed(issueDir, round, {
    appendLedger: {
      find(marker) {
        return readLedger(paths.webDir).find((event) => event.type === 'submission_consumed'
          && (event.entity?.id === round || event.data?.idempotency_key === marker.idempotency_key));
      },
      append(marker) {
        appendLedgerEvent(paths.webDir, {
          type: 'submission_consumed',
          actor: { type: 'software-agent', id: 'agent' },
          entity: { kind: 'consumed-submission', id: round, digest: sha256Json(marker), idempotency_key: marker.idempotency_key },
          data: marker,
        });
      },
    },
  });
  console.log(JSON.stringify({ ok: true, round, consumed: true, ...(result.replay ? { replay: true } : {}) }));
}

async function waitForRound(issueDir, round, flags) {
  const timeoutMs = flags['timeout-ms'] === undefined ? null : Number.parseInt(String(flags['timeout-ms']), 10);
  if (timeoutMs !== null && (!Number.isFinite(timeoutMs) || timeoutMs < 1)) die('--timeout-ms 要是正整数。', 2);

  const controller = new AbortController();
  const onSignal = () => controller.abort();
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  try {
    const submission = await waitForSubmissionTransport(issueDir, round, { timeoutMs, signal: controller.signal });
    console.log(JSON.stringify(submission));
  } catch (error) {
    const exitCode = error instanceof ContinuationWaitError ? error.exitCode : 1;
    die(error.message, exitCode);
  } finally {
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
  }
}

const flags = parseArgs(process.argv.slice(2));
const issueDir = issueDirFrom(flags['issue-dir']);

if (flags.scan) {
  scan(issueDir, Boolean(flags.oldest));
} else if (flags['claim-consume']) {
  const round = safeRound(String(flags['claim-consume']));
  try { console.log(JSON.stringify(await claimConsumption(issueDir, round))); }
  catch (error) { die(error.message); }
} else if (flags['mark-consumed']) {
  const round = safeRound(String(flags['mark-consumed']));
  try { await markConsumed(issueDir, round); }
  catch (error) { die(error.message); }
} else if (flags['recovery-payload']) {
  if (flags['recovery-payload'] === true) die('缺少 --recovery-payload <round>。', 2);
  const round = safeRound(String(flags['recovery-payload']));
  try { console.log(JSON.stringify(readAgentRecoveryPayload(issueDir, round))); }
  catch (error) { die(error.message); }
} else if (flags.history) {
  if (flags.history === true) die('缺少 --history <round>。', 2);
  const round = safeRound(String(flags.history));
  const qId = flags['q-id'] === undefined ? undefined : safeRound(String(flags['q-id']));
  try { console.log(JSON.stringify(readTargetedHistory(issueDir, round, qId))); }
  catch (error) { die(error.message); }
} else {
  const round = safeRound(String(flags.round ?? ''));
  await waitForRound(issueDir, round, flags);
}
