# Context Snapshot: 2026-08-13-cli-list-grouping

- 创建：2026-08-13T00:00:00Z（宿主调查，无 subagent 分片）
- 分片来源：无，宿主直接调查

## 任务陈述
> session.mjs 的 list 命令现在把所有 issue 摊平打印成一张表，issue 一多就看不过来了。我想让它按 stage 分组显示，并且能加个筛选只看某个 stage 或者只看 in_progress 的。

## 用户提出的方案
按 stage 分组显示；加筛选，只看某个 stage 或只看 in_progress 的。没有指定 CLI flag 的具体名字或语法。

## 意图假设
issue 数量增多后摊平的表格失去了可扫描性。用户要的不是「更多信息」，而是「同样的信息按他检索时的心智模型（先按 stage 分堆，再按状态过滤）重新排布」，减少他人工扫描的行数。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| `cmdList` 现在从 `grillingRoot()` 扫目录，读每个 `manifest.json`，拼成 `[slug, stage, status, goal_oneline\|original_request(截40字)]` 四列，按 slug 字母序排序，用等宽 padEnd 打印 | `session.mjs:494-521` | Fact |
| `m.stage` 是当前所在阶段，取值只会是 `1-interview` / `2-prototype` / `3-contract`（`STAGES` 常量） | `session.mjs:25,99,231-236` | Fact |
| `m.status`（当前打印的第三列）在代码里只会被赋两个值：初始 `in_progress`，全部阶段 `done`/`skipped` 后（含 `finalize` 成功后）变成 `ready`；`STATUSES` 常量（pending/in_progress/done/skipped/needs_reinterview）是 `stage_gates[stage].status` 的取值域，不是 `m.status` 的 | `session.mjs:26,89-111,230-233,484-486` | Fact |
| 每个 issue 还有更细的每阶段状态 `stage_gates['1-interview'\|'2-prototype'\|'3-contract'].status`，取值域正是 `STATUSES` 五种，包含 `in_progress` | `session.mjs:196-211` | Fact |
| 现在真实跑一次 `list`：3 个 issue 全部 `stage=1-interview`、`status=in_progress`（这个 worktree 里此刻没有跨阶段、跨状态的样本） | 实测输出 | Fact |
| manifest 损坏时现在的 `list` 会打印 `(manifest 损坏)` / `-` / `跑 rebuild` 那一行，不中断整个命令 | `session.mjs:502-509` | Fact |
| 仓库根 `package.json` 的 `test` 脚本串联了 `tests/skills`、`tests/hooks`、`tests/pi`、`tests/harnesses` 几层 `node:test`／自定义断言脚本，零依赖（无 `node_modules`），约定见 `docs/testing.md` | `package.json:8`、`docs/testing.md` | Fact |
| 这个 worktree 里 `npm test` 现在整体是红的：`tests/skills/test-no-tool-names.mjs` 和 `test-skill-discovery.mjs` 因为跟本次改动无关的既有技能文件（如 `skills/dev/claude-to-vscode-skill-converter`）报错，与本次要改的 `session.mjs` 无关 | 实测 `node --test` 输出 | Fact |
| `.claude/skills/workflow-interview/scripts/` 下目前没有任何针对 `session.mjs` 本身的测试文件；`tests/` 目录下也没有覆盖它 | 实测 `find`／`grep` | Fact |
| `.aes-workflow/` 整个目录被仓库根 `.gitignore` 忽略（`/.aes-workflow`），list 汇总的是运行期产物，不进版本库 | `.gitignore` | Fact |

## 验证基建候选池

- **`node --test <新测试文件路径>`（直接跑单文件）**：仓库既有约定是零依赖 `node:test`，`session.mjs` 是纯 Node 脚本，天然适配；代价：这个 worktree 里全量 `npm test` 现在因无关技能文件已经是红的，不能拿「跑 `npm test` 全绿」当验收，只能钉住新增测试文件本身绿、且不引入新的失败。
- **手动跑 `session.mjs list` 及其筛选/分组参数肉眼核对**：零成本、零基建，但不可重复、不进 CI；代价：只能当"先跑一遍"，不能替代自动化断言。
- **仓库没有端到端/集成测试基建**（`tests/` 三层都是结构断言或 doc-contract 测试，没有跑真实 CLI 子进程再断言 stdout 的先例可直接复用，但 `node:test` + `child_process.execFileSync` 写一个新测试文件的代价很低）：代价含新建这一份文件，但不含新建测试框架本身。

## 术语冲突

用户说的「in_progress」在仓库代码里有两个不同的宿主：
- `manifest.status`（现在 list 打印的第三列）——只有 `in_progress`/`ready` 两种取值；
- `manifest.stage_gates[<当前 stage>].status`——五种取值之一，语义更细（区分 pending 还没碰过 / in_progress 正在问 / needs_reinterview 被打回）。
用户说「只看 in_progress 的」时心里指的是哪一个，代码读不出来，见下方「决定边界未知项」。

## 四分类

- **Fact**：上表全部。
- **User decision**：
  - 「in_progress」筛选到底对齐 `manifest.status` 还是 `stage_gates[当前stage].status`；
  - 分组、筛选新增的默认行为是否会改变「不带任何 flag 时」的输出（用户在访谈开场前已表态这条不能变，仍需当面确认新旧行为的分界线画在哪、以及要不要为下游脚本做迁移）；
  - `list` 输出格式有没有仓库之外的东西在依赖它（跨仓库边界的事，代码读不出来，必须问）。
- **Agent-owned**：
  - CLI flag 的具体命名与解析细节（在 `parseFlags` 既有风格上扩展）；
  - 分组内部的排序规则（沿用现有按 slug 字母序）；
  - 分组标题行的具体措辞、列宽计算细节；
  - 0 匹配时的具体提示文案。
- **Blocked**：无。

## 决定边界未知项

- 「只看 in_progress 的」筛选，对齐 `manifest.status` 还是某个 stage 的 `stage_gates.status`——两个字段现在语义和取值域都不同，选错了筛出来的行完全不是用户想要的那批，必须问。

## 未知项

- `list` 纯文本输出格式有没有被仓库之外的脚本/工具依赖（解析固定列宽或列顺序）。这是跨仓库边界的事，仓库内一个字都没写，必须问，不能凭"没读到反例"就当没有。
