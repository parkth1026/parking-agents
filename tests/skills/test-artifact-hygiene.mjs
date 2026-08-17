#!/usr/bin/env node
/**
 * Invariant: run-generated artifacts never litter the repo root.
 *
 * Audit/eval/analysis runs used to mkdir `<name>-<date>/` directories (or drop
 * dated report files) at the repo root. The standard location for generated,
 * not-committed reports is docs/reports/<name>-<date>/ (see AGENTS.md); agents
 * that skip reading AGENTS.md get caught here instead of by code review.
 *
 * Run: node tests/skills/test-artifact-hygiene.mjs
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const failures = [];

// 1) No repo-root entry may carry an ISO date in its name -- no legit repo
//    path does, and every past offender (skill-audit-2026-08-16/, xxx-report
//    -2026-08-16.md) did.
const dated = readdirSync(repoRoot, { withFileTypes: true })
	.map((e) => e.name)
	.filter((name) => /-20\d{2}-\d{2}-\d{2}/.test(name));
if (dated.length > 0) {
	failures.push(
		`repo root has dated artifact entries (move them to docs/reports/<name>-<date>/): ${dated.join(", ")}`
	);
}

// 2) The convention file must exist and actually name the standard location.
try {
	const agents = readFileSync(join(repoRoot, "AGENTS.md"), "utf8");
	if (!agents.includes("docs/reports")) {
		failures.push("AGENTS.md exists but does not name docs/reports/ as the report location");
	}
} catch {
	failures.push("AGENTS.md is missing — it is the repo-wide artifact-location convention");
}

// 3) The standard location must stay gitignored, or reports will pollute
//    `git status` the same way the root litter did.
const gitignore = readFileSync(join(repoRoot, ".gitignore"), "utf8");
if (!/^\/?docs\/reports\/$/m.test(gitignore)) {
	failures.push(".gitignore no longer ignores docs/reports/");
}

if (failures.length > 0) {
	console.error(`FAIL — artifact hygiene:\n`);
	for (const f of failures) console.error(`  ✗ ${f}`);
	process.exit(1);
}

console.log("PASS — no dated artifacts at repo root; convention anchors in place");
