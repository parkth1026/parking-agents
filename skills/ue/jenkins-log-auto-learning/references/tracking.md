# 跟踪账本（analyzed-builds.json）

`{trackFile}` 是长期账本：记录每个构建的终态与每轮运行的统计。**本技能侧唯一写入者是 `scripts/session.mjs`**（scan-pairs.mjs 在扫描时顺带写入 success/skip 类**终态事实**条目）——Agent 不用 Edit/Write 直接改它。

账本文件由 session.mjs / scan-pairs.mjs 以 tmp+rename 原子替换写入（崩溃/断电只会看到完整旧文件或完整新文件）；读取方遇到损坏 JSON 会报错退出并给恢复指引，不会以空账本覆盖历史。

## 结构

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
  "healed_no_fix": {
    "job/path#1199": true
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

## `analyzed{}` 值 grammar

每个条目使用一致的格式（session.mjs 收尾时校验）：
- FAILURE 有知识：`"failure:score={0..10}:{ErrorCode}:fix=#{successBuild}"`；重复模式追加 `":see={existingFile}"`（必须指向 rawDir/wikiDir 内已存在的知识文件）
- FAILURE 基础设施：`"failure:infra:{reason}"`
- FAILURE 无修复：`"failure:no-fix-found"`（**只由 pair-analyze 的十构建前瞻结论写入**；扫描不预写——"还没等到修复"是瞬态负结果，等修复到来后下轮扫描自然配对）
- FAILURE 日志不可用：`"failure:log-unavailable"`
- FAILURE 分析失败：`"failure:error:{reason}"`
- SUCCESS：`"success:w={warningCount}"`（scan 预记为 `success:w=?`，分析时覆盖为实测警告数）
- 跳过：`"skip:{ABORTED|NOT_BUILT|...}"`（终态事实；**BUILDING 是 Jenkins 进行中语义，扫描不落账**）

**收尾机械门禁**（session.mjs stage done 时强制，违反即拒绝收尾）：
- score 限定 0-10（scoring.md 满分 10）
- `--knowledge` 文件必须真实存在且位于 `knowledgeBase.rawDir` 内（"只写 rawDir"约束的机械化）
- 知识文件必须有一级标题，且内容包含结论串的错误码 token（score 型取 ErrorCode，infra 型取 reason）——search-kb 按内容检索，缺 token 的文件等于沉底

## `healed_no_fix{}`（可选，scan 维护）

旧版 scan 曾把"扫描时还没等到修复"的失败组预写成 `failure:no-fix-found`，导致修复到来后该对被永久排除。扫描遇到这类**旧版预写**且其组如今已有 SUCCESS 修复时：删键回炉入队，并在此记录一次性自愈（防止 pair-analyze 后来合法地再结论为 no-fix 时被无限重开）。新账本通常为空。

## `runHistory[]` 条目字段（固定 7 字段，由 finish/abandon 追加）

- `timestamp` —— 本地时间 yyyy-MM-ddTHH:mm:ss
- `buildsAnalyzed` —— 本轮处理的构建数量
- `buildsSkipped` —— skip 类条目对应的构建数量
- `failurePairsFound` —— 分析的 FAILURE→SUCCESS 对数量
- `infraFailures` —— 基础设施故障数量（无代码更改）
- `knowledgeWritten` —— 创建或更新的新知识文件数量
- `remaining` —— 落账后所有任务中估计的未分析构建对数量

`last_analyzed[job.path]` 由 finish 更新为本轮最高构建号。仅供参考。

**已知无害限制**：finish 先写账本再写 workflow.json，两写之间崩溃的微秒窗口被恢复后重跑 finish 会重复推入一条 runHistory（analyzed 键本身幂等，仅统计虚增一条）。不修——重排写入顺序的代价是整对重新分析，比重复记账更差。

## 与 workflow.json 的关系

`{rawDir}/workflow.json` 是**进行中那一对**的会话状态（领取锁、阶段门禁、结论指针），会话终结后保留为"上一轮"记录；账本才是跨轮次的长期事实。二者都只由 session.mjs 写。
