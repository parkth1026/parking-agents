# 审计跑过程保真度日志（iteration-3 / 2026-08-18）

- 执行者：主会话 agent（非完全冷启动：此前读过 SKILL.md 做钢人分析；冷启动证据以 6 个子代理臂为准）
- 任务：evals.json #1（fresh ingest，Karpathy Intro to LLMs talk）
- 结果：**10/10 PASS，exit 0**；1 source + 1 entity + 8 concept 页；经历 1 次校验失败→修复→复跑循环
- 披露：本跑在沙箱 audit-run/outputs，SKILL_ENV 指向 mock-env/audit-run.json，未触碰真实 NAS 配置

## 协议执行记录（逐步）

| SKILL.md 步骤 | 执行情况 | 偏差/摩擦 |
|---|---|---|
| Phase 0 配置解析 | config.json + SKILL_ENV mock-env，解析出 wikiDir/rawDir | 无 |
| Ingest Step 1 存 raw | wiki-raw/transcripts/2026-08-18-…-talk.md + 元数据头 | 无 |
| Step 2 会话三文件 | 均不存在 → 走 Wiki Initialization 初始化 | **T1（见下）** |
| Step 3 讨论 takeaways | 批量模式无法交互 → 自动通过 | **D1（见下）** |
| Step 4 查已有页 | 新 wiki，无 | 无 |
| Step 5 建页 | 10 页，建页阈值按"central to source / well-known"执行 | **T3、T4（见下）** |
| Step 6/7 index+log | 全量登记 + 追加日志 | 无 |
| Step 8 校验闭环 | 首跑 FAIL（T1）→ 按修复策略#2 改纯文本 → 复跑 PASS | **T2（见下）** |

## 发现清单

- **T1（冷启动陷阱，实质缺陷）**：SKILL.md「Wiki Initialization」的 index.md 模板含字面占位链 `- [[Page Name]] — one-line description`。v5 校验器（397a4ea，2026-08-17 起）把 index 悬空链计入断链 → **照抄官方模板初始化的 wiki 必然 FAIL（本跑实测 9.75 分、exit 1）**。iteration-2（8-14）时该校验规则尚不存在，故属"改后回归"型缺陷，静态审计（8-16）也未覆盖此组合。
- **T2（校验器展示缺陷，轻微）**：断链维度 9.8 经四舍五入加权后总分恰为 10.0，输出「Total: 10 / 10 … Status: FAIL」——分数满分却判失败（FAIL 来自"断链=0"硬门而非分数）。冷用户会困惑；且维度分先取整再加权，总分略被抬高（9.75→10.0）。
- **T3（V1 双源分叉的实际代价）**：建 Tool Use 页需要 tool-use 标签，SKILL.md 内联分类（27 个）没有，references/tagging-taxonomy.md（46 个）有 agents 等更全集合。两处谁是权威未定义；按"先改 SCHEMA"协议可自救，但冷 agent 会随机偏向其中一个来源 → 不同 agent 初始化出不同 SCHEMA。
- **T4（文档自相矛盾）**：SKILL.md 建页阈值节写"拿不准就先留 wikilink，死了正好是它该建页的信号"；但校验器对断链硬门清零、Lint 完成标准要求 broken=0。两者不可同真。
- **D1（协议设计特性）**：Ingest Step 3 强制与用户讨论 takeaways，无非交互回退路径 → 自主/批量模式下必然违反协议。真实使用是特性（人在环），评测与自动化场景是缺口。
- **T5（轻微）**：约束 4 要求 CRLF 行尾，校验器不检查行尾（8 维度均无此项）→ 约束不可验证。本跑产物实际为 LF，仍 PASS。

## 核心理念符合度观察（本跑）

- 三层架构 ✓（raw 只写一次、wiki 全部交叉链接、SCHEMA 约束标签）
- compile-once/互联知识网 ✓（10 页 2+ 出链、零孤儿、知识以页为单位沉淀而非检索缓存）
- 配置驱动路径 ✓（全程无硬编码路径）
- 诚实性/阈值纪律 ✓（未给次要点建页；Karpathy 实体按 well-known+central 建页）
- 校验闭环 ✓（失败→定位→修复→复跑直至 ≥9.0 且断链=0）
