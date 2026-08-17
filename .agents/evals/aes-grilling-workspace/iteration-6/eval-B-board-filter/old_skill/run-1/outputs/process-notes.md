# 过程记录 — 按 SKILL.md（skill-snapshot-v4）执行 team-board 按负责人筛选需求梳理

参照文档：`G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\aes-grilling-workspace\skill-snapshot-v4\SKILL.md`
配套：`references/goal-contract-template.md`、`references/goal-contract-example.md`、
`references/handoff-prompt.md`、`scripts/validate-goal-contract.ps1`。
模拟用户画像：`workdir/PERSONA.md`。

## 实际执行的步骤

### 第 1 步 · 调查事实

- 直接读取仓库文件（不涉及并行调查，问题规模小，宿主自己读完即可，没有创建 subagent；
  按 SKILL.md「无法使用 subagent 时自行完成调查」以及「存在两个以上互不依赖的事实问题
  且可以创建 subagent 时才并行派遣」执行——本次事实问题彼此依赖同一份代码/文档，逐一读
  更直接，未强行拆分 subagent）：
  - `README.md`、`docs/testing.md`、`package.json`：整体架构与测试基建。
  - `src/server.mjs`：后端只有 `/api/tasks`（一次性返回全量任务）和静态文件服务。
  - `public/index.html`、`public/app.js`、`public/style.css`：前端结构与渲染逻辑，确认
    当前没有任何筛选、路由或 URL 状态处理。
  - `test/run-tests.mjs`：确认测试基建只是 `node:assert` 脚本，`npm test` 退出码 0 为过；
    没有 DOM/浏览器测试框架，也没有截图或视觉回归工具。
- 判定「验证基建」：存在（`npm test`），但只覆盖纯逻辑，不覆盖 UI 渲染/交互——这决定了
  第 4 步里 UI 类 AC 默认走 `[C]`，逻辑类 AC 可以走 `[A]`。
- 判定「对照物类型」：请求新增可见界面控件 → 界面 mock 分支。是否同时需要行为对照表，
  取决于是否更改 `/api/tasks` 契约，读不出来，列为第 2 步的用户决定之一。
- 用户请求原文里已经把「刷新后保留」+「分享链接后一致」两条 Outcome 说清楚，这在事实上
  蕴含了「筛选状态必须编码进可分享的 URL」，故未把「用 URL 还是 localStorage」单列成
  问题——按 SKILL.md「能由仓库或环境证据/用户已有陈述回答的事实，查清后写进上下文，不占
  提问轮次」处理。

### 第 2 步 · 批量问清歧义

- 先给出候选草案（Goal 一句话、In/Out 各一句、AC 大致方向），再一次性提出 3 个独立歧义
  （未超过 4 个，未使用 AskUserQuestion 工具——当前宿主环境没有该交互式工具，按 SKILL.md
  「宿主没有该工具时退化为编号文本，提问范围不变」处理，改用编号文本一次列出）：
  1. 筛选是否要求后端 `/api/tasks` 改契约，还是前端对已加载数据过滤；
  2. 负责人下拉选项来源：动态去重 vs 独立人员接口；
  3. assignee 为空（未指派）任务如何处理。
- 三题画像都未覆盖，按任务要求「画像未覆盖的一律选推荐项」全部采纳推荐项。
- 回答后逐维度自评（Intent/Outcome/Boundary/Constraints/Context）全部「已定」，收口审计
  通过，只跑了这一轮，没有追加第二轮——三个问题的答案都不会互相解锁新的材料歧义。

### 第 3 步 · 对齐对照物（界面 Mock）

- 因为不改 `/api/tasks` 契约（第 2 步已定），只落地界面 mock，不产出行为对照表——严格
  按 SKILL.md「新增或改动用户可见界面 → 界面 mock；...两者兼有→各出各的；...」的判定，
  本次落在纯 mock 分支。
- 产出 mock 草稿 v1（未确认，放临时目录，不占契约同目录路径）：
  `C:\Users\parking\AppData\Local\Temp\claude\G--GIT-AI-WorkFlow-parking-agents\1e4150d5-1f49-41d5-b648-852f2b291fc7\scratchpad\mock-draft-v1.html`
  草稿里筛选控件放在看板上方单独一行、没有清除筛选按钮、无空态提示。
- 按画像脚本给出的固定第一轮意见（画像原文明确列出这三条，与草稿 v1 具体呈现无关，是
  画像预先设定好的反馈脚本）修改，产出确认版 v2，落盘到与 Contract 同目录同 slug 的路径：
  `workdir/docs/goal-contracts/2026-08-07-team-board-assignee-filter-mock.html`
- 按画像脚本，第二次查看 v2 后确认通过，不再提新意见——流程到此不再迭代 mock。
- 未在迭代中暴露新的材料歧义，未触发「回第 2 步」。

### 第 4 步 · 对齐验收标准

- 一次性起草 7 条编号 AC，覆盖：默认视图不变（回归防护）、筛选生效、刷新保留、分享一致、
  清除筛选、空态文案、mock 结构对照。
- Verify 档位判定：
  - AC-02（过滤逻辑）判定为可用仓库现成基建覆盖 → `[A] npm test`，不占提问轮次（无数字
    门槛、非外部系统/真实数据、判据无歧义）。
  - 其余 UI 交互类 AC 按仓库既有约定（`docs/testing.md` 明确页面改动走人工验证、没有
    视觉回归工具）→ `[C]`，同样是 Fact，不升级为独立问题。
  - AC-07（mock 对照）按 SKILL.md 默认写法定为 `[C]` 并点名 mock 路径，因为仓库没有截图
    diff/视觉回归基建，不满足升级 `[A]` 的条件。
  - 没有 AC 命中「怎么算过」升级条件（无现成基建缺口、非真实数据/外部系统、无数字门槛），
    因此 Verify 全部由本方起草，没有再单独问用户。
- 按画像「验收方式：跟着仓库测试约定走，你推荐什么就是什么」，用户整体接受 7 条 AC，不改
  措辞、不删、不补。

### 第 5 步 · 形成并确认 Contract

- 读取 `goal-contract-template.md` 并严格按其结构生成；因为对信息密度没有把握不足的地方，
  只快速对照了 `goal-contract-example.md` 一次确认写法（Why 不超 3 条、AC 编号格式等），
  未额外反复读取。
- 落盘路径（与模板要求一致）：
  `workdir/docs/goal-contracts/2026-08-07-team-board-assignee-filter.md`
- Read First 指向确认版 mock 与 `docs/testing.md`；Deliverables 节整体省略——因为没有
  `[B]` 档 Verify，模板允许「Success Criteria 已经点名全部产物时省略」。
- 对照物（mock）在 Agent Mandate 的 Must not 中声明为只读、不得修改，符合 SKILL.md 要求。
- Status 判定为 `Ready`：歧义判据已满足、AC 已定稿、没有 Blocker、按 Contract 内容执行
  Agent 无需访谈上下文即可持续执行到满足全部 AC。
- 按画像确认候选表达了共同理解后落盘。

### 第 6 步 · 校验与交接

- 运行 `pwsh -NoProfile -File "<skill-dir>/scripts/validate-goal-contract.ps1" -Path "<contract-path>"`。
- 第一次运行报错：`Scope requires a meaningful In value.` / `Out value.`——排查后发现是两个
  低级错误：(1) Scope 的 `In`/`Out` 用了全角冒号「：」而校验器正则要求半角 `:`；
  (2) `In:`/`Out:` 内容被我写成跨多行的换行文本，而 `Get-ListValue` 只用
  `^- Key:\s*(\S.*)$` 匹配单行，续行内容取不到。修复方式：把 `In`/`Out`
  以及 Agent Mandate 的三行、Completion 的三行全部改成单行（半角冒号 + 不换行），
  Constraints 的普通 bullet（没有 `Key:` 解析需求）保留原有换行也不受影响。
- 修复后第二次运行：`VALID`，`STATUS: Ready`，`AC_COUNT: 7`，`LINE_COUNT: 85`，
  `EXIT_CODE: 0`，无 WARNING。完整命令与输出见 `outputs/validation.txt`。

## 跳过的内容与原因

- 未创建调查用 subagent：事实调查规模小、彼此依赖同一批文件，直接读取比派遣 subagent
  更快，且不违反 SKILL.md（该步骤是「存在两个以上互不依赖的事实问题且可以创建 subagent
  时」才要求并行派遣，本次事实问题不满足「互不依赖」的前提）。
- 未使用交互式 `AskUserQuestion` 工具：当前环境没有该工具，按 SKILL.md 明确的退化路径
  改用编号文本一次列出，提问范围（一次问完所有独立歧义）未打折扣。
- 未产出行为对照表（`-behavior.md`）：第 1/2 步已判定本次不改变 `/api/tasks` 契约、无
  现有可观察行为的今昔差异需要对照，只落 UI mock，符合 SKILL.md「两者兼有→各出各的；
  两者皆无→跳过」的判定逻辑（本次不属于「两者皆无」，而是单属于界面分支）。
- 未追加第二轮材料歧义提问：第 2 步收口自评五个维度全部「已定」，且回答没有解锁新的
  会改变执行的歧义，按 SKILL.md「默认就一轮」执行。
- 未把 Deliverables 节写进 Contract：模板允许在 Success Criteria 已经点名全部产物、且
  没有 `[B]` 档需要落盘 fixture 时省略；本次全部 AC 是 `[A]`/`[C]`，没有 `[B]`。
- 未实现任何产品代码：按任务要求，本次只做需求梳理与契约产出，未改动 `src/`、`public/`
  等目录下的任何实现文件。
- 未修改 `.claude/skills/aes-grilling-workspace` 之外的仓库其他内容。

## 产物清单

- `workdir/docs/goal-contracts/2026-08-07-team-board-assignee-filter-mock.html`（确认版 mock）
- `workdir/docs/goal-contracts/2026-08-07-team-board-assignee-filter.md`（Goal Contract，Ready）
- `outputs/questions.md`（完整 Q&A 记录）
- `outputs/process-notes.md`（本文件）
- `outputs/validation.txt`（校验命令与输出）
- `outputs/2026-08-07-team-board-assignee-filter.md`、
  `outputs/2026-08-07-team-board-assignee-filter-mock.html`（上述两份产物的副本，便于直接查看）
- 未确认的 mock 草稿 v1（临时目录，不是正式产物）：
  `C:\Users\parking\AppData\Local\Temp\claude\G--GIT-AI-WorkFlow-parking-agents\1e4150d5-1f49-41d5-b648-852f2b291fc7\scratchpad\mock-draft-v1.html`
