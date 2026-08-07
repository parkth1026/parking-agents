# 流程记录（process-notes.md）

评测 run：eval-7-mixed-notes-stats / with_skill / run-1。技能：aes-grilling（纯文本版）。
用户原始请求：notes-tool 加统计功能（每分类笔记数 + 最近一周新增），先理清需求写 goal contract，不写代码。

## 阶段 1：调查事实（执行，0 轮提问）

- 读取 workdir 全部文件：README.md、package.json、docs/testing.md、src/store.mjs、src/cli.mjs、src/web/server.mjs、src/web/public/index.html、test/run-tests.mjs、data/notes.jsonl。
- 固定事实一（验证基建）：`npm test` → node test/run-tests.mjs，退出码 0 为过；docs/testing.md 载明网页改动本地人工看，无截图对比 / 视觉回归工具。判定：AC 默认档 [A] 可用（npm test）；mock 对照 AC 不可升 [A]，保持 [C]。
- 固定判定二（界面分类）：请求本身读不出偏网页还是偏 CLI（仓库两者都有），归为 User decision，占提问轮次（第 2 阶段 Q1）。用户答「网页统计页 + CLI 简版」→ 判定为混合需求 → 第 3 阶段必须执行。
- 数据模型 Fact：笔记含 category / text / created（ISO 8601），「最近一周新增」可由 created 判定，但窗口口径（滚动/自然周）是 User decision。
- 归类结果：Fact = 仓库结构、测试基建、数据字段；User decision = 展示位置、时间窗口口径、周新增粒度、范围边界（标签/导出/图表库）；Agent-owned = 统计实现方式、CLI 文本排版、页面样式细节；Blocked = 无。
- 未派 subagent：仓库共 9 个小文件，宿主直接读完，无并行调查收益。

## 阶段 2：批量问清歧义（执行，1 轮）

- 先给完整推荐候选（Goal / In / Out / AC 方向），再一次发全 4 个互不依赖的问题（≤4，符合单轮上限；宿主无 AskUserQuestion 工具，退化为编号文本一次全列）。
- 回答后重算歧义地图：无新解锁的执行级歧义，不追加轮次。
- 维度自评：Intent / Outcome / Boundary / Constraints / Context 全部「已定」；收口审计通过（剩余问题只改措辞不改执行）。共 1 轮结束。

## 阶段 3：对齐界面 Mock（执行，混合需求必做，2 轮）

- 时机：材料歧义收口后、起草 AC 前。
- v1 草稿（表格版）落临时目录（scratchpad），不占确认版路径；第一次展示收到 PERSONA 两条意见（横向长条带数字、顶部「近 7 天新增」数字卡片）。
- v2 按意见修改后第二次展示，用户确认通过；确认版落盘 docs/goal-contracts/2026-08-07-notes-stats-mock.html（与 Contract 同 slug）。
- 迭代中无新材料歧义暴露，未回第 2 阶段。
- 用户明确视觉不要求像素级 → 写入 Constraints；mock 对齐的是结构与关键内容。

## 阶段 4：对齐验收标准（执行，1 轮）

- 起草 5 条 AC 一次全列，逐条交裁决并说明可一次回复完。
- Verify 来源判定：仓库基建存在且判据无歧义 → AC-01/02/05 自动采用默认档 [A]（npm test），不占提问轮次；AC-03 mock 对照按规则默认 [C]（无视觉回归基建，不升 [A]）并写明 mock 路径与不可修改；AC-04 双端一致 [C]。
- 升级条件检查：无数字门槛、无真实外部数据依赖、[A] 可用 → 「怎么算过」未升级为独立问题；用户在第 2 轮已表态「跟仓库测试约定走」。未选 [B]，无 fixture 问题需问。
- 用户全部接受，AC 定稿。无新材料歧义，未回第 2 阶段。

## 阶段 5：形成并确认 Contract（执行，1 轮）

- 读取 references/goal-contract-template.md 严格按模板生成；example 用于校准信息密度。
- Read First 写入 docs/testing.md 与确认版 mock 路径；mock 是访谈产物不进 Deliverables，Agent Mandate 的 Must not 写明不得修改 mock。
- 无 [B] 档 → 省略 Deliverables 节；Iteration Strategy 一句话。
- 展示完整候选 + Goal/In/Out/AC/Blocker 摘要，用户确认后落盘 docs/goal-contracts/2026-08-07-notes-stats.md，Status: Ready（歧义判据满足、AC 定稿、无 Blocker）。

## 阶段 6：校验与交接（执行）

- 运行 scripts/validate-goal-contract.ps1 → VALID，STATUS Ready，AC_COUNT 5，LINE_COUNT 65，退出码 0，无 WARNING。完整输出见 validation.txt。
- 未做 git 提交；未实现任何需求代码（仅落盘 mock 与 Contract 两份对齐产物）。
- Ready 启动指令（按 references/handoff-prompt.md 变体一）已可用，contract 绝对路径：
  G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\aes-grilling-workspace\iteration-3\eval-7-mixed-notes-stats\with_skill\run-1\workdir\docs\goal-contracts\2026-08-07-notes-stats.md

## 轮次汇总

- 阶段 1：0 轮（纯调查）；阶段 2：1 轮（4 问）；阶段 3：2 轮（展示→意见→确认）；阶段 4：1 轮（5 条 AC 一次裁决）；阶段 5：1 轮（候选确认）；阶段 6：0 轮。总计 5 轮交互。
