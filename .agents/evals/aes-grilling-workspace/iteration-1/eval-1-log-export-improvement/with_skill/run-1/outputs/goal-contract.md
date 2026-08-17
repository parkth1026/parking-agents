# Goal Contract: log-export 脚本支持日期过滤与输出路径参数

- Status: Ready
- Target: G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\aes-grilling-workspace\fixtures\log-export\export_logs.py
- Updated: 2026-08-04

## Goal

运维工程师可以用命令行参数运行 export_logs.py:通过 --from 和 --to(YYYY-MM-DD,含当天)按日期范围过滤导出行,通过 --output 指定输出 CSV 路径,并在每次运行结束时于 stderr 看到无法解析而被跳过的行数统计;不带任何参数运行时,脚本的全部可观察行为与改动前完全一致。

## Why

- 现在每次只能导出全部日志,又慢文件又大,而分析同事通常只需要指定日期范围内的数据。
- 输出路径写死为 export.csv,无法直接导出到目标位置;无法解析的行被静默跳过,数据丢失不可见。

## Scope

- In: 为 export_logs.py 增加 --from、--to、--output 三个命令行参数和 --help,并把跳过行数统计输出到 stderr。
- Out: 按日志级别过滤、CSV 以外的输出格式、压缩、自动上传、增量或追加导出、对日志文件格式本身的任何改动。

## Success Criteria

- AC-01: `python export_logs.py` 不带任何参数运行时,输出文件路径(脚本目录下 export.csv)、CSV 列名与列顺序(timestamp,level,message)、UTF-8 编码和覆盖行为与改动前完全一致。
- AC-02: 传入 `--output` 指定路径时,CSV 写入该路径;未传时仍写入默认 export.csv。
- AC-03: `--from YYYY-MM-DD` 和 `--to YYYY-MM-DD` 按日期范围过滤导出行,边界日期当天的日志包含在结果内;只传其中一个时,另一端不设限。
- AC-04: 对现有 logs/app.log 运行 `--from 2026-07-31 --to 2026-07-31`,导出恰好 2 行(09:40:22 WARN 与 09:41:03 ERROR 两条)。
- AC-05: 每次运行结束时,向 stderr 输出跳过行数统计(形如 `skipped N unparsable lines`),即使跳过 0 行也打印;stdout 保持现有 `exported N rows -> ...` 输出且不包含该统计。
- AC-06: `--help` 显示全部新增参数的用法说明并以退出码 0 结束。
- AC-07: `--from` 或 `--to` 传入非 YYYY-MM-DD 格式的值时,脚本向 stderr 输出清晰错误信息并以非零退出码结束,且不写出任何输出 CSV。

## Constraints

- CSV 列名与列顺序(timestamp,level,message)保持不变,下游按列位置解析。
- 输出编码保持 UTF-8;默认输出路径与文件名(脚本目录下 export.csv)保持不变,已有其他脚本依赖它。
- 无参数运行的全部可观察行为(读 logs/*.log、总是覆盖写、stdout 的 exported N rows 输出)保持不变。

## Agent Mandate

- May decide: Inspect the repository, choose reversible implementation details such as the argument-parsing library, edit export_logs.py, add or update tests, review the final diff, and simplify without changing behavior.
- Must ask: Only when the Goal, Scope, Success Criteria, or Constraints must change, or when a destructive, credentialed, production, or otherwise unauthorized action is required.
- Must not: Stop at analysis or a plan, ask for discoverable repository facts, expand scope silently (for example adding level filtering or new output formats), or claim completion without fresh evidence for every AC.

## Completion

- Evidence: All Success Criteria are satisfied with fresh, reproducible command output against the fixture logs.
- Quality: Relevant tests and repository checks pass; unrelated pre-existing failures are separated; the final diff is reviewed and simplified where safe.
- Final report: Map each AC to evidence and state changed files and remaining risks.

## Blockers

- None.
