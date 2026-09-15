# Fact: AES-QG 标准与 aes-gate 本体

- 派遣问题：AES-QG 是什么、L0-L5 判级体系、aes-gate 引擎输入输出、run standard v4 关系、调用场景、复用/收据语义
- 完成：2026-09-12T00:00:00Z（会话内 Explore subagent 调研，落盘时整理）

## 查到的

| 事实 | 证据出处 |
| --- | --- |
| AES-QG/1「跨仓统一的客观保证等级标准」，normative；仓库内无 QG 逐词展开，候选名曾为 AES Gate Assurance Level | `skills/workflow/aes-gate/references/aes-qg.md:1`；`.aes-workflow/grilling/2026-09-05-aes-gate-objective-level-standard/1-interview/context.md:39,45` |
| 所有权：所有者是 aes-gate；aes-qa 与 aes-worktree-board/GATE-qa 是消费方 | `skills/workflow/aes-gate/references/aes-qg.md:3` |
| L0-L5 矩阵：L0 静态一致性 → L3 装配候选系统冒烟 → L5 已安装制品运维验收 | `skills/workflow/aes-gate/references/aes-qg.md:20-27` |
| 判级=三轴（testObject/assertionScope/artifactFidelity）取最小值；任一轴不在闭集→UNCLASSIFIED 不猜 | `aes-qg.md:29-39`；`scripts/aes-qg.mjs:100-104` |
| 名称/耗时/测试数量/人工自动全部不是判级输入（IGNORED_CLASSIFICATION_KEYS） | `aes-qg.md:40-41`；`scripts/aes-qg.mjs:83-87` |
| 单 check 只有 classifiedAt；achievedLevel 只属累计 receipt，单项不得自称等级 | `aes-qg.md:42-43,98` |
| achievedLevel=同 candidate L0-Lx 最高连续 PASS，缺级不得跨越；失败截断 NOT_REACHED | `aes-qg.md:98-104` |
| 复用=五维 identity（candidate/artifact/gate 定义/policy/环境）全匹配才 reused；TTL 不参与；变化报 STALE_EVIDENCE 重跑 | `aes-qg.md:110-124`；`scripts/aes-qg.mjs:278-310` |
| L5 PASS ≠ release-qualified；qualifiesForRelease 只由显式 release profile 评估 | `aes-qg.md:126-132` |
| 引擎输入：run.toml（唯一注册真源）+ gate-policy.toml + candidate(git HEAD)；裸 gate 歧义 exit 64；无 policy→legacy-unqualified BLOCKED | `SKILL.md:10`；`aes-qg.md:57-59,148,150-160`；`scripts/aes-qg.mjs:643-859` |
| 输出落盘：`.aes-gate/runs/run-<N>/gate-receipt.json`（aes.gate.receipt/v1）+ level-AES-QG-L<k>.json + level-board.html | `aes-qg.md:121-122`；`scripts/aes-qg.mjs:843-847` |
| run.toml 段文法=run standard v4 §3.1（段内单连字符合法，2026-09-12 commit 51518ed 放宽） | `skills/workflow/aes-standardize-repo/references/run-standard.md:58`；`scripts/aes-qg.mjs:28-29` |
| 四条路径：单条沉淀/批量体检/组装（永不自动进入，组装产物永不在 aes-qa 调用路径内落地）/被 aes-qa 调用（collect.mjs --handoff 不落盘 stdout 回传） | `skills/workflow/aes-gate/SKILL.md:41-84` |
| 五维 identity 不含「驱动执行者标识」——LLM 驱动门在复用语义上有盲区（换模型=换执行者，identity 不变） | 由 `aes-qg.mjs:278-280` 五维闭集实证推出 |

## 未知项

- 无

## 没查的

- aes-gate 判级引擎内部测试覆盖明细（本票非目标不动引擎，只需回归确认）
