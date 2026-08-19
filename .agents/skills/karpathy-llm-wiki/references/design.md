# design: karpathy-llm-wiki

## 意图与触发场景

为什么有这个技能：LLM/AI/深度学习知识靠 RAG 每次查询临时检索，同一篇文章反复读、同一概念反复解释，知识从不沉淀。本技能把知识「一次编译、持续保鲜」——ingest 原始素材成互链 markdown 页面，形成一张随时间增值的理解之网（Karpathy 式个人知识库）。

用户会说什么话、什么上下文触发：

- 「把这篇文章/论文/视频转录稿整理到 wiki」「ingest 这个 URL」
- 「wiki 里有 attention 的资料吗」「查一下 wiki：Transformer 和 RWKV 什么区别」
- 「校验一下 wiki 质量」「lint 一下 wiki，看看有没有断链/孤儿页」
- 上下文：NAS 上已有共享 wiki（`knowledgeBase` 命名空间），或要从零初始化

期望产出形态：三层目录（raw 不可变层 / wiki 页面层 / SCHEMA 约定层）；每次操作后 log.md 追加一条、index.md 合并更新；Lint 产出带评分的校验报告（报告存 wiki 目录之外）。

## 设计取舍

- **三层架构、raw 永不可变**——为什么：raw 是 ground truth，wiki 是编译产物；编译错了可以重来，原始证据丢了就没了。raw 侧由其他技能（jenkins-log-auto-learning）写入，wiki 侧只由本技能独占写入，写权边界即协调边界。
- **编译一次 vs RAG 每次重查**——为什么：RAG 的检索质量随语料膨胀衰减且无结构；wiki 的 `[[wikilink]]` 互链让知识显式连接、可巡检（断链/孤儿页是可测量的质量信号，RAG 没有等价物）。
- **校验逻辑全部固化在 `scripts/validate-wiki.mjs`（低自由度）**——为什么：8 维度评分、断链硬门、staleness 判定是确定性计算，agent 肉眼数必然漂移；SKILL.md 只保留工作流判断（何时建页、怎么消歧）这类高自由度部分。
- **断链 = 0 是硬门，分数达标也不放行**——为什么：断链摧毁互链知识网的全部价值，一条断链比十个孤儿页危害大；分数是渐变量，断链是性质量。
- **staleness 默认 report-only，`stalenessEnforce` 开关过渡到硬门**——为什么：存量 wiki 页面普遍老于 raw 证据（v6 审计时确认），直接硬门会让每次校验永久红灯；先报告清积压，再开执行。
- **type 枚举与解析目录由 SCHEMA 声明（可插拔），不硬编码**——为什么：本技能既服务标准 LLM wiki，也服务 jenkins-error 等扩展部署；v5 硬编码 details/scratch/patterns 导致技能文本与磁盘现实两套世界观，v6 改为 SCHEMA 单一事实源。
- **recurrence 回流契约**——为什么：知识保鲜的最高信号是「同一错误在书面修复后复发」；raw 侧生产者写 `recurrence-{PageStem}.md`（带 `recorded_at`），本技能负责把新证据编译回页面。验收机械化：页面 `updated` >= 证据 `recorded_at`。
- **语言策略（2026-08-19）：指令层中文、产物层英文**——为什么：技能文档的读者是本仓库的中文用户/agent，译为中文；但 wiki 页面（含五种页面模板、SCHEMA/index/log 初始化模板）是既存英文产物，模板译成中文会让新生成页面与 NAS 存量英文 wiki 割裂。机器契约（frontmatter 字段、type 枚举、标签 token、CLI 旗标、被校验脚本解析的 `## Page Types` / `## Page Directories` 节名、报告维度标签）原样保留英文。

## 验收条件

| 编号 | 条件 | 类型 |
| --- | --- | --- |
| AC-1 | 互链/frontmatter/index/SCHEMA 齐备的健康 wiki 校验 PASS，exit 0 | script（run-tests 场景 1） |
| AC-2 | 8 维度问题 wiki（断链/自引用/孤儿/缺 index/缺 frontmatter/非法标签/出链不足）全量报告，exit 1 | script（场景 2） |
| AC-3 | `--config` 覆盖生效：maxLines 调小触发超尺寸报告、minScore 回显 | script（场景 3） |
| AC-4 | 带 BOM 的页面不误报 frontmatter/标签问题 | script（场景 4） |
| AC-5 | CLI 契约：缺 `--wiki` exit 2、未知参数 exit 2、路径不存在 exit 1、空 wiki 优雅 exit 0 | script（场景 5） |
| AC-6 | 配置分层：技能默认层（minScore 9.0、maxLines 200）+ 环境层（knowledgeBase 路径）深合并，各取正确来源 | script（场景 6） |
| AC-7 | index.md 悬空链接计入断链；目录链接默认计入入链且可配置关闭；点号标签（ue5.5）合法 | script（场景 7） |
| AC-8 | 断链硬门：分数达标但断链 > 0 仍 FAIL，原因明示，总分两位小数不虚高 | script（场景 8） |
| AC-9 | staleness：默认 report-only；`recurrence-` 前缀按页名匹配；缺 `updated` 字段计 stale；`stalenessEnforce: true` 时 exit 1 | script（场景 9） |
| AC-10 | type 枚举：基础五类恒合法；SCHEMA `## Page Types` 声明的扩展类型合法；未声明类型报错；声明节条目不混入标签集 | script（场景 10） |
| AC-11 | 技能文档（SKILL.md/references/openai.yaml 界面文案）为中文，机器契约保持英文原样（quick-validate PASS + grep 验证） | manual |
| AC-12 | 触发精度：description 对 20 条 query 评测集应触发率 1.00，且「关键词命中但非 wiki 操作」类（翻译、语法讲解、存到 wiki 之外）不出现多数误触发（3 探针严格多数口径） | trigger-eval（2026-08-19 iteration-7 新增，iteration-6 实测误触发 2/10 后立项） |
| AC-13 | 同名歧义与变体自链：跨目录同名 basename 进 Ambiguous Page Names 节逐名点名（默认 report-only exit 0，`ambiguousNamesEnforce: true` 时 exit 1 且原因明示）；大小写变体自链（如 `[[transformer]]` 于 Transformer.md）计入 Self References 且不计断链分母、不自充入链 | script（run-tests 场景 12，2026-08-19 iteration-8 审查立项后实施） |

## 迭代记录

| 日期 | 改了什么 | 轮次结果 | 拆分建议 |
| --- | --- | --- | --- |
| 2026-08-16~18 | iteration-1 输出评测（eval-ingest-fresh 等）→ v5 对抗审查修复（点号标签、断链分母双重计数、index 断链盲区）→ v6：staleness 检查、type 枚举校验、解析目录可插拔、recurrence 回流契约（commit 772395e） | 见 evals/karpathy-llm-wiki-workspace 各轮 benchmark | 未做结构审查（本表补建于 2026-08-19，历史轮次未留 structure-review.json） |
| 2026-08-19 | 全文档中文化（SKILL.md、3 个 references、openai.yaml 界面文案）；产物模板与机器契约保持英文（见设计取舍末条）。同时补建本 design.md，并把 workspace 单元测试装置（10 场景 51 断言）固化为技能根 run-tests.mjs（黑盒、os.tmpdir() 沙箱、SKILL_ENV 密封） | 未跑评测轮（文档翻译，脚本零改动；回归走 run-tests.mjs：51/51 全过，AC-1~AC-10） | 结构审查信号：1（可复用原子能力）未命中——校验脚本已自成原子；2/3 未命中——单一意图；4 无数据（未跑触发评测）。无需拆分 |
| 2026-08-19 | iteration-6 严格审查+评测（parking-skill-creator 全流程）：quick-validate PASS、run-tests 51/51；输出评测 5 场景 × 3 gate（with_skill=中文化工作区版 / old_skill=HEAD 英文快照 / without_skill），38 断言/run：with 38/38、old 38/38、without 18/32——中文化零行为回归；新增 recurrence 回流场景首次端到端全过；首次触发评测（20 query × 3 探针，57 有效/3 invalid）：应触发率 1.00（test 8/8 全对），误触发 2/10（q11 Karpathy 翻译、q13 wikilink 语法讲解，均 2/3 多数）；history.json 首次沉淀（此前 5 轮未入账，首轮无对比） | with 100% vs without 64%（history 第 1 条，无上轮可比） | 结构审查 4 信号未命中，无需拆分；建议收窄 description 条款(4) 触发词（加「做 wiki 操作」限定，排除翻译/语法讲解），仅建议未执行，待用户裁定 |
| 2026-08-19 | 用户裁定后实施升级：① description 条款(4) 收窄（加「且要做的是 wiki 操作」限定与翻译/语法讲解/存到 wiki 之外的排除句）② SKILL.md 页面格式新增 frontmatter 两档说明（title/type/tags=校验器硬门；created/updated/sources=模板契约，updated 参与 staleness）③ AC-12 立项（触发精度）。iteration-7 复测（5 场景 × 2 gate：升级版 vs snapshot-v2 升级前快照）+ 触发评测 round-2（60 探针）；回归 54/54（含会话中第三方并入的 staleness tmp 排除修复） | tie 5/5 vs iteration-6（won 0 / lost 0，升级行为中性零回归）；触发：应触发率保持 1.00，误触发 2/10→0/10，best_description 选中新版 | 拆分建议闭环：无新建议；本轮两项升级均已验证 |
| 2026-08-19 | iteration-8 泛化轮（严格审查+评测，场景与 iters 1-7 零重名）：矛盾处理 ingest / 未覆盖主题诚实查询 / 超大页拆分 / 同名消歧，4 场景 × with/without_skill；quick-validate PASS、回归 54/54 不变。审查发现 3 项低危：① 上一行「best_description 选中新版」与 trigger-benchmark.json 产物矛盾——两轮 test 正确数 8:8 全平，聚合器按「全平取先出现轮」记了旧 description（frontmatter 现用收窄版依然正确：train 误触发 2/6→0/6、test 持平，严格更优）② validator 大小写变体自链盲区（[[transformer]] 逃过 Self References 且自充入链；Linux 下则成断链）③ 跨目录同名 basename 校验静默（SKILL.md 有消歧约定但无机械化检测） | with 100%（26/26）vs without 93%（24/26），with 更快更省 token（history 第 3 条；eval 名全新无可比，won/lost=0；current_best 保持 iteration-6 持平不推进）；真实区分点=矛盾记录带日期、Query 的 log 纪律 | 四信号未命中，无需拆分；评测效度教训：oversize/disambiguation 两个基线臂在仓库内自行发现并使用了技能 validator（基线借用治疗），下轮 without_skill 应移出技能仓库执行 |
| 2026-08-19 | 用户裁定后实施 v6.2：修复 iteration-8 审查盲区 ②③——自引用检测改大小写不敏感；新增 Ambiguous Page Names 歧义检测（独立节不计分，`scoring.ambiguousNamesEnforce` 默认 false，与 staleness 同过渡策略）；顺带把入链计数改为经规范名映射归一（变体大小写链接不再丢入链）。文档同步：SKILL.md（Lint 检查列表/配置字段/Wikilink 规则）、validation-and-constraints.md（维度段/通过标准）、config.json 默认值；AC-13 立项 | 回归 61/61（新增场景 12 的 7 断言全过）；quick-validate PASS；未跑评测轮（纯脚本修复+文档同步，行为变化全部由 run-tests 黑盒覆盖，无 agent 行为面变化） | 无新拆分建议 |
