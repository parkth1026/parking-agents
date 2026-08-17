<!-- draft v1 | published 2026-08-13T00:20:00Z
     用户意见：分组标题行要清楚标出 stage 名字和数量；筛选命中 0 条不能什么都不打印，
     必须明确提示「没有匹配项」
     状态：superseded by v2 -->

# 可执行示例: 2026-08-13-cli-list-grouping

报文/行形态定义见 `behavior.md`，这里只写「怎么调、看到什么」。

## 场景 1：不变场景——不加参数，逐字节一样能跑

```
$ node .claude/skills/workflow-interview/scripts/session.mjs list
2026-08-13-cli-list-grouping              2-prototype  in_progress  session.mjs list 按 stage 分组展示 issue，并支持 
2026-08-13-insight-report-filter-ui       1-interview  in_progress  generate-insight-report.js 生成的报告现在是一份很长的
2026-08-13-mid-flight-requirement-change  1-interview  in_progress  帮我给 workflow-interview 加个功能，允许用户中途改需求。
```

这是当前真实跑出来的输出（用 `session.mjs list` 现场抓的），逐字节作为回归基准。改完之后
同样的目录状态下必须原样输出。

## 场景 2：按 stage 分组

```
$ node .claude/skills/workflow-interview/scripts/session.mjs list --group
## 1-interview (2)
2026-08-13-insight-report-filter-ui       in_progress  generate-insight-report.js 生成的报告现在是一份很长的
2026-08-13-mid-flight-requirement-change  in_progress  帮我给 workflow-interview 加个功能，允许用户中途改需求。

## 2-prototype (1)
2026-08-13-cli-list-grouping              in_progress  session.mjs list 按 stage 分组展示 issue，并支持 

## 3-contract (0)
（无）
```

组标题写清阶段名与该组条数；stage 列既然已经在标题里出现，组内每行不再重复打印它，
省下的宽度还给摘要列。

## 场景 3：只看某个 stage

```
$ node .claude/skills/workflow-interview/scripts/session.mjs list --stage 1-interview
2026-08-13-insight-report-filter-ui       1-interview  in_progress  generate-insight-report.js 生成的报告现在是一份很长的
2026-08-13-mid-flight-requirement-change  1-interview  in_progress  帮我给 workflow-interview 加个功能，允许用户中途改需求。
```

## 场景 4：只看 in_progress

```
$ node .claude/skills/workflow-interview/scripts/session.mjs list --status in_progress
2026-08-13-cli-list-grouping              2-prototype  in_progress  session.mjs list 按 stage 分组展示 issue，并支持 
2026-08-13-insight-report-filter-ui       1-interview  in_progress  generate-insight-report.js 生成的报告现在是一份很长的
2026-08-13-mid-flight-requirement-change  1-interview  in_progress  帮我给 workflow-interview 加个功能，允许用户中途改需求。
```

（此刻仓库里恰好三条都是 `in_progress`，筛选后和不筛一样；一旦有 issue 走到 `ready`，
它会从这份列表里消失。）

## 场景 5（边界）：命中 0 条

```
$ node .claude/skills/workflow-interview/scripts/session.mjs list --stage 3-contract
$
```

不打印任何 issue 行，退出码 0（这是「查得到但没有匹配」，不是错误）。

## 场景 6（边界）：非法 --stage 值

```
$ node .claude/skills/workflow-interview/scripts/session.mjs list --stage bogus
session: --stage 必须是 1-interview / 2-prototype / 3-contract 之一，现在是 "bogus"
$ echo $?
2
```
