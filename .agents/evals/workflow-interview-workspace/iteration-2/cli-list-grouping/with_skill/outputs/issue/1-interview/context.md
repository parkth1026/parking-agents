# Context Snapshot: 2026-08-13-cli-list-grouping

- 创建：2026-08-13T00:00:00Z
- 分片来源：无，宿主直接调查

## 任务陈述
session.mjs 的 list 命令现在把所有 issue 摊平打印成一张表，issue 一多就看不过来了。我想让它按 stage 分组显示，并且能加个筛选只看某个 stage 或者只看 in_progress 的。

## 用户提出的方案
按 stage 分组显示；加一个筛选参数，能只看某个 stage，或者只看 in_progress 的。未指定具体 flag 名、分组标题怎么写、筛选命中 0 条时怎么处理。

## 意图假设
用户是这套工具日常最重的使用者，手头挂着的 issue 一多，现在的摊平长表让他没法一眼定位到「哪些还在哪个阶段」「哪些是自己正在推进的」。真正要解决的不是「加个分组」本身，而是「issue 多起来之后还能快速找到自己关心的那几个」——分组和筛选是达成这一点的两种手段，不是目的本身。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| `cmdList` 现在扫 `.aes-workflow/grilling/` 下每个含 `manifest.json` 的目录，取 `[slug, m.stage, m.status, (goal_oneline\|\|original_request).slice(0,40)]`，按 slug 排序后按列宽对齐打印，两个空格分隔列，无表头 | `scripts/session.mjs:711-738`（cmdList） | Fact |
| `list` 子命令当前不解析任何 flag（不调用 `parseFlags`），加参数不会报错也不会生效——`--stage foo` 会被 `process.argv.slice(2)` 忽略 | `scripts/session.mjs:742-757`（dispatch 表，`table.list = cmdList` 无参数透传） | Fact |
| `m.stage` 只有三个合法值 `1-interview` / `2-prototype` / `3-contract`（`STAGES` 常量），是 issue 当前所处的单一阶段，不是多值集合 | `scripts/session.mjs:25` | Fact |
| `m.status`（manifest 顶层，list 表里第 3 列）只有两个真实取值：新建时是 `'in_progress'`，三个阶段全部 `done`/`skipped` 后被置为 `'ready'`（`cmdStage` 里 `if (!next) m.status = 'ready'`）。整个代码路径里没有第三个值 | `scripts/session.mjs:99`（`blankManifest`）、`scripts/session.mjs:428-431`（`cmdStage` 尾部） | Fact |
| 每个 `stage_gates[stage].status` 另有自己的取值集合 `pending/in_progress/done/skipped/needs_reinterview`（`STATUSES` 常量），这是阶段级状态，和顶层 `m.status` 是两套不同的字段，字面都叫 `status` 但含义不同 | `scripts/session.mjs:26`、`scripts/session.mjs:369-371` | Fact；同时是术语冲突，见下 |
| `needs_reinterview` 时 `m.stage` 被重置回 `1-interview` 且该阶段 gate 状态置为 `in_progress`，`m.status` 不受影响（仍是 `'in_progress'`）——被打回的 issue 会和「正常在 1-interview 阶段推进中」的 issue 在顶层 `status` 上完全无法区分 | `scripts/session.mjs:421-424` | Fact |
| `list` 现有输出没有表头行、没有分隔线、没有任何机器可选的结构标记（不是 JSON/TSV），纯文本对齐列，是给人眼读的格式，不是给程序 parse 的契约 | `scripts/session.mjs:711-738` | Fact |
| 仓库内没有任何其它文件（`.md`/`.mjs`/`.yaml`）引用或依赖 `list` 的具体输出格式；唯一的引用是 `workflow-interview/SKILL.md:90` 提到「要看时现扫 `session.mjs list`」，只是提它存在，不依赖格式 | `grep -rn "session.mjs list" .claude/skills/` 结果 | Fact |
| 仓库已有该脚本的黑盒回归测试 `scripts/session.test.mjs`，风格是 `spawnSync` 起子进程断言退出码与输出文案/盘上文件，不 import 内部函数；用 `mkdtempSync` 在临时目录伪造带 `.git` 的仓库根，跑 `node session.test.mjs` 全绿退出 0 | `scripts/session.test.mjs:1-40`，实测 `node session.test.mjs` → `44/44 通过` | Fact，是本次改动的验证基建候选 |
| 仓库没有 CI 配置文件（未见 `.github/workflows` 等）在本次可见范围内，验证目前靠本地手跑 `session.test.mjs` | 未见相关文件 | Fact |

## 验证基建候选池

- **`node .claude/skills/workflow-interview/scripts/session.test.mjs`**：仓库现成的黑盒回归测试，跑一次几秒出结果，覆盖 `list` 之外的全部子命令闸门。代价：目前 0 条测试覆盖 `list` 本身，新增分组/筛选需要在这份文件里新增用例，工作量是「加测试用例」量级，不是「建基建」量级。
- **手动跑 `session.mjs list` 系列命令肉眼核对输出**：零基建代价，能验证真实终端观感（对齐、分组是否好读），但不可重复、不进 CI。
- **新建端到端基建**：本次改动范围小（一个只读命令的输出格式），暂无迹象需要，未列为候选。

## 四分类

- **Fact**：`m.stage` 三值单选、`m.status` 只有 `in_progress`/`ready` 两值、现有测试风格与命令、当前输出无结构化格式、仓库内无格式依赖方。
- **User decision**：
  - 「只看 in_progress」筛的是顶层 `m.status`（`in_progress` vs `ready`，粗粒度：几乎所有未 ready 的 issue 都会命中）还是某个阶段 `stage_gates[x].status === 'in_progress'`（细粒度：真正在被推进而非排队 `pending` 或被打回 `needs_reinterview`）——两者字面都叫 `in_progress` 但过滤结果不同，改变了这个 flag 的可观察行为，必须问。
  - 默认不加任何 flag 时，输出要不要保持和现在完全一样（摊平单表，无分组）——这改变的是「谁在依赖当前格式」这类难逆问题，仓库内查不到答案，必须问用户。
  - 分组标题行、组内排序、空组/筛选命中 0 条时怎么显示——这些留到 `aes-prototype` 阶段出具体对照物时逐处质疑，不在这里用文字问，问了也是空对空。
- **Agent-owned**：flag 具体命名（如 `--stage` / `--status`）、内部实现是否复用现有 `parseFlags`、分组内部排序用什么比较函数——局部、可逆、不改变外部契约的实现细节。
- **Blocked**：无。

## 术语冲突

`status` 这个词在 manifest 里同时指两件不同的事：顶层 `m.status`（`in_progress`/`ready`，整个 issue 的宏观状态）和 `stage_gates[stage].status`（`pending`/`in_progress`/`done`/`skipped`/`needs_reinterview`，单个阶段的状态）。用户说「只看 in_progress 的」时用的是口语，仓库代码里这个词有两个不同出处（`scripts/session.mjs:26` 与 `scripts/session.mjs:99`），必须问清指的是哪一个。

## 决定边界未知项

无——上面「User decision」两条已经足够明确，不存在归类含糊的项。

## 未知项

- 用户本地是否有依赖当前 `list` 纯文本输出格式（列宽、列序、有无表头）的外部脚本或工具——这跨出仓库边界，仓库内查不到，必须问。
