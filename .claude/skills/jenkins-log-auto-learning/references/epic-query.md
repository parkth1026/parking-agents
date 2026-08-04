# Epic 查询指南

步骤 8 的完整规则：查询 Epic 官方 UE5 助手以获取权威指导。

提取错误代码、错误消息和上下文（文件路径、行号）后，调用 `epic-ue-assistant` 技能的 PowerShell 模块获取 Epic 官方解释。这为知识文件添加了一个权威的"第二意见"——读者既能获得项目特定的修复方案，又能获得引擎层面的解释。

```powershell
Import-Module "<skill-dir>/../epic-ue-assistant/scripts/EpicAssistant.psm1" -Force

# Build a focused question with the actual error context
$question = "UE5.5 C++ compilation error: $errorCode in file $filePath at line $lineNumber. Error message: $errorMessage. What causes this and how to fix it?"

$epicResult = Invoke-EpicAssistantQuery -Question $question
```

其中 `<skill-dir>` 是包含此 SKILL.md 的目录（即 `D:\Claude_skills\.claude\skills\jenkins-log-auto-learning`）。

**如何构造问题**：包含尽可能多的具体上下文——确切的错误代码、文件路径、行号以及 1-2 行错误消息。像"error C2061: identifier 'FTextureRenderTargetResource' in EarthExtractTexturePrefab.h line 52"这样具体的问题比泛泛的"what is C2061"效果好得多。

**从响应中提取什么**：
- `$epicResult.AgentAnswer` —— markdown 格式的解释（首选，不一定存在）
- `$epicResult.HtmlAnswer` —— HTML 回退（始终存在）
- `$epicResult.References` —— 官方 Epic 文档链接数组（`{Title, Url, Description, Type}`）

**何时跳过 Epic 查询** —— 仅限以下情况：
1. 基础设施故障（OOM、磁盘满、网络超时、Perforce 许可证错误）—— Epic 不会对 CI 基础设施问题提供指导
2. 重复出现的错误模式，且已有知识文件包含了相同错误代码和根因的 Epic 指导（参见"重复出现的错误模式"章节）

所有其他代码相关错误——包括"一目了然"的错误——都应查询。即使是常见的缺少 `#include` 错误也能从 Epic 的 IWYU 参考和官方最佳实践链接中获益。读者可能不了解引擎惯例。

**一次构建中的多个错误**：如果一个构建有多个不同的错误代码，为每个唯一错误代码查询 Epic（每次构建最多 3 个查询）。如果有超过 3 个不同错误，选择最重要的 3 个（主要编译错误优先于级联/次要错误）。如果同一构建中同一错误代码出现在多个文件中，复用同一 Epic 响应。

**空响应处理**：如果 `$epicResult.AgentAnswer` 和 `$epicResult.HtmlAnswer` 都为空但 `$epicResult.References` 有内容，SSE 流可能在 answer 事件之前被截断。用更短、更聚焦的问题重试一次（仅错误代码和一行摘要）。如果重试也失败，使用已返回的 References 并在知识文件中注明"Epic answer truncated — references only"。

**如果查询完全失败**（网络错误、速率限制、重试后仍为空响应）：记录警告并继续。在知识文件中写"Epic query unavailable — analysis based on project context only"。不要因 Epic API 不可用而阻塞流水线。

**速率限制**：连续的 Epic 查询之间添加约 5 秒延迟以避免触发速率限制。每个查询本身需要约 60-120 秒完成（网络往返 + 响应生成）；5 秒延迟是查询之间的额外冷却时间。一个有 3 个不同错误的构建总共约增加 3-6 分钟的 Epic 查询时间。
