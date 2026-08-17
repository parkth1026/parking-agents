# Goal Contract: 账单 CSV 按月分类汇总

- Status: Ready
- Target: billing 个人账单工具仓库根目录（`scripts/summarize.mjs`）
- Updated: 2026-08-07

## Goal

用户对 `data/` 下某月的原始账单 CSV 运行汇总命令后，得到一份按 category 分组、金额降序排列、
末行为总计、金额保留两位小数、列名为英文的 CSV 汇总结果，格式与用户手工核对并交给老板看的
那份一致。

## Why

- 每月手工做分类汇总耗时且出过错。
- 老板只认自己那份表的格式，需要稳定复现该格式。

## Read First

- README.md：说明 `scripts/summarize.mjs` 目前只会原样打印，汇总逻辑尚未实现。

## Scope

- In: 读取 `data/` 下单月账单 CSV（以 `bill-2026-07.csv` 为验证样本），按 category 分组求和，
  按金额从大到小排序，附加一行 TOTAL 总计，金额统一保留两位小数，输出英文列名 CSV
  （`category,total`）。
- Out: 跨月合并统计、GUI 界面、数据库存储、多币种换算；对畸形或缺失字段行的容错清洗本次
  不讨论，视为不在范围内。

## Deliverables

- D-01: tests/fixtures/bill-2026-07-input.csv：黄金用例输入，内容与 `data/bill-2026-07.csv`
  一致（该月真实账单原始数据，无需脱敏）。
- D-02: tests/fixtures/bill-2026-07-expected-summary.csv：与用户手工核对结果一致的期望汇总
  输出（`category,total` 两列，按金额降序，末行 `TOTAL,1482.80`，金额均两位小数）。

## Success Criteria

- AC-01: 对 `tests/fixtures/bill-2026-07-input.csv` 运行汇总命令，产出结果与用户手工核对的
  黄金用例完全一致（交通 616.50 / 餐饮 437.90 / 办公 285.40 / 服务 143.00 / 总计 1482.80）。
  - Verify: [B] `tests/fixtures/bill-2026-07-input.csv` → matches `tests/fixtures/bill-2026-07-expected-summary.csv`
- AC-02: 输出 CSV 首行为英文表头 `category,total`，金额字段统一保留两位小数（如 `616.50`
  而非 `616.5`）。
  - Verify: [D] `tests/fixtures/bill-2026-07-expected-summary.csv` 首行等于 `category,total`，
    每个金额字段匹配正则 `^\d+\.\d{2}$`
- AC-03: 分类行按 total 从大到小排序，最后一行是 `category` 为 `TOTAL` 的总计行，且其数值
  等于前面各分类行之和。
  - Verify: [D] `tests/fixtures/bill-2026-07-expected-summary.csv` 行序为 交通 > 餐饮 > 办公 >
    服务 > TOTAL，且 TOTAL 数值等于前四行数值之和（1482.80）
- AC-04: 对同一输入文件重复运行两次汇总命令，两次输出完全一致（无随机顺序、无时间戳等
  不确定内容）。
  - Verify: [C] 连续执行两次 `node scripts/summarize.mjs tests/fixtures/bill-2026-07-input.csv`
    并保存 stdout，两次输出逐字节 diff 为空

## Constraints

- 不引入 GUI、数据库或多币种处理（用户明确排除）。
- 输出金额统一保留两位小数，列名固定为英文 `category,total`。
- `tests/fixtures/` 下已落盘的黄金用例文件是确认版参照物，执行 Agent 不得修改其内容。
- 沿用 `scripts/summarize.mjs` 现有的按路径读取输入文件的调用方式（`process.argv[2]`），
  不破坏该调用约定。

## Agent Mandate

- May decide: 在 `scripts/` 下新增或修改代码实现分组求和、排序、格式化与总计行逻辑；选择
  CSV 解析与写出方式；用整数分或其它方式规避浮点误差等可逆实现细节；本地运行脚本自测。
- Must ask: 需要变更已确认的输出列名、排序规则、小数位数或总计行约定时；需要修改
  `tests/fixtures/` 下已落盘的黄金用例时；发现某条 AC 客观无法达成、需要变更 Scope 或
  Success Criteria 时。
- Must not: 引入 GUI 框架或数据库依赖、处理多币种转换；修改 `tests/fixtures/` 下已落盘的
  黄金用例文件；停在计划阶段不交付可运行结果；在没有针对每条 AC 的新鲜验证证据前声称完成。

## Iteration Strategy

先实现按 category 分组求和与降序排序，再补两位小数格式化与总计行，最后跑两次确定性校验。

## Completion

- Evidence: 全部 Success Criteria 的 Verify 行通过，证据来自当前 worktree 对
  `tests/fixtures/` 与 `data/bill-2026-07.csv` 的可复跑结果。
- Quality: 本仓库无自动化测试框架，至少完成 AC-04 要求的两次一致性重跑；最终 diff 已
  review 并在不改变行为前提下 simplify。
- Final report: docs/goal-contracts/billing-monthly-summary-report.md：逐条映射 AC-01 至
  AC-04 的 Verify 证据，列出改动文件与剩余风险。

## Blockers

- None.
