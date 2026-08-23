#!/usr/bin/env node
/**
 * One-click install: junction every skill in this repo into ~/.agents/skills.
 *
 * Works from any cwd on any machine this repo is cloned to — every path comes
 * from this file's location and os.homedir(), never a hardcoded drive letter.
 *
 * Usage:
 *   node scripts/install-skills-agents.mjs            install / repair
 *   node scripts/install-skills-agents.mjs --dry-run  preview only
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { installSkills, repoRoot, repoSources } from "./install-skills.mjs";

const result = installSkills({
  sources: repoSources,
  target: join(homedir(), ".agents", "skills"),
  labelBase: repoRoot,
  dryRun: process.argv.includes("--dry-run"),
});

process.exit(result.failures.length > 0 ? 1 : 0);
