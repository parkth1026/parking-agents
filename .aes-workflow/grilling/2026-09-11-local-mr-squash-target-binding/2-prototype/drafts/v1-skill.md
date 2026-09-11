<!-- draft v1 | published 2026-09-11
     用户意见：待确认（1-interview 三问全按推荐拍板后的首版实文）
     状态：draft（此件即产品本体：修订后 local-mr-squash 的 SKILL.md 实文） -->

---
name: local-mr-squash
description: 仅限用户显式点名时使用：用户原话出现 local-mr-squash（如「用 local-mr-squash 合并」「按 local-mr-squash 流程走」「$local-mr-squash」）才加载本技能；用户未点名时不要自动选它——常规合并分支、squash 压缩提交、解决 merge/rebase 冲突等请求不适用（冲突解决用 resolving-merge-conflicts）。点名后的用途：把源分支以 PR squash 等价方式合入本地主干——五步语义合并裁决冲突、溯源块 commit message、分支收口、四项硬门禁脚本验收。
---

把源分支以 PR squash 等价方式合入目标分支（dev/main 等长命分支）：语义合并、单笔提交、溯源留痕、硬门禁验收。

1. **预检**：确认当前检出就是要合入的目标分支——本流程全程在目标检出里执行，源≠当前检出，不在就先切过去；目标工作树干净；源分支有领先提交。记下源分支 tip 与 merge-base（写进最终 commit message 的溯源块）。

2. **Squash**：`git merge --squash <source>`。

3. **语义合并**（冲突时，内嵌 resolving-merge-conflicts 核心）：看合并现场与历史；溯源每个冲突的原始意图——读双侧 commit message 与分支历史，commit 引用了 issue 且取得到原文时取来读；逐 hunk 优先保双方意图，不相容时按本次合并的既定目标裁决并**记下取舍**；不发明第三种行为；永不 `--abort`。

4. **自动检查**：发现本项目的自动检查（typecheck / tests / format，或 ./run 类契约的等价动作）并跑到绿——这是 commit 的硬前置。调用方可在此插话更重的验收（code-review / 真测档位），验收结论摘要进 commit message；commit 时机由调用方说了算。

5. **单笔 commit**：message 必含溯源块——原分支提交 hash 清单、冲突裁决摘要（每条：文件+裁决+取舍一句话）、已跑检查清单。

6. **源分支收口**：前滚（未被 worktree 检出 → `git branch -f <source> HEAD`；被检出且彼处树净、tip 未前进 → 在彼处 `git reset --hard <target>`，源引用前滚到 HEAD，彼处未提交改动会被丢弃）或删除（短命特性流；源被 worktree 检出时先拆该 worktree 或彼处切走再删）。源已推送到远端时移动引用会与远端分叉、再推即改写已推送历史——撞红线，停下问。拿不准就问，不猜。

7. **硬门禁**：`node <skill-dir>/scripts/verify-squash-merge.mjs <source>` 四项全绿（退出码 0）才算合并完成；非零按提示修复后重跑。`--keep` 是「明知未收口仍要放行」的显式逃生门，用了要在报告里说出来。

永不：`--abort`、改写已推送历史、门禁没绿就宣称合并完成。
