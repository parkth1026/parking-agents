# 执行过程记录（旧版 skill-snapshot-v4 SKILL.md 流程）

严格按 `skill-snapshot-v4/SKILL.md` 的六步流程执行，宿主 Agent（本会话）独自完成全过程，
未使用 subagent（事实调查面很窄，宿主可自行完成，未触发"两个以上互不依赖的事实问题"
的并行派遣条件）。用户以 PERSONA.md 模拟画像自问自答，全程无真实用户参与。

## 第 1 步：调查事实

读取的文件：
- `workdir/README.md`：确认这是个人账单工具仓库，`data/` 下是每月银行 App 导出的原始
  CSV，`scripts/summarize.mjs` 现状只做透传打印，汇总逻辑尚未实现（占位状态）。
- `workdir/PERSONA.md`：模拟用户的既有回答集合（动机、格式要求、验收数据、fixture
  位置、不做事项）。
- `workdir/data/bill-2026-07.csv`：15 笔真实交易，人工重算分类合计，确认与 PERSONA
  给出的期望汇总（交通 616.50 / 餐饮 437.90 / 办公 285.40 / 服务 143.00 / 总计
  1482.80）完全一致，验证了这份"期望输出"内部自洽、可作为黄金用例。
- `workdir/scripts/summarize.mjs`：现状只有两行，`readFileSync` 后 `console.log`，
  证实 README 的描述，也确认脚本调用约定是 `process.argv[2]` 传入输入文件路径。

固定查清项——仓库验证基建：`ls` 未见 `package.json`、测试框架、CI 配置；`node`
可用（v24）。结论：本仓库没有可用的 `[A]` 自动化测试命令基建，Verify 只能落在
`[B]`（黄金用例 diff）、`[C]`（可复现手动步骤）、`[D]`（具名文件内容检查），不能
无脑套用 `[A]` 默认档。

固定判定项——对照物分类：`scripts/summarize.mjs` 当前行为是 README 明确标注的占位
实现（"目前只会原样打印，汇总还是手工在做"），不是需要保真延续的既有契约行为；
本次请求也不涉及任何图形界面。判定为 SKILL.md 第 1 步定义的"两者皆无"情形，跳过
第 3 步（不出 mock、不出行为对照表）。该判定基于仓库证据，作为 Fact 记录，未占用
提问轮次。

## 第 2 步：批量问清歧义

识别出 4 个 PERSONA 未覆盖、但会影响可观察结果或流程判定的独立问题（输出列名、
总计行的 category 取值、脚本产出方式 stdout vs 文件、是否需要走 mock/行为对照表
阶段）。宿主环境没有 `AskUserQuestion` 工具，按 SKILL.md 的退化规则改用编号文本
一次全列，见 `questions.md`。按 PERSONA.md"其他任何未覆盖的问题：选推荐项"的约定，
逐条采纳推荐候选。

收口自评：Intent / Outcome / Boundary / Constraints / Context 五维度全部转为"已定"，
收口审计通过（继续追问只会改变实现细节措辞，不改变可观察结果），按流程只用了一轮。

## 第 3 步：对齐对照物

第 1 步已判定本次请求两者皆无，跳过本阶段，直接进入第 4 步。

## 第 4 步：对齐验收标准

起草 4 条 AC（在 1-7 条范围内），覆盖：
- AC-01：黄金用例数值匹配（`[B]`，输入/期望输出 fixture）；
- AC-02：输出格式（英文表头 `category,total`、两位小数）（`[D]`）；
- AC-03：排序与总计行正确性（`[D]`）；
- AC-04：同输入重复运行两次结果一致，确保确定性（`[C]`）。

因为本仓库没有测试框架，`[A]` 档不可用，未强行套用默认档；`[B]` 档所需的输入/期望
输出数据来自 PERSONA 明确指认的真实数据（`data/bill-2026-07.csv`）与手工核对的
期望值，按流程"用户真实测试"来源采纳，不是凭空发明的合成数据。

按 SKILL.md 要求，选了 `[B]` 后一次问全数据位置、脱敏与否、期望输出依据、fixture
存放位置——PERSONA.md 已经把这四点都直接写明（`data/bill-2026-07.csv`、不脱敏、
以手工核对结果为准、`tests/fixtures/`），因此这部分未重复发问，直接采纳。

据此把 fixture 落盘到工作目录：
- `workdir/tests/fixtures/bill-2026-07-input.csv`（与 `data/bill-2026-07.csv` 内容
  一致的黄金用例输入）
- `workdir/tests/fixtures/bill-2026-07-expected-summary.csv`（期望汇总输出，
  `category,total` 两列，交通/餐饮/办公/服务降序 + `TOTAL,1482.80`）

未编写任何产品代码（未触碰 `scripts/summarize.mjs` 的实现），仅产出需求澄清文档
与 fixture 数据。

## 第 5 步：形成并确认 Contract

读取 `skill-snapshot-v4/references/goal-contract-template.md` 作为结构依据，读取
`goal-contract-example.md` 校准信息密度。按模板落盘：

`workdir/docs/goal-contracts/2026-08-07-billing-monthly-summary.md`

Status 定为 `Ready`：歧义判据已满足、AC 已定稿、没有客观 Blocker（数据已就绪、
fixture 已落盘）。模拟用户对候选（Goal / Scope / AC / Blocker 摘要）确认无异议
（按 PERSONA"选推荐项"的约定接受候选）后落盘。

## 第 6 步：校验与交接

运行仓库自带的旧版校验脚本 `skill-snapshot-v4/scripts/validate-goal-contract.ps1`，
对刚落盘的 Contract 校验，输出 `VALID` / `STATUS: Ready` / `AC_COUNT: 4`，exit code 0，
无 WARNING。完整命令与输出见 `outputs/validation.txt`。

## 交付物落盘位置

- Contract：`workdir/docs/goal-contracts/2026-08-07-billing-monthly-summary.md`
  （已复制一份到 `outputs/2026-08-07-billing-monthly-summary.md`）
- `[B]` 档 fixture：
  - `workdir/tests/fixtures/bill-2026-07-input.csv`
    （已复制到 `outputs/bill-2026-07-input.csv`）
  - `workdir/tests/fixtures/bill-2026-07-expected-summary.csv`
    （已复制到 `outputs/bill-2026-07-expected-summary.csv`）
- 提问记录：`outputs/questions.md`
- 校验输出：`outputs/validation.txt`
