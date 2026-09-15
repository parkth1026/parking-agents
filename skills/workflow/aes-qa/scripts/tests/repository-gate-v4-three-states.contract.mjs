#!/usr/bin/env node
// AC-001 契约：v4 等级栏三态——referenced（digest 原子引用 + 同 candidate 双绑定）/
// not-onboarded（非空 reason + trackerOnly 布尔 + 消费侧对账 gate-policy.toml 存在性）/
// 缺 status、裸 Lx、闭集外值一律 fail closed；v1/v2/v3 豁免逐字节等价现状。
import {
  CANDIDATE, makeAsserter, makeGreenGate, peersMissing, qaV4, buildEngineReceipt, loadPeers, gateOutcomeOf,
} from './v4-fixture.mjs';

const CONTRACT = 'repository-gate-level';
const CASE = 'v4-gate-three-states';
const RESULT_SCHEMA = 'aes.repository-gate-level-contract-result/v1';
const assert = makeAsserter({ contract: CONTRACT, contractCase: CASE, resultSchema: RESULT_SCHEMA });

if (peersMissing().length) {
  assert.skipped(`peer skill missing: ${peersMissing().join(', ')}`);
}
const { qg, evaluateMechanicalGate } = await loadPeers();
const greenGateWith = makeGreenGate(evaluateMechanicalGate);

const engineReceipt = buildEngineReceipt(qg, { requestedLevel: 'AES-QG-L3', passThrough: 3 });
const receiptDigest = qg.canonicalReceiptDigest(engineReceipt);

// —— 态 1：referenced（已接入门禁）——
const referenced = gateOutcomeOf(greenGateWith(qaV4({ receiptDigest })));
assert.check('referenced：v4 引擎同源 digest 引用 → GATE-qa PASS', referenced.qa === 'PASS' && referenced.allGreen, referenced.detail);
assert.check('referenced：base 绑定（GATE-qa-base PASS，v4 继承 v2 义务）', referenced.qaBase === 'PASS');

const bareLevel = gateOutcomeOf(greenGateWith(qaV4({ receiptDigest, repositoryGate: { requiredLevel: 'AES-QG-L3', achievedLevel: 'L3', gateReceiptDigest: receiptDigest, outcome: 'PASS' } })));
assert.check('裸 L3：achievedLevel 非全称 AES-QG-L[0-5] → fail closed', bareLevel.qa === 'FAIL' && /必须是完整 AES-QG-L\[0-5\]/.test(bareLevel.detail), bareLevel.detail);

const bareRequired = gateOutcomeOf(greenGateWith(qaV4({ receiptDigest, repositoryGate: { requiredLevel: 'L3', achievedLevel: 'AES-QG-L3', gateReceiptDigest: receiptDigest, outcome: 'PASS' } })));
assert.check('裸 L3 required：requiredLevel 非全称 → fail closed', bareRequired.qa === 'FAIL');

const digestMalformed = gateOutcomeOf(greenGateWith(qaV4({ receiptDigest: 'not-a-digest' })));
assert.check('digest：非 sha256 内容寻址 → fail closed', digestMalformed.qa === 'FAIL' && /gateReceiptDigest/.test(digestMalformed.detail));

const staleCandidate = gateOutcomeOf(greenGateWith(qaV4({ receiptDigest, repositoryGate: { gateReceiptDigest: receiptDigest, candidateCommitSha: 'f'.repeat(40), outcome: 'PASS' } })));
assert.check('双绑定：repositoryGate 绑定旧 candidate → fail closed', staleCandidate.qa === 'FAIL' && /旧证据\/未绑定 fail closed/.test(staleCandidate.detail), staleCandidate.detail);

const wrongStandard = gateOutcomeOf(greenGateWith(qaV4({ receiptDigest, repositoryGate: { standardVersion: 'SLSA/1', gateReceiptDigest: receiptDigest, outcome: 'PASS' } })));
assert.check('standardVersion≠AES-QG/1 → fail closed', wrongStandard.qa === 'FAIL');

const notRunGate = gateOutcomeOf(greenGateWith(qaV4({ receiptDigest, repositoryGate: { gateReceiptDigest: receiptDigest, outcome: 'NOT_RUN' } })));
assert.check('gate outcome=NOT_RUN → fail closed（闭集 {PASS, FAILED}）', notRunGate.qa === 'FAIL');

const missingGate = gateOutcomeOf(greenGateWith(qaV4({ receiptDigest, dropRepositoryGate: true })));
assert.check('缺 repositoryGate → fail closed（不降级成旧 receipt 处理）', missingGate.qa === 'FAIL' && /缺 repositoryGate/.test(missingGate.detail), missingGate.detail);

const missingStatus = gateOutcomeOf(greenGateWith(qaV4({ receiptDigest, rawRepositoryGate: { standardVersion: 'AES-QG/1', achievedLevel: 'AES-QG-L3', gateReceiptDigest: receiptDigest, candidateCommitSha: CANDIDATE, outcome: 'PASS' } })));
assert.check('缺 repositoryGate.status → fail closed', missingStatus.qa === 'FAIL');

const outOfSet = gateOutcomeOf(greenGateWith(qaV4({ receiptDigest, rawRepositoryGate: { status: 'none', reason: 'x' } })));
assert.check('status 闭集外（v3 的 "none" 不是 v4 态）→ fail closed', outOfSet.qa === 'FAIL' && /不在闭集/.test(outOfSet.detail), outOfSet.detail);

// —— 态 2：not-onboarded（未接入门禁）——
const notOnboarded = gateOutcomeOf(greenGateWith(qaV4({ repositoryGate: { status: 'not-onboarded' } }), { gatePolicy: { present: false, supportedThrough: null } }));
assert.check('not-onboarded：非空 reason + trackerOnly 布尔 → 验收单有效，GATE-qa PASS', notOnboarded.qa === 'PASS' && notOnboarded.allGreen, notOnboarded.detail);
assert.check('not-onboarded：detail 呈现计量+复盘治理形态（不设硬门）', /计量\+复盘/.test(notOnboarded.detail), notOnboarded.detail);

const forged = gateOutcomeOf(greenGateWith(qaV4({ repositoryGate: { status: 'not-onboarded' } }), { gatePolicy: { present: true, supportedThrough: 'AES-QG-L3' } }));
assert.check('防伪对账：仓有 gate-policy.toml 而自称 not-onboarded → fail closed 拒收', forged.qa === 'FAIL' && /对账矛盾/.test(forged.detail), forged.detail);

const unverified = gateOutcomeOf(greenGateWith(qaV4({ repositoryGate: { status: 'not-onboarded' } }), { gatePolicy: { present: null, supportedThrough: null } }));
assert.check('防伪对账：存在性不可核实（present=null，读取失败）→ fail closed 拒收（防伪不因信息缺失静默跳过）', unverified.qa === 'FAIL' && /存在性不可核实/.test(unverified.detail), unverified.detail);

const noFacts = gateOutcomeOf(greenGateWith(qaV4({ repositoryGate: { status: 'not-onboarded' } })));
assert.check('防伪对账：对账输入未提供（gatePolicy 缺省）→ fail closed 拒收（只有核实性不存在才放行 not-onboarded）', noFacts.qa === 'FAIL' && /存在性不可核实/.test(noFacts.detail), noFacts.detail);

const noReason = gateOutcomeOf(greenGateWith(qaV4({ rawRepositoryGate: { status: 'not-onboarded', reason: '  ', trackerOnly: false } }), { gatePolicy: { present: false, supportedThrough: null } }));
assert.check('not-onboarded 缺非空 reason → fail closed', noReason.qa === 'FAIL' && /reason/.test(noReason.detail));

const noTrackerOnly = gateOutcomeOf(greenGateWith(qaV4({ rawRepositoryGate: { status: 'not-onboarded', reason: '未建设' } }), { gatePolicy: { present: false, supportedThrough: null } }));
assert.check('not-onboarded 缺 trackerOnly 布尔 → fail closed', noTrackerOnly.qa === 'FAIL' && /trackerOnly/.test(noTrackerOnly.detail));

const carriedReferenced = gateOutcomeOf(greenGateWith(qaV4({ rawRepositoryGate: { status: 'not-onboarded', reason: '未建设', trackerOnly: false, achievedLevel: 'AES-QG-L3' } }), { gatePolicy: { present: false, supportedThrough: null } }));
assert.check('not-onboarded 携带 referenced 独有字段 → fail closed', carriedReferenced.qa === 'FAIL' && /不得携带 referenced 独有字段/.test(carriedReferenced.detail), carriedReferenced.detail);

const trackerAbuse = gateOutcomeOf(greenGateWith(qaV4({ repositoryGate: { status: 'not-onboarded', reason: 'tracker-only', trackerOnly: true } }), { changedPaths: ['src/app.mjs'], gatePolicy: { present: false, supportedThrough: null } }));
assert.check('trackerOnly=true 却有 product bytes 变化 → fail closed', trackerAbuse.qa === 'FAIL' && /product bytes 变化/.test(trackerAbuse.detail), trackerAbuse.detail);

// —— 态 3 兼容回归：v1/v2/v3 豁免逐字节等价现状 ——
const v1 = gateOutcomeOf(greenGateWith({
  schemaVersion: 'aes.qa.receipt/v1', jobId: 'job-1', commitSha: CANDIDATE, outcome: 'PASS',
  checks: [{ id: 'QA-1', kind: 'automated', outcome: 'PASS', summary: 'L3 passed（历史局部排序语义）', command: 'npm test' }],
  unexecuted: [], manualDebt: [],
}));
assert.check('v1 豁免逐字节等价：detail 原文', v1.qa === 'PASS' && /为 v1\/v2 历史语义，无 repository gate 义务（豁免）/.test(v1.detail), v1.detail);

const v3 = gateOutcomeOf(greenGateWith({
  schemaVersion: 'aes.qa.receipt/v3', jobId: 'job-58', attemptId: 'attempt-2', commitSha: CANDIDATE, baseCommit: '211aa90'.padEnd(40, '0'),
  requiredRepositoryGate: 'AES-QG-L3',
  repositoryGate: { standardVersion: 'AES-QG/1', achievedLevel: 'AES-QG-L3', gateReceiptDigest: receiptDigest, candidateCommitSha: CANDIDATE, outcome: 'PASS' },
  checks: [{ id: 'QA-1', kind: 'automated', outcome: 'PASS', command: './run gate.l3' }],
  unexecuted: [], outcome: 'PASS',
}));
assert.check('v3 豁免回归：v3 原语义照旧全绿（生成侧=消费侧同一 digest）', v3.qa === 'PASS' && v3.allGreen, v3.detail);

assert.finish();
