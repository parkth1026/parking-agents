# aes-qa 测试原则与用户模拟调研

- **Issue**: [#17 调研：测试原则与用户模拟测试实践](https://github.com/parkth1026/parking-agents/issues/17)（Part of #15）
- **日期**: 2026-08-24
- **目的**: 为 aes-qa 权威测试技能（显式 `/aes-qa` 触发；静态分析为第一层、**像用户一样的交互测试为核心层**；报告可辩护）提供原则依据。本报告末尾的「aes-qa 原则条目初稿」将定稿为技能的 `references/principles.md`。
- **方法**: 两条线（经典工程测试原则 / agent 用户模拟实践）的 web 调研。优先一手来源（官方文档、论文原文、作者博客）；WebFetch/搜索结果有损压缩，关键结论均做双源交叉，未能交叉的在文中明确标注。

**可信度标注约定**：
- 【一手】= 抓取到原文（官方站点/论文摘要/作者博客）
- 【一手·摘录】= 一手页面仅获部分内容（如评论线程/摘要页），要点经二级源交叉
- 【二级】= 转述来源，仅用于交叉验证
- 【未验证】= 未能交叉验证，谨慎采信

---

## 一、经典线：工程上真正好的测试怎么做

### 1.1 测试金字塔 vs 测试奖杯

| 维度 | 测试金字塔 | 测试奖杯（Testing Trophy） |
|---|---|---|
| 提出者/推广者 | Mike Cohn（*Succeeding with Agile*, 2009）；Fowler bliki 系统化 | Kent C. Dodds（2018–2019） |
| 形状主张 | 大量单元测试打底，少量集成，最少 E2E（GUI） | 静态/单元/集成/E2E 四层，**集成层最厚** |
| 核心论据 | 高层测试「brittle, expensive to write, time consuming to run」 | 「confidence quotient」随层级上升，集成是 confidence/速度/成本的平衡点 |
| 反模式 | 冰淇淋筒（ice-cream cone）：E2E 过多 | 过度 mock：「removing all confidence in the integration」 |
| 口号 | —— | 「Write tests. Not too many. Mostly integration.」 |

来源：
- Fowler《Test Pyramid》bliki【一手】：Mike Cohn 在 2009 年书中提出（2003–04 与 Lisa Crispin 草绘、2004 年 Scrum 聚会演讲）；「you should have many more low-level UnitTests than high level BroadStackTests running through a GUI」；UI E2E 测试「brittle, expensive to write, and time-consuming」易成冰淇淋筒；高层测试是「second line of test defense」——E2E 失败既意味着 bug 也意味着缺一个单元测试，应先用单测复现再修复。https://martinfowler.com/bliki/TestPyramid.html
- Kent C. Dodds《Write tests. Not too many. Mostly integration.》【一手】：四层（static/unit/integration/E2E）；「Integration tests strike a great balance on the trade-offs between confidence and speed/expense」；覆盖率超过约 70% 后收益递减（作者自称拍脑袋的数）；「You should very rarely have to change tests when you refactor code」；建议「stop mocking so much stuff」。https://kentcdodds.com/blog/write-tests
- Ham Vocke《The Practical Test Pyramid》（martinfowler.com）【未验证·正文不可达】：调研期间该 URL 反复返回 404/超时，无法直接核验；其要点（冰淇淋筒反模式、测试替身分层）经二级源交叉（Symflower、web.dev 均引用该文）。https://martinfowler.com/articles/practical-testing-pyramid.html
- Google Testing Blog《Just Say No to More End-To-End Tests》(Mike Wacker, 2015)【一手·摘录】：正文未抓全，但作者在评论中确认核心论点「It's not just a question of coverage and quality — it's a tradeoff between quality and velocity」；E2E 慢、flaky、难调试。文中广为流传的 70/20/10（small/medium/large 比例）未能在本次抓取中从正文验证，按【未验证】处理。https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html

**对 aes-qa 的启示**：分层与「置信度/成本」权衡是共识；但两层模型都隐含「E2E/交互层贵所以少」的前提——agent 时代交互测试的边际成本大降（见二.2），该前提需要改写，但「交互层验证的是用户旅程而非覆盖率」仍成立。

### 1.2 TDD（Kent Beck）

- Fowler TDD bliki【一手】：TDD 由 Kent Beck 在 1990s 末 XP 中创建；定义「a technique for building software that guides software development by writing tests」；循环 = 写失败测试 → 写实现通过 → 重构（Red-Green-Refactor）；Fowler 强调「thinking about the test first forces us to think about the interface to the code first」（TDD 本质是设计活动）；最常见的失败是跳过第三步重构。https://martinfowler.com/bliki/TestDrivenDevelopment.html
- **对 aes-qa 的启示**：TDD 是「开发时」的节奏，aes-qa 是「验收时」的技能；但「先想接口/行为，再想实现」的顺序同样适用于「先写可运行行为目标与 oracle，再动手测试」。

### 1.3 上下文驱动学派与探索式测试

**七项基本原则**【一手，context-driven-testing.com，Kaner & Bach 维护，出自 *Lessons Learned in Software Testing*（Kaner/Bach/Pettichord）】：
1. 任何实践的价值取决于其上下文（The value of any practice depends on its context）
2. 有上下文中的好实践，没有最佳实践（no best practices）
3. 人，以及人如何协作，是项目上下文中最重要的部分
4. 项目随时间展开的方式往往不可预测
5. 产品是问题的解——问题没解决，产品就没用
6. 好的软件测试是一个富有挑战的智力过程
7. 只有靠判断力与技能（在整个项目中协作地运用），才能在对的时间做对的事

https://context-driven-testing.com/

**探索式测试**【一手·Wikipedia 交叉 satisfice/developsense】：
- 术语由 Cem Kaner 1984 年提出（*Testing Computer Software* 首次出版定义）；定义：「simultaneous learning, test design and test execution」（同时进行的学习、测试设计与测试执行）；Kaner 强调「个人自由与责任」的风格，学习/设计/执行/解释是全程并行的相互支持活动；从「略带探索」到「高度探索」是一个连续谱，不是非黑即白。
- **Session-Based Test Management（SBTM）**：为了让探索式测试「auditable and measurable」而设计（charter + session + 报告）。
- 效果证据：Wikipedia 引用的研究发现探索式与脚本测试的缺陷检出**效果相当、效率更高**（单位时间发现缺陷更多），测试者知识是关键变量。
https://en.wikipedia.org/wiki/Exploratory_testing

**对 aes-qa 的启示**：「没有最佳实践」直接决定 aes-qa 不能是死清单，必须按上下文推导策略；SBTM 的 charter/session/debrief 结构是「agent 探索式测试可审计化」的现成模板——这正是 aes-qa 报告可辩护性的结构来源。

### 1.4 HTSM（启发式测试策略模型）

【一手，satisfice.com 官方下载页】HTSM v6.3（2024-12-02 发布，James Bach；被引/下载超 10 万次）：
- 定位：「a set of guideword heuristics designed to help you think better about test strategy」，明确「is pretty generic to any kind of software」；
- 四大区域：**test techniques / project elements（项目环境）/ product factors（产品元素）/ quality criteria（质量标准）**；
- 使用方式：可松可严（「casually or rigorously」），且鼓励「modify this to fit the context of your own organization」——即 HTSM 是可改写的思维脚手架，不是标准。
- 结构细节【二级交叉，rapid-software-testing.com / Cheesecake Labs】：Product Elements（结构/功能/数据/平台/操作/时间…）、Quality Criteria（操作性/开发性/感知性质量）、Project Environment（客户/信息/开发关系/测试团队/工具/日程/交付物）。
https://www.satisfice.com/download/heuristic-test-strategy-model

**对 aes-qa 的启示**：agent 缺人类测试者的隐性经验，HTSM 的 guideword 恰好是把「资深测试者脑内的检查清单」显式化的产物——可注入 agent 作为测试策略生成的骨架；且官方明确允许改编，aes-qa 应做一份裁剪版（按产品类型）而非照抄。

### 1.5 测试 oracle 问题（怎么判定「对」）

- 术语与问题【一手·Wikipedia 词条，交叉 Barr et al.】：oracle 由 William E. Howden（1978）提出：「a provider of information that describes correct output based on the input of a test case」；oracle 问题 = 为任意输入确定正确输出本质上很难（可控性/可观察性问题），是测试的公认瓶颈。
- 权威综述：Barr, Harman, McMinn, Shahbaz, Yoo, *The Oracle Problem in Software Testing: A Survey*, **IEEE TSE 41(5):507–525, 2015**, DOI 10.1109/TSE.2014.2372785【经 Wikipedia 引文条目验证，正文未直接抓取】。分类：**specified**（形式规约/契约断言）、**derived**（伪 oracle=独立参考实现、partial oracle=只断言部分性质，如蜕变关系）、**implicit**（隐含假设：崩溃即缺陷；fuzzing/PBT 属此类，易假阳性）、**human**（人类判断，靠启发式）。
https://en.wikipedia.org/wiki/Test_oracle

**对 aes-qa 的启示（本次调研最重要的一条）**：人类测试者一直靠「human oracle」兜底；agent 测试时 human oracle 缺位，oracle 设计从「隐含」变成「显式且决定性」——每个行为目标必须先声明用什么 oracle（断言/性质/蜕变/参考实现/人审），否则「测过了」不可辩护。这与 Barr 分类直接映射。

### 1.6 Property-Based Testing（QuickCheck / Hypothesis）

【一手，hypothesis.works】：
- 与示例测试的差别：示例测试「选具体输入、断言具体输出」；PBT「写对所有输入都应成立的性质」，工具随机生成输入探测「edge cases you might not have thought about」。
- **shrinking**：发现失败后自动最小化，「it reports the simplest possible one」——反例可最小化，直接服务调试。
- QuickCheck（Haskell，John Hughes 等）是这一流派的源头【二级共识，hypothesis.works 页面本身未提及】；Hypothesis 自称「the most widely used property-based testing library in the world」。
https://hypothesis.works/

**对 aes-qa 的启示**：agent 生成的交互是随机性极高的输入流，天然适合「性质断言」而非「精确期望值」（如「任意顺序操作购物车后，总价必 ≥ 0 且等于各行之和」）；shrink 思想对应「把失败交互轨迹最小化后写进报告」。

### 1.7 Mutation Testing（测测试本身）

【一手·ACM DL + UW 作者摘要页】Just, Jalali, Inozemtseva, Ernst, Holmes, Fraser, *Are mutants a valid substitute for real faults in software testing?*, **FSE 2014**（5 个真实开源项目、人工+自动生成的测试套件）：
- 结论：**mutation score 与真实缺陷检出能力存在统计显著的相关性，且独立于代码覆盖率**（UW 摘要原文：「A statistically significant correlation between mutant detection and real fault detection, independent of code coverage」）。
- 即：杀变异体能力强的测试套件确实更能抓真 bug——「测测试本身」有实证支撑。
- 复证：Papadakis et al. 2018 *Are Mutation Scores Correlated with Real Fault Detection?* 复制扩展研究。
- 工具【常识级，未逐一验证】：JVM 生态 PIT、多语言 Stryker、PITest/Cargo 等。
https://dl.acm.org/doi/10.1145/2635868.2635929 ；https://homes.cs.washington.edu/~mernst/pubs/mutation-effectiveness-fse2014-abstract.html

**对 aes-qa 的启示**：aes-qa 的产出（测试过程与报告）本身需要被验证——「这个技能真的能发现 bug 吗」可用变异思想做金标准实验：往被测系统注入已知缺陷，看 aes-qa 能否抓到（漏报率检查）。

### 1.8 Flaky 测试治理

- **Google Testing Blog《Flaky Tests at Google and How We Mitigate Them》(John Micco, 2016)**【一手·摘录】：定义「a test that exhibits both a passing and a failing result with the same code」；治理：持续检测、把 flaky 测试**从阻塞判定中移出（隔离/quarantine）**、只对标记过的 flaky 测试允许 rerun（避免用重跑掩盖新问题）、优先根因修复。https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html
- 数据【二级转述，Talent500/VT 课件，未在正文直接核验】：Google 约 1.5% 的自动化测试运行表现为 flaky；测试越大越易 flaky（与 WebDriver/E2E 相关的测试 flakiness 显著更高）。
- **根因实证**：Luo, Hariri, Eloussi, Marinov, *An Empirical Analysis of Flaky Tests*, **FSE 2014**【一手·ACM 条目】：首个 flaky 根因实证分类（微软 6 个大型项目）；**async wait（异步等待）是第一大根因**（Parry et al. 2022 survey 引其中约 18%），其次并发、测试顺序依赖、网络/IO。https://dl.acm.org/doi/10.1145/2635868.2635920
- 综述：Parry et al., *A Survey of Flaky Tests*, 2022（White Rose 存档）；Tahir et al. 2023 *Test flakiness' causes, detection, impact and responses*。

**对 aes-qa 的启示**：LLM 交互测试天然非确定性（模型输出、页面时序、网络），flaky 比例会远高于传统单测——隔离区、重跑上限、按目标聚合「通过率」而非单次结果、根因优先（等待/时序显式化）必须内建，不能事后补。

### 1.9 核心问题：测试者从人变成 agent，哪些原则仍成立、哪些必须改写

| 原则 | 人 → agent 后 | 论断 | 证据锚点 |
|---|---|---|---|
| 分层与置信度/成本权衡 | **仍成立** | 便宜层（静态/单测）仍应先跑、多跑 | Fowler bliki；Dodds trophy |
| 高层测试是「第二道防线」，验证用户旅程而非覆盖率 | **仍成立** | 交互层只测关键旅程，不追求全覆盖 | Fowler「second line of defense」；Google E2E 文 |
| 无最佳实践，策略取决于上下文 | **仍成立且更重要** | agent 更容易套模板，需强制先做上下文分析 | context-driven 七原则 #1、#2 |
| Oracle 必须显式设计 | **从重要变成决定性** | human oracle 缺位，LLM judge 有偏差（见 2.3），oracle 不显式则结论不可辩护 | Barr 2015 oracle 问题；MT-Bench/AgentRewardBench |
| 探索式测试 = 学习/设计/执行并行 | **仍成立，agent 反而占优** | agent 快、不知疲倦、可并行探索；但缺隐性知识，需 HTSM/persona 显式注入 | Kaner 探索式定义；HTSM 可改编 |
| 探索式要可审计 | **仍成立** | charter/session/debrief 结构直接适用 agent | SBTM |
| E2E/交互层贵所以要少 | **必须改写** | agent 使交互测试边际成本大降（browser agent 一晚可跑成百上千会话）；真正的稀缺变成 oracle 与判定，不是执行 | WebArena 基线提升（14%→60%）；browser-use/Playwright MCP 成本结构 |
| 确定性断言（精确期望值） | **必须放宽** | 非确定性输出下应改为性质/蜕变断言 + 多次运行统计 | Hypothesis PBT；LLM 非确定性 |
| 人是终极 oracle | **必须改写为「人审抽样」** | LLM judge 可承担大部分判定但需校准、交叉、可疑处升级人审 | MT-Bench >80% 但有偏差；AgentRewardBench 无单一最优 judge |
| 覆盖率作为主要指标 | **必须改写** | agent 交互测试的「覆盖」应度量「行为目标覆盖率/旅程完成率」，代码覆盖率退居辅助 | Dodds 覆盖率递减收益；Google quality-vs-velocity |
| flaky 治理（隔离/重跑/根因） | **仍成立且更严** | LLM 测试 flaky 率天然更高，重跑必须有限且不可用于「绿化工单」 | Google flaky 定义与隔离；Luo 2014 |

---

## 二、用户模拟线：「像用户一样测试」的行业实践

### 2.1 simulated user / LLM-as-user：研究与工业

| 工作/产品 | 是什么 | 关键结果 | 来源 |
|---|---|---|---|
| **UXAgent**（arXiv 2504.09407, 2025） | LLM agent 扮演可用性测试参与者：Persona Generator（可生成上千模拟用户）+ LLM Agent + Universal Browser Connector（真实浏览器交互）+ Result Viewer（问卷/交互日志/事后访谈） | 16 位 UX 研究者启发式评估：肯定创新性，但「expressed concerns about the future of LLM Agent usage in UX studies」；定位是**真人研究前的 dry-run** | https://arxiv.org/abs/2504.09407 |
| **用户模拟器评估研究**（arXiv 2605.02624 等） | 评估多轮交互中 LLM 用户模拟器的保真度 | 发现模拟用户「struggle at capturing the communication frictions that real users introduce」——模拟不出真实用户的摩擦（打错字、误解、不耐烦） | https://arxiv.org/abs/2605.02624 ；https://arxiv.org/html/2403.09738v4 |
| **EY × Aaru 多智能体模拟** | 用 Aaru 平台的多 agent 模拟复现 EY 的 3,600 人真实调研 | 合成数据逼近真实调研结果，「one day versus six months」 | MeasuringU 综述【二级转述】https://measuringu.com/review-of-experiments-with-synthetic-users/ |
| **NN/g 反方观点** | Nielsen Norman Group 对 synthetic users 的批评 | 合成用户只有有限用途，用户研究仍需真人；学界（ACM Interactions 2026）认为适合快速假设生成、本质受限 | https://www.nngroup.com/articles/synthetic-users/ |
| **MeasuringU 综述** | 12 项同行评审合成用户研究的回顾 | 结论：合成用户对「已知分布的群体态度」逼近度较好；对「新产品首次反应」等外推能力证据不足 | https://measuringu.com/review-of-experiments-with-synthetic-users/ |

**判断**（多源交叉后）：LLM-as-user 已可用于「结构化、有明确正确行为可对照的任务级模拟」（表单、流程、旅程）；用于「主观体验/偏好外推」（可用性感受、满意度）仍不可靠，学界与工业均明确保留。aes-qa 的「像用户一样测试」应限定在前者——**行为模拟而非体验模拟**。

### 2.2 browser agent 做交互测试

| 工具/机制 | 要点 | 对测试的意义 | 来源 |
|---|---|---|---|
| **Playwright MCP**（微软官方） | 「enabling LLMs to interact with web pages using structured accessibility snapshots」——LLM 驱动浏览器走**可访问性树而非像素**（「no vision models required」）；默认 headed、支持 `--isolated`（每次全新会话）、会话/cookie 持久化、mock 网络响应、读 console | 交互测试的可靠通道：结构化元素引用（ref=id）比截图点击稳定得多；isolated 模式即测试隔离 | https://playwright.dev/docs/getting-started-mcp |
| **browser-use**（开源） | 「lets an AI agent use a web browser the same way humans do」；MIT 协议；110k+ stars（2026-08）；支持多模型、自定义工具、Cloud 版 | 通用 browser agent 生态成熟度的标志；FAQ 明确把 QA 列为用途（scheduled/parallel QA） | https://github.com/browser-use/browser-use |
| computer use 类（Anthropic 等） | agent 直接操作系统级 GUI | 覆盖非 Web 应用的交互测试（本次未深挖，方向性引用） | —— |

**判断**：工具层已就绪且趋同（结构化快照 + 工具调用）；「像用户一样」的实现正从「截图+视觉模型」迁移到「accessibility tree + 语义操作」，后者更稳定、可断言、可回放——aes-qa 应规定优先走结构化通道，视觉仅作补充证据。

### 2.3 agent 能力基线与效果证据（能否真的「像用户一样完成任务」）

- **WebArena**（arXiv 2307.13854, 2023；引 2000+）【一手·arXiv 摘要 + 官网】：真实自托管网站（电商/CMS/论坛）上的 agent 任务基准；发布时最佳 agent 端到端任务成功率 **14.41%，人类 78.24%**。https://arxiv.org/abs/2307.13854 ；https://webarena.dev/
- **进展**【二级，EmergentMind/Medium 交叉】：两年内 SOTA 提升到约 60%（WebArena leaderboard 单 agent 记录 ~61.7%）。
- **判断**：agent「像用户一样完成任务」的能力真实存在但**远未到人类水平**（~60% vs 78%）。对 aes-qa 的直接推论：(a) 单次 agent 运行不能作为「功能不可用」的充分证据（可能是 agent 失败而非产品失败）；(b) 任务失败需要区分「产品缺陷」与「agent 能力不足」两类归因——这本身就是一个 oracle 问题。

### 2.4 LLM-as-judge：用 LLM 判定「对不对」的证据（oracle 的 agent 化）

| 证据 | 关键数字 | 含义 | 来源 |
|---|---|---|---|
| **MT-Bench / Chatbot Arena**（Zheng et al., NeurIPS 2023） | GPT-4 judge 与人类偏好一致率 **>80%**，「the same level of agreement between humans」；同时识别出 **position bias、verbosity bias、self-enhancement bias** | LLM judge 可用且接近人类间一致性，但有系统性偏差需缓解（换序、参考答案等） | https://arxiv.org/abs/2306.05685 |
| **AgentRewardBench**（McGill NLP, arXiv 2504.08942） | 1,302 条 web agent 轨迹 × 5 基准 × 4 agent，专家标注 success/side effects/repetitiveness；评测 **12 个 LLM judge**：「no single LLM excels across all benchmarks」；rule-based 评估器**系统性低估** agent 成功率 | 评估「agent 是否完成用户任务」时：规则 oracle 漏报真成功，LLM judge 各有所长且随场景漂移——judge 需要按场景校准 | https://arxiv.org/abs/2504.08942 ；https://agent-reward-bench.github.io/ |

**判断**：这是对 aes-qa 最关键的一组证据。「agent 像用户测试 + LLM 判定结果」的双 agent 架构可行，但判定层必须：(1) 显式 rubric 而非自由心证；(2) 关键结论多 judge/多源交叉；(3) 规则断言与 LLM 判定互补（规则防漏报真成功，LLM 防规则僵硬）；(4) 可疑/高风险结论升级人审。

### 2.5 对抗性 QA / 红队式验收

- **Microsoft PyRIT**（Python Risk Identification Tool）【一手·官方文档 + GitHub + 微软安全博客】：面向生成式 AI 的「automated and human-led AI red teaming」开源框架；微软官方明确 **PyRIT「is not a replacement for manual red teaming」——自动化红队增强而非替代人的领域专长**。https://azure.github.io/PyRIT/ ；https://www.microsoft.com/en-us/security/blog/2024/02/22/announcing-microsofts-open-automation-framework-to-red-team-generative-ai-systems/
- 学术描述【一手·arXiv 2410.02828】：model/platform-agnostic，探测 jailbreak 与新型伤害。
- **对交互测试的迁移**：红队的核心方法论——「假设系统会被用坏，主动构造敌意输入」（prompt injection、越界输入、破坏性操作序列）——可直接迁移为 aes-qa 的「对抗性用户模拟」环节：把「用户会怎么搞坏」作为标准测试维度，而不是只测 happy path。人机分工结论（自动化扩大覆盖、人保留判断）同样适用。

### 2.6 混沌工程思想的适用面

【一手，principlesofchaos.org】五原则：围绕**稳态行为**建假设（关注可度量的输出而非内部属性——「Chaos verifies that the system does work, rather than trying to validate how it works」）；变体必须是**真实世界事件**（按影响或频率排序）；尽量在生产运行；**自动化持续运行**；**最小化爆炸半径**。https://principlesofchaos.org/

**对交互测试的映射与边界**（推论，非来源原文）：
- 可迁移：稳态 = 「用户核心旅程可完成」的可观测指标；变体 = 真实用户行为扰动（慢网络、元素延迟、重复提交、中途放弃、错误输入后重试）；最小爆炸半径 = 隔离环境 + 隔离数据（对应 Playwright `--isolated`）。
- 不可迁移/需谨慎：混沌工程主张「在生产做实验」；aes-qa 面向验收测试，默认应在隔离/预发环境注入扰动，「生产」仅适用于只读旅程或专门的混沌演练，且破坏性操作必须有数据边界。

### 2.7 谁在做「agent 替用户做探索式验收」，效果证据如何

| 主体 | 做法 | 效果证据 | 来源 |
|---|---|---|---|
| **WebProber**（Columbia, arXiv 2509.05197, 2025） | 仅给 URL，agent「autonomously explores the website, simulating real user interactions」，输出人类可读的 bug/可用性报告 | 案例研究：120 个学术个人网站发现 **29 个可用性问题，其中多数为传统工具遗漏**【一手·arXiv 摘要】 | https://arxiv.org/abs/2509.05197 |
| **QA.tech** | 商用 AI QA agent：E2E、回归、**探索式**、PR 测试 | 官网宣称（营销口径，无第三方验证）【二级】 | https://qa.tech/ |
| **Test IO Agentic QA** | AI agent 网络自主探索 Web 应用、生成并执行测试、自适应环境变化 | 厂商宣称【二级】 | https://test.io/ai-in-qa/agentic-qa |
| **UXAgent**（同 2.1） | 千级模拟用户跑可用性测试 dry-run | 16 位 UX 研究者定性认可+存疑【一手·摘要】 | https://arxiv.org/abs/2504.09407 |

**判断**：学术侧已有原型与初步效果证据（WebProber：agent 发现传统工具遗漏的可用性问题）；工业侧产品化迅速但公开、可复核的效果证据仍以厂商自述为主——「效果证据不足」是当前诚实结论。对 aes-qa：技能内部应自带小规模金标准实验（如变异注入）来积累自己的效果证据，而不是引用厂商宣称。

---

## 三、对 aes-qa 的综合启示（调研结论）

1. **oracle 是 agent 测试的阿喀琉斯之踵，也是技能的核心竞争力所在。** 人类测试体系里「人对不对」是隐含兜底；agent 体系里 oracle 必须显式（Barr 分类）+ 可靠（MT-Bench 偏差、AgentRewardBench 场景漂移）+ 可升级（人审抽样）。aes-qa 报告的每一条结论都要能回答「凭什么说对/错」。
2. **「像用户一样测试」应该定义为行为模拟，不是体验模拟。** 任务/旅程级模拟有证据支撑（WebArena 能力、WebProber 发现、UXAgent 架构）；主观体验外推（满意度/偏好）证据不足且被权威方（NN/g）明确质疑——aes-qa 不应宣称后者。
3. **分层结构保留，成本模型改写。** 静态分析第一层（便宜、确定性）；单测/集成为第二层；**用户模拟交互从「少而贵」变为「核心层、可大量并行」**；同时新增性价比意识：执行变便宜了，判定变贵了。
4. **探索式 + 可审计是 agent 的优势组合。** agent 天然符合探索式「学习-设计-执行并行」，SBTM 的 charter/session/debrief 让它可辩护；HTSM guidewords 与 persona 矩阵补上「隐性知识」缺口。
5. **非确定性治理必须内建。** 多次运行 + 通过率统计 + flaky 隔离 + 重跑上限 + 轨迹最小化（shrink 思想），这些不是工程细节，是 agent 测试成立的前提。

---

## 四、aes-qa 原则条目初稿

> 每条 = 原则一句话 + 为什么（证据/来源） + 在 aes-qa 里怎么落地。定稿后成为 `references/principles.md`。共 16 条，按「总纲 → 目标与 oracle → 分层执行 → 用户模拟 → 判定与证据 → 治理与自我校验」排序。

### 总纲

**P1. 一切输入先变成「可运行行为目标」，没有行为目标就不开始测试。**
- 为什么：上下文驱动原则 5「产品是问题的解——问题没解决，产品就没用」；TDD「先想行为再想实现」（Fowler TDD bliki）。代码变更与需求文档只有转成可判定的行为目标，后续测试才可辩护。
- 落地：`/aes-qa` 第一步输出「行为目标清单」（每条：目标一句话 + 触发条件 + 预期可观测结果 + 来源锚点），作为后续所有测试的合同；无法推导出行为目标的范围必须明示「未覆盖」。

**P2. 没有最佳测试实践：策略必须从产品上下文推导，禁止无脑套清单。**
- 为什么：上下文驱动七原则 1/2（「任何实践的价值取决于其上下文」「没有 best practices」）。
- 落地：测试策略生成前强制走一遍裁剪版 HTSM 上下文扫描（产品类型/项目环境/质量标准），报告里「为什么这样测」一节须引用扫描结论；同一技能对不同项目允许产出完全不同的策略。

**P3. 报告可辩护：任何「通过/成功」的宣称必须挂可复现证据，无证据一律写「未验证」。**
- 为什么：mutation 研究证明测试声明本身需要验证（Just et al. 2014）；SBTM 存在的意义即让测试可审计；aes-qa 的立身之本。
- 落地：每个结论的取证包 = 交互轨迹（结构化步骤）+ 关键截图/console + 判定依据；报告模板固定「已验证 / 部分验证 / 未验证」三档措辞，禁止把「没发现问题」写成「功能正常」。

### 目标与 oracle

**P4. Oracle 先行：先声明「怎么判定对错」，再执行测试；oracle 缺位的行为目标不得进入执行队列。**
- 为什么：oracle 问题是软件测试公认瓶颈（Howden 1978；Barr et al. 2015 IEEE TSE）；agent 时代 human oracle 缺位，oracle 从隐含变显式且决定性。
- 落地：行为目标卡上 oracle 字段必填，取值限定为枚举：精确断言 / 性质断言 / 蜕变关系 / 参考实现对比 / LLM judge（须附 rubric）/ 人审；执行器拒绝运行无 oracle 的目标。

**P5. LLM judge 可用但必须校准：显式 rubric、关键结论多源交叉、可疑即升级人审。**
- 为什么：MT-Bench——GPT-4 judge 与人类 >80% 一致（接近人类间一致性）但存在 position/verbosity/self-enhancement 偏差；AgentRewardBench——12 个 judge「无单一最优」且随基准漂移。
- 落地：LLM 判定必须基于写下来的 rubric（逐条对照，不整体打分）；高风险目标（资金、数据删除、权限）双 judge 交叉或直接人审；judge 结论在报告中标注为「判定置信度：中」并留轨迹。

**P6. 规则断言与 LLM 判定互补，缺一不可。**
- 为什么：AgentRewardBench 发现纯规则评估器系统性低估 agent 真实成功率（漏报成功），纯 LLM 判定有偏差（误报成功）——两类错误方向相反。
- 落地：每个行为目标至少有一条确定性检查（HTTP 状态/DOM 断言/数据落库）+ 一条语义检查；两者矛盾时按「保守报告」处理（报告冲突，不宣称成功）。

### 分层执行

**P7. 静态分析永远第一层：能静态发现的就不进运行时。**
- 为什么：金字塔/奖杯的共识底座——最便宜的检查放最底层（Dodds 的 static 层；Fowler 金字塔的 unit 底座同理）。
- 落地：`/aes-qa` 固定首步 = 静态层（类型/lint/依赖/配置/危险模式扫描），产出直接计入证据；静态已证伪的目标直接记失败，不浪费交互预算。

**P8. 用户模拟交互测试是核心层而非点缀：按「关键用户旅程全覆盖、边缘旅程抽样」分配预算。**
- 为什么：Fowler「高层测试是第二道防线」验证的是旅程不是覆盖率；Google E2E 文强调 quality-vs-velocity 权衡；agent 时代交互层边际成本大降（browser-use 生态、Playwright MCP），原「E2E 少而贵」前提失效，但判定成本上升，故旅程级聚焦仍必要。
- 落地：从行为目标推导「旅程清单」，核心旅程（收入/数据安全/主流程）100% 跑，其余按风险抽样；单旅程预算（步数/时长/token）封顶。

**P9. 交互测试优先走结构化通道（accessibility tree / 语义操作），视觉仅作补充证据。**
- 为什么：Playwright MCP 官方设计——结构化快照比像素/截图点击稳定（「no vision models required」）；ref 式元素引用天然可断言、可回放。
- 落地：执行器规定：能 ref 定位绝不坐标点击；截图用于取证与视觉回归，不用于驱动操作主路径。

### 用户模拟

**P10. 「像用户一样」= 行为模拟，不宣称体验模拟。**
- 为什么：任务级模拟有证据（WebArena 能力曲线、WebProber 发现、UXAgent 架构）；体验/偏好外推被 NN/g 与学界明确质疑（合成用户用途有限；模拟不出真实用户的「沟通摩擦」）。
- 落地：persona 限定为行为差异（新手/老手/急躁/极端输入），输出措辞禁止「用户会喜欢/满意」类主观断言，只报告「旅程能否完成、何处受阻、代价几步」。

**P11. Persona 矩阵必含对抗性用户：把「用户会怎么搞坏」当标准环节。**
- 为什么：红队方法论（PyRIT：主动构造敌意输入；微软声明自动化红队扩大覆盖）；混沌工程「变体 = 真实世界事件」；探索式测试的价值恰恰在脚本外。
- 落地：每个核心旅程至少跑三种 persona：正常用户、误操作用户（错误输入/中途放弃/重复提交）、敌意用户（越权/注入/破坏性操作序列）；对抗性发现单列报告节。

**P12. 隐性知识显式注入：用裁剪版 HTSM guidewords + 领域 checklist 补 agent 的经验缺口。**
- 为什么：人类探索式测试效果依赖测试者知识（Wikipedia 引研究）；HTSM 官方定位即「把资深测试思维显式化的 guideword 集合」且明确鼓励改编（satisfice v6.3）。
- 落地：技能内置按产品类型的 HTSM 裁剪表（Web 表单/支付流/权限系统…），生成测试策略与探索 charter 时强制对照；guidewords 随技能迭代维护。

**P13. 探索式与回归分离：探索产出发现，发现的缺陷固化为可重跑的行为目标回归资产。**
- 为什么：Kaner 探索式-脚本连续谱；SBTM 让探索可审计；Fowler「E2E 失败 → 补一条低层测试复现」的固化思想。
- 落地：探索 session 用 charter（目标/范围/时长）驱动，debrief 产出「发现列表」；每个确认的缺陷生成一条回归行为目标（含最小复现轨迹）进入回归库，下次变更自动重跑。

### 判定与证据

**P14. 非确定性是常态：同一行为目标多次运行，报告通过率与最小失败轨迹，不报单次结论。**
- 为什么：Google flaky 定义（同代码双结果）；LLM 交互天然随机；Luo 2014 证明时序/等待是 flaky 首因；Hypothesis 的 shrink 思想（报告最小反例而非任意反例）。
- 落地：核心目标默认 N 次运行（N 按风险 3–10），报告「N 中 M 次通过」+ 失败轨迹最小化（去掉无关步骤后仍复现）；单次失败且不可复现的标注「疑似 flaky」并进入隔离流程，不得静默重跑到绿。

### 治理与自我校验

**P15. flaky 三步治理内建：隔离区、重跑上限、根因修复优先。**
- 为什么：Google 实践——flaky 测试移出阻塞判定、仅对标记者允许 rerun、根因优先（async wait 是首因，Luo 2014）；「重跑到绿」会摧毁信号（Google 博客立场）。
- 落地：连续 flaky 的目标自动进隔离区（不阻塞结论但显著提示）；重跑上限默认 2 次；等待/时序必须显式（显式等待条件，禁用盲 sleep）；隔离区条目有根因跟踪。

**P16. 测测试本身：定期用变异/金标准实验校验 aes-qa 的检出能力，效果证据自己挣。**
- 为什么：mutation score 与真实缺陷检出显著相关且独立于覆盖率（Just et al. FSE 2014）；工业 agent-QA 产品缺乏第三方效果证据（本次调研结论），aes-qa 不应重蹈。
- 落地：技能自检清单：对样例项目注入已知缺陷（人工 mutation），统计 aes-qa 漏检率并随版本跟踪；judge 层定期用人工标注样本复测一致性（AgentRewardBench 方法论），一致性退化即降级 judge 权重。

---

## 五、来源总清单

**经典线**
- [Fowler: Test Pyramid bliki](https://martinfowler.com/bliki/TestPyramid.html)
- [Dodds: Write tests. Not too many. Mostly integration.](https://kentcdodds.com/blog/write-tests)
- [Vocke: The Practical Test Pyramid](https://martinfowler.com/articles/practical-testing-pyramid.html)（正文当前不可达，二级交叉）
- [Google Testing Blog: Just Say No to More End-To-End Tests](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html)
- [Google Testing Blog: Flaky Tests at Google and How We Mitigate Them](https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html)
- [Fowler: TestDrivenDevelopment bliki](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
- [Context-Driven Testing 七原则](https://context-driven-testing.com/)
- [Wikipedia: Exploratory testing](https://en.wikipedia.org/wiki/Exploratory_testing)
- [Satisfice: Heuristic Test Strategy Model v6.3](https://www.satisfice.com/download/heuristic-test-strategy-model)
- [Wikipedia: Test oracle](https://en.wikipedia.org/wiki/Test_oracle)（含 Barr et al. 2015 引文）
- [Just et al. 2014, Are mutants a valid substitute for real faults? (ACm FSE)](https://dl.acm.org/doi/10.1145/2635868.2635929) / [UW 摘要页](https://homes.cs.washington.edu/~mernst/pubs/mutation-effectiveness-fse2014-abstract.html)
- [Luo et al. 2014, An Empirical Analysis of Flaky Tests (ACM FSE)](https://dl.acm.org/doi/10.1145/2635868.2635920)
- [Hypothesis 官网](https://hypothesis.works/)
- [Parry et al. 2022, A Survey of Flaky Tests](https://eprints.whiterose.ac.uk/id/eprint/230095/1/parry2021.pdf)

**用户模拟线**
- [WebArena (arXiv 2307.13854)](https://arxiv.org/abs/2307.13854) / [webarena.dev](https://webarena.dev/)
- [UXAgent (arXiv 2504.09407)](https://arxiv.org/abs/2504.09407)
- [WebProber (arXiv 2509.05197)](https://arxiv.org/abs/2509.05197)
- [多轮用户模拟评估框架 (arXiv 2605.02624)](https://arxiv.org/abs/2605.02624)
- [Generative User Simulators 评估 (arXiv 2403.09738)](https://arxiv.org/html/2403.09738v4)
- [MT-Bench / Judging LLM-as-a-Judge (arXiv 2306.05685)](https://arxiv.org/abs/2306.05685)
- [AgentRewardBench (arXiv 2504.08942)](https://arxiv.org/abs/2504.08942) / [项目站](https://agent-reward-bench.github.io/)
- [Playwright MCP 官方文档](https://playwright.dev/docs/getting-started-mcp)
- [browser-use (GitHub)](https://github.com/browser-use/browser-use)
- [Microsoft PyRIT 文档](https://azure.github.io/PyRIT/) / [微软公告：不替代人工红队](https://www.microsoft.com/en-us/security/blog/2024/02/22/announcing-microsofts-open-automation-framework-to-red-team-generative-ai-systems/) / [PyRIT 论文](https://arxiv.org/html/2410.02828v1)
- [Principles of Chaos Engineering](https://principlesofchaos.org/)
- [MeasuringU: A Review of Experiments with Synthetic Users](https://measuringu.com/review-of-experiments-with-synthetic-users/)
- [NN/g: Synthetic Users](https://www.nngroup.com/articles/synthetic-users/)
- [QA.tech](https://qa.tech/) / [Test IO Agentic QA](https://test.io/ai-in-qa/agentic-qa)（厂商自述，效果证据不足）

## 六、不确定性与局限（诚实声明）

1. **未能一手核验**：Ham Vocke《The Practical Test Pyramid》正文（URL 反复 404，要点靠二级源交叉）；Google E2E 文的 70/20/10 数字（正文未抓全）；Google flaky 的 1.5%/16% 统计（仅二级转述）；QuickCheck 起源的归属细节（hypothesis.works 未自述）。
2. **厂商宣称未独立验证**：QA.tech / Test IO 的效果数据均为营销口径；browser-use 的「3-5x faster」「Odysseys 榜单第一」为自述。
3. **WebArena SOTA ~60% 来自二级追踪**（EmergentMind 等），一手论文只有发布时基线 14.41%。
4. 2026 年该领域迭代极快，本报告快照日期 2026-08-24，工具层结论（2.2）保鲜期预计 6–12 个月。
