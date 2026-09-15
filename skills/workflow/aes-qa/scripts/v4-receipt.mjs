// aes.qa.receipt/v4：等级三态 + agent-live 托底 + 伴随截图保留 的 schema 与生成侧工具。
// 事实源：.aes-workflow/grilling/2026-09-12-aes-qa-sqa-three-pillars/2-prototype/api-mock.md
// （含 v2 修订节——冲突处以修订节为准）。本文件是生成侧校验/降档工具；
// 消费侧（aes-worktree-board merge-policy）独立复算，不 import 本文件。
export const QA_RECEIPT_V4 = 'aes.qa.receipt/v4';
export const REPOSITORY_GATE_STATUSES = Object.freeze(['referenced', 'not-onboarded']);
export const BACKING_LAYERS = Object.freeze(['dom-assertion', 'server-trace', 'read-model', 'sidecar-session']);
export const CHECK_KINDS = Object.freeze(['automated', 'live', 'agent-live', 'manual', 'screenshot', 'live-screenshot']);
export const FAILURE_CLASSES_V4 = Object.freeze(['must-fix', 'retryable', 'environment', 'gate-shortfall']);
export const GATE_OUTCOMES_V4 = Object.freeze(['PASS', 'FAILED']);
export const CHECK_OUTCOMES = Object.freeze(['PASS', 'FAIL', 'AWAITING_HUMAN']);
export const SHA256_DIGEST_RE = /^sha256:[0-9a-f]{64}$/i;
const FULL_LEVEL_RE = /^AES-QG-L[0-5]$/;
const SHA40_RE = /^[0-9a-f]{40}$/i;

export function isFullLevel(value) {
  return FULL_LEVEL_RE.test(String(value ?? ''));
}

export function levelIndex(value) {
  return isFullLevel(value) ? Number(String(value).slice(-1)) : -1;
}

// 进 receipt 的 agent-live 断言必须有四层托底之一 + 内容寻址 digest；
// 无 digest 视同无托底（round 4 决策 4A：仅对进 receipt 的断言强制，循环轮 finding 不要求）。
export function isBackedAssertion(assertion) {
  const backing = assertion?.backing;
  return Boolean(backing)
    && BACKING_LAYERS.includes(backing.layer)
    && typeof backing.pointer === 'string' && backing.pointer.trim().length > 0
    && typeof backing.digest === 'string' && SHA256_DIGEST_RE.test(backing.digest);
}

// 校验 v4 receipt，返回错误清单（空数组 = 合法）。错误文案即拒绝理由，面向 QA agent。
export function validateQaReceiptV4(receipt) {
  const errors = [];
  const fail = (message) => errors.push(message);
  if (receipt?.schemaVersion !== QA_RECEIPT_V4) fail(`schemaVersion 必须为 ${QA_RECEIPT_V4}`);
  if (typeof receipt?.jobId !== 'string' || !receipt.jobId.trim()) fail('jobId 必填');
  if (typeof receipt?.attemptId !== 'string' || !receipt.attemptId.trim()) fail('attemptId 必填');
  if (!SHA40_RE.test(receipt?.commitSha ?? '')) fail('commitSha 必须是 40 位 candidate SHA（v2 起义务）');
  if (!SHA40_RE.test(receipt?.baseCommit ?? '')) fail('baseCommit 必须是 40 位 base SHA（v2 起义务）');
  if (receipt?.requiredRepositoryGate !== undefined) {
    fail('v4 等级声明在 repositoryGate.requiredLevel，不得携带 v3 的顶层 requiredRepositoryGate');
  }
  if (!['PASS', 'FAIL', 'AWAITING_HUMAN'].includes(receipt?.outcome)) fail(`outcome 闭集 {PASS, FAIL, AWAITING_HUMAN}，实际：${receipt?.outcome ?? 'NOT_SET'}`);

  const rg = receipt?.repositoryGate;
  if (!rg || typeof rg !== 'object') {
    fail('repositoryGate 必填且为对象（status 闭集 {referenced, not-onboarded}），缺字段不降级');
  } else {
    if (!REPOSITORY_GATE_STATUSES.includes(rg.status)) {
      fail(`repositoryGate.status 不在闭集 {referenced, not-onboarded}，实际：${rg.status ?? 'NOT_SET'}`);
    }
    if (rg.status === 'not-onboarded') {
      if (typeof rg.reason !== 'string' || !rg.reason.trim()) fail('not-onboarded 必须携带非空 reason');
      if (typeof rg.trackerOnly !== 'boolean') fail('not-onboarded 必须携带布尔 trackerOnly（tracker-only 工作记 true，普通未接入门禁仓记 false）');
      const forbidden = ['standardVersion', 'requiredLevel', 'achievedLevel', 'gateReceiptDigest', 'candidateCommitSha', 'outcome'];
      const carried = forbidden.filter((field) => rg[field] !== undefined);
      if (carried.length) fail(`not-onboarded 不得携带 referenced 独有字段：${carried.join(', ')}`);
    }
    if (rg.status === 'referenced') {
      if (rg.standardVersion !== 'AES-QG/1') fail(`repositoryGate.standardVersion 必须为 AES-QG/1，实际：${rg.standardVersion ?? 'NOT_SET'}`);
      if (rg.requiredLevel !== undefined && rg.requiredLevel !== null && !isFullLevel(rg.requiredLevel)) {
        fail(`repositoryGate.requiredLevel 可空，但声明时必须是完整 AES-QG-L[0-5]，实际：${rg.requiredLevel}`);
      }
      if (!isFullLevel(rg.achievedLevel)) fail(`repositoryGate.achievedLevel 必须是完整 AES-QG-L[0-5]（裸 Lx 拒收），实际：${rg.achievedLevel ?? 'NOT_SET'}`);
      if (typeof rg.gateReceiptDigest !== 'string' || !SHA256_DIGEST_RE.test(rg.gateReceiptDigest)) {
        fail('repositoryGate.gateReceiptDigest 必须是 sha256:<64hex> 内容寻址摘要（引擎收据 canonical JSON，不手抄等级）');
      }
      if (rg.candidateCommitSha !== receipt.commitSha) {
        fail('repositoryGate.candidateCommitSha 必须与顶层 commitSha 精确相等（同 candidate 双绑定，旧证据不作数）');
      }
      if (!GATE_OUTCOMES_V4.includes(rg.outcome)) fail(`repositoryGate.outcome 闭集 {PASS, FAILED}，实际：${rg.outcome ?? 'NOT_SET'}`);
      const declaredRequired = rg.requiredLevel !== undefined && rg.requiredLevel !== null;
      const shortfall = declaredRequired && levelIndex(rg.achievedLevel) < levelIndex(rg.requiredLevel);
      if (shortfall) {
        if (rg.outcome !== 'FAILED') fail('未达声明门级（achieved < requiredLevel）时 repositoryGate.outcome 必须显式 FAILED');
        if (receipt.outcome !== 'FAIL' || receipt.failureClass !== 'gate-shortfall') {
          fail('未达声明门级时 receipt 必须 outcome=FAIL + failureClass=gate-shortfall（仅此场景用该枚举）');
        }
      } else {
        if (rg.outcome !== 'PASS') fail('achieved 未低于 requiredLevel（或未声明）时 repositoryGate.outcome 必须为 PASS');
        if (receipt.failureClass === 'gate-shortfall') fail('failureClass=gate-shortfall 仅允许「requiredLevel 已声明且 achieved 未达」场景');
      }
      if (rg.outcome === 'FAILED' && receipt.outcome === 'AWAITING_HUMAN') fail('repositoryGate.outcome=FAILED 是机械结论，receipt 不得停在 AWAITING_HUMAN，必须 FAIL');
    }
  }

  const checks = Array.isArray(receipt?.checks) ? receipt.checks : [];
  if (!checks.length) fail('checks[] 不得为空（至少含一条真实执行的检查）');
  checks.forEach((check, index) => {
    const where = `checks[${index}](${check?.id ?? 'NOT_SET'})`;
    if (typeof check?.id !== 'string' || !check.id.trim()) fail(`${where}: id 必填`);
    if (!CHECK_KINDS.includes(check?.kind)) fail(`${where}: kind 闭集 ${CHECK_KINDS.join('|')}（v4 新增 agent-live），实际：${check?.kind ?? 'NOT_SET'}`);
    if (!CHECK_OUTCOMES.includes(check?.outcome)) fail(`${where}: outcome 闭集 {PASS, FAIL, AWAITING_HUMAN}（未执行的进 unexecuted，不写 NOT_RUN），实际：${check?.outcome ?? 'NOT_SET'}`);
    if (check?.outcome === 'NOT_RUN') fail(`${where}: NOT_RUN 永不进 checks[]（红线：未执行项进 unexecuted[]）`);
    if (check?.kind === 'agent-live') {
      const driver = check.driver;
      if (!driver || typeof driver.model !== 'string' || !driver.model.trim()) fail(`${where}: agent-live 必须携带 driver.model（执行者可见性）`);
      if (!driver || typeof driver.capabilitySkill !== 'string' || !driver.capabilitySkill.trim()) fail(`${where}: agent-live 必须携带 driver.capabilitySkill（按能力指名组合既有技能）`);
      const assertions = Array.isArray(check.assertions) ? check.assertions : [];
      if (!assertions.length) fail(`${where}: agent-live 至少一条断言，否则整条降档 manual（不应以 agent-live 形态出现）`);
      assertions.forEach((assertion, aIndex) => {
        if (typeof assertion?.claim !== 'string' || !assertion.claim.trim()) fail(`${where}.assertions[${aIndex}]: claim 必填`);
        if (!isBackedAssertion(assertion)) {
          fail(`${where}.assertions[${aIndex}]: backing 必含 layer（四值闭集）+ pointer + digest（sha256:<64hex> 内容寻址）；无 digest 视同无托底，必须先降档 humanChecklist 再出票`);
        }
      });
    } else if (check?.driver !== undefined) {
      fail(`${where}: driver{model, capabilitySkill} 仅 agent-live 允许携带`);
    }
    if (check?.demotedFrom !== undefined || check?.demotionReason !== undefined) {
      if (check?.kind !== 'manual') fail(`${where}: demotedFrom/demotionReason 仅 manual 档降档项允许携带`);
      else if (typeof check.demotedFrom !== 'string' || typeof check.demotionReason !== 'string') fail(`${where}: demotedFrom/demotionReason 必须是非空字符串`);
    }
  });

  const checklist = Array.isArray(receipt?.humanChecklist) ? receipt.humanChecklist : [];
  checklist.forEach((item, index) => {
    if (typeof item?.id !== 'string' || !item.id.trim()) fail(`humanChecklist[${index}]: id 必填`);
    const hasWhat = typeof item.what === 'string' && item.what.trim();
    if (!hasWhat) fail(`humanChecklist[${index}]: what 必填（不了解上下文的人也要能执行）`);
    if (item.outcome !== 'AWAITING_HUMAN') fail(`humanChecklist[${index}]: outcome 恒为 AWAITING_HUMAN（agent 不得代答）`);
  });

  const screenshot = receipt?.screenshotEvidence;
  if (!screenshot || typeof screenshot.required !== 'boolean') fail('screenshotEvidence.required 布尔必填（实际跑了截图义务才为 true）');
  if (screenshot?.required === true) {
    const marker = screenshot.aggregateMarker;
    if (!marker || marker.schema !== 'aes.screenshot-evidence-marker/v1' || marker.status !== 'VERIFIED') {
      fail('screenshotEvidence.required=true 必须携带 VERIFIED aggregateMarker（aes.screenshot-evidence-marker/v1）');
    } else if (marker.candidateSha !== receipt.commitSha) {
      fail('aggregateMarker.candidateSha 必须与顶层 commitSha 精确相等（同 candidate 双绑定）');
    }
    const companion = screenshot.companionShots;
    if (!companion || typeof companion !== 'object') {
      fail('v4 截图义务轮必须携带 companionShots（伴随目录冻结证明；跑 companion-freeze 获得）');
    } else {
      if (companion.dir !== 'shots/' || companion.manifest !== 'shots-manifest.json') {
        fail('companionShots.dir 必须为 "shots/"、manifest 必须为 "shots-manifest.json"（api-mock 锁定命名）');
      }
      if (typeof companion.manifestSha256 !== 'string' || !SHA256_DIGEST_RE.test(companion.manifestSha256)) {
        fail('companionShots.manifestSha256 必须是 sha256:<64hex>（伴随清单 canonical JSON 摘要）');
      }
      if (!Number.isInteger(companion.count) || companion.count < 1) fail(`companionShots.count 必须是 ≥1 的整数，实际：${companion.count ?? 'NOT_SET'}`);
      const scan = companion.secretsScan;
      const scanShapeOk = scan && typeof scan === 'object' && ['CLEAR', 'BLOCKED'].includes(scan.result)
        && scan.ocr === false && Array.isArray(scan.scope)
        && scan.scope.every((entry) => ['filename', 'metadata', 'extractable-text'].includes(entry));
      if (!scanShapeOk) fail('companionShots.secretsScan 必须是对象 {result: CLEAR|BLOCKED, scope:[filename,metadata,extractable-text], ocr:false}');
      if (scan?.result === 'BLOCKED' && receipt.outcome !== 'FAIL') {
        fail('secretsScan=BLOCKED（截图含疑似凭据）时 receipt 必须 outcome=FAIL，截图不得入库');
      }
    }
  } else if (screenshot?.companionShots !== undefined || screenshot?.aggregateMarker !== undefined) {
    fail('screenshotEvidence.required=false 不得携带 companionShots/aggregateMarker');
  }

  if (receipt?.outcome === 'PASS' && receipt?.failureClass != null) fail('outcome=PASS 时 failureClass 必须为 null');
  if (receipt?.outcome === 'FAIL') {
    if (!FAILURE_CLASSES_V4.includes(receipt.failureClass)) {
      fail(`outcome=FAIL 必须携带 failureClass（闭集 ${FAILURE_CLASSES_V4.join('|')}），实际：${receipt.failureClass ?? 'NOT_SET'}`);
    }
  }
  return errors;
}

// 降档：把无托底的 agent-live 断言整条移出 agent-live，降为 manual AWAITING_HUMAN
// （带 demotedFrom/demotionReason）并同步进 humanChecklist——agent 不得代答人工验收。
// 返回 { receipt: 新对象, demotions: [...] }；原对象不被修改。
export function demoteUnbackedAssertions(input) {
  const receipt = structuredClone(input);
  const demotions = [];
  const checklist = [...(receipt.humanChecklist || [])];
  const checks = [];
  let hcSeq = checklist.length;
  for (const check of receipt.checks || []) {
    if (check?.kind !== 'agent-live') {
      checks.push(check);
      continue;
    }
    const assertions = Array.isArray(check.assertions) ? check.assertions : [];
    const backed = [];
    for (const assertion of assertions) {
      if (isBackedAssertion(assertion)) {
        backed.push(assertion);
        continue;
      }
      const reason = assertion?.backing && (assertion.backing.layer !== undefined || assertion.backing.pointer !== undefined)
        ? '断言无四层托底证据或 digest 缺失（内容寻址失败）'
        : '断言无四层托底证据';
      hcSeq += 1;
      const hcId = `hc-${String(hcSeq).padStart(2, '0')}`;
      checks.push({
        id: `${check.id}-${hcId}`,
        kind: 'manual',
        outcome: 'AWAITING_HUMAN',
        summary: assertion?.claim ?? `（无 claim 的 agent-live 断言）`,
        demotedFrom: 'agent-live',
        demotionReason: reason,
        ...(check.driver ? { originalDriver: check.driver } : {}),
      });
      checklist.push({
        id: hcId,
        what: `人工复核降档断言：${assertion?.claim ?? '（原断言缺失 claim）'}`,
        expect: '人工确认该断言真实成立；agent 不得代答',
        outcome: 'AWAITING_HUMAN',
      });
      demotions.push({ checkId: check.id, hcId, claim: assertion?.claim ?? null, reason });
    }
    if (backed.length) checks.push({ ...check, assertions: backed });
  }
  receipt.checks = checks;
  receipt.humanChecklist = checklist;
  return { receipt, demotions };
}
