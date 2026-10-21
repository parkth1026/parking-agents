# v4 工单控制面

命令中的 skillDir 指向 aes-worktree-board 的实际安装目录。

用于 typed 工单、runner、merge gate、outbox、恢复和真实宿主验收。目标仓配置及身份边界见 [desktop-orchestration.md](desktop-orchestration.md#目标仓配置与-runtime)。

## v4 无人值守控制面（目标 A）

在既有 v3 Task 编排之外，`master.mjs` 提供 runner / job / attempt 分层的无人值守控制面。
v3 runtime 被**只读封存**：只记录路径与 hash 引用，绝不反向推导 job/attempt。

### runner slot

本机 slot allowlist 是 Git 忽略的 `<目标仓根>/.aes-worktree-board/runner-slots.local.json`
（schema `aes.worktree-board.runner-slots/v1`），由确定性脚本生成，LLM 只能消费。
重复生成是幂等 NOOP；改配置必须显式 update。

slot 有四类不可领取状态，每类都带原因与恢复命令：

| 状态 | 触发 | 处置 |
| --- | --- | --- |
| `QUARANTINED_CONFIG_DRIFT` | 路径指向别的仓 | 只有显式 `runner update/init` 能修 |
| `QUARANTINED_DIRTY` | 有 dirty/untracked | **绝不** reset/clean；其余 slot 继续调度 |
| `QUARANTINED_MISSING` | 路径不存在 | 确认 worktree 后 update |
| `idle` + `needsBaselineSync` | 未同步到 integration HEAD | `master.mjs release --slot <id>` |

slot allowlist 为空时 Master Goal **拒绝启动**并非零退出，不由 LLM 自动补 slot。

### 一个 job 的完整路径

```bash
node "$skillDir/scripts/master.mjs" start
node "$skillDir/scripts/master.mjs" claim --issue-file <issue.json>
node "$skillDir/scripts/master.mjs" candidate --job <jobId> --commit <sha>
node "$skillDir/scripts/master.mjs" stage review --job <jobId> --payload-file <stage-result.json>
node "$skillDir/scripts/master.mjs" stage qa --job <jobId> --payload-file <qa-receipt.json>
node "$skillDir/scripts/master.mjs" terminal --payload-file <goal-terminal.json>
node "$skillDir/scripts/master.mjs" gate --job <jobId>
node "$skillDir/scripts/master.mjs" merge --job <jobId>
node "$skillDir/scripts/master.mjs" verify --job <jobId> --commands-file <commands.json>
node "$skillDir/scripts/master.mjs" close --job <jobId>
node "$skillDir/scripts/master.mjs" release --job <jobId> --slot <slotId>
```

`jobId` 跨 attempt 稳定；`attemptId` 每次尝试唯一。旧 attempt 与证据永不覆盖。

### 分档 merge gate

`riskProfile` 由 Issue 自报，而**自报环节正是不可信处**，所以 Master 按改动路径兜底校验：
触及 identity、权限、密钥、安全边界、schema/迁移、公共 API、CI 的改动会被强制升档，
并在 `triggeredRules` 里指名是哪条规则。

| 生效档 | 行为 |
| --- | --- |
| `low` / `medium` | 机械门全绿即自动 merge |
| `high` | 机械门全绿**仍**停在 humanGate 等人工批准 |
| `critical` | 拒绝直接 merge，只走 PR；waiver 也不能覆盖 |

顶层机械门仍按八类事实求值：slot → commit → integration → acceptance → review → review-base
→ QA → qa-base。QA 内含一个条件 screenshot-evidence 子门：若 QaReceipt 的
`screenshotEvidence.required=true`，或任一 `checks[].kind=screenshot|live-screenshot`，则顶层
wrapper `screenshotEvidence:{required:true,aggregateMarker}` 必须存在且 marker 为 VERIFIED；
漏填、冲突或 candidate 不一致都 fail closed。详细字段与成本/恢复规则只读
[aes-qa GitLab 截图证据协议](../../aes-qa/references/screenshot-evidence.md)，不在总管复制 schema。
无实际截图时不新增 gate、upload 或 note，旧无截图 QaReceipt 保持兼容。

QA 内另含一个 AES-QG repository gate level 子门（同样不新增顶层第九道门）：`aes.qa.receipt/v3`
必须携带 `requiredRepositoryGate`（完整 `AES-QG-L[0-5]` 或 `"none"`）与 `repositoryGate` 原子引用
（`standardVersion=AES-QG/1`、`achievedLevel ≥ required`、`gateReceiptDigest=sha256:<64hex>`、
`candidateCommitSha` 等于当前 candidate、`outcome=PASS`）；缺级、旧证据、NOT_RUN、裸 `Lx`、
`"none"` 却有 product bytes 变化（tracker-only 路径白名单默认拒绝）均 fail closed。
`aes.qa.receipt/v4` 显式认：`repositoryGate.status` 三态闭集（`referenced` 同套 digest/candidate
校验；`not-onboarded` 需非空 reason + trackerOnly 布尔，并与目标仓 `gate-policy.toml` 存在性
对账——仓有 policy 而自称未接入即 fail closed 拒收，存在性不可核实同样拒收）；未达声明门级显式
`failureClass=gate-shortfall` 拒合并（消费侧机械复算三义务：requiredLevel 机械比较、与目标仓
gate-policy 对账——声明了 requiredLevel 而 policy 缺失/存在性不可核实/supported_through 不可
解析一律 fail closed（引擎无合法 policy 即 BLOCKED 不产等级）、三裁决位一致性）；
截图义务轮校验 `companionShots` 完整性（shots/ + shots-manifest.json + manifestSha256 +
对象化 secretsScan）。版本判别是已知版本白名单（v1/v2/v3/v4），未知版本 fail closed 拒收，
不再保留「非 v3 即 legacy」黑名单。v1/v2 历史 QaReceipt 冻结豁免该子门；v3/v4 缺
`baseCommit` 在 `stage qa` 入口即 `MISSING_BASE_COMMIT`
（不降级成旧 receipt 处理）。标准所有权与规范在 [aes-gate AES-QG](../../aes-gate/references/aes-qg.md)；
等级与发布资格正交，level 子门不裁决 release。

`gate` 另返回 `outboxWarning` 提醒未送达的 GitHub 出站条目；该字段只提供可观测性，
不改变八门 outcome，也不参与 `decision.mayMerge`。
其中 `-base` 两项校验证据取自的 integration base 仍等于当前 base，不等判 STALE
（#62 交付；integration 前进会使旧 base 上取得的 review/QA 证据失效）。
其中 review/QA receipt 的 `commitSha` 必须与当前 candidate commit **精确相等**——
旧 commit 的证据不能给新 commit 背书；QA 含 `NOT_RUN` 或 `unexecuted` 非空一律判失败。
commit 前进只能走 `candidate` 命令（那里作废旧证据）；terminal 报文里的
`candidateCommit` 与 registry 不一致时拒收（`CANDIDATE_MISMATCH`），不推进状态。

### 出站队列：close 不联网（#142）

`close` 落账即终局：先写 registry（`issueClose.outcome: LOCAL_CLOSED`）并释放 slot，
再把 GitHub 侧的 comment/close **入队**到 `<runtime-v4>/outbox.jsonl`。
**这条命令内不调用 gh**——「GitHub 挂了交付照样落地」是拓扑保证的，不是靠 try/catch 兜的。

判据来自控制面既有的二分：**registry 记意图、Git 记事实**。GitHub 在这个二分里
没有位置，它只是把结果广播出去的副作用面，不该有权阻断交付并扣住 slot。

```bash
node "$skillDir/scripts/master.mjs" outbox flush         # 送达积压；轮起点与落盘时各跑一次
node "$skillDir/scripts/master.mjs" outbox status        # 看积压与已签收留档
node "$skillDir/scripts/master.mjs" outbox acknowledge --entry <id> --reason "<理由>"
```

条目状态闭集 `pending` / `succeeded` / `abandoned` / `acknowledged`，
与 inbox 同款 append-only：状态推进靠追加新行，按 `entryId` 取最后一行为准。

- **flush 退出码恒 0**：积压是待办不是失败。让 CI 因积压变红会逼人去清队列，
  而不是去修真正的问题；积压的可见性单点归 `gate` 的 `outboxWarning`。
- **跨 flush 调用累计 3 次**失败转 `abandoned`（尺子是 `attempts` 数组长度）。
  按单次 flush 内重试计数会把网络抖动误判成永久失败。
- **条目永不物理删除**。`acknowledge` 只把它移出告警计数，且**必须带 `--reason`**——
  没有理由的签收就是静默删除，而静默删除正是这套补偿审计要防的东西。
- `gate` 的 `outboxWarning` 只念**未签收**的积压，且**不参与 `mayMerge`**：
  机械门恒为八项，可观测性不是第九道门。

**环境边界（两个方向都要守）**：worker 侧调用 `master.mjs` 必须显式设置
`AES_WORKTREE_BOARD_REPO_ROOT` 指向目标仓根，否则会在 worker worktree 里
静默孵化一个平行 registry；反过来，跑 `selftest` / `run-tests` 时**不得**继承该变量，
它会污染 fixture 场景。

### aes-merge-worker（合并验收 worker）

v4 的角色分工是 **hub-and-spoke**：总管只管 claim / 派单 / slot / queue / 打回与
人工态路由，**不亲自执行合并**；合并验收是挂在总管之下的专职 worker lane
（`aes-merge-worker`），与 aes-issue-worker 平级、零直连——一切交接经 registry。

merge-worker 消化 mergeQueue 的完整职责：

以下是已有集成门禁，不是生成任务 AC 的清单。worker 工单携带目标和已有 Issue 正文，
独立验证应结合背景、范围和确认的期望理解 AC；不能因任务验证精简而跳过集成门禁，
也不把这些门禁逐项复制为用户的新目标。

1. 从 queue 领取 ready-to-merge 的 job；
2. 派独立 `code-review` subagent（Standards+Spec 双轴；深度按 `resolveMergePolicy`
   的 **effectiveRisk** 分档——含路径兜底，比工单自报档更准），review receipt 由
   merge-worker 侧 `stage review` 上报——**被审的 worker 无法自报 review PASS**；
3. review PASS → gate 八项 → 串行 merge → **merge 后全量回归**（commands file 跑
   全量套件，非 targeted）→ 幂等 close → release slot；
4. review MUST_FIX → 以 `aes.issue-worker.review-return/v1` 经总管打回原 owner
   session（原 thread 优先、新 attempt 兜底）：报文含 `jobId`/`attemptId`/
   `commitSha`（必须等于被审 candidate）、`findings[]`（`axis` 闭集
   `standards|spec`）、`budget.reviewLoops`。同一打回单据以新 commit 闭合，不重复
   消费；worker 修复后必须重走 aes-qa 回归再重新 READY；
5. **reviewLoops 由 merge-worker 记账**（每次打回递增）；耗尽后回
   `REVIEW_BUDGET_EXHAUSTED`，由总管决策（`NEW_ATTEMPT_FRONTIER_MODEL` /
   `AWAITING_HUMAN`）。普通 finding（非 must-fix）merge-worker 侧自行记录，
   不打回、不烦扰 worker。

机械入口先用 `review claim --job <jobId>` 领取 review：它按 candidate 的实际改动路径
推导 `effectiveRisk`，并固定 `low|medium → light`、`high|critical → deep` 后落 registry。
review subagent 的结果只由 merge-worker 用 `stage review` 上报；MUST_FIX 会生成 typed
打回，PASS 才能进入后续 gate。载体形态不改变这条 provenance 边界。

### 中断恢复

Master 死亡后人工重启，只凭 registry / inbox / receipts + Git 恢复：

```bash
node "$skillDir/scripts/master.mjs" reconcile
```

**判定 merge 是否真的发生，问 Git 不问状态位。** merge 前先落 `mergeIntent`，
reconcile 用 `git merge-base --is-ancestor` 核实 candidate 是否已在 integration 中：
在则认领既有 merge，不在则退回队列重排。这是「无重复 merge / 无丢失 job / 无假完成」
的实际依据 —— 进程可能在写状态位之前就死了，Git 不会。

reconcile 输出对每个 job 与每个 slot 都给可解释状态；`unexplainedJobs` /
`unexplainedSlots` 必须为 0。

### 人工态

`awaiting-human` / `blocked-permission` / `contract-conflict` 三个终点必须携带
`humanRequest{kind, prompt, requiredEvidence, resumeToken}`。缺 `resumeToken` 的报文
schema 拒收且**不推进状态**。人工答复必须 `actor: "human"`，Agent 不得代答；
`WAIVED` 需要结构化 `waiver{reason, loweredCriteria, authorizedBy}`。

### 700×1000 竖屏工作台

产品在 `(max-width: 900px) and (orientation: portrait)` 下切换到竖屏工作台，
渲染在 shadow root 内，与桌面全屏星图完全隔离（桌面层 id 与样式互不可见）。
该区段由 `scripts/build-portrait.mjs` 从确认版对照物 `mock.html` 机械生成并记录其
sha256；`board-ui` 域会核对生成物与真源同步，以及产品与 mock 的**逐像素**一致。
改视觉走「改 mock → 重跑 build-portrait.mjs」，不要手改 board.html 的生成区段。

### 真实宿主门（离线门代替不了的证据）

```powershell
node "$skillDir/scripts/live-gate.mjs" desktop --repo <目标仓根>
node "$skillDir/scripts/live-gate.mjs" worktrees --repo <目标仓根> --branch <integration> --paths <p1,p2,...>
node "$skillDir/scripts/live-gate.mjs" live-receipt --repo <目标仓根> --host <host worktree> --branch <integration> --issue-repo <owner/name>
```

`worktrees` 是**纯只读**校验：它比对每个 worktree 前后的完整指纹（HEAD / branch /
status / stash / reflog），前后不一致即判定「只读校验产生了写副作用」。只读如果不被
机械证明，就只是一句承诺。

receipt 一律落在 Git 忽略的 `<目标仓根>/.aes-worktree-board/receipts/`，不进版本库：
写进受版本控制的目录会让每次跑门禁都把 worktree 弄脏，slot 随即被 `QUARANTINED_DIRTY`，
交付循环在释放 slot 那一步就死锁了。

真实宿主门证明的是离线门结构上看不到的东西。已经抓到的两类：只在**第二份检出**上
存在的换行耦合（真源 SHA 绑定工作区字节、生成器锚点吃不掉 CRLF），以及只在**复用真实
slot** 时才走到的自我污染路径。离线 fixture 每次用全新临时仓，这两类永远碰不到。
