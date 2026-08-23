# Goal Contract: 主脑作战台 worktree-board——项目级 skill 自包含的双视图 issue 星图看板与 worktree 调度系统

- Status: Ready
- Target: G:\GIT\AI_WorkFlow\aes-agents-v2（交付落位 `.claude/skills/aes-worktree-board/`；迁移起点 `worktree-board/`）
- Updated: 2026-08-23

## 原始请求

> 我需要你写一个skill，专门负责更新当前仓库下所有worktree当前正在干嘛的状态，正在完成哪个issue或者独立任务，是否完成 是否应当merge到main。核心诉求：通过在主仓库中调用这个技能，检查所有sub-worktree的工作状态并判断是否应当合并。任务完全通过一个主Agent去发送（给所有worktree发任务），另一个是监控任务有没有完成、合并状态。用JSON描述每个结点状态，完成任务时更新JSON。HTML静态解析JSON展现状态，点刷新获得当前状态，不需要后端；有后端更好：1.通过Web看到所有issue的图谱 2.通过图谱点击发送指令让对应worktree干活。
>
> 补充一：我在创建的是一套尽可能一个主脑控制所有其他worktree干活的系统，用户交互只有一个主仓库的agent对话+一个页面，就能达到消化所有需求的目标。有些执行细节我会去worktree的对话去详细决定，但核心还是在主worktree中干活。
>
> 补充二：肯定是 issue 的全景作战图，然后你可以把每个 worktree 当做一个队员（真实的人），然后他在走地图，他走到哪个坐标了这种。
>
> 补充三：G:\GIT\AI_WorkFlow\aes-agents-v2\docs\uiux\design_handoff_issue_starmap 这里有完整的知识图谱的设计页面，你可以参考并改善你的 mock，或者直接替换也可以。

## 目标

用户只守两个界面——主仓 agent 对话 + 一张看板网页——就能读出全仓 issue 地图探明到哪、5 个 worktree 队员各自在哪个坐标干什么，并从任一界面派发 headless 任务、获得可信的合并建议。

## Why

- 现状：worktree 状态散在 5 个目录里，要逐个进去看；issue 全景、谁在做什么、能不能合并没有单一事实源。
- 做到之后：巡检、派活、合并判断全部从主仓单点发起；事实由脚本采集、判断由主 agent 落盘、页面只渲染，三者汇合在一份 status.json v2 上。

## 范围

做：
- 把既有 v1 实现（`worktree-board/`，采集/评估/派发/服务链路已实测可用）演进并整体迁入项目级 skill `.claude/skills/aes-worktree-board/`（自包含：SKILL.md + scripts/ + board.html + runtime/ 生成物）。
- 采集升级：全仓 issue（OPEN+CLOSED）+ body 依赖边解析 + frontier/degree 推导 + reopen 历史⚠回归警示 + worker mode/position/trail 推导 + 评估过期(stale)计算，产出 status.json v2。
- 看板页面重做：纸面 design tokens 双视图——默认图谱视图按 handoff 像素还原（星等半径、状态视觉、worker 名牌旗、hover 邻域高亮、图例过滤、搜索飞行、缩放、Workers 停靠面板、浮动详情面板），地图视图为四列进度轴；LIVE/file:// 快照双模式。
- 派发增强：dirty 二次确认握手（409 → confirmDirty 重试），页面/CLI/对话三入口一致。
- skill（SKILL.md）更新到新落位与新流程：巡检-落盘-汇总表、frontier 派活、独立任务合并降档、dirty 先确认。

不做：
- 不创建、不删除任何 worktree；不执行合并（只建议）；不关闭 issue。
- 不接飞书/系统通知；不做定时自动巡检；不暴露局域网。
- 不建页面浏览器测试基建（AC-002 走 [C]，第 7 轮裁决）。
- 不 commit 任何东西进 git（`.claude/` 整体暂不进 git，进退由用户后续自行处理）。
- 不做 status.json v1 的兼容读取（旧生成物直接废弃）。

## 强约束

- 作用范围：仅 `git worktree list` 中与主仓同级的**既有** worktree（当前 dev1~5）；Temp 等非同级条目排除。
- 合并只建议不执行；issue 关闭不由系统执行；headless 权限 flag（claude `--dangerously-skip-permissions`）为用户既定决策，不得擅改。
- 派发内核保持 v1 行为：PID 存活并发锁、prompt 走 stdin、守护进程写回 tasks/ 三件套（json/log/prompt.txt）；**干净 worktree 的派发请求与响应报文和 v1 逐字节兼容**（握手只在 dirty 时出现；confirmDirty 不绕过并发锁）。
- assess.mjs 的 CLI 参数与 assessment 字段结构不变；collect 重采按节点保留 assessment。
- server 仅绑 127.0.0.1；`GET /api/status`、`POST /api/dispatch`、`GET /api/task/:id` 三端点存续。
- status.json v2 的字段、闭集与推导规则以 `../2-prototype/api-mock.md`「已锁定的约定」为准；页面只渲染、不得二次推导 derived/stale/mode。
- 运行时零 npm 依赖（Node 内置模块）；页面为无构建单文件（Google Fonts 外链允许，断网退化系统字体）。
- board.config.json 现有字段（mainBranch/issueRepo/port/defaultAgent/agents）原样有效。
- run.toml 与 .gitignore 恢复原样后不再改动（v1 遗留改动撤销即 `git diff --quiet` 可过）。
- **确认版对照物不可修改**：`../2-prototype/{mock.html, behavior.md, api-mock.md, example-run.md, diagram.html}`；视觉像素规格源 `docs/uiux/design_handoff_issue_starmap/`（README.md 与设计稿）同样不可修改。执行 Agent 改的是产品，不是尺子。

## 自主边界

不用问，直接定：
- 脚本内部结构与文件拆分、页面 JS 组织方式、selftest 断言的实现细节与临时文件命名。
- 力导向布局参数与节点防重叠微调（不越出 handoff 的语义与像素规格）。
- gh 调用的并发、重试、缓存策略（fast 模式语义不变即可）。
- 日志与报错措辞、CLI 输出的列宽与对齐。

必须停下来问：
- 改 status.json v2 契约字段/闭集、改 API 端点或报文形态。
- 新增任何 npm 依赖；改 headless 权限 flag。
- 任何 `git commit`/`git push`；创建或删除 worktree。
- 修改确认版对照物或 handoff 设计文件。

## 读什么

- `../2-prototype/behavior.md` — 14 条变化行 + 不变清单 + 配置差异（迁移路径的权威表）。
- `../2-prototype/api-mock.md` — status.json v2 与 API 契约、已锁定约定（推导规则全在此）。
- `../2-prototype/mock.html` — 页面确认版（AC-002 的 [C] 尺子；文末注释含 v4 变更清单）。
- `../2-prototype/example-run.md` — 6 个场景（AC-006 汇总表格式、v1 冒烟保活样例）。
- `../2-prototype/diagram.html` — 架构拓扑、删除清单（run 动词/用户级 skill/顶级目录）。
- `docs/uiux/design_handoff_issue_starmap/README.md` — 图谱视图像素规格源（节点半径公式、颜色、交互 1-7、design tokens）。
- `worktree-board/` — v1 实现（迁移起点；collect/assess/dispatch/server 链路已实测，dispatch 的 stdin/PID 锁/cmd shim 解析等 Windows 细节直接复用）。

## 要落盘的东西

- D-01: `.claude/skills/aes-worktree-board/scripts/selftest.mjs` — 分域自检入口（`collect` / `dispatch` / `server` / `layout` 四个子命令，各自退出码 0/非 0），断言点由对应 AC 文本锁定。dispatch 域的 dirty 模拟 = 在一个空闲同级 worktree 创建临时未跟踪文件跑真实握手，测毕删除（第 7 轮 Q2 裁决）。

## 验收条件

- AC-001: `collect.mjs` 产出合法 status.json v2：全量 issue（OPEN+CLOSED）与依赖边；`derived.status/degree/warn`、`mode/position/trail`、`assessment.stale` 全部符合 api-mock「已锁定的约定」的闭集与推导规则；stats 与节点自洽；重采保留 assessment。
  - Verify: [A] `node .claude/skills/aes-worktree-board/scripts/selftest.mjs collect` → 0（断言至少含：schemaVersion=2；issues 数 = gh 全量数；derived.status 闭集且抽样复算一致；degree=无向边数；warn 仅出现在有 reopen 历史的 CLOSED；mode 三态推导；position 闭集 issue|none；stale 时间戳规则；stats 计数与节点一致；写入旧 assessment 后重采仍在）
- AC-002: 看板页面与确认版 mock 逐状态一致：双视图切换；图谱视图按 handoff 规格（星等半径公式、四态节点视觉、⚠回归环、背景星、贝塞尔边与阻塞链虚线、worker 名牌旗恒亮且 claimed 淡出下限 0.5、hover 150ms 邻域高亮、图例点击过滤、搜索飞行+闪烁、缩放 25%–400% 且 <60% 隐藏 resolved 标签、Workers 停靠面板含 dirty/过期徽标与 ⌖、浮动详情面板含完成后解锁/查看运行日志/打开 issue、dirty 确认弹层、评估过期标记）；地图视图四列纸面化。
  - Verify: [C] 起 server 后对照 `../2-prototype/mock.html`（含其文末变更清单）与 handoff README「Interactions & Behavior」1-7 逐项检查；每项记录通过/不通过（第 7 轮 Q1 裁决：人工对照，主 agent 可用内置浏览器半自动执行）
- AC-003: 派发链路：干净 worktree 派发报文与 v1 逐字节兼容且任务走完 running→done 三件套落盘；dirty 目标首次 409 `DIRTY` 并带 dirty 计数，`confirmDirty:true` 重试执行；运行中任务再派返回 409 `LOCKED` 且 confirmDirty 不能绕过；CLI 对 dirty 目标默认拒绝、`--confirm-dirty` 放行；test agent 冒烟原样可跑。
  - Verify: [A] `node .claude/skills/aes-worktree-board/scripts/selftest.mjs dispatch` → 0（用 test agent 与临时未跟踪文件模拟，断言上述五点与报文字段=api-mock 形态）
- AC-004: server 三端点可用：`/` 返回页面、`/api/status?fast=1` 不触发 gh 且沿用缓存 issue 详情、`/api/task/:id` 返回 task+logTail 且不存在时 404 形态正确；双击 board.html（file://）进入只读快照模式（读 runtime/status.js，派发控件降级为提示）。
  - Verify: [A] `node .claude/skills/aes-worktree-board/scripts/selftest.mjs server` → 0（临时端口起服断言三端点与 fast 语义）；[C] 双击 board.html 确认快照模式徽标与只读降级
- AC-005: 落位迁移完成且自包含：`.claude/skills/aes-worktree-board/` 下存在 SKILL.md、scripts/{collect,assess,dispatch,server,selftest}.mjs、board.html、board.config.json；`worktree-board/` 顶级目录不存在；`git diff --quiet -- run.toml .gitignore` 通过；用户级 `~/.claude/skills/aes-worktree-board/` 不存在；`.claude/launch.json` 指向新 server 路径。
  - Verify: [A] `node .claude/skills/aes-worktree-board/scripts/selftest.mjs layout` → 0
- AC-006: skill 巡检纪律成立：主仓对话触发巡检后，输出 `../2-prototype/example-run.md` 场景 2 格式的汇总表（位置列 #N/未在场、frontier 清单、空闲队员），每个节点的评估经 assess.mjs 落盘且与表格一致；对无 issue 的独立任务分支，合并建议最高 not-yet 且 reason 注明需补 issue。
  - Verify: [C] 演练一次巡检对话对照场景 2；抽查 status.json 的 assessment 与表格一致；构造（或口述模拟）一个无 issue 分支场景确认降档措辞

## 挡着的事

- None.

## 残留风险

- codex 命令模板 flag 凭记忆预置（`codex exec --dangerously-bypass-approvals-and-sandbox -`），未现场核对 — 错了会怎样：首次真实派 codex 失败；按约定先跑 `codex exec --help` 核对再用，修正即可。
- 依赖边只解析 issue body 的书写惯例（blocked by #N / depends on #N / 依赖 #N / task-list） — 错了会怎样：漏写依赖的 issue 被误判 frontier，派活判断偏差；靠 issue 书写纪律收敛，无技术兜底。

## 访谈记录

共 7 轮问答的聚合定稿，被否决的候选保留。

### 第 1 轮（需求访谈：4 问 + 默认区 6 条）

| 问题 | 候选（当时百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| 图谱本体 | A 全景OPEN图+视图切换 45% / B worktree中心视图 30% / C 全景含CLOSED 25% | A | **自定义推翻**：issue 全景作战图 + worktree 当队员走地图（overturned） |
| 工作最小单位 | A 并存，合并强制补issue 50% / B 一律先挂issue 35% / C 完全自由 15% | A | A |
| 交互会话并发防线 | A dirty即二次确认 55% / B 手动占用开关 25% / C 不设防 20% | A | A |
| 评估陈旧 | A 页面自动标过期 55% / B 看时间戳自判 25% / C 定时自动巡检 20% | A | A |

默认区（未反对）：仅绑 127.0.0.1；tasks/ 只增不清；生成物不进 git；不接通知；codex flag 首用前核对；worktrees/ 空目录不动。

### 第 2 轮（确认区 7 条 + 依赖边默认）

| 定了什么 | 档 | 用户 |
| --- | --- | --- |
| 工具代码进 git 提交 main | 确认 | **翻掉**：整套作为项目级 skill，暂不进 git，后续自行搬出（overturned） |
| recommend=issue 全 CLOSED+无冲突+无脏 | 确认 | 同意 |
| 脚本通用零 aes 硬编码 | 确认 | 同意 |
| issue 关闭不由系统执行 | 确认 | 同意 |
| 地图=OPEN 亮星+CLOSED 暗星+依赖边 | 确认 | **修改**：显示方式完全参考 wayfinder-maps（overturned；后续第 4 轮又被 handoff 取代） |
| 队员位置=正在做的 issue 坐标 | 确认 | 同意 |
| frontier 高亮作派活依据 | 确认 | 同意 |
| 依赖边解析 blocked by/depends on/依赖/task-list | 默认 | 未反对 |

### 第 3 轮（落位默认）：整套自包含进 `.claude/skills/aes-worktree-board/`，撤销 run.toml 改动，删用户级副本 — 未反对。

### 第 4~6 轮（对照物迭代）

- mock v1（wayfinder 暗色星空）→ 用户否：动画牺牲直观性，要 Obsidian 式可见性第一。
- mock v2（四列地图）→ 用户：此视图保留，另需知识图谱视图，双视图切换。
- mock v3（暗色双视图）→ 用户提供 `docs/uiux/design_handoff_issue_starmap` 高保真交接稿（米白纸面），视觉基准整体替换（overturned 第 2 轮的 wayfinder 裁决）。
- 对账 handoff 后四项裁决：dock 替代横排名册（同意）；✋=手动推进而非 handoff 字面的「等待确认」（同意）；「打开 PR」→「打开 issue」（同意）；⚠回归警示数据源=issue reopen 历史（同意）。默认区：main 基地与常显轨迹按 handoff 砍掉；详情面板浮动白卡盖住 dock；完成后解锁块+运行日志按钮加入。
- mock v4 + 四份文字稿 v2 → 用户确认锁版。

### 第 7 轮（验收深度）

| 问题 | 候选 | 用户选了 |
| --- | --- | --- |
| AC-002 页面验收深度 | A [C] 人工对照 mock 55% / B [A] 新建 playwright 基建 45% | A |
| AC-003 dirty 自动化 | A 临时文件模拟 60% / B dirty 走[C] 25% / C --simulate-dirty 开关 15% | A |

默认区（未反对）：[A] 统一挂 selftest.mjs；对照物不可修改进强约束；残留风险两条。

## 设计取舍

### D-1 视觉基准

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A wayfinder 暗色星空复刻 | 移植其 canvas 星图与动效 | 动画多、坐标语义弱 | 用户否：动画牺牲直观性 |
| B（选定）用户自产 handoff 纸面 Obsidian 风 | 按 README 像素还原 | 需重做 v1~v3 的视觉层 | 无 |
| C v1 worktree 环形图 | 保持现状 | 无 issue 全景 | 覆盖不了「所有 issue 的图谱」诉求 |

选定 B。理由：handoff 是用户亲手在设计工具里定稿的高保真产物，规格完备（半径公式/淡出值/tokens 俱全），比任何转述都准。落进契约的形态：强约束「handoff 目录不可修改」+ AC-002 以其为尺。

### D-2 页面验收深度

[C] 人工对照（选定） vs [A] 先建 playwright 基建：55/45 真两难，用户裁决取 [C]——页面改动频率低、主 agent 可用内置浏览器半自动执行，把基建成本省给功能本身。代价（无自动化反驳）已在交接面点名。

### D-3 dirty 握手验证

临时文件模拟（选定） vs 人工 [C] vs `--simulate-dirty` 开关：选真实握手不污染生产 CLI；代价是 selftest 期间目标 worktree 短暂 dirty，测毕清理。
