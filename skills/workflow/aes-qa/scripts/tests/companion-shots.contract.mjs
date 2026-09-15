#!/usr/bin/env node
// AC-005 契约：终态截图伴随保留——screenshotEvidence.required=true 的 v4 最终轮：
// VERIFIED 后冻结伴随目录（截图目录 + 伴随清单文件）；清单摘要与对象化 secretsScan
// （result+scope+ocr:false，CLEAR=已声明 scope 内未检出）进 receipt；BLOCKED →
// receipt FAIL、不入库；candidate 变更后旧伴随目录随旧 receipt 同批作废，
// 新 candidate 必须新 attempt 重跑。
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  atomicWriteJson, captureEvidence, canonicalBatchId, freezeTerminal, digestObject,
} from '../screenshot-evidence-core.mjs';
import { freezeCompanionShots } from '../companion-freeze.mjs';
import { validateQaReceiptV4 } from '../v4-receipt.mjs';
import { extractPngTextChunks, scanShotsForSecrets } from '../secrets-scan.mjs';

const CONTRACT = 'screenshot-evidence';
const CASE = 'companion-shots-freeze';
const RESULT_SCHEMA = 'aes.screenshot-evidence-contract-result/v1';

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

const CANDIDATE = '1'.repeat(40);
const sha256Hex = (value) => createHash('sha256').update(value).digest('hex');

// 最小 PNG 构造：签名 + 可选文本块 + IEND（CRC 不参与本契约的解析路径）。
function buildPng(textChunks = []) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunks = [];
  const push = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'latin1');
    chunks.push(head, data, Buffer.alloc(4));
  };
  push('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]));
  for (const [keyword, text] of textChunks) {
    push('tEXt', Buffer.from(`${keyword}\0${text}`, 'latin1'));
  }
  push('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, ...chunks]);
}

const root = mkdtempSync(join(tmpdir(), 'v4-companion-'));
const spool = join(root, 'spool');
const dest = join(root, 'receipts', 'job-1', 'att-1');

// spool 装配：真实 capture → terminal 冻结 → 手工落一个一致 VERIFIED marker
// （publish 需要 GitLab，本契约只验证冻结面的 marker 一致性校验，不触网）。
atomicWriteJson(join(spool, 'capture-manifest.json'), {
  schema: 'aes.screenshot-capture-manifest/v1',
  qaRoundId: 'qa-round-1', attemptId: 'att-1',
  evidenceTarget: { provider: 'gitlab', host: 'git.51vr.local', projectId: 2137, issueIid: 28 },
  codeState: { finality: 'final', headSha: CANDIDATE, candidateSha: CANDIDATE, worktreeDirty: false, patchDigest: null },
  environment: { environmentDigest: `sha256:${'2'.repeat(64)}` },
  terminal: null, requiredEvidence: [], captures: [], manifestRevision: 0,
});

const pngClear = join(root, 'clear.png');
writeFileSync(pngClear, buildPng([['Software', 'aes-qa-contract']]), 'utf8');
const pngDark = join(root, 'dark.png');
writeFileSync(pngDark, buildPng(), 'utf8');
captureEvidence({ spool, file: pngClear, captureId: 'cap-1', claim: 'claim-settings', role: 'acceptance', viewport: '1366x768', theme: 'light', sensitivity: 'CLEAR' });
captureEvidence({ spool, file: pngDark, captureId: 'cap-2', claim: 'claim-board', role: 'acceptance', viewport: '1366x768', theme: 'dark', sensitivity: 'CLEAR' });
freezeTerminal({ spool, outcome: 'PASS', candidate: CANDIDATE });
const manifest = JSON.parse(readFileSync(join(spool, 'capture-manifest.json'), 'utf8'));
const claimSet = manifest.terminal.reconciliation;
const uniqueSha = claimSet.uniqueSha256;
atomicWriteJson(join(spool, 'aggregate-marker.json'), {
  schema: 'aes.screenshot-evidence-marker/v1',
  batchId: canonicalBatchId(manifest),
  qaRoundId: 'qa-round-1', attemptId: 'att-1', status: 'VERIFIED', assertionOutcome: 'PASS',
  candidateSha: CANDIDATE, frozenManifestSha256: manifest.frozenManifestSha256,
  claimRefsN: manifest.terminal.reconciliation.claimRefs.length, uniqueSha256U: uniqueSha.length, verifiedU: uniqueSha.length,
  totalUniqueBytes: 200, noteId: 147900, receiptSha256: '0'.repeat(64),
});

function qaV4WithShots(companionShots) {
  return {
    schemaVersion: 'aes.qa.receipt/v4',
    jobId: 'job-1', attemptId: 'att-1', commitSha: CANDIDATE, baseCommit: '2'.repeat(40),
    repositoryGate: { status: 'not-onboarded', reason: '未接入门禁（契约夹具仓）', trackerOnly: false },
    checks: [{ id: 'regression-suite', kind: 'automated', outcome: 'PASS', command: 'node run-tests.mjs' }],
    screenshotEvidence: {
      required: true,
      aggregateMarker: {
        schema: 'aes.screenshot-evidence-marker/v1', batchId: canonicalBatchId(manifest),
        qaRoundId: 'qa-round-1', attemptId: 'att-1', status: 'VERIFIED', assertionOutcome: 'PASS',
        candidateSha: CANDIDATE, frozenManifestSha256: manifest.frozenManifestSha256,
        claimRefsN: manifest.terminal.reconciliation.claimRefs.length, uniqueSha256U: uniqueSha.length, verifiedU: uniqueSha.length,
        totalUniqueBytes: 200, noteId: 147900, receiptSha256: '0'.repeat(64),
      },
      ...(companionShots ? { companionShots } : {}),
    },
    humanChecklist: [], unexecuted: [], manualDebt: [], outcome: 'PASS', failureClass: null,
  };
}

// —— 1) 正常冻结：VERIFIED 后伴随目录三件套齐产 ——
const freeze = freezeCompanionShots({ spool, dest, receipt: qaV4WithShots(null) });
check('冻结：shots/ 副本落盘（每 blob 按 sha256 内容寻址命名）', existsSync(join(dest, 'shots', `${uniqueSha[0]}.png`)) && existsSync(join(dest, 'shots', `${uniqueSha[1]}.png`)));
check('冻结：shots-manifest.json 落盘', existsSync(join(dest, 'shots-manifest.json')));
check('冻结：qa-report.html 出票必产（一等伴随产物）', existsSync(join(dest, 'qa-report.html')));
check('清单：candidateSha 绑定 + count=2', freeze.manifest.candidateSha === CANDIDATE && freeze.manifest.count === 2);
const manifestDigestCopy = structuredClone(freeze.manifest);
const recordedManifestHex = manifestDigestCopy.manifestSha256Hex;
delete manifestDigestCopy.manifestSha256Hex;
check('清单：manifestSha256 = canonical JSON 摘要（重算相等）', digestObject(manifestDigestCopy) === recordedManifestHex);
check('companionShots 块：dir/manifest 命名按 api-mock 锁定', freeze.companionShots.dir === 'shots/' && freeze.companionShots.manifest === 'shots-manifest.json');
check('companionShots 块：secretsScan 对象化（result+scope+ocr:false）', freeze.companionShots.secretsScan.result === 'CLEAR' && freeze.companionShots.secretsScan.ocr === false && freeze.companionShots.secretsScan.scope.join(',') === 'filename,metadata,extractable-text');
const receiptWithShots = qaV4WithShots(freeze.companionShots);
check('带 companionShots 的 v4 receipt：schema 校验零错（可出票）', validateQaReceiptV4(receiptWithShots).length === 0, validateQaReceiptV4(receiptWithShots).join('；'));

// —— 2) 幂等重冻：同 candidate 重跑返回既有清单 ——
const refrozen = freezeCompanionShots({ spool, dest, receipt: receiptWithShots });
check('幂等重冻：同 candidate 返回既有清单', refrozen.idempotent === true && refrozen.companionShots.manifestSha256 === freeze.companionShots.manifestSha256);

// —— 3) candidate 变更：同目录拒绝（同批作废语义，新 candidate 必须新 attempt）——
const movedReceipt = structuredClone(receiptWithShots);
movedReceipt.commitSha = '9'.repeat(40);
let staleRejected = false;
try {
  freezeCompanionShots({ spool, dest, receipt: movedReceipt });
} catch (error) {
  staleRejected = error.code === 'COMPANION_STALE_CANDIDATE';
}
check('candidate 变更：旧伴随目录拒绝新 candidate（同批作废，须新 attempt）', staleRejected);

// —— 4) 非 VERIFIED marker：拒绝冻结 ——
const spoolUnverified = join(root, 'spool-unverified');
mkdirSync(spoolUnverified, { recursive: true });
const unverifiedManifest = structuredClone(manifest);
atomicWriteJson(join(spoolUnverified, 'capture-manifest.json'), unverifiedManifest);
mkdirSync(join(spoolUnverified, 'images'), { recursive: true });
for (const sha of uniqueSha) {
  writeFileSync(join(spoolUnverified, 'images', `${sha}.png`), readFileSync(join(spool, 'images', `${sha}.png`)));
}
atomicWriteJson(join(spoolUnverified, 'aggregate-marker.json'), { ...JSON.parse(readFileSync(join(spool, 'aggregate-marker.json'), 'utf8')), status: 'UPLOADED' });
let unverifiedRejected = false;
try {
  freezeCompanionShots({ spool: spoolUnverified, dest: join(root, 'dest-unverified'), receipt: receiptWithShots });
} catch (error) {
  unverifiedRejected = error.code === 'MARKER_NOT_VERIFIED';
}
check('非 VERIFIED marker → 拒绝冻结（只有 claim-complete 且发布完成批次可保留）', unverifiedRejected);

// —— 5) secrets 红线：BLOCKED 则不入库、receipt 必须 FAIL ——
const pngLeak = join(root, 'leak.png');
writeFileSync(pngLeak, buildPng([['Comment', 'token ghp_0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ']]), 'utf8');
const leakBytes = readFileSync(pngLeak);
check('PNG 文本块可提取（metadata scope 生效前提）', extractPngTextChunks(leakBytes).some((text) => text.includes('ghp_')));
const leakScan = scanShotsForSecrets([{ displayFileName: 'leak.png', bytes: leakBytes }]);
check('命中凭据模式 → secretsScan.result=BLOCKED（findings 不回显凭据内容）', leakScan.result === 'BLOCKED' && leakScan.findings.every((f) => !('match' in f)));

const spoolLeak = join(root, 'spool-leak');
mkdirSync(spoolLeak, { recursive: true });
const leakManifest = structuredClone(manifest);
leakManifest.captures = [];
leakManifest.requiredEvidence = [];
leakManifest.terminal = null;
delete leakManifest.frozenManifestSha256;
leakManifest.manifestRevision = 0;
atomicWriteJson(join(spoolLeak, 'capture-manifest.json'), leakManifest);
captureEvidence({ spool: spoolLeak, file: pngLeak, captureId: 'cap-leak', claim: 'claim-leak', role: 'acceptance', viewport: '1366x768', theme: 'light', sensitivity: 'CLEAR' });
freezeTerminal({ spool: spoolLeak, outcome: 'PASS', candidate: CANDIDATE });
const leakFrozen = JSON.parse(readFileSync(join(spoolLeak, 'capture-manifest.json'), 'utf8'));
const leakUniqueSha = leakFrozen.terminal.reconciliation.uniqueSha256;
atomicWriteJson(join(spoolLeak, 'aggregate-marker.json'), {
  schema: 'aes.screenshot-evidence-marker/v1', batchId: canonicalBatchId(leakFrozen),
  qaRoundId: 'qa-round-1', attemptId: 'att-1', status: 'VERIFIED', assertionOutcome: 'PASS',
  candidateSha: CANDIDATE, frozenManifestSha256: leakFrozen.frozenManifestSha256,
  claimRefsN: leakFrozen.terminal.reconciliation.claimRefs.length, uniqueSha256U: leakUniqueSha.length, verifiedU: leakUniqueSha.length,
  totalUniqueBytes: leakBytes.length, noteId: 147900, receiptSha256: '0'.repeat(64),
});
const leakReceipt = structuredClone(qaV4WithShots(null));
leakReceipt.screenshotEvidence.aggregateMarker = JSON.parse(readFileSync(join(spoolLeak, 'aggregate-marker.json'), 'utf8'));
const leakFreeze = freezeCompanionShots({ spool: spoolLeak, dest: join(root, 'dest-leak'), receipt: leakReceipt });
check('BLOCKED 冻结：返回 blocked 且截图不入库（伴随目录无 shots/）', leakFreeze.blocked === true && !existsSync(join(root, 'dest-leak', 'shots')));
const blockedReceipt = structuredClone(leakReceipt);
blockedReceipt.screenshotEvidence.companionShots = { dir: 'shots/', manifest: 'shots-manifest.json', manifestSha256: `sha256:${'4'.repeat(64)}`, count: 1, secretsScan: leakFreeze.secretsScan };
blockedReceipt.outcome = 'PASS';
check('BLOCKED 而 receipt outcome=PASS → schema 校验报错（必须 FAIL）', validateQaReceiptV4(blockedReceipt).some((e) => /BLOCKED/.test(e)), validateQaReceiptV4(blockedReceipt).join('；'));
blockedReceipt.outcome = 'FAIL';
blockedReceipt.failureClass = 'must-fix';
check('BLOCKED + receipt FAIL → schema 合法（正确终局形态）', validateQaReceiptV4(blockedReceipt).length === 0, validateQaReceiptV4(blockedReceipt).join('；'));

// —— 6) 渲染伴随：qa-report.html 内嵌 shots/ 相对引用（AC-007 交叉锚定）——
const reportHtml = readFileSync(join(dest, 'qa-report.html'), 'utf8');
check('qa-report.html：图片按 shots/ 相对路径引用', reportHtml.includes(`shots/${uniqueSha[0]}.png`) && reportHtml.includes('shots-manifest.json'));

rmSync(root, { recursive: true, force: true });
finish();
