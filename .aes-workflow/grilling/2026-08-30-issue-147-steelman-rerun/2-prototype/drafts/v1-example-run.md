<!-- draft v1 | published 2026-08-30T00:00:00+08:00
     用户意见：待确认
     状态：awaiting confirmation -->

# 可执行示例: workflow-story-map 新版设计

**草稿，尚未锁定。** 命令名和输出字段是确认候选；完整结构以 `v1-api-mock.md` 为唯一来源。

## 场景 1：冷启动接管一个跨仓 Story

调用：

```powershell
node skills/workflow-story-map/scripts/story.mjs resume `
  --story github:parkth1026/parking-agents#147
```

候选输出：

```text
STORY story-147 · active / unclaimed / pending
contract  revision=4 digest=sha256:contract-v4

RepoLane       Tracker  Checkout     Integration   Local Gate
desktop        github   509ea05b     dev:pending   pending
backend        gitlab   7a31c2de     91b0aa10      passed

Discovery frontier  1 ticket
Delivery frontier   2 tickets
Human pending       VIS-1..3 on desktop integration

rebuild: PASS
source: tracker control index + exact repo evidence
next: inspect ticket-I42 or submit a typed command
```

退出码：`0`。这表示状态可完整重建，不表示 Story 已完成。

## 场景 2：Tracker 断连时点击 Retry

调用：

```powershell
node skills/workflow-story-map/scripts/story.mjs command `
  --story story-147 `
  --ticket ticket-I42 `
  --attempt attempt-3 `
  --retry `
  --idempotency-key retry:ticket-I42:attempt-3
```

候选输出：

```text
NOT_COMMITTED · TRACKER_UNAVAILABLE
canonical state changed: no
queued locally: no
retryable: yes — retry explicitly with the same idempotency key
```

退出码：`20`。恢复网络后再次运行同一命令；若第一次其实已被 tracker 接收，同 key 返回原结果，不创建第二个 attempt。

## 场景 3：候选前进使旧 QA 失效

```powershell
node skills/workflow-story-map/scripts/story.mjs gates `
  --ticket ticket-I42 `
  --subject git:c3
```

候选输出：

```text
GATE-ticket-I42-qa  pending
current subject     git:c3
accepted receipts  0
stale receipts      1
  receipt-QA-900    bound=git:c2 reason=SUBJECT_CHANGED

No carry-forward is permitted. Re-run the profile-required verification.
```

退出码：`10`，表示 Gate 尚未满足；不是命令执行错误。

## 场景 4：进入人工视觉验收

```powershell
node skills/workflow-story-map/scripts/story.mjs human-checklist `
  --ticket ticket-I42
```

候选输出：

```text
AWAITING_HUMAN · profile=implementation@3
subject=git:509ea05b
authorized capability=human-test.visual

[ ] VIS-1  打开 Desktop 后拖动预览面板
    expected: 宽度在重启后保持，主内容区无覆盖
[ ] VIS-2  将窗口缩到最小支持宽度
    expected: Graph 仍可平移，Gate 面板不遮挡主操作
[ ] VIS-3  切换到 backend RepoLane 再返回
    expected: 当前 ticket、缩放和展开层级保持

Agent cannot mark these items PASS.
Submit one evidence reference per item.
```

退出码：`30`，表示有必需人工输入，不能当作 PASS 或失败。

## 场景 5：ProfileRegistry digest 不匹配

```powershell
node skills/workflow-story-map/scripts/story.mjs resume `
  --story story-147
```

候选输出：

```text
DEGRADED_PROFILE_UNAVAILABLE
ticket: ticket-I42
expected profile: implementation@3 sha256:profile-abc
current profile:  implementation@3 sha256:profile-def

allowed: read, diagnose, pause, cancel, release
blocked: claim, dispatch, retry, publish-evidence, close, story-done

recover by restoring the exact Registry definition,
or return to Discovery and create a replacement ticket.
The existing ticket will not migrate in place.
```

退出码：`40`。历史仍可读，但交付不能推进。

## 场景 6：所有必需 RepoLane 完成

```powershell
node skills/workflow-story-map/scripts/story.mjs finish-check `
  --story story-147
```

纯 PASS：

```text
STORY DONE · story-147
contract revision=4 digest=sha256:contract-v4

desktop  integration=git:509ea05b  full-regression=PASS  human=PASS
backend  integration=git:91b0aa10  full-regression=PASS  human=N/A

required lanes terminal: 2/2
open required gates:      0
stale receipts counted:   0
waivers:                  0
```

退出码：`0`。

带显式风险接受：

```text
STORY DONE-WITH-WAIVER · story-147
desktop  integration=git:509ea05b  full-regression=PASS
backend  integration=git:91b0aa10  full-regression=WAIVED

waiver receipt-W-12 · owner=team-backend · expires=2026-09-15
follow-up gitlab:neon/TWE/aes-agent#801
PASS was not claimed for the waived gate.
```

退出码：`0`，但机器可读终态必须与纯 `DONE` 不同。

## 场景 7：保持不变的现有用法

下面两条现在能独立使用，改完之后仍必须保持相同 charter，不被 story 工作流吞并：

```text
$workflow-interview  → 只锁一个任务的目标、对照物和 Goal Contract，不实现目标
$wayfinder           → 路线未知时建立 planning map，route clear 即可交接，不默认交付代码
```

新版只新增 `$workflow-story-map` 组合入口；不会让旧入口自动创建跨仓 StoryRoot、Agent、worktree 或 merge。
