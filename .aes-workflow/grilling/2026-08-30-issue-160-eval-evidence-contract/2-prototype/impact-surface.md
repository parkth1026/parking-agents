# Impact Surface: Creator 外部可变证据评测与持续质量门

> 改完之后，parking-skill-creator 同时回答两个问题：本轮 gate 是否拿到相同且可审计的外部证据，以及这次 skill 文档设计是否被行为证据支持。`shopping-deep-research` 的生产行为不变，只迁移评测证据面。`writing-for-agents` 仅是本轮设计调研来源；交付后的 Creator 独立安装、打包和运行，只使用自己已有的本地 `references/writing-guide.md`。

| 影响面 | 有/无 | 具体差异 | 谁会看见或受影响 | 对照物 |
| --- | --- | --- | --- | --- |
| 用户可见界面 | 有 | eval viewer/静态 review 首屏增加 Evidence gate 与 Quality claim：前者显示 mode/epoch/digest/hits/misses/live calls/isolation，后者显示质量假设覆盖、稳定性、差异价值、成本和 verdict | 技能作者、评审人、发布验收人 | `mock.html` |
| 可观察行为 | 有 | Creator 先用本地 writing guide 做 Agent 文档质量假设与外部依赖双分诊；replay 预检并失败关闭；各 gate 同 evidence digest；按假设选择 old/without/定向消融 gate 与重复次数；高分但无增益时不宣告好用 | 技能作者、执行 Agent、grader、聚合器 | `behavior.md` |
| 可运行输出 | 有 | 新增 quality plan、materialize/preflight/record 与 quality verdict 示例；终端/benchmark 明示 PASS/FAIL/BLOCKED/NOT_RUN 及 SUPPORTED/INCONCLUSIVE/REGRESSED | 本地开发者、自动门禁、审计者 | `example-run.md` |
| 对外接口报文 | 有 | `eval_metadata.json`、`output-evals.json` 增加 `quality_hypotheses` 与 evidence；manifest、benchmark/history、quality verdict 与错误报文扩 schema | Creator 脚本、viewer、后续 clone、第三方解析脚本 | `api-mock.md` |
| 用户配置 | 有 | 每题可声明质量假设、相关 gate、stability runs、cost budget；外部证据 eval 另声明 mode/manifest/miss/provider/live policy；旧 metadata 可都不声明 | 技能作者、评测运行者 | `behavior.md` 配置差异节、`api-mock.md` |
| 历史兼容性 | 有 | 旧 metadata 继续运行；旧 evidence 标 unmanaged，旧 quality 标 unassessed；不回写历史。evidence/harness/题库变化开启新纪元，跨纪元不比较 | 全部既有技能、历史 viewer、包消费者 | `behavior.md` 不变清单 |
| 架构与依赖 | 有 | Creator 不新增外部 skill 依赖，质量机制压缩进已有本地 writing guide；增加通用 evidence contract/provider 与 host isolation adapter；payload 和质量 harness 都不进入生产技能运行路径 | Creator 维护者、host adapter 实现者、所有被创建/改进技能 | `diagram.html` |

## 初步对照物集合

- `behavior.md`：状态、边界值、兼容与配置差异。
- `api-mock.md`：eval 定义、manifest、运行审计与错误结构。
- `example-run.md`：replay 成功、miss、host 不可隔离、受控 live 四类运行形态。
- `mock.html`：Evidence 卡及跨 gate 一致性呈现。
- `diagram.html`：改后架构与 record/replay/live 流程。
- `evidence-audit.md`：steelman 的仓库证据、反方论据、crux 与三层修改裁决。

## 已锁定的原型裁决

1. Evidence gate 放在 viewer Benchmark 首屏。
2. replay 前置不可用判 `BLOCKED`；运行中的 query miss/integrity mismatch 判 `FAIL`。
3. host 不能机械禁用或审计 live 工具时，official replay 必须 `BLOCKED`；只允许不计主成绩的 exploratory。
4. freshness policy 由每个 eval/entry 声明；未声明时只人工触发，不猜全局天数。
5. `writing-for-agents` 只作为本轮设计证据，不成为产品依赖；必要机制经 pruning 压缩进 Creator 已有本地 writing guide，不新增第二 reference/pointer，不以静态 checklist 单独判 PASS。
6. “持续好用”由三层共同负责：Creator 记录失败假设，目标技能只落相关文档杠杆，eval harness 用定向 gate、重复运行、差异价值、成本与 evidence epoch 裁决。
7. run 的 PASS/FAIL 与聚合的质量 verdict 分离；高分但无区分度时为 `INCONCLUSIVE`，明确回到改题/断言，而不是把规则继续堆进 SKILL.md。
8. Creator 上下文实行双零增长：常驻 `SKILL.md` 不超过 31,415 UTF-8 bytes/312 行；创建/改写分支的 `SKILL.md + references/writing-guide.md` 不超过 40,364 bytes/475 行。
