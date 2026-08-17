# 执行过程记录（aes-grilling skill-snapshot-v4，minicli --json 评测）

技能来源：`G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\aes-grilling-workspace\skill-snapshot-v4\SKILL.md`
（旧版快照，本次严格按它自己写的步骤编号执行）。

目标仓库（workdir）：
`G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\aes-grilling-workspace\iteration-7\eval-2-cli-json\old_skill\run-1\workdir`

用户原始请求：帮 minicli 加 `--json` 输出，先理清需求、写 goal contract，不写代码。

## 第 1 步：调查事实

读取了：
- `src/audit.mjs`（现有 CLI 全部逻辑：`audit()` 返回 `{rule,level,message}[]`；文本输出、
  `clean`/`N finding(s)` 汇总、`exit(1 if any error-level else 0)`；配置文件缺失或非法 JSON
  时无任何错误处理，直接抛未捕获异常崩溃）
- `README.md`（现有用法说明，无 JSON/--help 相关内容）
- `docs/testing.md`（测试约定：`npm test`，Node 内建 assert 零依赖，新增行为先写失败测试，
  CLI 输出变更需同步文本对比断言 → 确定 Verify 默认档 `[A] npm test` 可用）
- `test/run-tests.mjs`（现有测试只覆盖 `audit()` 返回值，不覆盖 CLI 进程级文本/退出码）
- `package.json`（`type: module`，`scripts.test`，无 CLI 参数解析框架）
- `PERSONA.md`（本次评测用的模拟用户画像，仅在需要提问/确认时查阅）

判定：本次请求属于"改变现有可观察行为"一类（新增输出模式，且错误路径在新模式下的表现与
现状不同），不涉及用户界面 → 需要产出行为对照表（第 3 步），不需要 mock HTML。

未发现需要并行 subagent 调查的独立事实分支（仓库很小，单文件即可穷尽），因此本步由宿主
直接完成，未派遣 subagent。

## 第 2 步：批量问清歧义

宿主没有 `AskUserQuestion` 工具，按 SKILL.md 规则退化为编号文本一次问全。共识别出 2 个
独立的材料歧义（低于 4 个上限，一轮问完）：

1. `--json` 与默认文本输出是否互斥 → 代入模拟用户「选推荐项」→ 互斥（提供 `--json` 时
   stdout 只输出 JSON）。
2. `--json` 模式下配置缺失/非法 JSON 如何处理，含新退出码定多少 → 代入模拟用户「选推荐项」
   → 结构化 JSON 错误 + 退出码 `2`，不带 `--json` 时该路径行为不变。

JSON 字段命名（用户已明确授权）和是否新增 `--help`（判定为 Out of scope，仓库当前无此
基建，用户也未提出）未作为问题提出，按规则归类为 Agent-owned / Out，不占提问轮次。

完整问题、候选、代入回答见 `outputs/questions.md`。

收口自评：Intent / Outcome / Boundary / Constraints / Context 五个维度在这一轮回答后
全部转为「已定」，审计通过，只用了一轮问答，未追加轮次。

## 第 3 步：对齐对照物（行为对照表）

产出行为对照表：
`workdir/docs/goal-contracts/2026-08-07-minicli-json-output-behavior.md`

9 行场景（5 个变化场景 + 4 个边界场景），逐行给出具体输入/前置条件、现在的行为、改后的
行为，并附不变清单（文本输出格式不变、现有崩溃路径在非 `--json` 模式下不变、审计规则
不变、退出码语义不冲突、`--json` 与文本互斥）。代入模拟用户「选推荐项」直接确认，无修改。

按规则该确认版对照物落盘到与 Contract 同目录同 slug 的 `-behavior.md` 路径，并写入
Contract 的 Read First。

## 第 4 步：对齐验收标准

起草 5 条 AC（未超过 7 条上限）：
- AC-01 兼容性护栏（不带 `--json` 时行为不变）
- AC-02 `--json` 正常路径下 stdout 是单一合法 JSON
- AC-03 JSON 结构完整性（黄金用例，`[B]` 档，需要 Deliverables 落盘 fixture）
- AC-04 退出码规则与现状一致
- AC-05 无效输入路径的结构化错误 + 新退出码 2（对应行为对照表场景 6-9）

Verify 全部来自仓库既有测试基建（`npm test`，`[A]` 档）或黄金用例（`[B]` 档），未出现
需要升级为独立问题的情形（仓库有现成基建、无真实/外部数据依赖、唯一的数字门槛是退出码
`2`，已在第 2 步 Q2 中问清并由用户决定）。

AC-03 的 `[B]` 档需要 fixture 落盘，追加 Deliverables 节：
- D-01 `test/fixtures/audit-json/input-config.json`
- D-02 `test/fixtures/audit-json/expected-report.json`
（本次评测未实现代码，未落盘 fixture 文件本身；命名和目录已在 Contract/Deliverables 中
明确，交给执行 Agent 落盘。）

## 第 5 步：形成并确认 Contract

读取了 `references/goal-contract-template.md` 校准结构，`references/goal-contract-example.md`
校准信息密度（该示例场景与本次任务高度相似，用于确认颗粒度和措辞风格，未直接照抄内容）。

Contract 落盘到：
`workdir/docs/goal-contracts/2026-08-07-minicli-json-output.md`

Status: Ready（歧义已收口、AC 已定稿、无 Blocker、Contract 自包含可独立交接）。
代入模拟用户确认候选表达了当前共同理解（画像回答方式为「其他任何未覆盖的问题选推荐项」，
本次候选完全落在推荐路径内，判定为确认）。

## 第 6 步：校验与交接

运行仓库自带校验脚本：
`skill-snapshot-v4/scripts/validate-goal-contract.ps1`

第一次运行报错：`Contract contains a template placeholder like <...>`，定位到 AC-02
的 Verify 行里写了字面量 `<fixture>` 占位符，替换为具体路径
`test/fixtures/audit-json/input-config.json` 后修正。

第二次运行：`VALID`，`STATUS: Ready`，`AC_COUNT: 5`，`EXIT_CODE: 0`。完整命令输出见
`outputs/validation.txt`。

未生成启动指令（handoff-prompt.md 变体一/二）——本次任务范围是理清需求与产出 Goal
Contract，不实现产品代码，因此报告到「校验通过」为止。

## 全程约束遵守情况

未编写、未修改任何产品代码（`src/audit.mjs`、`test/run-tests.mjs`、`package.json` 均未
改动）。写入仓库的文件只有 `docs/goal-contracts/` 下的两份契约类文档（Contract 本身 +
行为对照表），符合 SKILL.md 第 3/5 步对落盘路径的规定。
