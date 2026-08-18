#!/usr/bin/env node
// validate-wiki.mjs — Wiki 校验 v6：8 维度综合检查 + staleness 体检
// （唯一入口；原 validate-wiki.ps1 已按仓库脚本标准移除）
//
// 用法: node validate-wiki.mjs --wiki <path/to/wiki> [--config <path/to/config.json>] [--raw <path/to/rawDir>]
// 退出码: 0 = PASS（总分 >= minScore 且断链为 0），1 = FAIL
//
// v6 变更（2026-08-18 真实库只读审计后，见 docs/reports/karpathy-wiki-live-audit-2026-08-18）:
//   7. staleness 检查：raw 证据日期 vs 页面 updated（--raw > $SKILL_ENV > ~/.config 解析 rawDir；
//      证据日期取 frontmatter recorded_at/ingested/date，缺省回退文件 mtime；
//      recurrence-<page>.md 去前缀后按页名匹配）。默认仅报告，scoring.stalenessEnforce=true 时
//      存在 stale 页即 FAIL —— 复利闭环「知识必须不旧于原始证据」的可执行化
//   8. type 枚举校验：基础五类（entity/concept/source/comparison/query）恒有效，SCHEMA.md
//      `## Page Types` 节声明的扩展类型（如 jenkins-error）并入合法集；违规计入 frontmatter 维度
//   9. 链接解析目录可插拔：SEARCH_DIRS = 规范五目录 + 根 + SCHEMA.md `## Page Directories`
//      声明的扩展目录（替代 v5 硬编码 details/scratch/patterns —— 部署形态由 SCHEMA 声明，
//      skill 文本与磁盘现实不再两套世界观）
//  10. SCHEMA 标签收集排除 `## Page Types` / `## Page Directories` 两节（避免扩展声明混入标签集）
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
import { homedir } from "node:os";

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
  const args = { wiki: null, config: null, raw: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--wiki") args.wiki = argv[++i];
    else if (argv[i] === "--config") args.config = argv[++i];
    else if (argv[i] === "--raw") args.raw = argv[++i];
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
const { wiki: wikiPath, config: configPath, raw: rawArg } = parseArgs(process.argv.slice(2));

console.log(C.cyan("=== Wiki Validation Script v6 ==="));
if (!existsSync(wikiPath)) {
  console.error(`Wiki path does not exist: ${wikiPath}`);
  process.exit(1);
}

// 配置（可选 —— 未提供时使用默认值）
let maxLines = 200;
let minOutboundLinks = 2;
let minScore = 9.0;
let indexCountsAsInbound = true;
let stalenessEnforce = false;
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
  if (typeof config.scoring?.stalenessEnforce === "boolean") stalenessEnforce = config.scoring.stalenessEnforce;
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

// SCHEMA.md 解析：标签分类（允许点号：ue5.5 等版本号标签；仍要求小写 kebab 风格，
// 大写条目如 Conventions 节的 Page/Tags/Dates 依旧被过滤）。
// v6：`## Page Types` / `## Page Directories` 两节是类型/目录声明而非标签，排除在标签收集之外，
// 但解析出 validTypes（扩展 type 枚举）与 declaredDirs（扩展链接解析目录）
const validTags = [];
const validTypes = new Set(["entity", "concept", "source", "comparison", "query"]);
const declaredDirs = [];
const schemaPath = join(wikiPath, "SCHEMA.md");
const SCHEMA_DECL_SECTIONS = ["page types", "page directories"];
if (existsSync(schemaPath)) {
  const schemaLines = read(schemaPath).split(/\r?\n/);
  let inDeclSection = null;
  for (const line of schemaLines) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      inDeclSection = SCHEMA_DECL_SECTIONS.includes(h[1].trim().toLowerCase()) ? h[1].trim().toLowerCase() : null;
      continue;
    }
    const item = line.match(/^[ \t]*-[ \t]+(\S+)/);
    if (!item) continue;
    const token = item[1].trim();
    if (inDeclSection === "page types") {
      if (/^[a-z][a-z0-9-]*$/.test(token)) validTypes.add(token);
    } else if (inDeclSection === "page directories") {
      const dir = token.replace(/[\\/]+$/, "").replace(/^\.?[\\/]/, "");
      if (dir && !dir.includes("/")) declaredDirs.push(dir); // 只收单层目录名，拒绝路径穿越
    } else if (/^[a-z][a-z0-9.-]+$/.test(token)) {
      validTags.push(token);
    }
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

// v6：链接解析目录 = 规范五目录 + 根 + SCHEMA `## Page Directories` 声明的扩展目录
// （v5 曾硬编码 details/scratch/patterns —— 部署形态现由 SCHEMA 声明）
const CANONICAL_DIRS = ["entities", "concepts", "sources", "comparisons", "queries"];
const SEARCH_DIRS = [...CANONICAL_DIRS, ...declaredDirs, ""];
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
  // v6：type 值必须落在 基础五类 + SCHEMA `## Page Types` 声明的扩展集内
  const typeMatch = fm.match(/^type:\s*["']?([A-Za-z0-9_-]+)/m);
  if (typeMatch && !validTypes.has(typeMatch[1])) {
    frontmatterIssues.push({
      File: basename(file),
      Issue: `Invalid type '${typeMatch[1]}' — use a base type or declare it in SCHEMA.md '## Page Types'`,
    });
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

// === v6: staleness（raw 证据日期 vs 页面 updated；纯日期比较，零 LLM）===
// rawDir 解析链：--raw > $SKILL_ENV > ~/.config/parking-agents/skill-env.json（knowledgeBase.rawDir）
// 证据日期：frontmatter recorded_at / ingested / date（YYYY-MM-DD 前缀即可），缺省回退 mtime
// 匹配：raw 文件名去 recurrence- 前缀后与页面 basename 大小写不敏感比对
function resolveRawDir(cliRaw) {
  const normalize = (p) => (p && p.startsWith("~")) ? join(homedir(), p.replace(/^~[\\/]/, "")) : p;
  if (cliRaw) return normalize(cliRaw);
  const envPath = normalize(process.env.SKILL_ENV) || join(homedir(), ".config", "parking-agents", "skill-env.json");
  try {
    const cfg = JSON.parse(readFileSync(envPath, "utf8").replace(/^\uFEFF/, ""));
    return normalize(cfg.knowledgeBase?.rawDir || null);
  } catch { return null; }
}
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const stalePages = [];
let rawEvidenceScanned = 0;
const rawDir = resolveRawDir(rawArg);
if (rawDir && existsSync(rawDir)) {
  // lower(basename) -> { name: 原大小写页名, updated: YYYY-MM-DD | null（null = 缺 updated 字段）}
  const pageMeta = new Map();
  for (const file of allFiles) {
    const fmM = read(file).match(fmRe);
    pageMeta.set(baseName(file).toLowerCase(), {
      name: baseName(file),
      updated: fmM ? (fmM[1].match(/^updated:\s*["']?(\d{4}-\d{2}-\d{2})/m)?.[1] ?? null) : null,
    });
  }
  for (const rf of walkMd(rawDir)) {
    rawEvidenceScanned++;
    const target = basename(rf, extname(rf)).replace(/^recurrence-/, "").toLowerCase();
    if (!pageMeta.has(target)) continue;
    const fmS = read(rf).match(fmRe);
    let evDate = null;
    if (fmS) {
      for (const f of ["recorded_at", "ingested", "date"]) {
        const m = fmS[1].match(new RegExp(`^${f}:\\s*["']?(\\d{4}-\\d{2}-\\d{2})`, "m"));
        if (m) { evDate = m[1]; break; }
      }
    }
    if (!evDate) evDate = ymd(statSync(rf).mtime);
    const meta = pageMeta.get(target);
    if (!meta.updated || evDate > meta.updated) {
      // 同页多条证据只保留最新一条，避免报告噪声
      const prev = stalePages.find((s) => s.Page.toLowerCase() === target);
      const entry = { Page: meta.name, Evidence: basename(rf), EvidenceDate: evDate, PageUpdated: meta.updated || "(missing updated field)" };
      if (!prev || entry.EvidenceDate > prev.EvidenceDate) {
        if (prev) Object.assign(prev, entry); else stalePages.push(entry);
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

// === v6: staleness 报告 ===
console.log("\n" + C.cyan("=== Staleness (raw evidence vs page `updated`) ==="));
if (!rawDir || !existsSync(rawDir)) {
  console.log(C.yellow(`  Skipped — rawDir not found${rawDir ? `: ${rawDir}` : " (pass --raw or set knowledgeBase.rawDir)"}`));
} else {
  console.log(`  Scanned ${rawEvidenceScanned} raw evidence files (rawDir: ${rawDir})`);
  if (stalePages.length === 0) {
    console.log(C.green("  No stale pages — wiki knowledge is not older than any raw evidence."));
  } else {
    console.log(C.yellow(`  Stale Pages (${stalePages.length}) — raw evidence newer than page knowledge:`));
    for (const s of stalePages.sort((a, b) => b.EvidenceDate.localeCompare(a.EvidenceDate))) {
      console.log(C.yellow(`    ${s.Page}: ${s.Evidence} (${s.EvidenceDate}) > page updated ${s.PageUpdated}`));
    }
    if (!stalenessEnforce) {
      console.log(C.yellow("  (report-only — set scoring.stalenessEnforce=true to hard-gate)"));
    }
  }
}

// === 最终得分 ===
console.log("\n" + C.cyan("=== Final Score ==="));
const totalRounded = Math.round(totalScore * 10) / 10;
const stalenessFail = stalenessEnforce && stalePages.length > 0;
const pass = totalRounded >= minScore && brokenLinks.length === 0 && !stalenessFail;
// 总分展示 2 位小数：避免 9.95 四舍五入显示成 10 误导
console.log((totalRounded >= 9 ? C.green : totalRounded >= 7 ? C.yellow : C.red)(`  Total: ${totalScore.toFixed(2)} / 10`));
console.log(C.white(`  Threshold: ${minScore} / 10`));
if (pass) {
  console.log(C.green("  Status: PASS"));
} else if (stalenessFail) {
  console.log(C.red(`  Status: FAIL (staleness enforced: ${stalePages.length} stale pages — knowledge must be recompiled to cover newer raw evidence)`));
} else if (brokenLinks.length > 0 && totalRounded >= minScore) {
  console.log(C.red(`  Status: FAIL (hard gate: broken links must be 0 — found ${brokenLinks.length})`));
} else {
  console.log(C.red(`  Status: FAIL (score ${totalRounded} < ${minScore}; broken links: ${brokenLinks.length})`));
}

process.exit(pass ? 0 : 1);
