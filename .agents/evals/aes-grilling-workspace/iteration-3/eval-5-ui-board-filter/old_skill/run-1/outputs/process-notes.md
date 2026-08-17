# 流程记录（process-notes.md）

- 执行的技能：skill-snapshot-v2/SKILL.md（AES 目标对齐，纯文本变体，5 阶段）。技能文件与 references/、scripts/ 只读，未修改。
- 目标仓库：old_skill/run-1/workdir（team-board，8 个文件的静态看板 + Node 原生服务）。
- 模拟用户：按 run-1/PERSONA.md 作答；未覆盖项按运行规则选执行方推荐项。全部交互见 outputs/questions.md。

## 阶段执行与轮次

### 阶段 1：调查事实（0 轮用户交互）

宿主直接读完仓库全部 8 个文件（README.md、package.json、docs/testing.md、src/server.mjs、public/index.html、public/app.js、public/style.css、test/run-tests.mjs）。仓库极小、事实问题互相关联，未派遣 subagent（技能允许宿主自行完成调查）。

查清的 Fact：
- 任务数据形状 {id, title, assignee, status}，种子负责人 ayan/bo/chen；前端纯静态 JS 按 status 分三列渲染。
- 当前无任何 URL 参数 / 本地存储状态逻辑。
- 验证基建（固定必查项）：`npm test`（node test/run-tests.mjs，退出码 0 为过）；docs/testing.md 约定页面改动用 `npm start` + 浏览器人工验证；无 CI、无视觉回归工具、无仓库级规则文件（CLAUDE.md/AGENTS.md 不存在）。

归类：
- Fact：上述全部仓库事实（已告知用户，不占提问轮次）。
- User decision：持久/分享语义、单选或多选、筛选维度范围、空态行为（4 项）。
- Agent-owned：控件形态与摆放位置、URL 参数编码细节、空态样式、过滤逻辑模块化。
- Blocked：无。

### 阶段 2：批量问清歧义（1 轮）

先给完整推荐候选（Goal / In / Out / AC 方向）作为靶子，再一轮问全 4 个互不依赖的 User decision（Q1 持久与分享、Q2 单选/多选、Q3 筛选维度、Q4 空态）。宿主无 AskUserQuestion 工具，按技能约定退化为编号文本，一次发全。每题附证据摘要、互斥选项、推荐项与真实代价。

回答：Q1=URL 查询参数、Q2=单选、Q3=只按负责人（均由 PERSONA 直接覆盖）；Q4=空态提示「没有匹配的任务」（PERSONA 文本问答未覆盖 → 选推荐项）。

轮后逐维度自评：Intent / Outcome / Boundary / Constraints / Context 全部已定。收口审计通过：剩余问题只改措辞或属 Agent-owned。默认一轮，未追加提问，判定不进第二轮。

### 阶段 3：对齐验收标准（1 轮）

一次列出 6 条 AC 草案并明示可一次回复完，逐条交裁决。Verify 来源均为默认档（仓库最佳实践）：AC-06 用 [A] `npm test`（基建存在且判据无歧义，自动采用）；AC-01 至 AC-05 用 [C]（docs/testing.md 明确页面改动以人工浏览器验证为约定）。升级条件逐项核对均未命中：[A] 基建存在；不涉及真实数据/外部系统；无数字门槛。无 [B] 档，故无 fixture / Deliverables 需求。用户按 PERSONA「验收跟仓库测试约定走，你推荐什么就是什么」全部接受，AC 一轮定稿，未暴露新的材料歧义，未回退阶段 2。

### 阶段 4：形成并确认 Contract（1 轮）

读取 references/goal-contract-template.md 严格按其生成候选（可选节：保留 Read First 与 Iteration Strategy，省略 Deliverables——无 [B] 档，Success Criteria 已点名全部产物）。向用户展示完整候选与 Goal / In-Out / AC / Blocker 摘要，用户确认后落盘：

- workdir/docs/goal-contracts/2026-08-07-board-assignee-filter.md（Status: Ready，6 条 AC，无 Blocker）。

判定说明：PERSONA 的三条「界面示意」意见（控件放顶部工具栏右侧、清除筛选按钮、空态文案）触发条件是给用户看网页/HTML/图。本技能为纯文本变体、无 mock 阶段，未展示界面示意，该反馈路径未触发。其中空态文案经 Q4 推荐项进入 AC-04；「回到全部」经 AC-02 覆盖；控件摆放位置按本技能归为 Agent-owned，未进入契约。

### 阶段 5：校验与交接（0 轮）

运行 scripts/validate-goal-contract.ps1：第 1 次即 VALID，exit 0，无 ERROR / WARNING（完整输出见 validation.txt）。未降低规则、未修改重跑。

## 最终状态

- Contract：Ready
- 绝对路径：G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\aes-grilling-workspace\iteration-3\eval-5-ui-board-filter\old_skill\run-1\workdir\docs\goal-contracts\2026-08-07-board-assignee-filter.md
- Goal：看板按负责人筛选卡片，三列只显示该负责人任务；筛选入 URL，刷新保持、链接可分享。
- In/Out：见契约 Scope；AC 数量：6；校验：VALID / exit 0。
- 未实现任何需求代码，未做 git 提交。

## 启动指令（按 references/handoff-prompt.md 变体一生成）

```text
按 G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\aes-grilling-workspace\iteration-3\eval-5-ui-board-filter\old_skill\run-1\workdir\docs\goal-contracts\2026-08-07-board-assignee-filter.md 执行。

这份 Goal Contract 是本次需求的唯一权威。先完整读它。其中 Agent Mandate 一节写明了你
可以自己决定什么、必须回来问什么、不能做什么，按它执行。

仓库里查得到的事实自己查，不要回来问我。

完成实现，逐条跑通 Success Criteria 里的 Verify，review 最终 diff，在不改变行为的前提下
simplify。然后按 Completion 的 Final report 要求落盘报告：每条 AC 的 Verify 证据、改动的
文件和剩余风险。

全部 AC 满足之前不要停，也不要只交一份计划。

某条 AC 确实做不到时，把其余部分做完，然后单独说明是哪条、卡在哪里、需要什么才能解开。
不要因为一条卡住就停下整件事，也不要悄悄降低那条的标准。
```
