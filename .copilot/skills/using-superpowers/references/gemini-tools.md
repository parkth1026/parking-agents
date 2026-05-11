# Gemini CLI Tool Mapping

Skills use VS Code Copilot tool names. When you encounter these in a skill, use your Gemini CLI equivalent:

| Skill references | Gemini CLI equivalent |
|-----------------|----------------------|
| `read_file` (file reading) | `read_file` |
| `create_file` (file creation) | `write_file` |
| `replace_string_in_file` (file editing) | `replace` |
| `run_in_terminal` (run commands) | `run_shell_command` |
| `grep_search` (search file content) | `grep_search` |
| `file_search` (search files by name) | `glob` |
| `manage_todo_list` (task tracking) | `write_todos` |
| `read_file` (invoke a skill) | `activate_skill` |
| `fetch_webpage` (web search/fetch) | `google_web_search` / `web_fetch` |
| `runSubagent` (dispatch subagent) | `@agent-name` (see [Subagent support](#subagent-support)) |

## Subagent support

Gemini CLI supports subagents natively via the `@` syntax. Use the built-in `@generalist` agent to dispatch any task — it has access to all tools and follows the prompt you provide.

When a skill says to dispatch a named agent type, use `@generalist` with the full prompt from the skill's prompt template:

| Skill instruction | Gemini CLI equivalent |
|-------------------|----------------------|
| `runSubagent (superpowers:implementer)` | `@generalist` with the filled `implementer-prompt.md` template |
| `runSubagent (superpowers:spec-reviewer)` | `@generalist` with the filled `spec-reviewer-prompt.md` template |
| `runSubagent (superpowers:code-reviewer)` | `@code-reviewer` (bundled agent) or `@generalist` with the filled review prompt |
| `runSubagent (superpowers:code-quality-reviewer)` | `@generalist` with the filled `code-quality-reviewer-prompt.md` template |
| `runSubagent (general-purpose)` with inline prompt | `@generalist` with your inline prompt |

### Prompt filling

Skills provide prompt templates with placeholders like `{WHAT_WAS_IMPLEMENTED}` or `[FULL TEXT of task]`. Fill all placeholders and pass the complete prompt as the message to `@generalist`. The prompt template itself contains the agent's role, review criteria, and expected output format — `@generalist` will follow it.

### Parallel dispatch

Gemini CLI supports parallel subagent dispatch. When a skill asks you to dispatch multiple independent subagent tasks in parallel, request all of those `@generalist` or named subagent tasks together in the same prompt. Keep dependent tasks sequential, but do not serialize independent subagent tasks just to preserve a simpler history.

## Additional Gemini CLI tools

These tools are available in Gemini CLI but have no Claude Code equivalent:

| Tool | Purpose |
|------|---------|
| `list_directory` | List files and subdirectories |
| `save_memory` | Persist facts to GEMINI.md across sessions |
| `ask_user` | Request structured input from the user |
| `tracker_create_task` | Rich task management (create, update, list, visualize) |
| `enter_plan_mode` / `exit_plan_mode` | Switch to read-only research mode before making changes |
