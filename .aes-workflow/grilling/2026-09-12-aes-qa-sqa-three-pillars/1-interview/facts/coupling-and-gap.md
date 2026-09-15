# Fact: aes-qa ↔ aes-gate 耦合点与 #171 缺口实证

- 派遣问题：两技能真实衔接边界、v3 原子引用机制、反向感知、普通轮结论表达、落盘与共享标识、docs 层关系文档
- 完成：2026-09-12T00:00:00Z（会话内 Explore subagent 调研，落盘时整理）

## 查到的

| 事实 | 证据出处 |
| --- | --- |
| 真实代码级耦合仅一处：repository-gate.contract.mjs 直接 import aes-qg.mjs 引擎模块 | `skills/workflow/aes-qa/scripts/tests/repository-gate.contract.mjs:16,55-72` |
| v3 原子性=gateReceiptDigest(canonical JSON sha256 内容寻址)+candidateCommitSha 同 candidate 双绑定；消费侧四重校验（candidate/standardVersion/digest 格式/achieved≥required） | `skills/workflow/aes-qa/SKILL.md:116-131`；`merge-policy.mjs:114-130` |
| 衔接是 opt-in 单行道：只存在于最终轮 v3；循环轮 finding、v1/v2 receipt、三档位定义零等级语言 | grep 实证：L0-L5/AES-QG 字样仅在 `SKILL.md:105-139` 与 repository-gate.contract.mjs |
| 反向零耦合：判级引擎不消费 QA 结果；automated/live/manual 列为正交 evidence mode 不参与判级 | `skills/workflow/aes-gate/references/aes-qg.md:14` |
| 普通轮结论表达：循环轮无结论字段；最终轮 checks[].outcome(PASS/NOT_RUN)+顶层 outcome+failureClass | `SKILL.md:32,77-103`；`merge-policy.mjs:295-300` |
| 「跑既有回归」（SKILL.md:62）不映射门级——#171 支柱 1 缺口指控成立 | `SKILL.md:62` + grep 实证 |
| 无共享目录：.aes-gate/、.aes-worktree-board/receipts/、截图 spool 三处分离；耦合靠 digest 不靠路径；共享标识=40 位 candidate commit SHA 三方对齐 | 调研汇总；`aes-qg.mjs:843-844`；`aes-worktree-board/SKILL.md:389,542-546` |
| QaReceipt 落盘：经 Master `stage qa` 提交至 <目标仓>/.aes-worktree-board/receipts/（Git 忽略，避免弄脏 worktree 触发 QUARANTINED_DIRTY） | `skills/workflow/aes-worktree-board/SKILL.md:389,542-546` |
| docs/ 层无两者关系文档；唯一规范描述=aes-qg.md §10 消费合同 | grep `docs/` 0 命中；`aes-qg.md:162-176` |
| 命名碰撞：aes-qa 截图链路 qa-gate-receipt.json（aes.screenshot-evidence-gate-receipt/v1）与 aes-gate gate-receipt.json（aes.gate.receipt/v1）同叫 "gate receipt" 毫无关系 | `screenshot-evidence-core.mjs:14` |
| 消费端版本判别：非 /v3 结尾→legacy:true 豁免 repository gate 子门（v4 会被当 legacy 豁免——消费侧同步的必要性证据） | `merge-policy.mjs:86-89` |
| #171 全文三支柱+AC-1/2/3+待拍板点（支柱 3 保留位置）+非目标三条 | GitHub issue #171（2026-09-12T06:08:02Z 创建，OPEN，ready-for-agent，无 assignee） |

## 未知项

- 各消费仓 v3 receipt 实发情况（本仓读不出，跨仓边界）

## 没查的

- 消费仓 aes-agent 的 real-provider-acceptance.md 内容细节（AC-2 允许直接引用其 #153 F-1 实例，无需本仓复述）
