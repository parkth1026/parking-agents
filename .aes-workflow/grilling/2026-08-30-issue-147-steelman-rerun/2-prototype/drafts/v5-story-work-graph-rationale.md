# Story Work Graph v5 · Product rationale

## Product definition

`Story Atlas` 是产品名，`Story Work Graph` 是页面名。一个 StoryRoot 下有两个一级阶段入口：

- `Discovery Graph`：需求、调研、裁决、Contract 形成与改变承诺的回流。
- `Delivery Graph`：多 RepoLane 实现、QA、Review、Receipt、Gate、integration 与 Story acceptance reducer。

两个 Tab 不是固定流水线格。每个 Tab 内的节点和边由真实 WorkTicket / Receipt / Gate 动态生成；跨图通过 Contract revision、requires-decision 和一跳导航保持闭环。

## v5 为什么不沿用 v4

v4 修正了六阶段误建模，但把两张完整图同时压在 768px 画布里，丢失了 v3 的主动作、Lane 读态与 selected context。v5 保留动态双图语义，同时把两图分到独立 Tab，让每张 Graph 获得完整阅读面积。

## 真实数据修正

v3/v4 只读取 root #147 的 `blockedBy=0 / blocking=0`，错误地展示成整个 Story 没有 native dependency。逐票读取 #148–#159 后，v5 使用：

- 1 个真实 StoryRoot；
- 12 个真实 sub-issue；
- 12 条真实 membership edge；
- 7 条真实 descendant dependency edge；
- 作者 closure comment 的演进顺序作为可关闭 overlay，不冒充 native dependency。

真实 #147 明确排除了实现，因此 Delivery Tab 的全部运行态都使用 `SIM-*`，并常显 `SIMULATED GAP / runtime NOT_CONNECTED`。

## Delivery 演练依据

模拟 Delivery 不从空白想象，依据为：

- `parking-agents/docs/design/workflow-story-map/spec.md` §10；
- ADR 0002–0004；
- dossier Q23–Q35、P12、WEB-P9–P11；
- #158 Web 投影裁决与 #159 spec/ADR 定稿声明。

P12 已把 Runtime 收缩为 `Workflow/Skill → 持久事实 → Projection Runtime → Web` 的单向只读链路。因此 v5 的按钮只定位、筛选、查看、对比和导出，不 claim、dispatch、retry、close 或修改 Contract。

## 来自 AES Engineering Console 的设计语言

直接继承：

- warm neutral tokens、Anthropic/system font stacks、低阴影和细边界；
- 稳定 Story header、truth freshness、Next action；
- Map/List 同源、frontier、search/filter、selected context；
- 一跳聚焦、Evidence 下钻、missing/stale/NOT_RUN 显式。

没有继承：

- 固定九阶段 rail；
- 单张 WayFinder 图代替双图；
- worktree runner 或 closed/total 等同 Story done。

## 768×1080 交互合同

- 默认 Delivery Tab，因为当前演练主动作位于 WEB QA。
- 两个 Tab、Story Pulse、truth boundary 与 cross-Graph rail 首屏可见。
- Graph 保持 12px 节点标题；完整数据通过页面/Graph 滚动，不靠缩放到不可读。
- 选中节点后，Now / Why / Owner / Next / Unlocks 在 Graph 下方同源投影，不覆盖目标节点。
- 复杂 evidence 使用只读 modal；返回恢复当前 Tab、selection、filter 和 Graph state。

## 仍待用户确认

v5 是可逐处质疑的草稿，不是确认版 `mock.html`。当前需要用户核对：

- 两个 Tab 是否真的表达“设计 → 执行”的完整 Story；
- Discovery 的 12+7 真实 Graph 是否读得清；
- Delivery 演练是否足够真实且没有冒充运行事实；
- Story Pulse、RepoLane、selected context 与 Evidence 是否恢复了 v3 的操作优势。

