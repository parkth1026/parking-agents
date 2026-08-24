# Fact: runtime-state

- 派遣问题：aes-worktree-board 的运行态状态文件现在实际长什么样，两个控制面（主仓 runtime 与用户目录 runtime）各存了什么，复盘提到的字段矛盾样本是否还在？
- 完成：2026-08-24T16:40+08:00（subagent 为只读模式，由宿主代写落盘）

## 查到的

| 事实 | 证据出处 |
| --- | --- |
| **「两个控制面」其实是同一目录**：`C:\Users\parking\.agents\skills\aes-worktree-board` 是指向主仓同名目录的 NTFS JUNCTION，两侧文件完全同一份 | `dir /AL C:\Users\parking\.agents\skills` |
| 旧 runtime（技能目录）现有 4 项：status.json(34488B)、status.js、orchestration-stop.json(1416B)、空 tasks/ | ls 实测 |
| status.json：schemaVersion=2、generatedAt=2026-08-24T03:21:22Z、repo.root=aes-agents-v2、issueRepo=51world-ai-copilot/aes-agent、graph{issues:65,edges:36,stats{open:21,frontier:13,warned:1}}、worktrees[6] | 文件实测 |
| 时间戳格式不统一：generatedAt 为 UTC ISO(Z)，lastCommitAt 为本地带偏移(+08:00)，assessedAt 为 UTC ISO | 同上 |
| **复盘的 dev4 矛盾样本已不在当前文件**：6 个 worktree 的 assessment/activeTask 全 null、recentTasks 全空；`not-yet` 全文 0 次 | grep 实测 |
| 矛盾样本只在 git 历史：`ad28897`/`d78863a` 两版含 not-yet；ad28897 版 dev4 `currentTask` 写 #17 而 `position.issue=35`，互相矛盾；复盘原文那条（currentTask=已合并 main + merge=not-yet）在任何提交里都找不到，只存在于当时工作副本，已被覆盖 | 逐版 `git show <c>:...status.json` grep |
| orchestration-stop.json：schemaVersion=1、recordedAt=2026-08-23T23:37:20Z（无毫秒，格式又不同）、repo 是字符串非对象、worktree 条目字段 `{name,issue,state,blockCount,nextAction}` 与 status.json 除 name 外**零重叠** | 文件实测 |
| orchestration-stop 记录：dev1/#56、dev2/#57 handoff-required blockCount=3；dev3/#14、dev5/#41 parked；dev4/#17 merged；test 未列入 | 同上 |
| **orchestration-stop.json 脱离代码闭环**：全仓脚本零引用（只有 markdown 提到），是 agent 手写账本 | 全仓 grep |
| f2fa0d2 改动：DEFAULT_RUNTIME_DIR 从技能目录改为 `<REPO_ROOT>/.aes-worktree-board/runtime/`（REPO_ROOT=env 或 process.cwd()）；assess.mjs 改为从 collect.mjs import RUNTIME_DIR；旧 status.json/js 出库并进 .gitignore | `git show f2fa0d2` |
| **真正的分裂是新旧选址并存**：技能目录旧 runtime（aes-agents-v2 的 03:21 快照+手写 stop 账本）与新生成的 `parking-agents\.aes-worktree-board\runtime\`（16:05，在 parking-agents 里跑 collect 采到的是 parking-agents 自己，issues 空、worktrees 是 parking-agents-dev/dev2）并存；**目标仓 aes-agents-v2 下至今没有 `.aes-worktree-board\`**——新选址从未在目标仓落盘 | 三处目录 ls + status.json 内容 |
| parking-agents 那份 runtime 里 assessment 结构仍在用（parking-agents-dev 有一条 merge:"not-yet" 的活 assessment） | 文件实测 |
| 目标仓布局：主仓 aes-agents-v2 checkout 在 `dev`（与 main 同为 6d3713b9），6 个同级 worktree dev1~dev5/test，外加一个 Temp 下 detached 的 clean-check | `git worktree list` |
| 实时 ahead/behind/dirty：dev1 behind3 ahead2/16 modified；dev2 behind3 ahead3/clean；dev3 behind10/24 modified+16 untracked；dev4 behind8/1 untracked；dev5 behind10 ahead1/33 modified+1 untracked；test behind3/clean | 逐仓 git 实测 |
| 实时 Git 事实与 03:21 快照的 ahead/behind/dirty 完全一致——快照 13 小时未刷新但事实字段未过期，唯一变化是 assessment 全空 | 对比 |

## 未知项

- 03:21 那次 collect 为何把 assessment 全写成 null：collect.mjs 有 loadPrevious 承接逻辑（`collect.mjs:120-122,383`），但没保住 ad28897 版的 assessment——承接失效还是 runtimeDir 指向别处，未验证。
- derived.status/warn、stats.warned=1 对应哪条规则/哪个 issue，未定位。
- assessment.stale 置位规则、mode 取值域（观察到 manual/idle）未确认。
- 技能目录旧 runtime 是有意留档还是无人回收的残留，无文档交代回收路径。
- `C:\Users\parking\.agents\skills` junction 由谁何时建立（目录时间戳 2026/08/23 23:45），未查安装链路。

## 没查的

- status.js 与 status.json 的全量 diff（已确认是同 payload 的 window.WORKBOARD 包装）。
- board.html/server.mjs 对 assessment=null 的渲染降级行为。
- `.requests` prompt 暂存与 PID 锁文件的生成时机（当前两处 runtime 都没有）。
- 各 worktree dirty 的具体内容。
- GitHub 侧 #14/#17/#41/#56/#57 的当前状态（属其他分片）。
