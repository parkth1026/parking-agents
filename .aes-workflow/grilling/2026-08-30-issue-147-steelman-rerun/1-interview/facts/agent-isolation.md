# Fact: subagent 与独立 Agent/Task 的隔离和证据绑定

- 派遣问题：只读调查 subagent 与独立 agent/Task 在本仓现有工作流中的隔离、身份、持久性、恢复、用户可见性、receipt 绑定语义，为 workflow-interview Q27 提供证据。
- 完成：2026-08-29T20:10:45Z

## 查到的

| 事实 | 证据出处 |
| --- | --- |
| 正常执行单元被明确锁定为 Desktop `create_thread` Task：它在侧边栏可见，创建后登记真实 `threadId`；排队时可先登记 `clientThreadId`，以后再原子补齐 `threadId`、`hostId`、`projectId`。 | `skills/workflow/aes-worktree-board/SKILL.md:85-108` |
| Desktop Task 的身份不是只有会话名：registry 同时记录 Task 与 worktree 租约；reviewer 以 `parent-task-id` 关联 executor，且 reviewer 不取得 writer 租约。相同 worktree 的竞争 Task 会被 `LOCKED` 拒绝。 | `skills/workflow/aes-worktree-board/SKILL.md:90-113` |
| 现有复盘明确区分内部 subagent 与独立 Desktop Task：内部 subagent 不能冒充用户要求的 worker Task；前者不满足侧边栏可见、可跟进、可作为独立协作单元继续使用的要求，而 `create_thread` Task 可以被 `wait_threads` 追踪。 | `docs/retrospectives/aes-worktree-board-multi-agent-orchestration-retrospective-2026-08-24.md:101-117`; `docs/retrospectives/aes-worktree-board-multi-agent-orchestration-retrospective-2026-08-24.md:197-215` |
| worker 的实施闭环由一个 owner session 持有；lane 之间零直连，交接全部经过 registry。工单身份用跨尝试稳定的 `jobId` 与本次唯一的 `attemptId`，并带 contract digest、worktree 和 base commit。 | `skills/workflow/aes-issue-worker/SKILL.md:8-16`; `skills/workflow/aes-issue-worker/SKILL.md:27-38` |
| 内循环 QA 使用 fresh-context 只读 subagent；它只收到 AC、worktree 路径和命令，不收到实现者叙述。这里声明的“独立性”是上下文隔离；循环轮只产出 finding，不产 receipt，也不进入 registry。 | `skills/workflow/aes-issue-worker/SKILL.md:50-58`; `skills/workflow/aes-qa/SKILL.md:17-23` |
| 现有合同同时存在两种 reviewer 载体：v3 路径把 reviewer 建成关联 executor 的独立 Desktop Task；v4 路径由 merge-worker 派 `code-review` subagent。v4 明确规定，无论载体为何，review 结果只能由 merge-worker 上报，被审 worker 不能自报 PASS。 | `skills/workflow/aes-worktree-board/SKILL.md:110-114`; `skills/workflow/aes-worktree-board/SKILL.md:453-480` |
| durable QA 证据不是绑定某个 Agent 名称，而是 `QaReceipt` 精确绑定 `jobId`、`attemptId`、`commitSha`；candidate 或 integration base 前进会使旧证据 stale，QA 出现 `NOT_RUN` 或未执行项会让 gate 失败。 | `skills/workflow/aes-qa/SKILL.md:56-60`; `skills/workflow/aes-worktree-board/SKILL.md:411-419` |
| 打回首先恢复原 owner session/thread；原 session 不可恢复时，才创建新 attempt 并携带 finding。旧 attempt 与旧证据保留、不覆盖；新 commit 必须重新走 QA 并生成新 receipt。 | `skills/workflow/aes-issue-worker/SKILL.md:99-110`; `skills/workflow/aes-worktree-board/SKILL.md:397-397` |
| Orchestrator/Master 中断后的恢复真源是 registry、inbox、receipts 与 Git，而不是 Agent 的对话记忆；Git 用来判断 merge 是否真实发生。v3 的 Task 事件也按 thread 归属、parent 关联和稳定 eventId 入箱、幂等消费。 | `skills/workflow/aes-worktree-board/SKILL.md:59-67`; `skills/workflow/aes-worktree-board/SKILL.md:132-149`; `skills/workflow/aes-worktree-board/SKILL.md:482-496` |
| `wait_threads` 只在当前 Orchestrator 回合内等待，不是永久监听器；因此独立 Task 虽可追踪，控制面的持续恢复仍需持久账本和显式 resume/reconcile，不能靠一个等待调用。 | `docs/retrospectives/aes-worktree-board-multi-agent-orchestration-retrospective-2026-08-24.md:218-249` |

## 未知项

- 仓库没有定义通用 subagent 的持久身份字段、跨主会话恢复协议、侧边栏呈现或独立租约；目前只定义了其 fresh-context 输入边界和结果 provenance。宿主是否保留 subagent 历史、能否单独恢复，仍是宿主能力而非本仓协议事实。
- “只读 subagent”在现有技能中是职责约束；仓库没有给出与 Desktop Task 相同等级的文件系统、凭据、进程或网络隔离证明。因此不能仅凭“fresh-context/只读”推断它具有安全沙箱隔离。
- v3 的“独立 reviewer Desktop Task”和 v4 的“review subagent”并存，但仓库尚无一个统一的声明式规则，机械决定某个 DAG 角色必须采用哪种载体；当前选择写在具体 workflow 段落中。
- receipt 当前主要绑定工作项与被验 subject（job/attempt/commit/base），没有统一的 `producerAgentId` 或 agent-session 身份签名字段；来源权限主要靠“由哪一 lane 上报”的流程边界表达。

## 没查的

- 没有调查 Codex、Claude Code 等宿主产品对 subagent/thread 的未落仓实现细节；本分片只报告仓库可复核事实。
- 没有评价哪种载体应成为 Q27 的产品默认，也没有设计新的 ProfileRegistry、DAG schema、权限或恢复协议；这些属于用户裁决与后续原型/契约阶段。
- 没有运行任何工作流、测试或联网命令，也没有修改 manifest、context、rounds 或其他事实分片。
