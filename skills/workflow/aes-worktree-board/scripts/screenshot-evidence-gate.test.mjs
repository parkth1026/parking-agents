import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateMechanicalGate } from './merge-policy.mjs';

const CANDIDATE = 'a'.repeat(40);
const BASE = 'b'.repeat(40);

function passingGateInput(qa) {
  return {
    slotOk: true,
    commitFresh: true,
    integrationOk: true,
    acceptance: [{ id: 'AC-1', outcome: 'PASS' }],
    acceptanceCommit: CANDIDATE,
    review: {
      schemaVersion: 'aes.stage-result/v2',
      outcome: 'PASS',
      commitSha: CANDIDATE,
      baseCommit: BASE,
    },
    qa,
    candidateCommit: CANDIDATE,
    baseCommit: BASE,
  };
}

function passingQa(overrides = {}) {
  return {
    schemaVersion: 'aes.qa.receipt/v2',
    outcome: 'PASS',
    commitSha: CANDIDATE,
    baseCommit: BASE,
    checks: [{ id: 'QA-1', kind: 'automated', outcome: 'PASS' }],
    unexecuted: [],
    ...overrides,
  };
}

function verifiedMarker(overrides = {}) {
  return {
    schema: 'aes.screenshot-evidence-marker/v1',
    batchId: `sha256:${'1'.repeat(64)}`,
    qaRoundId: 'qa-round-1',
    attemptId: 'attempt-1',
    status: 'VERIFIED',
    assertionOutcome: 'PASS',
    candidateSha: CANDIDATE,
    frozenManifestSha256: '2'.repeat(64),
    claimRefsN: 2,
    uniqueSha256U: 2,
    verifiedU: 2,
    totalUniqueBytes: 1024,
    noteId: 28,
    receiptSha256: '3'.repeat(64),
    ...overrides,
  };
}

test('declared screenshot evidence obligation fails closed when aggregate marker is missing', () => {
  const mechanical = evaluateMechanicalGate(passingGateInput(passingQa({
    screenshotEvidence: { required: true },
  })));

  const qaGate = mechanical.checks.find((check) => check.id === 'GATE-qa');
  assert.equal(qaGate?.outcome, 'FAIL');
  assert.equal(mechanical.allGreen, false);
});

test('screenshot evidence marker that is not VERIFIED cannot pass the merge gate', () => {
  const mechanical = evaluateMechanicalGate(passingGateInput(passingQa({
    screenshotEvidence: {
      required: true,
      aggregateMarker: verifiedMarker({ status: 'NOTE_POSTED' }),
    },
  })));

  const qaGate = mechanical.checks.find((check) => check.id === 'GATE-qa');
  assert.equal(qaGate?.outcome, 'FAIL');
  assert.equal(mechanical.allGreen, false);
});

test('VERIFIED screenshot evidence with a non-PASS assertion remains blocked', () => {
  for (const assertionOutcome of ['FAIL', 'BLOCKED']) {
    const mechanical = evaluateMechanicalGate(passingGateInput(passingQa({
      screenshotEvidence: {
        required: true,
        aggregateMarker: verifiedMarker({ assertionOutcome }),
      },
    })));
    const qaGate = mechanical.checks.find((check) => check.id === 'GATE-qa');
    assert.equal(qaGate?.outcome, 'FAIL', `assertion=${assertionOutcome} 不得放行`);
  }
});

test('screenshot evidence marker must bind the current candidate commit', () => {
  const mechanical = evaluateMechanicalGate(passingGateInput(passingQa({
    screenshotEvidence: {
      required: true,
      aggregateMarker: verifiedMarker({ candidateSha: 'c'.repeat(40) }),
    },
  })));

  const qaGate = mechanical.checks.find((check) => check.id === 'GATE-qa');
  assert.equal(qaGate?.outcome, 'FAIL');
  assert.match(qaGate.detail, /candidate/i);
});

test('legacy QA receipts keep the existing eight mechanical gate ids and order', () => {
  const mechanical = evaluateMechanicalGate(passingGateInput(passingQa()));
  assert.deepEqual(mechanical.checks.map((check) => check.id), [
    'GATE-slot',
    'GATE-commit',
    'GATE-integration',
    'GATE-acceptance',
    'GATE-review',
    'GATE-review-base',
    'GATE-qa',
    'GATE-qa-base',
  ]);
  assert.equal(mechanical.allGreen, true);
});

test('new QA receipt with screenshotEvidence.required=false keeps legacy gate behavior', () => {
  const mechanical = evaluateMechanicalGate(passingGateInput(passingQa({
    screenshotEvidence: { required: false },
  })));
  assert.equal(mechanical.allGreen, true);
  assert.equal(mechanical.checks.find((check) => check.id === 'GATE-qa')?.outcome, 'PASS');
});

test('malformed or claim-incomplete screenshot markers fail closed in GATE-qa', () => {
  const invalidMarkers = [
    ['schema', verifiedMarker({ schema: 'aes.screenshot-evidence-marker/v0' })],
    ['batch digest', verifiedMarker({ batchId: 'batch-1' })],
    ['round identity', verifiedMarker({ qaRoundId: '' })],
    ['attempt identity', verifiedMarker({ attemptId: '' })],
    ['manifest digest', verifiedMarker({ frozenManifestSha256: 'short' })],
    ['receipt digest', verifiedMarker({ receiptSha256: 'short' })],
    ['empty unique set', verifiedMarker({ claimRefsN: 0, uniqueSha256U: 0, verifiedU: 0 })],
    ['more unique blobs than claim refs', verifiedMarker({ claimRefsN: 1, uniqueSha256U: 2, verifiedU: 2 })],
    ['unverified unique blob', verifiedMarker({ verifiedU: 1 })],
    ['invalid byte total', verifiedMarker({ totalUniqueBytes: 0 })],
    ['missing note', verifiedMarker({ noteId: 0 })],
  ];

  for (const [label, aggregateMarker] of invalidMarkers) {
    const mechanical = evaluateMechanicalGate(passingGateInput(passingQa({
      screenshotEvidence: { required: true, aggregateMarker },
    })));
    const qaGate = mechanical.checks.find((check) => check.id === 'GATE-qa');
    assert.equal(qaGate?.outcome, 'FAIL', `${label} 必须 fail closed`);
  }
});

test('screenshot check kind triggers the obligation even when the wrapper is omitted', () => {
  for (const kind of ['screenshot', 'live-screenshot']) {
    const mechanical = evaluateMechanicalGate(passingGateInput(passingQa({
      checks: [{ id: `QA-${kind}`, kind, outcome: 'PASS' }],
    })));
    const qaGate = mechanical.checks.find((check) => check.id === 'GATE-qa');
    assert.equal(qaGate?.outcome, 'FAIL', `${kind} 不得靠漏填 screenshotEvidence 逃门`);
    assert.match(qaGate.detail, /aggregate marker 缺失/);
  }
});

test('valid screenshot evidence passes through GATE-qa without changing the top-level gate shape', () => {
  const mechanical = evaluateMechanicalGate(passingGateInput(passingQa({
    checks: [{ id: 'QA-screenshot', kind: 'screenshot', outcome: 'PASS' }],
    screenshotEvidence: { required: true, aggregateMarker: verifiedMarker() },
  })));

  assert.equal(mechanical.allGreen, true);
  assert.equal(mechanical.checks.length, 8);
  assert.equal(mechanical.checks.find((check) => check.id === 'GATE-qa')?.outcome, 'PASS');
  assert.equal(mechanical.checks.some((check) => check.id === 'GATE-screenshot-evidence'), false);
});
