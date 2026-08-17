# design: parking-skill-creator

## 意图与触发场景

把 agent skill 的创建、校验、评测、迭代和分发流程固化为一套可在本机离线执行的工具链。用户提出创建新技能、评测既有技能、修正触发准确率、比较迭代结果或打包 `.skill` 文件时使用本技能。

## 设计取舍

| 范围 | 选择 | 原因 |
| --- | --- | --- |
| 脚手架、校验、聚合、打包 | Node 内置模块的确定性 `.mjs` 脚本 | Windows 本机无需 Python 或 npm 依赖，脆弱步骤保持可复现 |
| agent 执行与主观评审 | 文字流程 + subagent/人工评审 | 这些步骤依赖当前宿主能力，脚本不伪造真实 agent 证据 |
| 评测产物 | `<skill-dir>/../../evals/<skill>-workspace/` | `evals/` 与 `skills/` 平行，产物与技能根隔离，避免 `SKILL.md` 夹具冒充技能 |
| 设计依据与成绩 | `references/design.md` + `<skill-dir>/history.json` | 验收条件可追溯，跨轮成绩可追加且随包分发 |
| UI 元数据 | `agents/openai.yaml`，路径相对技能目录 | 技能可独立复制、安装，不绑定宿主扫描根名称 |

## 验收条件

| 编号 | 条件 | 类型 |
| --- | --- | --- |
| AC-1 | 目标技能和脚手架生成的技能均通过 frontmatter/name/description 校验，且正文占位提示不会被规则说明误报 | script |
| AC-2 | 目标技能自带回归测试全通过，脚手架生成的 `run-tests.mjs` 可执行 | script |
| AC-3 | 存在 `run-tests.mjs` 且返回非零时，`package-skill.mjs` 拒绝生成分发包 | script |
| AC-4 | 评测聚合、触发聚合、历史沉淀、静态评审和 viewer HTTP 服务能消费同一套相对 workspace 布局 | script |
| AC-5 | 技能文档和随附脚本不依赖具体宿主技能根名称，路径从技能目录或显式参数解析 | script |
| AC-6 | `agents/openai.yaml` 的字段合法、默认 prompt 引用当前技能名，且与技能目录一起打包 | script |

## 迭代记录

| 日期 | 改了什么 | 轮次结果 | 拆分建议 |
| --- | --- | --- | --- |
| 2026-08-17 | 补齐自测打包门禁、相对路径、设计依据、UI 元数据和对应回归覆盖 | 84 项自测通过；固定临时工作区端到端链路通过 | 未命中；保持单一流水线技能 |
