# Goal Contract: 把 lixiang-ceo-grill 整尺重构为 lixiang-product-grill——16 讲全景产品复盘尺 + 运行时赋能的 LLM wiki

- Status: Ready
- Target: skills/product/lixiang-ceo-grill → skills/product/lixiang-product-grill（含 ceo-copilot 题库同步、package-skill.mjs 打包排除、用户级 symlink）
- Updated: 2026-10-05

## 原始请求

> G:\GIT\AI_WorkFlow\parking-agents-manual\skills\product\lixiang-ceo-grill
> 我期望 完善这个 技能
> 使用 G:\GIT\AI_WorkFlow\product-research\exports\2026-10-04-dedao-lixiang-product-16\ 这里的 知识 做成 LLM wiki 融合到 ceo-grill 里
> 你用双向 steelman 帮我 确定一下 最重要的问题是什么？

后续补充（原话照录）：

> B. 升级为 16 讲全景产品尺——题库按 16 讲重构，技能身份从「CEO 方向复盘」变为「李想产品方法论全景复盘」；

> 我们用 workflow-interview 来 做完整 流程

> 这个是我个人仓库，只有我自己使用，不要有任何限制

## 目标

lixiang-product-grill 以《李想·产品实战16讲》为唯一尺子做产品方法论复盘：题库 14 维度逐字锚定课程原文，wiki 弹药层在复盘运行时赋能追问，五件套齐全、全部验证绿。

**北极星行为句**：建成后，用户点名 lixiang-product-grill 或「李想产品复盘」即得 16 讲 14 维度逐字对照复盘（追问带 wiki 案例弹药）；旧短语「用李想方法论盘一下」与旧名不再触发。

## Why

- 现尺子（单篇公开课提炼的三层九模块）与用户日常产品决策（定价/体验/复盘/节奏）错位；16 讲同作者、完整课程、自带案例弹药
- 现技能缺五件套中的 trigger-evals.json 与 trigger-benchmark.json（五件套＝trigger-evals.json、output-evals.json、run-tests.mjs、trigger-benchmark.json、history.json），且与 b2b-product-review（原 product-adverse-review，git b20b8be 改名）的语域重叠遗留未验

## 范围

做：
- git mv 改名；重构 SKILL.md、question-bank.md（14 维度）、report-format.md（矩阵改 14 维度×三模块）、web-prompt.md、run-tests.mjs、output-evals.json、design.md、agents/openai.yaml 内容
- 新增 references/wiki/（sources×19/concepts/cases + 脚手架）与 references/archive/（19 篇原文）
- 新增 trigger-evals.json 并真跑触发评测（探针+聚合器）；output evals 三臂（with/without/no_refs，虚构产品材料）
- ceo-copilot 让渡句措辞（进改名笔）与题库元数据（另笔）同步，其触发评测全量重跑
- 修改 package-skill.mjs 打包排除机制（现机制只匹配技能根一层目录，排不进 references/archive/，需新增精确路径匹配）
- 用户级 symlink 重建（改名笔 commit 后、触发评测与走查前——触发评测的技能清单与 [C] 走查依赖用户级挂载，output 三臂走显式仓内路径不依赖）

不做：
- 不动全局 karpathy-llm-wiki knowledgeBase 基建；不改 validate-wiki.mjs 本体
- 不修 b2b-product-review 本体（触发负例覆盖其语域即止）
- 不碰 parking-skill-creator 的 7 个既有未提交 M 文件（SKILL.md、references/gate-rules.md、references/trigger-eval.md、references/writing-guide.md、run-tests.mjs、scripts/init-skill.mjs、scripts/quick-validate.mjs）——package-skill.mjs 不在此列，允许精确修改；其 SKILL.md 排除文档**不同步**（属白名单文件，打包文档滞后记入残留风险）；也不把打包回归测试加进 parking-skill-creator 的 run-tests.mjs
- evals/ 与 .agents/evals/ 历史快照不改；评测工作区为 scratch 不入库（.gitignore /evals/），「落盘」＝磁盘存在，AC-005 [C] 从磁盘读
- 不新建 worktree；不做旧名别名/双挂载过渡兼容
- 旧九模块题库内容移除（git 历史留底）；旧公开课文章仅附注保留，不进运行链

## 强约束

- 裁定唯一依据＝question-bank 标准句（逐字＋讲次）；wiki 只供追问弹药与溯源，**不承载裁定措辞——由技能自身 run-tests 断言单拦**（validate-wiki.mjs 无此维度且本体禁改，不得为它加维度）
- 三模块层序固定：产品战略→从0到1→从1到10，禁止反向。14 维度＝产品战略（定位/品牌/文化/产品标准/团队标准）＋从0到1（体验/用户/技术/定价）＋从1到10（复盘/节奏/流程/门店/利润）
- 尺子句逐字引自 16 讲原文；五断点锚不到课程原句的必须标注「本技能自构检查」或删除
- 复盘协议骨架不可改：一次一问/证据三级/裁定四档/不耐烦降级/对话正文提问（禁结构化提问工具）/smart-skip；协议要素清单以确认版 example-run 场景 1 [协议] 组 13 项为准（第 9 项措辞按下方勘误 5）
- 旧文章 lixiang-ceo-article.md 正文只读不改；头部加非尺子声明；退出运行时加载清单；黑名单缺席断言的作用域＝question-bank.md、SKILL.md、web-prompt.md 三文件，对象＝旧九模块名 9 词（行业趋势/行业问题/进攻方向/用户定位/时间节奏/目标要求/业务架构/在线系统/运营系统）＋签名句 5 串（认知决定战略，战略决定业务/量变带来质变/独一无二的资质/高保真映射/闭环），逐词逐串断言；附注旧文章与 history.json 旧 run 豁免。**carve-out**：黑名单词/串若被 16 讲原文本身使用（实测 11 讲含「目标要求」、「闭环」命中 3 讲），题库逐字引用不受限，该词/串在断言实现里降级为长串组合形式，降级决定记 design.md 迭代记录
- archive 19 篇原文（16 正课＋发刊词＋00-目录 说明节定义的 2 篇加餐：工具手册、产品奖学金；其余非正课文件不选，全清单与取舍记 design.md）为 raw 层只读不可变，带溯源头（来源仓/抓取日期/仅个人使用标注）；打包出口必须排除
- 确认版对照物 ../2-prototype/behavior.md、example-run.md、diagram.html 不可修改——执行 Agent 改的是产品，不是对照物。**勘误清单**（契约与锁定对照物冲突时以本清单为准）：
  1. example-run 场景 3 的 `run-output-evals.mjs` 命令行不存在，output 臂以 `run-headless-eval-arm.mjs`（按配置目录逐臂）＋ `aggregate-benchmark.mjs`（`--skill-name lixiang-product-grill --history 技能目录`）实际链路为准
  2. example-run 场景 3 触发段的 `--persist --skill` 旗标有误，aggregate-trigger.mjs 真实接口＝workspace 目录为参数＋`--persist 技能目录`
  3. example-run 场景 1「组名锁定」的 13 组增补为 15 组：新增 [触发面]（trigger-evals 结构断言）与 [archive]（19 篇/讲次命名/溯源头）
  4. example-run [design] 组「AC-1..AC-9」口径：design.md 重写后 AC 集合＝AC-1 题库 14 维度／AC-2 原文存档（archive）／AC-3 wiki 完整性／AC-4 访谈协议要素／AC-5 报告模板／AC-6 人工评审保留／AC-7 附注护栏／AC-8 触发面／AC-9 五件套
  5. [协议] 组第 9 项与 behavior 不变清单 #3 的「不使用 AskUserQuestion」措辞：test-no-tool-names 门禁禁止技能文件点名宿主工具名，统一改为「不使用带选项面板的结构化提问工具，提问写在对话正文」；run-tests 断言用新措辞
- 技能内 .md/.mjs 不得含机器绝对路径（G:\、C:\Users）
- ceo-copilot 让渡路由行为不变（只改措辞与题库元数据）；其题库改动与其 description 改动**不得混进同一 commit**（description 让渡句改动进改名笔）
- 触发模式＝名字触发，description 严格字款式（剔除 name 后 ≤16 字符）；「用李想方法论盘一下」与旧名点名＝负例
- commit 中文分批（4 笔，见下）、staging 按文件精确圈选、无在执行 issue 不带编号。**顺序锁**：C1 改名笔（整尺重构：git mv＋archive＋wiki＋题库＋SKILL＋web-prompt/report-format/design/openai.yaml/附注化＋history 顶层 skill 手改＋package-skill.mjs 排除＋ceo-copilot description 让渡句；message 声明「锚点先于断言」）→ 重建 symlink → C2 冻结笔（trigger-evals.json＋run-tests.mjs，本地全绿后提交）→ 真跑评测 → C3 评测产物笔（trigger-benchmark/output-evals 整写/history runs 追加）→ C4 邻库笔（ceo-copilot 题库元数据＋其重跑 benchmark）。[A] 验证＝终态门（逐笔跑 run-tests 作开发自检可选，验收以终态全绿为准）
- run-tests.mjs **不得断言聚合器产物**（trigger-benchmark.json/benchmark/history runs）的存在性与数值——断言边界止于静态文件，防冻结笔↔产物笔成环

## 自主边界

不用问，直接定：
- wiki taxonomy（sources/concepts/cases＋S/K/C 前缀）与页内结构（概念页「拿它问什么/误用边界」，案例页「机制/证据与深度/不能推出什么」）；concepts/cases 各 ≥12 页
- archive 文件组织（19 篇 md 沿用原讲次文件名）；SCHEMA/index/log 内容
- 题库内部条目措辞（追问/红旗/合格线/合理答案示例）、断点最终措辞与锚点取舍
- run-tests 断言组内实现细节（在验收条件所列下限与断言边界之内自由加强）
- 评测题面细节（在 AC-003 题面锁之上自由补充；trigger-eval.md「写好后向用户过一遍」步骤由本契约题面锁替代，不再单独过目）
- subagent 编译批次划分（并行 ≤4）
- symlink 重建具体命令
- 打包排除实现：采用**精确路径匹配** references/archive/（不用全局目录名匹配，避免波及其他技能同名目录）
- output-evals 三个场景命名加「16讲」前缀（与 epoch-1 场景不同名，保证聚合器自动开 bank_epoch 2）

必须停下来问：
- 发现必须改 validate-wiki.mjs 本体才能过校验
- 发现 16 讲原文与题库锚点冲突到需要动摇「逐字锚定」纪律本身
- 发现必须动 7 个未提交 M 文件才能完成任何环节
- wiki 增益三臂对照出现显著负增益（wiki 拖累复盘质量）
- 聚合器跑完后 bank_epoch 未进 2
- 评测环境不满足（run-headless-eval-arm 需 --host 与 --model 或 --profile，zcode 通道需进程环境 ZCODE_API_KEY——凭据缺失时停下问，不自行换通道）
- 触发评测重跑一次后仍不达 1.0（杠杆已锁死，继续重跑只烧预算）

## 预算与中止协议

- 探针 spawn 总上限 150（本技能 60＋ceo-copilot 60＋重跑余量 30）；output 臂 run 上限 12（3 场景×3 臂＋余量）；grader 判定上限 60；subagent 并行 ≤4。超限即停，按中止协议上报
- **中止协议**：任何「必须停下来问」命中或预算超限——停在当前状态，不自动回滚、不自行撤销 commit、不自行换 symlink；报告五件套：已完成 AC 状态／已烧评测计数（spawn/run/grader）／commit 清单／symlink 现状／选项（A 回滚哪些笔 B 修契约继续 C 接受风险继续）。回滚与继续的裁定权＝用户
- AC-004 [C] 的新会话走查与旧短语反走查**由用户执行**（触发路由发生在宿主层，执行 Agent 无法自测）；执行 Agent 交回走查清单（含预期形态对照 example-run 场景 4）即达停止点，验收报告随之交付

## 读什么

- ../2-prototype/behavior.md —— 确认版行为对照表，14 条变化行是行为事实源
- ../2-prototype/example-run.md —— 确认版可执行示例：场景 1 断言组名（按勘误 3 为 15 组）、场景 4 开场回合形态（场景 3 见勘误 1/2）
- ../2-prototype/diagram.html —— 确认版架构图：加载链与门禁联动拓扑
- skills/product/lixiang-ceo-grill/（重构前全目录：协议骨架与题库六要素格式被复用；其 run-tests.mjs 的切片式模块断言写法被沿用）
- skills/product/ceo-copilot/（wiki 结构先例与 run-tests 断言强度模板；注意本技能与其相反——wiki 运行时赋能）
- skills/product/b2b-product-review/SKILL.md（语域邻库，负例取材）
- skills/workflow/parking-skill-creator/references/trigger-eval.md、eval-models.md、schemas.md（探针流程/output 臂 CLI/字段级 JSON 契约）、agents/grader.md（grader 评分契约）与 SKILL.md 评测节
- 课程原文真源：product-research 仓 exports/2026-10-04-dedao-lixiang-product-16/（仓外绝对路径见「原始请求」节；archive 自此拷贝；00-目录 说明节为加餐消歧源）

## 要落盘的东西

- D-01: skills/product/lixiang-product-grill/SKILL.md：协议（含倒序菜单/smart-skip 激进/每维度读 S 页/裁定唯一依据=题库）＋名字触发 description
- D-02: references/question-bank.md：14 维度×六要素（李想的标准/核心问题/追问/红旗/合格线/合理答案的样子）＋五断点（锚点/自构标注）＋文件头 TOC＋S 页指针
- D-03: references/wiki/：SCHEMA/index/log＋sources×19＋concepts＋cases（validator v7.2 PASS；concepts/cases 各 ≥12）
- D-04: references/archive/：19 篇原文 md＋溯源头（来源仓/抓取日期/仅个人使用）
- D-05: trigger-evals.json＋trigger-benchmark.json（聚合器真实产物：trigger_rate_on_should＝1.0）
- D-06: output-evals.json（3 场景「16讲」前缀命名，虚构产品材料，断言含技能依赖断言）＋history.json（顶层 skill 手改新名；runs 由 aggregate-benchmark --history 追加，bank_epoch 听聚合器、预期 2）＋评测工作区 evals/lixiang-product-grill-workspace/（scratch 不入库）
- D-07: web-prompt.md（16 讲单文件版）＋run-tests.mjs（15 断言组重写）＋design.md（AC-1..AC-9 按勘误 4；含触发模式声明行、黑名单降级记录、archive 选篇取舍、迭代记录）＋agents/openai.yaml（内容同步）＋references/report-format.md（14 维度×三模块矩阵）＋旧文章附注化
- D-08: ceo-copilot trigger-evals.json/run-tests.mjs 同步（与 description 改动分笔）＋其重跑后的 trigger-benchmark.json
- D-09: package-skill.mjs 精确路径排除 references/archive/

## 验收条件

- AC-001: 尺子重构——题库覆盖 14 维度且六要素齐全、标准句逐字＋讲次、三模块层序严格递增、五断点逐条带锚点或自构标注、文件头 TOC、S 页指针 14/14。断言实现下限（防自证放水）：切片式断言按模块边界切块、14 维度名各恰好一个块头、六要素在块内独立命中；[三层一致] 抽查 ≥5 个维度（三模块各 ≥1），每条标准句（≥10 字符、含讲次）双跳验证＝规范化后（剥 `**`、`[文本](链接)→文本`、CRLF→LF、trim）是对应 S 页引文段的 substring 且该引文段是对应讲 archive 文件的 substring、archive 文件名讲次与标注一致；[断点] 组锚点断点 ≥3、锚点句 ≥8 字符且不取课程开场/收尾套话、在其标注讲次对应 archive 文件逐字命中（规范化后不得命中其他讲）、自构断点显式含「本技能自构检查」；[archive] 组断言 19 篇、讲次命名、溯源头三字段
  - Verify: [A] `node skills/product/lixiang-product-grill/run-tests.mjs` → 退出码 0（[题库][层序][断点][三层一致][archive] 组全过；全文件 check 总数 ≥48）；[C] 验收时由用户或验收会话点名抽 3 个维度（执行 Agent 不得自抽），人工核对题库标准句逐字＋讲次对 archive 原文，另抽 1 讲 diff archive 文件与仓外源文件须零差异；抽样来源与结果记验收报告
- AC-002: wiki 层——三目录在位（sources=19、concepts/cases 各 ≥12）、断链 0、frontmatter 硬门齐全、wiki 页不含裁定措辞（「合格线」「裁定」字样，由 run-tests [wiki 结构] 组断言——validator 无此维度）
  - Verify: [A] `node skills/ue/karpathy-llm-wiki/scripts/validate-wiki.mjs --wiki skills/product/lixiang-product-grill/references/wiki` → 退出码 0 且总分 ≥9.0；[A] `node skills/product/lixiang-product-grill/run-tests.mjs` → 退出码 0（[wiki 结构] 组）
- AC-003: 触发面——trigger-evals 题面锁：正例 ≥6（英文点名与中文名点名各 ≥1）、负例 ≥13 且必含逐字题面「用李想方法论盘一下」与点名「lixiang-ceo-grill」各 ≥1、ceo-copilot 与 b2b-product-review（原 product-adverse-review）邻域题各 ≥2（后者语域负例 expected=none）、id 与 text 唯一、expected_skill 属 {lixiang-product-grill, ceo-copilot, b2b-product-review, none}、scoring 用 exact_string；run-tests check 总数 ≥48。真跑后聚合器产物 trigger-benchmark.json：test split `trigger_rate_on_should == 1.0` 且 `false_trigger_rate_on_should_not == 0`；噪声口径：单题允许重跑一次、以聚合器最终报告为准
  - Verify: [C] 步骤 0：`ls` 用户级挂载确认 symlink 指向新路径、读其 SKILL.md frontmatter name＝新名（探针技能清单以磁盘枚举为准，不以编排会话注入清单为准——编排会话先于挂载启动时其清单不含新技能）→ 按 skills/workflow/parking-skill-creator/references/trigger-eval.md 流程真跑（每题 spawn 3 探针、probe-results.jsonl 逐条追加 → `node skills/workflow/parking-skill-creator/scripts/aggregate-trigger.mjs`（workspace 目录为参数、`--persist skills/product/lixiang-product-grill`）），核对上述两字段与 best_description 含新名；[A] `node skills/product/lixiang-product-grill/run-tests.mjs` → 退出码 0（[触发面] 组）
- AC-004: 复盘运行行为——SKILL.md 含开场倒序菜单（单维度→模块→全量垫底，轮数口径每维度 1-3 轮）、smart-skip 激进措辞、每维度读 S 页、裁定唯一依据=题库、协议 13 要素（以 example-run [协议] 组清单为准，第 9 项按勘误 5 新措辞）；黑名单三文件缺席断言（按强约束 carve-out 条款）；旧文章退出加载清单且头部含非尺子声明；report-format.md 矩阵＝14 维度×三模块；web-prompt 14 维度自包含
  - Verify: [A] `node skills/product/lixiang-product-grill/run-tests.mjs` → 退出码 0（[协议][附注护栏][web-prompt][报告模板] 组）；[C] 由用户执行：新会话输入「用 lixiang-product-grill 盘一下「园区 3D 编辑器」」核对倒序菜单/禁止反向/单问 → 答「只盘定价」核对第二回合（标准句逐字+讲次/引用你的思考/只问一个缺口/smart-skip 出示对照）→ 另一新会话说「用李想方法论盘一下 园区 3D 编辑器」核对不触发
- AC-005: 评测三臂与台账——真实链：`run-headless-eval-arm.mjs` 按配置目录逐臂跑（with_skill/without_skill/with_skill_no_refs 同批；host/model 前置见「必须问」第 6 条）→ `node skills/workflow/parking-skill-creator/scripts/aggregate-benchmark.mjs`（iteration 目录为参数，`--skill-name lixiang-product-grill --history skills/product/lixiang-product-grill`）；「跑完」＝聚合器产出 benchmark 且 history 经 --history 通道追加（bank_epoch 听聚合器、预期 2）。output-evals 断言：每场景 ≥6 条且 ≥2 条技能依赖断言——模板句式「判定须逐字引用 question-bank 对应维度标准句（含讲次）」，执行 Agent 只填维度名；**断言有效性反证**：without_skill 臂在技能依赖断言上每场景至少翻 1 条，否则断言组无效（区别于不设门槛的三臂质量差分，后者随验收报告呈报）。with_skill 臂门槛＝断言全过（pass_rate=1，grader 评分）。评测材料＝虚构产品（第 5 轮 Q4 裁决）
  - Verify: [C] 四步核对：① evals/lixiang-product-grill-workspace/iteration-*/benchmark.json 的 configs 含三臂各 ≥1 run；② 逐 run 的 grading.json 中 with_skill 臂每条 passed=true 且 evidence 非空、without_skill 臂技能依赖断言有 ≥1 翻车；③ history.json 顶层 skill=新名、最新 run bank_epoch=2、三臂在 gates、vs_previous=null；④ output-evals.json ≥3 场景且场景名与 benchmark 的 eval 目录一致；[A] `node skills/product/lixiang-product-grill/run-tests.mjs` → 退出码 0（含 [配套同步] 组）
- AC-006: 邻库同步、改名回归与分发闸——ceo-copilot 规范名/负例/让渡句同步后其 run-tests 全绿；其触发评测全量重跑且新 trigger-benchmark.json 的 test `trigger_rate_on_should` 不低于其旧 benchmark；改名波及的两个回归测试（skill-discovery 自动发现新名、install-skills）退出码 0；validator 复跑 ceo-copilot 既有 wiki 结果与改动前一致；打包产物不含 references/archive/
  - Verify: [A] `node skills/product/ceo-copilot/run-tests.mjs` → 退出码 0；[A] `node tests/skills/test-skill-discovery.mjs && node tests/skills/test-install-skills.mjs` → 退出码 0（注：test-no-tool-names 现有 5 处与本任务无关的既有红——deepseek-ui.md×2、eval-models.md×2、github-trending-weekly×1，不属本契约；另有 2 处在现技能自身〔SKILL.md/design.md 点名 AskUserQuestion〕，由本任务按勘误 5 新措辞重写后自然消除）；[C] 打包演练：`node skills/workflow/parking-skill-creator/scripts/package-skill.mjs` 产包后列 zip 条目（unzip -l 或等价）grep 无 references/archive/；核对 ceo-copilot 新旧 trigger-benchmark.json 与 validator 复跑输出

## 残留风险

- public 仓纳入付费课程全文，git 历史永久化（用户知情裁定「无限制」）——错了会怎样：将来反悔时工作区删除容易、历史清除代价大
- wiki 运行时赋能的增益方向未经数据验证，三臂对照是首次测量——错了会怎样：若 no_refs 臂显著更优，每维度读 S 页协议需回炉（自主边界「必须问」）
- 全量 14 维度长交互（每维度 1-3 轮）的 late-session 质量未实测——错了会怎样：长对话后半裁定质量下降时，按三模块拆题库（拆分条件＝验收或使用中发现后段维度裁定质量可观察下滑）
- 五断点中「总纲」「回扣目标」两条锚点较弱，编译时可能降级为自构标注——错了会怎样：断点检查的「李想原话依据」弱一层，报告须显式区分
- 触发正例 1.0 门槛 × 探针噪声：test split 正例基数约 2-4 题，单探针一次翻转即破门——错了会怎样：AC-003 反复重跑烧预算（已配重跑一次口径＋超限即停）
- 打包排除若实现偏离精确路径（如误用全局目录名匹配），其他技能的同名目录会静默出局——错了会怎样：分发包内容变化用户不自知（已写进自主边界缓解）
- package-skill.mjs 的排除文档（parking-skill-creator/SKILL.md）不同步——错了会怎样：文档与行为暂不一致，待该文件提交后另行补记（白名单约束下的自觉滞后）

## 访谈记录

> 此处为访谈的聚合定稿，只留结论与被否决的候选。第 5 轮原记「六条后果句」实际含第 6 轮增补，计数以后来核对为准。

### 第 1-3 轮（1-interview，钢人与拍板）

| 问题 | 候选 | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| 尺子量什么 | A 九模块+弹药 45% / B 整尺换 30% / C 并存 25% | 偏 A | B |
| 技能名 / 旧尺 / 评测 | 改名 / 附注保留 / 真跑 | 改名 / 彻底移除 / 真跑 | 改名 / **附注保留（推翻）** / 真跑 |
| 引用尺度 / wiki 运行时 / 触发模式 | 短引 / slim / 语境 | 三项同推荐 | **无限制（推翻）** / **赋能（推翻）** / **名字触发（推翻）** |

### 第 4 轮（设计审计后，2-prototype）

换点名习惯（旧短语=负例）、ceo-copilot 全量重跑、打包排除 archive 三项拍板；11 条必修默认成立（真实评测链/双事实源/护栏升级/锚点纪律/补臂/TOC+指针/菜单倒序/让渡句/archive 溯源头/design 声明行/openai.yaml）。

### 第 5 轮（验收门槛，3-contract）

触发正例 1.0／validator ≥9.0／with_skill 断言全过（两实验臂无门槛只沉淀）／评测材料=虚构产品。

### 第 6-7 轮（契约第一轮反思）

三路（红队/验证设计/仓规核对）：必改 4（output 臂虚构命令、D-09 夹缝、report-format 漏网、黑名单无范围）＋防自证锁 5 条＋错位 4（validator 维度、bank_epoch 聚合器产物、trigger 字段名、打包硬编码常量）＋补锁 7，落 v2。第 7 轮 finalize 修复：占位符改写、AC-006 收窄为 discovery+install（npm test 全链含无关既有红）。

### 第 8 轮（契约第二轮反思，v2→v3）

三路（实施预演/修订落地核查/全新红队）发现并全数采纳：**product-adverse-review 为死名**（git b20b8be 已改名 b2b-product-review，枚举与邻域题全部改指新名）、D-09「同步其 SKILL.md」与 7 文件白名单自相矛盾（删该项、记残留风险）、carve-out 不覆盖旧词（实测 11 讲含「目标要求」，扩展到词/串级）、tool-name 门禁 7 处红中 2 处在目标技能自身（协议措辞按勘误 5 换新、另 5 处与本无关修实注记）、勘误扩为 5 条（aggregate-trigger 假旗标/断言组 13→15/design AC-1..AC-9 定义/协议措辞/通用优先级）、AC-003 加步骤 0（symlink 前置＋探针清单以磁盘枚举为准）、双跳 substring 规范化细则（剥 `**`/链接/CRLF）、AC-001 [C] 抽样主体=用户（禁自抽）、check 下限 46→48、预算与中止协议节（spawn 150/run 12/grader 60、超限即停、回滚裁定权=用户、走查由用户执行）、run-tests 断言边界（禁断言聚合器产物防真环）、commit 序列定稿（C1-C4、ceo-copilot description 进 C1 解分笔约束）、workspace scratch 归属、Q4 材料口径落正文、加餐点名消歧、读什么补 4 文档（eval-models/schemas/grader/b2b-product-review）、北极星行为句。正面确认：7 文件白名单、脚本 flag、bank_epoch 机制、一层匹配事实全部属实；锁定 example-run 场景 3 的 schema 示例实为真实字段（此前误报在草案 v1）。

## 设计取舍

### D-1 尺子架构

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 保留旧尺，16 讲做弹药 | 题库九模块不变，案例换 16 讲素材 | 尺子与用户决策域错位持续 | 维度映射重合仅 2-3/14 |
| B（选定） | 整尺更换为 16 讲 14 维度 | 旧身份废弃，五件套全部重做 | 无 |
| C 双尺并存 | 开场选 CEO 尺或产品尺 | agent 现场选尺=漂移路径 | 钢人否决 |

### D-2 wiki 运行时角色

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A slim 按需 | wiki 仅质疑/维护时读 | 建了不读，wiki 正当性只剩维护层 | 用户推翻：「用 wiki 不是为了省 token 吗」 |
| B（选定） | 每维度复盘读对应 S 页取弹药 | token 上升；增益未验证（三臂对照补偿） | 无 |

### D-3 引用尺度

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 短引+讲次纪律 | 每句 ≤70 字 | 核对要出仓 | 用户裁定个人仓无限制 |
| 无限制（选定） | 全文入仓（archive） | public 仓付费内容 git 历史永久化（残留风险在案） | 无 |

### D-4 打包排除机制（第 6 轮新增）

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 全局目录名匹配 | EXCLUDE_DIRS 加 archive | 任何技能的同名目录静默出局 | 副作用面不可控 |
| B 精确路径（选定） | 新增 references/archive/ 精确路径匹配 | 需给 package-skill.mjs 加代码路径 | 无 |
