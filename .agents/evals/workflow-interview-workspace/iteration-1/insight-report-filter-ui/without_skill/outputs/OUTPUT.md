# 工单：`aes-interview` 重入需要"补丁模式"，不再对被 `needs_reinterview` 打回的会话重跑整套访谈

状态：待排期（范围与验收标准已谈清，未动代码）
关联仓库路径：`.claude/skills/workflow-interview/`、`.claude/skills/aes-interview/`

## 一句话

原始请求"允许用户中途改需求"太模糊，且仓库里已经有一条为此设计的回退路径
（`needs_reinterview`）。经访谈定位，真正要修的不是"缺一个新功能"，而是**这条已有
回退路径重入 `aes-interview` 时没有"补丁模式"**：文档要求它每次被叫起都完整走一遍
"调查事实 → 批量问清歧义 → 五维度全部已定才能收尾"的仪式，不区分"第一次进入"和
"被某个后面的阶段打回来纠正一条"。后者应该只问被点名的那一条，其余维持原状。

## 背景（从维护者访谈里还原的真实场景）

维护者之前处理另一个需求时，走到第 3 阶段（`aes-goal-contract`，契约快写完）才发现
第 1 阶段确认过的一条边界后来是错的：当时确认"只改前端"，后来发现后端也得改。他用
现有的 `needs_reinterview` 把流程打回第 1 阶段。

体感上是"整套流程重来一遍"：访谈阶段被完整重新问了一次，包括很多跟"前端/后端"这条
边界完全无关的点。对照物阶段（`aes-prototype`）没有被完整重跑（这与代码里的状态机
逻辑吻合，见下），但访谈阶段确实是完整仪式重来的，不是针对性打补丁。

## 现状调查（已核实，不需要再猜）

- `.claude/skills/workflow-interview/scripts/session.mjs` 的 `stage` 命令：调用
  `stage <dir> <当前阶段> needs_reinterview` 时，**只把触发时那个阶段的 gate 标成
  `needs_reinterview`**，其它阶段的 gate（含 `closed_at`）原样保留；同时把全局指针
  `manifest.stage`重置为 `1-interview`，并把 `stage_gates['1-interview'].status`
  改成 `in_progress`（但不清空它原有的 `closed_at`）。
- 等 `aes-interview` 重新收尾、调用 `stage <dir> 1-interview done` 时，代码会在
  `STAGES` 里找"第一个状态不是 `done`/`skipped` 的阶段"作为下一站。如果触发时
  `2-prototype` 的 gate 还是 `done`，流程会跳过它直接回到那个被标记
  `needs_reinterview` 的阶段（比如 `3-contract`）——**这一步机制本身没有问题**，
  它天然不会强迫重跑已经 `done` 且没被点名的阶段。
- 问题出在 `aes-interview/SKILL.md`：文档只有一套流程（"1. 调查事实" → "2. 批量问清
  歧义"，收尾判据是"意图/结果/边界/约束/现状 五个维度都不能停在未定"），**没有为
  "被 `needs_reinterview` 打回重入"这种情况写任何区别对待**。`context.md` 的写法也是
  "宿主写，分片存在时先聚合分片"，没有"已有 `context.md` 时只增量改动错的那一行"的
  说明。执行 `aes-interview` 的 Agent 因此只能按"完整走一遍"的默认指令执行，这正是
  维护者体感到的"全部重来"。
- `rounds.jsonl` 的 schema 已经支持 `triggered_by` 字段（记录"这条问题是被哪份草稿
  撞出来的"），**这部分基础设施已经够用，不需要新增字段**。

## 范围

### 要做

1. **在 `aes-interview/SKILL.md` 里补一段"重入判定与补丁模式"**，明确两种入口：
   - **首次进入**：`manifest.stage_gates['1-interview'].closed_at` 为空 → 走现有的
     完整流程（调查事实 + 批量问清歧义 + 五维度收口），不变。
   - **补丁式重入**：`stage_gates['1-interview'].closed_at` 已经有值（说明之前
     `done` 过，这次是被某个阶段用 `needs_reinterview` 打回来的）→ 进补丁模式：
     - 从当前处于 `needs_reinterview` 状态的那个阶段的 `gate.reason`
       （以及 `manifest.next_action`，两者内容应一致）里取出"被点名要重问的那一条"，
       只针对这一条（以及它逻辑上牵连的维度）批量提问，**不重新调查已经写进
       `context.md` 的事实，不重新问跟这条无关的、已经在之前某轮 `rounds.jsonl`
       里定过的项**。
     - 收尾时不要求把五个维度重新逐一确认成"已定"作为前提条件，只要求：被点名的
       那个维度、以及下面第 2 条"牵连检查"发现被波及的维度，重新标为"已定"。
   - 两种入口共用同一套提问方法论（`asking.md`），只是提问范围不同，不新增另一份
     方法论文档。

2. **补一步强制的"牵连检查"（ripple check）**，在补丁模式收尾之前必须做：
   - 问自己（必要时问用户）：这条被纠正的边界，是否会让 `aes-prototype` 阶段
     `impact-surface.md` 里原本判"无差异"的某一面变成"有差异"，或者让已经出的
     确认版对照物本身过时？
   - 如果会：在把 `1-interview` 收尾成 `done` 之前，先对 `2-prototype` 也跑一次
     `node session.mjs stage <dir> 2-prototype needs_reinterview --reason "<引用这条被纠正的边界，说明新波及了哪一面>"`，
     让它和 `1-interview` 一起进入待重跑状态，这样收尾后"跳到第一个非
     done/skipped 阶段"的逻辑才不会把已经过时的 `2-prototype` 悄悄跳过。
   - 如果不会：什么都不用做，`2-prototype` 的 gate 保持原状，让现有的跳转逻辑
     自然生效。
   - 这一步的判断结果要写进 `context.md`（见下）和当轮 `rounds.jsonl`，不能只停留
     在 Agent 的临时推理里。

3. **`context.md` 增量更新的写法**：补丁模式下，`context.md` 不是整份重写，是在
   受影响的段落原地更新，并加一条简短"修订记录"（改了什么、从什么改成什么、为什么、
   由哪个阶段的哪份产物撞出来——复用 `rounds.jsonl` 已有的 `triggered_by` 约定，
   在 `context.md` 里引用同一个出处即可，不需要发明新格式）。

4. **`workflow-interview/SKILL.md` 的"回退"小节**加一两句，指向
   `aes-interview/SKILL.md` 里新增的这段判定规则，避免编排器层面的说明和
   子技能层面的执行脱节（现在"重新进入 aes-interview 把这些问清楚，再从中断处继续
   往下"这句已经是对的意图，只是没人把它翻译成可执行的判定条件）。

### 明确不做（这次访谈里维护者主动划掉的）

- 不新增 CLI 命令、不改 `session.mjs` 的状态机、`STATUSES` 列表或 `stage` 命令的
  行为——`needs_reinterview` 现有的状态流转逻辑已经够用，问题不在状态机，在
  `aes-interview` 被重入时的执行指令上。
- 不覆盖"用户单纯改主意、需求方向整个变了"这种场景（不是子技能发现某条确认错了，
  是用户主动要一个不一样的东西）。维护者确认这种情况现阶段确实应该走完整三阶段
  重来，不在这次范围内。
- 不改 `aes-prototype`、`aes-goal-contract` 两个 SKILL.md 本身的产物格式——它们已有
  的 `needs_reinterview` 触发方式（`stage <dir> <当前阶段> needs_reinterview --reason`）
  保持不变，本工单只改"回退之后 `aes-interview` 该怎么表现"。

## 验收标准

- AC1：`aes-interview/SKILL.md` 里能读到一条明确、可执行的判定规则，用来区分
  "首次进入"与"补丁式重入"，判定依据是 `manifest.json` 里已经存在的字段
  （`stage_gates['1-interview'].closed_at`），不依赖新字段、不依赖 Agent 的主观判断。
- AC2：补丁模式的文字明确写出"只问被点名的那一条（从触发阶段的 `gate.reason` /
  `manifest.next_action` 取）"，以及"不重新调查已写进 `context.md` 的事实，不重新问
  已经在之前 `rounds.jsonl` 定过的、与这条无关的项"，且收尾条件从"五维度全部已定"
  降级为"被点名的维度 + 牵连检查发现被波及的维度已定"。
- AC3：文档里有一步显式的"牵连检查"，判断被纠正的边界是否波及 `aes-prototype` 已判
  "无差异"的某一面；判断结果与后续动作（是否连带把 `2-prototype` 也打回
  `needs_reinterview`）都写进 `context.md` 与 `rounds.jsonl`，不是口头推理。
- AC4：`context.md` 的更新方式写明是"原地增量改动 + 一条修订记录"，不是整份重写；
  修订记录里能看出改了什么、为什么、由哪份产物触发（复用 `triggered_by`）。
- AC5：`workflow-interview/SKILL.md` 的回退小节里能看到一句指向
  `aes-interview/SKILL.md` 判定规则的引用，两份文档对"重入该怎么表现"说法一致，
  不冲突。
- AC6：`session.mjs` 无需改动即可满足以上全部——用一次真实或模拟的
  `needs_reinterview` 回退过程验证：`2-prototype` 此前是 `done` 且牵连检查判"无
  波及"时，收尾后流程确实跳过 `2-prototype` 直接回到触发阶段，不多问一句已经定过
  的、无关的问题；牵连检查判"有波及"时，`2-prototype` 的 gate 确实被一并打回
  `needs_reinterview`，不会被悄悄跳过。
- AC7（负向用例，防止范围蔓延）：这次改动不引入任何处理"用户主动要不一样的东西/
  大改方向"的路径；这类请求仍然只能通过完整重走三阶段处理，工单验收不检查这个
  场景是否变得更方便。

## 尚存的开放问题（留给排期后的实现者，不阻塞排期）

- "牵连检查"目前定位成 `aes-interview` 补丁模式收尾前的一个必答问题，具体问法
  （是自己判断写进 context 就够，还是要过一遍完整的 `aes-prototype` 六面清单）没有
  钉死，留给实现者结合 `aes-prototype/SKILL.md` 现有的六面判断法自己决定怎么复用，
  但结论必须落盘这条是硬要求。
- 如果同一份 `rounds.jsonl` 里，被点名的那条本身跟另一条早先"已定"的默认区/确认区
  决定互相牵连（不只是波及对照物阶段，还波及访谈阶段内部另一条已定的事），本工单
  没有单独设计处理规则，默认按现有的"批量问清歧义"方法论处理（不是新场景，是老
  方法论的正常应用范围）。
