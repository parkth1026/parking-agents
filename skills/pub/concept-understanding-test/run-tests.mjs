#!/usr/bin/env node
// run-tests.mjs — concept-understanding-test 的回归测试（升级/改动后必跑）
// 惯例：check() 计数器 + 黑盒检查，退出码 0=全过/1=有失败。测试固化在技能里，随技能分发。
// 本技能无确定性脚本资源，回归对象是文档自身完整性（AC-5）：frontmatter 合法、
// 必需章节齐全、双跑机制与判分公式在位、无 TODO 占位残留。
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL = join(SKILL_DIR, "SKILL.md");
const DESIGN = join(SKILL_DIR, "references", "design.md");

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}

const skill = existsSync(SKILL) ? readFileSync(SKILL, "utf8") : "";
const design = existsSync(DESIGN) ? readFileSync(DESIGN, "utf8") : "";

// frontmatter：name = 目录名；description 为名字式中英双语（触发模式二）
const fm = skill.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? "";
const desc = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? "";
check("SKILL.md 存在且含 frontmatter", skill !== "" && fm !== "");
check("name 与目录名一致", name === "concept-understanding-test");
check("description 为名字式中英双语", desc === "concept-understanding-test（概念理解测试）");
check("frontmatter 仅 name/description 两键", (fm.match(/^[a-z-]+:/gm) ?? []).length === 2);

// 正文：核心结构齐全（考题形态 / 双跑 / 对比与判分 / 纪律 / 测试）
for (const section of [
  "## 考题形态", "## 双跑", "## 对比与判分", "## 纪律", "## 测试",
]) {
  check(`正文含节「${section}」`, skill.includes(section));
}

// 双跑机制与判分公式在位
check("概念题+应用题两道考题已写入", skill.includes("概念题") && skill.includes("应用题"));
check("臂 A 闭卷硬判据 tool_uses=0 已写入", skill.includes("tool_uses 必须为 0"));
check("臂 B 带搜索硬判据（tool_uses>0 且含来源）已写入", skill.includes("tool_uses 必须大于 0"));
check("搜索通道降级顺序已写入", skill.includes("WebSearch → Exa → WebFetch"));
check("判分公式已写入", skill.includes("一致 ÷（一致 + 偏差 + 缺失）"));
check("分级已写入", ["≥90", "70–89", "40–69", "<40"].every((k) => skill.includes(k)));
check("子分诊断（原理/出处）已写入", skill.includes("原理类 / 出处类"));

// design.md：四节齐全 + 触发模式声明（与 quick-validate 触发模式检测对齐）+ AC-5
check("design.md 存在且四节齐全", design !== ""
  && ["意图与触发场景", "设计取舍", "验收条件", "迭代记录"].every((k) => design.includes(`## ${k}`)));
check("design.md 声明名字触发", design.includes("名字触发"));
check("AC-5 已编号", /\| AC-5 \|/.test(design));

// 占位残留
check("无 TODO 占位残留", ![skill, design].some((t) => t.includes("[TODO")));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
