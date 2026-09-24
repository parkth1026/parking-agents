#!/usr/bin/env node
// run-tests.mjs — product-adverse-review 的回归测试（升级/改动后必跑）
// 审查报告是主观判断产物，不硬上输出断言；本测试做客观结构自检：
// references 完整性（18 机制×六层×五要素）、固定词表、frontmatter 合法、无待办占位。
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

// --- SKILL.md frontmatter ---
const skill = read("SKILL.md");
const fmName = /^name:\s*(\S+)/m.exec(skill)?.[1];
check("SKILL.md name 与目录名一致", fmName === "product-adverse-review");
const desc = /^description:\s*(.+)$/m.exec(skill)?.[1] ?? "";
check("description 存在且 ≤1024 字符", desc.length > 0 && desc.length <= 1024);
check("description 无尖括号", !/[<>]/.test(desc));
check("SKILL.md 无待办占位", !/\[TODO|待办占位\]|结构选择指南/.test(skill));

// --- mechanisms.md：18 机制 × 六层 × 五要素 ---
const mech = read("references/mechanisms.md");
const mechIds = [...mech.matchAll(/^### (\d{2}) /gm)].map((m) => m[1]);
check("18 条机制编号齐全且唯一", new Set(mechIds).size === 18);
const layers = [..."ABCDEF"].every((L) =>
  new RegExp(`^## ${L} `, "m").test(mech));
check("六层（A–F）标题齐全", layers);
const five = ["失败做法", "可观察预警", "怎样检验", "反面提醒", "有条件的结论"];
for (const k of five) {
  check(`五要素「${k}」条目 18 条`, (mech.match(new RegExp(`^- ${k}：`, "gm")) ?? []).length === 18);
}
check("状态四值词表在 mechanisms.md 声明",
  mech.includes("未知 / 证据不足") && mech.includes("初步支持") && mech.includes("出现反证") && mech.includes("本阶段不适用"));

// --- evidence-rules.md：五失败定义 / 七级矩阵 / 六阶段 / 五选项 ---
const rules = read("references/evidence-rules.md");
for (const k of ["用户价值未成立", "商业可行性未成立", "战略回报未达标", "执行或治理失效", "实验被终止"]) {
  check(`失败定义「${k}」在列`, rules.includes(k));
}
for (const k of ["探索机会", "验证价值", "验证交易", "验证重复性", "扩大经营", "成熟与退出"]) {
  check(`阶段「${k}」在列`, rules.includes(k));
}
for (const k of ["继续投入", "限额取证", "改变路径", "暂停等待", "负责退出"]) {
  check(`决策出口「${k}」在列`, rules.includes(k));
}
check("三个不能混淆判读在列",
  rules.includes("未知 ≠ 失败") && rules.includes("未知 ≠ 通过") && rules.includes("局部通过 ≠ 全链通过"));

// --- context-adjustments.md：七类产品类型 + AI 四偷换 + 指标口径 ---
const adj = read("references/context-adjustments.md");
for (const k of ["企业级 B2B", "自助消费与创作产品", "开发者工具", "多边平台", "硬件", "内部工具与平台", "AI 功能 / Agent"]) {
  check(`产品类型「${k}」在列`, adj.includes(k));
}
check("AI 四种口径偷换在列",
  ["能稳定交付", "任务结果已发生", "产品价值提高", "全流程无需人工"].every((k) => adj.includes(k)));

// --- sources.md：S 编号解析表覆盖机制卡全部引用 ---
const src = read("references/sources.md");
const srcIds = [...src.matchAll(/^\| (S\d{2}) \|/gm)].map((m) => m[1]);
check("来源索引 27 项（S01–S27）", new Set(srcIds).size === 27);
const usedIds = [...new Set([...mech.matchAll(/\[(S\d{2})\]/g)].map((m) => m[1]))];
check(`机制卡 S 引用全部可解析（${usedIds.length} 项）`,
  usedIds.filter((id) => !srcIds.includes(id)).length === 0);

// --- 「七级→七类」改名回归（源报告反对证据等级化） ---
check("全文无「七级」残留", !skill.includes("七级") && !rules.includes("七级"));

// --- report-format.md：模板骨架 ---
const fmt = read("references/report-format.md");
for (const k of ["成功定义核查", "证据盘点", "18 机制审查", "最可能改变决策的假设", "决策建议", "未覆盖与证据不足"]) {
  check(`报告模板含「${k}」节`, fmt.includes(k));
}

// --- positive-signals.md：三层成立 / 八课关口 / 七案例 / 十假象 / B 编号 ---
const pos = read("references/positive-signals.md");
check("positive-signals.md 在位且含三层成立词表（生意/产品/自助）",
  pos.includes("生意成立") && pos.includes("产品成立") && pos.includes("自助成立"));
const lessons = ["1 付费任务", "2 角色系统", "3 价值账", "4 最小完整结果", "5 试点", "6 可重复交付", "7 一张账", "8 持续性与扩张"];
const lessonRowsOk = lessons.every((L) => {
  const row = pos.split("\n").find((l) => l.includes(`| ${L} `) || l.includes(`| ${L} |`));
  return row !== undefined && /(?:0[1-9]|1[0-8])(?:\/(?:0[1-9]|1[0-8]))*/.test(row);
});
check("八课关口行齐全且各行含机制交叉引用", lessonRowsOk);
check("验证重量 2×2（购买复杂度 × 交付复杂度）在列",
  pos.includes("购买复杂") && pos.includes("交付复杂"));
check("七个案例卡齐全（Atlassian/Veeva/ServiceNow/Samsara/Stripe/Hilti/金蝶）",
  ["Atlassian", "Veeva", "ServiceNow", "Samsara", "Stripe", "Hilti", "金蝶"].every((k) => pos.includes(k)));
const caseRows = ["Atlassian", "Veeva", "ServiceNow", "Samsara", "Stripe", "Hilti", "金蝶"]
  .map((k) => pos.split("\n").find((l) => l.startsWith("|") && l.includes(k)))
  .map((row) => (row ? (row.split("|")[3] ?? "").trim() : ""));
check("案例表含「不能照搬」边界列且七行均有实质内容",
  pos.includes("| 不能照搬 |") && caseRows.every((c) => c.length >= 15));
check("十种 To B 假象与纠偏在列", pos.includes("十种 To B 假象") && pos.includes("NRR 高于 100%"));
const bIds = [...src.matchAll(/^\| (B\d{2}) \|/gm)].map((m) => m[1]);
check("成功篇来源索引 30 项（B01–B30）", new Set(bIds).size === 30);
const usedB = [...new Set([...pos.matchAll(/\[(B\d{2})\]/g)].map((m) => m[1]))];
check(`positive-signals B 引用全部可解析（${usedB.length} 项）`,
  usedB.filter((id) => !bIds.includes(id)).length === 0);
check("S/B 编号分立声明（两文件均含「互不通用」）",
  src.includes("互不通用") && pos.includes("互不通用"));
check("报告模板含「成功信号对照」节与三层词表输出纪律",
  fmt.includes("成功信号对照") && fmt.includes("生意`、`产品`、`自助"));
check("SKILL.md Step 3 含正例对照并引用 positive-signals.md",
  skill.includes("正例对照") && skill.includes("positive-signals.md"));

// --- 其余资源在位 ---
check("references/design.md 在位且含 AC 验收表",
  existsSync(join(SKILL_DIR, "references/design.md")) && /AC-10/.test(read("references/design.md")));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
