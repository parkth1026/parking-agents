# 阶段 0：获取下一个待分析的构建对

```
1. 读取 config.json → 获取 tmpDir、knowledgeBase（wikiDir + rawDir）、trackFile
2. 检查 {skill-dir}/tmp/ 中是否存在 pending-pairs.json
   → 如果不存在，或文件超过 1 小时：先运行扫描脚本：
     powershell -File {skill-dir}/scripts/scan-pairs.ps1
     这会生成 pending-pairs.json，包含所有启用任务的全部 FAILURE→SUCCESS 对。
     如果 scan-pairs.ps1 以非零退出码结束或 pending-pairs.json 未生成，报告错误并停止。不要使用过期或缺失的 pairs 文件继续。
3. 读取 pending-pairs.json → 获取 pairs 数组
   如果 pairs 数组为空，报告"所有启用任务中未找到 FAILURE→SUCCESS 构建对"并停止。
4. 读取 {trackFile} → 获取已分析构建集
5. 找到第一个其 failBuilds 尚未全部在 analyzed{} 中的构建对
6. 如果没有未分析的对：
   → 重新运行扫描脚本以获取上次扫描后的新构建
   → 如果仍然没有 → 回复"没有新的构建对需要分析"并停止
```

## 扫描脚本说明

扫描脚本（`scripts/scan-pairs.ps1`）一次性完成繁重工作：
- 通过 Jenkins API 拉取所有启用任务的所有构建
- 立即在跟踪中记录 SUCCESS/ABORTED/NOT_BUILT（无需下载日志）
- 识别所有 FAILURE→SUCCESS 对，并将连续的具有相同修复的 FAILURE 合并
- 写入 `pending-pairs.json`

每次执行轮次处理列表中的**一个**构建对。定时任务控制节奏。
