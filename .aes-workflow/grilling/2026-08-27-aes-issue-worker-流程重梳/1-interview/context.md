# Context Snapshot: 2026-08-27-aes-issue-worker-流程重梳

- 创建：2026-08-27T00:00:00+08:00
- 分片来源：无，宿主直接调查

## 任务陈述

我们用这个严格流程 重新梳理这次 aes-issue-worker 内容，同时你要开 issue 来登记一下。

## 用户提出的方案

上游对话中用户提出：worker 应「通过 wayfinder 自己决定做什么（implement 还是 debug，根据单子）；做好了再跑 aes-qa；通过 QA 了才决定是否 code-review 跟 simplify 然后再跑一次；然后整体 git commit 并说 ready for merge，相当于提 PR；用 master agent 处理合并」。

## 意图假设

任务陈述说「重新梳理」，真正要解决的是：把上游讨论的五个流程问题（路由归属、QA 顺序、simplify 位置、review 分档、session 模型）从聊天记录变成锁定的契约与 SKILL.md 修订，并登记进 GitHub 治理结构。用户方案中「根据单子决定」与现行 workflowRole 契约字段是同一件事的两种表述；「QA 前置」与现行 review→QA 顺序冲突，是本次访谈的核心分歧点（已裁定维持现行）。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| buildWorkOrder 不携带 riskProfile，worker 拿不到分档依据 | `issue-contract.mjs` buildWorkOrder | Fact |
| recordStageResult 不强制 review 先于 qa；顺序是 worker 侧约定，gate 只要求两者都 PASS 且绑定 candidate | `master.mjs` recordStageResult | Fact |
| masterTerminal 已加 CANDIDATE_MISMATCH fail-closed，terminal 不是 candidate 前进通道（W-1 修复已落盘） | `master.mjs` READY_TO_MERGE 分支 | Fact |
| GATE-review/GATE-qa 已要求 commitSha === candidateCommit 精确相等 | `merge-policy.mjs` evaluateMechanicalGate | Fact |
| aes 族不在发布树 skills/（仅 engineering/productivity/pub），无 build-release 同步负担 | `ls skills/` | Fact |
| simplify 技能存在：3 并行 review subagent + 窄范围修复 | `.agents/skills/simplify/SKILL.md` | Fact |
| evals 不覆盖 aes-issue-worker，零评测用例 | `evals/` grep | Fact |
| selftest-v4 消费 workOrder 字段但未锁全形状，additive 字段安全 | `selftest-v4.mjs:91,976,1086` | Fact |
| aes-issue-worker / aes-qa 为 prose-only 技能，schema 唯一机器可执行定义在 board 的 master.mjs | 目录清单 | Fact |
| 行业对照报告支持 review→QA 顺序与 harness 强制预算方向 | `docs/research/自主闭环harness设计-行业调研-2026-08-27.md` | Fact |
| Wayfinder 在本仓已有确切含义：Master 侧 GitHub 写入适配器 | `discovery.mjs` makeWayfinder | Fact |
| GitHub 登记：map #82（aes-issue-worker）、票 #83（本次重梳），原生 sub-issue 已挂 | parkth1026/parking-agents | Fact |

## 验证基建候选池

- 根 `npm test` 七连 + check:repo + build-release --check —— 代价低；只验结构（discovery/no-tool-names），不验流程语义
- board `run-tests.mjs` 十域 —— 代价中；Q1 选 A 的 schema 改动必须过它
- `selftest-v4.mjs` orchestration 场景 —— 代价：为 work-order 新 risk 字段写断言（红绿各一）
- parking-skill-creator evals —— 代价含先建：aes-issue-worker 目前零 eval 用例，建触发评测是新工作
- 人工审读 SKILL.md —— 代价：用户时间；prose 流程质量无自动 oracle

## 术语冲突

用户说的「wayfinder 自己来决定做什么」与仓库 `discovery.mjs` 的 Wayfinder（Master 侧 GitHub 写入适配器：create/comment/edge）冲突。已澄清：用户所指是 workflowRole 路由（契约字段），按仓库语义走；Wayfinder 一词保留给 discovery 回流适配器。

## 四分类

- **Fact**：已查事实表全部。
- **User decision**（round 1 已全部裁定）：C1 QA 顺序维持 review→QA（推翻用户原 QA 前置提案，用户确认 A）；C2 review 无条件性保持（A）；Q1 review 分档落地=扩 work-order 带 declaredRisk（A）；Q2 simplify 条件触发（A）。默认区 5 条未被反对：D1 路由契约锁定 / D2 异议走 CONTRACT_CONFLICT / D3 单 session 模型 / D4 落地面 / D5 self-test 显式化。
- **Agent-owned**：SKILL.md 章节组织与措辞；分档规则的深度描述（low/medium 轻量 vs high/critical 深度各查什么）；simplify「实质代码改动」的判断指引措辞；work-order 新字段命名与放置位置；selftest 断言写法。
- **Blocked**：无。

## 未知项

无跨仓库边界必问项。风险承接：Q1 的 work-order 字段扩展需在 board 的 design.md 记一笔（仓库契约变更顺序），归 3-contract 阶段的交接指令覆盖。
