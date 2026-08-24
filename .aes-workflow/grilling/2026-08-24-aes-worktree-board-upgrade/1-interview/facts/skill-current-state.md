# Fact: skill-current-state

- 派遣问题：aes-worktree-board 技能的当前真源长什么样，与复盘报告描述的新协议漂移在哪里？
- 完成：2026-08-24T08:45:00Z（subagent 为只读模式，由宿主代写落盘）

## 查到的

| 事实 | 证据出处 |
| --- | --- |
| 真源目录：`SKILL.md`(96行)、`board.config.json`(11)、`board.html`(680)、`scripts/`(8 个 .mjs)、`fixtures/aes-agent-issues.json`(6425)、`runtime/`(未入库) | `.agents/skills/aes-worktree-board/` |
| 脚本角色/行数：`collect.mjs` 532（采集 git+gh issue，写 status.json/js）、`assess.mjs` 56（只写 assessment 字段）、`dispatch.mjs` 189（PID 锁+dirty 门+spawn agent+任务三件套）、`server.mjs` 194（127.0.0.1 HTTP，4 路由）、`selftest.mjs` 1241（7 个域）、`command.mjs` 32、`headless.mjs` 6、`capture-issues-fixture.mjs` 113 | 各文件首部注释 |
| worker 派发方式**仍是 dispatch.mjs + headless 子进程**，无 create_thread / 用户可见 Task | `SKILL.md:77`、`SKILL.md:81`、`SKILL.md:3`、`SKILL.md:85` |
| 合并边界仍是「只给合并建议，不执行 merge；不关闭 issue」 | `SKILL.md:24` |
| 状态文件选址：`AES_WORKTREE_BOARD_RUNTIME_DIR` > 目标仓根 `.aes-worktree-board/runtime/`；技能目录只放代码 | `SKILL.md:19`、`collect.mjs:18-22`、`assess.mjs:11-16` |
| 目标仓根 contract：`AES_WORKTREE_BOARD_REPO_ROOT` > 调用进程 cwd | `SKILL.md:17`、`collect.mjs:18` |
| 看板启动：LIVE `node scripts/server.mjs` + `http://127.0.0.1:8321/`；只读快照直接开 `board.html` | `SKILL.md:89-90`、`board.config.json`、`server.mjs:155-172` |
| server 路由：`GET /`、`GET /runtime/status.js`、`GET /api/status`、`POST /api/dispatch`、`GET /api/task/<id>` | `server.mjs:155-171` |
| **模型路由在 SKILL.md 中零记载**（无 Luna/Sol 字样）；agent 只有 claude/codex/test 三档命令模板 | grep 命中 0；`board.config.json:5-10` |
| status.json 顶层 schema：`schemaVersion`(=2)、`generatedAt`、`repo{...}`、`graph{issues[],edges[],stats}`、`worktrees[]`；board.html 硬校验 schemaVersion===2 | `collect.mjs:488`、`board.html:502` |
| 每 worktree 16 字段：`name,path,branch,head,headSubject,lastCommitAt,ahead,behind,dirty,mode,position,trail[],mergeCheck,assessment,activeTask,recentTasks[]` | `runtime/status.json` 实测 |
| `assessment` 仅 7 字段：`currentTask,done,merge(recommend/not-yet/blocked),reason,assessedAt,assessedBy,stale` —— 单一维度 verdict | `assess.mjs:44-52`、`SKILL.md:68-75` |
| **schema 中没有** lease、generation、事件 cursor/eventId、blockCount、phase/lastProgressAt、model、三维 verdict、状态机 state | grep `lease\|generation\|cursor\|blockCount\|registry\|create_thread` 全目录命中 0 |
| 复盘要求的新协议（Task Registry、事件 inbox+幂等、三维 verdict、15 态状态机、create_thread preflight、全局停止评估器、lease/generation、progress/stall、可解释模型路由、merge handler、board 展示状态机）在真源里一个字都没有 | 复盘 `:489-599`、流程骨架 `:601-638` |
| 遗留漂移物：技能目录内旧 `runtime/`（status.json 34KB repo=aes-agents-v2、status.js、orchestration-stop.json、空 tasks/）仍在原地，已 gitignore，#14 后代码不再往这写 | `.gitignore:17-19`、`git ls-files` |
| `orchestration-stop.json` 是**手写的、脱离 status.json 的第二套 schema**（schemaVersion:1，含 state/blockCount/nextAction），status.json 无对应字段——复盘 P2.2「单一事实源」问题已实体化 | `runtime/orchestration-stop.json:1-46` |
| 发布侧 `skills/` **没有** aes-worktree-board 副本，唯一真源是 `.agents/skills/` | `skills/` 目录、`git ls-files` |
| 已有 Issue 页面离线 fixture：`fixtures/aes-agent-issues.json`（508KB 全量），配 capture 刷新、`collect.mjs --no-gh --issues-fixture` 消费、`selftest.mjs fixture` 校验 | `SKILL.md:47-62`、commit `39c6a37` |
| selftest 7 个域：`collect / fixture / dispatch / server / repo-root / layout / windows-hide`；**无多智能体编排/事件回归域** | `selftest.mjs:1221-1229`、`SKILL.md:96` |
| 前置历史：`.aes-workflow/grilling/2026-08-23-worktree-board/` 已有上一版完整 interview/prototype/contract 档案 | `git ls-files` |

## 未知项

- Issue #5 当前内容与 SKILL.md 的一致性（另一分片已查）。
- `board.html` 680 行的完整渲染字段清单只抽查。
- 技能目录内遗留 `runtime/` 是否仍被任何代码路径读取（collect/assess/dispatch/server 已确认走 RUNTIME_DIR；selftest 未逐处扫）。
- `$HOME/.agents/skills/aes-worktree-board` junction 是否安装、指向何处。

## 没查的

- 未逐行 diff、未运行任何脚本或自检。
- 未进入 aes-agents-v2 及其 worktree 检查运行现场（属其他分片）。
- 未碰 manifest.json。
