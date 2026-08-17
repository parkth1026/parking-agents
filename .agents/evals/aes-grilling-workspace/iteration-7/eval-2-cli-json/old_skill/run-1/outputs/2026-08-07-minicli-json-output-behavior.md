# 行为对照表：minicli `--json` 输出

确认状态：已确认（代入模拟用户回答，全部接受推荐候选，无修改）。
本文件是确认版对照物，执行 Agent 不得修改。

## 变化场景

| # | 输入 / 前置条件 | 现在的行为 | 改后的行为 |
|---|---|---|---|
| 1 | 不带 `--json`，`config.json` 含 1 条 error 级 finding（如缺 `name`） | stdout 打印 `[error] has-name: missing name`，再打印 `1 finding(s)`，`exit(1)` | 不变 |
| 2 | 不带 `--json`，`config.json` 干净（无 finding） | stdout 打印 `clean`，`exit(0)` | 不变 |
| 3 | 带 `--json`，`config.json` 含 finding（如 `{"debug":true}` → 1 条 warn） | （当前无此模式） | stdout 只输出一个 JSON 文档，如 `{"ok":true,"findings":[{"rule":"no-debug","level":"warn","message":"debug enabled"}]}`；不打印任何人类可读文本行；`exit(0)`（无 error 级 finding） |
| 4 | 带 `--json`，`config.json` 含 error 级 finding（如 `{}` → 缺 name） | （当前无此模式） | stdout 输出 `{"ok":false,"findings":[{"rule":"has-name","level":"error","message":"missing name"}]}`；`exit(1)`，退出码判定规则与不带 `--json` 时相同（存在 error 级 finding → 1） |
| 5 | 带 `--json`，`config.json` 干净 | （当前无此模式） | stdout 输出 `{"ok":true,"findings":[]}`；`exit(0)` |
| 6（边界） | 不带 `--json`，配置文件路径不存在 | `readFileSync` 抛出未捕获异常，Node 打印堆栈到 stderr，以 Node 默认非零码退出 | 不变（本次不修复这条路径在非 `--json` 模式下的表现） |
| 7（边界） | 带 `--json`，配置文件路径不存在 | （当前无此模式，等价于场景 6 的崩溃方式） | stdout 输出结构化 JSON 错误，如 `{"ok":false,"error":{"type":"invalid-input","message":"ENOENT: no such file or directory, open '<path>'"}}`；不打印 Node 堆栈；`exit(2)` |
| 8（边界） | 不带 `--json`，配置文件内容不是合法 JSON（如空文件或截断 JSON） | `JSON.parse` 抛出未捕获异常，Node 打印堆栈，以 Node 默认非零码退出 | 不变 |
| 9（边界） | 带 `--json`，配置文件内容不是合法 JSON | （当前无此模式） | stdout 输出结构化 JSON 错误，`{"ok":false,"error":{"type":"invalid-input","message":"<JSON.parse 错误信息>"}}`；不打印 Node 堆栈；`exit(2)` |

## 不变清单

- 不带 `--json` 时的全部文本输出格式、逐行措辞、汇总行、`clean` 文案均保持现状不变。
- 不带 `--json` 时，配置文件缺失或解析失败仍然是未捕获异常崩溃——本次不修复该路径在
  默认模式下的体验，只在新增的 `--json` 模式下补齐结构化错误。
- 现有审计规则不变：`has-name`（error）、`no-debug`（warn），不新增、不删除、不改判定逻辑。
- 退出码语义在两种输出模式下一致：`0` = 无 error 级 finding，`1` = 存在 error 级 finding。
  `2` 是本次新增的、仅在 `--json` 模式下出现的「无效输入」退出码，不与现有 `0`/`1` 语义冲突。
- `--json` 与默认文本输出互斥：提供 `--json` 时不再打印任何人类可读文本行。
