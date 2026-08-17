# 执行步骤记录（transcript）

任务：统计 mixed-case.log 的错误分布，输出 markdown 频次表至 outputs/errors.md。

1. 读取输入文件 `input/mixed-case.log`，确认共 7 行。
2. 用大小写不敏感的 grep 匹配错误级别，确认 6 行为错误行（ERROR / Error / error 三种大小写混用，视为同一级别）；第 4 行 `INFO retry scheduled` 非错误行，排除。
3. 剥离时间戳与级别标记，按错误消息归并同型错误（将 attempt 序号、超时时长等可变参数归一化）：
   - job "payment-sync" failed (attempt {N}) — 2 次（第 1、5 行）
   - cannot read config from /etc/app/settings.yaml — 2 次（第 2、7 行）
   - error connection timeout after {N}s to db-primary:5432 — 2 次（第 3、6 行）
4. 三种模式次数相同（各 2 次），按首次出现顺序排列，写入含「错误模式 / 次数 / 代表样例」三列的 markdown 频次表。
5. 产物保存至 `run-1/outputs/errors.md`，并在 `run-1/` 下写本记录供评分者核对。

产物：`outputs/errors.md`
