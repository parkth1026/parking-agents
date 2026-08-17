# 执行过程记录：技能 description 规范对照（without_skill / run-1）

日期：2026-08-16

## 步骤

1. **列出考察范围**
   - `ls G:/GIT/AI_WorkFlow/parking-agents/.claude/skills/`：共 29 个目录。
   - 逐一检查 SKILL.md 存在性：7 个 `*-workspace` 目录（aes-grilling-workspace、epic-ue-assistant-workspace、jenkins-log-auto-learning-workspace、karpathy-llm-wiki-workspace、ue-error-solver-workspace、workflow-interview-workspace、best-practice-research-workspace）无 SKILL.md，是工作数据目录，排除。best-practice-research-workspace 下的评测产物按任务要求排除。
   - 实际考察 **23 个技能**。

2. **读取全部 description**
   - 用 awk 提取每个 SKILL.md 的 YAML frontmatter，人工通读 23 条 description 原文及 name / disable-model-invocation / argument-hint 等相关字段。

3. **查阅官方规范（3 个来源，交叉确认）**
   - WebFetch https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices （两次：一次总览、一次要求逐句引用）。docs.claude.com 同路径 302 重定向至此。得到：非空、≤1024 字符、无 XML 标签；"what it does + when to use it"；"Always write in third person"（好例 "Processes Excel files…"，坏例 "I can help you…" / "You can use this…"）；"Be specific and include key terms"；空泛反例 "Helps with documents" / "Processes data" / "Does stuff with files"；checklist 两项。
   - 下载官方 skill-creator SKILL.md（GitHub raw 路径 404 后，经 `gh api repos/anthropics/skills/git/trees/main?recursive=1` 定位到 `skills/skill-creator/SKILL.md`，再 `gh api repos/anthropics/skills/contents/...` 取 base64 解码）。得到："description: When to trigger, what it does…All 'when to use' info goes here, not in the body"；对抗 undertrigger 要"pushy"；触发评测优化流程（20 条 should/should-not-trigger 查询、训练/留存集迭代）。
   - WebFetch https://code.claude.com/docs/en/skills 。得到：`disable-model-invocation: true` 时 "Description not in context, full skill loads when you invoke"（description 完全不进模型上下文）；Claude Code 技能列表中 description+when_to_use 合计 1536 字符截断（补充信息）。

4. **量化检查（python 脚本）**
   - 对 23 条 description 做 YAML 解析（处理引号、`|` 字面块、`>` 折叠块三种风格），统计：字符数（Unicode 字符）、是否含 XML 标签（`<[A-Za-z/]...>` 正则）、第一/第二人称模式（I can / You can / 你可以 / 我可以 等）、"when to use"启发式（Use when / 适用于 / 触发 / 当用户 / 在以下场景 等）。
   - 结果：字符数最长 534，全部 < 1024；无 XML 标签；无人称问题；启发式标出 8 个疑似缺 when 的候选，再逐条人工复核（修正了 jenkins-pair-analyze 这类实际已含"用户点名……时"的误报，并确认 aes 三件套只写了编排语境、缺用户侧触发词）。

5. **形成结论并写报告**
   - 逐技能判定分三档：明确不符合 4 个（best-practice-research、aes-grilling-web、rust-workflow-init、simplify——均缺 when to use）；部分符合 3 个（aes-interview、aes-prototype、aes-goal-contract——仅编排语境）；符合 16 个（其中 7 个列为标杆）。
   - 按 disable-model-invocation 与否区分实际危害（可自动触发的缺 when 危害更大），给出 P0–P3 修复优先级与示意改法。
   - 报告写入 `outputs/report.md`。

## 读取的文件

- `G:/GIT/AI_WorkFlow/parking-agents/.claude/skills/*/SKILL.md`（23 个技能的 frontmatter 与 description 原文）
- 目录结构核对：上述 29 个目录（含 7 个无 SKILL.md 的 workspace 目录）

## 引用的网页来源

1. https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices （Anthropic Agent Skills 最佳实践；docs.claude.com 重定向至此）
2. https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md （官方 skill-creator，经 GitHub API 取原文）
3. https://code.claude.com/docs/en/skills （Claude Code Skills 参考：frontmatter 字段与 disable-model-invocation 语义）

## 产物

- `outputs/report.md`：中文对照结论报告（23 技能逐个判定 + 修复优先级 + 引用来源）
