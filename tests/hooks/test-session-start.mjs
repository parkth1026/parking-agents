#!/usr/bin/env node
/**
 * Asserts the SessionStart hook emits exactly the JSON shape each platform
 * consumes — and nothing else.
 *
 * Claude Code reads BOTH `additional_context` and `hookSpecificOutput` without
 * deduplication, so emitting more than one field would inject the bootstrap
 * twice. These assertions pin the shape per platform.
 *
 * Run: node tests/hooks/test-session-start.mjs
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const hookPath = join(repoRoot, "hooks", "session-start");

const failures = [];
const fail = (msg) => failures.push(msg);
const check = (cond, msg) => {
	if (!cond) fail(msg);
};

if (!existsSync(hookPath)) {
	console.error(`FATAL: ${hookPath} not found`);
	process.exit(1);
}

// The hook must be extensionless: Claude Code's Windows handling prepends
// `bash` to any command containing `.sh`, causing a double invocation.
check(!hookPath.endsWith(".sh"), "hooks/session-start must not have a .sh extension");

function runHook(env) {
	const out = execFileSync("bash", [hookPath], {
		cwd: repoRoot,
		encoding: "utf8",
		env: { ...process.env, CLAUDE_PLUGIN_ROOT: "", CURSOR_PLUGIN_ROOT: "", COPILOT_CLI: "", ...env },
	});
	return JSON.parse(out);
}

function assertBootstrapContent(ctx, label) {
	check(ctx.includes("<EXTREMELY_IMPORTANT>"), `${label}: missing <EXTREMELY_IMPORTANT> wrapper`);
	check(ctx.includes("You have the parking skills."), `${label}: missing bootstrap preamble`);
	check(
		ctx.includes("Skills speak in actions, not tool names"),
		`${label}: missing the action-vocabulary declaration — the model would expect literal tool names`
	);
	check(
		ctx.includes("Subagent (general-purpose):"),
		`${label}: missing the subagent dispatch template — skills that fan out would have nothing to translate`
	);
	check(
		ctx.includes("Platform Adaptation"),
		`${label}: missing the Platform Adaptation pointer list`
	);
	// No mapping file is appended on this code path: these harnesses expose a
	// tool for every action skills describe.
	check(
		!ctx.includes("# Codex tool mapping") && !ctx.includes("# Pi tool mapping"),
		`${label}: another harness's mapping table leaked into the injection`
	);
}

// --- Claude Code: hookSpecificOutput.additionalContext, nothing else ---------

{
	const j = runHook({ CLAUDE_PLUGIN_ROOT: repoRoot });
	const keys = Object.keys(j);
	check(
		keys.length === 1 && keys[0] === "hookSpecificOutput",
		`Claude Code: expected only 'hookSpecificOutput', got ${JSON.stringify(keys)}`
	);
	check(
		j.hookSpecificOutput?.hookEventName === "SessionStart",
		"Claude Code: hookEventName must be 'SessionStart'"
	);
	check(
		typeof j.hookSpecificOutput?.additionalContext === "string",
		"Claude Code: additionalContext must be a string"
	);
	check(
		!("additional_context" in j),
		"Claude Code: must NOT also emit additional_context (Claude reads both without dedup)"
	);
	assertBootstrapContent(j.hookSpecificOutput?.additionalContext ?? "", "Claude Code");
}

// --- Cursor: top-level additional_context (snake_case) -----------------------
// Cursor sets CURSOR_PLUGIN_ROOT and may ALSO set CLAUDE_PLUGIN_ROOT, so the
// Cursor branch must be tested first in the hook. This case pins that order.

{
	const j = runHook({ CURSOR_PLUGIN_ROOT: repoRoot, CLAUDE_PLUGIN_ROOT: repoRoot });
	const keys = Object.keys(j);
	check(
		keys.length === 1 && keys[0] === "additional_context",
		`Cursor: expected only 'additional_context', got ${JSON.stringify(keys)}`
	);
	assertBootstrapContent(j.additional_context ?? "", "Cursor");
}

// --- Copilot CLI / unknown: top-level additionalContext ----------------------

{
	const j = runHook({ COPILOT_CLI: "1", CLAUDE_PLUGIN_ROOT: repoRoot });
	const keys = Object.keys(j);
	check(
		keys.length === 1 && keys[0] === "additionalContext",
		`Copilot CLI: expected only 'additionalContext', got ${JSON.stringify(keys)}`
	);
	assertBootstrapContent(j.additionalContext ?? "", "Copilot CLI");
}

// --- Report -------------------------------------------------------------------

if (failures.length > 0) {
	console.error(`FAIL — ${failures.length} problem(s):\n`);
	for (const f of failures) console.error(`  ✗ ${f}`);
	process.exit(1);
}

console.log("PASS — session-start emits the correct single field for all 3 platform shapes");
