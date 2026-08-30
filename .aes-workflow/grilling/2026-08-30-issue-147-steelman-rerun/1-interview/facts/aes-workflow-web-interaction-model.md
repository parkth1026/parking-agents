# AES engineering Web 交互与运行状态模型调查

## 调查边界

- 参考仓库：`G:\GIT\AI_WorkFlow\aes-workflow`
- 固定快照：分支 `parking-dev`，HEAD `25cc3ce157bace9b7f813bb2642aca516b2b2af4`
- 主实现：`skills/engineering/aes-using-workflow/console/template.html`、`console/export.py`、`scripts/workflow_tool.py`
- 协议：`skills/engineering/aes-using-workflow/references/protocol.md`
- 测试证据：`tests/console/check.js`、`tests/console/exercise.js`、`tests/console/readonly-check.py`、`tests/skills/aes-workflow/test_workflow.py`
- 本轮只读核对实现、协议和测试源码；没有运行会生成 `workflow/.console/`、截图或浏览器状态的测试。因此下文的“有测试覆盖”表示仓库中存在对应断言，不表示本轮重新跑绿。

## 结论先行

**高置信结论：AES engineering Web 的强项不是“大地图”，而是把一个 Work Item 做成可连续工作的审阅台。** 它先用左栏找任务和“谁在等我”，再用任务总览确认目标与下一步，之后才按需进入决策导航、工程阶段、代码 diff、人工核对或批注发送。Map 是同级的解释视图，不是首屏主角。

**它不能原样充当 workflow-story-map。** 当前页面是一仓多 worktree、单 Work Item 深钻模型；缺少跨 RepoLane 的 Story 聚合、全局 blocker/owner/consequence、真正的 Action Center、事件时间线和 typed command lifecycle。最值得迁移的是信息架构和交互语法，不能照搬 AES 的文件协议、固定阶段、WayFinder ticket、VS Code/本地服务和人工清单写回方式。

## 一、从进入页面到完成下一动作的真实路径

| 步骤 | 用户看到/做什么 | 页面回答的问题 | 直接证据 | 局限 |
| --- | --- | --- | --- | --- |
| 0. 打开控制台 | 启动器先扫描仓库和 sibling worktrees，把数据和 diff 运行时内嵌进单文件页面；标签页标题带仓库名，顶栏显示 repo、生成时间、刷新和“盯住改动” | 我看的是哪个仓库、哪一刻的快照？ | `console/export.py:498-523, 671-711, 738-783, 917-953`；`template.html:1055-1076, 5703-5718` | 不是持续流；默认仍是离线快照，需手动刷新或另行授权检测变更 |
| 1. 扫全局任务 | 左栏任务行同时给 lifecycle 状态、日期、短 ID、关联待办数、等人/等 agent/剩余核对数，以及九阶段微型进度条 | 哪几个任务在跑，哪几个在等我？ | `template.html:3535-3555` | 行上没有 blocker 原因、owner、影响、下一安全动作；“有事要做”排序只是 lifecycle 排序 |
| 2. 收敛目标 | 可按全部/等人/进行中/待人测/已收口/已取消筛选，按最近/最早/标题/有事排序；全仓正文搜索显示命中位置与上下文片段，点击直达具体记录和原文 | 我怎么在大量记录中快速找到有关任务或证据？ | `template.html:3375-3406, 3419-3470, 3567-3592, 3595-3635` | “等人”只覆盖人工核对；WayFinder blocked、stale evidence 等不会自动进入统一 attention queue |
| 3. 进入 Work Item 总览 | 默认总览同时显示契约正文、已有阶段数、frontier 数、未完成导航任务、目标、路线、工程下一步和 stale 数；任务头部常显 status、branch、创建时间、走到哪一步、下一步和“让 agent 去做” | 这件事是什么、现在在哪、接下来做什么？ | `template.html:3918-3966, 4307-4387` | 下一步是人读文本；没有结构化展示 why/owner/consequence/command state |
| 4. 解释为什么卡住 | “决策导航”把当前决策、路线图、当前 frontier 和交接状态拆成三块；点图节点只更新详情，不重建图；详情明确原问题、候选、采用结果、取舍依据、证据和源文件入口 | 为什么走这条路线，当前未知或阻塞是什么，证据在哪？ | `template.html:3765-3916, 4076-4153, 4191-4304`；交互断言见 `tests/console/exercise.js:101-157, 224-357, 571-637` | 这是 AES WayFinder 专属模型，且只覆盖单个 Work Item 内的 route/frontier |
| 5. 核对工程证据 | “工程流程”才显示来源待办、九个产出阶段和衍生待办；阶段卡带 outcome、freshness、依赖 Artifact、头部字段、正文、源文件和被取代版本 | 哪些产出存在、还算不算数、建立在哪些证据上？ | `template.html:3666-3751, 4307-4387, 5113-5132` | 固定阶段和 Markdown Artifact 语义不可泛化为 Story/RepoLane；没有按 Gate 或风险组织证据 |
| 6. 深入代码审查 | 代码审查可按“为什么改”或“按文件看”，显示增删行数、hunk 数、解释缺口、核对进度；支持上下文件、整文件/逐 hunk 核对、split/unified、inline 评论；revision 变化后项目变 stale 并禁用核对动作；大 diff 默认安全摘要 | 具体改了什么、为何改、哪些我已看过、证据是否仍绑定当前版本？ | `template.html:4451-4505, 4845-4968`；断言见 `tests/console/check.js:163-378, 478-778` | 依赖 `change-note + git patch + Pierre`，不是一般 Story evidence viewer |
| 7. 完成人工核对 | 人工清单三态循环 `[ ] → [x] → [!]`，失败时就地记录现象，右栏实时汇总已过/没测/没过；保存后明确告诉人下一步 | 哪些人工项还没测、哪条失败、反馈如何落入事实源？ | `template.html:2242-2267, 2334-2365, 2393-2495`；`protocol.md:452-499` | 这是直接改 `manual-test.md`，不是授权、签名、可撤销的 Human Receipt |
| 8. 把意见或动作交给 agent | 正文批注可拖选或点整段，支持划线/评论/改成/删除/标签、任务级待办和记录总评；右栏汇总未发送意见；“照此推进/发去整改”先打开 modal 预览，再复制给 agent，并标记已导出 | 我如何在证据上下文里表达意见，并避免把没看过的 prompt 直接发出去？ | `template.html:2033-2120, 2915-3051, 3148-3181, 3235-3346, 5152-5210` | “发送”只是复制到剪贴板；页面不 dispatch、不追踪 agent 接收/执行/失败，也不产生权威 command receipt |
| 9. 刷新、恢复、继续 | 视图按 repo 保存任务、view、stage、file、滚动、筛选、排序和搜索词；刷新让本地服务重扫并 reload；授权后可提示记录比快照新、目录无法读取或当前不是主检出 | 离开再回来能否续读？页面是不是旧了？ | `template.html:5395-5500, 5536-5581, 5666-5742`；断言见 `tests/console/check.js:1117-1192` | 检测到 stale 不会自动获取新数据；服务失效时只提示重新打开启动器 |

## 二、页面实际使用的状态 Read Model

### 1. 权威计算在 Python，Web 只投影

协议明确要求 `state.json` 从 Markdown 和代码快照计算，包含 Artifact outcome/freshness、人工计数、`stage` 与给人的 `next`；`next_skill` 是机器字段，`next` 是人读文本，前端不应解析中文（`references/protocol.md:349-375`）。

实际工具也把规则集中在两处：

- `stage_block()` 只从 fresh 且有阶段号的 Artifact 推导 `reached/reached_stage/next_skill/waiting_on`（`scripts/workflow_tool.py:4621-4639`）。
- `suggest_next()` 依次处理 unreadable、人工失败/未测、终态、WayFinder、stale、设计/计划/实现/评审/验收/交付缺口（`scripts/workflow_tool.py:4823-4880`）。
- exporter 优先复用 `state.json`，没有时才调用同一 `suggest_next()`，随后把结果作为 `it.next` 给页面（`console/export.py:697-711`）。
- 页面 `nextOf()` 只显示 exporter 值，不自行复刻规则（`template.html:3527-3532`）。

这条原则非常适合 workflow-story-map：**UI 不应从 badge、文本或边关系临场猜下一动作；Core 应一次性给出 Story、RepoLane、Ticket 的 `now/why/next` 投影。**

### 2. 当前字段能回答什么

| 层级 | 字段/投影 | 能回答 | workflow-story-map 是否可直接复用 |
| --- | --- | --- | --- |
| Repository snapshot | `repo`, `branch`, `generated_at`, `main_checkout`, `mtimes` | 哪个仓、哪条分支、快照多旧、是否可能漏别处任务 | 原理可复用；字段需升级为每个 RepoLane 的 source/freshness |
| Work Item | `id`, `short`, `title`, `status`, `kind`, `branch`, `created`, `shadowed/elsewhere` | 任务身份、生命周期、所在 checkout、是否有重复旧副本 | AES checkout 细节不可原样复用 |
| Stage | `reached`, `reached_stage`, `next_skill`, `waiting_on` | 走到哪、接下来哪个 Skill、是否等人 | 可复用“正交投影”，但 story-map 需要 lifecycle/control/gate 三轴和 lane 聚合 |
| Human-readable next | `next` | 用一句话告诉人下一步或阻塞原因 | 表达可复用；需拆成结构化 `why`, `owner`, `consequence`, `next_safe_action` |
| Artifact | `artifact`, `outcome`, `freshness`, `depends_on`, `producer`, body/head | 证据是什么、结论、是否 stale、依赖、来源 | 可迁移为 Evidence/Receipt projection；不能沿用固定 Artifact 分类 |
| Manual test | `passed/open/failed` + case text | 人工验了多少、哪里失败 | 信息表达可复用；事实模型必须换为 typed Receipt/Gate |
| WayFinder | `state`, `destination`, `route`, `nodes`, `edges`, `frontier`, `tasks`, `handoff` | 当前未知、依赖路线、frontier、交接材料 | 仅 Discovery/decision 层可借鉴；不能替代 Delivery/Gate |
| Review-local state | `seen/reviewed/revision` | 哪些 hunk 看过，代码变后是否失效 | 可复用 subject-bound review UX；当前存 localStorage，不是共享事实源 |

### 3. 缺少的 story-map 状态

当前 read model 没有一等字段表达：

- `StoryRoot → RepoLane → Ticket → Attempt → Receipt → Gate` 聚合；
- 阻塞 owner、需要谁行动、多久未动、影响哪个 Gate/Story、若不处理会怎样；
- 下一动作的可执行 command id、前置条件、幂等键、提交中/成功/失败状态；
- Receipt 的签发者授权、subject digest、policy/profile digest、撤销、过期、quorum；
- 跨 lane required/optional 语义与 integration gate；
- 事件序列、状态跃迁原因和 actor audit trail。

这些不是“再加几个 badge”能补齐的，必须先由 Core/Projection 提供。

## 三、导航、搜索、详情与反馈机制

### 导航与逐层展开

证据：左栏任务/待办 → Work Item 总览/决策导航/工程流程三视图 → 阶段/文件 → Artifact 依赖/source 的跳转链已经完整存在（`template.html:3477-3515, 3918-3966, 4307-4387, 5516-5535`）。跨 Artifact 点击可直达另一个任务的具体阶段与文件，而不是只打开一个泛化详情页（`template.html:5516-5527`）。

可迁移强项：workflow-story-map 也应保持“概览 → 一跳 peek → 完整证据”的稳定层级；Map 节点点击只更新详情并保留缩放/滚动，相关断言已写进 `tests/console/exercise.js:224-357`。

AES 特有：11 格阶段轨、Artifact ID、Work Item/Todo 双向关联、WayFinder node/source 回退、VS Code URI。

### 筛选、排序与搜索

证据：页面区分任务/待办筛选；任务提供“等人”专用过滤；全文搜索预构建小写索引、每对象最多显示三条片段、按命中数排序，并能定位原文；`Ctrl+F` 留给浏览器，`Ctrl+Shift+F` 才是全仓搜索（`template.html:3375-3470, 5852-5865`；`tests/skills/aes-workflow/test_workflow.py:6696-6715`）。

可迁移强项：明确区分“当前页内查找”和“全 Story 证据搜索”；搜索结果必须带来源类型、片段和可验证的落点。

不足：没有 repo/lane、owner、风险、Gate、receipt freshness、actionability 等组合筛选；“有事要做”排序只按 `active → in_review → done → cancelled`（`template.html:3390-3396`），不等于人类优先级。

### Drawer / modal

证据：modal 会保存原焦点、声明 `role=dialog/aria-modal`、给底层 `.console` 加 `inert`，关闭时恢复焦点；Escape 统一关闭（`template.html:3148-3164, 5852-5854`）。发送面先预览可读内容和 raw text，允许在“推进/整改”间切换，最后才复制（`template.html:3241-3304`）。

可迁移强项：危险或外部动作先在同一上下文中预览 subject、范围、目的与将要提交的 payload，再确认；modal 必须有焦点边界和可恢复返回点。

AES 特有：目标是生成 `aes-plan/aes-execute/aes-review/aes-validate` prompt，而非调用 workflow-story-map command API。

### 命令与提交

事实：除人工清单外，页面明确不写文件、不起 agent；“推进/整改/待办转 prompt”均复制文本，用户回会话粘贴（`template.html:3235-3346, 5295-5385`）。人工清单是唯一页面拥有的写面：优先通过 token 保护的 localhost 服务，严格限定 `workflow/<slug>/manual-test.md` 且只接受勾选字符和反馈行变化；底版变化返回 409；浏览器 fallback 再用目录授权（`console/export.py:1014-1127`；`template.html:2393-2495`）。

可迁移强项：把“看”与“改”分开，提交前展示 payload；写入端做路径白名单、subject/base 对账、最小 mutation diff、原子替换和读回核验。

不能照搬：workflow-story-map 已决定需要 tracked command/receipt/gate lifecycle，不能把“复制了 prompt”当作已 dispatch，更不能把 localStorage 的 `sent` 当成权威状态。

## 四、错误、空态、刷新和历史

### 做得好的错误与空态

- 直接打开模板会解释“这是模板，不是生成好的页面”，给启动命令；数据损坏会说明重跑导出（`template.html:5584-5605`）。
- 搜索无结果会说明实际搜索范围（`template.html:3602-3615`）。
- WayFinder 没有地图、没有节点、frontier 为空、边指向不存在节点、字段缺失时都有具体空态/错误，不替数据猜结论（`template.html:4076-4136, 4191-4236`）。
- 任务不是主检出、mtime 更新或 Junction 读不到时，顶栏持续显示而非一次性 toast（`template.html:5569-5581`）。
- large diff 默认进入摘要并给明确风险确认（`template.html:4851-4870`）。

### 重要盲点

1. **Invalid Work Item 被静默过滤。** exporter 会把 invalid item 放进 payload，但 `adopt()` 直接 `filter(i => !i.invalid)`（`console/export.py:525-530`；`template.html:1197-1203`）。页面没有 persistent data-health 面板。
2. **Unreadable record 被塞进 `files.__bad`，但 UI 没有渲染路径。** 只有测试脚本读取 `__bad` 做发现（`template.html:1203-1213`；`tests/console/check.js:82-88`）。因此 Core 会 fail-closed，而 Web 可能让人看不到原因。
3. **部分筛选空态是空白。** 全文搜索和待办详情有空态，但任务筛选后 `shownWi()` 为空时 `renderSide()` 直接写空字符串（`template.html:3633-3635`）。
4. **toast 是短暂提示。** 保存、复制、失败等多数反馈 2.6 秒后消失（`template.html:5744-5759`），不适合作为阻塞、授权失败或 command failure 的唯一载体。

workflow-story-map 应把 invalid/unreadable/stale/degraded 提升为不可被总绿吞掉的 persistent system health / Action Center 项，而不是只靠 toast 或隐藏内部数组。

### 刷新语义

刷新按钮会调用 localhost `/export` 重扫仓库并 reload；没有服务时只 reload 同一旧文件并提示重新开启动器（`template.html:5536-5559`）。可选“盯住改动”只比较 mtime 并提示 stale，不主动更新数据（`template.html:5666-5693`）。服务有心跳、前台恢复补 ping、多个页面共享服务；相关生命周期断言在 `tests/skills/aes-workflow/test_workflow.py:5686-5798, 6655-6693`。

可迁移强项：始终显示快照时间和 source freshness，刷新失败必须告诉人恢复动作。

不能照搬：Story 多 RepoLane 需要每源独立 freshness、最后成功同步时间和 degraded 边界；单一页面级 generated time 会掩盖某条 lane 已陈旧。

### 历史与时间线

**证据：当前没有全局 activity timeline 或 command/event audit。** 实现里保留的“历史”只有：

- superseded Artifact 版本默认折叠，可展开并跳回旧版（`template.html:3692-3705`）；
- Work Item 阶段进度和 Artifact 依赖链；
- 本地 review `seen/reviewed/revision` 状态（`template.html:2033-2043`）；
- 批注撤销栈与 exported 标记，只存在浏览器侧（`template.html:2100-2119, 3235-3346`）。

推论：它能回答“现在有哪些证据”和“旧版本在哪”，不能回答“谁在何时因何动作把状态从 A 变成 B”“命令是否被接收/失败/重试”。workflow-story-map 应新增按 Story/Ticket/Attempt/Receipt/Gate 聚合的时间线，不能把阶段轨当时间线。

## 五、最适合融合进 workflow-story-map 的表达

### 1. 首屏分层：全局 attention → 选中对象的 Now/Why/Next → 深层证据

AES 的左栏先给“等人”和剩余人工项，任务页头再给当前阶段和下一步，Map/Flow 放到同级次级 tab。这个层级比“首屏就是 Map”更接近人类快速掌控。

适配 Story Map 时应增强为：

- 左侧或顶部 Action Center：每项固定显示 **状态、为什么、谁行动、不处理的影响、下一安全动作**；
- Story header：Story lifecycle/control/gate 总览，以及 required RepoLane 的最差 Gate；
- RepoLane beacons：source freshness、exact checkout/integration target、当前 ticket/attempt、blocker、next；
- List 作为十秒扫视默认面；Map 用于解释依赖和解锁关系；Evidence/Timeline 负责审计。

### 2. “Core 算、Web 讲”

保留 AES `suggest_next → exporter → UI 原样显示` 的单向链，但把文本升级为结构化投影：

```text
now: 当前事实
why: 阻塞或门禁原因
owner: 下一位行动者
consequence: 不处理影响
next_safe_action: 可执行动作或明确等待
source_refs: Receipt/Gate/Ticket/RepoLane
freshness: 每个来源的生成与核对时间
```

这样 Web 不需要用颜色、图边或中文字符串推导业务状态。

### 3. 把证据定位做成一等交互

可直接借鉴：全文搜索片段直达、依赖 chips、source 按钮、stale badge 原因、revision 变化后禁操作、按“为什么”或“按对象”切换证据视角。Story Map 中应替换成 Ticket/Attempt/Receipt/Gate source，而不是 Artifact 文件。

### 4. 人类操作必须先预览、再提交、可追踪

借鉴 modal 的 subject/context/payload 预览和焦点行为；抛弃“复制即发送”的语义。真正提交后要出现 command receipt，并在 Timeline 中展示 `requested → acknowledged → running → succeeded/failed/cancelled`。

### 5. 记住人上次工作的上下文

AES 会恢复任务、view、stage、file、滚动、筛选、排序和搜索词（`template.html:5414-5498`），测试也专门覆盖（`tests/console/check.js:1117-1164`）。Story Map 应按 Story/RepoLane 保存视图，但不能把权威 lifecycle/Gate 写进 localStorage。

## 六、不能照搬的 AES 专有设计

| AES 设计 | 为什么依赖 AES | workflow-story-map 应如何转译 |
| --- | --- | --- |
| Work Item + Todo 两类左栏对象 | 源于 `workflow/` Markdown 文件布局 | Story / RepoLane / Ticket / Action Center |
| 九个 Artifact 阶段 + IN/OUT 待办 | 固定工程流程和 Artifact outcome 枚举 | Profile/Gate 驱动的动态阶段或 lane-specific milestones |
| `state.json`、front matter、Artifact ID、supersedes | AES repo-as-database 协议 | Tracker + append-only receipts + deterministic projections |
| WayFinder tickets、frontier、handoff | AES Discovery 路由模型 | 仅用于 DiscoveryMap，不扩张为 Delivery truth |
| sibling worktree/Junction/shadowed | Windows + Git worktree 物理拓扑 | RepoLane adapter 报告 exact checkout/source health |
| `vscode://file` | 本机编辑器耦合 | 通用 source link/action adapter |
| `change-note` → git patch → Pierre review | AES 代码审查链专用 | Receipt/Evidence viewer，可按证据类型插件化 |
| 直接写 `manual-test.md` | AES 只允许这一份人工事实源 | 授权的 HumanTest/Acceptance/Waiver Receipt + RevocationReceipt |
| 复制 `aes-*` prompt | agent 会话是外部执行通道 | typed command dispatch + ack/result receipts；复制只能是 fallback |
| 一个页面级 generated time | 单仓快照 | 每 RepoLane/source 独立 freshness + Story 聚合健康度 |

## 七、对 workflow-story-map 当前 Web 方向的约束性结论

### 推荐保留（高置信）

1. **Map 必须是解释层，不是首屏状态层。** AES 已通过“总览 / 决策导航 / 工程流程”三视图把这个边界做对。
2. **List/Action Center 默认优先。** 人最先需要找到“谁在等我”，不是理解整张 DAG。
3. **所有下一步和阻塞原因由 Core 投影。** Web 只负责清楚表达和跳到源证据。
4. **证据 stale 必须绑定 subject，并在操作处禁用。** 不能只在角落给一个黄色提醒。
5. **人类反馈要就地、可撤销、批量收口。** 但 authoritative mutation 必须升级为 Receipt/Command，而非 localStorage 或剪贴板。
6. **恢复上下文是一等体验。** 刷新或换回页面不应把人送回 Story 顶部。

### 需要避免（高置信）

1. 把 lifecycle 状态、等待、blocker、Gate 和 source freshness 压成一个 badge。
2. 用“活动中优先”冒充真正的 Action Center 排序。
3. 让 Web 从 DAG、文本或颜色反推下一动作。
4. 把复制 prompt 宣称为命令已派发。
5. 把阶段轨或 Artifact 版本列表宣称为事件时间线。
6. 让 invalid/unreadable 数据从 UI 消失，却继续展示看似完整的绿色摘要。

## 八、证据与推论边界

### Evidence

- 页面实现、exporter、deterministic tool 和协议共同证明了上述现有字段、导航和写入边界。
- 仓库测试源码覆盖三视图、WayFinder 图交互、全文搜索、批注、人工清单、view restore、refresh 服务、跨 worktree 收集、stale handling 和 responsive layout。

### Inference

- “AES 更像审阅台而不是全局状态中枢”是对现有信息架构与缺字段的产品推论。
- “workflow-story-map 应新增 Action Center/Timeline/typed commands”来自其既定 Story/RepoLane/Receipt/Gate 目标与 AES 当前缺口的比较，不是 AES 已实现事实。

### Unknown / NOT_RUN

- 本轮未重新运行浏览器交互、视觉截图、键盘全路径、读屏或缩放测试。
- 未验证实际运行时的首屏十秒任务成功率、多人协作可理解性或 operator scanning 时间。
- 未验证当前浏览器环境中 Clipboard、File System Access、`vscode://` 和 localhost Private Network 的实际可用性。
- 当前页面没有内建 telemetry，仓库无法回答用户真实最常用哪些入口、在哪一步迷失。
