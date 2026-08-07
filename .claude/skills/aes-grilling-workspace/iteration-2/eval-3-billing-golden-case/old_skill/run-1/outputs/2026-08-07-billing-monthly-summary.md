# Goal Contract: 月度账单 CSV 一键生成老板格式的分类汇总

- Status: Ready
- Target: billing 仓库 scripts/summarize.mjs 与 tests/
- Updated: 2026-08-07

## Goal

运行 `node scripts/summarize.mjs` 并传入某个月度账单 CSV 路径后，标准输出直接得到老板认可格式的月度分类汇总 CSV——英文表头 `category,amount`，每个分类一行当月合计、金额保留两位小数、按金额从大到小排序、最后一行为「总计」行——从此无需再手工汇总。

## Why

- 每月手工做分类汇总费时且出过错。
- 老板只认自己那张表的样子，输出必须与该格式一致才能直接提交。

## Scope

- In: 把 scripts/summarize.mjs 从原样打印改为按分类汇总并按上述格式输出到 stdout，CSV 路径作为命令行参数；在 tests/fixtures/ 下添加账单 fixture 并提供自动化测试。
- Out: 不做 GUI、数据库、多币种处理、多月对比、图表或自动发送。

## Success Criteria

- AC-01: 运行 `node scripts/summarize.mjs data/bill-2026-07.csv`，标准输出为 CSV 文本：首行表头 `category,amount`，其后每个分类一行当月合计（金额保留两位小数），按金额从大到小排序，最后一行为标签「总计」的总计行。
- AC-02: 对 `data/bill-2026-07.csv`，输出数值与用户手工核对结果完全一致：交通 616.50、餐饮 437.90、办公 285.40、服务 143.00、总计 1482.80。
- AC-03: CSV 文件路径作为命令行参数传入；对任何表头为 `date,category,merchant,amount` 的同结构月度 CSV，命令都输出同一格式的分类汇总，分类与数值随输入数据变化。
- AC-04: `tests/fixtures/` 下存在账单 fixture，且仓库内有可复现执行的自动化测试命令对 fixture 校验输出格式与全部数值，执行退出码为 0。

## Constraints

- 保持现有 CLI 调用方式：`node scripts/summarize.mjs` 后接 CSV 路径参数。
- 验收使用真实数据 `data/bill-2026-07.csv`，不脱敏。
- `data/` 下的原始账单 CSV 不被修改。

## Agent Mandate

- May decide: 检查仓库，选择可逆的实现细节（CSV 解析方式、坏行或缺列时的报错行为与文案、测试框架或断言脚本形式），编辑代码，新增或更新测试，review 最终 diff 并在不改变行为的前提下简化。
- Must ask: 仅当 Goal、Scope、Success Criteria 或 Constraints 需要变更，或需要执行破坏性、涉及凭据、生产环境或其他未授权的操作时。
- Must not: 停在分析或计划，向用户询问仓库内可查的事实，悄悄扩大范围，或在缺少每条 AC 新鲜证据时宣称完成。

## Completion

- Evidence: 全部 Success Criteria 以可复现命令的新鲜输出逐条佐证。
- Quality: 相关测试与仓库检查通过；无关的既有失败单独说明；最终 diff 经 review 并在安全范围内简化。
- Final report: 逐条 AC 对应证据，列出改动文件与剩余风险。

## Blockers

- None.
