# 影响面扫描: 2026-08-24-对标mattpocock仓库差距

扫描时点:2026-08-24T18:34:43+08:00
扫描对象:本任务全部可观察改动 = ①差距报告落盘 `docs/research/` ②改造候选 C1–C8 的并集(实际执行面以用户圈定为准,此处扫并集)。

> 判据:改完之后,这个程序在哪些地方跑起来不一样了?每一处不一样,谁会看见、谁会受影响?

| 影响面 | 判定 | 具体差异 | 谁受影响 | 对照物 |
| --- | --- | --- | --- | --- |
| 用户可见界面 | **有** | 新增报告文档;README 定位段重写与索引(C2);CHANGELOG.md 新文件(C3);skills/ 出现自研技能目录与桶 README 增行(C1)。均为仓库内人眼可见文档/目录变化,无交互式 UI | 用户本人(跨机阅读)、任何 clone 者 | 报告草案 drafts/report-v1.md + behavior.md 变化行;不出 mock.html——无交互界面,markdown 草案即质疑靶 |
| 可观察行为 | **有** | C1 出库后 `skills/` 目录树变化、skill-discovery 结构测试新条目、(若登记)harness manifest 增行。**注意:junction 安装器本就按名合并两侧,自研技能已随开发侧装进自家机器——出库的观察差异在仓库发布形态,不在本机安装结果**(重名合并开发侧赢的语义保证结果不变)。C5 新增 `npm run evals` 类统一入口命令。C4 落地后 push 出现 GitHub Actions 运行记录 | 用户本人;依赖 skills/ 结构的 npm test 段 | behavior.md(变化行+不变清单);example-run.md |
| 可运行输出 | **有** | 新命令(transplant/evals)的终端输出样子;npm test 输出行数变化(若挂段) | 用户本人 | example-run.md |
| 对外接口报文 | **无** | 本仓无 HTTP/IPC 对外接口;新脚本是 CLI,属行为面与 example-run 面。此面扫过,确无报文结构变化 | — | — |
| 用户配置 | **有(条件)** | package.json `scripts` 增行(C1 移植命令、C5 evals 命令);.github/workflows 新文件(C4,现仓无 .github/) | 用户本人的 npm 工作流、push 体验 | behavior.md 配置差异节 |
| 历史兼容性 | **有** | 不变清单(与变化行同等重要):npm test 既有 9 段全绿不破坏;junction 重名合并语义(开发侧赢)不变;9 份 harness manifest 契约不破坏;双树结构保留(Q3≠C);上游移植 28 技能内容不动;AGENTS.md `.mjs` 零依赖、中文、双侧目录约定不违反 | 用户既有工作流、junction 安装器、tests/ 全部既有断言 | behavior.md 不变清单 |
| 架构与依赖 | **有** | 新数据流:开发侧 →(评测门槛)→ 发布侧 的出库通路首次成型;evals 统一入口的工具归属从 parking-skill-creator 技能内上升为仓级 scripts/ | 技能作者(未来出库动作)、npm test/CI 链 | diagram.html(架构视图,改后态,出库边 `.changed` 标注) |

## 汇总

- 判「有」六面,判「无」一面(对外接口报文)。
- 计划确认版对照物:`behavior.md`、`example-run.md`、`diagram.html`(第七面判有,必须带图)。
- `mock.html` 不出:无交互界面,报告草案(markdown)承担界面面的质疑职能。
- 前置:改造候选清单在报告草案 §5,由用户圈定后,确认版对照物只覆盖圈定项。
