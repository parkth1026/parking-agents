// dossier.mjs — 决策档案投影库（家族真源 → 单页档案）
//
// 家族版 scripts/export-dossier.mjs 直接 import 本文件。web 版（workflow-interview-web）
// 的 scripts/lib/dossier.mjs 是 2026-08-30 拷走的独立副本，仍保留「内嵌正文与 base64」
// 的旧投影；两份尚未合并，改本文件不会自动影响 web 载体（见 references/design.md）。
// 真源只有家族过程文件（manifest / rounds.jsonl / context / contract）与 web 提交证据
// （state / submissions / consumed / ledger），本库只读，不写任何真源。
//
// 档案是契约的轻量可视化预览：轨迹、原型结果、契约与校验结果投影进页面；来源文件
// （mock / diagram / 附件）按相对路径引用，不内嵌——档案必须与 issue 目录同放。
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
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const MIME_TYPES = new Map([
  ['.html', 'text/html;charset=utf-8'], ['.md', 'text/markdown;charset=utf-8'], ['.txt', 'text/plain;charset=utf-8'],
  ['.json', 'application/json'], ['.jsonl', 'application/x-ndjson'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'], ['.gif', 'image/gif'], ['.webp', 'image/webp'], ['.svg', 'image/svg+xml'],
  ['.pdf', 'application/pdf'], ['.css', 'text/css;charset=utf-8'], ['.js', 'text/javascript;charset=utf-8'],
  ['.mjs', 'text/javascript;charset=utf-8'], ['.yaml', 'text/yaml;charset=utf-8'], ['.yml', 'text/yaml;charset=utf-8'],
]);

/** 投影进档案正文的 markdown 上限：超过的只给链接，避免一份大文档在页面与机器 JSON 里各出现一遍。 */
const MARKDOWN_LIMIT = 2_000_000;

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

/** JSONL 逐行解析，坏行跳过：账本与家族轮次共用。 */
function readJsonl(pathname) {
  if (!existsSync(pathname)) return [];
  return readFileSync(pathname, 'utf8').split(/\r?\n/).filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

export function readLedger(webDir) {
  return readJsonl(join(webDir, 'decision-ledger.jsonl'));
}

function listJsonDirectory(directory) {
  if (!existsSync(directory)) return {};
  return Object.fromEntries(readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => [entry.name.slice(0, -5), readJson(join(directory, entry.name), {})]));
}

/** 递归列文件（不跟符号链接），每项带一次 lstat 得到的字节数，调用方不必再 stat。 */
function walkFiles(directory, root = directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const pathname = join(directory, entry.name);
    const info = lstatSync(pathname);
    if (info.isSymbolicLink()) continue;
    if (entry.isDirectory()) files.push(...walkFiles(pathname, root));
    else if (entry.isFile()) files.push({ pathname, relative_path: relative(root, pathname).replaceAll('\\', '/'), bytes: info.size });
  }
  return files;
}

/** 来源记录只登记路径、类型、字节数与 sha256——正文不进档案，页面按相对路径引用（见 renderSources）。 */
function fileRecord(file) {
  return {
    path: file.relative_path,
    name: basename(file.pathname),
    mime: MIME_TYPES.get(extname(file.pathname).toLowerCase()) ?? 'application/octet-stream',
    bytes: file.bytes,
    sha256: sha256File(file.pathname),
  };
}

function collectSources(issueDir) {
  const roots = ['1-interview', '2-prototype', '3-contract', join('web', 'assets')];
  return roots
    .flatMap((name) => walkFiles(join(issueDir, name), issueDir))
    .map(fileRecord)
    .sort((a, b) => a.path.localeCompare(b.path));
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

/**
 * rounds.jsonl → 页面轨迹。行字段表见 aes-interview 的 SKILL.md；答案从 user_choice /
 * user_verbatim / user / choices 还原成与 web submission 同构的 answers，渲染层无需
 * 区分载体。返回 null 表示盘上没有家族轮次（空 issue）。
 */
function projectFamilyTrajectory(issueDir) {
  const rows = readJsonl(join(issueDir, '1-interview', 'rounds.jsonl'));
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

/** 确认版对照物的固定顺序与中文标题：key 与 aes-prototype `--artifacts` 登记的名字一致。
 * diagram-detail 是独立登记项（拆图时 `--artifacts diagram,diagram-detail`），不由 diagram 推断。 */
const PROTOTYPE_ARTIFACTS = [
  ['mock', 'mock.html', '界面 mock（确认版）'],
  ['behavior', 'behavior.md', '行为对照表'],
  ['api-mock', 'api-mock.md', '接口报文对'],
  ['example-run', 'example-run.md', '可执行示例'],
  ['diagram', 'diagram.html', '架构与流程图'],
  ['diagram-detail', 'diagram-detail.html', '架构细节图'],
  ['impact-surface', 'impact-surface.md', '影响面扫描'],
];

/** manifest 里 artifacts_confirmed 的名字口径与 session.mjs 一致：可带或不带扩展名、不分大小写。 */
function artifactKey(name) {
  return String(name).replace(/\.(md|html)$/i, '').toLowerCase();
}

/** 2-prototype 阶段的结果投影：门禁记录、确认版对照物（固定顺序）、目录里其余顶层产物、草稿清单。
 * markdown / json 对照物的正文投影进档案（超过 MARKDOWN_LIMIT 的只给链接）；HTML 原型不内嵌，按相对路径 iframe 引用。 */
function projectPrototype(issueDir, manifest) {
  const dir = join(issueDir, '2-prototype');
  if (!existsSync(dir)) return null;
  const gate = manifest?.stage_gates?.['2-prototype'] ?? null;
  const confirmed = new Set((gate?.artifacts_confirmed ?? []).map(artifactKey));
  const entries = new Map(readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => [entry.name, entry]));
  const seen = new Set();
  const artifacts = [];
  const push = (key, name, title) => {
    if (!entries.has(name)) return;
    seen.add(name);
    const pathname = join(dir, name);
    const extension = extname(name).toLowerCase();
    const kind = extension === '.html' ? 'html' : extension === '.md' ? 'markdown' : extension === '.json' ? 'json' : 'file';
    const bytes = statSync(pathname).size;
    const record = { key, path: `2-prototype/${name}`, title, bytes, confirmed: confirmed.has(artifactKey(key)), kind };
    if (kind === 'markdown' && bytes <= MARKDOWN_LIMIT) record.markdown = readText(pathname);
    if (kind === 'json' && bytes <= MARKDOWN_LIMIT) record.json = readJson(pathname, null);
    artifacts.push(record);
  };
  for (const [key, name, title] of PROTOTYPE_ARTIFACTS) push(key, name, title);
  for (const name of [...entries.keys()].sort((a, b) => a.localeCompare(b))) {
    if (!seen.has(name)) push(name.replace(/\.[^.]+$/, ''), name, name);
  }
  const drafts = walkFiles(join(dir, 'drafts'), issueDir).map((file) => file.relative_path).sort();
  return { gate, artifacts, drafts };
}

/** 3-contract 阶段除 contract.md 之外的结果：分里程碑契约、交付图、候选清单等 markdown 各自投影；
 * verify.txt 是验收命令的实跑记录，单独原样给出；脚本与冻结规格只登记为文件。门禁与校验结果取自 manifest。 */
function projectContractExtra(issueDir, manifest) {
  const dir = join(issueDir, '3-contract');
  if (!existsSync(dir)) return null;
  const documents = [];
  const files = [];
  for (const file of walkFiles(dir, issueDir)) {
    const name = basename(file.pathname);
    if (dirname(file.pathname) !== dir || name === 'contract.md' || name === 'verify.txt') continue;
    const record = { path: file.relative_path, name, bytes: file.bytes };
    if (/\.md$/i.test(name) && file.bytes <= MARKDOWN_LIMIT) documents.push({ ...record, markdown: readText(file.pathname) });
    else files.push(record);
  }
  return {
    gate: manifest?.stage_gates?.['3-contract'] ?? null,
    validation: manifest?.validation ?? null,
    next_action: manifest?.next_action ?? null,
    verify_text: readText(join(dir, 'verify.txt')),
    documents,
    files,
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

export function buildDossier(issueDirInput) {
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
    prototype: projectPrototype(issueDir, manifest),
    contract_extra: projectContractExtra(issueDir, manifest),
    submissions,
    consumed,
    ledger: readLedger(webDir),
    sources: collectSources(issueDir),
    traceability: traceability(state, submissions),
  };
  base.state_digest = sha256Json(state);
  // 投影摘要：对同一 issue 内容确定（键序稳定、时间置空），不含导出位置（sourceBase），
  // 因而同一 issue 导出到不同目录 HTML 不同而 digest 相同。它不是 dossier.html 的文件 sha256。
  base.dossier_digest = sha256Json({ ...base, generated_at: null });
  return base;
}

// ─────────────────────────────── 渲染 ───────────────────────────────

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/** 链接目标只放行 http(s)、mailto、页内锚点与相对路径；其余 scheme 原样当文本。
 * 来源是用户自己 issue 目录的 markdown，风险低，这只是卫生措施。 */
function safeHref(target) {
  if (/^(https?:|mailto:|#)/i.test(target)) return target;
  return /^[a-z][\w+.-]*:/i.test(target) ? null : target;
}

/** 行内：反引号代码、粗体、链接。一次交替扫描：代码 span 命中即原样输出，里面的方括号与星号不再解析。
 * 页内锚点（# 开头）在本页打开，其余链接开新标签。 */
function inlineMarkdown(text) {
  const escaped = escapeHtml(text);
  return escaped.replace(/(`[^`]+`)|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g, (match, code, strong, label, target) => {
    if (code) return `<code>${code.slice(1, -1)}</code>`;
    if (strong) return `<strong>${strong}</strong>`;
    const href = safeHref(target);
    if (!href) return match;
    return href.startsWith('#') ? `<a href="${href}">${label}</a>` : `<a href="${href}" target="_blank" rel="noopener">${label}</a>`;
  });
}

/** 只认「以 | 开头」的管道表格（GFM 子集）；`\|` 是单元格内的字面管道；分隔行允许单个 `-`。 */
const TABLE_SEPARATOR = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/;

function tableCells(line) {
  return line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '').split(/(?<!\\)\|/).map((cell) => cell.replace(/\\\|/g, '|').trim());
}

function renderTable(rows) {
  const hasHeader = rows.length > 1 && TABLE_SEPARATOR.test(rows[1].trim());
  const header = hasHeader ? `<thead><tr>${tableCells(rows[0]).map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join('')}</tr></thead>` : '';
  const body = rows.slice(hasHeader ? 2 : 0).filter((line) => !TABLE_SEPARATOR.test(line.trim())).map((line) => `<tr>${tableCells(line).map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join('')}</tr>`).join('');
  return `<div class="table-wrap"><table class="md">${header}<tbody>${body}</tbody></table></div>`;
}

/** 契约与对照物用的 markdown 子集：标题、段落、有序/无序列表（不支持缩进续行）、引用、围栏代码、
 * 管道表格、分隔线、行内格式。headingIds 给出前缀时，每个二级标题得到 `${prefix}-${序号}` 的 id；
 * headings 数组给出时把这些二级标题按同一序号顺序推进去——目录只能从这里取，围栏代码里的 `## ` 不算标题。 */
function renderMarkdown(source, { headingIds = null, headings = null } = {}) {
  const lines = String(source ?? '').replaceAll('\r\n', '\n').split('\n');
  const output = [];
  let list = null;
  let paragraph = [];
  let code = null;
  let table = null;
  let quote = null;
  let headingIndex = 0;
  const flushParagraph = () => {
    if (paragraph.length) output.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) output.push(`<${list.tag}>${list.items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  const flushTable = () => {
    if (table) output.push(renderTable(table));
    table = null;
  };
  const flushQuote = () => {
    if (quote) output.push(`<blockquote>${quote.map((lines) => `<p>${inlineMarkdown(lines.join(' '))}</p>`).join('')}</blockquote>`);
    quote = null;
  };
  const flushBlocks = () => { flushParagraph(); flushList(); flushTable(); flushQuote(); };
  for (const raw of lines) {
    if (/^```/.test(raw.trim())) {
      flushBlocks();
      if (code) { output.push(`<pre>${escapeHtml(code.join('\n'))}</pre>`); code = null; }
      else code = [];
      continue;
    }
    if (code) { code.push(raw); continue; }
    if (raw.trim().startsWith('|')) {
      flushParagraph(); flushList(); flushQuote();
      (table ??= []).push(raw);
      continue;
    }
    flushTable();
    const quoted = raw.match(/^>\s?(.*)$/);
    if (quoted) {
      flushParagraph(); flushList();
      quote ??= [[]];
      if (quoted[1].trim()) quote[quote.length - 1].push(quoted[1].trim());
      else if (quote[quote.length - 1].length) quote.push([]);
      continue;
    }
    flushQuote();
    if (!raw.trim()) { flushParagraph(); flushList(); continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(raw)) { flushParagraph(); flushList(); output.push('<hr>'); continue; }
    const heading = raw.match(/^(#{1,4})\s+(.+)$/);
    const unordered = raw.match(/^\s*[-*]\s+(.+)$/);
    const ordered = raw.match(/^\s*\d+[.)]\s+(.+)$/);
    if (heading) {
      flushParagraph(); flushList();
      const level = Math.min(heading[1].length + 1, 5);
      let id = '';
      if (heading[1].length === 2) {
        if (headingIds) id = ` id="${headingIds}-${headingIndex}"`;
        headings?.push({ index: headingIndex, title: heading[2].trim() });
        headingIndex += 1;
      }
      output.push(`<h${level}${id}>${inlineMarkdown(heading[2])}</h${level}>`);
    } else if (unordered || ordered) {
      flushParagraph();
      const tag = ordered ? 'ol' : 'ul';
      if (list && list.tag !== tag) flushList();
      list ??= { tag, items: [] };
      list.items.push((unordered ?? ordered)[1]);
    } else {
      flushList(); paragraph.push(raw.trim());
    }
  }
  if (code) output.push(`<pre>${escapeHtml(code.join('\n'))}</pre>`);
  flushBlocks();
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

/** web state 自带 final（sections 已结构化）而盘上没有 contract.md 时的契约投影。 */
function renderFinal(final) {
  return `<section id="contract-final"><h2>契约内容</h2>
    ${(final.sections ?? []).map((section) => `<article class="contract-section"><h3>${escapeHtml(section.title)}</h3>${section.body ? renderMarkdown(section.body) : ''}${section.bullets?.length ? `<ul>${section.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}${section.basis ? `<p class="trace">依据：${escapeHtml(section.basis)}</p>` : ''}</article>`).join('')}
  </section>`;
}

function renderGate(gate) {
  if (!gate) return '<span class="chip">未记录门禁</span>';
  return `<span class="chip">${escapeHtml(gate.status ?? 'pending')}</span>${gate.closed_at ? `<span class="chip">收口 ${escapeHtml(gate.closed_at)}</span>` : ''}${gate.reason ? `<span class="chip">${escapeHtml(gate.reason)}</span>` : ''}`;
}

/** 来源文件按相对路径引用，不内嵌：档案与 issue 目录同放，浏览器直接读旁边的文件。
 * sourceBase 是档案所在目录到 issue 根目录的前缀（同目录为空串、web/exports/ 下为 ../../，
 * 跨盘时为 file:// 绝对 URL），由 exportDossier 算好并已做 URI 编码；这里只编码 issue 内的相对路径段。
 * 返回值是 URL，插入属性前统一 escapeHtml。 */
function relativeHref(path, sourceBase) {
  return sourceBase + path.split('/').map(encodeURIComponent).join('/');
}

function renderIframe(path, sourceBase) {
  return `<iframe class="prototype" src="${escapeHtml(relativeHref(path, sourceBase))}" loading="lazy" title="${escapeHtml(path)}"></iframe>`;
}

function renderOpenLink(path, sourceBase, label = '在新标签打开') {
  return `<a href="${escapeHtml(relativeHref(path, sourceBase))}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`;
}

/** 原型确认：门禁与确认清单在前，确认版对照物按固定顺序逐件呈现——HTML 原型 iframe 就地渲染，
 * markdown 对照物渲染成文档（确认版默认展开），json 折叠给出；草稿只列链接，供回溯，不当结果。 */
function renderPrototype(prototype, sourceBase) {
  if (!prototype) return '<p class="muted">没有 2-prototype 目录。</p>';
  const confirmed = prototype.gate?.artifacts_confirmed ?? [];
  const body = prototype.artifacts.map((artifact) => {
    const name = basename(artifact.path);
    const head = `<h3>${escapeHtml(artifact.title)}${artifact.title !== name ? ` <span class="muted">${escapeHtml(name)}</span>` : ''}</h3><p class="trace">${artifact.confirmed ? '确认版对照物' : '阶段产物'} · ${artifact.bytes} bytes · ${renderOpenLink(artifact.path, sourceBase)}</p>`;
    if (artifact.kind === 'html') return `<article class="artifact">${head}${renderIframe(artifact.path, sourceBase)}</article>`;
    if (artifact.markdown !== undefined) return `<article class="artifact">${head}<details${artifact.confirmed ? ' open' : ''}><summary>全文</summary>${renderMarkdown(artifact.markdown)}</details></article>`;
    if (artifact.json !== undefined) return `<article class="artifact">${head}<details><summary>JSON</summary><pre>${escapeHtml(JSON.stringify(artifact.json, null, 2))}</pre></details></article>`;
    return `<article class="artifact">${head}</article>`;
  }).join('');
  const drafts = prototype.drafts.length
    ? `<details><summary>草稿历史 · ${prototype.drafts.length} 个文件（未确认版本，仅供回溯）</summary><ul>${prototype.drafts.map((path) => `<li>${renderOpenLink(path, sourceBase, path)}</li>`).join('')}</ul></details>`
    : '';
  return `<div class="meta">${renderGate(prototype.gate)}${confirmed.map((key) => `<span class="chip">✓ ${escapeHtml(key)}</span>`).join('')}</div>${body || '<p class="muted">2-prototype 目录为空。</p>'}${drafts}`;
}

/** 契约：门禁、校验结果（AC 数、验证档分布、警告）、下一步与目录在前，契约原文整篇渲染，
 * 分里程碑契约等附属文档各自折叠，verify.txt 的验收实跑记录原样给出。目录与正文锚点出自同一次渲染。 */
function renderContract(dossier) {
  const final = dossier.state.final;
  const extra = dossier.contract_extra;
  const validation = extra?.validation;
  const tiers = validation?.verify_tiers ? Object.entries(validation.verify_tiers).map(([tier, count]) => `${tier} ${count}`).join(' · ') : null;
  const chips = renderGate(extra?.gate) + (validation
    ? `<span class="chip">校验 ${escapeHtml(validation.status)}</span><span class="chip">AC ${escapeHtml(validation.ac_count)}</span>${tiers ? `<span class="chip">验证档 ${escapeHtml(tiers)}</span>` : ''}${validation.warnings?.length ? `<span class="chip">警告 ${validation.warnings.length}</span>` : ''}${validation.ran_at ? `<span class="chip">校验于 ${escapeHtml(validation.ran_at)}</span>` : ''}`
    : '');
  const headings = [];
  const original = dossier.contract_markdown
    ? `<section id="contract-text"><h2>契约原文</h2>${renderMarkdown(dossier.contract_markdown, { headingIds: 'contract-section', headings })}</section>`
    : final ? renderFinal(final) : '<section><h2>契约原文</h2><p class="muted">尚未定稿契约。</p></section>';
  const toc = headings.length ? `<ol class="toc">${headings.map(({ index, title }) => `<li><a href="#contract-section-${index}">${escapeHtml(title)}</a></li>`).join('')}</ol>` : '';
  const head = `<section id="contract"><h2>${escapeHtml(final?.title ?? `目标契约 · ${dossier.slug}`)}</h2><p class="muted">${escapeHtml(final?.subtitle ?? '三阶段收口 · 家族载体')}</p><div class="meta">${chips}</div>${extra?.next_action ? `<p class="answer"><strong>下一步</strong>${escapeHtml(extra.next_action)}</p>` : ''}${toc}</section>`;
  const documents = extra?.documents?.length
    ? `<section><h2>契约附属文档</h2>${extra.documents.map((document) => `<details><summary>${escapeHtml(document.name)} · ${document.bytes} bytes</summary>${renderMarkdown(document.markdown)}</details>`).join('')}</section>`
    : '';
  const verify = extra?.verify_text
    ? `<section><h2>验收命令实跑记录 <span class="muted">3-contract/verify.txt</span></h2><pre>${escapeHtml(extra.verify_text)}</pre></section>`
    : '';
  return head + original + documents + verify;
}

function renderSourceBody(source, sourceBase) {
  const open = `<p class="source-open">${renderOpenLink(source.path, sourceBase)}</p>`;
  if (extname(source.name).toLowerCase() === '.html') return `${renderIframe(source.path, sourceBase)}${open}`;
  if (source.mime.startsWith('image/')) return `<img class="prototype-image" src="${escapeHtml(relativeHref(source.path, sourceBase))}" alt="${escapeHtml(source.path)}" loading="lazy">${open}`;
  return open;
}

function renderSources(sources, sourceBase) {
  if (!sources.length) return '<p class="muted">没有已发布来源文件。</p>';
  return sources.map((source) => `<details><summary>${escapeHtml(source.path)} · ${source.bytes} bytes · ${escapeHtml(source.sha256.slice(0, 12))}</summary>${renderSourceBody(source, sourceBase)}</details>`).join('');
}

/** 五个页签：概览 / 轨迹 / 原型 / 契约 / 来源。切页由页尾脚本按 hash 路由，深链到任意锚点会先切到它所在页签；
 * 无脚本或打印时全部页签平铺。 */
const TABS = [
  ['overview', '概览'],
  ['trajectory', '完整需求轨迹'],
  ['prototype', '原型确认'],
  ['contract', '交付契约'],
  ['sources', '来源与账本'],
];

const TAB_SCRIPT = `(() => {
  const panels = [...document.querySelectorAll('.tab-panel')];
  const tabs = [...document.querySelectorAll('.tabs [data-tab]')];
  if (!panels.length) return;
  const show = (id) => {
    for (const panel of panels) panel.hidden = panel.id !== 'tab-' + id;
    for (const tab of tabs) tab.setAttribute('aria-selected', String(tab.dataset.tab === id));
  };
  const route = () => {
    const hash = decodeURIComponent(location.hash.slice(1));
    const target = hash ? document.getElementById(hash) : null;
    const owner = target?.closest('.tab-panel');
    show(owner ? owner.id.slice(4) : 'overview');
    if (target && target !== owner) target.scrollIntoView();
  };
  for (const tab of tabs) tab.addEventListener('click', () => { history.replaceState(null, '', '#tab-' + tab.dataset.tab); show(tab.dataset.tab); window.scrollTo(0, 0); });
  addEventListener('hashchange', route);
  route();
})();`;

export function renderDossierHtml(dossier, { sourceBase = '' } = {}) {
  const machineJson = JSON.stringify(dossier).replaceAll('<', '\\u003c');
  const phases = dossier.state.phases ?? [];
  const submissions = dossier.submissions ?? {};
  const panel = (id, body) => `<section class="tab-panel" id="tab-${id}" role="tabpanel">${body}</section>`;
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>${escapeHtml(dossier.title)}</title>
<style>
:root{--paper:#faf9f6;--ink:#201d18;--muted:#766f65;--line:#e5e2dc;--card:#fff;--accent:#c4501e;--sage:#3d7a4e}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.55 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}main{max-width:1120px;margin:auto;padding:44px 34px 90px}h1{font-size:34px;margin:0 0 8px}h2{font-size:24px;margin:38px 0 16px}h3{margin:0;font-size:17px}.hero,.round,.contract-section,.decision,details,.manifest{border:1px solid var(--line);background:var(--card);border-radius:14px}.hero{padding:26px}.meta,.phase-row{display:flex;flex-wrap:wrap;gap:8px}.chip{padding:4px 10px;border:1px solid var(--line);border-radius:999px;font-size:12px}.round{padding:22px;margin:18px 0}.round-head,.decision>header,.option-record header{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.round-head span,.decision>header span,dt{color:var(--accent);font:11px ui-monospace,monospace;letter-spacing:.8px}.decision{padding:18px;margin:14px 0}.facts,.muted,.trace{color:var(--muted)}.option-records{display:grid;gap:8px;margin:12px 0}.option-record{border:1px solid var(--line);border-radius:11px;padding:12px}.option-record.selected{border:2px solid var(--ink);background:#f5f3ee}.option-record dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin:10px 0 0}.option-record dl div{padding:0 12px;border-left:1px solid var(--line)}.option-record dl div:first-child{padding-left:0;border-left:0}dd{margin:3px 0 0}.answer{display:grid;grid-template-columns:110px 1fr;gap:12px;padding:10px 12px;border-radius:9px;background:#f5f3ee}.contract-section{padding:18px;margin:12px 0}details{margin:8px 0;padding:10px 12px}summary{cursor:pointer;font-weight:650}pre{overflow:auto;white-space:pre-wrap}.ledger{width:100%;border-collapse:collapse}.ledger th,.ledger td{padding:8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.manifest{padding:16px;font:12px ui-monospace,monospace;overflow-wrap:anywhere}
.tabs{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:4px;margin:22px 0 6px;padding:8px 0;background:var(--paper);border-bottom:1px solid var(--line)}.tabs button{font:inherit;font-weight:600;color:var(--muted);background:none;border:0;border-bottom:2px solid transparent;padding:8px 14px;cursor:pointer;border-radius:8px 8px 0 0}.tabs button[aria-selected="true"]{color:var(--ink);border-bottom-color:var(--accent)}.tabs button:hover{background:#f5f3ee}.tab-panel[hidden]{display:none}.tab-panel>h2:first-child{margin-top:18px}[id]{scroll-margin-top:72px}
iframe.prototype{display:block;width:100%;height:720px;margin:8px 0;border:1px solid var(--line);border-radius:10px;background:#fff}.prototype-image{display:block;max-width:100%;margin:8px 0;border:1px solid var(--line);border-radius:10px}.source-open{margin:6px 0 0}.artifact{padding:18px;margin:12px 0;border:1px solid var(--line);background:var(--card);border-radius:14px}.artifact h3{margin:0 0 4px}.artifact details{border:0;padding:0;margin:8px 0 0}.table-wrap{overflow-x:auto;margin:.6rem 0}table.md{border-collapse:collapse;width:100%;font-size:14px}table.md th,table.md td{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}table.md th{background:#f5f3ee}code{font:13px ui-monospace,monospace;background:#f5f3ee;padding:1px 4px;border-radius:4px}pre code{background:none;padding:0}.toc{columns:2;gap:24px;margin:12px 0 0;padding-left:20px}.toc li{break-inside:avoid}hr{border:0;border-top:1px solid var(--line);margin:1rem 0}
.markdown{line-height:1.7}.markdown h2,.markdown h3,.markdown h4,.markdown h5{margin:1.25rem 0 .45rem}.markdown h2:first-child,.markdown h3:first-child{margin-top:0}.markdown p,.markdown ul,.markdown ol{margin:.45rem 0}.markdown blockquote{margin:.75rem 0;padding:.7rem .9rem;border-left:3px solid var(--accent);background:#f5f3ee}.markdown blockquote p{margin:.3rem 0}
@media(max-width:760px){main{padding:26px 16px}.option-record dl{grid-template-columns:1fr}.option-record dl div{padding:8px 0 0;border-left:0;border-top:1px solid var(--line)}.option-record dl div:first-child{border-top:0}.answer{grid-template-columns:1fr}.toc{columns:1}}
@media print{body{background:#fff}main{max-width:none;padding:0}.tabs{display:none}.tab-panel[hidden]{display:block}.hero,.round,.decision,.contract-section,details{break-inside:avoid;box-shadow:none}details>pre{display:block}summary{list-style:none}}
</style></head><body><main>
<section class="hero"><p>GOAL CONTRACT · DECISION DOSSIER</p><h1>${escapeHtml(dossier.title)}</h1><p>${escapeHtml(dossier.state.opening ?? '未记录原始请求')}</p><div class="meta"><span class="chip">状态 ${escapeHtml(dossier.status)}</span><span class="chip">开放歧义 ${escapeHtml(dossier.state.open_ambiguities)}</span><span class="chip">State ${dossier.state_digest.slice(0, 12)}</span><span class="chip">Dossier ${dossier.dossier_digest.slice(0, 12)}</span></div><div class="phase-row">${phases.map((phase) => `<span class="chip">${escapeHtml(phase.label)} · ${escapeHtml(phase.status)}</span>`).join('')}</div></section>
<nav class="tabs" role="tablist">${TABS.map(([id, label]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${id === 'overview'}" aria-controls="tab-${id}">${label}</button>`).join('')}</nav>
${panel('overview', `<h2>原始请求与上下文</h2>${dossier.context_markdown ? renderMarkdown(dossier.context_markdown) : `<p>${escapeHtml(dossier.state.opening ?? '')}</p>`}`)}
${panel('trajectory', `<h2>完整需求轨迹</h2><div id="trajectory">${(dossier.state.rounds ?? []).map((round) => renderRound(round, submissions[round.id])).join('') || '<p class="muted">尚无轮次记录。</p>'}</div>`)}
${panel('prototype', `<h2>原型确认</h2><div id="prototype">${renderPrototype(dossier.prototype, sourceBase)}</div>`)}
${panel('contract', renderContract(dossier))}
${panel('sources', `<h2>全部来源文件</h2><p class="muted">issue 目录下三阶段的全部文件，按相对路径引用；原型与契约的结果见前两个页签。</p>${renderSources(dossier.sources, sourceBase)}
<h2>溯源账本</h2>${dossier.ledger.length ? `<table class="ledger"><thead><tr><th>时间</th><th>事件</th><th>主体</th><th>摘要</th></tr></thead><tbody>${dossier.ledger.map((event) => `<tr><td>${escapeHtml(event.at)}</td><td>${escapeHtml(event.type)}</td><td>${escapeHtml(event.actor?.id)}</td><td>${escapeHtml(event.entity?.id ?? event.round ?? '')}<br><small>${escapeHtml(event.event_digest?.slice(0, 16))}</small></td></tr>`).join('')}</tbody></table>` : '<p class="muted">纯对话载体没有 Web 提交事件；过程账本即 1-interview/rounds.jsonl，见上方来源清单。</p>'}
<h2>追踪矩阵</h2><table class="ledger"><thead><tr><th>ID</th><th>阶段/轮次</th><th>来源</th><th>映射到</th><th>决定</th></tr></thead><tbody>${dossier.traceability.map((row) => `<tr><td>${escapeHtml(row.id)}</td><td>${escapeHtml(row.stage)} / ${escapeHtml(row.round)}</td><td>${escapeHtml(row.source_refs.join(' · ') || '未显式关联')}</td><td>${escapeHtml(row.maps_to.join(' · ') || '未显式关联')}</td><td>${escapeHtml(answerSummary(row.answer))}</td></tr>`).join('')}</tbody></table>
<h2>导出清单</h2><div class="manifest">schema=2<br>generated_at=${escapeHtml(dossier.generated_at)}<br>state_sha256=${dossier.state_digest}<br>dossier_sha256=${dossier.dossier_digest}（投影摘要，非本文件的 sha256）<br>ledger_events=${dossier.ledger.length}<br>sources=${dossier.sources.length}</div>`)}
<script type="application/json" id="decision-dossier-data">${machineJson}</script>
<script>${TAB_SCRIPT}</script>
</main></body></html>`;
}

/** 档案所在目录 → issue 根目录的 URL 前缀。同目录为空串；同盘为逐段 URI 编码的相对路径（`..` 原样）；
 * 跨盘（path.relative 只能给出绝对路径）退回 file:// 绝对 URL，浏览器从本地打开时仍能解析。 */
function sourceBaseFor(outputDir, issueDir) {
  const toIssue = relative(outputDir, issueDir);
  if (!toIssue) return '';
  if (isAbsolute(toIssue)) return `${pathToFileURL(issueDir).href}/`;
  return `${toIssue.split(/[\\/]/).map((segment) => (segment === '..' ? segment : encodeURIComponent(segment))).join('/')}/`;
}

export function exportDossier(issueDir, outputPath) {
  const dossier = buildDossier(issueDir);
  // web 载体默认进 web/exports；纯对话载体没有 web/，落在 issue 根目录与家族产物同层。
  const fallback = existsSync(join(issueDir, 'web'))
    ? join(issueDir, 'web', 'exports', `${dossier.slug}-decision-dossier.html`)
    : join(issueDir, 'dossier.html');
  const pathname = resolve(outputPath ?? fallback);
  mkdirSync(dirname(pathname), { recursive: true });
  const temporary = `${pathname}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  writeFileSync(temporary, renderDossierHtml(dossier, { sourceBase: sourceBaseFor(dirname(pathname), resolve(issueDir)) }), 'utf8');
  renameSync(temporary, pathname);
  return { pathname, dossier };
}

export function safeExportPath(issueDir, requested) {
  const exportsDir = resolve(join(issueDir, 'web', 'exports'));
  const target = resolve(exportsDir, requested);
  if (!target.startsWith(`${exportsDir}${sep}`)) return null;
  return target;
}
