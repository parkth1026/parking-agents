# Pi tool mapping

The skill bodies in this repository name VS Code Copilot tools. Those names are aliases for actions. Use the Pi tool in the right-hand column instead.

Pi's built-in coding tools are lowercase.

| Skill body says | Action | Use in Pi |
|---|---|---|
| `read_file` | read a file | `read` |
| `create_file` | create a file | `write` |
| `replace_string_in_file` | edit a file | `edit` |
| `multi_replace_string_in_file` | several edits in one file | `edit` (one call per replacement) |
| `run_in_terminal` | run a shell command | `bash` |
| `grep_search` | search file contents | `grep` |
| `file_search` | find files by name | `find` |
| `list_dir` | list a directory | `ls` |
| `manage_todo_list` | track tasks | No standard tool — see Degradations below |
| `runSubagent` | dispatch a subagent | `subagent` if `pi-subagents` is installed — see below |
| `vscode_askQuestions` | ask the user a question | No tool — ask in your reply and wait |
| `fetch_webpage` | fetch a URL / search the web | No standard tool — report the gap |
| `get_errors` | get diagnostics for a file | No tool — run the project's linter or type-checker via `bash` |

## Invoking other skills

Pi has native skills but does not expose Claude Code's `Skill` tool. When a skill body tells you to use another skill, read the relevant `skills/<name>/SKILL.md` with `read` and follow it, or let your human partner invoke `/skill:name` explicitly.

## Degradations

- **Subagents** — `runSubagent` is the most common tool name in this library. Pi does not ship a subagent tool by default. If one is available (such as `subagent` from the optional `pi-subagents` package), use it. If none is available, **do the work inline in this session or explain the missing capability — never invent a `runSubagent` or `Task` call.**
- **Task tracking** — no standard todo tool. If an installed todo/task tool is available, use it. Otherwise track work in plan files or a repo-local `TODO.md`.
- **Asking the user** — no `AskUserQuestion` equivalent. When a skill says to ask, put the question in your reply and stop; do not guess and continue.
- **Web access** — no standard fetch or search tool. If a skill's core purpose needs the web (`research`, `grill-with-docs`), say the capability is missing rather than answering from memory.

## Windows-only skills

`cpu-monitor`, `ps1-creator`, and `dev-environment` shell out to PowerShell and are Windows-only. On other platforms, say so instead of attempting a translation.

---

**Maintainers:** this mapping is duplicated in `.pi/extensions/parking-skills.ts` (`piToolMapping()`), which is what actually gets injected at session start. Change both together.
