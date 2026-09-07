#!/usr/bin/env node
// repository-gate-level 契约：AES-QG repository gate 的「同一证据合同」跨技能证明。
// 生成侧 = aes-gate 标准引擎（GateReceipt + canonical digest + release 正交裁决）；
// 消费侧 = aes-worktree-board GATE-qa level 子门（merge-policy.mjs）。
// 本 case 把两侧接在同一组 fixture 上跑：生成 → aes.qa.receipt/v3 原子引用 → 消费，
// 足够/不足/stale/legacy/none 滥用/v1-v2 兼容/L5 非发布资格逐分支 fail-closed 断言。
// 姊妹场景（Master 全流程阻断）在 aes-worktree-board selftest orchestration
// --scenario repository-gate-level；两侧断言语义必须一致。
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(dirname(HERE)); // skills/workflow/aes-qa
const WORKFLOW_DIR = dirname(SKILL_DIR); // skills/workflow
const AES_GATE_ENGINE = join(WORKFLOW_DIR, 'aes-gate', 'scripts', 'aes-qg.mjs');
const BOARD_MERGE_POLICY = join(WORKFLOW_DIR, 'aes-worktree-board', 'scripts', 'merge-policy.mjs');

const CONTRACT = 'repository-gate-level';
const RESULT_SCHEMA = 'aes.repository-gate-level-contract-result/v1';

const assertions = [];
function check(name, condition, detail = '') {
  assertions.push({ name, outcome: condition ? 'PASS' : 'FAIL', ...(condition || !detail ? {} : { detail }) });
}
function finish(extra = {}) {
  const failures = assertions.filter((entry) => entry.outcome === 'FAIL');
  const payload = {
    schema: RESULT_SCHEMA, contract: CONTRACT, case: 'generation-and-consumption',
    outcome: failures.length ? 'FAIL' : 'PASS',
    passed: assertions.length - failures.length, total: assertions.length,
    failures, ...extra,
  };
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  process.exit(failures.length ? 1 : 0);
}

// 同仓技能族相互引用是本契约的存在意义（同一证据合同）；独立安装缺同伴时如实 SKIP，
// 不把未跑说成 PASS。
if (!existsSync(AES_GATE_ENGINE) || !existsSync(BOARD_MERGE_POLICY)) {
  finish({ outcome: 'SKIPPED', passed: 0, total: 0, failures: [], skipped: [{ reason: `peer skill missing: ${[AES_GATE_ENGINE, BOARD_MERGE_POLICY].filter((p) => !existsSync(p)).join(', ')}` }] });
}

const qg = await import(pathToFileURL(AES_GATE_ENGINE).href);
const { evaluateMechanicalGate } = await import(pathToFileURL(BOARD_MERGE_POLICY).href);

const CANDIDATE = '7d9c0b4'.padEnd(40, '0');
const BASE = '211aa90'.padEnd(40, '0');

// —— 生成侧：一块真实、合法的 L3 GateReceipt（aes-gate 引擎产出）——
const aggregate = qg.aggregateLevels({
  requestedLevel: 'AES-QG-L3',
  levelOutcomes: ['L0', 'L1', 'L2', 'L3'].map((_, i) => ({ outcome: 'PASS', disposition: 'executed', runId: `run-10${i}` })),
});
const gateReceipt = qg.buildGateReceipt({
  requestedLevel: 'AES-QG-L3', aggregate,
  candidate: { commitSha: CANDIDATE, worktreeDirty: false, artifactDigest: null },
  identity: {
    candidateCommitSha: CANDIDATE, artifactDigest: 'none',
    gateDefinitionDigest: `sha256:${'b'.repeat(64)}`, policyDigest: `sha256:${'a'.repeat(64)}`,
    environmentDigest: `sha256:${'c'.repeat(64)}`,
  },
});
check('生成侧：GateReceipt 通过 aes-gate schema 校验', qg.validateGateReceipt(gateReceipt).length === 0,
  qg.validateGateReceipt(gateReceipt).join('；'));
check('生成侧：achievedLevel=L3 是最高连续 PASS', gateReceipt.achievedLevel === 'AES-QG-L3' && gateReceipt.outcome === 'PASS');
const receiptDigest = qg.canonicalReceiptDigest(gateReceipt);
check('生成侧：canonical digest 是 sha256 内容寻址', /^sha256:[0-9a-f]{64}$/.test(receiptDigest));
const tamperedReceipt = JSON.parse(JSON.stringify(gateReceipt));
tamperedReceipt.achievedLevel = 'AES-QG-L4';
check('内容寻址：篡改 receipt 内容必然改变 digest', qg.canonicalReceiptDigest(tamperedReceipt) !== receiptDigest);
check('内容寻址：篡改后的 receipt 无法通过 schema 校验（虚抬 achieved）', qg.validateGateReceipt(tamperedReceipt).length > 0);

// —— v3 QaReceipt 构造（api-mock §5 锁定字段）——
function qaV3(overrides = {}) {
  const required = overrides.requiredRepositoryGate ?? 'AES-QG-L3';
  const receipt = {
    schemaVersion: 'aes.qa.receipt/v3',
    jobId: 'job-58', attemptId: 'attempt-2', commitSha: CANDIDATE, baseCommit: BASE,
    requiredRepositoryGate: required,
    repositoryGate: required === 'none' ? null : {
      standardVersion: 'AES-QG/1',
      achievedLevel: overrides.achievedLevel ?? 'AES-QG-L3',
      gateReceiptDigest: overrides.gateReceiptDigest ?? receiptDigest,
      candidateCommitSha: overrides.gateCandidate ?? CANDIDATE,
      outcome: overrides.gateOutcome ?? 'PASS',
    },
    ...(overrides.extra ?? {}),
    checks: [{ id: 'QA-1', kind: 'automated', outcome: 'PASS', command: './run gate.l3' }],
    unexecuted: [], outcome: 'PASS',
  };
  if (overrides.trackerOnly === true) receipt.trackerOnly = true;
  if (overrides.reason) receipt.repositoryGateReason = overrides.reason;
  if (overrides.dropRequired) delete receipt.requiredRepositoryGate;
  return receipt;
}

function greenGateWith(qa, changedPaths = []) {
  return evaluateMechanicalGate({
    slotOk: true, slotReason: 'slot lease 持有本 job',
    commitFresh: true, commitReason: '',
    integrationOk: true, integrationReason: 'dev@abc',
    acceptance: [{ id: 'AC-1', outcome: 'PASS' }], acceptanceCommit: CANDIDATE,
    review: { schemaVersion: 'aes.issue-worker.stage-result/v2', commitSha: CANDIDATE, baseCommit: BASE, outcome: 'PASS', reviewerSessionId: 'rev-1' },
    qa, candidateCommit: CANDIDATE, baseCommit: BASE, integrationHead: 'abc1230',
    changedPaths,
  });
}
const gateOutcomeOf = (mechanical) => ({
  qa: mechanical.checks.find((c) => c.id === 'GATE-qa')?.outcome,
  qaBase: mechanical.checks.find((c) => c.id === 'GATE-qa-base')?.outcome,
  detail: mechanical.checks.find((c) => c.id === 'GATE-qa')?.detail ?? '',
  allGreen: mechanical.allGreen,
});

// —— 消费侧：GATE-qa level 子门逐分支 ——
// 1) 足够：required=L3 ≤ achieved=L3、digest 绑定、candidate 一致 → 全绿。
const enough = gateOutcomeOf(greenGateWith(qaV3()));
check('足够：v3 引用合法 GateReceipt → GATE-qa PASS', enough.qa === 'PASS' && enough.allGreen, enough.detail);
check('足够：base 绑定（GATE-qa-base PASS）', enough.qaBase === 'PASS');

// 2) 不足：required=L4 > achieved=L3 → fail closed。
const short = gateOutcomeOf(greenGateWith(qaV3({ requiredRepositoryGate: 'AES-QG-L4' })));
check('不足：required=L4 achieved=L3 → GATE-qa FAIL', short.qa === 'FAIL' && !short.allGreen);
check('不足：detail 点名缺级不得跨越', /required=AES-QG-L4 > achieved=AES-QG-L3/.test(short.detail), short.detail);

// 3) stale：repositoryGate 绑定旧 candidate → fail closed。
const staleGate = gateOutcomeOf(greenGateWith(qaV3({ gateCandidate: 'f'.repeat(40) })));
check('stale：repositoryGate candidate 不符 → FAIL', staleGate.qa === 'FAIL' && /旧证据\/未绑定 fail closed/.test(staleGate.detail));

// 4) digest：非 sha256 内容寻址摘要 → fail closed。
const badDigest = gateOutcomeOf(greenGateWith(qaV3({ gateReceiptDigest: 'not-a-digest' })));
check('digest：非法摘要 → FAIL', badDigest.qa === 'FAIL' && /gateReceiptDigest/.test(badDigest.detail));

// 4b) 标准版本不符 → fail closed。
const wrongStandard = gateOutcomeOf(greenGateWith(qaV3({
  requiredRepositoryGate: 'AES-QG-L3',
  extra: { repositoryGate: { standardVersion: 'SLSA/1', achievedLevel: 'AES-QG-L3', gateReceiptDigest: receiptDigest, candidateCommitSha: CANDIDATE, outcome: 'PASS' } },
})));
check('standardVersion≠AES-QG/1 → FAIL', wrongStandard.qa === 'FAIL');

// 5) legacy 三分支：
// 5a. v3 声称等级却缺 repositoryGate → fail closed（legacy 证据不能顶等级）。
const missingGate = gateOutcomeOf(greenGateWith(qaV3({
  extra: { repositoryGate: null },
})));
check('legacy：v3 required=L3 但无 repositoryGate → FAIL', missingGate.qa === 'FAIL' && /缺 repositoryGate/.test(missingGate.detail));
// 5b. v1 历史语义：正文含 "L3 passed" 也不做 repository gate 校验（冻结豁免）。
const qaV1 = {
  schemaVersion: 'aes.qa.receipt/v1', jobId: 'job-1', commitSha: CANDIDATE, outcome: 'PASS',
  checks: [{ id: 'QA-1', kind: 'automated', outcome: 'PASS', summary: 'L3 passed（历史局部排序语义）', command: 'npm test' }],
  unexecuted: [], manualDebt: [],
};
const v1Gate = gateOutcomeOf(greenGateWith(qaV1));
check('v1 兼容：历史语义冻结，无 repository gate 义务 → GATE-qa PASS', v1Gate.qa === 'PASS' && /v1\/v2 历史语义/.test(v1Gate.detail));
check('v1 兼容：v1 未承诺 baseCommit，GATE-qa-base 豁免', v1Gate.qaBase === 'PASS');
// 5c. v2 同样豁免 level 子门（repository gate 义务从 v3 才开始）。
const qaV2 = {
  schemaVersion: 'aes.qa.receipt/v2', jobId: 'job-2', commitSha: CANDIDATE, baseCommit: BASE, outcome: 'PASS',
  checks: [{ id: 'QA-1', kind: 'automated', outcome: 'PASS', command: 'node run-tests.mjs' }],
  unexecuted: [],
};
const v2Gate = gateOutcomeOf(greenGateWith(qaV2));
check('v2 兼容：豁免 level 子门、强制 baseCommit', v2Gate.qa === 'PASS' && v2Gate.qaBase === 'PASS');

// 6) none 分支：
// 6a. 滥用：candidate 改了 product bytes 却声明 none → fail closed。
const noneAbuse = gateOutcomeOf(greenGateWith(qaV3({ requiredRepositoryGate: 'none', trackerOnly: true, reason: 'tracker-only change; no product bytes changed' }), ['src/app.mjs']));
check('none 滥用：product bytes 变化 → FAIL', noneAbuse.qa === 'FAIL' && /product bytes 变化/.test(noneAbuse.detail));
// 6b. 只凭自由文本理由（缺 typed trackerOnly）→ fail closed。
const noneFreeText = gateOutcomeOf(greenGateWith(qaV3({ requiredRepositoryGate: 'none', reason: '纯跟踪项' })));
check('none 只凭自由文本理由 → FAIL', noneFreeText.qa === 'FAIL' && /trackerOnly/.test(noneFreeText.detail));
// 6c. 正当：tracker-only classification + 只改 docs → PASS。
const noneOk = gateOutcomeOf(greenGateWith(qaV3({ requiredRepositoryGate: 'none', trackerOnly: true, reason: 'tracker-only change; no product bytes changed' }), ['docs/note.md']));
check('none 正当：tracker-only + docs-only 变更 → PASS', noneOk.qa === 'PASS' && noneOk.allGreen, noneOk.detail);
// 6d. none 却携带 repositoryGate → fail closed。
const noneWithGate = gateOutcomeOf(greenGateWith(qaV3({ requiredRepositoryGate: 'none', trackerOnly: true, reason: 'x', extra: { repositoryGate: { standardVersion: 'AES-QG/1', achievedLevel: 'AES-QG-L3', gateReceiptDigest: receiptDigest, candidateCommitSha: CANDIDATE, outcome: 'PASS' } } })));
check('none 携带 repositoryGate → FAIL', noneWithGate.qa === 'FAIL');

// 7) NOT_RUN / 裸 namespace / 缺字段：
check('NOT_RUN → FAIL', gateOutcomeOf(greenGateWith(qaV3({ gateOutcome: 'NOT_RUN' }))).qa === 'FAIL');
check('裸 L3 required → FAIL（完整 namespace）', gateOutcomeOf(greenGateWith(qaV3({ requiredRepositoryGate: 'L3' }))).qa === 'FAIL');
check('v3 缺 requiredRepositoryGate → FAIL', gateOutcomeOf(greenGateWith(qaV3({ dropRequired: true }))).qa === 'FAIL');

// 8) L5 非发布资格（正交裁决，两侧一致）：
const l5Receipt = qg.buildGateReceipt({
  requestedLevel: 'AES-QG-L5',
  aggregate: qg.aggregateLevels({
    requestedLevel: 'AES-QG-L5',
    levelOutcomes: ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'].map((_, i) => ({ outcome: 'PASS', disposition: 'executed', runId: `run-20${i}` })),
  }),
  candidate: { commitSha: CANDIDATE, worktreeDirty: false, artifactDigest: null },
  identity: gateReceipt.identity,
});
const releaseProfile = {
  id: 'desktop-release', required_level: 'AES-QG-L5',
  required_quality_attributes: ['functional', 'security', 'compatibility'],
  required_evidence_modes: ['automated', 'live'], require_provenance: true,
};
const releaseVerdict = qg.evaluateReleaseQualification({
  receipt: l5Receipt, releaseProfile,
  evidence: { qualityAttributes: ['functional'], evidenceModes: ['automated'], provenance: false },
});
check('L5 PASS ≠ 发布资格：正交证据缺失 → release BLOCKED',
  l5Receipt.outcome === 'PASS' && releaseVerdict.verdict === 'BLOCKED' && releaseVerdict.qualifiesForRelease === false
  && releaseVerdict.missing.qualityAttributes.join(',') === 'security,compatibility'
  && releaseVerdict.missing.evidenceModes.join(',') === 'live');
check('GateReceipt 默认 qualifiesForRelease=false（等级不吞并发布策略）', l5Receipt.qualifiesForRelease === false);
const l5Gate = gateOutcomeOf(greenGateWith(qaV3({
  requiredRepositoryGate: 'AES-QG-L5', achievedLevel: 'AES-QG-L5', gateReceiptDigest: qg.canonicalReceiptDigest(l5Receipt),
})));
check('L5 等级证据本身可过 GATE-qa（发布资格另行裁决，不反向阻断）', l5Gate.qa === 'PASS' && l5Gate.allGreen, l5Gate.detail);

finish();
