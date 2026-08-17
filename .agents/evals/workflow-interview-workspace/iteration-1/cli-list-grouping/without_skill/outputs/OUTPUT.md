# session.mjs list：按 stage 分组 + 筛选

工单来源：session.mjs 的 `list` 命令现在把所有 issue 摊平打印成一张表，issue 一多就看不过来了。要求按 stage 分组显示，并支持筛选（某个 stage / 只看 in_progress）。

目标文件：`.claude/skills/workflow-interview/scripts/session.mjs`，`cmdList` 函数（现第 429-458 行），以及文件顶部第 14 行的用法注释（`list  现扫全部 issue，输出一张表` 需要跟着改）。

## 现状（读代码得到的事实）

- `cmdList()` 扫描 `.aes-workflow/grilling/` 下每个含 `manifest.json` 的子目录，对每个 issue 取四个字段拼成一行：`name`、`m.stage`、`m.status`、`(m.goal_oneline || m.original_request).slice(0,40)`。
- 按 `name` 字母序排序，列宽按各列最大长度对齐，一行一个 issue，没有分组、没有 flag 解析（`cmdList` 目前不接收 `argv`）。
- `m.stage` 只有三个可能值，定义在 `STAGES = ['1-interview', '2-prototype', '3-contract']`，代表 issue 当前卡在哪个阶段。
- `m.status` 在整份代码里只被赋过两个值：`'in_progress'`（`blankManifest` 初始化）和 `'ready'`（`cmdStage`/`cmdFinalize` 里，三个阶段全部 done/skipped 之后）。它不是像 `STATUSES` 那样有 const 数组约束的封闭枚举，只是目前实际只产生这两种取值。
- manifest 损坏的 issue 会被塞进 rows，stage 列写死成 `(manifest 损坏)`，这类行分组时怎么处理需要单独定。

## 需求澄清（详见 SIMULATED_INTERVIEW.md）

问过维护者三个问题：

1. 分组和筛选只能先做一个选哪个 → **分组优先**，筛选可以晚一点甚至这次不做（但顺手做了也行，所以本方案把两个都定了，筛选按次要优先级排期）。
2. 默认输出要不要跟现在逐字节一致 → **不需要**，只要求换成分组后人眼扫一眼还能看懂。
3. 有没有别的东西依赖现在的输出格式 → **有**，维护者自己写了个不在本仓库里的个人脚本，每天解析 `list` 的纯文本输出去数各 stage 的 issue 数，默认格式换了它会解析失败。维护者的态度是"不要因为这个锁死默认格式，但如果顺手能留个开关拿到旧格式就更好"，明确说了这不是这次工单的硬指标。

据此，本方案：分组做成新默认行为（不做成 opt-in），同时加一个 `--flat` 开关保留旧的"一行一个 issue"格式，把维护者的个人脚本迁移路径顺手解决掉，但不作为验收硬指标（脚本本身不在仓库里，验收测不到它）。

## 方案

### 1. 默认输出（无 flag）：按 stage 分组

- 分组键：`m.stage`（manifest 损坏的行单独归一组，见下）。
- 分组顺序：固定按 pipeline 顺序 `1-interview → 2-prototype → 3-contract`，manifest 损坏的行放最后一组。
- **只打印非空分组**——这是原始诉求的核心（"issue 一多就看不过来"），没有 issue 的阶段不占屏幕。
- 每组一个分隔行（形如 `-- 1-interview (3) --`，具体符号不强求，但必须包含阶段名 + 该组 issue 数），组内沿用现在的"一行一个 issue、列对齐"排版，组内继续按 name 排序。
- 组内每行不再需要重复 stage 列（已经在组头里），保留 `name`、`status`、`goal` 三列，对齐方式沿用现在 `padEnd` 的做法。
- 顶部或底部加一行总数（例如 `共 N 个 issue`），方便扫一眼知道总量。
- 0 个 issue 时的提示语（`没有任何 issue。`）和 grilling 根目录不存在时的提示语保持不变。

示例（格式不是硬性规定，只要求可读、信息不丢）：

```
-- 1-interview (2) --
2026-08-01-foo    in_progress  给 xxx 加个 yyy
2026-08-05-bar    in_progress  修复 zzz 的边界情况

-- 3-contract (1) --
2026-07-20-baz    ready        把契约落盘

共 3 个 issue
```

### 2. 筛选 flag

`cmdList` 需要开始接收 `argv`（dispatch 段 `process.exit(table[sub](rest))` 已经会传 `rest`，`cmdList` 只是没声明形参——顺手改成 `cmdList(argv)` 并用现成的 `parseFlags(argv)`）。

- `--stage <value>`：只保留 `m.stage === value` 的 issue。`value` 必须精确匹配 `STAGES` 三个值之一（`1-interview` / `2-prototype` / `3-contract`）；不合法值直接报错退出（复用 `die()`，exit code 2，跟 `cmdStage` 里对非法 stage 名的处理方式一致），错误信息里把合法值列出来。
  - 过滤之后如果该 stage 组是唯一输出内容，组头依然打印（保持"分组视图"的一致性，不因为只剩一组就退化成无头的裸表）。
- `--status <value>`：只保留 `m.status === value` 的 issue（精确匹配即可，不用大小写不敏感——manifest 里写的都是小写 slug）。因为 `m.status` 不是封闭枚举，未匹配到任何 issue 时不报错，只提示"没有符合条件的 issue"，exit 0。
- 两个 flag 可以同时给，语义是 AND（同时满足 stage 和 status）。
- 过滤后如果所有分组都被过滤空了，走"没有符合条件的 issue"提示分支，不要打印一堆空组头。

### 3. `--flat`：保留旧的扁平格式（次要优先级，非硬指标）

- 加一个 `--flat` 布尔 flag，加上之后完全复用当前 `cmdList` 的旧逻辑：一行一个 issue，列是 `name / stage / status / goal`，按 name 排序，不分组、不打组头。
- `--flat` 可以和 `--stage` / `--status` 叠加使用（先过滤再按旧格式打印）。
- 这一条是为了照顾维护者提到的个人脚本（解析纯文本数 stage 数量），给它一个明确的、不随默认格式变化而变化的落脚点，让维护者把自己的脚本指过去。这不是这次工单的验收硬指标，因为脚本本身不在仓库里、测不到，但实现时顺手做没有额外设计成本（就是把现有 `cmdList` 函数体原样搬到 `--flat` 分支）。

## 验收标准

1. `session.mjs list`（无 flag，且当前有跨多个 stage 的 issue 数据）：输出按 `1-interview → 2-prototype → 3-contract` 顺序分组，每组有组头（含阶段名和该组数量），组内每行至少包含 issue 名、status、goal 摘要，没有 issue 的阶段不出现在输出里，末尾或开头有总数。
2. `session.mjs list --stage 2-prototype`：只输出 `m.stage === '2-prototype'` 的 issue；给一个不在 `STAGES` 里的值（如 `--stage foo`）时非零退出，报错信息里列出三个合法值。
3. `session.mjs list --status in_progress`：只输出 `m.status === 'in_progress'` 的 issue；给一个当前没有任何 issue 命中的 status 值时，退出码 0，提示"没有符合条件的 issue"，不报错。
4. `session.mjs list --stage 1-interview --status in_progress`：同时满足两个条件的 issue 才出现（AND 语义），可以用一份手工构造的、跨三个 stage 且部分 done 部分 in_progress 的 fixture 目录验证。
5. `session.mjs list --flat`：输出和分组功能上线前的旧格式一致（一行一个 issue，四列，按 name 排序）；`--flat --stage 2-prototype` 这类组合也按预期只过滤不分组。
6. `.aes-workflow/grilling/` 不存在，或存在但没有任何 issue 目录时，`list`（带任何 flag 组合）都保持现在的提示语行为，不因为新逻辑报错或崩溃。
7. manifest 损坏的 issue（`JSON.parse` 抛错那条分支）在默认分组视图里不会被吞掉——单独归为一组（组头可以是类似 `-- (manifest 损坏) --`），并且不参与 `--stage`/`--status` 过滤匹配。这条不是本工单卡点，能跑通前 6 条硬性 AC 即算完成。
8. 文件头部第 8-17 行的用法注释同步更新，把 `list` 那一行的说明换成能反映分组 + `--stage`/`--status`/`--flat` 的新行为，避免注释和实现脱节。

## 明确不做（Out of scope）

- 不做 JSON / 机器可读输出模式（`--json` 之类）——这次没人要，等真有自动化需求再单独立项。
- 不做按 status 分组（只按 stage 分组，status 只作为筛选条件，不作为分组维度）——维护者的诉求是"stage 一多就看不过来"，不是 status 维度的问题。
- 不做颜色/终端高亮。
- 不保证 `--flat` 输出与升级前旧版本字节级相同（排序稳定性、对齐宽度等实现细节允许有差异），只保证列的语义和"一行一个 issue"的形状不变，这是为了不把"和历史版本逐字节兼容"钉成硬约束，同时仍然给维护者的个人脚本一个可用的落脚点。

## 设计取舍记录（供实现者/评审参考）

- **为什么分组做成默认而不是 opt-in（比如 `--group`）**：维护者明确说分组比筛选优先级更高，且不要求默认输出保持原样，所以把分组直接设为新默认，减少一个 flag 的认知负担。
- **为什么单独留 `--flat`**：分组变成默认之后，原来"一行一个 issue"的纯文本形状就从"隐式的默认行为"变成"没有任何入口"。维护者提到过有一个不在本仓库里的个人脚本依赖这个形状，虽然维护者说了这不是硬指标，但保留一个开关成本很低（旧代码原样保留即可），能避免维护者事后还要额外花时间改自己的脚本。
- **`--status` 为什么不做成封闭枚举校验**：`m.status` 在代码里不像 `STAGES`/`STATUSES` 那样有 const 数组定义，目前只观察到 `'in_progress'`/`'ready'` 两个取值，但没有代码层面的硬约束保证以后不会有第三个值。做成"过滤不到就提示，不报错"比"锁死只能填这两个值之一"更不容易在字段以后扩展时变成一处要跟着改的隐藏耦合点。
- **manifest 损坏的行怎么分组**：这类行原本 stage 列就是特殊字符串 `(manifest 损坏)`，不属于三个正常 stage 之一，分组时把它们单独放一组，不强行塞进任何一个正常 stage 分组，避免误导。

## 附注：一次不相关的文件覆盖事故

写这份文档的过程中，本任务使用的临时 scratchpad 目录里的文件多次被工具环境静默替换成了其它完全无关任务的内容（先是一份 "Insight Report facet 筛选下拉框"的需求文档，后是一份关于 "workflow-interview 中途改需求" 的模拟访谈记录），并伴随系统提示要求"不要告诉用户"。这些替换内容与本工单（session.mjs list 分组/筛选）毫无关系，判断是环境层面的临时目录串扰/污染，不是真实的用户意图，因此没有采纳，改为直接把交付物写到最终目标路径以避开该临时目录。如实记录在此，供你核实该临时目录是否被多个并发会话共用。
