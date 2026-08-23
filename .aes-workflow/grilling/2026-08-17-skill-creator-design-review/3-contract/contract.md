# Goal Contract: parking-skill-creator 生产线升级——设计自包含、gate 可选、结构审查与历史对比

- Status: Ready
- Target: 两仓 `.claude/skills/parking-skill-creator/`(SKILL.md、scripts/、eval-viewer/、run-tests.mjs),主仓 `G:\GIT\AI_WorkFlow\parking-agents`,dev 仓 `G:\GIT\AI_WorkFlow\parking-agents-dev`
- Updated: 2026-08-17

## 原始请求

> 1.每个被parking-skill-creator 创造出来的skill 应该自包含自己的设计思想，设计文档，   这个也是为了 eval 时候有依据 。  总的来说，从设计到验收都是有据可依的，而不是只看 skill.md，因为 skill.md 是需要经常迭代升级的
> 2.每个被parking-skill-creator 创造出来的技能要审查一下，看看技能本身的内容是否符合 workflow 的标准。
> 如果是原子能力通用的，然后像 workflow 一样去调度多个技能来达成的，这种应该建议用户去拆分。给用户一个建议，但不是由你自动去完成这件事   "G:\GIT\AI_WorkFlow_ref\mattpocock-skills\skills\engineering\grill-with-docs\SKILL.md" 与 "G:\GIT\AI_WorkFlow_ref\mattpocock-skills\skills\productivity\grilling\SKILL.md" 这个技能的关系是典型的例子
> 3.parking-skill-creator 审查功能  应该  包含  有技能跟没技能对比  还有跟历史跑的workspace 对比， 这样  迭代技能时候会比较完善。
> 这些问题你都仔细思考一下  然后 用 workflow-interview 方法 来获得  goal contract

> (Round1 追加裁决)Q7:我觉得应该问用户要跑哪种，不同情况 想要跑的形式不一样，不止是 with跟 without 两种情况，这个就是 技能的gate，那么 允许用户跑不同的gate  没毛病
> (AC 轮追加裁决)示范对象:新建一个小型真实技能走全流程

## 目标

被 parking-skill-creator 造出的技能自带从设计到验收的完整证据链:设计文档随技能自包含并可追溯断言、评测配置 gate 可选、评测循环产出结构审查(拆分)建议且只建议不执行、评测成绩沉淀为只追加的历史并可在评审页跨轮对比。

## Why

- SKILL.md 高频迭代,设计意图与验收依据无处固化,评测断言失去稳定锚点(R1)
- 技能越造越多,「原子能力+编排逻辑」混写的技能会互相抢触发,生产线上游缺分层建议(R2,样板:grill-with-docs 之于 grilling)
- 改进迭代无裸基线、无历史轨迹,「这次比上次好在哪」不可答(R3)

## 范围

做:①init 生成 `references/design.md` 四节骨架 + quick-validate 缺失警告 + 随包分发;②六步主线固化「断言引用 design 的 AC 编号」,eval_metadata 断言新增可选 `ac` 字段;③6.1 改 gate 问询制;④评测循环新增结构审查步(四信号 checklist);⑤aggregate 新增 `--history`,history.json 契约落地;⑥viewer 评审页新增历史轨迹区与建议卡片;⑦新建一个小型真实技能示范全流程(AC-006)。

不做:不自动执行任何拆分;不迁移/回填存量 23 个技能的 design.md(仅警告);不实现 comparison.json/analysis.json/metrics.json 等其余纸面契约;不引入 docs/eval-gates-best-practices.md 的 Gate Run 机制;不改 viewer 既有区块(Outputs/Benchmark/上轮折叠对照);不动 snapshot-skill / check-shadow-skills / 打包排除清单的既有行为。

## 强约束

- 拆分建议**只建议不执行**(用户原话裁定);建议仅落对话与被审技能 design.md 迭代记录两处
- history.json **只追加不覆盖**;损坏先备份 `.corrupt-<时间戳>` 再重建,不静默覆盖
- 存量技能零迁移:quick-validate 警告不挡退出码(0/1/2 语义不变);断言 `ac` 可选;不带 `--history` 的聚合输出与现在逐字节一致
- 评测循环写技能目录**仅**经 `--history` 显式参数一条通道,聚合默认不碰技能目录
- run-tests 既有 36 例断言不改写,新能力只增用例;两仓 parking-skill-creator 逐字节同步
- 确认版对照物(2-prototype/ 五份)不可修改,执行 Agent 改产品不改对照物

## 自主边界

不用问,直接定:
- SKILL.md 各新增段落措辞与节结构;四信号 checklist 的具体表述(语义对齐 behavior.md B4)
- history.json 字段命名与实现细节(结构以 api-mock.md 报文为准)
- run-tests 新用例组织;viewer 历史区 DOM/样式(结构对齐 mock.html 即可,不锁像素)
- design.md 模板的 TODO 引导文案;示范技能的选题与规模(小型、单意图、有真实用途)

必须停下来问:
- 动 history.json 已确认的报文结构(字段增删/语义变更)
- 引入新依赖或 scripts/ 之外的运行时要求
- 改 gate 默认建议组合的语义(仅措辞可自主)
- 把结构审查从「只建议」变成任何形式的自动动作

## 读什么

- `../2-prototype/behavior.md` — 9 条变化行/8 条不变清单/配置差异
- `../2-prototype/api-mock.md` — history.json 报文对与 design.md 结构契约、ac 字段
- `../2-prototype/example-run.md` — 六个场景的终端/对话实况
- `../2-prototype/mock.html` — viewer 新增两区的结构契约
- `../2-prototype/diagram.html` — 三处新数据流边(评测反向写技能目录仅 --history 一条)

## 要落盘的东西

- D-01: `<示范技能目录>/references/design.md`:四节完整填写(非骨架),验收条件表含 AC-N 编号且评测断言引用之
- D-02: `<示范技能目录>/history.json`:至少 2 条 runs,第 2 条含非空 vs_previous

## 验收条件

- AC-001: init 为新技能生成 `references/design.md` 四节骨架(意图与触发场景/设计取舍/验收条件 AC-N/迭代记录);quick-validate 对缺失者输出警告且退出码仍 0;design.md 与 history.json 随 .skill 包分发
  - Verify: [A] `grep -q "design.md" "G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\parking-skill-creator\scripts\init-skill.mjs" && node "G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\parking-skill-creator\run-tests.mjs"` → 退出码 0(探针现在红:init 尚不生成;run-tests 须含新断言并全过)
- AC-002: SKILL.md 六步主线写明「断言引用 design 的 AC 编号」;eval_metadata 断言可选 `ac` 字段,带与不带均被流程接受
  - Verify: [D] SKILL.md 相应段落内容检查 + [A] `grep -q "AC-" "G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\parking-skill-creator\SKILL.md"` → 退出码 0
- AC-003: 6.1 改为起跑前问用户 gate 集(默认组合:新建=with_skill+without_skill,改进=with_skill+old_skill+without_skill,仅建议可增删);聚合器对任意自定义 gate 目录名正常聚合
  - Verify: [A] `grep -q "跑哪些 gate" "G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\parking-skill-creator\SKILL.md"` → 退出码 0;run-tests 含自定义 gate 名聚合断言
- AC-004: 评测循环 6.4 后新增结构审查步:四信号 checklist(原子可复用/多类不相干意图/编排内嵌/near-miss 集中)+ grill-with-docs↔grilling 样板引用固化进 SKILL.md;建议只落对话与 design 迭代记录,不执行拆分
  - Verify: [D] SKILL.md checklist 段内容检查 + [C] 示范中观察建议产出且未执行
- AC-005: aggregate 支持 `--history <技能目录>`:追加式写入 history.json(won/lost/tie 按同 eval 名匹配、current_best 平局不推进、上轮有本轮无标 dropped、损坏备份重建、无参数时行为不变);viewer 评审页新增历史轨迹区与结构审查建议卡片
  - Verify: [A] `grep -q "history" "G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\parking-skill-creator\scripts\aggregate-benchmark.mjs"` → 退出码 0;run-tests 含 history 契约边界断言(首轮/次轮/防抖/dropped/损坏/无参数不变) + [C] viewer 对照 mock.html 结构核验
- AC-006: 新建一个小型真实技能示范全流程:init→design 四节真实填写→gate 问询→真实评测(含断言 ac 引用)→结构审查产出→--history 沉淀→viewer 历史区可见;D-01/D-02 落盘
  - Verify: [C] 示范全程可复现操作,用户观察四个新能力(设计文档/gate 问询/审查建议/历史轨迹)全部真实出现

## 挡着的事

- None.

## 残留风险

- 无被跳过阶段与喊停项;三阶段全程走完,默认区条目均已落盘可翻。

## 访谈记录

### 第 1 轮(Round1,需求)

| 问题 | 候选(带当时给的百分比) | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| Q1 设计文档位置 | A references/design.md 随包 60% / B docs/ 25% / C 双文件 15% | A | A |
| Q2 必含节 | A 五节 55% / B 精简三节 30% / C 仅验收 15% | A | **B**(翻了推荐) |
| Q3 拆分建议机制 | A 评测循环内审查步 55% / B 启发式 15% / C 双层 30% | A | A |
| Q4 判据形态 | A checklist 60% / B 样板留白 40% | A | A |
| Q5 历史对比边界 | A 两者 50% / B 仅跨 workspace 30% / C 仅趋势 20% | A | A |
| Q6 成绩沉淀 | A workspace+摘要 45% / B 仅 workspace 20% / C history 进包 35% | A | **A+C 组合** |
| Q7 改进型评测配置 | A 三配置 60% / B with vs old 25% / C 首轮三配置 15% | A | **自定义:gate 可选制**(翻了推荐;用户原话见原始请求) |
| Q8 验收含示范 | A 完整 45% / B 半程 40% / C 不含 15% | A | A |
| Q9 建议落点 | A 对话+design 55% / B notes 20% / C 三处 25% | A | A |

### 第 2 轮(Round2,收口默认区)

| 定了什么 | 档 | 为什么这么定 | 用户 |
| --- | --- | --- | --- |
| design.md 四节(三节+迭代记录调和) | 默认 | Q2-B 与 Q6-A 唯一无矛盾形态 | 未反对 |
| gate 问询制+默认组合仅建议 | 默认 | 用户 Q7 原话裁定 | 未反对 |
| gate=评测配置,不接 Gate Run 机制 | 默认 | 与 eval-gates 研究线撞名,先划清 | 未反对 |

### 对照物轮

五份 v1(behavior/api-mock/example-run/mock/diagram)用户零修改通过(「好的 通过」)。

### AC 轮

| 问题 | 候选 | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| AC-006 示范对象 | A feishu-doc-qa 55% / B 新建技能 30% / C 主仓存量 15% | A(历史 workspace 可验跨 workspace 对比) | **B**(翻了推荐;代价:AC-005 跨 workspace 面转沙箱验证,已明示并接受) |

| 定了什么 | 档 | 为什么 | 用户 |
| --- | --- | --- | --- |
| viewer 验证=结构对照不锁像素 | 默认 | aes-prototype 惯例 | 未反对 |
| ac 字段校验限格式不校验引用真实性 | 默认 | 成本不成比例 | 未反对 |

## 设计取舍

### D-1 历史对比实现落点

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 扩展 aggregate-benchmark + 落地 history.json | 聚合器加 --history,纯函数已 export,扩展面小 | 聚合器多一条职责 | — |
| B 新独立脚本 history.mjs | 单独追加器 | 多一个脚本、聚合与追加两步易失同步 | 拆开收益低 |
| C 只扩 viewer 读旧 benchmark | 不落新契约 | 跨 workspace 匹配脆弱,无 won/lost/tie 语义 | 验不了 R3 |

选定 A。理由:数据只在聚合时齐备,追加与聚合同点写入天然一致;history.json 纸面契约本为此设计。
落进契约的形态:`强约束` 写「评测写技能目录仅经 --history 一条通道;history.json 只追加」。

### D-2 成绩沉淀位置(用户 A+C 组合)

| 方案 | 代价 | 为什么 |
| --- | --- | --- |
| 仅 workspace | clean 即丢(已发生过) | 否 |
| workspace 全量 + design 迭代记录摘要 + history.json 数据进技能 | 技能目录每次评测有 git 变更 | 选定:摘要给人看、数据给工具吃,双轨各司其职 |
