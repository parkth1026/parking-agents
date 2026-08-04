# 阶段 1：分析当前构建对

处理阶段 0 选出的那一个 FAILURE→SUCCESS 构建对。

## ABORTED 或 NOT_BUILT

在跟踪中记录为 `"skip:{result}"` 并继续。不下载日志。

## FAILURE —— 核心分析流程

1. **查找修复构建**：从此 FAILURE 向前查找同一任务中的下一个 SUCCESS 构建。
   - 如果在后续 10 个构建内未找到 SUCCESS → 记录为 `"failure:no-fix-found"`，跳过
   - 如果 SUCCESS 构建已被分析过，没关系——我们仍需要 FAILURE 的错误信息

2. **下载 FAILURE 日志**：
   ```
   curl.exe -s "{baseUrl}/job/{job.path}/{failBuild}/consoleText" --globoff --max-time 120 -o {tmpDir}/logs/fail-{job.name}-{failBuild}.log
   ```
   如果 FAILURE 日志返回 HTTP 404 或空响应（构建已归档/删除），在跟踪中记录为 `"failure:log-unavailable"` 并跳到下一个构建对。

   如果磁盘上保存的日志文件超过 500KB，删除它并使用错误行过滤重新下载：
   ```powershell
   $log = curl.exe -s "{baseUrl}/job/{job.path}/{failBuild}/consoleText" --globoff --max-time 120
   $log -split "`n" | Where-Object { $_ -match 'error|fatal|warning|LNK|ExitCode|FAILED' } | Set-Content "{tmpDir}/logs/fail-{job.name}-{failBuild}.log" -Encoding UTF8
   ```

3. **从 FAILURE 日志中提取错误**：
   - 搜索匹配以下模式的行：`error C\d+:`、`error CS\d+:`、`fatal error`、`LNK\d+:`、`ExitCode`、`FAILED`
   - 提取：错误代码、文件路径、行号、错误消息
   - 按唯一的错误代码+文件组合分组

4. **在 SUCCESS 日志中验证修复**（精简——只需确认错误已消失）：
   ```powershell
   $successLog = curl.exe -s "{baseUrl}/job/{job.path}/{successBuild}/consoleText" --globoff --max-time 120
   $errorLines = $successLog -split "`n" | Where-Object { $_ -match 'error C\d+:|error CS\d+:|fatal error|LNK\d+:' }
   ```
   如果 `$errorLines` 为空 → 确认已修复。

5. **获取修复提交**：

   首先尝试 changeSet API：
   ```
   curl.exe -s "{baseUrl}/job/{job.path}/{successBuild}/api/json?tree=changeSet[items[commitId,msg,affectedPaths,author[fullName]]]" --globoff
   ```

   **回退方案**（changeSet 为空——WorkflowRun 流水线任务常见）：
   下载 SUCCESS 构建的控制台日志并从中提取提交信息：
   - `Checking out Revision <hash>` 或 `> git checkout <hash>` 行
   - 包含插件名 + 提交哈希 + 消息的微信/通知消息
   - 比较 FAILURE 和 SUCCESS 控制台日志中每个子模块的不同提交哈希

   此回退方案是此 Jenkins 实例中大多数任务的**预期路径**。不要将空 changeSet 视为错误。

6. **关联错误 ↔ 提交**：
   - 对每个错误文件（例如 `SomeClass.cpp`），检查是否有提交的 `affectedPaths` 涉及该文件或其头文件
   - 提交消息包含"fix"、"修复"、错误代码或类名可增强关联性
   - 如果提交直接修改了错误文件 → 强验证
   - 如果没有提交关联 → 标记为 `"weak"` 验证

7. **分析根因和修复**：
   基于错误类型、提交 diff 上下文和 UE5 知识，确定：
   - **什么坏了**：具体错误（例如 "C2061: FZoneGraphBuildData undeclared"）
   - **为什么坏了**：根本原因（例如 "API 重构后缺少 #include"）
   - **怎么修的**：来自提交的具体代码更改（例如 "添加了 #include ZoneGraphTypes.h"）
   - **如何预防**：将来如何避免此问题

8. **查询 Epic 官方 UE5 助手** —— 参见 [epic-query.md](epic-query.md)

   调用 `epic-ue-assistant` 技能获取权威的引擎层面解释。跳过查询的情况：基础设施故障、重复模式（已有 Epic 指导）。每次构建最多 3 个查询。详细的查询构造、响应提取、空响应处理、速率限制等规则参见参考文件。

9. **对发现进行评分** —— 参见 [scoring.md](scoring.md)

10. **如果评分 < 8 则进行反思**：如果初始评分低于 8，暂停并自问：
    - **我是否获取了真实 diff？** 检查 `{gitRepos}` 中的修复提交。如果你只是从提交消息推断修复内容，再努力一下——在 `{gitRepos}` 下每个仓库执行 `git show`。真实 diff 可以将 Reuse 从 0 提升到 +1。
    - **我是否遗漏了错误细节？** 重新阅读日志，查找可能提高 Info 评分的文件路径、行号或次要错误。
    - **这真的是基础设施问题吗？** 如果你将其分类为基础设施问题但 FAILURE 和 SUCCESS 之间确实有代码 diff，重新考虑——可能是真正的代码修复。
    - **能否找到更好的修复构建？** 也许紧邻的下一个 SUCCESS 仍然有错误；再检查一个后续构建。

    反思后重新评分。如果评分提高到 >= 8，写入 `details/` 而不是 `scratch/`。如果未提高，接受评分并继续。

    目标是在写入之前最大化每个知识文件的质量。一个通过找到真实 diff 从 7 变成 8 的文件值得额外付出。

11. **写入知识文件** —— 参见 [knowledge-format.md](knowledge-format.md)

## 阶段 1 检查清单（进入阶段 2 前核验）

- [ ] 日志已下载（或记录为 `log-unavailable`）？
- [ ] 错误已提取并分组？
- [ ] 修复构建已识别且确认错误已消失？
- [ ] 提交已获取（API 或控制台日志回退）？
- [ ] 错误 ↔ 提交关联完成（强或弱）？
- [ ] 基础设施检查：FAILURE 和 SUCCESS 之间代码相同 → 基础设施问题而非代码修复？
- [ ] 重复模式检查：是否已存在相同错误+根因的知识文件？
- [ ] Epic 查询已发送（除非是基础设施问题或重复模式）？
- [ ] 已评分（参见 scoring.md）？
- [ ] 如果评分 < 8 已进行反思（真实 diff？遗漏细节？误分类为基础设施？）？
- [ ] 文件位置已决定（details/ vs scratch/ vs 跳过）？

## SUCCESS 构建（独立的，非作为修复构建）

- 快速警告检查——下载日志并统计编译器警告数：
  ```powershell
  $log = curl.exe -s "{baseUrl}/job/{job.path}/{build}/consoleText" --globoff --max-time 60
  $warnings = ($log -split "`n" | Where-Object { $_ -match 'warning C\d+:|warning CS\d+:' }).Count
  ```
- 在跟踪中记录为 `"success:w={warnings}"`
- 如果警告数量与同一任务的上一个 SUCCESS 相比增加超过 30% → 在 `scratch/` 中写一条简短的警告趋势说明
- 如果警告数量显著下降（> 50%）→ 同样在 `scratch/` 中记录为正面趋势
- 否则只跟踪并继续。仅 SUCCESS 的构建优先级较低。

## 连续 FAILURE 构建

当多个 FAILURE 构建共享相同的 SUCCESS 修复构建和相同的错误模式时，为该组写一个知识文件。在标题中引用所有 FAILURE 构建号。只有在错误确实不同时才分开写文件。

## 基础设施/不稳定故障

如果 FAILURE 及其修复 SUCCESS 代码完全相同（相同提交，两者之间无代码更改），则故障很可能是基础设施问题（陈旧的增量构建、OOM、网络超时、磁盘满等）。在跟踪中记录为 `"failure:infra:{reason}"`。仅当该模式对 CI 维护有用时才写入 `scratch/`。
