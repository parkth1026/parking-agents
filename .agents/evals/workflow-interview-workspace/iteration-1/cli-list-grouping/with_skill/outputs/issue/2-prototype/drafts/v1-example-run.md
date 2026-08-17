<!-- draft v1 | published 2026-08-11T11:41:00Z
     用户意见：待收集
     状态：superseded by v2 -->

# Example Run: 2026-08-11-session-list-grouping (draft v1)

## 场景 1（不变）：不加任何 flag，逐字节兼容现状

```
$ node session.mjs list
2026-08-01-foo-bar        2-prototype  in_progress  加个批量导入按钮
2026-08-05-fix-timeout    3-contract   ready        超时重试次数改成可配置
2026-08-11-session-list-grouping  1-interview  in_progress  session.mjs 的 list 命令现在把所有 issue 摊平...
```
退出码 0。列宽、列顺序、排序方式（slug 字母序）与今天完全一样。

## 场景 2：`--group-by-stage`，按 stage 分组

```
$ node session.mjs list --group-by-stage
1-interview
2026-08-11-session-list-grouping  in_progress  session.mjs 的 list 命令现在把所有 issue 摊平...

2-prototype
2026-08-01-foo-bar  in_progress  加个批量导入按钮

3-contract
2026-08-05-fix-timeout  ready  超时重试次数改成可配置
```

## 场景 3：`--stage 3-contract`，只看某个 stage

```
$ node session.mjs list --stage 3-contract
2026-08-05-fix-timeout  ready  超时重试次数改成可配置
```

## 场景 4：`--status in_progress`，只看当前阶段在推进中的

```
$ node session.mjs list --status in_progress
2026-08-01-foo-bar                加个批量导入按钮
2026-08-11-session-list-grouping  session.mjs 的 list 命令现在把所有 issue 摊平...
```

## 场景 5：`--stage`/`--status` 都命中 0 条

```
$ node session.mjs list --stage 2-prototype --status needs_reinterview
$
```
（无输出，退出码 0）
