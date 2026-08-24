#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { EVAL_GATE_FILES } from "../../scripts/build-release.mjs";

const root = mkdtempSync(join(tmpdir(), "run-evals-test-"));
const script = resolve("scripts/run-evals.mjs");
let failures = 0;
const check = (condition, message) => {
  if (condition) return;
  failures++;
  console.error(`  ✗ ${message}`);
};

function makeSkill(name, { files = EVAL_GATE_FILES, exitCode = 0 } = {}) {
  const dir = join(root, ".agents", "skills", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: fixture\n---\n`);
  for (const file of files) {
    if (file === "run-tests.mjs") {
      writeFileSync(join(dir, file), `console.log("${name} self-test"); process.exit(${exitCode});\n`);
    } else {
      writeFileSync(join(dir, file), "{}\n");
    }
  }
}

try {
  makeSkill("complete-pass");
  makeSkill("complete-fail", { exitCode: 7 });
  makeSkill("partial", { files: ["run-tests.mjs", "history.json"] });
  makeSkill("no-evals", { files: [] });

  const listed = execFileSync(process.execPath, [script, "--root", root, "--list"], { encoding: "utf8" });
  check(listed.includes("评测产物齐全度"), "--list 缺齐全度列");
  check(listed.includes("complete-pass") && listed.includes("5/5"), "--list 未列完整技能");
  check(listed.includes("partial") && listed.includes("2/5"), "--list 未列部分技能");
  check(!listed.includes("no-evals"), "--list 列出了无评测产物技能");
  check(!listed.includes("self-test"), "--list 意外执行了 run-tests");

  const passOnly = execFileSync(
    process.execPath,
    [script, "--root", root, "--skill", "complete-pass"],
    { encoding: "utf8" }
  );
  check(passOnly.includes("PASS") && passOnly.includes("✅ 达标"), "单技能真跑结果不正确");

  const all = spawnSync(process.execPath, [script, "--root", root], { encoding: "utf8" });
  check(all.status === 1, "存在失败或不完整技能时真跑未返回非零");
  check(all.stdout.includes("complete-fail") && all.stdout.includes("FAIL (exit 7)"), "失败退出码未汇总");
  check(all.stdout.includes("partial") && all.stdout.includes("⚠️ 五件套不齐"), "不完整技能未标警告");
} finally {
  rmSync(root, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`FAIL — run-evals ${failures} problem(s)`);
  process.exit(1);
}
console.log("PASS — run-evals: --list zero-cost and real run summary verified");
