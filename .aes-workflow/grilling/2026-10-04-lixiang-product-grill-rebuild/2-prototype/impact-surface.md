# 影响面扫描: 2026-10-04-lixiang-product-grill-rebuild

- 创建：2026-10-04T17:10+08:00
- 判据：改完之后，这个程序在哪些地方跑起来不一样了？每一处，谁会看见？

| 影响面 | 有/无 | 具体差异 | 谁受影响 | 对照物 |
| --- | --- | --- | --- | --- |
| 用户可见界面 | **无** | 本技能是 prompt 产物，无可执行 GUI。用户看见的是对话产物（复盘回合、报告），归入行为面与示例面呈现 | — | — |
| 可观察行为 | **有** | ①触发方式：语境触发→名字触发，不点名不再触发；②旧名 lixiang-ceo-grill 失效（点名不再有技能响应）；③复盘尺子：9 模块→14 维度×三模块，层间断点 4→5；④复盘各维度新增「读对应 wiki 页取弹药」动作；⑤报告矩阵 9 行→14 行；⑥开场范围菜单按三模块/十五挑战组织；⑦web-prompt.md 内容整体换代 | 用户（每次复盘体验、点名习惯）、ceo-copilot（邻域题库语义） | behavior.md |
| 可运行输出 | **有** | run-tests.mjs 断言组重写（含 wiki 结构组、附注护栏组）；validator v7.2 对新 wiki 出 PASS/FAIL 报告；触发与输出评测新增产物（trigger-evals/trigger-benchmark/output-evals 重写） | 维护者（用户）：改完是否绿、成绩如何沉淀 | example-run.md |
| 对外接口报文 | **无**（网络 API） | 无网络接口。仓内数据契约变化（五件套 JSON 的新增/重写、ceo-copilot trigger-evals 规范名字段）不是对外报文，写入 behavior.md 配置差异节 | repo evals 基建 | behavior.md 配置差异节 |
| 用户配置 | **有**（广义） | frontmatter name/description 换（触发模式=名字触发字款式）；用户级 symlink 路径换；agents/openai.yaml 不变 | 用户（装机拓扑、点名方式） | behavior.md 配置差异节 |
| 历史兼容性 | **有** | ceo-copilot run-tests 规范名集合与 trigger-evals 负例必须同步（不同步则其 run-tests 红）；npm test 的 test-skill-discovery 自动发现新名（已确认无测试硬编码旧名）；evals/lixiang-ceo-grill-workspace 历史产物保留不动（记录性）；web-prompt 使用者拿到新版；history.json 旧 run 保留、追加新 run（bank_epoch 2，新旧成绩不直接可比） | 用户、ceo-copilot 技能、全仓 npm test | behavior.md 不变清单+迁移 |
| 架构与依赖 | **有** | 新增 references/wiki/（sources×19/concepts/cases + SCHEMA/index/log）；新增原文存档层 references/archive/（19 篇全文，引用无限制裁定后可入仓）；运行时加载链新增 SKILL→wiki 每维度读取边；旧文章降为附注节点；validator 复用（只调用不改） | 技能自身结构、后续维护者 | diagram.html（overview+detail 两视图） |

## 七面判「无」的说明

- 界面无：对话产物已在行为/示例面具体化，单独 mock.html 只会复刻 behavior.md 的变化行，无增量信息。
- 报文无：无对外 API；数据文件结构变化属配置差异节，不在两处重复定义。

## 由此产出的对照物

- behavior.md（变化行 12 + 不变清单 + 配置差异）
- example-run.md（5 场景：run-tests / validator / 评测沉淀 / 开场回合样例 / 全仓回归不变）
- diagram.html（两视图：复盘运行时加载链 / 门禁与联动）
