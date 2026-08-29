#!/usr/bin/env node
/**
 * Fixture test for scripts/skill-links.mjs (core library of the unified
 * installer/uninstaller).
 *
 * Builds a fake single-source skills tree (categories, lifecycle categories,
 * a matt-skills-style group) and pre-populated targets in a temp dir, then
 * checks every decision the installer can make:
 *
 *   per name:   create / keep / repoint / convert
 *   per set:    excludeCategories filtering BEFORE the byName map
 *   per target: out-of-set sweep (whole-set runs only), dead-link removal,
 *               anomalies, foreign untouched
 *   selection:  --only / --skills bypass the set exclusion AND are surgical —
 *               repo-owned but unselected links stay untouched; unknown values
 *               rejected
 *   clash:      same name in two categories -> one link, walk order wins
 *   uninstall:  removes ALL repo-owned links (deprecated/in-progress included)
 *
 * Run: node tests/skills/test-install-skills.mjs
 */

import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { installSkills, normalizeLinkTarget, uninstallSkills } from "../../scripts/skill-links.mjs";

const failures = [];
const fail = (msg) => failures.push(msg);
const expect = (cond, msg) => {
  if (!cond) fail(msg);
};
const linkTarget = (p) => normalizeLinkTarget(readlinkSync(p));
const isLink = (p) => lstatSync(p).isSymbolicLink();

const root = mkdtempSync(join(tmpdir(), "install-skills-test-"));

try {
  // --- fixtures ---------------------------------------------------------------
  // Three isolated single-root source trees, each standing for one stage.
  const mkTree = (name) => {
    const treeRoot = join(root, name);
    mkdirSync(treeRoot, { recursive: true });
    return treeRoot;
  };
  const mkSkill = (treeRoot, category, name, group) => {
    const dir = group ? join(treeRoot, category, group, name) : join(treeRoot, category, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), `---\nname: ${name}\n---\n`);
    return dir;
  };

  // Stage A tree: per-name decisions + health pass.
  const src = mkTree("src-a");
  const wfDevDir = mkSkill(src, "workflow", "wf-dev");
  const wfStaleDir = mkSkill(src, "workflow", "wf-stale");
  const wfNewDir = mkSkill(src, "workflow", "wf-new");
  const engPubDir = mkSkill(src, "engineering", "eng-pub");
  // Stage B-D tree: lifecycle categories for set semantics and bypasses.
  const src2 = mkTree("src-b");
  const wf2Dir = mkSkill(src2, "workflow", "wf2");
  const dep2Dir = mkSkill(src2, "deprecated", "dep2");
  mkSkill(src2, "in-progress", "prog2");
  // Stage E tree: cross-category name clash.
  const src3 = mkTree("src-c");
  const clashADir = mkSkill(src3, "cat-a", "shared");
  const clashBDir = mkSkill(src3, "cat-b", "shared");

  // --- stage A: create / keep / repoint / convert + health pass ---------------
  const target = join(root, "target");
  mkdirSync(target, { recursive: true });
  symlinkSync(wfDevDir, join(target, "wf-dev"), "junction"); // already correct
  symlinkSync(join(src, "workflow", "gone"), join(target, "wf-stale"), "junction"); // wrong target
  mkdirSync(join(target, "eng-pub")); // real copy to convert
  writeFileSync(join(target, "eng-pub", "SKILL.md"), "stale copy");
  mkdirSync(join(target, "foreign")); // not ours, must not be touched
  writeFileSync(join(target, "foreign", "keep.txt"), "keep");
  symlinkSync(join(root, "nowhere"), join(target, "dead-link"), "junction"); // foreign dead link
  writeFileSync(join(target, "loose.txt"), "x"); // anomaly: loose file
  mkdirSync(join(target, "empty-skill")); // anomaly: dir without SKILL.md

  const result = installSkills({ sources: [src], target, labelBase: root });

  expect(result.failures.length === 0, `failures reported: ${result.failures.join("; ")}`);
  expect(result.created.length === 1 && result.created[0].startsWith("wf-new"), "wf-new not created");
  expect(result.kept.length === 1 && result.kept[0] === "wf-dev", "wf-dev not kept");
  expect(result.repointed.length === 1 && result.repointed[0].startsWith("wf-stale"), "wf-stale not repointed");
  expect(result.converted.length === 1 && result.converted[0].startsWith("eng-pub"), "eng-pub not converted");
  expect(result.removed.length === 1 && result.removed[0].startsWith("dead-link"), "dead-link not removed");
  expect(result.outOfSet.length === 0, `unexpected out-of-set removals: ${result.outOfSet.join("; ")}`);
  // foreign/ also lacks SKILL.md, so it is a legitimate third anomaly
  expect(result.anomalies.length === 3, `anomalies: ${result.anomalies.join("; ")}`);
  const foreignList = result.foreign.slice().sort().join(",");
  expect(foreignList === "empty-skill,foreign,loose.txt", `foreign entries: ${foreignList}`);

  expect(isLink(join(target, "wf-new")), "wf-new is not a link");
  expect(linkTarget(join(target, "wf-new")) === normalizeLinkTarget(wfNewDir), "wf-new points wrong");
  expect(linkTarget(join(target, "wf-dev")) === normalizeLinkTarget(wfDevDir), "wf-dev points wrong");
  expect(linkTarget(join(target, "wf-stale")) === normalizeLinkTarget(wfStaleDir), "wf-stale still stale");
  expect(isLink(join(target, "eng-pub")), "eng-pub is not a link");
  expect(linkTarget(join(target, "eng-pub")) === normalizeLinkTarget(engPubDir), "eng-pub points wrong");

  const backupName = readdirSync(root).find((n) => n.startsWith("skills-backup-"));
  expect(backupName !== undefined, "no skills-backup-<ts> folder created next to target");
  if (backupName) {
    const backupPub = join(root, backupName, "eng-pub");
    expect(existsSync(backupPub), "converted eng-pub not moved into backup");
    expect(existsSync(join(backupPub, "SKILL.md")), "backup copy of eng-pub lost its contents");
  }

  expect(existsSync(join(target, "foreign", "keep.txt")), "foreign entry was touched");
  expect(!existsSync(join(target, "dead-link")), "dead-link still present after health pass");
  expect(existsSync(join(target, "loose.txt")), "loose.txt was touched (report only)");
  expect(existsSync(join(target, "empty-skill")), "empty-skill was touched (report only)");

  // --- stage B: set exclusion + out-of-set sweep --------------------------------
  const target2 = join(root, "target2");
  mkdirSync(target2, { recursive: true });
  symlinkSync(wf2Dir, join(target2, "wf2"), "junction"); // in default set
  symlinkSync(dep2Dir, join(target2, "dep2"), "junction"); // deprecated: out of set
  symlinkSync(join(src2, "in-progress", "prog2"), join(target2, "prog2"), "junction"); // in-progress: out of set
  mkdirSync(join(src2, "deprecated", "ghost-dir")); // alive dir under the source root, not a skill
  symlinkSync(join(src2, "deprecated", "ghost-dir"), join(target2, "ghost"), "junction"); // repo-owned, unselected
  symlinkSync(join(target2, "foreign"), join(target2, "lark-fake"), "junction"); // foreign link: must survive
  mkdirSync(join(target2, "foreign"));

  const setResult = installSkills({
    sources: [src2],
    target: target2,
    excludeCategories: ["deprecated", "in-progress"],
  });
  expect(setResult.failures.length === 0, `set run failures: ${setResult.failures.join("; ")}`);
  expect(setResult.created.length === 0 && setResult.kept.length === 1 && setResult.kept[0] === "wf2",
    "set run did not keep exactly wf2");
  const outOfSetNames = setResult.outOfSet.map((row) => row.split(/\s+/)[0]).sort();
  expect(
    outOfSetNames.join(",") === "dep2,ghost,prog2",
    `out-of-set sweep removed: ${outOfSetNames.join(",")}`
  );
  expect(!existsSync(join(target2, "dep2")), "deprecated link survived the out-of-set sweep");
  expect(!existsSync(join(target2, "prog2")), "in-progress link survived the out-of-set sweep");
  expect(!existsSync(join(target2, "ghost")), "unselected repo-owned link survived the sweep");
  expect(existsSync(join(target2, "lark-fake")), "foreign link was removed by the sweep");
  expect(setResult.foreign.includes("lark-fake"), "foreign link not reported as untouched");

  // dry-run reports the same sweep without touching anything.
  const target2b = join(root, "target2b");
  mkdirSync(target2b, { recursive: true });
  symlinkSync(dep2Dir, join(target2b, "dep2"), "junction");
  const drySet = installSkills({
    sources: [src2],
    target: target2b,
    excludeCategories: ["deprecated"],
    dryRun: true,
  });
  expect(drySet.outOfSet.length === 1 && drySet.outOfSet[0].startsWith("dep2"), "dry-run missed the out-of-set link");
  expect(existsSync(join(target2b, "dep2")), "dry-run deleted a link");

  // --- stage C: --only bypasses the set exclusion, surgically --------------------
  // Explicit selections never sweep: repo-owned links outside the selection
  // (and foreign links) must survive untouched.
  const onlyTarget = join(root, "only-target");
  mkdirSync(onlyTarget, { recursive: true });
  symlinkSync(wf2Dir, join(onlyTarget, "wf2"), "junction"); // repo-owned, NOT selected
  symlinkSync(join(onlyTarget, "foreign"), join(onlyTarget, "lark-fake"), "junction");
  mkdirSync(join(onlyTarget, "foreign"));
  const onlyResult = installSkills({
    sources: [src2],
    target: onlyTarget,
    only: "deprecated",
    excludeCategories: ["deprecated", "in-progress"],
  });
  expect(onlyResult.failures.length === 0, `--only failures: ${onlyResult.failures.join("; ")}`);
  expect(
    readdirSync(onlyTarget).sort().join(",") === "dep2,foreign,lark-fake,wf2",
    "--only did not add exactly the selected category while keeping the rest"
  );
  expect(linkTarget(join(onlyTarget, "dep2")) === normalizeLinkTarget(dep2Dir), "dep2 points wrong");
  expect(onlyResult.outOfSet.length === 0, `surgical --only swept: ${onlyResult.outOfSet.join("; ")}`);
  expect(onlyResult.removed.length === 0, `surgical --only removed: ${onlyResult.removed.join("; ")}`);
  expect(isLink(join(onlyTarget, "wf2")), "unselected repo link deleted/damaged by --only");
  expect(linkTarget(join(onlyTarget, "wf2")) === normalizeLinkTarget(wf2Dir), "wf2 repointed by --only");
  expect(existsSync(join(onlyTarget, "lark-fake")), "foreign link removed by --only");
  expect(
    onlyResult.foreign.includes("wf2") && onlyResult.foreign.includes("lark-fake"),
    "--only did not report unselected repo link and foreign link as untouched"
  );

  const badCategory = installSkills({ sources: [src2], target: join(root, "bad-cat"), only: "nope" });
  expect(badCategory.failures.length === 1, "unknown --only category was not rejected");
  expect(badCategory.failures[0].includes("workflow"), "unknown category error does not list available categories");

  // --- stage D: --skills bypasses the set exclusion, surgically ------------------
  const namesTarget = join(root, "names-target");
  mkdirSync(namesTarget, { recursive: true });
  symlinkSync(dep2Dir, join(namesTarget, "dep2"), "junction"); // repo-owned, NOT selected
  symlinkSync(join(namesTarget, "foreign"), join(namesTarget, "lark-fake"), "junction");
  mkdirSync(join(namesTarget, "foreign"));
  const namesResult = installSkills({
    sources: [src2],
    target: namesTarget,
    skillNames: ["prog2"],
    excludeCategories: ["deprecated", "in-progress"],
  });
  expect(namesResult.failures.length === 0, `--skills failures: ${namesResult.failures.join("; ")}`);
  expect(
    readdirSync(namesTarget).sort().join(",") === "dep2,foreign,lark-fake,prog2",
    "--skills did not reach an in-progress skill past the set exclusion"
  );
  expect(namesResult.outOfSet.length === 0 && namesResult.removed.length === 0,
    `surgical --skills swept: ${[...namesResult.outOfSet, ...namesResult.removed].join("; ")}`);
  expect(isLink(join(namesTarget, "dep2")), "unselected repo link deleted by --skills");
  expect(existsSync(join(namesTarget, "lark-fake")), "foreign link removed by --skills");

  const rejectedTarget = join(root, "rejected-target");
  const rejected = installSkills({ sources: [src2], target: rejectedTarget, skillNames: ["missing-skill"] });
  expect(rejected.failures.length === 1, "unknown --skills name was not rejected");
  expect(!existsSync(rejectedTarget), "selection failure mutated the target");

  // --- stage E: cross-category clash -> one link, walk order wins ------------------
  const clashTarget = join(root, "clash-target");
  const clashResult = installSkills({ sources: [src3], target: clashTarget, only: "cat-a" });
  const clashAgain = installSkills({ sources: [src3], target: clashTarget }); // full install incl. cat-b
  expect(clashResult.failures.length === 0 && clashAgain.failures.length === 0, "clash run reported failures");
  const clashEntries = readdirSync(clashTarget);
  expect(clashEntries.length === 1 && clashEntries[0] === "shared", `clash produced: ${clashEntries.join(",")}`);
  const clashPointee = linkTarget(join(clashTarget, "shared"));
  expect(
    clashPointee === normalizeLinkTarget(clashADir) || clashPointee === normalizeLinkTarget(clashBDir),
    "clash link points outside the source tree"
  );

  // --- stage F: uninstall removes ALL repo-owned links -----------------------------
  const target3 = join(root, "target3");
  mkdirSync(target3, { recursive: true });
  symlinkSync(wf2Dir, join(target3, "wf2"), "junction"); // current set
  symlinkSync(dep2Dir, join(target3, "dep2"), "junction"); // historical deprecated install
  symlinkSync(join(src2, "deprecated", "gone-forever"), join(target3, "dead-repo-link"), "junction"); // dead but repo-owned
  symlinkSync(join(target3, "foreign"), join(target3, "lark-fake"), "junction"); // foreign: survives
  mkdirSync(join(target3, "foreign"));
  writeFileSync(join(target3, "loose.txt"), "x");

  const dryUn = uninstallSkills({ sources: [src2], target: target3, dryRun: true });
  expect(dryUn.removed.length === 3, `dry uninstall removed: ${dryUn.removed.join("; ")}`);
  expect(existsSync(join(target3, "wf2")), "dry-run uninstall deleted a link");

  const un = uninstallSkills({ sources: [src2], target: target3 });
  expect(un.failures.length === 0, `uninstall failures: ${un.failures.join("; ")}`);
  expect(un.removed.length === 3, `uninstall removed: ${un.removed.join("; ")}`);
  for (const n of ["wf2", "dep2", "dead-repo-link"]) {
    expect(!existsSync(join(target3, n)), `${n} not removed by uninstall`);
  }
  expect(existsSync(join(target3, "lark-fake")), "foreign link removed by uninstall");
  expect(existsSync(join(target3, "foreign")), "foreign dir touched by uninstall");
  expect(existsSync(join(target3, "loose.txt")), "loose.txt touched by uninstall");
  expect(un.backups.length === 1, `backups reported: ${un.backups.join("; ")}`);
  expect(
    existsSync(join(root, un.backups[0], "eng-pub", "SKILL.md")),
    "backup folder deleted or emptied by uninstall"
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}

// The evals entry keeps its own fixture segment in the npm-test chain.
for (const child of ["test-run-evals.mjs"]) {
  try {
    execFileSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), child)], {
      stdio: "inherit",
    });
  } catch {
    fail(`${child} failed`);
  }
}

// --- Report ------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`FAIL — ${failures.length} problem(s):\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}

console.log("PASS — skill-links: create/keep/repoint/convert, set exclusion, out-of-set sweep, bypass selections, clash, uninstall all verified");
