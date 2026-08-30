import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BALANCED_LIMITS, atomicWriteJson, digestObject } from '../screenshot-evidence-core.mjs';
import { makeAsserter, readJson, runCli, writeManifest } from './contract-test-kit.mjs';

const t = makeAsserter('preflight-bounds');
const root = mkdtempSync(join(tmpdir(), 'aes-screenshot-preflight-'));
const testsDir = dirname(fileURLToPath(import.meta.url));
const fakeModule = join(dirname(testsDir), 'testing', 'fake-gitlab-adapter.mjs');
const candidate = '1111111111111111111111111111111111111111';

function limits(overrides = {}) { return { ...BALANCED_LIMITS, ...overrides }; }

function setup(name, specs, { findings = [], requiredEvidence = [], qaRoundId = name } = {}) {
  const spool = join(root, name, 'attempt-1');
  writeManifest(spool, { qaRoundId, findings, requiredEvidence });
  specs.forEach((spec, index) => {
    const fileDir = join(root, name, `source-${index}`);
    mkdirSync(fileDir, { recursive: true });
    const file = join(fileDir, spec.fileName || `image-${index}.png`);
    writeFileSync(file, spec.bytes);
    const args = [
      'capture', '--spool', spool, '--capture-id', spec.captureId || `cap-${index}`,
      '--claim', spec.claim, '--role', spec.role || 'acceptance', '--file', file,
      '--viewport', '1x1', '--theme', 'light', '--sensitivity', spec.sensitivity || 'CLEAR',
    ];
    if (spec.finding) args.push('--finding', spec.finding);
    const result = runCli(args);
    if (result.code !== 0) throw new Error(`fixture capture failed: ${result.stdout || result.stderr}`);
  });
  const terminal = runCli(['terminal', '--spool', spool, '--outcome', 'PASS', '--candidate', candidate]);
  if (terminal.code !== 0) throw new Error(`fixture terminal failed: ${terminal.stdout || terminal.stderr}`);
  return spool;
}

function publish(name, spool, policy) {
  const recorder = join(root, `${name}-recorder.jsonl`);
  const result = runCli([
    'publish', '--manifest', join(spool, 'capture-manifest.json'),
    '--limits', JSON.stringify(policy),
    '--adapter-module', fakeModule,
    '--adapter-options', JSON.stringify({ statePath: join(root, `${name}-gitlab.json`) }),
    '--recorder', recorder,
  ]);
  const requests = existsSync(recorder) ? readFileSync(recorder, 'utf8').split(/\r?\n/).filter((line) => line.includes('"type":"request"')).length : 0;
  return { ...result, requests, recorder };
}

function assertBoundary(label, exactSpecs, plusSpecs, policy) {
  const exactSpool = setup(`${label}-exact`, exactSpecs);
  const exact = publish(`${label}-exact`, exactSpool, policy);
  t.check(`${label} exactly at limit is accepted`, exact.code === 0, exact.stdout || exact.stderr);
  const plusSpool = setup(`${label}-plus`, plusSpecs);
  const plus = publish(`${label}-plus`, plusSpool, policy);
  t.check(`${label} limit+1 rejects before any GitLab HTTP`, plus.code === 65 && plus.json?.error?.code === 'BATCH_LIMIT_EXCEEDED' && plus.requests === 0, plus.stdout || plus.stderr);
  const rejectionReceiptPath = join(plusSpool, 'publish-receipt.json');
  const rejectionReceipt = existsSync(rejectionReceiptPath) ? readJson(rejectionReceiptPath) : null;
  t.check(`${label} rejection leaves a durable zero-cost blocked receipt`, rejectionReceipt?.releaseEligibility === 'BLOCKED' && rejectionReceipt?.cost?.gitlabHttpRequests === 0 && rejectionReceipt?.attempts?.[0]?.costDelta?.gitlabHttpRequests === 0);
  t.check(`${label} rejection keeps claim-complete manifest intact`, readJson(join(plusSpool, 'capture-manifest.json')).captures.length === plusSpecs.length);
}

try {
  assertBoundary('maxClaimRefs',
    [0, 1, 2].map((index) => ({ claim: `A${index}`, bytes: Buffer.from('same') })),
    [0, 1, 2, 3].map((index) => ({ claim: `A${index}`, bytes: Buffer.from('same') })),
    limits({ maxClaimRefs: 3 }));

  assertBoundary('maxUniqueImages',
    [{ claim: 'A', bytes: Buffer.from('a') }, { claim: 'B', bytes: Buffer.from('b') }],
    [{ claim: 'A', bytes: Buffer.from('a') }, { claim: 'B', bytes: Buffer.from('b') }, { claim: 'C', bytes: Buffer.from('c') }],
    limits({ maxUniqueImages: 2 }));

  assertBoundary('maxImageBytes',
    [{ claim: 'A', bytes: Buffer.alloc(8, 1) }],
    [{ claim: 'A', bytes: Buffer.alloc(9, 1) }],
    limits({ maxImageBytes: 8, maxTotalUniqueBytes: 100 }));

  assertBoundary('maxTotalUniqueBytes',
    [{ claim: 'A', bytes: Buffer.alloc(5, 1) }, { claim: 'B', bytes: Buffer.alloc(5, 2) }],
    [{ claim: 'A', bytes: Buffer.alloc(5, 1) }, { claim: 'B', bytes: Buffer.alloc(6, 2) }],
    limits({ maxImageBytes: 10, maxTotalUniqueBytes: 10 }));

  assertBoundary('maxFileNameUtf8Bytes',
    [{ claim: 'A', bytes: Buffer.from('a'), fileName: '12345.png' }],
    [{ claim: 'A', bytes: Buffer.from('a'), fileName: '123456.png' }],
    limits({ maxFileNameUtf8Bytes: 9 }));

  assertBoundary('maxClaimIdUtf8Bytes',
    [{ claim: 'ABC', bytes: Buffer.from('a') }],
    [{ claim: 'ABCD', bytes: Buffer.from('a') }],
    limits({ maxClaimIdUtf8Bytes: 3 }));

  const findingExact = setup('finding-summary-exact-real', [{ claim: 'A', bytes: Buffer.from('a'), finding: 'F1' }], { findings: [{ findingId: 'F1', claimId: 'A', summary: 'abc' }] });
  const findingPlus = setup('finding-summary-plus-real', [{ claim: 'A', bytes: Buffer.from('a'), finding: 'F1' }], { findings: [{ findingId: 'F1', claimId: 'A', summary: 'abcd' }] });
  const findingExactResult = publish('finding-summary-exact-real', findingExact, limits({ maxFindingTextUtf8Bytes: 3 }));
  const findingPlusResult = publish('finding-summary-plus-real', findingPlus, limits({ maxFindingTextUtf8Bytes: 3 }));
  t.check('finding summary exactly at UTF-8 limit is accepted', findingExactResult.code === 0);
  t.check('finding summary +1 rejects at HTTP=0', findingPlusResult.code === 65 && findingPlusResult.requests === 0);

  const noteProbeSpool = setup('note-probe', [{ claim: 'A', bytes: Buffer.from('a') }], { qaRoundId: 'qa-note-boundary' });
  const probe = publish('note-probe', noteProbeSpool, limits({ maxNoteBytes: 1 }));
  const observedNoteBound = probe.json?.error?.detail?.observed?.noteBytesUpperBound;
  t.check('note upper bound is computed from real UTF-8 content before upload', probe.code === 65 && Number.isInteger(observedNoteBound) && probe.requests === 0);
  const noteExactSpool = setup('note-exact', [{ claim: 'A', bytes: Buffer.from('a') }], { qaRoundId: 'qa-note-boundary' });
  const noteExact = publish('note-exact', noteExactSpool, limits({ maxNoteBytes: observedNoteBound }));
  const notePlusSpool = setup('note-plus', [{ claim: 'A', bytes: Buffer.from('a') }], { qaRoundId: 'qa-note-boundary' });
  const notePlus = publish('note-plus', notePlusSpool, limits({ maxNoteBytes: observedNoteBound - 1 }));
  t.check('maxNoteBytes exact upper bound passes', noteExact.code === 0, noteExact.stdout || noteExact.stderr);
  t.check('maxNoteBytes upper bound +1 fails at HTTP=0', notePlus.code === 65 && notePlus.requests === 0);

  const missingTargetSpool = setup('missing-target', [{ claim: 'A', bytes: Buffer.from('a') }]);
  const missingTargetManifest = readJson(join(missingTargetSpool, 'capture-manifest.json'));
  delete missingTargetManifest.evidenceTarget;
  delete missingTargetManifest.frozenManifestSha256;
  missingTargetManifest.frozenManifestSha256 = digestObject(missingTargetManifest);
  atomicWriteJson(join(missingTargetSpool, 'capture-manifest.json'), missingTargetManifest);
  const missingTarget = publish('missing-target', missingTargetSpool, limits());
  t.check('missing target exits 65 with GitLab HTTP=0', missingTarget.code === 65 && missingTarget.json?.error?.code === 'EVIDENCE_TARGET_REQUIRED' && missingTarget.requests === 0);

  const incompleteSpool = setup('incomplete-claim', [{ claim: 'A', bytes: Buffer.from('a') }]);
  const incompleteManifest = readJson(join(incompleteSpool, 'capture-manifest.json'));
  incompleteManifest.requiredEvidence.push({ claimId: 'MISSING', requiredVariants: ['dark@2x2'] });
  delete incompleteManifest.frozenManifestSha256;
  incompleteManifest.frozenManifestSha256 = digestObject(incompleteManifest);
  atomicWriteJson(join(incompleteSpool, 'capture-manifest.json'), incompleteManifest);
  const incomplete = publish('incomplete-claim', incompleteSpool, limits());
  t.check('claim-incomplete exits 65 with GitLab HTTP=0', incomplete.code === 65 && incomplete.json?.error?.code === 'CLAIM_SET_INCOMPLETE' && incomplete.requests === 0);

  for (const sensitivity of ['UNKNOWN', 'SUSPECTED']) {
    const spool = setup(`sensitivity-${sensitivity}`, [{ claim: 'A', bytes: Buffer.from('a'), sensitivity }]);
    const result = publish(`sensitivity-${sensitivity}`, spool, limits());
    t.check(`sensitivity ${sensitivity} blocks all remote writes`, result.code === 65 && result.json?.error?.code === 'SENSITIVE_CONTENT_NOT_CLEAR' && result.requests === 0);
  }

  const unknownPolicySpool = setup('unknown-policy', [{ claim: 'A', bytes: Buffer.from('a') }]);
  const unknownPolicy = publish('unknown-policy', unknownPolicySpool, { ...limits(), surprise: 1 });
  t.check('undeclared limit keys are rejected instead of silently extended', unknownPolicy.code === 64 && unknownPolicy.requests === 0);
} finally {
  rmSync(root, { recursive: true, force: true });
}
t.finish({ defaults: BALANCED_LIMITS });
