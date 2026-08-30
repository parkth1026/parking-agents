# Fact: 验证拓扑

- 派遣问题：只读调查本仓现有 `aes-qa`、`aes-worktree-board` 与 Goal Contract 如何决定风险、测试强度、自动/live/manual、人类 checklist、最终全量回归、review/QA 独立性，以及 candidate/base 证据失效；为 workflow-interview 后续验证 DAG 裁决提供证据。
- 完成：2026-08-30T04:12:38+08:00

## 查到的

| 事实 | 证据出处 |
| --- | --- |
| 访谈阶段固定先调查目标仓的测试命令、CI 门、覆盖率工具与 fixture 约定；Goal Contract 的验证途径候选池必须来自这份仓库事实，查不到时只能把“用户真实测试”或“先建基建”连同代价列为候选。 | `skills/workflow/aes-interview/SKILL.md:22-30` |
| Goal Contract 当前按每条 AC 决定验证深度：用户裁决“错了的影响”，Agent 根据仓库事实提出验证途径；真实数据、数字门槛或需要新建基建的验证即使 Agent 很有把握也必须问用户。真实数据被建模为 `[B]` 黄金用例，输入与期望输出都要落盘。 | `skills/workflow/aes-goal-contract/SKILL.md:52-73`；`skills/workflow/aes-goal-contract/SKILL.md:87-115`；`skills/workflow/aes-goal-contract/references/goal-contract-shape.md:66-77` |
| Goal Contract 的 `[A]/[B]/[C]/[D]` 只表示自动命令、黄金用例、可复现操作、具名文件检查这四种证据形态，不表示测试强度；同为 `[A]` 的 lint 与端到端测试可相差一个数量级。通用“测试全绿/lint/build”质量门刻意不写进每条 AC，而由交接模板负责。 | `skills/workflow/aes-goal-contract/references/goal-contract-shape.md:154-166`；`skills/workflow/aes-goal-contract/references/goal-contract-shape.md:181-196` |
| Board 的 Issue Contract 是另一套、更执行期导向的结构：必须声明 `riskProfile=low|medium|high|critical`，每条 AC 必须声明 `automated|live|manual`，人工门为可选列表；合同不完整就不能进入无人值守 claim。 | `skills/workflow/aes-worktree-board/scripts/issue-contract.mjs:1-14`；`skills/workflow/aes-worktree-board/scripts/issue-contract.mjs:96-145`；`skills/workflow/aes-worktree-board/scripts/issue-contract.mjs:165-220` |
| 当前 `IssueWorkOrder` 并未把已解析的 `riskProfile` 传给 executor，也没有 `testIntensity`、验证下限、样本清单或升档触发条件字段；它只传 AC 的 `evidenceClass`、`humanGates`、副作用边界和 runner 信息。因此“规划锁定最低测试要求”目前尚不是 typed work-order 能表达或消费的完整协议。 | `skills/workflow/aes-worktree-board/scripts/issue-contract.mjs:266-297` |
| 当前风险升档是 `declaredRisk` 与实际 changed paths 的最大值：identity、权限、密钥、安全、schema/迁移、公共 API、CI 路径可把风险强制升到 high/critical，并留下 `triggeredRules`；它不能把声明风险降级。 | `skills/workflow/aes-worktree-board/scripts/merge-policy.mjs:31-79`；`skills/workflow/aes-worktree-board/scripts/master.mjs:598-622` |
| 该 `effectiveRisk` 当前机械影响的是 review 深度和 merge 策略：low/medium 为 light review 且机械门全绿可自动 merge，high 为 deep review 且仍需人工批准，critical 为 deep review 且只能走 PR。它没有机械生成 QA 测试清单或验证强度。 | `skills/workflow/aes-worktree-board/scripts/merge-policy.mjs:13-29`；`skills/workflow/aes-worktree-board/scripts/merge-policy.mjs:178-224`；`skills/workflow/aes-worktree-board/SKILL.md:399-419`；`skills/workflow/aes-worktree-board/SKILL.md:477-480` |
| `aes-qa` 的现行测试选择规则是按“实际影响面”而非 diff 大小：内部逻辑→automated，CLI/报文/文件格式→automated+真实端到端，identity/权限/外部 API→live，界面/交互/视觉→live+人工，无法自动断言的观感/措辞/业务正确性→manual；把本可自动的项目推给人工也明确算失职。 | `skills/workflow/aes-qa/SKILL.md:41-54` |
| Master 当前对 QA 的机械判断只检查 `outcome=PASS`、receipt 精确绑定 candidate、没有 `NOT_RUN`、`unexecuted[]` 为空，以及 v2 receipt 的 base 绑定；它不把 changed paths / effectiveRisk / AC evidenceClass 与 receipt 中实际跑过的 automated/live/manual 种类逐项对账。因此“没有少测”仍主要依赖 `aes-qa` 角色纪律，而不是 Gate 的完备机械证明。 | `skills/workflow/aes-worktree-board/scripts/merge-policy.mjs:154-175`；`skills/workflow/aes-worktree-board/scripts/master.mjs:1124-1149` |
| 人工测试的目标形态已经存在：`aes-qa` 要求 `AWAITING_HUMAN`、冻结 candidate、释放 writer lease、保留环境 lease 和 resume token；每条 `humanChecklist` 必须写可执行 step 与 expected，Agent 不得代答，等待不会因超时变 PASS。 | `skills/workflow/aes-qa/SKILL.md:27-39`；`skills/workflow/aes-qa/SKILL.md:84-105`；`skills/workflow/aes-worktree-board/scripts/selftest-v4.mjs:890-925` |
| 但 Board 当前 typed `humanRequest` 只有整体 `prompt + requiredEvidence[] + resumeToken`，typed response 只有整体 `PASS|FAIL|WAIVED|ABANDON + actor=human`；没有逐 testcase 的 checked/failed 状态、每项 evidence 引用或“全部勾完才 PASS”的核心合成规则。现有 `humanChecklist` 详细结构停留在 `aes-qa` prose/receipt 示例层。 | `skills/workflow/aes-worktree-board/scripts/human-request.mjs:7-19`；`skills/workflow/aes-worktree-board/scripts/human-request.mjs:26-83`；`skills/workflow/aes-worktree-board/scripts/human-request.mjs:86-116` |
| QA 内循环的独立性当前明确定义为“fresh-context 只读 subagent，只拿 AC、worktree 路径和命令，不拿实现者叙述”；最终 code review 则由 merge-worker 派独立 `code-review` subagent，review receipt 只能由 merge-worker 上报，被审 worker 不能自报 review PASS。现有设计已经把“上下文隔离/证据来源”放在 carrier 名称之前。 | `skills/workflow/aes-qa/SKILL.md:15-25`；`skills/workflow/aes-issue-worker/SKILL.md:50-58`；`skills/workflow/aes-worktree-board/SKILL.md:453-480` |
| Review 独立性目前存在一个重要实现边界：v2 review 必须带 `reviewerSessionId`，Core 会根据它与 `ownerThreadId` 推导 `same-session|independent|unknown`；但现有自测明确锁定三种值都不阻断 merge gate。因此系统能记录独立性，却尚未把“必须 independent”做成放行条件。QA receipt 则没有相应 reviewer/validator identity 字段。 | `skills/workflow/aes-worktree-board/scripts/master.mjs:40-54`；`skills/workflow/aes-worktree-board/scripts/master.mjs:856-910`；`skills/workflow/aes-worktree-board/scripts/selftest-v4.mjs:2372-2420` |
| candidate 前进会在 registry 中显式清空并记录失效的 acceptance、review、QA；stage receipt 的 `commitSha` 不等于当前 candidate 时以 `STALE_EVIDENCE` 拒收，不能拿旧绿顶新码。 | `skills/workflow/aes-worktree-board/scripts/master.mjs:552-585`；`skills/workflow/aes-worktree-board/scripts/master.mjs:827-845`；`skills/workflow/aes-qa/SKILL.md:56-60` |
| integration base 前进会通过 `GATE-review-base` / `GATE-qa-base` 让 v2 review/QA 证据 stale，重新在新 base 取证后才可放行；但 v1 receipt 因兼容性被永久豁免 base 检查。当前 `aes-qa` 文档仍只展示 `aes.qa.receipt/v1`，而 Board 已支持并依赖 v2 承载 `baseCommit`，存在明确的 schema 文档漂移。 | `skills/workflow/aes-worktree-board/scripts/merge-policy.mjs:140-172`；`skills/workflow/aes-worktree-board/scripts/selftest-v4.mjs:2140-2238`；`skills/workflow/aes-qa/SKILL.md:56-77` |
| Board/issue contract 的 `contractDigest` 包含 goal、workflowRole、AC、dependencies、allowedSideEffects、humanGates，却不包含已解析且必填的 `riskProfile`。因此只改变规划风险档不会改变该 digest；若后续把测试下限绑定规划风险，现有 digest 边界不足以让相关 evidence 自动失效。 | `skills/workflow/aes-worktree-board/scripts/issue-contract.mjs:190-220`；`skills/workflow/aes-worktree-board/scripts/issue-contract.mjs:224-234` |
| 现行流程文字要求 merge 后运行“全量套件，非 targeted”，且 post-merge verification 必须在 integration root 真实执行并绑定 merge commit/live HEAD；但实现只强制 commands 数组非空、逐命令 exit 0，没有 full-suite 标识、仓库 Gate catalog digest 或“不得只给 targeted 命令”的机械校验。最终全量回归目前是强流程约定，不是 Core 可自证的命令覆盖合同。 | `skills/workflow/aes-worktree-board/SKILL.md:210-218`；`skills/workflow/aes-worktree-board/SKILL.md:453-471`；`skills/workflow/aes-worktree-board/scripts/master.mjs:1339-1382` |

## 未知项

- 仓库里没有找到一份统一的、机器可读的 `GateCatalog/ProfileRegistry`，能把风险档、影响面、每个 session 的最小测试集、最终全量套件和人工 checklist 合成同一规则；现状分散在 Goal Contract、Issue Contract、`aes-qa` prose 与 Board merge policy 中。
- 没有找到证明“真实文本/数字样本已在调研前提供”的执行期 typed 字段或门禁；Goal Contract 能把真实样本落成 `[B]` fixture，但并未把“调研开始前必须存在”做成阶段门。
- 没有找到逐人工 testcase 的 typed completion receipt；只能确认整体 human response 及其 requiredEvidence，无法从现有 schema 证明每项都被单独勾选。

## 没查的

- 未裁决 DAG 应固定使用 subagent、Desktop 独立 Task，还是只声明隔离/身份/恢复语义；这是用户决定，不是仓库事实。
- 未设计新的 ProfileRegistry、Receipt、GateCatalog、风险算法或 Web 展示；这些都属于后续原型/契约，不归本次只读调查。
- 未运行任何产品实现、测试套件或 live/manual 验收；本分片只核对当前仓库的技能文档、控制面实现与现有自测断言。
