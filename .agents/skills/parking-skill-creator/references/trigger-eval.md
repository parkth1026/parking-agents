# 触发评测：优化 description 的触发准确率

description 决定技能会不会被调用。技能做完、或用户反馈「触发不准 / 和别的技能抢」时读本文件。
它是独立入口：走创建主线（SKILL.md 第 1–6 步）的人不需要它，进来做触发评测的人也不需要那六步。

description 决定技能会不会被调用。技能做完（或触发不准）时主动提议跑触发评测。**首选机制：同宿主 subagent 探针**——生产环境用哪个 agent 跑就用哪个 agent 测，同宿主同模型。

起跑前先确认**当前编排会话**能否 spawn 探针。若没有嵌套 Agent 工具，读取 `references/headless-trigger-fallback.md`：仅在主会话已把同宿主、同模型凭据预置到进程环境时，用安全 launcher 单轮运行 `zcode --prompt`；严禁读写共享 CLI 配置、key 落盘或编排器自答，运行后删除私有 Temp 并扫描凭据前缀。缺少任一宿主能力或授权时停止，把整轮触发评测交回主会话直跑。

### 建评测集

约 20 条 query，存 `<技能目录>/trigger-evals.json`（schema 见 `references/schemas.md`）——题库是定稿资产，随 .skill 包分发；定稿后不改：要改就视为新题库、开新一轮全量重跑，且不与 description 改动混进同一提交（跨轮可比性依赖题库固定）：

```json
{
  "skill": "log-classifier",
  "queries": [
    { "id": "q1", "text": "把 D:/logs/ 下的 Jenkins 失败日志按错误模式归类", "should_trigger": true },
    { "id": "q5", "text": "帮我把这段报错截图里的英文翻译成中文", "should_trigger": false }
  ]
}
```

- 必须像真用户会说的话：具体、带细节（路径、上下文、口语、缩写、错别字都要有），别写成抽象指令。
- **应触发**（8-10 条）：同一意图的多种说法，正式与口语混搭；用户没点名技能但明确需要的场景；和相邻技能竞争但本技能该赢的场景。
- **不应触发**（8-10 条）：最有价值的是 **near-miss**——关键词重叠但意图不同的请求。「写个斐波那契函数」这种明显无关的反例什么也测不出来。
- 触发机制的现实：agent 只对「自己不容易直接搞定」的复杂多步任务咨询技能；「读一下 X 文件」这类简单请求即使 description 完全匹配也不会触发——评测集要足够有分量。

写好后向用户过一遍再跑。

### 分批并行 spawn 探针

对每条 query spawn 探针 subagent（同宿主、每条默认 3 个探针；宿主支持无工具 agent 类型时探针优先用无工具类型）。探针按**整条 query 分批**：默认每批 3 条 query（=9 个探针同回合并发，对齐官方 run_eval.py worker-pool 默认 10 并发的量级），同 query 的 3 个探针同批发、一批收完再发下一批；并发受限的宿主按比例调小批。批怎么切不影响聚合（聚合按 query 多数表决），但别为凑并发把全部约 20 条 × 3 探针一次推出去。探针 prompt 模板：

```
你是一个技能路由判断器。你不需要、也不允许实际执行任务、调用任何工具或浏览任何文件——你只做一件事：从下面的技能清单里选出会用到的技能。

用户向你提出以下请求：

<query 原文>

请先决定你会使用哪个技能来处理它。可用技能清单如下（name + description）：
<逐条列出会话可见的全部技能清单>

回复格式要求（必须严格遵守）：
第一行输出 `SKILL: <技能name>`——你会读取并使用的技能名；若不需要任何技能则输出 `SKILL: none`。
第二行起用不超过 15 个字说明理由。
```

首行的护栏句必保：没有它，任务形状的请求会诱使探针真去执行任务（实测 5~10 倍 token 与耗时）或翻到评测文件。**防泄漏红线**：探针 prompt 不得包含 should_trigger 预期答案、评测意图暗示、「我们在测试 X 技能」等信息；评测集与探针结果就放在 workspace，探针浏览文件即泄漏，护栏句已禁止。探针要知道的只有：请求原文、技能清单、首行协议。

**Agent 通道下的清单插槽**：`<逐条列出会话可见的全部技能清单>` 默认要求把完整清单逐条内嵌进每个探针的 prompt 参数。清单条目一多就会撑爆编排者自己的上下文——实测 119 条技能、42.6KB（name+description，UTF-8）的清单，按默认分批（约 20 query × 3 探针 ≈ 60 探针）逐条内嵌，编排者单轮生成的工具调用参数总量 ≈ 60 × 42.6KB ≈ 2.5MB，编排会话直接爆掉。这是 Agent 通道特有的问题：headless 通道走 `--skills-file` 由 launcher 在进程内拼 prompt，从不经过编排者 token（见 `headless-trigger-fallback.md`）。

清单体积超出编排者能承受的单次工具调用参数量时（没有固定阈值——出现编排 token 异常飙升或工具调用报体积超限就是信号），改用**清单文件 + 单次授权读取**：

1. **清单文件位置**：写入 workspace 外的独占目录，例如 `.agents/evals/<技能名>-trigger-manifest/visible-skills.txt`；该目录不得混入题库、探针结果等评测材料——探针能泄漏的只应是清单本体，不该牵连评测意图或判定口径。
2. **清单插槽替换**：把模板里的 `<逐条列出会话可见的全部技能清单>` 换成：

   ```
   可用技能清单已存于文件 <清单文件绝对路径>，读取该文件即获得清单本体。
   这是本任务唯一允许的一次文件读取，除此之外你不得读写、执行或浏览任何文件。
   ```

   模板其余部分——护栏句、query 原文、首行协议、判定口径——原样不动。
3. **成本量级**：每个探针多付一次 Read（约 15k tokens 进探针上下文），与 headless 通道走 `--skills-file` 的清单注入成本同量级，不构成额外负担。
4. **防泄漏边界**：这条授权只到「读一次清单文件」为止——探针只知道清单文件路径，不知道 workspace 路径、题库内容或「在测试触发」这件事本身；不得放宽成「可按需读取其他文件」，那会打穿护栏句本要挡住的翻文件泄漏面。

每个探针完成后，**逐条追加**进 `<workspace>/probe-results.jsonl`（原始探针数据，scratch 不入库）：

```jsonl
{"query_id": "q1", "probe": 1, "first_line": "SKILL: log-classifier", "triggered": true, "reason": "日志归类任务"}
```

`first_line` 填探针回复的逐字首行——它是聚合器唯一判定源；不匹配 `SKILL: <名>` 协议的行记 invalid，不猜。

### 聚合

```bash
node scripts/aggregate-trigger.mjs <workspace> --persist <技能目录>
```

先校验 `skill`、query id/text/should_trigger 和正负两类样本；探针协议不完整、JSONL 坏行、未知 query 或含换行的 `first_line` 都记 invalid，不猜答案。全无有效探针时退出码 1 且不写 `trigger-benchmark.json`，避免把 0 分假报告当成证据。

输出 `trigger-benchmark.json`：train/test 60/40 按 should_trigger 分层切分（官方 run_loop 口径），每 query 3 探针取严格多数，各层触发率/误触发率/invalid 计数；多轮（改写 description 后再跑探针，jsonl 行带 `description` 字段）时按 **test 正确数**选 best_description，防过拟合。结果同时记录 `valid_probes`，每轮记录有效探针数，便于审计证据是否充足。

**样本下限**：test 里**真正拿到有效探针**的 query 数（`test.evaluated`，不是切分声明的条数——8 条里 6 条没探针，实际证据仍只有 2 条）低于下限时**不宣告** best_description，置 `null` 并在 `best_description_reason` 写明原因。默认下限 6；20 条题库在 holdout=0.4 下 test=8，正常通过。这与「全无效探针退出 1、不写假报告」同源——test 只有 2 条时，一轮赢另一轮往往只差一条 query，那不是证据是噪声。需要放宽用 `--min-test-queries <N>`（显式动作，免得小题库悄悄拿到一个看起来权威的结论）；其余指标照常产出，不是整体失败。

`--persist <技能目录>` 把题库读取与成绩写出缺省切到技能目录（`trigger-evals.json`/`trigger-benchmark.json` 沉淀进技能根，显式 `--eval-set`/`--output` 仍可覆盖）；技能目录缺题库或目标不是目录时拒绝（退出 1），**绝不静默回退**读 workspace 旧副本——那是跨轮漂移的源头。probe-results.jsonl 始终留 workspace。成绩为原子整写（非追加），跨轮内容史由 git 记录。不带 `--persist` 时与旧行为完全一致，外部技能一次性评测照旧。

### 迭代 description

读聚合结果里的失败案例（漏触发/误触发的 query 与理由），**你在会话内**改写 description（参考 writing-guide 的 description 写法），更新 SKILL.md frontmatter，再跑下一轮探针——全程不外呼任何 CLI。收敛或不再改善时，把 best_description 写进 frontmatter，向用户展示前后对比与各轮分数。

---
