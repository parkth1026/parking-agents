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
| 2026-08-20 | 历史监控验证轮（iteration-9/10，技能本体零改动，同题面同种子字节级复刻）：验证 parking-skill-creator 的 history 追加、vs_previous 跨轮对比、current_best 防抖与 output-evals.json 题面沉淀。两轮 with_skill 全绿（26/26），baseline 89%/93%；发现两类真实方差——① baseline 跨轮路线漂移（iter9 删填充行、iter10 拆分保全，oversize 断言 4/5→5/5）② 外部网络可达性影响 ingest 场景成本（iter10 disambig with_skill 穷尽检索 3.79M tokens，with 均耗被拉高、delta 翻转为更慢更贵）；一处执行臂中途输出草稿未落盘，SendMessage 纠偏续跑后补齐（timing 按两段累计） | 两轮均 won 0/lost 0/tie 4（技能行为稳定）；current_best 五轮保持 runs[0]（100% 持平不推进）；append-only 校验通过（前 3 条逐字节不变）；output-evals 跟轮至 iteration-10 | 四信号未命中（4 无数据），无需拆分 |
| 2026-08-20 | 题库 v2（localraw 纪元）立项：钢人裁决确认技能核心是本地 raw 整理、在线检索非产品主线；两个 ingest 场景改名 *-ingest-localraw，原料以确定性文件提供（每臂 material/，disambig 原料据 iter10 Wayback 真实存档重建底稿），题面显式禁止在线检索——根治 iter10 暴露的外部可达性方差（3.79M token 离群、同轮两臂输入不等价）。断言集不变；honesty/oversize 题面未动、可比链延续。iteration-8~10 同名 eval 的成本趋势不跨代比较 | 待跑 iteration-11 | 无新拆分建议 |
| 2026-08-20 | iteration-11 = 题库 v2（localraw 纪元）首轮验证：4 场景 × 2 gate，两 ingest 场景原料为同一确定性文件（哈希入 manifests）+ 题面禁在线契约；全 8 臂零纠偏、零在线检索 | with 100%（26/26）vs without 96%（25/26）；成本方差收敛——with tokens 617k ±323k（stddev/均值 0.52，iter10 为 1.19），最大单 run 982k；vs_previous 如实断代（tie 2 + new 2 + dropped 2）；current_best 保持 runs[0]；contradiction 基线因原料就位首次通过 raw 断言——iter9/10 该失败为无文章伪差异 | 四信号未命中（4 无数据），无需拆分 |
| 2026-08-20 | iteration-12 realraw 专项探针轮（题库 v2 增补 eval-realraw-ingest）：语料改为 NAS 生产 raw 确定性裁剪（fixtures-realraw，6 份=5 新知识+1 recurrence，SHA-256 冻结；种子为生产 wiki 自洽子集，起步校验 10/10） | 两臂 8/8 全过（官方尺子 Total=10 断链 0）；with_skill 更快更省（830s/2247k vs 1061s/2598k）；recurrence 回流契约首次真实数据端到端验证（024 页 updated>=recorded_at）；专项轮暴露 output-evals 子集整写缺口→已修复并新增聚合器 --keep-evals | 四信号未命中（4 无数据），无需拆分 |
| 2026-08-21 | 评分器固化 eval-graders/（v1 与 iter8~12 判罚逐字同源+零漂移实证；本轮首次全程使用）→ 轮中升 ruler v2（disambig 引用判定接受作品全名 wikilink，向后兼容实证于 iter9~11）；iteration-13 全量题库轮（5 场景 × 2 gate） | with 34/34（100%）vs without 33/34（97%，唯一差项为 honesty 查询日志纪律，连续第四轮）；run8→run9 为重复聚合修正演示；发现基线污染：realraw without 臂用了 workspace 旧轮技能快照的校验器（行动项：without 臂隔离执行） | 四信号未命中（4 无数据），无需拆分 |
| 2026-08-23 | ruler v3 断代升级（评测体系加固批次，与技能本体无关）：① 评分器路径 `import.meta.url` 相对解析（换机/clone 可跑，旧版 `D:/GIT_dev/...` 硬编码换机即断）；② honesty 三条 manual 断言 + oversize「拆分不丢知识」manual 断言脚本化（判据=近五轮人评固定口径，含两个标定细节：mamba 未覆盖验证排除 log/index——查询记录本身会写 Mamba；不丢知识排除标题与 `- Note N:` 填充行——人评 iter9 without 已裁定填充行可删）；③ honesty「引用既有页面」删主题词兜底（`Transformer` 文本兜底判别力为零）改真实种子页名集合/wikilink；④ realraw logGrew 改与冻结种子 log（fixtures-realraw/wiki-seed/log.md 新增入 manifest）行数比对；⑤ 场景目录动态发现（兼容新旧命名）。同批：merge-grading 对账警告（缺 manual 显式警告+同名去重）、聚合器判罚对账（results 数≠断言数告警）、history bank_epoch 换纪元重置 + supersedes、run prompt 沙箱禁读令（基线隔离，iter8/13 两度泄题对策）、workspace 遗留 skill-snapshot 移入 archive/ | v3 对 iter9~13 全量重跑：240 条断言判罚逐条一致、零翻转（脚本化断言与历史人评全 PASS 相符，无历史误判发现）；两技能回归全绿（parking 121 / karpathy 64）；题库 v2 中 4 条断言 type 改 script（判罚口径不变，仅评定主体从人评变脚本） | 历史成绩跨 v3 可比；无需拆分 |
| 2026-08-23 | iteration-14 全量题库轮（6 场景 × 2 gate）：新增 eval-conflict-batch-ingest（多素材冲突批次，题库纪元 2 首轮）——fixtures-conflictbatch 冻结 7 份 NAS 语料（C1083×3 + C2039×3 两个同根因家族 + 496-C2672 复发记录，SHA-256 manifest），两臂输入严格等价、断言只考归并/建页/回流本质；v3 评分器首个实战轮；12 臂全部在沙箱禁读令下执行（基线隔离首轮） | with 39/40（97.2%）vs without 39/40（97.6%），总 delta 归零但失败模式分化：with 唯一失败=oversize「拆分不丢知识」（v3 脚本化首秀抓真回归：36 要点行丢 4 条、宽松匹配亦缺失，技能未改+种子同 iter13 → 运行级知识保全纪律波动）；without 唯一失败=honesty 查询日志纪律（连续第五轮稳定契约差项）；conflict-batch 两臂 6/6 无自然区分度（归并/回流/同根因关联两臂均正确）——按裁决如实记录「该场景家族系统已外化可自运转」，且该结论首次建立在无污染基线上（without 臂泄题抽查零命中，iter13 曾两度泄题）；成本 ≈5.9M tokens（预估下限之下），with 臂开销 ≈ without 的 1.85×；history bank_epoch=2 开纪元、current_best 重置为 runs[9] | 四信号未命中（4 无数据；本轮未跑触发评测），无需拆分 |
