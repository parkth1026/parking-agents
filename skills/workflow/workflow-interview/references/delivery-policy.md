# 正式交付、过程留存与提交预览

本规则由三个子技能共用。正式交付清单是发布范围的唯一来源。清单写在manifest.json的delivery字段，只能用session.mjs登记。不要再手写一份平行的权威清单。

## 事实与现行材料

关键事实写成简短结论、证据位置和核验时点。可以写在现有context或事实分片中，不为每次重验另建文件。证据应能定位到文件、版本或命令结果；旧分析和聊天只提供调查线索，不能直接证明当前行为。推荐与已锁事实冲突时，先只读重验相关代码或环境，再提出保留或修订建议。无法重验的事项明确标为未知或Blocked。

明确一个需求宿主和当前权威入口。执行Agent能否取得正式文件、外部输入和共享前提，要在交接前检查。不要为统一入口自动迁仓、删除旧副本或操作Git；历史副本标明归档身份即可。

目录、模块边界、包名或关键方案变化后，列出被替换的术语和路径，在当前正式材料中检查残留及相互矛盾。只改现行正文；rounds、旧草稿和归档保留原文。静态链接通过不代表业务术语正确。

## 文件怎样分类

| 用途 | 默认处理 |
| --- | --- |
| 当前需求、结构化问答、重要裁决与取舍 | 正式交付，进入Git候选清单 |
| 当前确认版界面、行为、流程图、接口对照物及必要资产 | 正式交付 |
| 正式契约、验收脚本、黄金输入/期望、规格锁、依赖清单和包锁 | 正式交付；执行产生的证据不混入规格目录 |
| 当前dossier.html | 正式交付的生成入口，只保留一份 |
| 旧草稿、候选契约、完整分工审查原稿 | 本地过程材料；重要结论汇总到当前需求或契约，不强制再建摘要文件 |
| 运行日志、普通截图、trace、原始回执 | 放在仓库artifacts/workflow-interview/<任务>/下，默认不提交 |
| 依赖目录、缓存、临时生成器 | 不提交 |

用途优先于扩展名。被锁定为验收依据的截图、样本或记录属于正式输入，必须提交或采用仓库认可的可恢复存储。不得把唯一依据留在某台机器的忽略目录。外部输入要写明版本、指纹和恢复方式；工具不代替远端可用性验证。

保留现有三阶段目录。未确认原型放2-prototype/drafts/，默认不提交。包外证据使用artifacts/workflow-interview/<任务>/reviews、runs或archive，按需建立。不要为每个任务强制创建空目录或多份README、复审摘要、校验摘要。

## 登记与检查

准备一个计划JSON，放包外过程目录。files登记相对issue根的文件路径和用途；excluded逐文件说明现存但不发布的材料。这里只演示格式，实际应列全正式文件及过程材料。

```json
{
  "files": [
    {"path":"manifest.json","role":"state"},
    {"path":"1-interview/context.md","role":"requirement"},
    {"path":"1-interview/rounds.jsonl","role":"decision"},
    {"path":"dossier.html","role":"derived"}
  ],
  "excluded": [
    {"path":"2-prototype/drafts/v1.html","reason":"已被确认版替代，原件保留"}
  ]
}
```

用途还支持entry、prototype、contract、verification和asset。所有正式契约都登记为contract；固定contract.md及contract-*路径误标其他用途会被工具拒绝。登记命令为普通文件记录SHA-256，manifest和生成的dossier不记录自身哈希，避免自引用。

文档引用按用途处理，不按文件是否恰好存在猜测用途：

- 现存验收输入：当前Markdown链接、契约普通相对输入及本issue仓库路径须发布；`./`、`../`均按文档位置解析。“读什么”中的本issue对照物、verification、fixtures及锁定输入继续检查缺件、发布范围和指纹。
- 未来产品输出：契约“要落盘的东西”及其子节列的是实现目标，普通路径、`./`、`../`和Markdown链接都不要求提前存在。当前验收依据须另列到“读什么”或登记为verification；不能把唯一现存依据藏到输出列表。
- 原话历史：“原始请求”“用户原话”“访谈原话”“原始任务”“任务陈述”及其子节保留原文，其中本机绝对路径与外部链接不自动成为当前发布输入。明确本issue的相对链接、逻辑issue前缀与输入路径继续检查；同一链接出现在其他当前章节时，也按当前用途检查。历史例外不覆盖整个context或契约。
- 宿主源码指路：仅在契约“读什么”中识别从仓库根开始的skills、src、apps、engine、tools、docs、tests、packages、crates路径；相同路径使用`./`时仍表示issue内输入。同一行可用指向references/scripts子树的完整skills文件路径，为后续references/scripts短路径建立基准；单独SKILL.md不建立该基准。原文在同一行先明确绝对Git仓库地址时，后续源码路径以该仓库为作用域；出现下一仓库地址后切换作用域。目录指路只用于浏览，必需文件仍须逐个写明。裸文件名、自然语言省略和计算路径不在静态推断保证内，必须另行核对或写成明确路径。

源码指路须有可恢复Git版本。登记时自动写入同一delivery的repository_inputs，保存来源文档、路径、物理SHA-256、commit、gitPath、blob_sha256及checkout_eol；显式外部仓库另存原文repository地址。默认验证HEAD；计划可在repository_inputs中用source/path/repository/commit明确给出历史commit提示，工具仍重新读取实际文件和该commit的blob，不采信提交者填写的SHA。内建LF到CRLF检出仅在Git属性/配置允许且重构字节完全一致时采用，冻结配方为crlf；其他直接一致的文件为identity。外部filter拒绝且不执行。不把任意文本归一化成匹配。缺失、未跟踪或无法按所记版本恢复的源码不能冒写身份；先取得实际版本或把必要快照登记为issue输入。不要为消除报错复制整套产品源码到需求目录。

repository_inputs属于交接前提，不是第二份发布清单。源任务检查当前源码及指定commit的内容身份；包外预览保留冻结身份，不复制产品源码。执行前须从原宿主恢复指定commit和gitPath并核对SHA-256。预览中的恢复可取得性明确为NOT_VERIFIED；提交检查不证明远端可达，也不采集remote URL或凭证。

同一契约已在“读什么”唯一声明的宿主文件，可供其他章节的references/scripts短路径复用；多来源同名时拒绝歧义，未声明时仍按issue输入检查。Verify中的可识别执行命令保留为命令，不把普通仓库参数当作issue文件；命令中明确的本issue前缀、verification或fixtures输入仍检查，包括`--参数=路径`右值及匹配的外层引号。这只是窄路径提取，不是shell解析；静态检查不执行这些命令。

```bash
node <workflow-interview>/scripts/session.mjs delivery <issue-dir> --plan <plan.json>
node <workflow-interview>/scripts/session.mjs finalize <issue-dir>
node <workflow-interview>/scripts/export-dossier.mjs --issue-dir <issue-dir>
node <workflow-interview>/scripts/session.mjs submission-check <issue-dir>
node <workflow-interview>/scripts/session.mjs submission-check <issue-dir> --output <新的包外预览目录>
```

阶段产物变化后，核对用户确认与锁定规格，再重新登记清单。不得靠重新登记或改规格锁来放宽已确认验收。已有锁文件会再次检查。输出目录必须新建，工具拒绝覆盖，拒绝通过符号链接读写文件。

预览目录包含issue/、submission.json和submission-files.txt。清单给出原仓库相对路径、用途、字节数与SHA-256；issue/只复制正式文件，并重新生成dossier。公共ignore及实际依赖的仓库ignore规则复制到repository-files/，同时列入repositoryPrerequisites；它们是共享前提，不一定都是本次新增文件。档案保持manifest中的稳定任务标识，不采用预览目录名。工具不搬走或删除原件，只读调用Git确认忽略效果，不暂存、提交或运行产品和模型。

submission-check检查：未分类文件、正式文件缺失或内容改变、本地页面与文档链接（含script的src）、静态相对导入、契约点名的本issue输入、规格锁和包锁。npm验收包的package-lock.json必须发布，缺锁是错误，不只告警；其他包管理器需另行明确支持。最终检查强制要求dossier.html登记为derived且存在。生成HTML还检查本地链接、任务身份、当前manifest和来源指纹；旧档案不能冒充当前来源状态。该检查不证明可见正文与规范投影逐字一致。动态计算的导入、远端服务、凭证、原生模块和实际浏览器行为不在静态保证内，必须另验。目录内只排除文件而不补齐依赖，会被拒绝。

旧任务没有delivery时，原阶段校验与旧版档案导出继续可用；工具发出旧模式提示。旧Web任务缺失或损坏manifest时仍由共享库容错导出。旧Web默认输出保持web/exports；登记后统一默认输出根dossier.html。submission-check不会因旧模式而通过，必须先登记清单。登记后finalize和3-contract的done闸门都会检查清单中的权威输入，允许派生dossier缺少或过期。完成状态写入后导出dossier；最终提交检查要求dossier存在、来源状态最新且依赖完整。

锁定ZIP、LOG、TRACE样本可明确登记为verification或asset，并按正常指纹与规格锁检查；不因扩展名被一律排除。这个例外不开放保留过程目录、.git目录或临时文件。

## 契约修订与复审

上游重开或finalize失效时，同时撤销契约阶段done；仅重新关闭上游不能恢复Ready，须重新通过当前契约校验。Windows契约留底按实际文件身份合并路径别名，全部登记指纹都须满足，不能靠后项覆盖早先约束。旧Web状态与新增family修订轮次共同投影到档案轨迹，保留旧答案、合并等义镜像、分别保留冲突记录。正式来源的字节数从实际读取的Buffer取得，源档案与预览均须有数值及SHA-256。

已有契约的目标和边界不变时，在原issue修订，不重置已确认的访谈和对照物。目标、范围或用户裁决变化时，回到受影响阶段澄清；纯文字复审和已知缺陷修正不自动触发整链回访。

实质修改前保留可恢复底本。已提交且内容一致的Git revision可作为底本；未提交内容须先快照。记录来源、修订理由和内容指纹，不能只留“修改N处”的摘要。可使用下列命令，一并归档当前契约与manifest、写入指纹回执并撤销旧Ready；工具只重开3-contract，保留1-interview和2-prototype：

```bash
node <workflow-interview>/scripts/session.mjs revise <issue-dir> --reason "<本次修订理由>"
```

命令要求1-interview为done，2-prototype为done或已确认的skipped。上游未闭合的独立或旧契约，可先用Git revision或包外副本留底，再按实际阶段继续，不补造确认。已登记的契约缺件或指纹不符时，先找回登记原件，工具不会把残缺副本当作完整底本。

命令返回JSON：archive指向底本目录，issue/下保留原相对路径，receipt指向revision.json指纹回执；现存verify.txt和verify-evidence.txt也归档。归档成功后状态回到in_progress，validation标为invalid/stale；仅3-contract重开并清closed_at，前两阶段不变。命令不自动追加round。

底本和完整审查原稿放宿主artifacts/workflow-interview/<任务>/archive或reviews，不登记为正式验收输入。修订后用session.mjs round记录改动和依据，triggered_by指向底本或审查证据；Agent的修复记录不能伪装为用户confirm。会改变验收后果或已锁边界的调整仍需用户实际裁决。更新现行材料后重新登记delivery，再按finalize、stage done、导出dossier、submission-check收尾。旧Ready或旧档案不能作为新版已就绪的证明。

候选收敛时，按风险或用户要求做一次只读对抗审查。公共接口、跨仓边界、难逆兼容及非自动验收优先审查；没有新增变化或证据时不重复跑同一轮。限定审查范围，findings逐项修复或说明保留理由，重要裁决并入当前材料，不强制再建摘要、固定人数或重复询问token预算。审查不能替用户确认，也不能替产品验收。

finalize前简查：每条验收是否有可完成且可判定的路径；是否存在实现正确仍永远失败的条件；契约、对照物与强约束是否互相矛盾。非自动验收写明操作、证据、通过/失败条件和责任方。未来产品输出不要求提前存在；缺凭证、NAS、真实数据等必要资源时，记录Blocked及解除条件，不用SKIP、合成数据或占位实现冒充原验收。新建验收基建或调整验证范围按已有授权处理，不因修订自动取得实施权限。

## 档案与历史

登记后的dossier只投影清单中的正文、原型和来源；过程原件即使仍在目录中，也不列作当前结果。原始问答保留，其中提到的旧草稿是历史线索，不自动成为发布依赖。历史、未来输出和仓库源码的Markdown链接在页面中显示为标签与原路径，避免生成假装可用的包内链接；正式源文件及机器JSON正文保持原文。真正输入保持可点击链接，并继续检查HTML资源、script、静态导入、规格锁和包锁。不能用显示方式替代实际输入闭合。

Git忽略范围遵从仓库约定。不要整体忽略.aes-workflow、verification、HTML或JSONL，否则会隐藏确认版和验收输入。已有跟踪文件须另查索引；忽略规则不能替代交付清单。

## 初始化公共忽略规则

权威模板为assets/grilling.gitignore。session.mjs init自动维护仓库.aes-workflow/grilling/.gitignore，覆盖所有任务的保留过程目录。公共文件本身应随仓库提交，不重复复制到每个任务。

node_modules/、drafts/、test-results/、playwright-report/全部使用简写，在grilling内任意层级生效。这四个目录名保留给依赖、草稿和运行输出，任何用途都不能登记为正式交付；历史文件仍可逐项登记为excluded并保留。正式黄金输入和期望使用fixtures/input/、fixtures/expected/等目录，不放入保留过程目录。

- 文件不存在时创建；没有管理区块时追加，区块外文本、BOM及换行保持。
- 重复初始化不改文件内容，也不改已有任务manifest。
- 管理区块含模板版本和正文哈希。未经改动的旧版本可更新；手改、缺标记、重复区块和未来版本均报错，原件保留，不追加第二块。
- 文件或祖先路径是符号链接/junction时拒绝写入。
- init不会自动修改仓库根.gitignore；根artifacts未受保护时报告警告，局部配置成功不等于全局保护完整。

submission-check在真实源目录独立执行Git检查，不在checkDelivery或包外副本中执行。检查使用真实issue路径定位仓库和当前任务；Windows的源任务、artifacts目录和Git记录按同一真实身份分类，不对其他平台路径一律转小写。支持.git文件形式的独立Git目录。正式清单与公共ignore不得被忽略。除固定过程输出探针外，还枚举当前任务任意层级保留过程目录中的现存文件，以及artifacts/workflow-interview/<任务>/下的文件；不因文件已登记excluded就跳过Git检查。Git枚举出现警告或错误时视为未完成，不能只凭退出码0判定覆盖完整。输出必须被仓库内可恢复的.gitignore保护。检查同时验证不依赖本机exclude/global的仓库目录规则，不能只按规则文件的名称和位置推定可共享。实际输出所依赖的适用祖先ignore也纳入预览共享前提。非Git目录的忽略效果标为NOT_VERIFIED，不能通过Git提交检查；静态材料检查和旧版导出仍可使用。

跟踪扫描同时覆盖grilling及artifacts/workflow-interview。当前任务已跟踪的过程输出（含包外artifacts）阻塞提交检查；其他旧任务的已跟踪输出列为历史债务警告，保留文件与索引，不自动git rm。迁移根目录重复规则须先验证局部规则等价并保留自定义内容，只在用户明确授权时执行。

目录已删除且大小写归属无法证明时，报告身份不明并阻塞，不将可能属于当前任务的输出降为历史警告。

提交检查通过只表示材料可交接。它不表示产品验收通过，也不授权暂存、提交或删除历史。交接时同时报告非自动验收、阻塞与未执行项。
