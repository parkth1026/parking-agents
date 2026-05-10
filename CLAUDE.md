# CLAUDE.md
 
> 本仓库用于开发 VS Code Copilot 的 **agents** 与 **skills**。

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

## 🎯 测试与运行 agent 时

CLAUDE.md 故意保持精简，**避免在 agent 实际工作时被自动注入大量开发文档**导致上下文污染。

如需开发指引，按上方链接查阅 [AGENT_DEVELOPMENT.md](./AGENT_DEVELOPMENT.md)。
