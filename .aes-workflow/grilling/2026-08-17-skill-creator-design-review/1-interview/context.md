# Context Snapshot: 2026-08-17-skill-creator-design-review

- 创建：2026-08-17T16:30:00+08:00
- 分片来源：facts/eval对比能力现状.md、facts/设计文档先例与拆分样板.md

## 任务陈述

（用户原话，三条）

1. 每个被 parking-skill-creator 创造出来的 skill 应该自包含自己的设计思想，设计文档，这个也是为了 eval 时候有依据。总的来说，从设计到验收都是有据可依的，而不是只看 skill.md，因为 skill.md 是需要经常迭代升级的
2. 每个被 parking-skill-creator 创造出来的技能要审查一下，看看技能本身的内容是否符合 workflow 的标准。如果是原子能力通用的，然后像 workflow 一样去调度多个技能来达成的，这种应该建议用户去拆分。给用户一个建议，但不是由你自动去完成这件事。「G:\GIT\AI_WorkFlow_ref\mattpocock-skills\skills\engineering\grill-with-docs\SKILL.md」与「G:\GIT\AI_WorkFlow_ref\mattpocock-skills\skills\productivity\grilling\SKILL.md」这个技能的关系是典型的例子
3. parking-skill-creator 审查功能应该包含有技能跟没技能对比，还有跟历史跑的 workspace 对比，这样迭代技能时候会比较完善。

这些问题你都仔细思考一下，然后用 workflow-interview 方法来获得 goal contract。

## 用户提出的方案

- 走 workflow-interview 三阶段（本目录），产出 goal contract 后再实施。
- 拆分判断以 mattpocock 的 grill-with-docs（薄编排层，1 行调度 /grilling + /domain-modeling）与 grilling（原子能力）的关系为样板。
- 拆分只给建议，不自动执行（用户原话）。

## 意图假设

用户要的不是三个孤立功能，而是把 parking-skill-creator 从「能造技能」升级为「造出的技能自带可追溯的质量证据链」：设计期意图固化（design 文档）→ 结构审查（原子/编排分层）→ 评测期完整对照（有无技能 + 历史轨迹）。深层动机：SKILL.md 高频迭代导致「当初为什么这么设计、验收依据是什么」不可考，评测断言失去稳定锚点；技能越造越多后，职责混杂的技能（原子能力+编排逻辑混写）会互相抢触发，需要在生产线上游就给出分层建议。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| with/without 对照全链路已齐（并行 run、grading、聚合 delta、viewer delta 表） | facts/eval对比能力现状.md；SKILL.md:104-124 | Fact |
| 改进既有技能时只跑 with vs old_skill，不跑 without_skill（裸基线缺席） | SKILL.md 6.1 | Fact |
| viewer --previous-workspace 实为「上一轮 iteration 目录」，不校验同 workspace；匹配键 eval/config/run 精确字符串，错位静默丢；只有产物+留言对照，无 benchmark 对照 | generate-review.mjs:30,106-123；viewer.html:782,978 | Fact |
| 聚合器严格单 iteration；benchmark.json 无跨轮趋势字段；全仓 grep trend 零命中 | aggregate-benchmark.mjs:44-96,136-144 | Fact |
| schemas.md 12 契约中 5 个纸面未实现；history.json（版本推进+won/lost/tie+current_best）正是跨版本趋势契约，零实现 | references/schemas.md | Fact |
| 触发评测的 rounds 分轮对比（按 description 分轮、按 test 分数选优）是仓内已验证的历史轮对比范式 | aggregate-trigger.mjs:102-191 | Fact |
| 评测成绩完全不沉淀在技能自身：benchmark/feedback 全在 workspace（且被 gitignore），包里只有 run-tests.mjs（用例，非成绩） | package-skill.mjs:15；.claude/.gitignore:1 | Fact |
| 技能本体无 design.md 先例；真实先例是 workspace 里的评测报告/修订说明（含「违规→修订动作→落点」三列、v2/v1 对照链），但本地留存不随 git/包分发 | facts/设计文档先例与拆分样板.md | Fact |
| mattpocock 仓共 8 对「薄编排层调度原子技能」样板；编排层普遍 disable-model-invocation: true；ask-matt 有原语/编排者显式分层陈述 | facts/设计文档先例与拆分样板.md | Fact |
| 本仓被提名的混杂候选（只提名未裁决）：parking-skill-creator 自身（290 行混方法论+评测+触发+打包）、ue-error-solver、workflow-interview 家族反向耦合；正对照：workflow-interview 纯编排声明 | 同上 | Fact |

## 验证基建候选池

- run-tests.mjs 黑盒回归（36 例，技能根，git 跟管）— 扩新脚本时同步扩用例，代价低
- quick-validate / check-shadow-skills / snapshot-skill 均有黑盒覆盖路径
- e2e 沙箱演练范式已验证（subagent 完整走 init→快照→评测落盘→聚合→打包→影子检测）
- 真实技能示范（用一个真技能走全流程）— 代价：一轮完整 eval 循环的 spawn 成本与用户时间
- 仓库无 CI；验证全靠本地 run-tests + 示范

## 术语冲突

- 「workflow 的标准」：用户指 mattpocock 式「编排层调度原子技能」的分层标准；仓库 init 脚手架里 `--structure workflow` 指「工作流型文档结构」。本契约全文取前者，访谈中需确认。
- 「设计文档」：用户指技能自包含的设计思想载体；仓内现有「评测报告/修订说明」在 workspace（被 ignore）。两者将并存，需划清谁是验收依据。

## 四分类

- **Fact**：现状能力清单（上表全部）
- **User decision**：design 文档落点与是否随包；内容 schema；拆分建议产生机制与判据形态；历史对比范围与成绩沉淀位置；改进型迭代是否强制三配置；验收是否含真实示范
- **Agent-owned**：具体文案、脚本实现方式、viewer 展示细节、测试用例组织
- **Blocked**：无

## 决定边界未知项

- 「跟历史跑的 workspace 对比」的边界：跨 workspace（新一轮 vs 上次评测活动）还是含同 workspace 跨 iteration 趋势，还是两者——进提问
- 拆分建议的产出位置（对话提醒 / design 文档 / benchmark notes）——部分进提问

## 未知项

- 无跨仓库边界的硬未知；用户时间预算（示范跑不跑完整 eval）需问
