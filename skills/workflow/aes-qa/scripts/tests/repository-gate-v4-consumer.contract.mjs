#!/usr/bin/env node
// AC-006 契约：消费侧 GATE-qa 显式认 v4——merge-policy 对 v4 走全套校验（三态、
// not-onboarded 与 gate-policy.toml 存在性对账、gate-shortfall 拒合并、消费侧复算三义务、
// companionShots 完整性、缺字段 fail closed）；版本判别=已知版本白名单、未知版本拒收；
// v1/v2/v3 豁免回归不变。
import {
  makeAsserter, makeGreenGate, peersMissing, qaV4, companionShotsBlock, buildEngineReceipt, loadPeers, gateOutcomeOf,
} from './v4-fixture.mjs';

const CONTRACT = 'repository-gate-level';
const CASE = 'v4-consumer-gate-verdict';
const RESULT_SCHEMA = 'aes.repository-gate-level-contract-result/v1';
const assert = makeAsserter({ contract: CONTRACT, contractCase: CASE, resultSchema: RESULT_SCHEMA });

if (peersMissing().length) {
  assert.skipped(`peer skill missing: ${peersMissing().join(', ')}`);
}
const { qg, evaluateMechanicalGate } = await loadPeers();
const greenGateWith = makeGreenGate(evaluateMechanicalGate);

const engineReceipt = buildEngineReceipt(qg);
const receiptDigest = qg.canonicalReceiptDigest(engineReceipt);
const CLEAR_SCAN = { result: 'CLEAR', scope: ['filename', 'metadata', 'extractable-text'], ocr: false };

// —— 版本白名单反转：未知版本 fail closed（不再「非 v3 即 legacy」）——
const v9 = gateOutcomeOf(greenGateWith({ ...qaV4({ receiptDigest }), schemaVersion: 'aes.qa.receipt/v9' }));
assert.check('未知版本 v9 → fail closed 拒收（白名单反转）', v9.qa === 'FAIL' && /不在已知版本白名单/.test(v9.detail), v9.detail);

const noSchema = gateOutcomeOf(greenGateWith({ jobId: 'job-x', commitSha: '7d9c0b4'.padEnd(40, '0'), outcome: 'PASS', checks: [{ id: 'QA-1', kind: 'automated', outcome: 'PASS' }], unexecuted: [] }));
assert.check('缺 schemaVersion → fail closed 拒收', noSchema.qa === 'FAIL' && /不在已知版本白名单/.test(noSchema.detail), noSchema.detail);

// —— v4 截图义务轮全套：companionShots 完整性 ——
const withShots = qaV4({
  receiptDigest,
  screenshotEvidence: {
    required: true,
    aggregateMarker: {
      schema: 'aes.screenshot-evidence-marker/v1',
      batchId: `sha256:${'9'.repeat(64)}`,
      qaRoundId: 'qa-round-1', attemptId: 'att-3', status: 'VERIFIED', assertionOutcome: 'PASS',
      candidateSha: '7d9c0b4'.padEnd(40, '0'),
      frozenManifestSha256: '0'.repeat(64),
      claimRefsN: 2, uniqueSha256U: 2, verifiedU: 2, totalUniqueBytes: 2048, noteId: 147900,
      receiptSha256: '1'.repeat(64),
    },
    companionShots: companionShotsBlock(2),
  },
});
const shotsOk = gateOutcomeOf(greenGateWith(withShots));
assert.check('v4 截图义务轮：marker VERIFIED + companionShots 完整 → GATE-qa PASS', shotsOk.qa === 'PASS' && shotsOk.allGreen, shotsOk.detail);
assert.check('companionShots 完整性并入 GATE-qa detail', /companionShots 完整/.test(shotsOk.detail), shotsOk.detail);

const noCompanion = gateOutcomeOf(greenGateWith({ ...withShots, screenshotEvidence: { required: true, aggregateMarker: withShots.screenshotEvidence.aggregateMarker } }));
assert.check('required=true 缺 companionShots → fail closed', noCompanion.qa === 'FAIL' && /缺 companionShots/.test(noCompanion.detail), noCompanion.detail);

const badManifestSha = gateOutcomeOf(greenGateWith({ ...withShots, screenshotEvidence: { ...withShots.screenshotEvidence, companionShots: { ...companionShotsBlock(2), manifestSha256: 'deadbeef' } } }));
assert.check('companionShots.manifestSha256 非 sha256 → fail closed', badManifestSha.qa === 'FAIL');

const badCount = gateOutcomeOf(greenGateWith({ ...withShots, screenshotEvidence: { ...withShots.screenshotEvidence, companionShots: { ...companionShotsBlock(2), count: 0 } } }));
assert.check('companionShots.count=0 → fail closed', badCount.qa === 'FAIL' && /count/.test(badCount.detail));

const stringScan = gateOutcomeOf(greenGateWith({ ...withShots, screenshotEvidence: { ...withShots.screenshotEvidence, companionShots: { ...companionShotsBlock(2), secretsScan: 'CLEAR' } } }));
assert.check('secretsScan 二值字符串（v1 草案形态）→ fail closed（必须是对象化）', stringScan.qa === 'FAIL' && /secretsScan 必须是对象/.test(stringScan.detail), stringScan.detail);

const blockedScan = gateOutcomeOf(greenGateWith({ ...withShots, screenshotEvidence: { ...withShots.screenshotEvidence, companionShots: { ...companionShotsBlock(2), secretsScan: { result: 'BLOCKED', scope: CLEAR_SCAN.scope, ocr: false } } } }));
assert.check('secretsScan=BLOCKED → fail closed（截图不得入库）', blockedScan.qa === 'FAIL' && /BLOCKED/.test(blockedScan.detail));

const ocrTrue = gateOutcomeOf(greenGateWith({ ...withShots, screenshotEvidence: { ...withShots.screenshotEvidence, companionShots: { ...companionShotsBlock(2), secretsScan: { result: 'CLEAR', scope: CLEAR_SCAN.scope, ocr: true } } } }));
assert.check('secretsScan.ocr=true → fail closed（零依赖约束下不做 OCR，盲区显式声明）', ocrTrue.qa === 'FAIL');

// —— 消费侧复算三义务 ②：requiredLevel 与 gate-policy 对账 ——
const overSupported = gateOutcomeOf(greenGateWith(qaV4({ receiptDigest, repositoryGate: { requiredLevel: 'AES-QG-L4', achievedLevel: 'AES-QG-L4', gateReceiptDigest: `sha256:${'e'.repeat(64)}`, outcome: 'PASS' } }), { gatePolicy: { present: true, supportedThrough: 'AES-QG-L2' } }));
assert.check('复算②policy 对账：requiredLevel 超出仓 supported_through → fail closed', overSupported.qa === 'FAIL' && /supported_through/.test(overSupported.detail), overSupported.detail);

const withinSupported = gateOutcomeOf(greenGateWith(qaV4({ receiptDigest }), { gatePolicy: { present: true, supportedThrough: 'AES-QG-L3' } }));
assert.check('policy 对账通过：required ≤ supported_through → PASS', withinSupported.qa === 'PASS' && withinSupported.allGreen, withinSupported.detail);

// —— not-onboarded 对账（无条件防伪，AC-001 交叉锚定）——
const forged = gateOutcomeOf(greenGateWith(qaV4({ repositoryGate: { status: 'not-onboarded' } }), { gatePolicy: { present: true, supportedThrough: null } }));
assert.check('not-onboarded 防伪对账：仓有 policy → fail closed 拒收', forged.qa === 'FAIL' && /对账矛盾/.test(forged.detail));

// —— gate-shortfall 拒合并（AC-002 交叉锚定，本 case 锁消费侧裁决位）——
const shortfall = gateOutcomeOf(greenGateWith(qaV4({
  repositoryGate: { requiredLevel: 'AES-QG-L3', achievedLevel: 'AES-QG-L1', gateReceiptDigest: `sha256:${'f'.repeat(64)}`, outcome: 'FAILED' },
  outcome: 'FAIL', failureClass: 'gate-shortfall',
})));
assert.check('gate-shortfall → GATE-qa FAIL 拒合并', shortfall.qa === 'FAIL' && /gate-shortfall/.test(shortfall.detail), shortfall.detail);

// —— v3 豁免回归（改 v4 分支不许动 v3 一行语义）——
const v3 = gateOutcomeOf(greenGateWith({
  schemaVersion: 'aes.qa.receipt/v3', jobId: 'job-58', attemptId: 'attempt-2', commitSha: '7d9c0b4'.padEnd(40, '0'), baseCommit: '211aa90'.padEnd(40, '0'),
  requiredRepositoryGate: 'AES-QG-L3',
  repositoryGate: { standardVersion: 'AES-QG/1', achievedLevel: 'AES-QG-L3', gateReceiptDigest: receiptDigest, candidateCommitSha: '7d9c0b4'.padEnd(40, '0'), outcome: 'PASS' },
  checks: [{ id: 'QA-1', kind: 'automated', outcome: 'PASS', command: './run gate.l3' }],
  unexecuted: [], outcome: 'PASS',
}));
assert.check('v3 豁免回归：v3 全绿原样（与 v4 分支互不干扰）', v3.qa === 'PASS' && v3.allGreen, v3.detail);

assert.finish();
