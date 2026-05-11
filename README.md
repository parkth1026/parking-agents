# parking-agents

VS Code Copilot 的 **Agents & Skills** 集合 —— 两套可编排的 AI 编程工作流，开箱即用。

---

## 安装

### 方式一：复制文件

将本仓库的 `.copilot/` 目录复制到用户级目录：

```powershell
# Windows
Copy-Item -Recurse .copilot\agents\ $env:USERPROFILE\.copilot\agents\
Copy-Item -Recurse .copilot\skills\ $env:USERPROFILE\.copilot\skills\
```

```bash
# macOS / Linux
cp -r .copilot/agents/ ~/.copilot/agents/
cp -r .copilot/skills/ ~/.copilot/skills/
```

### 方式二：符号链接（推荐）

使用 junction（Windows）或 symlink 链接到本仓库，后续 `git pull` 即可同步更新：

```powershell
# Windows（需管理员权限）
New-Item -ItemType Junction -Path "$env:USERPROFILE\.copilot\agents" -Target "D:\GIT\parking-agents\.copilot\agents"
New-Item -ItemType Junction -Path "$env:USERPROFILE\.copilot\skills" -Target "D:\GIT\parking-agents\.copilot\skills"
```

```bash
# macOS / Linux
ln -s /path/to/parking-agents/.copilot/agents ~/.copilot/agents
ln -s /path/to/parking-agents/.copilot/skills ~/.copilot/skills
```

> 安装后在 VS Code 中打开 Copilot Chat，即可通过 agent 模式选择 Parking 或 SuperPower。

---

## Parking 体系

**通用型编排器**，适合日常编程任务。

```
Parking（编排）→ Worker（执行）
```

| 角色 | 职责 |
|------|------|
| **Parking** | 意图理解、任务拆分、委派 Worker、结果蒸馏回报用户 |
| **Worker** | 全能执行器：文件读写、终端操作、代码修改、搜索探索 |

Parking 还可按需调度以下**专用 subagent**：

| Subagent | 描述 |
|----------|------|
| **parking-agent-creator** | 创建/脚手架新的 agent 或 skill 文件 |
| **parking-agent-eval** | 只读评估：lint、校验 customization 文件，输出打分 + 修复建议 |
| **parking-agent-insight** | Insight 分析编排：数据提取 → LLM 语义分析 → 叙事 + HTML 报告 |
| **parking-agent-analytics** | 脚本执行 + 定量分析：工具链脚本、HTML 报告、token 统计 |
| **Simplify** | 代码审查与清理：复用性、质量、效率三维审查并自动修复 |

---

## SuperPower 体系

**技能驱动编排器**，适合需要结构化工作流的场景（TDD、调试、计划等）。

```
SuperPower（编排 + 技能路由）→ SuperPowerSub（按技能执行）
```

| 角色 | 职责 |
|------|------|
| **SuperPower** | 识别意图、匹配最佳 skill、委派 SuperPowerSub 并传入 skill 规范 |
| **SuperPowerSub** | 严格按 skill 定义执行，保证流程一致性 |

### Skills 列表

| Skill | 描述 |
|-------|------|
| **brainstorming** | 创作性工作前置探索：需求理解、意图对齐、方案设计 |
| **claude-to-vscode-skill-converter** | Claude Code skill/prompt → VS Code Copilot 格式转换 |
| **dispatching-parallel-agents** | 多个独立任务的并行 subagent 分派策略 |
| **executing-plans** | 按既有计划分步执行，带审查检查点 |
| **finishing-a-development-branch** | 开发完成后的集成决策（merge / PR / cleanup） |
| **requesting-code-review** | 完成任务后触发结构化代码审查 |
| **subagent-driven-development** | 当前会话内基于 subagent 的并行实现执行 |
| **systematic-debugging** | 遇到 bug/失败时的系统化诊断流程（先于修复） |
| **test-driven-development** | TDD 工作流：先写测试再写实现 |
| **verification-before-completion** | 完成声明前的强制验证（跑命令、确认输出） |
| **writing-plans** | 多步任务的实施计划编写（先于编码） |
