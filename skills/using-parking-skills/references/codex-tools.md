# Codex tool mapping

The skill bodies in this repository name VS Code Copilot tools. Those names are aliases for actions. Use the Codex tool in the right-hand column instead.

| Skill body says | Action | Use in Codex |
|---|---|---|
| `read_file` | read a file | your native file read, or `shell` + `cat` |
| `create_file` | create a file | `apply_patch` |
| `replace_string_in_file` | edit a file | `apply_patch` |
| `multi_replace_string_in_file` | several edits in one file | `apply_patch` (one patch can carry several hunks) |
| `run_in_terminal` | run a shell command | `shell` |
| `grep_search` | search file contents | `shell` + `rg` (fall back to `grep -r`) |
| `file_search` | find files by name | `shell` + `rg --files` or `find` |
| `list_dir` | list a directory | `shell` + `ls` |
| `manage_todo_list` | track tasks | No standard tool — see Degradations below |
| `runSubagent` | dispatch a subagent | `spawn_agent` — **requires config, see below** |
| `vscode_askQuestions` | ask the user a question | No tool — ask in your reply and wait |
| `fetch_webpage` | fetch a URL / search the web | `shell` + `curl` where network is allowed |
| `get_errors` | get diagnostics for a file | No tool — run the project's linter or type-checker via `shell` |

## Invoking other skills

Codex discovers skills natively from the plugin's `skills/` directory. When a skill body tells you to use another skill, invoke it through Codex's own skill mechanism. If that is unavailable, read the other `skills/<name>/SKILL.md` directly and follow it.

## Subagent dispatch requires multi-agent support

`runSubagent` appears in many skills in this library. It maps to `spawn_agent`, which is gated behind a config flag. Add to `~/.codex/config.toml`:

```toml
[features]
multi_agent = true
```

This enables `spawn_agent`, `wait_agent`, and `close_agent`. Close a subagent when its work returns.

If multi-agent is not enabled, **do not invent a `runSubagent` or `Task` call.** Either do the work inline in this session, or tell your human partner that the skill wants a subagent and multi-agent support is off.

## Degradations

- **Task tracking** — no standard todo tool. Track multi-step work in a plan file or a repo-local `TODO.md`. Treat `manage_todo_list` in a skill body as "keep a written task list".
- **Asking the user** — no `AskUserQuestion` equivalent. When a skill says to ask, put the question in your reply and stop; do not guess and continue.
- **Diagnostics** — no `get_errors`. Run the project's own checks (`tsc --noEmit`, `cargo check`, `dotnet build`, `ruff`, etc.) via `shell`.

## Environment detection

Skills that create worktrees or finish branches should detect their environment with read-only git commands first:

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
BRANCH=$(git branch --show-current)
```

- `GIT_DIR != GIT_COMMON` → already in a linked worktree (skip creation)
- `BRANCH` empty → detached HEAD (cannot branch/push/PR from the sandbox)

When the sandbox blocks branch/push operations, commit the work and hand off to the App's native controls ("Create branch" / "Hand off to local"). You can still run tests, stage files, and output suggested branch names, commit messages, and PR descriptions for your human partner to copy.

## Windows-only skills

`cpu-monitor`, `ps1-creator`, and `dev-environment` shell out to PowerShell and are Windows-only. On other platforms, say so instead of attempting a translation.
