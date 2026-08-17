# Goal Contract: 审计命令支持 JSON 输出

- Status: Ready
- Target: `tools/audit-cli`
- Updated: 2026-07-29

## 原始请求

> 审计命令的结果能不能让脚本直接读？现在 CI 那边解析文本，
> 我们改一次文案他们就断一次。

## 目标

用户可以让现有审计命令输出机器可读的 JSON，默认的人类可读行为保持兼容。

## Why

- CI 目前解析人类可读文本，文案一改就断，属于隐性耦合。
- 有了 JSON 输出，下游脚本可以对着字段读，不再猜文案。

## 范围

做：为现有审计命令增加 JSON 输出选项，覆盖成功结果和审计失败两种情况。

不做：新建服务 API、改默认文本格式、调整无关的审计规则。

## 强约束

- 不引入网络服务，也不写第二套审计实现。
- 不使用新选项时，现有调用者看到的输出和退出码保持原样。
  `pnpm test --filter audit-cli` 的现有快照测试零 diff 即为证据。

## 读什么

- `docs/cli-conventions.md`，本仓库的 CLI 选项与退出码约定。

## 要落盘的东西

- D-01: `tests/fixtures/audit-json/expected-report.json`：用户认可的黄金用例期望输出，对应 AC-002。

## 验收条件

- AC-001: 使用 JSON 选项时，stdout 只有一个合法 JSON 文档，不混入展示文本。
  - Verify: [A] `pnpm audit-cli --json | pnpm exec jq .` → 退出码 0
- AC-002: JSON 结果包含审计结论、发现项和错误，当前文本输出表达的必要信息一个不丢。
  - Verify: [B] 对 `tests/fixtures/audit-json/input-repo/` 跑 `--json` → 与 `tests/fixtures/audit-json/expected-report.json` diff 为空
- AC-003: 成功、审计失败、无效输入、意外错误各有确定的退出码与 JSON 结构。
  - Verify: [A] `pnpm test --filter audit-cli-exit-codes` → 四类场景断言全绿
- AC-004: CLI 帮助里说明了这个选项，以及它对 stdout 和 stderr 的影响。
  - Verify: [D] `pnpm audit-cli --help` 的输出含 `--json` 及其 stdout 与 stderr 说明

## 访谈记录

### 第 1 轮

| 问题 | 候选 | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| JSON 要不要覆盖审计失败的情况，还是只覆盖成功结果？ | A 两种都出 JSON，失败时也结构化 76% / B 只有成功结果出 JSON，失败仍是文本 18% / C 失败时额外加一个 `--json-errors` 开关 6% | A，因为 CI 恰恰是解析失败信息时最容易断 | A（未覆盖 → 按推荐） |
| 要不要顺带支持 `--json-pretty` 之类的格式化选项？ | A 不做，JSON 本身可读性够，脚本消费不需要格式化 / B 加一个 pretty 开关 | A | A。「先不加，真需要再说」 |

## 设计取舍

### D-1 JSON 结构要不要复用现有的内部审计结果对象

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 直接序列化内部对象 | 内部审计结果加 `toJSON()` | 快，但内部字段变了外部契约跟着变 | 会把实现细节泄露成公共接口 |
| B（选定） 定义独立的输出 schema | 新写一层映射，内部对象 → 输出 JSON | 多一层映射代码，但内部重构不破坏外部契约 | 无 |
| 什么都不做 | 继续只出文本 | CI 继续靠解析文案，改文案就断 | 正是这次要解决的问题 |

选定 B。理由：内部审计结果对象会随规则迭代频繁改字段名，直接暴露等于把内部
重构变成破坏性变更；独立 schema 的代价是多写一层映射，但换来了自由改内部实现
的空间。
落进契约的形态：`强约束` 写「JSON 输出走独立 schema，不直接序列化内部审计
结果对象」。
