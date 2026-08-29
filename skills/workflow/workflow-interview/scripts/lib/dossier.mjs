// dossier.mjs — 决策档案投影库（家族真源 → 单页档案）
//
// 两载体共用的唯一投影实现：web 版（workflow-interview-web）的 export-static 与
// GET /export 直接 import 本文件，家族版走 scripts/export-dossier.mjs。真源只有
// 家族过程文件（manifest / rounds.jsonl / context / contract）与 web 提交证据
// （state / submissions / consumed / ledger），本库只读，不写任何真源。
//
// web state 缺失（纯对话载体）时，轨迹从 1-interview/rounds.jsonl 投影——决策档案
// 不依赖载体存在（issue #146 对齐裁决）。

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';

const TEXT_EXTENSIONS = new Set(['.md', '.json', '.jsonl', '.txt', '.html', '.css', '.mjs', '.js', '.yaml', '.yml', '.toml']);
const MIME_TYPES = new Map([
  ['.html', 'text/html;charset=utf-8'], ['.md', 'text/markdown;charset=utf-8'], ['.txt', 'text/plain;charset=utf-8'],
  ['.json', 'application/json'], ['.jsonl', 'application/x-ndjson'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'], ['.gif', 'image/gif'], ['.webp', 'image/webp'], ['.svg', 'image/svg+xml'],
  ['.pdf', 'application/pdf'], ['.css', 'text/css;charset=utf-8'], ['.js', 'text/javascript;charset=utf-8'],
  ['.mjs', 'text/javascript;charset=utf-8'], ['.yaml', 'text/yaml;charset=utf-8'], ['.yml', 'text/yaml;charset=utf-8'],
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

export function sha256File(pathname) {
  return createHash('sha256').update(readFileSync(pathname)).digest('hex');
}

function readJson(pathname, fallback = null) {
  if (!existsSync(pathname)) return fallback;
  try { return JSON.parse(readFileSync(pathname, 'utf8')); }
  catch { return fallback; }
}

function readText(pathname) {
  return existsSync(pathname) ? readFileSync(pathname, 'utf8') : null;
}

export function readLedger(webDir) {
  const pathname = join(webDir, 'decision-ledger.jsonl');
  if (!existsSync(pathname)) return [];
  return readFileSync(pathname, 'utf8').split(/\r?\n/).filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

function listJsonDirectory(directory) {
  if (!existsSync(directory)) return {};
  return Object.fromEntries(readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => [entry.name.slice(0, -5), readJson(join(directory, entry.name), {})]));
}

function walkFiles(directory, root = directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const pathname = join(directory, entry.name);
    const info = lstatSync(pathname);
    if (info.isSymbolicLink()) continue;
    if (entry.isDirectory()) files.push(...walkFiles(pathname, root));
    else if (entry.isFile()) files.push({ pathname, relative_path: relative(root, pathname).replaceAll('\\', '/') });
  }
  return files;
}

function fileRecord(pathname, root, embed) {
  const extension = extname(pathname).toLowerCase();
  const mime = MIME_TYPES.get(extension) ?? 'application/octet-stream';
  const info = statSync(pathname);
  const record = {
    path: relative(root, pathname).replaceAll('\\', '/'),
    name: basename(pathname),
    mime,
    bytes: info.size,
    sha256: sha256File(pathname),
  };
  if (TEXT_EXTENSIONS.has(extension) && info.size <= 2_000_000) record.text = readFileSync(pathname, 'utf8');
  if (embed) record.data_url = `data:${mime};base64,${readFileSync(pathname).toString('base64')}`;
  return record;
}

function collectSources(issueDir, embedAssets) {
  const sourceRoots = ['1-interview', '2-prototype', '3-contract'];
  const sources = [];
  for (const name of sourceRoots) {
    const directory = join(issueDir, name);
    for (const file of walkFiles(directory, issueDir)) sources.push(fileRecord(file.pathname, issueDir, embedAssets));
  }
  const assetsDir = join(issueDir, 'web', 'assets');
  for (const file of walkFiles(assetsDir, issueDir)) sources.push(fileRecord(file.pathname, issueDir, embedAssets));
  return sources.sort((a, b) => a.path.localeCompare(b.path));
}

// ─────────────────────── 家族载体投影（无 web state 时） ───────────────────────

const PHASE_LABELS = { '1-interview': '访谈·拷问', '2-prototype': '原型确认', '3-contract': '交付标准·契约' };

function projectPhases(manifest) {
  const gates = manifest?.stage_gates;
  if (!gates) return [];
  const rank = { done: 'done', skipped: 'skipped', needs_reinterview: 'needs_reinterview', in_progress: 'active' };
  return Object.keys(PHASE_LABELS).map((id) => ({
    id,
    label: PHASE_LABELS[id],
    status: rank[gates[id]?.status] ?? 'pending',
  }));
}

function readFamilyRounds(issueDir) {
  const pathname = join(issueDir, '1-interview', 'rounds.jsonl');
  if (!existsSync(pathname)) return [];
  return readFileSync(pathname, 'utf8').split(/\r?\n/).filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

/**
 * rounds.jsonl → 页面轨迹。行字段表见 aes-interview 的 SKILL.md；答案从 user_choice /
 * user_verbatim / user / choices 还原成与 web submission 同构的 answers，渲染层无需
 * 区分载体。返回 null 表示盘上没有家族轮次（空 issue）。
 */
function projectFamilyTrajectory(issueDir) {
  const rows = readFamilyRounds(issueDir);
  if (rows.length === 0) return null;
  const groups = new Map();
  for (const row of rows) {
    const no = Number(row.round);
    const key = `${row.stage}#${no}`;
    if (!groups.has(key)) {
      groups.set(key, { id: `${row.stage}-r${no}`, no, stage: row.stage, title: `第 ${no} 轮`, status: 'done', items: [], answers: [] });
    }
    const group = groups.get(key);
    const qId = row.q_id ?? `${row.tier === 'ask' ? 'Q' : 'D'}${group.items.length + 1}`;
    if (row.tier === 'ask') {
      group.items.push({
        q_id: qId,
        tier: 'ask',
        question: row.question,
        known_facts: row.known_facts,
        irreversible: row.irreversible,
        allow_custom: row.allow_custom,
        required: row.required,
        response: row.response,
        options: row.options,
        triggered_by: row.triggered_by,
        cross_repo_boundary: row.cross_repo_boundary,
      });
      if (Array.isArray(row.choices)) group.answers.push({ q_id: qId, type: 'multi', choices: row.choices, custom: row.custom });
      else if (row.user_choice !== undefined && row.user_choice !== 'custom') group.answers.push({ q_id: qId, type: 'choice', choice: row.user_choice });
      else if (row.user_verbatim !== undefined || row.user_choice === 'custom') group.answers.push({ q_id: qId, type: 'custom', text: row.user_verbatim ?? '' });
    } else {
      group.items.push({
        q_id: qId,
        tier: row.tier,
        line: [row.item, row.why, row.cost ? `代价：${row.cost}` : ''].filter(Boolean).join(' — '),
        irreversible: row.irreversible,
        triggered_by: row.triggered_by,
        cross_repo_boundary: row.cross_repo_boundary,
      });
      if (row.user !== undefined) {
        const answer = row.user === '未反对' ? { type: 'accept' } : row.user === '确认' ? { type: 'confirm' } : { type: 'veto', text: row.user };
        group.answers.push({ q_id: qId, ...answer });
      }
    }
  }
  const rounds = [...groups.values()].sort((a, b) => a.no - b.no);
  const answered = new Set(rounds.flatMap((round) => round.answers.map((answer) => answer.q_id)));
  const openAmbiguities = rounds.reduce(
    (sum, round) => sum + round.items.filter((item) => item.tier !== 'default' && !answered.has(item.q_id)).length,
    0,
  );
  const submissions = Object.fromEntries(rounds.map((round) => [round.id, { answers: round.answers }]));
  return { rounds, submissions, open_ambiguities: openAmbiguities };
}

/** contract.md 的 ## 节 → final 视图。只在 finalize 校验通过后投影为契约，未过校验仍是候选。 */
function projectContractFinal(md, slug) {
  if (!md) return null;
  const sections = [];
  let current = null;
  for (const line of md.split(/\r?\n/)) {
    const heading = /^##\s+(.+)$/.exec(line);
    if (heading) {
      if (current?.body?.trim()) sections.push(current);
      current = { title: heading[1].trim(), body: '' };
    } else if (current) {
      current.body += (current.body ? '\n' : '') + line;
    }
  }
  if (current?.body?.trim()) sections.push(current);
  if (sections.length === 0) return null;
  return {
    round: 'contract-family',
    title: `目标契约 · ${slug}`,
    subtitle: '三阶段收口 · 家族载体',
    sections: sections.map((section) => ({ title: section.title, body: section.body.trim() })),
  };
}

function traceability(state, submissions) {
  const rows = [];
  for (const round of state?.rounds ?? []) {
    const answerById = new Map((submissions[round.id]?.answers ?? []).map((answer) => [answer.q_id, answer]));
    for (const item of round.items ?? []) {
      rows.push({
        id: item.q_id,
        stage: round.stage,
        round: round.id,
        source_refs: item.source_refs ?? (item.triggered_by ? [item.triggered_by] : []),
        maps_to: item.maps_to ?? [],
        answer: answerById.get(item.q_id) ?? null,
      });
    }
  }
  for (const section of state?.final?.sections ?? []) {
    rows.push({
      id: section.id ?? section.title,
      stage: '3-contract',
      round: state.final.round,
      source_refs: section.source_refs ?? (section.basis ? [section.basis] : []),
      maps_to: section.maps_to ?? [],
      answer: null,
    });
  }
  return rows;
}

export function buildDossier(issueDirInput, { embedAssets = false } = {}) {
  const issueDir = resolve(issueDirInput);
  const webDir = join(issueDir, 'web');
  const manifest = readJson(join(issueDir, 'manifest.json'), null);
  const webState = readJson(join(webDir, 'state.json'), null);
  let submissions = listJsonDirectory(join(webDir, 'submissions'));
  const consumed = listJsonDirectory(join(webDir, 'consumed'));
  let state = webState;
  if (!state) {
    const family = projectFamilyTrajectory(issueDir);
    state = {
      schema_version: 2,
      slug: basename(issueDir),
      opening: manifest?.original_request ?? null,
      phases: projectPhases(manifest),
      open_ambiguities: family?.open_ambiguities ?? 0,
      rounds: family?.rounds ?? [],
      locked: [],
      final: null,
    };
    submissions = family?.submissions ?? {};
  }
  const contractMarkdown = readText(join(issueDir, '3-contract', 'contract.md'));
  if (!state.final && contractMarkdown && manifest?.validation?.status === 'valid') {
    state.final = projectContractFinal(contractMarkdown, state.slug);
  }
  const sources = collectSources(issueDir, embedAssets);
  const base = {
    schema_version: 2,
    kind: 'goal-contract-decision-dossier',
    slug: state.slug ?? basename(issueDir),
    title: state.dossier?.title ?? state.slug ?? basename(issueDir),
    generated_at: new Date().toISOString(),
    status: state.final ? 'contract' : state.open_ambiguities === 0 ? 'aligned' : 'in-progress',
    state,
    manifest,
    context_markdown: readText(join(issueDir, '1-interview', 'context.md')),
    contract_markdown: contractMarkdown,
    submissions,
    consumed,
    ledger: readLedger(webDir),
    sources,
    traceability: traceability(state, submissions),
  };
  base.state_digest = sha256Json(state);
  base.dossier_digest = sha256Json({ ...base, generated_at: null, sources: sources.map(({ data_url: _data, ...source }) => source) });
  return base;
}

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function renderMarkdown(source) {
  const lines = String(source ?? '').replaceAll('\r\n', '\n').split('\n');
  const output = [];
  let list = null;
  let paragraph = [];
  let code = null;
  const flushParagraph = () => {
    if (paragraph.length) output.push(`<p>${escapeHtml(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) output.push(`<${list.tag}>${list.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  for (const raw of lines) {
    if (/^```/.test(raw.trim())) {
      flushParagraph(); flushList();
      if (code) { output.push(`<pre>${escapeHtml(code.join('\n'))}</pre>`); code = null; }
      else code = [];
      continue;
    }
    if (code) { code.push(raw); continue; }
    const heading = raw.match(/^(#{1,4})\s+(.+)$/);
    const unordered = raw.match(/^\s*[-*]\s+(.+)$/);
    const ordered = raw.match(/^\s*\d+[.)]\s+(.+)$/);
    const quote = raw.match(/^>\s?(.+)$/);
    if (!raw.trim()) { flushParagraph(); flushList(); continue; }
    if (heading) {
      flushParagraph(); flushList();
      const level = Math.min(heading[1].length + 1, 5);
      output.push(`<h${level}>${escapeHtml(heading[2])}</h${level}>`);
    } else if (unordered || ordered) {
      flushParagraph();
      const tag = ordered ? 'ol' : 'ul';
      if (list && list.tag !== tag) flushList();
      list ??= { tag, items: [] };
      list.items.push((unordered ?? ordered)[1]);
    } else if (quote) {
      flushParagraph(); flushList();
      output.push(`<blockquote>${escapeHtml(quote[1])}</blockquote>`);
    } else {
      flushList(); paragraph.push(raw.trim());
    }
  }
  if (code) output.push(`<pre>${escapeHtml(code.join('\n'))}</pre>`);
  flushParagraph(); flushList();
  return `<div class="markdown">${output.join('')}</div>`;
}

function booleanLabelsFor(item) {
  if (item?.response?.type !== 'boolean') return undefined;
  const options = item.options ?? [];
  const trueOption = options.find((option, index) => option.value ?? index === 0);
  const falseOption = options.find((option, index) => !(option.value ?? index === 0));
  return [
    trueOption?.text ?? item.response.true_label ?? '是',
    falseOption?.text ?? item.response.false_label ?? '否',
  ];
}

function answerSummary(answer, booleanLabels) {
  if (!answer) return '尚未回答';
  if (answer.type === 'choice') return `选择 ${answer.choice}`;
  if (answer.type === 'multi') return `选择 ${answer.choices.join('、')}${answer.custom ? `；补充：${answer.custom}` : ''}`;
  if (answer.type === 'custom' || answer.type === 'veto') return answer.text;
  if (answer.type === 'text') return answer.value;
  if (answer.type === 'number') return `${answer.value}${answer.unit ? ` ${answer.unit}` : ''}`;
  if (answer.type === 'date_time') return answer.value;
  if (answer.type === 'ranking') return answer.choices.join(' → ');
  if (answer.type === 'evidence') return answer.values.join('；');
  if (answer.type === 'boolean') return answer.value ? booleanLabels?.[0] ?? '是' : booleanLabels?.[1] ?? '否';
  if (answer.type === 'confirm') return '明确确认';
  if (answer.type === 'accept') return '未反对，按默认接受';
  return JSON.stringify(answer);
}

function renderOptions(item, answer) {
  const selected = new Set(answer?.type === 'choice' ? [answer.choice] : answer?.type === 'multi' ? answer.choices : []);
  if (!(item.options ?? []).length) return '';
  return `<div class="option-records">${item.options.map((option) => `
    <article class="option-record ${selected.has(option.key) ? 'selected' : ''}">
      <header><strong>${selected.has(option.key) ? '✓ ' : ''}${escapeHtml(option.key)}. ${escapeHtml(option.text)}</strong>${option.pct !== undefined ? `<span>${escapeHtml(option.pct)}%</span>` : ''}</header>
      <dl><div><dt>覆盖</dt><dd>${escapeHtml(option.covers || '未说明')}</dd></div><div><dt>好处</dt><dd>${escapeHtml(option.pros?.join(' · ') || '未说明')}</dd></div><div><dt>代价</dt><dd>${escapeHtml(option.cons?.join(' · ') || '未说明')}</dd></div></dl>
    </article>`).join('')}</div>`;
}

function renderRound(round, submission) {
  const answers = new Map((submission?.answers ?? []).map((answer) => [answer.q_id, answer]));
  return `<section class="round" id="round-${escapeHtml(round.id)}">
    <header class="round-head"><div><span>${escapeHtml(round.stage)}</span><h2>Round ${escapeHtml(round.no)} · ${escapeHtml(round.title)}</h2></div><strong>${escapeHtml(round.status)}</strong></header>
    ${(round.items ?? []).map((item) => {
      const answer = answers.get(item.q_id);
      return `<article class="decision" id="decision-${escapeHtml(item.q_id)}">
        <header><span>${escapeHtml(item.q_id)} · ${escapeHtml(item.tier)}</span><h3>${escapeHtml(item.question ?? item.line)}</h3></header>
        ${item.known_facts ? `<p class="facts">已知事实：${escapeHtml(item.known_facts)}</p>` : ''}
        ${renderOptions(item, answer)}
        <p class="answer"><strong>用户决定</strong>${escapeHtml(answerSummary(answer, booleanLabelsFor(item)))}</p>
        ${(item.source_refs?.length || item.triggered_by) ? `<p class="trace">来源：${escapeHtml((item.source_refs ?? [item.triggered_by]).join(' · '))}</p>` : ''}
      </article>`;
    }).join('')}
  </section>`;
}

function renderFinal(final) {
  if (!final) return '<section><h2>当前 Goal Contract</h2><p class="muted">尚未定稿契约。</p></section>';
  return `<section id="contract"><h2>${escapeHtml(final.title)}</h2><p class="muted">${escapeHtml(final.subtitle ?? '')}</p>
    ${(final.sections ?? []).map((section) => `<article class="contract-section"><h3>${escapeHtml(section.title)}</h3>${section.body ? renderMarkdown(section.body) : ''}${section.bullets?.length ? `<ul>${section.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}${section.basis ? `<p class="trace">依据：${escapeHtml(section.basis)}</p>` : ''}</article>`).join('')}
  </section>`;
}

function renderSources(sources) {
  if (!sources.length) return '<p class="muted">没有已发布来源文件。</p>';
  return sources.map((source) => `<details><summary>${escapeHtml(source.path)} · ${source.bytes} bytes · ${escapeHtml(source.sha256.slice(0, 12))}</summary>${source.text !== undefined ? `<pre>${escapeHtml(source.text)}</pre>` : source.data_url ? `<p><a download="${escapeHtml(source.name)}" href="${source.data_url}">下载内嵌文件</a></p>` : '<p>二进制文件，仅记录摘要。</p>'}</details>`).join('');
}

export function renderDossierHtml(dossier) {
  const machineJson = JSON.stringify(dossier).replaceAll('<', '\\u003c');
  const phases = dossier.state.phases ?? [];
  const submissions = dossier.submissions ?? {};
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>${escapeHtml(dossier.title)}</title>
<style>
:root{--paper:#faf9f6;--ink:#201d18;--muted:#766f65;--line:#e5e2dc;--card:#fff;--accent:#c4501e;--sage:#3d7a4e}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.55 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}main{max-width:1120px;margin:auto;padding:44px 34px 90px}h1{font-size:34px;margin:0 0 8px}h2{font-size:24px;margin:38px 0 16px}h3{margin:0;font-size:17px}.hero,.round,.contract-section,.decision,details,.manifest{border:1px solid var(--line);background:var(--card);border-radius:14px}.hero{padding:26px}.meta,.phase-row{display:flex;flex-wrap:wrap;gap:8px}.chip{padding:4px 10px;border:1px solid var(--line);border-radius:999px;font-size:12px}.round{padding:22px;margin:18px 0}.round-head,.decision>header,.option-record header{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.round-head span,.decision>header span,dt{color:var(--accent);font:11px ui-monospace,monospace;letter-spacing:.8px}.decision{padding:18px;margin:14px 0}.facts,.muted,.trace{color:var(--muted)}.option-records{display:grid;gap:8px;margin:12px 0}.option-record{border:1px solid var(--line);border-radius:11px;padding:12px}.option-record.selected{border:2px solid var(--ink);background:#f5f3ee}.option-record dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin:10px 0 0}.option-record dl div{padding:0 12px;border-left:1px solid var(--line)}.option-record dl div:first-child{padding-left:0;border-left:0}dd{margin:3px 0 0}.answer{display:grid;grid-template-columns:110px 1fr;gap:12px;padding:10px 12px;border-radius:9px;background:#f5f3ee}.contract-section{padding:18px;margin:12px 0}details{margin:8px 0;padding:10px 12px}summary{cursor:pointer;font-weight:650}pre{overflow:auto;white-space:pre-wrap}.ledger{width:100%;border-collapse:collapse}.ledger th,.ledger td{padding:8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.manifest{padding:16px;font:12px ui-monospace,monospace;overflow-wrap:anywhere}@media(max-width:760px){main{padding:26px 16px}.option-record dl{grid-template-columns:1fr}.option-record dl div{padding:8px 0 0;border-left:0;border-top:1px solid var(--line)}.option-record dl div:first-child{border-top:0}.answer{grid-template-columns:1fr}}@media print{body{background:#fff}main{max-width:none;padding:0}.hero,.round,.decision,.contract-section,details{break-inside:avoid;box-shadow:none}details>pre{display:block}summary{list-style:none}}
.markdown{line-height:1.7}.markdown h2,.markdown h3,.markdown h4,.markdown h5{margin:1.25rem 0 .45rem}.markdown h2:first-child,.markdown h3:first-child{margin-top:0}.markdown p,.markdown ul,.markdown ol{margin:.45rem 0}.markdown blockquote{margin:.75rem 0;padding:.7rem .9rem;border-left:3px solid var(--accent);background:#f5f3ee}
</style></head><body><main>
<section class="hero"><p>GOAL CONTRACT · DECISION DOSSIER</p><h1>${escapeHtml(dossier.title)}</h1><p>${escapeHtml(dossier.state.opening ?? '未记录原始请求')}</p><div class="meta"><span class="chip">状态 ${escapeHtml(dossier.status)}</span><span class="chip">开放歧义 ${escapeHtml(dossier.state.open_ambiguities)}</span><span class="chip">State ${dossier.state_digest.slice(0, 12)}</span><span class="chip">Dossier ${dossier.dossier_digest.slice(0, 12)}</span></div><div class="phase-row">${phases.map((phase) => `<span class="chip">${escapeHtml(phase.label)} · ${escapeHtml(phase.status)}</span>`).join('')}</div></section>
<section><h2>原始请求与上下文</h2>${dossier.context_markdown ? renderMarkdown(dossier.context_markdown) : `<p>${escapeHtml(dossier.state.opening ?? '')}</p>`}</section>
<section id="trajectory"><h2>完整需求轨迹</h2>${(dossier.state.rounds ?? []).map((round) => renderRound(round, submissions[round.id])).join('') || '<p class="muted">尚无轮次记录。</p>'}</section>
${renderFinal(dossier.state.final)}
${dossier.contract_markdown ? `<section><h2>契约原文</h2>${renderMarkdown(dossier.contract_markdown)}</section>` : ''}
<section><h2>来源、原型与附件</h2>${renderSources(dossier.sources)}</section>
<section><h2>溯源账本</h2>${dossier.ledger.length ? `<table class="ledger"><thead><tr><th>时间</th><th>事件</th><th>主体</th><th>摘要</th></tr></thead><tbody>${dossier.ledger.map((event) => `<tr><td>${escapeHtml(event.at)}</td><td>${escapeHtml(event.type)}</td><td>${escapeHtml(event.actor?.id)}</td><td>${escapeHtml(event.entity?.id ?? event.round ?? '')}<br><small>${escapeHtml(event.event_digest?.slice(0, 16))}</small></td></tr>`).join('')}</tbody></table>` : '<p class="muted">纯对话载体没有 Web 提交事件；过程账本即 1-interview/rounds.jsonl，见上方来源清单。</p>'}</section>
<section><h2>追踪矩阵</h2><table class="ledger"><thead><tr><th>ID</th><th>阶段/轮次</th><th>来源</th><th>映射到</th><th>决定</th></tr></thead><tbody>${dossier.traceability.map((row) => `<tr><td>${escapeHtml(row.id)}</td><td>${escapeHtml(row.stage)} / ${escapeHtml(row.round)}</td><td>${escapeHtml(row.source_refs.join(' · ') || '未显式关联')}</td><td>${escapeHtml(row.maps_to.join(' · ') || '未显式关联')}</td><td>${escapeHtml(answerSummary(row.answer))}</td></tr>`).join('')}</tbody></table></section>
<section><h2>导出清单</h2><div class="manifest">schema=2<br>generated_at=${escapeHtml(dossier.generated_at)}<br>state_sha256=${dossier.state_digest}<br>dossier_sha256=${dossier.dossier_digest}<br>ledger_events=${dossier.ledger.length}<br>sources=${dossier.sources.length}</div></section>
<script type="application/json" id="decision-dossier-data">${machineJson}</script>
</main></body></html>`;
}

export function exportDossier(issueDir, outputPath) {
  const dossier = buildDossier(issueDir, { embedAssets: true });
  // web 载体默认进 web/exports；纯对话载体没有 web/，落在 issue 根目录与家族产物同层。
  const fallback = existsSync(join(issueDir, 'web'))
    ? join(issueDir, 'web', 'exports', `${dossier.slug}-decision-dossier.html`)
    : join(issueDir, 'dossier.html');
  const pathname = resolve(outputPath ?? fallback);
  mkdirSync(dirname(pathname), { recursive: true });
  const temporary = `${pathname}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  writeFileSync(temporary, renderDossierHtml(dossier), 'utf8');
  renameSync(temporary, pathname);
  return { pathname, dossier };
}

export function safeExportPath(issueDir, requested) {
  const exportsDir = resolve(join(issueDir, 'web', 'exports'));
  const target = resolve(exportsDir, requested);
  if (!target.startsWith(`${exportsDir}${sep}`)) return null;
  return target;
}
