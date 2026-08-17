# Goal Contract: notes-cli 支持按关键词直接定位笔记

- Status: Ready
- Target: fixtures/notes-cli
- Updated: 2026-08-07

## Goal

notes-cli 提供 `search` 子命令：给一个关键词，就能在几百条笔记里列出标题或正文包含该关键词的笔记，输出与 `list` 相同的表格；默认只看未归档笔记，`--all` 时连归档的一起看；一条都没命中时有明确的提示与退出码。

## Why

- 现在只有 `list`，笔记攒到几百条后靠翻页找目标笔记，成本已经不可接受。
- 有了 `search`，定位一条笔记从「翻几屏」变成「敲一个词」。

## Read First

- `docs/goal-contracts/2026-08-07-notes-cli-search-behavior.md`：用户逐行确认的行为对照表，示例数据集、四个场景的逐字期望输出、以及不变清单都在这里，验收数据一律取自它
- `fixtures/notes-cli/notes.py`：现有子命令、表格渲染与退出码惯例
- `fixtures/notes-cli/README.md`：面向用户的命令说明

## Scope

- In: 在 `fixtures/notes-cli/notes.py` 新增 `search` 子命令，按关键词对笔记的标题与正文做不区分大小写的字面子串匹配，命中结果用 `list` 现有表格格式输出，`--all` 控制是否包含已归档笔记，并同步更新 README 与命令帮助。
- Out: 不做标签匹配、正则匹配、模糊匹配、结果排序选项、搜索历史、正文片段摘要与关键词高亮；不改动 `add` / `list` / `archive` / `delete` 的任何现有行为；不引入第三方依赖或测试框架。

## Deliverables

- D-01: fixtures/notes-cli/testdata/search-golden-notes.json: 黄金用例输入数据集，逐字段取自行为对照表的「示例数据集」6 条笔记，不得自行增删改条目
- D-02: fixtures/notes-cli/testdata/search-golden-expected.txt: 四个场景的期望 stdout 与退出码，按场景分块并标注对应命令，内容逐字节取自行为对照表的四个场景

## Success Criteria

- AC-01: 以 D-01 为数据文件执行 `python notes.py search deploy`，退出码 0，stdout 是 `list` 同格式表格且只含笔记 1 和 2（标题命中允许大小写不同，正文命中同样算数），已归档的 4 与仅标签命中的 3 不出现。
  - Verify: [B] 用 `fixtures/notes-cli/testdata/search-golden-notes.json` 跑该命令，stdout 与 `fixtures/notes-cli/testdata/search-golden-expected.txt` 中「场景 1」块逐字节一致，退出码 0
- AC-02: 以 D-01 执行 `python notes.py search a.c`，退出码 0，结果只有笔记 5，笔记 6 不出现——关键词里的 `.` 按普通字符匹配，不作为正则元字符。
  - Verify: [B] 用 `fixtures/notes-cli/testdata/search-golden-notes.json` 跑该命令，stdout 与 `fixtures/notes-cli/testdata/search-golden-expected.txt` 中「场景 3」块逐字节一致，退出码 0
- AC-03: 以 D-01 执行 `python notes.py search deploy --all`，退出码 0，结果在 AC-01 的基础上多出已归档的笔记 4，顺序仍按 id 升序。
  - Verify: [B] 用 `fixtures/notes-cli/testdata/search-golden-notes.json` 跑该命令，stdout 与 `fixtures/notes-cli/testdata/search-golden-expected.txt` 中「场景 2」块逐字节一致，退出码 0
- AC-04: 以 D-01 执行 `python notes.py search kubernetes`，stdout 只有一行 `no notes matched "kubernetes"`、不打印表头、stderr 为空，退出码 0。
  - Verify: [B] 用 `fixtures/notes-cli/testdata/search-golden-notes.json` 跑该命令，stdout 与 `fixtures/notes-cli/testdata/search-golden-expected.txt` 中「场景 4」块逐字节一致，退出码 0
- AC-05: 行为对照表「不变清单」里的每一行在改动后仍然成立：`add` / `list` / `list --all` / 空库 `list` / `archive` 成功与未找到 / `delete` 未找到的输出、退出码、以及 `notes.json` 的字段与写盘格式都与改动前逐字一致。
  - Verify: [C] 按 `docs/goal-contracts/2026-08-07-notes-cli-search-behavior.md` 不变清单逐行执行对应命令 → 实际输出、stderr 与退出码与该行记载完全一致
- AC-06: `python notes.py search --help` 与 `fixtures/notes-cli/README.md` 都写明 `search` 的用法和 `--all` 的语义（默认不含归档笔记）。
  - Verify: [D] `fixtures/notes-cli/README.md` 命令列表含 search 与 --all 说明；`fixtures/notes-cli/notes.py` 顶部 docstring 的用法块含一行 search 示例

## Constraints

- 行为对照表的「不变清单」是硬约束：`add` / `list` / `archive` / `delete` 的参数、stdout、stderr 与退出码一个都不能变。
- `notes.json` 的字段名、结构与写盘格式保持原样，不新增字段、不做迁移。
- 只用 Python 标准库，不引入第三方依赖、不引入测试框架、不新增依赖声明文件。
- 搜索结果复用 `list` 的表头与列宽渲染；表格按字符数填充导致的中文视觉错位是既有行为，保持不变，不顺手修。
- 结果顺序沿用 `list` 的存储顺序（id 升序），不提供排序开关。
- 已确认的行为对照表和落盘后的 D-01 / D-02 是判据，不是可调整的实现细节。

## Agent Mandate

- May decide: 在 `fixtures/notes-cli/notes.py` 内部如何组织匹配与渲染代码（是否抽公共 helper、用 lower 还是 casefold）、`search` 位置参数的内部命名、按 D-01/D-02 写一个仅用标准库的比对脚本来跑黄金用例、更新 README 与 docstring 的措辞。
- Must ask: 需要改动 Goal、Scope、Success Criteria、Constraints，或需要改 `notes.json` 结构、引入依赖、改动其它四个子命令时。
- Must not: 修改 `docs/goal-contracts/2026-08-07-notes-cli-search-behavior.md`；落盘后再改 D-01 / D-02 的期望值来迁就实现；改动 `add` / `list` / `archive` / `delete` 的可观察行为；擅自扩大范围加排序、高亮、模糊匹配或搜索历史；git push 或删除仓库文件；停在分析或计划阶段；回来问仓库里查得到的事实；在没有逐条新鲜证据的情况下宣称完成。

## Iteration Strategy

先落盘 D-01 / D-02 并确认四个场景的期望输出，再实现 `search`，最后逐条跑不变清单。

## Completion

- Evidence: All Success Criteria are satisfied; every Verify line passes with fresh, reproducible evidence from the current worktree.
- Quality: 行为对照表不变清单逐行复核通过；最终 diff 已 review，在不改变行为的前提下 simplify。
- Final report: docs/goal-contracts/2026-08-07-notes-cli-search-report.md: 逐条列出 AC 与其 Verify 证据（命令、实际输出、退出码）、改动文件清单与剩余风险。

## Blockers

- None.
