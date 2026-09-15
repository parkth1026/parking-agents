# Fact: aes-qa 完整运行逻辑与 QaReceipt 三代 schema

- 派遣问题：aes-qa 定位、三档位定义、QaReceipt v1/v2/v3 schema 与兼容、运行逻辑树、receipt 生命周期状态类、截图证据链路、脚本清单
- 完成：2026-09-12T00:00:00Z（会话内 Explore subagent 调研，落盘时整理）

## 查到的

| 事实 | 证据出处 |
| --- | --- |
| 定位：worker 闭环内唯一验证角色；价值在「如实」；红线 NOT_RUN 永不写 PASS、Agent 不得代答人工验收 | `skills/workflow/aes-qa/SKILL.md:8-9,44,51` |
| 三形态：循环轮（只出 finding 不出 receipt）/最终轮（唯一 candidate 登记后出 typed QaReceipt 绑 SHA）/回归重验（新 commit 使旧 receipt STALE_EVIDENCE 作废） | `SKILL.md:28-40` |
| 三档位按影响面定：纯内部逻辑→automated；CLI/报文→automated+端到端；identity/权限/外部 API→live（正例+反例，错误账号 fail closed）；界面视觉→live+人工；无法自动断言→manual(humanChecklist) | `SKILL.md:56-69` |
| live 档定义仅一行「真实环境验证正例与反例」，无 reference 级操作定义（#171 支柱 2 缺口实证） | `SKILL.md:64` |
| v1：绑 jobId/attemptId/commitSha + environment/impactClasses/checks[]/screenshotEvidence/outcome/unexecuted[]/manualDebt[]；FAIL 带 failureClass(must-fix/retryable/environment) | `SKILL.md:73-103` |
| v2=v1+baseCommit 强制（消费侧只对 /v2、/v3 结尾强制，v1 豁免） | `SKILL.md:108`；`skills/workflow/aes-worktree-board/scripts/merge-policy.mjs:309-316` |
| v3=v2+repositoryGate 原子引用（requiredRepositoryGate + repositoryGate{standardVersion,achievedLevel,gateReceiptDigest,candidateCommitSha,outcome}）；digest 由 aes-qg.mjs 生成不手抄；缺级/旧证据/NOT_RUN/裸 Lx/candidate 不符 fail closed；"none" 仅 trackerOnly 白名单；v3 缺字段 fail closed 不降级 | `SKILL.md:105-139` |
| v1/v2 历史语义永久冻结，GATE-qa 豁免 repository gate 子门 | `SKILL.md:136-137`；`merge-policy.mjs:63,86-89` |
| GATE-qa 机械门：checks[] 出现 NOT_RUN 或 unexecuted[] 非空直接判失败；STALE_EVIDENCE=commitSha≠当前 candidate 拒收 | `SKILL.md:53-54,74-75`；`merge-policy.mjs:295-303`；`master.mjs:844-850` |
| 截图链路：capture spool（PNG→SHA-256→原子改名，GitLab HTTP=0）→terminal 冻结一次 claim-bearing batch →publish（U upload+1 note+strict readback 2U+2）→aggregate-marker →gate 只读 marker 出 screenshotEvidence wrapper | `references/screenshot-evidence.md:64-72`；`scripts/screenshot-evidence-core.mjs:141-216,272-305,566-734,925-970` |
| 三正交事实：assertionOutcome（真假）/evidenceState（五态发布进度）/releaseEligibility；发布成败不得改写断言 | `screenshot-evidence.md:81-83` |
| final candidate 规则：dirty/nonFinal 截图只支撑循环轮；登记 candidate 后必须新 {qaRoundId,attemptId} 重跑，marker candidateSha 精确等于 receipt commitSha | `screenshot-evidence.md:108-111` |
| abandon 永久禁止该 attempt 产出 QaReceipt/READY/close；VERIFIED 后可删 PNG 保留 manifest/publish-receipt/marker/qa-gate-receipt | `screenshot-evidence.md:73-75` |
| 验证基建：run-tests.mjs 契约 runner，CONTRACTS=screenshot-evidence(5 case 默认)+repository-gate-level(1 case)；live-u2-strict 需显式点名 | `skills/workflow/aes-qa/run-tests.mjs:10-34` |
| repository-gate.contract.mjs：跨技能「同一证据合同」，生成侧 aes-gate 引擎→v3 引用→消费侧 merge-policy；缺同伴技能如实 SKIPPED | `skills/workflow/aes-qa/scripts/tests/repository-gate.contract.mjs:2-8,38-42` |

## 未知项

- QaReceipt 在消费仓的实际落盘内容样本（本仓只有 schema 与契约 fixture）

## 没查的

- screenshot-evidence 各 Balanced limits 具体数值（支柱 3 只沿用协议，不改限值）
