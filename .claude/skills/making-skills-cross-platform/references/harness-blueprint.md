# Harness blueprint

Per-harness recipe: what files to create, which manifest fields the platform
actually reads, how the bootstrap gets in, and the trap that bites porters.

Reference implementation to copy from: [obra/superpowers](https://github.com/obra/superpowers).
When porting, read its `skills/using-superpowers/references/`, `hooks/`, `.pi/`,
`.opencode/` and `docs/porting-to-a-new-harness.md` as the worked example.

---

## Capability table

Only the first row is non-negotiable. Everything else has a documented degradation.

| Capability | Missing means |
|---|---|
| **Automatic session-start injection** | **Platform cannot be supported.** Stop. |
| File read / write / edit | Also fatal — no skill works without it |
| Run a shell command | Also fatal for verification and git workflows |
| Skill discovery + invocation | Degrade: model reads the target `SKILL.md` directly. That IS the mechanism on such a platform, so it does not violate "don't bypass the skill system" |
| Subagent dispatch | Degrade: run inline, or state the capability is missing. **Never fabricate a call** |
| Task / todo tracking | Degrade: a plan file or repo-local `TODO.md` |
| Asking the user a question | Degrade: put the question in the reply and stop |
| Web fetch / search | Degrade, but say so — some skills are useless without it |

---

## Shape A — shell hook

**Harnesses:** Claude Code, Cursor, Copilot CLI, Antigravity (reuses Claude Code's path)

**Files**

```
hooks/hooks.json          # Claude Code hook registration
hooks/hooks-cursor.json   # Cursor — DIFFERENT SCHEMA, not a rename
hooks/session-start       # extensionless, on purpose
hooks/run-hook.cmd        # polyglot: valid .bat AND valid sh
.claude-plugin/plugin.json
.claude-plugin/marketplace.json
.cursor-plugin/plugin.json
```

**Hook registration schemas differ per harness — this is the #1 Shape A trap:**

```json
// Claude Code — PascalCase, nested hooks array, matcher
{ "hooks": { "SessionStart": [ { "matcher": "startup|clear|compact",
  "hooks": [ { "type": "command", "command": "...", "shell": "bash" } ] } ] } }

// Cursor — top-level version, camelCase, flat
{ "version": 1, "hooks": { "sessionStart": [ { "command": "./hooks/run-hook.cmd session-start" } ] } }
```

**One script, three output shapes, exactly one field each:**

| Harness | Detect by | Emit |
|---|---|---|
| Cursor | `CURSOR_PLUGIN_ROOT` set | `additional_context` (top level, snake_case) |
| Claude Code | `CLAUDE_PLUGIN_ROOT` set and `COPILOT_CLI` empty | `hookSpecificOutput.additionalContext` (nested) |
| Copilot CLI / unknown | otherwise | `additionalContext` (top level) |

**Traps**

- **Claude Code reads both `additional_context` and `hookSpecificOutput`, without
  deduplication.** Emit two fields and the bootstrap is injected twice.
- **Cursor also sets `CLAUDE_PLUGIN_ROOT`**, so the Cursor branch must be tested first.
- **Keep the hook script extensionless.** Claude Code on Windows prepends `bash`
  to any command containing `.sh`, causing a double invocation.
- Emit with `printf`, not a heredoc — bash 5.3+ hangs on heredocs here.
- Pin `eol=lf` in `.gitattributes` for the hook and the `.cmd`. A CRLF shebang
  kills the hook silently, and the polyglot wrapper must parse as both.

**Claude Code / Cursor / Copilot CLI need NO tool mapping file** — their tool
surfaces already cover every action the skills describe.

---

## Shape B — in-process plugin

**Harnesses:** Pi, OpenCode

**Files**

```
.pi/extensions/<name>.ts        # declared via package.json "pi"
.opencode/plugins/<name>.js     # declared via package.json "main"
```

**Both must:** read the bootstrap `SKILL.md`, strip its frontmatter, wrap it,
cache it at module level, and inject it as a **`user`** message.

**Three hard requirements**

1. **Inject a `user` message, never `system`.** Repeated system messages inflate
   tokens every turn, and several models break on multiple system messages.
2. **Dedup guard is mandatory**, keyed on a unique marker string.
3. **Message object shapes are per-platform and NOT interchangeable:**
   - Pi: `{ role, content: [{ type, text }], timestamp }`
   - OpenCode: `message.info.role` + `message.parts[]`

**Callback frequency differs, and so must the dedup strategy:**

| | Fires | Guard |
|---|---|---|
| Pi (`context`) | once per **turn** | lifecycle boolean, reset on `agent_end` |
| OpenCode (`messages.transform`) | once per agent **step** | inspect the messages for the marker — there is no lifecycle event to lean on |

Copy the wrong one and the bootstrap re-injects every step.

**Also for Pi:** re-inject after compaction (`session_compact`), and insert
*after* any leading compaction-summary messages, or the summary gets displaced.

**Skill registration:** Pi returns `{ skillPaths: [...] }` from
`resources_discover`; OpenCode pushes onto `config.skills.paths` in the `config`
hook. Make the OpenCode one idempotent — `config` can fire more than once.

**Mapping placement:** inline in the plugin, since Shape B injects it directly.
Pi is the exception — it keeps the mapping in **both** the plugin and a reference
file. If a repo does that, changing one without the other is a half-done port.

---

## Shape C — instructions file

**Harnesses:** Gemini CLI

**Files**

```
gemini-extension.json   # { name, description, version, contextFileName }
GEMINI.md               # ONLY @-includes
references/gemini-tools.md
```

`GEMINI.md` is two lines:

```
@./skills/using-<repo>-skills/SKILL.md
@./skills/using-<repo>-skills/references/gemini-tools.md
```

**This is the least work of any shape.** No assembly, no frontmatter stripping,
no `<EXTREMELY_IMPORTANT>` wrapper, no "already loaded" preamble — the
`contextFileName` mechanism guarantees per-session loading, so every
anti-double-injection device is dead weight here.

**Trap:** a dangling `@`-include loads **empty, silently**. Assert both paths exist.

**Gemini tool mapping:** `read_file`, `read_many_files`, `write_file`, `replace`,
`run_shell_command`, `grep_search`, `glob`, `list_directory`, `web_fetch`,
`google_web_search`, `activate_skill`, `write_todos`, and subagent dispatch →
`invoke_agent` with `agent_name: "generalist"`.

---

## Shape D — manifest-declared

**Harnesses:** Codex, Kimi Code

### Codex

```json
"skills": "./skills/",
"hooks": {},
"interface": { "displayName": ..., "capabilities": [...], "composerIcon": ..., "logo": ... }
```

**`"hooks": {}` is a required suppression switch, not redundancy.** Without it
Codex auto-discovers and runs `hooks/hooks.json`, which emits a Claude
Code-shaped payload Codex neither understands nor needs.

Codex needs the model to go **read** its mapping, via the bootstrap's Platform
Adaptation pointer. Its subagent tool `spawn_agent` is gated behind
`[features] multi_agent = true` in `~/.codex/config.toml` — the mapping must say
so, and must say **not** to fabricate a call when it is off.

Per-skill Codex interface metadata lives at `skills/<name>/agents/openai.yaml`.
**`.yml` is silently ignored.**

### Kimi Code

```json
"sessionStart": { "skill": "using-<repo>-skills" },
"skillInstructions": "<the whole tool mapping as a JSON string>"
```

A **fourth mapping location** — not in `references/`, not in injector code, but
in a manifest field. When auditing a repo, do not conclude "no mapping" just
because `references/` lacks a file.

Kimi specifics worth encoding: todos → `TodoList`; questions → `AskUserQuestion`;
subagents → `Agent` with `subagent_type` of `coder` / `explore` / `plan` —
and **`general-purpose` is rejected as a subagent type**.

---

## Antigravity

No separate manifest; reuses the Claude Code plugin path. Its mapping file needs
only the two things that differ:

- subagent dispatch → `invoke_subagent` with `TypeName` of `self` (full
  capability) or `research` (read-only)
- todos → a task artifact: `write_to_file` with `IsArtifact: true` and
  `ArtifactType: "task"`. **Not** `manage_task`, which manages background processes.

---

## Cross-runtime marketplace

```
.agents/plugins/marketplace.json
```

```json
{ "name": "<repo>-dev", "plugins": [ { "name": "<repo>",
  "source": { "source": "url", "url": "./" },
  "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" } } ] }
```

---

## Version lockstep

```json
{ "files": [
  { "path": "package.json", "field": "version" },
  { "path": ".claude-plugin/plugin.json", "field": "version" },
  { "path": ".claude-plugin/marketplace.json", "field": "plugins.0.version" },
  { "path": ".codex-plugin/plugin.json", "field": "version" },
  { "path": ".cursor-plugin/plugin.json", "field": "version" },
  { "path": ".kimi-plugin/plugin.json", "field": "version" },
  { "path": "gemini-extension.json", "field": "version" }
] }
```

Note `.opencode/` and `.pi/` carry no version of their own — they are declared
through the root `package.json`.

---

## Per-harness sync excludes

If the repo syncs itself into another distribution (a plugin fork, a package),
every per-harness dotdir must be excluded from the *other* harnesses' payloads.
Anchor the patterns with a leading `/`: an unanchored `scripts/` would also match
`skills/<name>/scripts/` and delete real skill assets.
