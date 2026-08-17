# Goal Contract: minicli 审计结果支持 `--json` 输出

- Status: Ready
- Target: `src/audit.mjs`（minicli CLI）
- Updated: 2026-08-07

## Goal

minicli 新增 `--json` 选项，能输出机器可读的 JSON 审计结果，同时不带该选项时的现有文本
输出与退出码行为保持完全兼容。

## Why

- CI 流水线目前只能解析面向终端展示的文本报告，文案一变解析就挂。
- 稳定的 JSON 结果可以被 CI 和其他工具可靠消费，而不必跟着文案改动同步维护。

## Read First

- docs/goal-contracts/2026-08-07-minicli-json-output-behavior.md（已确认的行为对照表，
  新旧行为逐场景对照，含边界情况与不变清单）
- docs/testing.md（本仓库测试约定：`npm test`，零依赖，新增行为先写失败测试）

## Scope

- In: 为 `src/audit.mjs` 的 CLI 入口新增 `--json` 选项，覆盖三类结果——干净、含
  finding（含 error 级）、无效输入（配置文件缺失或不是合法 JSON）；`--json` 与默认
  文本输出互斥。
- Out: schema 版本化、新增配置文件、修改现有审计规则（`has-name`/`no-debug`）判定逻辑、
  新增或修改 `--help` 说明文本、修复不带 `--json` 时无效输入路径的现有崩溃行为。

## Deliverables

- D-01: test/fixtures/audit-json/input-config.json：AC-03 黄金用例的输入配置（含 1 条
  error 级 finding，用于覆盖 findings 明细与整体结论字段）。
- D-02: test/fixtures/audit-json/expected-report.json：AC-03 黄金用例对应的期望 JSON 输出。

## Success Criteria

- AC-01: 不使用 `--json` 时，命令现有的文本输出格式与退出码行为保持不变。
  - Verify: [A] `npm test` → 退出码 0，覆盖现状文本输出与退出码的既有/新增断言全部通过
- AC-02: 使用 `--json` 且配置合法时，stdout 只包含一个合法 JSON 文档，不与人类可读文本
  混合。
  - Verify: [A] `npm test` → 针对 `node src/audit.mjs --json test/fixtures/audit-json/input-config.json`
    的输出做 `JSON.parse` 断言，退出码 0
- AC-03: JSON 结果包含 findings 明细（每项 `rule`/`level`/`message`）与整体结论字段，
  不丢失当前文本输出表达的必要信息。
  - Verify: [B] 对 `test/fixtures/audit-json/input-config.json` 运行
    `node src/audit.mjs --json` → 输出与 `test/fixtures/audit-json/expected-report.json`
    diff 为空
- AC-04: 存在 error 级 finding 时退出码为 1，否则为 0，与不使用 `--json` 时的判定规则
  完全一致。
  - Verify: [A] `npm test` → 覆盖「干净」与「含 error 级 finding」两种场景在 `--json`
    模式下的退出码断言全部通过
- AC-05: 配置文件缺失或内容不是合法 JSON 时，`--json` 模式下输出结构化 JSON 错误对象
  （不打印 Node 未捕获异常堆栈）并以退出码 `2` 退出；不使用 `--json` 时该错误路径行为
  保持现状不变。
  - Verify: [A] `npm test` → 覆盖「文件不存在」与「JSON 无效」两种场景在 `--json` 模式下
    的错误结构与退出码 2 断言全部通过

## Constraints

- 不带 `--json` 时的输出文案、格式与退出码必须与现状逐字节兼容。
- `--json` 与默认文本输出互斥：提供 `--json` 时不再打印任何人类可读文本行。
- 不新增审计规则，也不改变 `has-name`/`no-debug` 现有判定逻辑。
- 新退出码 `2`（无效输入）仅在 `--json` 模式下出现，不得与现有 `0`/`1` 语义冲突或复用。
- docs/goal-contracts/2026-08-07-minicli-json-output-behavior.md 是确认版对照物，不得修改。

## Agent Mandate

- May decide: 创建分支；在 `src/audit.mjs`、`test/run-tests.mjs` 下改代码、补测试；
  在 `test/fixtures/audit-json/` 下新增/调整 fixture；确定 JSON 字段命名（如
  `ok`/`findings`/`error.type`/`error.message` 等）等不改变已确认行为的可逆实现细节；
  运行测试。
- Must ask: 需要打破 AC-01 描述的兼容性、需要改动 Scope/Success Criteria、需要变更
  行为对照表已确认的场景或不变清单时；需要未授权的外部或破坏性操作时。
- Must not: push；改 CI 配置；修改
  docs/goal-contracts/2026-08-07-minicli-json-output-behavior.md；新增 `--help`
  文本或参数解析框架之外的能力；停在计划阶段；询问可从仓库发现的事实；在没有每条 AC
  新鲜证据时宣布完成。

## Iteration Strategy

先落 AC-01 的兼容护栏和 AC-02/AC-04 的正常路径，再补 AC-03 的黄金用例，最后处理 AC-05
的错误路径。

## Completion

- Evidence: 全部 Success Criteria 的 Verify 行通过，证据来自当前 worktree 可复跑的
  `npm test` 输出。
- Quality: 相关测试通过，无关既有失败已分离；最终 diff 已完成 review 和 simplify。
- Final report: docs/goal-contracts/minicli-json-output-report.md：逐条映射
  AC-01 至 AC-05 的 Verify 证据，说明改动文件和剩余风险。

## Blockers

- None.
