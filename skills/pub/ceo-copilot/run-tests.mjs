#!/usr/bin/env node
// run-tests.mjs — ceo-copilot 的回归测试（升级/改动后必跑）
// 诊断报告是主观判断产物，不硬上输出断言；本测试做客观结构自检：
// frontmatter 合法、SKILL.md 指向的参考页齐全、地图八层与共享词表在位、
// 无待办占位与待裁定残留、运行时参考里无设计期测试样例残留（防评测泄题）。
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const REF = join(SKILL_DIR, "references");
const read = (p) => readFileSync(join(SKILL_DIR, p), "utf8");

let pass = 0;
let fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? `：${detail}` : ""}`); }
}

// --- SKILL.md frontmatter 与占位 ---
const skill = read("SKILL.md");
const fmName = /^name:\s*(\S+)/m.exec(skill)?.[1];
check("SKILL.md name 与目录名一致", fmName === "ceo-copilot");
const desc = /^description:\s*(.+)$/m.exec(skill)?.[1] ?? "";
check("description 存在且 ≤1024 字符", desc.length > 0 && desc.length <= 1024, `${desc.length} 字符`);
check("description 无尖括号", !/[<>]/.test(desc));
check("description 定义独立的商业诊断范围", desc.includes("面向产品立项") && desc.includes("商业证明链") && !desc.includes("区别："));
const triggerEval = JSON.parse(read("trigger-evals.json"));
const positiveQueries = triggerEval.queries.filter((q) => q.should_trigger === true);
const negativeQueries = triggerEval.queries.filter((q) => q.should_trigger === false);
const businessMarkers = /(商业|产品|新业务|定价|业务|客户|付费|市场|投资|获客|创业|采购|销售)/;
// 2026-10-02 AC-006 迁移：相邻商业近似题是有效负例。保留题数、平衡和无关反例的防误触发检查。
// 完整迁移记录随 issue31-closure/trigger/frozen/assertion-migration.json 保存。
const canonicalTriggerNames = new Set(["ceo-copilot", "lixiang-ceo-grill", "b2b-product-review", "none"]);
const neighborQueries = triggerEval.queries.filter((q) => q.group === "neighbor");
const unrelatedQueries = triggerEval.queries.filter((q) => q.group === "unrelated");
check("trigger-evals 20 条且正负各 10 条", triggerEval.skill === "ceo-copilot" && triggerEval.queries.length === 20 && positiveQueries.length === 10 && negativeQueries.length === 10);
check("trigger-evals id、文本唯一且使用规范分流名", new Set(triggerEval.queries.map((q) => q.id)).size === 20 && new Set(triggerEval.queries.map((q) => q.text)).size === 20 && triggerEval.queries.every((q) => typeof q.id === "string" && typeof q.text === "string" && q.text.trim().length > 0 && canonicalTriggerNames.has(q.expected_skill)));
check("trigger-evals should_trigger 与精确分流名一致", triggerEval.queries.every((q) => q.should_trigger === (q.expected_skill === "ceo-copilot")));
check("trigger-evals 相邻近似各至少 3 条且不是本技能正例", neighborQueries.length >= 6 && ["lixiang-ceo-grill", "b2b-product-review"].every((name) => neighborQueries.filter((q) => q.expected_skill === name).length >= 3) && neighborQueries.every((q) => q.should_trigger === false));
check("trigger-evals 无关反例仍不涉及商业诊断", unrelatedQueries.length >= 4 && unrelatedQueries.every((q) => q.should_trigger === false && q.expected_skill === "none" && !businessMarkers.test(q.text)));
check("trigger-evals 保留精确评分及禁止别名归一", triggerEval.scoring?.expected_name_comparison === "exact_string" && triggerEval.scoring?.aliases === "count_as_incorrect_without_normalization");
check("SKILL.md 无待办占位", !/\[TODO|结构选择指南/.test(skill));

// --- SKILL.md 指向的参考页都在 ---
const pointed = [...new Set([...skill.matchAll(/`(?:references\/)?([^`\s]+\.(?:md|txt))`/g)].map((m) => m[1]))]
  .filter((f) => f !== "SKILL.md");
const missing = pointed.filter((f) => !existsSync(join(REF, f)) && !existsSync(join(SKILL_DIR, f)));
check(`SKILL.md 指向的文件全部存在（${pointed.length} 个）`, missing.length === 0, missing.join("、"));

// --- 地图：第 0 格加八层 ---
const layers = [
  ["00-处境与这次的决定.md", "第 0 格"],
  ["01-为什么做.md", "V1"], ["02-做哪个.md", "V2"], ["03-真实需求.md", "V3"], ["04-解法成立吗.md", "V4"],
  ["05-谁付钱.md", "V5"], ["06-采用与获客.md", "V6"], ["07-复制.md", "V7"], ["08-够不够大与守不守得住.md", "V8"],
];
for (const [f, id] of layers) check(`${id} 页在位（${f}）`, existsSync(join(REF, f)));
const layerSections = ["必问句", "站住了长什么样", "没站住的信号", "常见幻觉", "症状到根因", "什么算证据", "题源"];
for (const [f, id] of layers.slice(1)) {
  const t = readFileSync(join(REF, f), "utf8");
  const lack = layerSections.filter((s) => !new RegExp(`^## ${s}`, "m").test(t));
  check(`${id} 页七节齐全`, lack.length === 0, lack.join("、"));
  check(`${id} 页必问句带事前版`, (t.match(/\*\*事前版\*\*/g) ?? []).length >= 3);
}
const scan = read("references/扫描卡.md");
check("扫描卡含 V1–V8 八层", ["V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8"].every((v) => new RegExp(`^## ${v} `, "m").test(scan)));

// --- 三条强制动作与产出模板 ---
for (const f of ["09-条件包.md", "10-全景扫描.md", "11-上溯根因.md", "11a-症状总索引.md", "12-闭环检查.md", "13-产出模板与总则.md"]) {
  check(`${f} 在位`, existsSync(join(REF, f)));
}
const scanPage = read("references/10-全景扫描.md");
check("层状态四档在全景扫描页声明", ["站住", "没站住", "部分站住", "未知"].every((k) => scanPage.includes(k)));
check("全景扫描页写全致命缺口清单", scanPage.includes("致命缺口"));
const idx = read("references/11a-症状总索引.md");
const sIds = new Set([...idx.matchAll(/\bS(\d{2})\b/g)].map((m) => m[1]));
check("症状总索引 S01–S30 齐全", Array.from({ length: 30 }, (_, i) => String(i + 1).padStart(2, "0")).every((n) => sIds.has(n)));
const loop = read("references/12-闭环检查.md");
check("闭环检查含五段证明链", ["技术可行", "用户有效", "跨客户复制", "足够规模"].every((k) => loop.includes(k)));
check("闭环检查含三档判定线", ["支持", "存疑", "否证"].every((k) => loop.includes(k)));
const tmpl = read("references/13-产出模板与总则.md");
check("产出模板新结构各节齐全",
  ["真正卡住的地方", "我怎么看", "该怎么做", "材料里对不上的地方", "我还需要你回答", "需要的话我还可以给你"].every((k) => tmpl.includes(k)));
check("对内对外两套话与白话对照表在列", tmpl.includes("对内和对外是两套话") && ["E0", "V1 为什么做", "站住／没站住"].every((k) => tmpl.includes(k)));
check("先答他问的规则在列（直答、试探区间、默认建议）",
  tmpl.includes("先答他问的") && tmpl.includes("试探") && tmpl.includes("你可以改"));
check("SKILL.md 写给用户时先答原问题", skill.includes("写给用户") && skill.includes("先答他问的"));
const scanStep = /^3\. \*\*全景扫描\*\*：([\s\S]*?)(?=\n4\.)/m.exec(skill)?.[1] ?? "";
// Static routing guards do not prove actual runtime reads or answer quality.
const diagnosticRoute = skill.split("## 独立知识查询、覆盖验收与维护")[0];
const knowledgeRoute = skill.split("## 独立知识查询、覆盖验收与维护")[1]?.split("## 测试")[0] ?? "";
check("日常瘦身诊断 Wiki disabled 且无自动 Wiki 页读取路由", diagnosticRoute.includes("`wiki_policy=disabled`") && diagnosticRoute.includes("日常不读取 `references/wiki/`") && !/references\/wiki\/(?:index\.md|books\/|cases\/|concepts\/|methods\/)/.test(diagnosticRoute));
check("瘦身必读全文在首次写答案前成功读取", diagnosticRoute.includes("工具输出截断、读取报错") && diagnosticRoute.includes("在第一次写用户答案前") && diagnosticRoute.includes("完成本文件、简明诊断页和所有输入全文读取"));
check("显式知识查询与覆盖验收保留定位资料且不自动启动", knowledgeRoute.includes("只在用户明确要求") && knowledgeRoute.includes("不因候选层、案例、框架或诊断信息缺口自动启动") && knowledgeRoute.includes("不遍历整库") && ["index.md", "coverage.md", "coverage-manifest.json"].every((f) => knowledgeRoute.includes(f) && existsSync(join(REF, "wiki", f))));
const slim = read("references/14-简明诊断.md");
check("瘦身入口固定两份必读技能文件", diagnosticRoute.includes("`runtime_profile=slim`") && diagnosticRoute.includes("只有这两份技能文件是日常必读页") && diagnosticRoute.includes("`references/14-简明诊断.md`"));
check("瘦身保留事实范围与部分已知，未知不升级失败", slim.includes("角色、收益归属、成本责任和入口不能互相替代") && slim.includes("不能因为一个子项未答就抹去整项已有证据") && slim.includes("未知说成查实失败"));
check("瘦身保留直答、时间分离与可证伪行动", slim.includes("第一句回答用户当前问题") && slim.includes("先分别说明当时决定是否有依据") && slim.includes("支持与不成立两种判据"));
check("瘦身不强制八层状态与长模板", slim.includes("不生成八层状态表或固定长报告") && slim.includes("不强制固定标题"));
check("瘦身保留九类经验边界和客户承诺四项", ["竞争动态", "时机", "获客与增长", "团队与当事人", "融资与现金", "合规", "面向个人消费者", "实体与服务", "验证期之后的经营", "试点性质", "有没有人工参与", "成熟度与输入限制", "收费与退出条件", "专业人员核验"].every(k=>slim.includes(k)));
const rootCausePage = read("references/11-上溯根因.md");
check("查实没站住要求层页信号与材料原话相互对应", rootCausePage.includes("“查实没站住”的条件") && rootCausePage.includes("逐字摘出") && rootCausePage.includes("材料原话"));
check("多层失败按依赖顺序取最上游且 V5/V6 固定并列", rootCausePage.includes("第 0 格 → V1 → V2 → V3 → V4 → {V5, V6} → V7 → V8") && rootCausePage.includes("V5 ∥ V6（并列根因）"));
check("未读根因层页或无引文时不得定根因", rootCausePage.includes("定根因之前，读完每个根因候选层的层页全文") && rootCausePage.includes("该层不得进入已查实根因集合"));
const rootCauseStep = /^4\. \*\*上溯根因\*\*：([\s\S]*?)(?=\n5\.)/m.exec(skill)?.[1] ?? "";
check("瘦身查实限制只来自材料，不强制未证实完整流程", diagnosticRoute.includes("不自动加载旧完整流程") && slim.includes("最上游的已知限制") && slim.includes("不把材料没写的目标、上限或负责人替代为根因"));
check("禁用自造词在白话对照表内", ["诊断尺子", "假设总账", "五段证明链"].every((k) => tmpl.includes(k)));
check("我怎么看要求算账与说出替代办法，该怎么做要求打法取舍",
  tmpl.includes("钱算不算得过来") && tmpl.includes("客户现在用什么替代") && tmpl.includes("打法取舍"));
check("裁决四选在列", ["继续", "调整", "暂缓", "停止"].every((k) => tmpl.includes(k) && loop.includes(k)));
check("三种输出模式在列", ["决策模式", "反思模式", "缩略版"].every((k) => tmpl.includes(k)));
check("九类尺子外问题列全且规定照答标经验",
  ["竞争", "时机", "增长", "团队", "融资", "合规", "个人消费者", "实体", "验证期"].every((k) => tmpl.includes(k))
  && tmpl.includes("一般经验"));

// --- 题源报告随技能分发 ---
const srcPath = join(REF, "来源-第二增长曲线报告.txt");
check("题源报告纯文本在位", existsSync(srcPath));
if (existsSync(srcPath)) {
  const lines = readFileSync(srcPath, "utf8").split("\n");
  check("题源报告行号锚点未漂移（2003 行为评审六问标题）", (lines[2002] ?? "").includes("只固定追问六件事"));
  check("题源报告行号锚点未漂移（1606 行为结论句式）", (lines[1605] ?? "").includes("某一输入边界"));
}

// --- 商业知识 wiki：数量、按层路由与页面索引
const WIKI = join(REF, "wiki");
const wikiFiles = [];
function collectWiki(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) collectWiki(p);
    else if (ent.isFile() && ent.name.endsWith(".md") && !["SCHEMA.md", "index.md", "log.md"].includes(ent.name)) wikiFiles.push(p);
  }
}
check("wiki 基础文件齐全", ["SCHEMA.md", "index.md", "log.md"].every((f) => existsSync(join(WIKI, f))));
for (const dir of ["books", "concepts", "methods", "cases"]) check(`wiki/${dir} 目录在位`, existsSync(join(WIKI, dir)));
if (existsSync(WIKI)) collectWiki(WIKI);
const wikiCount = (dir) => existsSync(join(WIKI, dir)) ? readdirSync(join(WIKI, dir)).filter((f) => f.endsWith(".md")).length : 0;
check("wiki 含 26 本书与 6 组理论（32 页）", wikiCount("books") === 32, `${wikiCount("books")} 页`);
check("wiki 概念与方法页不少于 26 页", wikiCount("concepts") + wikiCount("methods") >= 26, `${wikiCount("concepts") + wikiCount("methods")} 页`);
check("wiki 含至少 18 个机制案例页", wikiCount("cases") >= 18, `${wikiCount("cases")} 页`);
const wikiIndex = existsSync(join(WIKI, "index.md")) ? readFileSync(join(WIKI, "index.md"), "utf8") : "";
const indexNames = new Set([...wikiIndex.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].toLowerCase()));
const missingWikiIndex = wikiFiles.map((f) => f.split(/[\\/]/).pop().replace(/\.md$/, "").toLowerCase()).filter((n) => !indexNames.has(n));
check(`wiki index 覆盖全部页面（${wikiFiles.length} 页）`, missingWikiIndex.length === 0, missingWikiIndex.join("、"));
for (const [f, v] of layers.slice(1)) {
  const t = readFileSync(join(REF, f), "utf8");
  check(`${v} 题源表链接到 wiki`, /\[\[(?:B|T)\d{2}-/.test(t) && /\[\[K\d{2}-/.test(t));
}
check("SKILL.md 保留独立知识查询的 Wiki 指针和摘要边界", knowledgeRoute.includes("references/wiki/index.md") && knowledgeRoute.includes("概念、方法或工作表页") && knowledgeRoute.includes("未读原书、摘要深度和误用边界") && knowledgeRoute.includes("书名与作者不作商业成立的证据"));
const badWikiMeta = wikiFiles.filter((f) => {
  const t = readFileSync(f, "utf8");
  return !/^---\s*\r?\n/.test(t) || !/^title:/m.test(t) || !/^type:/m.test(t) || !/^tags:/m.test(t)
    || !/^created:/m.test(t) || !/^updated:/m.test(t) || !/^layers:/m.test(t) || !/^report_lines:/m.test(t) || !/^sources:/m.test(t);
});
check("wiki 内容页 frontmatter 含来源与层级字段", badWikiMeta.length === 0, badWikiMeta.map((f) => f.split(/[\\/]/).pop()).join("、"));

// --- 运行时参考无设计期残留（防评测泄题） ---
const runtime = readdirSync(REF).filter((f) => f.endsWith(".md") && f !== "design.md");
const leakRe = /卡 ?A|埋雷|评审记录|相对 v1|展开稿|试走缺陷|待裁定|请裁定|室内导航|导视/;
const leaks = runtime.filter((f) => leakRe.test(readFileSync(join(REF, f), "utf8")));
check("运行时参考无测试样例与设计期残留", leaks.length === 0, leaks.join("、"));
check("references 无模板占位 README", !existsSync(join(REF, "README.md")));

// --- 设计文档 ---
const design = read("references/design.md");
check("references/design.md 在位且含 wiki 与独立触发验收条件", /AC-18/.test(design) && /AC-19/.test(design) && design.includes("技能触发与运行保持自包含"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
