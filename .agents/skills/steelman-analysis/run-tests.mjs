#!/usr/bin/env node
// run-tests.mjs — steelman-analysis 的回归测试（升级/改动后必跑）
// 本技能产出是纯审议对话（主观），没有可黑盒执行的脚本；固化的是技能文档自身的结构契约：
// frontmatter 合法、协议五段骨架标签齐全、方法参考与设计文档在位、无待办占位。
// 内容质量由输出评测循环（with/without 对照）负责，不在本文件断言。
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}

const skill = readFileSync(join(SKILL_DIR, "SKILL.md"), "utf8");
const fm = skill.match(/^---\r?\n([\s\S]*?)\r?\n---/);
check("frontmatter 块存在", Boolean(fm));

const fmText = fm ? fm[1] : "";
const nameMatch = fmText.match(/^name:\s*(\S+)/m);
check("name 等于目录名 steelman-analysis", nameMatch?.[1] === "steelman-analysis");
const descMatch = fmText.match(/^description:\s*(.+)$/m);
const desc = descMatch ? descMatch[1].trim() : "";
check("description 非空且 ≤1024 字符", desc.length > 0 && desc.length <= 1024);
check("description 不含尖括号", !/[<>]/.test(desc));
check("description 覆盖触发关键词（steelman/重述/crux/只问一个）",
  ["steelman", "重述", "crux", "只问一个"].every((k) => desc.includes(k)));

const body = skill.replace(/^---\r?\n[\s\S]*?\r?\n---/, "");
for (const label of ["**重述**", "**支持方最强论证**", "**反对方最强论证**", "**crux 与关键变量**", "**一个问题**"]) {
  check(`骨架标签 ${label} 在正文`, body.includes(label));
}
check("两回合协议都在正文", body.includes("第一回合") && body.includes("第二回合"));
check("退出条款在正文（用户要求直接执行时跳过）", body.includes("跳过了协议"));
check("正文不含待办占位", !/\[TODO/.test(body));
check("正文不含「结构选择指南」节", !body.includes("结构选择指南"));
check("SKILL.md 少于 500 行", skill.split(/\r?\n/).length < 500);
check("指向 references/steelman-method.md 的指针存在", body.includes("references/steelman-method.md"));

const method = readFileSync(join(SKILL_DIR, "references", "steelman-method.md"), "utf8");
check("方法参考含完整示例与失败模式", method.includes("完整两回合示例") && method.includes("常见失败模式"));
check("方法参考含五段骨架同款标签", ["**重述**", "**支持方最强论证**", "**一个问题**"].every((l) => method.includes(l)));
check("方法参考 ≥100 行", method.split(/\r?\n/).length >= 100);

const design = readFileSync(join(SKILL_DIR, "references", "design.md"), "utf8");
for (let i = 1; i <= 6; i++) check(`design.md 验收条件 AC-${i} 在位`, new RegExp(`AC-${i}\\b`).test(design));
check("design.md 迭代记录表在位", design.includes("迭代记录"));

check("agents/openai.yaml 引用 $steelman-analysis",
  readFileSync(join(SKILL_DIR, "agents", "openai.yaml"), "utf8").includes("$steelman-analysis"));

// init 的 scripts 占位对本技能无意义（零脚本），不应回流
check("无 scripts 目录（零脚本技能）", !existsSync(join(SKILL_DIR, "scripts")));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
