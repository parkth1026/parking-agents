# Goal Contract: aes-worktree-board 进化为 Issue 无人值守消化控制面（目标 A）

- Status: Ready
- Target: `.agents/skills/aes-worktree-board`（orchestrate/selftest/runtime registry），新增 `.agents/skills/aes-issue-worker` 与 `.agents/skills/aes-qa`
- Updated: 2026-08-26

## 原始请求

> [$parking-skills:workflow-interview] 结合你的调查，帮我完整整理一下需要修复的问题是什么？

后续补充（原话照录）：

> 分辨率是手机的分辨率，竖屏的，不是横屏的
>
> 我要的不是那么低 390x844 这种小分辨率手机基线；我的意思是大概竖屏分辨率的页面，700x1000 大概这样分辨率下显示效果准确无误
>
> 都选 A，后果判断确认
>
> （钢人裁决：无人值守级别）A
>
> 好的帮我 重新 梳理下我的 goal contract

## 目标

Master 在一个存活的 master session 内，把 contract-complete 的 `ready-for-agent` Issue 自动推进到 merge+close 或明确的人工终点；session 中断后，人工重启 Master 仅凭持久状态即可无损续跑。

## Why

- 历史编排已付过代价：主控手工 parked reviewer、机械三次 BLOCK、错误 repo 派发、fixture/identity 缺口（#44/#43/#24/#32/#34/#45 为回归种子，不重复实现）。
- reviewer finding、merge conflict、verification failure 的处置目前靠主控自然语言，无法审计、无法回归。
- 做到后：frontier 被无人值守消化，用户只在 humanGate、高危合并、契约冲突这三类结构化人工触点被打断。

## 范围

做：

- runner slot 确定性本地配置（`runner-slots.local.json`）、identity/dirty 隔离、baseline 同步；
- runner/job/attempt/owner session 分层模型与恢复（jobId 跨 attempt 稳定）；
- owner session 内 implement→review→fix→QA 闭环，review/QA 为绑定 commit 的只读 subagent；
- `DISCOVERED_WORK` 四类关系→Master 去重→Wayfinder 回流；
- riskProfile→mergePolicy 四档 merge gate、串行 merge、post-merge verify、幂等 close；
- Master 重启 reconcile（目标 A 边界的可验收化）；
- 700×1000 竖屏工作台增量进入既有需求星图界面；
- humanRequest 统一人工态载荷；
- 三层结构落地：board master → `aes-issue-worker` → 专项 atomic skill（组合器，不复制方法论）；
- 为 AC-003 构建 5 条脱敏历史 trajectory replay fixture。

不做：

- 持久 daemon / 目标 B（关机后自动续跑）；
- session 证据飞轮 exporter 与 eval corpus 的完整基建（另立 Issue）；
- 正式发布晋级（category / build-release）；
- v3 runtime 数据迁移（只读封存，不推导）；
- 修改任何确认版对照物；
- 自动修改真实 GitHub triage label（权限边界未裁决，保持只报告候选）。

## 强约束

对照物与视觉：

- 确认版对照物不可修改：`../2-prototype/behavior.md`、`api-mock.md`、`example-run.md`、`mock.html`、`design-qa.md`、`diagram.html`；执行 Agent 改的是产品。
- `700×1000` 是锁定视觉基线；`640×960`/`768×1024` 仅相邻回归；`390×844` 仅 superseded 历史；desktop 全屏星图与既有交互不得降级；worker beacon 独立于淡出层；静态 mock/fixture 不得显示 `LIVE`；任一 Issue 详情不得复用其他 Issue 的证据。

编排不变量（behavior.md 不变清单，全文有效）：

- Worker 永不 merge integration branch；只有 Master host merge。
- 不自动删除 worktree、不自动清理 dirty/untracked、不覆盖用户现场。
- merge/review/QA 始终绑定精确 commit；candidate 前进使旧证据失效。
- registry 是编排状态真源；inbox/transitions/receipts 保持 append-only 审计。
- `runtime=NOT_RUN` 不得伪装 PASS；人工验收不得由 Agent 代答；`AWAITING_HUMAN` 永不因超时变 PASS。
- GitHub repo/account/permission、repo root、integration branch、runtime identity 继续 fail closed。
- 多 runner 可并行执行/review/QA；integration merge 与 post-merge verification 串行。
- 旧 session 与失败记录不删除；新 attempt 不覆盖旧 attempt；v3 runtime 只读封存。
- 明确 `ready-for-human` 的 Issue 不进入无人值守 claim。

本轮新增不变量（钢人裁决吸收）：

- 目标 A 边界：不引入常驻 daemon；恢复能力只依赖持久状态 + 人工重启，不依赖内存态。
- 分档 merge gate：`riskProfile=high`（触及权限、identity、数据格式迁移、安全边界、公共 API 的改动不得自报低于 high）机械门全绿仍必须 humanGate 人工批准；`critical` 拒绝直接 merge、仅走 PR；任何降低验收标准的豁免必须由用户留结构化 waiver。
- 人工态载荷：`AWAITING_HUMAN` / `BLOCKED_PERMISSION` / `CONTRACT_CONFLICT` 报文必须携带 `humanRequest{kind, prompt, requiredEvidence, resumeToken}`；缺 `resumeToken` 的人工态报文 schema 拒收。
- 模型只用语义档 `economy/standard/frontier`，provider adapter 映射具体型号与 reasoning effort；协议不写死模型名。
- `node .agents/skills/aes-worktree-board/run-tests.mjs` 保持单一回归入口，调用形式与成功退出码不变；新域进入其内部。

## 自主边界

不用问，直接定：

- schema 字段命名与内部结构、脚本/模块拆分、fixture 构造方式、selftest scenario 命名、命令 timeout 数值、registry 内部布局、日志措辞、测试断言风格。

必须停下来问：

- 对已锁定 typed 报文做增补字段之外的破坏性 schema 变更；
- 任何真实 GitHub 写入范围的扩大（尤其自动 triage/改 label）；
- 新增 npm 依赖（仓库约定 `.mjs` 零依赖）；
- 删除既有能力；
- 任何改变本契约验收条件的行为。

## 读什么

- `../2-prototype/behavior.md` — 变化行 B1–B26、边界 E1–E10、配置差异与迁移
- `../2-prototype/api-mock.md` — 七类 typed 报文与已锁定约定（确认版锁定）
- `../2-prototype/example-run.md` — 10 个可运行场景与输出口径
- `../2-prototype/mock.html` 与 `../2-prototype/design-qa.md` — 700×1000 视觉真源（mock SHA-256 `1A94A5291A37D3969E71E245AFD8399425CA80E13839260A451FC7CD7D736CF4`）
- `../2-prototype/diagram.html` — 三层架构改动标注
- `docs/design/design_handoff_issue_starmap/需求星图 7a.dc.html` — desktop 视觉/拓扑真源（SHA-256 `2703B1A632292A1AD4927D2BFD6E57384E234248B5E6EF59C9AA11128435B98A`，不得修改）

## 要落盘的东西

- D-01: 5 条脱敏历史 trajectory replay fixture（覆盖过早 complete、机械 review、idle lane、wrong-parent event、timeout/env 污染、merge conflict、orphan reviewer），路径归执行 Agent 定，须被 AC-003 的 [A] 命令消费。
- D-02: AC-003 live 门与 AC-006 desktop 非回归的 receipt 文件，绑定 commit/mock SHA/环境（Chromium 版本、DPR、字体）。

## 验收条件

- AC-001: runner slot 生命周期确定性——`runner init` 生成 Git 忽略的 slot allowlist 且重复运行幂等 NOOP；repo identity 漂移 → `QUARANTINED_CONFIG_DRIFT` 不领取；dirty/untracked → `QUARANTINED_DIRTY` 且绝不 reset/clean、其余 slot 继续调度；terminal 释放后 worker branch 同步到 integration HEAD 才允许 claim；slot 配置为空时 Master Goal 拒绝启动。
  - Verify: [A] `node .agents/skills/aes-worktree-board/scripts/selftest.mjs orchestration --scenario runner-lifecycle` → 退出码 0

- AC-002: 中断恢复与人工态载荷（任何一层中断后凭持久状态无损续跑）——job/attempt 层：jobId 跨 attempt 稳定、attemptId 唯一；owner thread 中断优先恢复原 thread，确认不可恢复才凭 handoff bundle 新建 attempt；旧 attempt 与证据保留；candidate commit 前进使旧 review/QA 失效。Master 层（目标 A 边界）：在 dispatch 后、merge 前、merge 成功但 close 前、awaiting-human 中四个中断点终止 Master 后重启，仅凭 registry/inbox/receipts 恢复——无重复 merge、无丢失 job、无假完成，每个 slot 与 job 状态可解释。人工态载荷：三个人工态终点携带完整 `humanRequest` 载荷，缺 `resumeToken` 的报文被 schema 拒收且不推进状态。
  - Verify: [A] `node .agents/skills/aes-worktree-board/scripts/selftest.mjs orchestration --scenario recovery` → 退出码 0

- AC-003: for-agent 无人值守闭环（离线半）——5 条历史 trajectory replay 全通过（D-01 语料）：过早 complete、机械 review、idle lane、wrong-parent event、timeout/env 污染、merge conflict、orphan reviewer 类历史问题不再复现。live 半见 AC-007，两半合起来才算混合门通过。
  - Verify: [A] `node .agents/skills/aes-worktree-board/scripts/selftest.mjs orchestration --scenario trajectory-replay` → 退出码 0

- AC-004: DISCOVERED_WORK 回流——`IN_CURRENT_SCOPE` / `NON_BLOCKING` / `BLOCKING_DEPENDENCY` / `CONTRACT_CONFLICT` 四类关系全覆盖；discovery digest 去重幂等；create/comment/edge 均产出 receipt；全程 fake-gh，不写真实 GitHub；worker 不得直接创建 Issue。
  - Verify: [A] `node .agents/skills/aes-worktree-board/scripts/selftest.mjs orchestration --scenario discovered-work` → 退出码 0

- AC-005: delivery 与分档 merge gate——`READY_TO_MERGE` 后 Master fresh 校验 slot/commit/integration/AC/review/QA；merge 串行且 post-merge verification 失败时不 close、不释放 slot、保留失败证据进 typed disposition；close 幂等（相同 comment digest 视为 already-succeeded）；legacy 封存 hash 不变；mergePolicy 分档生效：low/medium 机械门后自动 merge，high 机械门全绿仍停在 humanGate，critical 拒绝直接 merge；Master 对 riskProfile 自报按改动路径兜底校验。
  - Verify: [A] `node .agents/skills/aes-worktree-board/scripts/selftest.mjs orchestration --scenario delivery-merge` → 退出码 0

- AC-006: 700×1000 竖屏工作台——以 `../2-prototype/mock.html`（SHA `1A94…36CF4`）为真源，固定 Chromium/DPR/字体做截图 diff；机械断言：容器原生动态 viewBox、真实一跳展开/复位、Map/List/search/filter 单一状态源、runner drawer 与 detail sheet 互斥、10 条 Issue 同源绑定（缺失字段显示 `未产生 / NOT_RUN`）、delivery/awaiting-human/legacy 状态可达、beacon 常显、`DEMO SNAPSHOT` truthful、键盘/焦点/ARIA、zoom/pan/pinch 锚点；`640×960` 与 `768×1024` 仅布局 smoke。
  - Verify: [A] `node .agents/skills/aes-worktree-board/scripts/selftest.mjs board-ui --baseline 700x1000` → 退出码 0（截图 diff 基建随本契约新建）

- AC-007: 真实宿主人工门（离线门代替不了的证据）——离线门全绿后：(a) 3 个 fresh contract-complete `ready-for-agent` Issue 在本机真实 runner slot 上无人值守运行到 merge+close 或合法人工态终点，全程零意外用户消息（人工触点仅限契约人工态终点），顺带完成对本机 5 个既有 worktree 的真实只读校验（无写副作用）；(b) 产品 desktop 全屏星图、右侧 Workers 面板与既有交互不降级（对照 `docs/design/design_handoff_issue_starmap/需求星图 7a.dc.html` 真源）。
  - Verify: [C] 按 (a)(b) 步骤各执行一次，产出绑定 commit/mock SHA 的运行与截图 receipt（D-02）；(a) 的意外用户消息数 = 0

## 挡着的事

- AC-007 的 live 门需要 3 个 fresh contract-complete `ready-for-agent` Issue。解除条件：实现与离线门全绿后，由用户在 `parkth1026/parking-agents` 指定既有 Issue 或授权 Wayfinder 创建。

## 残留风险

- reviewer/QA subagent 与 owner 同 session 的独立性未被历史证据定住 — 错了会怎样：复审共享实现者的错误假设放行缺陷；本轮仅作为回归监测项，发现实例后需升级为独立 session 架构项。
- 目标 B（持久 daemon）明确出范围 — 错了会怎样：若实际使用中 Master session 中断频率远高于预期，人工重启成本会侵蚀无人值守收益，需另立契约补 Liveness。
- desktop runtime 非回归在原型阶段为 NOT_RUN — 错了会怎样：产品 desktop 星图可能被工作台改动破坏而到实现阶段才发现；由 AC-007(b) 兜底。

## 访谈记录

### 第 1~2 轮（验收深度六问，2026-08-25）

| 问题 | 候选（当时百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| ACQ-001 runner lifecycle 验多深 | A 真实临时 worktree selftest 70% / B 黄金 JSON diff 20% / C 人工查看 10% | A | A |
| ACQ-002 job/attempt 恢复验多深 | A host-shaped recovery selftest 65% / B 真实 Desktop 中断演练 20% / C 仅 schema/文档 15% | A | A |
| ACQ-003 无人值守门槛 | A 5 replay + 3 fresh live 55% / B 仅 replay 30% / C 20 live ≥90% 15% | A | A |
| ACQ-004 discovery 回流验多深 | A fake-gh 全覆盖 75% / B 真实 GitHub 建测试 Issue 10% / C 仅审报文 15% | A | A |
| ACQ-005 delivery 验多深 | A 临时真实 Git + fake-gh 全链 — / B / C | A | A |
| ACQ-006 视觉基线 | A 1440×900 + 390×844 截图 diff | A | A（后被翻掉，见下） |

### 第 3~5 轮（AC-006 基线被用户两次纠偏）

- 用户翻掉 1440×900 横屏并列基线：「分辨率是手机的分辨率，竖屏的，不是横屏的」。
- 用户再翻掉 390×844：「我要的不是那么低 390x844 这种小分辨率手机基线……700x1000 大概这样分辨率下显示效果准确无误」。
- ACQ-006 两次修订，最终口径：700×1000 唯一像素基线，640×960/768×1024 仅 smoke，390×844 降为 superseded 历史，desktop 只做非回归。这两次翻转标出本访谈中判断偏差最大的方向（视觉目标口径），后续改此契约者应优先重新验证视觉基线假设。

### 钢人裁决（2026-08-26，对照外部评审 `docs/research/aes-worktree-board-steelman-review.md`）

- crux：「本轮无人值守范围是否包含 Master session 死亡之后的自动续跑」。用户答 A（不包含）→ Skill+registry 架构成立，daemon（评审目标 B）出范围。
- 评审 P0 七项中六项已被本方案内化；吸收剩余三项为契约修订：目标 A 边界 AC（→AC-007）、riskProfile→mergePolicy（→AC-005）、humanRequest 统一载荷（→AC-002）。
- 评审的「独立 Reviewer 不是真理机器」（4.3）记入残留风险监测项，未采纳为架构变更。

### 第 6~7 轮（本轮，2026-08-26）

| 问题 | 候选（百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| C1 锁定 v4 700×1000 mock | 确认锁定 / 再改 mock | 确认 | A 确认锁定 |
| ACQ-007 Master 重启恢复验多深 | A 离线 restart-reconcile selftest 65% / B A+真实 kill 演练 25% / C 仅协议文档 10% | A | A |
| ACQ-008 merge gate 分档 | A 四档 mergePolicy 55% / B 仅 critical 人工 30% / C 保持全自动 15% | A | A |
| C2 humanRequest 统一载荷 | 采纳 / 保持各自字段 | 采纳 | A 采纳 |

默认区（用户未反对，一并算定）：

| 定了什么 | 档 | 为什么 | 用户 |
| --- | --- | --- | --- |
| AC-001~005 沿用已确认口径不重问 | 默认 | 材料未变，重问浪费预算 | 未反对 |
| 对照物不可修改；schema 增量内嵌契约、不改写已锁定 api-mock.md | 默认 | 保持三路复审绑定的 SHA 有效 | 未反对 |
| behavior.md 不变清单整体进强约束 | 默认 | 不变量不占 AC 编号 | 未反对 |
| 自主边界取 interview 四分类 Agent-owned | 默认 | 已裁决过，仅聚合 | 未反对 |
| 残留风险记 desktop debt / 目标 B 出范围 / reviewer 独立性监测 | 默认 | 钢人裁决缩小赌注 | 未反对 |

条数说明：最终 7 条 AC，贴着校验器上限。聚类调整：owner 中断恢复与 Master 重启 reconcile 同属「任何一层中断后凭持久状态无损续跑」一条规则，合入 AC-002（selftest scenario 名 `recovery` 覆盖两层）；live 运行与 desktop 非回归同属「离线门代替不了的真实宿主证据」，合为 AC-007 [C]。这两次合并是聚类修正，不减少任何已确认的验收内容。

## 设计取舍

### D-1 merge gate 形态

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A（选定）四档 mergePolicy | low/medium 机械门自动；high 机械门后 humanGate；critical 仅 PR；Master 按改动路径兜底校验自报 riskProfile | 高危 Issue 打断用户一次 | 无 |
| B 仅 critical 人工 | high 自动 + 扩展 post-merge verify + 可回滚 receipt | 权限类错误 merge 后才发现，回滚成本高 | 与 identity/permission 类 Issue 占比不低的现实不匹配 |
| C 保持全自动（原 Q9） | humanGates 完全由 Issue 作者自报 | 自报环节正是不可信处 | 外部评审 5.4 论证成立 |

落进契约的形态：强约束写「high 机械门全绿仍必须 humanGate；critical 仅走 PR」，AC-005 验证。

### D-2 humanRequest 载荷承载位置

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A（选定）契约内嵌 schema 增量 | `humanRequest{kind, prompt, requiredEvidence, resumeToken}` 定义写在本契约，产品实现落 schema | 契约与最终 schema 有一次同步成本 | 无 |
| B 改写 api-mock.md 增补节 | 在已锁定文件追加 v2 小节 | 打破「确认版锁定」与三路复审绑定的 SHA 语义 | 对照物不可修改是强约束 |

`kind` 闭集沿用外部评审建议：`decision / manual_validation / permission / external_access / risk_approval`。

### D-3 无人值守边界（钢人裁决）

选定目标 A（session 存活期闭环 + 重启 reconcile），未选目标 B（daemon）。理由：本轮价值在控制协议与证据链的正确性，Liveness 是正交能力；先用 AC-007 把「重启无损」钉死，daemon 未来另立契约时无需迁移 schema。
