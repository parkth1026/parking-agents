#!/usr/bin/env node
/**
 * Portable structural checker for a cross-platform skill repository.
 *
 * Every failure this catches is SILENT on real harnesses: a skill with indented
 * frontmatter, or buried one level too deep, or naming a tool that only one
 * platform has, simply never fires. No error, no warning, no log line. This
 * script is what turns those into loud failures.
 *
 * Repo-agnostic on purpose -- point it at any skills repo, not just this one.
 *
 * Usage:
 *   node check-skill-repo.mjs [repoRoot]
 *   node check-skill-repo.mjs /path/to/repo --bootstrap using-my-skills
 *   node check-skill-repo.mjs /path/to/repo --skills skills/engineering
 *   node check-skill-repo.mjs . --allow skills/tool-converter/,skills/x/references/
 *   node check-skill-repo.mjs . --json
 *
 * Exit code 1 if any check FAILS. WARNs do not fail the run.
 */

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve, relative } from "node:path";

// --- args --------------------------------------------------------------------

const argv = process.argv.slice(2);
const VALUE_FLAGS = new Set(["bootstrap", "allow", "skills"]);

const flag = (name) => {
	const i = argv.indexOf(`--${name}`);
	return i === -1 ? undefined : argv[i + 1];
};
const has = (name) => argv.includes(`--${name}`);

const positional = argv.filter((a, i) => {
	if (a.startsWith("--")) return false;
	const prev = argv[i - 1];
	return !(prev?.startsWith("--") && VALUE_FLAGS.has(prev.slice(2)));
});

const repoRoot = resolve(positional[0] ?? ".");
// Not every repo puts its skills at <root>/skills. A repo may group them
// (skills/engineering/<name>/SKILL.md) with the real scan root one level down,
// where its installer actually points. Guessing wrong makes every per-skill
// check examine zero skills.
const skillsDir = flag("skills") ? resolve(repoRoot, flag("skills")) : join(repoRoot, "skills");
const asJson = has("json");
const allowExtra = (flag("allow") ?? "").split(",").filter(Boolean);

// Tool names that must never appear in a skill body. Grouped by the harness
// whose vocabulary they belong to, so the failure message can say which.
const DENIED = {
	"VS Code Copilot": ["read_file", "create_file", "replace_string_in_file", "multi_replace_string_in_file",
		"run_in_terminal", "grep_search", "file_search", "list_dir", "manage_todo_list", "runSubagent",
		"vscode_askQuestions", "fetch_webpage", "get_errors"],
	"Claude Code": ["TodoWrite", "TodoRead", "MultiEdit", "subagent_type", "Agent tool", "Task tool",
		"Skill tool", "AskUserQuestion", "WebFetch", "WebSearch"],
	Gemini: ["read_many_files", "run_shell_command", "list_directory", "google_web_search", "activate_skill",
		"invoke_agent", "write_todos"],
	Other: ["spawn_agent", "invoke_subagent", "apply_patch", "todowrite", "webfetch", "write_to_file",
		"replace_file_content"],
};

// Manifests a cross-platform skill plugin may carry, and the harness each serves.
const MANIFESTS = [
	["package.json", "Pi / OpenCode", "version"],
	[".claude-plugin/plugin.json", "Claude Code", "version"],
	[".claude-plugin/marketplace.json", "Claude Code marketplace", "plugins.0.version"],
	[".codex-plugin/plugin.json", "Codex", "version"],
	[".cursor-plugin/plugin.json", "Cursor", "version"],
	[".kimi-plugin/plugin.json", "Kimi Code", "version"],
	["gemini-extension.json", "Gemini CLI", "version"],
];

// --- result collection --------------------------------------------------------

const results = [];
const record = (status, check, detail) => results.push({ status, check, detail });
const pass = (c, d = "") => record("PASS", c, d);
const fail = (c, d) => record("FAIL", c, d);
const warn = (c, d) => record("WARN", c, d);
const skip = (c, d) => record("SKIP", c, d);

const rel = (p) => relative(repoRoot, p).replace(/\\/g, "/");
const readJSON = (p) => JSON.parse(readFileSync(p, "utf8"));
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
const stripFrontmatter = (s) => s.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/)?.[1] ?? s;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function walk(dir, filter, depth = 0) {
	const out = [];
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) out.push(...walk(p, filter, depth + 1));
		else if (filter(e.name, depth)) out.push(p);
	}
	return out;
}

// --- 0. repo shape ------------------------------------------------------------

if (!existsSync(skillsDir) || !statSync(skillsDir).isDirectory()) {
	console.error(`FATAL: ${rel(skillsDir)} does not exist — this is not a skills repo`);
	process.exit(1);
}

const entries = readdirSync(skillsDir, { withFileTypes: true });
const skillDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
const looseFiles = entries.filter((e) => e.isFile()).map((e) => e.name);

// Only stray .md matters. A bundle root legitimately carries a README, an
// installer, and a manifest beside the skill directories; a stray .md is the
// real smell -- a skill someone forgot to give a directory.
const strayMarkdown = looseFiles.filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md");
if (strayMarkdown.length) fail("no stray markdown beside the skill directories", strayMarkdown.join(", "));
else pass("no stray markdown beside the skill directories");

// --- 1. flat layout — the #1 silent killer -----------------------------------
// Every harness scans skills/<name>/SKILL.md exactly ONE level deep. A skill at
// skills/category/name/SKILL.md loads nowhere, and nothing reports it.

// A directory holding no markdown at all is shared tooling (scripts/, assets/),
// not a skill that lost its SKILL.md. Only flag dirs that look like skills.
const looksLikeSkill = (n) =>
	walk(join(skillsDir, n), (f) => f.endsWith(".md")).length > 0;
const missing = skillDirs.filter((n) => !existsSync(join(skillsDir, n, "SKILL.md")) && looksLikeSkill(n));
if (missing.length) fail("every skill dir has SKILL.md", `missing in: ${missing.join(", ")}`);
else pass("every skill dir has SKILL.md", `${skillDirs.filter(looksLikeSkill).length} skill dir(s)`);

const deep = walk(skillsDir, (name, depth) => name === "SKILL.md" && depth > 1);
if (deep.length) fail("no SKILL.md nested deeper than one level", deep.map(rel).join(", "));
else pass("no SKILL.md nested deeper than one level");

// --- 2. frontmatter — the #2 silent killer -----------------------------------
// Indent the keys and YAML never closes the mapping; the whole skill vanishes.

const frontmatterProblems = [];
const bootstrapCandidates = [];
let frontmatterExamined = 0;

for (const name of skillDirs) {
	const p = join(skillsDir, name, "SKILL.md");
	if (!existsSync(p)) continue;
	frontmatterExamined++;
	const content = readFileSync(p, "utf8");
	const m = content.match(FRONTMATTER);

	if (!m) {
		frontmatterProblems.push(`${name}: no closing '---' (indented keys or indented delimiter?)`);
		continue;
	}
	const keys = m[1].split(/\r?\n/).filter((l) => /^[A-Za-z_-]+\s*:/.test(l)).map((l) => l.split(":")[0].trim());

	if (!keys.length) frontmatterProblems.push(`${name}: no unindented top-level keys`);
	if (!keys.includes("description")) frontmatterProblems.push(`${name}: missing 'description'`);
	if (!keys.includes("name")) {
		frontmatterProblems.push(`${name}: missing 'name'`);
	} else {
		const declared = m[1].match(/^name:\s*(.+)$/m)?.[1].trim().replace(/^["']|["']$/g, "");
		if (declared !== name) frontmatterProblems.push(`${name}: declares name '${declared}'`);
	}
	if (/^using-/.test(name)) bootstrapCandidates.push(name);
}

// A check that examined nothing must never report PASS -- a silent no-op is the
// exact failure class this tool exists to surface.
if (frontmatterProblems.length) fail("frontmatter parses and name matches dir", frontmatterProblems.join("; "));
else if (!frontmatterExamined) fail("frontmatter parses and name matches dir",
	`0 skills examined — no SKILL.md directly under ${rel(skillsDir)}/*/. Wrong scan root? Try --skills <dir>`);
else pass("frontmatter parses and name matches dir", `${frontmatterExamined} examined`);

// --- 3. action language — invariant #1 ---------------------------------------

// Detecting the bootstrap by name alone is unreliable: a repo can hold several
// `using-*` skills (using-git-worktrees, using-superpowers) and alphabetical
// order picks the wrong one. Ask the wiring instead -- whatever the injectors
// actually read IS the bootstrap -- and fall back to name heuristics.
function detectBootstrap() {
	const explicit = flag("bootstrap");
	if (explicit) return explicit;

	const injectors = [
		"hooks/session-start",
		...(existsSync(join(repoRoot, ".pi", "extensions")) ? walk(join(repoRoot, ".pi", "extensions"), () => true).map(rel) : []),
		...(existsSync(join(repoRoot, ".opencode", "plugins")) ? walk(join(repoRoot, ".opencode", "plugins"), () => true).map(rel) : []),
		"GEMINI.md",
		".kimi-plugin/plugin.json",
	];
	for (const f of injectors) {
		const p = join(repoRoot, f);
		if (!existsSync(p)) continue;
		const src = readFileSync(p, "utf8");
		const named = src.match(/skills[/\\]([a-z0-9-]+)[/\\]SKILL\.md/)?.[1]
			?? src.match(/"skill"\s*:\s*"([a-z0-9-]+)"/)?.[1];
		if (named && skillDirs.includes(named)) return named;
	}

	// Last resort: the `using-*` skill that actually carries a mapping pointer.
	const withAdaptation = bootstrapCandidates.find((n) =>
		/Platform Adaptation/i.test(readFileSync(join(skillsDir, n, "SKILL.md"), "utf8")));
	return withAdaptation ?? bootstrapCandidates[0];
}

const bootstrap = detectBootstrap();
const allowPrefixes = [
	...(bootstrap ? [`skills/${bootstrap}/references/`] : []),
	...allowExtra,
];

const toolNameHits = [];
for (const file of walk(skillsDir, (n) => n.endsWith(".md"))) {
	const r = rel(file);
	if (allowPrefixes.some((p) => r.startsWith(p))) continue;

	stripFrontmatter(readFileSync(file, "utf8")).split(/\r?\n/).forEach((line, i) => {
		for (const [harness, names] of Object.entries(DENIED)) {
			for (const n of names) {
				if (new RegExp(`(^|[^\\w-])${escapeRe(n)}([^\\w-]|$)`).test(line)) {
					toolNameHits.push(`${r}:${i + 1} → ${harness} tool '${n}'`);
				}
			}
		}
	});
}

if (toolNameHits.length) {
	fail("skill bodies name actions, not tools",
		`${toolNameHits.length} hit(s): ${toolNameHits.slice(0, 8).join("; ")}${toolNameHits.length > 8 ? " …" : ""}`);
} else {
	pass("skill bodies name actions, not tools",
		allowPrefixes.length ? `allowlisted: ${allowPrefixes.join(", ")}` : "");
}

// --- 4. bootstrap skill -------------------------------------------------------
// Without a bootstrap the skills are inert: present on disk, never invoked.

if (!bootstrap) {
	fail("a bootstrap skill exists", "no skills/using-* found — pass --bootstrap <name> if it is named differently");
} else if (!skillDirs.includes(bootstrap)) {
	fail("a bootstrap skill exists", `skills/${bootstrap}/ not found`);
} else {
	const body = readFileSync(join(skillsDir, bootstrap, "SKILL.md"), "utf8");
	pass("a bootstrap skill exists", `skills/${bootstrap}/`);

	const hasAdaptation = /Platform Adaptation/i.test(body);
	if (hasAdaptation) pass("bootstrap has a Platform Adaptation section");
	else warn("bootstrap has a Platform Adaptation section", "harnesses needing a mapping have no way to find it");

	const refDir = join(skillsDir, bootstrap, "references");

	// The harness-neutral dispatch template may be defined in the bootstrap or
	// in the mapping files -- either way the model meets it before it needs it.
	const DISPATCH = /Subagent \(general-purpose\):/;
	const inRefs = existsSync(refDir)
		&& readdirSync(refDir).some((f) => DISPATCH.test(readFileSync(join(refDir, f), "utf8")));
	if (DISPATCH.test(body)) pass("the subagent dispatch template is defined", "in the bootstrap");
	else if (inRefs) pass("the subagent dispatch template is defined", "in the mapping files");
	else warn("the subagent dispatch template is defined",
		"skills that fan out have no harness-neutral form to emit");

	// Count only harness MAPPING pointers. A bootstrap may reference plenty of
	// content files (protocol.md, style guides); counting those would report a
	// pass on a repo that has no tool mapping at all.
	const pointers = [...new Set([...body.matchAll(/references\/([a-z0-9-]+-tools\.md)/g)].map((m) => m[1]))];
	const onDisk = existsSync(refDir) ? readdirSync(refDir).filter((f) => f.endsWith("-tools.md")) : [];
	const broken = pointers.filter((f) => !existsSync(join(refDir, f)));

	if (broken.length) fail("harness mapping pointers resolve", `missing: ${broken.join(", ")}`);
	else if (pointers.length) pass("harness mapping pointers resolve", `${pointers.length} mapping file(s)`);
	else if (onDisk.length) warn("harness mapping pointers resolve",
		`${onDisk.length} mapping file(s) on disk but none pointed at from the bootstrap`);
	else if (hasAdaptation) warn("harness mapping pointers resolve", "adaptation section names no mapping file");
	else skip("harness mapping pointers resolve", "no harness mapping files (*-tools.md) in this repo");
}

// --- 5. manifests and version lockstep ---------------------------------------

const present = MANIFESTS.filter(([p]) => existsSync(join(repoRoot, p)));
if (!present.length) {
	warn("at least one harness manifest exists", "no plugin manifest found — skills cannot be installed anywhere");
} else {
	pass("harness manifests present", present.map(([, h]) => h).join(", "));
}

const versions = new Map();
for (const [p, harness, field] of present) {
	try {
		const json = readJSON(join(repoRoot, p));
		const v = field.split(".").reduce((o, k) => o?.[k], json);
		if (v) versions.set(p, { v, harness });
	} catch (e) {
		fail(`${p} is valid JSON`, e.message);
	}
}

const distinct = new Set([...versions.values()].map((x) => x.v));
if (distinct.size > 1) {
	fail("all manifests agree on one version",
		[...versions].map(([p, x]) => `${p}=${x.v}`).join(", "));
} else if (distinct.size === 1) {
	pass("all manifests agree on one version", `${[...distinct][0]}`);
}

const bumpPath = join(repoRoot, ".version-bump.json");
if (!existsSync(bumpPath)) {
	warn("versioned manifests are registered for lockstep bumping",
		"no .version-bump.json — manifests will drift and ship stale versions");
} else {
	const registered = new Set(readJSON(bumpPath).files.map((f) => f.path));
	const unregistered = [...versions.keys()].filter((p) => !registered.has(p));
	if (unregistered.length) fail("versioned manifests are registered for lockstep bumping", unregistered.join(", "));
	else pass("versioned manifests are registered for lockstep bumping", `${registered.size} registered`);
}

// --- 6. hook wiring -----------------------------------------------------------

const hookScript = join(repoRoot, "hooks", "session-start");
if (!existsSync(hookScript)) {
	skip("session-start hook", "no hooks/session-start — fine if every harness uses in-process or manifest bootstrap");
} else {
	pass("session-start hook exists");

	// A .sh extension makes Claude Code prepend `bash` on Windows -> double run.
	if (existsSync(`${hookScript}.sh`)) fail("hook script is extensionless", "hooks/session-start.sh causes double invocation on Windows");
	else pass("hook script is extensionless");

	// Claude Code reads additional_context AND hookSpecificOutput without dedup,
	// so the script must branch, never emit both.
	const src = readFileSync(hookScript, "utf8");
	const fields = ["additional_context", "hookSpecificOutput", "additionalContext"].filter((f) => src.includes(f));
	if (fields.length >= 2 && !/\bif\b|\belif\b/.test(src)) {
		fail("hook emits one context field per platform", "multiple fields with no branching — bootstrap injects twice");
	} else if (fields.length) {
		pass("hook emits one context field per platform", fields.join(" / "));
	}
}

const claudeHooks = join(repoRoot, "hooks", "hooks.json");
const cursorHooks = join(repoRoot, "hooks", "hooks-cursor.json");
if (existsSync(claudeHooks) && existsSync(cursorHooks)) {
	// The two schemas differ in more than the filename; mixing them means the
	// hook never fires and every skill stays silent.
	const c = readJSON(claudeHooks);
	const u = readJSON(cursorHooks);
	const ok = c.hooks?.SessionStart && u.hooks?.sessionStart && u.version !== undefined;
	if (ok) pass("Cursor and Claude Code hook schemas are not confused");
	else fail("Cursor and Claude Code hook schemas are not confused",
		"Claude Code needs hooks.SessionStart (PascalCase); Cursor needs version + hooks.sessionStart (camelCase)");
}

// --- 7. Gemini instructions file ---------------------------------------------

const geminiCtx = join(repoRoot, "GEMINI.md");
if (existsSync(join(repoRoot, "gemini-extension.json")) && existsSync(geminiCtx)) {
	// A dangling @-include loads EMPTY, silently. The bootstrap just never arrives.
	const includes = readFileSync(geminiCtx, "utf8").split(/\r?\n/)
		.filter((l) => l.trim().startsWith("@"))
		.map((l) => l.trim().replace(/^@\.?\//, ""));
	const dangling = includes.filter((p) => !existsSync(join(repoRoot, p)));
	if (dangling.length) fail("GEMINI.md @-includes resolve", `${dangling.join(", ")} — loads empty, silently`);
	else if (includes.length) pass("GEMINI.md @-includes resolve", `${includes.length} include(s)`);
	else fail("GEMINI.md @-includes resolve", "no @-includes — nothing is loaded");
}

// --- 8. Codex interface metadata naming --------------------------------------

const badYml = [];
let agentsDirsSeen = 0;
for (const name of skillDirs) {
	const agentsDir = join(skillsDir, name, "agents");
	if (!existsSync(agentsDir)) continue;
	agentsDirsSeen++;
	for (const f of readdirSync(agentsDir)) {
		if (/^openai\.yml$/.test(f)) badYml.push(`${rel(agentsDir)}/openai.yml`);
	}
}
if (badYml.length) fail("Codex metadata is named openai.yaml", `${badYml.join(", ")} — Codex ignores .yml`);
else if (agentsDirsSeen) pass("Codex metadata is named openai.yaml", `${agentsDirsSeen} skill(s) carry agents/`);
else skip("Codex metadata is named openai.yaml", "no skill declares agents/ metadata");

// --- report -------------------------------------------------------------------

if (asJson) {
	console.log(JSON.stringify({ repoRoot, results }, null, 2));
} else {
	const icon = { PASS: "✓", FAIL: "✗", WARN: "!", SKIP: "-" };
	console.log(`\nSkill repo structure — ${repoRoot}\n`);
	for (const r of results) {
		console.log(`  ${icon[r.status]} ${r.check}${r.detail ? `\n      ${r.detail}` : ""}`);
	}
	const n = (s) => results.filter((r) => r.status === s).length;
	console.log(`\n  ${n("PASS")} passed, ${n("FAIL")} failed, ${n("WARN")} warnings, ${n("SKIP")} skipped\n`);
}

process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
