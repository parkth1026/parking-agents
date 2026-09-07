# AES-QG/1：跨仓统一的客观保证等级标准（normative）

> 所有者是 aes-gate。aes-qa 与 aes-worktree-board/GATE-qa 是消费方，不是标准所有者。
> 确认版规格源：`.aes-workflow/grilling/2026-09-05-aes-gate-objective-level-standard/2-prototype/`（锁定，不可修改）。
> 本文是标准在技能内的 normative 落地；与确认版冲突时以确认版为准并修本文。

## 1. 等级是 assurance boundary（保证边界），不是排序

`AES-QG Lx` 回答「这次执行在什么客观边界上给了保证」，不回答「测试多不多、跑得久不久、
有没有联网、是不是人做的」。等级与以下维度**正交**，它们不能抬高或降低等级：

- 执行时间、test size、资源预算、machine-exclusive；
- 网络策略（hermetic / loopback-only / declared-endpoints）；
- 证据方式（automated / live / manual / screenshot——那是 aes-qa 的 evidence mode）;
- 质量属性风险（security / performance / accessibility / compatibility / reliability）;
- 发布策略（release qualification 见 §7，独立裁决）。

### 规范矩阵

| 等级 | 客观测试对象 | 最低断言范围 | PASS 必须证明 | 明确不代表 |
| --- | --- | --- | --- | --- |
| `AES-QG L0` | source/config/schema/build graph | static conformance | 目标能被解析、类型/格式/依赖关系符合机器规则；不要求执行被测行为 | 组件行为正确 |
| `AES-QG L1` | isolated component | component behavior | 单一组件在受控替身/fixture 下满足公开合同与边界值 | 真实组件间连通 |
| `AES-QG L2` | collaborating components | integration contract | 两个或以上真实生产组件通过真实边界协作，允许受控外部替身 | 完整产品关键旅程 |
| `AES-QG L3` | assembled candidate | system smoke | 同一候选通过至少一条代表性关键用户/服务旅程，覆盖真实进程内/进程间装配 | 完整系统回归或发布制品正确 |
| `AES-QG L4` | release-candidate artifact | system E2E regression | 从产品公开入口到最终可观察结果覆盖声明的关键旅程集合，并验证候选发布制品 | 安装后环境、升级/回滚、外部依赖真实性 |
| `AES-QG L5` | installed distributable artifact | operational acceptance | 在声明的代表性受控环境完成安装/启动/升级或兼容/持久化/清理等适用生命周期 | 自动获得 release-qualified，或真实生产环境已无风险 |

## 2. 机械判级规则（classifyCheck）

单个 check 只按它**实际观察到的**三条轴各取其值，等级 = 三轴等级的最小值：

| 轴 | 闭集（index=等级上限） |
| --- | --- |
| `testObject` | `source` / `config` / `schema` / `build-graph`(→0)；`isolated-component`(→1)；`collaborating-components`(→2)；`assembled-candidate`(→3)；`release-candidate-artifact`(→4)；`installed-distributable-artifact`(→5) |
| `assertionScope` | `static-conformance`(→0)；`component-behavior`(→1)；`integration-contract`(→2)；`system-smoke`(→3)；`system-e2e-regression`(→4)；`operational-acceptance`(→5) |
| `artifactFidelity` | `static-artifact`(→0)；`controlled-standins`(→1)；`real-boundary`(→2)；`assembled-process`(→3)；`release-artifact`(→4)；`installed-artifact`(→5) |

- 任一轴取值不在闭集内 → `UNCLASSIFIED`（带原因），不猜。
- 名称（含 `E2E`/`full`/`release` 字样）、耗时、测试数量、网络策略、证据方式、
  人工/自动——全部不是判级输入；输入里带这些字段会被忽略，不会改变结果。
- 单个 check 的判级产物只有 `classifiedAt=AES-QG-Lx`；`achievedLevel` 属于累计
  receipt（§5），任何单测结果不得自称「L4 已通过」。

## 3. namespace 规则

- 人类结论、机器日志、结构化 receipt **首次**提到等级必须写完整 `AES-QG Lx`
  （机器字段用 `AES-QG-Lx`）。
- 裸 `Lx` 只允许出现在同一行/同一上下文已声明 `AES-QG` 之后（如
  `AES-QG L3 PASS: achieved=L3`）。
- 所有机器可读字段（`level` / `requiredLevel` / `achievedLevel` /
  `requiredRepositoryGate` / `supported_through` / `target_level`…）必须是完整
  `AES-QG-L[0-5]`；裸 `L[0-5]` 一律 fail closed。

## 4. `gate-policy.toml`（`aes-gate-policy/v1`）

`run.toml` 永远是 action id/name/kind/argv 的唯一注册真源；policy 只**引用** action id，
绝不复制命令定义（出现 `run` / `argv` 键即非法）。policy 由 aes-gate 生成候选、
用户确认后落地。

```toml
schema = "aes-gate-policy/v1"
standard = "AES-QG/1"            # 必须等于 AES-QG/1
supported_through = "AES-QG-L4"  # 诚实截止：不具备的形态不要声明
migration = "terminal"           # staged | terminal（默认 terminal）

[[levels]]
level = "AES-QG-L0"
action = "gate.l0"               # 外键：必须存在于 run.toml 且 kind="gate"
subject = "source"               # 展示用
environment_class = "hermetic"   # 以下三项是可审计运行 policy，不参与判级
network_policy = "none"
size_class = "small"
artifact_paths = []              # L4/L5 可选：参与 artifact digest 的制品路径

[[profiles]]
id = "quick"
action = "gate.quick"            # 便利入口，必须显式展开 target_level
target_level = "AES-QG-L1"

[[release_profiles]]
id = "desktop-release"
required_level = "AES-QG-L5"
required_quality_attributes = ["functional", "security", "compatibility"]
required_evidence_modes = ["automated", "live"]
require_provenance = true
```

约束：

- `levels[]` 必须从 `AES-QG-L0` **连续**到 `supported_through`，不跳级、不重复、不越界。
- `profiles[].target_level` ≤ `supported_through`；profile 名不是证据语义，
  执行时必须展开为标准等级。
- `quick/mid/full` 只是单仓便利 profile，不构成等级同义词，跨仓比较一律看 AES-QG Level。

## 5. GateReceipt（`aes.gate.receipt/v1`）与累计规则

- `achievedLevel` = **同一 candidate 的 L0-Lx 最高连续 PASS**；缺任一级不得跨越。
- `outcome` 闭集 `PASS | BLOCKED | FAILED`；level 结局闭集 `PASS | FAILED | NOT_REACHED`，
  未执行不得写 PASS。
- `disposition` 闭集 `executed | reused`；未执行的 level 不带 disposition。
- capability 不足 → `BLOCKED` + `failureClass=BLOCKED_CAPABILITY`（不是测试 FAIL，
  也不是 N/A PASS）；断言失败 → `FAILED` + `failedAt`，高于失败级的 level 全部
  `NOT_REACHED`。
- `levels[].receiptDigest` 是被复用 level receipt 的内容寻址摘要（canonical JSON 的
  sha256）。

## 6. 五维 evidence identity 与复用

低层证据仅在下表五维**全匹配**时可 `reused`；任一变化必须 `STALE_EVIDENCE` 并重跑，
TTL 不参与正确性判定：

| 维 | 承载字段 | 变化来源示例 |
| --- | --- | --- |
| candidate SHA | `identity.candidateCommitSha` | 新 commit |
| artifact digest | `identity.artifactDigest`（未声明 artifact_paths 时恒为 `"none"`） | 同源码但制品字节变化（E3） |
| gate-definition digest | `identity.gateDefinitionDigest` | run.toml 中被引用 action 的 argv/kind 变化 |
| policy digest/version | `identity.policyDigest` + `policyVersion` | gate-policy.toml 任何变化（E2） |
| environment identity | `identity.environmentDigest` | node 版本/平台/架构变化 |

落盘：`.aes-gate/runs/run-<n>/level-AES-QG-L<k>.json`（level receipt，含五维 identity）
与 `gate-receipt.json`（累计 receipt）。复用扫描按 run 倒序找同 identity 的 PASS
level receipt；发现同 level 但 identity 不匹配的历史 receipt 时报告
`STALE_EVIDENCE <dim> changed` 并重执行。

## 7. release qualification（独立裁决）

`AES-QG L5 PASS` 只表示 operational acceptance 边界通过。`qualifiesForRelease` 只能由
显式选择 release profile 的评估置 true，且要求同时满足：required level 达标、
`required_quality_attributes` 与 `required_evidence_modes` 的正交证据齐全、
`require_provenance` 时来源链完整。默认（未评估）`qualifiesForRelease=false,
releasePolicy=null`。L5 PASS + release BLOCKED 是合法且必须可表达的状态。

## 8. 执行器与退出码（scripts/aes-qg.mjs）

```
node scripts/aes-qg.mjs --repo <路径> gate.l3 [--json]
                        --repo <路径> gate.<profile-id>
                        --repo <路径> gate                # 裸 gate：拒绝歧义
                        --repo <路径> gate.l5 --release-profile <id> --evidence <json>
```

| 退出码 | 含义 |
| --- | --- |
| 0 | requested level 累计 PASS（release BLOCKED 不改此码） |
| 1 | ASSERTION_FAILED（某级断言失败） |
| 2 | BLOCKED（capability 不足 / policy 缺失或不合规 / 目标不可读） |
| 64 | 用法错误；**裸 `gate` 歧义拒绝——不执行任何门**（迁移终态行为） |

## 9. legacy 迁移（分阶段，可重放）

| 阶段 | 判定 | 行为 |
| --- | --- | --- |
| legacy（无 gate-policy.toml） | bare `gate` / 自定义 gate action / 旧报告、旧 receipt | 全部标 `legacy-unqualified`；collect 给出 UNCONFIRMED 映射候选；不产生任何 AES-QG `achievedLevel`；旧证据原字节保留 |
| staged / terminal（policy 已确认） | `schema="aes-gate-policy/v1"` | 标准 action 生效；裸 `gate` fail closed（exit 64）；未确认映射仍不产生等级结论 |
| terminal | 建议 run.toml 删除裸 `gate` | 引擎对残留裸 `gate` 仍拒绝执行 |

映射候选由名称启发式给出（e2e→L4、smoke→L3、integration→L2、component/unit→L1、
lint/type/format/check→L0、install/upgrade/compat→L5），永远 `UNCONFIRMED`，
用户确认前不参与任何判级。历史报告/receipt/Issue/commit 不批量改写、不回填 AES-QG 含义。

## 10. 消费合同（aes-qa 与 GATE-qa）

- 新 QA 流程使用 `aes.qa.receipt/v3`，原子引用 GateReceipt：
  `requiredRepositoryGate`（`AES-QG-Lx` 或 `"none"`）+ `repositoryGate`
  `{standardVersion, achievedLevel, gateReceiptDigest, candidateCommitSha, outcome}`。
- `requiredRepositoryGate="none"` 只允许可信 tracker-only classification：
  `trackerOnly=true` + `repositoryGateReason` 非空 + candidate 无 product bytes 变化
  （GATE-qa 按默认拒绝的 tracker-only 路径白名单机械复核）；不得伪造 L0 PASS。
- `v1`/`v2` QaReceipt 历史语义永久冻结：GATE-qa 对它们不做 repository gate 校验，
  v3 缺字段不得降级成旧 receipt 处理（fail closed）。
- GATE-qa 的 level 子门并入既有 `GATE-qa` 机械门（不新增第九道顶层门）：
  required/achieved 可比较、digest 合法、candidate 一致、缺级/旧证据/NOT_RUN
  均 fail closed。
- repository level 与 release profile 正交证据分别裁决：L5 不能单独放行发布。

## 11. 与四态词汇的关系

aes-gate 的 `green/red/missing/stale` 运行态词汇继续存在（collect 评分/看板不变）；
AES-QG 是其上的保证等级结论，不替代它。普通 `kind=test` action 的 argv、退出码和用途
保持不变；只有被 gate policy 引用时才新增 `classifiedAt` 元数据，不自动改名为 gate。
