# Goal Contract: 把 aes-worktree-board 升级为 Issue #5 协议的产品化控制平面

- Status: Ready
- Target: parking-agents 仓库 `.agents/skills/aes-worktree-board/`（附带 GitHub tracker parkth1026/parking-agents 的 wayfinder 建图）
- Updated: 2026-08-24

## 原始请求

> aes-worktree-board 这个技能之前执行的一个复盘报告在 /G:/GIT/AI_WorkFlow/parking-agents/docs/retrospectives/aes-worktree-board-multi-agent-orchestration-retrospective-2026-08-24.md 请你仔细阅读后 我们开始确定升级改造目标。

后续追加裁决原话：「先 P0 + 控制面bug，然后所有问题都要用 wayfinder方式 把 issue创建好。」「ok 那个list 应该修正成 map 跟list 而不是 图谱视图跟 地图视图。」

## 目标

把上轮编排已验证正确的行为固化为可恢复、幂等、可审计的控制平面（Task Registry、事件 inbox、三维 verdict、状态机终态、create_thread preflight、全局停止评估器），修复四个控制面缺陷，消除 SKILL.md / Issue #5 / 运行时三处契约漂移，并把全部已知问题建成 wayfinder 依赖图。

## Why

- 复盘结论：业务闭环跑通、控制闭环不稳——listener 丢失、事件漏消费、快照覆盖历史均已实证发生，且靠 prompt 防不住。
- 三处契约漂移（SKILL.md 仍写 headless+只建议 merge，而 #5 已固化新协议）会让下一轮 agent 走回已纠正过的错误路径（复盘 §12 点名的失败模式）。

## 范围

**做**：P0 六项（registry / inbox 幂等 / 三维 verdict / 15 态状态机 / preflight / 全局停止评估器，新 CLI `orchestrate.mjs`）；修 #22（server 跨源防护）、#23（worktree 锁 TOCTOU）、#24（board.config 选址校验）、#25（runtime 原子读写）；status.json schema v3（board 兼容读 v2）；看板六处增量挂点 + Map/List 改名；selftest 新增 orchestration 回归域；SKILL.md 重写对齐 + #5 正文重排补验收条目；wayfinder 建图（#5 转父节点，N1~N9 实现项挂依赖边，#23/#25 收编关闭，B1~B6 backlog 建而不做）。

**不做**：P1 的实现（progress/stall、merge handler、恢复 automation、reviewer 临时资源、路由评分——只建 backlog issue）；目标仓 aes-agents-v2 现场恢复（dev1/2 handoff、dev3/5 parked 继续挂起）；真实编排冒烟（另起一轮）；`npm test` 三条红灯修复（已分离为独立任务）；星图视觉重设计；发布侧 `skills/` 移植。

## 强约束

- **星图设计语言零变化**：`docs/design/design_handoff_issue_starmap/` 的全部规格（状态颜色、星等半径公式、光晕、名牌旗、图例、交互）原样保持；控制面信息只走确认版 mock 的六个挂点；双视图切换文案改「Map / List」，切换行为与视图内容不变。
- 正常派发路径 = Desktop `create_thread`（宿主工具归 agent）；headless 真实派发必须带 `--fallback-authorized "<用户原话>"`，缺省拒绝（退出 2）；`test` 假 agent 豁免供自检；脚本不模拟宿主工具。
- `runtime=NOT_RUN` 在任何路径下不得改写为 `PASS`；`already-consumed` 是成功形态（退出 0），不是错误。
- `registry.json` 是判断真源，`status.json` 是渲染快照，冲突以 registry 为准；`transitions.jsonl` / `inbox.jsonl` append-only；全部写入走 tmp+rename 原子替换加互斥。
- collect 只写 schemaVersion 3；board 兼容读 v2（降级渲染，不报错）；collect 不得改写终态（merged/parked/handoff-required/orchestration-stop）与既有 assessment（承接，不清空）。
- 15 态状态机集合、verdict 三维闭集、401/403 code 闭集、数据契约字段以 `../2-prototype/api-mock.md` 为准；blockCount 只对新 follow-up commit 的最终 BLOCK 计数，同 commit 同 verdict 去重。
- 既有 selftest 七域保持绿；collect/assess/server/dispatch 现有命令行用法不变（dispatch 仅新增授权参数，是唯一破坏点）；runtime 选址链（env > 目标仓根 `.aes-worktree-board/runtime/`）不变。
- 零 npm 依赖、脚本全 `.mjs`、`windowsHide` 纪律；board 端口 8321 与既有四路由不变（只加安全门，不加新对外面）。
- 技能目录旧 runtime（03:21 快照 + orchestration-stop.json）原地归档只读，不删除，SKILL.md 写明其历史地位；目标仓 aes-agents-v2 现场不碰；test worktree 不参与调度。
- 模型两档 luna-max / sol-high；TaskRecord 必记 modelTier + routingReason。
- 确认版对照物（`../2-prototype/` 下五份）不可修改——执行 Agent 改的是产品，不是对照物。

## 自主边界

不用问，直接定：
- `orchestrate.mjs` 内部结构（子命令解析、模块拆分、导出函数供 selftest）、锁文件实现方式、eventId 生成实现、时间戳统一格式；
- registry/transitions/inbox 行内的补充字段（不与 api-mock 契约冲突即可）、fixture 场景的构造方式与 `--scenario` 过滤实现；
- 看板挂点内的 CSS 细节与文案微调（不越出六挂点、不动星图规格）；SKILL.md 行文组织；新建 issue 的正文措辞（按 behavior.md 建图表的节点/依赖/label）。

必须停下来问：
- 增删 AC 或改验收口径；新增任何 npm 依赖；改 15 态状态机集合或 verdict/错误码闭集；改 runtime 选址链或数据文件布局语义；动星图既有规格；删除或移动旧 runtime 归档；关闭 #5/#22/#23/#24/#25 之外的既有 issue；新增 HTTP 路由或改端口。

## 读什么

- `../2-prototype/behavior.md` — 17 条变化行、wayfinder 建图表（N1~N9/B1~B6 与依赖边）、不变清单、配置差异：判定素材源。
- `../2-prototype/api-mock.md` — 报文对、registry/TaskRecord/transitions/inbox 数据契约、15 态状态机、已锁定约定。
- `../2-prototype/example-run.md` — 8 个 CLI 场景的命令形态与退出码。
- `../2-prototype/mock.html` — 看板六挂点与 Map/List 文案（AC-007 的对照物）。
- `../2-prototype/diagram.html` — 架构视图（orchestrate.mjs 与 runtime v3 的依赖方向）与事件消费流程视图。
- `docs/retrospectives/aes-worktree-board-multi-agent-orchestration-retrospective-2026-08-24.md` — 背景与 P0 定义。
- https://github.com/parkth1026/parking-agents/issues/5 — 治理载体（重排对象）；`docs/agents/issue-tracker.md` — wayfinder 口径（原生 issue dependencies、frontier、claim）。
- `docs/design/design_handoff_issue_starmap/README.md` — 星图高保真规格（不变式来源）。

## 要落盘的东西

- D-01: `.agents/skills/aes-worktree-board/scripts/check-issue-graph.mjs` — AC-008 的 gh 断言脚本：断言 N1~N9/B1~B6 存在且 blocked-by 边闭合、#5 为父节点、#23/#25 已关闭并与收编 issue 互链、#22/#24 已挂边；全部成立退出 0，任一不成立退出 1 并点名。

## 验收条件

聚类说明：初聚 9 簇，按「同一条规则的不同侧面」二次合并为 7（inbox 幂等并入生命周期簇、全局停止并入终态治理簇）；「既有七域全绿」是通用质量门，进强约束不占 AC。全部 [A] 命令挂在新建的 selftest `orchestration` 域下（今天全红是预期——该域本身是交付物；不挂既有域，防止「今天就绿」的空验收）。

- AC-001: runtime v3 存储并发安全且向后兼容——并发读写下无 torn read，v2 快照可被 collect 承接与 board 读取，collect 重跑不清空 assessment、不改写终态（#25 修复）
  - Verify: [A] `node .agents/skills/aes-worktree-board/scripts/selftest.mjs orchestration --scenario storage` → 退出 0
- AC-002: Task 生命周期只经 registry/inbox 且幂等——task create 原子登记 TaskRecord+租约+generation；desktop 路径要求真实 threadId；未授权 headless 拒绝（退出 2）；同 worktree 二次抢锁失败（退出 2 LOCKED，无 TOCTOU 双派发，#23 修复）；非法状态转移拒收（退出 2）；wait 返回的全部 polls 入箱，首次 consume 产生转移，duplicate eventId 得 already-consumed（退出 0，零状态变化），inbox pending 列出未消费事件与各 thread cursor 供新回合续接
  - Verify: [A] `node .agents/skills/aes-worktree-board/scripts/selftest.mjs orchestration --scenario lifecycle` → 退出 0
- AC-003: 终态治理——verdict 三维分开落账且 NOT_RUN 不阻塞 autonomous 类 MERGE_READY、要求真机的 Issue 拒绝；同 commit 同 verdict 不计数；第三次 BLOCK 自动转 handoff-required、生成交接包、封锁该线路后续派发；全部非 test 线路处于终态/暂停态时 stop eval --write 写入 stopped 并列各线路状态，仍有可推进线路时退出 1 并点名，stopped 写入后 collect 重跑保持不变
  - Verify: [A] `node .agents/skills/aes-worktree-board/scripts/selftest.mjs orchestration --scenario governance` → 退出 0
- AC-004: 边界防护——POST /api/dispatch 缺 token 得 401 MISSING_TOKEN、跨源得 403 FORBIDDEN_ORIGIN（#22 修复）；board.config 解析顺序 env > 目标仓根 > 技能目录，issueRepo/mainBranch 错配被 preflight 点名拒绝退出 2（#24 修复）
  - Verify: [A] `node .agents/skills/aes-worktree-board/scripts/selftest.mjs orchestration --scenario boundary` → 退出 0（场景内起真实 server 探测 401/403 与错配拒绝）
- AC-005: 看板 v3 增量渲染——六挂点（编排状态胶囊、Workers 面板徽章、详情面板任务区+转移历史、派发授权提示、v2 降级条、Map/List 改名）与确认版 mock 一致，星图既有规格零变化
  - Verify: [C] 打开 LIVE 看板按 `../2-prototype/mock.html` 六挂点逐处人工对照（含 v2 旧快照打开时的降级条）；星图节点/名牌旗/图例与升级前无差异
- AC-006: wayfinder 依赖图建成且 #5 完成重排——N1~N9 实现项与 B1~B6 backlog 存在且 blocked-by 边闭合，#5 为父节点，#23/#25 关闭收编并互链，#22/#24 挂边保留实现；#5 正文重排后追加段位于验收条件之前，且 cursor/熔断/全局停止/heartbeat 各有对应验收条目
  - Verify: [A] `node .agents/skills/aes-worktree-board/scripts/check-issue-graph.mjs` → 退出 0（gh 读图与 #5 正文断言；联网条目，是离线验收主力的唯一例外）
- AC-007: SKILL.md 契约同步——重写为 create_thread 正常路径/registry/三维 verdict/熔断/停止协议，不再含 headless 正常路径与「只给合并建议不执行 merge」；新契约标记与旧契约反标记由 orchestration 域机械断言
  - Verify: [A] `node .agents/skills/aes-worktree-board/scripts/selftest.mjs orchestration --scenario contract` → 退出 0

## 挡着的事

- None.（gh 已认证；AC-008 需网络，属运行条件而非阻塞）

## 残留风险

- 本次不做真实编排冒烟（用户裁决 q4=A，离线回归为主）——错了会怎样：listener/事件链的 fixture 假设若与真实 wait_threads 行为不符，下一轮真实编排首轮会暴露，需要一次现场修正。

## 访谈记录

### 第 1 轮（范围与路径）

| 问题 | 候选（当时百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| 范围切法 | A 只 P0 30% / B P0+控制面 bug 45% / C 全量 P0+P1 25% | B | B，追加「所有问题都要用 wayfinder 方式把 issue 创建好」 |
| headless 去留 | A 显式 fallback 并修 #22/#23 50% / B 降为自检专用 35% / C 不动 15% | A | A |
| listener 深度 | A 纯协议 40% / B 脚本化 inbox+幂等 45% / C 加常驻 watcher 15% | B | B |
| 最终验证 | A 离线回归为主 45% / B +单线路真实冒烟 40% / C +全量真实 15% | — | A |

默认区（未反对即定）：真源=SKILL.md、create_thread 归 agent 脚本只做状态面、模型两档、selftest 编排回归域为验收主力（npm test 红灯分离）、复盘 7.1 八条保留设计维持。

### 第 2 轮（建图覆盖面与确认区）

| 问题 | 候选 | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| wayfinder 覆盖面 | A 全量建图 #5 转父节点 60% / B 只本次范围 25% / C 建图并关闭 #5 15% | A | A |

确认区四条全同意：schema v3+v2 兼容、旧 runtime 归档不删、#5 作载体补验收条件、目标仓现场不碰。

### 第 3~4 轮（对照物翻案）

- v1 mock 从零画表格 UI，被用户翻掉（「之前不是已经按 design_handoff_issue_starmap 实现的吗，差别这么大理由是什么」）——判断偏差：漏读既有锁定设计。v2 改为星图零变化+六挂点增量，成为强约束。
- 用户追加：双视图文案「图谱视图/地图视图」→「Map / List」。

### 第 5 轮（验收）

| 问题 | 候选 | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| AC-007 UI 深度 | A [C] 人工对照 mock 55% / B [A]字符串断言+[C] 40% / C 只[A] 5% | A | A |
| AC-008 建图验收 | A [A] gh 断言脚本 60% / B [D] 清单+人工 35% / C 不验 5% | A | A |

九条 AC 的后果表用户未反对；途径挂载（orchestration 域场景过滤、collect 域不作门槛、冒烟全红为预期）走默认区未反对。

## 设计取舍

### D-1 新 CLI 形态

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 按现有风格拆多个脚本 | registry.mjs / inbox.mjs / stop.mjs 各自入口 | 三处重复实现 registry 读写与锁，原子性约定易漂移 | 锁与原子写必须单点实现 |
| B（选定）单入口 orchestrate.mjs 子命令 | 一个脚本八个子命令，导出函数供 selftest | 单文件偏大 | 无 |
| 什么都不做 | 继续靠 agent 记忆 | 复盘三个红灯原样保留 | 正是本次要修的 |

选定 B。理由：幂等与原子性是这套控制面的命根，实现点越少越不容易漂。落进契约的形态：强约束「全部写入走 tmp+rename 原子替换加互斥」。

### D-2 契约条数信号

初聚 9 条触发七条上限，按「同一条规则的不同侧面」二次聚类合并为 7（inbox 幂等并入生命周期、全局停止并入终态治理，通用回归门撤出 AC 进强约束，编号随之连续重排——第 5 轮访谈记录中的九条后果表按此映射）；不拆契约：执行层面的拆分由 wayfinder 依赖图（N1~N9）承担（用户第 1 轮裁决），契约作为整轮升级的验收伞。代价：单轮交付面大，靠 issue 图分段推进。

### D-3 已立案 bug 的归宿

#23/#25 关闭收编进 N2/N1（同一批文件一次改完，避免重复实现），#22/#24 保留原 issue 直接实现（自身即完整交付单元）。为什么没选全部保留：#23/#25 与 registry/原子写不可分割，分开实现必然二次返工。
