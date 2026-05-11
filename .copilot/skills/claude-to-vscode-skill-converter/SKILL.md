---
description: "Use when: converting Claude Code skills/prompts to VS Code Copilot format. Handles tool name mapping, syntax conversion, and platform-specific adaptations."
---

# Claude Code → VS Code Copilot Skill Converter

## 工具名映射表

| Claude Code | VS Code Copilot | 类别 | 备注 |
|---|---|---|---|
| `Read` / `ReadFile` | `read_file` | 文件操作 | 注意区分自然语言 "Read" |
| `Write` / `WriteFile` | `create_file` | 文件操作 | 注意区分自然语言 "Write" |
| `Edit` / `EditFile` | `replace_string_in_file` | 文件操作 | 注意区分自然语言 "Edit" |
| `MultiEdit` | `multi_replace_string_in_file` | 文件操作 | |
| `Bash` / `bash` | `run_in_terminal` | 终端 | 包括 `Bash("cmd")` 语法 |
| `Grep` / `GrepTool` | `grep_search` | 搜索 | |
| `Glob` / `GlobTool` | `file_search` | 搜索 | |
| `TodoWrite` | `manage_todo_list` | 任务管理 | |
| `TodoRead` | `manage_todo_list` | 任务管理 | 同一工具 |
| `Task` / `Task("...")` | `runSubagent` / `runSubagent("...")` | Agent | 子代理调用 |
| `WebSearch` | `fetch_webpage` | 网络 | 近似映射 |
| `WebFetch` | `fetch_webpage` | 网络 | |
| `ListDir` / `LS` | `list_dir` | 文件操作 | |
| `Skill` / `Skill("name")` | 系统自动注入 | 特殊 | VS Code 通过 `.copilot/skills/` 自动发现 |
| `EnterPlanMode` / `ExitPlanMode` | 无等价 | 特殊 | VS Code 无计划模式 |

## 语法转换规则

- `Task("prompt text")` → `runSubagent("prompt text")` 或 `runSubagent({ prompt: "prompt text" })`
- `Bash("command")` → `run_in_terminal` 执行 command
- `Skill("skill-name")` → 无需手动调用，VS Code 自动匹配 `.copilot/skills/` 下的 skill
- `@file` 引用 → `[filename](relative-path)` markdown 链接
- `superpowers:<name>` → 在 VS Code 中通过 skill 系统自动发现

## 判断规则：何时替换 vs 不替换

- ✅ 反引号包裹的工具名（`` `Read` ``）→ 替换
- ✅ "use the X tool" / "call X" → 替换
- ✅ 代码块中的调用（`Task("...")`, `Bash("...")`）→ 替换
- ❌ 自然语言（"Read the file", "Write the code"）→ 不替换
- ⚠️ 平台对照文档（"In Claude Code: use `Skill`..."）→ 保留原文作为参考

## 转换工作流

1. **列出目标文件** — 列出所有 .md 文件
2. **搜索工具名** — 用 `grep_search` 搜索 pattern: `\b(Read|ReadFile|Write|WriteFile|Edit|EditFile|MultiEdit|Bash|bash|Grep|GrepTool|Glob|GlobTool|TodoWrite|TodoRead|Task|WebSearch|WebFetch|ListDir|LS|Skill)\b`
3. **上下文判断** — 逐一判断：工具引用 vs 自然语言
4. **按映射表替换** — 执行替换
5. **检查 `@file` 引用** — 转为 `[filename](relative-path)` markdown 链接
6. **检查 YAML frontmatter** — 确认符合 VS Code 格式
7. **验证无遗漏** — 再次搜索确认

## VS Code Copilot 特有注意事项

- SubAgent 不能使用 `vscode_askQuestions`
- Skills 在 `.copilot/skills/` 下通过 description 自动发现
- `agents: ["*"]` 允许调用所有 subagent
- `user-invocable: false` 防止用户直接调用 subagent
- frontmatter 中 tools 列表控制可用工具

## 常见陷阱

- **`Read`** 是最容易误判的——作为工具名时需替换，作为动词时不替换
- **`Task`** 也易误判——"task" 小写通常是自然语言，"Task" 大写 + 反引号通常是工具
- **`Skill`** 在 VS Code 中无等价工具——由系统自动处理
- **`EnterPlanMode`/`ExitPlanMode`** 在 VS Code 中不存在——直接删除相关段落或注释
- 引用文件中的映射表（如 copilot-tools.md, codex-tools.md）也需要更新
