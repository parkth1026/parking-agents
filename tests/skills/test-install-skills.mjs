#!/usr/bin/env node
/**
 * Fixture test for scripts/install-skills.mjs.
 *
 * Builds a fake source tree (one flat, one nested) and a pre-populated target
 * in a temp dir, then checks every decision the installer can make per name:
 * create, keep, repoint, convert — plus that foreign entries stay untouched.
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
import { installSkills, normalizeLinkTarget, uninstallSkills } from "../../scripts/install-skills.mjs";

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
  const srcA = join(root, "src-a"); // flat, like .agents/skills
  const srcB = join(root, "src-b"); // nested, like skills/<category>/<name>
  const target = join(root, "target");

  const mkSkill = (base, ...segments) => {
    const dir = join(base, ...segments);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), `---\nname: ${segments.at(-1)}\n---\n`);
    return dir;
  };

  const devDir = mkSkill(srcA, "skill-dev");
  const staleDir = mkSkill(srcA, "skill-stale");
  const newDir = mkSkill(srcA, "skill-new");
  const pubDir = mkSkill(srcB, "engineering", "skill-pub");

  mkdirSync(target, { recursive: true });
  symlinkSync(devDir, join(target, "skill-dev"), "junction"); // already correct
  symlinkSync(join(srcA, "gone"), join(target, "skill-stale"), "junction"); // stale link
  mkdirSync(join(target, "skill-pub")); // real copy to convert
  writeFileSync(join(target, "skill-pub", "SKILL.md"), "stale copy");
  mkdirSync(join(target, "foreign")); // not ours, must not be touched
  writeFileSync(join(target, "foreign", "keep.txt"), "keep");
  symlinkSync(join(root, "nowhere"), join(target, "dead-link"), "junction"); // foreign dead link
  writeFileSync(join(target, "loose.txt"), "x"); // anomaly: loose file
  mkdirSync(join(target, "empty-skill")); // anomaly: dir without SKILL.md

  // --- run --------------------------------------------------------------------
  const result = installSkills({ sources: [srcA, srcB], target, labelBase: root });

  // --- assertions -------------------------------------------------------------
  expect(result.failures.length === 0, `failures reported: ${result.failures.join("; ")}`);
  expect(result.created.length === 1 && result.created[0].startsWith("skill-new"), "skill-new not created");
  expect(result.kept.length === 1 && result.kept[0] === "skill-dev", "skill-dev not kept");
  expect(result.repointed.length === 1 && result.repointed[0].startsWith("skill-stale"), "skill-stale not repointed");
  expect(result.converted.length === 1 && result.converted[0].startsWith("skill-pub"), "skill-pub not converted");
  expect(result.removed.length === 1 && result.removed[0].startsWith("dead-link"), "dead-link not removed");
  // foreign/ also lacks SKILL.md, so it is a legitimate third anomaly
  expect(result.anomalies.length === 3, `anomalies: ${result.anomalies.join("; ")}`);
  const foreignList = result.foreign.slice().sort().join(",");
  expect(foreignList === "empty-skill,foreign,loose.txt", `foreign entries: ${foreignList}`);

  expect(isLink(join(target, "skill-new")), "skill-new is not a link");
  expect(linkTarget(join(target, "skill-new")) === normalizeLinkTarget(newDir), "skill-new points wrong");
  expect(linkTarget(join(target, "skill-dev")) === normalizeLinkTarget(devDir), "skill-dev points wrong");
  expect(linkTarget(join(target, "skill-stale")) === normalizeLinkTarget(staleDir), "skill-stale still stale");
  expect(isLink(join(target, "skill-pub")), "skill-pub is not a link");
  expect(linkTarget(join(target, "skill-pub")) === normalizeLinkTarget(pubDir), "skill-pub points wrong");

  const backupName = readdirSync(root).find((n) => n.startsWith("skills-backup-"));
  expect(backupName !== undefined, "no skills-backup-<ts> folder created next to target");
  if (backupName) {
    const backupPub = join(root, backupName, "skill-pub");
    expect(existsSync(backupPub), "converted skill-pub not moved into backup");
    expect(
      existsSync(join(backupPub, "SKILL.md")),
      "backup copy of skill-pub lost its contents"
    );
  }

  expect(existsSync(join(target, "foreign", "keep.txt")), "foreign entry was touched");
  expect(!existsSync(join(target, "dead-link")), "dead-link still present after health pass");
  expect(existsSync(join(target, "loose.txt")), "loose.txt was touched (report only)");
  expect(existsSync(join(target, "empty-skill")), "empty-skill was touched (report only)");

  // --- missing target directory is created and fully populated ----------------
  const fresh = join(root, "fresh-target"); // does not exist yet
  const freshResult = installSkills({ sources: [srcA, srcB], target: fresh });
  const freshLinks = ["skill-dev", "skill-stale", "skill-new", "skill-pub"].filter((n) =>
    isLink(join(fresh, n))
  );
  expect(freshResult.created.length === 4 && freshLinks.length === 4, "fresh target not fully populated");
  expect(freshResult.failures.length === 0, `fresh run failures: ${freshResult.failures.join("; ")}`);

  // --- uninstall removes only links owned by the sources ----------------------
  symlinkSync(join(target, "foreign"), join(target, "alien-link"), "junction"); // foreign link: must survive
  const un = uninstallSkills({ sources: [srcA, srcB], target });
  expect(un.failures.length === 0, `uninstall failures: ${un.failures.join("; ")}`);
  expect(un.removed.length === 4, `uninstall removed: ${un.removed.join("; ")}`);
  for (const n of ["skill-dev", "skill-stale", "skill-new", "skill-pub"]) {
    expect(!existsSync(join(target, n)), `${n} not removed by uninstall`);
  }
  expect(existsSync(join(target, "alien-link")), "foreign link removed by uninstall");
  expect(existsSync(join(target, "foreign", "keep.txt")), "foreign dir touched by uninstall");
  expect(existsSync(join(target, "loose.txt")), "loose.txt touched by uninstall");
  expect(existsSync(join(target, "empty-skill")), "empty-skill touched by uninstall");
  expect(un.backups.length === 1, `backups reported: ${un.backups.join("; ")}`);
  expect(
    existsSync(join(root, un.backups[0], "skill-pub", "SKILL.md")),
    "backup folder deleted or emptied by uninstall"
  );

  // --- optional selection: category and explicit names -----------------------
  const selectDev = join(root, "select-dev");
  const selectRelease = join(root, "select-release");
  const selectOnlyTarget = join(root, "select-only-target");
  const selectNamesTarget = join(root, "select-names-target");
  const alphaDir = mkSkill(selectDev, "alpha");
  const sharedDevDir = mkSkill(selectDev, "shared");
  const engineeringDir = mkSkill(selectRelease, "engineering", "engine-only");
  const productivityDir = mkSkill(selectRelease, "productivity", "product-only");
  mkSkill(selectRelease, "productivity", "shared");

  const onlyResult = installSkills({
    sources: [selectDev, selectRelease],
    target: selectOnlyTarget,
    only: "productivity",
  });
  expect(onlyResult.failures.length === 0, `--only failures: ${onlyResult.failures.join("; ")}`);
  expect(
    readdirSync(selectOnlyTarget).sort().join(",") === "product-only,shared",
    "--only productivity did not install exactly that category"
  );
  expect(
    linkTarget(join(selectOnlyTarget, "shared")) === normalizeLinkTarget(sharedDevDir),
    "--only did not preserve dev-side clash precedence"
  );
  expect(!existsSync(join(selectOnlyTarget, "engine-only")), "--only installed an unselected category");

  const namesResult = installSkills({
    sources: [selectDev, selectRelease],
    target: selectNamesTarget,
    skillNames: ["alpha", "engine-only"],
  });
  expect(namesResult.failures.length === 0, `--skills failures: ${namesResult.failures.join("; ")}`);
  expect(
    readdirSync(selectNamesTarget).sort().join(",") === "alpha,engine-only",
    "--skills did not install exactly the requested names"
  );
  expect(linkTarget(join(selectNamesTarget, "alpha")) === normalizeLinkTarget(alphaDir), "alpha points wrong");
  expect(
    linkTarget(join(selectNamesTarget, "engine-only")) === normalizeLinkTarget(engineeringDir),
    "engine-only points wrong"
  );
  expect(
    linkTarget(join(selectOnlyTarget, "product-only")) === normalizeLinkTarget(productivityDir),
    "product-only points wrong"
  );

  const rejectedTarget = join(root, "rejected-target");
  const rejected = installSkills({
    sources: [selectDev, selectRelease],
    target: rejectedTarget,
    skillNames: ["missing-skill"],
  });
  expect(rejected.failures.length === 1, "unknown --skills name was not rejected");
  expect(!existsSync(rejectedTarget), "selection failure mutated the target");
} finally {
  rmSync(root, { recursive: true, force: true });
}

// Keep the existing npm-test segment as the release-flow fixture segment.
// The package script gains only the required build-release --check segment.
for (const child of ["test-build-release.mjs", "test-run-evals.mjs"]) {
  try {
    execFileSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), child)], {
      stdio: "inherit",
    });
  } catch {
    fail(`${child} failed`);
  }
}

// --- Report --------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`FAIL — ${failures.length} problem(s):\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}

console.log("PASS — install-skills: create/keep/repoint/convert/untouched all verified");
