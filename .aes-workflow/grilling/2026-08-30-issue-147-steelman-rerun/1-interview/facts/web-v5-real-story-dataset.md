# Fact: Web v5 真实 Story 数据集与模拟缺口

- 调查对象：GitHub `parkth1026/parking-agents#147` 与 #148–#159、root timeline、当前 dossier、`parking-agents/docs/design/workflow-story-map/spec.md` 与 ADR 0001–0004。
- 调查方法：`gh issue view ... -R parkth1026/parking-agents` 逐票读取；本地文件只读对照。
- 边界：真实事实、作者评论、dossier 裁决、派生分类和模拟运行态严格分层；设计依据真实不等于运行事实真实。

## 关键修正

旧原型把 `#147 blockedBy=0 / blocking=0` 错误扩展成“整个 Story 没有 native dependency”。逐票读取后确认：

- root #147 自身的 `blockedBy=0 / blocking=0`；
- #148–#159 全部是 #147 的真实 sub-issue，共 12 条 membership edge；
- descendant subgraph 内存在 **7 条真实 GitHub dependency edge**；
- #147 没有真实 Delivery runtime，implementation、RepoLane、candidate、Receipt、Gate、active owner 与 wave 都不能冒充 ISSUE FACT。

## Provenance 分类

| 标签 | 允许表达 |
| --- | --- |
| `ISSUE FACT` | GitHub API 直接字段、membership 和 dependency |
| `ISSUE COMMENT` | 作者评论声明的顺序、结论和交付说明 |
| `DOSSIER FACT` | manifest、rounds、context 中已经持久化的用户裁决 |
| `DERIVED` | 从标题、真实边、spec/ADR 与 dossier 做的有限分类 |
| `SIMULATED GAP` | 为覆盖不存在的 Delivery runtime 而构造的票、Lane、Receipt、Gate、candidate、owner、wave 与状态 |

模拟节点必须同时保存 `truth_class=SIMULATED GAP` 与 `design_basis[]`，不能因为依据来自真实 spec 就改称真实执行事实。

## Root #147 真实字段

| 字段 | 值 |
| --- | --- |
| repo / number | `parkth1026/parking-agents#147` |
| title | `story 级全链条工作流整合设计` |
| state / reason | `CLOSED / COMPLETED` |
| author / assignees | `parkth1026` / 空 |
| label | `wayfinder:map` |
| created | `2026-08-28T18:37:40Z` |
| closed / updated | `2026-08-29T04:18:31Z` |
| parent | null |
| subIssues | 12/12 closed，100% |
| root blockedBy / blocking | 0 / 0 |
| comments | 1 |
| milestone / issueType / project | 空 |

Root 正文明确：终点是设计定稿；实现另开 effort；覆盖流程真源与 Web 投影设计但不实施。唯一 closure comment 声明 spec v1.0 与 ADR 0001–0004 已交付，并给出 #148–#159 的作者全链回溯。该回溯是 `ISSUE COMMENT`，不是全部 native dependency。

## 12 个真实子 Issue

共同字段：`parent=147`、`CLOSED/COMPLETED`、author 与 assignee 都是 `parkth1026`、无 milestone/type/project/sub-issue，正文首行 `Part of #147`。

| # | 标签 | created | closed | comments | blockedBy | blocking |
| --- | --- | --- | --- | ---: | --- | --- |
| 148 | `wayfinder:research` | 18:38:07 | 18:48:59 | 1 | — | 152,153,155 |
| 149 | `wayfinder:research` | 18:38:09 | 18:49:41 | 1 | — | 152,154 |
| 150 | `wayfinder:research` | 18:38:11 | 18:47:02 | 1 | — | 153 |
| 151 | `wayfinder:research` | 18:38:13 | 18:45:39 | 1 | — | — |
| 152 | `wayfinder:grilling` | 18:38:33 | 19:14:08 | 1 | 148,149 | — |
| 153 | `wayfinder:grilling` | 18:38:36 | 19:17:59 | 1 | 148,150 | — |
| 154 | `wayfinder:grilling` | 18:38:38 | 19:39:45 | 2 | 149 | — |
| 155 | `wayfinder:grilling` | 18:38:40 | 19:39:53 | 2 | 148 | — |
| 156 | `wayfinder:grilling` | 19:14:11 | 19:39:47 | 2 | — | — |
| 157 | `wayfinder:grilling` | 19:14:13 | 19:39:45 | 2 | — | — |
| 158 | `wayfinder:grilling` | 19:40:31 | 20:09:56 | 1 | — | 159 |
| 159 | `wayfinder:task` | 19:40:33 | 2026-08-29 04:17:49 | 1 | 158 | — |

以上未写日期的时间均为 2026-08-28 UTC。

### 7 条 native dependency

```text
#148 -> #152
#148 -> #153
#148 -> #155
#149 -> #152
#149 -> #154
#150 -> #153
#158 -> #159
```

#151、#156、#157 没有 native dependency。作者 closure comment 给出的完整线性顺序只能作为另一种 overlay。

## 真实节点语义

| 范围 | 真实产出 |
| --- | --- |
| #148–#151 | interview/Web、wayfinder、board、engineering 路由与门禁调研 |
| #152 | 独立组合层技能落点裁决 |
| #153 | 双层可插拔执行与 Story 收口裁决，不是 implementation |
| #154 | tracker 真源、双 tracker、claim 与投影重算裁决 |
| #155 | story grill、拆解出口、ticket finalize 与回退裁决 |
| #156 | map 索引 + ticket dossier 两级同构 |
| #157 | `workflow-story-map` 命名与发布边界 |
| #158 | Story Web 星图归属与交互协议 |
| #159 | spec v1.0 + ADR 0001–0004 定稿，不是代码交付 |

## 当前 dossier 事实

- stage：`2-prototype` pending；1-interview done；3-contract pending；overall in_progress。
- `WEB-P9`：Map-first 动态双图；推翻工作台优先、Queue-first 首屏和固定六阶段。
- `WEB-P9-NAMING-SUPPLEMENT`：Story Atlas / Story Work Graph / Versioned Dual-track Story Workflow Graph。
- Q23–Q35：StoryRoot、独立 DiscoveryMap/DeliveryMap、ProfileRegistry、typed Receipt、Gate、风险升档、Role/Carrier、integration SHA、stale、Waiver、多 RepoLane、Human authorization、fail-closed degraded。
- Q32：Contract 不变自动进入下一 wave；改变用户承诺或无法分类时 requires-decision 回 Discovery。

## 当前真实缺口

以下数据没有任何真实来源可证明：

- 后续 implementation StoryRoot 或票；
- 真实 RepoLane/repo/checkout/branch/integration target；
- candidate/base SHA、diff、owner、Agent/Task、lease/claim；
- ProfileRegistry digest、GateCatalog、Qa/Review/Human/Waiver Receipt；
- wave、requires-decision 实例、stale Receipt、parallel frontier；
- GitLab 对应 Story、Skill+Web Runtime 或 Web 数据接口。

真实页面必须常显：

```text
DELIVERY RUNTIME: NOT_CONNECTED
IMPLEMENTATION MAP: 0 VERIFIED NODES
```

## 从真实设计依据派生的 SIM DeliveryMap

所有 ID 必须以 `SIM-` 开头，常显 `SIMULATED GAP`。

### RepoLane

| Lane | 模拟职责 | 真实设计依据 |
| --- | --- | --- |
| `SIM-LANE-CORE` | tracker adapter、Story reducer、Profile/Gate/Receipt、local Runtime | spec §10、ADR 0002–0004、Q23–Q35 |
| `SIM-LANE-WEB` | Story Atlas、Story Work Graph、Review Workspace | #158、WEB-P9、WEB-P5 |

### 建议模拟票

| ID | Lane | 标题 |
| --- | --- | --- |
| SIM-I01 | CORE | tracker-neutral Story index 与 dependency reader |
| SIM-I02 | CORE | StoryRoot、DiscoveryMap、DeliveryMap reducer |
| SIM-I03 | CORE | ticket finalize、tracker ack 与 frontier command |
| SIM-I04 | CORE | 独立 Skill+Web local Runtime 与 continuation authority |
| SIM-I05 | CORE | ProfileRegistry、Receipt validator、Gate projector |
| SIM-I06 | CORE | RepoLane reducer、integration Gate 与全量回归 |
| SIM-I07 | CORE | ticket dossier 与 story 合成投影 |
| SIM-W01 | WEB | Map-first 动态双图 |
| SIM-W02 | WEB | Now/Why/Owner/Next 与并行 frontier |
| SIM-W03 | WEB | Review Workspace 与 Human Receipt |
| SIM-W04 | WEB | provenance、NOT_CONNECTED 与 degraded projection |
| SIM-R01 | CORE | 当前 release/maintenance 规则重新核对 |

### 模拟依赖

```text
SIM-I01 -> SIM-I02, SIM-I03, SIM-I05
SIM-I02 -> SIM-I04, SIM-I06, SIM-I07, SIM-W01
SIM-I03 -> SIM-I04
SIM-I05 -> SIM-I06, SIM-W03, SIM-W04
SIM-I07 -> SIM-W01
SIM-W01 -> SIM-W02
SIM-W02 -> SIM-W03
SIM-I04 -> SIM-W03
SIM-I06, SIM-W03, SIM-W04 -> SIM-R01
```

这些边是 `DERIVED + SIMULATED GAP`，不是 GitHub dependency。

### 必须覆盖的演练

1. Wave 1：SIM-I01 与 SIM-W01 并行；旧 Web candidate 得到模拟 PASS Receipt。
2. Review finding 发现固定阶段与 Runtime authority 会改变公共语义，触发 `requires-decision` 回 Discovery。
3. `contract@1 -> contract@2` 后旧 Receipt 变 `STALE / audit only / gate contribution none`。
4. Wave 2 frontier：SIM-I04、SIM-I05、SIM-W01R；之后 CORE QA PASS、CORE Review READY、WEB QA RUNNING、WEB Review blocked。
5. 两条 required RepoLane Gate 均 pending，Story acceptance locked；主动作 Finish WEB QA，CORE Review 可安全并行。

## UI 必须支持的查询

真实模式：12 members、7 descendant dependencies、author progression overlay、comments/timeline、Delivery empty truth。

模拟模式：双动态图、RepoLane filter、wave history、requires-decision 回流、contract revision、stale Receipt、parallel frontier、Gate 合成和 acceptance lock reason。

任一节点详情必须回答：truth class、source、subject/revision、当前状态原因、阻塞后果、下一安全动作、有效与 stale evidence。

## 禁止误导

- 不得再无条件写“#147 native blocker edges 为 0”；必须限定为 root 自身。
- 不得忽略 7 条 descendant native dependency。
- 不得把 closure comment 顺序全部画成 native dependency。
- 不得把 #153 当 implementation、#159 当代码交付。
- 不得把 spec §10 建议切票画成已创建 Issue。
- 不得为真实 #147 生成 candidate、Receipt、Gate、RepoLane 或 active owner。
- 不得让模拟 PASS 汇入真实 Story 状态。

