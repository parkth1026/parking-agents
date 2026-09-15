#!/usr/bin/env node
// AC-003 契约：agent-live evidence kind——driver{model, capabilitySkill} 必填且仅
// agent-live 允许；进 receipt 的断言 backing 必含 layer（四值闭集）+ pointer + digest
// （被指工件内容寻址）；无 digest 视同无托底降档 humanChecklist（AWAITING_HUMAN +
// demotedFrom/demotionReason），agent 不得代答；契约 case 抽样核验 digest 与被指文件
// 实际内容一致；同 candidate 换驱动模型不作废 receipt 但 driver 变化在报文可见。
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { demoteUnbackedAssertions, isBackedAssertion, validateQaReceiptV4 } from '../v4-receipt.mjs';

const CONTRACT = 'aes-qa-v4-schema';
const CASE = 'agent-live-backing';
const RESULT_SCHEMA = 'aes.qa-v4-schema-contract-result/v1';

const assertions = [];
function check(name, condition, detail = '') {
  assertions.push({ name, outcome: condition ? 'PASS' : 'FAIL', ...(condition || !detail ? {} : { detail }) });
}
function finish() {
  const failures = assertions.filter((entry) => entry.outcome === 'FAIL');
  const payload = {
    schema: RESULT_SCHEMA, contract: CONTRACT, case: CASE,
    outcome: failures.length ? 'FAIL' : 'PASS',
    passed: assertions.length - failures.length, total: assertions.length, failures,
  };
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  process.exit(failures.length ? 1 : 0);
}

const CANDIDATE = '7d9c0b4'.padEnd(40, '0');
const BASE = '211aa90'.padEnd(40, '0');
const sha256Of = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;

// 抽样核验素材：真实落盘工件 + 实算 digest（内容寻址一致性由「重算等于」证明）。
const work = mkdtempSync(join(tmpdir(), 'v4-agent-live-'));
const sidecarLog = join(work, 'sidecar-session.log');
writeFileSync(sidecarLog, 'spawn ok: model=glm-5.3 pid=4821 banner-shown=true\n', 'utf8');
const sidecarDigest = sha256Of(readFileSync(sidecarLog));

function qaV4AgentLive(overrides = {}) {
  return {
    schemaVersion: 'aes.qa.receipt/v4',
    jobId: 'job-2026-09-12-171', attemptId: 'att-3', commitSha: CANDIDATE, baseCommit: BASE,
    repositoryGate: { status: 'not-onboarded', reason: '仓库未做门禁建设', trackerOnly: false },
    checks: overrides.checks ?? [
      { id: 'regression-suite', kind: 'automated', outcome: 'PASS', command: 'node run-tests.mjs' },
      {
        id: 'agent-journey-login', kind: 'agent-live', outcome: 'PASS',
        driver: { model: 'glm-5.3', capabilitySkill: 'browser-use:control-browser' },
        assertions: [
          { claim: '名单内模型真实 spawn，CLI banner 为证', backing: { layer: 'sidecar-session', pointer: sidecarLog, digest: sidecarDigest } },
          { claim: '工作台出现会话卡片', backing: { layer: 'read-model', pointer: 'sqlite:sessions/row-88', digest: `sha256:${'a'.repeat(64)}` } },
        ],
        summary: '正例 spawn + 反例 WS patch 被拒，双向闭环',
      },
    ],
    screenshotEvidence: { required: false },
    humanChecklist: [], unexecuted: [], manualDebt: [],
    outcome: 'PASS', failureClass: null,
    ...overrides.extra,
  };
}

// 1) 合法 agent-live：driver + 四层闭集 + pointer + digest → schema 零错。
const valid = qaV4AgentLive();
check('合法 agent-live（driver + layer 四值闭集 + pointer + digest）→ 校验零错', validateQaReceiptV4(valid).length === 0, validateQaReceiptV4(valid).join('；'));

// 2) digest 内容寻址抽样核验：与被指文件实际内容一致（重算相等）。
check('digest 抽样核验：backing.digest 与被指文件实际内容一致（重算相等）', sha256Of(readFileSync(sidecarLog)) === valid.checks[1].assertions[0].backing.digest);
const tamperedArtifact = 'spawn ok: model=other pid=9999 banner-shown=false\n';
check('内容寻址：工件内容变化必然改变 digest（篡改可检测）', sha256Of(tamperedArtifact) !== sidecarDigest);

// 3) 无 digest 视同无托底：先校验报错，降档后零错且不再残留未托底断言。
const unbacked = qaV4AgentLive({
  checks: [
    { id: 'regression-suite', kind: 'automated', outcome: 'PASS', command: 'node run-tests.mjs' },
    {
      id: 'agent-visual', kind: 'agent-live', outcome: 'PASS',
      driver: { model: 'glm-5.3', capabilitySkill: 'browser-use:control-browser' },
      assertions: [
        { claim: '配色观感舒适', backing: { layer: 'dom-assertion', pointer: 'shot://settings' } },
      ],
    },
  ],
});
check('无 digest 断言：v4 校验直接报错（无托底不得进 receipt）', validateQaReceiptV4(unbacked).some((e) => /digest/.test(e)), validateQaReceiptV4(unbacked).join('；'));
const { receipt: demoted, demotions } = demoteUnbackedAssertions(unbacked);
check('降档后：schema 校验零错（未托底断言已移出 agent-live）', validateQaReceiptV4(demoted).length === 0, validateQaReceiptV4(demoted).join('；'));
const demotedCheck = demoted.checks.find((c) => c.demotedFrom === 'agent-live');
check('降档形态：manual + AWAITING_HUMAN + demotedFrom/demotionReason 标注', demotedCheck && demotedCheck.kind === 'manual' && demotedCheck.outcome === 'AWAITING_HUMAN' && demotedCheck.demotedFrom === 'agent-live' && typeof demotedCheck.demotionReason === 'string');
check('降档同步进 humanChecklist（agent 不得代答）', demoted.humanChecklist.length === 1 && demoted.humanChecklist[0].outcome === 'AWAITING_HUMAN' && demoted.humanChecklist[0].what.includes('配色观感舒适'));
check('demotions 台账：记录降档原因（digest 缺失口径）', demotions.length === 1 && /digest|托底/.test(demotions[0].reason));

// 4) layer 闭集外 / pointer 缺失 = 无托底，同样走降档。
const badLayer = { claim: 'x', backing: { layer: 'vibes', pointer: 'p', digest: `sha256:${'b'.repeat(64)}` } };
check('layer 闭集外（vibes）= 无托底', !isBackedAssertion(badLayer));
const noPointer = { claim: 'x', backing: { layer: 'dom-assertion', digest: `sha256:${'b'.repeat(64)}` } };
check('pointer 缺失 = 无托底', !isBackedAssertion(noPointer));

// 5) driver 规则：仅 agent-live 允许。
const driverOnAutomated = qaV4AgentLive({
  checks: [
    { id: 'regression-suite', kind: 'automated', outcome: 'PASS', command: 'node run-tests.mjs', driver: { model: 'glm-5.3', capabilitySkill: 'x' } },
    valid.checks[1],
  ],
});
check('driver 出现在 automated → 校验报错（仅 agent-live 允许）', validateQaReceiptV4(driverOnAutomated).some((e) => /仅 agent-live/.test(e)));

const missingDriver = qaV4AgentLive({
  checks: [
    valid.checks[0],
    { id: 'agent-x', kind: 'agent-live', outcome: 'PASS', assertions: valid.checks[1].assertions },
  ],
});
check('agent-live 缺 driver → 校验报错', validateQaReceiptV4(missingDriver).some((e) => /driver/.test(e)));

// 6) 同 candidate 换驱动模型：receipt 不作废，driver 变化在报文可见。
const reDriven = structuredClone(valid);
reDriven.checks[1].driver.model = 'claude-haiku-4-5';
const reDrivenErrors = validateQaReceiptV4(reDriven);
check('同 candidate 换驱动模型：receipt 不作废（校验零错）', reDrivenErrors.length === 0, reDrivenErrors.join('；'));
check('driver 变化在报文可见（model 字段即执行者记录）', reDriven.checks[1].driver.model === 'claude-haiku-4-5' && reDriven.checks[1].driver.capabilitySkill === 'browser-use:control-browser');

rmSync(work, { recursive: true, force: true });
finish();
