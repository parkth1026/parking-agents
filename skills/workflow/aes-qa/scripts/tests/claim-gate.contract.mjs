import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeAsserter, readJson, runCli, writeManifest } from './contract-test-kit.mjs';

const t = makeAsserter('claim-gate');
const root = mkdtempSync(join(tmpdir(), 'aes-screenshot-claim-gate-'));
const here = dirname(fileURLToPath(import.meta.url));
const fakeModule = join(dirname(here), 'testing', 'fake-gitlab-adapter.mjs');
const recorder = join(root, 'request-byte-recorder.jsonl');
const adapterArgs = (name) => [
  '--adapter-module', fakeModule,
  '--adapter-options', JSON.stringify({ statePath: join(root, `${name}-gitlab.json`) }),
  '--recorder', recorder,
];

function capture(spool, source, id, claim, extra = []) {
  return runCli([
    'capture', '--spool', spool, '--capture-id', id, '--claim', claim, '--role', 'acceptance',
    '--file', source, '--viewport', '1x1', '--theme', 'light', '--sensitivity', 'CLEAR', ...extra,
  ]);
}

function buildTerminal(name, outcome, { codeState = null } = {}) {
  const spool = join(root, name, 'attempt-1');
  const finalState = codeState || {
    finality: 'final', headSha: '1111111111111111111111111111111111111111',
    candidateSha: '1111111111111111111111111111111111111111', worktreeDirty: false, patchDigest: null,
  };
  writeManifest(spool, { qaRoundId: name, codeState: finalState });
  const file = join(root, `${name}.png`);
  writeFileSync(file, Buffer.from(`image-${name}`));
  capture(spool, file, `cap-${name}`, 'AC-1');
  const terminalArgs = ['terminal', '--spool', spool, '--outcome', outcome];
  if (finalState.finality === 'final') terminalArgs.push('--candidate', finalState.candidateSha);
  const terminal = runCli(terminalArgs);
  const publish = runCli(['publish', '--manifest', join(spool, 'capture-manifest.json'), ...adapterArgs(name)]);
  return { spool, terminal, publish };
}

try {
  const spool = join(root, 'qa-pass', 'attempt-1');
  writeManifest(spool, {
    qaRoundId: 'qa-pass',
    requiredEvidence: [
      { claimId: 'AC-1', requiredVariants: ['light@1x1'] },
      { claimId: 'AC-2', requiredVariants: ['light@1x1'] },
      { claimId: 'AC-3', requiredVariants: ['light@1x1'] },
    ],
  });
  const leftDir = join(root, 'left');
  const rightDir = join(root, 'right');
  mkdirSync(leftDir, { recursive: true });
  mkdirSync(rightDir, { recursive: true });
  const sameBytesA = join(leftDir, 'same-name.png');
  const sameBytesB = join(rightDir, 'duplicate-name.png');
  const differentBytesSameName = join(rightDir, 'same-name.png');
  const navigation = join(root, 'navigation.png');
  writeFileSync(sameBytesA, Buffer.from('same-sha'));
  writeFileSync(sameBytesB, Buffer.from('same-sha'));
  writeFileSync(differentBytesSameName, Buffer.from('different-sha'));
  writeFileSync(navigation, Buffer.from('navigation-only'));
  capture(spool, sameBytesA, 'cap-1', 'AC-1');
  capture(spool, sameBytesB, 'cap-2', 'AC-2');
  capture(spool, differentBytesSameName, 'cap-3', 'AC-3');
  runCli(['capture', '--spool', spool, '--capture-id', 'cap-nav', '--role', 'navigation', '--diagnostic-only', '--file', navigation, '--viewport', '1x1', '--theme', 'light', '--sensitivity', 'CLEAR']);
  const terminal = runCli(['terminal', '--spool', spool, '--outcome', 'PASS', '--candidate', '1111111111111111111111111111111111111111']);
  t.check('claim reconciliation keeps N refs while SHA dedupe produces U', terminal.code === 0 && terminal.json?.N === 3 && terminal.json?.U === 2, terminal.stderr || terminal.stdout);
  t.check('navigation capture is mechanically excluded', terminal.json?.excludedDiagnostic === 1);
  const frozen = readJson(join(spool, 'capture-manifest.json'));
  t.check('same-name different-SHA remains two unique blobs', new Set(frozen.captures.filter((entry) => entry.publishDisposition === 'REQUIRED').map((entry) => entry.sha256)).size === 2);

  const publish = runCli(['publish', '--manifest', join(spool, 'capture-manifest.json'), ...adapterArgs('pass')]);
  t.check('normal strict publish reaches VERIFIED', publish.code === 0 && publish.json?.evidenceState === 'VERIFIED' && publish.json?.releaseEligibility === 'ELIGIBLE', publish.stderr || publish.stdout);
  t.check('strict publish cost follows 2U+2 and uploads unique bytes only', publish.json?.cost?.gitlabHttpRequests === 6 && publish.json?.cost?.gitlabUploadRequests === 2);
  t.check('aggregate marker is durable and array-free', existsSync(join(spool, 'aggregate-marker.json')) && !Array.isArray(readJson(join(spool, 'aggregate-marker.json')).uploads));

  const gate = runCli(['gate', '--spool', spool, '--candidate', '1111111111111111111111111111111111111111']);
  t.check('final PASS + VERIFIED candidate is ELIGIBLE through wrapper', gate.code === 0 && gate.json?.releaseEligibility === 'ELIGIBLE' && gate.json?.screenshotEvidence?.required === true && gate.json?.screenshotEvidence?.aggregateMarker?.schema === 'aes.screenshot-evidence-marker/v1', gate.stderr || gate.stdout);
  const wrongCandidate = runCli(['gate', '--spool', spool, '--candidate', '3333333333333333333333333333333333333333']);
  t.check('candidate mismatch fails closed', wrongCandidate.code === 65 && wrongCandidate.json?.error?.code === 'SCREENSHOT_EVIDENCE_CANDIDATE_MISMATCH');

  const fail = buildTerminal('qa-fail', 'FAIL');
  t.check('FAIL evidence can be VERIFIED without becoming release PASS', fail.publish.code === 0 && fail.publish.json?.releaseEligibility === 'BLOCKED');
  const failGate = runCli(['gate', '--spool', fail.spool, '--candidate', '1111111111111111111111111111111111111111']);
  t.check('VERIFIED FAIL remains gate failure', failGate.code === 1 && failGate.json?.assertionOutcome === 'FAIL' && failGate.json?.releaseEligibility === 'BLOCKED');

  const blocked = buildTerminal('qa-blocked', 'BLOCKED');
  t.check('BLOCKED evidence can be VERIFIED without becoming release PASS', blocked.publish.code === 0 && blocked.publish.json?.releaseEligibility === 'BLOCKED');
  const blockedGate = runCli(['gate', '--spool', blocked.spool, '--candidate', '1111111111111111111111111111111111111111']);
  t.check('VERIFIED BLOCKED remains mechanically blocked', blockedGate.code === 65 && blockedGate.json?.assertionOutcome === 'BLOCKED');

  const nonFinal = buildTerminal('qa-non-final', 'PASS', {
    codeState: {
      finality: 'nonFinal', headSha: '4444444444444444444444444444444444444444', candidateSha: null,
      worktreeDirty: true, patchDigest: `sha256:${'5'.repeat(64)}`,
    },
  });
  t.check('dirty/nonFinal evidence may publish but is never eligible', nonFinal.publish.code === 0 && nonFinal.publish.json?.evidenceState === 'VERIFIED' && nonFinal.publish.json?.releaseEligibility === 'BLOCKED');
  const nonFinalGate = runCli(['gate', '--spool', nonFinal.spool]);
  t.check('dirty/nonFinal PASS is blocked at release gate', nonFinalGate.code === 65 && nonFinalGate.json?.releaseEligibility === 'BLOCKED');
} finally {
  rmSync(root, { recursive: true, force: true });
}
t.finish();
