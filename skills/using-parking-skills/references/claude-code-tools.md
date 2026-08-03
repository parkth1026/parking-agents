# Claude Code tool mapping

The skill bodies in this repository name VS Code Copilot tools. Those names are aliases for actions. Use the Claude Code tool in the right-hand column instead.

| Skill body says | Action | Use in Claude Code |
|---|---|---|
| `read_file` | read a file | `Read` |
| `create_file` | create a file | `Write` |
| `replace_string_in_file` | edit a file | `Edit` |
| `multi_replace_string_in_file` | several edits in one file | `Edit` (one call per replacement) |
| `run_in_terminal` | run a shell command | `Bash` |
| `grep_search` | search file contents | `Grep` |
| `file_search` | find files by name | `Glob` |
| `list_dir` | list a directory | `Glob` with a `*` pattern, or `Bash` + `ls` |
| `manage_todo_list` | track tasks | `TodoWrite` |
| `runSubagent` | dispatch a subagent | `Task` (or `Agent`, whichever your build exposes) |
| `vscode_askQuestions` | ask the user a question | `AskUserQuestion` |
| `fetch_webpage` | fetch a URL / search the web | `WebFetch` for a known URL, `WebSearch` to search |
| `get_errors` | get diagnostics for a file | No direct equivalent — run the project's linter or type-checker via `Bash` |

## Invoking other skills

Claude Code exposes a native `Skill` tool. When a skill body tells you to use another skill, call `Skill` with the skill's name. You do not need to read the other `SKILL.md` yourself.

## Subagents

`runSubagent` maps cleanly onto Claude Code's subagent dispatch. Two notes carried over from the original VS Code skill bodies:

- Several skills in this library were written for a dispatcher/worker split where the main agent never does heavy work itself. That pattern works as-is here.
- Some skill bodies say a subagent must not ask the user questions. Keep that constraint: subagents cannot reach the user, so a subagent that needs a decision must return and let the main agent ask.

## `allowed-tools` frontmatter

A few skills (`playwright-cli`, `shadcn`) declare `allowed-tools` using `Bash(...)` syntax. That is Claude Code's own syntax and works correctly here — no translation needed.
