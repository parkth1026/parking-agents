import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarizeRecorder } from '../request-byte-recorder.mjs';
import { makeAsserter, readJson, runCli, writeManifest } from './contract-test-kit.mjs';

const t = makeAsserter('recovery-cost-pilot');
const root = mkdtempSync(join(tmpdir(), 'aes-screenshot-recovery-'));
const testsDir = dirname(fileURLToPath(import.meta.url));
const fakeModule = join(dirname(testsDir), 'testing', 'fake-gitlab-adapter.mjs');
const candidate = '1111111111111111111111111111111111111111';

function cli(args, env = {}) {
  return runCli(args, { env: { AES_SCREENSHOT_EVIDENCE_TEST_NO_BACKOFF: '1', ...env } });
}

function setup(name, blobs = [Buffer.from('one')]) {
  const spool = join(root, name, 'attempt-1');
  writeManifest(spool, { qaRoundId: name });
  blobs.forEach((bytes, index) => {
    const file = join(root, `${name}-${index}.png`);
    writeFileSync(file, bytes);
    const capture = cli([
      'capture', '--spool', spool, '--capture-id', `cap-${index}`, '--claim', `AC-${index}`,
      '--role', 'acceptance', '--file', file, '--viewport', '1x1', '--theme', 'light', '--sensitivity', 'CLEAR',
    ]);
    if (capture.code !== 0) throw new Error(capture.stdout || capture.stderr);
  });
  const terminal = cli(['terminal', '--spool', spool, '--outcome', 'PASS', '--candidate', candidate]);
  if (terminal.code !== 0) throw new Error(terminal.stdout || terminal.stderr);
  return spool;
}

function adapterArgs(name, rules = []) {
  return [
    '--adapter-module', fakeModule,
    '--adapter-options', JSON.stringify({ statePath: join(root, `${name}-gitlab.json`), faultPlan: { rules } }),
    '--recorder', join(root, `${name}-recorder.jsonl`),
  ];
}

function publish(name, spool, rules = [], env = {}) {
  return cli(['publish', '--manifest', join(spool, 'capture-manifest.json'), ...adapterArgs(name, rules)], env);
}

function resume(name, spool, rules = [], env = {}) {
  return cli(['resume', '--receipt', join(spool, 'publish-receipt.json'), ...adapterArgs(name, rules)], env);
}

function costMatchesRecorder(name, receipt) {
  const recorded = summarizeRecorder(join(root, `${name}-recorder.jsonl`), receipt.batchId);
  const fields = ['gitlabUploadRequests', 'gitlabNoteCreateRequests', 'gitlabNoteReadRequests', 'gitlabAttachmentDownloadRequests', 'gitlabHttpRequests', 'uploadedBytes', 'downloadedBytes'];
  return fields.every((field) => recorded[field] === receipt.cost[field])
    && fields.every((field) => receipt.attempts.reduce((sum, attempt) => sum + (attempt.costDelta[field] || 0), 0) === receipt.cost[field]);
}

try {
  const transientSpool = setup('transient-recovers');
  const transientRules = [{ operation: 'createNote', calls: [1, 2], kind: 'transient', code: 'HTTP_503' }];
  const transient = publish('transient-recovers', transientSpool, transientRules);
  const transientReceipt = readJson(join(transientSpool, 'publish-receipt.json'));
  t.check('two 503s recover inside one publisher invocation', transient.code === 0 && transientReceipt.attempts.length === 1 && transientReceipt.cost.gitlabNoteCreateRequests === 3, transient.stdout || transient.stderr);
  t.check('independent recorder equals cumulative and ΣcostDelta', costMatchesRecorder('transient-recovers', transientReceipt));

  const resumeSpool = setup('resume-note');
  const resumeRules = [{ operation: 'createNote', calls: [1, 2, 3], kind: 'transient', code: 'HTTP_503' }];
  const first = publish('resume-note', resumeSpool, resumeRules);
  t.check('A=3 note failure returns resumable exit 75 after keeping uploads', first.code === 75 && first.json?.error?.code === 'GITLAB_NOTE_CREATE_FAILED');
  const resumed = resume('resume-note', resumeSpool, resumeRules);
  const resumedReceipt = readJson(join(resumeSpool, 'publish-receipt.json'));
  t.check('resume reuses upload receipt and reaches VERIFIED', resumed.code === 0 && resumed.json?.newUploads === 0 && resumedReceipt.attempts.length === 2 && resumedReceipt.evidenceState === 'VERIFIED', resumed.stdout || resumed.stderr);
  t.check('resume cumulative ledger equals independent recorder', costMatchesRecorder('resume-note', resumedReceipt));
  t.check('resume costs remain within RA HTTP/byte hard bounds', resumedReceipt.cost.gitlabHttpRequests <= 2 * 3 * (2 * 1 + 2) && resumedReceipt.cost.uploadedBytes <= 2 * 3 * 3 && resumedReceipt.cost.downloadedBytes <= 2 * 3 * 3);

  const crashSpool = setup('crash-recovery', [Buffer.from('first'), Buffer.from('second')]);
  const crashed = publish('crash-recovery', crashSpool, [], { AES_SCREENSHOT_EVIDENCE_CRASH_AFTER_PERSISTED_UPLOADS: '1' });
  const crashReceipt = readJson(join(crashSpool, 'publish-receipt.json'));
  t.check('hard process crash leaves first upload receipt durable', crashed.code === 86 && crashReceipt.uploads.length === 1 && crashReceipt.attempts[0].outcome === 'RUNNING');
  const crashResumed = resume('crash-recovery', crashSpool);
  const crashRecoveredReceipt = readJson(join(crashSpool, 'publish-receipt.json'));
  t.check('same-machine crash recovery skips durable upload and completes same batch', crashResumed.code === 0 && crashResumed.json?.newUploads === 1 && crashRecoveredReceipt.uploads.length === 2 && crashRecoveredReceipt.attempts[0].outcome === 'CRASH_DETECTED');
  t.check('crash recovery ledger still reconciles independently', costMatchesRecorder('crash-recovery', crashRecoveredReceipt));

  const ambiguousNoteSpool = setup('ambiguous-note');
  const ambiguousNoteRules = [{ operation: 'createNote', calls: [1], kind: 'ambiguous', afterPersist: true, code: 'AMBIGUOUS_NOTE' }];
  const ambiguousNote = publish('ambiguous-note', ambiguousNoteSpool, ambiguousNoteRules);
  const ambiguousState = readJson(join(root, 'ambiguous-note-gitlab.json'));
  t.check('AMBIGUOUS_NOTE reconciles by batch marker without a second note', ambiguousNote.code === 0 && ambiguousState.notes.length === 1 && ambiguousNote.json?.newNotes === 1);

  const ambiguousUploadSpool = setup('ambiguous-upload');
  const ambiguousUploadRules = [{ operation: 'uploadAttachment', calls: [1], kind: 'ambiguous', afterPersist: true, code: 'AMBIGUOUS_UPLOAD' }];
  const ambiguousUpload = publish('ambiguous-upload', ambiguousUploadSpool, ambiguousUploadRules);
  const ambiguousUploadReceipt = readJson(join(ambiguousUploadSpool, 'publish-receipt.json'));
  t.check('AMBIGUOUS_UPLOAD fails closed without filename guessing/retry', ambiguousUpload.code === 75 && ambiguousUpload.json?.error?.code === 'AMBIGUOUS_UPLOAD' && ambiguousUploadReceipt.uploads.length === 0 && ambiguousUploadReceipt.cost.gitlabUploadRequests === 1);
  const ambiguousResumeBefore = summarizeRecorder(join(root, 'ambiguous-upload-recorder.jsonl'), ambiguousUploadReceipt.batchId).gitlabHttpRequests;
  const ambiguousResume = resume('ambiguous-upload', ambiguousUploadSpool, ambiguousUploadRules);
  const ambiguousResumeAfter = summarizeRecorder(join(root, 'ambiguous-upload-recorder.jsonl'), ambiguousUploadReceipt.batchId).gitlabHttpRequests;
  t.check('ambiguous upload cannot blind-resume or add HTTP', ambiguousResume.code === 65 && ambiguousResumeAfter === ambiguousResumeBefore);

  const exhaustedSpool = setup('budget-exhausted');
  const exhaustedRules = [{ operation: 'createNote', calls: [1, 2, 3, 4, 5, 6], kind: 'transient', code: 'HTTP_503' }];
  const exhaustedFirst = publish('budget-exhausted', exhaustedSpool, exhaustedRules);
  const exhaustedSecond = resume('budget-exhausted', exhaustedSpool, exhaustedRules);
  const exhaustedReceipt = readJson(join(exhaustedSpool, 'publish-receipt.json'));
  const beforeThird = summarizeRecorder(join(root, 'budget-exhausted-recorder.jsonl'), exhaustedReceipt.batchId).gitlabHttpRequests;
  const exhaustedThird = resume('budget-exhausted', exhaustedSpool, exhaustedRules);
  const afterThird = summarizeRecorder(join(root, 'budget-exhausted-recorder.jsonl'), exhaustedReceipt.batchId).gitlabHttpRequests;
  t.check('two invocations consume exactly R=2 while remaining BLOCKED', exhaustedFirst.code === 75 && exhaustedSecond.code === 75 && exhaustedReceipt.attempts.length === 2 && exhaustedReceipt.releaseEligibility === 'BLOCKED');
  t.check('third invocation is blocked before GitLab/model work', exhaustedThird.code === 65 && exhaustedThird.json?.error?.code === 'RECOVERY_BUDGET_EXHAUSTED' && afterThird === beforeThird);
  t.check('abnormal summaries stay inside 1024/6144 byte budgets', exhaustedReceipt.attempts.every((attempt) => attempt.controlSummaryUtf8Bytes <= 1024) && exhaustedReceipt.attempts.reduce((sum, attempt) => sum + (attempt.controlSummaryUtf8Bytes || 0) + (attempt.projectionUtf8Bytes || 0), 0) <= 6144);

  const pilotNotes = [];
  for (let index = 1; index <= 20; index += 1) {
    pilotNotes.push({
      projectId: 2137, batchId: `sha256:batch-${index}`, kind: 'acceptance', status: 'VERIFIED', synthetic: false,
      verifiedAt: `2026-08-${String(index).padStart(2, '0')}T00:00:00Z`, N: index, U: Math.ceil(index / 2),
      bytes: index * 100, noteBytes: index * 10, retries: index % 3, humanReviewMinutes: index,
    });
  }
  pilotNotes.push({ ...pilotNotes[0] });
  pilotNotes.push({ ...pilotNotes[0], batchId: 'sha256:synthetic', kind: 'synthetic_smoke', synthetic: true });
  const pilotFile = join(root, 'pilot-notes.json');
  writeFileSync(pilotFile, `${JSON.stringify({ notes: pilotNotes, rejections: [{ legitimate: true }, { legitimate: false }] }, null, 2)}\n`);
  const due = cli(['report', '--notes-file', pilotFile, '--project-id', '2137']);
  t.check('20 unique VERIFIED acceptance batches produce DUE checkpoint only', due.code === 0 && due.json?.status === 'DUE' && due.json?.checkpointId === 'AES-SCREENSHOT-EVIDENCE-PILOT-v1' && due.json?.uniqueVerifiedAcceptanceBatches === 20);
  t.check('pilot excludes duplicate/synthetic and computes fixed P50/P95 metrics', due.json?.metrics?.N?.p50 === 10 && due.json?.metrics?.N?.p95 === 19 && due.json?.legitimateRejectionRate === 0.5);
  t.check('pilot never auto-tunes policy and requires owner REVIEWED', due.json?.policyChangeApplied === false && due.json?.ownerReview === 'REQUIRED');
  writeFileSync(pilotFile, `${JSON.stringify({ notes: pilotNotes.slice(0, 19) }, null, 2)}\n`);
  const pending = cli(['report', '--notes-file', pilotFile, '--project-id', '2137']);
  t.check('19 batches remain pending and do not fabricate DUE report', pending.code === 0 && pending.json?.status === 'PENDING' && pending.json?.remaining === 1);
} finally {
  rmSync(root, { recursive: true, force: true });
}
t.finish();
