# Goal Contract: 建立跨仓统一的 AES-QG L0-L5 客观保证等级

- Status: Ready
- Target: `D:\GIT\parking-agents` 的 `aes-gate`、`aes-qa` 与 `aes-worktree-board/GATE-qa`
- Updated: 2026-09-05

## 原始请求

> 我认为 L几应该是客观的 标准，而不是排序。
>
> 以后所有仓库都是统一的 应该写进 aes-gate 标准。
>
> 以后提到任何一个 L 都知道 是什么强度。有共识。
>
> 请你结合软件工程最佳实践来设计这个模式，并且作为 aes-gate 技能标准。请你先深度调研与思考，然后我们开始 workflow-interview。
>
> 需要明确表达通过的 gate 是哪一道，quick 还是 mid 还是 full，然后 aes-qa 是否跟 aes gate 知道这块内容设计。

## 目标

建立跨仓统一、可机械审计且与正交风险证据解耦的 AES-QG L0-L5 assurance standard（保证标准），并让 aes-gate、aes-qa 与 GATE-qa 以同一证据合同生成和消费等级结论。

## Why

- 现有仓库的 L 编号、quick/mid/full 和裸 gate 是局部排序，不能回答通过了什么客观强度。
- 只统一名称而不统一分类规则、candidate identity（候选身份）和消费门禁，会制造 false assurance（虚假保证）。
- 统一后，维护者、QA 和合并门可以比较跨仓结论，同时仍让纯库、CLI、服务和桌面应用诚实声明不同的支持上限。

## 范围

做：

- 在 aes-gate 定义版本化的 `AES-QG/1`、L0-L5 normative matrix（规范矩阵）、分类规则与完整 namespace。
- 定义 `aes-gate-policy/v1`，以 run action id 为外键描述 supported level、standard level action、可选 profile 与 release policy。
- 定义并生成 `aes.gate.receipt/v1`，实现累计等级、内容寻址复用、明确结局和离线 Board 投影。
- 将 repository gate evidence（仓库门证据）接入 `aes.qa.receipt/v3` 和 GATE-qa，并保持 release qualification（发布资格）独立裁决。
- 提供可重放的 legacy repository fixture 与分阶段迁移判定，使旧证据保持原语义。

不做：

- 不在本任务内修改 AntAgentWeb2、SuperTools、AesDataCenterManger 或其他下游仓库的 `run.toml`、gate policy 和测试实现。
- 不批量改写历史报告、历史 receipt、Issue 或 commit，不给旧 L 回填 AES-QG 含义。
- 不把 security、performance、accessibility、compatibility、live/manual/screenshot evidence 合并进 L 轴。
- 不替代各仓库的风险策略，也不在本任务内执行任何下游 release gate。

## 强约束

- `AES-QG Lx` 是 assurance boundary（保证边界），不是执行次序、wall-clock time（运行时间）、测试数量、test size 或网络策略。
- L0-L5 只由 test object（测试对象）、assertion scope（断言范围）与 artifact fidelity（制品保真度）判定；名称含 `E2E`、`full` 或 `release` 不能成为判级证据。
- 人类结论、机器日志和结构化 receipt 首次提到等级时必须使用完整 `AES-QG Lx`；裸 `Lx` 只允许出现在已声明 `AES-QG` 上下文内。
- `run.toml` 永远是 action id/name/kind/argv 的唯一注册真源；`gate-policy.toml` 只引用 action id，不复制命令定义。
- `achievedLevel=AES-QG-Lx` 必须由同一 candidate 的 L0-Lx 最高连续 PASS 得出；单个 check 只能声明 `classifiedAt`，缺级不得跨越。
- 低层证据仅在 candidate SHA、artifact digest、gate-definition digest、policy digest/version 和 environment identity 全匹配时可复用；任一变化必须 `STALE_EVIDENCE` 并重跑。
- `AES-QG L5 PASS` 只表示 operational acceptance（运行验收）边界通过，不自动表示 `releaseQualified=true`；发布资格必须同时满足所选 release profile 的正交证据和 identity。
- `aes.qa.receipt/v1` 与 `/v2` 的历史语义永久冻结；新 repository gate 语义使用 `/v3`，不得把缺字段的 v3 降级成旧 receipt 处理。
- `requiredRepositoryGate="none"` 只允许可信 tracker-only classification（纯跟踪项分类）且 candidate 没有 product bytes 变化；不能只凭自由文本理由绕过 repository gate。
- 旧 action、报告和 receipt 原字节保留并标 `legacy-unqualified`；未确认映射不能产生 AES-QG `achievedLevel`。
- 确认版 `../2-prototype/behavior.md`、`api-mock.md`、`example-run.md`、`mock.html` 与 `diagram.html` 是不可修改的规格源；执行 Agent 改的是产品与测试，不是尺子。
- Gate Board 按已确认的 state/structure fidelity（状态级/结构级保真）验收：DOM 语义、信息层级和关键状态必须一致，不要求像素一致。
- aes-gate 运行时保持零新增第三方依赖；Gate Board 保持零 JavaScript、零外链、断网可读。

## 自主边界

不用问，直接定：

- 内部模块拆分、函数命名、测试 fixture 的具体文件名、错误文案细节和 digest 的确定性序列化实现。
- 在不改变确认版公共字段和语义的前提下，选择 parser、validator、executor 与 receipt renderer 的内部边界。
- 为现有 `run-tests.mjs` 增加 case-scoped JSON 输出和必要的正反 fixture；修复执行中发现的同类诚实性漏洞，并在回执中单列契约外行为。

必须停下来问：

- 修改已确认的 L0-L5 边界、完整 namespace、累计规则、五维 evidence identity 或 release qualification 公式。
- 改动 `run.toml` 通用 schema、引入运行时第三方依赖、改变 GateReceipt/QaReceipt 公共字段语义或另增一种并行 receipt 真源。
- 删除既有 v1/v2 receipt 读取能力、提前结束 legacy 迁移期，或把任何下游仓库的实际迁移扩大进本任务。

## 读什么

- `../2-prototype/behavior.md`：确认版 L0-L5 矩阵、行为变化、边界值与不变清单。
- `../2-prototype/api-mock.md`：确认版 gate policy、GateReceipt、QaReceipt 与 tracker-only 报文。
- `../2-prototype/example-run.md`：确认版 CLI、阻塞、stale、发布资格与迁移输出。
- `../2-prototype/mock.html`：确认版 Gate Board 状态与信息结构。
- `../2-prototype/diagram.html`：确认版标准所有权、依赖方向与消费拓扑。
- `skills/workflow/aes-gate/SKILL.md` 与其 `references/`、`scripts/collect.mjs`、`run-tests.mjs`：当前 gate 注册、采集和零依赖测试合同。
- `skills/workflow/aes-qa/SKILL.md` 与 `run-tests.mjs`：当前 QaReceipt 与证据模式合同。
- `skills/workflow/aes-worktree-board/scripts/merge-policy.mjs`、`master.mjs` 与 `selftest.mjs`：当前 GATE-qa、v1/v2 兼容和合并门合同。

## 验收条件

- AC-001: `AES-QG/1` 对 L0-L5 给出唯一、可机械执行的客观判级；正例能归入预期等级，近邻反例、名称/耗时/数量和正交 evidence mode 不能抬高等级，单项只产生 `classifiedAt`。
  - Verify: [A] `node -e "const{spawnSync}=require('node:child_process');const r=spawnSync(process.execPath,['skills/workflow/aes-gate/run-tests.mjs','--contract','aes-qg','--case','level-classification','--json'],{encoding:'utf8'});let p;try{p=JSON.parse(r.stdout)}catch{}process.exit(r.status===0&&p&&p.outcome==='PASS'&&p.case==='level-classification'?0:1)"` → 退出码 0，且六级正例、近邻反例、namespace 与正交维度误分类断言全绿
- AC-002: `aes-gate-policy/v1` 只引用 `run.toml` action；level 从 L0 连续到 `supportedThrough`，`gate.lx` 累计 L0-Lx，profile 显式展开 `targetLevel`，unsupported 返回 `BLOCKED_CAPABILITY`，迁移终态裸 gate 不执行任何门并退出 64。
  - Verify: [A] `node -e "const{spawnSync}=require('node:child_process');const r=spawnSync(process.execPath,['skills/workflow/aes-gate/run-tests.mjs','--contract','aes-qg','--case','policy-execution','--json'],{encoding:'utf8'});let p;try{p=JSON.parse(r.stdout)}catch{}process.exit(r.status===0&&p&&p.outcome==='PASS'&&p.case==='policy-execution'?0:1)"` → 退出码 0，且完整、缺级、profile、unsupported、裸 gate 与 argv 不复制 fixture 全绿
- AC-003: `aes.gate.receipt/v1` 的 `achievedLevel` 是同 candidate 最高连续 PASS；五维 identity 任一变化都拒绝复用并留下 `STALE_EVIDENCE`，PASS/BLOCKED/FAILED 与 executed/reused/NOT_REACHED 语义闭合；Board 只投影 receipt 并符合确认版状态级/结构级规格。
  - Verify: [A] `node -e "const{spawnSync}=require('node:child_process');const r=spawnSync(process.execPath,['skills/workflow/aes-gate/run-tests.mjs','--contract','aes-qg','--case','receipt-identity-board','--json'],{encoding:'utf8'});let p;try{p=JSON.parse(r.stdout)}catch{}process.exit(r.status===0&&p&&p.outcome==='PASS'&&p.case==='receipt-identity-board'?0:1)"` → 退出码 0，且五维逐项篡改、结局闭集、连续聚合、DOM 关键状态、零 JS/外链断言全绿
- AC-004: 新 QA 使用 `aes.qa.receipt/v3` 原子引用 GateReceipt；aes-qa 与 GATE-qa 对 required/achieved、candidate、base、digest、stale、legacy 和 `none` 一致 fail closed，v1/v2 保持旧语义；repository level 与 release profile 正交证据分别裁决，L5 不能单独放行发布。
  - Verify: [A] `node -e "const{spawnSync}=require('node:child_process');const q=spawnSync(process.execPath,['skills/workflow/aes-qa/run-tests.mjs','--contract','repository-gate-level','--json'],{encoding:'utf8'});let p;try{p=JSON.parse(q.stdout)}catch{}const g=spawnSync(process.execPath,['skills/workflow/aes-worktree-board/scripts/selftest.mjs','orchestration','--scenario','repository-gate-level'],{encoding:'utf8'});process.exit(q.status===0&&p&&p.outcome==='PASS'&&p.contract==='repository-gate-level'&&g.status===0&&(g.stdout||'').includes('repository-gate-level')?0:1)"` → 退出码 0，且足够、不足、stale、legacy、none 滥用、v1/v2 兼容和 L5 非发布资格分支全绿
- AC-005: 分阶段迁移能把旧仓 gate 识别为 `legacy-unqualified` 并给出未确认映射候选，但不改旧证据、不产生 AES-QG `achievedLevel`；启用新 schema/action 后只接受完整 namespace，迁移终态裸 gate fail closed，且所有迁移状态可重放。
  - Verify: [A] `node -e "const{spawnSync}=require('node:child_process');const r=spawnSync(process.execPath,['skills/workflow/aes-gate/run-tests.mjs','--contract','aes-qg','--case','legacy-migration','--json'],{encoding:'utf8'});let p;try{p=JSON.parse(r.stdout)}catch{}process.exit(r.status===0&&p&&p.outcome==='PASS'&&p.case==='legacy-migration'?0:1)"` → 退出码 0，且旧证据字节、legacy 标记、未确认映射、版本隔离和终态拒绝断言全绿

## 挡着的事

- None.

## 访谈记录

### 第 1 轮：目标与边界

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| 等级名称是否强制 namespace | A 首次完整 `AES-QG Lx` 70% / B 永远允许裸 L 20% / C 仓库自定前缀 10% | A，避免 SLSA 与仓库本地 L 冲突 | A，“都选 A” |
| 标准命令与 profile 的关系 | A `gate.l0...l5` 为标准、profile 显式 target 65% / B profile 即等级 25% / C 只保留裸 gate 10% | A，便利入口不能成为证据语义 | A |
| L5 是否等于可发布 | A 否，发布还需正交证据与 identity 75% / B 是 15% / C 仓库自行解释 10% | A，functional assurance 不能吞并风险策略 | A |
| achievedLevel 是否累计 | A 同 candidate 连续 L0-Lx 70% / B 只看最后单项 20% / C 允许 N/A 跨级 10% | A，防止高层单测冒充整体通过 | A |
| 不支持高等级如何表达 | A supported/required/achieved 70% / B 强制所有仓 L0-L5 15% / C N/A 跨级 15% | A，纯库不能被迫伪造产品形态 | A，“全都A” |
| policy metadata 放哪里 | A `gate-policy.toml` 外键引用 60% / B 扩展 `run.toml` 30% / C 从名称推断 10% | A，保持通用 runner schema 和 action 真源 | A |
| 低层证据如何复用 | A 五维 identity 内容寻址 65% / B 每次全重跑 25% / C TTL 10% | A，在正确性与成本之间保持可审计边界 | A |
| 旧仓如何迁移 | A 分阶段迁移 70% / B 一次硬切 20% / C 永久双轨 10% | A，既不篡改历史也不永久保留歧义 | A |

### 第 2 轮：验收深度

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| L0-L5 分类验多深 | A 正例+近邻反例自动合同 65% / B 只查文档 25% / C 人工抽查 10% | A，错误属于 false assurance | A，“全部都a” |
| policy/累计/profile 验多深 | A 多形态临时仓黑盒 70% / B 只跑 L5 happy path 20% / C 人工确认 10% | A，必须覆盖缺级与歧义入口 | A |
| receipt identity 与 Board 验多深 | A 五维篡改+schema+DOM 70% / B 成功 JSON 20% / C 文本存在 10% | A，防旧绿背书新候选 | A |
| mock 复刻精度 | A 状态/结构级 65% / B 双轨截图 30% / C 像素级 5% | A，保护审计信息而不冻结内部页面样式 | A |
| QA/GATE-qa 联动 | A 五类 receipt 跨技能合同 70% / B 只成功路径 20% / C 只写文档 10% | A，必须证明 merge gate 实际阻断 | A |
| legacy 迁移验多深 | A 全迁移态 fixture 70% / B 只验新仓 20% / C 两仓人工演练 10% | A，历史语义不可只靠承诺 | A |

### 第 3 轮：公共 schema

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| QaReceipt 新语义如何版本化 | A 新增 v3 75% / B v2 可选字段 15% / C 独立 sidecar 10% | A，缺字段必须能与历史旧证据区分 | A |

### 对照物确认

- 用户确认 v1 的行为矩阵、报文、可执行示例、Board mock 和架构图后要求继续；确认版已提升到 `2-prototype/` 根目录。
- 用户明确选择状态级/结构级复刻，不选择截图双轨或像素级锁定。

## 设计取舍

### D-1 等级主轴与正交风险

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A（选定） | L 只表达功能/制品保证边界；质量属性、证据方式和发布策略正交 | 需要组合多个 verdict | 无 |
| B | 把安全、性能、人工、live 等继续塞入更高 L | 单一数字看似简单但不可比较 | 同一 L 会随仓库风险不同而漂移 |
| 什么都不做 | 保留仓库本地 L 排序 | 无迁移成本 | 无法形成跨仓共识 |

选定 A。行业资料区分 test level、test type 与 test size；AES-QG 是建立在这些概念之上的组织级标准，不冒充既有行业 L0-L5。

### D-2 action 注册与 gate policy

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A（选定） | `run.toml` 注册动作，版本化 `gate-policy.toml` 引用 action id | 两个 manifest 要交叉校验 | 无 |
| B | 把全部 gate metadata 写进 `run.toml` | 单文件但污染所有通用 runner | gate 特例会扩大通用 schema 迁移面 |
| C | 由 action 名称推断等级 | 零 schema 成本 | 不可机械证明，命名漂移即语义漂移 |

选定 A。职责边界以唯一命令真源加独立 policy 合同表达。

### D-3 QaReceipt 版本与历史兼容

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A（选定） | 新 repository gate 语义进入 `aes.qa.receipt/v3`，冻结 v1/v2 | 消费者新增版本分支 | 无 |
| B | 给 v2 加可选字段 | 少一个版本号 | 同版本出现两种保证强度，漏字段无法 fail closed |
| C | 另建 gate-link sidecar | QaReceipt 不动 | 证据不原子，归档与引用可能分离 |

选定 A。版本号表达保证语义的变化，而不是实现发布日期。
