# Impact Surface: 2026-08-30-issue-147-steelman-rerun

> 接续说明：下表保留早期七面扫描与历史草稿定位；当前候选文件、P13 新裁决及确认状态以文末“P13 后当前对照物”检查点为准。旧行中的“待产出”不再表示最新文件状态。

- 扫描时间：2026-08-30T00:00:00+08:00
- 上游：`1-interview/context.md`、`1-interview/rounds.jsonl`（Q1～Q35）
- 判据：新版设计落地后，`workflow-story-map` 在哪些地方运行得不一样，谁会看见、谁会受影响。

| 影响面 | 有/无 | 具体差异 | 受影响者 | 对照物 |
| --- | --- | --- | --- | --- |
| 用户可见界面 | 有 | WEB-P9 继续锁定 Map-first、动态 DiscoveryMap/DeliveryMap 与无固定六阶段。WEB-P10/WEB-P11 进一步把两张图改成同一 StoryRoot 下的两个一级 Tab：`Discovery Graph` 与 `Delivery Graph`；每个 Tab 内有自己的完整 Graph、frontier、Map/List、search/filter、selection 与 Now/Why/Owner/Next/Unlocks。共同 Story header、Contract/return rail 和一跳导航维持设计→执行→finding→再裁决的闭环。v5 直接采用 AES Engineering Console 的 warm-neutral tokens、字体、低阴影、frontier、freshness、搜索与 selected-context 语法。真实 Discovery 使用 #147 + 12 membership + 7 descendant dependency；root 0/0 明确只描述 root。真实 Delivery runtime 仍为 `NOT_CONNECTED / 0 VERIFIED`，完整 Delivery 只在逐字段标记 `SIMULATED GAP` 的 spec/ADR/dossier 推演中出现。 | Story owner、RepoLane owner、QA、reviewer、人工验收者 | `drafts/v5-story-work-graph.html`、`drafts/v5-story-work-graph-rationale.md`、`drafts/v5-design-qa.md`、`evidence/webp11-v5/`；v3/v4 保留为 superseded 对照证据 |
| 可观察行为 | 有 | StoryRoot 可跨多个 RepoLane；DiscoveryMap/DeliveryMap 双 frontier；profile/attempt/receipt/gate 均有稳定、可重建的生命周期；contract 不变的发现自动进入下一 wave，改变承诺则回流 Discovery；最终 done 由所有必需 lane 的 integration gate 合成。P8/P9 保留核心规则单一实现与共用 Web Shell；P10/P11 改为不依赖 AesAgent 的独立 Local Runtime，但 Runtime 只做单向信息同步与 Web 投影，不调动 Agent。 | 总控 Agent、执行器、验证角色、用户、独立 Runtime 维护者 | `drafts/v1-behavior.md`；单向同步 Runtime 新版逻辑草稿待产出，AesAgent v4 双 Host稿仅作历史 |
| 可运行输出 | 有 | 冷启动接管、信息同步、projection rebuild、freshness/provenance、Registry degraded 与 Story 状态观察都会产生确定性输出；`--explain-route` 仍可解释 Workflow/Role/Skill 语义，但 Local Runtime 不执行或恢复 Agent。Agent start/resume/stop、lease、Provider/Task、AesAgent install/promotion 全部移出当前范围。 | 操作 CLI/Skill 的用户、独立 Runtime 运维者与自动化 harness | `drafts/v1-example-run.md`、`drafts/v2-orchestration-example.md`；单向同步 Runtime 示例待重写 |
| 对外接口报文 | 有 | 新增 tracker-neutral Story/RepoLane/WorkTicket/Attempt envelope、typed event、Receipt/Gate；Web 消费同 revision 的两个 map frontier、current contract、Now/Why/Next、Action projection、RepoLane Gate 与 freshness read model。共用 Surface 仍需 declarative `SurfaceDocument`、revision/digest、cursor/history、Artifact ref 与安全 fallback；P11 删除 `AgentRuntimeAdapter` 和 `agent-resumed/consumed` 作为 Local Runtime 责任。Web projection 必须保留 provenance，前端不得从边或颜色自行猜 live Agent 状态。 | TrackerAdapter、Execution evidence importer、Local Runtime、共用 Web Shell、ProfileRegistry 实现者 | `drafts/v1-api-mock.md`、`drafts/v2-web-projection-api.md`；`v4-surface-protocol.md` 仅作历史输入，单向协议待重写；Web 证据见 `drafts/webp9-v4-product-audit.md` |
| 用户配置 | 有 | 每个 RepoLane 需声明 repo/tracker/exact checkout/integration target/ProfileRegistry/GateCatalog；Profile 声明 risk/test/human authorization。P12 后 Web 不接受任何改变 Story 的领域命令；筛选、缩放、Tab、selection 与本地书签只是非权威 view state。 | 仓库维护者、Story owner、执行编排器 | `drafts/v1-behavior.md` 的“配置差异” |
| 历史兼容性 | 有 | GitHub/GitLab 共同领域语义必须等价；旧 #147 spec/ADR 只作证据，不再是新版权威。保留 wayfinder planning-only、workflow-interview 单任务 charter、board 执行面；不得把旧 candidate/base receipt、旧 profile digest 或 tracker 写权限当成新 Gate 证明。P10 明确 AesAgent 兼容、Extension 晋级与旧 Run 导入不属于当前 v1，不得作为阻塞或隐含验收。 | 既有 Skill 调用者、旧 story-map 设计消费者、双 tracker 仓库 | `drafts/v1-behavior.md` 的“不变清单”；独立 Runtime 新稿待补 |
| 架构与依赖 | 有 | 当前方向收缩为共享 Workflow Core + 单向 Projection Runtime + 共用 Web Shell；StoryRoot/RepoLane、ProfileRegistry、Receipt/Gate projector 与可重建 read model 只实现一次。Runtime 拥有 source ingestion、revision/digest、projection、history/export 与 Web notify，不拥有 Agent/Provider/Task、RoleAttempt lease 或 execution authority。Domain/Accountability DAG 仍描述事实语义，实际 Agent Invocation 留给未来 AesAgent。 | 技能实现者、独立 Runtime、Web/Tracker/Repo evidence 集成者、后续维护者 | 新版单向 Runtime diagram 待产出；`v3-role-runtime-diagram.html` 仅保留领域责任参考；`v4-shared-workflow-module-diagram.html` 已 superseded |

## 结论

七面全部存在可观察差异，不能 `skipped`。确认版候选包含 `mock`、`behavior`、`api-mock`、`example-run`、`diagram`；Role/Skill/Carrier 详细模型应并入这些权威根文件，不另立第二事实源。v5 已落实 WEB-P9–P11：双一级 Tab、两个完整 Graph、真实 12+7 Discovery、显式模拟 Delivery、AES Console 视觉语法与 768×1080 浏览器旅程；`v5-design-qa.md` 已为当前视觉目标给出 `passed`，但用户尚未确认 v5 Web artifact，因此不得复制为根目录 `mock.html`，也不得执行 `2-prototype done`。逻辑侧 P5/P6、P8 的单一规则和 P9 的共用 Shell 保留；P10–P12 已移除 AesAgent、双 Host、Agent Runtime 与 Web→Runtime 领域命令主线。Projection Runtime 的行为、报文、运行示例与架构图仍需另一原型分支按单向同步重做。真实 screen reader、200% zoom、high contrast、320px reflow、真实 tracker/repo runtime、Local Runtime multi-writer 与 projection crash recovery 仍为 `NOT_RUN`、`NOT_CONNECTED` 或 `NOT_PROVEN`。两边明确确认后才复制为根目录锁定版。

## P13 后当前对照物（覆盖上文旧文件状态）

| 影响面 | 最新候选与状态 |
| --- | --- |
| 用户可见界面 | v5 经 WEB-P12 业务审计为 `REWORK_REQUIRED`；WEB-P13=A 明确先确认业务对照物，再构建 v6 Web；目前无确认版 mock |
| 可观察行为 | `drafts/v6-business-behavior.md`：current/historical Discovery、RepoLane 与 Workstream、三轴、Role/Carrier、typed Receipt/Gate、integration subject、P13 required-only + optional_debt |
| 可运行输出 | `drafts/v6-business-example-run.md`：真实 #147 NOT_CONNECTED、独立 SIM 完整闭环、P13 optional blocked 但 Story done 的追加场景 |
| 对外接口报文 | `drafts/v6-business-api-mock.md`：只读 Surface、typed subject、三轴、跨图 trace、P13 §2A required results 与 optional_debt |
| 用户配置 | `v6-business-behavior.md` 配置差异：required/optional Contract 冻结、Profile/Gate digest、typed subject；Web 不新增领域命令 |
| 历史兼容性 | 同文件不变清单；旧 spec/ADR 只为历史设计依据，既有 Skill/Board 责任不变；optional 不改写原 Gate/Receipt、不自动 Waiver |
| 架构与依赖 | `drafts/v6-business-diagram.html` 与 `drafts/v6-business-diagram-detail.html`：overview + detail；P13 以旁注/ledger 表达，不改变 Agent/Runtime 权限 |

P13=A 仅关闭 optional Lane 的 `OPEN-1`；上述五份文件仍是待整体确认的业务候选。阶段仍为 pending，不能以文档存在、JSON 可解析或历史浏览器渲染结果替代用户确认。先确认业务对照物，再构建并审阅 v6 Web；整个 prototype 门禁通过后才进入 Contract。

## P14 当前状态（覆盖旧检查点）

- P14 / round:59：用户「好的请继续」确认五份业务基线，已通过 session.mjs round 落盘并提升为根文件 behavior、api-mock、example-run、diagram、diagram-detail。内容摘要与元数据转换记录见 evidence/webp14-v6/p14-confirmation.json。
- 用户可见界面：drafts/v6-story-work-graph.html 已生成，沿用双 Tab / Map-first / AES 风格，消费 P14 基线；六个隔离 SIM 快照补足真实 #147 未验证的 Delivery。仍未确认，不是根 mock.html。
- 其他六面：以上五个根文件已确认锁定；P14 不确认 Web、不授权目标实现。
- 验证：53项有限静态/样本检查通过；真实浏览器/视觉检查尚未执行。内置 Browser setup 失败，独立 Playwright 测试许可待答；design-qa.md 为 blocked。
- 当前阶段仍为 2-prototype pending。不得以静态检查或旧 v5 QA 结果进入 Contract。
