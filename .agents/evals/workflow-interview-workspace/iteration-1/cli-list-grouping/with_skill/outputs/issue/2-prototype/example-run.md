# Example Run: 2026-08-11-session-list-grouping

**确认版·锁定。** 执行 Agent 改的是产品，不是这份对照表。
用户确认：2026-08-11T11:50:00Z

字段结构（有没有列、列叫什么）以 `behavior.md` 为准，这里只写「怎么用、看到什么」。

## 场景 1（不变）：不加任何 flag，逐字节兼容现状

这是给用户本机那个 PowerShell 脚本兜底的场景，改完之后必须逐字节一样能跑。

```
$ node session.mjs list
2026-08-01-foo-bar                2-prototype  in_progress  加个批量导入按钮
2026-08-05-fix-timeout            3-contract   ready        超时重试次数改成可配置
2026-08-11-session-list-grouping  1-interview  in_progress  session.mjs 的 list 命令现在把所有 issue 摊平...
```
退出码 0。列宽、列顺序、排序方式（slug 字母序）、无提示语，与今天完全一样。

## 场景 2：`--group-by-stage`，按 stage 分组，标题带条数

```
$ node session.mjs list --group-by-stage
1-interview (1)
2026-08-11-session-list-grouping  in_progress  session.mjs 的 list 命令现在把所有 issue 摊平...

2-prototype (1)
2026-08-01-foo-bar  in_progress  加个批量导入按钮

3-contract (1)
2026-08-05-fix-timeout  ready  超时重试次数改成可配置
```

## 场景 3：`--stage 3-contract`，只看某个 stage

```
$ node session.mjs list --stage 3-contract
3-contract (1)
2026-08-05-fix-timeout  ready  超时重试次数改成可配置
```

## 场景 4：`--status in_progress`，只看当前阶段在推进中的

```
$ node session.mjs list --status in_progress
2026-08-01-foo-bar                加个批量导入按钮
2026-08-11-session-list-grouping  session.mjs 的 list 命令现在把所有 issue 摊平...
```

## 场景 5（边界值）：筛选命中 0 条，明确提示而不是空输出

```
$ node session.mjs list --status done
没有匹配项：--status done
```
退出码 0（这是一次成功的空查询）。

## 场景 6（边界值）：`--stage` 与 `--status` 同时给出，交集为空

```
$ node session.mjs list --stage 2-prototype --status needs_reinterview
没有匹配项：--stage 2-prototype --status needs_reinterview
```

## 场景 7（边界值）：非法 `--stage` 取值

```
$ node session.mjs list --stage not-a-real-stage
session: --stage 必须是 1-interview / 2-prototype / 3-contract 之一
```
退出码非 0。
