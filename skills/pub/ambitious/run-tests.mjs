#!/usr/bin/env node
// run-tests.mjs — ambitious 的回归测试（升级/改动后必跑）
// 惯例：check() 计数器 + 黑盒执行；prompt-only 技能的资产就是 SKILL.md 正文，
//       所以这里测结构不变式（frontmatter 双开关、四步流程、五项方案格式、关键判据句）。
//       退出码 0=全过/1=有失败。
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}

const skill = existsSync(join(SKILL_DIR, "SKILL.md"))
  ? readFileSync(join(SKILL_DIR, "SKILL.md"), "utf8")
  : "";
const yaml = existsSync(join(SKILL_DIR, "agents", "openai.yaml"))
  ? readFileSync(join(SKILL_DIR, "agents", "openai.yaml"), "utf8")
  : "";

// AC-1 双开关（SKILL.md 半边 + openai.yaml 半边）
check("SKILL.md 声明 name: ambitious", /^name: ambitious$/m.test(skill));
check("AC-1a 手动开关：frontmatter disable-model-invocation: true", /^disable-model-invocation: true$/m.test(skill));
check("AC-1b 手动开关：openai.yaml allow_implicit_invocation: false", /^\s*allow_implicit_invocation:\s*false$/m.test(yaml));
check("AC-1c openai.yaml default_prompt 引用 $ambitious", yaml.includes("$ambitious"));
check("参数占位符 $ARGUMENTS 在正文", skill.includes("$ARGUMENTS"));

// 核心流程结构不变式（正文即资产，四步 + 执行规则缺一不可）
for (const step of ["第一步：高度", "第二步：深度", "第三步：广度", "第四步：输出方案", "执行阶段的规则"]) {
  check(`核心流程在：${step}`, skill.includes(step));
}

// AC-2 五项方案格式逐项在正文点名
for (const item of ["改写后的任务", "要用的方法和工具", "野心目标", "外部验证", "需要用户提供的"]) {
  check(`AC-2 方案格式项在：${item}`, skill.includes(item));
}

// 深度四问（Felix 原文判据）在
for (const q of ["顶尖从业者", "最原始的材料", "方法和工具", "证明结果是对的"]) {
  check(`深度四问判据在：${q}`, skill.includes(q));
}

// AC-3 / AC-5 / AC-6 关键纪律句在
check("AC-3 反空词纪律在（不要只写「专业地」）", skill.includes("不要只写「专业地」"));
check("AC-5 不抬空泛纪律在（不要抬到空泛）", skill.includes("不要抬到空泛"));
check("AC-6 范围纪律在（不扩大任务范围）", skill.includes("不扩大任务范围"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
