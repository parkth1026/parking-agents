#!/usr/bin/env node

// audit-ambiguous-terms 的回归测试：黑盒执行校验脚本，退出码 0=全过。
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const validator = join(SKILL_DIR, "scripts", "validate-rewrite.mjs");
const skillFile = join(SKILL_DIR, "SKILL.md");
const inputFixture = join(SKILL_DIR, "fixtures", "first-prompt.input.md");
const expectedFixture = join(SKILL_DIR, "fixtures", "first-prompt.expected.md");

let pass = 0;
let fail = 0;
function check(name, condition) {
  if (condition) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}

function runValidator(args) {
  try {
    const stdout = execFileSync(process.execPath, [validator, ...args], {
      cwd: SKILL_DIR,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return { code: 0, stdout };
  } catch (error) {
    return { code: error.status ?? 1, stdout: error.stdout?.toString() ?? "", stderr: error.stderr?.toString() ?? "" };
  }
}

check("required files exist", [skillFile, validator, inputFixture, expectedFixture].every(existsSync));

const skillCheck = runValidator([skillFile, "--kind", "skill"]);
check("SKILL.md passes structure validation", skillCheck.code === 0 && skillCheck.stdout.includes("PASS"));

const expectedTerms = [
  "双向钢人分析（steelman）",
  "分歧核心（crux）"
];
const promptCheck = runValidator([
  expectedFixture,
  "--kind", "prompt",
  ...expectedTerms.flatMap((term) => ["--expect", term]),
  "--forbid", "problem framing",
  "--forbid", "current hypothesis",
  "--forbid", "key decision variables",
  "--forbid", "crux of the disagreement",
  "--forbid", "detailed thinking",
  "--max-english-terms", "2"
]);
check("first prompt conversion preserves only the two core terms", promptCheck.code === 0 && promptCheck.stdout.includes("PASS"));

check("first prompt input and expected output are distinct",
  readFileSync(inputFixture, "utf8") !== readFileSync(expectedFixture, "utf8"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
