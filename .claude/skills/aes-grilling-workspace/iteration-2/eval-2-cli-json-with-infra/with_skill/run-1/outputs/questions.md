# 提问与确认记录（aes-grilling / minicli --json）

## 第 1 轮：批量问清歧义（Step 2）

### 已查清并同步给用户的事实（不占提问）

- `src/audit.mjs`：`audit()` 返回 `[{rule, level, message}]`；CLI 打印 `[level] rule: message` 行加汇总行（`N finding(s)` 或 `clean`），存在 error 级 finding 时退出码 1。
- 验证基建：`npm test` → `node test/run-tests.mjs`（node 内建 assert，零依赖）；`docs/testing.md` 要求新增行为先有失败测试、CLI 输出行为变更需同步文本对比断言。
- 无 CI 配置、无第三方依赖；README 记载文本报告与退出码语义。
- 当前坏输入（config 文件缺失或非法 JSON）抛未捕获异常，栈打到 stderr，node 默认非 0 退出。

### 推荐候选（靶子，供挑毛病）

- Goal：`node src/audit.mjs <config.json> --json` 输出机器可读的 JSON 审计结果；不带 flag 时行为与现状完全一致。
- In：在现有 CLI 入口增加 `--json` flag、其输出格式、相应测试与 README 用法更新。
- Out：不改动审计规则本身，不新增其它 flag，不重构参数解析体系，坏输入错误美化按 Q3 裁决。
- AC 方向：JSON 输出符合约定形状；退出码语义保持；默认文本输出逐字节不变；`npm test` 全绿含新增断言；README 更新。

### 问题批次（互不依赖，一次问全）

**Q1. JSON 输出形状**
- 证据：findings 元素为 `{rule, level, message}`；文本模式额外有汇总行与 clean 态。
- 选项 A：裸数组 `[{rule,level,message}, ...]`，clean 时为 `[]`。代价：消费方需自行统计 error 数，丢失汇总信息。
- 选项 B（推荐）：信封对象 `{ findings: [...], summary: { error: n, warn: n, total: n }, ok: <bool> }`。代价：schema 稍大，字段命名需一次定死。
- 选项 C：JSON Lines，每 finding 一行。代价：与"单文件一次审计"场景不匹配，汇总仍无处安放。

**Q2. JSON 模式退出码语义**
- 证据：现状有 error 级 finding 时 exit 1，README 明文记载。
- 选项 A（推荐）：与文本模式一致——有 error 级 finding 时 exit 1。代价：管道消费方（如 `| jq`）需容忍非 0 退出码。
- 选项 B：JSON 模式恒 exit 0，成败只看 JSON 内容。代价：破坏与现状一致性，CI 门禁需额外解析 JSON 才能判失败。

**Q3. 坏输入（文件缺失/非法 JSON）错误处理是否入 Scope**
- 证据：当前直接抛未捕获异常（栈 + node 默认退出码），文本与 JSON 模式将同样如此。
- 选项 A（推荐）：本次 Out——保持现状，`--json` 只覆盖成功审计路径。代价：JSON 消费方遇坏文件收到的是 stderr 栈而非 JSON。
- 选项 B：一并做——JSON 模式下错误也输出结构化 JSON。代价：范围扩大，需另定错误 schema，且文本模式是否同改又是一层决定。

**Q4. JSON 排版（公共输出格式，golden 断言会锁死它）**
- 证据：`docs/testing.md` 要求 CLI 输出变更配文本对比断言，输出必须逐字节确定。
- 选项 A（推荐）：紧凑单行 `JSON.stringify`。代价：人眼不好读，需 `jq` 辅助。
- 选项 B：两空格缩进 pretty-print。代价：fixture 多行、diff 稍大，但同样确定。

### 第 1 轮回答（按 PERSONA.md 立场）

- Q1 → B（信封对象）：明确要求 findings 含 rule/level/message 且带整体结论；字段命名授权 Agent 决定。
- Q2 → A：退出码不能变。
- Q3 → A（PERSONA 未覆盖，按推荐项）：坏输入错误处理本次 Out。
- Q4 → A（PERSONA 未覆盖，按推荐项）：紧凑单行 JSON。
- 补充信息：动机是 CI 流水线要机器读审计结果，解析文本经常被文案变化搞挂；默认文本输出必须保持兼容；额外 Out：不做 schema 版本化、不加配置文件、不改现有审计规则；验收方式跟仓库测试约定走，推荐即准。

### 第 1 轮后维度自评

- Intent：已定 —— CI 机器读审计结果，摆脱文本解析脆弱性。
- Outcome：已定 —— `--json` 输出信封 JSON（findings + 整体结论），退出码语义不变。
- Boundary：已定 —— In：`--json` flag、输出格式、测试、README；Out：审计规则、其它 flag、schema 版本化、配置文件、坏输入错误美化。
- Constraints：已定 —— 文本输出与退出码逐字节兼容、零依赖、遵循 docs/testing.md。
- Context：已定 —— 5 个仓库文件全部查清，验证基建为 `npm test`。

收口审计：剩余想问的问题（如 summary 字段内部命名）不同答案只改措辞不改执行，已归 Agent-owned。结束提问，进入 AC 对齐。

## 第 2 轮：AC 逐条裁决（Step 3）

一次列全 5 条候选 AC，可一次回复完（例如「2 改成……，删 4，其余接受」）。Verify 档位说明：仓库有现成基建（`npm test`），默认档自动采用；无数字门槛、不涉及真实外部数据，唯一升级点是 [B] golden fixture 的数据来源——采用合成配置（触发既有规则组合即可说明问题），fixture 放 `test/fixtures/`，期望输出以定稿 schema 为准，均属推荐项。

- AC-01：对含 1 个 error（缺 name）与 1 个 warn（debug 开启）的配置运行 `node src/audit.mjs 路径 --json`，stdout 为单行合法 JSON：findings 数组逐项含 rule、level、message，并含整体结论（ok 布尔与 summary 的 error/warn/total 计数）；ok 为 false，进程退出码为 1。
  - Verify: [B] `test/fixtures/bad.json` → stdout 逐字节等于 `test/fixtures/bad.expected.json` 且退出码为 1（由 `npm test` 内断言执行）。
- AC-02：对无 finding 的配置运行同命令，stdout 为单行合法 JSON：findings 为空数组、ok 为 true、summary 计数全 0；退出码为 0。
  - Verify: [B] `test/fixtures/ok.json` → stdout 逐字节等于 `test/fixtures/ok.expected.json` 且退出码为 0（由 `npm test` 内断言执行）。
- AC-03：不带 `--json` 运行时，文本输出（`[level] rule: message` 行与汇总行）及退出码与现状逐字节一致，且该现状被新增文本对比断言锁定。
  - Verify: [A] `npm test` → 退出码 0（含锁定文本模式输出的对比断言）。
- AC-04：README 用法一节记载 `--json` 的用法、输出字段含义（findings/ok/summary）与退出码语义。
  - Verify: [D] `README.md` 含 `--json` 用法说明与上述字段说明。
- AC-05：`npm test` 全量通过，新增测试遵循 docs/testing.md 的文本对比断言约定。
  - （起草后自审：与 AC-01/02/03 的 Verify 重复，属流程性而非新的可观察结果，建议删除。）

### 第 2 轮回答（按 PERSONA.md 立场）

- 「验收方式：跟着仓库测试约定走就行，你推荐什么就是什么。」→ AC-01/02/03/04 按草案接受；AC-05 按推荐删除。
- [B] fixture 四问（数据在哪/脱敏/期望输出基准/存放位置）均未被 PERSONA 覆盖 → 按推荐项：合成配置、无需脱敏、期望输出以定稿 schema 为准、放 `test/fixtures/` 并列入 Deliverables。
- AC 定稿：AC-01～AC-04。

## 第 3 轮：Contract 候选整体确认（Step 4）

向用户展示完整候选摘要：

- Goal：`--json` flag 让 minicli 输出机器可读 JSON 审计结果；默认行为逐字节不变。
- In：`--json` flag、单行信封 JSON 输出、golden fixture 测试、README 更新。
- Out：审计规则、其它 flag、schema 版本化、配置文件、坏输入错误美化、参数体系重构。
- AC：4 条（AC-01 JSON 输出含 finding 场景、AC-02 clean 场景、AC-03 文本模式兼容锁定、AC-04 README）。
- Blocker：无，状态 Ready。
- 落盘路径：workdir 内 `docs/goal-contracts/2026-08-07-minicli-json-output.md`。

### 第 3 轮回答（按 PERSONA.md 立场）

- PERSONA 未覆盖「是否确认落盘」→ 按推荐项：确认候选表达当前共同理解，同意落盘。

