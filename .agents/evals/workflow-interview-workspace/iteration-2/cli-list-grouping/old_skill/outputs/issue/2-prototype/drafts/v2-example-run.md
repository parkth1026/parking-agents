<!-- draft v2 | published 2026-08-13T00:20:00Z
     用户意见：v1 两条——分组标题行要清楚标出 stage 名字和数量；0 命中不能空输出，要明确提示
     状态：confirmed -->

# 可执行示例: 2026-08-13-cli-list-grouping (draft v2)

## 场景 1 — 现有用法，必须逐字节不变

```
$ node .claude/skills/workflow-interview/scripts/session.mjs list
2026-08-13-cli-list-grouping                                 1-interview  in_progress  session.mjs 的 list 命令现在把所有 issue 摊平打印成一张
2026-08-13-insight-report-facet-filter                       1-interview  in_progress
2026-08-13-workflow-interview-mid-flight-requirement-change  1-interview  in_progress  帮我给 workflow-interview 加个功能，允许用户中途改需求。
```
退出码 0。这段输出是仓库外那个 PowerShell 脚本按固定列宽/列序解析的对象，字节级不许变。

## 场景 2 — 按 stage 分组

```
$ node .claude/skills/workflow-interview/scripts/session.mjs list --stage 1-interview
== 1-interview (3) ==
2026-08-13-cli-list-grouping                                 in_progress  session.mjs 的 list 命令现在把所有 issue 摊平打印成一张
2026-08-13-insight-report-facet-filter                       in_progress
2026-08-13-workflow-interview-mid-flight-requirement-change  in_progress  帮我给 workflow-interview 加个功能，允许用户中途改需求。
```
退出码 0。分组视图下 stage 列从每行里去掉（已经在标题里了），status 列保留。

## 场景 3 — 按状态筛选，跨多个 stage 命中

```
$ node .claude/skills/workflow-interview/scripts/session.mjs list --status in_progress
== 1-interview (2) ==
2026-08-13-cli-list-grouping                                 in_progress  session.mjs 的 list 命令现在把所有 issue 摊平打印成一张
2026-08-13-insight-report-facet-filter                       in_progress

== 2-prototype (1) ==
2026-01-05-some-other-issue                                  in_progress  之前某个已经在对照物阶段的例子
```
退出码 0。组的出场顺序固定按 STAGES 常量（1-interview → 2-prototype → 3-contract），不是按命中数或字母序；`ready` 状态的组即使存在也整组不出现（不是打印空表格）。

## 场景 4 — 筛选组合命中 0 条

```
$ node .claude/skills/workflow-interview/scripts/session.mjs list --stage 3-contract --status in_progress
没有匹配项（--stage=3-contract --status=in_progress）。
```
退出码 0（这不是错误，是正常的空结果）。

## 场景 5 — 单独一个 flag 命中 0 条

```
$ node .claude/skills/workflow-interview/scripts/session.mjs list --stage 2-prototype
没有匹配项（--stage=2-prototype）。
```
退出码 0。提示文案只带用户实际传的那几个 flag，不带没传的那个。

## 场景 6 — 非法 stage 值

```
$ node .claude/skills/workflow-interview/scripts/session.mjs list --stage not-a-stage
session: 阶段名必须是 1-interview / 2-prototype / 3-contract
```
退出码 2。

## 场景 7 — 非法 status 值

```
$ node .claude/skills/workflow-interview/scripts/session.mjs list --status bogus
session: --status 必须是 in_progress / ready
```
退出码 2。
