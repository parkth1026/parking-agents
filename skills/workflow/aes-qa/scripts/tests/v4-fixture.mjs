// repository-gate-level v4 契约共享 fixture：三个 v4 case（三态/shortfall/消费侧全套）
// 共用同一组构造器，保证断言对象与 generation-and-consumption 的 v3 case 同源同法。
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SKILL_DIR = dirname(dirname(HERE)); // skills/workflow/aes-qa
export const WORKFLOW_DIR = dirname(SKILL_DIR); // skills/workflow
export const AES_GATE_ENGINE = join(WORKFLOW_DIR, 'aes-gate', 'scripts', 'aes-qg.mjs');
export const BOARD_MERGE_POLICY = join(WORKFLOW_DIR, 'aes-worktree-board', 'scripts', 'merge-policy.mjs');
export const BOARD_MASTER = join(WORKFLOW_DIR, 'aes-worktree-board', 'scripts', 'master.mjs');

export function peersMissing() {
  return [AES_GATE_ENGINE, BOARD_MERGE_POLICY, BOARD_MASTER].filter((path) => !existsSync(path));
}

export async function loadPeers() {
  const qg = await import(pathToFileURL(AES_GATE_ENGINE).href);
  const { evaluateMechanicalGate } = await import(pathToFileURL(BOARD_MERGE_POLICY).href);
  const { resolveGatePolicyFacts } = await import(pathToFileURL(BOARD_MASTER).href);
  return { qg, evaluateMechanicalGate, resolveGatePolicyFacts };
}

export const CANDIDATE = '7d9c0b4'.padEnd(40, '0');
export const BASE = '211aa90'.padEnd(40, '0');

// 一块真实、合法的引擎收据（与 generation-and-consumption 同法构造），供 referenced 态引用。
export function buildEngineReceipt(qg, { requestedLevel = 'AES-QG-L3', passThrough = 3 } = {}) {
  const aggregate = qg.aggregateLevels({
    requestedLevel,
    levelOutcomes: ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'].map((_, index) => ({
      outcome: index <= passThrough ? 'PASS' : 'NOT_REACHED',
      disposition: index <= passThrough ? 'executed' : undefined,
      runId: index <= passThrough ? `run-v4-${index}` : undefined,
    })),
  });
  return qg.buildGateReceipt({
    requestedLevel, aggregate,
    candidate: { commitSha: CANDIDATE, worktreeDirty: false, artifactDigest: null },
    identity: {
      candidateCommitSha: CANDIDATE, artifactDigest: 'none',
      gateDefinitionDigest: `sha256:${'b'.repeat(64)}`, policyDigest: `sha256:${'a'.repeat(64)}`,
      environmentDigest: `sha256:${'c'.repeat(64)}`,
    },
  });
}

const CLEAR_SCAN = Object.freeze({ result: 'CLEAR', scope: ['filename', 'metadata', 'extractable-text'], ocr: false });

// v4 QaReceipt 构造器（api-mock.md 对 1/对 2/对 3 + v2 修订节锁定字段）。
// rawRepositoryGate 原样透传（病态输入构造用：缺 status/缺 trackerOnly 等负例不被默认值修复）。
export function qaV4(overrides = {}) {
  const gateOverrides = overrides.repositoryGate ?? {};
  const status = gateOverrides.status ?? 'referenced';
  const repositoryGate = overrides.rawRepositoryGate ?? (status === 'not-onboarded'
    ? {
      status,
      reason: gateOverrides.reason ?? '仓库未做门禁建设，run.toml 无已注册 gate',
      trackerOnly: gateOverrides.trackerOnly ?? false,
    }
    : {
      status,
      standardVersion: gateOverrides.standardVersion ?? 'AES-QG/1',
      ...(gateOverrides.requiredLevel !== undefined ? { requiredLevel: gateOverrides.requiredLevel } : {}),
      achievedLevel: gateOverrides.achievedLevel ?? 'AES-QG-L3',
      gateReceiptDigest: gateOverrides.gateReceiptDigest ?? overrides.receiptDigest,
      candidateCommitSha: gateOverrides.candidateCommitSha ?? CANDIDATE,
      outcome: gateOverrides.outcome ?? 'PASS',
    });
  const receipt = {
    schemaVersion: 'aes.qa.receipt/v4',
    jobId: overrides.jobId ?? 'job-2026-09-12-171',
    attemptId: overrides.attemptId ?? 'att-3',
    commitSha: overrides.commitSha ?? CANDIDATE,
    baseCommit: overrides.baseCommit ?? BASE,
    impactClasses: ['cli'],
    repositoryGate,
    checks: overrides.checks ?? [{ id: 'regression-suite', kind: 'automated', outcome: 'PASS', command: 'node run-tests.mjs' }],
    screenshotEvidence: overrides.screenshotEvidence !== undefined
      ? overrides.screenshotEvidence
      : { required: false },
    outcome: overrides.outcome ?? 'PASS',
    unexecuted: [],
    manualDebt: [],
    ...(overrides.failureClass !== undefined ? { failureClass: overrides.failureClass } : { failureClass: null }),
  };
  if (overrides.dropRepositoryGate) delete receipt.repositoryGate;
  return receipt;
}

// 截图义务轮的合法 companionShots 块（sha 由 digestObject 风格的稳定 hex 占位）。
export function companionShotsBlock(count = 2) {
  return {
    dir: 'shots/',
    manifest: 'shots-manifest.json',
    manifestSha256: `sha256:${'3'.repeat(63)}${count}`,
    count,
    secretsScan: CLEAR_SCAN,
  };
}

// 消费侧调用工厂：case 先 loadPeers 拿 evaluateMechanicalGate，再构造 greenGateWith。
export function makeGreenGate(evaluateMechanicalGate) {
  return function greenGateWith(qa, { changedPaths = [], gatePolicy = null } = {}) {
    return evaluateMechanicalGate({
      slotOk: true, slotReason: 'slot lease 持有本 job',
      commitFresh: true, commitReason: '',
      integrationOk: true, integrationReason: 'dev@abc',
      acceptance: [{ id: 'AC-1', outcome: 'PASS' }], acceptanceCommit: CANDIDATE,
      review: { schemaVersion: 'aes.issue-worker.stage-result/v2', commitSha: CANDIDATE, baseCommit: BASE, outcome: 'PASS', reviewerSessionId: 'rev-1' },
      qa, candidateCommit: CANDIDATE, baseCommit: BASE, integrationHead: 'abc1230',
      changedPaths, gatePolicy,
    });
  };
}

export function gateOutcomeOf(mechanical) {
  return {
    qa: mechanical.checks.find((c) => c.id === 'GATE-qa')?.outcome,
    qaBase: mechanical.checks.find((c) => c.id === 'GATE-qa-base')?.outcome,
    detail: mechanical.checks.find((c) => c.id === 'GATE-qa')?.detail ?? '',
    allGreen: mechanical.allGreen,
  };
}

export function makeAsserter({ contract, contractCase, resultSchema }) {
  const assertions = [];
  return {
    check(name, condition, detail = '') {
      assertions.push({ name, outcome: condition ? 'PASS' : 'FAIL', ...(condition || !detail ? {} : { detail }) });
    },
    skipped(reason) {
      const payload = {
        schema: resultSchema, contract, case: contractCase,
        outcome: 'SKIPPED', passed: 0, total: 0, failures: [],
        skipped: [{ reason }],
      };
      process.stdout.write(`${JSON.stringify(payload)}\n`);
      process.exit(0);
    },
    finish(extra = {}) {
      const failures = assertions.filter((entry) => entry.outcome === 'FAIL');
      const payload = {
        schema: resultSchema, contract, case: contractCase,
        outcome: failures.length ? 'FAIL' : 'PASS',
        passed: assertions.length - failures.length, total: assertions.length,
        failures, ...extra,
      };
      process.stdout.write(`${JSON.stringify(payload)}\n`);
      process.exit(failures.length ? 1 : 0);
    },
  };
}
