<!-- 确认版·锁定 | 用户确认：2026-08-23T02:05:00+08:00 | 执行 Agent 改的是产品，不是这份对照物 -->

# 可执行示例: 2026-08-23-worktree-board

写死的示例输出，不连真实系统。报文结构一律见 `api-mock.md`，此处只写「怎么用、看到什么」。
`<skill>` = `.claude/skills/aes-worktree-board`。

## 场景 1：巡检采集（CLI）

```
$ node <skill>/scripts/collect.mjs
图谱: 61 issue (17 OPEN / 44 CLOSED) · frontier 6 · 依赖边 14 · ⚠回归 1
aes-agents-v2-dev1  aes-agents-v2-dev1@f0172225  +0/-0  dirty:0+0?   未在场      merge:up-to-date
aes-agents-v2-dev2  aes-agents-v2-dev2@f0172225  +0/-0  dirty:2+0?   未在场      merge:up-to-date
aes-agents-v2-dev3  aes-agents-v2-dev3@f6d9a1e6  +0/-6  dirty:16+15? 未在场      merge:up-to-date
aes-agents-v2-dev4  aes-agents-v2-dev4@45700c9c  +0/-5  dirty:4+1?   #58 手动推进 merge:up-to-date
aes-agents-v2-dev5  aes-agents-v2-dev5@6bd40b2e  +1/-6  dirty:0+0?   #41 运行中   merge:clean · not-yet: issue #41 仍 OPEN

已写入 <skill>/runtime/status.json
```

退出码：0 成功；gh 不可用时 issue 标 UNKNOWN 仍退 0（`--no-gh` 显式跳过）；git 异常退 1。

## 场景 2：主仓对话巡检（skill 输出样例）

```
| 队员 | 位置 | 当前任务 | 完成 | 合并建议 |
| dev1 | 未在场 | 空闲 | — | not-yet（空闲） |
| dev3 | 未在场 | 31 个未提交文件，进展不明 | ? | not-yet（先弄清现场） |
| dev4 | #58 ✋手动推进 | 报告排版（评估已过期） | ? | not-yet（以现场为准） |
| dev5 | #41 ▶运行中 | 修复访谈跳确认问题 | 未 | not-yet（#41 仍 OPEN） |

frontier 可开工：#62 #57 #18 #60 #63 #56 —— 空闲队员：dev1 dev2 dev3
```

## 场景 3：派发（干净 worktree，与 v1 逐字节一致）

```
$ node <skill>/scripts/dispatch.mjs dev5 --agent claude "按 #41 验收清单补交互测试，完成后提交并在 commit message 带 (#41)"
{"ok":true,"taskId":"dev5-20260823101530","worktree":"aes-agents-v2-dev5","pid":141001,"log":"<skill>/runtime/tasks/dev5-20260823101530.log"}
…任务结束时…
{"ok":true,"taskId":"dev5-20260823101530","exitCode":0,"log":"<skill>/runtime/tasks/dev5-20260823101530.log"}
```

## 场景 4：派发撞 dirty（对话样态）

```
用户: 让 dev3 把 lint 修了
主agent: dev3 现有 16 处改动 + 15 个未跟踪文件——可能是你上次会话留的现场。仍要派发吗？
        （回「派」即执行；或者我先派只读侦查弄清这些改动是什么）
用户: 派
主agent: 已派发 dev3-20260823102200，完成后我会汇报。
```

CLI 直派同样拦截：`dispatch.mjs` 对 dirty 目标默认拒绝并提示加 `--confirm-dirty` 重试。

## 场景 5：v1 冒烟保活（不变行为）

这条现在能跑，改完之后必须同样能跑（仅路径前缀变化）：

```
$ node <skill>/scripts/dispatch.mjs dev1 --agent test "冒烟"
{"ok":true,"taskId":"dev1-…","worktree":"aes-agents-v2-dev1","pid":…,"log":"…"}
{"ok":true,"taskId":"dev1-…","exitCode":0,"log":"…"}
$ tail 日志 → [test-agent] prompt received: 冒烟 / [test-agent] done
```

## 场景 6：起看板

```
$ node <skill>/scripts/server.mjs
worktree 看板: http://127.0.0.1:8321/  （仅本机可访问）
```

无后端时双击 `<skill>/board.html` = 只读快照模式（读 runtime/status.js；Google Fonts 断网时退化系统字体）。
