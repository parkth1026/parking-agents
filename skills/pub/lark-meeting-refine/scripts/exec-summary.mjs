#!/usr/bin/env node
// 一页纸摘要（executive summary）层：从修正稿生成决策导向的浓缩页。
// 两个模式：
//   --scaffold  机械抽取修正稿的「待办 / 未决分歧标题 / 统计 / 修正说明」生成骨架，
//               已定事项与关键数字留 TODO 由 Agent 补（语义提炼）
//   --verify    质量门：①必备节齐全 ②每个全精度时间戳必须同时存在于修正稿与逐字稿
//               ③待决策条数 === 修正稿未决分歧条数；待办条数 === 修正稿待办 checkbox 条数（不许丢项）
// 用法: node exec-summary.mjs --slug <YYYY-MM-DD-slug> (--scaffold|--verify) [--evidence-root agent/evidence]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const m = process.argv[i].match(/^--([\w-]+)(?:=(.*))?$/);
  if (m) {
    const next = process.argv[i + 1];
    args[m[1]] = m[2] !== undefined ? m[2] : (next !== undefined && !next.startsWith('--') ? (i++, next) : true);
  }
}
const SLUG = args.slug;
const MODE = args.scaffold !== undefined ? 'scaffold' : args.verify !== undefined ? 'verify' : null;
const EVIDENCE = args['evidence-root'] || 'agent/evidence';
if (!SLUG || !MODE) {
  console.error('用法: node exec-summary.mjs --slug <slug> (--scaffold|--verify)');
  process.exit(2);
}
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..', '..'); // scripts → skill → skills → .agents → 仓库根
const dir = path.join(repoRoot, EVIDENCE);
const cmPath = path.join(dir, `${SLUG}-corrected-minutes.md`);
const trPath = path.join(dir, `${SLUG}-meeting-transcript.md`);
const esPath = path.join(dir, `${SLUG}-executive-summary.md`);
if (!fs.existsSync(cmPath)) { console.error(`缺少修正稿 ${cmPath}`); process.exit(2); }
const cm = fs.readFileSync(cmPath, 'utf8');

// ---------- 修正稿结构解析 ----------
function section(body, nameRe) {
  const lines = body.split('\n');
  const out = [];
  let inSec = false;
  for (const l of lines) {
    if (/^#{1,2}\s/.test(l)) { inSec = nameRe.test(l); continue; }
    if (inSec) out.push(l);
  }
  return out;
}
const body = cm.replace(/^---\n[\s\S]*?\n---\n/, '');
const todos = section(body, /^#\s*待办/).filter((l) => /^-\s+\[[ x]\]/.test(l));
// 未决分歧：兼容两种形态——独立标题（# 未决分歧…）或总结内加粗列表项（- **未决分歧…**）
function extractDisputes(src) {
  const out = [];
  let active = false;
  for (const l of src.split('\n')) {
    if (/未决分歧/.test(l) && /^(#{1,2}\s|-?\s*\*\*)/.test(l)) { active = true; continue; }
    if (active) {
      if (/^\s*\d+\.\s/.test(l)) { out.push(l); continue; }
      if (/^#\s/.test(l) || /^-\s/.test(l)) active = false;
    }
  }
  return out;
}
const disputes = extractDisputes(body);
const stats = (cm.match(/^correction_stats:\s*(.+)$/m) || [])[1] || '';
const tsOf = (s) => [...s.matchAll(/\d{2}:\d{2}:\d{2}/g)].map((m) => m[0]);
const disputeTitle = (l) => {
  const bold = l.match(/\*\*([^*]+)\*\*/);
  const plain = l.replace(/^\s*\d+\.\s/, '').replace(/\*\*/g, '');
  return (bold ? bold[1] : plain.split(/[：。；]/)[0]).replace(/（[^）]*\d{1,2}:\d{2}[^）]*）\s*$/, '').trim().slice(0, 40);
};

// ---------- scaffold ----------
if (MODE === 'scaffold') {
  if (fs.existsSync(esPath)) { console.error(`已存在 ${esPath}（不覆盖）`); process.exit(1); }
  const title = (body.match(/^#\s+(.+)$/m) || [])[1] || SLUG;
  const out = [
    '---',
    `type: executive-summary`,
    `basis: ./${SLUG}-corrected-minutes.md（逐字稿为唯一事实基准；本页只收录修正稿已核实条目）`,
    `generated_at: ${new Date().toISOString().slice(0, 10)}`,
    'workflow: lark-meeting-refine',
    '---',
    '',
    `# 一页纸摘要：${title.replace(/^智能纪要（修正稿）：/, '')}`,
    '',
    `> 依据：[修正稿](./${SLUG}-corrected-minutes.md) · 统计：${stats}`,
    '',
    '# 已定事项',
    '',
    '<!-- TODO(Agent)：5-10 条决策级结论，每条一句话 + 全精度时间戳；只用修正稿中已出现的时间戳 -->',
    '',
    '# 待决策（未决分歧）',
    '',
    ...disputes.map((l, i) => `- **${disputeTitle(l)}**：<!-- TODO(Agent)：一句话现状 -->${(() => { const t = tsOf(l); return t.length ? `（${[...new Set(t)].slice(0, 2).join('、')}）` : ''; })()}`),
    '',
    '# 待办',
    '',
    ...todos.map((l) => l.replace(/^-\s+\[[ x]\]\s*/, '- ')),
    '',
    '# 关键数字',
    '',
    '<!-- TODO(Agent)：3-6 条量化口径，每条带时间戳 -->',
    '',
    '',
  ].join('\n');
  fs.writeFileSync(esPath, out, 'utf8');
  console.log(`scaffold: ${path.relative(repoRoot, esPath)}（已定事项/关键数字待补，待决策 ${disputes.length} 项 / 待办 ${todos.length} 条已机械抽取）`);
  process.exit(0);
}

// ---------- verify ----------
if (!fs.existsSync(esPath)) { console.error(`缺少摘要 ${esPath}`); process.exit(1); }
if (!fs.existsSync(trPath)) { console.error(`缺少逐字稿 ${trPath}`); process.exit(2); }
const es = fs.readFileSync(esPath, 'utf8');
const tr = fs.readFileSync(trPath, 'utf8');
const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exit(1); };

for (const s of ['已定事项', '待决策', '# 待办', '一页纸摘要']) if (!es.includes(s)) fail(`缺「${s}」`);
const esBody = es.replace(/^---\n[\s\S]*?\n---\n/, '');
const esDecided = section(esBody, /^#\s*已定事项/).filter((l) => /^-\s/.test(l));
const esPending = section(esBody, /待决策/).filter((l) => /^-\s/.test(l));
const esTodos = section(esBody, /^#\s*待办/).filter((l) => /^-\s/.test(l));
if (esDecided.length < 1) fail('已定事项为空');
if (esPending.length !== disputes.length) fail(`待决策 ${esPending.length} 条 ≠ 修正稿未决分歧 ${disputes.length} 条（不许丢项/加项）`);
if (esTodos.length !== todos.length) fail(`待办 ${esTodos.length} 条 ≠ 修正稿待办 ${todos.length} 条（不许丢项/加项）`);
if (/TODO\(Agent\)/.test(es)) fail('仍有 TODO 占位未补');

const cmTs = new Set(tsOf(cm));
const trTsCheck = (x) => tr.includes(x);
const missCM = [], missTR = [];
for (const t of new Set(tsOf(es))) {
  if (!cmTs.has(t)) missCM.push(t);
  else if (!trTsCheck(t)) missTR.push(t);
}
if (missCM.length) fail(`时间戳不在修正稿中: ${missCM.join(',')}（摘要只允许收录修正稿已核实的时间戳）`);
if (missTR.length) fail(`时间戳不在逐字稿中: ${missTR.join(',')}`);
console.log(`ok: ${path.relative(repoRoot, esPath)}（已定 ${esDecided.length} / 待决策 ${esPending.length} / 待办 ${esTodos.length}，时间戳 ${new Set(tsOf(es)).size} 个双源命中）`);
process.exit(0);
