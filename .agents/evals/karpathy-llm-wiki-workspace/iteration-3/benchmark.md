# Skill Benchmark: karpathy-llm-wiki — iteration-3

**Date**: 2026-08-18
**Skill HEAD**: 397a4ea (2026-08-17，v5 校验器：index 链计入断链/入链、版本式标签)
**Design**: 3 场景 × with/without，冷启动子代理执行（同任务文本、同种子、唯技能有无不同）；n=1/臂（iteration-2 为 n=3，本次为改后回归验证）
**Grader**: 主会话 agent 依 evals.json 断言 + validate-wiki.mjs 量化（非盲评，已知局限）

## Summary

| Metric | With Skill | Without Skill | Delta |
|--------|------------|---------------|-------|
| Pass Rate | 3/3 (100%) | 1/3 (33%) | +67pp |
| Mean final validation score | 10.0 | 8.03 (5.0 / 9.3 / 9.8) | +1.97 |
| Mean tokens | 566,688 | 333,489 | +233k |
| Mean duration | 497.4s | 399.9s | +97.5s |

## Per-scenario results

| Scenario | Arm | Score | Status | 要点 |
|---|---|---|---|---|
| ingest-fresh | with | 10/10 | PASS exit 0 | 11 页首跑即过；冷 agent 主动改写 index 模板规避 T1 陷阱 |
| ingest-fresh | without | 5/10 | FAIL exit 1 | 自创扁平结构+相对链接；无 frontmatter/SCHEMA/log/raw——与 iteration-2 同分（5/10），跨迭代复现 |
| ingest-incremental | with | 10/10 | PASS exit 0 | 建页阈值纪律（拒投机页）；先扩 SCHEMA 再用 person 标签 |
| ingest-incremental | without | 9.3/10 | FAIL exit 1 | 新页放自创 techniques/ 目录 → 校验器判 3 断链+孤儿（页面实际存在，目录漂移） |
| lint | with | 8.5 → 10/10 | PASS exit 0 | 一轮修复收敛，按技能优先级顺序，5/5 植入问题全修 |
| lint | without | 8.5 → 9.8/10 | PASS exit 0 | 自写 9 项检查器；修 4/5（漏 under-linked）；额外发现种子 log 与现实不符并诚实标记 |

## 与 iteration-2 对比

pass 率方向一致（it2: 100% vs 64%；it3: 100% vs 33%）。本次新增信息：改后回归确认（397a4ea 之后端到端仍全绿）+ 暴露 T1 模板陷阱（it2 时代校验规则不存在，故当时不可能出现）。

## 已知局限

n=1/臂（无方差估计）；grader 与被测同模型（无独立盲评）；token 由 harness 事后读取（it2 曾记 0，本次已修正采集方式）。
