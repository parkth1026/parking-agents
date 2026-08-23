# 影响面扫描: 2026-08-17-bpr-skill-improve

改完之后，这个"程序"（技能 + 新脚本）在哪些地方跑起来不一样：

| 影响面 | 有/无 | 具体差异 | 谁受影响 | 对照物 |
| --- | --- | --- | --- | --- |
| 用户可见界面 | **无** | CLI 技能，无 UI | — | 不出 |
| 可观察行为 | **有** | 技能激活后的路由、检索预算、报告结构、置信标注、冲突标记、交接措辞全部变化；description 增中文触发词 | 使用该技能的用户；迭代 eval 的裁判断言 | `behavior.md` |
| 可运行输出 | **有** | 新增 `scripts/verify-refs.mjs`：终端可执行、有退出码 | 用户、后续 eval 门禁 | `example-run.md` |
| 对外接口报文 | **有** | verify-refs 的文本/JSON 双模式输出结构 | 潜在自动化消费者（eval 门禁、CI） | `api-mock.md` |
| 用户配置 | **无** | 无配置文件/环境变量新增；脚本零依赖（Node ≥20 内置 fetch） | — | 省略 |
| 历史兼容性 | **有** | name 不变；description 保留英文触发词（既有激活不破坏）；eval harness 按路径引用技能不变；输出契约旧六段语义保留只改中文名+新增段 | eval workspace、既有调用习惯 | `behavior.md` 不变清单 |

结论：四面为有，产物为 `behavior.md` + `api-mock.md` + `example-run.md` 三份确认版对照物，外加核心对照物 `skill-draft.md`（修订版 SKILL.md 全文——用户逐处质疑的主靶）。`mock.html` 不适用。
