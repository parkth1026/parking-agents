#!/usr/bin/env node
/**
 * Link every skill in this repo into a user-level skills directory.
 *
 * One discovery rule covers both sources — any directory holding a SKILL.md
 * is a skill — and results are flattened by name into the target root,
 * because Claude Code / Codex scan skills/ only one level deep:
 *
 *   <repo>/.agents/skills/<name>/SKILL.md           dev side (wins clashes)
 *   <repo>/skills/<category>/<name>/SKILL.md        release side, flattened
 *
 * Each skill becomes a directory junction (Windows, no admin rights needed;
 * POSIX degrades to a plain symlink). The agent then reads the working tree
 * directly, so installed copies can never drift from the repo.
 *
 * Per-name decision at the target:
 *   missing                      -> create junction (target dir itself is
 *                                   created too if it does not exist)
 *   link to the desired source   -> keep (idempotent)
 *   link anywhere else           -> repoint to the desired source
 *   real directory/file          -> moved into a sibling skills-backup-<ts>/
 *                                   folder (same volume, instant rename),
 *                                   then junctioned
 *
 * Health pass over entries NOT owned by this repo — the target doubles as a
 * checkup that clears illegal content and reports the rest:
 *   link whose target is gone    -> removed (dead junction: the skill would
 *                                   silently never load in any agent)
 *   dir without SKILL.md, loose
 *   file, link to a file         -> reported as an anomaly, left untouched
 *   healthy foreign skill/link   -> untouched (e.g. lark-* installed elsewhere)
 *
 * Every path is derived from this file's location and os.homedir(); nothing
 * is hardcoded, so the repo stays portable across machines and drives.
 *
 * Usage: see install-skills-agents.mjs / install-skills-claude.mjs.
 */

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const repoSources = [
  join(repoRoot, ".agents", "skills"),
  join(repoRoot, "skills"),
];

/** A directory holding SKILL.md is a skill; never descend past one. */
function discoverSkills(root) {
  const skills = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const dirPath = join(dir, entry.name);
      if (existsSync(join(dirPath, "SKILL.md"))) {
        skills.push({ name: entry.name, dir: dirPath });
      } else {
        walk(dirPath);
      }
    }
  };
  if (existsSync(root)) walk(root);
  return skills;
}

/** Compare junction targets across Windows/POSIX spelling differences. */
export function normalizeLinkTarget(p) {
  return p
    .replace(/^\\\\\?\\/, "") // \\?\ prefix
    .replace(/^\\\?\?\\/, "") // \??\ prefix used by some mklink junctions
    .replace(/\//g, "\\")
    .replace(/\\+$/, "")
    .toLowerCase();
}

function timestamp() {
  const t = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  return `${t.slice(0, 8)}-${t.slice(8)}`;
}

/**
 * Install every discovered skill into `target` (created if missing), then run
 * a health pass that clears dead links and reports anomalies.
 * Returns { created, kept, repointed, converted, removed, anomalies, foreign, failures }.
 */
export function installSkills({ sources, target, labelBase, dryRun = false }) {
  const byName = new Map();
  const clashes = [];
  for (const source of sources) {
    for (const skill of discoverSkills(source)) {
      if (byName.has(skill.name)) {
        clashes.push(`${skill.name}: ${skill.dir} skipped, first source wins`);
      } else {
        byName.set(skill.name, skill);
      }
    }
  }

  mkdirSync(target, { recursive: true });

  const display = (dir) => (labelBase ? relative(labelBase, dir) : dir);
  const created = [];
  const kept = [];
  const repointed = [];
  const converted = [];
  const failures = [];
  let backupDir = null;

  for (const [name, skill] of [...byName.entries()].sort()) {
    const link = join(target, name);
    const desired = skill.dir;
    try {
      let st = null;
      try {
        st = lstatSync(link);
      } catch {
        // missing entry — created below
      }

      if (!st) {
        if (!dryRun) symlinkSync(desired, link, "junction");
        created.push(`${name}  <-  ${display(desired)}`);
      } else if (st.isSymbolicLink()) {
        const current = readlinkSync(link);
        if (normalizeLinkTarget(current) === normalizeLinkTarget(desired)) {
          kept.push(name);
        } else {
          if (!dryRun) {
            rmSync(link);
            symlinkSync(desired, link, "junction");
          }
          repointed.push(`${name}  ${current}  ->  ${desired}`);
        }
      } else {
        // Real copy shadowing a repo skill: move it aside, then junction.
        if (!dryRun) {
          backupDir ??= join(dirname(target), `skills-backup-${timestamp()}`);
          mkdirSync(backupDir, { recursive: true });
          let dest = join(backupDir, name);
          for (let i = 2; existsSync(dest); i++) dest = join(backupDir, `${name}-${i}`);
          renameSync(link, dest);
          symlinkSync(desired, link, "junction");
        }
        converted.push(`${name}  (real copy backed up, now <-  ${display(desired)})`);
      }
    } catch (err) {
      failures.push(`${name}: ${err.message}`);
    }
  }

  // --- health pass over foreign entries --------------------------------------
  // A dead link is unambiguous garbage: the skill silently never loads. Real
  // directories and files are never deleted here — only reported.
  const removed = [];
  const removedNames = new Set();
  const anomalies = [];
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (byName.has(entry.name)) continue; // managed above
    const entryPath = join(target, entry.name);
    try {
      const st = lstatSync(entryPath);
      if (st.isSymbolicLink()) {
        const current = readlinkSync(entryPath);
        const abs = isAbsolute(current) ? current : resolve(dirname(entryPath), current);
        if (!existsSync(abs)) {
          if (!dryRun) rmSync(entryPath);
          removedNames.add(entry.name);
          removed.push(`${entry.name}  ->  ${current}  (target missing)`);
        } else if (!statSync(abs).isDirectory()) {
          anomalies.push(`${entry.name}: link target is a file, not a directory (${current})`);
        }
      } else if (st.isDirectory()) {
        if (!existsSync(join(entryPath, "SKILL.md"))) {
          anomalies.push(`${entry.name}: directory has no SKILL.md — will never load as a skill`);
        }
      } else {
        anomalies.push(`${entry.name}: loose file in skills directory`);
      }
    } catch (err) {
      anomalies.push(`${entry.name}: could not inspect (${err.message})`);
    }
  }

  const foreign = readdirSync(target, { withFileTypes: true })
    .filter((e) => !byName.has(e.name) && !removedNames.has(e.name))
    .map((e) => e.name);

  const section = (title, rows) => {
    if (rows.length === 0) return;
    console.log(`\n${title} (${rows.length}):`);
    for (const row of rows) console.log(`  ${row}`);
  };

  if (dryRun) console.log("DRY RUN — nothing was changed\n");
  console.log(`Target: ${target}`);
  console.log(`Sources: ${sources.join(", ")}`);
  section("created", created);
  section("kept (already correct)", kept);
  section("repointed", repointed);
  section("converted (real copy -> backup + junction)", converted);
  section("removed (dead links)", removed);
  section("anomalies (reported, not touched)", anomalies);
  console.log(`\nForeign entries left untouched (${foreign.length}): ${foreign.join(", ") || "none"}`);
  for (const c of clashes) console.warn(`warning: name clash — ${c}`);
  console.log(
    `\nSummary: ${created.length} created, ${kept.length} kept, ${repointed.length} repointed, ` +
      `${converted.length} converted, ${removed.length} dead links removed, ${foreign.length} untouched` +
      (anomalies.length ? `, ${anomalies.length} anomalies reported` : "") +
      (failures.length ? `, ${failures.length} FAILED` : "")
  );
  for (const f of failures) console.error(`  ✗ ${f}`);

  return { created, kept, repointed, converted, removed, anomalies, foreign, failures };
}
