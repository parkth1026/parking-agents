# Goal Contract: 审计结果支持 JSON 输出

- Status: Ready
- Target: `tools/audit-cli`
- Updated: 2026-07-29

## Goal

用户可以让现有审计命令输出机器可读的 JSON，同时默认的人类可读行为保持兼容。

## Why

- 自动化目前只能解析面向终端展示的文本，容易因文案变化而失效。
- 稳定的 JSON 结果可以被 CI 和其他工具可靠消费。

## Read First

- docs/cli-conventions.md（本仓库 CLI 选项与退出码约定）

## Scope

- In: 为现有审计命令增加 JSON 输出选项，覆盖成功结果和审计失败。
- Out: 新建服务 API、修改默认文本格式以及调整无关审计规则。

## Deliverables

- D-01: tests/fixtures/audit-json/expected-report.json：用户认可的黄金用例期望输出，对应 AC-03。

## Success Criteria

- AC-01: 不使用新选项时，命令现有的输出和退出码行为保持兼容。
  - Verify: [A] `pnpm test --filter audit-cli` → 退出码 0，现有快照测试零 diff
- AC-02: 使用 JSON 选项时，stdout 只包含一个合法 JSON 文档，不混入展示文本。
  - Verify: [A] `pnpm audit-cli --json | pnpm exec jq .` → 退出码 0
- AC-03: JSON 结果包含审计结论、发现项和错误，不丢失当前文本输出表达的必要信息。
  - Verify: [B] 对 `tests/fixtures/audit-json/input-repo/` 运行 `--json` → 输出与 `tests/fixtures/audit-json/expected-report.json` diff 为空
- AC-04: 成功、审计失败、无效输入和意外错误都有确定的退出码与 JSON 结构。
  - Verify: [A] `pnpm test --filter audit-cli-exit-codes` → 四类场景断言全绿
- AC-05: 面向用户的 CLI 帮助说明该选项及其 stdout/stderr 行为。
  - Verify: [A] `pnpm audit-cli --help` → 输出包含 `--json` 选项及 stdout/stderr 行为说明

## Constraints

- 不引入网络服务或第二套审计实现。
- 除非 Success Criteria 明确要求，否则保持现有 CLI 调用者兼容。

## Agent Mandate

- May decide: 创建分支；在 `tools/audit-cli` 下改代码、补测试与文档；确定 JSON schema 等可逆实现细节；运行测试与 lint。
- Must ask: 实现 Goal 必须破坏默认行为、改 Scope 或 Success Criteria 时；需要未授权的外部或破坏性操作时。
- Must not: push、改 CI 配置、变更 package.json 依赖；停在计划阶段；询问可从仓库发现的事实；在没有每条 AC 新鲜证据时宣布完成。

## Iteration Strategy

先立 AC-01 的兼容护栏，再按 AC-02 到 AC-05 逐条推进，每条 Verify 通过后再动下一条。

## Completion

- Evidence: 全部 Success Criteria 的 Verify 行通过，证据来自当前 worktree 可复跑的命令输出。
- Quality: 相关测试和仓库检查通过，无关既有失败已分离；最终 diff 已完成 review 和 simplify。
- Final report: docs/goal-contracts/audit-json-report.md：逐条映射 AC-01 至 AC-05 的 Verify 证据，说明改动文件和剩余风险。

## Blockers

- None.
