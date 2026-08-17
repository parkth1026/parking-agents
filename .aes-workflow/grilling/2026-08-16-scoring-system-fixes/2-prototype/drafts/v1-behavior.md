<!-- draft v1 | published 2026-08-16
     用户意见：待质疑
     状态：draft -->

# 行为对照表: 2026-08-16-scoring-system-fixes（草稿 v1）

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | 分析对：修复提交存在，`git show` 可得真实 diff | Reuse +1（三处文档口径不一，推断是否计分矛盾） | **唯一定义（scoring.md）**：知识文件含 `git show` 片段（before/after 代码）→ Reuse 第 1 分；analyze.md / config.md 改为引用此处 |
| 2 | 分析对：修复提交存在但 diff 不可得（浅克隆/force-push） | scoring.md:38「推断可接受」vs :15「推断不算分」矛盾 | **等效强归因链**三条件同时成立 → Reuse 第 1 分：①失败→成功两构建间 pin/提交集合唯一变化指向单一变更；②该变更标题/内容与失败对象同名或直接对应；③错误在 fix 构建消失。纯推断（缺任一条件）不计分。aes6-329 案例在新口径下重算仍 8 分（合法化既有实践，非提分通道） |
| 3 | 分析对：修复 = Jenkins 配置/环境变更（无代码提交） | Commit 第 1 分「有至少 1 个 commit」语义未定义，实践从严全给 0 → infra 封顶 7 | Commit 三分重定义为**修复侧证据**：①修复侧变更证据（代码提交、job 配置 diff、流水线参数变化、管理员操作记录任一）+1；②该变更直接触及错误文件/对象或其配置 +1；③变更描述清楚说明修复 +1。infra 对（如 MissingPlugin 型）凭配置变更书面证据可获第 1、3 分；「重跑即好、无任何变更证据」仍 0 分（EnvironmentStateLag 仍 7，向后兼容） |
| 4 | 写入新知识文件（recorded_at ≥ 规则生效时刻） | Warning 数据只在账本（success:w=），文件无验证信号 | **`## Warning Trend` 必填节**：fail 构建 vs fix 构建警告数 + 趋势一句话；details/ 档（≥8）趋势恶化必须在文中解释，否则降 scratch。不进 10 分总分 |
| 5 | 分析对命中重复模式（同错误码+同根因已有文件） | 规则已写但 :see= 落账 0 执行（账本 98 条 0 个） | **强制纪律**：结论串必须带 `:see={existingFile}`；rawDir 内已有文件追加/更新 `## Recurrences` 行；analyze.md 检查清单加一条；session.mjs 既有「:see= 指向存在文件」门禁兜底 |
| 6 | 查「权重/阈值什么时候校准」 | 无任何触发定义 | scoring.md 新增**校准触发条件**：账本 :see= 累计 ≥30 条，或距上次校准 ≥6 个月，或盲评一致率 <0.8——三者任一满足即触发权重/阈值复审（本轮不改数字） |
| 7 | 读 <5 分档说明 / knowledge-format.md 自例 | <5 分支从未触发无说明；:47 自例文件名缺 ShortDesc 段 | <5 分支补一句「未触发也正常，多见于日志不可得/弱归因老对」；自例文件名补齐段 |
| 8 | 盲评（一次性交付+流程沉淀） | 不存在 | **盲评包**：对当前库全量文件生成去分副本（剥离 frontmatter score/scoring 行与文件名暗示）+ 维度级评分表（Info/Diff/Commit/Reuse 四维各打分）+ 流程说明；流程文档沉淀为 `jenkins-pair-analyze/references/blind-review.md`；用户盲评后结果与指标（逐文件 \|Δ总分\|、|Δ|≤1 占比、维度级差异表）落 `scoring-audit-2026-08-16/blind-review/results.md` |
| 9 | validate-raw.mjs 全库验收 | 只验 frontmatter/命名/token/账本一致性 | 增：recorded_at ≥ 生效时刻的文件必须有 Warning Trend 节；recorded_at 早于生效时刻的存量文件放行（向后兼容） |

## 不变清单

- **四维权重数值（Info3/Diff2/Commit3/Reuse2）与 8/5 阈值不变**（Q1=A：本轮只修语义与仪表，数字待校准）。
- 10 分制、结论串 grammar、文件命名规则、frontmatter schema 字段集不变（Warning Trend 是正文节不是 frontmatter）。
- **存量 14 份知识文件与其账本条目零改动**；新规则重算存量不得改变任何一份的分档（Q2=B，行为行 2/3 的向后兼容性由此约束）。
- NAS wiki（人工精选层）不动；skill-env.json 不动；对 Jenkins API 请求不变。
- 每次调用单构建对、单实例锁等编排器机制不变。

## 配置差异

无（不触配置文件）。
