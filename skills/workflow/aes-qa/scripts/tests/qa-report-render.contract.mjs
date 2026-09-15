#!/usr/bin/env node
// AC-007 契约：qa-report.html 一等伴随产物——v4 出票必产；模板复制渲染零 LLM；
// 单文件零外链断网可开；包含等级栏三态、全部 checks（agent-live 断言与托底层）、
// humanChecklist/unexecuted、screenshotEvidence 状态与 shots/ 相对路径图片引用、
// jobId/attemptId/candidateSha 元数据；随 receipt 同批作废（candidateSha 内嵌）。
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { dirname, join as joinPath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderQaReportHtml, readShotsManifest } from '../qa-report.mjs';

const CONTRACT = 'aes-qa-v4-schema';
const CASE = 'qa-report-render';
const RESULT_SCHEMA = 'aes.qa-v4-schema-contract-result/v1';
const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(dirname(HERE));

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
const CLEAR_SCAN = { result: 'CLEAR', scope: ['filename', 'metadata', 'extractable-text'], ocr: false };

const receipt = {
  schemaVersion: 'aes.qa.receipt/v4',
  jobId: 'job-2026-09-12-171', attemptId: 'att-3', commitSha: CANDIDATE, baseCommit: BASE,
  repositoryGate: {
    status: 'referenced', standardVersion: 'AES-QG/1',
    requiredLevel: 'AES-QG-L3', achievedLevel: 'AES-QG-L3',
    gateReceiptDigest: `sha256:${'a'.repeat(64)}`,
    candidateCommitSha: CANDIDATE, outcome: 'PASS',
  },
  checks: [
    { id: 'regression-suite', kind: 'automated', outcome: 'PASS', command: 'node run-tests.mjs' },
    {
      id: 'agent-journey-login', kind: 'agent-live', outcome: 'PASS',
      driver: { model: 'glm-5.3', capabilitySkill: 'browser-use:control-browser' },
      assertions: [
        { claim: '名单内模型真实 spawn，CLI banner 为证', backing: { layer: 'sidecar-session', pointer: 'codex/sessions/2026-09-12T08-11.log', digest: `sha256:${'c'.repeat(64)}` } },
        { claim: '工作台出现会话卡片', backing: { layer: 'read-model', pointer: 'sqlite:sessions/row-88', digest: `sha256:${'d'.repeat(64)}` } },
      ],
      summary: '正例 spawn + 反例 WS patch 被拒，双向闭环',
    },
    { id: 'visual-polish', kind: 'manual', outcome: 'AWAITING_HUMAN', summary: '确认设置页配色观感', demotedFrom: 'agent-live', demotionReason: '断言无四层托底证据' },
  ],
  humanChecklist: [{ id: 'hc-1', what: '打开设置页查看配色', expect: '无刺眼对比', outcome: 'AWAITING_HUMAN' }],
  screenshotEvidence: {
    required: true,
    aggregateMarker: {
      schema: 'aes.screenshot-evidence-marker/v1', batchId: `sha256:${'9'.repeat(64)}`,
      qaRoundId: 'qa-round-1', attemptId: 'att-3', status: 'VERIFIED', assertionOutcome: 'PASS',
      candidateSha: CANDIDATE, frozenManifestSha256: '0'.repeat(64),
      claimRefsN: 2, uniqueSha256U: 2, verifiedU: 2, totalUniqueBytes: 2048, noteId: 147900, receiptSha256: '1'.repeat(64),
    },
    companionShots: { dir: 'shots/', manifest: 'shots-manifest.json', manifestSha256: `sha256:${'3'.repeat(64)}`, count: 2, secretsScan: CLEAR_SCAN },
  },
  unexecuted: [], manualDebt: [], outcome: 'PASS', failureClass: null,
};

const shotsManifest = {
  schema: 'aes.qa.companion-shots-manifest/v1',
  jobId: receipt.jobId, attemptId: receipt.attemptId, candidateSha: CANDIDATE,
  shots: [
    { captureId: 'cap-1', claimIds: ['claim-login'], displayFileName: 'settings-light.png', file: 'shots/1111.png', sha256: '1111', bytes: 1024, viewport: '1366x768', theme: 'light' },
    { captureId: 'cap-2', claimIds: ['claim-card'], displayFileName: 'board-dark.png', file: 'shots/2222.png', sha256: '2222', bytes: 1024, viewport: '1366x768', theme: 'dark' },
  ],
  count: 2, secretsScan: CLEAR_SCAN,
};

// 1) 模板复制渲染：纯函数确定性——同输入两次渲染逐字节相等（零 LLM 的机械证明）。
const html = renderQaReportHtml(receipt, shotsManifest);
check('模板复制渲染：纯函数确定性（同输入逐字节相等，零 LLM）', html === renderQaReportHtml(receipt, shotsManifest));

// 2) 单文件零外链断网可开：无 http(s) 资源、无外链字体/脚本。
check('零外链：无 http(s):// 引用（断网双击可开）', !/https?:\/\//i.test(html));
check('单文件：无 <script src>/外链字体', !/<script[^>]+src/i.test(html) && !/@import/i.test(html) && !/fonts\./i.test(html));
check('系统字体：system-ui 字体栈', /system-ui/.test(html));
check('图片按 shots/ 相对路径引用不内嵌', /src="shots\/1111\.png"/.test(html) && /src="shots\/2222\.png"/.test(html) && !/data:image/.test(html));

// 3) 内容投影：等级栏三态 + checks 托底层 + 人工/未执行 + 截图状态 + 元数据。
check('元数据：jobId/attemptId/candidateSha 全文可见', html.includes(receipt.jobId) && html.includes(receipt.attemptId) && html.includes(CANDIDATE));
check('等级栏：referenced 三态字段（required/achieved/digest/outcome）', html.includes('AES-QG-L3') && html.includes('referenced') && html.includes(`sha256:${'a'.repeat(64)}`));
check('checks：agent-live 断言 + 四层托底 + digest 可见', html.includes('名单内模型真实 spawn') && html.includes('sidecar-session') && html.includes('read-model') && html.includes(`sha256:${'c'.repeat(64)}`));
check('driver 执行者可见', html.includes('glm-5.3') && html.includes('browser-use:control-browser'));
check('降档项：demotedFrom=agent-live + 原因可见', /demotedFrom=<code>agent-live<\/code>/.test(html) && html.includes('断言无四层托底证据'));
check('humanChecklist 可执行条目', html.includes('打开设置页查看配色') && html.includes('无刺眼对比'));
check('unexecuted 诚实呈现（NOT_RUN 永不写成 PASS）', html.includes('unexecuted'));
check('screenshotEvidence：marker VERIFIED + secretsScan 对象化', html.includes('VERIFIED') && html.includes('extractable-text') && html.includes('ocr'));
check('作废语义：candidateSha 内嵌（STALE_EVIDENCE 同源对账依据）', html.includes(CANDIDATE) && html.includes('STALE_EVIDENCE'));

// 4) not-onboarded 态投影（等级栏三态的另一态）。
const notOnboarded = structuredClone(receipt);
notOnboarded.repositoryGate = { status: 'not-onboarded', reason: '仓库未做门禁建设，run.toml 无已注册 gate', trackerOnly: false };
const htmlNo = renderQaReportHtml(notOnboarded, null);
check('not-onboarded 态：reason/trackerOnly 呈现', htmlNo.includes('not-onboarded') && htmlNo.includes('仓库未做门禁建设') && htmlNo.includes('false'));

// 5) CLI 出票必产路径：--receipt 落盘 qa-report.html，重复渲染幂等。
const work = mkdtempSync(join(tmpdir(), 'v4-report-'));
const receiptPath = join(work, 'qa-receipt.json');
writeFileSync(receiptPath, JSON.stringify(receipt), 'utf8');
const cli = spawnSync(process.execPath, [joinPath(SKILL_DIR, 'scripts', 'qa-report.mjs'), '--receipt', receiptPath, '--out', work, '--json'], {
  cwd: SKILL_DIR, encoding: 'utf8', stdio: 'pipe', windowsHide: true,
});
let cliPayload = null;
try { cliPayload = JSON.parse((cli.stdout || '').trim()); } catch {}
check('CLI 渲染：exit 0 + success 报文', cli.status === 0 && cliPayload?.resultKind === 'success', cli.stdout || cli.stderr);
check('CLI 落盘：伴随目录出现 qa-report.html（出票必产）', cliPayload?.target === join(work, 'qa-report.html'));
// 无 shots-manifest.json 时图库降级说明（伴随目录与清单同生）。
const manifestMissing = readShotsManifest(work) === null;
check('缺伴随清单：图库如实降级（不假装可显示）', manifestMissing);

rmSync(work, { recursive: true, force: true });
finish();
