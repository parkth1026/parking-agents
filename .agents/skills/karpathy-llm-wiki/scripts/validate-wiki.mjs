#!/usr/bin/env node
// validate-wiki.mjs — Wiki 校验 v5：8 维度综合检查
// （唯一入口；原 validate-wiki.ps1 已按仓库脚本标准移除）
//
// 用法: node validate-wiki.mjs --wiki <path/to/wiki> [--config <path/to/config.json>]
// 退出码: 0 = PASS（总分 >= minScore 且断链为 0），1 = FAIL
//
// v5 变更（2026-08-17 对抗审查后修复，见 docs/reports/wiki-lint-adversarial-review-2026-08-16）:
//   1. SCHEMA 标签过滤正则允许点号（ue5.5 等版本号标签不再误杀）
//   2. 断链维度分母不再双重计数（旧版 broken+totalLinkSum，而 totalLinkSum 已含断链）
//   3. 自引用不计入断链分母
//   4. index.md 的目录链接纳入断链检查（此前处于校验盲区）
//   5. index.md 目录链接计入入链（孤儿页口径，可用 scoring.indexCountsAsInbound 关闭）
//   6. EXCLUDED_NAMES / index 完整性匹配大小写不敏感

import { fileURLToPath } from "node:url";
import { dirname, join, basename, extname } from "node:path";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";

// ---- ANSI 颜色（等价 PowerShell Write-Host -ForegroundColor）----
const C = {
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  white: (s) => `\x1b[37m${s}\x1b[0m`,
};

// ---- CLI 参数 ----
function parseArgs(argv) {
  const args = { wiki: null, config: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--wiki") args.wiki = argv[++i];
    else if (argv[i] === "--config") args.config = argv[++i];
    else { console.error(`未知参数: ${argv[i]}`); process.exit(2); }
  }
  if (!args.wiki) { console.error("缺少必填参数 --wiki <path/to/wiki>"); process.exit(2); }
  return args;
}

// ---- 工具函数 ----
function walkMd(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "raw" || name === "node_modules" || name.startsWith(".")) continue;
      out.push(...walkMd(p));
    } else if (name.endsWith(".md")) {
      out.push(p);
    }
  }
  return out;
}

function lineCount(content) {
  const lines = content.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.length;
}

// ---- 入口 ----
const { wiki: wikiPath, config: configPath } = parseArgs(process.argv.slice(2));

console.log(C.cyan("=== Wiki Validation Script v5 ==="));
if (!existsSync(wikiPath)) {
  console.error(`Wiki path does not exist: ${wikiPath}`);
  process.exit(1);
}

// 配置（可选 —— 未提供时使用默认值）
let maxLines = 200;
let minOutboundLinks = 2;
let minScore = 9.0;
let indexCountsAsInbound = true;
const weights = {
  brokenLinks: 0.25, selfReferences: 0.10, orphanPages: 0.10,
  indexCompleteness: 0.15, frontmatter: 0.15, pageSize: 0.10,
  outboundLinks: 0.10, tagCompliance: 0.05,
};

if (configPath && existsSync(configPath)) {
  // 容错：strip UTF-8 BOM（历史 config 可能带 BOM，JSON.parse 不接受）
  const config = JSON.parse(readFileSync(configPath, "utf8").replace(/^\uFEFF/, ""));
  if (config.page?.maxLines) maxLines = config.page.maxLines;
  if (config.page?.minOutboundLinks) minOutboundLinks = config.page.minOutboundLinks;
  if (config.scoring?.minScore) minScore = config.scoring.minScore;
  if (config.scoring?.weights) Object.assign(weights, config.scoring.weights);
  if (typeof config.scoring?.indexCountsAsInbound === "boolean") indexCountsAsInbound = config.scoring.indexCountsAsInbound;
}

// 收集所有 .md（排除 SCHEMA.md / index.md / log.md / raw 目录；basename 大小写不敏感）
const EXCLUDED_LOWER = new Set(["schema.md", "index.md", "log.md"]);
const allFiles = walkMd(wikiPath).filter((p) => !EXCLUDED_LOWER.has(basename(p).toLowerCase()));
const totalPages = allFiles.length;
console.log(C.green(`Found ${totalPages} wiki pages`));

if (totalPages === 0) {
  console.log(C.yellow("No wiki pages found. Nothing to validate."));
  process.exit(0);
}

const baseName = (p) => basename(p, extname(p));
// 对齐 PowerShell Get-Content -Encoding UTF8：剥离文件开头的 BOM，
// 否则带 BOM 的页面 ^--- 匹配失败，frontmatter/tags 维度误判
const read = (p) => readFileSync(p, "utf8").replace(/^\uFEFF/, "");

// SCHEMA.md 提取标签分类（允许点号：ue5.5 等版本号标签；仍要求小写 kebab 风格，
// 大写条目如 Conventions 节的 Page/Tags/Dates 依旧被过滤）
const validTags = [];
const schemaPath = join(wikiPath, "SCHEMA.md");
if (existsSync(schemaPath)) {
  for (const m of read(schemaPath).matchAll(/^[ \t]*-[ \t]+(\S+)/gm)) {
    const tag = m[1].trim();
    if (/^[a-z][a-z0-9.-]+$/.test(tag)) validTags.push(tag);
  }
}

// index.md 提取已索引页面
const indexedPages = [];
const indexPath = join(wikiPath, "index.md");
if (existsSync(indexPath)) {
  for (const m of read(indexPath).matchAll(/\[\[([^\]]+)\]\]/g)) indexedPages.push(m[1]);
}

// === 维度 1: 断链 ===
const brokenLinks = [];
const selfReferences = [];
const allPageNames = new Map();
const inboundCount = new Map();
const outboundCount = new Map();

for (const file of allFiles) {
  allPageNames.set(baseName(file), file);
  inboundCount.set(baseName(file), 0);
}

const SEARCH_DIRS = ["entities", "concepts", "sources", "comparisons", "queries", "details", "scratch", "patterns", ""];
let totalLinkSum = 0;

for (const file of allFiles) {
  const content = read(file);
  const links = [...content.matchAll(/\[\[([^\]]+)\]\]/g)];
  let outbound = 0;

  for (const link of links) {
    const linkText = link[1];

    // 维度 2: 自引用（不计出链、不计断链分母）
    if (linkText === baseName(file)) {
      selfReferences.push({ File: basename(file), Link: linkText });
      continue;
    }
    totalLinkSum++;
    outbound++;

    // 检查链接目标是否存在
    let found = false;
    for (const dir of SEARCH_DIRS) {
      const targetPath = join(wikiPath, dir, `${linkText}.md`);
      if (existsSync(targetPath)) { found = true; break; }
    }

    if (found) {
      if (inboundCount.has(linkText)) inboundCount.set(linkText, inboundCount.get(linkText) + 1);
    } else {
      brokenLinks.push({ File: basename(file), Link: linkText });
    }
  }
  outboundCount.set(baseName(file), outbound);
}

// index.md 的目录链接：纳入断链检查（消除校验盲区）；按配置计入入链
// （index 是 catalog of all pages，目录行视为官方入链；关闭开关可回退旧行为）
if (existsSync(indexPath)) {
  for (const target of indexedPages) {
    let found = false;
    for (const dir of SEARCH_DIRS) {
      if (existsSync(join(wikiPath, dir, `${target}.md`))) { found = true; break; }
    }
    totalLinkSum++;
    if (found) {
      if (indexCountsAsInbound && inboundCount.has(target)) {
        inboundCount.set(target, inboundCount.get(target) + 1);
      }
    } else {
      brokenLinks.push({ File: "index.md", Link: target });
    }
  }
}

// === 维度 3: 孤儿页 ===
const orphanPages = [];
for (const [page] of allPageNames) {
  if (inboundCount.get(page) === 0) orphanPages.push(page);
}

// === 维度 4: index 完整性（大小写不敏感）===
const missingFromIndex = [];
const indexedLower = new Set(indexedPages.map((s) => s.toLowerCase()));
for (const [page] of allPageNames) {
  if (!indexedLower.has(page.toLowerCase())) missingFromIndex.push(page);
}

// === 维度 5: frontmatter 有效性 ===
const requiredFields = ["title", "type", "tags"];
const frontmatterIssues = [];
const fmRe = /^---\s*\r?\n([\s\S]*?)\r?\n---/;
for (const file of allFiles) {
  const content = read(file);
  if (!/^---\s*\r?\n/.test(content)) {
    frontmatterIssues.push({ File: basename(file), Issue: "Missing frontmatter" });
    continue;
  }
  const fmMatch = content.match(fmRe);
  if (!fmMatch) {
    frontmatterIssues.push({ File: basename(file), Issue: "Malformed frontmatter" });
    continue;
  }
  const fm = fmMatch[1];
  for (const field of requiredFields) {
    if (!new RegExp(`^${field}:`, "m").test(fm)) {
      frontmatterIssues.push({ File: basename(file), Issue: `Missing field: ${field}` });
    }
  }
}

// === 维度 6: 页面大小 ===
const oversizedPages = [];
for (const file of allFiles) {
  const lines = lineCount(read(file));
  if (lines > maxLines) oversizedPages.push({ File: basename(file), Lines: lines, Max: maxLines });
}

// === 维度 7: 出链数量 ===
const underlinkedPages = [];
for (const [page, count] of outboundCount) {
  if (count < minOutboundLinks) underlinkedPages.push({ Page: page, Count: count, Min: minOutboundLinks });
}

// === 维度 8: 标签合规 ===
const invalidTags = [];
if (validTags.length > 0) {
  for (const file of allFiles) {
    const fmMatch = read(file).match(fmRe);
    if (fmMatch) {
      const tagMatch = fmMatch[1].match(/^tags:\s*\[([^\]]*)\]/m);
      if (tagMatch) {
        const tags = tagMatch[1].split(",").map((t) => t.trim().replace(/^["']|["']$/g, ""));
        for (const tag of tags) {
          if (tag && !validTags.includes(tag)) invalidTags.push({ File: basename(file), Tag: tag });
        }
      }
    }
  }
}

// === 评分 ===
const dimScores = {};

// 断链: 0 个得 10 分，否则按比例扣（分母 totalLinkSum 已含全部非自引用链接
// 与 index.md 目录链接，不再与 brokenLinks.length 相加——旧版双重计数虚高分）
dimScores.brokenLinks = brokenLinks.length === 0 ? 10 : (() => {
  return totalLinkSum > 0 ? Math.max(0, 10 * (1 - brokenLinks.length / totalLinkSum)) : 10;
})();

// 自引用: 0 个得 10 分，否则 0 分
dimScores.selfReferences = selfReferences.length === 0 ? 10 : 0;

// 孤儿页: 按比例
dimScores.orphanPages = totalPages === 0 ? 10 : Math.max(0, 10 * (1 - orphanPages.length / totalPages));

// index 完整性: 按比例
dimScores.indexCompleteness = totalPages === 0 ? 10 : 10 * ((totalPages - missingFromIndex.length) / totalPages);

// frontmatter: 按有问题的页面数计（不是问题总数）
const pagesWithFmIssues = new Set(frontmatterIssues.map((i) => i.File)).size;
dimScores.frontmatter = totalPages === 0 ? 10 : 10 * ((totalPages - pagesWithFmIssues) / totalPages);

// 页面大小: 按比例
dimScores.pageSize = totalPages === 0 ? 10 : 10 * ((totalPages - oversizedPages.length) / totalPages);

// 出链: 按比例
dimScores.outboundLinks = totalPages === 0 ? 10 : 10 * ((totalPages - underlinkedPages.length) / totalPages);

// 标签合规: 无 schema 或无非法标签得 10 分
dimScores.tagCompliance = validTags.length === 0 || invalidTags.length === 0 ? 10 : (() => {
  const pagesWithBadTags = new Set(invalidTags.map((i) => i.File)).size;
  return 10 * ((totalPages - pagesWithBadTags) / totalPages);
})();

// 加权总分
let totalScore = 0;
for (const dim of Object.keys(weights)) totalScore += dimScores[dim] * weights[dim];

// === 输出报告 ===
console.log("\n" + C.cyan("=== Dimension Scores ==="));
const dimOrder = ["brokenLinks", "selfReferences", "orphanPages", "indexCompleteness", "frontmatter", "pageSize", "outboundLinks", "tagCompliance"];
const dimLabels = {
  brokenLinks: "Broken Links", selfReferences: "Self References", orphanPages: "Orphan Pages",
  indexCompleteness: "Index Completeness", frontmatter: "Frontmatter", pageSize: "Page Size",
  outboundLinks: "Outbound Links", tagCompliance: "Tag Compliance",
};
for (const dim of dimOrder) {
  const score = Math.round(dimScores[dim] * 10) / 10;
  const w = Math.round(weights[dim] * 100);
  const fmt = (s, label) => `  ${label.padEnd(22)} ${String(s).padStart(5)}/10  (weight: ${w}%)`;
  const line = fmt(score, dimLabels[dim]);
  console.log(score >= 9 ? C.green(line) : score >= 7 ? C.yellow(line) : C.red(line));
}

console.log("\n" + C.cyan("=== Issues ==="));
if (brokenLinks.length > 0) {
  console.log(C.red(`  Broken Links (${brokenLinks.length}):`));
  for (const b of brokenLinks) console.log(C.red(`    ${b.File} -> [[${b.Link}]]`));
}
if (selfReferences.length > 0) {
  console.log(C.red(`  Self References (${selfReferences.length}):`));
  for (const s of selfReferences) console.log(C.red(`    ${s.File} -> [[${s.Link}]]`));
}
if (orphanPages.length > 0) {
  console.log(C.yellow(`  Orphan Pages (${orphanPages.length}):`));
  for (const o of orphanPages) console.log(C.yellow(`    ${o}`));
}
if (missingFromIndex.length > 0) {
  console.log(C.yellow(`  Missing from Index (${missingFromIndex.length}):`));
  for (const m of missingFromIndex) console.log(C.yellow(`    ${m}`));
}
if (frontmatterIssues.length > 0) {
  console.log(C.yellow(`  Frontmatter Issues (${frontmatterIssues.length}):`));
  for (const f of frontmatterIssues) console.log(C.yellow(`    ${f.File}: ${f.Issue}`));
}
if (oversizedPages.length > 0) {
  console.log(C.yellow(`  Oversized Pages (${oversizedPages.length}):`));
  for (const o of oversizedPages) console.log(C.yellow(`    ${o.File}: ${o.Lines} lines (max: ${o.Max})`));
}
if (underlinkedPages.length > 0) {
  console.log(C.yellow(`  Under-linked Pages (${underlinkedPages.length}):`));
  for (const u of underlinkedPages) console.log(C.yellow(`    ${u.Page}: ${u.Count} links (min: ${u.Min})`));
}
if (invalidTags.length > 0) {
  console.log(C.yellow(`  Invalid Tags (${invalidTags.length}):`));
  for (const t of invalidTags) console.log(C.yellow(`    ${t.File}: tag '${t.Tag}' not in SCHEMA.md`));
}

// === 最终得分 ===
console.log("\n" + C.cyan("=== Final Score ==="));
const totalRounded = Math.round(totalScore * 10) / 10;
const pass = totalRounded >= minScore && brokenLinks.length === 0;
console.log((totalRounded >= 9 ? C.green : totalRounded >= 7 ? C.yellow : C.red)(`  Total: ${totalRounded} / 10`));
console.log(C.white(`  Threshold: ${minScore} / 10`));
console.log((pass ? C.green : C.red)(`  Status: ${pass ? "PASS" : "FAIL"}`));

process.exit(pass ? 0 : 1);
