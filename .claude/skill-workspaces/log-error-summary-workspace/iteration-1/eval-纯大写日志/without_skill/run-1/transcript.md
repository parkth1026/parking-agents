# 执行记录（transcript）

任务：统计 `build-errors.log` 中的错误分布，输出 markdown 频次表到 `outputs/errors.md`。

## 执行步骤

1. **读取输入文件**
   - 用 Read 工具完整读取 `input/build-errors.log`，确认共 10 行、日志级别为全大写（INFO/WARN/ERROR）。
   - 用 `wc -l` 复核行数，并确认 `run-1/outputs/` 目录当时尚不存在。

2. **提取并统计错误**
   - `grep -c "ERROR"` 得到 ERROR 总数：**5** 条。
   - `grep "ERROR"` 列出全部错误行原文。
   - 归并统计（单条 bash 管道完成）：
     ```bash
     grep "ERROR" input/build-errors.log \
       | sed -E 's/^[0-9-]+ [0-9:]+ ERROR //; s/exit code [0-9]+/exit code <N>/; s/"[^"]*"/"<name>"/; s/after [0-9]+ms/after <T>ms/' \
       | sort | uniq -c | sort -rn
     ```
   - 归一化规则：去掉时间戳与级别前缀；将退出码归一为 `<N>`、测试名归一为 `<name>`、超时时长归一为 `<T>ms`，使同型错误可合并计数。

3. **统计结果**

   | 错误模式 | 次数 |
   | --- | --- |
   | npm install failed with exit code \<N\> | 2 |
   | connection refused: registry.example.com:443 | 2 |
   | unit test "\<name\>" timed out after \<T\>ms | 1 |

   计数已与原始 grep 输出逐条核对（5 = 2 + 2 + 1）。

4. **写出产物**
   - 用 Write 工具将 `errors.md` 保存到 `run-1/outputs/errors.md`：三列表格（错误模式 / 次数 / 代表样例），按次数降序，附归并规则与补充说明（如 exit code 1 与 137 同型不同因、connection refused 伴随重试日志等）。

## 工具与命令清单

- Read（读输入日志）
- Bash：`wc -l`、`grep -c "ERROR"`、`grep "ERROR"`、`sed`（归一化）、`sort | uniq -c | sort -rn`（计数降序）
- Write（写 `outputs/errors.md` 与本 transcript）
