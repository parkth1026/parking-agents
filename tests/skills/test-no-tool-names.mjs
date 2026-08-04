#!/usr/bin/env node
/**
 * Invariant #1: skill bodies name ACTIONS, never tools.
 *
 * A skill body that says "use the Agent tool" or "call read_file" is correct on
 * exactly one harness and silently wrong on the other seven -- the model either
 * invents a tool call that does not exist, or refuses because it cannot find the
 * named tool. Neither failure is visible until someone runs that skill on that
 * platform.
 *
 * The fix for a missing capability is ALWAYS a line in
 * skills/using-parking-skills/references/<harness>-tools.md, never an edit to a
 * skill body. This test is what keeps that true.
 *
 * Run: node tests/skills/test-no-tool-names.mjs
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const skillsDir = join(repoRoot, "skills");

// Tool names that must not appear in a skill body, grouped by the harness whose
// vocabulary they belong to.
const DENIED = {
	"VS Code Copilot": [
		"read_file",
		"create_file",
		"replace_string_in_file",
		"multi_replace_string_in_file",
		"run_in_terminal",
		"grep_search",
		"file_search",
		"list_dir",
		"manage_todo_list",
		"runSubagent",
		"vscode_askQuestions",
		"fetch_webpage",
		"get_errors",
	],
	"Claude Code": [
		"TodoWrite",
		"TodoRead",
		"MultiEdit",
		"subagent_type",
		"Agent tool",
		"Task tool",
		"Skill tool",
		"AskUserQuestion",
		"WebFetch",
		"WebSearch",
	],
	Other: [
		"spawn_agent",
		"invoke_agent",
		"invoke_subagent",
		"activate_skill",
		"write_todos",
		"apply_patch",
		"todowrite",
		"webfetch",
		"read_many_files",
		"run_shell_command",
		"list_directory",
		"google_web_search",
		"write_to_file",
		"replace_file_content",
	],
};

// Paths (repo-relative, forward slashes) exempt from the rule, and why.
//
// The bundled checker (skills/making-skills-cross-platform/scripts/check-skill-repo.mjs)
// applies the same invariant via its --allow flag. It auto-allows the bootstrap's
// own references/ (using-parking-skills), so only the two non-bootstrap exemptions
// below are duplicated as --allow in package.json's check:repo script. Keep both
// in sync when you add or remove an exemption.
const ALLOWLIST = [
	// The tool-name conversion table IS this skill's subject matter.
	// Also passed to the checker as --allow in package.json.
	"skills/claude-to-vscode-skill-converter/",
	// The adapter layer itself -- naming real tools is the entire point.
	// Auto-allowed by the checker (bootstrap references).
	"skills/using-parking-skills/references/",
	// The porting blueprint: telling a porter which tool each harness exposes
	// IS the deliverable. Its SKILL.md is still held to the rule.
	// Also passed to the checker as --allow in package.json.
	"skills/making-skills-cross-platform/references/",
];

const failures = [];

for (const file of collectMarkdown(skillsDir)) {
	const rel = relative(repoRoot, file).replace(/\\/g, "/");
	if (ALLOWLIST.some((prefix) => rel.startsWith(prefix))) continue;

	// `allowed-tools: Bash(...)` in frontmatter is native platform syntax, not a
	// body instruction -- strip frontmatter before scanning.
	const lines = stripFrontmatter(readFileSync(file, "utf8")).split(/\r?\n/);

	lines.forEach((line, i) => {
		for (const [harness, names] of Object.entries(DENIED)) {
			for (const name of names) {
				const pattern = new RegExp(`(^|[^\\w-])${escapeRegExp(name)}([^\\w-]|$)`);
				if (pattern.test(line)) {
					failures.push(
						`${rel}:${i + 1} names the ${harness} tool '${name}' — ` +
							`describe the action instead, and map it in references/<harness>-tools.md`
					);
				}
			}
		}
	});
}

function collectMarkdown(dir) {
	const found = [];
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) found.push(...collectMarkdown(p));
		else if (e.name.endsWith(".md")) found.push(p);
	}
	return found;
}

function stripFrontmatter(content) {
	const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
	return match ? match[1] : content;
}

function escapeRegExp(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

if (failures.length > 0) {
	console.error(`FAIL — ${failures.length} tool name(s) in skill bodies:\n`);
	for (const f of failures) console.error(`  ✗ ${f}`);
	process.exit(1);
}

console.log("PASS — no harness tool names in skill bodies");
