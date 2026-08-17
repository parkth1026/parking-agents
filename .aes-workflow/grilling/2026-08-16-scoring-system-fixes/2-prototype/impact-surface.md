# Impact Surface: 2026-08-16-scoring-system-fixes

- 扫描时间：2026-08-16（本地）
- 判据：改完之后，程序在哪些地方跑起来不一样了？谁会看见？

## 六面扫描

| 影响面 | 有/无 | 具体差异 | 谁受影响 | 对照物 |
| --- | --- | --- | --- | --- |
| 用户可见界面 | **无** | 纯规则文档、校验脚本与盲评流程；无人眼 UI | 无人 | — |
| 可观察行为 | **有** | ①Reuse 第 1 分判定统一（真实 diff 或等效强归因链，纯推断不再计分）；②Commit 维度 culprit/修复语义定义（infra 可用配置变更证据拿第 1 分）；③新文件 Warning Trend 必填节 + details 门禁旁证；④重复模式 :see= 落账从「0 执行」变为强制纪律；⑤scoring.md 写入校准触发条件 | 每轮自动分析（外部驱动）、日后调分的人 | `behavior.md` |
| 可运行输出 | **有** | validate-raw：存量放行、生效日后新文件缺 Warning Trend 报 ERROR；账本出现 :see= 条目 | 运维/审计者 | `example-run.md` |
| 对外接口报文 | **无** | Jenkins API 请求不变；结论串 grammar 不变（:see= 本就是 grammar 子集，只是从 0 执行变强制） | 无 | — |
| 用户配置 | **无** | skill-env.json 不动 | 无 | — |
| 历史兼容性 | **有** | 存量 14 份与新规则重算不得改档（Q2=B 约束，含 aes6-329 合法化、EnvironmentStateLag 仍 7 分）；knowledge-format.md 自例修正；<5 分支说明补写 | 既有语料与账本 | `behavior.md` 不变清单 |

## 结论

出 behavior.md（评分规则前后对照）与 example-run.md（校验/落账/盲评示例）两份确认版。mock.html、api-mock.md 不出。

关键设计点（供逐处质疑）：等效强归因链三条件、Commit 配置变更证据的边界、Warning Trend 的生效分界（recorded_at）、校准触发条件的数字、盲评指标口径。
