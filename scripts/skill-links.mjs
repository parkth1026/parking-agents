#!/usr/bin/env node
/**
 * Core library shared by scripts/install-skills.mjs and
 * scripts/uninstall-skills.mjs: discovery over the skills/ tree, junction
 * management, and the per-name decision table at the target directory.
 *
 * The skills/ tree is the single install source. Categories are its top-level
 * directories (deprecated, in-progress, life, matt-skills, pub, ue, workflow);
 * a directory anywhere in the tree holding a SKILL.md is a skill, and
 * installable sets are expressed as category exclusions:
 *
 *   default  excludes deprecated + in-progress
 *   progress excludes deprecated
 *   all      excludes nothing
 *
 * Results are flattened by name into the target root, because Claude Code /
 * Codex scan skills/ only one level deep. Each skill becomes a directory
 * junction (Windows, no admin rights needed; POSIX degrades to a plain
 * symlink). The agent then reads the working tree directly, so installed
 * copies can never drift from the repo.
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
 * Selection, in precedence order:
 *   only / skillNames  explicit choice, BYPASSES set exclusion — surgical:
 *                      only the chosen names are created/repointed/converted,
 *                      every other entry (repo-owned links included) is left
 *                      untouched, so `--only <cat>` / `--skills a,b` are safe
 *                      to run for real against a fully populated target
 *   excludeCategories  set exclusion (see SETS); ignored when only/skillNames
 *
 * Out-of-set sweep — enabled ONLY on whole-set runs (no only, no skillNames):
 * after the managed names, a junction whose target lives under the skills/
 * root but whose name is NOT in the selected set is removed — switching from
 * the `all` set back to `default` must take the old deprecated/in-progress
 * links away again. Explicit selections never sweep.
 *
 * Health pass over entries NOT owned by this repo — the target doubles as a
 * checkup that clears illegal content and reports the rest:
 *   link whose target is gone    -> removed (dead junction: the skill would
 *                                   silently never load in any agent)
 *   dir without SKILL.md, loose
 *   file, link to a file         -> reported as an anomaly, left untouched
 *   healthy foreign skill/link   -> untouched (e.g. lark-* installed elsewhere)
 *
 * The reverse operation, uninstallSkills(), removes exactly what this repo
 * ever put in: links whose target lives under the skills/ root, including
 * links installed by historical versions of the installer (deprecated and
 * in-progress links included). Real directories, loose files, and links
 * pointing anywhere else (lark-* chains, other repos) are never touched, and
 * skills-backup-* folders are only reported, never deleted.
 *
 * Every path is derived from this file's location and os.homedir(); nothing
 * is hardcoded, so the repo stays portable across machines and drives.
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

/** The skills/ tree is the single install source. */
export const repoSources = [join(repoRoot, "skills")];

/** Named install sets, expressed as category exclusions. */
export const SETS = {
  default: ["deprecated", "in-progress"],
  progress: ["deprecated"],
  all: [],
};

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

/** Every skill in the repo's skills/ tree (single source). */
export function discoverRepoSkills() {
  return repoSources.flatMap((source) => discoverSkills(source));
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

/** Resolve a link's stored target to a comparable absolute path. */
function linkTargetAbsolute(linkPath, current) {
  return isAbsolute(current) ? current : resolve(dirname(linkPath), current);
}

function timestamp() {
  const t = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  return `${t.slice(0, 8)}-${t.slice(8)}`;
}

/**
 * Install the selected skills into `target` (created if missing), then run
 * the health pass (dead links, anomalies).
 *
 * Selection, in precedence order:
 *   only / skillNames  explicit choice, BYPASSES set exclusion — surgical:
 *                      only the chosen names are created/repointed/converted
 *                      and NO out-of-set sweep happens; repo-owned but
 *                      unselected links are left untouched
 *   excludeCategories  set exclusion (see SETS); whole-set runs additionally
 *                      sweep repo-owned links that fell out of the set
 *
 * Returns { created, kept, repointed, converted, removed, outOfSet, anomalies,
 *           foreign, failures }.
 */
export function installSkills({
  sources = repoSources,
  target,
  labelBase,
  dryRun = false,
  only,
  skillNames,
  excludeCategories,
}) {
  const excluded = new Set(excludeCategories ?? []);
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

  // Set exclusion happens BEFORE the byName map: a filtered-out skill never
  // enters the selection, so clash detection sees only what will be installed.
  const visible = discovered.map((skills) =>
    selectedNames
      ? skills.filter((skill) => selectedNames.has(skill.name))
      : excluded.size > 0
        ? skills.filter((skill) => !skill.category || !excluded.has(skill.category))
        : skills
  );

  const byName = new Map();
  const clashes = [];
  for (const skills of visible) {
    for (const skill of skills) {
      if (byName.has(skill.name)) {
        clashes.push(`${skill.name}: ${skill.dir} skipped, walk order wins`);
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

  // --- out-of-set sweep + health pass over remaining entries ------------------
  // Whole-set runs (no only/skillNames) sweep: repo-owned junctions whose name
  // is not in this run's selection are removed, so a set downgrade takes stale
  // deprecated/in-progress links away. Explicit selections are surgical —
  // repo-owned but unselected links are skipped entirely (no delete, no
  // anomaly) and land in the untouched/foreign report. Dead foreign links are
  // unambiguous garbage (the skill silently never loads); real directories and
  // files are never deleted here — only reported.
  const sweepOutOfSet = selectedNames === null; // null = whole-set run
  const ownedRoots = sources.map((s) => normalizeLinkTarget(s));
  const isRepoOwned = (abs) => {
    const normalized = normalizeLinkTarget(abs);
    return ownedRoots.some((r) => normalized.startsWith(r + "\\"));
  };

  const removed = [];
  const removedNames = new Set();
  const outOfSet = [];
  const anomalies = [];
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (byName.has(entry.name)) continue; // managed above
    const entryPath = join(target, entry.name);
    try {
      const st = lstatSync(entryPath);
      if (st.isSymbolicLink()) {
        const current = readlinkSync(entryPath);
        const abs = linkTargetAbsolute(entryPath, current);
        if (!existsSync(abs)) {
          if (!dryRun) rmSync(entryPath);
          removedNames.add(entry.name);
          removed.push(`${entry.name}  ->  ${current}  (target missing)`);
        } else if (isRepoOwned(abs)) {
          if (!sweepOutOfSet) continue; // surgical run: repo-owned, unselected — untouched
          if (!dryRun) rmSync(entryPath);
          removedNames.add(entry.name);
          outOfSet.push(`${entry.name}  ->  ${current}  (out of set)`);
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
  section("removed (out of set)", outOfSet);
  section("removed (dead links)", removed);
  section("anomalies (reported, not touched)", anomalies);
  console.log(`\nForeign entries left untouched (${foreign.length}): ${foreign.join(", ") || "none"}`);
  for (const c of clashes) console.warn(`warning: name clash — ${c}`);
  console.log(
    `\nSummary: ${created.length} created, ${kept.length} kept, ${repointed.length} repointed, ` +
      `${converted.length} converted, ${outOfSet.length} out-of-set removed, ${removed.length} dead links removed, ${foreign.length} untouched` +
      (anomalies.length ? `, ${anomalies.length} anomalies reported` : "") +
      (failures.length ? `, ${failures.length} FAILED` : "")
  );
  for (const f of failures) console.error(`  ✗ ${f}`);

  return { created, kept, repointed, converted, removed, outOfSet, anomalies, foreign, failures };
}

function selectionFailure(message) {
  console.error(`ERROR: ${message}`);
  return {
    created: [],
    kept: [],
    repointed: [],
    converted: [],
    removed: [],
    outOfSet: [],
    anomalies: [],
    foreign: [],
    failures: [message],
  };
}

/**
 * Remove exactly what this repo ever put into `target`: links whose target
 * lives under one of `sources` — regardless of category, so links installed
 * by historical runs (deprecated, in-progress) go too. Real directories,
 * loose files, and links pointing anywhere else (lark-* chains, other repos)
 * are never touched, and skills-backup-* folders next to the target are
 * reported but kept.
 * Returns { removed, remaining, backups, failures }.
 */
export function uninstallSkills({ sources = repoSources, target, dryRun = false }) {
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
      const abs = linkTargetAbsolute(entryPath, current);
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
