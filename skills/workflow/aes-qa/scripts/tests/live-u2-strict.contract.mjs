import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { makeAsserter, readJson, runCli, writeManifest } from './contract-test-kit.mjs';

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const token = argv[index];
    if (!token?.startsWith('--') || argv[index + 1] === undefined) throw new Error(`invalid live argument: ${token || '<missing>'}`);
    values[token.slice(2)] = argv[index + 1];
  }
  return values;
}

const args = parseArgs(process.argv.slice(2));
const projectId = Number(args['project-id']);
const issueIid = Number(args['issue-iid']);
if (!args.host || !Number.isInteger(projectId) || !Number.isInteger(issueIid)) throw new Error('live-u2-strict requires --host, --project-id and --issue-iid');
const hostUrl = new URL(args.host.includes('://') ? args.host : `http://${args.host}`);
const testsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testsDir, '..', '..', '..', '..', '..');
const git = spawnSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true });
if (git.status !== 0) throw new Error(`cannot resolve candidate SHA: ${git.stderr}`);
const candidate = git.stdout.trim();
const root = join(tmpdir(), 'aes-screenshot-evidence-live-u2', candidate);
const spool = join(root, 'attempt-1');
const manifestFile = join(spool, 'capture-manifest.json');
const receiptFile = join(spool, 'publish-receipt.json');
const adapter = resolve(testsDir, '..', 'gitlab-live-adapter.mjs');
const recorder = join(root, 'request-recorder.jsonl');
mkdirSync(root, { recursive: true });

const fixtures = [
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=', 'base64'),
];
const fixturePaths = fixtures.map((bytes, index) => {
  const path = join(root, `u2-${index + 1}.png`);
  writeFileSync(path, bytes);
  return path;
});

if (!existsSync(manifestFile)) {
  writeManifest(spool, {
    qaRoundId: `qa-screenshot-evidence-live-${candidate.slice(0, 12)}`,
    attemptId: 'attempt-1',
    evidenceTarget: {
      provider: 'gitlab', host: hostUrl.hostname, projectId, issueIid,
      projectPath: 'neon/TWE/AesDataCenter', webUrl: hostUrl.origin,
    },
    codeState: { finality: 'final', headSha: candidate, candidateSha: candidate, worktreeDirty: false, patchDigest: null },
    environment: {
      environmentDigest: `sha256:${'2'.repeat(64)}`, browser: 'contract-live-fixture', headed: true,
      appUrl: 'about:blank',
    },
  });
  for (let index = 0; index < fixturePaths.length; index += 1) {
    const capture = runCli([
      'capture', '--spool', spool, '--capture-id', `live-u2-${index + 1}`, '--claim', `AC-LIVE-${index + 1}`,
      '--role', 'acceptance', '--file', fixturePaths[index], '--viewport', '1x1', '--theme', index ? 'dark' : 'light',
      '--sensitivity', 'CLEAR',
    ]);
    if (capture.code !== 0) throw new Error(capture.stdout || capture.stderr);
  }
  const terminal = runCli(['terminal', '--spool', spool, '--outcome', 'PASS', '--candidate', candidate]);
  if (terminal.code !== 0) throw new Error(terminal.stdout || terminal.stderr);
}

const common = ['--adapter-module', adapter, '--recorder', recorder];
const existingReceipt = existsSync(receiptFile) ? readJson(receiptFile) : null;
const first = existingReceipt && existingReceipt.evidenceState !== 'VERIFIED'
  ? runCli(['resume', '--receipt', receiptFile, ...common])
  : runCli(['publish', '--manifest', manifestFile, ...common]);
const second = runCli(['publish', '--manifest', manifestFile, ...common]);
const receipt = readJson(receiptFile);
const marker = readJson(join(spool, 'aggregate-marker.json'));
const t = makeAsserter('live-u2-strict');
t.check('live publish reaches VERIFIED', first.code === 0 && receipt.evidenceState === 'VERIFIED', first.stdout || first.stderr);
t.check('exactly two unique attachments are indexed', receipt.reconciliation.uniqueBlobs === 2 && receipt.uploads.length === 2);
t.check('exactly one evidence note is durable', Number.isInteger(receipt.note?.noteId) && receipt.note.noteId > 0);
t.check('strict normal cost is 2U+2=6', receipt.cost.gitlabHttpRequests === 6 && receipt.cost.strictNormalPathFormula === '2U+2=6');
t.check('both authenticated downloads match bytes and SHA', receipt.verification.attachments.checked === 2 && receipt.verification.attachments.bytesMatched === 2 && receipt.verification.attachments.sha256Matched === 2);
t.check('aggregate marker binds final candidate', marker.status === 'VERIFIED' && marker.candidateSha === candidate && marker.uniqueSha256U === 2 && marker.verifiedU === 2);
t.check('normal model summary stays within 512 UTF-8 bytes', receipt.cost.modelSummaryUtf8Bytes <= 512);
t.check('note URL is exact and discoverable', typeof receipt.note.noteUrl === 'string' && receipt.note.noteUrl.includes(`#note_${receipt.note.noteId}`));
t.check('same candidate rerun is idempotent', second.code === 0 && second.json?.idempotent === true && second.json?.newUploads === 0 && second.json?.newNotes === 0, second.stdout || second.stderr);
t.check('smoke remains one logical batch', receipt.attempts.length === 1 && receipt.cost.publisherInvocations === 1);
t.finish({
  U: 2, noteCount: 1, http: 6, verified: 2, candidateSha: candidate,
  noteUrl: receipt.note.noteUrl, idempotentRerun: { newUploads: second.json?.newUploads, newNotes: second.json?.newNotes },
  spool,
});
