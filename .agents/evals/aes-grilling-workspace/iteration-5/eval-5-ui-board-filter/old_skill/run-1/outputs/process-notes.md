# 过程记录（走了哪几步、跳过了什么）

执行依据：`skill-snapshot-v4/SKILL.md`（含 references/、scripts/）。目标仓库根 = `run-1/workdir`。全程未写产品代码。

## 第 1 步 调查事实 — 走了

- 读全了目标仓库的 5 个源文件加 2 份文档：`README.md`、`docs/testing.md`、`package.json`、`src/server.mjs`、`public/index.html`、`public/app.js`、`public/style.css`。
- 固定项一（验证基建）：`npm test` → `node test/run-tests.mjs`，退出码 0 为过；页面改动靠 `npm start` 后人工浏览器验证；无截图对比 / 视觉回归工具。这直接决定了第 4 步 AC-07 只能停在 `[C]`，不能升级 `[A]`。
- 固定项二（对照物分类）：新增用户可见界面 → 出界面 mock；无既有可观察行为需要今昔对照（页面此前不读 URL 参数，`/api/tasks` 契约不变）→ 不出行为对照表。
- **跳过：并行 subagent 只读调查。** 理由：目标仓库总共 7 个文件、单人 10 分钟可读完，宿主直接读完成本低于派遣与汇总；SKILL 允许「无法/不需要使用 subagent 时自行完成调查」。

## 第 2 步 批量问清歧义 — 走了，1 轮

- 独立歧义 7 个（> 4），按 SKILL 规定改用编号文本一次全列，未拆成多轮。提问前先给出完整推荐候选（Goal / In / Out / AC 方向）当靶子。
- 每题给了证据摘要、2 到 4 个互斥选项、推荐项与真实代价。
- 可调查事实（负责人取值、现有渲染方式、测试命令）已在第 1 步查清并告知，未占提问轮次。
- **跳过：追加第二轮提问。** 理由：五个维度自评全部「已定」，收口审计通过——剩余问题（控件宽度、文案措辞、history push/replace）不同答案只改措辞或属于 `Agent-owned`。SKILL 明确「默认就一轮，追加要有理由」。

## 第 3 步 对齐对照物 — 走了（界面 mock，2 轮迭代）

- v1 草案放临时目录（scratchpad），不占用正式路径；用户提出三条修改（控件移到顶栏右侧、加「清除筛选」按钮、加空态文案「没有匹配的任务」）。
- v2 按三条改完后用户确认通过，确认版落盘到与契约同目录同 slug：`docs/goal-contracts/2026-08-07-board-assignee-filter-mock.html`，路径写入 Read First 并被 AC-07 引用。
- **跳过：行为对照表。** 理由见第 1 步分类——本次没有需要今昔对照的既有公共行为。
- 用户「不接受像素级较真」的表态按 SKILL 写进了 Constraints（不做像素级还原）。

## 第 4 步 对齐验收标准 — 走了

- 7 条 AC 一次全列，逐条交裁决并明确告知可以一次回复完；用户全部接受。
- Verify 来源：AC-06 走默认档（仓库既有 `npm test`，判据无歧义，不占提问轮次）；其余走 `[C]` 可复现操作步骤。
- **跳过：`[B]` 黄金用例与「怎么算过」升级提问。** 理由：不涉及真实数据、外部系统或数字门槛，`[A]` 基建存在且可用，三项升级条件一个都没命中。
- 走过第 3 步，故按 SKILL 强制加入 mock 对照 AC（AC-07），Verify 写明 mock 路径；因无视觉回归基建，保持 `[C]` 未升级 `[A]`；确认版 mock 在 Agent Mandate 的 Must not 中声明为不可修改。

## 第 5 步 形成并确认 Contract — 走了

- 严格按 `references/goal-contract-template.md` 生成，仅照 `goal-contract-example.md` 校准了信息密度。
- 用了可选节 Read First（mock + testing.md）与 Iteration Strategy；**未用 Deliverables**，因为没有 `[B]` fixture，Success Criteria 已点名全部产物。
- 展示完整候选并取得用户确认后才落盘：`docs/goal-contracts/2026-08-07-board-assignee-filter.md`，Status `Ready`（无 Blocker）。

## 第 6 步 校验与交接 — 走了

- `pwsh -NoProfile -File …\scripts\validate-goal-contract.ps1 -Path <契约>` → `VALID / STATUS: Ready / AC_COUNT: 7 / LINE_COUNT: 70`，退出码 0，零 WARNING，一次通过未返工。完整输出见 `validation.txt`。
- **未执行：启动执行 Agent。** 用户明确「先不要写代码」，本次只交付契约。启动指令按 `references/handoff-prompt.md` 变体一生成，见下。

## 可复制的启动指令（用户要动手时再用）

```text
按 G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\aes-grilling-workspace\iteration-5\eval-5-ui-board-filter\old_skill\run-1\workdir\docs\goal-contracts\2026-08-07-board-assignee-filter.md 执行。

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

## 未改动确认

`workdir` 下的产品代码（`src/`、`public/`、`test/`、`package.json`）零改动；新增文件只有 `docs/goal-contracts/` 下的契约与确认版 mock。
