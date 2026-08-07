# Goal Contract: minicli 支持 --json 机器可读输出

- Status: Ready
- Target: minicli 仓库（src/audit.mjs CLI 层与 test/）
- Updated: 2026-08-07

## Goal

`node src/audit.mjs config.json --json`（`--json` 位于配置路径前或后均可）在 stdout 输出一份机器可读的 JSON 审计结果，供 CI 直接解析；不带 `--json` 时 CLI 行为与现状完全一致。

## Why

- CI 流水线需要机器读审计结果，现有文本输出的文案变化反复搞挂解析脚本。
- JSON 输出给消费方稳定结构（findings + 整体结论），不再依赖文本格式。

## Scope

- In: CLI 参数解析识别 `--json`；JSON 输出（findings 的 rule/level/message 与含整体状态、计数的汇总对象）；按 docs/testing.md 约定新增测试。
- Out: 不改 `audit()` 导出 API 与审计规则；不做 YAML 等其他输出格式；不做 JSON schema 版本化与配置文件；配置缺失或非法 JSON 的报错行为维持现状（两种模式均抛异常、退出 1）。

## Success Criteria

- AC-01: 带 `--json` 运行（配置路径前或后均可）时，stdout 为单个可被 JSON.parse 解析的 JSON 文档，且不含任何其他文本行。
- AC-02: JSON 文档含 findings 数组，每项含 rule、level、message 三个字段，对相同输入与文本模式报告的 finding 一一对应。
- AC-03: JSON 文档含汇总对象，给出 error 计数、warn 计数与整体状态（clean、warn、error 三者之一），无需遍历 findings 即可判定整体结论。
- AC-04: 不带 `--json` 时，对相同输入 stdout 输出与改动前逐字节一致（逐条 `[level] rule: message` 行与末尾汇总行）。
- AC-05: 两种模式退出码语义一致：存在 error 级 finding 退出 1，否则退出 0。
- AC-06: `npm test` 全部通过，新增测试覆盖 `--json` 输出的结构断言，且遵循先失败测试与文本对比断言约定。

## Constraints

- 默认文本输出与退出码保持向后兼容，逐字节不变。
- 保持零依赖：仅用 Node 内建能力，package.json 不新增依赖。
- 遵循 docs/testing.md：所有测试走 `npm test`；新增行为先有失败测试；CLI 输出行为变更同步文本对比断言。

## Agent Mandate

- May decide: JSON 字段的具体命名与排版、`--json` 的解析实现方式、测试文件组织，以及其余可逆实现细节。
- Must ask: 仅当 Goal、Scope、Success Criteria 或 Constraints 需要改变，或需要破坏性、凭据、生产环境等越权操作时。
- Must not: 停在分析或计划、询问仓库可查事实、悄悄扩大范围、在缺乏每条 AC 新鲜证据时宣称完成。

## Completion

- Evidence: 全部 Success Criteria 以新鲜、可复现的命令输出佐证（含 `--json` 与默认模式的实际 stdout 与退出码）。
- Quality: `npm test` 通过；无关的既有失败单独说明；最终 diff 经 review 并在不改变行为的前提下简化。
- Final report: 逐条 AC 对应证据，列出改动文件与剩余风险。

## Blockers

- None.
