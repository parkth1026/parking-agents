# 过程说明（aes-grilling，eval-5 team-board 按负责人筛选）

## 走过的步骤

**第 1 步 调查事实（做了）**
读了 `README.md`、`package.json`、`docs/testing.md`、`public/index.html`、`public/app.js`、`public/style.css`、`src/server.mjs`、`test/run-tests.mjs`。
- 固定必查项「验证基建」：`npm test` = `node test/run-tests.mjs`（退出码 0）；页面改动只有人工浏览器验证，**明确没有截图对比或视觉回归工具**。→ 界面类 AC 的默认档只能是 `[C]`，`[A]` 不可用；由于判据无歧义、无数字门槛、无真实数据依赖，验收档位不升级为独立提问。
- 固定必判项「对照物分类」：新增用户可见界面 → 出**界面 mock**；`/api/tasks` 报文与无筛选时的看板呈现均不变，没有今昔差异可列 → **不出行为对照表**（这是分类判定的结果，不是省略）。
- 术语核对：用户口中的「负责人」在仓库里就是 `assignee` 字段，无一词多义，不占提问轮次。
- 没有派 subagent：仓库共 8 个文件、总量极小，宿主直接读完比拆分调查更快，不满足「两个以上互不依赖的事实问题」的并行前提。

**第 2 步 批量问清歧义（做了，1 轮）**
先给完整推荐候选（Goal / In / Out / AC 方向）当靶子，再用 `AskUserQuestion` 一次发 4 题：状态存哪（URL vs localStorage）、过滤在前端还是后端、下拉名单来源、链接里负责人不存在时怎么办。四题互不依赖，都是「不同答案会改变公共行为或边界」的问题。
用户回答后逐维度自评：Intent / Outcome / Boundary / Constraints / Context 全部「已定」，收口审计通过（剩余问题只改措辞）。**没有追加第二轮** —— 追加要有「某个回答解锁了新歧义」的理由，这里没有。

**第 3 步 对齐对照物（做了，界面 mock 两轮）**
v1 草稿放临时目录（未确认不占正式路径），请用户逐处质疑 → 收到三条意见（控件移到顶栏右侧、加清除筛选按钮、加空态文案「没有匹配的任务」）。
v2 照改并补齐三个可切换的关键状态（无筛选 / 筛选中 / 无匹配空态）→ 用户确认。
确认版落到与 Contract 同目录同 slug：`workdir/docs/goal-contracts/2026-08-07-board-assignee-filter-mock.html`，写入 Read First，并在 Agent Mandate 的 Must not 里声明不得修改。
用户「不接受像素级较真」→ 按 SKILL 处理为「不在 Constraints 声明像素级要求」，即执行 Agent 只需结构对照，同时把这句原则写进 Constraints 以免执行侧误判。

**第 4 步 对齐验收标准（做了）**
4a 例子直接取自确认版 mock 的关键状态与交互（走过第 3 步就不重新问一遍）。聚类得 5 条，不预设区间；没有另立「整体与 mock 一致」的结构对照 AC，因为逐点 AC 已覆盖，再立就是同一件事判两遍。
分流：`npm test` 绿 → Completion 的 Quality；`/api/tasks` 报文不变、无筛选时看板与现状一致、单选、无新依赖 → Constraints。两者都不占 AC 编号。
4b 五条一次全列（超过 4 条改用编号文本），每条给 2–3 个互斥口径候选 + 真实代价 + 推荐项，并告知可一次回复完。用户选择「全部按推荐」。

**第 5 步 形成并确认 Contract（做了）**
按 `references/goal-contract-template.md` 生成；展示完整候选与摘要，用户确认后才落盘到 `workdir/docs/goal-contracts/2026-08-07-board-assignee-filter.md`。
可选节：用了 Read First（mock + testing.md）和 Iteration Strategy；**省略 Deliverables** —— 没有 `[B]` 档 fixture，没有必须落盘才能验证的产物，Success Criteria 已点名全部产物。

**第 6 步 校验（做了）**
`pwsh -NoProfile -File .../validate-goal-contract.ps1 -Path <contract>` → `VALID / STATUS: Ready / AC_COUNT: 5 / LINE_COUNT: 66`，退出码 0，无 WARNING。完整输出见 `validation.txt`。

## 跳过 / 未做的部分及原因

- **行为对照表**：第 1 步分类判定为「无既有可观察行为变更」——`/api/tasks` 一字不改，无筛选时看板与现状逐处一致，新增的是纯粹的新能力。没有今昔差异可写的表不制造。
- **subagent 并行调查**：仓库规模不足以拆分，见上。
- **`goal-contract-example.md`**：只在需要校准信息密度时读，本次模板已足够，未读。
- **实现代码**：按任务要求未写任何产品代码，`workdir` 下只新增了 `docs/goal-contracts/` 两个访谈产物，产品文件（public/、src/、test/）零改动。
- **真正的交互式提问**：按评测设定，所有向用户提问 / 展示 / 确认的动作改由 `PERSONA.md` 代答，未覆盖处取推荐项（Q2 / Q3 / Q4 与 4b 全部按推荐）。

## 落盘位置

- 目标仓库内（正式路径）：`workdir/docs/goal-contracts/2026-08-07-board-assignee-filter.md`、`workdir/docs/goal-contracts/2026-08-07-board-assignee-filter-mock.html`
- 评测输出（本目录）：契约副本、确认版 mock 副本、v1 草稿副本、`questions.md`、`validation.txt`、本文件
