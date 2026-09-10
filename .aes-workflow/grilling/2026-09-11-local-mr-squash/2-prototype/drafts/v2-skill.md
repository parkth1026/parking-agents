<!-- draft v2 | published 2026-09-11
     用户意见：R3 总反思后重写（机制版推翻）
     状态：confirmed（2026-09-11 用户确认「好的 请继续」） -->

---
name: local-mr-squash
description: Use when squash-merging a feature/work branch into the main branch locally — PR-style squash flow with semantic merge, provenance commit message, and a hard safety-gate script. 触发：把 X 分支 squash 合过来 / 本地 PR 流程合并 / squash merge 到主干。
---

把源分支以 PR squash 等价方式合入主干：语义合并、单笔提交、溯源留痕、硬门禁验收。

1. **预检**：目标分支工作树干净；源分支有领先提交。记下源分支 tip 与 merge-base（写进最终 commit message 的溯源块）。

2. **Squash**：`git merge --squash <source>`。

3. **语义合并**（冲突时，内嵌 resolving-merge-conflicts 核心）：看合并现场与历史；溯源每个冲突的原始意图——读双侧 commit message 与分支历史，commit 引用了 issue 且取得到原文时取来读；逐 hunk 优先保双方意图，不相容时按本次合并的既定目标裁决并**记下取舍**；不发明第三种行为；永不 `--abort`。

4. **自动检查**：发现本项目的自动检查（typecheck / tests / format，或 ./run 类契约的等价动作）并跑到绿——这是 commit 的硬前置。调用方可在此插话更重的验收（code-review / 真测档位），验收结论摘要进 commit message；commit 时机由调用方说了算。

5. **单笔 commit**：message 必含溯源块——原分支提交 hash 清单、冲突裁决摘要（每条：文件+裁决+取舍一句话）、已跑检查清单。

6. **源分支收口**：前滚（未被 worktree 检出 → `git branch -f <source> HEAD`；被检出且彼处树净、tip 未前进 → 在彼处 `git merge <target>`）或删除（短命特性流）。拿不准就问，不猜。

7. **硬门禁**：`node <skill-dir>/scripts/verify-squash-merge.mjs <source>` 四项全绿（退出码 0）才算合并完成；非零按提示修复后重跑。`--keep` 是「明知未收口仍要放行」的显式逃生门，用了要在报告里说出来。

永不：`--abort`、改写已推送历史、门禁没绿就宣称合并完成。
