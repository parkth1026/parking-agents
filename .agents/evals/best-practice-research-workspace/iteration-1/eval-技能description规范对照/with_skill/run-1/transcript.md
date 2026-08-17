# 执行过程记录：eval-技能description规范对照 / with_skill / run-1

日期：2026-08-16。所用流程：`best-practice-research` 技能（先读取其 SKILL.md，按其工作流执行：本地事实 → 官方证据 → 综合对照 → 按输出契约产出）。

## 步骤

1. **读取技能文件**：`G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\best-practice-research\SKILL.md`。确认其为只读研究包装：官方/上游证据优先、需引用来源、需区分仓库本地事实与外部最佳实践、按固定 Output Contract 产出。注：该技能默认不改仓库文件，但本次任务明确指定把产物写入本评测工作区（属任务指定的输出路径，非仓库源文件），据此写入 report.md 与本文件。

2. **收集仓库本地事实**：
   - `find .claude/skills -name SKILL.md -not -path "*best-practice-research-workspace*"` → 共 31 个文件（23 个现行技能目录 + `aes-grilling-workspace/` 下 8 个历史快照 skill-snapshot / v2..v7）。
   - 用 awk 提取每个文件的 frontmatter（name / description / disable-model-invocation 等）逐个检视。
   - diff 证实：`skill-snapshot` == `skill-snapshot-v2`（description 178 字符）、`skill-snapshot-v5` == `skill-snapshot-v6`（281 字符）。
   - 用 Node 脚本（按 Unicode 码点）统计每条 description 字符数，并识别 YAML 引号/块标量（`|`、`>`）格式；对解析失败项（快照 v7）单独 Read 文件核实：`description: aes-grilling` + `disable-model-invocation: true`。

3. **收集官方证据**（WebFetch + WebSearch）：
   - `https://code.claude.com/docs/en/skills`（Claude Code 官方 Skills 文档）→ description 是唯一"推荐"frontmatter 字段；省略时用正文首段；description+when_to_use 在技能列表 1536 字符截断、关键用例前置；不触发→补用户自然会说的关键词、误触发→写得更具体；`disable-model-invocation: true` 时 description 不进上下文。
   - `https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices`（首次请求 404、docs.claude.com 302 重试后成功）→ Must be non-empty；Maximum 1,024 characters；Cannot contain XML tags；Should describe what the Skill does and when to use it；"Always write in third person"（注入 system prompt，人称不一致造成发现问题）；好例 `Processes Excel files and generates reports`，反例 `Helps with documents` / `Processes data` / `Does stuff with files`；"Be specific and include key terms"；Claude 从 100+ 技能中按 name+description 挑选。
   - WebSearch 交叉验证 1024 字符上限与第三人称要求确为官方现行表述（社区转载 obra/superpowers 等仅作佐证，未用作判据）。

4. **综合对照**：将 8 条官方判据逐条套到 31 条 description 上。核验结果：非空 / ≤1024 字符（最长 karpathy-llm-wiki 518）/ 无 XML 标签 / 第三人称——31/31 全过；问题集中在内容层：4 个缺 when-to-use（或形同占位符）判"不符合"，7 个判"部分符合/可改进"，16 个判"符合"（含快照 v1–v6）。

5. **产出**：按技能 Output Contract 写出中文对照报告，保存为
   `outputs/report.md`（含总结论、官方判据、硬约束核验表、逐技能三级对照、可直接采用的改写建议、证据与版本上下文、边界与交接）。

## 读过的文件

- `.claude/skills/best-practice-research/SKILL.md`
- `.claude/skills/` 下全部 31 个 SKILL.md 的 frontmatter（含 `aes-grilling-workspace/skill-snapshot{,-v2..v7}/SKILL.md`；其中 skill-snapshot-v7 额外读了正文开头 15 行核实 frontmatter）

## 引用的来源

- [Skill authoring best practices – Claude Platform Docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)（官方，主要判据来源）
- [Agent Skills – Claude Code Docs](https://code.claude.com/docs/en/skills)（官方，宿主行为与排障建议）
- 检索佐证（非判据）：obra/superpowers `anthropic-best-practices.md`（GitHub）等社区转载
