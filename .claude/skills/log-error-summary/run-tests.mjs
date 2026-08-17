#!/usr/bin/env node
// run-tests.mjs — log-error-summary 的回归测试（升级/改动后必跑）
// 惯例：check() 计数器 + 黑盒执行（execFileSync 跑脚本/命令再比对输出），退出码 0=全过/1=有失败；
//       fixtures/ 放黄金输入与 expected，逐字段比对。测试固化在技能里，随技能分发。
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(SKILL_DIR, "scripts", "summarize-errors.mjs");
const FIXTURE = join(SKILL_DIR, "fixtures", "build-errors.log");

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}

function run(args) {
  try {
    const stdout = execFileSync("node", [SCRIPT, ...args], { encoding: "utf8" });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status ?? 1, stdout: e.stdout?.toString() ?? "" };
  }
}

const out = run([FIXTURE]);

check("用法错（无参数）退出码 2", run([]).code === 2);
check("日志不可读退出码 1", run([join(SKILL_DIR, "no-such.log")]).code === 1);
check("大写 ERROR 日志计数正确：5 条 3 类（AC-1）", out.code === 0 && out.stdout.includes("共 5 条错误，3 类"));
check("表格三列且按次数降序（AC-3）", out.stdout.includes("| 错误模式 | 次数 | 代表样例 |")
  && out.stdout.indexOf("npm install failed") < out.stdout.indexOf("connection refused")
  && out.stdout.indexOf("connection refused") < out.stdout.indexOf("unit test"));
check("同型错误归并累计（AC-4）", out.stdout.includes("| 2 |") && !out.stdout.includes("exit code 137"));
check("代表样例保留原文", out.stdout.includes("2026-08-16 03:12:44 ERROR npm install failed with exit code 1"));

const tmp = mkdtempSync(join(tmpdir(), "les-test-"));
try {
  const outFile = join(tmp, "errors.md");
  const w = run([FIXTURE, outFile]);
  check("写文件模式：产出与 stdout 同口径（AC-3）", w.code === 0 && existsSync(outFile)
    && readFileSync(outFile, "utf8") === out.stdout);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// v2：大小写混杂日志（AC-2）
const MIXED = join(SKILL_DIR, "fixtures", "mixed-case.log");
const mixed = run([MIXED]);
check("大小写混杂全部计入：6 条 3 类（AC-2）", mixed.code === 0 && mixed.stdout.includes("共 6 条错误，3 类"));
check("混合样例归并不受大小写影响（attempt 3/4 同计）", mixed.stdout.includes("attempt N") && mixed.stdout.includes("| 2 |"));
check("INFO 行不计入", !mixed.stdout.includes("retry scheduled"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
