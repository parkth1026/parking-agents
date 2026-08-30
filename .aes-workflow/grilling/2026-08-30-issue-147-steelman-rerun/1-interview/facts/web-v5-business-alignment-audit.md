# Fact: Web v5 业务对齐审计

- 审计对象：`2-prototype/drafts/v5-story-work-graph.html`
- 权威对照：`manifest.json`、`1-interview/context.md`、`rounds.jsonl`、真实 #147 数据分片、旧 spec/ADR
- 边界：本文件不确认 Web artifact，不替用户裁决，不修改产品代码。
- 结论：双 Tab、真实/模拟隔离与 P12 只读 Runtime 方向成立；当前业务语义仍为 `REWORK_REQUIRED`。

## 已对齐

1. `StoryRoot + DiscoveryMap / DeliveryMap` 两个一级 Tab，没有恢复固定六阶段 rail。
2. 真实 #147 使用 12 条 membership 与 7 条 descendant dependency；root 0/0 只描述 root。
3. Delivery runtime 常显 `SIMULATED GAP / NOT_CONNECTED`，所有运行对象使用 `SIM-*`，没有汇入真实 #147 终态。
4. `requires-decision → Discovery → contract revision → next Delivery wave` 与旧 Receipt stale 的方向符合 Q29/Q32。
5. Web 只做定位、筛选、查看、比较与投影，没有 claim、dispatch、retry、close、Gate 放行或 Agent lifecycle，符合 P11/P12。

## 确认阻塞项

| ID | 严重度 | 业务不对齐 | 直接证据 |
| --- | --- | --- | --- |
| B-01 | HIGH | **当前 Discovery revision 没进入 Graph。** 页面把历史 #147/#148–#159 旧设计图作为 Discovery 主图，而本轮 Q1–Q35、P5–P12 和 WEB-P9–P12 只出现在 badge/bridge。旧 spec/ADR 已被允许推翻且多处已被新裁决覆盖，所以它只能是 historical revision，不能代表 `current projection`。 | `context.md:17-30,94,100,215-257,295-320`；`v5-story-work-graph.html:97-110,128-171,223-240,276-278` |
| B-02 | HIGH | **WEB/CORE 不是已证明的 RepoLane。** Q33 的 RepoLane 必须绑定 repo identity、tracker、exact checkout、integration target、Profile/Gate catalog 与局部 done；v5 只有组件职责、owner、candidate subject 与 Gate。如果两组工作同属一仓，应叫 Workstream/Territory，而非两个 RepoLane。 | `context.md:28,135`；`v5-story-work-graph.html:187,193-195,244-256` |
| B-03 | HIGH | **公共 ticket 状态三轴被压成一个 `state`。** `closed/passed/running/blocked/ready/pending/locked` 混合 lifecycle、control 与 gate；Inspector 没有保留三轴详情。 | `context.md:17,94,116`；`v5-story-work-graph.html:63-64,223-256,269,273-274` |
| B-04 | HIGH | **integration subject 与最终全量回归缺失。** Lane card 和 Receipt 绑定 `SIM-*-C2` candidate，但节点被称为 integration Gate。Q28/Q29 要求目标 integration SHA 与该 SHA 上的 final full-suite Receipt；candidate 不能冒充 integration subject。 | `context.md:23-25,28,130-135`；`v5-story-work-graph.html:194-195,251,253,255,278` |
| B-05 | HIGH | **independent Review 的 actor 自相矛盾。** `RepoLane reducer` 与 `CORE Review` 都由 `SIM-C3` owner 承担，却写成 independent review，无法证明 Role/Carrier actor separation。 | `context.md:74-79,168,274-279`；`v5-story-work-graph.html:252,254` |
| B-06 | MEDIUM | **WorkTicket/Profile binding 不足。** QA/Review 都被画成独立节点，却不显示 ticket identity、`profile_id/schema_version/digest`、attempt 或从 Gate 晋升 WorkTicket 的理由；无法区分合法可调度工作与被错误实体化的 Gate。 | `context.md:17,21,94,111-124`；`v5-story-work-graph.html:246,249-255` |
| B-07 | MEDIUM | **Story reducer 的 why-not-done 不完整。** 只显示两条 Lane Gate，没有展示 integration SHA、full suite、pending Human Receipt/checklist、waiver 与 `done-with-waiver` 条件。 | `context.md:23-30,130-137`；`v5-story-work-graph.html:251,255-256,278` |
| B-08 | MEDIUM | **QA→Review 被画成通用固定顺序。** 当前裁决只要求 Profile/Gate 定义证据 DAG；Review 是否依赖 QA 必须由具体 Profile predicate 证明，不能从 Q29 的 stale 规则外推。 | `context.md:17,21,24,74-79`；`v5-story-work-graph.html:249-251,261,278` |
| B-09 | MEDIUM | **Frontier 语义不一致。** 按钮写 `Frontier 2`，但过滤代码还包含 locked Story reducer；locked reducer 不是可启动 WorkTicket。 | `v5-story-work-graph.html:180,249,254,256,268` |
| B-10 | MEDIUM | **来源粒度被压平。** 节点统一标为 `ISSUE FACT`，但 kind、why、unlocks 同时混入 ISSUE COMMENT 与 DERIVED 解释；例如 #159 的 `contract` 是内容分类，不是原生 label。 | `web-v5-real-story-dataset.md`；`v5-story-work-graph.html:223-242,273` |
| B-11 | LOW | **旧 spec/ADR 的优先级没有声明。** 页面把旧 #159 spec/ADR 与本轮 dossier 并列为“真实设计依据”，但冲突时应以本轮 rounds/context 为当前权威，旧文档只保留 historical evidence。 | `context.md:70,94,100,295-320`；`v5-story-work-graph.html:138-140,171,244-256,278` |

## 业务根因

v5 修复了固定阶段与真实/模拟混写，但又发生三类语义压平：

1. 用 `state` 压平 lifecycle/control/gate。
2. 用 `owner` 压平 Role、actor、Carrier 与 deterministic projector。
3. 用 WEB/CORE 组件区压平 repository 级 RepoLane。

这些压平让页面看起来合理，却不足以支持新会话从持久事实机械重建同一结论。

## 确认前最小修正边界

1. 保留双 Tab 和当前视觉系统，但把 Discovery 改成 versioned projection：historical #147 revision 与 current dossier revision 均可见。
2. 若没有两个真实 repo/integration target，把 WEB/CORE 改为 Workstream；若保留 RepoLane，补齐 lane identity。
3. WorkTicket Inspector 展示 lifecycle/control/gate、Profile binding、RoleAssignment、Carrier/actor provenance。
4. candidate 与 integration subject 分离，补 final integration SHA/full-suite/Human/Waiver why-not-done。
5. 修正 actor separation、frontier 过滤与字段级 provenance。

