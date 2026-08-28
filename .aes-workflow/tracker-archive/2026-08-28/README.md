# Tracker 抢救存档 2026-08-28

## 为什么有这个目录

`piaotonghu` 账号被 GitHub 暂停后，该账号创建的全部 Issue 对其他账号（含仓库 admin
`parkth1026`）返回 404。受影响范围 = parking-agents 仓 **#45 及以后的全部 Issue**，
外加 #5、#15 等由该账号创建的早期票 —— 其中包含**全部 wayfinder map**。

`parkth1026` 视角当前只可见 38 张票（#6–#44，全部由 parkth1026 创建）。

本目录保存的是 2026-08-28 wayfinder 会话中、账号失效**之前**实际读取到的票面正文，
逐字转存。这是这些票现行版本在 GitHub 之外的唯一副本。

## 覆盖范围

| 文件 | 内容 | 完整度 |
| --- | --- | --- |
| `issue-005-map-aes-worktree-board.md` | map #5 正文 | 完整 |
| `issue-082-map-aes-issue-worker.md` | map #82 正文 | 完整 |
| `issue-094-aes-merge-worker.md` | #94 正文 + 2 条评论 | 完整 |
| `issue-098-manual-merge-worker-run.md` | #98 正文 | 完整 |
| `issue-066-high-critical-live.md` | #66 正文 + 评论 | 正文完整；第 3 条评论尾部截断 |
| `issue-069-duplicate-section.md` | #69 正文（含契约块） | 完整 |
| `issue-099-lost-delivery.md` | #99 正文（本会话所建，现 404） | 完整（本地原稿） |
| `closing-comments-62-64-65.md` | #62/#64/#65 关闭评论 | 完整 |

## 未覆盖（已丢失可见性且本会话未读取）

#15、#46–#61、#63、#67、#68、#70、#71、#74、#75、#77、#80、#81、#83–#93、#95–#97
的正文与评论。其中 #70（下一轮投入裁定）与 #83（v7 流程重梳）是路线的关键裁定档案，
仅在 map #5 的 Decisions so far 里留有一行摘要。

**注**：`.agents/skills/aes-worktree-board/fixtures/parking-agents-issues.json` 存有
#1–#45 的 P0 期快照，但为**过期版本**（例如 #5 仍是旧标题「改为 Orchestrator Agent +
create_thread 的 Issue × Worktree 编排」，正文为 P0 轮规格），不能当现行副本用。

## 恢复路径

账号暂停是 GitHub 侧状态，本地 token 刷新不解决。申诉恢复后内容会自动重新可见，
本目录即可作废。若确定无法恢复，则以本目录 + fixture 快照为底重建 map。
