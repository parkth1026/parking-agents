# Goal Contract: minicli 审计命令支持 --json 输出

- Status: Ready
- Target: `src/audit.mjs`（minicli）
- Updated: 2026-08-07

## 原始请求

> 帮我给 minicli 加个 --json 输出。先别写代码，帮我理清需求、写份 goal contract。

## 目标

用户可以给 minicli 的审计命令加 `--json` 标志，拿到机器可读的结构化审计结果；
不加这个标志时，现有文本输出和退出码完全不变。

## Why

- CI 流水线要机器读审计结果，现在解析文本，文案一改就断。
- JSON 输出让下游脚本对着固定字段读，不再猜文案措辞。

## 范围

做：为 `minicli` 的审计命令新增 `--json` 标志，覆盖「无 finding（clean）」「有
finding（含 error/warn 级）」「无效输入（配置文件不存在、JSON 内容不合法、未提供
配置路径）」三类场景的结构化输出；README 补充这个选项的说明。

不做：JSON schema 版本化；新增配置文件；修改现有审计规则（`has-name`、`no-debug`）
的判定逻辑；修改不加 `--json` 时的文本输出格式或退出码；新增格式化类选项（如
`--json-pretty`）。

## 强约束

- 不加 `--json` 时，CLI 的文本输出和退出码规则必须与现状逐位一致：成功（无 finding）
  退出码 0，含 error 级 finding 退出码 1，无效输入（当前是未捕获异常直接抛到
  stderr）exit 1。`npm test` 里新增的 CLI 文本输出回归断言零 diff 即为证据（现状
  只测 `audit()` 函数返回值，不测 CLI 层文本输出，这是需要补的缺口，`docs/testing.md`
  "CLI 输出行为变更需同步文本对比断言" 这条已经要求这么做）。
- `--json` 模式下，无效输入（缺文件、JSON 解析失败、未提供配置路径）也要输出结构化
  JSON 错误文档到 stdout，不是 stack trace；退出码沿用现状的二值语义（非 0），不新增
  独立退出码。
- 不引入新依赖：`package.json` 现状零 dependency，`--json` 的实现只能用 Node 内建能力。
- JSON 里的字段命名由执行 Agent 决定（用户已明确授权），但一旦定下，`findings` 里
  每条至少要有 `rule`、`level`、`message`，且要有一个能看出「整体是否通过」的字段；
  确定后的具体形态见「访谈记录」里给出的 fixture。

## 读什么

- `src/audit.mjs`：现有审计逻辑与 CLI 入口实现，新逻辑要接在这里或紧邻的位置。
- `docs/testing.md`：本仓库的测试约定（node 内建 assert、新行为先补失败测试、CLI
  输出变更需同步文本对比断言）。
- `test/run-tests.mjs`：现有测试写法参考。

## 要落盘的东西

- D-01: `test/fixtures/audit-json/input.json`：黄金用例输入，对应 AC-002。
- D-02: `test/fixtures/audit-json/expected-report.json`：黄金用例期望输出，对应 AC-002。

## 验收条件

- AC-001: 使用 `--json` 时，stdout 只有一个合法 JSON 文档，不混入任何展示性文本。
  - Verify: [A] `node src/audit.mjs test/fixtures/audit-json/input.json --json | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"` → 退出码 0
- AC-002: JSON 结果里，`findings` 数组每条含 `rule`/`level`/`message`，且有一个字段
  能表达整体结论（是否存在 error 级 finding）；当前文本输出表达的信息一个不丢。
  - Verify: [B] 对 `test/fixtures/audit-json/input.json` 跑 `--json` → 输出与
    `test/fixtures/audit-json/expected-report.json` diff 为空
- AC-003: 无 finding（clean）、含 error 级 finding、无效输入（文件不存在 / JSON
  解析失败 / 未提供配置路径）三类场景，在 `--json` 模式下都有确定的退出码和结构化
  输出（无效输入是结构化 JSON 错误文档，不是 stack trace）。
  - Verify: [A] `npm test` → 新增覆盖这三类场景的断言全绿，退出码 0
- AC-004: README 说明了 `--json` 选项的存在、它覆盖的场景，以及它对 stdout 的影响。
  - Verify: [D] `README.md` 含 `--json` 关键字及对应说明段落

## 访谈记录

### 第 1 轮：材料歧义（对应第 2 步）

| 问题 | 候选 | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| 无效输入（缺文件/JSON 解析失败）在 `--json` 模式下要不要也变成结构化 JSON？ | A 捕获后输出结构化 JSON 错误文档，仍走现状二值退出码 / B 维持现状，抛未捕获异常，stdout 空 / C 只处理"文件不存在"，"JSON 非法"仍按现状崩溃 | A，否则 CI 拿到的 stdout 在这种情况下不是合法 JSON，没解决问题的另一半 | A（画像未覆盖 → 按"选推荐项"代入，理由："CI 要机器读结果"这条动机本身要求无效输入也可解析） |
| `--json` 模式下无效输入要不要给独立于"审计不通过"的退出码？ | A 沿用现状二值语义，不新增退出码 / B 无效输入单独给新退出码（如 2） | A，B 相当于凭空发明一条今天仓库里不存在的退出码约定，且画像强调"退出码也不能变" | A（未覆盖 → 选推荐项） |
| `minicli --json`（不带配置路径）该输出什么？ | A 视为无效输入的一种，走同一条结构化错误路径 / B 完全保持现状：静默退出码 0，`--json` 也不例外 | A，静默成功但 stdout 空对 `--json` 管道下游一样会炸，且与 Q1 保持同一套错误处理逻辑更一致 | A（未覆盖 → 选推荐项） |

收口自评：意图/结果/边界/约束/现状五个维度均已定，进入第 3 步。

### 第 2 轮：对照物判定与行为对照表（对应第 3 步）

判定：本次请求改变现有可观察行为（CLI 新增输出分支，且触及无效输入这类既有行为
的处理方式），不涉及用户可见界面。出行为对照表，不出 mock。

| 场景 / 输入 | 现在的行为 | 改后的行为（`--json` 时） |
| --- | --- | --- |
| `node src/audit.mjs cfg.json`（无 `--json`，`cfg.json = {"name":"x"}`） | stdout 打印 `clean`，退出码 0 | **不变**：与现状逐位一致（不加 `--json` 不受影响） |
| `node src/audit.mjs cfg.json`（无 `--json`，`cfg.json = {"debug":true}`） | stdout 打印两行 finding 文本 + `2 finding(s)`，退出码 1 | **不变** |
| `node src/audit.mjs cfg.json --json`，`cfg.json = {"name":"x"}` | （选项不存在） | stdout 输出单个 JSON 文档，`findings: []`，整体结论字段表示通过，退出码 0 |
| `node src/audit.mjs cfg.json --json`，`cfg.json = {"debug":true}` | （选项不存在） | stdout 输出单个 JSON 文档，`findings` 含 `has-name`(error) 与 `no-debug`(warn) 两条，整体结论字段表示不通过，退出码 1（**变化行**：见 AC-002/AC-003 fixture） |
| `node src/audit.mjs missing.json --json`（文件不存在） | （选项不存在；不带 `--json` 时是未捕获异常，stack trace 到 stderr，退出码 1） | stdout 输出结构化 JSON 错误文档（不是 stack trace），退出码非 0（**变化行**：见 AC-003） |
| `node src/audit.mjs bad.json --json`（JSON 内容非法） | （同上，未捕获异常路径） | stdout 输出结构化 JSON 错误文档，退出码非 0（**变化行**：见 AC-003） |
| `node src/audit.mjs --json`（未提供配置路径） | 静默退出码 0，无输出 | stdout 输出结构化 JSON 错误文档，退出码非 0（**变化行**：见 AC-003） |
| `node src/audit.mjs`（不带任何参数，不带 `--json`） | 静默退出码 0，无输出 | **不变**：不加 `--json` 不受影响 |
| 现有审计规则 `has-name`/`no-debug` 的判定逻辑 | 见 `src/audit.mjs` | **不变**：本次不改规则本身 |

不变清单：
- 不加 `--json` 时的全部文本输出格式与退出码规则。
- 现有审计规则（`has-name`、`no-debug`）的判定条件与文案。
- `package.json` 的依赖列表（保持零依赖）。

用户对以上对照表逐行确认：无异议，按推荐版本落定（画像："其他任何未覆盖的问题：
选推荐项"）。

### 第 3 轮：验收条件候选（对应第 4b 步）

| AC | 候选与代价 | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| stdout 只含合法 JSON | [A] `node -e "JSON.parse(...)"` 校验，不需要新依赖如 `jq`（仓库零依赖） | [A] | [A]（选推荐项） |
| JSON 字段内容完整 | [B] 黄金用例 diff，输入输出均落盘为 fixture；仓库测试约定本就是"具体输入→具体断言"风格 | [B]，fixture 由本次访谈直接给出（合成数据，非真实/敏感数据） | [B]（选推荐项，fixture 见「要落盘的东西」） |
| 三类场景的退出码与结构 | [A] `npm test` 断言，一分钟出结果，覆盖不到真实生产配置的形态，但当前也没有更高档位的基建（无端到端/CI 集成环境） | [A] | [A]（选推荐项） |
| 默认文本模式零变化 | 不单独立 AC，写入「强约束」，Verify 挂在 `npm test` 新增的 CLI 文本回归断言上（现状缺口：现有测试只测 `audit()` 返回值，不测 CLI 文本层） | 写入「强约束」 | 同意（选推荐项） |
| README 说明 | [D] 文件内容检查 | [D] | [D]（选推荐项） |

收口自评：剩下能问的问题只改 Verify 的措辞，不改执行 Agent 要跑什么、跑到什么
程度——判定收口，进入落盘。

## 设计取舍

### D-1 无效输入在 `--json` 模式下要不要给独立退出码

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A（选定） 沿用现状二值退出码语义 | 无效输入与"审计不通过"共用非 0 退出码，靠 JSON 里的字段区分具体原因 | CI 要细分原因得读 JSON 字段，不能只看退出码 | 无 |
| B 新增独立退出码（如 2） | 无效输入单独给一个新数字 | 凭空给仓库引入一条今天不存在的退出码约定，且与画像"退出码也不能变"的精神冲突 | 画像明确强调退出码稳定性，不引入新语义面 |
| 什么都不做（无效输入维持崩溃） | `--json` 不特殊处理无效输入 | stdout 不是合法 JSON，`--json` 想解决的"CI 解析不稳"问题在这条路径上完全没解决 | 违背本次目标里"CI 要机器读结果"这条核心动机 |

选定 A。理由：这次的核心诉求是"CI 别再因为文案变化解析失败"，无效输入恰恰是最容易
让下游 JSON 解析器直接崩溃的一类输出，必须纳入结构化范围；但退出码这个维度画像
明确要求稳定，没有必要在这个维度上再造一条新规则——把"发生了什么"这件事交给 JSON
内容本身表达，退出码继续只做"整体是否 OK"这一件事，两者分工清楚，也不违反约束。
落进契约的形态：`强约束` 写「JSON 模式下无效输入也输出结构化错误文档，但不新增
独立退出码」。

### D-2 JSON 字段命名与整体结构

本次无需在多个成熟方案间取舍——画像已明确把字段命名授权给执行侧决定
（"字段命名你定"）。为了让验收条件可判定，本次访谈给出了一份具体候选（`ok` +
`findings[]`，每条 `rule`/`level`/`message`）并落成黄金用例 fixture，执行 Agent
按 AC-002 的 fixture 实现即可，不必再重新设计结构。
