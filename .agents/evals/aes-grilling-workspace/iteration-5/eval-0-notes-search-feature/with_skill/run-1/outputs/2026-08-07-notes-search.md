# Goal Contract: notes-cli 支持按关键词搜索笔记

- Status: Ready
- Target: fixtures/notes-cli
- Updated: 2026-08-07

## Goal

用户在 notes-cli 里输入一个关键词，就能直接得到标题或正文包含该关键词的笔记列表，不必再用 `list` 逐屏翻找几百条笔记。

## Why

- 笔记已积累几百条，`list` 只能全量输出，定位一条笔记要靠人眼翻页。
- 有了关键词定位，日常「我上次记的那条 docker 清理命令」这类回忆式查找变成一条命令的事。

## Read First

- fixtures/notes-cli/notes.py：现有 4 个子命令的实现与 `list` 的表格格式来源。
- docs/goal-contracts/2026-08-07-notes-search-mock.html：用户确认版输出对照 mock，含 6 个关键状态的期望终端输出与不变清单。

## Scope

- In: 为 notes-cli 新增 `search <关键词>` 子命令，含 `--all` 开关、标题与正文的大小写不敏感子串匹配、复用 `list` 表格的输出、无命中时的输出与退出码，以及覆盖这些行为的自动化测试。
- Out: 不做正则/通配符/模糊匹配、不做多关键词布尔组合、不做排序选项、不做关键词高亮或正文摘要、不做搜索历史、不搜索标签字段、不改动 `add` / `list` / `archive` / `delete` 的任何行为、不改 `notes.json` 的数据结构。

## Deliverables

- D-01: fixtures/notes-cli/tests/fixtures/notes_sample.json: 与确认版 mock 示例数据一致的 4 条合成笔记（含 1 条 archived），作为黄金用例输入。
- D-02: fixtures/notes-cli/tests/fixtures/expected_search_docker.txt: `search docker` 在上述输入下的期望 stdout 全文，逐字节为准。

## Success Criteria

- AC-01: `search <关键词>` 以不区分大小写的普通子串匹配标题与正文；标签字段不参与匹配，正则元字符按字面字符处理。
  - Verify: [A] `python -m pytest fixtures/notes-cli/tests -q` → 退出码 0；用例覆盖 mock 状态 1/2/3/4/6：`docker` 与 `DOCKER` 命中标题含 Docker 的笔记且结果相同、`kubectl` 命中仅正文含它的笔记、仅作为标签存在的 `work` 不命中、`.*` 不命中。
- AC-02: 默认只搜未归档笔记；带 `--all` 时归档笔记一并纳入结果，语义与 `list --all` 一致。
  - Verify: [A] `python -m pytest fixtures/notes-cli/tests -q` → 退出码 0；用例断言 `search docker` 只返回 id 1，`search docker --all` 返回 id 1 与 id 4。
- AC-03: 无命中时 stdout 只输出与 `list` 相同的表头，一行 `no notes matched: <关键词>` 写入 stderr，进程退出码为 0。
  - Verify: [A] `python -m pytest fixtures/notes-cli/tests -q` → 退出码 0；用例逐字符断言 stdout 表头、stderr 文案与退出码 0。
- AC-04: 命中结果的每一行与 `list` 的行格式逐字符一致（同样的列、列宽与创建时间截断方式）。
  - Verify: [B] `fixtures/notes-cli/tests/fixtures/notes_sample.json` 作为库内容执行 `search docker` → stdout 与 `fixtures/notes-cli/tests/fixtures/expected_search_docker.txt` 逐字节相同。

## Constraints

- `add` / `list` / `archive` / `delete` 的参数、输出文案、退出码与写库字段保持原样，包括 `archive` / `delete` 未找到时 stderr 报错并退出码 1。
- `notes.json` 的结构与字段不变，不新增索引或缓存字段。
- 表格沿用 `list` 现有实现的宽度写法（中文按字符数补空格），不顺手修正中文对齐缺陷。
- 仅使用 Python 标准库，不引入运行时第三方依赖（pytest 仅作开发期测试依赖）。
- 确认版 mock `docs/goal-contracts/2026-08-07-notes-search-mock.html` 是判定依据，不得修改。

## Agent Mandate

- May decide: 编辑 fixtures/notes-cli/notes.py 与 fixtures/notes-cli/README.md、在 fixtures/notes-cli/tests/ 下新增测试与 fixture 文件、选择测试内部隔离数据库路径的方式（如 monkeypatch 模块级 DB_PATH）、选择匹配的内部实现写法。
- Must ask: 需要改变 Goal、Scope、Success Criteria 或 Constraints 时；需要改动现有 4 个子命令的可观察行为时；需要引入第三方运行时依赖或执行删除、推送等不可逆操作时。
- Must not: 修改确认版 mock HTML、改动 `add` / `list` / `archive` / `delete` 的可观察行为、把标签纳入匹配、引入正则或模糊匹配、提交或推送、停在分析或计划阶段、就仓库里查得到的事实回来提问、无新鲜证据就宣称完成。

## Iteration Strategy

先按 mock 的 6 个状态写出失败测试，再实现 `search` 让它们逐个变绿，最后补黄金用例比对。

## Completion

- Evidence: All Success Criteria are satisfied; every Verify line passes with fresh, reproducible evidence from the current worktree.
- Quality: `python -m pytest fixtures/notes-cli/tests -q` 全绿；现有 4 个子命令手动抽查行为未变；最终 diff 已 review 并在不改变行为的前提下简化。
- Final report: docs/goal-contracts/2026-08-07-notes-search-report.md: 逐条 AC 对应 Verify 证据、改动文件清单与剩余风险。

## Blockers

- None.
