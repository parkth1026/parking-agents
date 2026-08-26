# Fact: 当前技能覆盖与剩余缺口

- 派遣问题：逐项对照最新 session 问题，判断当前 `aes-worktree-board` 真源是否已有机械覆盖，还是只有文档/主控自然语言处置。
- 完成：2026-08-25T08:02:33Z

## 查到的

| 事项 | 当前覆盖 | 证据出处 | 剩余缺口 |
| --- | --- | --- | --- |
| Desktop 可见 Task preflight | 部分机械覆盖：SKILL 要求 `list_projects → create_thread → threadId/clientThreadId → registry`；`task create` 强制 reviewer parent/同 Issue/同 worktree。 | `G:/GIT/AI_WorkFlow/parking-agents/.agents/skills/aes-worktree-board/SKILL.md:85-110`；`scripts/orchestrate.mjs:460-515` | 脚本不能调用宿主工具，也没有 receipt 证明“侧边栏已可见、初始 prompt/project/environment 正确”；仍依赖主控执行。 |
| Board 目标 identity | 已机械覆盖：repo/root/mainBranch/runtime identity、完整 server marker/schema、GitHub account/host/repo/permission 都有代码和 identity 域。 | `SKILL.md:21-47,309`；`run-tests.mjs` 9 domains；提交 `81afa92` | 自动打开 board 及打开前的宿主级 API identity receipt 没有一等 action。 |
| Goal stop/frontier | 核心机械覆盖：typed final、next-actions、STOP 前 fresh actions 重算、eligible frontier、pending/merge/post-merge 门禁都有代码与 continuous tests。 | `SKILL.md:127-182`；`orchestrate.mjs:1186-1357,1690-1732` | 真实 Desktop run 仍暴露主控曾提前结束、空闲 worker 未及时补派；“持续 drain host actions”仍是 Skill 执行纪律，不是宿主 driver。 |
| BLOCK/manual debt | 三维 verdict、interaction class、第三次 BLOCK、handoff recovery 已机械覆盖。 | `SKILL.md:214-270`；`orchestrate.mjs:769-835` | reviewer finding 的“有效 code/spec / 可执行测试 / manual debt / 非阻塞建议”没有 typed disposition；主控仍从自然语言判断。 |
| Reviewer parent/commit 绑定 | task create、thread relationship、review commit 三方绑定已机械覆盖。 | `orchestrate.mjs:344-362,647,769-779,1447-1457` | wrong-parent 但已被合法 replacement 取代的旧事件不满足现有 dead-letter 狭窄合同；本 run 靠 parked + terminal-noop 收敛。 |
| Parent terminal 后 reviewer 收敛 | 未覆盖为自动不变量。 | runtime 当前 `10 merged executor + 28 parked reviewer`；session `:4580` 明确主控手工 parked | 应定义 child reviewer 在 parent merged/parked/handoff 后的 settlement 规则、transition 与回归。 |
| Worker idle / claim next | 对 `ready-for-agent` eligible Issue 有 reservation、跨 worker 去重、CLAIM receipt。 | `orchestrate.mjs:1289-1347,1524-1538` | 完整正文但缺标签的候选不会产生 `TRIAGE_CANDIDATE`；主控无权时会 idle、获权时又只能手工改 Issue。 |
| Merge conflict | 未进入 action 闭集。 | `orchestrate.mjs:29-30` | 需要决定新增 typed conflict disposition，或把它作为 `EVALUATE_MERGE_GATE` 的结构化失败/恢复协议。 |
| Verification timeout/env | `action verify` 实际执行命令、绑定 HEAD，单命令 timeout 可配 1s~600s，默认 120s。 | `orchestrate.mjs:1558-1612` | 没有对失败作 timeout/harness/env/code 分类；没有 host env 最小作用域契约；session 两次靠主控诊断重跑。 |
| Fixture 完整性 | 已机械覆盖并合入。 | `66e2fee`、`e8b0ea6`；`check-issue-graph.mjs` / contract tests | 作为历史回归种子保留，不再重复实现。 |
| GitHub 多账号 identity | 已机械覆盖并合入，新增 identity 域。 | `6c59e3a`、`a929590`、`81afa92`；`github-identity.mjs` / `github-issue.mjs` | SKILL 的默认回归文字仍只枚举旧 8 域，和 `run-tests.mjs` 的 9 域存在文档漂移。 |
| Session 历史/训练语料 | 未产品化。只有忽略目录中的一次性 `summarize-worker-usage.mjs`，路径、日期、Goal 均硬编码，只汇总 token。 | `G:/GIT/AI_WorkFlow/parking-agents/.aes-worktree-board/runtime/summarize-worker-usage.mjs`；`.gitignore:20` | 没有 root/child session 发现、C/E 去重、稳定封存、脱敏、问题切片、Git/Issue/Task 关联、trajectory eval 导出。 |
| 评测与发布 | 未达到晋级门槛：五件套只有 `run-tests.mjs`；frontmatter 无 `category`，发布树无 `aes-worktree-board`。 | `docs/agents/skill-release.md:3-42`；技能目录文件清单 | 缺 `trigger-evals.json`、`output-evals.json`、`trigger-benchmark.json`、`history.json`，也未决定是否正式发布。 |

## 未知项

- 宿主是否提供可机器读取的“board 已在当前 Codex 窗口打开”receipt，仓库代码无法确定。
- 自动 triage/改 label 的授权边界不在代码里，必须问用户。
- Session 原始数据是否允许复制进 Git、保留多久、脱敏到什么程度属于仓库外政策。

## 没查的

- 没有设计具体模块拆分；`aes-interview` 只锁目标和边界，影响面与具体对照物留给 prototype 阶段。
- 没有运行发布生成器，因为当前五件套和 category 明确不满足前置条件。
