#!/usr/bin/env node
// run-tests.mjs — story-principles 的回归测试（升级/改动后必跑）
// 惯例：check() 计数器 + 黑盒执行（execFileSync 跑脚本/命令再比对输出），退出码 0=全过/1=有失败；
//       fixtures/ 放黄金输入与 expected，逐字段比对。测试固化在技能里，随技能分发。
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

// TODO: 逐条固化用例——scripts/ 每个脚本至少一条真实用例（黑盒跑 + 比对输出），别只测存在性
check("SKILL.md 存在且声明 name", existsSync(join(SKILL_DIR, "SKILL.md"))
  && readFileSync(join(SKILL_DIR, "SKILL.md"), "utf8").includes("name:"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
