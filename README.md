# parking-agents

VS Code Copilot 的 **Agents & Skills** 开发仓库 —— 构建可编排、可复用的 AI 编程工作流。

---

## Agent 体系概览

本仓库采用 **编排器 + 执行器** 的分层架构，主 agent 负责意图理解与任务分派，subagent 负责实际执行。

### 核心编排链

| 编排器 | 执行器 | 职责 |
|--------|--------|------|
| **Parking** | **Worker** | 通用编程任务。Parking 解析意图、委派 Worker 执行全部文件/终端操作，结果蒸馏后回报用户 |
| **SuperPower** | **SuperPowerSub** | 技能驱动的结构化工作流。SuperPower 匹配技能并委派，SuperPowerSub 按 skill 规范严格执行 |

### 专用 Subagent

| Agent | 一句话描述 |
|-------|-----------|
| **parking-agent-creator** | 创建/脚手架新的 agent 或 skill 文件（规范内置，不修改不评估） |
| **parking-agent-eval** | 只读评估：lint、校验、排错 customization 文件，输出打分表 + 修复建议 |
| **parking-agent-insight** | Insight 分析编排器：3-phase 管线（数据提取 → LLM 语义 facets → 叙事 + HTML 报告） |
| **parking-agent-analytics** | 脚本执行 + 定量分析：运行工具链脚本、生成 HTML 报告、token 统计、错误诊断 |
| **Simplify** | 代码审查与清理：对 diff 进行复用性、质量、效率三维并行审查并自动修复 |

---

## Skills 库

`.copilot/skills/` 下的可用技能（由 SuperPower 编排调用）：

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

---

## 目录结构

```
.copilot/
  agents/           # Agent 定义文件（.agent.md）
    eval/           # eval 工具链脚本（extract-outputs / run-eval 等）
    insight/        # insight 工具链脚本（analyze / generate-report 等）
  skills/           # Skill 定义目录（每个 skill 一个子目录）
docs/               # 设计文档、研究笔记、分析报告
reports/            # 生成的 insight/eval 报告与缓存数据
AGENT_DEVELOPMENT.md  # Agent/Skill 开发完整指南
CLAUDE.md           # 仓库定位与 subagent 索引（精简版）
```

---

## 开发指引

- **[AGENT_DEVELOPMENT.md](./AGENT_DEVELOPMENT.md)** — 完整开发手册：设计原则、文件规范、工具白名单、故障排查、验收流程
- **[CLAUDE.md](./CLAUDE.md)** — 仓库定位速览与 subagent 索引（刻意精简，避免上下文污染）

> 开发新 agent/skill 时，推荐让主 agent 调用 `parking-agent-creator` subagent，规范已内置。

---

## 快速开始

1. **克隆仓库**到本地工作区
2. 在 VS Code 中打开，确保已安装 GitHub Copilot 扩展
3. 在 Copilot Chat 中切换 agent 模式：
   - `@Parking` — 通用编程任务（推荐默认）
   - `@SuperPower` — 需要结构化技能工作流时使用（TDD、调试、计划等）
4. 描述任务，agent 会自动编排 subagent 完成执行
