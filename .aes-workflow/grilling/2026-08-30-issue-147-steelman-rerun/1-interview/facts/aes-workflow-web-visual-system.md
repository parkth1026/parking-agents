# aes-workflow Engineering Web 视觉与产品表达审计

## 范围与证据边界

- 调查对象：`G:/GIT/AI_WorkFlow/aes-workflow/skills/engineering`，当前源仓 HEAD 为 `25cc3ce157bace9b7f813bb2642aca516b2b2af4`。
- 下文 `console/...` 与 `references/...` 均精确相对于 `G:/GIT/AI_WorkFlow/aes-workflow/skills/engineering/aes-using-workflow/`；`aes-wayfinder/...` 相对于本次调查根目录。
- 共枚举 58 个文件；其中只有一个第一方页面模板 `aes-using-workflow/console/template.html`，页面数据适配器是 `console/export.py`。`pierre-diffs-entry.js` 只是代码 diff 组件桥接，`pierre-diffs.bundle.js` 是 10 MB 的第三方编译产物，不作为 AES 自身产品设计意图的事实源；其职责由入口与许可证明确限定为代码审查正文渲染。证据：`console/pierre-diffs-entry.js:1-16`、`console/THIRD_PARTY_LICENSES.md:3-6`。
- 此目录没有独立的 Web wireframe、Figma 文件或产品需求稿。这里所谓 prototype 支持，是把任务 `mockups/` 下的 HTML、截图和导出图列为设计阶段入口；prototype 的状态机仍由目录外的 `skills/productivity/aes-prototype` 承担。证据：`references/protocol.md:80-98`、`console/template.html:3666-3675`、`aes-wayfinder/SKILL.md:55-57`。
- 本文件只调查 Web/console 的信息表达，不裁决 Skill 调用链，不修改 prototype。以下“事实”来自源码和文档；“迁移判断”是面向 workflow-story-map 的产品推论。
- 本轮没有运行该 Console，也没有截图、眼动或十秒任务测试。因此源码能证明结构与意图，不能证明真实用户能在十秒内读懂。

## 三条最关键结论

1. **事实（高置信）**：它不是 graph-first 页面，而是五层 operator workbench。全局任务列表负责找对象；任务头负责回答状态、等谁、下一步；三视图分别承载契约总览、决策导航和工程证据；图只存在于“决策导航”内，并同时被“当前决策”和“frontier/交接”两侧夹住。证据：`console/template.html:1057-1106`、`console/template.html:3918-3966`、`console/template.html:4262-4285`、`console/template.html:4307-4387`。
2. **事实（高置信）**：它让人快速获取状态，靠的不是大号 KPI 卡，而是同一组操作信息在不同尺度重复投影：列表行显示终态、等待对象和九阶段微进度；任务头显示当前状态、已到阶段、下一步；右栏把“照此推进 / 发去整改”和人工核对计数钉在工作面旁；顶栏持续披露数据生成时间与 stale/blind checkout 风险。证据：`console/template.html:3535-3554`、`console/template.html:4307-4377`、`console/template.html:5113-5205`、`console/template.html:5562-5581`。
3. **迁移判断（高置信）**：workflow-story-map 应迁移这套“状态分层 + 上下文动作 + 证据渐进披露”，而不是照搬它的 11 格阶段轨或整页 Route Map。当前 Console 默认收起任务概览，并隐藏 `下一步` note；窄屏 WayFinder 又把路线图排在当前决策和操作之前。这两点与“十秒知道 Now / Why / Next”的 StoryRoot 工作台目标冲突，必须改。证据：`console/template.html:135-196`、`console/template.html:1129-1130`、`console/template.html:332-335`、`console/template.html:4369-4377`。

## 页面信息架构

### 事实：五层导航

```text
L0  仓库 Shell
    仓库身份 / 数据时间 / stale 警告 / 刷新 / 盯住改动
      ↓
L1  对象导航
    任务 | 待办 / 全文搜索 / 排序 / 状态筛选 / 等人筛选
      ↓
L2  当前 Work Item 头
    标题 / status / ID / kind / branch / created / reached / waiting_on / 下一步
      ↓
L3  三个互斥工作视图
    Work Item 总览 | 决策导航 | 工程流程
      ↓
L4  视图内工作面
    总览：契约 + 导航进度
    决策：当前决策 | 路线图 | frontier + handoff
    工程：阶段轨 → 本篇目录 | 正文/代码 | 批注与推进
      ↓
L5  按需下钻
    头部字段 / 历史版本 / rejected route / 全屏图 / 完整 diff / 源文件 / 抽屉与发送面板
```

直接证据：

- L0/L1 的固定 DOM 是顶栏、左侧 `aside` 和主内容区；左侧只有“任务 / 待办”两个对象域，并把搜索、排序、过滤放在对象列表之前。`console/template.html:1057-1100`
- 左侧筛选明确包含“等人”，排序包含“有事要做的在前”；任务行带 status、日期、短 ID、关联待办、等待对象与阶段条。`console/template.html:3375-3406`、`console/template.html:3535-3554`、`console/template.html:3595-3635`
- L2 的任务头把身份事实和 `stage.waiting_on` 放在一行，并把后端生成的 `next` 作为独立 note 和“让 agent 去做”入口。`console/template.html:3527-3532`、`console/template.html:4307-4377`、`console/template.html:5113-5119`
- L3 的 tab 明确是“Work Item 总览 / 决策导航 / 工程流程”，而不是让一张图承担所有工作。`console/template.html:3918-3922`
- 总览用左右两栏分开 Work Item 契约和“当前导航与进度”；后者只展示已有阶段、frontier、未完成导航任务、目标、路线、工程下一步和 stale 数量。`console/template.html:3925-3966`
- 决策导航在宽屏是 280–330px 当前决策栏、可伸缩路线图、260–300px utility 栏；utility 栏只放 frontier 与 handoff。`console/template.html:216-235`、`console/template.html:4262-4285`
- 工程流程是 210px 目录、弹性正文、288px 批注/行动栏；目录和行动栏可单独收起。`console/template.html:337-400`

### 迁移判断

- **直接迁移**：StoryRoot 也应有固定 L0/L1/L2，先让人找到“哪个 Story/RepoLane 要我处理”，再进入该对象；不要让用户先解析 DAG。
- **直接迁移**：保留三个语义互斥的工作视图，但目标词应改成面向 workflow-story-map 的语言，例如“状态总览 / 依赖地图 / 交付与证据”。地图只是解释 Why 的视图，不是默认首页。
- **调整后迁移**：WayFinder 的三栏可以成为 Map 页骨架：左侧选中节点的 Now/Why，中央依赖图，右侧当前 frontier、阻塞与 handoff。对 workflow-story-map，右栏应先放 Action Center，再放 handoff。
- **不要照搬**：工程 Console 的“任务 / 待办”只有一个 repo 的对象模型；StoryRoot 需要在 L1 或 L2 明确 RepoLane，而不能把 RepoLane 仅画成图中节点。

## 视觉层级与布局密度

### 事实

- 页面使用暖灰背景与表面、黑灰文字、陶土色 accent、绿/黄/红语义色；展示字体、正文字体、等宽字体三套角色，以及 4–32px 间距、8/12/16px 圆角和轻量描边/阴影。源码注释说明 token 来自另一个 AES Web 主题。`console/template.html:8-29`
- 外壳高度只有 46px，左栏固定 296px；对象行主标题 13px，元数据 10.5px，状态 badge 10px。它是高密度工作台，不是营销型 dashboard。`console/template.html:43-117`
- 任务头 h1 是 26px，正文 h1/h2/h3 依次 22/15/13.5px；机器身份、路径、时间、SHA 使用等宽字体，叙述正文使用 sans，顶层标题使用 serif。`console/template.html:129-149`、`console/template.html:566-611`
- 卡片基本都使用同一套 1px soft border、暖白 surface、12–16px radius；层级主要靠位置、标题、留白与 sticky，而不是大量高阴影卡片。`console/template.html:403-414`、`console/template.html:863-915`
- 阶段 rail 宽屏同时展示 11 格（来源待办 + 9 阶段 + 衍生待办），每格只放编号、阶段名、结论/数量/陈旧警告。主区域不足 1180px 时，每格保持至少 128px 并横向滚动，而不是继续压扁文字。`console/template.html:151-196`、`console/template.html:1026-1034`、`console/template.html:4318-4348`
- 长文工作面不是无限纵向堆卡片：顶部任务概览先滚出视口，然后目录、正文、批注分别使用自己的滚动容器；右侧动作区 sticky。`console/template.html:371-383`、`console/template.html:863-872`、`console/template.html:5761-5813`

### 迁移判断

- **直接迁移**：三种字体角色和紧凑尺寸体系很适合 operator UI。标题说明“这是什么”，sans 说明“发生了什么”，mono 说明“证据与身份是什么”。
- **直接迁移**：用轻描边和暖中性色建立稳定背景，把饱和色只留给状态、焦点和动作；这比每张卡都用不同底色更利于长时间扫视。
- **调整后迁移**：11 格 rail 应变成 RepoLane/Gate 的短轨或按 lane 分组的微进度，不应把 AES 固定阶段直接当 StoryRoot 公共模型。
- **不要照搬**：10px badge 和大量 11–12px 元数据适合桌面高密度 Console，不能自动视为移动端或低视力用户的最佳字号。

## 颜色与状态编码

### 事实

- 页面先把业务结论映射为六种稳定 tone：`ok / bad / warn / accent / idle / void`；相同 tone 可覆盖 accepted、passed、done 等多个内部枚举。`console/template.html:1243-1254`
- badge 永远带文字，颜色不是唯一信息；`void` 还使用删除线。语义色的小字号 ink 另行压深，源码注释声称目标是 4.5:1，但此目录没有对比度测试证据。`console/template.html:16-19`、`console/template.html:119-127`
- “等人”和“等 agent”不仅颜色不同，也有明确文本；任务行还会单列剩余人工核对条数。`console/template.html:976-983`、`console/template.html:3535-3544`
- 路线图节点用边框/底色表示 decided、frontier、claimed、unknown、blocked、deferred；out-of-scope 与 rejected 增加虚线，rejected edge 也用虚线。`console/template.html:241-261`
- stale 在三个尺度均显式出现：阶段格 `!`、依赖 chip 警告色、全局 stale banner；它不会被绿色任务状态吞掉。`console/template.html:176-177`、`console/template.html:984-995`、`console/template.html:5562-5581`
- 存在一处跨组件不一致：`frontier` 在通用 tone 中映射为陶土 accent，但 WayFinder 图节点使用蓝色 focus。`console/template.html:1244-1252`、`console/template.html:244-249`

### 迁移判断

- **直接迁移**：先做“业务状态 → 少量视觉 tone”的适配层，而不是让每个 Receipt/Gate 枚举拥有新颜色。状态文字必须始终可见。
- **直接迁移**：stale、NOT_RUN、blocked、awaiting-human 必须在对象行、详情头和证据层各有投影，不能只藏在 Evidence 页。
- **调整后迁移**：workflow-story-map 应统一 `frontier/current` 的颜色语义；若蓝色代表选择/焦点，就不要同时把蓝色当业务状态。
- **不要照搬**：Human/Agent 用“陶土/绿色”区分可以保留为辅助，但责任归属的主编码应该是角色文本、头像/图标和明确动作，而不是颜色。

## 组件与交互模式

| 模式 | 事实证据 | 可迁移表达 |
| --- | --- | --- |
| 对象扫描行 | 每行有 kind、status、标题、日期、ID、等待对象、人工余量和九段微进度。`console/template.html:3535-3554` | Story/Lane 行只保留“状态、责任人、阻塞、下一动作、证据健康度”；微进度作辅助。 |
| Action-first 头部 | 标题事实下面单独出现 `下一步`，并提供“让 agent 去做”。`console/template.html:4307-4377` | Story 首屏常显 Now / Why / Next / Owner / consequence；主动作与 Next 同处。 |
| 状态总览卡 | 契约正文与当前导航进度分栏，右栏只放三个数和五条摘要。`console/template.html:3925-3966` | 总览左侧放目标/承诺，右侧放 required lanes、gate、blocker、freshness、next action。 |
| 决策驾驶舱 | 当前决策、路线图、frontier/handoff 三栏并存；选节点更新左栏详情。`console/template.html:3843-3878`、`console/template.html:4262-4285` | Map 模式中永远让图旁边有“当前选中对象”和“下一可行动项”，避免 graph-only。 |
| 证据阅读面 | 本篇目录、正文、批注三栏；目录跟随滚动；原型入口放在设计正文之前。`console/template.html:3666-3675`、`console/template.html:5008-5043`、`console/template.html:5135-5205` | Ticket/Receipt peek 先给摘要，再一跳进证据；证据详情可用目录 + 主体 + sticky actions。 |
| 人工核对卡 | 已过/没测/没过三个数字，逐项清单可保存，推进/整改始终在右栏顶部。`console/template.html:5152-5205` | Human Gate 应同时显示总计、未完成/失败项和明确“接受/打回”动作，不只显示一个 gate badge。 |
| 评审双索引 | 代码审查可按“为什么改”或“按文件看”，又可在“审查改动/评审结论”间切换。`console/template.html:4917-4955` | Evidence 详情可允许按 Gate/风险原因或按 RepoLane/文件两种索引查看。 |
| 过大内容保护 | 大 diff 先显示大小、最长行、SHA、理由和截断预览；完整加载需显式确认，且摘要不会自动标已核对。`console/template.html:4851-4870` | 大证据包先摘要、风险和 digest，展开全文不改变 Gate/Receipt 状态。 |
| 可追源 | 记录卡显示源路径、producer、freshness、依赖，并提供打开源文件和复制路径。`console/template.html:3678-3727`、`console/template.html:5122-5132` | 每个 Story/Lane/Gate verdict 提供一跳到 Receipt/Tracker/checkout 的事实源。 |
| 上下文续接 | 选中任务、视图、阶段、文件、滚动位置、筛选、排序和搜索词按仓库存入本机并恢复。`console/template.html:5407-5498` | Story map 再开时回到同一 Story/Lane/视图；恢复失败则安全回默认总览。 |

## 渐进披露

### 事实

- 页面默认视图变量是 overview，但选中带 review 数据的 Work Item 时会直接进入 flow；因此默认入口会随当前工作类型调整。`console/template.html:1124-1130`、`console/template.html:5500`
- 任务概览默认折叠；折叠后隐藏 note，并把 11 格阶段 rail 压成只有色条、hover/focus 才出现文本的紧凑形态。`console/template.html:135-196`、`console/template.html:1129-1130`
- YAML 头部字段使用原生 `<details>`；被 supersede 的历史版本默认折叠，当前选中的历史版本例外。`console/template.html:542-565`、`console/template.html:3683-3705`
- 被否路线默认隐藏，只有选中含被否候选的节点或点击“显示被否路线”才展开；虚线残枝仍可追溯和重开。`aes-wayfinder/SKILL.md:103-107`、`console/template.html:4039-4052`、`console/template.html:4171-4188`
- 路线图支持缩放、平移、复位和全屏；图形节点可用 Enter/Space 打开。`console/template.html:638-675`、`console/template.html:1781-1931`、`console/template.html:4288-4304`
- 代码 hunk 可逐项收起；大型 diff 默认只显示摘要，显式确认后才加载完整内容。`console/template.html:4851-4883`
- 侧栏、目录、批注栏都能收起并保存；搜索结果能直接跳到正文命中位置。`console/template.html:3574-3592`、`console/template.html:5008-5059`、`console/template.html:5816-5834`

### 迁移判断

- **直接迁移的披露顺序**：状态摘要 → 当前异常/动作 → 选中对象 peek → Gate/Receipt 列表 → 原始证据。每一层都应能独立回答当层问题。
- **直接迁移**：历史 attempt、stale receipt、被否路线和原始 JSON 默认收起，但必须有数量与异常角标；展开不能改变状态。
- **不要照搬默认隐藏 Next**：StoryRoot 的核心任务是快速获取当前状态，Now/Why/Next 必须在紧凑模式仍可见。AES Console 的默认折叠更像“熟练用户继续读长文”的优化。

## 响应式策略

### 事实

- 它同时使用 viewport media query 和 main 容器查询。1100px 以下全局左栏变抽屉；正文自身小于 1010px 时先隐藏目录但保留 288px 批注栏；小于 820px 才把正文工作面完全堆叠。`console/template.html:996-1025`
- 阶段 rail 在正文容器不足 1180px 或 viewport 小于 900px 时横向滚动，避免每格文字压成两三行。`console/template.html:1026-1035`
- WayFinder 小于 1100px 变单列，排序是路线图 → 当前决策 → utility；小于 701px utility 和 handoff 字段再由双列变单列。`console/template.html:323-335`
- 宽屏收侧栏是把 grid 列压到 0，窄屏收侧栏是把抽屉移出；同一按钮按当前宽度切换行为，并更新 `aria-expanded` 与 `inert`。`console/template.html:1016-1045`、`console/template.html:5816-5834`

### 迁移判断

- **直接迁移**：优先用内容容器宽度决定证据三栏何时收缩，因为全局 sidebar 的开关会改变实际可用正文宽度。
- **直接迁移**：收缩顺序应按任务优先级定义，而非同比缩小所有组件；表格、阶段轨、Graph 宁可局部横滚。
- **必须改变**：workflow-story-map 窄屏应先显示 Now/Why/Next 与 Action Center，再显示图；不能照抄当前 WayFinder 的“路线图排第一”。

## 数据投影如何支撑 UI

### 事实

- Console 不是让浏览器现场猜状态。`export.py` 从可见 Work Item、artifact、ticket、manual test、WayFinder、review、todo 和 sibling worktree 收集派生 read model。`console/export.py:498-784`
- `stage.reached / next_skill / waiting_on` 是机器字段；中文 `next` 只给人看，页面不得解析它。`references/protocol.md:349-370`、`references/record-shapes.md:316-336`
- 页面也明确拒绝复制 `suggest_next`：导出数据提供相同确定性工具算出的 `next`，页面只显示。`console/template.html:3527-3532`、`console/export.py:701-711`
- 页面顶栏显示 `generated_at`，目录授权只用于发现记录是否比快照新；Junction 无法读取时显式报告 blind dirs，分支 checkout 也标明“不是主检出”。`console/template.html:1110-1119`、`console/template.html:5562-5581`
- WayFinder map 不是开放 ticket 的正本，也不复制 claim/token/完整答案；Console 读取 map 与 ticket 的派生数据，状态实时从 fog、ticket 和 Artifact 计算。`aes-wayfinder/SKILL.md:12-17`、`aes-wayfinder/SKILL.md:59-71`、`references/protocol.md:205-209`

### 迁移判断

- **直接迁移**：workflow-story-map 的 Web 只能消费 Core/Reducer 产出的 `now / why / next / waiting_on / freshness / gate_verdict`，不能在 React/HTML 中再实现一套 Gate 或 Router 逻辑。
- **直接迁移**：页面必须告诉人这是哪个 repo/checkout 的哪一版 read model；source freshness 是首屏状态，不是设置页元数据。
- **调整后迁移**：AES 的 static single-file 导出很适合本地可移植 Console，但 StoryRoot 的多 RepoLane 和 tracker 更新频率可能需要 live projection。可迁移的是“同源 read model + 显式 freshness”，不是 `file://` 技术形态。静态单文件设计事实见 `console/export.py:917-953`。

## 为什么它比 graph-only mock 更强

以下是从上述事实导出的产品推论，不是源码自述：

1. **它先解决 actionability，再解决 explainability。** 左栏和任务头先回答“哪里在等人、现在到哪、下一步做什么”；Graph 只负责说明决策依赖。
2. **它把同一对象按用户任务拆成三种视图。** 用户确认目标、理解路线、核查交付时，需要的是不同信息形状；没有要求一张 Map 同时承担三个任务。
3. **它把动作贴在证据旁边。** 人在看 manual test、设计、review 或 diff 时，不必回到另一个页面找“通过/整改/交给 Agent”。
4. **它给异常比正常更高的信息保真。** stale、读不到 checkout、人工未测、失败项、被否路线不会被总状态吞掉。
5. **它维护工作记忆。** 上次对象、视图、阶段、滚动、筛选和搜索都恢复，适合跨多次打开的长周期工作。

## 建议迁移优先级

| 优先级 | 迁移项 | workflow-story-map 中的落点 | 置信度 |
| --- | --- | --- | --- |
| P0 | 全局对象扫描行 | Story/Lane 列表：状态、waiting_on、blocker、next、evidence health | 高 |
| P0 | 常显 Now / Why / Next | StoryRoot 头与 Action Center；紧凑态也不隐藏 | 高 |
| P0 | 三视图信息架构 | 状态总览 / 依赖地图 / 交付与证据 | 高 |
| P0 | Map 三栏驾驶舱 | 选中节点详情 / 图 / frontier+行动 | 高 |
| P0 | 全局 freshness | repo、checkout、tracker、projection 时间与 degraded/stale banner | 高 |
| P1 | sticky action rail | Human Gate、waiver、retry、requires-decision 的上下文动作 | 高 |
| P1 | 证据渐进披露 | 摘要 → Receipt/Gate → 原始 evidence/source | 高 |
| P1 | 视图恢复 | Story、RepoLane、tab、筛选、滚动和选中节点 | 中高 |
| P1 | 容器级响应式 | 先收目录，再堆叠证据；移动端 Action Center 排在 Graph 前 | 高 |
| P2 | 暖中性色视觉 token | 作为视觉基线；字体资产、字号和对比度需重新实测 | 中 |
| 不迁移 | 固定 11 阶段、默认隐藏 Next、窄屏 Graph-first、`file://`/VS Code 专属动作 | 这些是 AES Console 的局部产品约束，不是 StoryRoot 公共行为 | 高 |

## 未知与验证债务

- 此目录没有真实用户十秒找状态测试、视觉回归截图或可访问性报告；“更快”仍需用任务测试验证。
- 源码写明小字色值以 4.5:1 为目标，但本轮未找到自动对比度测试，不能把注释当测试通过。
- `template.html` 未发现 `prefers-reduced-motion`、`prefers-color-scheme` 或 `@font-face`；因此 motion、dark mode 与指定字体加载不能从本目录宣称已覆盖。
- Graph 设有 720px 最小宽度并允许滚动，适合中小图；大规模多 RepoLane/DAG 是否仍可读，源码与文档没有证据。`console/template.html:236-240`
- Side list 的“有事要做的在前”实际只按 Work Item lifecycle 排序；等待人、阻塞后果和 SLA 并未形成真正的 Action Center 排序。`console/template.html:3375-3405`
- 本调查不判断 workflow、阶段 Skill、原子 Skill 的组合边界；那属于另一个 session 的 Skill chain 设计。
