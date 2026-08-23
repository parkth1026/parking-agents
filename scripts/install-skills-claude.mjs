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
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { installSkills, repoRoot, repoSources } from "./install-skills.mjs";

const result = installSkills({
  sources: repoSources,
  target: join(homedir(), ".claude", "skills"),
  labelBase: repoRoot,
  dryRun: process.argv.includes("--dry-run"),
});

process.exit(result.failures.length > 0 ? 1 : 0);
