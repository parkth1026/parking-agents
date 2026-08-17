# 构建日志错误分布统计

- 输入文件：`input/build-errors.log`（10 行）
- 日志级别为全大写（INFO / WARN / ERROR），ERROR 行共 **5** 条
- 归并规则：去除时间戳与级别前缀后，将可变部分（退出码、测试名、超时时长）归一化为同一错误模式

| 错误模式 | 次数 | 代表样例 |
| --- | --- | --- |
| npm install 失败（exit code 变化） | 2 | `npm install failed with exit code 1`（另一次为 exit code 137，常提示 OOM 被杀） |
| registry 连接被拒 | 2 | `connection refused: registry.example.com:443` |
| 单元测试超时 | 1 | `unit test "AuthSpec" timed out after 30000ms` |

## 补充说明

- **npm install 失败**：两次失败退出码不同（1 为通用失败，137 为进程被 SIGKILL/OOM 终止），消息模板相同，归并为同型错误。
- **connection refused**：两条消息完全相同，中间夹有 `retry 1 of 3` 重试日志，说明是同一网络问题的重复出现。
- **单元测试超时**：仅 `AuthSpec` 一例，超时阈值 30000ms。
- 其余 5 条为 INFO/WARN（含 1 条 WARN：`retrying artifact download`），未计入错误统计。
