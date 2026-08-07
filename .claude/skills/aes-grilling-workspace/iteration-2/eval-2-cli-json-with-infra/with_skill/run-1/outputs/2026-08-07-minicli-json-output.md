# Goal Contract: minicli 支持 --json 机器可读审计输出

- Status: Ready
- Target: minicli 仓库（src/audit.mjs CLI 及其测试与 README）
- Updated: 2026-08-07

## Goal

运行 `node src/audit.mjs 某配置.json --json` 时，stdout 输出单行合法 JSON：findings 数组逐项含 rule、level、message，并带整体结论（ok 布尔与 summary 的 error/warn/total 计数），退出码语义与文本模式一致；不带 `--json` 时，文本输出与退出码逐字节保持现状。

## Why

- CI 流水线需要机器读审计结果，现行文本输出一变文案就把下游解析搞挂。
- 结构化 JSON 加上被断言锁定的文本兼容性，让机器消费与既有人读输出互不干扰。

## Read First

- docs/testing.md：测试约定（`npm test`、新增行为先有失败测试、CLI 输出变更需同步文本对比断言）。
- README.md：现有用法与退出码语义（存在 error 级 finding 时退出码 1）。

## Scope

- In: 在 src/audit.mjs 现有 CLI 入口增加 `--json` flag、单行信封 JSON 输出、golden fixture 测试，以及 README 用法更新。
- Out: 不改审计规则（has-name、no-debug）与 audit() 返回结构；不新增其它 flag、配置文件或 schema 版本化；不美化坏输入（文件缺失、非法 JSON）的报错路径；不重构参数解析体系。

## Deliverables

- D-01: test/fixtures/bad.json: 合成配置，缺 name 且 debug 为 true，同时触发 error 与 warn 各一。
- D-02: test/fixtures/bad.expected.json: AC-01 场景下 `--json` 模式 stdout 的期望逐字节内容。
- D-03: test/fixtures/ok.json: 含 name 的干净合成配置，零 finding。
- D-04: test/fixtures/ok.expected.json: AC-02 场景下 `--json` 模式 stdout 的期望逐字节内容。

## Success Criteria

- AC-01: 对同时触发 1 个 error（缺 name）与 1 个 warn（debug 开启）的配置运行 `node src/audit.mjs test/fixtures/bad.json --json`，stdout 为单行合法 JSON：findings 逐项含 rule、level、message，ok 为 false，summary 计数为 error 1、warn 1、total 2，进程退出码为 1。
  - Verify: [B] `test/fixtures/bad.json` → stdout 逐字节等于 `test/fixtures/bad.expected.json` 且退出码为 1，由 `npm test` 内断言执行。
- AC-02: 对零 finding 的配置运行 `node src/audit.mjs test/fixtures/ok.json --json`，stdout 为单行合法 JSON：findings 为空数组，ok 为 true，summary 计数全 0，进程退出码为 0。
  - Verify: [B] `test/fixtures/ok.json` → stdout 逐字节等于 `test/fixtures/ok.expected.json` 且退出码为 0，由 `npm test` 内断言执行。
- AC-03: 不带 `--json` 运行时，文本输出（逐条 finding 行与汇总行）及退出码与现状逐字节一致，并被新增的文本对比断言锁定。
  - Verify: [A] `npm test` → 退出码 0，其中含锁定文本模式输出与退出码的对比断言。
- AC-04: README 用法一节记载 `--json` 的用法、输出字段含义（findings、ok、summary）与退出码语义。
  - Verify: [D] `README.md` 含 `--json` 用法说明及 findings、ok、summary 字段与退出码语义的描述。

## Constraints

- 默认（无 `--json`）文本输出与退出码逐字节保持现状。
- 两种模式退出码语义一致：存在 error 级 finding 时退出码 1，否则 0。
- 保持零依赖：仅用 node 内建模块，不新增 dependencies 或 devDependencies。
- 不改动审计规则与 audit() 的返回结构。
- 遵循 docs/testing.md：新增行为先有失败测试，CLI 输出变更配文本对比断言。

## Agent Mandate

- May decide: JSON 字段的具体命名与顺序（在 findings、ok、summary 骨架内）、`--json` 的 argv 解析方式、fixture 具体内容、测试代码组织、src/audit.mjs 内部结构调整。
- Must ask: 需要改变 Goal、Scope、Success Criteria 或 Constraints，需新增第三方依赖，需改变文本模式输出或退出码，或需删除、重命名现有公共文件时。
- Must not: 修改审计规则逻辑；改变无 flag 时的输出或退出码；新增其它 flag、配置文件或 schema 版本化；改动 CI 或发布配置；push；停在分析；对仓库可查事实回头提问；在未跑通全部 Verify 前宣称完成。

## Iteration Strategy

先用对比断言锁定文本模式现状，再实现 `--json` 并落 golden fixture，全程保持 `npm test` 绿。

## Completion

- Evidence: All Success Criteria are satisfied; every Verify line passes with fresh, reproducible evidence from the current worktree.
- Quality: `npm test` 全量通过；最终 diff 经过 review 并在不改行为的前提下简化；无无关改动混入。
- Final report: docs/goal-contracts/2026-08-07-minicli-json-output-report.md: 逐条 AC 对应 Verify 证据、改动文件清单与剩余风险。

## Blockers

- None.
