// OpenCode plugin for the parking-skills library.
//
// Shape B (in-process bootstrap): OpenCode has no session-start shell hook, so
// this plugin does two things at runtime:
//   1. `config`  -- registers skills/ so OpenCode's native skill tool finds them
//   2. `experimental.chat.messages.transform` -- injects the using-parking-skills
//      bootstrap as the first user message of the conversation
//
// This repo intentionally ships no node_modules, so there is nothing to import
// beyond node builtins.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXTREMELY_IMPORTANT_MARKER = "<EXTREMELY_IMPORTANT>";

const pluginDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(pluginDir, "../..");
const skillsDir = resolve(packageRoot, "skills");
const bootstrapSkillPath = resolve(skillsDir, "using-parking-skills", "SKILL.md");

// Module-level cache: `transform` fires on EVERY agent step, and re-reading
// SKILL.md from disk each time would be pure waste.
let cachedBootstrap;

export default async function parkingSkillsOpenCodePlugin() {
	return {
		config: async (config) => {
			config.skills = config.skills || {};
			config.skills.paths = config.skills.paths || [];
			if (!config.skills.paths.includes(skillsDir)) {
				config.skills.paths.push(skillsDir);
			}
			return config;
		},

		experimental: {
			chat: {
				messages: {
					// NOTE: this fires per agent STEP, not per turn -- there is no
					// lifecycle flag to lean on the way Pi has. The only safe guard is
					// to inspect the messages themselves for an already-injected copy.
					transform: async ({ messages }) => {
						const bootstrap = getBootstrapContent();
						if (!bootstrap) return { messages };

						const firstUser = messages.find((m) => m?.info?.role === "user");
						if (!firstUser) return { messages };

						const alreadyInjected = firstUser.parts?.some(
							(p) => p?.type === "text" && p.text?.includes(EXTREMELY_IMPORTANT_MARKER)
						);
						if (alreadyInjected) return { messages };

						firstUser.parts = firstUser.parts || [];
						firstUser.parts.unshift({ type: "text", text: bootstrap });
						return { messages };
					},
				},
			},
		},
	};
}

function getBootstrapContent() {
	if (cachedBootstrap !== undefined) return cachedBootstrap;

	try {
		const body = stripFrontmatter(readFileSync(bootstrapSkillPath, "utf8"));
		cachedBootstrap = `${EXTREMELY_IMPORTANT_MARKER}
You have the parking skills.

The using-parking-skills skill content is included below and is already loaded for this OpenCode session. Follow it now. Do not try to load using-parking-skills again.

${body}

${openCodeToolMapping()}
</EXTREMELY_IMPORTANT>`;
	} catch {
		cachedBootstrap = null;
	}
	return cachedBootstrap;
}

function stripFrontmatter(content) {
	const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
	return (match ? match[1] : content).trim();
}

// There is no references/opencode-tools.md -- OpenCode's mapping lives here and
// only here, so this is the single source of truth for it.
function openCodeToolMapping() {
	return `## OpenCode tool mapping

Skills speak in actions, not tool names ("dispatch a subagent", "create a todo", "read a file"). On OpenCode these resolve to:

- Read a file → \`read\`
- Create, edit, or delete files → \`apply_patch\`
- Run a shell command → \`bash\`
- Search file contents → \`grep\`
- Find files by name → \`glob\`
- Fetch a URL → \`webfetch\`
- Track tasks ("create a todo", "mark complete") → \`todowrite\`
- Dispatch a subagent (\`Subagent (general-purpose):\` block) → \`task\` with \`subagent_type: "general"\`
- Invoke a skill → OpenCode's native \`skill\` tool

Use OpenCode's native \`skill\` tool to list and load skills. Do not read other SKILL.md files directly with \`read\` -- that bypasses the mechanism.

OpenCode has no interactive question tool. When a skill says to ask your human partner, put the question in your reply and stop; do not guess and continue.

\`cpu-monitor\`, \`ps1-creator\`, and \`dev-environment\` shell out to PowerShell and are Windows-only. On other platforms, say so instead of attempting a translation.`;
}
