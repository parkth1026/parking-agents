#!/usr/bin/env node
// AC-002 契约：未达声明门级显式失败——requiredLevel 非空且 achieved 未达时
// receipt outcome=FAIL + failureClass=gate-shortfall（新枚举，仅此场景）；
// 消费侧机械复算比较（不信任 receipt 自称）并拒合并；未声明 requiredLevel 时无此失败语义。
import {
  makeAsserter, makeGreenGate, peersMissing, qaV4, buildEngineReceipt, loadPeers, gateOutcomeOf,
} from './v4-fixture.mjs';

const CONTRACT = 'repository-gate-level';
const CASE = 'v4-gate-shortfall';
const RESULT_SCHEMA = 'aes.repository-gate-level-contract-result/v1';
const assert = makeAsserter({ contract: CONTRACT, contractCase: CASE, resultSchema: RESULT_SCHEMA });

if (peersMissing().length) {
  assert.skipped(`peer skill missing: ${peersMissing().join(', ')}`);
}
const { qg, evaluateMechanicalGate } = await loadPeers();
const greenGateWith = makeGreenGate(evaluateMechanicalGate);

// 真实缺口收据：requested L3，L2 断言失败 → achieved 停在 L1（引擎聚合语义，不手编）。
const shortfallAggregate = qg.aggregateLevels({
  requestedLevel: 'AES-QG-L3',
  levelOutcomes: [
    { outcome: 'PASS', disposition: 'executed', runId: 'run-s-0' },
    { outcome: 'PASS', disposition: 'executed', runId: 'run-s-1' },
    { outcome: 'FAILED', disposition: 'executed', runId: 'run-s-2' },
  ],
});
const shortfallGate = qg.buildGateReceipt({
  requestedLevel: 'AES-QG-L3', aggregate: shortfallAggregate,
  candidate: { commitSha: '7d9c0b4'.padEnd(40, '0'), worktreeDirty: false, artifactDigest: null },
  identity: {
    candidateCommitSha: '7d9c0b4'.padEnd(40, '0'), artifactDigest: 'none',
    gateDefinitionDigest: `sha256:${'b'.repeat(64)}`, policyDigest: `sha256:${'a'.repeat(64)}`,
    environmentDigest: `sha256:${'c'.repeat(64)}`,
  },
});
const shortfallDigest = qg.canonicalReceiptDigest(shortfallGate);

// 1) 诚实 shortfall：receipt 如实 FAIL + gate-shortfall，GATE-qa 拒合并且理由可读。
const honest = gateOutcomeOf(greenGateWith(qaV4({
  receiptDigest: shortfallDigest,
  repositoryGate: { requiredLevel: 'AES-QG-L3', achievedLevel: 'AES-QG-L1', gateReceiptDigest: shortfallDigest, outcome: 'FAILED' },
  outcome: 'FAIL', failureClass: 'gate-shortfall',
})));
assert.check('诚实 shortfall：GATE-qa FAIL（拒合并）', honest.qa === 'FAIL' && !honest.allGreen);
assert.check('诚实 shortfall：detail 点名 gate-shortfall 与缺级', /gate-shortfall/.test(honest.detail) && /required=AES-QG-L3 > achieved=AES-QG-L1/.test(honest.detail), honest.detail);

// 2) 撒谎 shortfall：gate=FAILED 但 receipt outcome=PASS → 矛盾拒收（不信任自称）。
const lyingOutcome = gateOutcomeOf(greenGateWith(qaV4({
  receiptDigest: shortfallDigest,
  repositoryGate: { requiredLevel: 'AES-QG-L3', achievedLevel: 'AES-QG-L1', gateReceiptDigest: shortfallDigest, outcome: 'FAILED' },
  outcome: 'PASS', failureClass: null,
})));
assert.check('复算不信任自称：缺级而 receipt outcome=PASS → 矛盾拒收', lyingOutcome.qa === 'FAIL' && /矛盾拒收/.test(lyingOutcome.detail), lyingOutcome.detail);

// 3) 枚举滥用：无缺级（achieved≥required、gate PASS）却写 gate-shortfall → 拒收。
const classAbuse = gateOutcomeOf(greenGateWith(qaV4({
  repositoryGate: { requiredLevel: 'AES-QG-L3', achievedLevel: 'AES-QG-L3', gateReceiptDigest: `sha256:${'d'.repeat(64)}`, outcome: 'PASS' },
  outcome: 'FAIL', failureClass: 'gate-shortfall',
})));
assert.check('枚举仅此场景：无缺级却 failureClass=gate-shortfall → 拒收', classAbuse.qa === 'FAIL' && /不得为 gate-shortfall/.test(classAbuse.detail), classAbuse.detail);

// 4) failureClass 误用：缺级却写 must-fix（门级不够 ≠ 功能缺陷，路由不能混类）。
const mixedClass = gateOutcomeOf(greenGateWith(qaV4({
  receiptDigest: shortfallDigest,
  repositoryGate: { requiredLevel: 'AES-QG-L3', achievedLevel: 'AES-QG-L1', gateReceiptDigest: shortfallDigest, outcome: 'FAILED' },
  outcome: 'FAIL', failureClass: 'must-fix',
})));
assert.check('缺级混类 must-fix → 矛盾拒收（打回路由错即白烧返工）', mixedClass.qa === 'FAIL' && /gate-shortfall/.test(mixedClass.detail), mixedClass.detail);

// 5) 缺级但 gate outcome 写 PASS → 复算识破（声明即比较义务）。
const gateLiesPass = gateOutcomeOf(greenGateWith(qaV4({
  receiptDigest: shortfallDigest,
  repositoryGate: { requiredLevel: 'AES-QG-L3', achievedLevel: 'AES-QG-L1', gateReceiptDigest: shortfallDigest, outcome: 'PASS' },
  outcome: 'PASS', failureClass: null,
})));
assert.check('复算①声明即比较：缺级而 gate outcome=PASS → 拒收', gateLiesPass.qa === 'FAIL' && /required=AES-QG-L3 > achieved=AES-QG-L1/.test(gateLiesPass.detail), gateLiesPass.detail);

// 6) 未声明 requiredLevel：achieved 即结论，无「未达」失败语义（Q2 裁决）。
const noRequired = gateOutcomeOf(greenGateWith(qaV4({
  repositoryGate: { achievedLevel: 'AES-QG-L1', gateReceiptDigest: `sha256:${'d'.repeat(64)}`, outcome: 'PASS' },
  outcome: 'PASS', failureClass: null,
})));
assert.check('未声明 requiredLevel：achieved=L1 即结论 → GATE-qa PASS（无 shortfall 语义）', noRequired.qa === 'PASS' && noRequired.allGreen, noRequired.detail);

// 7) 无缺级而 gate outcome=FAILED → 三裁决位矛盾拒收。
const inconsistent = gateOutcomeOf(greenGateWith(qaV4({
  repositoryGate: { requiredLevel: 'AES-QG-L3', achievedLevel: 'AES-QG-L3', gateReceiptDigest: `sha256:${'d'.repeat(64)}`, outcome: 'FAILED' },
  outcome: 'FAIL', failureClass: 'gate-shortfall',
})));
assert.check('复算③：achieved≥required 而 gate=FAILED → 矛盾拒收', inconsistent.qa === 'FAIL' && /复算矛盾/.test(inconsistent.detail), inconsistent.detail);

assert.finish();
