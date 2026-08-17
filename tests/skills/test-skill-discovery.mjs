#!/usr/bin/env node
/**
 * Structural assertions for the .agents/skills/ directory.
 *
 * Skill loading fails SILENTLY on every platform: a skill with a broken
 * frontmatter or at the wrong nesting depth simply never appears, with no error
 * and no warning. These assertions are the only thing standing between a bad
 * commit and a skill quietly vanishing.
 *
 * Run: node tests/skills/test-skill-discovery.mjs
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const skillsDir = join(repoRoot, ".agents", "skills");

const failures = [];
const fail = (msg) => failures.push(msg);

// --- 1. skills/ exists and has direct subdirectories -------------------------

if (!existsSync(skillsDir)) {
	console.error("FATAL: .agents/skills/ does not exist");
	process.exit(1);
}

const entries = readdirSync(skillsDir, { withFileTypes: true });
const looseFiles = entries.filter((e) => e.isFile()).map((e) => e.name);
const skillDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

for (const f of looseFiles) {
	fail(`skills/${f} is a loose file; every skill must be a directory`);
}

if (skillDirs.length === 0) {
	console.error("FATAL: .agents/skills/ contains no subdirectories");
	process.exit(1);
}

// --- 2. Every direct subdirectory has a SKILL.md ------------------------------
// This is the rule that would have caught the mattpocock/ nesting: Claude Code
// and Codex scan skills/ ONE level deep and expect SKILL.md there.

for (const name of skillDirs) {
	const skillPath = join(skillsDir, name, "SKILL.md");
	if (!existsSync(skillPath)) {
		fail(`skills/${name}/SKILL.md missing — this skill will never load`);
	}
}

// --- 3. No SKILL.md is buried deeper than one level --------------------------

function findDeepSkillFiles(dir, depth = 0) {
	const found = [];
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) {
			found.push(...findDeepSkillFiles(p, depth + 1));
		} else if (e.name === "SKILL.md" && depth > 1) {
			found.push(p);
		}
	}
	return found;
}

for (const p of findDeepSkillFiles(skillsDir)) {
	fail(
		`${relative(repoRoot, p).replace(/\\/g, "/")} is nested too deep — ` +
			`platforms only scan skills/<name>/SKILL.md`
	);
}

// --- 4. Frontmatter is parseable and consistent -------------------------------

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;

for (const name of skillDirs) {
	const skillPath = join(skillsDir, name, "SKILL.md");
	if (!existsSync(skillPath)) continue;

	const content = readFileSync(skillPath, "utf8");
	const match = content.match(FRONTMATTER);

	if (!match) {
		fail(
			`skills/${name}/SKILL.md has no closing frontmatter delimiter — ` +
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
		fail(`skills/${name}/SKILL.md frontmatter has no top-level keys (all indented?)`);
		continue;
	}

	if (!topLevelKeys.includes("name")) {
		fail(`skills/${name}/SKILL.md frontmatter is missing 'name'`);
	} else {
		const declared = block.match(/^name:\s*(.+)$/m)?.[1].trim().replace(/^["']|["']$/g, "");
		if (declared !== name) {
			fail(`skills/${name}/SKILL.md declares name '${declared}' but lives in '${name}/'`);
		}
	}

	if (!topLevelKeys.includes("description")) {
		fail(`skills/${name}/SKILL.md frontmatter is missing 'description'`);
	}
}

// --- 4b. Codex interface metadata is named consistently -----------------------
// agents/ is optional, but when present Codex only reads `openai.yaml`. An
// `openai.yml` is not an error anywhere -- it is simply never read.

for (const name of skillDirs) {
	const agentsDir = join(skillsDir, name, "agents");
	if (!existsSync(agentsDir)) continue;

	for (const f of readdirSync(agentsDir, { withFileTypes: true })) {
		if (f.isFile() && /^openai\.(yml|yaml)$/.test(f.name) && f.name !== "openai.yaml") {
			fail(`skills/${name}/agents/${f.name} must be named 'openai.yaml' — Codex ignores .yml`);
		}
	}
	const metadataPath = join(agentsDir, "openai.yaml");
	if (existsSync(metadataPath)) {
		const metadata = readFileSync(metadataPath, "utf8");
		const displayNameMatch = metadata.match(/^\s*display_name:\s*(.+)$/m);
		const displayName = displayNameMatch
			? displayNameMatch[1].trim().replace(/^[\"']|[\"']$/g, "")
			: "";
		if (displayName !== name) {
			fail(`.agents/skills/${name}/agents/openai.yaml display_name must be '${name}', not '${displayName}'`);
		}
	}
}

// --- 5. The bootstrap source exists -------------------------------------------

// Bootstrap moved from a skill (skills/using-parking-skills/, removed) to plain
// AGENTS.md injection: hooks/session-start reads the repo-root AGENTS.md on every
// session. AGENTS.md content conventions are gated by test-artifact-hygiene.mjs;
// here we only pin that the file the hook depends on actually exists.
if (!existsSync(join(repoRoot, "AGENTS.md"))) {
	fail("AGENTS.md missing at repo root — hooks/session-start has nothing to inject");
}

// --- Report -------------------------------------------------------------------

if (failures.length > 0) {
	console.error(`FAIL — ${failures.length} problem(s):\n`);
	for (const f of failures) console.error(`  ✗ ${f}`);
	process.exit(1);
}

console.log(`PASS — ${skillDirs.length} skills, all one level deep with valid frontmatter`);
