import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const packageJsonPath = resolve(repoRoot, "package.json");
const extensionPath = resolve(repoRoot, ".pi/extensions/parking-skills.ts");
const piToolsPath = resolve(repoRoot, "skills/using-parking-skills/references/pi-tools.md");

async function loadExtension() {
	const handlers = new Map();
	const pi = {
		on(event, handler) {
			if (!handlers.has(event)) handlers.set(event, []);
			handlers.get(event).push(handler);
		},
	};
	const mod = await import(
		pathToFileURL(extensionPath).href + `?cachebust=${Date.now()}-${Math.random()}`
	);
	mod.default(pi);
	return { handlers };
}

function firstHandler(handlers, event) {
	const eventHandlers = handlers.get(event) ?? [];
	assert.equal(eventHandlers.length, 1, `expected one ${event} handler`);
	return eventHandlers[0];
}

function textOf(message) {
	if (typeof message.content === "string") return message.content;
	return message.content
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("\n");
}

test("package.json declares a pi package with skills and extension resources", async () => {
	const pkg = JSON.parse(await readFile(packageJsonPath, "utf8"));

	assert.equal(pkg.name, "parking-skills");
	assert.equal(pkg.type, "module", "import.meta.url requires ESM");
	assert.ok(pkg.keywords.includes("pi-package"));
	assert.deepEqual(pkg.pi.skills, ["./skills"]);
	assert.deepEqual(pkg.pi.extensions, ["./.pi/extensions/parking-skills.ts"]);
});

test("extension registers the expected lifecycle hooks", async () => {
	const { handlers } = await loadExtension();

	for (const event of [
		"resources_discover",
		"session_start",
		"session_compact",
		"context",
		"agent_end",
	]) {
		assert.equal((handlers.get(event) ?? []).length, 1, `missing ${event} handler`);
	}
});

test("resources_discover contributes the bundled skills directory", async () => {
	const { handlers } = await loadExtension();
	const discover = firstHandler(handlers, "resources_discover");

	const result = await discover({ type: "resources_discover", cwd: repoRoot, reason: "startup" }, {});

	assert.deepEqual(result.skillPaths, [resolve(repoRoot, "skills")]);
});

test("startup context injects the bootstrap as one user message until agent_end", async () => {
	const { handlers } = await loadExtension();
	const sessionStart = firstHandler(handlers, "session_start");
	const context = firstHandler(handlers, "context");
	const agentEnd = firstHandler(handlers, "agent_end");

	await sessionStart({ type: "session_start", reason: "startup" }, {});

	const originalMessages = [
		{ role: "user", content: [{ type: "text", text: "Write me a PowerShell script" }], timestamp: 1 },
	];
	const result = await context({ type: "context", messages: originalMessages }, {});

	assert.equal(result.messages.length, 2);
	assert.equal(result.messages[0].role, "user", "bootstrap must be a user message, not system");
	assert.match(textOf(result.messages[0]), /You have the parking skills/);
	assert.match(textOf(result.messages[0]), /Pi tool mapping/);
	assert.equal(result.messages[1], originalMessages[0]);

	// The alias declaration is the whole point on this platform — without it the
	// model calls the VS Code tool names written in the skill bodies verbatim.
	assert.match(textOf(result.messages[0]), /ALIASES, not real tools/);

	const alreadyInjected = await context({ type: "context", messages: result.messages }, {});
	assert.equal(alreadyInjected, undefined, "bootstrap must not duplicate when already present");

	await agentEnd({ type: "agent_end", messages: [] }, {});
	const afterEnd = await context({ type: "context", messages: originalMessages }, {});
	assert.equal(afterEnd, undefined, "startup bootstrap should clear after agent_end");
});

test("session_compact injects bootstrap after compaction summaries", async () => {
	const { handlers } = await loadExtension();
	const sessionCompact = firstHandler(handlers, "session_compact");
	const context = firstHandler(handlers, "context");

	await sessionCompact({ type: "session_compact", compactionEntry: {}, fromExtension: false }, {});

	const summary = { role: "compactionSummary", summary: "Prior work", tokensBefore: 123, timestamp: 1 };
	const user = { role: "user", content: [{ type: "text", text: "Continue" }], timestamp: 2 };
	const result = await context({ type: "context", messages: [summary, user] }, {});

	assert.equal(result.messages.length, 3);
	assert.equal(result.messages[0], summary, "summary must stay first");
	assert.equal(result.messages[1].role, "user");
	assert.match(textOf(result.messages[1]), /You have the parking skills/);
	assert.equal(result.messages[2], user);
});

test("pi-tools.md and the inlined piToolMapping() stay in sync", async () => {
	// The Pi mapping lives in two places: this reference file (which a human or
	// a non-pi agent reads) and piToolMapping() inside the extension (which is
	// what actually gets injected). Drift between them is silent, so assert the
	// load-bearing mappings appear in both.
	assert.equal(existsSync(piToolsPath), true, "pi-tools.md should exist");
	const doc = await readFile(piToolsPath, "utf8");

	const { handlers } = await loadExtension();
	const sessionStart = firstHandler(handlers, "session_start");
	const context = firstHandler(handlers, "context");
	await sessionStart({ type: "session_start", reason: "startup" }, {});
	const injected = textOf(
		(await context({ type: "context", messages: [{ role: "user", content: [], timestamp: 1 }] }, {}))
			.messages[0]
	);

	const rows = doc.split("\n").filter((line) => line.startsWith("|"));
	assert.ok(rows.length > 5, "pi-tools.md should still contain a mapping table");

	for (const [alias, piTool] of [
		["read_file", "read"],
		["run_in_terminal", "bash"],
		["grep_search", "grep"],
	]) {
		assert.ok(
			rows.some((row) => row.includes(alias) && row.includes(`\`${piTool}\``)),
			`pi-tools.md table should map ${alias} → ${piTool}`
		);
		assert.ok(
			injected.includes(alias) && injected.includes(`\`${piTool}\``),
			`injected mapping should cover ${alias} → ${piTool}`
		);
	}

	for (const topic of [/subagent/i, /todo|TODO\.md/]) {
		assert.match(doc, topic, "pi-tools.md should document this degradation");
		assert.match(injected, topic, "injected mapping should document this degradation");
	}
});
