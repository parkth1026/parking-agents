# Goal Contract: notes-cli 新增关键词搜索子命令

- Status: Ready
- Target: G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\aes-grilling-workspace\fixtures\notes-cli\notes.py
- Updated: 2026-08-04

## Goal

用户可以运行 `python notes.py search 关键词`,工具以不区分大小写的子串匹配在笔记标题与正文中检索,命中的未归档笔记以 `list` 同款表格列出;附加 `--all` 时,已归档笔记也参与检索并显示;无匹配时输出明确提示并以退出码 0 结束。

## Why

- 笔记已积累几百条,靠 `list` 逐屏翻找定位一条笔记越来越费时。
- 有搜索后可按关键词直达目标笔记,已归档的旧笔记也能通过 `--all` 找回。

## Scope

- In: 在 notes.py 中新增 `search` 子命令:单关键词、大小写不敏感的子串匹配,匹配范围为 title 与 body;默认排除已归档笔记,`--all` 时包含;输出复用 `list` 的表格格式;无匹配时打印提示并以 0 退出。
- Out: 不匹配 tags;不做正则、模糊匹配、相关度排序、搜索历史或高亮摘要;不改动现有 add/list/archive/delete 的任何行为;不引入第三方依赖;不新增文件,数据仍存 notes.json。

## Success Criteria

- AC-01: 运行 `python notes.py search 关键词`,标题或正文包含该关键词的未归档笔记以 `list` 同款表格(ID/标题/标签/创建时间)列出,退出码 0。
- AC-02: 关键词仅出现在某未归档笔记的正文(body)中时,`search` 结果包含该笔记。
- AC-03: 匹配不区分大小写:用 `Meeting` 能搜到含 `meeting` 的笔记,用 `meeting` 也能搜到含 `Meeting` 的笔记。
- AC-04: 默认结果不含已归档笔记;`python notes.py search 关键词 --all` 时,匹配的已归档笔记也出现在结果中。
- AC-05: 无任何匹配时,stdout 输出一条明确的"无结果"提示,退出码为 0。
- AC-06: 关键词仅出现在某笔记的 tags 中(标题、正文均不含)时,该笔记不出现在 `search` 结果中。
- AC-07: `add` / `list` / `list --all` / `archive` / `delete` 在与改动前相同的输入下,输出与退出码与改动前完全一致。

## Constraints

- 现有 `add` / `list` / `archive` / `delete` 的输出与退出码必须保持不变。
- 保持单文件 `notes.py`、仅用 Python 标准库;`notes.json` 的数据结构不变。

## Agent Mandate

- May decide: Inspect the repository, choose reversible implementation details, edit code, add or update tests, review the final diff, and simplify without changing behavior.
- Must ask: Only when the Goal, Scope, Success Criteria, or Constraints must change, or when a destructive, credentialed, production, or otherwise unauthorized action is required.
- Must not: Stop at analysis or a plan, ask for discoverable repository facts, expand scope silently, or claim completion without fresh evidence for every AC.

## Completion

- Evidence: 逐条 AC 附可复现实测证据:在包含未归档/已归档、大小写差异、仅 tags 命中等样本的临时 notes.json 上运行真实命令并记录输出与退出码。
- Quality: 仓库无既有测试;至少对全部六个子命令做一轮命令行冒烟验证,最终 diff 经 review 并在不改变行为的前提下简化。
- Final report: 逐条 AC 对应证据,列出改动文件与剩余风险。

## Blockers

- None.
