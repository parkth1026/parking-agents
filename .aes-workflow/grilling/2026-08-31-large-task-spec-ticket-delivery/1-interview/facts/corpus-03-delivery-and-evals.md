# Fact: 六例交付与验收语义样本

- 派遣问题：只读六个 grilling 案例，检验「总体 Spec + 阶段/票级独立验收」能补的缺口，以及不能用规格替代的执行与收口问题。
- 完成：2026-08-31
- 边界：未运行任何案例命令、未刷新远端 Issue、未把 `Ready`、历史 `PASS` 或结构 `valid` 解释为当前产品的最终运行成功。

## 查到的

| 案例 | 目标与复杂度证据 | 阶段、拆分与交接 | 验证与终态证据 | 对本轮假说的含义 |
| --- | --- | --- | --- | --- |
| `2026-08-28-aes-merge-worker-落地` | 原目标同时含 prose、血统、`depthTier`、review-return、close/outbox 和 live 验证；影响面判六面有变化。 | interview/prototype 已完成，但 3-contract 仍 pending，尚无正式 contract；11 条 AC 曾触发按「通用基建 vs 单一生产者」拆票。 | `validation: null`、整体 `in_progress`；仅有确认版对照物，不存在此目录的执行 receipt。 | 支持先有总范围、再拆隔离票；也证明早期 Spec 不能替代逐票契约与交付证据。 |
| `2026-08-28-issue70-loop-first-ruling` | 是投入排序裁决：先用混合三段证明真实闭环，再按命中证据建设硬化；不是可直接编码的单一功能。 | 只到 2-prototype，contract pending；它把 #94、#66、#35/#39 的依赖与先后关系显式化。 | 此案例目录没有 contract、verify 或 receipt；这只能说明本次材料没有交付证据，不能倒推出当前仓库没有 merge consumer 或真实宿主。 | 总体 Spec/决策能说明为什么分期和依赖；它仍不能单凭文字证明真实环境、成本样本或后续实现已经成立。 |
| `2026-08-28-outbox-close-解耦` | `close` 与 GitHub 出站副作用解耦；AC 分别覆盖 local close、flush、ack、gate 与真实解卡。 | 从 #126 的 11 条 AC 拆为独立通用 outbox 票，理由、边界及把完整 happy path 留给 #114 都记录在 context。 | 历史 `verify.txt` 记录 AC-001..004 四个 orchestration selftest PASS；AC-005 的真实解卡 `[C]` 明确未跑。不能把四项绿推成真实现场已验。 | 是「小而完整的基础票 + 后续真实/集成票」正例；独立验收不是零依赖，也不吞掉被拆走的 live 义务。 |
| `2026-08-29-aes-glab-skill改进` | 教程型技能同时要求安装/配置/使用面、输出 eval、逐条实测证据和历史沉淀，目标跨文档、评测和真实实例。 | 单一 contract 有 5 AC；范围明确保留旧三节并把使用面证据文件作为交付物。 | 历史 verify 记录当时 0 绿/3 红，且 [B]/[D] 未跑；它是实施前活验收线而非当前实现状态。manifest 的 `ready/valid` 只说明当时可交接。 | 长 Spec 能避免把「文档补字」误当全面技能质量，但执行、实测和非 A 档证据仍须在交付后收口。 |
| `2026-08-30-issue-160-eval-evidence-contract` | 把可变外部证据、replay/live、evidence digest、Creator 独立性和 shopping pilot 放入一个跨模块目标；6 AC 既含 deterministic gate 也含受控 live。 | `contract-criteria-r1.json` 是 3-contract 的六项验证深度候选；`contract-final-r2.json` 已把 live blocker 和 Creator 独立性收敛为最终确认稿，随后落 `contract.md`。 | 历史 `verify.txt` 记录 A 组、replay 与受控 live 均 PASS，并保留 `INCONCLUSIVE` 质量结论。当前源树也有对应的 evidence/replay/quality 模块、fixtures 和 `47df513` 关联提交；本调查未重新运行，故这支持“已进入源码并曾有历史收据”，不支持当前外部 provider 或 live 环境仍成功。 | 是总体规格把不同验收层、外部前置和诚实结论放在一个发布边界的强正例；provider、预算、实时来源和人工授权仍需每次按证据判定。 |
| `2026-08-30-psc-layout-regression-fix` | 两条布局不变量涉及分类目录、link、snapshot、shadow 检测、gitignore、文档及全量回归。 | 单 contract 的 6 AC 由行为/示例对照物锁定；对 #160 WIP 的先后依赖显式写入 next action。 | 历史 verify 是实施前基线：AC-005 全量既有 run-tests PASS，AC-001..004/006 RED；这恰是可 Ready 的活验收线，不是契约失败。 | 反例：单一、可测的回归修复不需要再加一份冗长总体 Spec；应先判定是否真有跨票范围、版本和依赖问题。 |

## 归纳（事实到推论）

1. **规格缺失可由总体 Spec 补强。** 前四例都显示：来源、跨票边界、保留/排除项和 live 义务若只散在对话或子票，会被错误地缩成局部实现。总体 Spec 应成为这些义务的稳定索引，而不是重新采访已锁定的故事。
2. **执行/收口不能靠总体 Spec 单独证明。** 例 70 的本地材料不含真实闭环收据；outbox 的本地历史记录未包含 AC-005 live 解卡；glab 的历史红线只反映当时待实现；#160 的 live 与授权是环境事实。这些都需要依赖图、能力/权限前检、逐 AC 证据和 aggregate completion，而不是增加 User Story 段落。
3. **`Ready` 可合法包含预期 RED 或未跑的人工档。** psc 与 glab 都是实施前的明确反例；因此新的发布门禁应区分 `ReadyForExecution` 和 `Complete`，不得要求 Ready 前全绿。
4. **阶段拆分本身不是遗漏。** merge-worker/outbox 将通用队列与单一消费者切开、live happy path 留给另票，是经过理由和用户裁决的依赖分解。需要补的是父级索引：哪些票、验证和外部前置共同构成总体完成。

## 可翻转事实

- 若总体目标可在一个新上下文窗口中完整表达、只有一个执行对象且无跨票/跨环境验收，则 psc 型单契约已足够，总体 Spec 只会重复。
- 若 story-level 发布包能锁定 revision、来源覆盖、票清单、blocked-by 和全部 required evidence，且执行器消费该索引，则总体 Spec 可成为防遗漏的有效交接面；没有这些机读关联则只是更长摘要。
- 若外部 live/人工验收被明确取消或替换，应把它标为获准排除；在此之前，任何子票 PASS 都不得替代该义务。

## 实际阅读清单

以下行号以本次快照的 corpus inventory 为准；完整读取了每例 `manifest.json`、`1-interview/context.md`、`rounds.jsonl`，及存在的根级正式 `3-contract` contract/verify。正式 prototype 的 impact/behavior/example/api 在与目标/验证相关时读取；draft、web submission 与远端状态未作为终态证据。

- merge-worker：`manifest.json:1-40`；`1-interview/context.md:1-48`；`rounds.jsonl:1-17`；`2-prototype/impact-surface.md:1-22`、`behavior.md:1-61`、`api-mock.md:1-241`、`example-run.md:1-200`。
- issue70：`manifest.json:1-33`；`1-interview/context.md:1-50`；`rounds.jsonl:1-7`。无 prototype/contract/verify 文件。
- outbox：`manifest.json:1-52`；`1-interview/context.md:1-69`；`rounds.jsonl:1-17`；`2-prototype/impact-surface.md:1-22`、`behavior.md:1-61`、`api-mock.md:1-241`、`example-run.md:1-200`；`3-contract/contract.md:1-218`；`3-contract/verify.txt:1-15`。
- aes-glab：`manifest.json:1-51`；`1-interview/context.md:1-66`；`rounds.jsonl:1-16`；`2-prototype/impact-surface.md:1-18`、`behavior.md:1-24`、`example-run.md:1-50`；`3-contract/contract.md:1-140`；`3-contract/verify.txt:1-9`。
- issue160：`manifest.json:1-57`；`1-interview/context.md:1-65`；`rounds.jsonl:1-35`；`2-prototype/impact-surface.md:1-27`、`behavior.md:1-87`、`api-mock.md:1-298`、`example-run.md:1-163`、`evidence-audit.md:1-37`；`3-contract/contract-criteria-r1.json:1-119`、`contract-final-r2.json:1-76`、`contract.md:1-241`、`verify.txt:1-22`。
- psc regression：`manifest.json:1-50`；`1-interview/context.md:1-59`；`rounds.jsonl:1-17`；`2-prototype/impact-surface.md:1-13`、`behavior.md:1-36`、`example-run.md:1-57`；`3-contract/contract.md:1-152`；`3-contract/verify.txt:1-26`。

## 未知项

- 各样本对应产品/技能在本次快照后的当前运行状态、远端 Issue 结论、真实 live 验收和最终集成状态均未复查。
- 没有对历史格式运行当前 validator；不同历史工作流的 `ready`/`valid` 不作横向完成结论。

## Issue #160 的有界当前源码关联

- 当前 `skills/workflow/parking-skill-creator/` 已存在本地 `references/evidence.md`、`scripts/lib/evidence.mjs`、`scripts/lib/quality.mjs`、`fixtures/external-evidence/` 及 `run-tests.mjs` 的 named external-evidence groups；静态源码可见 replay 的 `live_calls=0`、digest 一致性、record/live 授权/并发/预算阻断和 `SUPPORTED | INCONCLUSIVE | REGRESSED | BLOCKED` 判定。
- 路径限定的本地 `git log` 显示 `47df513 feat(eval): 以固定证据与受控 live pilot 完成技能质量链路 - #160`，随后 `47c82ac` 为 psc 布局修复。此为当前源码与 #160 案例存在提交关联的证据，不是对工作树当前测试结果或真实 Web provider 的重新验收。
- `contract-criteria-r1.json` 的早期候选仍写 shared writing-for-agents 真源；`contract-final-r2.json` 已改为 Creator 独立和“真实 live 前 Blocked”。这是版本化确认能够纠正方案的历史正例；执行器若不绑定最终 revision，仍会误读早期候选。
