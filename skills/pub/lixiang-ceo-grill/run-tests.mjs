#!/usr/bin/env node
// run-tests.mjs — lixiang-ceo-grill 的回归测试（升级/改动后必跑）
// 本技能产出主观（访谈质量），输出不做断言（design.md AC-6 走人工评审）；
// 这里固化结构完整性：原文存档、题库九模块三要素、访谈协议要素、报告模板、层序（AC-1~AC-5）。
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(SKILL_DIR, p), "utf8");

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}

const MODULES = ["行业趋势", "行业问题", "进攻方向", "用户定位", "时间节奏", "目标要求", "业务架构", "在线系统", "运营系统"];
const LAYERS = ["认知层", "战略层", "业务层"];

// AC-1 原文存档完整
const article = read("references/lixiang-ceo-article.md");
check("AC-1a 原文存档存在且含来源链接", article.includes("blog.liyuai.com/archives/become-a-professional-CEO"));
for (const layer of LAYERS) check(`AC-1b 原文含层「${layer}」`, article.includes(layer));
for (const m of MODULES) check(`AC-1c 原文含模块「${m}」`, article.includes(m));
check("AC-1d 原文含关键标准句（量变带来质变/高保真映射/闭环）",
  article.includes("量变带来质变") && article.includes("高保真映射") && article.includes("闭环"));

// AC-2 题库九模块五要素
const bank = read("references/question-bank.md");
for (const m of MODULES) {
  const idx = bank.indexOf(m);
  const next = MODULES.map((x) => bank.indexOf(x)).filter((i) => i > idx).sort((a, b) => a - b)[0] ?? bank.length;
  const seg = bank.slice(idx, next);
  check(`AC-2 模块「${m}」含 核心问题/追问/红旗/合理答案的样子`,
    seg.includes("核心问题") && seg.includes("追问") && seg.includes("红旗") && seg.includes("合理答案的样子"));
}
check("AC-2 题库含层间依赖检查四检查点（认知→战略/战略→业务/跨层跳跃/认知第一性）",
  ["认知→战略", "战略→业务", "跨层跳跃", "认知第一性"].every((x) => bank.includes(x)));

// AC-3 访谈协议要素
const skill = read("SKILL.md");
check("AC-3a 协议含一次一问铁律", skill.includes("一次一问"));
check("AC-3b 协议含原文标准先行", skill.includes("李想的标准"));
check("AC-3c 协议含证据三级（有据/口头断言/答不上）", skill.includes("有据") && skill.includes("口头断言") && skill.includes("答不上"));
check("AC-3d 协议含裁定四档", ["符合", "部分符合", "缺失", "冲突"].every((x) => skill.includes(x)));
check("AC-3e 协议含层间依赖检查", skill.includes("层间依赖检查"));
check("AC-3f 协议含多问句拆问规则", skill.includes("拆开逐问"));
check("AC-3g 协议含示例回合", skill.includes("示例回合"));
check("AC-3h 协议含引用用户思考核心动作", skill.includes("引用你的思考"));
check("AC-3i 协议要求对话正文提问、禁用结构化提问工具", skill.includes("不使用 AskUserQuestion"));
check("AC-3j 协议含合理答案判据", skill.includes("合理答案的判据"));
check("AC-3k 协议含校准式认可", skill.includes("校准式认可"));
check("AC-3l 协议含复述确认", skill.includes("复述成"));
check("术语纪律：题库无 workaround/Plan B", !bank.includes("workaround") && !bank.includes("Plan B"));

// 网页端单文件版（web-prompt.md）
const web = existsSync(join(SKILL_DIR, "web-prompt.md")) ? read("web-prompt.md") : "";
check("web-prompt.md 存在、覆盖九模块、含一次一问铁律",
  web.length > 0 && MODULES.every((m) => web.includes(m)) && web.includes("一次一问"));
check("web-prompt.md 同步新协议：引用先行、合理答案判据、报告含思维复盘节",
  web.includes("引用先行") && web.includes("合理答案") && web.includes("你是怎么思考这个产品的"));

// AC-4 报告模板：矩阵/断裂点/前三差距/推翻条件 + 思维复盘节 + 推荐依据强制
const report = read("references/report-format.md");
check("AC-4a 报告模板含 矩阵/断裂点/前三差距/推翻条件",
  report.includes("符合度矩阵") && report.includes("层间依赖断裂点") && report.includes("前三差距") && report.includes("推翻"));
check("AC-4b 报告模板含「你是怎么思考这个产品的」节", report.includes("你是怎么思考这个产品的"));
check("AC-4c 报告推荐必须有理有据（差距/依据/影响/推荐强度）",
  report.includes("依据") && report.includes("影响") && report.includes("推荐强度"));

// AC-5 层序：认知→战略→业务，且 SKILL.md 禁止反向
const order = LAYERS.map((l) => bank.indexOf(`## ${l}`));
check("AC-5a 题库层序为认知→战略→业务", order[0] !== -1 && order[0] < order[1] && order[1] < order[2]);
check("AC-5b SKILL.md 禁止反向拷问", skill.includes("禁止反向"));

// 基线：frontmatter 与占位清理
const fm = skill.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
check("frontmatter 声明正确 name", fm.includes("name: lixiang-ceo-grill"));
check("description 非空且非占位", fm.includes("description:") && !fm.includes("TODO") && fm.split("description:")[1]?.trim().length > 50);
check("SKILL.md 无残留 TODO 占位", !skill.includes("[TODO"));
check("design.md 验收条件 AC-1~AC-6 齐备", (() => {
  const d = read("references/design.md");
  return ["AC-1", "AC-2", "AC-3", "AC-4", "AC-5", "AC-6"].every((x) => d.includes(x));
})());

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
