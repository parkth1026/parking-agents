// qa-report.html 渲染器：v4 验收单的人类可读一等伴随产物。
// 模板复制渲染、零 LLM、零依赖：确定性字符串投影，单文件、系统字体、零外链、
// 断网双击可开；图片按 shots/ 相对路径引用不内嵌；只落本地伴随目录，不发布 GitLab。
// 形态锚 = workflow-interview export-dossier 产物（同款 CSS 变量与版式语言）。
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// isMain 用双向 realpath 归一判等：字面判等经 symlink 挂载路径调用会跳过 CLI 段、
// 零输出 exit 0 假绿（c7fc2d6 遗训——exit 0 不算过，零输出即空转信号）。
const isMain = (() => {
  try {
    return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const OUTCOME_CLASS = { PASS: 'pass', FAIL: 'fail', AWAITING_HUMAN: 'awaiting', FAILED: 'fail', VERIFIED: 'pass', BLOCKED: 'fail' };
function badge(kind, text) {
  return `<span class="badge ${OUTCOME_CLASS[String(text)] ?? 'muted'}">${escapeHtml(kind)} ${escapeHtml(text)}</span>`;
}

function metaRow(receipt) {
  const rows = [
    ['jobId', receipt.jobId],
    ['attemptId', receipt.attemptId],
    ['candidate (commitSha)', receipt.commitSha],
    ['baseCommit', receipt.baseCommit],
    ['schemaVersion', receipt.schemaVersion],
    ['outcome', receipt.outcome],
    ['failureClass', receipt.failureClass ?? '—'],
  ];
  return `<dl class="meta">${rows.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value ?? 'NOT_SET')}</dd></div>`).join('')}</dl>`;
}

function repositoryGateSection(rg) {
  if (!rg || typeof rg !== 'object') {
    return '<section class="card"><h2>repository gate</h2><p class="fail">repositoryGate 缺失（fail closed）</p></section>';
  }
  if (rg.status === 'not-onboarded') {
    return `<section class="card"><h2>repository gate · not-onboarded</h2>
      <p>${badge('status', 'not-onboarded')}</p>
      <dl class="meta"><div><dt>reason</dt><dd>${escapeHtml(rg.reason ?? 'NOT_SET')}</dd></div>
      <div><dt>trackerOnly</dt><dd>${escapeHtml(String(rg.trackerOnly ?? 'NOT_SET'))}</dd></div></dl>
      <p class="muted">验收单有效；未接入仓治理 = 计量 + 定期复盘（不设硬门），接入率显著变化后复议。等级语言见 AES-QG（aes-gate 所有权）。</p></section>`;
  }
  const rows = [
    ['status', rg.status],
    ['standardVersion', rg.standardVersion],
    ['requiredLevel', rg.requiredLevel ?? '（未声明：achieved 即结论）'],
    ['achievedLevel', rg.achievedLevel],
    ['gateReceiptDigest', rg.gateReceiptDigest],
    ['candidateCommitSha', rg.candidateCommitSha],
    ['outcome', rg.outcome],
  ];
  const shortfall = rg.requiredLevel && rg.achievedLevel && /AES-QG-L([0-5])$/.exec(rg.requiredLevel)?.[1] > /AES-QG-L([0-5])$/.exec(rg.achievedLevel)?.[1];
  return `<section class="card"><h2>repository gate · referenced</h2>
    <p>${badge('status', 'referenced')} ${badge('gate', rg.outcome ?? 'NOT_SET')}</p>
    <dl class="meta">${rows.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value ?? 'NOT_SET')}</dd></div>`).join('')}</dl>
    ${shortfall ? '<p class="fail">未达声明门级：failureClass=gate-shortfall，缺级不得跨越，拒合并。</p>' : ''}
    <p class="muted">等级出自引擎收据内容寻址引用（不手抄）；等级与发布资格正交，L5 PASS ≠ release-qualified。</p></section>`;
}

function assertionRow(assertion) {
  const backing = assertion?.backing ?? {};
  const digestOk = /^sha256:[0-9a-f]{64}$/i.test(String(backing.digest ?? ''));
  return `<tr><td>${escapeHtml(assertion?.claim ?? '（无 claim）')}</td>
    <td><code>${escapeHtml(backing.layer ?? '—')}</code></td>
    <td><code>${escapeHtml(backing.pointer ?? '—')}</code></td>
    <td class="${digestOk ? '' : 'fail'}"><code>${escapeHtml(backing.digest ?? '（无 digest：视同无托底，已降档）')}</code></td></tr>`;
}

function checksSection(receipt) {
  const checks = Array.isArray(receipt.checks) ? receipt.checks : [];
  const blocks = checks.map((check) => {
    const driver = check.kind === 'agent-live' && check.driver
      ? `<p class="muted">driver: model=<code>${escapeHtml(check.driver.model)}</code> · capabilitySkill=<code>${escapeHtml(check.driver.capabilitySkill)}</code>（同 candidate 换驱动模型不作废 receipt，执行者变化在此可见）</p>`
      : '';
    const demoted = check.demotedFrom
      ? `<p class="awaiting">降档项：demotedFrom=<code>${escapeHtml(check.demotedFrom)}</code> · 原因=<code>${escapeHtml(check.demotionReason ?? '—')}</code>（AWAITING_HUMAN，agent 不得代答）</p>`
      : '';
    const assertions = Array.isArray(check.assertions) && check.assertions.length
      ? `<table class="ledger"><thead><tr><th>断言</th><th>托底层</th><th>指针</th><th>内容寻址 digest</th></tr></thead><tbody>${check.assertions.map(assertionRow).join('')}</tbody></table>`
      : '';
    const command = check.command ? `<p class="muted">command: <code>${escapeHtml(check.command)}</code></p>` : '';
    const summary = check.summary ? `<p>${escapeHtml(check.summary)}</p>` : '';
    return `<div class="check"><header><span class="check-id">${escapeHtml(check.id ?? 'NOT_SET')}</span>
      <span>${escapeHtml(check.kind ?? 'NOT_SET')} ${badge('outcome', check.outcome ?? 'NOT_SET')}</span></header>
      ${driver}${demoted}${summary}${command}${assertions}</div>`;
  }).join('');
  return `<section><h2>checks（全部 ${checks.length} 条）</h2>${blocks || '<p class="muted">（无）</p>'}</section>`;
}

function humanSection(receipt) {
  const checklist = Array.isArray(receipt.humanChecklist) ? receipt.humanChecklist : [];
  const rows = checklist.map((item) => `<tr><td>${escapeHtml(item.id ?? '—')}</td><td>${escapeHtml(item.what ?? item.step ?? '—')}</td><td>${escapeHtml(item.expect ?? item.expected ?? '—')}</td><td>${escapeHtml(item.outcome ?? 'NOT_SET')}</td></tr>`).join('');
  const unexecuted = (receipt.unexecuted || []).map((entry) => `<li>${escapeHtml(typeof entry === 'string' ? entry : JSON.stringify(entry))}</li>`).join('');
  const debt = (receipt.manualDebt || []).map((entry) => `<li>${escapeHtml(typeof entry === 'string' ? entry : JSON.stringify(entry))}</li>`).join('');
  return `<section class="card"><h2>humanChecklist / unexecuted / manualDebt</h2>
    ${checklist.length ? `<table class="ledger"><thead><tr><th>id</th><th>做什么</th><th>期望看到</th><th>outcome</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="muted">humanChecklist：无</p>'}
    ${unexecuted ? `<h3>unexecuted</h3><ul>${unexecuted}</ul>` : '<p class="muted">unexecuted：无（NOT_RUN 永不写成 PASS）</p>'}
    ${debt ? `<h3>manualDebt</h3><ul>${debt}</ul>` : ''}</section>`;
}

function screenshotSection(receipt, shotsManifest) {
  const evidence = receipt.screenshotEvidence;
  if (!evidence || evidence.required !== true) {
    return '<section class="card"><h2>screenshot evidence</h2><p class="muted">required=false：本 attempt 无截图义务。</p></section>';
  }
  const marker = evidence.aggregateMarker ?? {};
  const companion = evidence.companionShots ?? {};
  const scan = companion.secretsScan;
  const shots = Array.isArray(shotsManifest?.shots) ? shotsManifest.shots : [];
  const gallery = shots.length
    ? `<div class="gallery">${shots.map((shot) => `<figure><img src="${escapeHtml(shot.file)}" alt="${escapeHtml(shot.displayFileName ?? shot.sha256)}" loading="lazy">
      <figcaption><code>${escapeHtml(shot.sha256?.slice(0, 16))}…</code> · ${escapeHtml(shot.claimIds?.join(', ') ?? '—')} · ${escapeHtml(String(shot.bytes ?? '?'))} bytes</figcaption></figure>`).join('')}</div>`
    : '<p class="muted">（伴随清单缺失或为空：图库不可用——回伴随目录核对 shots-manifest.json）</p>';
  return `<section class="card"><h2>screenshot evidence</h2>
    <p>${badge('marker', marker.status ?? 'NOT_SET')} ${badge('assertion', marker.assertionOutcome ?? 'NOT_SET')}</p>
    <dl class="meta">
      <div><dt>batchId</dt><dd>${escapeHtml(marker.batchId ?? 'NOT_SET')}</dd></div>
      <div><dt>claimRefs N / unique U / verifiedU</dt><dd>${escapeHtml(`${marker.claimRefsN ?? '?'} / ${marker.uniqueSha256U ?? '?'} / ${marker.verifiedU ?? '?'}`)}</dd></div>
      <div><dt>companion dir / manifest</dt><dd>${escapeHtml(companion.dir ?? 'NOT_SET')} · ${escapeHtml(companion.manifest ?? 'NOT_SET')}</dd></div>
      <div><dt>manifestSha256</dt><dd>${escapeHtml(companion.manifestSha256 ?? 'NOT_SET')}</dd></div>
      <div><dt>companion count</dt><dd>${escapeHtml(String(companion.count ?? 'NOT_SET'))}</dd></div>
      <div><dt>secretsScan</dt><dd>${escapeHtml(scan ? `${scan.result}（scope: ${(scan.scope || []).join(', ')}；ocr: ${scan.ocr}——CLEAR=已声明 scope 内未检出，像素内渲染内容为已声明盲区）` : 'NOT_SET')}</dd></div>
    </dl>
    ${gallery}
    <p class="muted">终态截图冻结副本随本验收单同生共死；candidate 变更后旧伴随目录随旧 receipt 同批作废（STALE_EVIDENCE 同源），新 candidate 必须新 attempt 重跑。GitLab 发布链路原样并行，本报告只落本地。</p></section>`;
}

const PAGE_TEMPLATE = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>QA Report · __JOB_ID__ · __ATTEMPT_ID__</title>
<style>
:root{--paper:#faf9f6;--ink:#201d18;--muted:#766f65;--line:#e5e2dc;--card:#fff;--accent:#c4501e;--sage:#3d7a4e;--red:#b3402e}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.55 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
main{max-width:1120px;margin:auto;padding:44px 34px 90px}h1{font-size:32px;margin:0 0 8px}h2{font-size:22px;margin:34px 0 14px}h3{margin:18px 0 8px}
code{font:12.5px ui-monospace,Consolas,monospace;background:#f1efe9;border-radius:4px;padding:1px 5px;overflow-wrap:anywhere}
.card{border:1px solid var(--line);background:var(--card);border-radius:14px;padding:20px;margin:14px 0}
.hero{padding:26px}.hero h1{margin-bottom:4px}
.meta{display:flex;flex-wrap:wrap;gap:8px 26px;margin:10px 0;padding:0}.meta div{min-width:180px}.meta dt{color:var(--accent);font:11px ui-monospace,monospace;letter-spacing:.8px;text-transform:uppercase}
.meta dd{margin:2px 0 0;font-family:ui-monospace,Consolas,monospace;font-size:12.5px;overflow-wrap:anywhere}
.badge{display:inline-block;padding:3px 10px;border:1px solid var(--line);border-radius:999px;font:600 12px ui-monospace,monospace;margin-right:6px}
.badge.pass{color:var(--sage);border-color:var(--sage)}.badge.fail{color:var(--red);border-color:var(--red)}.badge.awaiting,.badge.muted{color:var(--muted)}
.check{border:1px solid var(--line);border-radius:11px;background:var(--card);padding:14px 16px;margin:10px 0}
.check header{display:flex;justify-content:space-between;gap:12px;align-items:baseline}
.check-id{font:600 13px ui-monospace,monospace;color:var(--accent)}
.muted{color:var(--muted)}.fail{color:var(--red)}.awaiting{color:#8a6d1d}
.ledger{width:100%;border-collapse:collapse;margin:8px 0}.ledger th,.ledger td{padding:7px 9px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top;font-size:13.5px}
.ledger th{font:11px ui-monospace,monospace;letter-spacing:.6px;text-transform:uppercase;color:var(--muted)}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-top:14px}
.gallery figure{margin:0;border:1px solid var(--line);border-radius:11px;background:var(--card);padding:10px}
.gallery img{width:100%;height:auto;display:block;border-radius:7px;border:1px solid var(--line);background:#fff}
.gallery figcaption{font-size:12px;color:var(--muted);margin-top:6px;overflow-wrap:anywhere}
footer{margin-top:38px;color:var(--muted);font-size:12.5px;border-top:1px solid var(--line);padding-top:14px}
</style></head><body><main>
<header class="hero card"><h1>QA Report</h1>
<p class="muted">aes-qa 验收单一等伴随产物 · 模板复制渲染（零 LLM）· 单文件离线可开 · 随 receipt 同批作废</p>
__META__
</header>
__REPO_GATE__
__CHECKS__
__HUMAN__
__SCREENSHOT__
<footer>本页由 qa-report.mjs 从 qa-receipt.json 确定性投影生成；不发布任何 tracker。作废判据以 qa-receipt.json 的 candidateSha 为准（candidate 前进即整批 STALE_EVIDENCE）。</footer>
</main></body></html>`;

// receipt + 可选 shots-manifest → 单文件 HTML。纯函数：无 IO、无网络、无随机源。
export function renderQaReportHtml(receipt, shotsManifest = null) {
  return PAGE_TEMPLATE
    .replaceAll('__JOB_ID__', escapeHtml(receipt?.jobId ?? 'unknown'))
    .replaceAll('__ATTEMPT_ID__', escapeHtml(receipt?.attemptId ?? 'unknown'))
    .replaceAll('__META__', metaRow(receipt ?? {}))
    .replaceAll('__REPO_GATE__', repositoryGateSection(receipt?.repositoryGate))
    .replaceAll('__CHECKS__', checksSection(receipt ?? {}))
    .replaceAll('__HUMAN__', humanSection(receipt ?? {}))
    .replaceAll('__SCREENSHOT__', screenshotSection(receipt, shotsManifest));
}

export function readShotsManifest(dir) {
  const path = join(dir, 'shots-manifest.json');
  if (!existsSync(path)) return null;
  try {
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    return manifest?.schema === 'aes.qa.companion-shots-manifest/v1' ? manifest : null;
  } catch {
    return null;
  }
}

export function writeQaReport({ receiptPath, outDir = null }) {
  const receipt = JSON.parse(readFileSync(resolve(receiptPath), 'utf8'));
  const dir = outDir ? (isAbsolute(outDir) ? outDir : resolve(outDir)) : dirname(resolve(receiptPath));
  const html = renderQaReportHtml(receipt, readShotsManifest(dir));
  const target = join(dir, 'qa-report.html');
  writeFileSync(target, html, 'utf8');
  return { target, jobId: receipt.jobId, attemptId: receipt.attemptId, bytes: Buffer.byteLength(html, 'utf8') };
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--json') {
      values.json = true;
      continue;
    }
    if (token !== '--receipt' && token !== '--out') throw new Error(`unexpected argument: ${token}`);
    const value = argv[index + 1];
    if (!value) throw new Error(`missing value for ${token}`);
    values[token.slice(2)] = value;
    index += 1;
  }
  if (!values.receipt) throw new Error('--receipt <qa-receipt.json> is required');
  return values;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ schema: 'aes.qa-report-result/v1', resultKind: 'usage_error', error: error.message })}\n`);
    process.exit(64);
  }
  try {
    const result = writeQaReport({ receiptPath: args.receipt, outDir: args.out ?? null });
    process.stdout.write(`${JSON.stringify({ schema: 'aes.qa-report-result/v1', resultKind: 'success', ...result })}\n`);
    process.exit(0);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ schema: 'aes.qa-report-result/v1', resultKind: 'business_failure', error: error.message })}\n`);
    process.exit(65);
  }
}

if (isMain) {
  main();
}
