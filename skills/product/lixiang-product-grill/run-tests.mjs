#!/usr/bin/env node
// run-tests.mjs — lixiang-product-grill 的回归测试（升级/改动后必跑）
// 本技能产出主观（复盘质量），输出不做断言（design.md AC-6 走人工评审）；
// 这里固化结构完整性：题库 14 维度逐字锚定、wiki、archive、协议要素、报告模板、触发面、附注护栏。
// 断言边界：只断言静态文件，不断言聚合器产物（trigger-benchmark.json / benchmark / history runs）。
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(SKILL_DIR, p), "utf8");

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}

// ---------- 公共数据 ----------

const MODULES = ["产品战略", "从0到1", "从1到10"];
const MODULE_HEADERS = ["## 模块一：产品战略", "## 模块二：从0到1", "## 模块三：从1到10"];
const DIMS = [
  { name: "定位", lec: "02", mod: 0, s: "S02-定位" },
  { name: "品牌", lec: "03", mod: 0, s: "S03-品牌" },
  { name: "文化", lec: "04", mod: 0, s: "S04-文化" },
  { name: "产品标准", lec: "05", mod: 0, s: "S05-产品标准" },
  { name: "团队标准", lec: "06", mod: 0, s: "S06-团队标准" },
  { name: "体验", lec: "07", mod: 1, s: "S07-体验" },
  { name: "用户", lec: "08", mod: 1, s: "S08-用户" },
  { name: "技术", lec: "09", mod: 1, s: "S09-技术" },
  { name: "定价", lec: "10", mod: 1, s: "S10-定价" },
  { name: "复盘", lec: "11", mod: 2, s: "S11-复盘" },
  { name: "节奏", lec: "12", mod: 2, s: "S12-节奏" },
  { name: "流程", lec: "13", mod: 2, s: "S13-流程" },
  { name: "门店", lec: "14", mod: 2, s: "S14-门店" },
  { name: "利润", lec: "15", mod: 2, s: "S15-利润" },
];
const SIX_ELEMENTS = ["李想的标准", "核心问题", "追问", "红旗", "合格线", "合理答案的样子"];

const ARCHIVE_DIR = "references/archive";
const WIKI_DIR = "references/wiki";

function normalize(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*/g, "")
    .split("\n")
    .map((l) => l.replace(/^\s*>?\s?/, "").trim())
    .join("\n")
    .trim();
}

function archiveFiles() {
  return readdirSync(join(SKILL_DIR, ARCHIVE_DIR)).filter((f) => f.endsWith(".md") && f !== "README.md");
}
function archiveText(file) {
  return normalize(readFileSync(join(SKILL_DIR, ARCHIVE_DIR, file), "utf8"));
}
function archiveByLecture(lec) {
  return archiveFiles().find((f) => f.startsWith(`${lec}-`));
}
// 提取「…」（NN 讲）引文-讲次对
function quotePairs(text) {
  return [...text.matchAll(/「([^」]+)」（(\d\d) 讲）/g)].map((m) => ({ q: m[1], lec: m[2] }));
}

const skill = read("SKILL.md");
const bank = read("references/question-bank.md");
const bankDimPart = bank.split("## 层间依赖检查")[0];

// ---------- [基线] ----------

const fm = skill.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
const descLine = fm.split("\n").find((l) => l.startsWith("description:")) ?? "";
const descValue = descLine.replace(/^description:\s*/, "").trim();
check("[基线] frontmatter name 与目录一致（lixiang-product-grill）", fm.includes("name: lixiang-product-grill"));
check("[基线] description 名字触发字款式：剔除 name 后 ≤16 字符", descValue.includes("lixiang-product-grill") && descValue.replace("lixiang-product-grill", "").length <= 16);
check("[基线] description 含中文名「李想产品复盘」", descValue.includes("李想产品复盘"));
check("[基线] SKILL.md 无 TODO/占位残留", !skill.includes("[TODO") && !skill.includes("TODO:"));

// ---------- [题库] ----------

check("[题库] 文件头目录（TOC）在位", /^## 目录$/m.test(bank) && bank.indexOf("## 目录") < bank.indexOf(MODULE_HEADERS[0]));
check("[题库] 题库超过 100 行", bank.split("\n").length > 100);

const modIdx = MODULE_HEADERS.map((h) => bank.indexOf(h));
const depIdx = bank.indexOf("## 层间依赖检查");
const modSlices = modIdx.map((ix, i) => bank.slice(ix, modIdx[i + 1] ?? depIdx));

for (const d of DIMS) {
  // 块头唯一：全库恰有一个「### <名>（」头
  const headerRe = new RegExp(`^### ${d.name}（`, "gm");
  const headerCount = [...bank.matchAll(headerRe)].length;
  const seg = modSlices[d.mod];
  const hMatch = seg.match(new RegExp(`^### ${d.name}（[^\\n]*$`, "m"));
  const after = hMatch ? seg.slice(hMatch.index + hMatch[0].length) : "";
  const block = hMatch ? hMatch[0] + after.split(/^### /m)[0] : "";
  check(`[题库] 维度「${d.name}（${d.lec} 讲）」块头恰好一个`, headerCount === 1 && Boolean(hMatch));
  check(`[题库] 维度「${d.name}」六要素在块内独立命中`, SIX_ELEMENTS.every((e) => block.includes(e)));
  check(`[题库] 维度「${d.name}」块含 S-页指针且 S 页存在`, block.includes(`弹药页：${d.s}`) && existsSync(join(SKILL_DIR, WIKI_DIR, "sources", `${d.s}.md`)));
  const quotes = quotePairs(block);
  check(`[题库] 维度「${d.name}」标准句逐字＋讲次（≥1 条且全部含该讲次标注）`, quotes.length >= 1 && quotes.every((p) => p.lec === d.lec));
}

// ---------- [层序] ----------

check("[层序] 题库模块层序：产品战略 → 从0到1 → 从1到10 严格递增", modIdx[0] !== -1 && modIdx[0] < modIdx[1] && modIdx[1] < modIdx[2]);
check("[层序] 题库三模块名齐全", MODULES.every((m) => bank.includes(m)));
check("[层序] SKILL.md 含「禁止反向」", skill.includes("禁止反向"));

// ---------- [断点] ----------

const depPart = bank.slice(depIdx);
const breakpointItems = [...depPart.matchAll(/^\d+\./gm)].length;
check("[断点] 层间依赖检查含五个断点", breakpointItems === 5);
const anchors = quotePairs(depPart);
check("[断点] 锚点断点 ≥3（逐条带课程逐字锚点）", anchors.length >= 3);
const openers = /^(各位|你好|总结一下|下一讲|谢谢|以上就是)/;
let anchorOk = true;
let anchorDetail = "";
for (const a of anchors) {
  const file = archiveByLecture(a.lec);
  if (!file) { anchorOk = false; anchorDetail += `[${a.lec}]无对应讲;`; continue; }
  const nq = a.q.trim();
  const arcN = archiveText(file);
  const raw = readFileSync(join(SKILL_DIR, ARCHIVE_DIR, file), "utf8");
  const lines = raw.split("\n");
  const lineNo = lines.findIndex((l) => normalize(l).includes(normalize(nq)));
  if (nq.length < 8 || openers.test(nq)) { anchorOk = false; anchorDetail += `「${nq.slice(0, 12)}…」套话/过短;`; }
  if (!arcN.includes(normalize(nq))) { anchorOk = false; anchorDetail += `「${nq.slice(0, 12)}…」未命中${a.lec}讲;`; }
  if (lineNo >= 0 && (lineNo < 2 || lineNo > lines.length - 3)) { anchorOk = false; anchorDetail += `「${nq.slice(0, 12)}…」位于${a.lec}讲首尾;`; }
  const otherHit = archiveFiles().filter((f) => !f.startsWith(`${a.lec}-`) && archiveText(f).includes(normalize(nq)));
  if (otherHit.length) { anchorOk = false; anchorDetail += `「${nq.slice(0, 12)}…」另命中${otherHit.join(",")};`; }
}
check("[断点] 锚点句 ≥8 字符、非开场/收尾套话、逐字命中标注讲次且不命中其他讲", anchorOk || console.log(anchorDetail));
const depItems = depPart.split(/\n(?=\d+\. )/).slice(1);
check("[断点] 无锚点断点显式标注「本技能自构检查」（有锚点则免标）", depItems.every((it) => quotePairs(it).length >= 1 || it.includes("本技能自构检查")));

// ---------- [协议] 13 要素 ----------

check("[协议] 一次一问铁律", skill.includes("一次一问"));
check("[协议] 证据三级（有据/口头断言/答不上）", skill.includes("有据") && skill.includes("口头断言") && skill.includes("答不上"));
check("[协议] 裁定四档（符合/部分符合/缺失/冲突）", ["符合", "部分符合", "缺失", "冲突"].every((x) => skill.includes(x)));
check("[协议] 层间依赖检查", skill.includes("层间依赖检查"));
check("[协议] 多问句拆开逐问", skill.includes("拆开逐问"));
check("[协议] 示例回合", skill.includes("示例回合"));
check("[协议] 引用你的思考（核心动作）", skill.includes("引用你的思考"));
check("[协议] 对话正文提问（不使用带选项面板的结构化提问工具）", skill.includes("不使用带选项面板的结构化提问工具") && !skill.includes("AskUserQuestion"));
check("[协议] 合理答案的判据", skill.includes("合理答案的判据"));
check("[协议] 校准式认可", skill.includes("校准式认可"));
check("[协议] 复述确认（复述成）", skill.includes("复述成"));
check("[协议] 开场菜单倒序（①维度→②模块→③全量垫底）", /①.{0,40}维度/.test(skill) && /②.{0,20}模块/.test(skill) && /③.{0,10}全量/.test(skill));
check("[协议] smart-skip 激进措辞", skill.includes("smart-skip（默认激进）"));
check("[协议] 每维度读 S 页（弹药页指针写入协议）", skill.includes("每维度必读") && skill.includes("弹药页"));
check("[协议] 裁定唯一依据＝题库", skill.includes("裁定唯一依据＝题库"));

// ---------- [报告模板] ----------

const report = read("references/report-format.md");
check("[报告模板] 含 14 维度×三模块矩阵", MODULES.every((m) => report.includes(m)) && DIMS.every((d) => report.includes(d.name)));
check("[报告模板] 矩阵行带讲次标注", DIMS.every((d) => report.includes(`${d.name}（${d.lec} 讲）`)));
check("[报告模板] 含层间依赖断裂点", report.includes("层间依赖断裂点"));
check("[报告模板] 含前三差距与最小补救动作", report.includes("前三差距") && report.includes("最小补救动作"));
check("[报告模板] 含推翻该裁定的条件/推翻整个复盘结论", report.includes("推翻该裁定") && report.includes("推翻整个复盘结论"));
check("[报告模板] 含「你是怎么思考这个产品的」节", report.includes("你是怎么思考这个产品的"));
check("[报告模板] 推荐四要素（依据/影响/推荐强度）", report.includes("依据") && report.includes("影响") && report.includes("推荐强度"));
check("[报告模板] 裁定口径四档说明", report.includes("部分符合：方向对但合格线有缺口"));

// ---------- [web-prompt] ----------

const web = read("web-prompt.md");
check("[web-prompt] 14 维度全覆盖", DIMS.every((d) => web.includes(d.name)));
check("[web-prompt] 三模块与层序", MODULES.every((m) => web.includes(m)) && web.indexOf("产品战略") < web.indexOf("从0到1") && web.indexOf("从0到1") < web.indexOf("从1到10"));
check("[web-prompt] 一次一问铁律", web.includes("一次一问"));
check("[web-prompt] 提问写在对话正文（不用选项面板）", web.includes("提问写在对话正文"));
check("[web-prompt] 不耐烦降级方案", web.includes("不耐烦降级"));
check("[web-prompt] 报告结构收尾（矩阵/断裂点/前三差距）", web.includes("符合度矩阵") && web.includes("断裂点") && web.includes("前三差距"));
check("[web-prompt] 自包含：不引用技能内部文件路径", !web.includes("references/") && !web.includes("question-bank"));
check("[web-prompt] 层间依赖五断点", web.includes("五个断点") && depPart.split(/\n(?=\d+\. )/).slice(1).length === 5);

// ---------- [附注护栏] ----------

const article = read("references/lixiang-ceo-article.md");
check("[附注护栏] 旧文章头部含非尺子声明", article.slice(0, 600).includes("非本技能尺子"));
const loadingList = skill.slice(skill.indexOf("**资源加载**"), skill.indexOf("## 复盘协议"));
check("[附注护栏] SKILL 资源加载清单不含旧文章", !loadingList.includes("lixiang-ceo-article"));

const BLACKLIST_BARE = ["行业趋势", "行业问题", "进攻方向", "用户定位", "时间节奏", "业务架构", "在线系统", "运营系统", "认知决定战略，战略决定业务", "量变带来质变", "独一无二的资质", "高保真映射"];
const BLACKLIST_COMBOS = ["模块 6：目标要求", "时间节奏、目标要求", "每个运营环节必须形成闭环", "运营体系必须是闭环"]; // carve-out 降级：目标要求（11 讲原文使用）、闭环（01/06/12 讲原文使用），降级决定记 design.md
const scopeFiles = { "question-bank.md": bank, "SKILL.md": skill, "web-prompt.md": web };
for (const [fn, text] of Object.entries(scopeFiles)) {
  check(`[附注护栏] ${fn} 无旧九模块名与旧签名句（12 项裸词/裸串）`, BLACKLIST_BARE.every((w) => !text.includes(w)));
  check(`[附注护栏] ${fn} 无降级组合串（目标要求/闭环 carve-out 长串）`, BLACKLIST_COMBOS.every((w) => !text.includes(w)));
}

// ---------- [wiki 结构] ----------

check("[wiki 结构] SCHEMA/index/log 三件套在位", ["SCHEMA.md", "index.md", "log.md"].every((f) => existsSync(join(SKILL_DIR, WIKI_DIR, f))));
const srcPages = readdirSync(join(SKILL_DIR, WIKI_DIR, "sources")).filter((f) => f.endsWith(".md"));
const conPages = readdirSync(join(SKILL_DIR, WIKI_DIR, "concepts")).filter((f) => f.endsWith(".md"));
const casePages = readdirSync(join(SKILL_DIR, WIKI_DIR, "cases")).filter((f) => f.endsWith(".md"));
check("[wiki 结构] sources=19", srcPages.length === 19);
check("[wiki 结构] concepts ≥12", conPages.length >= 12);
check("[wiki 结构] cases ≥12", casePages.length >= 12);
const wikiIndex = read(`${WIKI_DIR}/index.md`);
const wikiSchema = read(`${WIKI_DIR}/SCHEMA.md`);
const allWikiPages = [...srcPages, ...conPages, ...casePages].map((f) => f.replace(/\.md$/, ""));
check("[wiki 结构] index [[]] 覆盖全部内容页", allWikiPages.every((p) => wikiIndex.includes(`[[${p}]]`)));
check("[wiki 结构] SCHEMA 声明 case 类型与 cases 目录", /^-\s*case\b/m.test(wikiSchema) && /^-\s*cases\b/m.test(wikiSchema));
let fmOk = true;
let fmDetail = "";
for (const [dir, pages, type] of [["sources", srcPages, "source"], ["concepts", conPages, "concept"], ["cases", casePages, "case"]]) {
  for (const p of pages) {
    const t = readFileSync(join(SKILL_DIR, WIKI_DIR, dir, p), "utf8");
    const pfm = t.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    if (!t.startsWith("---") || !pfm.includes("title:") || !pfm.includes("type:") || !pfm.includes(`type: ${type}`) || !pfm.includes("tags:")) {
      fmOk = false; fmDetail += `${dir}/${p};`;
    }
    if (t.includes("合格线") || t.includes("裁定")) { fmOk = false; fmDetail += `${dir}/${p} 禁词;`; }
  }
}
check("[wiki 结构] frontmatter 硬门（title/type/tags）齐全且类型正确", fmOk || console.log(fmDetail));
check("[wiki 结构] wiki 页不含裁定措辞（合格线/裁定）", fmOk);
let outlinkOk = true;
let outlinkDetail = "";
const wikiSet = new Set(allWikiPages);
for (const [dir, pages] of [["sources", srcPages], ["concepts", conPages], ["cases", casePages]]) {
  for (const p of pages) {
    const t = readFileSync(join(SKILL_DIR, WIKI_DIR, dir, p), "utf8");
    const name = p.replace(/\.md$/, "");
    const links = [...t.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?\]\]/g)].map((m) => m[1].trim());
    if (links.length < 2) { outlinkOk = false; outlinkDetail += `${name} 出链<2;`; }
    for (const l of links) {
      if (l === name || !wikiSet.has(l)) { outlinkOk = false; outlinkDetail += `${name}→${l};`; }
    }
  }
}
check("[wiki 结构] 每页 ≥2 条出链、无自引、无断链", outlinkOk || console.log(outlinkDetail));

// ---------- [三层一致]（抽查 ≥5 维度，三模块各 ≥1）----------

const SAMPLED = [DIMS[0], DIMS[3], DIMS[5], DIMS[8], DIMS[10], DIMS[13]]; // 定位/产品标准/体验/定价/节奏/门店
check("[三层一致] 抽样覆盖三模块（各 ≥1，共 6 维度）", SAMPLED.filter((d) => d.mod === 0).length >= 1 && SAMPLED.filter((d) => d.mod === 1).length >= 1 && SAMPLED.filter((d) => d.mod === 2).length >= 1 && SAMPLED.length >= 5);
for (const d of SAMPLED) {
  const sText = readFileSync(join(SKILL_DIR, WIKI_DIR, "sources", `${d.s}.md`), "utf8");
  const sfm = sText.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const sArc = sfm.match(/^sources:\s*"?([^"\n]+)"?/m)?.[1]?.trim();
  const sec = sText.match(/^## 引文\s*\n([\s\S]*?)(?=^## )/m)?.[1] ?? "";
  const secN = normalize(sec);
  const arcFile = archiveByLecture(d.lec);
  const arcN = arcFile ? archiveText(arcFile) : "";
  const quotes = quotePairs(bankDimPart).filter((p) => p.lec === d.lec);
  let ok = Boolean(sArc) && sArc === `${ARCHIVE_DIR}/${arcFile}` && quotes.length >= 1;
  for (const { q } of quotes) {
    const nq = normalize(q);
    if (nq.length < 10 || !secN.includes(nq) || !arcN.includes(nq)) { ok = false; }
  }
  // 引文块整体逐字 ⊂ archive
  const blocks = sec.split(/\n\s*\n/).filter((b) => b.trim().startsWith(">")).map(normalize);
  if (!blocks.length || !blocks.every((b) => arcN.includes(b))) ok = false;
  check(`[三层一致] ${d.name}（${d.lec} 讲）：标准句 ⊂ S${d.lec} 引文段 ⊂ ${d.lec} 讲 archive（双跳逐字）`, ok);
}

// ---------- [archive] ----------

const arcList = archiveFiles();
check("[archive] 19 篇原文（16 正课＋发刊词＋2 加餐）", arcList.length === 19);
check("[archive] 讲次命名（01-16 正课文件名带讲次号）", Array.from({ length: 16 }, (_, i) => String(i + 1).padStart(2, "0")).every((n) => arcList.some((f) => f.startsWith(`${n}-`))));
check("[archive] 发刊词与 2 篇加餐在位（工具手册领取页/产品奖学金）", arcList.includes("发刊词-一个产品经理的十五个挑战.md") && arcList.includes("学习之前，来领取工具手册（仅限已购用户）.md") && arcList.includes("产品奖学金任务开启，邀你来挑战.md"));
const arcReadme = read(`${ARCHIVE_DIR}/README.md`);
check("[archive] 溯源头三字段（来源仓/抓取日期/仅个人使用）", arcReadme.includes("来源仓") && arcReadme.includes("抓取日期") && arcReadme.includes("仅个人使用"));
check("[archive] 溯源头记抓取日期 2026-10-04", arcReadme.includes("2026-10-04"));

// ---------- [出厂门禁] ----------

let pathHits = [];
const BS = "\\";
const machinePathRe = new RegExp(`G:${BS}+|G:${"/"}+|C:${BS}+Users|C:${"/"}+Users`);
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.(md|mjs)$/.test(e.name)) {
      const t = readFileSync(full, "utf8");
      if (machinePathRe.test(t)) pathHits.push(relative(SKILL_DIR, full));
    }
  }
})(SKILL_DIR);
check("[出厂门禁] 技能 .md/.mjs 无机器绝对路径（G:\\、C:\\Users）", pathHits.length === 0 || console.log(pathHits.join(",")));

// ---------- [design] ----------

const design = read("references/design.md");
check("[design] AC-1..AC-9 标记齐全", ["AC-1", "AC-2", "AC-3", "AC-4", "AC-5", "AC-6", "AC-7", "AC-8", "AC-9"].every((x) => design.includes(x)));
check("[design] 含「触发模式：名字触发」声明行", design.includes("触发模式：名字触发"));
check("[design] 含黑名单降级记录（carve-out）", design.includes("降级为长串组合"));
check("[design] 含 archive 选篇取舍记录", design.includes("选篇取舍"));
check("[design] 迭代记录在位", design.includes("迭代记录"));

// ---------- [配套同步] ----------

const yaml = read("agents/openai.yaml");
check("[配套同步] openai.yaml display_name 为新名", yaml.includes('display_name: "lixiang-product-grill"'));
check("[配套同步] openai.yaml default_prompt 用新名", yaml.includes("$lixiang-product-grill"));
check("[配套同步] openai.yaml short_description 换 16 讲身份", yaml.includes("16讲") || yaml.includes("16 讲") || yaml.includes("14 维度"));
const history = JSON.parse(read("history.json"));
check("[配套同步] history.json 顶层 skill=新名", history.skill === "lixiang-product-grill");
const pkgPath = join(SKILL_DIR, "../../workflow/parking-skill-creator/scripts/package-skill.mjs");
const pkg = existsSync(pkgPath) ? readFileSync(pkgPath, "utf8") : "";
check("[配套同步] package-skill 排除清单含 references/archive/（精确路径）", pkg.includes("EXCLUDE_PATHS") && pkg.includes('"references/archive"'));

// ---------- [触发面] ----------

const te = JSON.parse(read("trigger-evals.json"));
const qs = te.queries ?? [];
const ids = qs.map((q) => q.id);
const texts = qs.map((q) => q.text);
const pos = qs.filter((q) => q.should_trigger);
const neg = qs.filter((q) => !q.should_trigger);
const VALID_EXPECTED = new Set(["lixiang-product-grill", "ceo-copilot", "b2b-product-review", "none"]);
check("[触发面] skill 字段为 lixiang-product-grill 且题库非空", te.skill === "lixiang-product-grill" && qs.length >= 19);
check("[触发面] 正例 ≥6（英文点名与中文名点名各 ≥1）", pos.length >= 6 && pos.some((q) => q.text.includes("lixiang-product-grill")) && pos.some((q) => q.text.includes("李想产品复盘")));
check("[触发面] 负例 ≥13", neg.length >= 13);
check("[触发面] 必含逐字旧短语「用李想方法论盘一下」", neg.some((q) => q.text.includes("用李想方法论盘一下")));
check("[触发面] 必含旧名点名「lixiang-ceo-grill」", neg.some((q) => q.text.includes("lixiang-ceo-grill")));
check("[触发面] ceo-copilot 邻域题 ≥2", qs.filter((q) => q.expected_skill === "ceo-copilot").length >= 2);
check("[触发面] b2b-product-review 邻域语域负例 ≥2 且 expected=none", qs.filter((q) => /B ?端|b2b|失败预演|投前挑刺|企业服务/i.test(q.text) && q.expected_skill === "none").length >= 2);
check("[触发面] id 唯一且 text 唯一", new Set(ids).size === ids.length && new Set(texts).size === texts.length);
check("[触发面] expected_skill 全部属于四值集合", qs.every((q) => VALID_EXPECTED.has(q.expected_skill)));
check("[触发面] scoring 用 exact_string", JSON.stringify(te.scoring ?? {}).includes("exact_string"));

// ---------- [互鉴移植] 2026-10-07 ----------
check("[协议] 读取完成契约（截断不算读过、维度输出前完成 S 页、失败如实报告）",
  skill.includes("读取完成契约") && skill.includes("截断、读取报错") && skill.includes("如实报告缺失") && skill.includes("读取记录不写进复盘对话"));
check("[协议] 数字纪律（只用用户/材料数字、课程案例标注、不代估）",
  skill.includes("数字纪律") && skill.includes("只用用户给出或材料里的数字") && skill.includes("不代入自己估的数"));
check("[协议] 中途直问先答", skill.includes("中途直问先答") && skill.includes("再回到当前维度流程"));
check("[web-prompt] 数字纪律同步", web.includes("数字纪律") && web.includes("只用我给出或材料里的数字"));
check("[web-prompt] 直问先答同步", web.includes("直问先答"));
check("[design] AC-10..AC-12 在场", ["AC-10", "AC-11", "AC-12"].every((x) => design.includes(x)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
