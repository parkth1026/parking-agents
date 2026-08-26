# Context Snapshot: 2026-08-25-aes-worktree-board-session-evolution

- 创建：2026-08-25T08:02:33Z
- 分片来源：`facts/session-runtime-failures.md`、`facts/current-skill-coverage.md`、`facts/session-evidence-and-publication.md`

## 任务陈述

[$parking-skills:workflow-interview](G:\GIT\AI_WorkFlow\parking-agents-manual\.agents\skills\workflow-interview\SKILL.md) 结合你的调查，帮我完整整理一下需要修复的问题是什么？

## 当前访谈状态

- 2026-08-25：用户要求先锁定 `aes-worktree-board` 的期望目标，再评估修复项。
- 第一轮 Q1~Q4（修复范围、归档、board 行为、triage 权限）全部冻结，不能视为已回答；待目标、输入输出契约与完成定义锁定后重新分诊。
- Q5~Q9 已全部选择推荐项 A：严格 Issue Contract、风险分级 QA、预算内模型升级、可恢复 awaiting-human、for-agent 机械门通过后自动合并。
- 本轮先定义产品角色、Issue 生命周期、两类 worker 与 Master 权限，不修改产品代码。

## 期望目标 v1（用户已确认）

`aes-worktree-board` 是 Wayfinder 产出 Issue 的持续消化控制面。Master 从 Issue 图中领取获授权且可执行的工作，按执行政策、工作流类型、复杂度、风险和成本选择模型与 worker；每个 Issue 由一个 owner session 尽可能完成实现、验证、独立审查、修复与验收闭环；只有机械 merge gate 通过后，Master 才执行合并。无法自治完成的工作进入可恢复的人机协作流程，不得丢失、假完成或无限循环。

### 已锁定的角色边界

1. `for-agent` / `for-human` 是可转换的执行政策，不是固定不变的 Issue 类型；Issue 另有独立的 workflow role（如 implement、diagnose、research、interview、qa）与运行状态。
2. 一个 Issue 有一个长期负责的 owner session；独立 reviewer 可以使用关联的独立 session，结果回到原 owner 修复。完整轨迹以 Issue/Task/commit 关联，不要求所有参与者物理共用一个上下文。
3. Master 只拥有受政策约束的裁决权。Code/spec must-fix 不能由 Master 自行放过；任何改变验收标准的豁免必须由用户决定并留下结构化 waiver。
4. Master 是调度、监控、裁决、合并与停止的 workflow skill；普通 Issue 实现由 worker 完成。持久 board/runtime 是状态真源，Goal 只能辅助长任务持续执行，不能代替状态机。
5. Worker skill 是组合器：按 Issue workflow role 调用专门技能，不复制 diagnosing-bugs、TDD、code-review、workflow-interview、QA 等技能的完整方法论。

### 目标结构

```text
Wayfinder -> Issue contract -> aes-worktree-board Master
                                |-> for-agent owner -> implement/diagnose/research -> review -> QA
                                |-> for-human owner -> workflow-interview/manual QA -> user receipt
                                `-> merge gate -> Master merge / structured escalation
```

### 最佳实践依据

- OpenAI manager/multi-agent：中央 orchestrator 为并行、聚焦的 subagent 分派有界工作，并负责综合结果。
- Anthropic orchestrator-workers + evaluator-optimizer：复杂编码适合动态分解；有清晰评判标准时用独立评价与迭代改进。
- Durable workflow：session 中断不应丢失持久状态、已完成动作与下一步。
- Matt Pocock 当前工作流：implement 驱动 TDD，完成后进入独立 Standards + Spec code-review；TDD 是被 driver 调用的方法论，不应把全部内容复制进总控技能。
- OpenAI 模型配置：模型与 reasoning effort 是两个维度；应使用语义档位和代表性 eval 做路由，而不是把具体型号硬编码进技能流程。

## 期望目标 v2 增量（用户已确认）

### 三层 workflow

```text
aes-worktree-board master workflow
  -> aes-issue-worker owner workflow
       -> implement / diagnosing-bugs / tdd / research / code-review / aes-qa 等 atomic 或专项 workflow skill
```

- `aes-issue-worker` 是执行一条 Issue 的总入口，不把各专项技能的方法论复制进自身。
- 当前 atomic 能力大体可复用；明确缺失的 workflow 是 `aes-issue-worker` 与 `aes-qa`。
- Wayfinder 是发现与拆分能力：找 skill、发现/拆分 Issue、建立依赖；它不是当前 Issue 的实现者。

### Runner / Job / Attempt / Session 身份

- worktree 是长期复用的 runner slot；runner 集合在初始化阶段确定，不再由 LLM 临场选择。
- runner slot 写入 Git 忽略的本地结构化配置，类似 `.env` 的本机配置角色；repo identity、slotId、worktreePath、projectId、enabled、capabilities、concurrency 属于配置。
- lease、heartbeat、currentJob、attempt、owner session、health 属于 runtime registry，不写入静态 slot 配置。
- Issue claim 是 job；一次 `create_thread` owner session 是 job attempt。正常情况一个 attempt 在同一 session 内走完；不可恢复的 session 故障才允许同一 job 新建 attempt。

### Owner session 内闭环

- owner 主 Agent 完成 implement/diagnose/research 与每轮修复。
- code-review 与 QA 使用同一 owner session 内的隔离 subagent；两者绑定精确 commit，返回 typed result，不改源代码、不 merge。
- review/QA 的 must-fix 或可复现 FAIL 返回 owner 主 Agent，继续修复→复审/复测；不因普通阶段失败打断 for-agent 或直接请求用户。
- Master 只接收 job 级 typed final/escalation，不逐条裁决普通 stage finding。

### 双层 Goal

- Master Goal：保持 runner 利用、领取 job、等待 owner、处理跨 Issue 事件、串行 merge、post-merge verify、继续领取，直到获授权 frontier 耗尽。
- Worker Goal：绑定 Issue Contract、runner、attempt、base/candidate commit、预算与 AC，持续推进 implement→review→fix→QA，直到 `READY_TO_MERGE` 或真实 job-level terminal。
- Goal 提供趋近完成与恢复能力，但持久 board/runtime 仍是状态真源。
- stage 的 `MUST_FIX`、测试失败、普通 timeout、可修复环境问题不是 Goal BLOCK；只有不可在授权预算内继续的 job-level 阻塞才由 Worker Goal 交给 Master。

### 题外问题与 Wayfinder

- Worker 不扩张当前 Issue scope；发现题外问题时输出结构化 `DISCOVERED_WORK`，由 Master 去重并调用 Wayfinder 创建/拆分/关联 Issue。
- `NON_BLOCKING`：创建或关联新 Issue，当前 job 继续。
- `BLOCKING_DEPENDENCY`：创建或关联依赖、建立 blocking edge，当前 job 进入可恢复阻塞；Master 可先调度依赖 Issue，不必立即请求用户。
- `IN_CURRENT_SCOPE`：仍由当前 owner 完成，不新开 Issue。
- `CONTRACT_CONFLICT`：涉及改变当前 AC，必须交用户裁决，Wayfinder 不得自行改写目标。

### End-unit 分层

1. Stage result：`PASS | MUST_FIX | RETRYABLE_FAILURE | ENVIRONMENT_FAILURE | NON_BLOCKING | DISCOVERED_WORK`。
2. Worker loop：修复、重跑、复审、模型升级、记录 debt 或上报题外工作。
3. Worker Goal terminal：`READY_TO_MERGE | AWAITING_HUMAN | BLOCKED_DEPENDENCY | BLOCKED_PERMISSION | CONTRACT_CONFLICT | BUDGET_EXHAUSTED | CANCELLED`。
4. Master disposition：合并、Wayfinder 建 Issue/依赖、换 runner、新 attempt、转 for-human 或请求用户。

## 用户提出的方案

使用 `workflow-interview`，把最新根 session、`create_thread` 子 Task、当前技能真源及历史问题完整整理；用户此前明确说明这些对话和技能调用问题是后续进化技能的核心数据。

## 意图假设

用户真正要解决的不是“再写一份聊天摘要”，而是防止真实编排中已经付过代价的问题再次发生：把历史事故分成已修复回归种子、当前控制面缺口和证据/评测基础设施缺口，最终形成可交给实现 Agent、可独立验收、可持续吸收新 session 的修复契约。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| 最新 Goal 最终完成 #43/#24/#32/#34/#45，`dev=81afa92`，pending=0；#34/#45 不再是待实现项。 | `facts/session-runtime-failures.md`；runtime `registry.json` | Fact |
| 目标 identity、fixture 完整性、GitHub 多账号、Goal/typed final/claim/stop 的核心代码已落地并有 9-domain 回归。 | `facts/current-skill-coverage.md` | Fact |
| Parent terminal 后 reviewer 依赖主控手工 parked；wrong-parent 旧 event、merge conflict、verification failure disposition 没有完整 typed action。 | `facts/session-runtime-failures.md` / `facts/current-skill-coverage.md` | Fact |
| BLOCK/manual debt 三维数据存在，但 reviewer finding 的业务分类仍由主控自然语言完成。 | `facts/current-skill-coverage.md` | Fact |
| 完整正文但缺 triage label 的 #45 曾让可用 worker idle；自动改 GitHub label 的权限边界未定义。 | `facts/session-runtime-failures.md` | Fact + User decision |
| Raw 根/子 session 可读，但分布式全轨迹跨文件、跨路径、含截断快照和内部 subagent；没有稳定归档/脱敏/问题切片工具。 | `facts/session-evidence-and-publication.md` | Fact |
| 一次性 usage 脚本在 ignored runtime，硬编码日期/路径；最新 session 尚无版本化复盘或 eval corpus。 | `facts/session-evidence-and-publication.md` | Fact |
| 技能无 category，评测五件套只有 run-tests，未进入分类发布树。 | `facts/current-skill-coverage.md` | Fact |

## 验证基建候选池

- `node .agents/skills/aes-worktree-board/run-tests.mjs`：当前 9 个确定性域；代价是长测约 2~5 分钟，session 已证明 timeout/env 污染必须单独处理。
- `node .../scripts/selftest.mjs orchestration --scenario <name>`：可做 storage/lifecycle/governance/continuous/boundary/contract 的 host-shaped 离线回归；代价是它仍不能证明真实 Desktop 宿主执行纪律。
- `node .../scripts/selftest.mjs identity`：fake-gh、多账号、repo/permission/error 分类；代价是 live 账号/网络另验。
- `collect-live`、`check-issue-graph.mjs`、`github-issue.mjs --account ...`：真实 GitHub 身份与图；代价是需要网络、账号、仓库权限且不能放进完全离线默认门禁。
- 真实 Codex root + child session replay：可验证工具序列、BLOCK disposition、worker 利用率、stop；代价是需先建去重、稳定快照、脱敏与 oracle。
- LIVE board 浏览器对照：可验证目标 identity、自动打开和 Goal/worker 展示；代价是宿主 UI 与人工/浏览器运行条件。
- 发布门：评测五件套 + `build-release.mjs --check` + `npm test`；当前代价含先补四个缺失 eval 产物和 category。

## 术语冲突

- 用户说的 `codex_start_thread` 在证据中没有这个正式名称；实际宿主工具是 `create_thread`，raw telemetry 名称为 `codex_app__create_thread`。
- “完整历史对话”至少有两种口径：根 chat 全量，或 root + Desktop children + 内部 subagents 的分布式全轨迹。后者不能靠一个 JSONL 文件完成。
- “需要修复的问题”可指历史发生过的全部问题，也可指当前 HEAD 尚未闭环的问题；本访谈默认前者进入回归语料，后者才进入实现 backlog。

## 四分类

- **Fact**：#34/#45 等历史代码缺陷已修；当前剩余缺口集中在 host 生命周期、reviewer/event settlement、conflict/verification disposition、session evidence/evals/release。
- **User decision**：raw 数据保存口径与隐私；是否允许自动 triage/改标签；board 自动打开是否成为强制公共行为；本轮是否包含正式发布晋级。
- **Agent-owned**：解析器/manifest/schema 的内部模块拆分、hash/去重实现、测试 fixture 构造、命令 timeout 的具体数值，只要不改变用户确认的边界。
- **Blocked**：没有仓库内的数据保留/脱敏政策；在用户裁决前不能把 230MB raw 对话直接复制进 Git，也不能默认修改 GitHub triage 状态。

## 决定边界未知项

- 本次交付是否只修运行控制面，还是同时建设 session 证据飞轮和正式发布门。
- 归档保存 raw 全文，还是保存 hash/index + 脱敏问题切片；原始数据放 repo、repo 外受控目录，还是两者组合。
- Goal 启动/恢复是否必须自动打开并验证当前 board。
- 对“正文完整但缺 ready-for-agent”的 Issue，主控是否可以自动 triage，还是只能报告候选等待确认。

## 未知项

- 必须问：完整 raw session 中可能含本机路径、账号、Issue 内容和工具输出，用户接受的保留与脱敏边界是什么。
- 必须问：发布目标是否是当前开发真源内部可用，还是完成五件套后进入跨平台分类发布树。

## 当前候选修复集合

### P0：控制闭环

1. Parent executor 进入 terminal 后，关联 reviewer 自动、幂等、可审计地收敛，不再靠主控逐条 parked。
2. 为已被合法 replacement 取代的 wrong-parent/错误 Task 绑定事件提供安全 settlement；不能扩大成任意吞事件。
3. 把 merge conflict 与 verification failure/timeout/harness/env/code 分类加入结构化 next-action/receipt，保留失败历史并禁止机械 BLOCK。
4. 把 reviewer finding disposition 固化为主控必须执行的阶段：code/spec must-fix、可执行验证、manual debt、non-blocking 建议四分，只有第一类进入 blockCount。
5. 每轮 drain 后显式报告空闲 worker；无 eligible 时报告阻塞原因，有待 triage 候选时按用户授权政策处理。

### P1：真实宿主行为与回归

6. Goal start/recovery 的 board 打开、目标 identity、project/environment/thread 可见性形成 host receipt 或至少强制 preflight/checklist。
7. 用本次真实 session 生成 trajectory replay：过早 complete、机械 review、idle lane、wrong-parent event、timeout/env 污染、conflict、orphan reviewer 等均成为回归。
8. 同步 SKILL 的默认域描述为 9 domains，消除文档/代码漂移。

### P1：证据飞轮

9. 建立版本化 session evidence exporter：按 registry 发现 root/children，C/E 去重，等待稳定/Goal completion，记录 hash、来源、Task/Issue/commit/role/usage、缺失与截断。
10. 建立脱敏 problem-slice 产物：保留用户纠偏、主控判断、工具序列、失败/修复/复审/merge 证据，不保存不可逆秘密。
11. 将问题切片转成 trigger/output/trajectory eval，并维护 benchmark/history；一次性 usage 脚本变为可参数化受测工具或被 exporter 吸收。

### P2：发布

12. 在控制面与证据 eval 通过后决定 `category`，由 `build-release.mjs` 生成正式发布副本；不手改 `skills/`。

### 历史回归种子，不重复实现

- #44 错项目 board、#43 连续编排旁路、#24 labels/config、#32 v2/v3 board、#34 fixture 完整性、#45 GitHub identity/repo/permission。
