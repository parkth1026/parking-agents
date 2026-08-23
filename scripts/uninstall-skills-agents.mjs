#!/usr/bin/env node
/**
 * One-click uninstall: remove the junctions this repo installed into
 * ~/.agents/skills. Only links pointing into this repo are removed — real
 * directories, files, and links owned by others (e.g. lark-*) stay, and
 * skills-backup-* folders are kept and reported.
 *
 * Usage:
 *   node scripts/uninstall-skills-agents.mjs            uninstall
 *   node scripts/uninstall-skills-agents.mjs --dry-run  preview only
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { uninstallSkills, repoSources } from "./install-skills.mjs";

const result = uninstallSkills({
  sources: repoSources,
  target: join(homedir(), ".agents", "skills"),
  dryRun: process.argv.includes("--dry-run"),
});

process.exit(result.failures.length > 0 ? 1 : 0);
