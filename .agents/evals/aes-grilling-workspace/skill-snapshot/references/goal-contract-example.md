# Goal Contract: 审计结果支持 JSON 输出

- Status: Ready
- Target: `tools/audit-cli`
- Updated: 2026-07-29

## Goal

用户可以让现有审计命令输出机器可读的 JSON，同时默认的人类可读行为保持兼容。

## Why

- 自动化目前只能解析面向终端展示的文本，容易因文案变化而失效。
- 稳定的 JSON 结果可以被 CI 和其他工具可靠消费。

## Scope

- In: 为现有审计命令增加 JSON 输出选项，覆盖成功结果和审计失败。
- Out: 新建服务 API、修改默认文本格式以及调整无关审计规则。

## Success Criteria

- AC-01: 不使用新选项时，命令现有的输出和退出码行为保持兼容。
- AC-02: 使用 JSON 选项时，stdout 只包含一个合法 JSON 文档，不混入展示文本。
- AC-03: JSON 结果包含审计结论、发现项和错误，不丢失当前文本输出表达的必要信息。
- AC-04: 成功、审计失败、无效输入和意外错误都有确定的退出码与 JSON 结构。
- AC-05: 面向用户的 CLI 帮助说明该选项及其 stdout/stderr 行为。

## Constraints

- 不引入网络服务或第二套审计实现。
- 除非 Success Criteria 明确要求，否则保持现有 CLI 调用者兼容。

## Agent Mandate

- May decide: 自主调查仓库、确定 JSON schema 和可逆实现细节、修改代码与文档、补充测试、审查最终 diff。不改变行为的前提下可做 simplify。
- Must ask: 实现 Goal 必须破坏默认行为、改 Scope 或 Success Criteria 时询问。需要未授权的外部或破坏性操作时也询问。
- Must not: 停在计划阶段、询问可从仓库发现的事实、创建平行审计路径，或在没有每条 AC 新鲜证据时宣布完成。

## Completion

- Evidence: 通过仓库中最高可行的既有测试边界证明全部 Success Criteria。
- Quality: 相关测试和仓库检查通过，无关既有失败已分离；最终 diff 已完成 review 和 simplify。
- Final report: 逐条映射 AC-01 至 AC-05 的证据，并说明改动文件和剩余风险。

## Blockers

- None.
