# grilling 全案例研究：大任务 Spec、拆分与验收的真正改进点

日期：2026-08-31。研究对象是当前 parking-agents-manual 仓库 grilling 下的全部历史案例。本文替代“只凭一个AesAgent案例推断整体能力”的讨论范围，不取代已确认的产品决定，也不授权实施。

## 1. 结论先行

**你的方向得到这些案例支持：大任务需要总体承诺、可执行的任务分解、依赖关系和独立验收。但更准确的制作方向，不是简单给 workflow-interview 再接上 to-spec 和 to-tickets，而是让已有的好做法形成一致、可恢复、可核对的交付流程。**

这次全案例调查要求我修正此前讨论的三个倾向：

1. **不能说历史上没有总规格和拆票。** Board升级已有“总体契约作验收伞＋执行依赖图”；Merge Worker/Outbox已按职责拆分；#147早已讨论总体Spec、分波推进、发现回流与最终集成验收。这些是历史模式和个别机制，不等于当前所有入口都有统一完整协议。
2. **不能把庞大任务都强制拆开。** NAS迁移、图表能力与对标发布改造都存在用户明确要求合并交付的记录；Creator布局修复也可以由一份有界契约表达。适合拆的是能够分出可验证边界的工作，不是达到某个AC数量就必须拆。
3. **不能先把本次目标缩成“只交任务包”。** #147的用户原话已明确“分太多管理不过来、合一起上下文爆炸”，又要求分波验收与回流。我前面直接提出这个范围候选偏早，应先核对这些既有决定的适用性。但这也不能自动推出本次要重造一个Agent调度Runtime：同一案例P11/P12明确否决了这种扩张。

**最关键的缺口是：最新决定、总体规格、子任务、验证证据与最终完成状态之间，缺少在各入口稳定生效的对应关系；部分验收判据和样例本身还需要一致性检查。**更多文档可以改善表达，但只有这些对应关系被生成、检查并被执行端使用，才能减少遗漏。

## 2. 覆盖范围与方法

实际根目录：

G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling

用户输入中的 AI/_WorkFlow 路径不存在，本轮使用实际存在且名称对应的 AI_WorkFlow。

本轮共清点 **20个目录，其中19个历史案例，另1个是本次研究/访谈现场**。19例共 **508个文件、18,381,670 bytes**。本次现场不作为历史成功或失败样本；之前的 aes-agent-manual 工作台案例也不混入这19例。

全量覆盖的含义：

- 19例均逐例核对 manifest、context 和 rounds；#147的63条事件按问题、回答与已选分支投影阅读，并核对关键反转原文。
- 读取全部存在的15份正式 contract.md及verify记录；#160另读契约候选/确认JSON。
- 每例先列全部产物，再定向核对正式行为表、必要接口/场景、历史修订、验收附件及已发现的后续源码/提交指针。
- 历史稿、生成视图、全部图片没有逐份逐像素审核。Web访谈例查看了选定PNG，其余视觉评价主要按已有QA记录限定报告。**508是清点数，不是本轮独立验收508个文件。**
- 没有运行历史Verify、修改旧案例、刷新远端tracker、启动服务或消费真实Provider。本轮的全新验证仅限文件/记录解析、摘要核对和Git只读查证。

基线HEAD为 f4e37757b9f3d5627c7636626f579d87d523bc37。已有未提交研究报告保留。本轮只写新的研究报告和当前访谈facts/context/rounds/manifest；后两者只经session.mjs更新。

本地保存状态为15例ready、4例in_progress；15份正式契约共92条AC。**这些不是成功率：ready主要表示访谈交接，in_progress可以是正常未完成设计；同一产品的连续演进案例也不是独立随机样本。**

机器清单：
- [初始文件清单与关键摘要](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-31-large-task-spec-ticket-delivery/1-interview/facts/corpus-inventory-start.json)
- [15份契约及历史验证索引](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-31-large-task-spec-ticket-delivery/1-interview/facts/corpus-contract-index.json)
- [结束时全文件摘要](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-31-large-task-spec-ticket-delivery/1-interview/facts/corpus-snapshot-end.json)与[前后快照对账](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-31-large-task-spec-ticket-delivery/1-interview/facts/corpus-consistency-check.json)：截至2026-08-31 23:36（UTC+8），19例的89个关键文件摘要未变，历史文件路径无新增或删除。其余文件仅在结束时计算全量摘要，不宣称都做了前后字节对比。

## 3. 19例逐例结论

表中Ready均指文件记录状态，不代表本轮或历史最终产品全部通过。

| 案例 | 保存的阶段/规模 | 已有组织方法 | 本例对改进方向的启示 |
| --- | --- | --- | --- |
| C01 [08-16 NAS迁移](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-jenkins-learning-nas-scope/3-contract/contract.md:1) | Ready；7 AC | 配置、知识库与运行状态迁移；用户明确否决拆两步 | 复杂不等于必须拆票；路径变更与原对照物之间需要一致的解释。 |
| C02 [08-16 评分修复](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-scoring-system-fixes/3-contract/contract.md:1) | Ready；7 AC | 九项缺陷合成一个修复目标，包含盲评及既有样本兼容 | 自动锚点、语义判断、盲评是不同证明；1行混合Verify。 |
| C03 [08-17 研究技能改进](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-bpr-skill-improve/1-interview/context.md:1) | 原型阶段；无正式契约 | 11项机制候选，由既有对抗评测的FAIL反哺修订 | 这是尚在收敛的案例，不能计成交付失败；材料更丰富也不等于已Ready。 |
| C04 [08-17 图表对照物](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-diagram-artifact/3-contract/contract.md:1) | Ready；7 AC | 一个家族能力跨文档、脚本、七面扫描与测试同步 | 跨文件不自动等于多个用户交付；结构/关键词检查不能替代图的语义质量。 |
| C05 [08-17 Creator设计与评审](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-skill-creator-design-review/3-contract/contract.md:1) | Ready；6 AC | 设计档、结构审查、可选gate、历史趋势共同改造 | 3行混合Verify；需要保留每种验收义务，而不是只数六个AC。 |
| C06 [08-20 Web访谈入口](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-20-workflow-interview-web/3-contract/contract.md:1) | Ready；6 AC | 薄Web入口、持久提交、唤醒/消费、重启恢复 | 有自动与浏览器证据，是正例；验收fixture的家族映射不能冒充完整宿主接续。 |
| C07 [08-23 初版Board](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-23-worktree-board/3-contract/contract.md:1) | Ready；6 AC | 采集、派发、地图与状态工作面；最初明确只建议合并 | 后续确有编排复盘，但新运行范围不能反向替旧目标全量签收。 |
| C08 [08-24 对标与发布改造](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-24-对标mattpocock仓库差距/3-contract/contract.md:1) | Ready；7 AC | 报告、生成式发布、安装、评测等耦合改造，用户选择合一份 | 数量阈值不是拆分依据；为保持14项而补共同缺项说明数量指标可能扭曲分类。 |
| C09 [08-24 Gate技能](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-24-aes-gate/3-contract/contract.md:1) | Ready；5 AC | 单条沉淀、检测、组装、看板、调用；后续关联#42实施 | 总体五AC与自举报告五AC含义不同，需要映射；不是凭同样条数判全部覆盖。 |
| C10 [08-24 Board升级](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-24-aes-worktree-board-upgrade/3-contract/contract.md:1) | Ready；7 AC | 总体契约作为验收伞，N1—N9执行图，B1—B6只建不做 | 总体规格＋任务依赖已有直接先例；重编号后旧AC指针残留。 |
| C11 [08-25 Board会话演进](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-25-aes-worktree-board-session-evolution/3-contract/contract.md:1) | Ready；7 AC | runner/job/attempt、双层Goal、恢复及发现回流；分组验证 | 26行为＋10边界被聚成7 AC，条数低估复杂度；原型QA与真实fresh任务验收分开。 |
| C12 [08-27 Worker重梳](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-27-aes-issue-worker-流程重梳/3-contract/contract.md:1) | Ready；5 AC | 最终限定纯文档、零脚本/零schema；未来merge角色另交付 | manifest摘要仍保留已撤销的schema扩展目标，证明入口版本漂移。 |
| C13 [08-28 Merge Worker](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-28-aes-merge-worker-落地/1-interview/context.md:1) | 契约阶段；无正式契约 | 11 AC的候选被分成通用outbox、单一消费者及后续live工作 | 拆分按职责和副作用边界，有理由；本目录未完成契约不等于目标实施失败。 |
| C14 [08-28 闭环优先裁决](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-28-issue70-loop-first-ruling/1-interview/context.md:1) | 原型阶段；无正式契约 | 决定先证明真实回路，再由命中证据推动硬化 | 研究/裁决票应按决定是否闭合来评价，不能拿编码产物当统一尺子。 |
| C15 [08-28 Outbox解耦](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-28-outbox-close-解耦/3-contract/contract.md:1) | Ready；5 AC | local close、出站flush、ack和门禁，真实happy path分工明确 | 历史四个自动验证绿、真实解卡未跑；基础能力票可以独立验证但不吞掉后续live义务。 |
| C16 [08-29 glab技能扩充](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-29-aes-glab-skill改进/3-contract/contract.md:1) | Ready；5 AC | 安装、配置、使用面实测、输出评测及历史沉淀 | 准备期0绿3红不说明当前未实现；真实数据与文档语义需各自证据。 |
| C17 [08-30 Story设计重访](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-issue-147-steelman-rerun/1-interview/context.md:1) | 原型阶段；无新正式契约 | 跨仓、多角色、双图、分波回流、精确集成验收；多次边界反转 | 已有深度总设计，主要挑战是持续保持语义一致；P14五文件摘要匹配，Web仍未确认。 |
| C18 [08-30 评测证据契约](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-issue-160-eval-evidence-contract/3-contract/contract.md:1) | Ready；6 AC | 统一证据、replay/live分工、Creator独立质量门和shopping pilot | 历史post-live记录与源码提交可对应，同时诚实保留INCONCLUSIVE；复杂单契约也有正例。 |
| C19 [08-30 Creator布局回归](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-psc-layout-regression-fix/3-contract/contract.md:1) | Ready；6 AC | 两条布局不变量，分类目录/link/输出隔离和回归 | 可闭合的回归修复不必再套一层冗长总Spec；预期RED与既有回归绿合理并存。 |

详细证据与实际阅读范围分别在：

- [C01—C06：早期任务与Web访谈](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-31-large-task-spec-ticket-delivery/1-interview/facts/corpus-01-early-and-web.md)
- [C07—C12：Board、Gate与Worker](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-31-large-task-spec-ticket-delivery/1-interview/facts/corpus-02-board-and-worker.md)
- [C13—C16、C18—C19：交付与评测](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-31-large-task-spec-ticket-delivery/1-interview/facts/corpus-03-delivery-and-evals.md)
- [C17：#147大任务设计重访](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-31-large-task-spec-ticket-delivery/1-interview/facts/corpus-04-story147.md)

## 4. 已有的有效做法，比之前看到的更多

### 4.1 总体契约与执行图分工，已经有直接先例

C10的契约明确写：执行拆分由N1—N9依赖图承担，总体契约作为整轮升级的“验收伞”。同时把只建不做的B1—B6 backlog排除出本轮实施，避免把地图中的所有开放节点都误当本轮义务。[契约D-2/D-3](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-24-aes-worktree-board-upgrade/3-contract/contract.md:141)

它还将与registry/原子写不可分的缺陷收编，而保留自身就是完整交付单元的缺陷票。这说明合理拆分同时包括“拆”和“合”，不追求票数越多越好。

**应复用：**总体目标不随拆票丢失；每张票有明确交付；必做与后续事项分开；依赖是具体前置，不是标题编号顺序。

**还不能证明：**图存在即代表每票已在同一有效版本上完成验收。该图还把部分测试工作放在前置能力之后，不能声称历史已经统一采取每票全层纵切，更不能仅凭标题判断其失败。

### 4.2 基础设施票可以成立，不必每张票都做一遍前后端

C13/C15把通用出站队列与Merge Worker这个消费者分离，保留后续真实happy path的责任。这比“后端所有内容做完再统一联调”更具体：它按副作用、接口与消费责任划界。[Merge Worker范围收敛](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-28-aes-merge-worker-落地/1-interview/context.md:1)、[Outbox契约](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-28-outbox-close-解耦/3-contract/contract.md:1)

C15历史四项自动验证通过，但真实解卡的C档未跑。正确结论是基础能力的部分证据已成立，完整真实链路仍需另外证明，不是把后者删掉。

**应复用：**基础票有明确生产者/消费者边界、故障语义、独立验证和后续集成责任。模拟消费者与schema检查仍只证明局部，不能替代紧邻波次的首个真实消费路径。

### 4.3 已有可审计的非自动化证据，不应一概说“只有自报”

C06保存自动回归、浏览器截图、submission/consumed与重启恢复记录。查看的截图显示锁定、确认及恢复界面，支持“单个复杂契约可以配套多层证据”。但其中家族映射由acceptance fixture模拟、不写rounds，不能升级成完整真实宿主自动接续的证明。见[C06调查及附件边界](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-31-large-task-spec-ticket-delivery/1-interview/facts/corpus-01-early-and-web.md)。

C18的post-live记录分别保留自动组、replay与受控live，并明确质量结论仍为INCONCLUSIVE，而不是把所有证据都写成一个笼统PASS。当前本地Git也能定位47df513f866a06dff9fe5c46c045256cb09ee7ac及相关源码。[历史post-live记录](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-issue-160-eval-evidence-contract/3-contract/verify.txt:4)

**应复用：**每种证据只证明它实际覆盖的对象；产品/工具交付通过，不等于已经证明某种模型质量假说。本次没有重跑live，不能称当前环境再次通过。

### 4.4 版本与批准绑定不是从零开始

C17的P14确认记录把五份业务对照物及其摘要绑定起来，并明确不包含Web批准。**本轮重新计算这五份确认版文件的SHA256，全部与记录一致。**[P14确认记录](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-issue-147-steelman-rerun/2-prototype/evidence/webp14-v6/p14-confirmation.json:1)

同时v6验证记录诚实写53项有限静态检查、browser NOT_RUN、design_qa blocked、real_runtime NOT_CONNECTED。旧v5视觉QA没有被直接拿来放行v6。[v6验证边界](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-issue-147-steelman-rerun/2-prototype/evidence/webp14-v6/validation.json:1)

这反驳“整个体系没有版本/确认保护”。更精确的问题是：这些保护还不是所有契约、入口和派发路径都会执行的统一规则。

## 5. 跨案例重复出现的薄弱点

### 5.1 入口摘要与最新裁决不一致

最清楚的是C12：manifest仍要求review→QA及declaredRisk schema扩展；最终契约却明确不改任何mjs、不动schema、不实现Merge Worker。rounds中存在完整推翻链。[旧入口目标](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-27-aes-issue-worker-流程重梳/manifest.json:7)、[最终排除范围](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-27-aes-issue-worker-流程重梳/3-contract/contract.md:49)

C01执行后路径发生变化，契约补充解释但旧路径和原型仍保留；C11已确认材料中仍有候选/待确认措辞；C17前段保留Web可写的旧决定，P12已覆盖为只读。

**风险：**不同会话从不同入口读取，可能执行相反要求。历史保留不是错误，但有效版本及覆盖关系必须明确。不能仅要求Agent把整个历史读完，再自行判断哪句最新。

### 5.2 总体AC与子任务AC缺乏稳定映射

C09总体契约的五项AC，涵盖单条沉淀、检测、组装、看板与调用；#42自举报告的五项则是目录、缺口、注册、体检和校验。它们都叫“五项”，但不是同五项。[总体AC](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-24-aes-gate/3-contract/contract.md:80)、[实施自举中的AC](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/aes-gate/references/bootstrap-report.md:73)

**已证事实是映射尚未完整重建，不是认定功能漏做。**远端可能存在合法重订或其他票承接，本轮没有刷新。

C10从9条聚成7条后，D-01/阻塞处仍引用AC-008，UI说明和实际AC编号也不一致。[产物与验收引用](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-24-aes-worktree-board-upgrade/3-contract/contract.md:57)、[重编号说明](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-24-aes-worktree-board-upgrade/3-contract/contract.md:143)

因此新增Spec最该补的是“某条承诺最终由哪个任务、哪条验收证明”，不是再生成一份长清单。

### 5.3 AC数量不能代表工作规模，也不该迫使重新编号

C11把26个行为变化、10个边界聚成7 AC；C09五AC包含四种工作路径；C02七AC覆盖发布、安装、评测和文档。它们和C19六AC的有界回归修复，不能因条数接近就采用相同拆法。

C10明确因上限将9条聚为7条，并留下旧编号。C02为满足“14条”把双方共同缺项补入差距清单，最终报告诚实披露了此处理。这些不是证明作者隐瞒，而是说明数量尺可能驱使内容变形。

**建议：**用义务是否内聚、前置是否稳定、验证是否闭合、上下文能否独立接手来拆；允许父级规格较大，但不能靠删条目或改号假装工作变小。

### 5.4 验证种类被压在一行，机器消费可能失真

15份正式契约中，有4份出现混合档位Verify，共8行：C02、C05、C07、C09。该数字来自逐行文本清点，不是通过率。

结合前轮已核对的当前session首档解析方式，这些现存文本在当前消费模型下有漏读或漏统计风险。**本轮没有还原所有历史脚本版本，不能据此声称当年四个案例都发生了漏验或交付失败。**

此外，C12主动说明：[A]4/[D]1低估了人工负担，前三条A的承重判断仍含语义对照，只有一条纯机械。档位标成A不代表全部业务含义都能由一个grep判定。[验收负担说明](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-27-aes-issue-worker-流程重梳/3-contract/contract.md:134)

### 5.5 准备期红测与最终验收的角色没有统一归档

大多数verify是实施前冒烟，包含缺命令、缺测试域、关键词尚未出现等；C18则是post-live交付记录。相同文件名承担不同生命周期角色，不能横向按红绿直接排名。

应分开保存：

- 验证入口与基线检查：测量路径是否成立、已发现什么；
- 候选改动的局部验收：这张票是否满足对应承诺；
- 最终集成验收：目标版本上的整体旅程与回归；
- 人工/真实环境证据及尚未执行项。

预期RED允许存在；但测试没被发现、参数不合法、环境无法运行，不能冒充“断言真正运行后证明功能未实现”。更长的Spec不会自动修复这个分类。

### 5.6 大任务会演进，不能只生成一次静态任务图

C17的Q22已经明确：第一步能拆出大量任务，但执行和验收会产生bug、新问题与小需求变化，需要多轮收敛。Q32又把“原承诺内修复”和“改变目标/范围/AC/权限的变更”分开。[Q22](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-issue-147-steelman-rerun/1-interview/rounds.jsonl:23)、[Q32](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-30-issue-147-steelman-rerun/1-interview/rounds.jsonl:34)

C11也有题外发现分类、风险、证据失效与恢复规则。这些支持分波推进，不支持提前详细规定所有未来票、也不支持执行Agent遇事随意扩大范围。

### 5.7 管理复杂度与执行权限不能混为一谈

C17 Q8希望分散执行又保持全局掌控；P11/P12则明确Runtime只同步，不调Agent。两者并不矛盾：执行责任可以由已有Skill/执行器承担，观察与恢复信息由投影层提供。

因此，“要让大任务完整落地”不能直接推导为“本次必须实现新的Agent Host”，也不能直接缩减为“只生成文件就算完成”。应先核对既有接口能否衔接，再确定本次制作职责。

### 5.8 验收判据和确认样例本身也可能不成立

这个问题比“有没有拆票”更基础：即使所有票都按计划完成，如果判据验错对象，仍然会得到假完整。

- C02强约束要求存量14份按新规则重算逐一保持，但AC-003只读取两个锚点文件已有的score/result，不能逻辑上证明14份经过新规则重评后的兼容性。[强约束](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-scoring-system-fixes/3-contract/contract.md:40)、[AC-003](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-scoring-system-fixes/3-contract/contract.md:70)
- C05的接口样例两轮同分，却推进current_best；同页规则要求严格更高才推进，平局不推进。[样例与规则](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-skill-creator-design-review/2-prototype/api-mock.md:21)
- C06成功请求例让同一Q1同时有choice和custom，已锁规则却要求互斥。[成功请求](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-20-workflow-interview-web/2-prototype/api-mock.md:57)、[互斥规则](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-20-workflow-interview-web/2-prototype/api-mock.md:115)

这些是文档、样例与验证逻辑之间可定位的不一致，不是对当前实现的缺陷断言。它们要求在正式交接前检查“规则—样例—验证是否说同一件事”；用户确认过样例，不会自动使矛盾消失。发现矛盾时应回到对应决定修正，不能让执行Agent自行选择更容易通过的一边。

## 6. 对 to-spec / to-tickets 的具体判断

**应该吸收它们的职责，但需要任务适配和完整性检查。**

| 工作性质 | 更适合的组织方式 | 必须守住的边界 |
| --- | --- | --- |
| 范围明确、承诺内聚、能在一个新上下文中完整接手的修复/改造 | 单份Goal Contract；必要时内部实施计划 | 不强造总Spec和多个票；仍保留明确验证与版本 |
| 已明确总体目标，但存在多个可独立验证的交付单元 | 总体Spec/Story Contract＋任务图＋各票契约 | 每项总体承诺都有归属；所有必需跨票/真实验收都进入总完成判定 |
| 存在会改变产品边界或核心可行性的未知 | 先做研究/裁决或有界探针，再逐波细化实现 | 不把未知写成已定需求，也不把未来所有细节提前冻结 |
| 共用基础能力、不可分兼容迁移或跨模块机械重构 | 明确基础票、兼容迁移及后续消费/集成票 | 不能把局部schema/mock测试当真实全链通过；保留故障与回滚边界 |

这是跨案例设计建议，不是已经自动批准的路由规则。路由不能仅靠文件数、AC数或“后端/前端”的名称。

to-spec最值得补强：

1. 总体问题与范围；
2. 全部已确认义务及来源；
3. 已否决、替代和未决内容；
4. 系统边界与关键接口；
5. 总体验收与子票归属。

to-tickets最值得补强：

1. 每票有可观察的交付结果；
2. 只声明真正阻塞的依赖；
3. 切分后仍有父级覆盖对账；
4. 逐票有独立可用的上下文和验证；
5. 已做/未做、必做/后续明确分开；
6. 执行发现按原承诺内修复或需重新裁决分流。

**独立验收不等于零依赖。**它意味着在明确的前置版本与环境上，能单独证明本票结果；既不强迫每票都从数据库做到UI，也不能把首次真实集成无限推迟到全项目末尾。

## 7. 双向Steelman后的裁决

### 支持“补总体Spec＋拆票”的最强论证

跨案例确有同一根问题：一个整体用户意图在多个文件、任务、阶段和会话之间传播。总体契约提供不丢目标的锚点，任务图控制依赖和工作规模，逐票验收提供局部完成证据。C10的验收伞、C13/C15的职责拆分、C17的分波回流均是直接先例。

因此，该方向不是纯理论，也不是照搬另一套技能名称。它能针对当前材料中看到的遗漏与失控风险。

### 反对“这样就足够”的最强论证

C10已有总契约和拆票，仍有编号、范围与验证衔接问题；C12已完整访谈，入口摘要仍保留已撤销工作；C06/C18有丰富证据，仍必须区分fixture、真实环境和质量假说；C01/C02又明确要求合并交付。

所以，新增两份文档或两个技能调用不能保证正确；未经适配的统一拆分反而可能破坏原本内聚的交付，还可能创造新的权威冲突。

### 本轮裁决

**保留三阶段访谈和有界单任务路径；对需要跨任务协作的大目标，建立总体承诺、任务依赖、有效版本、分波演进和整体证据之间的统一衔接。优先把已有成熟做法变成稳定规则，不先重造另一套平台。**

判断依据是案例中的义务传播、独立验证与状态一致性，不是工作量，也不是AC数量。

这仍不能单独保证最终成功。真实工具能力、授权、环境、数据与用户接受标准必须成立；无足够证据时，正确结果可能是明确阻塞，而非完成。

### 可以推翻这次裁决的事实

1. 如果当前另一个真实入口已统一消费总Spec、子票、版本与全部验收证据，那么问题可能只是入口发现/路由，不应重复实现。
2. 如果多数目标在实际执行中能由一个有界上下文完整交付，且无跨票/环境义务，普遍引入父Spec会变成重复。
3. 如果所谓依赖图只是展示、执行仍靠复制粘贴并反复重新解释，那么仅补文档不能解决用户的管理痛点。
4. 如果某些“映射缺失”在远端已通过后续裁决解决，就应下调为归档/检索问题，不得写成漏实现。
5. 如果正式的多案例冷启动交接试验仍频繁遗漏义务，说明统一元数据不够，还需修正需求表达或执行器消费方式。

这些是反证条件，不要求用户现在逐项作答；本轮先交完整研究。

## 8. 对当前制作目标访谈的影响

Q1继续暂停，不要求用户重复回答“想要任务包还是完整交付”。

下一轮应先给出一份**继承与冲突对照**：

- 已有长期意图：小粒度组织任务、避免上下文爆炸、保持全局掌控、分波验收与发现回流。
- 已有可复用模式：单份内聚契约、总体验收伞、基础能力拆分、显式必做/后续范围、精确对象证据、版本绑定。
- 仍需确认的新增范围：哪些旧决定继续适用于此次目标；本次需要补哪个缺失衔接；是否改变既有入口、默认行为、外部副作用或最终收口责任。
- 不能默认继承：#147的全部Story Atlas界面、跨仓模型、特定Runtime边界等，不经适用性核对直接塞进新任务。
- 同样不能忽略：#147已允许重裁旧Spec/ADR；不能只依据更早Accepted标签否决当前讨论。

一个适合进入下一轮的目标表述候选是：

> 让现有技能体系能够按任务性质选择单契约或总体规格＋任务图，在多个执行上下文之间保留完整承诺、依赖和验收依据；允许按已批准范围分波推进，对变更及时回流，并依据最终交付对象的完整证据判断总体完成。

这只是研究后的候选，不是Ready契约。此时还没有授权实现、发布Issue或启动产品交付。

## 9. 证据限制与验证记录

本轮新增的可复现检查：

- 清点19例、508文件，读取各例核心资料；15份正式契约及其92个AC建立索引。
- 检出4份契约的8行混合Verify；没有用当前validator给历史格式判通过/失败。
- #147五份确认版文件重新计算SHA256，全数匹配本地P14记录。
- 对已发现的若干实现提交做只读Git核对；其中#160提交47df513f866a06dff9fe5c46c045256cb09ee7ac可定位。
- 明确区分实施前verify、历史post-live、原型QA、真实宿主、fixture和当前重新验证。

没有执行：

- 19例产品的当前全量回归、真实浏览器/Provider/桌面往返；
- 所有历史任务的最终验收重演；
- 远端Issue全量刷新或其全部评论恢复；
- 证明to-spec/to-tickets加入前后改善幅度的对照实验。

因此，本文能支持**方法与交接协议的改进方向**，不能报告19例中的完整交付成功率，不能证明某种模型执行概率，也不能将历史归档中没找到的证据说成从未发生。

后续验证新流程时，这19例可以转为分层回归样本，但只有在来源版本、任务范围和期望结果重新锁定后才能使用；不能直接把旧Ready当golden。可重点选：单契约内聚改造、总契约＋多票、职责解耦、原型反转、动态回流、真实验收和不完整证据七类场景。

**研究后的重点已经明确：补齐“大任务在规格、任务、会话与验收之间传递时不丢失、不串版本、能重新收敛”的能力。是否新增某个技能或修改哪个入口，应由这个结果反推。**
