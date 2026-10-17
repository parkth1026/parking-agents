#!/usr/bin/env node
// run-tests.mjs — markmap-mindmap 的回归测试（升级/改动后必跑）
// 惯例：check() 计数器 + 黑盒执行 lint.mjs 再比对输出，退出码 0=全过/1=有失败
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const LINT = join(SKILL_DIR, "scripts", "lint.mjs");

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}
const lint = (...args) => spawnSync(process.execPath, [LINT, ...args], { encoding: "utf8" });

// AC-7：规范范例判 0 违规
const good = lint(join(SKILL_DIR, "fixtures", "good.mindmap.md"));
check("good 范例退出码 0", good.status === 0);
check("good 范例统计 违规 0", /违规 0/.test(good.stdout));
check("good 范例统计 节点数 80 · 一级分支 3 · 首屏节点 15 · 最大深度 6",
  /节点数 80 · 一级分支 3 · 首屏节点 15 · 最大深度 6/.test(good.stdout));

// AC-7：违规样例逐类检出（行号 + 原因）
const bad = lint(join(SKILL_DIR, "fixtures", "bad.mindmap.md"));
check("bad 样例退出码 1", bad.status === 1);
const expected = [
  ["L7", "元信息占用一级分支"],
  ["L10", "分支 17 字 > 12"],
  ["L12", "叶子 33 字 > 30"],
  ["L13", "节点含 [[ ]]"],
  ["L14", "（注）26 字 > 20"],
  ["L15", "缩进 3 空格"],
  ["L16", "子节点 8 > 7"],
  ["L29", "深度 7 > 6"],
  ["L30", "深度 8 > 6"],
  ["L32", "用了 ### 标题"],
  ["L33", "缩进含 Tab"],
  ["L35", "根节点（#）应恰好 1 个"],
];
for (const [line, why] of expected) {
  check(`bad 检出 ${line} ${why}`, bad.stdout.split("\n").some((l) => l.trim().startsWith(`${line} ${why}`)));
}
check("bad 违规总数 12", /违规 12/.test(bad.stdout));

// 模板自身合规
const tpl = lint(join(SKILL_DIR, "assets", "template.mindmap.md"));
check("模板退出码 0", tpl.status === 0);

// 用法错误
check("无参数退出码 2", lint().status === 2);
check("文件不存在退出码 2", lint(join(SKILL_DIR, "fixtures", "不存在.md")).status === 2);

// AC-6：技能不引导生成 HTML 或调用 markmap-cli
const skill = readFileSync(join(SKILL_DIR, "SKILL.md"), "utf8");
check("SKILL.md 声明不用 markmap-cli", /不调用 markmap-cli/.test(skill));
check("SKILL.md 无 markmap-cli 调用命令", !/npx[^\n]*markmap-cli/.test(skill));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
