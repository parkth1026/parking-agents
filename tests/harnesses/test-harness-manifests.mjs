#!/usr/bin/env node
/**
 * Doc-contract tests for every harness integration.
 *
 * Most of these platforms cannot be installed or driven from this machine, so
 * there is no e2e test to write. What CAN be pinned is the contract: the
 * manifest declares the fields the harness reads, the bootstrap points at files
 * that actually exist, and the tool mapping names the tools that platform
 * actually has. A broken integration otherwise fails silently -- the skills sit
 * on disk and are never invoked, with no error anywhere.
 *
 * Run: node --test tests/harnesses/test-harness-manifests.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const readJSON = (rel) => JSON.parse(readFileSync(join(repoRoot, rel), "utf8"));
const readText = (rel) => readFileSync(join(repoRoot, rel), "utf8");

// --- Cursor (Shape A: shell hook, own hook schema) ---------------------------

test("Cursor manifest declares skills and its own hook file", () => {
	const m = readJSON(".cursor-plugin/plugin.json");
	assert.equal(m.name, "parking-skills");
	assert.equal(m.skills, "./skills/");
	assert.equal(
		m.hooks,
		"./hooks/hooks-cursor.json",
		"Cursor must point at hooks-cursor.json, not the Claude Code hooks.json"
	);
	assert.ok(existsSync(join(repoRoot, "hooks", "hooks-cursor.json")));
});

test("Cursor hook config uses Cursor's schema, not Claude Code's", () => {
	const h = readJSON("hooks/hooks-cursor.json");
	// Cursor: { version, hooks: { sessionStart: [{ command }] } }
	// Claude Code: { hooks: { SessionStart: [{ matcher, hooks: [{ type, command }] }] } }
	assert.equal(h.version, 1, "Cursor hook config requires a top-level version");
	assert.ok(Array.isArray(h.hooks?.sessionStart), "Cursor uses camelCase 'sessionStart'");
	assert.match(h.hooks.sessionStart[0].command, /run-hook\.cmd session-start/);
	assert.equal(h.hooks.SessionStart, undefined, "PascalCase SessionStart is Claude Code's key");
});

// --- Gemini CLI (Shape C: instructions file) ---------------------------------

test("Gemini extension points at a context file that exists", () => {
	const m = readJSON("gemini-extension.json");
	assert.equal(m.name, "parking-skills");
	assert.equal(m.contextFileName, "GEMINI.md");
	assert.ok(existsSync(join(repoRoot, "GEMINI.md")));
});

test("GEMINI.md @-includes resolve to real files", () => {
	// The bootstrap skill and its gemini-tools.md mapping were removed in
	// 048efac; GEMINI.md now carries the repo conventions via @AGENTS.md. What
	// stays load-bearing: every @-include must resolve, because a dangling one
	// loads EMPTY, silently.
	const lines = readText("GEMINI.md")
		.split(/\r?\n/)
		.filter((l) => l.trim().startsWith("@"));

	assert.ok(lines.length >= 1, "GEMINI.md should @-include at least the repo conventions");

	for (const line of lines) {
		// Gemini accepts `@AGENTS.md`, `@./AGENTS.md`, and `@/abs/path` forms.
		const rel = line.trim().replace(/^@(\.\/)?/, "");
		assert.ok(
			existsSync(join(repoRoot, rel)),
			`GEMINI.md includes '${rel}' which does not exist — Gemini would load nothing`
		);
	}
});

// --- Kimi Code (skills + inline mapping; no session-start skill since 048efac) --

test("Kimi manifest declares skills, no ghost bootstrap, and an inline mapping", () => {
	const m = readJSON(".kimi-plugin/plugin.json");
	assert.equal(m.skills, "./skills/");
	// The bootstrap skill was removed in 048efac. A sessionStart.skill pointing
	// at a skill that is not on disk bootstraps NOTHING, silently — so if the
	// field exists at all, it must resolve.
	if (m.sessionStart?.skill) {
		assert.ok(
			existsSync(join(repoRoot, "skills", m.sessionStart.skill, "SKILL.md")),
			"sessionStart.skill must name a skill that exists"
		);
	}

	const instr = m.skillInstructions;
	assert.equal(typeof instr, "string");
	assert.ok(instr.length > 200, "skillInstructions carries Kimi's entire tool mapping");
	assert.match(instr, /Subagent \(general-purpose\):/);
	assert.match(instr, /TodoList/, "Kimi's todo tool is TodoList");
	assert.match(instr, /AskUserQuestion/);
	assert.match(
		instr,
		/Do NOT pass `general-purpose` as `subagent_type`/,
		"Kimi rejects general-purpose as a subagent type — the mapping must say so"
	);
});

// --- OpenCode (Shape B: in-process, mapping inline in the plugin) ------------

test("package.json main resolves to the OpenCode plugin", () => {
	const pkg = readJSON("package.json");
	assert.equal(pkg.main, ".opencode/plugins/parking-skills.js");
	assert.ok(existsSync(join(repoRoot, pkg.main)), "OpenCode resolves its entry point from main");
});

test("OpenCode plugin registers skills and injects a deduped user message", async () => {
	const mod = await import(
		new URL("../../.opencode/plugins/parking-skills.js", import.meta.url).href
	);
	const plugin = await mod.default();

	// 1. skills directory registration
	const config = await plugin.config({});
	assert.ok(
		config.skills.paths.some((p) => p.replace(/\\/g, "/").endsWith("/skills")),
		"config hook must push the skills dir so OpenCode's skill tool finds them"
	);
	// Idempotent: `config` may fire more than once.
	const again = await plugin.config(config);
	assert.equal(again.skills.paths.length, 1, "config hook must not duplicate the skills path");

	// 2. bootstrap injection into the first user message
	const transform = plugin.experimental.chat.messages.transform;
	const messages = [{ info: { role: "user" }, parts: [{ type: "text", text: "hello" }] }];
	const out = await transform({ messages });
	const injected = out.messages[0].parts[0].text;

	assert.match(injected, /<EXTREMELY_IMPORTANT>/);
	assert.match(injected, /Skills speak in actions, not tool names/);
	assert.match(injected, /OpenCode tool mapping/);
	assert.match(injected, /todowrite/, "task tracking must resolve to todowrite");
	assert.match(injected, /subagent_type: "general"/, "OpenCode uses 'general', not 'general-purpose'");
	assert.equal(out.messages[0].parts[1].text, "hello", "original content must be preserved");

	// 3. dedup -- transform fires on EVERY agent step, not once per turn
	const twice = await transform({ messages: out.messages });
	assert.equal(
		twice.messages[0].parts.length,
		2,
		"a second transform pass must not inject the bootstrap again"
	);
});

// --- Cross-runtime marketplace ------------------------------------------------

test(".agents marketplace entry is well formed", () => {
	const m = readJSON(".agents/plugins/marketplace.json");
	assert.equal(m.plugins[0].name, "parking-skills");
	assert.equal(m.plugins[0].source.source, "url");
	assert.equal(m.plugins[0].policy.installation, "AVAILABLE");
});

// --- Every versioned manifest is registered for lockstep bumping -------------

test("every manifest carrying a version is registered in .version-bump.json", () => {
	const registered = new Set(readJSON(".version-bump.json").files.map((f) => f.path));
	const versioned = [
		"package.json",
		".claude-plugin/plugin.json",
		".codex-plugin/plugin.json",
		".cursor-plugin/plugin.json",
		".kimi-plugin/plugin.json",
		"gemini-extension.json",
	];
	for (const path of versioned) {
		assert.ok(
			registered.has(path),
			`${path} has a version field but is not in .version-bump.json — it would ship stale`
		);
	}
});
