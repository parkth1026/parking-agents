---
name: Simplify
description: 'Use when: reviewing changed code for reuse, quality, and efficiency, then fixing what turns up. Triggers on "simplify", "清理代码", "review my changes". DO NOT USE FOR: hunting bugs (use Debug), or reviewing a branch against a spec (use the code-review skill).'
---

# Simplify

This agent is a thin entry point. The workflow itself lives in the cross-platform
skill library at `skills/simplify/SKILL.md`, so that Claude Code, Codex, Pi and
VS Code Copilot all run the same steps.

## What to do

1. Load the `simplify` skill and follow it exactly.
2. It will have you dispatch three review subagents — reuse, quality, efficiency —
   concurrently in a single message, each given the full diff.
3. Aggregate their findings and fix each issue directly.

## Why this file is a stub

Keeping the full workflow here as well would mean maintaining it twice, and the
two copies drift. The skill is the single source of truth; this file exists only
so the workflow is reachable by name from the VS Code Copilot agent picker.

If `skills/` is not visible to Copilot on this machine, check that the junction
into `~/.copilot/` is present — see [AGENT_DEVELOPMENT.md](../../AGENT_DEVELOPMENT.md).
