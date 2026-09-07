<!-- confirmed v1 | confirmed 2026-09-05 | 用户意见：全部按 A，继续 -->

# 行为对照表：AES-QG 客观等级标准

## AES-QG L0-L5 normative matrix（规范矩阵）

等级只由 `test object / assertion scope / artifact fidelity`（测试对象 / 断言范围 / 制品保真度）决定；
执行时间、test size、是否联网、是否人工、性能/安全/兼容性均不能抬高或降低等级。

| 等级 | 客观测试对象 | 最低断言范围 | PASS 必须证明 | 明确不代表 |
| --- | --- | --- | --- | --- |
| `AES-QG L0` | source/config/schema/build graph | static conformance（静态符合性） | 目标能被解析、类型/格式/依赖关系符合机器规则；不要求执行被测行为 | 组件行为正确 |
| `AES-QG L1` | isolated component（隔离组件） | component behavior（组件行为） | 单一组件在受控替身/fixture 下满足公开合同与边界值 | 真实组件间连通 |
| `AES-QG L2` | collaborating components（协作组件） | integration contract（集成合同） | 两个或以上真实生产组件通过真实边界协作，允许受控外部替身 | 完整产品关键旅程 |
| `AES-QG L3` | assembled candidate（组装候选） | system smoke（系统冒烟） | 同一候选通过至少一条代表性关键用户/服务旅程，覆盖真实进程内/进程间装配 | 完整系统回归或发布制品正确 |
| `AES-QG L4` | release-candidate artifact（候选发布制品） | system E2E regression（系统端到端回归） | 从产品公开入口到最终可观察结果覆盖声明的关键旅程集合，并验证候选发布制品 | 安装后环境、升级/回滚、外部依赖真实性 |
| `AES-QG L5` | installed distributable artifact（已安装可分发制品） | operational acceptance（运行验收） | 在声明的代表性受控环境完成安装/启动/升级或兼容/持久化/清理等适用生命周期 | 自动获得 release-qualified，或真实生产环境已无风险 |

判级规则：一项 check 只能按它实际观察到的最窄保证边界获得 `classifiedAt`；名称、耗时、测试数量和
“E2E”标签均不是判级证据。仓库若不具备某一级及以上的产品形态，就以 `supportedThrough` 诚实截止。

## 跨仓映射示例（非标准强制配置）

| 仓库形态 | L0 | L1 | L2 | L3 | L4 | L5 |
| --- | --- | --- | --- | --- | --- | --- |
| Tauri desktop | lint/type/schema | Rust/React component tests | IPC/adapter integration | assembled app smoke | release artifact E2E | installer/upgrade/compat lifecycle |
| Server + CLI | format/type/protocol schema | domain unit | DB/transport integration | assembled service CLI smoke | release protocol E2E | deployed/packaged lifecycle |
| Pure library | build/API/static | public behavior | backend/runtime integration | 仅在有 assembled distribution 时支持 | 仅在有 release artifact journey 时支持 | 通常 unsupported |

`quick/mid/full` 只是在单仓内方便调用的 profile，不构成等级同义词。示例可映射为 L1/L3/L4，
但每个 profile 必须在 policy 中显式写 `target_level`，跨仓比较一律看 AES-QG Level。

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| B1 | 人或 agent 说“gate 通过” | 不知道通过了 quick/mid/full 或某仓自定义 L | 必须报告 `AES-QG Lx PASS`；机器报文写 `achievedLevel` |
| B2 | 执行裸 `gate` | 各仓可能表示 full、quick 或任意聚合 | 迁移终态 fail closed，提示选择 `gate.l0...gate.l5` 或已声明 profile |
| B3 | 执行 `gate.l3` | 没有跨仓含义 | 对同一 candidate 累计满足 L0-L3；缺任一级不得声称 L3 |
| B4 | 单个测试被分类到 L4 | 容易被口头升级成“L4 已通过” | 只能写 `classifiedAt=AES-QG-L4`；总体 `achievedLevel` 由累计 receipt 裁决 |
| B5 | 某仓没有 L3 能力 | 可能写 N/A 后继续声称 full | `supportedThrough` 截止 L2；unsupported 不算测试失败，但禁止声称 L3+ |
| B6 | 高层运行希望复用低层结果 | 可能凭时间或人工判断复用 | 五项 identity 全匹配才可 `reused`，否则 `STALE_EVIDENCE` |
| B7 | AES QA 最终轮 | 只记录 automated/live/manual，未强制仓库 gate 强度 | QaReceipt vNext 声明 required level 并引用 GateReceipt；GATE-qa 机械校验 |
| B8 | L5 PASS | 容易被解释为允许发布 | 只证明 operational acceptance；release-qualified 另由 policy + 正交证据裁决 |
| B9 | 旧报告写 `L3 passed` | 读者可能按新标准重解释 | 标为 `legacy-unqualified`，保留原字节和原语义，不回填 AES-QG |
| B10 | aes-gate 扫描仓库 | 只给 red/green/missing/stale 与六维评分 | 额外输出 policy 合规、supported/required/achieved 与映射缺口 |

### 边界值

| # | 输入 | 预期 |
| --- | --- | --- |
| E1 | `gate.l4` 的 L0 编译失败、L4 E2E 单独绿 | `outcome=FAILED`，`achievedLevel=null` 或低于 L0，绝不报告 L4 PASS |
| E2 | candidate SHA 相同但 policy digest 改变 | 旧低层证据 stale，必须重跑 |
| E3 | source SHA 相同但 release artifact digest 改变 | artifact-bound 等级证据 stale |
| E4 | `required=L4`、`supportedThrough=L3` | `BLOCKED_CAPABILITY`，不是测试 FAIL，也不是 N/A PASS |
| E5 | L5 PASS 但 required security receipt 缺失 | repository gate 可 PASS；release policy 必须 BLOCKED |
| E6 | tracker-only 工作要求 repository gate `none` | QaReceipt 明确 `requiredRepositoryGate="none"` 与理由；不得伪造 L0 PASS |

## 不变清单

- `run.toml` 仍是 action id/name/kind/argv 的唯一注册真源。
- aes-gate 的 `green/red/missing/stale` 运行态词汇继续存在；它们不被 L 替代。
- automated/live/manual/screenshot 继续是 aes-qa evidence mode，不与 L 合并。
- security/performance/accessibility/reliability 仍按风险独立要求，不因高 L 自动通过。
- 历史报告、历史 receipt 和历史 Issue 保持原字节，不批量改写。
- CI 可以并行调度不同 level/check；L 的累计语义不要求流水线物理串行。
- timeout、资源预算、machine-exclusive 是 size/environment policy，不决定 L。
- 无关仓库不因缺少不需要的高层能力被判失败；只有 profile 要求超过支持上限时 BLOCKED。

## 配置差异

| 字段/文件 | 现在 | 改后 | 迁移 |
| --- | --- | --- | --- |
| `run.toml` | 任意 `kind=gate` action | 标准 action `gate.l0...gate.l5` + 可选 profile | 先并存，终态删除/拒绝裸 gate |
| `gate-policy.toml` | 不存在 | `aes-gate-policy/v1`；等级、profile、正交要求 | aes-gate 生成候选，用户确认后落地 |
| GateReceipt | 不存在统一 level receipt | `aes.gate.receipt/v1` | 新运行只出新 receipt；旧报告只读 |
| QaReceipt | v1/v2 无强制 repository level | vNext 增加 required/actual gate 引用 | v1/v2 历史兼容；新流程要求 vNext |
