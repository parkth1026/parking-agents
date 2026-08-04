# Antigravity tool mapping

Antigravity loads this library through the Claude Code plugin path, so almost every action resolves exactly as it does there — read, write, edit, run, search, glob all have direct equivalents and need no translation.

This file documents **only what actually differs**. Two things do, and both fail silently if you guess.

## Subagent dispatch → `invoke_subagent`

When a skill emits a `Subagent (general-purpose):` block, call `invoke_subagent`. Antigravity does not accept `general-purpose` as a type — pick from its own:

| Block asks for | Pass |
|---|---|
| General implementation, review, or any filled prompt template | `self` |
| Read-only investigation: exploring a codebase, gathering docs, answering "how does X work" | `research` |

Fill the block's `prompt` in completely — the subagent sees nothing from this conversation. Subagents cannot reach your human partner; one that needs a decision must return and let the main agent ask.

## Task tracking → task artifacts

**Not** `manage_task`. That is the trap: it sounds like the todo tool and is not — it manages **background processes** (long-running commands, servers). Using it to track a skill's checklist silently does the wrong thing.

Task lists in Antigravity are **artifacts**. When a skill says to track tasks or create a todo per checklist item, write a task-list artifact:

- `IsArtifact`: `true`
- `ArtifactType`: the task-list artifact type

Update that artifact as items complete, the same way a todo tool would be updated elsewhere.

## Windows-only skills

`cpu-monitor`, `ps1-creator`, and `dev-environment` shell out to PowerShell and are Windows-only. On other platforms, say so instead of attempting a translation.
