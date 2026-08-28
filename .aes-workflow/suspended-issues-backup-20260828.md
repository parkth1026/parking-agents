# piaotonghu suspended 期间不可见票的本地备份（2026-08-28）

背景：piaotonghu 账号被 GitHub suspended，其创建的全部 issue（约 #45 以后 + map #5）对所有访问者隐藏。
本文件是本会话（#70 裁定 + #98 证伪段）期间实际读取过的票面内容备份，供解封失败时重建、或解封后校对。
**未读过的票不在此列**（#71-#97 区间多数只有标题，见文末标题清单）。

---

## map #5：aes-worktree-board: Issue × Worktree 编排技能持续维护（wayfinder:map，OPEN）

最后已知 body（2026-08-28 本会话更新后版本）：

### Destination
aes-worktree-board 作为 Master 控制面（master.mjs、registry、merge gate、slot 租约）在真实宿主上把 Issue × Worktree 交付回路跑通并持续硬化。v7 拓扑（#83 定稿）：worker / aes-merge-worker（待建，#94）/ 人参与 lane 平级挂总管，一切交接经 registry；脚本只做 collect/record/lock/validate/render，调度权威是编排 Agent。

### Notes（要点）
- 执行纳入 map（长期开发模式）
- 硬化立票门槛（长期原则，#70 裁定）：新硬化/防御票开工前须引用「该失败在真实宿主发生过或有可信类比」的证据
- 中文；标题 `aes-worktree-board:` 前缀
- 架构档案：docs/retrospectives/...-2026-08-24.md；.aes-workflow/grilling/2026-08-25-.../；MW2 钢人反思；#70 裁定档案 .aes-workflow/grilling/2026-08-28-issue70-loop-first-ruling/

### Decisions so far（gist，共 19 条，末三条为本会话新增）
- 2026-08-24 范围裁决 P0 六项；看板强约束；历史散票收编（#3/#4/#13/#14/#43/#44/#45、#23→#27、#25→#26）
- 2026-08-25：#26 runtime v3 原子读写；#27 Task Registry 租约 generation；#28 inbox 幂等；#29 三维 verdict 熔断；#30 create_thread preflight；#31 stop eval；#22 跨源防护
- 2026-08-26：目标 A 收口（#51/#52/#53，回填 #59/#60/#61）「registry 记意图、Git 记事实」；700×1000 竖屏工作台；AC-007 三类离线门盲区；过程失误两条登记
- 2026-08-27：v7 流程重梳（#83，dev 1126794+0e4ec20）；merge 权归 aes-merge-worker（#94）
- 2026-08-28：#38 收编并入 #94；**#70 修改后采纳**（回路证明轮三段串行 #98→#94→#66；#35/#39 实测反哺；立票门槛入 Notes；装甲不减）
- （待追加）#98 证伪段完成 + #69 交付

### Not yet specified
- 证据失效第三层（环境层）；hermetic 档速度治理；轻拓扑快车道（条件=#66 实测冲突率≈0）；#35/#39 提级挂回路证明轮实测；check-issue-graph live 期望冻结在 P0 轮

### Out of scope
- 飞书 todo；创建/删除 worktree；spawn_agent 侧边栏 worker；Task 自动 push；mobile/远端 Web UI 编排；worker/merge-worker lane 内部流程（归 map #82）

---

## #69：issue-contract 解析器取首个同名小节，重复小节静默取错（wayfinder:task，ready-for-agent，**已交付未关票**）

- 交付：candidate cf6b12ad8a3c0fff0de92b58807370fb967413f5，merge 进 dev 9004b5f9，verify 10 域 PASS
- body：sectionBody() 用 pattern.exec 只取第一个匹配；实测 #62 散文「## 依赖」被误读 complete=true；建议 DUPLICATE_SECTION fail closed
- 本会话补的契约块：目标=七小节重复检测判 invalid；workflow role=implement；AC-1/2/3（automated）；依赖=无；riskProfile: low；副作用=edit-worktree/run-tests/create-commit；人工门=无
- 待办：解封后 master.mjs close（发 comment+关票）+ release slot worker-1

## #70：下一轮投入裁定——先证明回路再加装甲（wayfinder:grilling，**已关**）

- resolution（2026-08-28）：修改后采纳。三段串行 #98(证伪)→#94(merge-worker)→#66(完整轮)；#35/#39 实测反哺不预建；硬化后置泛化为长期立票门槛；已建装甲不减；#65/#38/#62/#64 记「路上已完成」
- 决策档案：.aes-workflow/grilling/2026-08-28-issue70-loop-first-ruling/

## #98：回路证明轮第一段——人工顶替 merge-worker 跑 1 Issue 端到端证伪协议（wayfinder:task，ready-for-human，OPEN，**已完成待 resolution**）

- body：按 #70 裁定第一段，人工顶替 merge-worker 跑 1 Issue 最小端到端，校验 registry/mergeQueue 协议偏差；产出偏差清单作为 #94 设计输入；血统 #70→#98→#94→#66
- 中期 comment（已发）：偏差 1-5 + 事故裁决记录
- 最终 resolution 草稿：.aes-workflow/issue98-resolution-draft.md（13 条偏差清单 + #94 设计输入 + 成本锚点）
- blocking：#94 blocked_by #98（已 wire）；#66 blocked_by #94（已 wire）

## #75：脚本仓与调用 cwd 不一致时 fixture 域 REPO_MISMATCH 假红（#64 同族第三处）（needs-triage，OPEN）

- 待发证据 comment：技能目录默认 board.config.json 仍写 51world-ai-copilot/aes-agent|main 遗留 identity；temp fixture 仓 fallback 到它与目标仓打架；base f08033e 同因红；已实际造成一次 GATE-qa 死锁

## #94：aes-merge-worker 合并验收 lane 落地（needs-triage，wayfinder:task，OPEN）

- 8-28 注记（已发）：blocked by #98，带实测证据开工不裸建
- #98 给它的设计输入（见 resolution 草稿）：close 与 GitHub 解耦；REPO_ROOT env 边界文档；基线红表达位；分支 ref 层对账另票

## #66：high/critical 分档未经真实宿主验证（needs-triage，OPEN）

- 8-28 注记（已发）：回路证明轮第三段，blocked by #94；保留刻意触发 high 档 humanGate + token/Issue 成本锚点自采；轮内人工兼任 stall 检测器

## #35：progress/stall 协议 P1.2（backlog，OPEN）

- 8-28 注记（已发）：不预建维持 backlog；开工前提=回路证明轮实测 stall 案例；phase 枚举按 v7 词汇重定义；两信号方向保留
- 待发：stall 实测第一例（worker 自报等后台测试而 Git 事实显示实现完成未提交；推醒后正常收敛）

## #39/#37（backlog，OPEN）：8-28 注记已发（不预建/前提重确认）

## 其余 piaotonghu 建的 OPEN 票（仅标题，body 未读）

#97 READY_TO_MERGE 冲突区分；#96 registry 脚本缺失无降级；#95 aes-qa 测试有效性判据；#90 live 档不可观测记录位；#89 验收既有候选分支入口；#87 aes-gate 验收证据绑定（grilling）；#85 契约冷读探针（grilling）；#80 psc 探针协议变体率；#79 zcode 桥会话 UI 可见性（ready-for-agent；dev 侧 1b94e47 已修）；#77 slot lease 软约定+gate 血统（8-28 注记：并入 #94）；#74 门禁时间预算假红；#71 Goal 使用纪律（grilling）；#68 runner slot branch 目录名推导
（其余 map：#82 aes-issue-worker；#92 aes-goal-contract；#91 zcode loop；#93 install-skills；#50/#49/#48/#47/#46/#15 各技能 map——多为 piaotonghu 建，同样不可见）

## 待建新票（草稿在会话记录）

- mock.html 被 0aa0ba0 直接改动未走 build-portrait，board-ui SHA 锁失效（挂 map #5）
- 分支 ref 层意图/事实对账（#98 偏差 7 衍生，挂 map #5）
