<!-- draft v3 | independence/context revision 2026-08-30T20:13:50+08:00
     用户意见：Creator 独立；上下文选择主文件与创建分支双零增长
     状态：confirmed basis for Goal Contract -->

# 行为对照表: Creator 外部可变证据评测与持续质量门

**确认版·锁定。** 执行 Agent 最终改产品，不改本对照物。

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| B01 | Creator 创建/改进一个依赖 Web、外部 API、数据库/文件快照或实时数据的技能 | Step 2 只分 scripts/references/assets/run-tests，不识别外部时变依赖 | Step 2 必须把该依赖归类为 `external evidence`，声明 replay 可固定什么、live 才能证明什么；未分类不进入输出评测 |
| B02 | `eval_metadata.json` 含用户任务与外部证据 | 只有 `prompt` 与 `assertions`；fixture 约定容易被塞进用户 prompt | `prompt` 逐字保留用户任务；独立 `evidence` 对象声明 mode/provider/manifest/miss/live policy；聚合后原样进入 `output-evals.json` |
| B03 | replay 起跑，manifest、payload、摘要均存在 | Agent 通过文字提示自行 lookup，仍可能联网 | provider 先验证 manifest 与 payload 摘要，按 eval 物化最小 evidence pack 到每个 gate 的 `inputs/`；host adapter 禁用/审计 live 工具后才放行 |
| B04 | 同一 eval 启动 with_skill、old_skill、without_skill | 只要求同批，不验证外部证据是否一致 | 三个 gate 必须拿到相同 `evidence_digest`；任一不同则整组 `BLOCKED`，不聚合 delta |
| B05 | replay 预检找不到 payload 或声明 query 没有 fixture | 可能在运行中临时真搜 | 起跑前判 `BLOCKED_EVIDENCE_UNAVAILABLE`；保持零 live 调用，不创建可误读的 benchmark 成绩 |
| B06 | replay 运行中 Agent 请求 manifest 未声明的 query/intent | prompt 可被忽略，miss 后可能直接联网 | 判 `REPLAY_QUERY_MISS`/`FAIL`；保留请求 intent 与 query 摘要供后续显式 record，不在当前轮 fallback |
| B07 | manifest 或 payload 摘要不匹配 | 当前无完整性门 | 判 `EVIDENCE_INTEGRITY_MISMATCH`/`FAIL`；不读入、不自动修复、不覆盖旧 epoch |
| B08 | 当前 host 不能禁用、代理或审计 WebSearch/外部网络 | 仍可凭 prompt 宣称“未联网” | official replay 判 `BLOCKED_NETWORK_ISOLATION_UNAVAILABLE`；可以另跑 exploratory，但不得进入主 benchmark/current_best |
| B09 | 显式 record/live，人工授权且预算充足 | 子代理可高并发自由搜索 | 逐 eval 串行；只允许声明的 provider 与调用上限；每次调用记账；输出先脱敏、裁剪、摘要，再生成新 evidence epoch |
| B10 | live 预算用尽、外部服务不可达或 9 月 10 日前不具备配额 | 容易以已有 fixture 或部分结果补齐 | 该 live AC 标 `BLOCKED`/`NOT_RUN`，不由 replay 绿替代；已取得的部分只作未完成 record 草稿，不晋级 epoch |
| B11 | replay 成功 | 只看到任务 pass rate/time/tokens | 额外记录 mode、provider、evidence/harness digest、epoch、hits/misses、live_calls、isolation；完成判据为 misses=0、live_calls=0、isolation=verified、各 gate digest 一致 |
| B12 | evidence/harness digest 改变后再次聚合 | 可能继续与上一轮直接算 won/lost/tie | 开启新可比纪元；跨纪元标 `incomparable`，current_best 在新纪元重置，不制造 lost |
| B13 | 发布 `.skill` | 评测六件套随包；大 payload 若放技能根会误入包 | 包只携带 `output-evals.json` 中的 manifest/digest；仓库中的 `eval-fixtures/` 最小 evidence pack 明确排除出 `.skill` |
| B14 | shopping-deep-research 真实用户调研 | 真实联网并要求当前在售、价格、来源日期 | 保持原样；fixture 只用于 eval harness，不进入生产 SKILL.md，也不降低真实购买调研广度 |
| B15 | Creator 创建或改进任何 Agent 消费的 skill 文档 | 本地 `references/writing-guide.md` 提供通用写法，流程没有要求把文档风险变成待验证假设 | Creator 只读取自己包内经 pruning 后的本地 writing guide，逐项判断 pointer、信息层级/co-location、完成判据、sprawl/no-op 等是否构成真实风险；只把命中的风险写成 `quality_hypotheses`，未命中项不凑数 |
| B16 | 写作/结构审查完成 | checklist 或 quick-validate 绿容易被误当成“文档质量已证明” | 静态审查只产 `finding | not_applicable` 与建议；每个 finding 必须绑定预期行为、相关 AC/断言和验证 gate，不能单独产生质量 PASS |
| B17 | 为新 skill 或改进 skill 设计输出 eval | 新建常跑 with/without，改进常跑 with/old/without；gate 可选但没有假设覆盖要求 | 新建至少保留 with/without；改进至少保留 with/old；是否加 without 或 `with_skill_no_refs` 等消融由假设决定。每个高风险假设都必须被至少一个断言与一个对照覆盖 |
| B18 | 被测行为有明显随机性或曾出现“旧版偶发也能做对” | 单 run 可能把模型自发行为当成 skill 的结构保证 | `stability_runs` 由题目声明；行为/方差敏感假设默认每 gate 3 runs，确定性 script 断言可为 1。样本不足不猜稳定性，quality verdict 为 `INCONCLUSIVE` |
| B19 | 聚合结果绝对 pass_rate 很高，但 with 与 old/without 平手或更差 | history 仍展示高分，评审人可能自行理解成“技能好用” | run 判罚与质量裁决分离：满足断言且有稳定、可比的假设增益才是 `SUPPORTED`；全平/样本不足/无区分度为 `INCONCLUSIVE`；关键断言或已声明成本预算回归为 `REGRESSED`；证据不可用为 `BLOCKED` |
| B20 | 修改 reference pointer、拆分层级或报告完成判据 | 只能比较整份 skill，新旧差异的因果解释弱 | 允许按假设增加定向消融 gate，例如 reference/pointer 假设用 `with_skill_no_refs`；消融不是每轮固定套餐，也不得把 harness 私有答案写进用户 prompt |
| B21 | viewer/history 展示一次迭代 | Benchmark 主要显示 pass/time/token 与 won/lost/tie | 首屏在 Evidence gate 旁显示 Quality claim：假设覆盖、runs、关键差异、成本预算、`quality_verdict` 与不能推出的声明；旧历史显示 `unassessed`，不回填 |
| B22 | 把 parking-skill-creator `.skill` 单包复制到未安装 writing-for-agents 的宿主 | 旧候选曾打算运行时读取另一个 skill | 创建、校验、评测、viewer 与打包全链继续可用；package、SKILL pointer、脚本 import 和 eval 前置均不得引用 writing-for-agents |
| B23 | 增加 evidence/quality 规则后检查上下文 | 现有软约束只要求 SKILL.md <500 行，允许本轮继续膨胀或把内容搬进 reference | 双零增长门：`SKILL.md` ≤31,415 UTF-8 bytes 且 ≤312 行；创建/改写分支 `SKILL.md + references/writing-guide.md` ≤40,364 bytes 且 ≤475 行；任一新增内容必须以 pruning 抵消 |

## 边界值

| 边界 | 改后结果 |
| --- | --- |
| queries 为空但声明 `mode: replay` | 用法错，拒绝发布 eval 定义；空 replay 不能证明任何外部证据能力 |
| 多个 query 归一化后同 key、payload 不同 | manifest 校验失败，要求显式拆 intent id 或裁决 canonical payload |
| evidence pack 存在但包含 session id、token-like 字段或绝对用户路径 | 脱敏门失败，不生成可持久 epoch |
| gate 运行产物为空 | 沿用现有执行臂故障语义，不归因于技能，也不写成功审计 |
| legacy eval 无 `evidence` | 行为保持旧路径并标 `mode: unmanaged`；不声称 zero-live 或 evidence 可复现 |
| live 完成但新 payload 与旧 digest 相同 | 记录一次 live acceptance，不强开新 evidence epoch；captured_at/来源可作为审计事件保留 |
| 简单技能没有命中任何 Agent 文档风险 | `quality_hypotheses=[]`，记录审查理由；不为过门而制造 pointer/leading word/消融 gate |
| 所有 gate 都 100% 且逐断言完全相同 | run 可以 PASS；质量 verdict 为 `INCONCLUSIVE`，下一安全动作是增强题面/断言或换能显露差异的模型，不是继续堆规则 |
| with_skill 比 without_skill 好，但比 old_skill 无提升 | 新建场景可支持“技能有用”；改进场景仍为 `INCONCLUSIVE`，不能宣称本次改进有效 |
| with_skill 关键断言更好但 token/time 超预算 | 按 metadata 的 `cost_budget` 判 `REGRESSED` 或要求用户显式接受取舍；不隐藏成本 |
| quality 假设/断言/题库发生实质变化 | `harness_digest` 改变并开启新纪元；新题不能回写成旧技能退步或进步 |
| 宿主没有安装 writing-for-agents | Creator 行为与验证结果不变；若任一路径尝试读取它，独立性门直接 FAIL |
| bytes 过线但行数未过，或行数过线但 bytes 未过 | 任一维度超限都 FAIL；不得用压成超长单行或换更多短行规避预算 |

## 不变清单

- 用户任务 `prompt` 仍是原话；不混入 fixture、grader、答案或 harness 私有说明。
- with_skill/old_skill/without_skill 的任务、断言和同批公平纪律保持。
- 触发评测、quick-validate、技能结构、grader 判罚哲学不因本次改动改变。
- `.agents/evals/<skill>-workspace/` 继续是 scratch；submission、输出、临时物化包仍可清理。
- `history.json` 继续 append-only；旧记录不回改，缺失值不伪造为 0。
- `shopping-deep-research` 的生产证据分级、当前在售与实时价格口径保持。
- 真实 Agent/live 证据不能由本地 fixture 或单元测试冒充。
- 本次只迁移 shopping pilot，不批量修改其他联网技能。
- `writing-for-agents` 只保留为本轮设计来源，不进入 Creator 产品依赖；运行时唯一 writing 参考是 Creator 已有的本地 `references/writing-guide.md`。
- quick-validate、181 项机械回归和静态结构审查继续证明各自声明的机械性质，但不改名为“技能好用证明”。
- 不新增第二个 writing reference 或第二条常驻 pointer；本地 guide 的新增机制必须先删除 no-op、重复或环境可查的缓存内容。

## 配置差异

| 字段/位置 | 现在 | 改后 | 迁移 |
| --- | --- | --- | --- |
| `eval_metadata.json.evidence` | 不存在 | 可选对象：`mode/provider/manifest/manifest_sha256/epoch/miss_policy/live_policy` | 老 metadata 无需改，按 `unmanaged` 兼容 |
| `output-evals.json.evals[].evidence` | 聚合器丢弃未知字段 | 与 metadata 同形持久化 | 只对显式 opt-in eval 写入 |
| `<skill>/eval-fixtures/` | 无约定 | 可选、仓库跟踪、按 eval/epoch 分目录的最小脱敏 pack | shopping pilot 首建；package 明确排除 |
| run `inputs/evidence-pack/` | 无约定 | provider 从持久 pack 只读物化；各 gate digest 相同 | scratch，run 完成后可清理 |
| benchmark/history evidence 审计 | 无 | mode/digest/epoch/hits/misses/live_calls/isolation | 老记录缺字段显示 `unmanaged/unknown`，不补造 |
| `eval_metadata.json.quality_hypotheses` | 不存在 | 可选数组：`id/lever/risk/expected_behavior/assertions/gates` | 老 metadata 无需改，显示 `unassessed` |
| `eval_metadata.json.quality_policy` | 不存在 | 可选对象：`stability_runs/cost_budget/required_comparators` | 新建/改进使用 Creator 默认建议，用户可按题裁决 |
| benchmark/history `quality_verdict` | 不存在 | `SUPPORTED | INCONCLUSIVE | REGRESSED | BLOCKED | unassessed` + reasons | 旧记录只显示 `unassessed`，不回算 |
| 独立写作内核 | Creator 已有 `references/writing-guide.md`；本轮分析参考过 writing-for-agents | 只把经案例验证的最小机制压缩进本地 guide；Creator 不读取/调用/要求安装其他 skill | 不新增文件；去重与 pruning 后维持双零增长预算 |
| 上下文预算 | SKILL.md 31,415 bytes/312 行；创建分支合计 40,364 bytes/475 行 | 两组数同时成为 hard max，run-tests 自动断言 | 以 2026-08-30 当前 checkout 为 baseline，不随实现重算放宽 |

## 状态与声明

| mode | 外部调用 | 能支持的声明 | 不能支持的声明 |
| --- | --- | --- | --- |
| `replay` | 必须 0 | 固定证据下的分析、遵循技能、gate 公平回归 | query 规划、实时可达性、当前价格/在售 |
| `record` | 显式、串行、有上限 | 建立/刷新证据 epoch 与来源审计 | 技能 pass rate；record 本身不是评分轮 |
| `live` | 显式、串行、有上限 | 真实 query 规划、工具链、新鲜度与来源可达性 | 与 replay 分数直接连续比较 |
| `unmanaged` | 沿用旧行为 | 旧 eval 的兼容结果 | zero-live、固定 evidence、跨机可复现 |

## 质量 verdict 与声明

| quality verdict | 最低条件 | 可以声称 | 下一安全动作 |
| --- | --- | --- | --- |
| `SUPPORTED` | 所有高风险假设有断言与对照覆盖；需要的 runs 足量；evidence/harness 可比；关键结果优于相关基线或达到已声明非劣目标；成本未越预算 | 本轮定义的具体质量假设得到支持 | 保留证据并进入发布/下一迭代 |
| `INCONCLUSIVE` | 全平、样本不足、断言无区分度、缺相关 comparator，或只能证明绝对通过 | 只能声称各 run 的原始结果 | 改题面/断言/消融或补 runs；不要先改 skill 迎合噪声 |
| `REGRESSED` | 关键断言相对 old/without 退步，或已声明成本预算被突破且未获接受 | 本次候选不应晋级 | 回滚候选设计或重新说明取舍并开新假设 |
| `BLOCKED` | evidence、host isolation、必须的 gate 或 grader 前置不可用 | 尚未得到质量结论 | 修复前置后重跑同一 contract |
| `unassessed` | legacy 记录无质量 schema | 只展示历史原始分数 | 首次 opt-in 时开新质量纪元 |
