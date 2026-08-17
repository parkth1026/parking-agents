<!-- draft v1 | published 2026-08-13T00:10:00Z
     用户意见：待收集
     状态：superseded by v2 -->

# 可执行示例: 2026-08-13-cli-list-grouping (draft v1)

## 场景 1 — 现有用法，必须逐字节不变

```
$ node .claude/skills/workflow-interview/scripts/session.mjs list
2026-08-13-cli-list-grouping                                 1-interview  in_progress  session.mjs 的 list 命令现在把所有 issue 摊平打印成一张
2026-08-13-insight-report-facet-filter                       1-interview  in_progress
2026-08-13-workflow-interview-mid-flight-requirement-change  1-interview  in_progress  帮我给 workflow-interview 加个功能，允许用户中途改需求。
```
退出码 0。

## 场景 2 — 按 stage 分组

```
$ node .claude/skills/workflow-interview/scripts/session.mjs list --stage 2-prototype
（该分组下的 issue 表）
```
退出码 0。

## 场景 3 — 按状态筛选

```
$ node .claude/skills/workflow-interview/scripts/session.mjs list --status in_progress
（每组内只保留 in_progress 的行）
```
退出码 0。

## 场景 4 — 非法 stage 值

```
$ node .claude/skills/workflow-interview/scripts/session.mjs list --stage not-a-stage
session: 阶段名必须是 1-interview / 2-prototype / 3-contract
```
退出码 2。
