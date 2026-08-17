# 错误分布统计（mixed-case.log）

- 源文件：`input/mixed-case.log`（共 7 行，其中错误行 6 行，1 行为 INFO）
- 错误级别匹配不区分大小写（`ERROR` / `Error` / `error` 均计入）
- 同型错误归并：仅变量部分不同（attempt 序号、超时时长）的记录合并为一个错误模式
- 合计：3 类错误模式，共 6 次

| 错误模式 | 次数 | 代表样例（原始行） |
|---|---|---|
| job "payment-sync" failed (attempt N) | 2 | `2026-08-15 10:00:01 ERROR job "payment-sync" failed (attempt 3)` |
| cannot read config from /etc/app/settings.yaml | 2 | `2026-08-15 10:00:05 Error: cannot read config from /etc/app/settings.yaml` |
| connection timeout after Ns to db-primary:5432 | 2 | `2026-08-15 10:00:06 error connection timeout after 30s to db-primary:5432` |

## 说明

- 排序：按次数降序；次数相同（均为 2）时按日志中首次出现顺序排列。
- 归并细节：
  - `attempt 3`（10:00:31 为 `attempt 4`）归并为同一模式 `attempt N`。
  - `after 30s` / `after 60s` 归并为同一模式 `after Ns`。
  - `cannot read config from /etc/app/settings.yaml` 两次出现内容完全一致。
- 各模式的 3 种大小写变体均被识别：job 失败两次均为 `ERROR`，配置读取失败两次均为 `Error:`，连接超时两次均为 `error`。
