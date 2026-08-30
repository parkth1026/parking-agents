# Fact: Web v5 可复用 Console / Board 表达

- 调查对象：`G:/GIT/AI_WorkFlow/aes-workflow/skills/engineering` 下 Console/WayFinder 协议与本仓 `skills/workflow/aes-worktree-board/board.html`、UI selftest。
- 边界：只记录已有实现或测试支持的表达；不把参考产品的领域状态机搬进 Story Work Graph，不替用户裁决最终布局。

## 核心结论

- AES Workflow Console 最强的是稳定任务头、显式下一步、frontier 与 evidence/freshness 分层。
- aes-worktree-board 最强的是 Map/List 同源、一跳聚焦、owner beacon、peek→完整证据，以及 700×1000 portrait 专用工作面。
- Story Work Graph 应以动态 Map 为第一视觉，但不能让 Map 独自承担读态：frontier、owner/RepoLane、blocker、next action 与 freshness 必须贴图常显。

## 高置信可复用模式

| Rank | 模式 | 证据落点 |
| ---: | --- | --- |
| 1 | Map/List/search/filter/selection 消费同一状态源 | board Map/List 与 selftest |
| 2 | 全局概览 → 一跳聚焦 → peek → 完整证据 | board portrait 与 selection selftest |
| 3 | frontier、next action、owner 紧贴地图常显 | AES WayFinder + board Workers/ORCH |
| 4 | stale、blind、unreadable、NOT_RUN、SNAPSHOT 显式 | AES exporter/Console + board mode logic |
| 5 | 768×1080 使用专用工作面，不压缩桌面三栏 | board 700×1000 portrait |

## 具体表达合同

### 稳定头部

- 常显 StoryRoot identity、contract revision、snapshot/live、last refresh 和 source health。
- next action 必须来自 Core 确定性投影，Web 不解析中文或从颜色猜动作。
- stale/unavailable 不藏进 tooltip。

### Map 与 List 同源

- Map 回答“为什么被挡、会解锁谁”。
- List 回答“有哪些需要处理”，但不是第二套流程。
- 搜索、status filter、RepoLane filter 与 selection 在 Map/List 间一致。

### 一跳聚焦

- 默认只显示高信号全局骨架。
- 选择节点后把它居中、展开真实一跳邻居，其他节点淡出并退出辅助技术树。
- 先打开不遮目标节点的 peek；完整 Evidence/Review 才升级为独立 Workspace。

### Frontier 与动作

- DiscoveryMap 与 DeliveryMap 各自有 frontier。
- 全局 next 与 safe parallel 从两者确定性派生。
- blocked、open、frontier、eligible-to-dispatch 不共用一个颜色或枚举。

### RepoLane / Owner beacon

- 常显 RepoLane、owner/actor、current WorkTicket、worst Gate、blocker 与 next。
- 点击 Lane beacon 定位到当前 frontier/blocker。
- Lane drawer 与 node evidence Inspector 互斥；不把 RepoLane 等同 worktree runner。

### 阻塞与恢复

- Map edge 显示依赖；peek 显示来路、后果、owner、next 与 unlocks。
- dangling edge、missing Receipt、stale subject 是可见 health item，不能静默过滤。

### Evidence 下钻

- 依次读取 Ticket → Result → Receipt/Evidence；Map 只持摘要和引用。
- evidence 缺失显示 missing/NOT_RUN，不生成占位绿灯。

### 768×1080 专用工作面

- 顶部仅保留 identity/source health、Map/List、search/filter。
- 主工作面归图；selected context 使用底部 peek；RepoLane/owner 使用抽屉；复杂 Review 使用专用全屏面。
- 恢复 view、selection、filter、zoom、scroll、Inspector 展开态与返回位置；不把 UI state 当 canonical state。

## 不得照搬

| 参考表达 | 原因 |
| --- | --- |
| AES 固定工程阶段 rail | 服务 Artifact workflow，与动态双图冲突 |
| AES 单张 WayFinder 决策图 | 只覆盖 planning/decision，不能替代 Discovery + Delivery |
| board 四/五态 | 无法表达 requires-decision、degraded、Gate freshness 与 Story reducer |
| board closed/total | Issue close 不等于跨 RepoLane Story done |
| board Workers/Runner | 绑定本地 worktree；RepoLane 也可能是远端 CI、人工或调查 |
| 任一参考的最终布局 | 都没有多 RepoLane、双动态图、Contract revision 回流与 required-lane Gate 合成 |

## v5 参考合同

- Story Map 与 List 共用投影、filter、search、selection。
- 默认显示高信号骨架，选择后展开一跳。
- Map 第一视觉，frontier rail、owner beacon、source health 常显。
- Peek 回答 status/owner/blocker/next/unlocks。
- 完整详情才展示 Attempt、Receipt、Gate、transition 与日志。
- 768×1080 使用 bottom sheet + drawer，不压缩三栏。
- 所有 missing/stale/blind/unreadable/NOT_RUN/SNAPSHOT 显式。
- Map 是投影；Ticket、Contract、Receipt 与 Gate 保持唯一真源。

