---
name: using-parking-skills
description: Use when starting any conversation - establishes how to find and use the parking skills, and how to resolve the actions they name into the tools your platform actually exposes.
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, ignore this skill.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

## The Rule

**Invoke relevant or requested skills BEFORE any response or action** — including clarifying questions, exploring the codebase, or checking files. If it turns out wrong for the situation, you don't have to use it.

Then announce "Using [skill] to [purpose]" and follow the skill exactly. If it has a checklist, track one task per item.

## Skills speak in actions, not tool names

**This is the single most important thing to understand about this skill library.**

The same skill bodies run unmodified on nine different platforms. That is only possible because they never name a tool. They name an **action**, and you resolve it to whichever of *your* tools performs it.

| When a skill names this action | You do this |
|---|---|
| read a file | read it with your file-reading tool |
| create a file | create it |
| edit a file | apply the edit |
| run a shell command | run it |
| search file contents | search them |
| find files by name | find them |
| list a directory | list it |
| fetch a URL / search the web | fetch or search |
| track tasks / mark a task complete | use your task-tracking mechanism |
| ask your human partner a question | ask, through whatever mechanism reaches them |
| get diagnostics for a file | run the project's own linter or type-checker |
| dispatch a subagent | see the dispatch block below |

If your platform cannot perform an action, **say so and degrade as your reference file instructs — never invent a tool call.** A fabricated call fails silently: the model either hallucinates a tool that does not exist, or stalls because it cannot find the named one.

## Subagent dispatch blocks

When a skill wants a subagent, it emits a block that looks like a call but names no real tool:

```
Subagent (general-purpose):
  description: "<one-line task name>"
  model: <required when your harness supports it; omitting it silently inherits the session's most expensive model>
  prompt: |
    <the full prompt>
```

Translate that block into your platform's own subagent dispatch. Your reference file below spells out which one, and which agent type to pass. Subagents cannot reach your human partner — a subagent that needs a decision must return and let the main agent ask.

## Platform Adaptation

Read the reference file for the harness you are running in:

| Harness | Where its mapping lives |
|---|---|
| Claude Code / Cursor / Copilot CLI | None needed — your tool surface already covers every action above |
| Codex | `references/codex-tools.md` |
| Pi | `references/pi-tools.md` |
| Gemini CLI | `references/gemini-tools.md` |
| Antigravity | `references/antigravity-tools.md` |
| OpenCode / Kimi Code | Delivered inline with this bootstrap — nothing to read |

If none of these matches your harness, apply the action table above using whatever tools you do expose, and tell your human partner that this harness has no mapping yet.

## Two kinds of skills in this library

- **Model-invoked** — you reach for these yourself when the task matches the `description`.
- **User-invoked only** — marked `disable-model-invocation: true` in their frontmatter. Do not reach for these on your own; they run only when your human partner asks for them by name.

## Red Flags

These thoughts mean STOP—you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "I can check git/files quickly" | Files lack conversation context. Check for skills. |
| "Let me gather information first" | Skills tell you HOW to gather information. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Read current version. |
| "This doesn't count as a task" | Action = task. Check for skills. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "The skill named an action, so there must be a tool with that name" | It named an action. Resolve it to one of *your* tools. |
| "No mapping for this action, I'll guess a name" | Never invent tool calls. Report the gap. |

## User Instructions

User instructions (CLAUDE.md, AGENTS.md, direct requests) take precedence over skills, which in turn override default behavior. Only skip skill workflows or instructions when your human partner has explicitly told you to.
