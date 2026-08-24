#!/usr/bin/env node

import { existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EVAL_GATE_FILES } from "./build-release.mjs";

const SCRIPT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  let root = SCRIPT_ROOT;
  // npm 11 treats `npm run evals --list` as a config flag instead of a script
  // argument. Honour the exported config value so the Contract's exact command
  // stays zero-cost; direct `node ... --list` still works normally.
  let list = process.env.npm_config_list === "true";
  let skillName = null;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--list") list = true;
    else if (arg === "--root" && argv[index + 1]) root = argv[++index];
    else if (arg === "--skill" && argv[index + 1]) skillName = argv[++index];
    else throw new Error(`未知参数或缺参数值: ${arg}`);
  }
  return { root: resolve(root), list, skillName };
}

function discoverRows(root, skillName) {
  const skillRoot = join(root, ".agents", "skills");
  if (!existsSync(skillRoot)) return [];
  const all = readdirSync(skillRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(skillRoot, entry.name, "SKILL.md")))
    .map((entry) => {
      const dir = join(skillRoot, entry.name);
      const present = EVAL_GATE_FILES.filter((file) => existsSync(join(dir, file)));
      return { name: entry.name, dir, present };
    });

  if (skillName) {
    const selected = all.filter((row) => row.name === skillName);
    if (selected.length === 0) throw new Error(`技能不存在: ${skillName}`);
    return selected;
  }
  return all.filter((row) => row.present.length > 0).sort((a, b) => a.name.localeCompare(b.name));
}

function renderTable(rows, listOnly) {
  console.log("| skill | 评测产物齐全度 | run-tests | verdict |");
  console.log("| --- | --- | --- | --- |");
  for (const row of rows) {
    const complete = `${row.present.length}/${EVAL_GATE_FILES.length}`;
    const test = listOnly ? "未执行 (--list)" : row.test;
    const verdict = listOnly
      ? row.present.length < EVAL_GATE_FILES.length
        ? "⚠️ 五件套不齐"
        : "待运行"
      : row.code !== null && row.code !== 0
        ? "❌ 未达标"
        : row.present.length < EVAL_GATE_FILES.length
          ? "⚠️ 五件套不齐"
          : "✅ 达标";
    console.log(`| ${row.name} | ${complete} | ${test} | ${verdict} |`);
  }
}

export function runEvals({ root = SCRIPT_ROOT, list = false, skillName = null } = {}) {
  const rows = discoverRows(resolve(root), skillName);
  if (list) {
    renderTable(rows, true);
    console.log(`\n评测产物: ${EVAL_GATE_FILES.join(", ")}`);
    return { ok: true, rows };
  }

  for (const row of rows) {
    const testPath = join(row.dir, "run-tests.mjs");
    if (!existsSync(testPath)) {
      row.code = null;
      row.test = "SKIP (缺 run-tests.mjs)";
      continue;
    }
    const result = spawnSync(process.execPath, [testPath], {
      cwd: row.dir,
      encoding: "utf8",
    });
    row.code = result.status ?? 1;
    row.test = row.code === 0 ? "PASS" : `FAIL (exit ${row.code})`;
    row.output = `${result.stdout || ""}${result.stderr || ""}`;
  }

  renderTable(rows, false);
  const passed = rows.filter((row) => row.present.length === EVAL_GATE_FILES.length && row.code === 0).length;
  const failed = rows.filter((row) => row.code !== null && row.code !== 0).length;
  const warned = rows.length - passed - failed;
  console.log(`\n汇总: ${passed} ✅ / ${warned} ⚠️ / ${failed} ❌`);
  for (const row of rows.filter((item) => item.code !== null && item.code !== 0)) {
    console.error(`\n[evals] ${row.name} run-tests 输出:\n${row.output.trim()}`);
  }
  return { ok: rows.every((row) => row.code === 0 && row.present.length === EVAL_GATE_FILES.length), rows };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = runEvals(parseArgs(process.argv.slice(2)));
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.error(`[evals] ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
