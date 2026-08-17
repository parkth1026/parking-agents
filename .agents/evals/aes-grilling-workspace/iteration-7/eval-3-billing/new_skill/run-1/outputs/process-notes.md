# 执行过程记录

模拟场景：workdir 是目标仓库，`PERSONA.md` 里预置的模拟需求方回答用来代替真实
用户在 aes-grilling 流程的提问环节里作答，全程不等待外部输入。

## 步骤 1：调查事实

读取了 `workdir/README.md`、`workdir/PERSONA.md`、`workdir/scripts/summarize.mjs`、
`workdir/data/bill-2026-07.csv`。查明：

- 现有脚本 `scripts/summarize.mjs` 只做 `readFileSync` + `console.log`，尚无汇总
  逻辑，但已经用 `process.argv[2]` 接收文件路径。
- 仓库没有 `package.json`、测试框架或 CI 配置，验证基建候选池只剩「用户提供真实
  数据/黄金 fixture」与「从零新建自动化基建」两条，后者对单文件脚本代价过高。
- 用 `data/bill-2026-07.csv` 的 15 行明细手工复核，得到交通 616.50、餐饮 437.90、
  办公 285.40、服务 143.00、总计 1482.80，与 `PERSONA.md` 给出的期望数字完全一致，
  可直接作为黄金输出使用。
- 判定本次请求为「纯新增能力」（脚本现状只是透传打印，没有可对照的既有公共行为
  或既有界面），按 SKILL 第 1 步规则跳过第 3 步对照物阶段，直接从第 2 步材料歧义
  进入第 4 步验收条件。

无并行 subagent 调查需求：事实来源单一（一个小仓库、一份数据、一份 persona），
宿主 Agent 自行完成调查已足够，未创建额外 subagent。

## 步骤 2：批量问清材料歧义

一轮问完 3 个 PERSONA 未覆盖、但会改变输出契约的问题：输出目的地（stdout 还是
落文件）、输出列名与总计行标法、脚本要不要保持通用（不写死月份/分类）。均按
「选推荐项」代入模拟用户作答。逐维度自评：意图/结果/边界/约束/现状全部「已定」，
收口，进入第 3 步判定。

## 步骤 3：对齐对照物

判定本次无需求（纯新增能力，跳过），未产出 mock.html 或行为对照表。

## 步骤 4：对齐验收条件

从 PERSONA 给定的真实数据和期望数字直接聚出 AC-001（真实数据正确性）；从「保持
通用、不写死月份/分类」这条材料歧义的答案里聚出 AC-002（结构泛化）。两条 AC 各自
给出 Verify 候选（含代价说明），模拟用户按 PERSONA 明确指示或推荐项作答：

- AC-001 选 `[B]`：直接用 `data/bill-2026-07.csv` 做输入，落一份用户认可的黄金
  期望输出 fixture 做逐字节 diff。
- AC-002 选 `[B]`：用一份明确声明「仅验证结构、不代表业务正确性」的合成小样本
  （3 月、教育/通讯两类）做 diff，避免和真实数据的用途混淆。

两条 AC 收口后落盘，未再产生新的材料歧义。

## 步骤 5：落盘

契约写入 `workdir/docs/goal-contracts/2026-08-07-monthly-billing-summary.md`。
同时按契约「要落盘的东西」新建三份 fixture：

- `workdir/tests/fixtures/expected-monthly-summary.csv`（AC-001 期望输出）
- `workdir/tests/fixtures/generic-sample-input.csv`（AC-002 合成输入）
- `workdir/tests/fixtures/generic-sample-expected.csv`（AC-002 合成期望输出）

全程未编写任何产品代码，`scripts/summarize.mjs` 保持原样未改动。

## 步骤 6：校验与交接

跑 `node <skill-dir>/scripts/validate-goal-contract.mjs
workdir/docs/goal-contracts/2026-08-07-monthly-billing-summary.md`，输出
`AC_COUNT: 2` / `VALID: ...`，退出码 0，无 ERROR 也无 WARNING。完整命令输出见
`outputs/validation.txt`。

契约文件与三份 fixture 均已复制一份到 `outputs/`（fixture 放在
`outputs/tests/fixtures/` 下，与 workdir 内路径结构一致）。本次无 mock.html
（第 3 步已跳过）。
