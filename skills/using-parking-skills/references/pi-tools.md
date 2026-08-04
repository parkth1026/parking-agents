# Pi tool mapping

Skills speak in actions, not tool names ("dispatch a subagent", "create a todo", "read a file"). On Pi these resolve to the lowercase built-in tools:

| Action a skill names | Use in Pi |
|---|---|
| Read a file | `read` |
| Create a file | `write` |
| Edit a file | `edit` |
| Several edits in one file | `edit` (one call per replacement) |
| Run a shell command | `bash` |
| Search file contents | `grep` |
| Find files by name | `find` |
| List a directory | `ls` |
| Fetch a URL / search the web | No standard tool — see Degradations below |
| Track tasks | No standard tool — see Degradations below |
| Ask your human partner a question | No tool — ask in your reply and wait |
| Get diagnostics for a file | No tool — run the project's linter or type-checker via `bash` |
| Dispatch a subagent | `subagent` if `pi-subagents` is installed — see below |

## Invoking other skills

Pi has native skill discovery but no dedicated skill-invocation tool. When a skill body says to invoke another skill, load the relevant `skills/<name>/SKILL.md` with `read`, or let your human partner invoke `/skill:name` explicitly. Reading it that way IS Pi's skill-loading mechanism, so it does not bypass anything.

## Degradations

- **Subagents** — Pi does not ship a subagent tool by default. When a skill emits a `Subagent (general-purpose):` block, use `subagent` from `pi-subagents` if it is installed. If no subagent tool is available, do the work in this session or explain the missing capability — **never invent a subagent call.**
- **Task tracking** — no standard todo tool. If an installed todo/task tool is available, use it. Otherwise track work in plan files or a repo-local `TODO.md`.
- **Asking the user** — no interactive question tool. When a skill says to ask, put the question in your reply and stop; do not guess and continue.
- **Web access** — no standard fetch or search tool. If a skill's core purpose needs the web (`research`, `grill-with-docs`), say the capability is missing rather than answering from memory.

## Windows-only skills

`cpu-monitor`, `ps1-creator`, and `dev-environment` shell out to PowerShell and are Windows-only. On other platforms, say so instead of attempting a translation.

---

**Maintainers:** this mapping is duplicated in `.pi/extensions/parking-skills.ts` (`piToolMapping()`), which is what actually gets injected at session start. Change both together — `tests/pi/test-pi-extension.mjs` cross-checks them.
