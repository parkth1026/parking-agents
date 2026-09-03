#!/usr/bin/env node
// validate-wiki.mjs — Wiki 校验 v7：8 维度综合检查 + staleness 体检 + 图结构体检
// （唯一入口；原 validate-wiki.ps1 已按仓库脚本标准移除）
//
// 用法: node validate-wiki.mjs --wiki <path/to/wiki> [--config <path/to/config.json>] [--raw <path/to/rawDir>]
// 退出码: 0 = PASS（总分 >= minScore 且断链为 0），1 = FAIL
//
// v7.0 变更（2026-09-02 wiki-top5 图谱审计后修复——342 页星型拓扑拿 10/10，暴露质量模型只看
//        「每页合规」不看「库是图」的盲区；见 skill 会话审计报告）:
//  14. 脚手架链接纳入断链：log.md / SCHEMA.md 的 [[wikilink]] 此前完全不被扫描
//      （「修复了 [[占位]] 断链」的日志自身再造一个活断链即此类）。现与 index.md 同口径
//      计入 Broken Links 硬门。与 index 的 v6.2 硬口径（反引号内也计入）不同：log/SCHEMA
//      是审计/规范文档，合法引用链接语法——代码围栏与反引号内联代码中的 [[示例]] 豁免
//  15. 有机孤儿（Organic Orphans）：默认 indexCountsAsInbound=true 下孤儿检查与 index 完整性
//      互为充要（每页都被要求进 index，index 链接又计入入链）→ 逻辑恒真，「孤儿 0」不能
//      证明图连通性。现恒报告「除 index 外零入链」页面；scoring.organicOrphansEnforce=true
//      时 FAIL（与 staleness/ambiguousNames 同过渡策略）
//  16. 未建链提及（Unlinked Mentions，advisory）：页面正文以纯文本出现其他页面 basename
//      但全页从未链过——关系数据（人名花名册/责任人/汇报线）以纯文本形态逃逸出图。
//      匹配规则：CJK 名 ≥2 字符、ASCII 名 ≥4 字符（3 字符缩写如 Sim/PCG 误报面过大）；
//      「链一次即豁免」：该页已 [[链]] 过的名字其余纯文本提及不再计；frontmatter/代码围栏/
//      行内代码中的出现不计；长名优先遮蔽防子串误报（王超凡 不误报 王超）
//  17. 图结构摘要（Graph Structure）：有机节点/边数、入度分布、顶级枢纽、叶子占比
//      —— hub-and-spoke 星型拓扑此前可满分，结构不可见则不可治理
//  18. index.md 行数检查（report-only）：目录页豁免 pageSize 维度后无人守门，
//      318 人目录超 200 行即此类；恒报告，超限时提示分层 MOC 拆分
//  19. 嵌套 vault 探测（report-only）：wikiDir 祖先存在 .obsidian 即告警——Obsidian 不支持
//      嵌套 vault，从父库打开时裸 [[名]] 因等深路径解析歧义，另一个同名页成死岛；
//      并枚举祖先库与本库的 basename 碰撞清单
//
// v6.2 变更（2026-08-19 iteration-8 严格审查后修复）:
//  12. 自引用检测大小写不敏感：[[transformer]] 在 Transformer.md 内此前既逃过 Self References
//      又自充 1 条入链（Windows 文件系统大小写不敏感、字符串比较敏感所致）；现与 v5 确立的
//      页面名匹配口径一致，变体自链同样不计出链、不计断链分母、不计入链
//  13. 同名 basename 歧义检测：跨目录同名页面（如 concepts/Attention.md + sources/Attention.md）
//      会让 [[Title]] 解析产生歧义（inbound/orphan/index 计数按 basename 去重静默丢失一方）。
//      Ambiguous Page Names 节独立报告（不计分），scoring.ambiguousNamesEnforce=true 时 FAIL
//      ——与 staleness 同过渡策略：先报告清积压，再开执行
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
//  11. staleness 证据扫描排除 tmp/ 目录（2026-08-19：raw/tmp 下的 wiki 修复前备份以 mtime
//      充当证据日期，产生 73 条假 stale 并掩盖真证据 recorded_at——tmp 是工作区不是证据区）
//
// v5 变更（2026-08-17 对抗审查后修复，见 docs/reports/wiki-lint-adversarial-review-2026-08-16）:
//   1. SCHEMA 标签过滤正则允许点号（ue5.5 等版本号标签不再误杀）
//   2. 断链维度分母不再双重计数（旧版 broken+totalLinkSum，而 totalLinkSum 已含断链）
//   3. 自引用不计入断链分母
//   4. index.md 的目录链接纳入断链检查（此前处于校验盲区）
//   5. index.md 目录链接计入入链（孤儿页口径，可用 scoring.indexCountsAsInbound 关闭）
//   6. EXCLUDED_NAMES / index 完整性匹配大小写不敏感

import { fileURLToPath } from "node:url";
import { dirname, join, basename, extname, relative, resolve, sep } from "node:path";
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

// ---- v7 工具：正则转义 / 非正文遮蔽（等长 \x00 填充，保持偏移稳定）----
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const maskFill = (m) => "\x00".repeat(m.length);
// 代码围栏与行内代码不是活文本：Obsidian 不渲染其中的链接，log/SCHEMA 引用语法属文档行为
function stripCodeSpans(content) {
  return content
    .replace(/```[\s\S]*?(```|$)/g, maskFill)
    .replace(/`[^`\n]*`/g, maskFill);
}
// frontmatter 之后才是正文
function stripFrontmatter(content) {
  return content.replace(/^---\s*\r?\n[\s\S]*?\r?\n---/, "");
}
const isCJKName = (s) => /^[\u4e00-\u9fff]/.test(s);

// ---- 入口 ----
const { wiki: wikiPath, config: configPath, raw: rawArg } = parseArgs(process.argv.slice(2));

console.log(C.cyan("=== Wiki Validation Script v7.0 ==="));
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
let ambiguousNamesEnforce = false;
let organicOrphansEnforce = false;
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
  if (typeof config.scoring?.ambiguousNamesEnforce === "boolean") ambiguousNamesEnforce = config.scoring.ambiguousNamesEnforce;
  if (typeof config.scoring?.organicOrphansEnforce === "boolean") organicOrphansEnforce = config.scoring.organicOrphansEnforce;
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
// v7：有机入链（仅内容页之间的链接；index/脚手架不算）——孤儿检查恒真缺陷的对症数据
const organicInboundCount = new Map();
const outboundCount = new Map();

for (const file of allFiles) {
  allPageNames.set(baseName(file), file);
  inboundCount.set(baseName(file), 0);
  organicInboundCount.set(baseName(file), 0);
}

// v6.2：同名 basename 歧义收集（跨目录同名让 [[Title]] 解析产生歧义）+
// 大小写不敏感的规范名映射（入链计数经它归一，变体大小写链接不再丢入链）
const ambiguousNames = [];
{
  const byLower = new Map();
  for (const file of allFiles) {
    const low = baseName(file).toLowerCase();
    if (!byLower.has(low)) byLower.set(low, []);
    byLower.get(low).push(file);
  }
  for (const [low, files] of byLower) {
    if (files.length > 1) ambiguousNames.push({ Name: low, Files: files.map((f) => relative(wikiPath, f)).sort() });
  }
  ambiguousNames.sort((a, b) => a.Name.localeCompare(b.Name));
}
const pageByLower = new Map();
for (const file of allFiles) {
  const low = baseName(file).toLowerCase();
  if (!pageByLower.has(low)) pageByLower.set(low, baseName(file));
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

    // 维度 2: 自引用（不计出链、不计断链分母；v6.2 大小写不敏感——[[transformer]]
    // 在 Transformer.md 内同样是自引用，且不再自充入链）
    if (linkText.toLowerCase() === baseName(file).toLowerCase()) {
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
      const canonical = pageByLower.get(linkText.toLowerCase());
      if (canonical) {
        inboundCount.set(canonical, inboundCount.get(canonical) + 1);
        organicInboundCount.set(canonical, organicInboundCount.get(canonical) + 1);
      }
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
      const canonical = pageByLower.get(target.toLowerCase());
      if (indexCountsAsInbound && canonical) {
        inboundCount.set(canonical, inboundCount.get(canonical) + 1);
      }
    } else {
      brokenLinks.push({ File: "index.md", Link: target });
    }
  }
}

// v7：脚手架文件（log.md / SCHEMA.md）的活链接纳入断链——此前完全不扫描，
// 「修复了 [[占位]]」的日志自身再造活断链即此类。与 index 的 v6.2 硬口径不同：
// log/SCHEMA 是审计/规范文档，合法引用链接语法，代码围栏与反引号内的 [[示例]] 豁免。
// 脚手架链接不计入任何页面的入链（审计记录不是知识边）。
for (const scaffoldName of ["log.md", "SCHEMA.md"]) {
  const scaffoldPath = join(wikiPath, scaffoldName);
  if (!existsSync(scaffoldPath)) continue;
  const prose = stripCodeSpans(read(scaffoldPath));
  for (const m of prose.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const target = m[1];
    totalLinkSum++;
    let found = false;
    for (const dir of SEARCH_DIRS) {
      if (existsSync(join(wikiPath, dir, `${target}.md`))) { found = true; break; }
    }
    if (!found) brokenLinks.push({ File: scaffoldName, Link: target });
  }
}

// === 维度 3: 孤儿页 ===
const orphanPages = [];
for (const [page] of allPageNames) {
  if (inboundCount.get(page) === 0) orphanPages.push(page);
}

// === v7: 有机孤儿（除 index.md 外零入链）===
// 默认配置下 Orphan Pages 与 Index Completeness 互为充要（逻辑恒真），不能证明图连通性；
// 本节恒报告真实孤立页面。scoring.organicOrphansEnforce=true 时升级为硬门。
const organicOrphans = [];
for (const [page] of allPageNames) {
  if (organicInboundCount.get(page) === 0) organicOrphans.push(page);
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

// === v7: 图结构摘要（有机 = 仅内容页之间的边，index/脚手架不计）===
// hub-and-spoke 星型拓扑在 8 维度下可拿满分——结构不可见则不可治理
const graphEdges = new Set(); // 无向去重边 "a\x00b"（a<b）
let graphDirectedEdges = 0;
for (const file of allFiles) {
  const src = baseName(file);
  const content = read(file);
  for (const m of content.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const canonical = pageByLower.get(m[1].split(/[|#]/)[0].trim().toLowerCase());
    if (!canonical || canonical === src) continue;
    graphDirectedEdges++;
    graphEdges.add(src < canonical ? `${src}\x00${canonical}` : `${canonical}\x00${src}`);
  }
}
const graphDist = { 0: 0, 1: 0, "2-3": 0, "4-10": 0, "11+": 0 };
for (const [page] of allPageNames) {
  const d = organicInboundCount.get(page) || 0;
  graphDist[d === 0 ? 0 : d === 1 ? 1 : d <= 3 ? "2-3" : d <= 10 ? "4-10" : "11+"]++;
}
const graphHubs = [...allPageNames.keys()]
  .map((p) => ({ name: p, d: organicInboundCount.get(p) || 0 }))
  .filter((h) => h.d > 0)
  .sort((a, b) => b.d - a.d)
  .slice(0, 5);
const leafPages = graphDist[0] + graphDist[1];
const leafRatio = totalPages > 0 ? leafPages / totalPages : 0;

// === v7: 未建链提及（advisory）——纯文本出现其他页面名但全页从未链过 ===
// 关系数据（花名册/责任人/汇报线）以纯文本形态逃逸出图的重灾区检测。
// 口径：CJK 名 ≥2 字符、ASCII 名 ≥4 字符；链一次即豁免该名其余提及；
// frontmatter/代码围栏/行内代码不计；长名优先遮蔽防子串误报。
const mentionCandidates = [...new Set([...pageByLower.values()])]
  .filter((n) => (isCJKName(n) ? n.length >= 2 : n.length >= 4))
  .sort((a, b) => b.length - a.length); // 长名先匹配先遮蔽
const unlinkedMentions = { total: 0, pages: 0, top: [] };
{
  const perPage = [];
  for (const file of allFiles) {
    const pageName = baseName(file);
    const linkedNames = new Set();
    for (const m of read(file).matchAll(/\[\[([^\]]+)\]\]/g)) {
      linkedNames.add(m[1].split(/[|#]/)[0].trim().toLowerCase());
    }
    // 正文 = 去 frontmatter + 代码区 + 全部 [[链接]] 跨度（等长遮蔽）
    let prose = stripFrontmatter(read(file));
    prose = stripCodeSpans(prose).replace(/\[\[[^\]]*\]\]/g, maskFill);
    let pageTotal = 0;
    const pageNames = [];
    for (const cand of mentionCandidates) {
      // 所有名字一律最长优先遮蔽（含自我/已链豁免者），防止其子串被较短名字误计；
      // 仅非豁免且计数 >0 者进入报告
      let cnt = 0;
      prose = prose.replace(new RegExp(escapeRegExp(cand), "gi"), (mm) => { cnt++; return maskFill(mm); });
      if (cnt === 0) continue;
      if (cand.toLowerCase() === pageName.toLowerCase()) continue; // 自我提及
      if (linkedNames.has(cand.toLowerCase())) continue;           // 链一次即豁免
      pageTotal += cnt;
      pageNames.push(`${cand}×${cnt}`);
    }
    if (pageTotal > 0) perPage.push({ file: basename(file), total: pageTotal, names: pageNames });
  }
  unlinkedMentions.total = perPage.reduce((s, p) => s + p.total, 0);
  unlinkedMentions.pages = perPage.length;
  unlinkedMentions.top = perPage.sort((a, b) => b.total - a.total).slice(0, 20);
}

// === v7: index.md 行数（report-only）——目录页豁免 pageSize 维度后无人守门 ===
let indexLines = null;
if (existsSync(indexPath)) indexLines = lineCount(read(indexPath));

// === v7: 嵌套 vault 探测（report-only）+ 祖先库 basename 碰撞 ===
// wikiDir 自带 .obsidian（本库即独立 vault）没问题；祖先带 .obsidian 才是嵌套冲突
let nestedVault = null;
let nestedCollisions = [];
{
  let dir = dirname(resolve(wikiPath));
  const limit = dirname(dir);
  for (; dir !== limit; dir = dirname(dir)) {
    if (existsSync(join(dir, ".obsidian"))) { nestedVault = dir; break; }
  }
  if (nestedVault) {
    const ownLower = new Set([...allPageNames.keys()].map((p) => p.toLowerCase()));
    const seen = new Set();
    let scanned = 0;
    for (const f of walkMd(nestedVault)) {
      // f 在本库子树内 → relative 返回不以 .. 开头的相对路径，跳过（两侧同口径：内容页对内容页）
      const rel = relative(wikiPath, f);
      if (rel !== ".." && !rel.startsWith("..")) continue;
      if (EXCLUDED_LOWER.has(basename(f).toLowerCase())) continue;
      if (++scanned > 5000) break; // 超大祖先库（如家目录）止损
      const low = basename(f, extname(f)).toLowerCase();
      if (ownLower.has(low) && !seen.has(low)) {
        seen.add(low);
        nestedCollisions.push(low);
      }
    }
    nestedCollisions.sort();
  }
}

// === v6: staleness（raw 证据日期 vs 页面 `updated`；纯日期比较，零 LLM）===
// rawDir 解析链：--raw > $SKILL_ENV > ~/.config/parking-agents/skill-env.json（knowledgeBase.rawDir）
// 证据日期：frontmatter recorded_at / ingested / date（YYYY-MM-DD 前缀即可），缺省回退 mtime
// 匹配：raw 文件名去 recurrence- 前缀后与页面 basename 大小写不敏感比对
// 范围：tmp/ 目录不参与扫描（工作区备份非证据，见头部变更 11）
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
  // tmp/ 是工作区（tmpDir 落点、wiki 修复前备份等）而非证据区：备份副本无日期字段，
  // 以 mtime 当证据日期既制造假 stale，又借「同页取最新」掩盖真证据的 recorded_at
  const isTmpPath = (p) => p.split(/[\\/]+/).includes("tmp");
  for (const rf of walkMd(rawDir)) {
    if (isTmpPath(rf)) continue;
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

// === v6.2: 同名 basename 歧义报告 ===
console.log("\n" + C.cyan("=== Ambiguous Page Names (duplicate basenames across directories) ==="));
if (ambiguousNames.length === 0) {
  console.log(C.green("  No ambiguous page names — every [[wikilink]] target resolves to exactly one page."));
} else {
  console.log(C.yellow(`  Ambiguous Page Names (${ambiguousNames.length}) — [[Title]] resolution is ambiguous:`));
  for (const a of ambiguousNames) console.log(C.yellow(`    '${a.Name}' used by: ${a.Files.join(", ")}`));
  if (!ambiguousNamesEnforce) {
    console.log(C.yellow("  (report-only — set scoring.ambiguousNamesEnforce=true to hard-gate)"));
  }
}

// === v7: 有机孤儿报告 ===
console.log("\n" + C.cyan("=== Organic Orphans (zero inbound excluding index.md) ==="));
if (organicOrphans.length === 0) {
  console.log(C.green("  No organic orphans — every page earns at least one inbound link from real content."));
} else {
  console.log(C.yellow(`  Organic Orphans (${organicOrphans.length}) — reachable only via index.md, invisible to the orphan check when indexCountsAsInbound=true:`));
  for (const o of organicOrphans) console.log(C.yellow(`    ${o}`));
  if (!organicOrphansEnforce) {
    console.log(C.yellow("  (report-only — set scoring.organicOrphansEnforce=true to hard-gate)"));
  }
}

// === v7: 图结构摘要 ===
console.log("\n" + C.cyan("=== Graph Structure (content-page edges only, index.md excluded) ==="));
console.log(`  ${totalPages} nodes, ${graphEdges.size} undirected edges (${graphDirectedEdges} directed), avg organic in-degree ${(totalPages > 0 ? graphDirectedEdges / totalPages : 0).toFixed(2)}`);
console.log(`  Organic in-degree distribution: 0: ${graphDist[0]} | 1: ${graphDist[1]} | 2-3: ${graphDist["2-3"]} | 4-10: ${graphDist["4-10"]} | 11+: ${graphDist["11+"]}`);
if (graphHubs.length > 0) {
  console.log(`  Top hubs by organic inbound: ${graphHubs.map((h) => `${h.name}=${h.d}`).join(", ")}`);
}
if (leafRatio > 0.7) {
  console.log(C.yellow(`  Leaf ratio ${(leafRatio * 100).toFixed(1)}% (≤1 organic inbound) — hub-and-spoke topology; surface relationships (rosters, reporting lines, cross-references) as [[wikilinks]] or the graph stays unnavigable`));
} else {
  console.log(C.green(`  Leaf ratio ${(leafRatio * 100).toFixed(1)}% (≤1 organic inbound)`));
}

// === v7: 未建链提及报告（advisory）===
console.log("\n" + C.cyan("=== Unlinked Mentions (advisory) ==="));
if (unlinkedMentions.total === 0) {
  console.log(C.green("  No unlinked mentions — page names appearing in plain text are linked somewhere on the same page."));
} else {
  console.log(C.yellow(`  ${unlinkedMentions.total} page-name mention(s) on ${unlinkedMentions.pages} page(s) appear as plain text with zero links to that page (top 20 by count):`));
  for (const p of unlinkedMentions.top) {
    console.log(C.yellow(`    ${p.file}: ${p.total} — ${p.names.slice(0, 6).join(", ")}${p.names.length > 6 ? ", …" : ""}`));
  }
  console.log(C.yellow("  (advisory — fix by linking names in structured fields (rosters/owners/reporting lines); verbatim-quote corpora may keep some by design)"));
}

// === v7: 脚手架健康（index 行数 + 嵌套 vault）===
console.log("\n" + C.cyan("=== Scaffolding Health ==="));
if (indexLines === null) {
  console.log(C.yellow("  index.md not found"));
} else if (indexLines > maxLines) {
  console.log(C.yellow(`  index.md: ${indexLines} lines (max: ${maxLines}) — split into hierarchical MOC pages (per-section sub-indexes) linked from a slim index`));
} else {
  console.log(C.green(`  index.md: ${indexLines} lines (max: ${maxLines})`));
}
if (nestedVault) {
  console.log(C.yellow(`  Nested vault: wikiDir sits inside another Obsidian vault (.obsidian found at ${nestedVault})`));
  if (nestedCollisions.length > 0) {
    const sample = nestedCollisions.slice(0, 10).join(", ");
    console.log(C.yellow(`    ${nestedCollisions.length} basename collision(s) with pages in the ancestor vault: ${sample}${nestedCollisions.length > 10 ? ", …" : ""}`));
    console.log(C.yellow("    Bare [[links]] resolve ambiguously when the vault is opened from the parent — relocate the wiki or namespace the colliding pages"));
  } else {
    console.log(C.yellow("    No basename collisions with ancestor vault pages — link resolution is ambiguous only for future name overlaps"));
  }
} else {
  console.log(C.green("  No ancestor .obsidian — wikiDir is not nested inside another vault"));
}

// === 最终得分 ===
console.log("\n" + C.cyan("=== Final Score ==="));
const totalRounded = Math.round(totalScore * 10) / 10;
const stalenessFail = stalenessEnforce && stalePages.length > 0;
const ambiguousFail = ambiguousNamesEnforce && ambiguousNames.length > 0;
const organicOrphansFail = organicOrphansEnforce && organicOrphans.length > 0;
const pass = totalRounded >= minScore && brokenLinks.length === 0 && !stalenessFail && !ambiguousFail && !organicOrphansFail;
// 总分展示 2 位小数：避免 9.95 四舍五入显示成 10 误导
console.log((totalRounded >= 9 ? C.green : totalRounded >= 7 ? C.yellow : C.red)(`  Total: ${totalScore.toFixed(2)} / 10`));
console.log(C.white(`  Threshold: ${minScore} / 10`));
if (pass) {
  console.log(C.green("  Status: PASS"));
} else if (organicOrphansFail) {
  console.log(C.red(`  Status: FAIL (organic orphans enforced: ${organicOrphans.length} page(s) with zero inbound excluding index.md — earn real inbound links or merge them)`));
} else if (stalenessFail) {
  console.log(C.red(`  Status: FAIL (staleness enforced: ${stalePages.length} stale pages — knowledge must be recompiled to cover newer raw evidence)`));
} else if (ambiguousFail) {
  console.log(C.red(`  Status: FAIL (ambiguous page names enforced: ${ambiguousNames.length} name(s) shared by multiple pages — rename one to disambiguate)`));
} else if (brokenLinks.length > 0 && totalRounded >= minScore) {
  console.log(C.red(`  Status: FAIL (hard gate: broken links must be 0 — found ${brokenLinks.length})`));
} else {
  console.log(C.red(`  Status: FAIL (score ${totalRounded} < ${minScore}; broken links: ${brokenLinks.length})`));
}

process.exit(pass ? 0 : 1);
