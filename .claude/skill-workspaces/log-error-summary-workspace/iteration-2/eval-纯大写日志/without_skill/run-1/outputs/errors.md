# 构建日志错误分布统计

- 来源：`build-errors.log`（build 4127，2026-08-16）
- ERROR 记录总数：5 条，归并为 3 种错误模式

| 错误模式 | 次数 | 代表样例 |
| --- | ---: | --- |
| npm install failed with exit code `<N>` | 2 | `2026-08-16 03:12:44 ERROR npm install failed with exit code 1` |
| connection refused: `<host:port>` | 2 | `2026-08-16 03:13:40 ERROR connection refused: registry.example.com:443` |
| unit test `"<name>"` timed out after `<N>`ms | 1 | `2026-08-16 03:16:20 ERROR unit test "AuthSpec" timed out after 30000ms` |

## 归并说明

- **npm install 失败**（2 次）：exit code 1 与 exit code 137 属于同一命令失败的同一错误类型，仅退出码不同，归并计数；样例取首次出现（03:12:44，exit code 1）。
- **连接被拒绝**（2 次）：两条记录完全相同（`registry.example.com:443`），对应日志中的两次重试（retry 1 of 3），归并计数。
- **单元测试超时**（1 次）：`AuthSpec` 超过 30000ms，仅出现一次。
- 次数相同的模式按首次出现时间排序。
