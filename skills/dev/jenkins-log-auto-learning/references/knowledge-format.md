# 知识文件格式

## 文件命名

使用 **FAILURE 构建号**作为主标识符，而非自增序号。这避免了多次运行写入文件时的冲突。

格式：`{job-short}-{failBuild}-{ErrorCode}-{ShortDesc}.md`

示例：
- `twe-898-LNK1120-TiffJpegUnresolved.md`
- `aes6-3746-CookFail-UassetVersionTooNew.md`
- `aes6-3913-C1083-TextureRenderTargetResource.md`

对于具有相同错误的连续 FAILURE 构建，使用第一个构建号：
- `twe-898-903-LNK1120-TiffJpegUnresolved.md`（覆盖 #898 到 #903）

## 文件位置

- 评分 >= 8 → `{knowledgeBase.rawDir}/details/{filename}`
- 评分 5-7 → `{knowledgeBase.rawDir}/scratch/{filename}`
- 评分 < 5 → 不写入（仅在跟踪中记录）

## 写入前检查已有文件

在 `{knowledgeBase.wikiDir}/details/` 和 `{knowledgeBase.rawDir}/details/`（以及它们的 `scratch/` 对应目录）中搜索包含相同构建号或错误模式的文件。如果在 rawDir 中找到，更新现有文件而不是创建新文件。如果在 wikiDir 中找到，按重复模式处理（见下文）——绝不直接修改 wikiDir 文件。

## 重复出现的错误模式

如果你发现一个已有的知识文件（在 wikiDir 或 rawDir 中）具有**相同的错误代码和相同的根因**（例如另一个"UAsset version too new"烹饪失败，或另一个"missing #include TextureResource.h"）：

1. **不要创建新的占位文件**仅说"参见其他文件"
2. 如果已有文件在 **rawDir** 中：直接在该文件中追加 `## Recurrences` 章节（如果已存在则更新）：
   ```markdown
   ## Recurrences
   | Date | Builds | Trigger | Notes |
   |------|--------|---------|-------|
   | 2026-04-09 | #3877 → #3878 | WBP_DomManager.uasset saved with UE5.4 | Same root cause, different asset file |
   ```
   如果已有文件在 **wikiDir** 中（只读）：在 `{knowledgeBase.rawDir}/details/` 中创建新文件 `recurrence-{existingFileName}`，包含 Recurrences 表格和指向 wikiDir 原始文件的引用。绝不修改 wikiDir 文件。
3. 在跟踪中记录新构建为 `"failure:score={N}:{ErrorCode}:fix=#{successBuild}:see={existingFile}"` —— `:see=` 后缀告诉读者哪个知识文件涵盖了此问题
4. 对重复模式跳过 Epic 查询——原始文件已包含此错误类型的 Epic 指导

## details/ 的必需内容（评分 >= 8）

知识库的全部意义在于帮助将来遇到相同错误的人。每个 details/ 文件应包含：

```markdown
# {ErrorCode}: {Brief description}

> **Score**: X/10 | **Job**: {job.name} | **Date**: YYYY-MM-DD
> **Builds**: #{failBuild} (FAILURE) → #{successBuild} (SUCCESS)
> **Scoring**: Info {n}/3 + Diff {n}/2 + Commit {n}/3 + Reuse {n}/2 = {total}/10

## Error Message
(paste the actual error lines from the log — 1 to 5 lines)

## Root Cause
(what went wrong and why — not "possibly" or "may have", give a definite analysis)

## Fix
(the concrete code change that fixed it, based on the commit)
- **Commit**: {hash} by {author}
- **Message**: "{commit message}"
- **What changed**: (describe the specific code change)

## How to Reproduce / Detect
(how would someone know they have this same problem)

## Epic Official Guidance
(response from Epic's UE5 AI assistant — provides the engine-level explanation)
- **Query**: "{the question sent to Epic}"
- **Answer**: (paste the key parts of Epic's response — focus on the explanation, not boilerplate)
- **References**: (list any official Epic doc/learning links returned)

If the Epic query failed or returned no useful information, write: "Epic query unavailable — analysis based on project context only."

## Prevention
(how to avoid this in future — 1-3 bullet points)
```

如果你无法有信心地确定根因，请明确说明——但仍需提供错误详情和提交信息。

## scratch/ 的内容（评分 5-7）

可以使用更简短的格式，但仍必须包含：错误消息、构建号以及任何可用的部分分析。
