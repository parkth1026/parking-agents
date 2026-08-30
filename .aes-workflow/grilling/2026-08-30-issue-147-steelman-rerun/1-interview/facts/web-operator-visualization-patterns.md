# Web Operator 可视化模式：真实来源、十秒读态与响应式目标

> 只读事实分片；调查日期：2026-08-30。本文不替用户裁决，也不把任何参考界面的样例数据当成 Issue #147 的真实状态。

## 结论先行

1. `aes-workflow` Engineering Console 最值得融合的是：**固定位置的阶段轨、列表直接标出“等谁”、权威来源给出的下一步、逐条 freshness、以及随滚动压缩但不消失的总览**。
2. `aes-worktree-board` 最值得融合的是：**LIVE / SNAPSHOT / DEMO SNAPSHOT 明示、Map/List 共用同一状态源、Worker/Owner 定位、blocked-by 与“完成后解锁”的因果对、registry/transition/verdict 的证据下钻、窄屏 peek sheet → 完整证据的分级升级**。
3. 两个参考都不能直接为当前 prototype 提供 Issue #147 的真实业务样本。现存 board 快照属于 `aes-agents-v2`，现存完整 fixture 属于 `parkth1026/parking-agents` 且只到 45 个 Issue；竖屏工作台的十条 Issue 是明确标为 `DEMO SNAPSHOT` 的合成 coverage fixture。它们只能提供视觉语法和状态覆盖，不能冒充当前 Story 数据。
4. 当前 Web 应采用“**真实骨架 + 明示模拟缺口**”：Issue #147 / dossier / 仓库事实原样还原；真实材料尚未产生的 Attempt、Receipt、QA/Human Test 状态显示 `未产生 / NOT_RUN`；只有为检验交互覆盖而补的状态才标 `SIMULATED`，并与 Current Story 分区，不能影响真实主动作排序。
5. 768×1080 Codex 右侧窄栏应保持 Queue-first：一屏内必须同时看到来源新鲜度、全局主动作及排序理由、六阶段固定轨和至少 5 条 Action；Map 保持第二视图。宽屏再展开为持久 Inspector / RepoLane 矩阵，不反转主次。

## 一、直接证据：参考界面为什么“读得快”

### 1. Engineering Console：把事实、下一步和阶段放在稳定位置

| 直接模式 | 代码证据 | 可复用价值 |
| --- | --- | --- |
| 数据由 exporter 先解析仓库、Git 与 Junction，再将 JSON 交给页面；页面不自行猜真相 | `G:/GIT/AI_WorkFlow/aes-workflow/skills/engineering/aes-using-workflow/console/template.html:1111-1119` | Web 只是权威状态的呈现层，避免 Router/页面各算一份并漂移 |
| 快照带 `generated_at`；页面可在只读授权后比较文件 mtime，并显式报告 newer / unreadable / blindDirs | 同文件 `:1176-1195` | freshness 不只是“最后刷新时间”，还要能说明哪些来源无法验证 |
| 左侧一行同时给出 kind、status、created、短 id、“等人/等 agent”、剩余人工核对数和九段微型进度 | 同文件 `:3375-3380`、`:3518-3554` | 用户不必逐条展开就能找到“现在等我做什么” |
| “下一步”不由页面重算，直接显示工具导出的 `suggest_next` 结果 | 同文件 `:3527-3533` | 主动作排序必须引用 authority 输出和理由，而不是 UI 猜测 |
| 阶段轨固定九个产出阶段，状态以形状/颜色/文字表达；滚动后压成 28px 状态条，hover/focus 再显名称 | 同文件 `:151-196`、`:1138-1153` | 固定位置形成肌肉记忆；压缩的是视觉密度，不是语义 |
| 窄于 1180px 时阶段轨横向滚动并保证每格至少 128px，不把长状态压成不可读碎片；小于 1100px 时左栏变抽屉 | 同文件 `:1016-1035` | 当阶段很多时宁可局部滚动，也不制造页面级横向溢出 |
| 总览卡把目标、路线、工程下一步和 stale 数量放在同一块；决策图作为进一步查看入口 | 同文件 `:3925-3966` | “行动工作台主、拓扑图次”已有成熟先例 |

### 2. aes-worktree-board：把状态、阻塞、Owner、后果、证据连在一起

| 直接模式 | 代码证据 | 可复用价值 |
| --- | --- | --- |
| 顶部同时显示 Map/List、LIVE/SNAPSHOT、ORCH 状态、全仓进度；快照模式禁用写动作 | `G:/GIT/AI_WorkFlow/parking-agents/skills/workflow/aes-worktree-board/board.html:207-219`、`:838-854`、`:995-1003` | 一眼区分“能否相信/能否操作”，防止演示页伪装现场 |
| Issue List 按 已探明/进行中/可开工/被阻塞 四列降维；Map 与 List 共享搜索/过滤状态 | 同文件 `:820-830`；交互同源断言见 `scripts/selftest-board-ui.mjs:251-275` | 拓扑和队列可切换，但不得产生两个互相矛盾的状态源 |
| Worker 卡直接展示位置、运行态、dirty、assessment stale、Task 状态、BLOCK 次数、三维 verdict、model tier | `board.html:794-815` | 跨 RepoLane 的“谁在做、做到哪、证据是否可信”应在列表层可扫读 |
| 详情把当前状态、branch、blockedBy（来路）、完成后解锁（后果）、registry Task、nextAction、verdict、transition history 放在一条因果链里 | `board.html:880-897` | Inspector 应回答：现在是什么 → 为什么 → 卡谁 → 解锁谁 → 下一步是什么 |
| assessment 不是永久真相；若最新 commit/Task 晚于 assessedAt 就打 stale，且 stale 只提示、不推进门禁 | `scripts/collect.mjs:497-507`；`docs/research/aes-worktree-board-星图与Issue关系数据面-2026-08-29.md:96-102` | “旧结论”必须可见但失去权威，不可继续当 PASS |
| 状态快照绑定 `generatedAt + repo.root/name/mainBranch/mainHead/issueRepo + orchestration + graph + worktrees + transitions` | `scripts/collect.mjs:702-717` | provenance 条应至少能回溯仓库、Issue 源、HEAD、采集时刻与运行记录 |
| Live Issue 事实来自 `gh issue list`；fixture 有显式 loader；`--no-gh` 才回退旧快照 | `scripts/collect.mjs:366-410`、`:459-470`、`:611-618` | UI 必须展示本次究竟来自 live、captured fixture 还是 cached snapshot |

### 3. 窄屏交互：参考中已经被机械验证的部分

`aes-worktree-board` 的竖屏工作台不是只画一张图：它有 44px 控件、状态过滤、Map/List、搜索、Runner drawer、174px peek sheet、展开到最多 68vh 的完整证据层，以及 Escape/焦点恢复。对应结构与响应式规则在 `board.html:228-420`，交互在 `:450-490`。

测试真源锁定为 700×1000，并对 640×960、768×1024 做相邻布局 smoke；700×1000 下断言无 document overflow、无 console error，且真实点击覆盖一跳展开、List→Map、Runner 定位、搜索/过滤同源、键盘、Escape 和 ARIA。证据：

- `G:/GIT/AI_WorkFlow/parking-agents/skills/workflow/aes-worktree-board/scripts/selftest-board-ui.mjs:1-45`
- 同文件 `:140-233`、`:251-330`
- 同文件 `:500-552`（mock 与产品同一运行截图做零像素 diff，并生成绑定 commit/mock SHA/浏览器环境的 receipt）

这说明可融合的不是“星图外观”本身，而是**同一选中态贯穿 Map/List/Inspector、低层 peek 不遮挡主任务、复杂证据才升级、以及可重复的截图与交互验收**。

## 二、真实数据与模拟数据的严格边界

### 1. 现有参考数据的事实身份

| 数据 | 事实身份 | 能否当 Issue #147 真值 |
| --- | --- | --- |
| `docs/design/design_handoff_issue_starmap/aes-worktree-board-current-status.html` 内嵌 `window.WORKBOARD` | `generatedAt=2026-08-24T18:28:11.369Z`，仓库为 `aes-agents-v2`，Issue 源为 `51world-ai-copilot/aes-agent`；包含真实 Issue/Worktree/registry 快照 | **不能**；仓库和时间都不是当前现场。只可参考数据形状和视觉密度。证据在该文件 `:203-219`，其中状态 JSON 位于 `:219` |
| `fixtures/parking-agents-issues.json` | GitHub 捕获 fixture，`capturedAt=2026-08-25T03:59:46.027Z`，repo=`parkth1026/parking-agents`，45 Issue，并带 issue number integrity hash | **不能**；不是 `parking-agents-manual` 的 Issue #147，而且捕获时间早。证据：该文件 `:1-36`、`:85` |
| `board.html` portrait 的十条 Issue | 设计覆盖 fixture；页面明确写 `DEMO SNAPSHOT`、`MASTER GOAL · 示例运行中`，并含 job/attempt/runner/QA/delivery 等合成状态 | **不能**；只用于确保各种状态能被看见和操作。证据：`board.html:407-440` |
| `portraitData(board)` 映射 live/snapshot board | 真实 board 只提供的字段按原值映射；缺少 job/attempt/model/candidate 等就保留空，review/QA/delivery 明示 `NOT_RUN`；只有合法 live 才显示 LIVE | **可以作为方法参考**；不能自动补出当前 Story 未产生的事实。证据：`board.html:1074-1124` |

### 2. 当前 prototype 应采用的五级来源标签

每个可见状态和 Inspector 字段都应带机器可读的 `sourceClass`，并在人能看到的 provenance 区汇总：

| 标签 | 含义 | 允许影响主动作排序 | 显示规则 |
| --- | --- | --- | --- |
| `ISSUE` | 当前 Issue 的原始字段、正文、AC、关系、更新时间 | 是 | 展示 Issue 编号/URL 或 artifact id、采集时间 |
| `DOSSIER` | 当前 workflow 的 manifest、rounds、context、已确认 prototype/contract 记录 | 是 | 展示相对路径、revision/round、读取时间 |
| `REPO` | Repo Registry、HEAD、dirty、worktree/task/receipt 等现场事实 | 是 | 展示 repo、lane、commit/receipt id、observedAt |
| `DERIVED` | 由已公开、确定性的 Router/Gate 规则推导 | 是，但必须展示 rule id 和输入 | Inspector 显示“由什么规则、从哪些事实推导” |
| `SIMULATED` | 为覆盖未发生状态而补的交互样本 | **否**，不可改变 Current Story 的 Pulse/排名 | 必须有 `SIMULATED` 条纹/徽章、模拟原因和缺失的真实来源；只出现在 Coverage Scenario |

对于没有真实材料的字段，优先显示 `未产生 / NOT_RUN`，而不是补一段看似可信的英文 Receipt。`aes-worktree-board` 已有对应机械断言：未领取 Job 的 Issue 详情必须显示 `未产生 / NOT_RUN`，见 `selftest-board-ui.mjs:187-202`。

### 3. 推荐的数据组织方式：真实 Story 与 coverage 场景彻底分开

- **Current Story**：只用 Issue #147、当前 dossier 和当前 Repo Registry 能证明的内容。它决定 Pulse、六阶段、RepoLane、Action Queue 和 Inspector。
- **Coverage Scenario**：仅在“示例状态”切换后出现，用少量合成数据补足 Human Test、Waiver、quorum、stale Receipt、跨 Lane 阻塞等尚未真实发生的状态；整个视图持续显示 `SIMULATED · 不代表 Issue #147 当前状态`。
- 不要在同一张 Action Queue 里把真实行和模拟行混排后只放一个小脚注。人在十秒扫读时会默认所有高亮状态都是真的。
- 模拟记录也要说明“为什么模拟”：例如 `真实 Issue 尚无 HumanTestReceipt；此记录仅验证 Review Workspace 的 quorum/撤销布局`。

## 三、应融合的十秒读态可视化

### P0：始终可见的 Truth Strip

在 shell 下放一条不超过两行的 provenance strip：

- `CURRENT STORY / SNAPSHOT / DEMO` 三者只能选一个主模式；不能同时出现模糊的“Prototype live”。
- 显示 Issue、dossier revision/round、repo/HEAD、observedAt 与 age。
- 汇总覆盖：`真实来源 n · 确定性推导 n · NOT_RUN n · 模拟 n`。
- 任一来源 stale/unreadable/subject mismatch 时整条变成 warning，并列出影响范围；不能只改一个不起眼的小圆点。

这是用户判断“页面是否在 YY”的第一证据，应先于标题和装饰性 KPI。

### P0：Story Pulse 必须形成完整的行动句

Pulse 不是一组无关 chip，应以固定顺序表达：

1. **当前状态**：Story 当前公共阶段和 Gate。
2. **阻塞**：哪个 Receipt/Gate/Lane 使它不能继续。
3. **Owner**：当前唯一责任方；若无人认领则显式 `UNASSIGNED`。
4. **后果**：不处理会阻塞哪个阶段/RepoLane/用户承诺。
5. **下一安全动作**：引用 Router/Gate 的 authority 输出。
6. **为什么排第一**：可展开 ranking facts（风险、时效、解锁数、是否人工等待）。

这一结构综合了 Console 的权威 `next` 与 Board 的 `blockedBy → 完成后解锁`，比只显示“状态 + 按钮”更可操作。

### P0：Queue row 在一行内回答六件事

每条 Action 至少包含：`priority / action / owner / RepoLane / blocking consequence / freshness`。状态不可只靠颜色：

- Blocked：虚线边 + `BLOCKED` 文本 + blocker id。
- 等人：琥珀标记 + `WAITING HUMAN` + 等待时长。
- Stale：斜纹或虚线 + `STALE since …`。
- Safe parallel：单独的浅底队列，并显示为何与主动作无写冲突。
- N/A：中性空心标记，绝不能与 NOT_RUN 或 PASS 共用颜色。

### P1：固定六阶段 + RepoLane 对齐矩阵

- 六个 Story 公共阶段始终固定为 `Discovery / Contract / Delivery / QA / Integration / Closeout`，不因 Profile 缺阶段而移动；不适用显示 `N/A`。
- 阶段轨只回答 Story 级“到哪了”；RepoLane 矩阵在其下用同样六列回答各 Lane 的映射。这样既保留跨 Story 位置稳定，又不假装每个 Profile 生命周期完全一致。
- 每个 Lane 行首固定显示 repo、branch/HEAD、owner、freshness；阶段格只显示最强信号（状态 + Receipt 数/失败数）。详细证据进 Inspector。
- 阻塞跨 Lane 时用一条轻量 connector 或 `→ backend/QA` 文本即可；不要把完整星图搬回主工作台。

### P1：Inspector 的证据顺序固定

Inspector 依次展示：`Now → Why → Consequence → Next → Source → History`。简单可逆动作停留在 peek/Inspector；Human Test、Waiver、quorum、证据对照才进入 Review Workspace。返回时恢复 selection、scroll、focus 和当前视图。

### P1：视觉语言沿用“温暖纸面 + 精确控制台”，不复制装饰

可融合：暖灰纸面、深墨文字、砖橙主动作、紫色进行中、琥珀人工等待、虚线 blocked/stale、mono provenance、serif 标题，以及 150–280ms 的选择/展开过渡。颜色必须同时配文字或形状，并支持 `prefers-reduced-motion`。

不应融合：Google Fonts 外链、8.5–10px 的大面积正文、纯色圆点独立承担语义、无来源的百分比 KPI。当前本地 prototype 应保持离线可用，字体使用本地可用的明确栈或随 artifact 打包的授权字体。

## 四、不应照搬的模式

1. **不要 Map-first**：Board 的星图适合探索依赖，但用户已选择工作台主、Map 第二视图。中心性/degree 也不等于操作优先级。
2. **不要把 OPEN/CLOSED 派生四态当 Story 生命周期**：Board 的 `resolved/claimed/blocked/frontier` 是 Issue 图派生值，规则见 `scripts/collect.mjs:510-562`；它不能替代六阶段、Gate、Receipt freshness 或 Story Contract。
3. **不要把 portrait 十条 fixture 复制成当前数据**：它是优秀的 coverage set，但其中 `job-58`、`qa-ui-7`、candidate SHA 等都是合成叙事。
4. **不要把“已完成 Issue x/y”当 Ready**：数量进度与门禁完成是正交维度；必须同时展示 Gate/Receipt/NOT_RUN。
5. **不要让 UI 重算 next action**：Console 已记录过页面与工具重复算法会给出相反结论。UI 可解释、排序和呈现 authority 输出，但不能另造一套 Router。
6. **不要在 768 宽度照搬桌面悬浮面板**：Board 的 wide 版右侧 workers/details 会挤占主画布；窄屏应升级为抽屉或底部 sheet。
7. **不要以模拟数据追求“看起来忙”**：真实现场没有 Attempt/Receipt 时，空白不是缺陷；`NOT_RUN + 为什么未产生 + 下一步如何产生` 比虚构完整链更可信。

## 五、可验证布局目标

### 768×1080（Codex 对话左、Web 右的主场景）

| 目标 | 可机械验证的阈值 |
| --- | --- |
| 页面边界 | `documentElement.scrollWidth === clientWidth === 768`；无页面级横向滚动 |
| Truth Strip | 默认态完全可见；包含 mode、Issue、observedAt/age、真实/模拟/NOT_RUN 计数；高度不超过 56px |
| 十秒主信息 | 视口 y≤320 内出现完整主动作、Owner、阻塞后果和“为何第一”入口 |
| 六阶段 | 同一行固定顺序，无换行/重排；单格可点击面积至少 44px 高；`N/A` 有独立文字/形状 |
| Queue-first | Action Queue 起点 y≤430；Inspector 收起时首屏至少完整看见 5 条真实 Action；每条高度≤72px |
| RepoLane | 首屏至少看见所有 Lane 的行头或 rail；更多阶段细节可横向局部滚动，但 body 不滚动 |
| Inspector | 收起态 56–72px，不遮主动作；展开≤40vh；Escape 收起并恢复触发点焦点 |
| 复杂 Review | 进入专用 workspace 后仍无横向溢出；测试用例 rail 可折叠；返回恢复 view/selection/scroll/focus |
| 可访问性 | 主按钮/触点≥44×44；正文≥13px、元数据≥11px；颜色之外有文本/轮廓；键盘完成主路径 |

建议的垂直预算不是固定像素稿，但应能通过几何断言：Shell 44–48、Truth 40–56、Pulse 120–150、阶段轨 72–88，Queue 在约 340–420px 开始，底部留 64px Inspector peek。这样 1080 高度足够容纳 5–7 条 64–72px Action，而不需要把字体压到不可读。

### 宽屏（建议用 1440×900 与 1920×1080 两档）

| 目标 | 可机械验证的阈值 |
| --- | --- |
| 主结构 | 1440 起采用 `导航/队列 280–320px + 工作台 minmax(640px,1fr) + Inspector 320–380px`；任何主列不小于 320px |
| 首屏密度 | 不滚动即可看到 Truth Strip、Pulse、完整六阶段、至少 8 条 Action 或全部当前 Action |
| RepoLane 矩阵 | 六阶段列与 Lane 行同屏，不以缩小字体换空间；Inspector 打开不覆盖矩阵 |
| Map | 仅第二视图占用中间主区；切换前后的 filter、selection、Inspector 对象保持同源 |
| 空间利用 | 不把 768 版简单居中成 700px 小岛；宽屏增加的是并列信息与证据，不是无意义留白 |

## 六、浏览器交互验收路径

下一轮真实浏览器 QA 至少逐项执行并留下截图/几何/console 证据：

1. 768×1080 打开默认 Workbench：先读 mode/provenance，再在十秒内回答“当前状态、谁阻塞、后果、下一步”。
2. 点击主动作排名理由，再点击第二条真实 Action：Inspector 的 source/subject/age 必须随选择变化，不能残留上一条详情。
3. 切换六阶段中的 `Closeout`：RepoLane `N/A` 的解释必须可达，且不被误读为 PASS。
4. 打开 Safe Parallel 队列：每项显示无冲突理由；关闭后主动作仍保持。
5. 打开 Human Test Review Workspace：录入 Actual、选择 verdict、查看证据、返回；selection/scroll/focus 恢复。
6. Map ↔ Workbench 往返：相同 filter/selection 对应同一对象；Map 不产生第二份状态。
7. 键盘完成选择、Inspector、Review、返回；Escape 逐层关闭；焦点不掉到页面顶部。
8. 在 601、720、768、820、900、1440、1920 宽度断言无 body overflow、无裁切、无 console error；另做 reduced-motion 与 200% zoom 人工验收。
9. 对每张截图同时记录 scenario id、viewport、mode、source snapshot id、HEAD/subject、observedAt；仅截图本身不能证明数据真实。

## 证据边界与信心

- **高信心事实**：上述源码、fixture header、测试断言直接证明参考产品如何标来源、freshness、状态、详情和窄屏交互。
- **高信心限制**：本地现存 board 快照/fixture 都不是当前 Issue #147 的权威数据；portrait 十条记录是 DEMO fixture。
- **设计推断**：Truth Strip、五级 sourceClass、Current Story/Coverage Scenario 分区、768/宽屏阈值是基于上述证据与本轮已锁定的 Workbench-first / Queue-first / 固定六阶段决策提出的产品化融合方案，不是参考源码已有功能。
- **未在本事实分片验证**：当前 `v3-product-prototype.html` 是否已真实绑定 Issue #147、真实浏览器交互是否达标、当前截图是否存在视觉裁切。这三项必须由主 Agent 针对当前 artifact 另做 provenance audit 和浏览器实操，不能从参考代码推定。
