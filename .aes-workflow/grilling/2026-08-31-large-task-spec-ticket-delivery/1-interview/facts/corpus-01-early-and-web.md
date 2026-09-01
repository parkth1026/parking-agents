# Fact: 早期技能与 Web 载体六案例——Spec、拆分与独立验收的历史证据

- 派遣问题：读取指定六个历史案例的实际产物，判断它们对“大任务需要 Spec→拆解→独立验收”的假说提供哪些支持、反证与尚不能回答的部分；不先替用户选择交付边界。
- 调查日期：2026-08-31；清单与阶段快照时间：2026-08-31T23:25:40+08:00。
- 案例根：`G:\GIT\AI_WorkFlow\parking-agents-manual\.aes-workflow\grilling`。
- 范围：2026-08-16-jenkins-learning-nas-scope、2026-08-16-scoring-system-fixes、2026-08-17-bpr-skill-improve、2026-08-17-diagram-artifact、2026-08-17-skill-creator-design-review、2026-08-20-workflow-interview-web。
- 方法：先完整列出六例的111个文件，再实际全文读每例 manifest/context/rounds、目录内全部5份正式contract，按需读取正式对照物、草稿、verify、Web提交与消费记录、历史Git实现记录和现存示范产物。具体阅读清单在文末。
- 无副作用：未运行任何历史AC命令，未用当前validator评历史格式，未修改原案例/技能，未查远端；唯一写入本事实分片。
- 证据分层：**记录**=当时文档/日志作出的陈述；**本轮直接核对**=文件内容、文件存在性、图像画面或Git对象/祖先关系；**推论**=由上述材料支持的解释。没有把历史PASS当成本轮重跑PASS。

## 查到的：横向快照

复杂度是任务结构判断，不由AC条数单独决定。这里的“高”指跨多个行为域/系统边界、有人或外部状态依赖，需要多个互补判据；并不自动推出应拆成几张票。

| 案例 | 复杂度与依据 | 当前目录记录的阶段 | 正式交接/拆分形态 | 目录内可见验证证据 |
| --- | --- | --- | --- | --- |
| NAS迁移 | 中高：三技能、本机配置、网络文件系统、旧数据与入口删除，16行为行 | 三阶段done，ready | 单contract、7AC；明确分两簇，用户否决拆两步 | 冒烟1绿4红、2条C未跑；合同后附新地址复验声明；有本地实现提交 |
| 评分修复 | 高：9缺陷、规则语义/脚本/动态语料/用户盲评，7AC | 三阶段done，ready | 单contract；用户盲评单独列AC但未另拆票 | 冒烟2绿4红、1条C未跑；有规则实现提交；目录无盲评结果 |
| BPR改进 | 中：11研究机制、文档分层、新引用验证脚本与对抗评测 | interview done，prototype pending，contract pending，in_progress | 无正式contract，6份prototype草稿 | 只有前期评测的上下文转述；本例没有交付验收记录 |
| 图表产物 | 中：技能家族同步、新产物消费链、结构门禁、可视化效果 | 三阶段done，ready | 单contract、7AC；明确讨论且接受不拆 | 冒烟0绿7红；后续提交包含实现/测试并宣称全绿，现存源码有相应能力 |
| 技能生产线 | 高：init/校验、设计追溯、评测gate、结构审查、历史聚合、viewer、真实示范 | 三阶段done，ready | 单contract、6AC；另有被生产的示范技能及其design/AC | 冒烟0绿3红、3条非A未跑；后续实现与示范history/design实际存在 |
| interview Web | 高：浏览器、HTTP/WS、鉴权、后台等待、持久化恢复、三阶段交互 | 三阶段done，ready | 单contract、6AC；evals/发布侧明确另做 | A三行均记录12/12；另有浏览器截图、submission、consumed、恢复步骤；宿主续接只到模拟边界 |

六例目录内都没有独立命名的正式 spec/plan/ticket 文件。五份正式contract本身已承担“目标/范围/约束/验收/设计取舍”的规格功能。**这支持讨论规格与分解的能力缺口，不支持仅从文件名推出“缺Spec所以失败”。** 未查远端，不能据此说这些任务从未有外部Issue。

## 1. 2026-08-16-jenkins-learning-nas-scope

### 目标、阶段与交接

原始请求是把知识输出迁到NAS并限定3个Jenkins job，访谈后来增加XDG本地配置、旧路径回退、无配置引导、不可达诊断及PS入口删除；正式范围同时跨三技能、本机与NAS。[contract.md:29](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-jenkins-learning-nas-scope/3-contract/contract.md:29)

manifest的三阶段均done、顶层ready；它的next_action仍为“用/goal交接”，不是执行完成状态。[manifest.json:9](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-jenkins-learning-nas-scope/manifest.json:9)

**反对强制拆分的直接证据**：Q5明确给出“拆两步”与“并入本次”，用户选后者；contract又明确分为迁移/范围与配置机制/清理两簇，但仍是一份交接。[rounds.jsonl:15](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-jenkins-learning-nas-scope/1-interview/rounds.jsonl:15)、[contract.md:94](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-jenkins-learning-nas-scope/3-contract/contract.md:94)

### 可定位的信息问题与正面反证

- **已证实的跨节矛盾**：确认版behavior第16行要求删除`UeErrorSolver.psm1`，同一文件不变清单却要求其行为不变。不能以“文件已确认不可改”解决这两个要求的冲突。[behavior.md:26](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-jenkins-learning-nas-scope/2-prototype/behavior.md:26)、[behavior.md:37](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-jenkins-learning-nas-scope/2-prototype/behavior.md:37)
- **版本解释负担有实物**：contract顶部追加“执行后用户改NAS地址为x.public”，要求正文与AC中的PaaS地址等价理解，并保留旧对照物不改；但AC-001等仍含硬编码旧地址。这是公开声明的变更，不是隐瞒；仍使新执行者必须解释叠加规则，原命令不能按字面代表新目标。[contract.md:6](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-jenkins-learning-nas-scope/3-contract/contract.md:6)、[contract.md:79](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-jenkins-learning-nas-scope/3-contract/contract.md:79)
- **聚合未完全同步的较小例子**：实际7AC、分簇注记也写7条，设计取舍仍写“8条AC”。这不是能力未交付的证明，但说明同一规格里的重复摘要会漂移。[contract.md:161](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-jenkins-learning-nas-scope/3-contract/contract.md:161)
- **正面反证**：prototype确实撞出了“本地既有wiki迁不迁”的漏问，Q3回访后补进目标；契约摘要又撞出“配置文件本地还是路径值指NAS”的歧义，Q4/Q5记录了重新裁决。这证明三阶段不是纯仪式，能捕获原始请求未说出的依赖。[rounds.jsonl:11](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-jenkins-learning-nas-scope/1-interview/rounds.jsonl:11)、[rounds.jsonl:13](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-jenkins-learning-nas-scope/1-interview/rounds.jsonl:13)

### 证据强度与对假说的含义

verify为实施前冒烟：1绿4红、两条C未跑。它不证明最终失败。[verify.txt:15](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-jenkins-learning-nas-scope/3-contract/verify.txt:15)

本轮直接读取本地提交`91bb96d23e4df9c4725b784b2e9e549875641112`与`c7b4be7815db8926cbad3e60b989d5e8121968a4`的改动清单：确有配置迁移实现及新NAS地址变更，两个提交均为当前HEAD祖先。这能否定“没有实现”的说法；不证明今天NAS仍可达，亦不独立证实contract顶部声称的全部复验。

**推论**：本例首要缺口是扩围后的跨产物一致性与已批准版本表达。拆成票可能让两个交付簇更清楚，但没有变更传播规则仍会保留同样矛盾；不能违背已记载的用户选择，把“不拆”当作错误本身。

## 2. 2026-08-16-scoring-system-fixes

### 目标、阶段与交接

本例从9项审计缺陷起步，用户裁定“机制全部修、权重阈值不动，只搭仪表”，并坚持本轮用户盲评；所以“全修”已经被明确限定，不能以后又按“本轮必须校准权重”判失败。[rounds.jsonl:6](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-scoring-system-fixes/1-interview/rounds.jsonl:6)、[rounds.jsonl:9](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-scoring-system-fixes/1-interview/rounds.jsonl:9)

三阶段done、ready、7AC，next_action特别指出盲评需用户半天投入。交接是单contract，不是七张票。[manifest.json:9](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-scoring-system-fixes/manifest.json:9)

### 可定位的信息问题与正面反证

- **目标谓词与Verify不等价**：强约束要求存量14份按新规则重算逐一不变；AC-003却声称“两锚点文件零改动即证明存量分档不受影响”，命令只读取两文件既有score/result字段，并不运行新规则重评，也没有遍历14份。这里问题是验收尺子，不是AC太少。[contract.md:40](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-scoring-system-fixes/3-contract/contract.md:40)、[contract.md:70](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-scoring-system-fixes/3-contract/contract.md:70)
- **动态母集造成可完成性问题已有修订记录**：AC-006后来把盲评副本数量的对照基准从持续增长的活语料改为`key.md`生成快照，正文直接说明原判据有竞态；旧verify仍保留原活语料计数命令。这是固定数据版本必要性的实际反例。[contract.md:76](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-scoring-system-fixes/3-contract/contract.md:76)、[verify.txt:10](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-scoring-system-fixes/3-contract/verify.txt:10)
- **多方法AC的证据不能只看首档**：AC-004同一Verify行含自动全库校验与人工负例；旧verify记录自动项PASS，而非A汇总只列AC-007，不能据此推定缺节负例已验。[contract.md:72](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-scoring-system-fixes/3-contract/contract.md:72)、[verify.txt:7](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-scoring-system-fixes/3-contract/verify.txt:7)
- **正面反证**：用户盲评被明确保留为AC-007，且写出操作者=用户、Agent不代填；没有把人不能省掉的工作暗换成脚本PASS。[contract.md:78](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-16-scoring-system-fixes/3-contract/contract.md:78)

### 证据强度与对假说的含义

verify是2绿4红、1条C未跑的旧冒烟。本轮读取的本地提交`9abbc6c8e2ad2c066885d70ca583071bddabeadb`有规则/校验器/盲评流程的真实改动清单，并声明负例已验；该提交是HEAD祖先。提交说明属于当时验证声明，不是本轮重跑记录。案例目录内未见`blind-review/results.md`，当前仓库也没有其合同引用的`docs/reports`目录；未查原机器或远端，不能断言盲评从未进行。

**推论**：支持把“规则实现”“盲评材料”“人完成盲评”“整体验收”分清，并为每个验证方法记录状态；不能从Agent无法替人盲评推出工作流失败。是否拆票不能消除用户动作这一真实依赖。

## 3. 2026-08-17-bpr-skill-improve

### 目标、阶段与交接

任务把既有研究与iteration-2反馈转成11项机制；用户推翻单文件建议，选择references+scripts，同时选择复用3个对抗案例做iteration-3。[rounds.jsonl:12](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-bpr-skill-improve/1-interview/rounds.jsonl:12)、[rounds.jsonl:13](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-bpr-skill-improve/1-interview/rounds.jsonl:13)

本例10个文件包括manifest/context/rounds、impact-surface和6份draft。manifest明确处于2-prototype、该阶段pending、contract pending、validation null、in_progress；没有正式contract/spec/plan/ticket。[manifest.json:9](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-bpr-skill-improve/manifest.json:9)

### 能与不能得出的结论

- **不是失败案例**：六份草稿都写“待质疑/draft”，并没有假称完成。没有contract只能证明本目录保存的进度未到契约交接；不能推断任务被放弃、更不能纳入交付失败率。[v1-skill.md:1](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-bpr-skill-improve/2-prototype/drafts/v1-skill.md:1)
- **已产生规格性内容**：草稿明确了verify-refs的成功/业务失败/用法错/意外错误、JSON字段、三种URL状态、超时和只读边界。没有正式Spec文件名，并不等于没有做规格澄清。[v1-api-mock.md:9](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-bpr-skill-improve/2-prototype/drafts/v1-api-mock.md:9)、[v1-api-mock.md:71](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-bpr-skill-improve/2-prototype/drafts/v1-api-mock.md:71)
- **潜在歧义仍应留在待质疑状态**：草稿把unreachable引用“按幻觉处理”，同时只验证链接可达性；可达与内容支持度是不同谓词。草稿的成功示例还出现checked=5而ok3+ambiguous1+unreachable0=4。这能说明对照物阶段仍有问题可挑，但不能把未批准草稿当作已交付缺陷。[v1-behavior.md:16](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-bpr-skill-improve/2-prototype/drafts/v1-behavior.md:16)、[v1-api-mock.md:12](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-bpr-skill-improve/2-prototype/drafts/v1-api-mock.md:12)
- **评测信息有来源边界**：context中iteration-1/2的pass率与成本数字来自别的workspace，是访谈的输入记录。本轮未追读那些原始run与grader，不把这些数字当作本例独立验收结果。[context.md:27](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-bpr-skill-improve/1-interview/context.md:27)

**推论**：本例不支持也不反驳“拆票后执行是否更可靠”，因为根本还没有执行终态样本。它反驳的是“历史目录没有contract就表示流程失败”的统计方法。

## 4. 2026-08-17-diagram-artifact

### 目标、阶段与交接

任务目标是架构/流程改动能够像mock一样直观质疑；产出图表规范、diagram类型、第七影响面、家族消费链、测试与跨仓注记。七条AC仍围绕同一个能力增量。[contract.md:14](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-diagram-artifact/3-contract/contract.md:14)、[contract.md:29](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-diagram-artifact/3-contract/contract.md:29)

三阶段done、ready。用户对七条AC整体确认并确认不拆；契约给出理由是规范、门禁与消费链互为前提，拆成互引产物的两合同会降低可独立交付性。[rounds.jsonl:15](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-diagram-artifact/1-interview/rounds.jsonl:15)、[contract.md:180](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-diagram-artifact/3-contract/contract.md:180)

### 可定位的信息问题与正面反证

- **A档不等于目标已被深验**：AC-004只grep规范关键词，AC-007只grep评测JSON存在diagram，并没有实际让新技能生成一张图再核验拓扑/视觉质量。目标是“决策直观”，这些A只能覆盖机制和定义在场。[contract.md:112](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-diagram-artifact/3-contract/contract.md:112)、[contract.md:120](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-diagram-artifact/3-contract/contract.md:120)
- **未把结构门禁伪装成语义门禁**：behavior行8明确“只有面名没判有无”仍放行，说明当时有意让机器挡结构，质量由自评与用户确认承担。这是历史边界，不能用今天更强的期待倒判当时实现违约。[behavior.md:17](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-diagram-artifact/2-prototype/behavior.md:17)
- **风险诚实但终止摘要偏强**：contract残留风险写整体确认、视觉细节未逐点核验，并说明完成后需人工复核七条；manifest next_action却写“七条A全绿即完成”。不同载体中的终止条件不完全一致。[contract.md:128](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-diagram-artifact/3-contract/contract.md:128)、[manifest.json:10](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-diagram-artifact/manifest.json:10)
- **正面反证**：表格为行为源、架构图为拓扑源、流程图只是同一行为的视图，这种信息归属有明确用户裁决，避免了“加一张图就多一份互相争权的规格”。[rounds.jsonl:10](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-diagram-artifact/1-interview/rounds.jsonl:10)

### 证据强度与对假说的含义

旧verify的0绿7红是前置冒烟，不是最终结果；其中AC-001显示当时既有44项测试通过，但追加目标grep仍红。[verify.txt:4](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-diagram-artifact/3-contract/verify.txt:4)

本地提交`8ca41eea167d78b41fa789b158c44a8d5f22aea0`明确关联本合同，有代码/规范/测试/历史案例补扫的实际文件改动，提交说明声称62/62与七条AC通过；该提交为HEAD祖先。现存规范与第七面代码可直接核对，但本轮不把提交里的历史验证声明等同于新鲜视觉验证。

**推论**：本例反对“超过若干AC就必须拆票”的机械规则，支持以消费者边界与可独立验收性决定粒度。同时证明“测试定义在场”和“由技能实际产生正确成果”应分别验收。

## 5. 2026-08-17-skill-creator-design-review

### 目标、阶段与交接

用户要的是生产线从设计到验收的证据链，不是只加一个文档；范围横跨init、quick-validate、eval追溯、gate选择、结构审查、历史数据、viewer及真实示范。[context.md:10](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-skill-creator-design-review/1-interview/context.md:10)、[contract.md:30](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-skill-creator-design-review/3-contract/contract.md:30)

三阶段done、ready、单contract六AC；其中AC-005合并历史写入多个边界和viewer视觉核验，AC-006再跨整条链做真实示范。这里有多个可区分成果，但没有保存正式票清单。[contract.md:80](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-skill-creator-design-review/3-contract/contract.md:80)

### 可定位的信息问题与正面反证

- **验收方法的语法不能只容一个档位**：AC-002为D+A、AC-004为D+C、AC-005为A+回归边界+C。旧verify只列三个首档A，因此不能把“3条A/3条非A”当作完整方法覆盖表。[contract.md:74](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-skill-creator-design-review/3-contract/contract.md:74)、[verify.txt:4](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-skill-creator-design-review/3-contract/verify.txt:4)
- **追溯是有意识的部分门禁**：api-mock要求ac值是design里存在的编号；后续AC轮明确只机械检查格式、引用真实性靠示范与grader。不能宣称漏做了一个明确要求的全局自动校验；但“可追溯”实际依赖人工语义核对，不能只看字段存在。[api-mock.md:103](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-skill-creator-design-review/2-prototype/api-mock.md:103)、[rounds.jsonl:31](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-skill-creator-design-review/1-interview/rounds.jsonl:31)
- **确认版样例仍存在跨处不一致**：api-mock两轮with_skill都是1.00，示例却将current_best推进到第二轮；其同页规则是“严格更高才推进，平局不推进”，mock也显示第二轮current_best。此处矛盾来自规格样例，不是根据实现猜测。[api-mock.md:21](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-skill-creator-design-review/2-prototype/api-mock.md:21)、[api-mock.md:41](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-skill-creator-design-review/2-prototype/api-mock.md:41)、[api-mock.md:68](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-skill-creator-design-review/2-prototype/api-mock.md:68)
- **正面反证：有真实下游成果，不能按旧红灯判失败**。本地实现提交`5bc9b3f34a13150e626c2043a046e2629a323256`明确关联本合同，并包含示范log-error-summary的design/history/评测工件；当前对应design与history仍存在。history前两轮记录with_skill从0.75到1.00、won1/tie1；design迭代记录记载先暴露大小写问题、再修复，而不是首轮一律写通过。[history.json:5](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/ue/log-error-summary/history.json:5)、[history.json:23](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/ue/log-error-summary/history.json:23)、[design.md:36](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/ue/log-error-summary/references/design.md:36)
- **另一项正面反证**：用户在AC轮选“新建小技能”示范；合同明确其代价是跨workspace面改由沙箱验证，而没有假称这次示范覆盖了所有真实历史对比。[contract.md:125](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-17-skill-creator-design-review/3-contract/contract.md:125)

### 证据强度与对假说的含义

本轮读取了后续`c4346d953775f1898798ce17cc9f449f15626feb`的replay-evidence.md Git对象：它记录7项校验、真实输入计数、重打包与SHA，并明确“复用with/without产物、timing=null”，没有伪称新模型评测。`5bc9b3f`和`c4346d9`均为当前HEAD祖先。当前history/design是本轮直接核对的持久工件；其性能数字与PASS仍是历史评测记录，未本轮复跑。

**推论**：这是单合同复杂改动能够产出实质成果的正例，不能用来论证“必须先有票才可能交付”。同时它已经采用“生产线合同→示范技能design/AC→评测记录”的分层证据，支持把不同层级的目标和验收分开；不必把这种能力限定为某个文件名或tracker。

## 6. 2026-08-20-workflow-interview-web

### 目标、阶段与交接

用户最初要求“不要超时、过一天页面确认还能继续”；调查后把它拆成“活宿主可唤醒、关闭时server缓冲、重开吸收”，并明确48h缓冲不是关闭宿主期间即时唤醒。这个边界经过Q1带覆盖/不覆盖说明的选择。[rounds.jsonl:1](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-20-workflow-interview-web/1-interview/rounds.jsonl:1)、[rounds.jsonl:3](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-20-workflow-interview-web/1-interview/rounds.jsonl:3)

三阶段done、ready，单contract六AC；完整三阶段Web化是本轮，trigger/output evals及发布侧明确排除。不能事后把被排除范围计为遗漏。[contract.md:27](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-20-workflow-interview-web/3-contract/contract.md:27)

### 实际证据与验证边界

- verify记录AC-001/002/003分别执行同一套12/12测试并PASS；这是三次同套测试，不能相加宣传成36个不同场景。[verify.txt:4](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-20-workflow-interview-web/3-contract/verify.txt:4)
- AC-004有steps、expected、输入round JSON、4张PNG；steps记录真实Chromium/HTTP/WS、Other/刷新/锁定/契约确认，并记录发现hidden样式问题后修复复测。submission JSON实存相应答案与时间。本轮打开了其中锁定与契约确认两张PNG，确见相应画面，不仅是读取PASS一词。[steps.md:10](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-20-workflow-interview-web/web/evidence/ac-004/steps.md:10)、[steps.md:34](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-20-workflow-interview-web/web/evidence/ac-004/steps.md:34)、[browser-r1.json:5](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-20-workflow-interview-web/web/submissions/browser-r1.json:5)
- AC-005记录杀wait-submit后POST200、落盘、scan、mark-consumed、再scan为空与重启恢复。本轮核对submission/consumed时间、server-stopped标记，并打开恢复PNG，画面保留两个submitted轮次。[steps.md:17](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-20-workflow-interview-web/web/evidence/ac-005/steps.md:17)、[steps.md:37](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-20-workflow-interview-web/web/evidence/ac-005/steps.md:37)
- **边界不是失败也不能被扩大**：AC-005明确选“模拟隔天”而非真实过夜；steps末尾进一步声明用acceptance fixture模拟家族映射，不修改manifest/rounds。因此上述证据证明了提交/恢复部件的实跑，未证明新宿主会话实际从Web答案驱动家族round/stage一路完成。[rounds.jsonl:20](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-20-workflow-interview-web/1-interview/rounds.jsonl:20)、[steps.md:45](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-20-workflow-interview-web/web/evidence/ac-005/steps.md:45)

### 信息问题与正面反证

- **已证实的规格样例矛盾**：api-mock成功请求中同一Q1同时有choice和custom，但同文件已锁规则要求同一q_id最多一条且两者互斥。不能把示例自动当成golden而忽略声明式规则。[api-mock.md:57](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-20-workflow-interview-web/2-prototype/api-mock.md:57)、[api-mock.md:115](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-20-workflow-interview-web/2-prototype/api-mock.md:115)
- **整体目标比自动验收多一条边**：目标是提交即时唤醒Agent继续下一轮，AC-002的自动谓词止于submission在盘、wait-submit退出并打印JSON；文件→宿主续回合→家族落账这条边没有在该AC中实测。因此“部件自动全绿”不足以自动推出完整双向访谈。[contract.md:19](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-20-workflow-interview-web/3-contract/contract.md:19)、[contract.md:84](G:/GIT/AI_WorkFlow/parking-agents-manual/.aes-workflow/grilling/2026-08-20-workflow-interview-web/3-contract/contract.md:84)
- **强正面反证**：本例的B/C并非没有证据的自陈；它们有输入、期望、步骤、截图、真实提交文件和消费标记，明显强于只写“人工看过”。证据仍不能单靠画面证明全部后台语义，也不等于本轮重跑。
- **实现确已进入本地历史**：`e110e333d42a88fe9ebe18282fc86b1d389ba173`同时提交此案例证据和新技能runtime/UI，是当前HEAD祖先。后续还有`9492be6`等schema/端口修正提交的本地记录。后续修正存在说明系统在继续演进，不直接推出原合同没有价值或当时全部失败。

**推论**：本例最有力地支持“独立部件验收之后仍要验证整体用户旅程”，而不是只增加更多小票。它也反驳“非A都不可靠”“一份合同不能承载跨模块增量”这两种绝对说法。

## 对大任务假说的有限结论

1. **被支持的部分**：复杂任务需要把原始意图、边界、依赖、样例、可执行判据与人工/外部依赖明确组织；需要对变化传播与证据版本负责。六例的实际矛盾集中在“声明/示例/命令不一致”“动态母集”“单AC多验证方法”“部件结束被当作旅程结束”。这些是可验证的问题，不靠经验口号。
2. **未被证明的部分**：这六例没有“同任务单合同 vs Spec+拆票”的受控对照，也没有完整的多票收口样本，不能据此声称新增Spec文件与票层必然提高成功率，更不能给百分比。
3. **被反驳的过强说法**：没有contract不等于失败（BPR）；旧冒烟红不等于没有实现（NAS/图表/生产线）；非A不等于没有强证据（Web）；AC达到7不自动要求拆（NAS与图表有明确用户裁决和依赖理由）。
4. **应保留的根问题**：本次新增能力究竟要证明“给全新执行者的规格/票已完备可验”，还是还要证明“真实执行、集成与用户旅程已经闭合”？Web模拟映射和评分人工盲评把这两个终态的差别具体展示出来，不能由Agent代替用户选择。

## 未知项

- 六例的完整宿主会话转录、真实执行任务ID和逐条最终验收收据没有都留在案例目录；因此没有计算“Goal完成率”。
- NAS与评分涉及原机`D:/GIT_dev`、用户目录和内网NAS；本輪未访问这些外部现场，历史路径现今不可读不用于判当时失败。
- BPR在此目录外是否继续执行没有充分证据；当前stage是目录快照，不一定是整个工作的最终命运。
- 用户批准来源在多数早期案例中是rounds/contract转述；没有独立签名或内容摘要绑定。本轮不据此否认确认，也不把转述升级为版本锁定证明。
- 当前示范history可核对数据在盘，但本轮没有重新执行模型评测、评分器或所有历史断言。

## 没查的

- 不查远端Issue/MR、网络资料和其他机器；不运行NAS/文件删除/重启/发布等历史验收命令。
- 未逐一阅读所有已被确认版替代的draft，也未重渲染所有HTML；每个未读项在下方清单明示。
- 不给这六例套今天的validator或七面规则判历史对错；仅按当时记录的约定与实际证据辨析。
- 不修改原案例、不落实新Spec/拆票机制、不恢复Q1提问、不改当前manifest/context/rounds。

## 全部产物与实际阅读清单

以下清单由本轮磁盘扫描生成；“全文已读”包含按行读取全部文本，“图像已看”只代表查看历史画面，“仅清单”不冒称已读内容。全部正式contract均全文已读。后续实现的Git对象与现存示范产物阅读见各例证据段。


### 2026-08-16-jenkins-learning-nas-scope（17个文件）

| 文件（相对案例目录） | 实际阅读 |
| --- | --- |
| `1-interview/context.md` | 全文已读 |
| `1-interview/rounds.jsonl` | 全文已读 |
| `2-prototype/behavior.md` | 全文已读 |
| `2-prototype/drafts/v1-behavior.md` | 仅清单 |
| `2-prototype/drafts/v1-example-run.md` | 仅清单 |
| `2-prototype/drafts/v2-behavior.md` | 仅清单 |
| `2-prototype/drafts/v2-example-run.md` | 仅清单 |
| `2-prototype/drafts/v3-behavior.md` | 仅清单 |
| `2-prototype/drafts/v3-example-run.md` | 仅清单 |
| `2-prototype/drafts/v4-behavior.md` | 仅清单 |
| `2-prototype/drafts/v4-example-run.md` | 仅清单 |
| `2-prototype/drafts/v5-behavior.md` | 仅清单 |
| `2-prototype/example-run.md` | 全文已读 |
| `2-prototype/impact-surface.md` | 全文已读 |
| `3-contract/contract.md` | 全文已读 |
| `3-contract/verify.txt` | 全文已读 |
| `manifest.json` | 全文已读 |

### 2026-08-16-scoring-system-fixes（10个文件）

| 文件（相对案例目录） | 实际阅读 |
| --- | --- |
| `1-interview/context.md` | 全文已读 |
| `1-interview/rounds.jsonl` | 全文已读 |
| `2-prototype/behavior.md` | 全文已读 |
| `2-prototype/drafts/v1-behavior.md` | 仅清单 |
| `2-prototype/drafts/v1-example-run.md` | 仅清单 |
| `2-prototype/example-run.md` | 全文已读 |
| `2-prototype/impact-surface.md` | 全文已读 |
| `3-contract/contract.md` | 全文已读 |
| `3-contract/verify.txt` | 全文已读 |
| `manifest.json` | 全文已读 |

### 2026-08-17-bpr-skill-improve（10个文件）

| 文件（相对案例目录） | 实际阅读 |
| --- | --- |
| `1-interview/context.md` | 全文已读 |
| `1-interview/rounds.jsonl` | 全文已读 |
| `2-prototype/drafts/v1-api-mock.md` | 全文已读 |
| `2-prototype/drafts/v1-behavior.md` | 全文已读 |
| `2-prototype/drafts/v1-example-run.md` | 全文已读 |
| `2-prototype/drafts/v1-references-report-template.md` | 全文已读 |
| `2-prototype/drafts/v1-references-source-quality.md` | 全文已读 |
| `2-prototype/drafts/v1-skill.md` | 全文已读 |
| `2-prototype/impact-surface.md` | 全文已读 |
| `manifest.json` | 全文已读 |

### 2026-08-17-diagram-artifact（14个文件）

| 文件（相对案例目录） | 实际阅读 |
| --- | --- |
| `1-interview/context.md` | 全文已读 |
| `1-interview/facts/diagram-design-内核.md` | 全文已读 |
| `1-interview/facts/家族闸门与产物机制.md` | 全文已读 |
| `1-interview/rounds.jsonl` | 全文已读 |
| `2-prototype/behavior.md` | 全文已读 |
| `2-prototype/diagram.html` | 仅清单 |
| `2-prototype/drafts/v1-behavior.md` | 仅清单 |
| `2-prototype/drafts/v1-diagram.html` | 仅清单 |
| `2-prototype/drafts/v1-example-run.md` | 仅清单 |
| `2-prototype/example-run.md` | 全文已读 |
| `2-prototype/impact-surface.md` | 全文已读 |
| `3-contract/contract.md` | 全文已读 |
| `3-contract/verify.txt` | 全文已读 |
| `manifest.json` | 全文已读 |

### 2026-08-17-skill-creator-design-review（18个文件）

| 文件（相对案例目录） | 实际阅读 |
| --- | --- |
| `1-interview/context.md` | 全文已读 |
| `1-interview/facts/eval对比能力现状.md` | 仅清单 |
| `1-interview/facts/设计文档先例与拆分样板.md` | 仅清单 |
| `1-interview/rounds.jsonl` | 全文已读 |
| `2-prototype/api-mock.md` | 全文已读 |
| `2-prototype/behavior.md` | 全文已读 |
| `2-prototype/diagram.html` | 全文已读 |
| `2-prototype/drafts/v1-api-mock.md` | 仅清单 |
| `2-prototype/drafts/v1-behavior.md` | 仅清单 |
| `2-prototype/drafts/v1-diagram.html` | 仅清单 |
| `2-prototype/drafts/v1-example-run.md` | 仅清单 |
| `2-prototype/drafts/v1-mock.html` | 仅清单 |
| `2-prototype/example-run.md` | 全文已读 |
| `2-prototype/impact-surface.md` | 全文已读 |
| `2-prototype/mock.html` | 全文已读 |
| `3-contract/contract.md` | 全文已读 |
| `3-contract/verify.txt` | 全文已读 |
| `manifest.json` | 全文已读 |

### 2026-08-20-workflow-interview-web（42个文件）

| 文件（相对案例目录） | 实际阅读 |
| --- | --- |
| `1-interview/context.md` | 全文已读 |
| `1-interview/facts/aes-grilling-web-runtime.md` | 仅清单 |
| `1-interview/facts/deep-research-wakeup-and-persistence.md` | 全文已读 |
| `1-interview/facts/web-interaction-references.md` | 仅清单 |
| `1-interview/facts/workflow-interview-family.md` | 仅清单 |
| `1-interview/rounds.jsonl` | 全文已读 |
| `2-prototype/api-mock.md` | 全文已读 |
| `2-prototype/behavior.md` | 全文已读 |
| `2-prototype/diagram.html` | 仅清单 |
| `2-prototype/drafts/v1-api-mock.md` | 仅清单 |
| `2-prototype/drafts/v1-behavior.md` | 仅清单 |
| `2-prototype/drafts/v1-diagram.html` | 仅清单 |
| `2-prototype/drafts/v1-example-run.md` | 仅清单 |
| `2-prototype/drafts/v1-mock.html` | 仅清单 |
| `2-prototype/example-run.md` | 全文已读 |
| `2-prototype/impact-surface.md` | 全文已读 |
| `2-prototype/mock.html` | 仅清单 |
| `3-contract/contract.md` | 全文已读 |
| `3-contract/verify.txt` | 全文已读 |
| `manifest.json` | 全文已读 |
| `web/assets/diagram.html` | 仅清单 |
| `web/assets/mock.html` | 仅清单 |
| `web/consumed/browser-contract-r2.json` | 全文已读 |
| `web/consumed/browser-r1.json` | 全文已读 |
| `web/consumed/overnight-r3.json` | 全文已读 |
| `web/evidence/ac-004/01-three-tiers-other.png` | 仅清单 |
| `web/evidence/ac-004/02-submitted-locked.png` | 图像已看 |
| `web/evidence/ac-004/03-contract-revise-draft.png` | 仅清单 |
| `web/evidence/ac-004/04-contract-confirmed.png` | 图像已看 |
| `web/evidence/ac-004/expected.md` | 全文已读 |
| `web/evidence/ac-004/round-contract.json` | 全文已读 |
| `web/evidence/ac-004/round-r1.json` | 全文已读 |
| `web/evidence/ac-004/steps.md` | 全文已读 |
| `web/evidence/ac-005/01-submit-without-waiter.png` | 仅清单 |
| `web/evidence/ac-005/02-restart-restored-current.png` | 图像已看 |
| `web/evidence/ac-005/round-overnight.json` | 全文已读 |
| `web/evidence/ac-005/steps.md` | 全文已读 |
| `web/server-stopped` | 全文已读 |
| `web/state.json` | 全文已读 |
| `web/submissions/browser-contract-r2.json` | 全文已读 |
| `web/submissions/browser-r1.json` | 全文已读 |
| `web/submissions/overnight-r3.json` | 全文已读 |

本分片清单合计：111个文件；全文读取71个文本文件；查看3张历史PNG；其余37个只检查清单与用途，不计入已读证据。
