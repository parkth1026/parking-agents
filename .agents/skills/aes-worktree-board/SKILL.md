---
name: aes-worktree-board
description: 在主仓巡检并调度同级既有 worktree：采集全仓 issue 星图与队员坐标、逐节点写入可信合并建议、派发 headless 任务并启动双视图看板。用户要查看所有 worktree 在做什么、全仓 issue/frontier、判断是否建议合并、向 dev worktree 派任务或打开 worktree 看板时使用。
---

# AES Worktree Board

把主仓对话作为判断与调度入口，把看板作为同一份事实的可视入口。脚本采集事实，主 agent 负责判断；两者只通过 `runtime/status.json` v2 汇合，页面不推导业务状态。

本仓开发侧活跃真源是 `.agents/skills/aes-worktree-board/`。PowerShell 中先解析用户级 junction；未安装 junction 时，把右侧替换为活跃真源的绝对路径：

```powershell
$skillDir = "$HOME/.agents/skills/aes-worktree-board"
$worker = "dev1"
```

运行脚本前，把当前目录切到要巡检的目标主仓。目标仓根按以下单一 contract 解析：`AES_WORKTREE_BOARD_REPO_ROOT`（显式覆盖）优先，否则使用调用进程的当前目录；skill 的安装目录永远不参与目标仓判定。server 启动 dispatch 时必须把已经解析的目标仓根继续传给子进程。

## 不可越过的边界

- 只操作 `git worktree list` 中与主仓同级的既有 worktree；不创建、不删除 worktree。
- 只给合并建议，不执行 merge；不关闭 issue。用户另行明确要求合并时，重新巡检后再进入仓库的合并流程。
- 保持同一 worktree 单任务 PID 锁。撞到 `LOCKED` 时报告 task id，不终止进程。
- headless 权限模板以 `board.config.json` 为准，不降级或改写用户确认的权限 flag。
- dirty worktree 必须先把修改数与未跟踪数复述给用户。只有用户确认后才带 `--confirm-dirty` 派发；该确认不能越过 PID 锁。

## 巡检与落盘

用户问全局状态、issue 星图、队员位置或合并建议时：

1. 在目标主仓运行 `node "$skillDir/scripts/collect.mjs"`。只有明确要快速沿用 issue 快照时才加 `--no-gh`。
2. 读取 `runtime/status.json`。对每个 worktree 检查任务记录、分支 ahead/behind、dirty、mergeCheck、关联 issue 与必要的 diff/测试证据；不要把脚本的事实字段当作完成判断。
3. 对每个节点运行：

   `node "$skillDir/scripts/assess.mjs" $worker --merge not-yet --done unknown --task "待确认任务" --reason "证据不足"`

4. 所有同级节点都完成本轮 assessment 后，输出：

   | 队员 | 位置 | 当前任务 | 完成 | 合并建议 |
   | --- | --- | --- | --- | --- |
   | devN | #N ▶运行中 / #N ✋手动推进 / 未在场 | 一句话任务或现场说明 | 是 / 未 / ? / — | recommend / not-yet / blocked（理由） |

   表后单独列出 `frontier 可开工：#… —— 空闲队员：dev…`；frontier 为空时明确写“无可开工项”。

### 合并建议口径

- `recommend` 需要：分支领先 main、merge-tree 无冲突、任务与 issue 验收已闭环、worktree 干净，并有对应测试或用户验收证据。
- `not-yet` 用于仍在执行、issue 仍 OPEN、证据不足、现场不明或需先同步的节点；reason 写清缺什么。
- `blocked` 只用于真实冲突或验收已明确 BLOCKED。
- 与 main 同步且没有任务的空闲节点写 `not-yet（空闲）`。
- 无 issue 的独立任务分支即使其他条件满足也最高为 `not-yet`，reason 必须写“需先补 issue”。`assess.mjs` 会守住这一下限。
- `assessment.stale=true` 表示评估早于最新 commit 或任务结束；必须重新判断，不能沿用旧建议。

## 派发 headless 任务

组织自包含 prompt：写明 issue、目标、范围、验收、禁止事项与交付证据。worktree 内 agent 看不到主仓对话。

- 干净目标：`node "$skillDir/scripts/dispatch.mjs" $worker --agent claude "实现已确认的 issue"`
- dirty 目标：先向用户报告 `modified + untracked` 并等待确认；确认后在原命令增加 `--confirm-dirty`。
- 很长的 prompt 使用 `--prompt-file <path>`。agent 可选值来自 `board.config.json`。

立即报告首行 JSON 的 taskId 与 log 路径。任务结束后读取三件套 `runtime/tasks/<id>.{json,log,prompt.txt}`，重跑巡检并更新 assessment。

## 看板

- LIVE：在目标主仓运行 `node "$skillDir/scripts/server.mjs"`，打开 `http://127.0.0.1:8321/`。页面可刷新、查看日志和派发。
- 只读快照：先巡检，再直接打开 `board.html`；页面读取 `runtime/status.js`，派发控件会降级为提示。

server 只能绑定 `127.0.0.1`。不要增加外部监听或把页面改成自行推导 `derived`、`mode`、`assessment.stale`。

## 自检

按改动域运行自检，例如 `node "$skillDir/scripts/selftest.mjs" repo-root`；其他域是 `collect`、`dispatch`、`server` 与 `layout`。`dispatch` 使用独立 Git fixture 验证 Windows 可执行解析、dirty 确认、PID 锁与 server → dispatch；`repo-root` 验证跨仓 collect、direct dispatch、server → dispatch 与非法目标路径。页面视觉与交互仍需用真实浏览器对照锁定的 mock 与 handoff，不能由自检替代。
