---
name: using-parking-skills
description: Use when starting any conversation - establishes how to find and use the parking skills, and how to translate the tool names written in them into the tools your platform actually exposes.
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

Then announce "Using [skill] to [purpose]" and follow the skill exactly. If it has a checklist, create a todo per item.

## Tool names in these skills are ALIASES, not real tools

**This is the single most important thing to understand about this skill library.**

The skill bodies in this repository were originally written for VS Code Copilot. They name tools like `read_file`, `run_in_terminal`, `runSubagent`, `manage_todo_list`, `grep_search`, and `vscode_askQuestions`.

**Those are not tools you can call.** Treat every such name as an *alias for an action*:

| When a skill says | It means the action |
|---|---|
| `read_file` | read a file |
| `create_file` | create a file |
| `replace_string_in_file` / `multi_replace_string_in_file` | edit a file |
| `run_in_terminal` | run a shell command |
| `grep_search` | search file contents |
| `file_search` | find files by name |
| `list_dir` | list a directory |
| `manage_todo_list` | track tasks / todos |
| `runSubagent` | dispatch a subagent |
| `vscode_askQuestions` | ask the user a question |
| `fetch_webpage` | fetch a URL or search the web |
| `get_errors` | get diagnostics for a file |

Read your platform's reference file below to learn which of *your* tools performs each action, then use that tool. **Never call a tool by the name written in the skill body.** If a skill names an action your platform cannot perform, say so and degrade as the reference file instructs — never invent a tool call.

## Platform Adaptation

Read the reference file for the harness you are running in:

- Claude Code: `references/claude-code-tools.md`
- Codex: `references/codex-tools.md`
- Pi: `references/pi-tools.md`

If none of these matches your harness, apply the alias table above using whatever tools you do expose, and tell your human partner that this harness has no reference file yet.

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
| "The skill says `read_file`, so I'll call `read_file`" | That name is an alias. Translate it first. |
| "No mapping for this tool, I'll guess a name" | Never invent tool calls. Report the gap. |

## User Instructions

User instructions (CLAUDE.md, AGENTS.md, direct requests) take precedence over skills, which in turn override default behavior. Only skip skill workflows or instructions when your human partner has explicitly told you to.
