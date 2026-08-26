# design: parking-skill-creator

## 意图与触发场景

把 agent skill 的创建、校验、评测、迭代和分发流程固化为一套可在本机离线执行的工具链。用户提出创建新技能、评测既有技能、修正触发准确率、比较迭代结果或打包 `.skill` 文件时使用本技能。

## 设计取舍

| 范围 | 选择 | 原因 |
| --- | --- | --- |
| 脚手架、校验、聚合、打包 | Node 内置模块的确定性 `.mjs` 脚本 | Windows 本机无需 Python 或 npm 依赖，脆弱步骤保持可复现 |
| agent 执行与主观评审 | 文字流程 + subagent/人工评审 | 这些步骤依赖当前宿主能力，脚本不伪造真实 agent 证据 |
| 无嵌套 Agent 的触发探针 | 主会话预置进程环境 + 单轮 headless launcher；能力不足则交回主会话 | 保留同宿主同模型对照，同时隔离共享配置、凭据落盘和编排器自答风险 |
| Prompt 语言 | Chinese-first；English 只保留 machine contract 和通过四道 gate 的少量核心 term | 本技能自身是中文 Prompt，逐句加入 English 会增加噪声并削弱用户可读性 |
| 术语数量 | 短 Prompt 最多 2 个，普通文章最多 5 个，不足不凑数 | 用硬上限和信息增益排序阻止“术语化翻译”蔓延 |
| 评测产物 | `<skill-dir>/../../evals/<skill>-workspace/` | `evals/` 与 `skills/` 平行，产物与技能根隔离，避免 `SKILL.md` 夹具冒充技能 |
| 设计依据与成绩 | `references/design.md` + `<skill-dir>/history.json` | 验收条件可追溯，跨轮成绩可追加且随包分发 |
| UI 元数据 | `agents/openai.yaml`，路径相对技能目录 | 技能可独立复制、安装，不绑定宿主扫描根名称 |
| 迭代能力分布 | 能力集中本技能、证据随技能（六件套），技能不内嵌自迭代流程 | 评测管线只维护一份防口径漂移；clone 仓库即同时拿到管线与全部迭代依据，技能 description 触发面不被「迭代我」类意图污染 |

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
| AC-10 | `--history` 沉淀通道同轮整写 `output-evals.json`（题面+断言含 ac），clone 接收方不依赖 workspace 即可重建评测用例；无旗标时不写、写入失败干净拒绝 | script |
| AC-11 | 评测 subagent 分批受限并发：输出评测同一 eval 的各 gate 同批、默认每批 2 eval；触发探针按整条 query 分批、默认每批 3 条；grader 同口径；并发受限宿主可降级串行 | manual |
| AC-13 | frontmatter 解析器有显式支持子集：子集内构造与宿主 YAML 语义逐字一致（多行 plain 折叠、双引号转义含 `\uNNNN`、行尾注释剥离、块标量 `|`/`>`）；越界构造（flow 集合、跨行引号标量、单引号双写、keep chomping）不猜值，落在 name/description/compatibility 上时以退出码 3 报「无法判定」，落在不被校验的键上不阻塞；打包门同样拒绝无法判定 | script |
| AC-12 | 无嵌套 Agent 工具时，headless 触发探针固定逐字 prompt 和单轮调用；只从进程环境接收凭据，不读写共享 CLI 配置、不输出或落盘 key；失败不自答；清理私有 Temp 后对授权扫描根的内容、文件名和路径做前缀残留检查，命中路径输出不得泄漏前缀 | script/manual |

## 迭代记录

| 日期 | 改了什么 | 轮次结果 | 拆分建议 |
| --- | --- | --- | --- |
| 2026-08-17 | 补齐自测打包门禁、相对路径、设计依据、UI 元数据和对应回归覆盖 | 84 项自测通过；固定临时工作区端到端链路通过 | 未命中；保持单一流水线技能 |
| 2026-08-17 | 触发聚合失败关闭、评测集 schema 校验、坏探针计数和 viewer HTTP/端口回归 | 90 项自测通过；全无效触发证据退出 1 且不写报告 | 未命中；保持单一流水线技能 |
| 2026-08-18 | 将 Chinese-first、四道 conversion gate、短 Prompt 最多 2 个/长文最多 5 个写入 SKILL.md、writing guide 和 UI default prompt | n/a；待跑自测 | 未命中；保持单一流水线技能 |
| 2026-08-18 | 独立复跑新文档契约和完整流水线回归 | 96 项自测通过；quick-validate 通过 | 未命中；保持单一流水线技能 |
| 2026-08-18 | 按 Chinese-first 规则重写本技能 frontmatter description，收窄 English 到机器契约和路由必要词 | 97 项自测通过；quick-validate 通过 | 未命中；保持单一流水线技能 |
| 2026-08-20 | 钢人裁决「迭代能力集中 Creator、技能只带证据」落进发现约定；新增 output-evals.json 题面沉淀（`--history` 同通道整写），补齐 clone 接收方复现评测用例的缺口，五件套扩为六件套 | 109 项自测通过；quick-validate 通过；clone 视图模拟中六件套齐全、题面可重建并被聚合器消费；3 个存量技能已回填 | 未命中；保持单一流水线技能 |
| 2026-08-20 | karpathy-llm-wiki 两轮历史监控验证（16 执行臂）后按钢人裁决固化两条流程纪律（裁定：三候选缺口均为流程欠账/有意取舍，零代码改动进清单）：6.3 完成通知到达即核对产物落盘、空产物按执行臂故障纠偏续跑（draft 事故教训）；6.1 重要轮次可同轮 run-2 池化采样；另以 analyst pass 后置补跑实测验证其可捕捉 token 离群（1.92× 重尾被 notes 点名） | 109 项自测通过；quick-validate 通过；卫生门禁通过 | 未命中；保持单一流水线技能 |
| 2026-08-20 | realraw 专项轮暴露 output-evals.json 子集整写缺口（部分场景轮把题库缩写成本轮集合）：buildOutputEvals 支持 keepExisting 合成、CLI 新增 --keep-evals（专项轮保留存量、stdout 明示保留数；全量轮换代默认整写不变），SKILL.md 6.4 与 schemas.md 同步 | 112 项自测通过（+3）；quick-validate 通过 | 未命中；保持单一流水线技能 |
| 2026-08-25 | 评测并发由同回合全量 spawn 改为分批受限：6.1 输出评测同一 eval 各 gate 同批（对照公平不靠大并发）、默认每批 2 eval，触发探针按整条 query 分批、默认每批 3 条，grader 同口径 ≤4 在飞；依据官方 claude-skill-creator run_eval.py worker-pool（默认 10 并发上限）与 Cowork 超时允许退化串行的口径，适配低并发宿主（codingplan） | 121 项自测通过；quick-validate 通过 | 未命中；保持单一流水线技能 |
| 2026-08-25 | 为无嵌套 Agent 工具的宿主加入 headless 触发探针 fallback：固定逐字 prompt 与单轮调用，凭据仅从进程环境注入，私有空 settings 隔离共享配置，失败不自答，Temp 清理前后做前缀残留检查；能力或授权不足时交回主会话直跑 | 135 项自测通过；仅使用假凭据 fixture；真实 Provider 与全盘扫描未执行 | 未命中；保持单一流水线技能 |
| 2026-08-25 | 修复私有 Temp 命中后过早退出：私有清理后始终完成外部扫描并记录摘要，再统一报告 Provider、协议和全部残留失败；增加私有与外部双位置同时泄漏回归 | 136 项自测通过；双位置假凭据均被检出，私有 Temp 清零且外部路径进入审计 | 未命中；保持单一流水线技能 |
| 2026-08-25 | 修复 secret-derived filename/path 输出泄漏：扫描文件内容时同步检查文件名和父路径，命中路径含 key 前缀时整条脱敏；保留双位置扫描顺序与统一失败审计 | 137 项自测通过；12 字符假前缀文件名被检出，stdout/stderr 不含完整 key、前缀或原路径 | 未命中；保持单一流水线技能 |
| 2026-08-25 | 移除 headless fallback 的本机 zcode 绝对路径，Windows + Git Bash 示例改用 `command -v zcode` 发现入口；回归扫描随包 Markdown，拒绝硬编码用户主目录 | 139 项自测通过；quick-validate、Node 语法和 diff-check 通过；真实 Provider 仍为 runtime debt | 未命中；保持单一流水线技能 |
| 2026-08-26 | issue #54：修 frontmatter 解析器与宿主的 9/11 类分歧。实测建 11 类构造对照，补齐多行 plain 折叠、双引号转义（含 `\uNNNN`）、行尾注释剥离、块标量 `|` 换行连接四类（此前假 PASS：1201 字符 description 被读成 600 而放行；假 FAIL：带注释的合法 name 被判非 kebab-case；尖括号检查可被 `\u003c` 绕过）；其余四类失败关闭为退出码 3「无法判定」，只在被校验键上阻塞。init 模板的 `description: [TODO…]` 是裸 flow 序列（宿主也读不成字符串），改为带引号标量 | 160 项自测通过（+10）；11 类对照 8 一致 3 无法判定 0 分歧；全仓 58 技能 0 新增无法判定，`code-review` 由 419/字面反斜杠 → 417 与宿主逐字一致 | 未命中；保持单一流水线技能 |
