# parking-agents

> 个人 VS Code Copilot 定制工具箱。Agents / skills / 工具链，攒一点记一点，**体系未完成，随用随加**。

## 目录结构

```
.copilot/
├── agents/        # 自建 agent（编排器 + 专用 subagent）
├── skills/        # 自建 + 移植的 skills
├── agents/eval/   # 行为评估脚本（从 debug-logs 提取 + 断言）
└── agents/insight/# 使用行为洞察分析（定量 + LLM 语义）
docs/              # 研究笔记
.vscode/           # VS Code 性能优化配置
```

## Agents

**编排器**

| Agent | 说明 |
|-------|------|
| Master | 编排者，琐碎自干 + 实质任务走 Worker→Evaluator 三角验证 |
| Worker | 全能执行器，按契约回报 Result/Claims |
| Evaluator | 只读第二只眼睛，独立验证 Worker 产出 |
| Parking | 薄编排器，全部委派给 Worker |
| SuperPower | skill 驱动编排器，按技能路由 |
| SuperPowerSub | SuperPower 的执行子代理 |
| Karpathy | 遵循 Karpathy 准则的代码 agent |
| Debug | REPRODUCE→ISOLATE→FIX→PROVE 系统化除虫 |
| Simplify | 代码审查：复用 / 质量 / 效率三维审查 |

**工具链 subagent**（`parking-agent-*`）

| Subagent | 说明 |
|----------|------|
| parking-agent-creator | 创建 / 脚手架新的 agent / skill |
| parking-agent-eval | 只读评估：lint、校验、排错 customization 文件 |
| parking-agent-insight | Insight 分析编排：3-phase 管线（提取→语义→报告）|
| parking-agent-analytics | 脚本执行 + 定量分析 + 错误诊断 |

## Skills

**自建**

| Skill | 说明 |
|-------|------|
| cpu-monitor | Windows CPU 采样 + WMI 诊断（不经 WMI Provider）|
| gh | GitHub CLI 调用模式 |
| playwright-cli | 浏览器自动化 |
| rust-workflow / rust-workflow-init | Rust 双流开发工作流 |
| shadcn | shadcn/ui 组件管理 |
| react-doctor | React 代码健康度扫描 |
| ps1-creator | PowerShell 脚本创建规范 |
| dev-environment | .NET + 前端一键启动 |
| simplify | 改动代码的复用/质量/效率审查 |
| claude-to-vscode-skill-converter | Claude Code skill → VS Code Copilot 格式 |

**移植**（`mattpocock/`，来自 [Matt Pocock 的 skills](https://github.com/mattpocock)）

`engineering/`（代码）：ask-matt、tdd、diagnosing-bugs、code-review、codebase-design、domain-modeling、implement、improve-codebase-architecture、prototype、research、triage、to-goal-contract、to-spec、to-tickets、wayfinder、resolving-merge-conflicts 等。

`productivity/`（通用）：grill-me、grilling、handoff、teach、writing-great-skills。

## 工具链

**eval**（`.copilot/agents/eval/`）— 从 Copilot debug-logs 提取行为数据，用声明式 YAML 断言验证 agent 合规性。详见该目录 `README.md`。

**insight**（`.copilot/agents/insight/`）— 三阶段管线：定量提取 → LLM 语义分析 → HTML 报告。支持快速模式（零 LLM）和完整模式。详见该目录 `README.md`。

## 安装

把 `.copilot/` 复制或软链到用户级目录：

```powershell
# Windows（junction，推荐）
New-Item -ItemType Junction -Path "$env:USERPROFILE\.copilot\agents" -Target "G:\GIT\parking-agents\.copilot\agents"
New-Item -ItemType Junction -Path "$env:USERPROFILE\.copilot\skills" -Target "G:\GIT\parking-agents\.copilot\skills"
```

```bash
# macOS / Linux
ln -s /path/to/parking-agents/.copilot/agents ~/.copilot/agents
ln -s /path/to/parking-agents/.copilot/skills ~/.copilot/skills
```

软链后 `git pull` 即可同步更新。

## 开发

开发 / 调试 agent / skill 时，阅读 [AGENT_DEVELOPMENT.md](./AGENT_DEVELOPMENT.md)。

---

> 本仓库是个人自用，**体系还在建设中**，内容随实践增删，不保证稳定。
