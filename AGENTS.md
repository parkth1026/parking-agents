# AGENTS.md

> 本仓库有两部分：`skills/` 是**跨平台技能库**（Claude Code / Codex / Pi）；`.copilot/agents/` 是 **VS Code Copilot agent**。

## ⚠️ Skills 已迁出 `.copilot/`

技能真源现在是仓库根的 **`skills/`**，一层扁平（`skills/<name>/SKILL.md`，禁止更深嵌套 —— 嵌套会让技能在所有平台**静默消失**）。

- 改完技能跑 `npm test` 验证结构
- 技能正文里的 `read_file` / `runSubagent` 等是 **VS Code 工具名当作动作别名**，各平台靠 `skills/using-parking-skills/references/<harness>-tools.md` 翻译
- 增加新平台支持 → [docs/porting-to-a-new-harness.md](./docs/porting-to-a-new-harness.md)


> 你是我的**CTO**,擅长使用**第一性原理**与**行业最佳实践**来制定方案.所有结论必须是**明确证据**支持，不能是臆想，工作量不参与决策。


> git commit message 必须中文，且面向用户的解释，关键参数的修正，针对行业知识的修改。 不能写成改动代码的流水账。



## 📖 开发请阅读

进行 agent / skill **开发、调试、设计、扩展** 时，请阅读：

👉 **[AGENT_DEVELOPMENT.md](./AGENT_DEVELOPMENT.md)**

里面包含：

- 设计总原则（Harness 思维）
- Parking 主 agent 调度铁律
- 工作目录与软链接约定
- 参考仓库（superpowers / mattpocock_skills）
- VS Code Copilot 官方规范与内置 skills 索引
- 文件命名 / YAML frontmatter / 工具白名单速查
- 故障排查 / 冒烟验收 / 版本演进策略

> **优先方案**：开发新 agent / skill 时，让主 agent 调用 `parking-agent-creator` subagent；它已内置全部规范，无需主 agent 加载 [AGENT_DEVELOPMENT.md](./AGENT_DEVELOPMENT.md)。后者作为人读参考保留。

## 🤖 现有 subagent

- **parking-agent-creator** —— 创建 / 脚手架新的 agent / skill。开发新 agent 时主 agent 应**优先调用它**（规范已内置，无需注入 AGENT_DEVELOPMENT.md）。
- **parking-agent-eval** —— 评估 / lint / 排错 customization 文件（read-only，输出打分表 + 修复建议）；运行行为断言测试。
- **parking-agent-insight** —— Insight 分析编排器：编排完整 3-phase 管线，直接执行脚本（Phase 1 数据提取、Phase 3b HTML 报告）和 LLM 语义分析（Phase 2 facets 提取、Phase 3a 叙事生成）。
- **parking-agent-analytics** —— 脚本执行 + 定量分析：运行 insight/eval 工具链脚本、生成 HTML 报告、工具错误诊断、token 消耗统计。

## 🦸 SuperPower Agent 开发规范

### 架构原则

1. **主 Agent（SuperPower）** 是编排器，能委派 subagent 时**必须委派**，自己只做：
   - 意图理解与 skill 路由
   - 需要 `vscode_askQuestions` 的交互型 skill
   - 结果整合与用户确认
2. **执行 Agent（SuperPowerSub）** 是干活的，能根据 skill 定义自己的工作规范
3. 主 agent 应**合理拆分任务**，不能把所有工作丢给一个 subagent 调用

### 任务拆分原则

- 独立的代码修改 → 分别委派
- 有依赖关系的步骤 → 按依赖顺序分批委派
- 单个 subagent 调用范围 ≤ 1 个明确目标
- 避免一个 subagent prompt 超过 500 字

### Skill 同步规范

- `.copilot/agents/superpowers/` 下的文件来源于 [superpowers](https://github.com/…/superpowers) 仓库
- **保持英文原文**，方便未来同步更新
- 仅做最小兼容性修复（TodoWrite→manage_todo_list, Task→runSubagent 等）
- 不翻译、不重组、不改变原文格式

## 🎯 测试与运行 agent 时

AGENTS.md 故意保持精简，**避免在 agent 实际工作时被自动注入大量开发文档**导致上下文污染。

如需开发指引，按上方链接查阅 [AGENT_DEVELOPMENT.md](./AGENT_DEVELOPMENT.md)。
