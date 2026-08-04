// Types for `node:*` and `@earendil-works/pi-coding-agent` are supplied by the pi
// runtime when it loads this extension. This repo intentionally ships no
// node_modules or tsconfig, so an editor opening this file standalone will report
// unresolved imports — that is expected and does not affect the extension.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const EXTREMELY_IMPORTANT_MARKER = "<EXTREMELY_IMPORTANT>";
const BOOTSTRAP_MARKER = "parking-skills:using-parking-skills bootstrap for pi";

const extensionDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(extensionDir, "../..");
const skillsDir = resolve(packageRoot, "skills");
const bootstrapSkillPath = resolve(skillsDir, "using-parking-skills", "SKILL.md");

let cachedBootstrap: string | null | undefined;

export default function parkingSkillsPiExtension(pi: ExtensionAPI) {
	let injectBootstrap = true;

	pi.on("resources_discover", async () => ({
		skillPaths: [skillsDir],
	}));

	pi.on("session_start", async () => {
		injectBootstrap = true;
	});

	pi.on("session_compact", async () => {
		injectBootstrap = true;
	});

	pi.on("agent_end", async () => {
		injectBootstrap = false;
	});

	pi.on("context", async (event) => {
		if (!injectBootstrap) return;
		// Dedup guard: `context` fires every turn, and a second copy of the
		// bootstrap would both waste tokens and dilute the instruction.
		if (event.messages.some(messageContainsBootstrap)) return;

		const bootstrap = getBootstrapContent();
		if (!bootstrap) return;

		// Must be a `user` message, not `system`: repeated system messages inflate
		// tokens every turn and multiple system messages break some models.
		const bootstrapMessage = {
			role: "user" as const,
			content: [{ type: "text" as const, text: bootstrap }],
			timestamp: Date.now(),
		};

		const insertAt = firstNonCompactionSummaryIndex(event.messages);
		return {
			messages: [
				...event.messages.slice(0, insertAt),
				bootstrapMessage,
				...event.messages.slice(insertAt),
			],
		};
	});
}

function getBootstrapContent(): string | null {
	if (cachedBootstrap !== undefined) return cachedBootstrap;

	try {
		const skillContent = readFileSync(bootstrapSkillPath, "utf8");
		const body = stripFrontmatter(skillContent);
		cachedBootstrap = `${EXTREMELY_IMPORTANT_MARKER}
${BOOTSTRAP_MARKER}

You have the parking skills.

The using-parking-skills skill content is included below and is already loaded for this Pi session. Follow it now. Do not try to load using-parking-skills again.

${body}

${piToolMapping()}
</EXTREMELY_IMPORTANT>`;
		return cachedBootstrap;
	} catch {
		cachedBootstrap = null;
		return null;
	}
}

function stripFrontmatter(content: string): string {
	const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
	return (match ? match[1] : content).trim();
}

// Keep in sync with skills/using-parking-skills/references/pi-tools.md
function piToolMapping(): string {
	return `## Pi tool mapping

Skills speak in actions ("dispatch a subagent", "create a todo", "read a file"). On Pi these resolve to the lowercase built-in tools:

- Read a file → \`read\`
- Create a file → \`write\`
- Edit a file → \`edit\`
- Run a shell command → \`bash\`
- Search file contents → \`grep\`
- Find files by name → \`find\`
- List a directory → \`ls\`

Pi has native skill discovery but no dedicated skill-invocation tool. When a skill body says to invoke another skill, load the relevant \`SKILL.md\` with \`read\`, or let your human partner invoke \`/skill:name\` explicitly. Reading it that way IS Pi's skill-loading mechanism, so it does not bypass anything.

Pi does not ship a standard subagent tool. When a skill emits a \`Subagent (general-purpose):\` block, use \`subagent\` from \`pi-subagents\` if it is installed. If no subagent tool is available, do the work in this session or explain the missing capability — never invent a subagent call.

Pi does not ship a standard task-list tool. If an installed todo/task tool is available, use it. Otherwise track work in plan files or a repo-local \`TODO.md\`.

Pi has no interactive question tool. When a skill says to ask your human partner, put the question in your reply and stop — do not guess and continue.

Pi has no standard web fetch or search tool. If a skill's core purpose needs the web, say the capability is missing rather than answering from memory.

\`cpu-monitor\`, \`ps1-creator\`, and \`dev-environment\` shell out to PowerShell and are Windows-only. On other platforms, say so instead of attempting a translation.`;
}

function messageContainsBootstrap(message: unknown): boolean {
	const content = (message as { content?: unknown }).content;
	if (typeof content === "string") return content.includes(BOOTSTRAP_MARKER);
	if (!Array.isArray(content)) return false;
	return content.some((part) => {
		return (
			part &&
			typeof part === "object" &&
			(part as { type?: unknown }).type === "text" &&
			typeof (part as { text?: unknown }).text === "string" &&
			(part as { text: string }).text.includes(BOOTSTRAP_MARKER)
		);
	});
}

function firstNonCompactionSummaryIndex(messages: unknown[]): number {
	let index = 0;
	while ((messages[index] as { role?: unknown } | undefined)?.role === "compactionSummary") {
		index += 1;
	}
	return index;
}
