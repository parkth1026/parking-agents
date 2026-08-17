# 流程记录（eval-7-mixed-notes-stats / old_skill / run-1）

- 技能：skill-snapshot-v2/SKILL.md（纯文本目标对齐，阶段 1–5），模板 references/goal-contract-template.md，示例 goal-contract-example.md，启动指令 handoff-prompt.md，校验器 scripts/validate-goal-contract.ps1。技能文件只读，未修改。
- 目标仓库：run-1/workdir（notes-tool）。原始请求：加统计功能（每分类条数 + 最近一周新增），只写 goal contract，不写代码。

## 阶段 1：调查事实（宿主直接完成，0 轮提问）

- 判定：仓库共 8 个文件，规模极小，不存在两个以上互不依赖且需要并行的事实问题 → 未派遣 subagent，宿主自行读完 README.md、package.json、docs/testing.md、src/cli.mjs、src/store.mjs、src/web/server.mjs、src/web/public/index.html、test/run-tests.mjs、data/notes.jsonl。
- 固定必查项（验证基建）：`npm test` = node test/run-tests.mjs，退出码 0 为过（docs/testing.md）；网页改动约定为 `npm run web` 人工看，无截图对比/视觉回归工具 → 逻辑类 AC 默认档 [A] 可用，网页展示类 AC 走 [C]。
- 事项归类：
  - Fact：工具形态（CLI add/list + 只读网页 + /api/notes）、数据结构（category/text/created，ISO 时间戳）、验证基建、零外部依赖。
  - User decision：①统计入口（网页/CLI/两者）；②「最近一周」口径（滚动 168h vs 自然周）；③新增数展示粒度（全局总数 vs 分分类）；④边界（标签统计/导出/图表库要不要）。
  - Agent-owned：CLI 子命令名与输出排版、页面路由与视觉呈现、统计计算的代码组织、空数据边界处理。
  - Blocked：无。
- 无术语冲突（用户说的「分类」与仓库 category 字段一一对应）。

## 阶段 2：批量问清歧义（1 轮）

- 4 个独立歧义 ≤ 4，本应用 AskUserQuestion 一次发全；宿主无该工具 → 按 SKILL.md 退化为编号文本，一轮问全（见 questions.md 第 1 轮）。提问前先给出完整推荐候选（Goal/In/Out/AC 方向）作为靶子。
- 回答来源：PERSONA.md 覆盖 ①④；②③未覆盖 → 取推荐项（滚动 168 小时；全局总数）。
- 轮后五维度自评全部「已定」；收口审计通过（新解锁项均为 Agent-owned）→ 不追加轮次，共 1 轮。

## 阶段 3：对齐验收标准（1 轮）

- 起草 AC-01 至 AC-04 一次全列，逐条交裁决并明示可一次回复完。
- Verify 升级条件逐项检查：有 [A] 基建（不命中「无基建」）；无数字门槛（不命中）；数据为仓库内已有 data/notes.jsonl，非外部真实数据（不命中）→ Verify 全部走默认档（仓库最佳实践），未占提问轮次；PERSONA「跟着仓库测试约定走，你推荐什么就是什么」与此一致。
- 未使用 [B] 档 → 无 fixture、无 Deliverables 节。
- 用户 4 条全部接受 → AC 定稿，共 1 轮。起草过程未暴露新的材料歧义，未回阶段 2。

## 阶段 4：形成并确认 Contract（1 轮）

- 读取 goal-contract-template.md 严格按模板生成；参考 example 校准信息密度。可选节使用：Read First（README.md、docs/testing.md，即阶段 1 实际依赖的证据来源）、Iteration Strategy（一句话）；省略 Deliverables（无 [B]）。
- 向用户展示完整候选 + Goal/In/Out/AC/Blocker 摘要 → 用户确认（PERSONA 未覆盖 → 推荐项）→ 落盘：
  - workdir/docs/goal-contracts/2026-08-07-notes-stats.md（Status: Ready，4 条 AC，无 Blocker）。
- 共 1 轮。

## 阶段 5：校验与交接

- 校验命令与完整输出见 validation.txt：VALID / FORMAT: AES Goal Contract B / STATUS: Ready / AC_COUNT: 4 / LINE_COUNT: 62 / 无 WARNING / EXIT CODE: 0。一次通过，未返工。
- 契约原样副本：outputs/2026-08-07-notes-stats.md。
- Ready 启动指令（按 handoff-prompt.md 变体一生成，本次评测只对齐不实现，未启动执行）：

```text
按 G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\aes-grilling-workspace\iteration-3\eval-7-mixed-notes-stats\old_skill\run-1\workdir\docs\goal-contracts\2026-08-07-notes-stats.md 执行。

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

## 执行/跳过判定汇总

- 阶段 1 执行（无 subagent，理由：事实问题不满足并行条件）。
- 阶段 2 执行，1 轮（AskUserQuestion 不可用 → 编号文本）。
- 阶段 3 执行，1 轮（Verify 无升级，默认档）。
- 阶段 4 执行，1 轮（确认后才落盘）。
- 阶段 5 执行（校验一次通过，exit 0）。
- 界面 mock 阶段：不存在于 snapshot-v2 SKILL.md，未执行；PERSONA 的 mock 反馈分支因此未触发（已在 questions.md 记录）。
- 未实现需求代码、未做 git 提交、未修改技能文件。
