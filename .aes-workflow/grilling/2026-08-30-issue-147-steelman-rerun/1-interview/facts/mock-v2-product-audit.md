# workflow-story-map v2 Mock 产品 / UX 审计

> 本分片只审计 Web 产品表达，不讨论 Skill 调用链，不替用户确认原型，也不修改 `2-prototype`。

## 审计范围与证据边界

- 目标页面：`2-prototype/drafts/v2-mock.html`，当前 SHA-256 为 `5FE955869F532B4869D6FBC3ED6F0B7D5742484244097BF99FE7056562A56259`。
- 用户目标：进入页面后，在十秒内回答四件事：**Story 现在怎样、为什么没完成、谁必须做什么、做完会解锁什么**；需要追责时再下钻到 lane、ticket、receipt 与历史证据。
- 当前视觉证据：`C:/Users/parking/.codex/visualizations/2026/08/29/01a04f43-9300-7232-95af-5d615de71b25/workflow-story-map-mock-v2.png`，1440×1100，本轮已按原分辨率检查。截图与当前 HTML 的标题、五张摘要卡、Action Center、RepoLane 表、Ticket 队列和右侧 D17 Peek 一致。
- 对照实现：
  - `G:/GIT/AI_WorkFlow/aes-workflow/skills/engineering/aes-using-workflow/console/template.html`
  - `G:/GIT/AI_WorkFlow/aes-workflow/workflow/ai-guided-code-review/assets/audit-aes-current/01-task-list-overview.png`
  - `G:/GIT/AI_WorkFlow/aes-workflow/workflow/ai-guided-code-review/assets/audit-aes-current/01-task-flow-current.png`
  - `G:/GIT/AI_WorkFlow/aes-workflow/workflow/wayfinder-local-tracker/assets/console-ticket-projection.png`
  - `G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/aes-worktree-board/board.html`
- 本轮没有接管用户当前 in-app browser，也没有另启 Playwright；因此点击、键盘、读屏、缩放与响应式结论来自当前 HTML 源码审计，不冒充真实浏览器验收。视觉结论来自上述已提供截图。

## 总结判断

v2 的产品方向比 v1 正确：它已经把 Map 降为次级视图，引入 Action Center，并把 `stale`、`NOT_RUN`、degraded 与 lane gate 放到首屏。这些都应保留。

用户仍觉得“表达弱”的根因不是装饰不足，而是：**页面把正确的数据做成了五组同权信息，没有形成一个明确的操作者任务。** 它更像状态字段的示例页，而不是能让人完成一次判断和行动的控制台。

最关键的四个结构缺口：

1. 没有一条贯穿全页的“当前故事”：阶段在哪里、哪个 lane 拖住、谁在等谁、最短解锁路径是什么。
2. 首屏摘要与 Action Center 重复，但最高优先动作没有直接闭环；用户仍需先读卡、再选行、再到右栏找按钮。
3. 页面自称 `LIVE · AUTO`，却是固定时间、固定样例、无真实刷新结果的静态文件，破坏可信感。
4. 所有东西都被做成浅色边框卡片，造成视觉同权；真正重要的 P0 决策只比普通表格多一条红边。

## 已经做对、应保留的部分

1. **NOW / WHY / NEXT 是正确的信息骨架。** 当前 HTML 先显示 Story 状态、未完成原因与最高优先动作（`v2-mock.html:96-102`），右栏也以 NOW / WHY / NEXT 展开选择项（`:147-153`）。问题在于重复与缺乏闭环，不在这套问法本身。
2. **Action Center 比全图优先是正确的。** 它只收异常与人工动作（`:106-112`），符合“先处理会改变下一步的事”。
3. **RepoLane 状态是一等对象。** checkout、integration、当前 attempt、evidence、why、next 同行展示（`:115-125`），比只画 Story 图更接近真实运营。
4. **证据健康度没有被总绿吞掉。** `valid / stale / NOT_RUN` 首屏可见（`:101-102`），这是高可信工作流必须保留的反乐观设计。
5. **List 默认、Map 次级是正确方向。** 当前明说 List 用于快速扫状态，Map 用于解释关系（`:128-143`）。v3 不应倒回 Map-first。

## 为什么 v2 仍显得弱

### P0：结构性问题

#### P0-1 首屏没有“一个结论 + 一个动作”，而是五张同权 KPI 卡

截图中从左到右连续出现 NOW、WHY、NEXT、Lane Gate、证据健康度五张相同尺寸和相同白底的卡。用户必须自己把它们合成为一句话。紧接着 Action Center 又重复 D17、阻塞数与下一步，造成“信息很多但抓不住主线”。

可实施的 v3 改法：

- 把五卡压成一个 **Story Pulse**：
  - 主句：`Desktop lane 已暂停；需要你决定 API 是否保持只读。`
  - 影响：`该决定会解锁 4 张票，随后仍需 3 项视觉验收。`
  - 主 CTA：`处理 D17 决策`
  - 次 CTA：`查看为什么`
  - 右侧只保留两个小信号：`1/2 required lanes passed`、`2 stale · 1 NOT_RUN`。
- Story Pulse 不重复 Action Center；它只把 Action Center 排名第一项升格成主行动。
- 当没有人类动作时，主句切成“Agent 正在做什么 / 下一次可判断的事件是什么”，而不是空泛 `ACTIVE`。

这对应 engineering Console 的强项：任务标题下方只放一条“下一步”提示，随后紧接阶段 rail，而不是先平铺一排 KPI（`template.html:132-147`、截图 `01-task-list-overview.png`）。

#### P0-2 没有 story 全链阶段脊柱，用户看不到“全流程走到哪”

当前 WorkTicket 队列按 `待人工 / 阻塞 / 降级 / 可启动 / 已完成` 分类（`:128-138`），能看局部状态，却不能回答 Story 处在 Discovery、Contract、Delivery、QA、Integration、Closeout 的哪一段。多 RepoLane 又进一步打散了时间顺序。

engineering Console 的阶段 rail 是最值得迁移的结构：九阶段固定存在，当前阶段、空阶段、过期和完成都能一眼定位；滚动后还能压成紧凑色条并保留悬停 / 键盘标签（`template.html:144-196`）。这建立了稳定的空间记忆。

可实施的 v3 改法：

- Story Pulse 下常驻一条 **六阶段 Story Spine**：`Discovery → Contract → Delivery → QA → Integration → Closeout`。
- 每个阶段只显示一个合成状态：完成、当前、等待人、阻塞、未开始；当前阶段旁显示 owner。
- 点击阶段只改变下方工作面，不另开页面；滚动后阶段脊柱压成窄条保持可见。
- RepoLane 不再与阶段竞争。每条 lane 在同一阶段坐标上显示自己的小进度条，展开时才看 checkout、attempt、receipt。

不要照搬 engineering 的九格或十一格宽 rail；StoryRoot 是跨 lane 的合成流程，应压成 5–6 个用户能理解的业务阶段。

#### P0-3 页面宣称 LIVE，但没有可验证的 live 语义

当前 header 写 `LIVE · AUTO` 和“更新于 12 秒前”（`:92-93`）；刷新按钮只把文字改成“已刷新”900ms，没有更新数据、时间或错误状态（`:181`）。这会让用户错误相信状态与 tracker / registry 同步。

对照中两个产品都把模式真相做成一等信息：

- engineering Console 明确展示快照生成时间、刷新和“盯住改动”，并说明页面是快照、目录授权只用于判 stale（`template.html:1048-1106`、`:1120-1175`）。
- aes-worktree-board 明确区分 `LIVE` 与 `SNAPSHOT`，snapshot 下刷新禁用；ORCH pill 还显示 next / last / merge / unclassified，并把 `whyNotComplete` 放进可查入口（`board.html:835-855`）。

可实施的 v3 改法：

- Mock 阶段必须写 `SCENARIO SNAPSHOT`，不能写 LIVE。
- 真产品顶部用一个 **Source Integrity** 组件显示：来源、最后成功同步时间、同步中 / 失败、旧快照、盲区、当前 revision。
- 刷新必须有 `loading → success/no-change/error` 三态和明确结果；不允许只闪一下按钮文案。
- 任何 `stale` 都应说明 stale 的对象和影响范围，而不是只给计数。

#### P0-4 Action Center 只有“看起来能做”，没有动作闭环

当前可见 13 个按钮，但 `打开 Tracker`、`全部 Lane`、搜索、筛选、`回答决策`、`打开 Ticket` 等主要控件没有行为；`primary-action` 只会随选中项换文案（`:154-173`）。用户点击 Action Center 项后只是改右栏文本，不能完成决策、领取 checklist、复制恢复步骤或看到提交回执。

可实施的 v3 改法：

- 每种 Action 必须有明确闭环：
  - decision → 打开双向方案 / 影响摘要 → 确认 → 显示 receipt → 重算 Story；
  - human test → 打开逐项 checklist → 填 evidence → 签发或退回；
  - degraded → 显示允许 / 禁止动作 → 复制恢复指令或创建替代票；
  - stale → 显示受影响 receipts → 触发重验或回到 owner。
- Action 行本身只保留 `What / Consequence / Owner / CTA`；长 WHY 放右栏，避免一行同时塞标题、WHY、NEXT、owner。
- 完成动作后：焦点回到更新后的 Action Center；出现可读的 receipt / transition；原项移除或降级，并说明下一项为何成为第一。
- 原型里未实现的按钮要么做通，要么明确 disabled + “本原型未连接”，不能伪装成可操作产品。

#### P0-5 缺少可用导航模型，Story、Lane、Ticket、Evidence 只是同页堆叠

页面没有 Story 切换、breadcrumb、阶段导航或稳定的选择回路。点击 Action、lane 或 ticket 都向同一个右栏灌文本，但 URL、选中态、返回位置和焦点都不保存。长时间使用时，用户很难知道自己在 Story → Lane → Ticket → Receipt 的哪一级。

engineering Console 的真正优势是稳定壳：左侧任务 / 待办索引，中间固定阶段与内容，右侧固定批注 / 发送出口；两种 review 入口仍读同一批 location 和同一份进度（`template.html:46-119`、`review-narrative-research.md:54-60`）。WayFinder 则把“概览 / 决策导航 / 工程流程”做成明确 tablist（`template.html:3920-3922`）。

可实施的 v3 改法：

```text
Shell
├─ 左栏：Story / RepoLane 导航（可收起）
├─ 中栏：Story Pulse + Stage Spine + 当前工作面
│  ├─ Actions（默认）
│  ├─ Lanes
│  ├─ Tickets
│  └─ Map（解释依赖）
└─ 右栏：当前对象 Inspector
   ├─ 概览
   ├─ 证据
   └─ 历史
```

- 顶部 breadcrumb：`Story #147 / desktop / I42`；每级可回退。
- Actions、Lanes、Tickets、Map 是同一投影的不同视图，共用搜索、筛选与选中对象；不能各维护状态。
- 右栏是 Inspector，不重复主工作面；关闭后把焦点还给触发对象。

### P1：高影响表达问题

#### P1-1 视觉同权：所有内容都是白卡 + 灰边 + 11px 字

当前 `system-ui` 字体、8px 圆角、1px 灰边用于几乎所有层级（`:8-43`）。截图中卡片、表格、队列、Peek 都有相似视觉重量；橙色 outline 甚至更像“设计稿变更标注”，而不像产品状态。大量 11px 正文和英文代码混排降低扫读速度。

可实施的 v3 改法：

- 定义“控制室编辑风”而不是泛 SaaS 卡片风：暖灰纸面、深墨文字、焦橙只用于可行动焦点，状态色只用于状态，不用颜色装饰。
- 采用有角色差异的字体：人类结论 / Story 标题用 Source Serif 4 或同类中文兼容衬线；操作与正文用 Archivo / IBM Plex Sans；ID 与 digest 用 IBM Plex Mono。若无法随产品打包字体，就在 mock 中明确 fallback，不假定机器已有字体。
- 减少 40% 容器边框：用背景区、留白、细分隔线和 typographic hierarchy 建层级。只有可点击对象、告警与 selected item 需要完整边界。
- 关键句 22–28px；动作标题 15–16px；正文不低于 13–14px；元数据才使用 11–12px。
- 删除 `.changed` 这类设计过程标注，或者只在 reviewer overlay 中显示，不进入目标产品。

engineering Console 可借的是克制的 warm paper、衬线标题、单一焦橙、阶段 rail 与滚动压缩，不是逐像素复制它的 Anthropic 风格（`template.html:10-38`）。

#### P1-2 Action 文案混合内部枚举与用户语言，认知成本高

`ACTIVE · NEEDS ATTENTION`、`DEGRADED`、`profile digest mismatch`、`requires-decision` 与中文解释同时出现。内部状态能审计，但不应成为用户首先阅读的句子。

可实施的 v3 改法：

- 第一层统一写人话：`等待你决定`、`执行规则不可重建，已暂停`、`需要视觉验收`。
- 枚举放次级 mono 标签：`requires-decision`、`degraded`。
- 所有动作使用动词 + 对象 + 结果：`决定 API 是否保持只读`，不要只写 `回答决策`。
- `WHY` 不是字段名堆叠，而是因果句；`NEXT` 必须说明操作者与完成判据。

#### P1-3 Lane 表格适合审计，不适合持续掌控

六列表能容纳事实，却把 lane 的身份、健康、进行中工作、阻塞和下一步切碎成横向字段。它在 1040px 以下也没有包裹容器，容易横向溢出。更关键的是，用户无法快速比较哪个 lane 正在推进、等待人、暂停或已通过。

可实施的 v3 改法：

- 默认用 **Lane Rails**：每条 lane 一行，左侧 lane 名与健康，中间阶段位置 + 当前票，右侧 next / owner；只显示异常和活跃 lane。
- 点击 lane 后在 Inspector 显示 exact checkout、integration SHA、attempt、receipt 明细。
- `All lanes` 再进入审计表格；表格不是默认主视图。
- backend 已 passed 且无动作时压成一行“已通过，等待合成”，不要与 degraded lane 占同等高度。

#### P1-4 Progressive disclosure 只有“显示更多文本”，还没有证据模型

当前右栏只有一个 `完整证据` toggle，打开的是五行 monospace 文本（`:152-153`）。这无法区分“摘要、可复现证据、来源、历史、授权”，也不能证明人看到的是当前 revision。

engineering 的最佳实践是把目标 / 当前内容放主线，把依据、替代方案、命令、测试和日志放证据层；原始执行轨迹不占主线（`review-narrative-research.md:48-60`）。

可实施的 v3 改法：

1. Level 1：行内结论（状态、影响、owner、CTA）。
2. Level 2：Inspector 概览（NOW / WHY / NEXT、subject、affected objects）。
3. Level 3：Evidence tab（receipt 类型、签发者、subject digest、command/exit code、artifact、freshness）。
4. Level 4：History tab（状态转移、撤销、supersede、source link）。

Evidence 和 History 不要做成同一个无限滚动抽屉。

#### P1-5 缺少时间、等待对象和变化因果

最近变化只有 `12 秒 / 4 分钟 / 9 分钟` 加事件文本，没有 actor、source、from→to 和是否导致当前 P0。Action Center 也没有“已经等了多久”。

可实施的 v3 改法：

- Action 显示 `等待你 9 分钟` 或 `Agent 自 16:21 暂停`，时间用于判断优先级，不用于虚假 SLA。
- Activity 记录 `actor · source · from → to · consequence`；重要转移可跳回 receipt。
- Story Pulse 显示“最后有效变化”，Source Integrity 显示“最后同步”，两者不能混为一个“12 秒前”。

### P2：完善性与可访问性

#### P2-1 当前交互语义对键盘与读屏不成立

源码中 13 个 button，但没有任何 `aria-*`、`role` 或 `<label>`。List / Map 不是 tablist；evidence toggle 没有 `aria-expanded`；动态 Inspector 没有 live region；lane 用可点击 `<tr>`，没有键盘焦点；选中态只靠 `.selected` 视觉类（`:115-125`、`:169-181`）。

可实施的 v3 改法：

- 目标为 WCAG 2.2 AA，但在实现验收前只能称“目标”，不能称合规。
- 用 `nav/main/aside` 与真实 heading order；tabs 使用 `role=tablist/tab/tabpanel`、`aria-selected`、`aria-controls`。
- lane 和 ticket 使用 button / link，不用点击 `<tr>`；保证 44×44px 目标与可见 focus ring。
- Inspector 更新用合适的 live region，只播报状态变化摘要，不把整栏重读。
- Modal / sheet 要有 focus trap、Escape、关闭后焦点归还。
- 状态不能只靠红绿；图标 / 文案 / pattern 同时编码。
- `prefers-reduced-motion`、200% zoom、320 CSS px reflow、Windows 高对比、键盘全流程都列为后续真实验收。

engineering Console 已实现的可借证据包括：tablist/aria-selected（`template.html:3920-3922`）、图节点键盘入口与 aria（`:1731-1736`）、图 pan/zoom 键盘说明（`:1782-1802`）、toast live region（`:1104-1106`）。aes-worktree-board 还实现了 reduced-motion、focus restore、dialog focus trap 和 snapshot/live 区分（`board.html:185`、`:464-482` 附近的 portrait demo）。

#### P2-2 响应式不是简单堆成一列

当前只有 `max-width:1040px` 一档（`:80-87`）：五张状态卡变两列，主工作区变一列；lane 六列表没有移动重排，Queue 依赖横向滚动，右侧 Peek 会被推到所有主内容之后。移动端用户先读大量表格，最后才看到当前动作详情。

可实施的 v3 改法：

- 宽屏：左导航 + 中工作面 + 右 Inspector。
- 中屏：左导航收起；Inspector 变右侧 sheet。
- 窄屏：Story Pulse + 当前 CTA 固定在前；Action 列表；Inspector 变底部 sheet；lane 用 cards；Map 单独全屏。
- 不在窄屏同时展示 Map 与详情；保留选择、筛选和焦点位置。

## 推荐的 v3 首屏结构

```text
┌ Story / source breadcrumb ───────────── sync integrity ─────┐
│ Desktop lane 已暂停；需要你决定 API 是否保持只读。 [处理] │  ← Story Pulse
│ 影响 4 tickets · 之后还需 3 项视觉验收       [查看原因]   │
├ Discovery ─ Contract ─ Delivery ─ QA ─ Integration ─ Close ┤  ← Story Spine
│ Story/Lane │ 等待你（1）                                   │ Inspector
│ navigator  │ ┌ D17 决策 · 已等待 9m · 解锁 4 ─ [处理] ┐   │ 概览
│             │ └────────────────────────────────────────┘   │ 证据
│             │ 系统异常（1） / 人工验收（1）                │ 历史
│             │                                               │
│             │ Lane rails / Ticket explorer / Map tabs       │
└─────────────┴───────────────────────────────────────────────┘
```

这个结构同时吸收了：

- engineering Console 的稳定 shell、阶段脊柱、当前内容与反馈出口分工；
- aes-worktree-board 的空间记忆、runner/lane beacon、一跳聚焦、完成后解锁与 LIVE/SNAPSHOT 真相；
- v2 已正确建立的 Action-first、NOW/WHY/NEXT、证据 freshness 与 List-before-Map。

## 可实施优先级

| 优先级 | v3 工作项 | 完成判据 |
| --- | --- | --- |
| P0 | Story Pulse + 第一 CTA | 首屏只读一句主结论即可知道谁该做什么、会解锁什么；CTA 能完成或进入真实动作 |
| P0 | 六阶段 Story Spine | 不打开 Map 也能说出全链所处阶段、当前 owner 和哪个 lane 拖住 |
| P0 | Source Integrity | snapshot 不冒充 live；刷新有明确 success/no-change/error；stale 指向具体对象 |
| P0 | 统一导航与选择状态 | Actions/Lanes/Tickets/Map 共享筛选和 selected object；URL/返回/焦点不丢 |
| P0 | 四类 Action 闭环 | decision、human test、degraded、stale 各有完成、失败、回执和重算路径 |
| P1 | Lane Rails + 审计表二层 | 默认可比较 lane；exact checkout / receipt 明细下钻可得 |
| P1 | 视觉系统重排 | 不靠满屏卡片；主结论、动作、证据、元数据四级清楚；正文至少 13–14px |
| P1 | Evidence / History 分层 | 一跳见摘要，两跳见 receipt，三跳见 transition/source，不混成日志墙 |
| P1 | 状态中文与枚举分层 | 人话优先，机器枚举次级；动作使用动词 + 对象 + 结果 |
| P2 | 响应式与无障碍 | 键盘、焦点归还、读屏播报、reduced motion、320px reflow 与 200% zoom 实测 |

## 不要照搬的东西

1. **不要复制 engineering Console 的表层皮肤。** 暖纸、衬线和焦橙可作为方向，但 Anthropic 风格、文档阅读布局不是 workflow-story-map 的产品身份。
2. **不要复制其九阶段 / 十一格 rail。** 迁移“稳定阶段脊柱”，不迁移工程 artifact 的全部阶段名。
3. **不要复制其重型批注与 code-review 工具栏。** workflow-story-map 只需要统一 Human Action / Receipt 出口，不需要编辑器式标注系统。
4. **不要把 aes-worktree-board 的星图重新升回首屏主角。** Board 的 Map 强在空间记忆和 worker 定位；Story Map 的首要任务是行动与收口判断，Map 必须是解释层。
5. **不要复制 board 的 live dispatch 面板到每张 Ticket。** 编排权限、风险和单一写入者应通过专门动作流表达，不能把 textarea + 派发按钮塞进任意详情。
6. **不要用更多状态颜色解决层级问题。** 状态颜色只编码状态；层级由位置、字号、留白、折叠与动作优先级承担。
7. **不要把内部三轴和所有 receipt 字段永久露在首屏。** 三轴适合 Inspector / evidence；首屏应先给用户结论。

## 下一轮与用户讨论时最值得看的五个表达决策

这些不是事实，也不应自动当成用户裁决：

1. 是否接受“单一 Story Pulse 取代五张摘要卡”。
2. 六阶段 Story Spine 的阶段命名与多 RepoLane 叠加方式。
3. 左侧 Story/Lane 导航是否常驻，还是本产品先做单 Story 工作台。
4. Human Action 是右侧 Inspector 内完成，还是打开专用 review sheet。
5. v3 的视觉方向选择：`控制室编辑风`（推荐）还是更接近 board 的 `星图观测台`；两者不能混成一半文档、一半太空图。

## 停止条件

本轮只读审计已到可做 v3 设计的证据阈值：已定位 v2 的结构性弱点，提取 engineering Console 与 aes-worktree-board 可迁移的产品原则，给出 P0/P1/P2 改法与禁止照搬项。未运行浏览器交互或无障碍测试，相关项目保持 `NOT_RUN`。
