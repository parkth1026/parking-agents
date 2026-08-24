# Fact: issue-tracker

- 派遣问题：治理 Issue #5 现在记录了什么协议，issue tracker 上还有哪些与 aes-worktree-board 相关的 open/closed issue？
- 完成：2026-08-24（gh CLI 实时查询，仓库 parkth1026/parking-agents；由宿主代写落盘，subagent 为只读模式）

## 查到的

| 事实 | 证据出处 |
| --- | --- |
| #5「aes-worktree-board：改为 Orchestrator Agent + create_thread 的 Issue × Worktree 编排」为 OPEN，作者 piaotonghu，无 label、无 assignee、无 milestone | issues/5；`gh api repos/.../issues/5` |
| #5 **评论数 = 0**，全部协议在正文；正文 26777 字符；created 2026-08-23T17:42:35Z，updated 2026-08-23T19:29:20Z（正文被就地编辑追加） | `gh issue view 5 --comments` 返回空评论；`gh api .../issues/5` |
| #5 timeline 仅两条：18:08:04 parkth1026 renamed；19:35:55 piaotonghu cross-referenced（来自 #12） | `gh api .../issues/5/timeline` |
| 已固化协议（正文，非讨论）：create_thread 为正常执行单元；spawn_agent 是 Task 内 subagent、不得静默替代；codex exec/claude -p 仅作显式授权 cli-fallback | #5 正文「调度权威与 fallback」 |
| 已固化：executor ownership 阶段压缩——一个 executor Task 拥有 Issue 全闭环（实现→定向 QA→self-review→中文 scoped commit）；reviewer 必须独立、只读、不取 writer 锁；BLOCK 后 findings 经 send_message_to_thread 回原 executor 修复+follow-up commit，正常不新建 fix/commit Task；Orchestrator 只控三个外部门（Issue ownership、reviewer verdict、main merge 门禁） | #5 正文「Agent ownership 与阶段压缩」「角色与职责」 |
| 已固化：事件 fan-in——wait_threads 的 wake 只代表「第一个需处理的 Task」；必须消费同一次返回的全部 polls/changed targets；**每个 thread 独立 cursor**；用 phase/commitSha/verdict/cursor 做幂等；idle 必须先 read_thread + 核对 Git 才可解释为 completed/parked/blocked/needs-decision；五个 Task 不是 barrier | #5 正文「## Event fan-in 与逐项消费」（追加段） |
| 已固化：三次 BLOCK 熔断——独立 reviewer 对新 follow-up commit 的最终 BLOCK 才计数（重复读取/工具失败/测试环境故障/同 commit 重复 verdict 不计）；blockCount=1或2 回原 executor；blockCount=3 立即 handoff-required，停止自动修复、reviewer 重派与新 Task 创建，保留现场等人工交接；needs-decision/waiting-user/parked 不伪装成 BLOCK、不消耗 BLOCK 次数 | #5 正文「### BLOCK 熔断与全局停止」 |
| 已固化：全局停止——忽略 test worktree，当所有非 test worktree 处于 handoff-required/needs-decision/waiting-user/delivery-blocked/parked 且无可推进 Task、无干净空闲 worktree、无满足 merge 门禁节点时，写入全局 orchestration-stop、停止建 Task/派 Issue/merge、不强杀不 reset、停掉 wait_threads 挂机链并输出交接摘要 | #5 正文「### BLOCK 熔断与全局停止」 |
| 已固化：Listener 生命周期——wait_threads 是当前 turn 内的等待调用、不是常驻 daemon；无 live listener 时才由 heartbeat 作低频丢事件恢复，只消费已有 Task、不得重复创建；heartbeat 先检测 live listener；heartbeat 长期 PAUSED + turn 结束会造成假性停滞（配置错误） | #5 正文「### Listener 生命周期与恢复兜底」 |
| 已固化：模型两档——默认 gpt-5.6-luna + max；仅多未决设计决策/模糊主观验收/跨边界高风险/返工成本高时升 gpt-5.6-sol + high；窄范围机械审查用 Luna，架构/协议/竞态/主观 Spec 审查才用 Sol；创建时显式记录 model/thinking/modelReason；失败后按证据升级、不得无脑重试同配置 | #5 正文「模型路由」；验收条件「正常策略只保留 Luna Max 和 Sol High 两档」 |
| 已固化：interactionClass（autonomous / user-aligned）与队列规则；autonomous 五条证据闭环后可直接 merge，不等无关人工 UI 测试 | #5 正文「任务优先级与自主交付」 |
| 已固化：每 worktree 单写者逻辑锁（key=规范化 worktree identity，owner=taskKind+threadId/clientThreadId+hostId+projectId+issue+role），reviewer 不取锁；不按进程名/模糊路径杀进程 | #5 正文「每 worktree 单写者锁」 |
| 已固化：status.json 字段集（taskKind desktop-thread\|cli-fallback、threadId、clientThreadId、hostId、projectId、role、cursor、phase、commitSha、mergeBase/mergeTarget、qaEvidence、blocker 等）；真实 threadId 作身份与锁来源，不伪造 PID/agentId；v2 三件套兼容读取；页面只渲染不推导 | #5 正文「runtime/status.json 与任务记录」 |
| 已固化：15 个 phase 状态机 + append-only 状态历史 + 补充状态（testing/committing/stalled/delivery-blocked/needs-decision/parked） | #5 正文「状态机」「Worker 状态账本」「卡住、停放与长时间挂机」 |
| **结构缺口**：追加的三段（Event fan-in、BLOCK 熔断/全局停止、Listener 生命周期）排在「验收条件/非目标/交付物」之后，且验收条件中**没有**对应 cursor、blockCount、orchestration-stop、heartbeat 的可验条目 | #5 正文段落顺序；验收条件全文比对 |
| #5 全部约 33 条验收条件**均为未勾选 `- [ ]`** | #5 正文「验收条件」 |
| 相关 CLOSED：#3（skill 宿主目录误判为目标仓根）、#4（Windows headless 命令解析失败 + dispatch selftest 跨仓失焦），label 均 ready-for-agent | `gh issue list --search aes-worktree-board --state all` |
| #13「Windows headless/selftest 高频弹出 Node.js 控制台窗口」CLOSED，closedAt 2026-08-24T07:20:22Z，stateReason=COMPLETED | issues/13 |
| #14「runtime 巡检产物默认写入技能目录，多仓/多实例互相覆盖」CLOSED，closedAt 2026-08-24T08:06:10Z，stateReason=COMPLETED | issues/14 |
| 相关 OPEN 缺陷（均 needs-triage，2026-08-24 新建）：#22 server /api/dispatch 缺跨源防护（drive-by 派发 skip-permissions agent）、#23 同 worktree 单任务锁失效（TOCTOU 双派发 / PID 复用误判 + EPERM 口径矛盾）、#24 board.config.json 锚在技能目录、issueRepo/mainBranch 与目标仓错配（自述为 #14 输入侧）、#25 runtime 快照读写非原子且无互斥、torn read 静默抹掉全部 assessment | issues/22、23、24、25 |
| #12「Run strict worktree delivery loop for dev and dev2」OPEN，needs-triage，自述为 orchestrate-worktree-loop 的执行/协调记录，不替代产品 Issue；它 cross-reference 了 #5 | issues/12 |
| **本次升级改造的候选载体：#5 本身**，是唯一已建的 open 演进 issue；#22/#23/#24/#25 是可挂载其下的具体缺陷；#12 是协调记录不宜承载 | 交叉比对全量 issue 列表 |
| 仓库全量 issue 为 #1–#25；非 board 相关 open：#7~#11、#15、#18~#21；closed：#1、#2、#6、#16、#17 | `gh issue list --state all --limit 100` |
| 仓库现有 label 中**无 aes-worktree-board 专属 label**，检索只能靠标题关键词 | `gh label list` |

## 未知项

- #5 正文的具体编辑历史（哪几段何时追加）无法从 API 取得——只知 created 17:42:35 → updated 19:29:20 之间被改过，18:08 有一次 rename。
- #22/#23/#24/#25 的正文细节与验收条件未逐条读取（本次只取标题/状态/label）。
- #3/#4/#13/#14 关闭时对应的 commit / PR 证据未核验。
- 是否存在已合并但未在 issue 上留痕的 board 改动（未查 git log / PR 列表）。

## 没查的

- 未查 PR 列表与分支状态。
- 未读取 SKILL.md 现状与 #5 协议的实际落地差距（属其他派遣问题）。
- 未查 `.aes-workflow/grilling/` 下既有 issue 目录的原文。
- 未接触 manifest.json（按指令）。
