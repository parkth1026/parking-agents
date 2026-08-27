# Goal Contract: 把 round 1–9 锁定的 worker 闭环落成三处 prose 真源

- Status: Ready
- Target: G:\GIT\AI_WorkFlow\parking-agents-manual（.agents/skills/ 开发侧真源）
- Updated: 2026-08-27

## 原始请求

> 我们用这个严格流程 重新梳理这次 aes-issue-worker 内容，同时 你要开 issue 来登记一下。

过程中的关键补充原话（均已裁定）：

> aes-qa 就是 evaluator 啊 为啥分开了？
> master 这里……只是用来接收类似本地 pr 的流程的 worker，就是专门用来 merge 后做全量测试的，不是真正的总管。
> aes-integrator 不是在 aes-issue-worker 里的一环吧……应当说是挂在 aes-worktree-board master 节点的吧。
> 1.确认 2.aes-merge-worker 3.确定

## 目标

aes-issue-worker 的阶段闭环、aes-qa 的调用模式、aes-worktree-board 的角色表述三处
prose 真源与 round 1–9 锁定的 hub-and-spoke 架构一致，执行 Agent 读技能文档即得新
流程，不再需要翻聊天记录或过程文件。

## Why

- 现行 aes-issue-worker SKILL.md 仍写着 review 在 worker 内自派自报——被审者雇佣
  审查者的 provenance 洞（W-2 同款）留在真源里，每张新单都按旧流程跑。
- aes-qa SKILL.md 只描述出 receipt 的一种调用，循环轮/回归两种形态无文字依据——
  prose 与用法漂移正是 W-4（承诺字段零消费）的成因。
- 合并验收角色（aes-merge-worker）已定名定责但无文字落点，将来建设时无契约可依。

## 范围

做什么：

- 重写 `.agents/skills/aes-issue-worker/SKILL.md` 的阶段闭环与角色表述（v7 形态）。
- `.agents/skills/aes-qa/SKILL.md` 增补「循环轮 / 最终轮 / 回归」三种调用模式一节。
- `.agents/skills/aes-worktree-board/SKILL.md` 与 `references/design.md` 写入
  aes-merge-worker 角色与 `aes.issue-worker.review-return/v1` 打回协议，废止
  「Master host 兼任合并」的旧表述。
- 三份文档的**其余章节不重写**（issue-worker 的边界/工单输入/DISCOVERED_WORK/中断恢复
  节、aes-qa 的档位表/secrets 节、board 的 v3 编排/看板/身份节），仅在与新闭环直接
  冲突处做最小修订。
- **v3 编排节的宿主合并表述（「宿主工具负责……合并动作」「合并是宿主主 agent 的受
  门禁动作」）不在废止范围**：它们描述的是 v3 Desktop Task lane 的既有语义，保留原文，
  只加一句指向 v4 角色分化（merge 权归 aes-merge-worker）的最小括注。「废止旧表述」
  仅指 v4 无人值守控制面区把合并写成 Master 亲自执行的句子。

不做什么：

- 不实现 aes-merge-worker（不建技能目录、不建其 map、不写任何执行逻辑）。
- 不实现人参与 lane（for-human 模式只记角色位与协议复用）。
- 不改任何 `.mjs`、不动 work-order / registry / receipt schema、不碰机械门语义。
- 不做 aes-gate 联动（map #47 管辖）、不同步发布树（aes 族不在 `skills/`）。

## 强约束

- 三份确认版对照物不可修改：执行 Agent 改的是技能文档，不是对照物。
- `aes.issue-worker.work-order/v1` 零字节改动；selftest-v4 既有断言不许动。
- 不变量原样保留进新文档：机械门 receipt 绑 candidateCommit 精确相等；GATE-review
  无条件（分档只调深度）；hub-and-spoke lane 零直连（一切交接经 registry）；merge 权
  独属 aes-merge-worker（worker 永不 merge）；人工答复 `actor:"human"` + resumeToken
  + WAIVED 需结构化 waiver。
- aes-qa 是唯一验证角色：循环轮只出 finding 不进 registry；只有最终轮出 typed
  QaReceipt；打回修复后必须重走 aes-qa 回归（新 commit 新 receipt）。
- 命名闭集：aes-merge-worker（弃 aes-integrator）；流程步骤名一律用技能名
  （tdd / diagnosing-bugs / aes-qa / simplify / code-review），不引入自造词。
- 本契约任何修订必须同步 GitHub #83 正文的六节契约块（board claim 从正文解析，
  contractDigest 派生自正文）；只改仓内文件不改正文会造成 board 按旧契约派单。

## 自主边界

不用问，直接定：

- 三份文档的章节组织、行文措辞、锚点词落在哪一段。
- review 分档深度的具体检查清单措辞（low/medium 轻量双轴、high/critical 加查面）。
- simplify「实质代码改动」的判断指引措辞。
- aes-qa 调用模式一节的篇幅与示例。
- 打回通道实现载体的表述方式（原 thread 消息优先、新 attempt 兜底——两者都写明即可）。

必须停下来问：

- 任何 `.mjs` 或 schema 改动的冲动（本票承诺零代码改动）。
- 想创建 aes-merge-worker 技能目录、其 map、或实现人参与 lane。
- 发现三份对照物之间互相矛盾（回 needs_reinterview，不现场裁决）。
- 想改 34 条 AC 或机械门语义的任何表述（board 契约由 map #5 管辖）。

## 读什么

- `../2-prototype/behavior.md` — 9 条变化行 + 角色词表，AC-001/002/003 的逐行对照源。
  **「v7 形态」即指此确认版**：本节点名的三份确认版对照物是唯一对照依据，任何历史
  草稿（与定稿存在有意的命名差异）不作依据，无需另行核对。
- `../2-prototype/api-mock.md` — review-return/v1 报文对与已锁定约定，AC-003 对照源。
- `../2-prototype/diagram.html` — hub-and-spoke 架构视图与双泳道流程视图。
- `.agents/skills/aes-issue-worker/SKILL.md`、`.agents/skills/aes-qa/SKILL.md`、
  `.agents/skills/aes-worktree-board/SKILL.md` 与 `references/design.md` 现状。
- GitHub：map #82（Decisions so far 已同步）、票 #83（round 1–9 过程记录评论）。

## 验收条件

- AC-001: aes-issue-worker SKILL.md 的阶段闭环重写为 v7 形态并与
  `../2-prototype/behavior.md` 变化行 1–5、7 逐行一致（人工验收时对照）：aes-qa
  循环轮内循环、simplify 条件触发、单次 candidate commit、aes-qa 最终轮出 receipt、
  READY terminal 进 registry、打回后重走回归；旧的「review 在 session 内修」表述消失；
  **frontmatter description 同步新流程**（旧序「实现 → 只读 review」消失）。
  - Verify: [A] `node -e "const s=require('fs').readFileSync('.agents/skills/aes-issue-worker/SKILL.md','utf8');process.exit(s.includes('循环轮')&&s.includes('最终轮')&&s.includes('aes-merge-worker')&&!s.includes('在本 session 内修')&&!s.includes('实现 → 只读 review')?0:1)"` → 退出码 0
- AC-002: aes-qa SKILL.md 含「循环轮 / 最终轮 / 回归」三种调用模式的显式区分，与
  behavior.md 变化行 1、4、7 一致（人工验收时对照）：循环轮只出 finding 不出
  receipt，最终轮绑 commit SHA 出 typed QaReceipt，打回后回归重跑；**frontmatter
  description 同步新顺序**（旧语「review 通过后」消失）。
  - Verify: [A] `node -e "const s=require('fs').readFileSync('.agents/skills/aes-qa/SKILL.md','utf8');process.exit(s.includes('循环轮')&&s.includes('最终轮')&&!s.includes('review 通过后')?0:1)"` → 退出码 0
- AC-003: aes-worktree-board SKILL.md 与 references/design.md 写入 aes-merge-worker
  角色（queue 领取、code-review 派生分档、gate→merge→全量回归→close、reviewLoops
  记账）与 review-return/v1 打回协议，与 `../2-prototype/api-mock.md` 三对报文及已
  锁定约定一致（人工验收时对照）；「Master host 兼任合并」旧角色表述废止。
  - Verify: [A] `node -e "const f=require('fs');const a=f.readFileSync('.agents/skills/aes-worktree-board/SKILL.md','utf8');const b=f.readFileSync('.agents/skills/aes-worktree-board/references/design.md','utf8');process.exit(a.includes('aes-merge-worker')&&a.includes('review-return')&&b.includes('aes-merge-worker')?0:1)"` → 退出码 0
- AC-004: 人参与 lane 的角色位记入 aes-issue-worker SKILL.md：executionPolicy=for-human
  模式（round 9 裁定）、humanRequest{resumeToken} typed 暂停、aes-qa humanChecklist
  在此获得消费方，并明确「本票不实现该 lane」的边界。
  - Verify: [D] `.agents/skills/aes-issue-worker/SKILL.md` 内容检查：含 for-human 模式角色位声明、humanRequest 暂停协议引用、与「不实现」边界句。
- AC-005: 零回归卫——本票交付后仓库根测试与 board 对 schema 最敏感的 orchestration
  域保持全绿（零 schema 改动的机械证明；此命令当前即为绿，交付后必须仍绿；十域全量
  `run-tests.mjs` 因含浏览器域不进冒烟，交付后由执行 Agent 完整跑一次并报告）。
  - Verify: [A] `npm test && node .agents/skills/aes-worktree-board/scripts/selftest.mjs orchestration` → 退出码 0

## 残留风险

- QA receipt 的 provenance 仍在 worker 侧（最终轮由 worker 派生并上报）——错了会怎样：
  偷懒的 worker 可编造 receipt 过 GATE-qa；修复归 aes-gate（map #47）的确定性检查，本票不扩面。
- aes-merge-worker 的载体形态（独立 session 占 host worktree vs 总管兼任）与打回通道
  实现未实测——错了会怎样：将来建设时可能发现 prose 协议与宿主能力不匹配，需回本契约修订。
- merge 后全量回归耗时进入串行 merge 临界区——错了会怎样：队列吞吐由全量套件时长决定，
  长队列下交付变慢；此为 design.md 已记录的既有结论，本票不新增机制。
- AC-001~003 的 [A] 锚点只挡结构性遗漏，语义一致性押在 AC 陈述内点名的人工对照上——
  错了会怎样：锚点词齐但语义走样的文档能过冒烟，需在验收时逐行对照对照物拆穿。
  **档位分布实情**：finalize 打印的「[A] 4 / [D] 1」低估人工负载——AC-001~003 的承重
  验证（语义逐行对照）在人工侧，实际人工验收面是 4 条（AC-001~004），只有 AC-005
  纯机械。冷读交接指令的人不要被 [A] 标签的比例误导。

## 访谈记录

### 1-interview round 1（提问区 2 + 确认区 2 + 默认区 5）

| 问题 | 候选（当时百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| Q1 review 分档怎么落地 | A 扩 work-order 带 declaredRisk 50% / B 本轮不分档 35% / C worker 自读 Issue 15% | A | A（后被 round 5 连锁撤销：review 移层后分档依据在 merge-worker 手里且更准） |
| Q2 simplify 触发条件 | A 条件触发 45% / B 每单必跑 30% / C 不进流程 25% | A | A |
| C1 QA 顺序维持 review→QA | 确认区 | 维持 | A（后被 round 4 推翻：QA 循环在前、review 移终局） |
| C2 review 无条件性 | 确认区 | 保持 | A（存续：分档只调深度） |

默认区 5 条未被反对：路由契约锁定 / 异议走 CONTRACT_CONFLICT / 单 session 模型 /
落地面开发侧 / self-test 显式化。

### 2-prototype rounds 2–9（对照物迭代，3 次推翻推荐）

| 轮 | 定了什么 | 用户 |
| --- | --- | --- |
| 2 | simplify 仅首次 commit 前 → 每次 commit 前 | 用户质疑触发（overturned） |
| 3 | simplify 再移至 review PASS 后、QA 前 | 用户坚持终局位置（overturned） |
| 4 | 循环结构重构：solve↔evaluator 内循环 + 单 commit + 终局并行双验；C1 推翻 | 用户提出，oh-my-codex 佐证采纳 |
| 5 | code-review 移出 worker 至合并验收层；Q1 连锁撤销，落地面收敛纯 prose | 用户提出，双向 steelman 采纳 |
| 6 | evaluator 与终验双角色取消——aes-qa 单一角色两种调用 | 用户指正（overturned） |
| 7 | 步骤名=技能名；打回后 aes-qa 回归显式化；验收层与总管分离 | 用户三条修正 |
| 8 | 拓扑修正：hub-and-spoke，merge-worker 挂总管、lane 零直连；人参与 lane 补位 | 用户指正（overturned） |
| 9 | 终版确认；定名 aes-merge-worker；人参与 lane = for-human 模式 | 1.确认 2.aes-merge-worker 3.确定 |

### 3-contract round 1

5 条 AC 后果行与默认区验证途径整体确认（用户原话：确认）。无提问区：本票无数字
门槛、无真实数据需求、无新建基建。

## 设计取舍

### D-1 code-review 归属

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A worker 内自派（v4 现状） | review subagent 由 owner session 派生并上报 | 被审者雇佣审查者：receipt provenance 无法机械证明（W-2 同款洞） | 信任模型不成立 |
| B（选定）merge-worker 派生 | 验收方派 review、记账 reviewLoops、打回经总管 | MUST_FIX 打回跨 session，低频事件付重建上下文成本 | 无 |
| 什么都不做 | 保持 prose 与讨论脱节 | 每张新单按旧流程跑 | 本票的存在理由 |

选定 B。理由：验收方雇佣审查者与 autopilot 链、PR 模型同构，且连锁使 work-order
schema 零改动（分档依据 effectiveRisk 在 merge-worker 手里更准）。
落进契约的形态：`强约束` 写「merge 权独属 aes-merge-worker；review receipt 由
merge-worker 侧上报」。

### D-2 QA 位置

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A review→QA 串行（C1 原裁定） | QA 只在 review PASS 后跑一次 | 跑不通的实现先烧 review；与 evaluator 模式相悖 | round 4 推翻 |
| B（选定）aes-qa 循环轮内循环 + 最终轮绑 SHA | 每轮独立验证、终局出 receipt | 每轮一次 subagent 成本 | 无 |

选定 B。理由：Anthropic evaluator-optimizer、oh-my-codex ultraqa 5 轮循环、MAST
弱验证失败占比 23.95% 三方同构佐证。
