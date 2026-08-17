# 过程记录：走 SKILL.md 各阶段的实际情况

## 依据

- 流程文档：`.claude/skills/aes-grilling/SKILL.md`（当前工作区未提交的最新版）
- 配套文档：`references/work-item-shape.md`、`references/interview-and-design.md`、
  `references/work-item-example.md`、`scripts/validate-acceptance.mjs`、
  `references/handoff-prompt.md`（全部读过）
- 模拟用户画像：`workdir/PERSONA.md`
- 工作目录（当作真实仓库根）：`workdir/`

## 第 1 步：调查事实 — 完整执行

读了 `README.md`、`docs/testing.md`、`package.json`、`public/index.html`、
`public/app.js`、`public/style.css`、`src/server.mjs`、`test/run-tests.mjs`。
判定了两件固定要查的事：

1. 验证基建：`npm test`（`node:assert`，退出码判定）+ 无视觉回归/无浏览器
   自动化依赖，`docs/testing.md` 明确写着页面改动靠人工。这个清单成为第 4
   步 Verify 候选池。
2. 对照物分类：新增用户可见界面 → 需要 mock；不改变现有可观察行为
   （未筛选时现状不变）→ 不需要行为对照表。

**未使用 subagent 做并行调查**：本次事实调查项之间彼此依赖（都要读同一批
小文件才能判定测试基建和对照物分类），文件总量小（8 个文件，最大的不到
30 行），不构成「两个以上互不依赖的事实问题」，派 subagent 并行反而增加
往返成本，所以由当前宿主 Agent 直接调查完成，符合 SKILL.md「无法使用
subagent 时自行完成调查」以及「只调查会改变……的事实」的范围限定。

## 第 2 步：批量问清歧义 — 完整执行

`AskUserQuestion` 工具在本次可用工具列表里不存在（当前宿主环境未接入），
按 SKILL.md「宿主没有该工具时退化为编号文本，提问范围不变」的规定，改用
编号文本一次发全。第 1 轮 4 题，都是会改变范围或验证机制的材料歧义（筛选
维度、单选/多选、URL vs 账号级持久化、卡片是否顺带改动），不是可调查事实
或表面选项。

自评五维度（意图/结果/边界/约束/现状），确认无「未定」项后收口，进入第 3 步。
未额外发起第 2 轮，因为第 1 轮回答（对照画像）没有解锁新的材料歧义——画像
本身在开场陈述里已经把范围边界说得很完整，第 1 轮问答起到的是「正式过一遍
候选、留痕」的作用，而不是挖出新信息。

## 第 3 步：对齐对照物 — 完整执行

判定为「界面向，只出 mock，不出行为对照表」，理由见上。产出 v1 草稿（暂存
在 scratchpad，未落盘），展示给用户（按画像）后拿到三条意见（控件挪到工具
栏右侧、加清除筛选按钮、加空态文案），改出 v2 并直接落盘为确认版
`workflow/board-assignee-filter/mock.html`。v1 没有落盘到任务目录，符合
SKILL.md「未确认的草稿放临时目录，不占用该路径」。

v2 展示后用户（按画像）确认通过、未再提新意见，同时确认「不接受像素级
较真」，这条写进了 `work-item.md` AC-001 的 Verify 说明，没有写进「强约束」
——它是验收判定口径，不是不可变的现有行为，避免把两类信息混进同一节。

## 第 4 步：对齐验收条件 — 完整执行

4a：因为走过第 3 步，例子直接取自 mock 的关键状态与交互（控件位置/选项、
筛选生效、清除筛选、空态文案），没有另外发散问「验收标准是什么」。

4b：五条候选逐条给出「后果 + 验证途径 + 真实代价」，编号文本一次发全（5 条
超过 `AskUserQuestion` 4 题上限，按规定改用编号文本）。用户（按画像）原话
是「跟着仓库测试约定走，你推荐什么就是什么」，所以五条都落在推荐档位，
但仍然逐条把候选、代价写出来留痕，而不是直接把结论当定稿——这是为了满足
SKILL.md「给定稿求确认只暴露结论，带候选才暴露排除了什么」的要求，即使
最终用户全盘接受推荐，过程记录里也留着「AC-001/003/004/005 为什么没选
[A]（新增浏览器自动化基建代价过高）」这类否决理由。

聚类结果 5 条 AC，在 1–7 条区间内，未拆分任务。

## 第 5 步：落盘 — 完整执行

三份记录 + mock.html 落到 `workdir/workflow/board-assignee-filter/`：

- `work-item.md`：四个摘要标题（目标/范围/强约束/验收条件）只放访谈定死
  的东西，标题名未改动、未译成英文。
- `interview.md`：完整记录查到的事实、两轮问答（含被否决的候选）、对照物
  迭代、验收对齐、收口判定。`dependencies.artifacts` 为空，不被下游引用。
- `design.md`：两个关键决策（D-1 客户端 vs 服务端过滤、D-2 URL vs
  localStorage vs 服务端账号持久化），每个都有「什么都不做」选项、代价、
  否决理由。`dependencies.artifacts` 引用了 `interview.md` 并带 digest。
  用户（按画像）认可后把 `result` 从 `proposed` 改成 `accepted`。
- `mock.html`：确认版界面对照物，落盘前的 v1 草稿只存在于 scratchpad。

`work-item.md` 的 `work_item_contract_digest` 是四个摘要小节文本（目标+
范围+强约束+验收条件，按此顺序拼接）的 SHA-256，`interview.md`/`design.md`
头部字段引用同一个 digest；`design.md` 引用 `interview.md` 时也附带其内容
的 SHA-256。`artifact_id`/`work_item_id` 用 ULID 格式的占位 ID（本次没有
真实的工作流工具生成器可调用，手写但保持格式合规：`wi_`/`ar_` 前缀 + 26
位大写字母数字）。

## 第 6 步：校验与交接 — 完整执行

跑了：

```bash
node "<skill-dir>/scripts/validate-acceptance.mjs" "workflow/board-assignee-filter/work-item.md"
```

退出码 0，`AC_COUNT: 5`，无 ERROR、无 WARNING。完整命令与输出见
`outputs/validation.txt`。

未生成 handoff 启动指令文本作为独立交付物，因为任务描述明确「不要实现任何
产品代码……只做需求梳理与产出记录」，`handoff-prompt.md` 的模板已读过、
理解了变体一的用法，但本次任务只要求产出记录并跑校验，未要求真的把启动
指令发给某个执行 Agent；`work-item.md` 里没有「挡着的事」，如果确实要交接，
直接套用变体一模板、把路径换成
`workdir/workflow/board-assignee-filter/work-item.md` 即可。

## 跳过的部分与原因

- 未使用 `AskUserQuestion` 工具本身：工具不在本次可用列表里，按 SKILL.md
  规定退化为编号文本，不算跳过流程要求的步骤。
- 未派遣 subagent 做事实调查：事实调查范围小且互相依赖，不满足「两个以上
  互不依赖的事实问题」的并行派遣前提。
- 未产出行为对照表：第 1 步判定本次不改变任何现有可观察行为，按 SKILL.md
  「两者皆无……跳过第 3 步」的对应部分（本次是「有 mock 无对照表」的子情形，
  不是整个跳过第 3 步）。
- 未新建测试基建（Playwright/Puppeteer/jsdom）：这是验收候选阶段摆出来给
  用户比较代价的选项之一，用户按推荐选择了人工验证 [C]，不是被省略，而是
  被摆出来后没被选中。
- 未实现任何产品代码：任务要求明确排除，未触碰 `src/`、`public/`。
