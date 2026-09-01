# Fact: 大任务 Spec → 拆票 → 独立验收的验证基建候选池

- 派遣问题：当前仓库有哪些可复用的测试命令、CI 门、fixture 与技能评测入口，哪些证据已经存在，哪些验收能力需要针对本次需求补建？不裁决本次范围止于派发前还是覆盖实际执行收口。
- 完成：2026-08-31T20:38:30+08:00
- 调查目录：`G:\GIT\AI_WorkFlow\parking-agents-manual`
- 源码基线：`f4e37757b9f3d5627c7636626f579d87d523bc37`；本轮开始时仅见本次访谈目录与前轮研究报告未跟踪，没有观察到已跟踪源码改动。
- 调查方式：只读文件、只读清单命令；复用本会话前轮测试证据，不重跑全量测试，不调用会修改真实访谈状态的 finalize、verify、stage，不创建或发布票。

## 查到的

| 事实 | 证据出处 |
| --- | --- |
| 仓库根有 `npm test` 总入口，串行运行 aes-qa 截图证据契约、技能发现与安装、工具名检查、会话 hook、Pi 扩展、harness 清单、版本检查和 `check:repo`。此命令没有包含 workflow-interview 的独立回归入口。 | [package.json:12](G:/GIT/AI_WorkFlow/parking-agents-manual/package.json:12)、[package.json:13](G:/GIT/AI_WorkFlow/parking-agents-manual/package.json:13) |
| `check:repo` 当前只扫描 matt-skills 的 engineering、productivity 和 pub；不能据此声称覆盖 skills/workflow 的本次改动。 | [package.json:8](G:/GIT/AI_WorkFlow/parking-agents-manual/package.json:8) |
| workflow-interview 有现成独立回归入口，串行运行 session 和 dossier 两个套件。前轮主会话实际结果为 session 71/71、dossier 13/13，共84项通过；此处复用该证据，没有再次执行。 | [run-tests.mjs:10](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/run-tests.mjs:10)、[前轮报告:405](G:/GIT/AI_WorkFlow/parking-agents-manual/docs/research/2026-08-31-workflow-interview-goal-contract-deep-analysis.md:405) |
| session 回归通过真实子进程调用命令，验证退出码、输出与文件；fixture 在系统临时目录内创建伪仓库，子进程工作目录是临时仓库。dossier 套件同样使用临时伪仓库。 | [session.test.mjs:8](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/scripts/session.test.mjs:8)、[session.test.mjs:19](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/scripts/session.test.mjs:19)、[session.test.mjs:38](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/scripts/session.test.mjs:38)、[export-dossier.test.mjs:19](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/scripts/export-dossier.test.mjs:19) |
| 现有84项覆盖的是已有阶段结构门禁、恢复与档案投影的指定场景，不是本次大任务 Spec→拆票能力的完成证据。现有 session 测试中，finalize 直接覆盖主要为缺 contract 报错，另有纯非A的 verify 场景。 | [session.test.mjs:286](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/scripts/session.test.mjs:286)、[session.test.mjs:358](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/scripts/session.test.mjs:358) |
| 当前 validator 可以提供格式校验，但它不验证 Spec→票之间语义覆盖和多票聚合。session 的 contractPath 固定为单个 `3-contract/contract.md`。 | [validate-goal-contract.mjs:113](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/scripts/validate-goal-contract.mjs:113)、[session.mjs:65](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/scripts/session.mjs:65) |
| 前轮函数级内存探针已重现重开仍保留 ready/valid、首档 Verify 解析、缺模块错误被当作普通 RED 等行为。它们可作为回归场景来源，但模拟文件系统/子进程的探针不能替代真实 CLI 或产品端到端证据。 | [前轮报告:406](G:/GIT/AI_WorkFlow/parking-agents-manual/docs/research/2026-08-31-workflow-interview-goal-contract-deep-analysis.md:406)、[前轮报告:420](G:/GIT/AI_WorkFlow/parking-agents-manual/docs/research/2026-08-31-workflow-interview-goal-contract-deep-analysis.md:420) |
| 通用技能评测入口为 `npm run evals`；它发现技能后检查固定五件套，并执行技能根目录 `run-tests.mjs`。它不会自动消费任意 eval JSON、启动模型访谈或判定文本质量。 | [package.json:11](G:/GIT/AI_WorkFlow/parking-agents-manual/package.json:11)、[run-evals.mjs:15](G:/GIT/AI_WorkFlow/parking-agents-manual/scripts/run-evals.mjs:15)、[run-evals.mjs:85](G:/GIT/AI_WorkFlow/parking-agents-manual/scripts/run-evals.mjs:85) |
| 本轮实际只读执行 `node scripts/run-evals.mjs --list --skill workflow-interview`，退出0，报告 `1/5`、`未执行 (--list)`、五件套不齐。1/5表示固定清单中只有 run-tests；不能误读为只写过一个评测场景。 | 本轮命令输出；固定五件套定义见 [run-evals.mjs:15](G:/GIT/AI_WorkFlow/parking-agents-manual/scripts/run-evals.mjs:15)，list 分支见 [run-evals.mjs:85](G:/GIT/AI_WorkFlow/parking-agents-manual/scripts/run-evals.mjs:85) |
| workflow-interview 另有4个人设评测案例：CLI分组、含糊的中途改需求、报告筛选界面、架构拆分图。这些包含 programmatic/judgment 断言；未覆盖完整 Spec→多票→跨票收口链。此处未运行模型评测，也未把“有用例”说成“当前用例已通过”。 | [evals.json:5](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/evals/evals.json:5)、[evals.json:22](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/evals/evals.json:22)、[evals.json:38](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/evals/evals.json:38)、[evals.json:55](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/evals/evals.json:55) |
| parking-skill-creator 有同宿主 with/old/without 对照评测工作流、隔离 run 目录、评分与历史沉淀。它能提供评测组织能力，但本次大任务的输入、判据和参考答案仍需定义，不能用工具存在替代目标已验。 | [parking-skill-creator/SKILL.md:124](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/parking-skill-creator/SKILL.md:124)、[parking-skill-creator/SKILL.md:140](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/parking-skill-creator/SKILL.md:140)、[parking-skill-creator/SKILL.md:151](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/parking-skill-creator/SKILL.md:151) |
| 在 to-spec、to-tickets、aes-interview、aes-prototype、aes-goal-contract 目录内按 test/fixture 文件名进行的扫描没有发现各自独立的测试/fixture入口；这不等于仓库外没有评测，也不抹掉 workflow-interview 的共享套件。 | 本轮 `rg --files --hidden` 限定上述五个技能目录的扫描，无匹配；上层共享入口见 [run-tests.mjs:10](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/run-tests.mjs:10) |
| aes-gate 提供既有门禁的盘点能力，黑盒自测包含 `--handoff`、临时仓库、结构与缺口断言；handoff不落盘。这可辅助调查目标仓库能怎样验，不能自动补齐本次 Spec/票的语义覆盖。 | [aes-gate/run-tests.mjs:39](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/aes-gate/run-tests.mjs:39)、[aes-gate/run-tests.mjs:50](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/aes-gate/run-tests.mjs:50) |
| aes-worktree-board 有离线 Issue/编排 fixture和历史失败轨迹复放；轨迹用步骤与期望表达失败形态，检查5条语料对指定7类失败的覆盖。其真实 Git fixture会在临时目录建真仓与worktree，是邻接控制面基建，不是本次需求默认必须采用的执行方式。 | [selftest-trajectory.mjs:2](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/aes-worktree-board/scripts/selftest-trajectory.mjs:2)、[selftest-trajectory.mjs:342](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/aes-worktree-board/scripts/selftest-trajectory.mjs:342)、[selftest-fixture.mjs:2](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/aes-worktree-board/scripts/selftest-fixture.mjs:2)、[selftest-fixture.mjs:36](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/aes-worktree-board/scripts/selftest-fixture.mjs:36) |
| aes-qa 当前机械回归入口针对 screenshot-evidence契约，默认执行4个离线case，明确排除live-u2-strict。不能用默认全绿替代真正外部系统/live验证，也不能把它误认作所有产品AC的通用自动验收器。 | [aes-qa/run-tests.mjs:8](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/aes-qa/run-tests.mjs:8)、[aes-qa/run-tests.mjs:16](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/aes-qa/run-tests.mjs:16)、[aes-qa/run-tests.mjs:89](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/aes-qa/run-tests.mjs:89) |
| 本次扫描本地可见文件未发现 `.github`、GitLab CI、Jenkinsfile、Azure Pipelines 等配置；因此目前仅能确认本地命令入口，不能声称远端强制CI已经接管这些门禁。 | 本轮目录存在性检查与 `rg --files --hidden -g '!**/.git/**'` 对常见CI路径/文件模式扫描，无匹配；未访问远端设置 |

## 验证基建候选池

以下是给契约阶段选用的候选，不是已定验收范围，也不是实现计划。

| 候选途径 | 现成部分 | 本次需要补齐的部分或真实前置 | 能证明什么 / 不能证明什么 | 本轮状态 |
| --- | --- | --- | --- | --- |
| workflow-interview原有回归 | Node黑盒命令、临时文件系统、84项已有断言 | 本次改动确定后，运行受影响回归；不能只看仓库根npm test | 既有行为未破坏；不能证明新目标完整覆盖 | 复用本会话前轮 PASS 84/84；未重跑 |
| 新增状态/多契约/追溯机械测试 | 可复用上述Node零依赖测试方式和前轮反例 | 先确定状态含义、Spec/票对应关系、依赖与版本变更规则，再将正反例固化；目标判据尚未裁决 | 可证明给定规则能拒收漏票、过期证据等指定反例；不能代替对规则是否符合用户意图的确认 | 新场景待定义，NOT_RUN |
| Spec与票的语义质量评测 | 现有人设测试表达方式、skill-creator同宿主对照与独立评分工作流 | 需要本次大任务样例、用户认可的“漏了什么算错/拆到什么程度可独立验收”的判据，隔离执行与评分输入 | 能评估理解保真、粒度、依赖和可独立验收性；不是单次自动脚本通过即可保证 | 本次专项评测尚未建立，NOT_RUN |
| 全新上下文交接演练 | 宿主可派只读或隔离执行子任务；已有评测隔离纪律 | 必须定义执行者可见的材料包、允许访问范围和终态证据；依据本次范围决定只审核票可执行性还是实际实现 | 可检查材料能否在无访谈历史时支撑独立判定；没有实际执行时不得声称产品完成 | 具体范围未定，NOT_RUN |
| 历史失败轨迹回归 | worktree-board现成5条历史轨迹、步骤/期望、真实临时Git fixture | 本次若包含调度/执行/合并边界，需核对哪些失败类相关；本仓不因有fixture就改变用户限定的唯一开发目录 | 能证明指定控制面失败形态未复现；不能代替新的Spec拆票全过程验收 | 仅查到入口，NOT_RUN；是否适用待范围裁决 |
| 真实用户案例验收 | 2026-08-30工作台案例及前轮报告提供实际遗漏、重开与多契约素材 | 需要冻结允许使用的输入版本、确认最终目标和应有输出；不能以当前尚有争议的旧Ready合同充当golden真值 | 可证明现实需求在选定边界内完整映射；涉及真实环境/执行时还需权限与业务终态证据 | 可作为素材；golden标准未批准，NOT_RUN |
| 仓库总回归与技能包装校验 | package.json命令、quick-validate、evals聚合入口均在 | 根据实际改动影响面选择；workflow-interview固定评测五件套缺4件，需说明是补齐还是不把它作为本次门禁 | 可证明相关包装/加载约定，不证明大任务产品语义正确 | 本轮未跑总回归；evals只读列表为1/5 |

## 未知项

- 本次能力是只负责“需求完整化、Spec定稿、可独立验收的票交接”，还是还负责执行、集成、整体验收收口。不同答案改变需要实测的业务终态，不能由现成工具多寡替用户决定。
- 大任务的代表性样例和通过标准尚未确认。现有2026-08-30案例有完整复刻等后续变更，不能直接把其旧合同内容指定为正确答案。
- 远端分支保护、必需状态检查、CI运行历史、团队人工审批流程本轮未查；本地无配置匹配不等于远端没有门禁。
- 邻接aes-worktree-board、aes-gate、aes-qa套件的当前运行结果本轮未获取；仅确认入口与用例结构，均不得记PASS。
- 现有4个人设评测在本次源码版本上的实际成绩未获取；`evals --list`不运行它们，也不证明它们失败。
- 对本次Spec和票的追溯、批准版本、例子分配覆盖、多个Verify、阻塞与重开规则，需先由需求/对照物阶段形成明确判据，才能确定哪些适合机械门禁、哪些保留人工判断。

## 没查的

- 不调查具体目标产品的代码实现、数据库、运行环境或真实外部系统权限；尚未确定本次交付是否负责实际执行收口。
- 不运行全仓npm test、不运行工作树编排或外部截图发布；本分片职责是验证基建盘点，不取得额外执行范围。
- 不修改任何技能、模板、脚本、案例或测试；不新增产品验证器，不将上述候选直接写成已批准AC。
- 不改manifest、rounds、context，不建票、不发布票、不替用户作技术方案或范围选择。
