# Fact: Web v4 真实与模拟双地图样本计划

- 调查性质：只读 fixture/provenance 规划；原负责 subagent 受角色只读约束，正文由主 Agent 按其完整回传落盘。

## 真实 #147

`#147` 是已关闭的设计 Map，不是 active delivery Story。

### DiscoveryMap

- StoryRoot：`ISSUE-147`，`CLOSED/completed`，12/12 native sub-issues closed，native `blocked-by=0 / blocking=0`。
- #148–#151：标题可派生为 `research`，必须标 `DERIVED`。
- #152–#158：标题可派生为 `decision`，必须标 `DERIVED`。
- #159：可派生为 `contract-finalization`；不是 implementation completion。
- 默认边只有 #147 → 12 child 的 native membership。closure comment 的演进叙事只能作为默认关闭的 `ISSUE COMMENT · author-declared progression`，不得冒充 native dependency。

特别禁止：#153 虽提到执行与验收，仍是架构裁决，不得放进 DeliveryMap。

### DeliveryMap

必须真实为空：`0 verified nodes / REPO NOT_CONNECTED`。不得为 #147 生成 implementation、RepoLane、candidate、Gate、Receipt、owner、wave、quorum 或 current action。

当前本地 dossier 只能作为 `DOSSIER SIDECAR · NOT TRACKER MEMBER`；不能伪装成第 13 张子票。

## SIM active Story

所有 ID 必须以 `SIM-` 开头，不能复用真实仓库名、SHA、Receipt 或 #147 身份。

### DiscoveryMap 最小节点

- `SIM-D0` intent；
- `SIM-D1 / SIM-D2` 两张并行 research；
- `SIM-C1` superseded contract@1；
- `SIM-RD1` 由 wave-1 finding 回流的 requires-decision；
- `SIM-C2` current contract@2。

### DeliveryMap 最小节点

- 折叠的 wave-1 历史及 acceptance finding；旧 QA Receipt 必须 `STALE · Gate none`；
- wave-2 的 WEB implementation → QA running → Review blocked → Lane Gate pending；
- wave-2 的 CORE implementation → QA passed → Review ready → Lane Gate pending；
- Story acceptance reducer locked。

当前 frontier 精确为：

1. `SIM-W2-WEB-Q · RUNNING`，全局 NEXT；
2. `SIM-W2-CORE-R · READY`，安全并行。

主动作理由：完成 WEB QA 会解锁 WEB Review，并缩短最长 required-lane 路径；CORE Review 不依赖 WEB QA，可并行。

## 可证伪条件

1. 默认首屏是 StoryRoot + DiscoveryMap + Contract revision seam + DeliveryMap，不存在六阶段 rail。
2. 真实模式有 12 Discovery nodes、0 verified Delivery nodes、12 native membership、0 native blocker edge。
3. SIM 模式一眼可见两次 contract、两轮 wave、两条 RepoLane 与一条 Delivery→Discovery 回流边。
4. Wave-1 PASS Receipt stale，不贡献 contract@2 Gate。
5. 两个 required RepoLane Gate 未满足时，Story reducer 保持 locked。
6. 任一节点详情能回答 source、type、state、Now、Why、Owner、Next、Unlocks。
