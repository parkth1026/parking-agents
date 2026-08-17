<!-- draft v1 | published 2026-08-17T17:30:00+08:00
     用户意见：好的·通过(全文无修改,2026-08-17)
     状态：confirmed -->

# 行为对照表: 2026-08-17-skill-creator-design-review

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| B1 | `init-skill.mjs demo-flow --structure task` | 产出 SKILL.md + run-tests.mjs + 资源目录 README | 多产出 `references/design.md` 四节骨架（意图与触发场景/设计取舍/验收条件 AC 编号/迭代记录），stdout 多一行 `references/design.md  (设计文档骨架,验收条件编号 AC-N,eval 断言引用 ac 字段)` |
| B2 | quick-validate 跑一个没有 design.md 的技能 | PASS（可能有 run-tests 警告） | PASS + 警告行 `警告: 无 references/design.md——设计依据不可考(新技能必须,老技能升级时补)`；退出码仍 0 |
| B3 | 评测起跑（6.1），新建技能场景 | 固定 spawn with_skill + without_skill 两组 | 起跑前先问用户「这轮跑哪些 gate？」，给默认组合：新建=with_skill+without_skill；改进=with_skill+old_skill+without_skill；用户可增删/自定义 gate 名（gate 名=配置目录名，聚合器动态发现） |
| B4 | 评测循环 6.4 聚合完成后 | 直接进 6.5 起评审页 | 插入**结构审查步**：agent 按 SKILL.md 的拆分 checklist（可复用原子能力/多类不相干意图/编排逻辑内嵌/触发评测 near-miss 集中）逐条判，产出「拆分建议」——**只建议不执行**，落两处：对话告知用户 + design.md 迭代记录节追加一行 |
| B5 | `aggregate-benchmark.mjs <iter> --skill-name X --history <技能目录>` | --history 参数不存在；成绩只落 workspace | 聚合照旧产出 benchmark.json/md，另把本轮各 gate 指标追加进 `<技能目录>/history.json`，与上一轮逐 eval 比 won/lost/tie，stdout 多趋势摘要 3 行 |
| B6 | 每轮迭代收尾（6.6 改进后） | 改进只进 SKILL.md，无留痕 | design.md「迭代记录」节追加一行：日期 / 改了什么一句 / 本轮 vs 上轮 won/lost/tie / 拆分建议结论（如有） |
| B7 | viewer 评审页 | 只有本轮 iteration 数据 + 上轮产物/留言折叠对照 | 顶部新增「历史轨迹」折叠区：读技能目录 history.json，展示历次评测 pass_rate/token/time 表 + 本轮 vs 上轮 won/lost/tie；有拆分建议时在 Benchmark 页上方展示建议卡片（含「仅建议，未执行」标记） |
| B8 | 边界：history.json 不存在时 | （机制不存在） | B5 不带 --history 时行为与现在逐字节一致；B7 读不到 history.json 时历史区显示「无历史轨迹（首次评测）」，不报错 |
| B9 | 边界：老技能首次带 --history | — | history.json 不存在则创建，won/lost/tie 全空（无上轮可比），current_best=本轮 |

## 不变清单

| 现有行为 | 谁在依赖 |
| --- | --- |
| quick-validate 退出码语义 0/1/2 与既有规则集逐条不变 | run-tests 36 例；package-skill 打包前校验 |
| snapshot-skill 缺省 workspace 位置（扫描根上一级 skill-workspaces/）与 .bak 去识别化 | 影子技能防护链 |
| aggregate-benchmark 单 iteration 聚合、配置目录动态发现、run-K/outputs 口径 | 既有 workspace 数据可重跑聚合；eval-viewer |
| viewer --previous-workspace 既有产物/留言对照 | 评审流程 |
| package-skill 排除清单（evals/ 等）与 STORE 格式 | 包消费者核验 |
| 36 例 run-tests 全过（新增能力只加用例不改旧断言） | 回归门 |
| 两仓逐字节同步提交惯例 | 用户跨仓工作流 |
| 存量 23 技能不被警告阻塞（警告不挡退出码） | 两仓现有技能日常校验 |

## 配置差异

| 字段 | 现在 | 改后 | 迁移 |
| --- | --- | --- | --- |
| gate 组合 | 隐含固定（新建=with/without，改进=with/old） | 对话内问询，默认组合只是建议，可自定义 gate 名 | 无迁移；gate 名即配置目录名，老目录名全部继续有效 |
| aggregate-benchmark CLI | `<iteration> --skill-name <名>` | 新增可选 `--history <技能目录>` | 不带参数=旧行为，零迁移 |
| eval_metadata.json 断言 | `{name,type}`（type: manual/script） | 新增**可选**字段 `ac`（引用 design.md 的 AC-N 编号） | 旧 metadata 原样合法；无 ac 时断言照常起草 |
