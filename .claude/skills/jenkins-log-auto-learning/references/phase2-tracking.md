# 阶段 2：更新跟踪

分析完每个构建后，立即更新 `{trackFile}`。

每次写入前重新读取文件以避免覆盖并发更改（防御性措施，尽管单实例是规则）。

## 跟踪文件结构

```json
{
  "last_analyzed": {
    "job/path": 1234
  },
  "analyzed": {
    "job/path#1230": "failure:score=8:C2061:fix=#1231",
    "job/path#1231": "success:w=164",
    "job/path#1232": "skip:ABORTED",
    "job/path#1233": "failure:no-fix-found"
  },
  "runHistory": [
    {
      "timestamp": "2026-04-09T10:00:00",
      "buildsAnalyzed": 10,
      "buildsSkipped": 2,
      "failurePairsFound": 3,
      "infraFailures": 1,
      "knowledgeWritten": 2,
      "remaining": 180
    }
  ]
}
```

## `analyzed{}` 值格式

每个条目使用一致的格式：
- FAILURE 有知识：`"failure:score={N}:{ErrorCode}:fix=#{successBuild}"`
- FAILURE 基础设施：`"failure:infra:{reason}"`
- FAILURE 无修复：`"failure:no-fix-found"`
- FAILURE 日志不可用：`"failure:log-unavailable"`
- SUCCESS：`"success:w={warningCount}"`
- 跳过：`"skip:{ABORTED|NOT_BUILT}"`

## `runHistory[]` 条目字段（固定格式）

每个 runHistory 条目必须恰好包含以下字段：
- `timestamp` —— ISO 8601
- `buildsAnalyzed` —— 本轮处理的构建数量
- `buildsSkipped` —— ABORTED + NOT_BUILT 数量
- `failurePairsFound` —— 分析的 FAILURE→SUCCESS 对数量
- `infraFailures` —— 基础设施故障数量（无代码更改）
- `knowledgeWritten` —— 创建或更新的新知识文件数量
- `remaining` —— 所有任务中估计的未分析构建数量

将 `last_analyzed[job.path]` 更新为本轮分析的最高构建号。这仅供参考。
