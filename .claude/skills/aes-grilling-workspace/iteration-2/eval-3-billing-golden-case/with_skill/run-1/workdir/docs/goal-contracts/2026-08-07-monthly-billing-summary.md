# Goal Contract: 单月账单 CSV 一键生成老板格式分类汇总

- Status: Ready
- Target: billing 个人账单工具仓库（eval-3 with_skill/run-1/workdir）
- Updated: 2026-08-07

## Goal

运行 `node scripts/summarize.mjs` 并传入单月账单 CSV 路径后，stdout 直接输出该月按分类汇总的 CSV 报表——每个分类一行合计、按金额从大到小排序、最后一行总计、金额保留两位小数、列名用英文；对 `data/bill-2026-07.csv` 的输出与用户手工核对的 07 月汇总完全一致。

## Why

- 每月手工做分类汇总费时且出过错。
- 老板只认用户那张表的样子，输出与该格式一致才能直接上交。

## Read First

- README.md（工具定位：data/ 是银行 App 导出的原始账单，summarize.mjs 是唯一入口脚本）

## Scope

- In: 修改 `scripts/summarize.mjs`，对任意符合 `date,category,merchant,amount` schema 的单月账单 CSV 输出分类汇总；落盘验收 fixture；更新 README 用法说明。
- Out: GUI、数据库、多币种处理、多月对比、图表、文件自动写出或自动发送、银行导出流程改动。

## Deliverables

- D-01: tests/fixtures/2026-07-summary.expected.csv: 用户核对认可的 07 月期望汇总，内容固定为六行——表头 `category,total`，随后依次 `交通,616.50`、`餐饮,437.90`、`办公,285.40`、`服务,143.00`、`总计,1482.80`。
- D-02: tests/fixtures/mini-bill.csv: 合成单月账单最小输入，同 schema，至少两个分类且其中一类多笔。
- D-03: tests/fixtures/mini-summary.expected.csv: 对 D-02 按同一格式规则手工核算得到的期望汇总。

## Success Criteria

- AC-01: 运行 `node scripts/summarize.mjs data/bill-2026-07.csv`，stdout 输出的 07 月分类汇总与用户手工核对的数字完全一致。
  - Verify: [B] 输入 `data/bill-2026-07.csv` → 输出与 `tests/fixtures/2026-07-summary.expected.csv` diff 为空
- AC-02: 汇总逻辑对同 schema 的其他单月 CSV 通用，按同一格式规则（每类一行、金额降序、末行总计、两位小数、英文列名）输出该文件数据的汇总，不写死 07 月数据。
  - Verify: [B] 输入 `tests/fixtures/mini-bill.csv` → 输出与 `tests/fixtures/mini-summary.expected.csv` diff 为空
- AC-03: README.md 描述汇总用法，不再声称脚本只会原样打印、汇总靠手工。
  - Verify: [D] 检查 `README.md` 包含 `node scripts/summarize.mjs` 汇总用法说明，且「原样打印、汇总手工做」的过时描述已移除

## Constraints

- 输入 schema `date,category,merchant,amount` 保持不变；`data/` 下原始账单文件不得修改。
- 不引入运行时依赖：仓库无 package.json，脚本只使用 Node 内置模块。
- 输出为 UTF-8 纯文本 CSV，行尾与落盘 fixture 保持一致。

## Agent Mandate

- May decide: 编辑 `scripts/summarize.mjs` 与 `README.md`；创建 `tests/` 目录及 D-01 至 D-03 fixture；拟定 D-02 合成数据内容并手工核算 D-03；决定解析与格式化的实现细节（如手写 CSV 解析而非引库）。
- Must ask: 需要改动 Goal、Scope、Success Criteria、期望汇总数字或输出格式规则时；需要引入依赖、修改 `data/` 原始账单或执行破坏性操作时。
- Must not: 修改 `data/bill-2026-07.csv`；引入 package.json 或第三方依赖；发起网络调用；停在分析或只交计划；向用户询问仓库可查事实；在缺少逐条 AC 新鲜证据时宣布完成。

## Iteration Strategy

先落 D-01 期望 fixture 并让 AC-01 通过，再补 D-02/D-03 验证通用性，最后更新 README。

## Completion

- Evidence: 全部 Success Criteria 的 Verify 通过，证据来自当前 worktree 可复跑的命令输出与落盘 fixture 的对比结果。
- Quality: 三份 fixture 的数字经手工核算复核；最终 diff 已 review，并在不改变行为的前提下 simplify。
- Final report: docs/goal-contracts/2026-08-07-monthly-billing-summary-report.md：逐条映射 AC-01 至 AC-03 的 Verify 证据，列出改动文件与剩余风险。

## Blockers

- None.
