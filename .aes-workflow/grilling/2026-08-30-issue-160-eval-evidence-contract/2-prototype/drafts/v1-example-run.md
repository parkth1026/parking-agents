<!-- draft v3 | independence/context revision 2026-08-30T20:13:50+08:00
     用户意见：Creator 独立；上下文选择主文件与创建分支双零增长
     状态：confirmed basis for Goal Contract -->

# 可执行示例: Creator 外部证据评测与持续质量门

> 报文字段只在 `api-mock.md` 定义；这里锁定调用、退出形态与人看到的结果。

## 场景 1：replay 预检与三 gate 公平运行

```text
> node scripts/eval-evidence.mjs preflight \
    --eval-metadata <iteration>/eval-升降桌小房间调研/eval_metadata.json

PASS evidence preflight
mode=replay  epoch=1  entries=2/2
evidence_digest=sha256:3e6c...f19a
network_isolation=verified  live_calls=0
```

```text
> node scripts/eval-evidence.mjs materialize \
    --eval-dir <iteration>/eval-升降桌小房间调研 \
    --gates with_skill,old_skill,without_skill

PASS materialize
with_skill     sha256:3e6c...f19a  inputs/evidence-pack
old_skill      sha256:3e6c...f19a  inputs/evidence-pack
without_skill  sha256:3e6c...f19a  inputs/evidence-pack
gate_digest_consistent=true
```

Creator 随后分批启动三个 gate。每个 run 的正向指令是：

```text
外部证据模式：replay。
只从本 run 的 inputs/evidence-pack 读取已声明证据；所有证据意图都用 manifest entry id 引用。
产物写入 outputs/。当前 host 已隔离 live 外部工具。
```

完成判据：三 gate digest 一致；hits=entries；misses=0；live_calls=0；isolation=verified；产物非空。

## 场景 2：fixture 在起跑前缺失

```text
> node scripts/eval-evidence.mjs preflight --eval-metadata ...

BLOCKED_EVIDENCE_UNAVAILABLE
entry=desk-current-skus
live_calls=0
next=显式运行 record/live 补齐新 epoch

exit 3
```

不会发生：自动启动 WebSearch、用上轮报告假装命中、创建 pass_rate=0 的假 benchmark。

## 场景 3：运行中出现未声明 query

```text
REPLAY_QUERY_MISS
intent=补查某品牌 2026 年投诉
live_calls=0
run_status=FAIL
next=终止本 run；把 intent 交给独立 record 候选清单

exit 1
```

这条证明的是被测执行偏离固定输入，不是环境缺文件，因此候选判罚为 FAIL。

## 场景 4：Host 不能证明网络隔离

```text
> node scripts/eval-evidence.mjs preflight --eval-metadata ...

BLOCKED_NETWORK_ISOLATION_UNAVAILABLE
required=disable_or_audit_external_tools
main_benchmark=NOT_RUN
exploratory_allowed=true

exit 3
```

可以让人手工探索，但 exploratory 结果不推进 `current_best`，也不能声称“零真实搜索”。

## 场景 5：配额重置后的受控 record

```text
> node scripts/eval-evidence.mjs record \
    --eval eval-升降桌小房间调研 \
    --concurrency 1 --max-calls 16 --authorize-live

RECORD started  provider=web-search  concurrency=1  budget=16
[01/14] desk-industry-metrics       captured + sanitized
[02/14] desk-current-skus           captured + sanitized
...
[14/14] desk-brand-complaints       captured + sanitized
PASS record
epoch=2  entries=14  calls=14/16
manifest_sha256=sha256:8abc...912f
```

record 不评分技能。只有所有 entry 完成、脱敏与摘要门全过时才晋级 epoch。

## 场景 6：受控 live acceptance

```text
> node scripts/eval-evidence.mjs live \
    --eval eval-升降桌小房间调研 \
    --concurrency 1 --max-calls 16 --authorize-live

PASS live acceptance
query_plan=PASS  tool_path=PASS  source_reachability=PASS
freshness=PASS  calls=15/16
replay_comparison=incomparable
```

live 证明真实 query 规划、工具链和新鲜度；它不与 replay pass_rate 直接相减。

## 场景 7：现有无 evidence 的技能继续跑

```text
> node scripts/aggregate-benchmark.mjs <legacy-iteration> --history <skill>

WARN evidence mode unmanaged: 此轮未声明固定证据或 live 审计
legacy aggregation completed
```

旧用法、目录与输出仍可消费；新增的只是诚实标注，不会把历史未知值补成 0。

## 场景 8：打包保持轻量

```text
> node scripts/package-skill.mjs skills/life/shopping-deep-research dist

加入: shopping-deep-research/output-evals.json
跳过: shopping-deep-research/eval-fixtures/
PASS package
```

分发包读得到 manifest/digest 和评测声明，但不携带大 payload；仓库 clone 才拥有离线 replay 数据。

## 场景 9：创建/改进技能前形成 Agent 文档质量假设

```text
> Creator: quality-plan skills/ue/ue-log-analysis

READ local reference: references/writing-guide.md
QH-01  completion_criteria  HIGH
  risk: gaps 子命令可运行，但最终报告没有可检查的空窗输出要求
  expected: 空窗起止、时长、空窗前上下文在同一表中成组呈现
  assertions: AC-10
  gates: with_skill,old_skill
  stability_runs: 3

NOT_APPLICABLE leading_words
  reason: 当前失败是结果传导，不是概念召回或术语漂移

QUALITY PLAN READY: 1 hypothesis, 0 unbound findings
```

Creator 只读取自身包内的本地 writing guide，并只把当前技能命中的失败假设落进 eval。若 finding 没有 expected behavior、断言或 gate，计划不完整；这不是静态质量 PASS。

## 场景 10：同证据、多 run 后支持本次文档改进

```text
> node scripts/aggregate-benchmark.mjs <iteration> \
    --history skills/ue/ue-log-analysis

Evidence gate       PASS
  epoch=2 digest=sha256:91ab...77cd live_calls=0 isolation=verified

Quality claim       SUPPORTED
  QH-01 covered      yes
  completed runs     with_skill 3/3 · old_skill 3/3
  AC-10              with 3/3 · old 1/3 · delta +66.7pp
  token budget       within 1.25× old
  harness epoch      consistent

Claim allowed: 强制成组空窗表在本轮固定输入下稳定改善结果传导。
Claim forbidden: 当前 Web/日志来源仍然新鲜；本轮是 replay。
```

这里的 `SUPPORTED` 只支持 QH-01，不把一个成功假设外推成“整个技能在所有场景都更好”。

## 场景 11：两臂全绿但不能证明 Creator 有增益

```text
> node scripts/aggregate-benchmark.mjs <creator-iteration-3> \
    --history skills/workflow/parking-skill-creator

Run results          PASS
  with_skill         3/3 · 263.2s · 800.6k tokens
  without_skill      3/3 · 166.8s · 242.2k tokens

Quality claim        INCONCLUSIVE
  reason 1: 三条断言完全平手，题面无区分度
  reason 2: 没有证明“好用技能”的长期用户结果与稳定性
  reason 3: with_skill 成本为 without_skill 的 3.31× tokens

next=先增强题面/断言或增加针对性消融；不推进“持续产出好用技能”的证明
```

这保留了机械绿测的事实，同时阻止“100%”被误读为生产线价值证明。

## 场景 12：独立包与双零增长上下文门

```text
> node scripts/package-skill.mjs skills/workflow/parking-skill-creator dist
> 在没有安装 writing-for-agents 的干净扫描根运行 Creator 自测

PASS standalone package
external_skill_dependencies=0
create=PASS  validate=PASS  eval=PASS  viewer=PASS  package=PASS
```

```text
> node skills/workflow/parking-skill-creator/run-tests.mjs

Creator 独立性与上下文预算：
  PASS no runtime/package/pointer dependency on writing-for-agents
  PASS SKILL.md                   31,415 / 31,415 bytes · 312 / 312 lines
  PASS SKILL.md + writing-guide   40,364 / 40,364 bytes · 475 / 475 lines
```

任一 bytes 或 lines 超限都 FAIL。新增原则必须先从本地 guide 或主文档删除 no-op、重复、陈旧缓存来腾出预算；不得通过新增第二个 reference 或把多行压成一行绕过。
