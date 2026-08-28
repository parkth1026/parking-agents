# Issue #99 — aes-worktree-board: dev 上 7 张已关票的交付代码被 reset 摘除，状态位与 Git 不一致
labels: ready-for-human, wayfinder:task | 2026-08-28 本会话所建，现因账号暂停 404

Part of #5

## 问题

**dev 上有 7 个已关票「已交付合入 dev」的 Issue，其交付代码不在 dev 里。**

2026-08-27 dev 分支上发生过两次 `git reset`，把四次已完成的 worker 合并从 dev 上摘掉了。
被摘掉的提交对象仍在仓库中，但**不被任何 ref 引用**（本地分支、远端分支均无），
`git branch -a --contains` 全空。

## 机械证据

dev reflog（自下而上读，`dev@{2026-08-27}`）：

```
ae5a369  merge worker-5      ← #62 交付
ede543f  merge worker-4      ← #64 交付
9bcf2e7  merge worker-4      ← #72 / #76 / #78 交付
5d3dfae  merge worker-3      ← #73 交付
dc2f675  reset: moving to dc2f675   ←【丢失点】以上四次合并被摘除
0aa0ba0  reset: moving to 0aa0ba0
...      merge worker-2 / worker-1 / parking-agents-manual2 / fix-zcode → f08033e
f08033e  reset: moving to f08033e   （dev 现值）
```

各票关闭评论自报的交付 SHA，逐个核对 dev 祖先关系：

| Issue | 关闭评论自报 | `git cat-file` | 在 dev 中 | 含它的分支 |
| --- | --- | --- | --- | --- |
| #62 | merge `ae5a369` / candidate `f9dcb87` | 对象存在 | **否** | 无 |
| #64 | merge `ede543f` / candidate `6b66ded` | 对象存在 | **否** | 无 |
| #65 | merge `d11f23a` / candidate `4b5bc35` | 对象存在 | **否** | 无 |
| #72 / #76 / #78 | merge `9bcf2e7` | 对象存在 | **否** | 无 |
| #73 | merge `5d3dfae` | 对象存在 | **否** | 无 |

代码层复核（当前 HEAD = dev 内容）：

- 全仓 `grep reviewerSessionId` 只在 `.aes-workflow/grilling/2026-08-28-issue70-loop-first-ruling/1-interview/context.md`
  命中一处「已交付」的**记述**，`.mjs` 代码零命中 —— #65 的 stage-result v2 不存在；
- `master.mjs:358` 的 `recordStageResult` 仍只接受 `aes.issue-worker.stage-result/v1`，
  无 `baseCommit` 必填、无 `MISSING_BASE_COMMIT` —— #62 的 v2 不存在；
- `merge-policy.mjs:102-124` 仍是六项门（slot/commit/integration/acceptance/review/qa），
  无 `GATE-review-base` / `GATE-qa-base` —— #62 的 base 失效检测不存在。

对照组：#84（`d19b81e`）、#83（`1126794`）、#86（`0e4ec20`）**确在 dev 中**，
说明不是全仓性问题，而是精确落在被 reset 摘掉的那一段。

## 影响

1. **七张票的关闭状态是假的**：状态位说交付，Git 说没有。这恰是本图既有原则
   「判定 merge 是否真的发生，问 Git 不问状态位」（2026-08-26 目标 A 收口裁定）
   所描述的失败形态本身 —— 只不过这次失效的不是 registry，是 Issue tracker。
2. **阻塞回路证明轮**：#98 要跑的是「纸面协议 vs 实跑」的偏差清单。在缺失
   #62/#65 的 dev 上跑，会把「代码根本不在」误记成「协议偏差」，产出的清单不可用，
   而 #94 是拿这份清单当设计输入的。
3. **#66 的验证面被削**：review depthTier 与证据 base 失效语义正是 #62/#65 交付的部分。

## 恢复可行性（已预演）

丢失线的最大覆盖点是 `5d3dfae`，相对 dev 独有 **24** 个提交。
`git merge-tree --write-tree dev 5d3dfae` 预演结果：核心实现文件
（`master.mjs` / `merge-policy.mjs` / `selftest-v4.mjs`）**全部自动合并成功**，
仅 3 个文件冲突：

- `.agents/skills/aes-worktree-board/references/design.md`（双方各自追加决策行）
- `.agents/skills/orchestrate-worktree-loop-zcode/scripts/zcode-threads-mcp.mjs`
  （#79 在两条线上各修了一次：dev 侧 `1b94e47`，丢失线侧另有其修法 —— 需判定取哪个）
- `.agents/skills/parking-skill-creator/references/trigger-eval.md`（add/add）

## 待裁（恢复策略）

- **A. 合并丢失线**：`git merge 5d3dfae` 进 dev，解 3 处冲突。保留全部历史与 QA 证据链，
  但会把 24 个提交一次性带回，其中含 #79 的重复修复需人工取舍。
- **B. 逐票 cherry-pick**：只捞回七张票的实现提交，弃合并结构。历史干净但丢失原
  QA 证据绑定的 SHA 血统。
- **C. 重做**：代价最高，且已有的独立 review / 十域 QA 证据全部作废。

倾向 A —— 冲突面已实测很小，且七张票的 receipt 全部绑在这条线的 SHA 上，
B/C 都会让既有证据链失效。

## 验收条件

- **AC-1**：`git merge-base --is-ancestor <每张票的 candidate SHA> dev` 对 #62/#64/#65/#72/#73/#76/#78 全部为真。
- **AC-2**：代码层复核翻绿 —— `reviewerSessionId` 在 `.mjs` 中存在且 review stage-result v2
  强制校验；`GATE-review-base` / `GATE-qa-base` 出现在 `merge-policy.mjs` 的门项列表中。
- **AC-3**：`run-tests.mjs` 十域全绿（丢失线自带的 selftest 用例一并回来且通过）。
- **AC-4**：#79 的重复修复取舍有明确结论并记录理由（该票仍 OPEN，取舍结果回写票面）。

## 根因侧（本票范围外，另议）

`git reset` 能把已合并的交付从 dev 上静默摘除，且七张票无一察觉 —— 关票动作只信
自己写下的 SHA，从不回问 Git「它还在吗」。是否需要一道机械检查（关票前/巡检时
校验 candidate SHA 的 integration 祖先关系）另行评估，不在本票。
