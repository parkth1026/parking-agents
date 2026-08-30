# Fact: 访谈收口缺口审计

- 派遣问题：审计 workflow-interview Q1～Q26（含 Q25-SUPPLEMENT），找出仍会改变目标、范围、公共行为、兼容性、可观察验收或难逆成本的真正 User decisions，并区分仓库事实与 Agent-owned 选择。
- 完成：2026-08-30T04:11:59+08:00

## 查到的

| 事实 | 证据出处 |
| --- | --- |
| Q1～Q26 均已回答；Q7 重复两次但语义一致。Q27 尚未写入 rounds.jsonl。 | `1-interview/rounds.jsonl:1-28`；`1-interview/context.md:138-159` |
| Q27 的完整 steelman 与 A/B/C 已存在，问题是 DAG 锁定具体 Agent 产品形态，还是锁定隔离、身份、持久性和恢复语义。 | `1-interview/context.md:162-176` |
| context 的最后一行仍误写“下一动作确认 Q26、追加 round 26”，与 Q26 已记录及上文 Q27 待答冲突。它是恢复检查点缺陷，不是用户决定。 | `1-interview/context.md:158-159,178`；`1-interview/rounds.jsonl:28` |
| 用户要求流程覆盖到“最终落地代码实现”，但当前裁决只确定 Core 不亲自 merge，并未明确 Story done 必须绑定 candidate、merge-ready 还是目标 integration SHA。 | `1-interview/rounds.jsonl:9,21,24` |
| 旧 ADR 把四条件全过定义为 `ready`，仍需用户确认才 `handed_off`；新裁决只说 StoryRoot 独占最终 done，没有重新裁决是否所有 Story 都必须额外人工确认。 | `docs/adr/0003-story收口四条件硬门禁.md:18-23`；`1-interview/rounds.jsonl:24,27-28` |
| 现有 QA/board 要求 receipt 精确绑定 candidate SHA；candidate 或 integration base 前进即为 stale。当前访谈明确把 carry-forward 顺延，尚未裁决。 | `skills/workflow/aes-qa/SKILL.md:58-60`；`skills/workflow/aes-worktree-board/SKILL.md:411-419`；`1-interview/context.md:105,157` |
| 用户要求最终交付前全量回归，但“全量”的权威清单、绑定哪个集成快照，以及 baseline red、NOT_RUN、环境不可用时是否阻断仍未定义。 | `1-interview/rounds.jsonl:27-28`；`skills/workflow/aes-worktree-board/SKILL.md:465` |
| 用户要求调研和执行前提供“真实文本和数字测试样本”，但未定义真实生产数据、脱敏样本、生产形态 synthetic fixture 谁可接受，以及缺样本是否阻断。 | `1-interview/rounds.jsonl:27` |
| Q24 选择 repo-versioned ProfileRegistry，但缺失旧 profile、digest 不匹配或 registry 不可读时只提到需要 degraded behavior，未决定能否继续执行。 | `1-interview/rounds.jsonl:25` |
| Q22 允许执行中出现 bug 与小需求变化，但未定义哪些变化可由 DeliveryMap 自动开下一 wave，哪些必须回流 Discovery 并重新取得用户确认。 | `1-interview/rounds.jsonl:23-24` |
| 当前模型以 tracker repo 和精确 checkout 为重建输入，但没有明确一个 StoryRoot 是否只能覆盖一个 repo/integration target，还是允许跨仓票与跨仓最终回归。 | `1-interview/rounds.jsonl:19,24`；`skills/workflow/aes-worktree-board/SKILL.md:45-47,178` |
| Web 可提交人工回答与验收确认，但谁有权发布 human receipt、撤销确认或解决冲突尚未定义。该信息跨出仓库，不能由代码调查代答。 | `1-interview/rounds.jsonl:10-11,26` |

## 未知项

- 必须问：DAG 节点锁定具体 subagent/独立 Agent，还是锁定可验证的隔离与持久性语义。
- 必须问：Story 的代码交付终点是否必须绑定 merge 后的目标 integration SHA。
- 必须问：机械 Gate 全绿后，所有 Story 是否仍需额外 human handed-off，还是只有声明了人工 AC 的 Story 等人确认。
- 必须问：subject 变化后 receipt 是否全部 stale，还是允许显式 CarryForwardReceipt。
- 必须问：最终“全量回归”的权威来源及 baseline red、NOT_RUN、环境不可用的阻断语义。
- 必须问：“真实文本和数字样本”的合法来源、脱敏要求、批准者与缺失行为。
- 必须问：一个 StoryRoot 是否允许跨 repository / integration target。
- 必须问：Delivery wave 中 bug 与小需求变化的自动扩展边界。
- 必须问：human receipt 的授权身份、撤销和冲突裁决边界。

## 没查的

- 未做 GitHub/GitLab live mutation 或权限实验；本次只做设计访谈收口审计。
- 未调查具体 JSON schema、字段名、Web 布局或 router 算法；这些在公共语义确定后属于 Architect/Agent-owned 工作。
- 未验证真实 GitLab adapter；目标仓、凭据和实现契约尚未提供。

## 候选待定项排序

1. **P0 — Q27：DAG carrier 语义**：已完整形成问题，直接继续询问。决定验证独立性、恢复能力与 Web 可观察拓扑。
2. **P0 — Story 最终交付与人工终态**：需要拆清代码必须进入哪个 integration subject，以及机械全绿后是否普遍等待 human handed-off。
3. **P0 — Receipt 版本失效与结转**：决定旧证据能否用于新 candidate/integration，直接影响假绿风险和多 wave 重验成本。
4. **P0 — 最终全量回归的可判定定义**：锁定仓库版本化 Gate 清单与精确最终 integration subject；仍需裁决 baseline red、NOT_RUN、环境不可用是否 fail-closed。
5. **P0 — 真实文本/数字样本契约**：需明确 production-derived 脱敏样本与 production-shaped synthetic fixture 是否都算“真实”，由谁确认，缺失是否阻止 Discovery/Delivery。
6. **P1 — StoryRoot 单仓还是跨仓**：默认单仓可显著缩小 v1；跨仓则必须增加跨 tracker identity、membership、integration 与回归合成协议。
7. **P1 — Delivery wave 自动扩展边界**：bug 可自动生成修复票较清楚；需求或 AC 变化是否必须回流 Discovery 仍需裁决。
8. **P1 — ProfileRegistry 缺失/损坏行为**：可进入确认区；建议 fail-closed degraded，只读展示但禁止 claim、执行和收口。
9. **P1 — Human receipt 授权与撤销**：需要用户给组织权限边界；具体签名字段和乐观锁属于 Agent-owned。

## Agent-owned / 可由仓库查清

- **仓库事实**：每仓现有 Gate、测试命令、CI、fixture、风险路径和全量回归候选池，应调查后写入 ProfileRegistry，不问用户。
- **Agent-owned**：JSON 字段名、内部状态枚举命名、router 实现、Web 布局、依赖闭包算法和目录布局；前提是不改变上面待裁决的公共语义。
- **建议默认后确认**：ProfileRegistry 缺失或 digest 不符时 fail-closed；不可把无法重建的 profile 当作通过。
