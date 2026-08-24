#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { EVAL_GATE_FILES } from "../../scripts/build-release.mjs";

const temp = mkdtempSync(join(tmpdir(), "build-release-test-"));
const script = resolve("scripts/build-release.mjs");
let failures = 0;
const check = (condition, message) => {
  if (condition) return;
  failures++;
  console.error(`  ✗ ${message}`);
};

function write(path, content) {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, content);
}

function makeRepo(name) {
  const root = join(temp, name);
  mkdirSync(join(root, ".agents", "skills"), { recursive: true });
  mkdirSync(join(root, "skills", "engineering"), { recursive: true });
  mkdirSync(join(root, "skills", "productivity"), { recursive: true });
  write(join(root, "README.md"), "# fixture\n");
  write(join(root, "skills", "engineering", "README.md"), "# Engineering\n");
  write(join(root, "skills", "productivity", "README.md"), "# Productivity\n");
  return root;
}

function makeSkill(root, name, { category, malformed = false, files = EVAL_GATE_FILES, exitCode = 0 } = {}) {
  const dir = join(root, ".agents", "skills", name);
  mkdirSync(dir, { recursive: true });
  const skill = malformed
    ? `---\nname: ${name}\ndescription: missing close\n`
    : `---\nname: ${name}\ndescription: fixture${category ? `\ncategory: ${category}` : ""}\n---\nbody\n`;
  write(join(dir, "SKILL.md"), skill);
  for (const file of files) {
    if (file === "run-tests.mjs") write(join(dir, file), `process.exit(${exitCode});\n`);
    else write(join(dir, file), "{}\n");
  }
  return dir;
}

function makeReleaseSkill(root, category, name) {
  const dir = join(root, "skills", category, name);
  write(join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: upstream\n---\nupstream\n`);
  write(join(dir, "nested.txt"), "must stay byte-identical\n");
  return dir;
}

function digest(dir) {
  const rows = [];
  const walk = (path, prefix = "") => {
    for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = join(path, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(abs, rel);
      else rows.push(`${rel}:${createHash("sha256").update(readFileSync(abs)).digest("hex")}`);
    }
  };
  walk(dir);
  return rows.join("\n");
}

function run(root, ...args) {
  return spawnSync(process.execPath, [script, "--root", root, ...args], { encoding: "utf8" });
}

try {
  // Happy path, nested files, generated indexes, --check, drift repair.
  const happy = makeRepo("happy");
  const upstreamDir = makeReleaseSkill(happy, "engineering", "upstream-one");
  const upstreamBefore = digest(upstreamDir);
  const source = makeSkill(happy, "my-skill", { category: "productivity" });
  write(join(source, "scripts", "helper.mjs"), "export const value = 1;\n");
  const built = run(happy);
  check(built.status === 0, `happy build failed: ${built.stderr}`);
  const generated = join(happy, "skills", "productivity", "my-skill");
  check(existsSync(join(generated, "scripts", "helper.mjs")), "nested skill content was not copied");
  check(readFileSync(join(happy, "README.md"), "utf8").includes("BEGIN GENERATED"), "top index marker missing");
  check(
    readFileSync(join(happy, "skills", "productivity", "README.md"), "utf8").includes("my-skill"),
    "bucket README registration missing"
  );
  check(digest(upstreamDir) === upstreamBefore, "existing release skill content changed");
  check(run(happy, "--check").status === 0, "fresh generated tree failed --check");
  write(join(generated, "scripts", "helper.mjs"), "tampered\n");
  const drift = run(happy, "--check");
  check(drift.status !== 0 && `${drift.stdout}${drift.stderr}`.includes("漂移"), "manual edit did not fail --check");
  check(run(happy).status === 0 && run(happy, "--check").status === 0, "rebuild did not repair drift");
  const manifestPath = join(happy, "skills", ".generated-by-build-release.json");
  write(manifestPath, `${readFileSync(manifestPath, "utf8")} `);
  check(run(happy, "--check").status !== 0, "manual manifest edit did not fail --check");
  check(run(happy).status === 0, "rebuild did not repair manifest drift");
  makeSkill(happy, "my-skill");
  check(run(happy).status === 0, "removing category did not refresh the generated tree");
  check(!existsSync(generated) && !existsSync(manifestPath), "stale generated skill or manifest remained");
  check(run(happy, "--check").status === 0, "tree failed --check after promotion removal");
  check(digest(upstreamDir) === upstreamBefore, "promotion removal changed existing release skill content");

  // No category: no files or empty category buckets are created.
  const noop = makeRepo("noop");
  makeSkill(noop, "not-promoted", { files: [] });
  const beforeNoop = digest(noop);
  const noopResult = run(noop);
  check(noopResult.status === 0, "no-category build failed");
  check(digest(noop) === beforeNoop, "no-category build was not a no-op");
  check(!existsSync(join(noop, "skills", "pub")), "no-category build created an empty bucket");

  // Invalid category points at the skill and mutates nothing.
  const invalid = makeRepo("invalid");
  makeSkill(invalid, "bad-category", { category: "foo" });
  const invalidBefore = digest(invalid);
  const invalidResult = run(invalid);
  check(invalidResult.status !== 0, "invalid category did not fail");
  check(`${invalidResult.stdout}${invalidResult.stderr}`.includes("bad-category"), "invalid category did not name skill");
  check(digest(invalid) === invalidBefore, "invalid category mutated release tree");

  // Existing release name collision is rejected even across another category.
  const collision = makeRepo("collision");
  makeReleaseSkill(collision, "engineering", "same-name");
  makeSkill(collision, "same-name", { category: "productivity" });
  const collisionResult = run(collision);
  check(collisionResult.status !== 0, "existing release name collision did not fail");
  check(`${collisionResult.stdout}${collisionResult.stderr}`.includes("same-name"), "collision did not name skill");

  // Missing SKILL.md and malformed frontmatter warn and do not abort another promotion.
  const warnings = makeRepo("warnings");
  mkdirSync(join(warnings, ".agents", "skills", "missing-skill-file"), { recursive: true });
  makeSkill(warnings, "malformed", { malformed: true, files: [] });
  makeSkill(warnings, "valid", { category: "engineering" });
  const warningResult = run(warnings);
  const warningOutput = `${warningResult.stdout}${warningResult.stderr}`;
  check(warningResult.status === 0, "warnings aborted a valid promotion");
  check(warningOutput.includes("missing-skill-file") && warningOutput.includes("malformed"), "skip warnings incomplete");
  check(existsSync(join(warnings, "skills", "engineering", "valid", "SKILL.md")), "valid skill not generated after warnings");

  // Five-piece gate and latest run-tests result both fail closed.
  const gate = makeRepo("gate");
  makeSkill(gate, "missing-evidence", {
    category: "engineering",
    files: EVAL_GATE_FILES.filter((file) => file !== "history.json"),
  });
  const missingGate = run(gate);
  check(missingGate.status !== 0 && `${missingGate.stdout}${missingGate.stderr}`.includes("history.json"), "missing evidence did not fail closed");
  rmSync(join(gate, ".agents", "skills", "missing-evidence"), { recursive: true, force: true });
  makeSkill(gate, "red-tests", { category: "engineering", exitCode: 9 });
  const redGate = run(gate);
  check(redGate.status !== 0 && `${redGate.stdout}${redGate.stderr}`.includes("run-tests 未通过"), "red run-tests did not fail closed");
} finally {
  rmSync(temp, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`FAIL — build-release ${failures} problem(s)`);
  process.exit(1);
}
console.log("PASS — build-release: generation, gates, boundaries, indexes, and drift checks verified");
