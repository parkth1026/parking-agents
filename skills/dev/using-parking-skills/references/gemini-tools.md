# Gemini CLI tool mapping

Skills speak in actions, not tool names ("dispatch a subagent", "create a todo", "read a file"). On Gemini CLI these resolve to:

| Action a skill names | Use in Gemini CLI |
|---|---|
| Read a file | `read_file` |
| Read several files at once | `read_many_files` |
| Create a file | `write_file` |
| Edit a file | `replace` |
| Several edits in one file | `replace` (one call per replacement) |
| Run a shell command | `run_shell_command` |
| Search file contents | `search_file_content` |
| Find files by name | `glob` |
| List a directory | `list_directory` |
| Fetch a URL | `web_fetch` |
| Search the web | `google_web_search` |
| Track tasks / mark a task complete | `write_todos` |
| Ask your human partner a question | No tool — ask in your reply and wait |
| Get diagnostics for a file | No tool — run the project's linter or type-checker via `run_shell_command` |
| Dispatch a subagent | `invoke_agent` — see below |

## Invoking other skills

Gemini CLI exposes `activate_skill`. When a skill body tells you to use another skill, call `activate_skill` with the skill's name. Do not read the other `SKILL.md` with `read_file` — that bypasses the skill mechanism.

## Subagent dispatch

When a skill emits a `Subagent (general-purpose):` block, call `invoke_agent` with the `generalist` agent:

- `agent_name`: `generalist`
- `task`: the block's `prompt`, filled in completely — the subagent sees nothing from this conversation
- `description`: the block's `description`

Subagents cannot reach your human partner. A subagent that needs a decision must return and let the main agent ask.

If `invoke_agent` is unavailable in your build, do the work inline in this session or explain the missing capability — **never invent a subagent call.**

## Degradations

- **Asking the user** — Gemini CLI has no interactive question tool. When a skill says to ask, put the question in your reply and stop; do not guess and continue.
- **Diagnostics** — no diagnostics tool. Run the project's own checks (`tsc --noEmit`, `cargo check`, `dotnet build`, `ruff`, etc.) via `run_shell_command`.

## Windows-only skills

`cpu-monitor`, `ps1-creator`, and `dev-environment` shell out to PowerShell and are Windows-only. On other platforms, say so instead of attempting a translation.

---

**Maintainers:** this file is `@`-included by `GEMINI.md`. An `@`-include pointing at a missing file loads **empty content, silently** — `tests/harnesses/test-harness-manifests.mjs` asserts both include targets exist.
