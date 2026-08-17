# 可执行示例: 2026-08-13-workflow-interview-mid-flight-requirement-change

**确认版·锁定。** 执行 Agent 改的是产品，不是这份示例。
用户确认：2026-08-13T00:30:00Z

## 场景 1：finalize 前中途加一条 AC（对应 behavior.md #1）

不新增命令。就是 `aes-goal-contract` 第 2 步本来的迭代：

```text
$ node .claude/skills/workflow-interview/scripts/session.mjs round <issue-dir> \
    '{"stage":"3-contract","tier":"ask","q_id":"AC-00X","question":"..."}'
appended → <issue-dir>/1-interview/rounds.jsonl
```

不触发 `needs_reinterview`，`manifest.stage` 全程停在 `3-contract`。

## 场景 2：finalize 之后（`ready`）重开 3-contract（对应 behavior.md #2）

这是这次改动新增文档说明、但复用的是已经存在的命令。下面是对一个真实 fixture 目录
跑出来的原始终端输出（在本仓库 `C:\wt\old` 下执行，`repoRoot()` 自动定位到仓库根）：

```text
$ node .claude/skills/workflow-interview/scripts/session.mjs init verify-fixture-amend
dir:   C:\wt\old\.aes-workflow\grilling\verify-fixture-amend
slug:  verify-fixture-amend
stage: 1-interview  (新建)
  1-interview: pending
  2-prototype: pending
  3-contract: pending
next:  跑 /aes-interview 调查事实并批量问清歧义。

$ node .claude/skills/workflow-interview/scripts/session.mjs stage \
    .aes-workflow/grilling/verify-fixture-amend 3-contract done
3-contract → done；当前阶段 1-interview
next: 跑 /aes-interview 调查事实并批量问清歧义。

$ node .claude/skills/workflow-interview/scripts/session.mjs stage \
    .aes-workflow/grilling/verify-fixture-amend 3-contract in_progress
3-contract → in_progress；当前阶段 3-contract
next: 跑 /aes-interview 调查事实并批量问清歧义。

$ echo EXIT:$?
EXIT:0
```

`3-contract` 从 `done` 被成功拉回 `in_progress`，`manifest.stage` 跟着回到 `3-contract`，
退出码 0——不需要任何新脚本命令。重开之后按场景 1 改 `contract.md`，改完重新跑：

```text
$ node .claude/skills/workflow-interview/scripts/session.mjs finalize <issue-dir>
```

必须重新跑 finalize 才能再次拿到有效的交接指令（这是 1-interview 默认区 D2 定下的）。

## 必须保持不变的现有用法

```text
$ node .claude/skills/workflow-interview/scripts/session.mjs stage <issue-dir> 2-prototype needs_reinterview \
    --reason "扫不出可观察差异"
```

这条命令的行为这次完全不变：子技能撞出新歧义时仍然报 `needs_reinterview`，仍然强制打回
`1-interview`。「中途改需求」是一条新增的、更轻的平行路径，不替换它，也不改它的触发条件。
