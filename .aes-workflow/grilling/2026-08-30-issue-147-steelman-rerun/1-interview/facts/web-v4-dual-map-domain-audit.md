# Fact: Web v4 双动态图领域审计

- 调查性质：只读领域审计；原负责 subagent 受角色只读约束，正文由主 Agent 按其完整回传落盘。
- 主要证据：`1-interview/context.md:111-135`、`1-interview/rounds.jsonl` 中 Q23/Q32/Q33 与 WEB-P9、`2-prototype/drafts/v1-behavior.md`。

## 结论

用户的纠正成立。领域模型不是 `Discovery → Contract → Delivery → QA → Integration → Closeout` 六阶段流水线，而是：

```text
StoryRoot
├─ DiscoveryMap  动态 WorkTicket + frontier
└─ DeliveryMap   动态 wave / RepoLane / WorkTicket + frontier
```

稳定的是 StoryRoot、两张子图、WorkTicket 身份、RepoLane、Attempt/Receipt、ProfileRegistry 与 Gate 规则；动态的是节点、边、frontier、wave、owner、阻塞和行动投影。

WorkTicket 不从 research 原地变成 implementation 再变成 QA。每票完成自己的稳定 profile 后关闭，通过 `produces / graduates_to / verifies / accepts / requires-decision` 等关系生成或连接新的实际票。

## 正确的图语义

- `DiscoveryMap` 承载实际 research、decision、prototype，以及改变 Contract 或无法分类的 fog；拥有独立 frontier 与局部终态。
- `DeliveryMap` 按实际 wave 承载 implementation、bug/fix、QA、review、acceptance 与 human work；Delivery 不是一次性静态 DAG。
- `requires-decision` 从具体 Delivery finding 回流到具体 Discovery ticket；Contract revision 再通过新 `produces` 边生成下一 Delivery wave。
- RepoLane 是 DeliveryMap 内的一等分区；每条 lane 有 tracker、exact checkout、integration target、局部 Gate 与终态。
- 一个全局主动作与安全并行队列保留，但只能由双图 frontier、依赖和 Gate 派生，作为地图 overlay/Inspector，不再压过地图本体。

## Contract / QA / Integration / Closeout

### Contract

Contract 是版本化用户承诺边界与验证 subject，不是固定格。StoryRoot 常显当前 revision/digest；Delivery ticket、Receipt 与 Gate 绑定它。revision 变化后旧 Receipt stale。

### QA / Review / Acceptance

默认是来源票的 Gate/Evidence。只有确实具有独立 owner、context、blocking、retry 或跨票覆盖时，才成为实际 WorkTicket 节点。不是每张票都经过同名 QA 阶段。

### Integration

是每条代码 RepoLane 的 terminal subject/Gate。若 integration 工作本身需要独立调度，才创建实际 WorkTicket；否则只表现为 lane terminal Gate。

### Closeout

没有已锁定的独立 Closeout stage。StoryRoot 从 required RepoLane Gate、目标 integration SHA 的最终全量回归和必要 Human Receipt 机械合成 `done / done-with-waiver`。发布说明、迁移或人工签收若真实存在，再单独生成 WorkTicket。

## WEB-P9 推翻与保留

| 旧表达 | WEB-P9 后 |
| --- | --- |
| P3：工作台第一、Map 第二 | 推翻；当前 Story 双图成为默认第一可视化 |
| WEB-P6：768 Queue-first | 推翻首屏主密度；768 一等验收视口保留 |
| WEB-P7：固定六阶段主坐标 | 推翻；删除固定槽位 |
| P4：一个主动作 + 安全并行 | 保留为 map-derived projection |
| WEB-P5：Modal / Review Workspace 分级 | 保留，从选中节点进入并恢复 map context |
| WEB-P8：provenance 隔离 | 保留到每个节点和边 |

## 根因

v3 把 AES 工程材料的“稳定扫描位置”误升格为 Story 的“稳定领域生命周期”，并把地图分区、版本边界、验证机制、Lane 终点和 Root reducer 五种不同类别画成同一种时间阶段。

v4 应采用：**动态双图为领域本体，稳定操作语法作为 UI 骨架。**
