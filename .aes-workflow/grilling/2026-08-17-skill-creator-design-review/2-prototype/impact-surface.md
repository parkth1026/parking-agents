# Impact Surface: 2026-08-17-skill-creator-design-review

- 创建：2026-08-17T17:20:00+08:00
- 上游：1-interview/context.md、rounds.jsonl（Round1 答案 + Round2 默认区 3 条）

> 判据：改完之后，这个程序在哪些地方跑起来不一样了？每一处不一样，谁会看见、谁会受影响？

## 七面扫描

| 影响面 | 判 | 具体差异 | 谁受影响 | 对照物 |
| --- | --- | --- | --- | --- |
| 用户可见界面 | **有** | viewer 评审页新增「历史轨迹」区（历次评测 pass_rate/token/time + 与上轮 won/lost/tie）与拆分建议展示位；现有页其余不动 | 评审技能的用户 | `mock.html` |
| 可观察行为 | **有** | ①init 生成 references/design.md 四节骨架 ②quick-validate 对缺 design.md 技能给警告 ③6.1 起跑前问用户 gate 集（不再固定 with/without）④评测循环新增结构审查步（拆分建议只建议不执行）⑤aggregate 支持 --history 追加技能目录 history.json ⑥design.md「迭代记录」节每轮沉淀一句 | 造技能/评技能的用户；两仓 23 个存量技能（仅警告面） | `behavior.md` |
| 可运行输出 | **有** | init 多一行产出日志；quick-validate 多警告行；aggregate --history 多趋势输出与 history.json 写入日志；打包日志多 design.md/history.json 条目 | 终端用户 | `example-run.md` |
| 对外接口报文 | **有** | ①新数据契约 history.json 落地（纸面契约实现化，含 won/lost/tie）②design.md 结构约定（四节+验收条件编号 AC-N）③eval_metadata.json 断言新增可选字段 ac（引用 AC 编号，建立设计→验收追溯链） | 消费 .skill 包的下游；eval-viewer/aggregate 读 history.json | `api-mock.md` |
| 用户配置 | **有（轻）** | 无配置文件/环境变量变化；新增运行时选择「gate 集」（对话内问询，非持久配置）；aggregate 新可选 CLI 参数 --history | 跑评测的用户 | `behavior.md` 配置差异节 |
| 历史兼容性 | **有（以不变为主）** | 存量技能无 design.md → 仅警告不挡；现有 workspace 布局/聚合单 iteration 用法必须原样可跑；36 例 run-tests 不破坏；.skill 包消费者看到新增文件（design.md/history.json 随包） | 两仓存量技能、包消费者 | `behavior.md` 不变清单 |
| 架构与依赖 | **有** | 新增数据流边：workspace 评测数据 → 技能目录 history.json（评测反向写技能目录，历史上首次）；design.md → eval 断言（追溯边）；结构审查步 → design.md 迭代记录（回写边） | 技能生产线的数据流拓扑 | `diagram.html` |

## 对照物清单

- drafts/v1-behavior.md（行为对照表：变化行/不变清单/配置差异）
- drafts/v1-api-mock.md（history.json 报文对 + design.md 结构 + ac 字段约定）
- drafts/v1-example-run.md（终端与对话示例：init/校验/gate 问询/聚合/打包）
- drafts/v1-mock.html（viewer 历史轨迹区 + 拆分建议展示 mock）
- drafts/v1-diagram.html（架构视图：改后态 + 新数据流边标注）
