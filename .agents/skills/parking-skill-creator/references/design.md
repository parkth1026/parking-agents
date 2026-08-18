# design: parking-skill-creator

## 意图与触发场景

把 agent skill 的创建、校验、评测、迭代和分发流程固化为一套可在本机离线执行的工具链。用户提出创建新技能、评测既有技能、修正触发准确率、比较迭代结果或打包 `.skill` 文件时使用本技能。

## 设计取舍

| 范围 | 选择 | 原因 |
| --- | --- | --- |
| 脚手架、校验、聚合、打包 | Node 内置模块的确定性 `.mjs` 脚本 | Windows 本机无需 Python 或 npm 依赖，脆弱步骤保持可复现 |
| agent 执行与主观评审 | 文字流程 + subagent/人工评审 | 这些步骤依赖当前宿主能力，脚本不伪造真实 agent 证据 |
| Prompt 语言 | Chinese-first；English 只保留 machine contract 和通过四道 gate 的少量核心 term | 本技能自身是中文 Prompt，逐句加入 English 会增加噪声并削弱用户可读性 |
| 术语数量 | 短 Prompt 最多 2 个，普通文章最多 5 个，不足不凑数 | 用硬上限和信息增益排序阻止“术语化翻译”蔓延 |
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
| AC-6 | `agents/openai.yaml` 的字段合法、`display_name` 与当前技能名一致、默认 prompt 引用当前技能名，且与技能目录一起打包 | script |
| AC-7 | 触发评测先校验评测集；坏探针、未知 query 和全无效证据失败关闭，不生成可误读的 0 分报告 | script |
| AC-8 | viewer 对端口参数做边界校验，并能通过真实 HTTP GET 首页、POST/GET feedback 完成评审闭环 | script |
| AC-9 | `SKILL.md`、writing guide 和 UI default prompt 明确 Chinese-first；English 只用于 machine contract 或通过四道 gate 的少量核心 term | manual/script |

## 迭代记录

| 日期 | 改了什么 | 轮次结果 | 拆分建议 |
| --- | --- | --- | --- |
| 2026-08-17 | 补齐自测打包门禁、相对路径、设计依据、UI 元数据和对应回归覆盖 | 84 项自测通过；固定临时工作区端到端链路通过 | 未命中；保持单一流水线技能 |
| 2026-08-17 | 触发聚合失败关闭、评测集 schema 校验、坏探针计数和 viewer HTTP/端口回归 | 90 项自测通过；全无效触发证据退出 1 且不写报告 | 未命中；保持单一流水线技能 |
| 2026-08-18 | 将 Chinese-first、四道 conversion gate、短 Prompt 最多 2 个/长文最多 5 个写入 SKILL.md、writing guide 和 UI default prompt | n/a；待跑自测 | 未命中；保持单一流水线技能 |
| 2026-08-18 | 独立复跑新文档契约和完整流水线回归 | 96 项自测通过；quick-validate 通过 | 未命中；保持单一流水线技能 |
| 2026-08-18 | 按 Chinese-first 规则重写本技能 frontmatter description，收窄 English 到机器契约和路由必要词 | 97 项自测通过；quick-validate 通过 | 未命中；保持单一流水线技能 |
