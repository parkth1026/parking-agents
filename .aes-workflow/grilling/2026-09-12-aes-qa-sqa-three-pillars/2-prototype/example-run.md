# 可执行示例: 2026-09-12-aes-qa-sqa-three-pillars

**确认版·锁定。** 用户确认：2026-09-12
报文结构一律指回 api-mock.md，此处只写「怎么用、看到什么」。

## 场景 1：已接入门禁仓的最终轮出票

```text
$ node ../aes-gate/scripts/aes-qg.mjs --repo . gate.l3
AES-QG/1 · candidate 7d9c0b4 · worktreeDirty=false
L0 PASS (reused) · L1 PASS · L2 PASS · L3 PASS → achievedLevel=AES-QG-L3
receipt → .aes-gate/runs/run-12/gate-receipt.json

$ node ../aes-worktree-board/scripts/master.mjs stage qa --payload-file qa-receipt-v4.json
receipt accepted → .aes-worktree-board/receipts/job-2026-09-12-171/att-3/
  qa-receipt.json        （v4；repositoryGate.status=referenced，digest=引擎收据 sha256）
  shots/                 （4 张终态截图冻结副本）
  shots-manifest.json    （SHA-256 清单 + candidateSha + secretsScan=CLEAR）
GATE-qa → PASS
```

## 场景 2：未接入门禁仓的最终轮出票

```text
$ node ../aes-worktree-board/scripts/master.mjs stage qa --payload-file qa-receipt-v4.json
repositoryGate: not-onboarded · reason="仓库未做门禁建设，run.toml 无已注册 gate"
GATE-qa → PASS（验收单有效，等级栏显式呈现未接入状态与原因）
```

## 场景 3：agent-live 一轮（业务真实验收）

```text
[QA agent] 按 references/business-acceptance.md 配方：
  能力层：browser-use:control-browser 驱动真实浏览器（read-only 配对会话 + IAB 控制面）
  断言层：claim「名单内模型真实 spawn」→ backing sidecar-session ✓
          claim「工作台出现会话卡片」→ backing read-model ✓
          claim「配色观感舒适」→ 四层均无托底 → 降档 humanChecklist（AWAITING_HUMAN）
  驱动层：driver={model: glm-5.3, capabilitySkill: browser-use:control-browser} 记入 check
checks: 1 automated PASS + 1 agent-live PASS(2 断言托底) + 1 manual AWAITING_HUMAN(demoted)
退出码 0；断言结构见 api-mock.md 对 1
```

## 场景 4：旧 v3 receipt 照旧（必须逐字节一样能跑）

```text
$ node ../aes-worktree-board/scripts/master.mjs stage qa --payload-file old-v3.json
（现状输出原样）legacy 豁免 repository gate 子门 → GATE-qa PASS
```

## 场景 5：契约测试

```text
$ node run-tests.mjs
contract screenshot-evidence / capture-durable-ack ……… PASS
contract repository-gate-level / generation-and-consumption … PASS   （扩：v4 三态 + gate-shortfall + companionShots 完整性 + v3 豁免回归）
contract aes-qa / v4-schema-validation ……………………… PASS   （新增 case）
all contracts PASS
```
