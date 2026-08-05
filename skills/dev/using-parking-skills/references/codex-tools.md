# Codex tool mapping

Skills speak in actions, not tool names ("dispatch a subagent", "create a todo", "read a file"). On Codex these resolve to:

| Action a skill names | Use in Codex |
|---|---|
| Read a file | your native file read, or `shell` + `cat` |
| Create a file | `apply_patch` |
| Edit a file | `apply_patch` |
| Several edits in one file | `apply_patch` (one patch can carry several hunks) |
| Run a shell command | `shell` |
| Search file contents | `shell` + `rg` (fall back to `grep -r`) |
| Find files by name | `shell` + `rg --files` or `find` |
| List a directory | `shell` + `ls` |
| Fetch a URL / search the web | `shell` + `curl` where network is allowed |
| Track tasks | No standard tool — see Degradations below |
| Ask your human partner a question | No tool — ask in your reply and wait |
| Get diagnostics for a file | No tool — run the project's linter or type-checker via `shell` |
| Dispatch a subagent | `spawn_agent` — **requires config, see below** |

## Invoking other skills

Codex discovers skills natively from the plugin's `skills/` directory. When a skill body tells you to use another skill, invoke it through Codex's own skill mechanism. If that is unavailable, read the other `skills/<name>/SKILL.md` directly and follow it.

## Subagent dispatch requires multi-agent support

When a skill emits a `Subagent (general-purpose):` block, it maps to `spawn_agent`, which is gated behind a config flag. Add to `~/.codex/config.toml`:

```toml
[features]
multi_agent = true
```

This enables `spawn_agent`, `wait_agent`, and `close_agent`. Close a subagent when its work returns.

If multi-agent is not enabled, **do not invent a subagent call.** Either do the work inline in this session, or tell your human partner that the skill wants a subagent and multi-agent support is off.

## Degradations

- **Task tracking** — no standard todo tool. Track multi-step work in a plan file or a repo-local `TODO.md`.
- **Asking the user** — no interactive question tool. When a skill says to ask, put the question in your reply and stop; do not guess and continue.
- **Diagnostics** — no diagnostics tool. Run the project's own checks (`tsc --noEmit`, `cargo check`, `dotnet build`, `ruff`, etc.) via `shell`.

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
