# VS Code Copilot Tool Mapping

Skills use Claude Code tool names. When you encounter these in a skill, use the VS Code Copilot equivalent:

| Skill references | VS Code Copilot equivalent |
|-----------------|---------------------------|
| `Read` (file reading) | `read_file` |
| `Write` (file creation) | `create_file` |
| `Edit` (file editing) | `replace_string_in_file` |
| `Bash` (run commands) | `run_in_terminal` |
| `Grep` (search file content) | `grep_search` |
| `Glob` (search files by name) | `file_search` |
| `Skill` tool (invoke a skill) | No equivalent — skills are auto-injected via YAML `applyTo` or manually via `read_file` |
| `WebFetch` | `fetch_webpage` |
| `Task` tool (dispatch subagent) | `runSubagent` |
| Multiple `Task` calls (parallel) | Multiple `runSubagent` calls |
| Task status/output | No equivalent — subagent results are returned inline |
| `TodoWrite` (task tracking) | `manage_todo_list` |
| `WebSearch` | No equivalent — use `fetch_webpage` with a search engine URL |
| `EnterPlanMode` / `ExitPlanMode` | No equivalent — stay in the main session |

## File operations

| Tool | Purpose | Example |
|------|---------|---------|
| `read_file` | Read file contents (line range required) | `read_file(filePath, startLine=1, endLine=50)` |
| `create_file` | Create a new file with content | `create_file(filePath, content)` |
| `replace_string_in_file` | Edit file by replacing exact string match | `replace_string_in_file(filePath, oldString, newString)` |
| `multi_replace_string_in_file` | Batch multiple replacements in one call | Array of `{filePath, oldString, newString}` |
| `list_dir` | List directory contents | `list_dir(path)` |
| `view_image` | View image files (png, jpg, gif, webp) | `view_image(filePath)` |

## Search tools

| Tool | Purpose | Example |
|------|---------|---------|
| `grep_search` | Fast text/regex search across workspace | `grep_search(query, isRegexp=true)` |
| `file_search` | Find files by glob pattern | `file_search(query="**/*.ts")` |
| `semantic_search` | Natural language code search | `semantic_search(query="authentication logic")` |
| `explore_subagent` | Launch a search-specialized subagent | `explore_subagent(query, description, details)` |

## Terminal tools

| Tool | Purpose | Example |
|------|---------|---------|
| `run_in_terminal` | Execute command (sync or async mode) | `run_in_terminal(command, mode="sync")` |
| `send_to_terminal` | Send input to active terminal | `send_to_terminal(id, command)` |
| `get_terminal_output` | Read output from async terminal | `get_terminal_output(id)` |
| `kill_terminal` | Terminate a terminal session | `kill_terminal(id)` |

## Code intelligence

| Tool | Purpose | Example |
|------|---------|---------|
| `get_errors` | Get compile/lint errors for file(s) | `get_errors(filePaths=[...])` |
| `vscode_listCodeUsages` | Find all references/definitions of a symbol | `vscode_listCodeUsages(symbol, lineContent)` |
| `vscode_renameSymbol` | Rename symbol across workspace | `vscode_renameSymbol(symbol, newName, lineContent)` |

## Agent & task management

| Tool | Purpose | Example |
|------|---------|---------|
| `runSubagent` | Dispatch a subagent for delegated work | Replaces Claude Code `Task` |
| `explore_subagent` | Lightweight codebase exploration agent | Replaces Claude Code `Task` with `agent_type: "explore"` |
| `manage_todo_list` | Track task items in a checklist | Replaces Claude Code `TodoWrite` |
| `vscode_askQuestions` | Ask user clarifying questions with options | No Claude Code equivalent |

## Memory & persistence

| Tool | Purpose | Example |
|------|---------|---------|
| `memory` | Manage persistent notes (view/create/edit/delete) | `memory(command="create", path="/memories/repo/note.md", file_text="...")` |

## Browser tools

| Tool | Purpose |
|------|---------|
| `open_browser_page` | Open URL in integrated browser |
| `read_page` | Get accessibility snapshot of browser page |
| `screenshot_page` | Capture screenshot of browser page |
| `click_element` | Click element in browser |
| `type_in_page` | Type text or press keys in browser |
| `hover_element` | Hover over element in browser |
| `drag_element` | Drag element over another |
| `navigate_page` | Navigate browser (URL, back, forward, reload) |
| `handle_dialog` | Respond to modal dialogs |
| `run_playwright_code` | Execute custom Playwright code |

## Other tools

| Tool | Purpose |
|------|---------|
| `fetch_webpage` | Fetch and extract content from a URL |
| `tool_search` | Search for available deferred tools by description |
| `get_changed_files` | Get git diffs of current changes |

## Key differences from Claude Code

1. **No `Bash` tool** — use `run_in_terminal` with `mode="sync"` or `mode="async"`
2. **No `Task` tool** — use `runSubagent` (results returned inline, no `read_agent`/`list_agents`)
3. **No `TodoWrite`** — use `manage_todo_list`
4. **No `Skill` tool** — skills are loaded automatically via YAML frontmatter or read manually with `read_file`
5. **No `sql` tool** — no built-in SQLite; use `memory` for persistence
6. **File editing** — `replace_string_in_file` requires exact string match with context lines (not line-based Edit)
7. **Browser tools** — VS Code Copilot has built-in browser tools; Claude Code requires MCP
8. **Code intelligence** — `vscode_listCodeUsages` and `vscode_renameSymbol` leverage VS Code's language server (no Claude Code equivalent)
