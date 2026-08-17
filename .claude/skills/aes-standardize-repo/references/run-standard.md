# run 接口标准

## 协议

- 仓库内分发 `run.cmd`、`run`、`run.toml`、`run.schema.json` 和 `scripts/run.mjs`。
- 接口本身只依赖 Node；不要求安装全局 run CLI。
- `[project]` 只有一个 `id = "namespace/name"`。
- 用重复的 `[[actions]]` 表承载 `id`、`name`、`kind`、`run`。
- `kind` 只允许 `task`、`open`、`test`、`gate`。
- 动作 id 限制为唯一的小写点分词。协议约束"形"；[action-naming.md](action-naming.md) 约束"义"——id 一律从它的动词域里取。
- 保留字：`list`、`show`、`doctor`、`help`、`run`。
- `run` 以 argv 数组执行，`shell: false`，工作目录为仓库根。
- 用 `scripts/vendor/toml/` 内置的 TOML 解析器解析 `run.toml`；支持完整 TOML 1.0 语法，而不是按行取子集。解析之后保留 run/v1 schema 校验。
- 命令、动作 id、选项名匹配时不区分大小写。

示例：

```toml
[project]
id = "acme/widget"

[[actions]]
id = "build"
name = "Build"
kind = "task"
run = ["npm", "run", "build"]
```

## run/v1 schema

`run.toml` 是 TOML 1.0；下游软件先解析，再用随每个标准化仓库分发到根目录的 `run.schema.json` 校验解析结果。机器可读契约如下：

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `project` | object | 恰好 `{ id }`；`id` 匹配 `^[a-z0-9][a-z0-9.-]*\/[a-z0-9][a-z0-9.-]*$` |
| `actions` | array | 至少一项 |
| `actions[].id` | string | `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$`，非保留字，全目录内唯一 |
| `actions[].name` | string | 非空 |
| `actions[].kind` | string | `task`、`open`、`test`、`gate` 之一 |
| `actions[].run` | 字符串数组 | 非空，且每个元素非空 |

任何层级都不允许多余属性。跨条目的 id 唯一性是 JSON Schema 表达不了的一条规则，由 runner 在加载时兜底。

## 命令面

- 裸 `run` 与 `run list` 列出全部动作。
- `run show <id>` 描述单个动作。
- `run doctor` 校验 wrapper、配置、Node 与动作可执行文件。
- `run help` 打印用法。
- `run run <id>` 是显式别名；首选一级形式 `run <id>`。
- `-n` 与 `--dry-run` 只生成计划，不启动子进程。
- `--json` 适用于所有命令。

## 退出码语义

- 子进程启动后，原样返回其退出码。
- runner 自有退出码：`64` 用法错误或未知动作，`65` 配置非法，`69` 可执行文件不可用，`70` runner 内部错误。
- 用 JSON 的 `origin` 字段（`run` 或 `child`）配合 `exitCode` 区分归属。

## 机器与终端结果契约

- JSON stdout 恰好是一个 JSON 文档加结尾换行。
- `--json` 生效期间，子进程的 stdout 与 stderr 全部改走 stderr，杜绝子进程文本污染 JSON。
- 输出包含 `schema = "run/v1"`、状态、退出码，以及命令对应的动作或检查数据。
- 结构化 JSON 与进程退出码是权威；绝不解析人类可读的标题行。
- 人类可读的查询输出保持简洁，走 stdout。
- 人类可读的执行计划、错误与最终结果走 stderr。
- 预览必须标注"未执行"；绝不把预览呈现为执行成功。
- 人类可读的结论从真实进程结果推导，绝不从子进程打印的文字推测。

## 集成边界

- 既有 `AGENTS.md` 只追加 run 集成句；原字节保持不变。
- 不包裹 Git 操作。
- 不编辑既有的任务定义、package 脚本或任务运行器命令。
- 门禁工具缺失对 `kind = "gate"` 是预期内的不可用；这些动作在 list 和 doctor 中保持可见。
- 模板与 runner 保持零依赖，克隆一个标准化仓库即足够使用。
- 内置解析器的许可证随源码一同保留；运行时不需要安装包、不访问网络。
