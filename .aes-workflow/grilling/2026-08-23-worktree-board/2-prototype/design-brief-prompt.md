# 设计需求 Prompt：issue 知识图谱视图（worktree 作战台默认视图）

> 用法：把「中文版」或「English version」整段贴进设计工具。两版内容等价。
> 拿到定稿图后交回主仓 agent，由它编码回真实页面。

---

## 中文版

为一个开发者工具设计其**默认主界面**：一张「issue 知识图谱」，深色桌面 UI，1440×900。

**产品背景**：一个"主脑作战台"——用户（技术负责人）用一个网页监控 5 个并行开发工作区（worker：dev1~dev5）在一张需求地图（GitHub issues）上的推进情况，并从图上直接派活。

**这张图必须让用户在 3 秒内读出两件事**：
1. 需求地图探明了多少——整体进度感（61 个 issue 中 44 个已完成）；
2. 每个 worker 此刻在做哪个 issue、处于什么状态。

**页面结构（自上而下）**：
1. 顶栏：产品名「AES 需求地图」· 视图切换（图谱｜地图，图谱为激活态）· 探明进度条「已探明 44/61 · 72%」· 三个计数 chip（可开工 6 / 进行中 2 / 被阻塞 4）· 刷新按钮×2；
2. worker 名册条：5 张横排小卡（dev1~dev5），每张含：状态圆点 + 名字 + 状态文字（▶ 任务运行中=琥珀 / ✋ 手动推进=浅蓝 / 空闲=灰）+ 第二行「在做 #41 访谈确认门禁」；异常徽标：「31 未提交 ⚠」（橙）、「评估过期」（黄，虚线框）；
3. 主体（约 75% 高度）：issue 关系图谱。

**图谱语义（核心）**：
- 节点 = issue，四种状态：
  - frontier 可开工（依赖全部完成、无人认领）：亮青蓝，最醒目，是用户派活的目标；
  - claimed 进行中（有 worker 认领）：琥珀金，节点旁钉一个小 worker 名牌「dev5 ▶」；
  - blocked 被阻塞（依赖未完成）：暗红棕、偏小；
  - resolved 已探明（已关闭）：暗绿灰小点，退到背景层，构成"已探明领土"的氛围但不抢注意力；
- 节点大小随依赖连接数增大；每个开放节点下方有短标签「#41 访谈确认门禁」；已关闭节点只在少数处标注编号；
- 边 = 依赖关系：已满足的依赖 = 细实线（微绿）；未满足 = 更淡的灰色细虚线；
- 布局：有依赖关系的节点聚成核心网；无依赖的开放项在旁侧；已关闭的暗点自然散布外围（不要机械的正圆环）。

**需要两帧**：
1. 默认态（如上）；
2. 邻域聚焦态：某节点被点选——它与直接邻居、相连的边保持全亮，其余一切降到 ~15% 透明度（Obsidian 图谱的交互）。

**视觉方向**：Obsidian graph view 的克制 + 专业深色工具 UI（近黑蓝底 #10131a 一类）。颜色只承载状态信息，不做装饰。字体倾向 IBM Plex Sans / Mono 或同类工具感字体。

**明确不要**：星空/粒子/轨道环等装饰动画元素、大面积发光、渐变滥用、机械的同心圆布局、假的浏览器/系统边框。

---

## English version

Design the **default main screen** of a developer tool: an "issue knowledge graph", dark desktop UI, 1440×900.

**Context**: a "commander's board" — the user (a tech lead) monitors 5 parallel dev workspaces (workers: dev1–dev5) advancing across a requirement map (GitHub issues), and dispatches work directly from the graph.

**The screen must answer two questions within 3 seconds**:
1. How much of the requirement map is explored — overall progress (44 of 61 issues done);
2. What each worker is doing right now, and in which state.

**Page structure (top to bottom)**:
1. Top bar: product name "AES Requirement Map" · view toggle (Graph | Map, Graph active) · progress bar "explored 44/61 · 72%" · three count chips (ready 6 / in-progress 2 / blocked 4) · two refresh buttons;
2. Worker roster strip: 5 compact cards (dev1–dev5), each with a status dot + name + state text (▶ task running = amber / ✋ manual = light blue / idle = gray) + second line "working on #41 interview gate"; warning badges: "31 uncommitted ⚠" (orange), "assessment stale" (yellow, dashed border);
3. Body (~75% height): the issue relationship graph.

**Graph semantics (core)**:
- Nodes = issues, four states:
  - frontier / ready (all deps closed, unclaimed): bright cyan-blue, the most salient — these are dispatch targets;
  - claimed / in-progress: amber gold, with a small worker name tag pinned beside the node ("dev5 ▶");
  - blocked (deps unresolved): dim red-brown, smaller;
  - resolved (closed): dim green-gray dots receding into the background — an "explored territory" ambience that never competes for attention;
- Node size scales with dependency degree; open nodes carry a short label below ("#41 interview gate"); closed dots are numbered only sparsely;
- Edges = dependencies: satisfied = thin solid line (faint green); unsatisfied = fainter gray dashed line;
- Layout: dependency-connected nodes cluster into a core web; independent open items sit nearby; closed dots scatter organically around the periphery (no mechanical perfect ring).

**Two frames required**:
1. Default state (as above);
2. Neighborhood-focus state: one node selected — it, its direct neighbors and connecting edges stay fully lit, everything else drops to ~15% opacity (Obsidian graph interaction).

**Visual direction**: the restraint of Obsidian's graph view + professional dark tool UI (near-black blue base like #10131a). Color carries state information only, never decoration. Typeface leaning IBM Plex Sans / Mono or similar tool-grade faces.

**Explicitly avoid**: starfields / particles / orbital rings or any decorative animation motifs, heavy glow, gradient overuse, mechanical concentric layouts, fake browser/OS chrome.
