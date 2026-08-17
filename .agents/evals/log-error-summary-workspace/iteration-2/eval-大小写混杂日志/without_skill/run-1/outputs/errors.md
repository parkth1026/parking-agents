# 错误分布统计

- 输入文件：`input/mixed-case.log`（共 7 行，其中错误行 6 行，非错误行 1 行为 INFO）
- 错误级别匹配方式：不区分大小写（日志中 ERROR / Error / error 三种写法混用，视为同一级别）
- 归并规则：剥离时间戳与级别标记后，将可变参数（重试次数、超时时长）归一化为占位符，同型错误合并计数

| 错误模式 | 次数 | 代表样例 |
| --- | ---: | --- |
| job "payment-sync" failed (attempt {N}) | 2 | 2026-08-15 10:00:01 ERROR job "payment-sync" failed (attempt 3) |
| cannot read config from /etc/app/settings.yaml | 2 | 2026-08-15 10:00:05 Error: cannot read config from /etc/app/settings.yaml |
| error connection timeout after {N}s to db-primary:5432 | 2 | 2026-08-15 10:00:06 error connection timeout after 30s to db-primary:5432 |

说明：三种错误模式次数相同（各 2 次），表中按首次出现顺序排列。`INFO retry scheduled`（第 4 行）非错误行，未计入。
