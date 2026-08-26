# Fact: 最新 session 运行时失败轨迹

- 派遣问题：从 `01a03540-650f-7a82-b7e1-caf0a1d16ad3` 根 session 与关联 Task 中，区分真正代码缺陷、主控策略缺陷、正确门禁摩擦，以及各项当前是否已闭环。
- 完成：2026-08-25T08:02:33Z

## 查到的

| 事实 | 证据出处 |
| --- | --- |
| 根 Goal 首次启动后没有立即打开 board；主控解释为停在 dirty-worktree 确认门禁前。这是正确门禁与未显式说明下一宿主动作叠加的摩擦，不是产品测试失败。 | `C:/Users/parking/.codex/sessions/2026/08/25/rollout-2026-08-25T03-30-07-01a03540-650f-7a82-b7e1-caf0a1d16ad3.jsonl:216,223,267` |
| 8321 实际返回另一项目 `aes-agents-v2`，用户看到错误 Issue 图；该 code/spec 缺陷记录为 #44，随后以 repo identity/schema/PORT_CONFLICT 门禁修复。当前 `server` 契约已有对应机械校验。 | 同上 `:319,339,344,416`；`G:/GIT/AI_WorkFlow/parking-agents/.agents/skills/aes-worktree-board/SKILL.md:309` |
| 第一阶段曾报告 Goal complete，但用户复查后发现仍有可推进 Issue，并追问 Goal 为什么消失。后续 root 恢复 Goal，继续完成 #43/#24/#32/#34/#45。证明“静态 frontier/终态快照足够”是错误假设；当前 run 最终才在 fresh registry/inbox/Git/frontier 后 STOP。 | 第一分片 `:5415`；第二分片 `:8,4607` |
| 用户明确指出主控曾把 reviewer BLOCK 当成机械循环信号，并把真机/人工债务与 code/spec BLOCK 混在一起。后续 #34/#45 改成“主控先判可执行性 → 原 executor 修 → 聚焦复审”，且 manual debt 不再 BLOCK；这是执行策略纠偏，当前主要靠 SKILL 与主控判断，不是独立 typed disposition。 | 第二分片 `:86,3178,4172,4284,4417,4607` |
| #33、#43、#44、#34、#45 的若干 BLOCK 有直接红测证据，不能一概降为低价值 review：包括伪 merge、旧 reviewer 跨 commit、重复 claim、UNCLASSIFIED 被吞、跨仓 runtime 覆盖、fixture fail-open、GitHub repo/identity 错绑。 | 第一分片 `:1232,1423,1502,2263`；第二分片 `:3039,4172,4225` |
| dev2/dev3 在一段时间内确实 idle，主控先前没有及时派下一条工作；#45 具备完整正文但缺 `ready-for-agent` 标签，主控人工完成 triage 后才进入 claim。当前 `CLAIM_NEXT_ISSUE` 只消费已 eligible Issue，不包含“候选需 triage”的 typed action。 | 第二分片 `:3182,3187,3346,3366,3388` |
| reviewer verdict 曾错误绑定 reviewer Task 而非 parent executor；正确 replacement 后残留 pending event。现有 dead-letter 只允许“同 reviewer/thread/verdict 的 commit 字符串绑定差异”，不覆盖一般 wrong-parent 形态。本 run 最后通过把旧 reviewer lane 合法 parked、再按 late terminal-noop 收敛。 | 第一分片 `:1284`；第二分片 `:3607,4560,4580`；`G:/GIT/AI_WorkFlow/parking-agents/.agents/skills/aes-worktree-board/scripts/orchestrate.mjs:699-748` |
| parent executor 已 merged 后，历史 reviewer 仍停在 `dispatching/executing`；主控手工逐条 parked 后 stop 才成立。当前 registry 有 10 个 merged executor、28 个 parked reviewer，说明现场已收敛，但“parent terminal 自动收敛 child reviewers”不是机械不变量。 | 第二分片 `:4580,4594`；`G:/GIT/AI_WorkFlow/parking-agents/.aes-worktree-board/runtime/registry.json` |
| merge conflict 在 #43/#24/#32 中被主控正确判为 Git 集成冲突，不增加 blockCount，并交回原 executor 解析；但 action 闭集没有 conflict 类型，因此整段靠自然语言处置和手工 transition/receipt。 | 第二分片 `:1625,1879,2157`；`orchestrate.mjs:29-30` |
| post-merge verification 两次出现“非代码失败”：#43 默认 120 秒不足，300 秒重跑通过；#45 因主控把 GitHub account 全局注入测试环境，污染隔离场景，移除全局 env 后重跑通过。失败历史被保留，这是正确证据处理，但 timeout/env disposition 仍靠主控。 | 第二分片 `:2107,2149,4481,4520,4560`；`orchestrate.mjs:1572` |
| #34 的完整 fixture 初版删掉 Issue/字段仍通过，属于有效 code/spec BLOCK；`66e2fee` 修复并由 `e8b0ea6` 合并。#45 的身份/repo 错绑由 `6c59e3a` + `a929590` 修复并由 `81afa92` 合并。二者当前不应再列“待实现”，应转成回归种子。 | 第二分片 `:3039,3401,3454,3511,4172,4417,4449`；目标仓 `git log` |
| 最终 Goal 已正常 complete：pending=0、所有 executor merged、reviewer 收敛、无 eligible autonomous Issue；15 个 OPEN 不等于 15 个应自动实现。#35~#40 正文是“Backlog（建而不做）”。 | 第二分片 `:4594,4607`；runtime `registry.json` / `status.json` |

## 未知项

- “board 每次 Goal start/recovery 都必须自动打开”是用户期望还是只针对第一次错误体验，仓库证据不能替用户决定。
- 对正文完整但缺 triage 标签的 Issue，root 是否获权自动改为 `ready-for-agent`，会改变外部 Issue 状态，必须由用户裁决。
- wrong-parent reviewer event 应扩展 dead-letter，还是由 parent terminal settlement 自动吸收，存在两条成本不同的公共契约路径。

## 没查的

- 没有重新运行已经在 session 中完成的 9-domain 回归；本分片只核对历史证据与当前代码/registry 形态。
- 没有修改或重新打开 GitHub Issue；Issue 当前状态以 session、Git 提交和本地 fixture 为证据。
