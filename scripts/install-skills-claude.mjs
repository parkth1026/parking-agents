#!/usr/bin/env node
/**
 * One-click install: junction every skill in this repo into ~/.claude/skills.
 *
 * Works from any cwd on any machine this repo is cloned to — every path comes
 * from this file's location and os.homedir(), never a hardcoded drive letter.
 * A relocated ~/.claude (e.g. a link to another drive) resolves transparently.
 *
 * Usage:
 *   node scripts/install-skills-claude.mjs            install / repair
 *   node scripts/install-skills-claude.mjs --dry-run  preview only
 *   node scripts/install-skills-claude.mjs --only productivity
 *   node scripts/install-skills-claude.mjs --skills skill-a,skill-b
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { installSkills, repoRoot, repoSources } from "./install-skills.mjs";

function parseSelection(argv) {
  let only;
  let skillNames;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--dry-run") continue;
    if (arg === "--only" && argv[index + 1]) {
      only = argv[++index];
      continue;
    }
    if (arg === "--skills" && argv[index + 1]) {
      skillNames = argv[++index].split(",").map((name) => name.trim()).filter(Boolean);
      continue;
    }
    throw new Error(`未知参数或缺参数值: ${arg}`);
  }
  if (only && skillNames) throw new Error("--only 与 --skills 不能同时使用");
  if (skillNames && skillNames.length === 0) throw new Error("--skills 名单不能为空");
  return { only, skillNames };
}

let selection;
try {
  selection = parseSelection(process.argv.slice(2));
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(2);
}

const result = installSkills({
  sources: repoSources,
  target: join(homedir(), ".claude", "skills"),
  labelBase: repoRoot,
  dryRun: process.argv.includes("--dry-run"),
  ...selection,
});

process.exit(result.failures.length > 0 ? 1 : 0);
