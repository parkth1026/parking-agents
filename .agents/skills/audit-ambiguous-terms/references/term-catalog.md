# Term catalog

这些是候选 term，不是自动替换表。每一项仍要通过 `term-policy.md` 的四道 gate；普通中文默认优先保留。

## 本轮确认可以转换的核心

| 中文原词 | 最小 English nucleus | 需要扩展时 | 使用条件 |
| --- | --- | --- | --- |
| 双向钢人分析 | `steelman` | `steelman both sides` | 文本明确要求分别构造双方最强论证时 |
| 分歧核心 | `crux` | `crux of the disagreement` | 文本明确要求找出会改变结论的核心分歧时 |

这两个词来自 critical thinking / argumentation，不是 software engineering 专词。输出时标明领域来源，不把它们包装成工程标准。

## 常见但默认保留中文

| 中文原词 | 可能的 English mapping | 默认处理 |
| --- | --- | --- |
| 问题想清楚 | `problem framing` / `problem definition` | 保留中文；只有用户明确讨论 formal problem framing 时才转换 |
| 当前想法 | `current hypothesis` / `current position` | 保留中文；除非“假设”和“立场”的区别会改变执行 |
| 关键变量 | `key decision variables` / `decision drivers` | 保留中文；只有它是正式 decision model 的变量时才转换 |
| 明确判断 | `clear conclusion or recommendation` | 保留中文；普通结论不需要 English label |
| 理由 | `rationale` | 保留中文；只有字段、模板或 contract 明确要求 `rationale` 时才转换 |
| 下一步行动 | `concrete next steps` / `action items` | 保留中文；有任务字段或责任人 schema 时才转换 |
| 详细思考 | `rigorous analysis` | 改成“严谨分析”即可，不自动加 English |

## Software engineering 与 product：仅在 formal context 转换

| 中文原词 | 可能的 English mapping | 只有在什么情况下才转换 |
| --- | --- | --- |
| 功能 | `feature` / `capability` | 产品字段、API capability 或明确的能力边界 |
| 需求 | `requirement` / `request` | 可验收 requirement 或协议字段 |
| 方案 | `proposed approach` / `design option` | 设计评审中需要区分推荐方案和备选方案 |
| 支持 | `supports` / `compatible with` | 兼容矩阵、能力声明或 API contract |
| 完成 | `implemented` / `validated` / `shipped` | 需要区分实现、验证和发布状态 |
| 可用 | `available` / `usable` / `production-ready` | 需要区分存在、可操作和可上线 |
