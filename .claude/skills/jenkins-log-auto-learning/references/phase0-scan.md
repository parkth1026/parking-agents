# 阶段 0：获取下一个待分析的构建对

```
1. node {skill-dir}/scripts/session.mjs status
   → 有进行中的会话：按输出的 next: 指针续跑（通常直接进入子技能或 finish），阶段 0 结束
   → 无会话：继续下一步
2. 看 status 输出的 pending-pairs 行：
   → 不存在，或超过 1 小时（status 会提示）：先跑扫描脚本
     node {skill-dir}/scripts/scan-pairs.mjs
     缺省输出到 {trackFile} 同目录的 pending-pairs.json（不在技能目录内）。
     如果 scan-pairs.mjs 以非零退出码结束或 pending-pairs.json 未生成，报告错误并停止。
     不要使用过期或缺失的 pairs 文件继续。
3. node {skill-dir}/scripts/session.mjs next
   → 领取成功：输出被领取的构建对，阶段 0 结束，进入子技能 jenkins-pair-analyze
   → "没有新的构建对需要分析"：重跑一次 scan-pairs.mjs 拉取新构建后再 next；
     仍然没有 → 向用户报告并停止
   → "已有进行中的会话"（单实例锁）：回到第 1 步按续跑指针处理；
     确认会话僵死（上次运行已中断且无法续）才可 session.mjs abandon --reason "..."
```

选取逻辑（哪些对算"待分析"）由 `session.mjs next` 决定：pending-pairs.json 中第一个 failBuilds 未全部落账 analyzed{} 的对。Agent 不自行挑选、不手工跳过。

## 扫描脚本说明

扫描脚本（`scripts/scan-pairs.mjs`）一次性完成繁重工作：
- 通过 Jenkins API 拉取所有启用任务的所有构建
- 立即在跟踪中记录 SUCCESS/ABORTED/NOT_BUILT 等**终态事实**（无需下载日志）
- 识别所有 FAILURE→SUCCESS 对，并将连续的具有相同修复的 FAILURE 合并
- 写入 `pending-pairs.json`（{trackFile} 同目录；`--output` 可覆盖）

**瞬态不落账**（定时持续积累的关键约束）：
- BUILDING（进行中）不落账，下轮重扫重判
- 尾部失败组（后面还没有 SUCCESS）不预写 `no-fix-found`——修复到来后下轮扫描自然配对
- 自愈旧版账本：旧版预写的 `failure:no-fix-found`（其组如今已有 SUCCESS 修复）删键回炉入队，`healed_no_fix{}` 记录一次性自愈；旧版冻结的 `skip:BUILDING` 删除后按真实结果重判

**失败语义**：
- 全部启用任务不可达 → exit 1 且**不生成** pending-pairs.json（Jenkins 挂了 ≠ 没有新失败；上面的"报告错误并停止"守卫由此触发）
- 部分任务不可达 → WARN + exit 0，末尾输出 "N/M 个任务不可达"（本次结果不完整但可用）

**技能目录零写入**：所有运行时产物（pending-pairs.json、workflow.json、下载的日志、跟踪文件）都落在配置指定的 rawDir/tmpDir 内，技能目录只保留静态文件（SKILL.md、references、scripts、config）。

配置加载与校验逻辑在 `scripts/config.mjs`（技能默认 ⊕ 环境层深合并、BOM 容错、`~/` 展开、账本原子写与损坏优雅报错），scan-pairs.mjs 与 session.mjs 共用。
