#!/usr/bin/env node
// validate-patterns.mjs — 错误模式库(patterns/)的不变量校验
// 规则来源: .scratch/ue-log-analysis-pattern-library/issues/01、02（schema 与去重纪律）
// 零 npm 依赖。退出码: 0=全绿 1=有违规

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, basename, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argv, exit } from 'node:process';

const CATEGORIES = new Set([
  'crash', 'ensure-chain', 'hang', 'struggle-freeze', 'gpu-device',
  'infra', 'startup-fail', 'network-signal', 'orchestration',
]);
const REQUIRED = ['name', 'category', 'signature', 'first-seen', 'last-seen'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 双引号值反转义 \ -> \, 再剥引号; 单引号/裸值只剥引号 */
function unquote(v) {
  if (v.startsWith('"')) return v.replace(/^"|"$/g, '').replace(/\\/g, '\\');
  return v.replace(/^'|'$/g, '');
}

/** 极简 frontmatter 解析: 标量 key: value 与 "- item" 列表(仅 aliases/sources/recurrences 用) */
function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const fm = {};
  let listKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    const li = /^\s*-\s+(.*)$/.exec(line);
    if (li && listKey) {
      fm[listKey].push(li[1].trim());
      continue;
    }
    const kv = /^([A-Za-z-]+):\s*(.*)$/.exec(line);
    if (kv) {
      const [, k, v] = kv;
      if (v === '' || v === '[]') {
        if (k === 'aliases' || k === 'sources') { fm[k] = []; listKey = k; }
        else fm[k] = '';
      } else if (k === 'aliases' || k === 'sources') {
        fm[k] = [unquote(v)];
        listKey = k;
      } else {
        fm[k] = unquote(v);
        listKey = null;
      }
    }
  }
  return fm;
}

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);

function parseRecurrenceDates(body) {
  const dates = [];
  const sec = /^## Recurrences\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(body);
  if (!sec) return dates;
  for (const line of sec[1].split(/\r?\n/)) {
    const m = /^\|\s*(\d{4}-\d{2}-\d{2})\s*\|/.exec(line);
    if (m) dates.push(m[1]);
  }
  return dates;
}

function validate(dir) {
  let files = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  } catch {
    errors.push(`无法读取模式库目录: ${dir}`);
    return { files: [], entries: [] };
  }
  const sigOwner = new Map(); // signature/alias -> 文件（全局唯一）
  const entries = [];
  for (const f of files) {
    const text = readFileSync(join(dir, f), 'utf8');
    const fm = parseFrontmatter(text);
    if (!fm) { err(f, '缺少 frontmatter(--- 块)'); continue; }
    const stem = parse(f).name;
    for (const k of REQUIRED) {
      if (!(k in fm) || fm[k] === '' || (Array.isArray(fm[k]) && !fm[k].length)) err(f, `缺少必填字段 ${k}`);
    }
    if (fm.name && fm.name !== stem) err(f, `name(${fm.name}) != 文件名主干(${stem})`);
    if (fm.category && !CATEGORIES.has(fm.category)) {
      err(f, `category(${fm.category}) 不在词表 ${[...CATEGORIES].join('/')}`);
    }
    for (const d of ['first-seen', 'last-seen']) {
      if (fm[d] && !DATE_RE.test(fm[d])) err(f, `${d}(${fm[d]}) 不是 YYYY-MM-DD`);
    }
    if (fm['first-seen'] && fm['last-seen'] && fm['first-seen'] > fm['last-seen']) {
      err(f, `first-seen(${fm['first-seen']}) 晚于 last-seen(${fm['last-seen']})`);
    }
    // match 变体正则(可选): 必须可编译
    if (fm.match) {
      try { new RegExp(fm.match); } catch (e) { err(f, `match 正则编译失败: ${e.message}`); }
    }
    // 签名全局唯一(signature + aliases)
    const sigs = [fm.signature, ...(fm.aliases ?? [])].filter(Boolean);
    for (const sig of sigs) {
      const owner = sigOwner.get(sig);
      if (owner) err(f, `签名与 ${owner} 重复: ${sig.slice(0, 60)}`);
      else sigOwner.set(sig, f);
    }
    // 正文节与 Recurrences 时序/计数
    const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---/, '');
    if (!/^## 识别特征/m.test(body)) err(f, "正文缺 '## 识别特征' 节");
    const idSec = /^## 识别特征\s*$([\s\S]*?)(?=^## |\Z)/m.exec(body);
    if (idSec && idSec[1].trim().length < 10) err(f, "'## 识别特征' 节过短(应含 regex 与错误原句)");
    const rDates = parseRecurrenceDates(body);
    for (const d of rDates) {
      if (fm['first-seen'] && d < fm['first-seen']) err(f, `Recurrences 日期 ${d} 早于 first-seen`);
      if (fm['last-seen'] && d > fm['last-seen']) err(f, `Recurrences 日期 ${d} 晚于 last-seen（回流时须同步更新 last-seen）`);
    }
    const rc = fm['recurrence-count'] === undefined ? 0 : Number(fm['recurrence-count']);
    if (rDates.length !== rc) err(f, `recurrence-count(${rc}) != Recurrences 表行数(${rDates.length})`);
    if (rc > 0 && !/^## Recurrences/m.test(body)) err(f, 'recurrence-count > 0 但无 Recurrences 节');
    entries.push({ file: f, name: fm.name, category: fm.category, signature: fm.signature, aliases: fm.aliases ?? [] });
  }
  return { files, entries };
}

const dir = argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'patterns');
const { files, entries } = validate(dir);

for (const w of warnings) console.log(`WARN ${w}`);
for (const e of errors) console.log(`FAIL ${e}`);
console.log(`patterns 校验: ${files.length} 个条目, ${errors.length} 个违规`);
if (errors.length) exit(1);
console.log('全绿');
exit(0);
