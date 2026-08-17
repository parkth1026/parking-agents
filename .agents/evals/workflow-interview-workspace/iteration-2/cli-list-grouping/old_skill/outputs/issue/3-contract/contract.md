# Goal Contract: session.mjs 的 list 命令按 stage 分组显示，并支持按 stage / status 筛选

- Status: Ready
- Target: `.claude/skills/workflow-interview/scripts/session.mjs`（`cmdList` 及配套测试）
- Updated: 2026-08-13

## 原始请求

> session.mjs 的 list 命令现在把所有 issue 摊平打印成一张表，issue 一多就看不过来了。我想让它按 stage 分组显示，并且能加个筛选只看某个 stage 或者只看 in_progress 的。

## 目标

`list` 按 stage 分组展示所有 issue，并支持只看某个 stage 或只看 in_progress 状态的 issue，同时不带任何参数时的现有输出保持不变。

## Why

- issue 数量增多后，现在摊平成一张长表的输出失去了可扫描性，用户没法一眼看出手上的 issue 分布在哪些阶段。
- 用户在自己电脑上有一个仓库外的 PowerShell 脚本，靠这条命令现有输出的固定列宽/列顺序解析文本，喂给他自己的一个提醒工具；这条改动必须在提供新视图的同时不打断这条已存在的路径。

## 范围

做：
- `list` 新增 `--stage` 参数，接收一个值，必须是 `1-interview`/`2-prototype`/`3-contract` 之一，按该 stage 过滤。
- `list` 新增 `--status` 参数，接收一个值，必须是 `in_progress`/`ready` 之一（对齐清单文件里记的整体 status 字段，不是每阶段更细的那五态），按该状态过滤。
- 两个参数任意组合使用时，按 STAGES 常量顺序（`1-interview` → `2-prototype` → `3-contract`）逐组打印过滤后的结果，分组标题带 stage 名字和该组过滤后的命中数。
- 过滤后没有任何命中时，打印一行明确的「没有匹配项」提示（带上用户实际传的 flag），不打印空表格、不静默不输出。

不做：
- 不改 `--stage`/`--status` 之外任何已有子命令（`init`/`round`/`stage`/`verify`/`rebuild`/`finalize`）的行为。
- 不新增按其它字段（如按 slug 前缀、按创建时间）分组或筛选的能力。
- 不迁移或适配仓库外那个 PowerShell 脚本本身——那个脚本不在这个仓库里，这次改动只保证「不加 flag 时的默认输出」这一侧不变，脚本那侧不动。
- 不把分组/筛选逻辑做成可配置的输出格式（如 JSON 输出），仍然是给人读的纯文本。

## 强约束

- 不带任何 `--stage`/`--status` 参数时，`list` 的输出（列、列宽、列序、每行文本内容、行的排序）必须和当前实现字节级一致。这是本次改动里最高代价的不变量，錯了会打断用户仓库外脚本的解析。
- `2-prototype/behavior.md`、`2-prototype/example-run.md` 是确认版对照物，不可修改；执行 Agent 改的是 `session.mjs` 和它的测试，不是这两份文件。
- 不引入新的运行时依赖（仓库现有约定是零依赖，只用 Node 内置模块）。

## 自主边界

不用问，直接定：
- CLI 参数解析细节（沿用 `session.mjs` 现有的 `parseFlags` 风格）。
- 分组内部除已锁定的「按 STAGES 常量顺序出组、组内按 slug 字母序」之外的其它实现选择。
- 测试文件的内部组织方式（用几个 `test()`/`describe()`、断言写法），只要覆盖到验收条件里点名的场景。
- 测试如何伪造 `repoRoot()`（例如用临时目录 + `.git` 占位文件），只要不污染真实的 `.aes-workflow/grilling/`。
- 清单文件损坏时的行数据在分组视图下归入哪个分组标签（可以另立一个 `(未知 stage)` 组），只要不影响正常 issue 的分组结果。

必须停下来问：
- 改变不带 flag 时的默认输出（哪怕只改一个空格）。
- 让 `--status` 的取值域从 `in_progress`/`ready` 扩展到 `stage_gates` 的五态，或者反过来改变现有 `manifest.status` 的语义。
- 给 `list` 加任何会连网、读用户仓库外文件、或者需要新依赖的能力。

## 读什么

- `../2-prototype/behavior.md` — 确认版行为对照表，变化行与不变清单。
- `../2-prototype/example-run.md` — 确认版可执行示例，7 个具体调用场景与期望输出/退出码。
- `docs/testing.md`（仓库根）— 现有测试惯例：零依赖 `node:test`，无 lockfile。

## 验收条件

- AC-001: 不带任何 `--stage`/`--status` 参数时，`list` 的输出与当前实现字节级一致
  - Verify: [A] `node --test .claude/skills/workflow-interview/scripts/session.test.mjs --test-name-pattern="^AC-001"` → 退出码 0
- AC-002: 带 `--stage` 参数时按指定的那个 stage 分组打印，标题行带 stage 名字和过滤后的命中数
  - Verify: [A] `node --test .claude/skills/workflow-interview/scripts/session.test.mjs --test-name-pattern="^AC-002"` → 退出码 0
- AC-003: 带 `--status` 参数（`in_progress`/`ready`）时按该状态过滤，跨多个 stage 命中时按 STAGES 常量顺序逐组打印，未命中的 stage 组不出现
  - Verify: [A] `node --test .claude/skills/workflow-interview/scripts/session.test.mjs --test-name-pattern="^AC-003"` → 退出码 0
- AC-004: `--stage`/`--status` 任意组合过滤后命中 0 条时，打印明确的「没有匹配项」提示（带上用户实际传的 flag），不打印空表格
  - Verify: [A] `node --test .claude/skills/workflow-interview/scripts/session.test.mjs --test-name-pattern="^AC-004"` → 退出码 0
- AC-005: `--stage`/`--status` 传入不在合法域内的值时报错退出，退出码 2
  - Verify: [A] `node --test .claude/skills/workflow-interview/scripts/session.test.mjs --test-name-pattern="^AC-005"` → 退出码 0

## 挡着的事

- None.

## 访谈记录

### 第 1 轮（1-interview）

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| 「只看 in_progress 的」该对齐 `manifest.status` 还是 `stage_gates[当前stage].status` | A 对齐 manifest.status 55% / B 对齐 stage_gates 35% / C 按值落域自动判断 10% | A，因为跟现有第三列语义一致、不引入新概念 | A（选对方推荐项） |
| list 的纯文本输出有没有仓库外的东西依赖它 | 开放性发现问题，无候选百分比 | — | 有——用户自己写的本地 PowerShell 脚本，按固定列宽/列顺序解析，喂给一个提醒工具；不确定要不要迁移，请给建议 |

没占提问、走默认区定下的条目：

| 定了什么 | 档 | 为什么这么定 | 用户 |
| --- | --- | --- | --- |
| 分组顺序固定用 STAGES 常量顺序，不按字母序 | 默认 | 仓库现成的阶段顺序 | 未反对 |
| 分组标题行同时标出 stage 名字和该组 issue 数量 | 默认 | 分组的意义就是一眼知道每堆多少 | 未反对 |
| `--stage`/`--status` 值不在合法域内直接报错退出 | 默认 | 复用 `cmdStage` 现成校验风格 | 未反对 |
| 筛选后 0 条的分组不打印该组标题 | 默认 | 减少噪音 | 未反对 |
| 筛选参数命中 0 条时明确打印没有匹配项 | 默认 | 空输出让人分不清筛没了还是命令挂了 | 未反对 |
| 组内排序沿用现有按 slug 字母序 | 默认 | 和现在唯一的排序规则保持一致 | 未反对 |
| 不加任何 flag 时输出保持字节级不变，分组/筛选只在显式传参时启用 | 确认 | 不确定输出格式有没有仓库外依赖，动默认行为代价不可逆 | 确认——用户证实确有本地脚本依赖 |

### 第 1 轮（2-prototype，draft v1 → v2）

| 版本 | 给用户看了什么 | 用户意见 | 改成什么 |
| --- | --- | --- | --- |
| v1 | `behavior.md` 变化行 + `example-run.md` 场景，分组/0命中用文字占位描述而非具体样例 | ①分组标题要给出具体样子（stage 名字+数量），不能占位；②要补一个 0 命中的具体场景，明确提示没有匹配项 | v2：具体化为 `== stage 名字 (数量) ==` 这种标题格式，新增场景 4/5 展示「没有匹配项（带上用户实际传的 flag）。」文案 |
| v2 | 修订后的 `behavior.md`/`example-run.md` | 确认通过，无新增意见 | 落为确认版 `2-prototype/behavior.md`、`2-prototype/example-run.md` |

### 第 1 轮（3-contract）

全部 5 条验收条件的验证途径（node:test + `--test-name-pattern`）走默认区一次定掉：不涉及数字门槛、真实数据或需要新建重基建，仓库已有零依赖 `node:test` 惯例可以直接复用。用户回复「选对方推荐项，都按你说的定」。

## 设计取舍

本次无需取舍。验证途径只有一个成熟选项（复用仓库现成的 `node:test` 惯例新建一份 `session.test.mjs`），没有第二条成本结构不同的路径需要比较；分组/筛选的实现方式是局部、可逆、不改变外部契约的选择，属于自主边界，不进这里。
