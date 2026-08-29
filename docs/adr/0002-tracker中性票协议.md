# ADR-0002：tracker 中性票协议（双 tracker 单真源）

- 日期：2026-08-29
- 状态：已接受（2026-08-29 用户裁决）
- 关联：parkth1026/parking-agents#147（map）、#154（裁决票，本 ADR 主决议源）；调研底座 #149、#150
- 筛选判据自评：三条全中——协议必需项决定所有票的形状，票建满后改协议等于重刷全部载体；「为什么不用 sub-issues/原生 dependencies 做必需项、为什么本地不留可变状态、为什么 claim 不上 token」是无上下文时连环惊讶点；免费审计/人机共读 vs 机器互斥/崩溃对账是载体选型的真实权衡。

## Context

wayfinder 双变体深读（#149 报告）给出载体取舍的两极事实：

- **GitHub Issues 原生**：买到 frontier 人机共读可视、零工具、免费审计、跨机并发；牺牲 claim 互斥（assignee 弱凭证）、跨 issue 事务（建票与 wire 两遍、「票关了 map 没追加」崩溃窗口）、无幂等锚点（fog 毕业重试可能双开票）。
- **本地文件**：买到 token 互斥、原子写、sync-map/source_fog_id 崩溃对账、机器门禁；牺牲人类可视（被迫再造 Console 投影层）、多机不安全、每票约 30 头部字段成本。
- 两版分歧不在语义在执行者；24h claim 警告只存在于 AES 文档、代码无实现（文档-实现缺口）。
- board 星图零改动复用三条件与「issue + 原生 blocked-by + close」完全重合（#150 报告 §2.1）。
- #152 已裁 GitHub Issues 为拆解层真源方向，但用户在 #154 进一步要求 **GitHub 与 GitLab 双 tracker 都支持、两边都要星图**。

## Decision

**tracker issue 为单真源，票协议按 tracker 中性抽象（#154 决议）：**

1. **协议必需项只用三件：labels + blocked-by 依赖 + close 状态**。GitHub 专有特性（sub-issues API、原生 dependencies API 等）只做增强、不进必需项。弱父子表达用 body 行文 `Part of #<map>`，跨 tracker 必需（2026-08-29 裁决补入，spec ②.1）；dependencies 不可用时回退 body 行文 `Blocked by: #<n>`。
2. **本地只保留可再生状态文件**（只读缓存性质），禁止持久可变本地状态。
3. **claim = 弱 claim（assignee）+ 认领/抢票留痕评论**（session id + 时间；抢票前必须留谁/何时/为何说明），放弃 token sidecar——GitHub 上做 token 需 sidecar 文件得不偿失，执行侧互斥已由 board registry 保证。
4. **崩溃恢复 = map Decisions 投影全量重算**（sync-map 语义 tracker 化）：Decisions 与 ready 判定从 closed sub-issues 现算，半写自愈。
5. **fog 幂等锚点 = 双写**：map 行带 `F-<slug>` + 毕业票打 `fog:<slug>` 标签，查重走标签机械查询。
6. **不继承 24h 时长阈值**，改采留痕抢票语义（语义未想清的不随包继承）。
7. **编排脚本是 tracker 状态唯一写入者**（#155 决议，本协议的执行面）：`ready-for-agent`、票 close、story 收口三类写只走编排脚本、写前对账，不绑 CI（门禁在无 CI、无 board 的仓也成立）。

## Consequences

- 正：双 tracker（GitHub/GitLab）天然支持，双星图同协议渲染；星图/门禁消费面零改动复用 board 三条件；崩溃窗口从「事故」降级为「下次重算可见」；不引入第二份可变状态即无漂移面；免费审计与人机共读保留。
- 负：放弃 token 级机器互斥——拆解侧并发正确性靠留痕审计 + agent 自律（执行侧由 board registry 兜底）；票形无机器校验（body 是自由 markdown），纪律靠编排脚本单一写入者与 SKILL.md 文本约束；幂等锚点必须自造（标签查重协议要被严格遵守才真幂等）。
- 难逆转性：必需项三件一旦承载全部存量票，扩充必需项（如引入 sub-issues 依赖）即破坏 GitLab 支持；本 ADR 约束 #159 spec ② 节全部子协议。
