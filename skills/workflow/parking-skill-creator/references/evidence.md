# 外部证据评测指南

当被测技能依赖 Web、外部 API、数据库快照、文件快照或实时数据时，读取本文件。
普通离线技能不需要读取它。

## 先分清四种模式

| mode | 是否访问 provider | 能证明什么 | 终态 |
| --- | --- | --- | --- |
| `replay` | 0 次 | 固定证据下的分析、遵循技能和 gate 公平性 | 预检缺证据/隔离能力为 `BLOCKED`；运行 query miss/摘要错为 `FAIL` |
| `record` | 仅显式授权、串行、有预算 | 建立完整脱敏 evidence epoch | 不评分技能 |
| `live` | 仅显式授权、串行、有预算 | 真实 query 规划、工具链、来源可达性和 freshness | 与 replay 分数 `incomparable` |
| `unmanaged` | 沿用旧路径 | 兼容旧题 | 不能声称 zero-live 或可复现 |

## replay

先在 `eval_metadata.json` 声明 `evidence.mode=replay`、manifest、摘要和
`miss_policy=fail`。用可隔离或可审计的 host adapter 预检：

```bash
node scripts/eval-evidence.mjs preflight \
  --eval-metadata <path>/eval_metadata.json \
  --skill-dir <skill-dir> \
  --host-adapter <verified-host.json>
```

预检通过后，把同一 pack 物化到每个 gate 的
`<gate>/run-1/inputs/evidence-pack/`，再启动同批 gate：

```bash
node scripts/eval-evidence.mjs materialize \
  --eval-dir <iteration>/eval-某题 \
  --skill-dir <skill-dir> \
  --host-adapter <verified-host.json> \
  --gates with_skill,old_skill,without_skill
```

被测 Agent 只能从本 run 的 `inputs/evidence-pack/` 读 entry；请求未声明
query 时终止该 run：

```bash
node scripts/eval-evidence.mjs replay \
  --eval-metadata <path>/eval_metadata.json \
  --skill-dir <skill-dir> --host-adapter <verified-host.json> \
  --calls <calls.json> --run-dir <gate>/run-1
```

`calls.json` 是 `{ "entry_id": "...", "query": "..." }` 数组或 JSONL。replay
不会联网，也不会在 miss 时 fallback 到 live。成功条件是 `misses=0`、
`live_calls=0`、`network_isolation=verified` 和所有 gate 的 digest 逐字相同。

## record/live provider seam

provider 只通过显式 `--provider-fixture`（测试/离线）或 `--provider-adapter`
（可执行的 stdin/stdout JSON seam）提供。fixture 的 live 检查只返回
`SIMULATED_PASS`，不能冒充真实 web acceptance；只有执行 adapter 的结果才可标记
`PASS`/`execution=live`。两者都必须输出同一语义，不把凭据写进 payload：

```json
{
  "entries": {
    "entry-a": {
      "payload": { "summary": "脱敏来源摘要" },
      "query": "原 manifest query",
      "tool": "web-search",
      "sources": [{ "url": "https://example.invalid/source", "reachable": true }],
      "captured_at": "2026-08-30T10:00:00+08:00",
      "freshness_ok": true
    }
  }
}
```

调用前同时给出 `--authorize-live --concurrency 1 --max-calls N`。`N` 必须等于
该题声明的 `live_policy.max_calls`，并且 freshness policy 必须存在。record
只有所有 entry 采集、脱敏、摘要和写入都成功才晋级新 epoch；缺 entry、预算耗尽、
脱敏失败或摘要失败都保留旧 epoch、不覆盖、不评分。

```bash
node scripts/eval-evidence.mjs record \
  --eval-metadata <path>/eval_metadata.json --skill-dir <skill-dir> \
  --output-dir <skill-dir>/eval-fixtures/eval-name \
  --provider-fixture <fake-provider.json> \
  --authorize-live --concurrency 1 --max-calls 16
```

受控 live acceptance 只记录独立审计，不拿 replay 分数做减法：

```bash
node scripts/eval-evidence.mjs live \
  --eval-metadata <path>/eval_metadata.json --skill-dir <skill-dir> \
  --provider-adapter <provider-adapter.mjs> --audit-path <live-audit.json> \
  --authorize-live --concurrency 1 --max-calls 16
```

provider adapter 从 stdin 接收 `{schema_version, kind, requests:[{entry_id,intent,query}]}`，
向 stdout 返回 `{entries:{...}}`；adapter 自己负责真实 provider 调用并把 query、tool、
source URL/可达性、freshness 和脱敏后的 payload 返回，Creator 只验收并审计这些声明。
离线 fake provider 只能用于 AC-003 生命周期矩阵，不能满足 AC-006 的真实 live pilot。

证据半段 pilot 可用固定 workspace 重建四题并让唯一 history writer 消费其审计：

```bash
node scripts/pilot-replay.mjs \
  --skill-dir <skill-dir> --workspace <temporary-workspace> \
  --host-adapter <verified-host.json>
node scripts/aggregate-benchmark.mjs \
  --pilot-audit <temporary-workspace>/iteration-pilot \
  --history <skill-dir> --pilot-id <skill>-replay-YYYY-MM-DD
```

第二条命令只追加 `history.json.pilot_audits[]`，收据中的 manifest、digest、gate、
hits/misses 来自第一条命令写入的 evidence audit；不能手工复制这些字段。官方 replay
没有 Agent output grading 时 quality claim 必须是 `INCONCLUSIVE`，live acceptance 另行
追加，且与 replay 分数 `incomparable`。配额恢复后，每题把 live 命令的审计写为
`<live-audit-dir>/eval-<题名>.json`，再以
`--pilot-phase live-acceptance --pilot-live-audit-dir <live-audit-dir>` 追加一条新收据；
旧 replay 收据不回改。

## 质量假设

创建或改进 Agent skill 时，先读取 Creator 自己的
`references/writing-guide.md`，把真实文档风险写成：

```text
risk → expected_behavior → assertion → gates → stability_runs/cost_budget
```

静态 finding 不能直接给质量 PASS。用 `quality-plan.mjs` 校验绑定关系：

```bash
node scripts/quality-plan.mjs plan \
  --skill-dir <skill-dir> --eval-metadata <eval_metadata.json> \
  --findings-file <document-review.json>
```

finding 若缺风险、预期行为、已登记断言或相关 comparator，命令失败关闭。未命中
的写作 lever 进入带理由的 `not_applicable`，不为了填 checklist 造 finding。随后
用聚合器从足量、同 evidence/harness epoch 的对照运行推导
`SUPPORTED | INCONCLUSIVE | REGRESSED | BLOCKED`；`pass_rate=100%` 不是充分条件。

`SKILL.md` 的常驻上下文上限是 31,415 UTF-8 bytes / 312 行；创建或改写分支加载
`SKILL.md + references/writing-guide.md` 的上限是 40,364 bytes / 475 行。新增机制
先删 no-op、重复和可从环境查到的缓存，不新建第二个 writing reference。
