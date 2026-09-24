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

// --- 其余资源在位 ---
check("references/design.md 在位且含 AC 验收表",
  existsSync(join(SKILL_DIR, "references/design.md")) && /AC-8/.test(read("references/design.md")));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
