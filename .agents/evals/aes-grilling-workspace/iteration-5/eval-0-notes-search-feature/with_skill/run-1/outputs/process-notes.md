# 流程执行记录（aes-grilling · notes-cli 搜索功能）

## 走过的步骤

| SKILL 步骤 | 是否执行 | 做了什么 / 跳过原因 |
| --- | --- | --- |
| 1. 调查事实 | 执行 | 读 `fixtures/notes-cli/notes.py` 与 `README.md`；扫全仓确认无 tests/CI/lint；探测 Python 3.13.12 + pytest 9.0.2 可用；确认 `DB_PATH` 硬编码影响测试隔离。未派 subagent——仓库只有 2 个文件，并行调查的开销大于收益。 |
| 1b. 对照物分类 | 执行 | 「独立子命令 vs 改 `list`」在请求里读不出来 ⇒ 按 SKILL 归为 User decision，作为轮次 1 的 Q1。用户选独立子命令 ⇒ 现有行为零今昔差异 ⇒ **不出行为对照表**；但 `search` 的终端输出是新增用户可见输出面 ⇒ **出 mock**。 |
| 2. 批量问清歧义 | 执行 | 宿主无 `AskUserQuestion` 且独立歧义有 7 个 ⇒ 编号文本一次全列。提问前先给完整候选草案（Goal / In / Out / AC 方向）作靶子。 |
| 2b. 追加轮次 | **跳过** | 轮次 1 的回答没有解锁任何会改变执行的新歧义；五个维度均为「已定」，收口审计通过。剩余问题只影响措辞，按 SKILL「不为流程制造提问」不追加。 |
| 3. 对齐对照物 | 执行 | 草稿先落临时目录，用户确认后才占用正式路径 `docs/goal-contracts/2026-08-07-notes-search-mock.html`。6 个关键状态 + 不变清单表。 |
| 4a. 收集判定例子 | 执行（复用） | 直接取 mock 的 6 个状态作为例子，未重新问一遍（走过第 3 步的需求例子已在手）。 |
| 4. 聚类定条数 | 执行 | 6 个例子聚成 4 簇 ⇒ 4 条 AC。三个信号自查：未超 6 簇（无需拆契约）、簇内例子同源、每条 AC 都至少挂 1 个例子。「测试全绿」归 Completion Quality，「现有 4 命令不变 / 数据结构不变 / 不修对齐缺陷」归 Constraints，均不占 AC 编号。 |
| 4b. 逐条带候选批量提问 | 执行 | 5 题（4 条 AC 口径 + 1 个整体验证方式）一次发全。因仓库零测试基建，「怎么算过」按 SKILL 强制升级为用户决定；`[B]` 档的数据来源 / 脱敏 / 期望基准 / fixture 位置在同一批一次问全。 |
| 5. 形成并确认 Contract | 执行 | 按 `references/goal-contract-template.md` 生成；先展示完整候选取得确认，再落盘 `docs/goal-contracts/2026-08-07-notes-search.md`。用了可选节 Read First（指路 notes.py 与确认版 mock）、Deliverables（`[B]` fixture）、Iteration Strategy。 |
| 6. 校验与交接 | 执行 | `validate-goal-contract.ps1` → `VALID / STATUS: Ready / AC_COUNT: 4 / LINE_COUNT: 69`，退出码 0，无 WARNING。 |
| 实现需求本身 | **跳过** | 任务明确要求先不写代码；SKILL 亦声明本 Skill 不实现 Contract 中的目标。产品代码 `notes.py` 未改动。 |

## 几个判断的理由

- **为什么出 mock 而不是行为对照表**：本次不改任何现有命令，没有今昔差异可对照；但 `search` 的终端输出（表头、列宽、空结果形态、退出码）是全新的用户可见输出面，用具体样例对齐比用文字描述可靠得多。mock 用终端样式渲染，对齐的是结构与状态，不是像素。
- **为什么把「对齐缺陷不修」写进 Constraints**：`notes.py:55` 用字符数而非显示宽度补空格，中文标题会错位。执行 Agent 很可能顺手「修好」，那会让 `search` 与 `list` 的输出分叉——这是「不许变什么」，方向与 AC 相反，所以进 Constraints 不占 AC 编号。
- **为什么 AC-04 单独用 `[B]`**：格式一致性是逐字节的事，用断言描述会退化成「差不多一样」；落盘期望文件让改格式必须显式更新期望，阻力本身就是保护。
- **Status = Ready 的依据**：五个维度全部已定，AC 定稿且每条落在明确档位，无客观 Blocker，无访谈上下文的执行 Agent 读 Contract 即可执行到全部 AC 满足。

## 落盘产物（目标仓库内）

- `workdir/docs/goal-contracts/2026-08-07-notes-search.md`
- `workdir/docs/goal-contracts/2026-08-07-notes-search-mock.html`

未改动 `workdir/fixtures/notes-cli/` 下任何产品代码。

## 交接指令（按 references/handoff-prompt.md 变体一）

```text
按 <workdir 绝对路径>/docs/goal-contracts/2026-08-07-notes-search.md 执行。

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
