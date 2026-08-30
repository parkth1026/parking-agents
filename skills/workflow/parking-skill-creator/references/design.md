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
| 评测产物 | skills 祖先父级的 `evals/<skill>-workspace/` | 向上找 `skills` 祖先、取其父，与 skills 根平行，任意嵌套深度均落扫描根外，避免 `SKILL.md` 夹具冒充技能 |
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
| AC-17 | SKILL.md 正文只保留无条件内容；条件性内容（触发评测全流程、门禁判定细则、宿主与仓库约定）下沉到 `references/`，正文每处留写明「何时读」的指针；下沉只搬运不删除（每条实质规则在并集中仍可查到）；`agents/`、`references/` 下不得出现未被 SKILL.md 引用的文件 | script/manual |
| AC-16 | 触发聚合设 test 样本下限（默认 6，`--min-test-queries` 可显式放宽）：判定基数是 `test.evaluated`（真正拿到有效探针的 query 数）而非切分声明条数；不足时 `best_description` 置 null 并给出 `best_description_reason`，其余指标照常产出；足量时（20 条题库 test=8）正常宣告，不得误拦 | script |
| AC-15 | `agents/` 与 `references/` 下不存在孤儿资源：每个文件都能在 SKILL.md 正文中被引用到，由 `run-tests.mjs` 常设检测（注入孤儿文件时确实失败并点名） | script |
| AC-14 | frontmatter 键分诊：未知键只警告不挡退出码；与已知键编辑距离 ≤2 且 ≤ 键长/3 的未知键判拼写错误并给出建议键名；已知键按 kebab/snake/camel 归一后比对；`run-tests.mjs` 含全仓复扫（进程内调用），本仓任一技能不过门禁即测试失败，非本仓布局跳过 | script |
| AC-13 | frontmatter 解析器有显式支持子集：子集内构造与宿主 YAML 语义逐字一致（多行 plain 折叠、双引号转义含 `\uNNNN`、行尾注释剥离、块标量 `|`/`>`）；越界构造（flow 集合、跨行引号标量、单引号双写、keep chomping）不猜值，落在 name/description/compatibility 上时以退出码 3 报「无法判定」，落在不被校验的键上不阻塞；打包门同样拒绝无法判定 | script |
| AC-12 | 无嵌套 Agent 工具时，headless 触发探针固定逐字 prompt 和单轮调用；只从进程环境接收凭据，不读写共享 CLI 配置、不输出或落盘 key；失败不自答；清理私有 Temp 后对授权扫描根的内容、文件名和路径做前缀残留检查，命中路径输出不得泄漏前缀 | script/manual |
| AC-18 | opt-in 外部 evidence 的 prompt/harness 分离、manifest/payload 摘要校验、按 gate 物化和审计字段保持一致 | script |
| AC-19 | replay 对缺证据、host 隔离不足、query miss、摘要错和跨 gate digest 漂移失败关闭；不 fallback live、不产主 benchmark | script |
| AC-20 | record/live 只在显式授权、串行、有预算和 freshness policy 下访问 provider；record 不评分，失败不晋级或覆盖 epoch | script |
| AC-21 | 本地 writing guide 的静态 finding 转为绑定 risk/expected behavior/assertion/gates 的 hypothesis；静态审查不直接产生质量 PASS | script |
| AC-22 | benchmark/history/viewer 分离 run 判罚与 `SUPPORTED | INCONCLUSIVE | REGRESSED | BLOCKED` quality verdict；跨 evidence/harness epoch 不制造比较 | script |

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
| 2026-08-26 | issue #63：键白名单从判定依据降为提示依据。实证官方校验器的 `ALLOWED_PROPERTIES` 拒掉 31 个官方 marketplace 技能中的 24 个（`user-invocable`/`version`/`tools` 都是官方插件在用的键）——这条规则不是过时而是从未被执行。改为键分诊：未知键只警告，拼错的已知键（编辑距离 ≤2 且 ≤ 键长/3）判错并给建议；已知集补入 changelog 逐条求证的 12 个宿主 skill 键，比对前 kebab/snake/camel 归一。新增全仓复扫回归（进程内 20ms vs spawn 48s），防这类只在真实语料上才暴露的腐化 | 170 项自测通过（+10）；本仓 34/58 → 58/58，官方 marketplace 7/31 → 29/31（余 2 为真违规：description 含尖括号/非字符串）；注入拼错键的 canary 技能验证全仓复扫确实失败并点名 | 未命中；保持单一流水线技能 |
| 2026-08-26 | issue #56：删除盲比较能力。裁决依据是 `comparator.md` 系官方逐字节拷贝、从未本地化（同目录 analyzer/grader 都改过），平局触发条件零发生，无测试覆盖——接回本来也要重写。实施时发现删除面是票面的 2.3 倍：`agents/analyzer.md` 前 186 行的 Post-hoc Analyzer 只在盲比较之后可运行，且同样与官方逐字节相同（6 行差异全在保留的 benchmark 段），随之删去；`schemas.md` 的 comparison.json 与 analysis.json 两节同理。另加孤儿资源检测防复发——病根是「文件存在、被索引、正文无调用路径」 | 共删约 509 行（comparator 202 + analyzer 前半 184 + schemas 123）；零残留引用；171 项自测通过（+1）；注入孤儿文件验证检测确实失败并点名 | 未命中；保持单一流水线技能 |
| 2026-08-26 | issue #55：`best_description` 加 test 样本下限。此前 test 只有 2 条也照样选出一个冠军——一轮赢另一轮往往只差一条 query，那是噪声不是证据。判定基数取 `test.evaluated`（真正有有效探针的 query 数）而非切分声明条数，因为 8 条里 6 条没探针时实际证据仍是 2 条。不足时置 null 并写明原因，其余指标照常产出；放宽需显式 `--min-test-queries`。注：`beats()` 的四级字典序本就比官方 run_loop（只比 correct、平局取先）更严，本轮不动它 | 180 项自测通过（+9）；双向验证：4 条题库(test=2) 拒绝宣告并给原因，20 条题库(test=8) 正常宣告 | 未命中；保持单一流水线技能 |
| 2026-08-26 | issue #57：条件性内容下沉。正文 41520 → 31727 字节（-23.6%）。判据是**条件性**而非篇幅——触发评测是 SKILL.md 自己声明的独立入口（走创建主线的人不读它，进来做触发评测的人不读那六步），门禁判定细则只在改校验器或追查 UNDECIDABLE 时需要，宿主/仓库约定只对本仓与需读环境值的技能成立；中文术语节是 writing-guide 的浓缩重复件，压成指针。**明确不动第 6 步输出评测循环（38.9%）**——它对任何走到第 6 步的人都是无条件需要的，下沉只会多一次往返并诱发「凭骨架开跑」 | 181 项自测通过（+1，fallback 路由契约拆成 SKILL.md 可发现 + trigger-eval.md 完整两层）；内容守恒逐条命题核验，发现并补回 writing-guide 缺失的 4 条（bilingualize / provider name / context-dependent / unverified） | 未命中；保持单一流水线技能 |
| 2026-08-27 | issue #58 参考轮：触发题库定稿 20 条（正10/负10，负例走 near-miss——用既有技能做事、写普通脚本、非 .skill 打包、接口评测、CI 触发、SKILL.md 翻译、概念咨询、飞书机器人、点名 ps1-creator、写分享大纲），同宿主 Agent 探针 60 个分 7 批跑完（119 条会话可见技能清单；清单插槽文件化以绕开编排上下文体积限制）；输出评测 iteration-3 双臂 with/without 各 3 断言，timing 首次全数值抓齐（来源：subagent 完成通知的 usage 字段） | 181 项自测通过；触发评测 train 12/12、test 8/8（应触发率 1.00、误触发率 0.00，best_description 首次非空，test.evaluated=8 过下限 6；53 valid / 7 中文协议变体探针记 invalid 不猜）；输出评测两臂 3/3 平手（断言对强模型区分度不足，双侧 grader 的 eval_feedback 均已点名），with 263.2s/800.6k vs without 166.8s/242.2k tokens；--history 聚合产出 output-evals.json 首版、history 追加第 3 条（vs_previous 因上轮 iteration 目录已清记不可比） | 未命中；保持单一流水线技能 |
| 2026-08-30 | Issue #160：增加本地 evidence provider seam、replay 失败关闭、record/live 生命周期、质量假设计划、双零增长审计和 Evidence/Quality viewer 首屏；shopping 四题建立脱敏 epoch-1 pack 与 replay pilot 审计 | Creator 自测 215 项通过；shopping replay 四题三 gate 均 digest 一致、misses=0、live_calls=0、isolation=verified；live acceptance 按合同在 2026-09-10 前保持 BLOCKED | 未命中；保持单一流水线技能 |
| 2026-08-30 | Issue #160 受控 live acceptance：用户明确授权提前消耗真实搜索额度；shopping 四题沿用 epoch-1 replay manifest，逐题通过可执行 Node provider adapter 实际搜索并探测来源，所有 entry `query/tool/source/freshness` 通过，live 与 replay 保持不可比 | 四题 live audit 均 `execution=live`、`real_provider_verified=true`、2 calls/题、`concurrency=1`、`max_calls=16`；history 追加 `shopping-deep-research-live-2026-08-30` PASS，viewer 首屏核对通过 | 未命中；保持单一流水线技能 |
| 2026-08-31 | 布局回归修复（7677680 大搬移后）：snapshot 缺省 workspace 解析改为 skills 祖先语义（向上找名为 `skills` 的祖先、取其父，任意嵌套深度；找不到回退上两级并提示一行）；check-shadow 影子判据从「非一级目录」改为产物特征（`evals/`、`eval-fixtures/`、`*-workspace/`、`skill-snapshot*` 名单内的活 SKILL.md），无参派生根同一语义；另修 cpSync 未解引用——link 挂载快照曾穿透链接把源 SKILL.md 改名（实机触发后已恢复源并补回归夹具） | 自测 226 项通过（+11）；实机分类根 63 技能全合法 exit 0（原 63 全判影子 exit 1）；2/3 层技能快照实机均落 `<repo>/evals/`；用户级 link 场景输出逐字节不变且源完好 | 未命中；保持单一流水线技能 |
