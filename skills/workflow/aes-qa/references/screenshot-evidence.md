# GitLab 截图证据协议

本页只定义 **AES QA 以内部 GitLab 为 evidence target** 时的截图分支。它不是通用
artifact 协议：trace、video、日志、YAML snapshot、source-controlled visual baseline、
非 GitLab tracker 都不沿用本页。

## 何时进入

以机器事实触发，不以 Issue 类型或手填开关触发。满足任一条件即
`screenshotEvidence.required=true`：

- 本 QA attempt 实际执行了 screenshot check，QaReceipt 的 `checks[]` 含
  `kind=screenshot|live-screenshot`；
- screenshot capture 被规格、terminal verdict 或 `findings[]` 引用。

没有实际 screenshot check、也没有 screenshot 引用时，不运行 publisher、不写空 note；新 receipt 写
`screenshotEvidence.required=false` 即可。旧版无截图 QaReceipt 可以不带 wrapper，保持 v1
兼容。界面改动、Issue 本身或纯导航 diagnostic capture 不自动产生截图义务；但实际 screenshot
check 不能把全部截图标成 diagnostic 来逃避 claim-complete。

## 角色与权限

- QA attempt owner 负责 `{qaRoundId,attemptId}` 整轮的 claim-complete、terminal 与最终
  receipt；一个 attempt 可以含多个 screenshot checks。
- capture executor 只复制本地 PNG、计算 hash、写 stable spool；它不持 GitLab 写凭据，
  capture/terminal 阶段 GitLab HTTP 必须为 0。
- owner session 下的最小权限 publisher 是唯一 GitLab writer；缺少显式
  `evidenceTarget={provider:"gitlab",host,projectId,issueIid}` 时在正式 capture 前阻断，
  不猜 Issue，也不自动建票。
- issue worker 负责调用顺序与 QaReceipt 绑定；worktree-board、merge/close lane 只读
  `aggregateMarker`，不联网重读 note、不扫描本地图片。
- publisher 只证明证据完整性，不替代人工视觉签收，也不把 FAIL/BLOCKED 改写成 PASS。

远端写入仍受当前 Goal/Issue 的授权边界约束；某次契约授权的 smoke Issue 不能成为后续
run 的默认 target。

## 公共入口与顺序

公共入口是 `skills/workflow/aes-qa/scripts/screenshot-evidence.mjs`。上游按
`qaRoundId/attemptId` 建 run-scoped spool，并在正式 screenshot check 前提供 target、
code state、环境摘要和所需 claims。

```powershell
$ev = "skills/workflow/aes-qa/scripts/screenshot-evidence.mjs"

node $ev capture --spool <run-spool> --file <png> --capture-id <id> `
  --claim <claim-id> --role <role> --viewport 1366x768 --theme light --sensitivity CLEAR

node $ev terminal --spool <run-spool> --outcome PASS --candidate <40-char-candidate-sha>
node $ev publish --manifest <run-spool>/capture-manifest.json --json
node $ev gate --spool <run-spool> --candidate <40-char-candidate-sha> --json
```

异常恢复、清理与 pilot 报告使用同一入口：

```powershell
node $ev resume --receipt <run-spool>/publish-receipt.json --json
node $ev cleanup --spool <run-spool> --json
node $ev cleanup --spool <run-spool> --abandon --reason <reason> --actor <owner> --json
node $ev report --notes-file <notes.json> --project-id 2137 --json
```

执行顺序有这些不可跳过的完成条件：

1. `capture` 先把 PNG 复制到同机 stable spool 的临时文件，计算 bytes/SHA-256，原子改名为
   `images/<full-sha256>.png`，再原子持久化 `capture-manifest.json`；两者 durable 后才 ACK。
2. 整轮检查结束后，`terminal` 只冻结一次 claim-bearing `PASS|FAIL|BLOCKED`，形成不可变
   batch。取消或没有稳定 claim 的 attempt 只能恢复或显式 abandon；N=U=0 不发布。
3. 正常路径对一个 frozen batch 只调用一次 `publish`。publisher 从 receipt 续接内部重试，
   不靠模型逐图驱动。
4. strict readback 全部通过后才原子写 `aggregate-marker.json`；随后 `gate` 才能把 wrapper
   交给 QaReceipt/terminal consumer。
5. `VERIFIED` 后可删 PNG，但保留 manifest、`publish-receipt.json`、
   `aggregate-marker.json`、`qa-gate-receipt.json` 与 cleanup receipt。未 VERIFIED 只能显式
   abandon 后清理；abandon 永久禁止该 attempt 产出 QaReceipt、READY 或 close。

stable spool 只承诺同机恢复。换机没有受控复制完整 spool 时保持 BLOCKED 并重跑。

## Claim-complete 与 final candidate

三个事实始终正交：`assertionOutcome=PASS|FAIL|BLOCKED` 是测试真假；
`evidenceState=LOCAL_SPOOLED→BATCH_FROZEN→UPLOADED→NOTE_POSTED→VERIFIED` 是发布进度；
`releaseEligibility=ELIGIBLE|BLOCKED` 是最终放行。发布成功或失败都不得改写 assertion。

必传引用集合必须逐层相等：

```text
规格要求 refs UNION verdict refs UNION Finding refs
= capture inventory 中 REQUIRED refs
= receipt refs
= Issue note refs
= strict readback VERIFIED refs
```

`N` 是 claim refs 数，`U` 是完整 SHA-256 去重后的 unique blobs，故 `U≤N`。导航图默认
排除；同字节可映射多个 refs，只上传一次；同名异 SHA 必须分开。冻结后出现新的
claim-bearing capture，说明原 attempt 不完整，必须新建 attempt 重跑，不能追加第二个正常批次。

`batchId` 的 canonical identity 只在本页定义：

```text
sha256(provider + host + projectId + issueIid + qaRoundId + attemptId
       + candidateSha-or-codeStateDigest + frozenManifestSha256)
```

八项缺一不可；publish、内部重试与 resume 始终复用原 batch/receipt。

dirty/nonFinal 截图可以支撑循环轮 verdict/Finding，但不能进入最终 QaReceipt。登记唯一
candidate commit 后，必须在该 candidate 的构建/运行态创建新的 `{qaRoundId,attemptId}`，
重跑最终 screenshot checks，并令 marker 的 `candidateSha` 精确等于 QaReceipt 的
`commitSha`。内容相同、tree digest 相同或旧图 SHA 相同都不能替代 final candidate live run。

## QaReceipt wrapper 与 VERIFIED gate

QaReceipt 的公共 seam 只有顶层 wrapper；marker 字段不要在其他技能重复定义：

```json
{
  "screenshotEvidence": {
    "required": true,
    "aggregateMarker": {
      "schema": "aes.screenshot-evidence-marker/v1",
      "batchId": "sha256:<64-hex>",
      "qaRoundId": "qa-round-1",
      "attemptId": "attempt-1",
      "status": "VERIFIED",
      "assertionOutcome": "PASS",
      "candidateSha": "<40-char-candidate-sha>",
      "frozenManifestSha256": "<64-hex>",
      "claimRefsN": 2,
      "uniqueSha256U": 2,
      "verifiedU": 2,
      "totalUniqueBytes": 87904,
      "noteId": 147900,
      "receiptSha256": "<64-hex>"
    }
  }
}
```

`aggregateMarker` 是 `aggregate-marker.json` 的完整对象，不是本机路径。以下任一事实触发
fail closed：

- screenshot 义务已触发但 wrapper 或 marker 缺失；
- schema/identity/digest 不完整，`status!=VERIFIED`，或 `verifiedU!=uniqueSha256U`；
- marker candidate 与当前 QaReceipt/candidate 不同，或 final worktree 不干净；
- assertion 不是 PASS，或其他自动/live/manual 门仍未通过。

FAIL/BLOCKED batch 可以达到 VERIFIED，但 `releaseEligibility` 仍是 BLOCKED。只有 final
candidate 上重新执行的 PASS、marker VERIFIED、claim-complete 且其他 QA 门全绿，才能进入
READY_TO_MERGE；close 使用同一判据。这个条件是 QA 门的条件子门，不把截图变成每张 Issue
的必需物。

## Balanced limits 与成本

首次 GitLab 请求前按真实 UTF-8 内容做合取 preflight：

| 项 | 上限 |
| --- | ---: |
| claim refs N | 32 |
| unique images U | 16 |
| 单图 | 10 MiB |
| 唯一图片合计 | 100 MiB |
| note | 64 KiB |
| 显示文件名 | 180 UTF-8 bytes |
| claim id | 128 UTF-8 bytes |
| Finding 摘要 | 256 UTF-8 bytes |
| 每个 upload URL reserve | 512 UTF-8 bytes |

`noteBytesUpperBound = renderedKnownUtf8Bytes + U × reservedUploadUrlUtf8Bytes`。缺 target、
claim 不完整、sensitivity 为 `unknown|suspected` 或任一 limit 超界时退出 65、GitLab HTTP=0、
release BLOCKED；不拆批、不有损重编码/降采样、不截断 provenance、不丢 claim。

远端载体固定为 U 个可内联附件和一条索引 note。严格正常路径为：

```text
U upload POST + 1 note POST + 1 note GET + U authenticated attachment GET = 2U+2 HTTP
uploadedBytes = downloadedBytes = sum(unique blob bytes)
```

令 `A=maxAttemptsPerStage=3`、`R=maxPublisherInvocationsPerBatch=2`。整个 batch 生命周期：

```text
HTTP <= R*A*(2U+2)
uploadedBytes <= R*A*sum(unique blob bytes)
downloadedBytes <= R*A*sum(unique blob bytes)
```

publisher 在一次 invocation 内吸收可安全重试；一次正常 publish 加至多一次显式 resume。
R 耗尽后第三次调用前即阻断并保持 BLOCKED；提高 R 必须有 owner 的显式 policy-change 审计。
成功对象不重传。`AMBIGUOUS_NOTE` 先按 batch marker 对账；`AMBIGUOUS_UPLOAD` 不按文件名
猜成功，也不宣称 exactly-once。

正常首次成功给模型的摘要不超过 512 UTF-8 bytes。异常控制摘要每 invocation 不超过
1024 bytes，必要时至多一个不可分页、无数组的 receipt projection 不超过 2048 bytes；R=2
时整个 batch 的发布/恢复文本不超过 6144 bytes。PNG/base64、逐图数组、note body、完整
receipt 和原始 GitLab 回包默认不进入模型。

成本必须由 publisher 之外的 request/byte recorder 验证，且
`sum(attempts[].costDelta)=cost(batch_cumulative)=recorder`；publisher 自报 receipt 不能独自
证明成本。前 20 个唯一 VERIFIED `kind=acceptance` batch 的 profile 只生成 DUE 报告，
synthetic smoke 不计数；owner 明确 REVIEWED 前不自动调参。
