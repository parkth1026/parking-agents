# Goal Contract: 审计命令支持 JSON 输出

- Status: Ready
- Target: `tools/audit-cli`
- Updated: 2026-08-11

## 原始请求

> 审计命令的结果能不能让脚本直接读？现在 CI 那边解析文本，
> 我们改一次文案他们就断一次。

## 目标

用户可以让现有审计命令输出机器可读的 JSON，默认的人类可读行为保持兼容。

## Why

- CI 目前解析人类可读文本，文案一改就断，属于隐性耦合。
- 运维巡检脚本同样在 grep 当前文本输出，任何文本变动都会波及它。
- 有了 JSON 输出，下游脚本对着字段读，不再猜文案。

## 范围

做：为现有审计命令增加 JSON 输出选项，覆盖成功、审计失败、用法错、意外错误四种结局；
增加 `audit.config.json` 的 `defaultFormat` 字段作为默认格式来源。

不做：新建服务 API、改默认文本格式、调整任何审计规则、迁移现有配置文件。

## 强约束

- 不带 `--json` 且配置未设 `defaultFormat` 时，stdout 逐字节与当前一致。
  运维巡检脚本正在 grep 它。`pnpm test --filter audit-cli` 现有 12 个快照测试零 diff 即为证据。
- 三类退出码语义不变：0 成功 / 1 审计失败 / 2 用法错。
- JSON 输出走独立 schema，不直接序列化内部审计结果对象。
- 非法 `defaultFormat` 值必须报错退出 2，不得静默回退到文本格式。
- 不引入网络服务，不写第二套审计实现。
- 确认版对照物不得修改。

## 读什么

- `docs/cli-conventions.md`，本仓库的 CLI 选项与退出码约定。
- `../2-prototype/api-mock.md`，用户确认版接口报文对。JSON 字段名与结构以它为准。
- `../2-prototype/behavior.md`，用户确认版行为对照表，含不变清单与配置差异。
- `../2-prototype/example-run.md`，用户确认版可执行示例。

## 要落盘的东西

- D-01: `tools/audit-cli/__tests__/fixtures/audit-json/input-repo/`：用户提供的脱敏真实输入，对应 AC-002。
- D-02: `tools/audit-cli/__tests__/fixtures/audit-json/expected-report.json`：对应的期望输出，对应 AC-002。

## 验收条件

- AC-001: 使用 JSON 输出时，stdout 只有一个合法 JSON 文档，不混入任何展示文本。
  - Verify: [A] `pnpm audit-cli --json | pnpm exec jq .` → 退出码 0
- AC-002: JSON 结果的字段与结构与确认版报文对一致，当前文本输出表达的必要信息一个不丢。
  - Verify: [B] 对 `tools/audit-cli/__tests__/fixtures/audit-json/input-repo/` 跑 `--json` → 与 `tools/audit-cli/__tests__/fixtures/audit-json/expected-report.json` diff 为空
- AC-003: 成功、审计失败、用法错、意外错误各有确定的退出码与 JSON 结构，用法错时 stdout 为空。
  - Verify: [A] `pnpm test --filter audit-cli-exit-codes` → 四类场景断言全绿
- AC-004: 配置项 `defaultFormat` 提供默认格式，显式命令行选项覆盖它，非法值报错退出 2。
  - Verify: [A] `pnpm test --filter audit-cli-config-precedence` → 三条断言全绿

## 挡着的事

- None.

## 访谈记录

### 第 1 轮

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| 审计失败时也出 JSON，还是失败仍走文本？ | A 两种都出 76% / B 只有成功出 18% / C 加 `--json-errors` 6% | A，CI 恰恰在解析失败信息时最容易断 | A。「失败信息才是我们解析最多的」 |
| 仓库外还有别的东西在解析当前文本输出吗？ | A 只有 CI 50% / B 还有别的 50% | 无推荐，50/50 已标明没把握 | **B**。「运维那边有个巡检脚本也在 grep 输出，不能改文本格式」 |
| 默认输出格式要不要做成可配置？ | A 不配置，`--json` 显式开启 58% / B 配置加 `defaultFormat` 42% | A | **B**。「CI 那边不想每次都传 flag」 |

### 第 3 轮（对照物阶段回流）

| 问题 | 候选 | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| 审计失败时 `findings` 是空数组还是缺省？ | A 始终存在，空数组 72% / B 无发现时省略 28% | A | A。「始终有，省略最烦人」 |

这一问是 `api-mock.md` 的草稿撞出来的，需求阶段问不到：用户不觉得「字段有没有」
算个要求，直到他看见一份具体报文。

### 没占提问的条目

| 定了什么 | 档 | 为什么这么定 | 用户 |
| --- | --- | --- | --- |
| JSON 走 stdout，日志走 stderr | 默认 | `docs/cli-conventions.md:31` 已是约定 | 未反对 |
| 字段命名 camelCase | 默认 | 仓库现有 3 个 CLI 全部 camelCase | 未反对 |
| 不加 `--json-pretty` | 默认 | JSON 本身可读，脚本消费不需要 | 未反对 |
| fixture 放 `__tests__/fixtures/audit-json/` | 默认 | 跟随仓库既有约定 | 未反对 |
| 退出码语义完全不变 | 默认 | 改动即破坏兼容 | 未反对 |
| 不引入网络服务或第二套实现 | 默认 | 超出请求范围 | 未反对 |
| JSON 走独立 schema | 确认 | 内部对象随规则迭代频繁改名 | 未反对 |
| 首版不带 schema 版本号 | 确认 | 未承诺兼容前版本号是空承诺 | **翻成：要带 `schemaVersion`** |

被翻掉的两条都是**跨仓库边界的事**（谁在消费输出、组织上是否打算长期承诺兼容），
两条都错。仓库里读不出来的事，置信天然不可靠——下次改这份契约的人靠这行知道
该重新验证什么。

## 设计取舍

### D-1 JSON 结构要不要复用现有的内部审计结果对象

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 直接序列化内部对象 | 内部结果加 `toJSON()` | 快，但内部字段变了外部契约跟着变 | 会把实现细节泄露成公共接口 |
| B（选定）独立输出 schema | 新写一层映射 | 多一层映射代码，内部重构不破坏外部契约 | 无 |
| 什么都不做 | 继续只出文本 | CI 与巡检脚本继续解析文案 | 正是这次要解决的问题 |

选定 B。理由：内部审计结果对象随规则迭代频繁改字段名，直接暴露等于把内部重构变成
破坏性变更。落进契约的形态：`强约束` 写「JSON 输出走独立 schema」。

### D-2 非法配置值的处理

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 静默回退到文本 | 忽略非法值 | CI 会拿到它以为是 JSON 的文本，静默漏报 | 静默失败比响亮失败危险 |
| B（选定）报错退出 2 | 校验后报错，stdout 为空 | 配置写错的用户被挡住 | 无 |

落进契约的形态：`强约束` 写「非法 `defaultFormat` 值必须报错退出 2，不得静默回退」。
