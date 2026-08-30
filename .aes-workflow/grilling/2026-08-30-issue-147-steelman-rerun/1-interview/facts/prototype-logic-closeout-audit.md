# 2-prototype completion 审计：逻辑线程与 Web 线程

- 审计日期：2026-08-30
- 审计范围：`aes-prototype` 七面门禁、现有全部草稿、`manifest.json`、`context.md` 的 P3～P9 / WEB-P8 检查点、Web 证据目录
- 审计性质：只读 completion audit；本文件不替用户确认，也不改变 stage、round、context、prototype 或产品代码

## Verdict

**PARTIAL；当前执行 `2-prototype done` 必须判 FAIL。**

七个影响面都已识别，并且 Web v3 已有较强浏览器证据；但 `2-prototype/` 根目录目前只有 `impact-surface.md`，没有任何锁定版对照物。Web 线程仍有 `WEB-P9` 未答，逻辑线程也尚未把 P5～P9 合入一套确认版 artifacts，更没有获得整套 logic prototype 的明确确认。因此既不满足用户确认门禁，也不满足 `session.mjs stage ... done --artifacts ...` 的文件存在门禁。

`manifest.json` 的可观察状态与该结论一致：stage=`2-prototype`，`stage_gates.2-prototype.status=pending`，整个 dossier=`in_progress`。

## 七面门禁与最终根文件

| 影响面 | 当前证据 | 当前结论 | 最终必须落在 `2-prototype/` 根目录的确认版 |
| --- | --- | --- | --- |
| 用户可见界面 | `drafts/v3-product-prototype.html`、产品依据、WEB-P8 audit、16 张图像证据 | 有候选、有浏览器证据，但 Web artifact=`NOT_CONFIRMED` | `mock.html` |
| 可观察行为 | `drafts/v1-behavior.md`；P5/P6 Role/Router 裁决；P7～P9 双宿主/共享 Module/Web Shell 裁决 | 基础行为表存在，但晚于 v1 的 P5～P9 尚未回写成同一行为事实源 | `behavior.md` |
| 可运行输出 | `drafts/v1-example-run.md`、`v2-orchestration-example.md` | 有冷启动、失败、Gate、`--explain-route` 示例；缺双宿主、共享 Module、Surface submit/continuation 与晋级等价输出 | `example-run.md` |
| 对外接口报文 | `drafts/v1-api-mock.md`、`v2-web-projection-api.md` | typed Story/command/Receipt 有候选；尚无确认版 `Workflow Module`/`SurfaceDocument`/DevHost/AesAgentHost 通信与 continuation 合同；旧 live fixture 又与 WEB-P8 truth boundary 冲突 | `api-mock.md` |
| 用户配置 | `v1-behavior.md` 的配置差异 | RepoLane/Profile/Human/Web command 有候选；缺共享 Module digest、host capability、Surface schema/version、promotion/conformance 配置口径 | `behavior.md` 的“配置差异” |
| 历史兼容性 | `v1-behavior.md` 的不变清单 | 旧 Skill charter、tracker/repo 分治等已列；缺“SkillDevHost → AesAgent Extension 不重写业务规则”的兼容性与证据要求 | `behavior.md` 的“不变清单” |
| 架构与依赖 | `v3-role-runtime-diagram.html`、`v3-role-skill-carrier-model.md`，另有 P7～P9 facts | Role/Carrier 分离已经成形；缺把共享 Workflow Module、SkillDevHost、AesAgentHost、共用 Web Shell、SurfaceDocument 放进同一最新拓扑 | `diagram.html`；若按每图 ≤9 节点/≤12 边预算无法容纳，应再出 `diagram-detail.html` |

因为七面全部为“有”，最终至少必须存在并经用户确认：

1. `2-prototype/mock.html`
2. `2-prototype/behavior.md`
3. `2-prototype/api-mock.md`
4. `2-prototype/example-run.md`
5. `2-prototype/diagram.html`

Role/Skill/Carrier 矩阵不必另立新的权威根文件；其稳定行为应并入 `behavior.md`，拓扑并入 `diagram.html` / `diagram-detail.html`。`v3-product-design-rationale.md`、facts 与 QA 报告可继续作来源和证据，不应替代上述固定根文件。

## 草稿有效性与淘汰关系

### 已明确 superseded，不可晋级为确认版

- `v1-mock.html`：文件自身标记 superseded by `v2-mock.html`。
- `v2-mock.html`：页面标题和正文标记已被 `v3-product-prototype.html` 取代。
- `v1-diagram.html`：文件自身标记 superseded by `v2-diagram.html`。
- `v2-diagram.html`：Skill invocation semantics 已被 v3 Role/Carrier 模型取代；只能保留能力 inventory/历史参考。
- `v2-skill-chain.md`：明确声明编排语义由 `v3-role-skill-carrier-model.md` 取代，只保留 capability inventory。

### 仍有来源价值，但不能原样晋级

- `v1-behavior.md`：是当前最完整的业务例子池，但早于 P5～P9；必须补 Role-first、unknown 三分流、共享 Workflow Module、双 Host Adapter、共用 Web Shell、declarative `SurfaceDocument`、promotion conformance。
- `v1-api-mock.md`：typed command/Receipt/Gate 仍可复用；必须增加通用 Surface 协议及双宿主合同，并清除把 synthetic story-147 runtime 当现场的歧义。
- `v1-example-run.md`：基础 CLI 场景可复用；必须与 `v2-orchestration-example.md` 合并，并补 DevHost/AesAgentHost 等价运行与失败输出。
- `v2-orchestration-example.md`：补了完整 Skill 路由，但仍按旧 Core/Skill 链描述，缺 P7～P9 的共享 Module 与 Web Shell。
- `v2-web-projection-api.md`：Now/Why/Next read model 有价值，但其中 D17/I42/story-147 live runtime 是 fixture 口径；与 WEB-P8 “真实默认 + 隔离模拟”规则冲突，不能直接成为 `api-mock.md`。
- `v3-role-skill-carrier-model.md`、`v3-role-runtime-diagram.html`：P5/P6 局部语义已确认，但文件明确仍是草稿；它们早于 P7～P9，缺共享 Workflow Module 与两 Host Adapter，不是最终架构事实源。
- `v3-product-prototype.html`、`v3-product-design-rationale.md`：是当前最新 Web 候选，WEB-P8 rework 已完成；但仍等待 WEB-P9 和 Web artifact confirmation。
- `design-qa.md`、`webp8-product-audit.md`：是验证证据，不是用户确认版对照物。

## 用户确认状态：必须分线程处理

### Web 线程

已确认的产品原则：P3、P4、WEB-P5、WEB-P6、WEB-P7。WEB-P8 是明确的 rework 请求，并记录 `web_artifact_confirmed=false`；rework 已做完，但它没有自动转化为确认。

当前唯一准备提出且尚未回答的是 `WEB-P9`：是否接受“真实 Issue/dossier 默认 + 独立 SIMULATED GAP”作为确认版样本，还是确认前必须找到真实 active Story runtime。该问题未写入 `rounds.jsonl`，所以：

- Web 线程不能把 `v3-product-prototype.html` 复制为根 `mock.html`；
- 逻辑线程不能替 Web 线程回答 WEB-P9；
- WEB-P9 若接受当前混合样本，仍需明确整件 Web artifact 已确认；若要求 active runtime，则需继续 Web rework 和浏览器复验。

多 actor Waiver/quorum 完整路径当前也未制作。它可以由 WEB-P9 后的用户决定是确认前必需，还是作为 Contract 的 live/manual debt；在用户裁决前不能静默视为覆盖。

### 逻辑线程

P5、P6 已确认 Role-first、Carrier 按风险晚绑定及 unknown 三分流；P7 已确认 AesAgent 为最终宿主且必须保留 Skill+Web 孵化形态；P8 已确认共享 `Workflow Module` 是唯一业务规则实现；P9 已记录接受“共用 Web Shell + Workflow 页面说明书”。这些都是架构原则确认，不等于 artifacts 确认。

逻辑线程仍缺：

1. 把 P5～P9 合入更新后的 `behavior/api-mock/example-run/diagram`；
2. 给用户逐处展示这套最新 logic prototype；
3. 获得“整套 logic artifacts 确认”的明确回答；
4. 裁清 `v1-behavior.md` 中仍以“待确认点”出现但未被既有裁决完全覆盖的 E2：可选 RepoLane 是否可以在必需 RepoLane 全部通过时不阻止 Story done。另两个待确认点已分别被 Q17（主徽章只作确定性投影并保留三轴）与 Q35（degraded 下允许 Core 可独立判断的止损动作）覆盖，不应重问。

P9 的 `user_verbatim` 只有“共用 Web Shell + Workflow 页面说明书”，但 round 已持久化为 `user_choice=true`，context 也按接受恢复；审计不得擅自撤销这一裁决。它仍不构成整套 prototype confirmation。

## 已有自动与浏览器证据

`2-prototype/evidence/webp8/` 实际存在：

- 14 张逐屏实现截图；
- 2 张相同视口 before/after 对照；
- `audit-results.json` 机器可读结果；
- `design-qa.md` 与 `webp8-product-audit.md` 对旅程和残余缺口的解释。

机器证据支持以下局部结论：

- 默认真实模式展示 #147 captured facts、12 个真实 child links、0 native blocker edges，且 runtime 为 `NOT_CONNECTED`；
- 模拟模式持续标记 `SIMULATED GAP` 且使用 `SIM-*` identity；
- pointer/keyboard/text-input 旅程覆盖真实总览、成员树、来源 Modal、dataset tabs、Decision、Map reset、blocked Human Test、Review 编辑、保存与返回恢复；
- 601/720/768/820/900/1440/1920 页面 `clientWidth=scrollWidth`；480 无页面横溢出，只有阶段条局部横滑；
- 768 的六阶段为 721/721px，Review 为 208px + 560px；
- 有效 target 低于 24px 为 0，无名 button 为 0，reduced motion 为 0s，console/runtime errors 为空。

这些证据只能证明当前 v3 Web candidate 的局部行为，不能证明：

- 用户已经确认 Web artifact；
- 根 `mock.html` 已存在；
- logic artifacts 正确；
- SkillDevHost 与 AesAgentHost 的真实等价闭环；
- `2-prototype done` 门禁通过。

## 必须进入 Goal Contract 的 NOT_RUN / NOT_CONNECTED / 人工债务

若用户最终允许 prototype 带这些声明收口，下一阶段必须如实保留，不能改写成 PASS：

| 项目 | 当前状态 | Contract 中应要求的证明 |
| --- | --- | --- |
| 真实 screen reader traversal | `NOT_RUN` | 指定读屏器完成主要导航、Modal、Review、动态状态旅程并留人工证据 |
| 200% browser zoom | `NOT_RUN` | 主要视口实测，无裁切、遮挡或动作丢失 |
| Windows high contrast | `NOT_RUN` | 状态、focus、边界和 disabled 在高对比下仍可辨认 |
| 320px reflow | `NOT_RUN` | 320 CSS px 实测；当前只有 480px |
| 真正 GitHub/GitLab/repo runtime 聚合与 live refresh | `NOT_CONNECTED` | live/captured runtime 证明 freshness、stale、冲突、不可用和同 revision projection |
| 真 evidence 上传、跨 session 持久草稿、tracker/repo mutation | prototype scope `N/A` | 实现阶段按授权环境跑真实提交、持久化、恢复、幂等与失败语义 |
| 多 actor Waiver/quorum | 未制作 | 若属 v1 范围，跑完整角色授权、quorum、revocation、非 PASS 语义；否则列明 defer |
| SkillDevHost 多 writer / 崩溃事务窗口 | `NOT_PROVEN` | durable submit、ledger/state 原子性、重复提交、崩溃恢复和 fencing 测试 |
| 双宿主同规则 | `NOT_RUN` | 两边装载同一 Workflow Module digest，对同一 canonical trace 的 event/state/Surface/receipt 规范化全等 |
| 孵化晋级不重写 | `NOT_RUN` | promotion diff 不含 reducer/schema/validator/projection 业务重写 |
| 两宿主 Web↔Agent 闭环 | `NOT_RUN` | SkillDevHost 与 AesAgentHost 各自真实完成 `publish → submit → persisted → continuation → consumed` |
| diagram 几何/离线/可访问性最终校验 | `NOT_RUN`（最终图尚不存在） | 根 `diagram.html`/detail 逐项检查零 JS、零外链、SVG title/desc、预算、连线、fidelity ledger |

## 最短可通过路径

1. **逻辑线程**先基于 P5～P9 产出新一版 logic drafts，合并而不是继续堆独立互相冲突的权威文件。
2. **Web 线程**独立恢复并只问 WEB-P9；按答案确认当前 v3 或继续补 active runtime，再取得明确 Web artifact confirmation。
3. **逻辑线程**展示更新后的 `behavior/api-mock/example-run/diagram`，只问整套 logic artifact confirmation；E2 若仍影响 Story done，再单独问一个最高杠杆问题。
4. 两边都确认后，才把候选复制/整理为根 `mock.html`、`behavior.md`、`api-mock.md`、`example-run.md`、`diagram.html`（必要时 `diagram-detail.html`），每份标明确认时间且不可修改。
5. 对根 artifacts 做结构、离线 HTML、链接、报文一致性和七面交叉检查；所有未执行项保留原状态。
6. 最后才运行 `session.mjs stage ... 2-prototype done --artifacts ...`。在根文件或任一线程确认缺失时停止，不能进入 `3-contract`。

## Stop condition

只有同时满足下列条件，2-prototype 才可判 PASS：

- Web artifact 已由 Web 线程明确确认；
- logic artifacts 已由用户明确确认；
- 七面所需根文件全部存在并声明锁定；
- 根文件已吸收 P3～P9、WEB-P8/WEB-P9 的最终裁决，不再引用已淘汰的假现场或混合链作为权威；
- `NOT_RUN` / `NOT_CONNECTED` / defer 项未被伪装成 PASS；
- `session.mjs stage ... 2-prototype done` 实际返回成功。

