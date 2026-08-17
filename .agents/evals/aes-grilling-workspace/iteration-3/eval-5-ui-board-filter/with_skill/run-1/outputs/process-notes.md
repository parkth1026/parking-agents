# 流程记录（process-notes.md）

评测 run：eval-5-ui-board-filter / with_skill / run-1
技能：aes-grilling（G:\GIT\AI_WorkFlow\aes-workflow\skills\productivity\aes-grilling\SKILL.md，只读遵循）
目标仓库：run-1\workdir（team-board）

## 阶段执行情况

### 第 1 步 调查事实 — 执行（0 轮提问，纯调查）

- 读取 workdir 全部文件：README.md、package.json、src/server.mjs、public/{index.html,app.js,style.css}、test/run-tests.mjs、docs/testing.md。
- 固定事实一（验证基建）：`npm test` = node test/run-tests.mjs，退出码 0 为过；实际运行确认（ok - 2 assertions，EXIT=0）。页面改动按 docs/testing.md 走本地浏览器人工验证；无截图对比/视觉回归工具 → [A] 档对逻辑可用，页面验证默认 [C]，mock 对照 AC 不升级 [A]。
- 固定判定二（界面分类）：请求是给看板加筛选控件，明确界面向（Fact，无需占提问轮次）→ 第 3 步 Mock 必须执行。
- 事实归类：任务数据含 assignee 字段、前端全量渲染、无 URL/存储逻辑 = Fact；持久化方式、单/多选、筛选范围、选项来源 = User decision（前三条改变公共行为，第四条改变可见选项）；控件具体实现、URL 参数名 = Agent-owned；无 Blocked 项。
- 未派遣 subagent：仓库共 8 个小文件，宿主直接查完，不存在需要并行的独立事实问题。

### 第 2 步 批量问清歧义 — 执行（1 轮，4 题）

- 先展示完整推荐候选（Goal/In/Out/AC 方向），再用一轮批量提出 4 个互斥选项问题（宿主无 AskUserQuestion 工具且为模拟评测，按技能规定退化为编号文本一次全列）。
- 回答依据 PERSONA：Q1 URL 查询参数、Q2 单选、Q3 只按负责人（均为 PERSONA 明确覆盖）；Q4 选项来自任务数据去重（PERSONA 未覆盖 → 推荐项）。
- 回答未解锁新的会改变执行的歧义 → 不追加轮次。五维度自评全部「已定」，收口审计通过（详见 questions.md）。

### 第 3 步 对齐界面 Mock — 执行（2 轮）

- 第 1 轮：草稿 v1 落临时目录（scratchpad\board-assignee-filter-mock-draft-v1.html），左侧筛选栏方案，改动点虚线+「新增」角标对照现状。模拟用户按 PERSONA 提三条意见：控件移顶部工具栏右侧、加「清除筛选」按钮、无匹配时空态「没有匹配的任务」。
- 第 2 轮：v2 全部采纳三条意见（空态做成按列显示，PERSONA 未细化 → 推荐项），模拟用户第二次查看确认通过。
- 三条意见均为界面结构/交互层面，未暴露新的材料歧义 → 无需回第 2 步。
- 确认版落盘：workdir\docs\goal-contracts\2026-08-07-board-assignee-filter-mock.html（与契约同目录同 slug）。

### 第 4 步 对齐验收标准 — 执行（1 轮）

- 起草 7 条 AC 一次全列，逐条附 Verify 档位；告知用户可一次回复完。
- Verify 来源判定：仓库基建存在且判据无歧义 → AC-06 默认档 [A]（npm test）；页面类按仓库约定 [C]；mock 对照 AC 按技能要求加入（AC-07，[C]，写明 mock 路径，mock 声明只读）。三个升级条件（无基建 / 真实外部数据 / 数字门槛）均未命中 → Verify 行不占用户裁决。
- 模拟用户回答（PERSONA：验收跟仓库测试约定走，推荐即定）：7 条全部接受，AC 定稿。

### 第 5 步 形成并确认 Contract — 执行（1 轮）

- 读取 goal-contract-template.md 严格按模板生成；Success Criteria 直接用第 4 步定稿。
- Read First：docs/testing.md + 确认版 mock（设计输入，不进 Deliverables）；Must not 写明不得修改确认版 mock。
- 无 [B] 档 fixture → 省略 Deliverables 可选节。
- 展示完整候选与摘要，模拟用户确认（PERSONA 未覆盖 → 推荐项=确认）后落盘：
  workdir\docs\goal-contracts\2026-08-07-board-assignee-filter.md，Status: Ready（歧义判据满足、AC 定稿、无 Blocker）。

### 第 6 步 校验与交接 — 执行

- 校验命令与完整输出见 outputs\validation.txt：VALID，FORMAT: AES Goal Contract B，STATUS: Ready，AC_COUNT: 7，LINE_COUNT: 69，无 WARNING，exit code 0。一次通过，未修改。
- 契约原样副本：outputs\2026-08-07-board-assignee-filter.md。

## 交接启动指令（按 references/handoff-prompt.md 变体一生成，Ready 才启动）

```text
按 G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\aes-grilling-workspace\iteration-3\eval-5-ui-board-filter\with_skill\run-1\workdir\docs\goal-contracts\2026-08-07-board-assignee-filter.md 执行。

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

## 边界遵守

- 技能文件与 references/scripts 只读，未修改。
- 只做需求对齐：未实现筛选功能代码，未做 git 提交。
- 交互总轮次：提问 1 轮 + Mock 2 轮 + AC 1 轮 + Contract 确认 1 轮 = 5 轮，全部如实记录于 questions.md。
