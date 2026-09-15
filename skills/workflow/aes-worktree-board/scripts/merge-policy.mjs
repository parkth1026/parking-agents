#!/usr/bin/env node
// riskProfile → mergePolicy 四档 merge gate（契约 D-1 / AC-005）。
// 关键设计：riskProfile 由 Issue 自报，而自报环节正是不可信处，所以 Master 必须按
// 改动路径做兜底校验 —— 自报低于路径推导出的档位时，以路径为准并留下 escalation 证据。
import { storeError } from './job-store.mjs';

export const RISK_PROFILES = Object.freeze(['low', 'medium', 'high', 'critical']);
export const MERGE_POLICIES = Object.freeze(['AUTO_MERGE', 'HUMAN_GATE', 'PR_ONLY']);
export const REVIEW_DEPTH_TIERS = Object.freeze(['light', 'deep']);

const RISK_ORDER = Object.freeze(Object.fromEntries(RISK_PROFILES.map((value, index) => [value, index])));

// 四档映射（强约束）：low/medium 机械门后自动 merge；high 机械门全绿仍停 humanGate；
// critical 拒绝直接 merge、仅走 PR。
const POLICY_BY_RISK = Object.freeze({
  low: 'AUTO_MERGE',
  medium: 'AUTO_MERGE',
  high: 'HUMAN_GATE',
  critical: 'PR_ONLY',
});

const REVIEW_DEPTH_BY_RISK = Object.freeze({
  low: 'light', medium: 'light', high: 'deep', critical: 'deep',
});

export function reviewDepthForRisk(effectiveRisk) {
  assertRiskProfile(effectiveRisk);
  return REVIEW_DEPTH_BY_RISK[effectiveRisk];
}

// 触及权限、identity、数据格式迁移、安全边界、公共 API 的改动不得自报低于 high。
// 每条规则都必须能指名它兜住的是哪一类风险，否则就是无法解释的黑箱升级。
export const ESCALATION_RULES = Object.freeze([
  { id: 'ESC-identity', minimum: 'high', reason: 'GitHub identity / 账号绑定', pattern: /(^|\/)(github-identity|identity)[^/]*\.(mjs|js|ts)$/i },
  { id: 'ESC-permission', minimum: 'high', reason: '权限与授权边界', pattern: /(permission|authz|authorization|acl|scope)/i },
  { id: 'ESC-secrets', minimum: 'critical', reason: '凭据与密钥', pattern: /(secret|credential|token|password|\.env(\.|$)|private[-_]?key)/i },
  { id: 'ESC-security', minimum: 'high', reason: '安全边界', pattern: /(security|sandbox|sanitiz|escape|csp|origin-check)/i },
  { id: 'ESC-schema', minimum: 'high', reason: '数据格式与迁移', pattern: /(schema|migration|migrate|runtime-store|registry)/i },
  { id: 'ESC-public-api', minimum: 'high', reason: '公共 API 契约', pattern: /(^|\/)(api|public|server)[^/]*\.(mjs|js|ts)$/i },
  { id: 'ESC-ci', minimum: 'high', reason: 'CI 与发布管线', pattern: /(^|\/)(\.github\/workflows|build-release|release)[^/]*/i },
]);

export function assertRiskProfile(value) {
  if (!RISK_PROFILES.includes(value)) {
    throw storeError('BAD_RISK_PROFILE', `riskProfile 非闭集取值: ${value}`, { allowed: RISK_PROFILES });
  }
  return value;
}

export function maxRisk(a, b) {
  return RISK_ORDER[a] >= RISK_ORDER[b] ? a : b;
}

function declaresScreenshotEvidenceObligation(qa) {
  return qa?.screenshotEvidence?.required === true
    || (qa?.checks || []).some((check) => ['screenshot', 'live-screenshot'].includes(check?.kind));
}

// ---------------------------------------------------------------- AES-QG level 子门
// aes.qa.receipt 的 repository gate level 子门（并入既有 GATE-qa，不新增第九道顶层门）。
// 标准所有权在 aes-gate（AES-QG/1）；此处只做机械消费面：required/achieved 可比较、
// GateReceipt digest 合法、candidate 一致、缺级/旧证据/NOT_RUN 均 fail closed。
// v1/v2 历史语义永久冻结：不携带 repository gate 义务，豁免本子门（向下兼容，不是漏检）。
// 版本判别是已知版本白名单（v1/v2/v3/v4）——未知版本 fail closed 拒收，不保留
// 「非 v3 即 legacy」黑名单结构（否则 v5 出现时会像 v4 曾那样被误判 legacy 豁免）。
const AES_QG_FULL_LEVEL = /^AES-QG-L[0-5]$/;
const SHA256_DIGEST = /^sha256:[0-9a-f]{64}$/i;
const QA_RECEIPT_KNOWN_VERSIONS = Object.freeze(['v1', 'v2', 'v3', 'v4']);
const V4_REPOSITORY_GATE_STATUSES = Object.freeze(['referenced', 'not-onboarded']);
const V4_SECRETS_SCAN_SCOPE = Object.freeze(['filename', 'metadata', 'extractable-text']);

function qaReceiptVersion(qa) {
  const match = /\/(v[0-9]+)$/.exec(String(qa?.schemaVersion ?? ''));
  return match ? match[1] : null;
}

function aesQgLevelIndex(level) {
  return AES_QG_FULL_LEVEL.test(String(level || '')) ? Number(String(level).slice(-1)) : -1;
}

// tracker-only 路径白名单（默认拒绝）：只有明确不携带产品字节的跟踪面文件可豁免 repository gate。
// 任何未知形态一律视为 product bytes——「none」是例外路径，必须证明自己配得上。
const TRACKER_ONLY_PATH_RE = Object.freeze([
  /(^|\/)\.github\/(ISSUE_TEMPLATE|PULL_REQUEST_TEMPLATE)\//i,
  /^(\.aes-workflow|\.aes-gate|\.aes-worktree-board|\.agents)\//i,
  /^docs?\//i,
  /(^|\/)(CHANGELOG|README|LICENSE|CONTRIBUTING|AGENTS|CLAUDE|CONTEXT)(\.|\.md$|$)/i,
  /\.(md|markdown|rst|adoc)$/i,
]);

export function isTrackerOnlyPath(path) {
  const normalized = String(path).replaceAll('\\', '/');
  return TRACKER_ONLY_PATH_RE.some((re) => re.test(normalized));
}

export function repositoryGateLevelGate(qa, candidateCommit, changedPaths = null, gatePolicy = null) {
  const version = qaReceiptVersion(qa);
  if (!QA_RECEIPT_KNOWN_VERSIONS.includes(version)) {
    return { ok: false, detail: `schemaVersion=${qa?.schemaVersion || 'NOT_SET'} 不在已知版本白名单（v1/v2/v3/v4），fail closed 拒收` };
  }
  if (version === 'v1' || version === 'v2') {
    return { ok: true, legacy: true, detail: `schemaVersion=${qa?.schemaVersion || 'NOT_SET'} 为 v1/v2 历史语义，无 repository gate 义务（豁免）` };
  }
  if (version === 'v4') {
    return repositoryGateV4Gate(qa, candidateCommit, changedPaths, gatePolicy);
  }
  const required = qa.requiredRepositoryGate;
  if (required === undefined || required === null || required === '') {
    return { ok: false, detail: 'v3 缺 requiredRepositoryGate（AES-QG-Lx 或 "none"），fail closed' };
  }
  if (required === 'none') {
    if (qa.trackerOnly !== true) {
      return { ok: false, detail: 'requiredRepositoryGate="none" 需要 trackerOnly=true 的可信 tracker-only classification' };
    }
    if (typeof qa.repositoryGateReason !== 'string' || !qa.repositoryGateReason.trim()) {
      return { ok: false, detail: 'requiredRepositoryGate="none" 必须携带非空 repositoryGateReason（自由文本是记录，不是绕过）' };
    }
    if (qa.repositoryGate != null) {
      return { ok: false, detail: 'requiredRepositoryGate="none" 不得携带 repositoryGate 引用' };
    }
    if (Array.isArray(changedPaths)) {
      const productPaths = changedPaths.filter((p) => !isTrackerOnlyPath(p));
      if (productPaths.length > 0) {
        return { ok: false, detail: `candidate 存在 product bytes 变化（${productPaths.slice(0, 3).join(', ')}${productPaths.length > 3 ? '…' : ''}），不得声明 repository gate "none"` };
      }
    }
    return { ok: true, detail: 'tracker-only classification + 无 product bytes 变化' };
  }
  if (!AES_QG_FULL_LEVEL.test(required)) {
    return { ok: false, detail: `requiredRepositoryGate 必须是完整 AES-QG-L[0-5] 或 "none"，实际：${required}` };
  }
  const rg = qa.repositoryGate;
  if (!rg || typeof rg !== 'object') {
    return { ok: false, detail: '缺 repositoryGate（GateReceipt 原子引用：achievedLevel/gateReceiptDigest/candidateCommitSha/outcome）' };
  }
  if (rg.standardVersion !== 'AES-QG/1') {
    return { ok: false, detail: `repositoryGate.standardVersion=${rg.standardVersion || 'NOT_SET'}，必须是 AES-QG/1` };
  }
  if (!AES_QG_FULL_LEVEL.test(rg.achievedLevel || '')) {
    return { ok: false, detail: `repositoryGate.achievedLevel=${rg.achievedLevel || 'NOT_SET'} 必须是完整 AES-QG-L[0-5]（裸 Lx 不算）` };
  }
  if (rg.outcome !== 'PASS') {
    return { ok: false, detail: `repositoryGate.outcome=${rg.outcome || 'NOT_SET'}，NOT_RUN/非 PASS fail closed` };
  }
  if (typeof rg.gateReceiptDigest !== 'string' || !SHA256_DIGEST.test(rg.gateReceiptDigest)) {
    return { ok: false, detail: 'repositoryGate.gateReceiptDigest 必须是 sha256:<64hex> 内容寻址摘要' };
  }
  if (!candidateCommit || rg.candidateCommitSha !== candidateCommit) {
    return { ok: false, detail: `repositoryGate candidate=${rg.candidateCommitSha || 'NOT_BOUND'} current=${candidateCommit || 'NOT_RUN'}，旧证据/未绑定 fail closed` };
  }
  if (aesQgLevelIndex(rg.achievedLevel) < aesQgLevelIndex(required)) {
    return { ok: false, detail: `required=${required} > achieved=${rg.achievedLevel}（缺级不得跨越）` };
  }
  return { ok: true, detail: `required=${required} ≤ achieved=${rg.achievedLevel}，GateReceipt digest 绑定 candidate` };
}

// v4 子门：等级栏三态 + 消费侧复算三义务 + companionShots 完整性。
// 无论 receipt 自称什么，这里独立机械复算：①声明了 requiredLevel 即比较 achieved；
// ②requiredLevel 与目标仓 gate-policy 声明对账（gatePolicy.supportedThrough 提供时）；
// ③outcome / repositoryGate.outcome / failureClass 三裁决位一致性，矛盾拒收。
function repositoryGateV4Gate(qa, candidateCommit, changedPaths, gatePolicy) {
  const companion = companionShotsV4Gate(qa);
  const rgDetail = v4RepositoryGateDetail(qa, candidateCommit, changedPaths, gatePolicy);
  if (!rgDetail.ok) return rgDetail;
  if (companion && !companion.ok) return companion;
  return {
    ok: true,
    detail: `${rgDetail.detail}${companion ? `；${companion.detail}` : ''}`,
  };
}

function companionShotsV4Gate(qa) {
  if (qa?.screenshotEvidence?.required !== true) return null;
  const cs = qa.screenshotEvidence.companionShots;
  if (!cs || typeof cs !== 'object') {
    return { ok: false, detail: 'v4 截图义务轮缺 companionShots（伴随目录冻结证明：shots/ + shots-manifest.json），fail closed' };
  }
  if (cs.dir !== 'shots/' || cs.manifest !== 'shots-manifest.json') {
    return { ok: false, detail: `companionShots.dir/manifest 必须为 shots/ 与 shots-manifest.json，实际：${cs.dir ?? 'NOT_SET'}/${cs.manifest ?? 'NOT_SET'}` };
  }
  if (typeof cs.manifestSha256 !== 'string' || !SHA256_DIGEST.test(cs.manifestSha256)) {
    return { ok: false, detail: 'companionShots.manifestSha256 必须是 sha256:<64hex> 内容寻址摘要' };
  }
  if (!Number.isInteger(cs.count) || cs.count < 1) {
    return { ok: false, detail: `companionShots.count 必须是 ≥1 的整数，实际：${cs.count ?? 'NOT_SET'}` };
  }
  const scan = cs.secretsScan;
  const scanShapeOk = scan && typeof scan === 'object' && ['CLEAR', 'BLOCKED'].includes(scan.result)
    && scan.ocr === false && Array.isArray(scan.scope)
    && scan.scope.every((entry) => V4_SECRETS_SCAN_SCOPE.includes(entry));
  if (!scanShapeOk) {
    return { ok: false, detail: 'companionShots.secretsScan 必须是对象 {result: CLEAR|BLOCKED, scope:[filename,metadata,extractable-text], ocr:false}（CLEAR=已声明 scope 内未检出）' };
  }
  if (scan.result === 'BLOCKED') {
    return { ok: false, detail: 'companionShots.secretsScan=BLOCKED：截图含疑似凭据模式，receipt 必须 FAIL，截图不得入库' };
  }
  return { ok: true, detail: `companionShots 完整（count=${cs.count}，secretsScan=CLEAR）` };
}

function v4RepositoryGateDetail(qa, candidateCommit, changedPaths, gatePolicy) {
  const rg = qa.repositoryGate;
  if (!rg || typeof rg !== 'object') {
    return { ok: false, detail: 'v4 缺 repositoryGate（status 闭集 {referenced, not-onboarded}），fail closed 不降级' };
  }
  if (rg.status === undefined) {
    return { ok: false, detail: 'v4 缺 repositoryGate.status，fail closed' };
  }
  if (rg.status === 'not-onboarded') {
    if (typeof rg.reason !== 'string' || !rg.reason.trim()) {
      return { ok: false, detail: 'not-onboarded 必须携带非空 reason（未接入门禁的原因要可读）' };
    }
    if (typeof rg.trackerOnly !== 'boolean') {
      return { ok: false, detail: 'not-onboarded 必须携带布尔 trackerOnly（tracker-only 工作记 true）' };
    }
    const carried = ['standardVersion', 'requiredLevel', 'achievedLevel', 'gateReceiptDigest', 'candidateCommitSha', 'outcome']
      .filter((field) => rg[field] !== undefined);
    if (carried.length) {
      return { ok: false, detail: `not-onboarded 不得携带 referenced 独有字段：${carried.join(', ')}` };
    }
    // 防伪对账（api-mock 义务②「防伪，无条件」）：not-onboarded 只有在核实性
    // 不存在（present=false）时放行——仓有 policy（present=true）矛盾拒收；
    // 存在性不可核实（present=null：读取失败/对账输入未提供）同样 fail closed，
    // 防伪检查不得因信息缺失静默跳过。
    if (gatePolicy?.present === true) {
      return { ok: false, detail: '目标仓存在 gate-policy.toml 而 receipt 声称 not-onboarded——对账矛盾，fail closed 拒收' };
    }
    if (gatePolicy?.present !== false) {
      return { ok: false, detail: 'gate-policy.toml 存在性不可核实（读取失败或对账输入未提供）——not-onboarded 声称无法验证，fail closed 拒收' };
    }
    if (rg.trackerOnly === true && Array.isArray(changedPaths)) {
      const productPaths = changedPaths.filter((p) => !isTrackerOnlyPath(p));
      if (productPaths.length > 0) {
        return { ok: false, detail: `trackerOnly=true 但 candidate 存在 product bytes 变化（${productPaths.slice(0, 3).join(', ')}${productPaths.length > 3 ? '…' : ''}），不得声明 tracker-only` };
      }
    }
    return { ok: true, detail: `not-onboarded：${rg.reason}（trackerOnly=${rg.trackerOnly}；治理=计量+复盘，不设硬门）` };
  }
  if (!V4_REPOSITORY_GATE_STATUSES.includes(rg.status)) {
    return { ok: false, detail: `repositoryGate.status=${String(rg.status)} 不在闭集 {${V4_REPOSITORY_GATE_STATUSES.join(', ')}}，fail closed` };
  }
  if (rg.standardVersion !== 'AES-QG/1') {
    return { ok: false, detail: `repositoryGate.standardVersion=${rg.standardVersion || 'NOT_SET'}，必须是 AES-QG/1` };
  }
  const required = rg.requiredLevel;
  const declaredRequired = required !== undefined && required !== null && required !== '';
  if (declaredRequired && !AES_QG_FULL_LEVEL.test(required)) {
    return { ok: false, detail: `repositoryGate.requiredLevel 可空，但声明时必须是完整 AES-QG-L[0-5]，实际：${required}` };
  }
  if (!AES_QG_FULL_LEVEL.test(rg.achievedLevel || '')) {
    return { ok: false, detail: `repositoryGate.achievedLevel=${rg.achievedLevel || 'NOT_SET'} 必须是完整 AES-QG-L[0-5]（裸 Lx 不算）` };
  }
  if (typeof rg.gateReceiptDigest !== 'string' || !SHA256_DIGEST.test(rg.gateReceiptDigest)) {
    return { ok: false, detail: 'repositoryGate.gateReceiptDigest 必须是 sha256:<64hex> 内容寻址摘要' };
  }
  if (!candidateCommit || rg.candidateCommitSha !== candidateCommit) {
    return { ok: false, detail: `repositoryGate candidate=${rg.candidateCommitSha || 'NOT_BOUND'} current=${candidateCommit || 'NOT_RUN'}，旧证据/未绑定 fail closed` };
  }
  if (!['PASS', 'FAILED'].includes(rg.outcome)) {
    return { ok: false, detail: `repositoryGate.outcome=${rg.outcome || 'NOT_SET'}，闭集 {PASS, FAILED}，NOT_RUN fail closed` };
  }
  // 义务①：声明即比较——不信任 receipt 自称，机械复算缺级。
  const shortfall = declaredRequired && aesQgLevelIndex(rg.achievedLevel) < aesQgLevelIndex(required);
  if (shortfall) {
    const honest = rg.outcome === 'FAILED' && qa.outcome === 'FAIL' && qa.failureClass === 'gate-shortfall';
    if (!honest) {
      return { ok: false, detail: `复算：required=${required} > achieved=${rg.achievedLevel}（缺级不得跨越），receipt 必须 outcome=FAIL + failureClass=gate-shortfall + repositoryGate.outcome=FAILED，实际 outcome=${qa.outcome || 'NOT_SET'} failureClass=${qa.failureClass || 'NOT_SET'} gate=${rg.outcome}——矛盾拒收` };
    }
    return { ok: false, detail: `gate-shortfall：required=${required} > achieved=${rg.achievedLevel}，缺级不得跨越，拒合并（失败已在 receipt 可读，路由回引擎重跑）` };
  }
  // 无 shortfall 时 gate 必须 PASS：FAILED 而不缺级 = 三裁决位矛盾。
  if (rg.outcome !== 'PASS') {
    return { ok: false, detail: `复算矛盾：required=${declaredRequired ? required : '未声明'} ≤ achieved=${rg.achievedLevel} 但 repositoryGate.outcome=${rg.outcome}` };
  }
  // 义务③：三裁决位一致性（gate-shortfall 仅允许缺级场景，此处已排除）。
  if (qa.failureClass === 'gate-shortfall') {
    return { ok: false, detail: `复算矛盾：achieved=${rg.achievedLevel} 未低于 required=${declaredRequired ? required : '未声明'}，failureClass 不得为 gate-shortfall（该枚举仅缺级场景）` };
  }
  if (rg.outcome === 'FAILED' && qa.outcome !== 'FAIL') {
    return { ok: false, detail: `复算矛盾：repositoryGate.outcome=FAILED 而 receipt outcome=${qa.outcome || 'NOT_SET'}` };
  }
  // 义务②（api-mock「消费侧复算三义务」②，无「提供时」豁免）：声明了 requiredLevel 就必须
  // 能与目标仓 gate-policy 声明目标级对账——policy 不存在/存在性不可核实/supported_through
  // 不可解析都算对账无法执行，fail closed 拒收（信息缺失≠比对通过，与 not-onboarded 防伪同族；
  // 引擎对 policy 缺失或 supported_through 不合法一律 BLOCKED 不产等级，referenced receipt
  // 合法存在的前提就是 policy 存在且可解析）。
  if (declaredRequired) {
    if (gatePolicy?.present !== true) {
      const presentLabel = gatePolicy?.present === undefined ? '未提供' : String(gatePolicy.present);
      return { ok: false, detail: `对账：声明了 requiredLevel=${required} 但 gate-policy 对账输入不可执行（present=${presentLabel}），义务②无法复算，fail closed 拒收` };
    }
    if (!AES_QG_FULL_LEVEL.test(gatePolicy.supportedThrough || '')) {
      return { ok: false, detail: `对账：目标仓 gate-policy.toml 存在但 supported_through 不可解析（${gatePolicy.supportedThrough ?? 'NOT_SET'}），义务②无法复算，fail closed 拒收` };
    }
    if (aesQgLevelIndex(required) > aesQgLevelIndex(gatePolicy.supportedThrough)) {
      return { ok: false, detail: `对账：requiredLevel=${required} 超出目标仓 gate-policy supported_through=${gatePolicy.supportedThrough}` };
    }
  }
  return { ok: true, detail: `required=${declaredRequired ? required : '未声明（achieved 即结论）'} ≤ achieved=${rg.achievedLevel}，digest 绑定 candidate` };
}

function screenshotEvidenceGate(qa, candidateCommit) {
  const marker = qa?.screenshotEvidence?.aggregateMarker;
  if (!marker) return { ok: false, detail: '截图证据义务已触发，但 aggregate marker 缺失' };
  const sha256 = /^[0-9a-f]{64}$/i;
  if (marker.schema !== 'aes.screenshot-evidence-marker/v1') {
    return { ok: false, detail: `截图证据 marker schema=${marker.schema || 'NOT_SET'}，必须为 aes.screenshot-evidence-marker/v1` };
  }
  if (typeof marker.batchId !== 'string' || !/^sha256:[0-9a-f]{64}$/i.test(marker.batchId)) {
    return { ok: false, detail: '截图证据 batchId 不是完整 sha256 identity' };
  }
  if (typeof marker.qaRoundId !== 'string' || !marker.qaRoundId.trim()
    || typeof marker.attemptId !== 'string' || !marker.attemptId.trim()) {
    return { ok: false, detail: '截图证据 qaRoundId/attemptId 缺失' };
  }
  if (typeof marker.frozenManifestSha256 !== 'string' || !sha256.test(marker.frozenManifestSha256)
    || typeof marker.receiptSha256 !== 'string' || !sha256.test(marker.receiptSha256)) {
    return { ok: false, detail: '截图证据 manifest/receipt SHA-256 缺失或非法' };
  }
  if (marker.status !== 'VERIFIED') {
    return { ok: false, detail: `截图证据 marker status=${marker.status || 'NOT_SET'}，必须为 VERIFIED` };
  }
  if (marker.assertionOutcome !== 'PASS') {
    return { ok: false, detail: `截图证据 assertion=${marker.assertionOutcome || 'NOT_SET'}，只有 PASS 可获得 release eligibility` };
  }
  if (!candidateCommit || marker.candidateSha !== candidateCommit) {
    return {
      ok: false,
      detail: `截图证据 candidate=${marker.candidateSha || 'NOT_BOUND'} current=${candidateCommit || 'NOT_RUN'}，过期或未绑定`,
    };
  }
  const n = marker.claimRefsN;
  const u = marker.uniqueSha256U;
  const verified = marker.verifiedU;
  if (!Number.isInteger(n) || !Number.isInteger(u) || n < u || u < 1) {
    return { ok: false, detail: `截图证据 claim-complete 计数非法 N=${n ?? 'NOT_SET'} U=${u ?? 'NOT_SET'}` };
  }
  if (!Number.isInteger(verified) || verified !== u) {
    return { ok: false, detail: `截图证据 verifiedU=${verified ?? 'NOT_SET'} 与 U=${u} 不一致` };
  }
  if (!Number.isInteger(marker.totalUniqueBytes) || marker.totalUniqueBytes < 1) {
    return { ok: false, detail: `截图证据 totalUniqueBytes=${marker.totalUniqueBytes ?? 'NOT_SET'} 非法` };
  }
  if (!Number.isInteger(marker.noteId) || marker.noteId < 1) {
    return { ok: false, detail: `截图证据 noteId=${marker.noteId ?? 'NOT_SET'} 非法` };
  }
  return { ok: true, detail: '截图证据 aggregate marker 已 VERIFIED' };
}

// 纯函数：给定自报档位与改动路径集合，推导出实际生效的档位与 policy。
export function resolveMergePolicy({ declaredRisk, changedPaths = [], waiver = null }) {
  assertRiskProfile(declaredRisk);
  const triggered = [];
  let effectiveRisk = declaredRisk;
  for (const rule of ESCALATION_RULES) {
    const hits = changedPaths.filter((path) => rule.pattern.test(String(path).replaceAll('\\', '/')));
    if (!hits.length) continue;
    triggered.push({ id: rule.id, minimum: rule.minimum, reason: rule.reason, paths: hits.slice(0, 5) });
    effectiveRisk = maxRisk(effectiveRisk, rule.minimum);
  }
  const escalated = effectiveRisk !== declaredRisk;
  const policy = POLICY_BY_RISK[effectiveRisk];
  const result = {
    declaredRisk,
    effectiveRisk,
    escalated,
    triggeredRules: triggered,
    mergePolicy: policy,
    autoMergeAllowed: policy === 'AUTO_MERGE',
    requiresHumanGate: policy === 'HUMAN_GATE',
    prOnly: policy === 'PR_ONLY',
    waiver: null,
  };
  if (waiver) result.waiver = applyWaiver(result, waiver);
  return result;
}

// waiver 只能由用户留下结构化记录，且永远不能把 critical 降到可直接 merge。
// 「任何降低验收标准的豁免必须由用户留结构化 waiver」不等于「waiver 可以取消 PR-only」。
export function applyWaiver(resolution, waiver) {
  for (const key of ['reason', 'authorizedBy', 'scope']) {
    if (typeof waiver?.[key] !== 'string' || !waiver[key].trim()) {
      throw storeError('WAIVER_REJECTED', `waiver.${key} 缺失，豁免不生效`, { field: key });
    }
  }
  if (waiver.authorizedBy !== 'human') {
    throw storeError('WAIVER_REJECTED', 'waiver.authorizedBy 必须是 human；Agent 不得自我豁免', {
      actual: waiver.authorizedBy,
    });
  }
  if (resolution.effectiveRisk === 'critical') {
    throw storeError('WAIVER_REJECTED', 'critical 档拒绝直接 merge，waiver 不能覆盖 PR-only', {
      effectiveRisk: resolution.effectiveRisk,
    });
  }
  return { ...waiver, appliedTo: resolution.effectiveRisk };
}

// 机械门：merge 前必须 fresh 校验的全部条件。任一不满足即不 merge。
// 顺序固定，便于把「卡在第几关」写进 typed disposition。
export function evaluateMechanicalGate({
  slotOk, slotReason, commitFresh, commitReason, integrationOk, integrationReason,
  acceptance = [], acceptanceCommit = null, review = null, qa = null, candidateCommit = null, baseCommit = null, integrationHead = null,
  changedPaths = null, gatePolicy = null,
}) {
  const checks = [];
  const push = (id, ok, detail) => checks.push({ id, outcome: ok ? 'PASS' : 'FAIL', detail });

  push('GATE-slot', Boolean(slotOk), slotReason || 'slot 仍持有本 job 的 lease 且未被隔离');
  push('GATE-commit', Boolean(commitFresh), commitReason || 'candidate commit 与 registry 记录一致');
  push('GATE-integration', Boolean(integrationOk), integrationReason || 'integration branch 处于预期 HEAD');

  const unmetAc = acceptance.filter((entry) => entry.outcome !== 'PASS');
  // #72：AC 结论必须绑定当前 candidate，candidate 前进使旧 acceptance 过期 ——
  // 这一层要有自己的失效语义，不靠 GATE-commit 替它兜底（纵深防御奏效不等于该层没漏）。
  // acceptance 不是 schema 化的外部报文，而是 masterTerminal 落盘的内部状态，取证
  // commit 由 Master 自己记录；缺失即 FAIL ——「无从比对」不等于「比对通过」
  // （gate 是最后防线，不假设上游状态机没被绕过）。口径与 GATE-review/qa 的
  // commit 绑定一致。
  const acceptanceFresh = Boolean(candidateCommit && acceptanceCommit === candidateCommit);
  push('GATE-acceptance', acceptance.length > 0 && !unmetAc.length && acceptanceFresh,
    !acceptance.length
      ? 'AC 列表为空，拒绝放行'
      : !acceptanceFresh
        ? `acceptance 取证 commit=${acceptanceCommit || 'NOT_BOUND'} candidate=${candidateCommit || 'NOT_RUN'}，过期或未绑定`
        : `${acceptance.length - unmetAc.length}/${acceptance.length} AC PASS`);

  // review/QA 必须绑定 candidate commit；commit 前进使旧证据失效（E5）。
  // truthy 的 commitSha 不够 —— 必须与 candidateCommit 精确相等，否则旧 commit 的
  // 证据可以给新 commit 背书（gate 是最后防线，不假设上游状态机没被绕过）。
  const reviewBound = review && review.outcome === 'PASS'
    && candidateCommit && review.commitSha === candidateCommit;
  push('GATE-review', Boolean(reviewBound), review
    ? `review outcome=${review.outcome} commit=${review.commitSha || 'NOT_BOUND'} candidate=${candidateCommit || 'NOT_RUN'}`
    : 'review 证据缺失');

  // review 必须在当前 integration base 上取证；base 前进使旧证据失效（AC-007/AC-2）。
  // 只对 v2 证据强制：v1 从未承诺过 baseCommit 字段，语义永久保持原样——这是向下
  // 兼容的既定豁免，不是漏检；历史 trajectory replay 语料就是真实的 v1 报文（合同
  // 早于 AC-007 存在），不能因为新门禁而回溯性判它们不合格。判据只看报文自带的
  // schemaVersion，不做「探测回放/测试环境」的特权判断（见 references/design.md）。
  const reviewDeclaresBase = Boolean(review?.schemaVersion?.endsWith('/v2'));
  const reviewBaseOk = !review ? false : (!reviewDeclaresBase || review.baseCommit === baseCommit);
  const reviewBaseReason = !review
    ? 'review 证据缺失'
    : !reviewDeclaresBase
      ? `review schemaVersion=${review.schemaVersion} 为 v1，不承诺 baseCommit，按向下兼容豁免此检查`
      : `review baseCommit=${review.baseCommit || 'NOT_SET'} job baseCommit=${baseCommit || 'UNRESOLVED'}`;
  push('GATE-review-base', Boolean(reviewBaseOk), reviewBaseReason);

  // runtime=NOT_RUN 不得伪装 PASS（不变清单）。
  const screenshotRequired = declaresScreenshotEvidenceObligation(qa);
  const screenshotGate = screenshotRequired ? screenshotEvidenceGate(qa, candidateCommit) : null;
  // AES-QG repository gate level 子门（v3/v4 义务；v1/v2 冻结豁免；未知版本 fail closed）
  // ——detail 并入 GATE-qa，不新增顶层第九道机械门。gatePolicy 是 v4 not-onboarded
  // 防伪对账与 requiredLevel 对账的输入（master 侧解析目标仓 gate-policy.toml 存在性）。
  const repoGate = repositoryGateLevelGate(qa, candidateCommit, changedPaths, gatePolicy);
  const qaOk = qa && qa.outcome === 'PASS'
    && candidateCommit && qa.commitSha === candidateCommit
    && !(qa.checks || []).some((check) => check.outcome === 'NOT_RUN')
    && !(qa.unexecuted || []).length
    && repoGate.ok
    && (!screenshotRequired || screenshotGate.ok);
  push('GATE-qa', Boolean(qaOk), qa
    ? `qa outcome=${qa.outcome} commit=${qa.commitSha || 'NOT_BOUND'} candidate=${candidateCommit || 'NOT_RUN'} unexecuted=${(qa.unexecuted || []).length} repositoryGate=${repoGate.detail}${screenshotRequired ? ` screenshot=${screenshotGate.detail}` : ''}`
    : 'QA 证据缺失');

  // QA 必须在当前 integration base 上取证；base 前进使旧证据失效（AC-007/AC-2）。
  // v2/v3/v4 都承诺 baseCommit（v3 是 repository gate 语义的最低字段集，v4 继承）；
  // v1 豁免（向下兼容，理由见 GATE-review-base 处注释）。缺 baseCommit 的 v3/v4
  // 不降级成旧 receipt 处理——recordStageResult 已 fail closed，这里同样按不匹配拒绝。
  const qaDeclaresBase = ['v2', 'v3', 'v4'].includes(qaReceiptVersion(qa));
  const qaBaseOk = !qa ? false : (!qaDeclaresBase || qa.baseCommit === baseCommit);
  const qaBaseReason = !qa
    ? 'QA 证据缺失'
    : !qaDeclaresBase
      ? `qa schemaVersion=${qa.schemaVersion} 为 v1，不承诺 baseCommit，按向下兼容豁免此检查`
      : `qa baseCommit=${qa.baseCommit || 'NOT_SET'} job baseCommit=${baseCommit || 'UNRESOLVED'}`;
  push('GATE-qa-base', Boolean(qaBaseOk), qaBaseReason);

  const failed = checks.filter((check) => check.outcome === 'FAIL');
  return { checks, allGreen: !failed.length, failed };
}

// 最终放行判定：机械门 + 分档 gate。high 档「机械门全绿仍必须停 humanGate」在这里体现。
export function decideMerge({ mechanical, policy, humanApproval = null }) {
  if (!mechanical.allGreen) {
    return {
      decision: 'BLOCKED_MECHANICAL',
      mayMerge: false,
      reason: `机械门未全绿: ${mechanical.failed.map((check) => check.id).join(', ')}`,
      failedChecks: mechanical.failed,
    };
  }
  if (policy.prOnly) {
    return {
      decision: 'PR_ONLY',
      mayMerge: false,
      reason: `effectiveRisk=${policy.effectiveRisk} 拒绝直接 merge，只走 PR`,
      escalated: policy.escalated,
    };
  }
  if (policy.requiresHumanGate) {
    if (!humanApproval) {
      return {
        decision: 'AWAITING_HUMAN_GATE',
        mayMerge: false,
        reason: `effectiveRisk=${policy.effectiveRisk}：机械门全绿仍需人工批准`,
        escalated: policy.escalated,
      };
    }
    if (humanApproval.outcome !== 'PASS') {
      return {
        decision: 'HUMAN_GATE_REJECTED',
        mayMerge: false,
        reason: `人工门 outcome=${humanApproval.outcome}`,
      };
    }
    return {
      decision: 'APPROVED_BY_HUMAN',
      mayMerge: true,
      reason: `人工门通过（${humanApproval.resumeToken}）`,
      escalated: policy.escalated,
    };
  }
  return {
    decision: 'AUTO_MERGE',
    mayMerge: true,
    reason: `effectiveRisk=${policy.effectiveRisk} 机械门全绿，自动 merge`,
    escalated: policy.escalated,
  };
}
