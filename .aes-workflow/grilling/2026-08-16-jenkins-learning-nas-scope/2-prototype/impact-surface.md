# Impact Surface: 2026-08-16-jenkins-learning-nas-scope

- 扫描时间：2026-08-15T16:20:00Z；**v2 更新：2026-08-15T17:05:00Z（Q5=B 并入配置机制改造）**
- 判据：改完之后，程序在哪些地方跑起来不一样了？谁会看见？

## 六面扫描（v2）

| 影响面 | 有/无 | 具体差异 | 谁受影响 | 对照物 |
| --- | --- | --- | --- | --- |
| 用户可见界面 | **无** | 纯配置、数据落点与脚本行为变更，无人眼可见 UI | 无人 | — |
| 可观察行为 | **有** | v1 全部 8 行（扫描范围 7→3；知识/账本/tmp 迁 NAS；空账本；ue-error-solver/llm-wiki 跟随）**+ 新增**：配置文件从 `~/.claude/skill-env.json` 迁 `~/.config/parking-agents/skill-env.json`，解析链 SKILL_ENV > 新路径 > 旧路径回退；仓库 config.example.json 成为带真实 NAS 值的团队模板 | 用户、其他安装本技能集的成员 | `behavior.md` |
| 可运行输出 | **有** | v1 两项（status 配置摘要、scan 产物落 NAS）**+ 新增**：status 显示配置来源行（新路径/回退旧路径）；**NAS 不可达时打印现状报告（哪条路径不可达、影响什么、建议检查什么）后 exit 1**，替代裸路径报错 | 用户、运维排障 | `example-run.md` |
| 对外接口报文 | **无** | 对 Jenkins 的 API 请求构造逐字节不变；无新增报文结构 | 无 | — |
| 用户配置 | **有**（v2 扩大） | 环境层文件位置变更 + 回退链 + 模板 + jobs/path 六字段（v1 原有） | 本机所有读 skill-env.json 的技能；新成员用模板初始化 | `behavior.md` 配置差异节 |
| 历史兼容性 | **有**（v2 扩大） | v1 原有（本地两目录封存、115 条历史不迁、旧 workflow/pending-pairs 失效）**+ 新增**：旧 `~/.claude/skill-env.json` 必须仍可被回退读取；SKILL_ENV 覆盖行为不变；UeErrorSolver.psm1 与 jenkins-pair-analyze 不受影响 | 存量用法、其他机器 | `behavior.md` 不变清单 |

## 结论（v2）

behavior.md 与 example-run.md 两份确认版对照物需按扩大后范围重出（v3 / v2）。mock.html（无界面）与 api-mock.md（无报文结构变化）仍不出。

代码影响面（供执行参考，非逐文件任务书）：`jenkins-log-auto-learning/scripts/config.mjs`、`ue-error-solver/scripts/UeErrorSolver.mjs` 两处默认路径+回退+fail-fast；3 处文档路径引用；1 个模板文件。

## 撞出的新歧义（均已回访裁决）

- Q3：本地既有 wiki 迁不迁 NAS → A 整目录拷贝（已裁决）。
- Q4/Q5：skill-env.json 位置与解析机制 → B' 并入本次（已裁决）。

## 第七面补扫（2026-08-17）

- 架构与依赖：**无**（补扫）。本 issue 只改配置位置、数据落点与脚本默认行为——
  config.mjs 与 UeErrorSolver.mjs 仍是各自技能内部改动，模块归属与依赖方向零变化，
  不新增跨模块依赖边，无需回溯出图。2026-08-17-diagram-artifact 契约裁定：存量
  issue 补扫此行即豁免第七面闸门（rebuild 不降级）。
