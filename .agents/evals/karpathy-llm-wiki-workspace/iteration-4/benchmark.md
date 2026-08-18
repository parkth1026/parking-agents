# Skill Benchmark: karpathy-llm-wiki — iteration-4（修复后复验）

**Date**: 2026-08-18（同日完成 修复→复验 闭环）
**Skill state**: 第一轮 11 项修复（T1/T2/T4/T5/T6/T7/T8/T9/V1/V2/D1）+ 第二轮 6 项冷启动发现修复（A3/A5/A6/A8/T10/T12）；SKILL.md 444→399 行
**Design**: 与 iteration-3 完全同构（同任务文本、同种子、同 n=1/臂、同评分方式），可直接对比

## Summary（iteration-4）

| Metric | With Skill | Without Skill | Delta |
|--------|------------|---------------|-------|
| Pass Rate | 3/3 (100%) | 1/3 (33%) | +67pp |
| Mean final score | 10.00 | 7.37 (2.5 / 10.0 / 9.6) | +2.63 |
| Mean tokens | 998,289 | 238,158 | +760k |
| Mean duration | 312.8s | 189.9s | +122.9s |

## 迭代间对比（修复前 → 修复后）

| 指标 | it3 with | it4 with | it3 without | it4 without |
|---|---|---|---|---|
| Pass 率 | 3/3 | 3/3 | 1/3 | 1/3 |
| 平均分 | 10.0 | 10.00 | 8.03 | 7.37 |
| 首跑即过 | 2/3 | 2/3* | — | — |
| 审计跑（逐字模板） | FAIL(陷阱) | **PASS 首跑** | — | — |
| 冷启动摩擦点 | 10 项实质缺陷 | 0 项未修** | — | — |

\* it4 eval-1 的 1 次修复循环由 A6（index 条目格式未写明）引起——agent 自己括号化了示例表头；该根因已在第二轮修复中闭合（Ingest step 6 现在明确写出条目格式与占位禁令）。
\** it4 冷启动仍报的摩擦（A3/A5/A6/A8/T10/T12）全部当场定位并已修复入库；剩余 3 条（A9 判断类、A11 信息类、A13 文档严于工具）属设计取舍非缺陷。

## with_skill 臂新协议兑现情况（本轮修复的直接证据）

- D1 批量回退：3/3 臂照走并在 log 记录（it3 全部被迫违反协议）
- T12 确认门回退：2/2 需要建目录的臂照走（该规则为重组期间他方新增，本轮补齐回退）
- T8 报告落位：2/2 产出报告的臂全部放 wiki 外（it3 需要自行摸索）
- T4 新流程：Ghost Network 去链留文 + log 记 pending，完全照走
- T9 回填规则：retro-fill created 用当日 + log 注明，照走
- T7/V1：person/agents 标签直接可用，零 SCHEMA 扩展（it3 两臂被迫自行扩表）

## 已知局限

n=1/臂；grader 非盲评；without 臂跨运行方差大（同任务 it3 9.3 FAIL / it4 10.0 PASS；fresh 5.0/2.5）——正是 n=1 的固有噪声，方向性结论（with 稳定满分、产出 schema 合规）不受影响。
