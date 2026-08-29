#!/usr/bin/env node
/**
 * Structural assertions for the skills/ tree (single install source) and the
 * .agents/skills/ incubation side.
 *
 * Skill loading fails SILENTLY on every platform: a skill with a broken
 * frontmatter or at the wrong nesting depth simply never appears, with no
 * error and no warning. These assertions are the only thing standing between
 * a bad commit and a skill quietly vanishing.
 *
 * Run: node tests/skills/test-skill-discovery.mjs
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { SETS, discoverSkills } from "../../scripts/skill-links.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const skillsDir = join(repoRoot, "skills");
const incubatorDir = join(repoRoot, ".agents", "skills");

const failures = [];
const fail = (msg) => failures.push(msg);
const rel = (p) => relative(repoRoot, p).replace(/\\/g, "/");

// --- 1. skills/ exists with category directories --------------------------------

if (!existsSync(skillsDir)) {
	console.error("FATAL: skills/ does not exist");
	process.exit(1);
}

const categoryEntries = readdirSync(skillsDir, { withFileTypes: true });
for (const e of categoryEntries.filter((e) => e.isFile())) {
	fail(`skills/${e.name} is a loose file; categories must be directories`);
}
const categories = categoryEntries.filter((e) => e.isDirectory()).map((e) => e.name);
if (categories.length === 0) {
	console.error("FATAL: skills/ contains no category directories");
	process.exit(1);
}

// Every category the named sets exclude must actually exist — otherwise
// `--set default` silently stops excluding deprecated/in-progress.
for (const excluded of new Set(Object.values(SETS).flat())) {
	if (!categories.includes(excluded)) {
		fail(`category '${excluded}' is excluded by a named set but skills/${excluded}/ does not exist`);
	}
}

// A category directory is either a skill (has SKILL.md) or a group of skills
// (matt-skills/engineering/<name>). Deeper grouping or stray files are smells.
for (const category of categories) {
	const categoryRoot = join(skillsDir, category);
	const entries = readdirSync(categoryRoot, { withFileTypes: true });
	for (const e of entries.filter((e) => e.isFile())) {
		if (e.name.toLowerCase() !== "readme.md") {
			fail(`skills/${category}/${e.name} is a loose file; only README.md may sit beside skills`);
		}
	}
	for (const e of entries.filter((e) => e.isDirectory() && e.name.startsWith("."))) {
		fail(`skills/${category}/${e.name}/ is hidden and will never be discovered`);
	}
}

// --- 2. Discovery: recursive to SKILL.md, category = first segment --------------

const skills = discoverSkills(skillsDir);
if (skills.length === 0) {
	console.error("FATAL: no skills discovered under skills/");
	process.exit(1);
}

for (const skill of skills) {
	if (!skill.category) {
		fail(`${rel(join(skill.dir, "SKILL.md"))} sits directly under the category root — every skill needs a category directory`);
	}
	// matt-skills groups its skills one level deeper (engineering/productivity);
	// that is the only allowed extra level: category/group/name.
	const depth = relative(skillsDir, skill.dir).split(/[\\/]/).length;
	if (depth > 3) {
		fail(`${rel(join(skill.dir, "SKILL.md"))} is nested ${depth} levels deep — max is category/group/name`);
	}
}

// A directory that holds SKILL.md must never be descended into: nothing that
// looks like a nested second skill may hide inside an installed skill.
// walk() at depth d iterates children of a directory d levels below skills/;
// SKILL.md legitimately appears at depth 2 (category/name) and depth 3
// (category/group/name, the matt-skills layout).
function findNestedSkillFiles(dir, depth = 0) {
	const found = [];
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) {
			found.push(...findNestedSkillFiles(p, depth + 1));
		} else if (e.name === "SKILL.md" && depth > 3) {
			found.push(p);
		}
	}
	return found;
}
for (const p of findNestedSkillFiles(skillsDir)) {
	fail(`${rel(p)} is nested too deep — discovery stops at the first SKILL.md per branch`);
}

// --- 3. Frontmatter is parseable and consistent ----------------------------------

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;

for (const skill of skills) {
	const skillPath = join(skill.dir, "SKILL.md");
	const content = readFileSync(skillPath, "utf8");
	const match = content.match(FRONTMATTER);

	if (!match) {
		fail(
			`${rel(skillPath)} has no closing frontmatter delimiter — ` +
				`check for indented '---' or indented keys`
		);
		continue;
	}

	const block = match[1];

	// Top-level keys must be unindented, or YAML never closes the mapping.
	const topLevelKeys = block
		.split(/\r?\n/)
		.filter((l) => /^[A-Za-z_-]+\s*:/.test(l))
		.map((l) => l.split(":")[0].trim());

	if (topLevelKeys.length === 0) {
		fail(`${rel(skillPath)} frontmatter has no top-level keys (all indented?)`);
		continue;
	}

	if (!topLevelKeys.includes("name")) {
		fail(`${rel(skillPath)} frontmatter is missing 'name'`);
	} else {
		const declared = block.match(/^name:\s*(.+)$/m)?.[1].trim().replace(/^["']|["']$/g, "");
		if (declared !== skill.name) {
			fail(`${rel(skillPath)} declares name '${declared}' but lives in '${skill.name}/'`);
		}
	}

	if (!topLevelKeys.includes("description")) {
		fail(`${rel(skillPath)} frontmatter is missing 'description'`);
	}
}

// --- 3b. Codex interface metadata is named consistently --------------------------
// agents/ is optional, but when present Codex only reads `openai.yaml`. An
// `openai.yml` is not an error anywhere -- it is simply never read. The
// display_name inside is a cosmetic label (upstream skills use title case,
// e.g. "Code Review"), so only the file naming is pinned here.

for (const skill of skills) {
	const agentsDir = join(skill.dir, "agents");
	if (!existsSync(agentsDir)) continue;

	for (const f of readdirSync(agentsDir, { withFileTypes: true })) {
		if (f.isFile() && /^openai\.(yml|yaml)$/.test(f.name) && f.name !== "openai.yaml") {
			fail(`${rel(join(agentsDir, f.name))} must be named 'openai.yaml' — Codex ignores .yml`);
		}
	}
}

// --- 4. Incubation side stays flat ------------------------------------------------
// .agents/skills/ is the project-level incubation spot: one level, SKILL.md
// per directory, project-local loading without installing. Empty is fine.

if (existsSync(incubatorDir)) {
	for (const e of readdirSync(incubatorDir, { withFileTypes: true })) {
		if (!e.isDirectory() || e.name.startsWith(".")) continue;
		if (!existsSync(join(incubatorDir, e.name, "SKILL.md"))) {
			fail(`.agents/skills/${e.name}/SKILL.md missing — an incubating skill that will never load`);
		}
	}
}

// --- 5. The bootstrap source exists ------------------------------------------------

// Bootstrap moved from a skill (skills/using-parking-skills/, removed) to plain
// AGENTS.md injection: hooks/session-start reads the repo-root AGENTS.md on every
// session. Here we only pin that the file the hook depends on actually exists.
if (!existsSync(join(repoRoot, "AGENTS.md"))) {
	fail("AGENTS.md missing at repo root — hooks/session-start has nothing to inject");
}

// --- Report -------------------------------------------------------------------------

if (failures.length > 0) {
	console.error(`FAIL — ${failures.length} problem(s):\n`);
	for (const f of failures) console.error(`  ✗ ${f}`);
	process.exit(1);
}

const countBy = (list, cat) => list.filter((skill) => skill.category === cat).length;
const groups = [...new Set(skills.map((skill) => skill.category))].sort().join(", ");
console.log(
	`PASS — ${skills.length} skills across [${groups}] ` +
		`(matt-skills: ${countBy(skills, "matt-skills")}, deprecated: ${countBy(skills, "deprecated")}, in-progress: ${countBy(skills, "in-progress")}), all categorized with valid frontmatter`
);
