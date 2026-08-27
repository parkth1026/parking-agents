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
 * The reverse operation, uninstallSkills(), removes exactly what
 * installSkills() put in: links whose target lives under one of the source
 * roots. Real directories, loose files, and links pointing anywhere else
 * (lark-* chains, other repos) are never touched, and skills-backup-* folders
 * are only reported, never deleted.
 *
 * Usage: see the install-skills-{agents,claude}.mjs and
 * uninstall-skills-{agents,claude}.mjs entry scripts. Install entry scripts
 * accept --only <category> or --skills <comma-separated-names>; with neither,
 * discovery and first-source-wins behavior are unchanged.
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
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const repoSources = [
  join(repoRoot, ".agents", "skills"),
  join(repoRoot, "skills"),
];

/** A directory holding SKILL.md is a skill; never descend past one. */
export function discoverSkills(root) {
  const skills = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const dirPath = join(dir, entry.name);
      if (existsSync(join(dirPath, "SKILL.md"))) {
        const fromRoot = relative(root, dirPath).split(sep);
        skills.push({
          name: entry.name,
          dir: dirPath,
          category: fromRoot.length > 1 ? fromRoot[0] : null,
        });
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
export function installSkills({
  sources,
  target,
  labelBase,
  dryRun = false,
  only,
  skillNames,
}) {
  const discovered = sources.map((source) => discoverSkills(source));
  const availableNames = new Set(discovered.flat().map((skill) => skill.name));
  let selectedNames = null;

  if (only) {
    const releaseCategories = new Set(
      discovered.flat().map((skill) => skill.category).filter(Boolean)
    );
    if (!releaseCategories.has(only)) {
      const available = [...releaseCategories].sort().join(", ") || "none";
      return selectionFailure(`未知分类 '${only}'（可选: ${available}）`);
    }
    selectedNames = new Set(
      discovered.flat().filter((skill) => skill.category === only).map((skill) => skill.name)
    );
  } else if (skillNames) {
    selectedNames = new Set(skillNames);
    const unknown = [...selectedNames].filter((name) => !availableNames.has(name));
    if (unknown.length > 0) return selectionFailure(`未知技能: ${unknown.join(", ")}`);
  }

  const byName = new Map();
  const clashes = [];
  for (const skills of discovered) {
    for (const skill of skills) {
      if (selectedNames && !selectedNames.has(skill.name)) continue;
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
          repointed.push(`${name}\n    旧: ${current}\n    新: ${desired}`);
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

function selectionFailure(message) {
  console.error(`ERROR: ${message}`);
  return {
    created: [],
    kept: [],
    repointed: [],
    converted: [],
    removed: [],
    anomalies: [],
    foreign: [],
    failures: [message],
  };
}

/**
 * Remove exactly what installSkills() put into `target`: links whose target
 * lives under one of `sources`. Real directories, loose files, and links
 * pointing anywhere else (lark-* chains, other repos) are never touched, and
 * skills-backup-* folders next to the target are reported but kept.
 * Returns { removed, remaining, backups, failures }.
 */
export function uninstallSkills({ sources, target, dryRun = false }) {
  const removed = [];
  const removedNames = new Set();
  const failures = [];

  if (!existsSync(target)) {
    console.log(`Target: ${target}\nNothing to uninstall — target does not exist.`);
    return { removed, remaining: [], backups: [], failures };
  }

  const ownedRoots = sources.map((s) => normalizeLinkTarget(s));

  for (const entry of readdirSync(target, { withFileTypes: true })) {
    const entryPath = join(target, entry.name);
    try {
      if (!lstatSync(entryPath).isSymbolicLink()) continue; // never touch real entries
      const current = readlinkSync(entryPath);
      const abs = isAbsolute(current) ? current : resolve(dirname(entryPath), current);
      const normalized = normalizeLinkTarget(abs);
      if (!ownedRoots.some((r) => normalized.startsWith(r + "\\"))) continue; // not ours
      if (!dryRun) rmSync(entryPath);
      removedNames.add(entry.name);
      removed.push(`${entry.name}  ->  ${current}`);
    } catch (err) {
      failures.push(`${entry.name}: ${err.message}`);
    }
  }

  const remaining = readdirSync(target, { withFileTypes: true })
    .filter((e) => !removedNames.has(e.name))
    .map((e) => e.name);

  const backups = readdirSync(dirname(target)).filter((n) => /^skills-backup-/.test(n));

  const section = (title, rows) => {
    if (rows.length === 0) return;
    console.log(`\n${title} (${rows.length}):`);
    for (const row of rows) console.log(`  ${row}`);
  };

  if (dryRun) console.log("DRY RUN — nothing was changed\n");
  console.log(`Target: ${target}`);
  console.log(`Sources: ${sources.join(", ")}`);
  if (removed.length > 0) {
    section("removed", removed);
  } else {
    console.log("\nNothing owned by this repo found — no links point into the sources.");
  }
  console.log(`\nEntries left untouched (${remaining.length}): ${remaining.join(", ") || "none"}`);
  if (backups.length > 0) {
    console.log(
      `\nBackup folders kept (restore from or delete them manually): ` +
        backups.map((b) => join(dirname(target), b)).join(", ")
    );
  }
  console.log(
    `\nSummary: ${removed.length} removed, ${remaining.length} untouched` +
      (backups.length ? `, ${backups.length} backup folder(s) kept` : "") +
      (failures.length ? `, ${failures.length} FAILED` : "")
  );
  for (const f of failures) console.error(`  ✗ ${f}`);

  return { removed, remaining, backups, failures };
}
