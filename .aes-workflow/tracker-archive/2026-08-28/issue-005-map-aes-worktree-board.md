# Issue #5 — aes-worktree-board: Issue × Worktree 编排技能持续维护
label: wayfinder:map  |  state: OPEN  |  抢救时间: 2026-08-28（账号失效前读取）

<!-- WAYFINDER-CONTROL-PLANE-2026-08-24 --><!-- 历史标记保留：P0 轮的正文规格、状态机与验收清单见本票 2026-08-28 之前的编辑历史（GitHub 保留全部版本）；当前设计真源 = .agents/skills/aes-worktree-board/SKILL.md + references/design.md -->

## Destination

aes-worktree-board 作为 Master 控制面（master.mjs、registry、merge gate、slot 租约）在真实宿主上把 Issue × Worktree 交付回路跑通并持续硬化。v7 拓扑（#83 定稿）：worker / aes-merge-worker（待建，#94）/ 人参与 lane 平级挂总管，一切交接经 registry；脚本只做 collect/record/lock/validate/render，调度权威是编排 Agent。

## Notes

- **执行纳入 map**（长期开发模式）：本图同时收决策票与执行票，不随单轮收口关闭；全部子票（含 backlog）闭合后由人工确认关闭。
- **硬化立票门槛（长期原则，#70 裁定）**：新硬化/防御票开工前须引用「该失败在真实宿主发生过或有可信类比」的证据，写不出继续排后。
- 语言：中文；issue 标题以 `aes-worktree-board:` 前缀标识归属（[backlog] 等标记放技能名后）。
- 架构档案：复盘 `docs/retrospectives/aes-worktree-board-multi-agent-orchestration-retrospective-2026-08-24.md`；契约 `.aes-workflow/grilling/2026-08-25-aes-worktree-board-session-evolution/`；MW2 钢人反思 `G:\GIT\AI_WorkFlow\mw2-agent复盘对aes-worktree-board的钢人反思-20260826.md`；#70 裁定档案 `.aes-workflow/grilling/2026-08-28-issue70-loop-first-ruling/`。
- 控制面协议基线（registry 真源 / transitions·inbox append-only / 幂等消费 / 三维 verdict / BLOCK 熔断 / heartbeat 边界）真源在 SKILL.md 与 references/design.md，此处不重述。

## Decisions so far

- 2026-08-24 范围裁决：本轮只实现 P0 六项 + 控制面 bug（#22/#24）；P1/P2 建票不做（#35–#40 backlog）。headless 保留为显式授权 cli-fallback；status.json 升 v3 且 v2 兼容读取；技能目录旧 runtime 归档不删。
- 2026-08-24 看板强约束：星图设计语言（`docs/design/design_handoff_issue_starmap`）零变化，控制面信息只走确认版 mock 六挂点；双视图切换文案「Map / List」。
- 2026-08-24 历史散票收编：#3 宿主目录误判目标仓根（339b4d9）、#4 Windows headless 解析（339b4d9）、#13 控制台窗口弹出（25aa177）、#14 巡检产物落目标仓（f2fa0d2）、#43 显式 Goal 连续编排闭环（6b81013）、#44 live board 锚错图谱（2f2cc5d）、#45 多账号 gh 身份（81afa92）；#23→#27、#25→#26 收编关闭。
- 2026-08-25 [runtime v3 schema 与原子读写互斥（收编 #25）（#26）](https://github.com/parkth1026/parking-agents/issues/26)：tmp+rename + 互斥锁；4 进程并发零 torn read 零丢写。
- 2026-08-25 [Task Registry、worktree 租约与 generation（收编 #23）（#27）](https://github.com/parkth1026/parking-agents/issues/27)：createTask 单锁临界区原子登记；判活只看 owner+generation+心跳 mtime，不查 PID。
- 2026-08-25 [事件 inbox 与 consume/pending 幂等消费（#28）](https://github.com/parkth1026/parking-agents/issues/28)：wake+polls 全量入箱、每 thread 独立 cursor、duplicate eventId already-consumed 零状态变化。
- 2026-08-25 [三维 verdict、15 态状态机与三次 BLOCK 熔断（#29）](https://github.com/parkth1026/parking-agents/issues/29)：NOT_RUN 不改写；只对新 follow-up commit 计数且同 commit 同 verdict 去重；第三次 BLOCK 转 handoff-required + LANE_CLOSED。
- 2026-08-25 [create_thread preflight 与 cli-fallback 显式授权（#30）](https://github.com/parkth1026/parking-agents/issues/30)：thread-id/client-thread-id 双门判 desktop-thread；未授权 fallback 双层门退 2 且 registry 零落账。
- 2026-08-25 [全局停止评估器 stop eval（#31）](https://github.com/parkth1026/parking-agents/issues/31)：无可推进线路 --write 落 stopped；stopped 后 collect 承接不改写；ORCHESTRATION_STOPPED 拒新建。
- 2026-08-25 [server /api/dispatch 跨源防护（#22）](https://github.com/parkth1026/parking-agents/issues/22)：随机 token 门 + Host 白名单 + Origin 同源九向量实测，两攻击链终点不可达。
- 2026-08-26 目标 A 无人值守控制面收口（交付 #51/#52/#53，回填 #59/#60/#61）：新增 runner/job/attempt 分层与 Master 重启 reconcile；核心判据「registry 记意图、Git 记事实」（merge 前落 mergeIntent，重启后以 `git merge-base --is-ancestor` 问 Git，不信可能没写完的状态位）；v3 runtime 只读封存，v4 走独立 registry。
- 2026-08-26 700×1000 竖屏工作台：build-portrait.mjs 从确认版 mock 机械生成 + shadow root 隔离，逐像素 0 差异，桌面星图零改动。
- 2026-08-26 AC-007 live 门抓到三类离线门结构性盲区（真源 SHA 绑工作区字节 / 生成器 CRLF 锚点 / receipt 进版本控制目录）——「live 门不可省」的实证。
- 2026-08-26 过程失误两条已修正登记：DISCOVERED_WORK 回流机制零使用（直接改掉无 Issue 轨迹 → 回填 #59–#62）；live receipt 把 3 次 merge 写成 23 次（数了整条分支历史 → 按 job 反查）。
- 2026-08-27 v7 流程重梳落地（#83，dev `1126794` + 修正 `0e4ec20`）：hub-and-spoke 三 lane 定稿；「Master host 兼任合并」废止，合并验收归待建的 aes-merge-worker（#94）；#62/#64/#65 已关票交付（stage-result v2 强制 baseCommit/reviewerSessionId、receipt 目录修址、reviewerIndependence 机械推导）。
- 2026-08-28 #38 收编并入 #94：merge 门禁机械检查（ancestry/冲突、无 unrelated changes、mergeCommit 写回、worktree 刷新）归 master.mjs 机械层、编排归 #94 管线；#77 问题二（gate 缺 commit 血统校验）实现落点同收敛 #94 单点。
- 2026-08-28 [下一轮投入裁定——先证明回路再加装甲（#70）](https://github.com/parkth1026/parking-agents/issues/70)：**修改后采纳**。下一轮入口 = 回路证明轮，混合三段串行（#98 人工顶替证伪段 → #94 merge-worker 落地 → #66 完整轮，含刻意触发 high 档 humanGate + token/Issue 成本锚点自采）；行为防御（#35/#39）不预建、实测反哺后再定提级；「硬化票后置」泛化为长期立票门槛（入 Notes）；已建装甲（worktree/registry/证据链/merge gate）不减。

## Not yet specified

- 证据失效第三层（环境层：QA environment 变化是否使 QaReceipt 失效）尚未想清楚。
- hermetic 档速度是治理变量（全量回归时长决定串行 merge 队列长度）；加速方向已知（scenario 并行、模板仓复制、Chromium 复用、统一调度并发度）但未立票、归属待裁。
- 轻拓扑快车道：#70 已裁采纳；剩余条件 = 回路证明轮（#66）实测合并冲突率 ≈0，成立则评估为机械正交任务族开「快车道」变体——届时才立票。
- #35/#39 的提级与否挂回路证明轮实测：证明轮采集的 stall/wake 摩擦逐例记录是它们的开工证据（#70 裁定）；#35 开工时 phase 枚举按 v7 闭环词汇重定义。
- check-issue-graph 的 live 期望冻结在 P0 轮（#5 标题与 children 集已随 8-25 重组漂移，live 模式必红）；selftest 走 SHA 锁定的离线 fixture 快照仍绿。live 断言需重锁或显式声明 fixture-only。

## Out of scope

- 飞书/系统待办或普通 todo 管理。
- 创建、删除或自动清理用户 worktree。
- spawn_agent 作为侧边栏 worktree worker；Node 脚本替代编排 Agent 调用宿主 Task 工具。
- Task 自动 push、关闭 Issue 或绕过用户仍需确认的产品决策。
- mobile 或远端 Web UI 承担编排逻辑。
- worker / merge-worker lane 内部流程与 SKILL.md（归 map #82 aes-issue-worker）。
