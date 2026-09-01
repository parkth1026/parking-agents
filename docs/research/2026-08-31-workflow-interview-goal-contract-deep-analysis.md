# workflow-interview → Goal Contract 的自主交付充分性审查

审查日期：2026-08-31。初始快照于 17:49（UTC+8）采集，18:00 复查时纳入并行访谈新增的第 67—69 行及 v2 草案；结论不代表未来修订稿。本文为分析与改进建议，不是执行授权，不启动 Goal、不修订需求、不修改技能。

## 1. 直接结论

**现有 workflow-interview 是一个有价值的需求收敛与交接底座，但其 Goal Contract 还不能单独构成“让 Goal 模式完整完成所有内容”的充分条件。对这个具体案例，结论更明确：最新目标正在重新收敛，三份旧 Ready 契约不能作为最新完整目标的唯一执行和完成依据。**

这不是“Goal 模式做不到”，也不是“契约越长越好”。真正的问题是：

> 当前有效的目标，是否被完整保留；所有必要工作是否有人负责；完成时，是否有覆盖全部承诺、绑定当前版本的真实证据。

只要这三件事没有形成闭环，Agent 即使忠实执行契约、连续运行很久，也可能完成一个比用户目标更小、已经过时，或者仅在模拟环境成立的结果。

| 用户问题的解释 | 本次判断 | 证据与边界 |
| --- | --- | --- |
| 能否把这类契约作为 Goal 模式输入？ | 可以，是合理的输入形式 | 官方支持明确 Outcome、Constraints、Verification；现有模板也生成 /goal 指令 |
| 当前这三份文件能否代表最新“完整复刻 mock＋全逻辑闭环”的目标？ | 不能 | 最新 context 已明确旧 Ready 不适用，当前处于 2-prototype 修订中 |
| 条件齐备后，能否设计成可持续自主推进的交付流程？ | 有工程可行方向，需实际评测 | 版本、覆盖、执行环境、权限、独立验收、恢复共同决定结果 |
| 能否完全无人参与地完成本案例的全部验收？ | 按当前已确认要求，不能 | M1b、M2 明确保留用户在场和认可动作，不能由 Agent 替签 |
| 能否保证所有需求、所有环境下最终成功？ | 没有这种证据，不应承诺 | 本次未做当前 Goal 模式的产品端到端运行或统计评测 |

**建议的产品承诺应是：在已确认边界内持续推进；遇到真正依赖时准确停等；未验证不得宣告完成；恢复后能够继续。**“不能虚报完成”与“必然最终完成”是两种不同承诺。

OpenAI 当前官方文档说明，Goal 文本既是起始提示也是完成标准；开启 Goal 不扩大权限，遇到需要决定的事项仍会暂停。它没有承诺自动理解本仓库的契约包协议，也没有给出任务必然成功的保证。[OpenAI：Long-running work](https://learn.chatgpt.com/docs/long-running-work)

## 2. 审查范围与证据强度

本次分三条并行路径审查：生成链及门禁代码、案例决策到契约的追溯、官方软件工程与 Agent 工程资料；随后进行了独立双向 Steelman 复核。

- 技能源仓库：G:/GIT/AI_WorkFlow/parking-agents-manual，分支 parking-agents-manual，HEAD 为 f4e37757b9f3d5627c7636626f579d87d523bc37。
- 案例仓库：G:/GIT/AI_WorkFlow/aes-agent-manual，分支 aes-agent-manual，HEAD 为 5042daaa2269c205c3811b590e14f5e5fec9ca17。存在用户已有的未提交访谈修订，本文依据工作树现状，不能仅以 HEAD 代表全部案例内容。
- 用户输入路径中的 AI/_WorkFlow 未命中；实际命中的是 AI_WorkFlow，案例目录名称一致。
- 已核对安装侧与源码侧的 workflow-interview SKILL、aes-goal-contract SKILL、session.mjs、validate-goal-contract.mjs，四组 SHA256 当前一致。**未发现这四项的当前安装副本漂移；不能据此倒推出历史生成时使用的确切版本。**
- 没有修改案例、产品、技能、Issue 或运行态；没有启动真实 Provider、消费模型额度、做浏览器验收或执行实现任务。本次只新增本报告。
- 未逐票刷新远端 GitLab 决议；相关结论来自本地已保存的原话及决议材料。若远端存在更新的取消/替代决定，相关覆盖缺口需重新裁定。

本文用以下口径：**事实**是源码或当前文件直接可见；**推论**是由这些事实导出的执行风险；**未知**是此次未验证的产品运行、历史生成环境或远端新证据。行业规范用于评判方法，不自动升级为本项目已经确认的需求。

## 3. 这个案例实际上已经到哪一步

当前状态是**正在合法修订中的契约包**，不是“最终输出已经完成但不合格”。

最新记录明确：

- 用户要求完全复刻 mock 并跑通全部逻辑；旧“结构非像素”口径不够。
- M1a/M1b/M2 可以继续用于组织实现，但其中一部分完成不能代表整页及完整旅程完成。
- 默认收起宿主侧栏、视觉与真实数据双轨验证已有回答，不应无故重问。第 65 行曾选择同一渲染器双模式；**审查期间追加的第 68 行已记录用户质疑产品级演示模式，并将原推荐退回、待 REPLICA-Q5 锁定**。不能继续拿第 65 行当当前唯一结论。
- 第 67 行已记录用户确认视觉取样候选，包括 1280×800、DPR 1、七状态集及≤1%候选；同一记录仍明确最终容差在契约阶段锁定。应区分“已确认取样候选”和“完整最终验收标准已批准”，不能把两者都说成未确认，也不能替用户升级为最终批准。

证据：[当前接续及新目标边界](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/1-interview/context.md:3)、[旧 Ready 不适用及完成定义候选](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/1-interview/context.md:25)、[三个新裁决](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/1-interview/rounds.jsonl:64)、[视觉取样与容差候选](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/2-prototype/drafts/v1-replica-delta.md:50)。

但同一现场同时存在这些不同信号：

| 读取入口 | 看见的内容 | 可能得到的错误结论 |
| --- | --- | --- |
| manifest 的 stage / stage_gates | 2-prototype 进行中，3-contract 为 needs_reinterview | 正确理解为还在修订 |
| manifest 的顶层 status / validation | ready / valid，验证时间仍是旧时间 | 误认为可直接交接 |
| 三份 contract 文件首部 | Ready、Ready（带前置）、Ready（带前置） | 误认为当前三份都是有效执行稿 |
| M1a 的范围及 mock 读取说明 | 排除像素级规范；结构对照非像素 | 严格执行后仍达不到新目标 |

证据：[manifest 当前阶段与旧状态](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/manifest.json:7)、[M1a 旧范围](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/3-contract/contract.md:22)、[M1b 首部](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/3-contract/contract-m1b.md:1)、[M2 首部](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/3-contract/contract-m2.md:1)。

**事实：初始快照中，人通读 context 能理解旧稿与修订的时间层次；18:00 复查时，rounds 已新增第 67—69 行，而 context、manifest 和三份契约的内容摘要仍未改变。**此时连 context 顶部的“双模式已定”也落后于用户新意见。推论：仅拿到某份摘要的全新执行会话，可能收到刚被推翻的要求。

新增证据：[取样候选确认与模式反转](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/1-interview/rounds.jsonl:67)、[v2 草案的替代说明](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/2-prototype/drafts/v2-replica-delta.md:1)。v2 仍是草案，不在本报告中将其全部表述视为新批准。

修订期保留历史稿是合理的；危险在于导出/派发/完成审计没有统一拒绝失效稿。

另外，manifest.target 仍指向 aes-agent@a57b93fe…，案例工作树已有 5042daaa… 等后续提交。旧目标坐标可以作为历史基线，但必须明确它与当前执行/验收对象的关系，不能默认它就是当前产品状态。

## 4. 现体系值得保留的部分

这里不能只列问题，否则会把“有效的需求方法”与“尚未闭合的执行协议”混为一谈。

1. **先事实、再对照物、再验收，方向正确。** 技能要求从行为变化行、报文对、场景、mock 状态和交互提取 AC，减少凭空写规格。证据：[例子来源与聚类规则](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/aes-goal-contract/SKILL.md:27)。
2. **已经保留真实成功与异常路径。** M1b 分别要求真实桌面往返与断会话演练，明确 SDK/API 成功不等于原生可见，不能自动降级冒充成功。证据：[M1b 真实验收边界](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/3-contract/contract-m1b.md:27)、[两组合真实旅程](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/3-contract/contract-m1b.md:60)。
3. **权限和人工参与没有被假装消除。** M1b/M2 明确用户在场、认可和资源条件。这些是合规的完成前置条件，不应为了“自动”删掉。证据：[M1b 阻塞与解除条件](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/3-contract/contract-m1b.md:65)、[M2 人工演示](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/3-contract/contract-m2.md:67)。
4. **三份分解经过用户选择。** 它不是 Agent 擅自缩水。问题在于缺父级组合验收，不在分解本身。证据：[拆分与验收规模裁决](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/1-interview/rounds.jsonl:53)。
5. **原型对模拟与真实的区分是正确的。** 原稿说明派单/认可未连后端，并区分 SIMULATED、NOT_CONNECTED。后续讨论先要求模拟隔离，又将正式产品演示模式的必要性退回讨论；无论最终控件去留如何，测试/模拟证据不能冒充真实业务证据。证据：[mock 的演示边界](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/2-prototype/mock.html:1087)、[新双模式裁决](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/1-interview/context.md:10)。

这些材料表明：不需要推倒重来。应补强从“已经说清楚”到“能安全启动和证明完成”的接口。

## 5. 按风险排序的主要发现

### F1 — P0：有效版本与 Ready 没有形成唯一、可执行的裁定

**事实：**当前案例的重开状态与旧 Ready 并存；session 的 needs_reinterview 分支没有统一清除顶层 ready、旧 validation 和下游有效性。函数级内存探针重现了这一保留行为。证据：[重开分支](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/scripts/session.mjs:481)。

**影响推论：**检索命中旧稿、生成单文件 handoff 或只判断某一个字段的消费者，会使用不同的需求版本。仅让 Agent“认真阅读全部历史”不足以给多会话系统提供一致性。

**改进方向：**保留历史材料，但以一个发布入口给出唯一有效 revision、被替代版本、失效原因及允许执行范围；上游变更必须使受影响的派发资格和验收证据失效。

注意：失效的是“当前目标的适用性与验收证明”，不等于删除实现、否认历史结果或一律重写代码。

### F2 — P0：三份契约没有被当前 Goal 交接链整体消费

**事实：**session 的 contractPath 固定返回 3-contract/contract.md；当前 verify/finalize 及对应交接路径不会自动聚合 contract-m1b.md、contract-m2.md。证据：[唯一契约路径](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/scripts/session.mjs:65)。M1a 目标又明确“不依赖原生会话桥即可成立”，范围排除 M1b、M2。

**影响推论：**如果直接使用默认生成的 Goal 指令，成功完成 M1a 是符合该指令的，不能据此期待它必然继续并完成用户的整体目标。靠执行者自行发现另两份契约，不是可靠的组合协议。

**改进方向：**保留三份子契约，加父目标索引、明确依赖及整体完成条件；所有 AC 用带契约身份的引用，如 M1b/AC-004，避免三份文件重复 AC-001 时产生歧义。

本仓已有 [ADR-0004 的两级契约与 finalize 决策](G:/GIT/AI_WorkFlow/parking-agents-manual/docs/adr/0004-grill出口融合派发阶段模型.md:19)，说明这不是要凭空发明一套流程。**本次发现针对当前 workflow-interview 这条消费链，不等于断言整个仓库都不存在 Story 编排能力。**

### F3 — P0：混写 Verify 导致机器实际验收面比人读到的小

**事实：**validator 要求每条 AC 恰好一行 Verify，并只从行首识别一个档位；session 同样按第一档分类，自动执行时只抽取 [A] 的首个反引号内容。证据：[提取 Verify](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/scripts/session.mjs:512)、[自动验证过滤](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/scripts/session.mjs:555)。

这个案例已经出现真实的解析差异：

| 文件 | AC 数 | 解析后的第一档统计 | Verify 行中出现的 [A] 标记 |
| --- | --- | --- | --- |
| M1a | 6 | A=4、B=1、C=1 | 6 |
| M1b | 4 | A=3、C=1 | 3 |
| M2 | 6 | A=5、C=1 | 5 |

这里的标记次数不自动等于独立验证方法数量，但能直接定位漏掉的自动命令：

- M1a/AC-001 先写 [C]，后面还有 [A] 的 UI 测试；被整体归为 C。
- M1a/AC-004 先写 [B]，后面还有 [A] 的 records 测试；被整体归为 B。
- 历史 verify.txt 正好只记录四个自动命令，另两条被记成非 A 未跑。

证据：[AC-001 到 AC-006 的混合 Verify](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/3-contract/contract.md:62)、[历史四条冒烟及跳过记录](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/3-contract/verify.txt:4)、[一行限制与首档解析](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/scripts/validate-goal-contract.mjs:153)。

**影响推论：**人以为“一条 AC 同时要求自动、fixture、真实 UI”，机器却只登记其中一类。这不是 AC 文案不够长，而是数据模型无法无损表达实际验收组合。

**改进方向：**一个 AC 可以挂多个有稳定身份的 verification；逐项声明方法、环境、预期、证据和判定结果，并显式说明必须全过，还是允许某种已批准的替代证明。

### F4 — P0/P1：聚类后没有覆盖账，已确认小句会消失

下列是具体的“上游有、下游没有明确对应判定”案例，不是泛泛要求加字段：

| 已确认内容 | 原始入口 | 现有契约缺少的判定 |
| --- | --- | --- |
| 建议规则沉淀为可查看默认策略 | [Q12](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/1-interview/rounds.jsonl:24) | M1b/AC-001 只验逐单建议、理由、可改；未验策略透明度 |
| 独立任务并行、依赖任务串行 | [Q10](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/1-interview/rounds.jsonl:22) | M1a/AC-002 没有明确“依赖未满足不得启动” |
| 连续/单票模式随时切换，且只影响后续派单 | [行为边界行](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/2-prototype/behavior.md:55) | 暂停/收回不等同模式切换；缺明确切换结果 |
| 冲突的两案均可驳回并重派调查 | [mock 双拒绝入口](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/2-prototype/mock.html:1924) | 报文与 M1a/AC-003 主要定义 winner/loser，双拒绝后的状态和重派未闭合 |
| 收敛时待确认必须为零 | [小 Story 收敛场景](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/2-prototype/example-run.md:54) | M2/AC-004 写停等清零，但没把独立的待确认清零写成明确条件 |
| 代码型 Story 合入目标版本并完成最终回归 | [继承的产品决策](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/1-interview/facts/prior-product-decisions.md:21) | 回归虽在继承强约束中，收敛凭据没有绑定最终集成版本 |

还存在逻辑边界：M2/AC-004 的“全部 wave 终态”没有明确哪些终态能贡献完成。失败、取消、阻塞不是同一种结果；“所有任务不再运行”不等于“所有必要目标已满足”。证据：[M2 收敛条件](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/3-contract/contract-m2.md:63)。

**结论边界：**这些证明的是规格与验收映射不充分，不能直接推断当前实现缺少对应功能。整份原型被列入“读什么”，也意味着要求不一定完全消失；但其通过/失败没有进入显式验收清单，仍可能被漏验。若存在后续取消决定，应改记为获准排除。

**改进方向：**自动生成“来源决定→原型行/控件/状态→AC 或不变量→verification”的覆盖表；每个来源必须落在保留、替代、明确排除或未决之一。聚类可以压缩表述，不能压缩义务。

### F5 — P0：结构有效、finalize 成功、阶段完成存在状态脱节

**事实：**finalize 写入的 validation.status 取决于结构校验结果；冒烟或残留风险失败会影响命令退出码，但不一定把该字段改成失败。stage 3 done 检查的是 validation.status 和契约文件时间等条件，不等价于检查上一次 finalize 整体成功。

函数级内存探针得到：

~~~text
结构校验成功 + 冒烟 UNRUNNABLE
→ finalize exit 1
→ validation.status 仍为 valid
→ 后续 stage 3 done 可返回 0
~~~

这证明一个状态一致性缺口；探针模拟了文件系统与子进程返回值，**不是对真实产品执行链的端到端攻击或验收结果**。

源码定位：[finalize 写入及后续失败处理](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/scripts/session.mjs:694)、[stage done 检查](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/scripts/session.mjs:341)。严格按 finalize 非零退出立即停止交接的调用方，可以避免此次误用；这里指出的是 stage done 自身没有落实同等门禁。

**改进方向：**把 schemaValid、verificationRunnable、readinessGatePassed 和 complete 分开表达；阶段关闭只接受绑定当前输入版本、整体成功的 readiness receipt，不能把局部字段当总结果。

同时必须保留一个合理设计：**Ready 可以允许预期 RED。**实现前断言失败是正常的。需要区分的是“测试已运行并证明功能尚未满足”与“没有测试被发现、命令/模块不存在、环境未启动”。把后者当普通 RED，会伪装出一条实际上尚不存在的验收线。

### F6 — P1：自包含和版本绑定主要停留在文案，依赖还可能漂移

**事实：**shape 要求契约自包含，允许引用确认版原型；四个核心章节变更会影响验收摘要。但当前案例没有给全部引用物、用户认可范围、外部决议和执行对象提供一个共同发布版本。缺少被引用的原型文件，在 validator 中通常只是 WARNING。

**影响推论：**同一份契约配上不同版本 mock、不同 Issue 结论或不同 checkout，会导出不同结果；文件存在并不等于用户认可过这个版本。

**改进方向：**自包含应定义成“完整依赖包可解析并被锁定”，不要求把所有原型复制成一篇巨文。摘要覆盖验收语义及必要依赖，附带确认主体、时间、范围；注释或无关排版变化不应机械地使所有实现重来。

单纯依赖 mtime 也不够：它无法可靠区分内容不变的复制、外部引用变化、批准之后的修改。

### F7 — P1：技术可行、执行授权、人工验收仍需独立成立

**事实：**M1b 将原生可发现/同人续聊等记为未证实风险，要求真实双组合旅程；也明确用户在场、额度、凭据及授权条件。M2 同样有用户认可动作。

**影响推论：**即使所有需求都说清楚，也不能由文档制造缺失的工具能力、扩大权限，或替用户完成认可。现有 glab 配置说明可能有认证材料，不等于任意测试项目、写入和关闭 Issue 的范围已经全部明确。

另有需要收窄的约束口径：

- M1a 要求普通 Session 零变化；M1b 又要求修复 Codex adapter 的 resume→fresh-start 行为。若修复作用于普通 Session 的共享路径，两个字面要求可能冲突；若仅 Graph bridge 采用严格恢复策略，则可能兼容。**本次只指出适用范围需明确，没有判定当前实现已冲突。**
- “修改公共 schema 必须问”与新增 Graph 的公共能力存在交界，应区分已批准的新增范围与突破既有兼容边界，减少执行中把已授权设计重新当作未授权事项。

证据：[M1a 自主边界](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/3-contract/contract.md:36)、[M1b 范围与继承约束](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/3-contract/contract-m1b.md:24)、[M1b 人工和能力条件](G:/GIT/AI_WorkFlow/aes-agent-manual/.aes-workflow/grilling/2026-08-30-aesagent-workflow-workbench/3-contract/contract-m1b.md:65)。

**改进方向：**执行前检查实际 checkout、工具、凭据可用性、允许副作用、测试空间、真实模型配置及人工参与；阻塞必须指向具体 AC/依赖，允许不受影响的独立工作继续，但不能提前宣布整体 Complete。

### F8 — P1：模板约束与校验约束并不完全一致

**事实：**

- validator 主要校验验收那一半：仅有合法“验收条件”也能通过；目标、范围、强约束等不是全部强制存在。
- shape 要求 AC 身份稳定、删除不补号；validator 却要求连续编号。
- shape 提示超过六条需拆，validator 允许七条；更重要的是，单条 AC 内可以堆很多独立义务，条数并不能证明上下文负荷或原子性。
- shape 说通用测试/lint/build 由 handoff 接管，实际模板没有完整补齐这组通用门禁；Goal 短版也未像会话版明确写出完整读依赖、逐条验证和 review/simplify 等行为。
- validator 会拒绝部分旧式章节名称，包括 Approval Binding、Independent Handoff、Completion；所以“把旧大模板字段加回来”并不能直接兼容当前协议。

证据：[validator 的检查范围](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/scripts/validate-goal-contract.mjs:3)、[必需 AC 与连续编号](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/scripts/validate-goal-contract.mjs:113)、[旧式章节拒绝规则](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/scripts/validate-goal-contract.mjs:88)、[shape 与交接职责](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/aes-goal-contract/references/goal-contract-shape.md:151)、[交接模板两变体](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/aes-goal-contract/references/handoff-prompt.md:1)。

**改进方向：**统一一份契约协议及机器表示，人读 Markdown 与交接指令从同一协议派生；通用执行规则放版本化 execution profile，避免在每份契约重复，也避免“以为别处负责”而实际无人负责。

这不证明 Goal 一定会漏做 review 或质量门；它证明当前模板未提供一致、可核验的保证。案例自己的强约束已写全量测试，不能把模板的一般缺口错误说成该案例完全没有回归要求。

## 6. 哪些信息会导致偏差

| 偏差通道 | 在本案例/技能中的表现 | 应采用的控制 |
| --- | --- | --- |
| 时间与版本偏差 | 最新修订、旧 Ready、历史目标 SHA 并存 | 当前有效 revision；历史显式标为 superseded；交接前检查 |
| 聚合压缩偏差 | 默认策略、双拒绝、依赖顺序等小句不再有验收落点 | 来源逐项覆盖，聚类后核对无丢失 |
| 展示与业务混淆 | mock 有完整状态，实际原稿是静态演示；演示控件的正式产品归属又被用户质疑 | 按当前有效裁决处理控件去留；同数据视觉验证与真实业务状态验证分别取证 |
| 代理指标偏差 | 测试全绿、API 200、wave 终态被扩大为产品完成 | 最终持久状态＋真实原生旅程＋用户认可，各证据只证明对应层 |
| 权威偏差 | Agent 摘要、用户确认、默认未反对、历史研究混写 | 分开记录决定/事实/假设/未知/否决；明确谁有权确认 |
| 验证路径偏差 | Verify 同行混档、只读单契约、缺测试仍当红 | 每项验证独立登记，完整数量对账和执行分类 |
| 环境偏差 | 老 SHA、未确认额度、真实载体与模拟环境不同 | 实际前检＋环境身份＋数据/能力边界 |
| 推荐锚定 | 问答强制百分比，用户可能将推荐权重误读成成功概率 | 无校准数据时不把百分比当统计概率；展示证据、反方和翻转条件 |
| 长会话记忆偏差 | 上游上下文很长，新会话只看摘要或局部文件 | 自包含发布包、决策截止点、冷启动接手检查 |
| 规范层级偏差 | 最佳实践被临时加入需求，或把明确业务验收降为“建议” | 区分契约 AC、仓库不变量、风险建议；新增产品承诺需要明确来源 |

推荐百分比并非一定造成偏差；本案例用户曾推翻推荐，说明该机制允许纠正。没有实验数据，不能声称百分比已经导致某个错误。也不能从代码复杂度直接推导一个精确成功概率。

软件工程还要区分两件事：**符合写下来的规格**，与**真正解决用户的问题**。这份合同主要覆盖前者及部分体验演示；“减少多少人工衔接、是否真能管理大需求”等价值结果仍缺少基线和真实用户证据。可以作为后续产品验证项，不能在本轮悄悄变成未获批准的硬 AC。

## 7. 最值得改进的契约形态

以下是设计方向与验收判据，不是本轮实施计划。优先级按错误交付与权限风险，不按工作量排序。

### 7.1 先建立当前有效的契约包

最小发布信息应能回答：

- 这是什么目标、哪个 revision，替代哪一版；
- 用户确认的是哪些内容与对照物；
- 有哪些必要子契约及依赖；
- 输入文件、原型、决策截止点、执行目标和验收相关依赖如何绑定；
- 哪些资料只是历史、哪些已经失效。

建议人读主文档＋小型索引＋验证清单，**由同一权威源派生**，不维护多份可以独立漂移的规格。

### 7.2 让义务与证明都可逐项对账

不要再把“一条 AC 恰好一行 Verify”当成不可改变的结构。

| 对象 | 最小应表达的内容 |
| --- | --- |
| Requirement / 不变量 | 稳定身份、来源、意义、保留/替代/排除状态 |
| AC | 可观察结果，归属契约，覆盖的来源 |
| Verification | 独立身份、方法、前置/环境/数据、预期、证据位置、验收主体 |
| 聚合关系 | 哪些验证必须全部通过；哪些是有条件或获准替代；适用性及原因 |
| Result | PASS / FAIL / NOT_RUN / BLOCKED / N/A 等明确结果；N/A 必须有适用性依据 |

一个 AC 同时需要自动测试和真实桌面亲见是合理的；任何一条 PASS 都不能吞掉另一条 NOT_RUN。方法档位不是证据等级，更不是可靠性百分比。

### 7.3 把“可启动”与“已完成”彻底分开

建议定义两层不同谓词：

~~~text
ReadyFor(scope) =
  当前有效且被确认的范围
  AND 来源覆盖闭合
  AND 验证路径可执行，或已明确约定需要建立该路径
  AND 当前安全动作具有所需能力与授权
  AND 不存在会改变该范围目标/边界的未决决定

Complete(goal) =
  当前契约包仍有效
  AND 全部 required 目标已满足
  AND 全部 required 验证都有当前有效的通过证据
  AND 所有必要集成及回归作用于最终交付对象
  AND 没有影响完成的阻塞、待确认或冲突
  AND 契约要求的人工/真实旅程认可已经取得
~~~

这只是建议语义，不是现有系统已经实现的字段或代码。

可实现范围 Ready 不代表所有外部前置已齐，也不代表最终验收已通过。允许明确的预期 RED；允许先建设已批准的测试基础设施；不允许把无法运行的测试写成“已证明功能为红”。

必需子任务失败/取消，不得因为它“到终态”就算完成。删除、豁免或降低标准必须有批准记录及影响说明。无法完成时保持诚实阻塞；与其无依赖的工作可以继续。

### 7.4 把执行协议放进公共 profile，避免每份文档变成操作手册

公共 profile 可以统一：查仓库事实、完整读依赖、基线记录、实现与测试、独立 review、必要 simplify 后重验、最终集成、恢复检查点、部分阻塞处理和证据收口。

每份任务只补自己的变量：目标 checkout、特殊权限/副作用、测试数据、模型与真实系统约束、不可变对照物、额外验收和人工参与。

这能同时避免两种问题：契约越来越长；契约删去通用规则后，执行端却没有真正接管。

### 7.5 对本案例优先补齐的接受面

| 接受面 | 应能证明的结果 | 不足以替代它的证据 |
| --- | --- | --- |
| 完整复刻 | 已确认环境及同一数据下，关键状态、结构与视觉满足锁定标准 | 某一张正常态截图；“大体像” |
| 真实数据布局 | 长标题、空态、新节点、状态变化不隐藏必要信息；动态差异有确认范围 | 固定演示数据全绿 |
| 交互覆盖 | 每个正式入口映射业务结果、失败/退出路径与证据 | 按钮能点、弹 toast、写前端日志 |
| 测试隔离与控件例外 | 按最终修订明确正式/演示控件去留；测试夹具或模拟路径不写真实 Issue、不启动真实会话 | 只有 SIMULATED 文案，或未经批准直接复制原稿全部演示控件 |
| 原生往返 | 同一会话身份、真实进入续聊、回读、落单和返回 Graph | SDK 返回 ID；后台执行成功 |
| 工作流收敛 | 依赖顺序、待确认、冲突、回流、证据失效及成功条件闭合 | 所有 wave 都到某种终态 |
| 恢复与并发 | 重启/断连后不丢、不重复、不串身份，不越过有效权限 | 仅内存状态机测试 |
| 交付兼容 | 最终目标版本上全量回归和 desktop 冒烟满足约束 | 各子模块在不同 SHA 分别通过 |

这里大部分来自最新目标，不是新加产品范围。**数值、动态豁免及尚未决定的语义必须由后续有效修订锁定；本报告不替用户批准。**

## 8. 官方工程依据：支持什么，不支持什么

| 来源 | 能支持本次判断的内容 | 不应从它推出 |
| --- | --- | --- |
| [NASA SWE-052：双向追溯](https://swehb.nasa.gov/spaces/SWEHBVC/pages/50888903/SWE-052%2B-%2BBidirectional%2BTraceability) | 把来源、需求、设计、实现、验证及变更影响连接起来，减少遗漏和无依据扩张 | 追溯完整就代表需求正确，或必须照搬航天流程 |
| [NASA 系统工程手册附录：V&V 计划](https://www.nasa.gov/reference/system-engineering-handbook-appendix/) | 预先定义测试、分析、检查、演示等方法，区分规格符合与用户期望 | 自动测试可以替代任何真实体验 |
| [NIST SSDF v1.1](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-218.pdf) | 测试与审查需要记录、分诊发现项，并考虑实际环境和风险 | 全绿或扫描通过即保证安全 |
| [NIST AI RMF 1.0](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf) | 明确用途、假设、限制、风险、人工监督及生命周期变化 | 写一张风险表即可消除不确定性 |
| [Google 工程实践：代码审查关注点](https://google.github.io/eng-practices/review/reviewer/looking-for.html) | 审查行为、边界情况、并发与用户可见结果，必要时看演示 | 读过 diff 就完成了产品验收 |
| [Anthropic：长时程应用开发的 harness 设计](https://www.anthropic.com/engineering/harness-design-long-running-apps) | 分解、结构化交接、生成与评估分工能帮助长期任务，执行者自评仍需约束 | 一个厂商的经验证明当前 Codex 与本案例必然成功 |
| [Anthropic：Agent evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) | 评估最终环境结果、隔离运行、重复试验、检查轨迹并校准 grader | 一次成功或一个分数能证明普遍完成能力 |

资料检索于 2026-08-31。NASA/NIST 为规范或指导；Google 为工程实践；Anthropic 两篇为厂商工程经验与评测方法，不能当跨模型定理。引用的是 SSDF 1.1、AI RMF 1.0 的明确版本，不声称其代表所有后续修订。

## 9. 双向 Steelman：让结论接受最强反驳

### 立场 A：现体系已经足以让能力强的 Goal Agent 完成，没必要再加协议

最强论证：

- 契约包含目标、范围、强约束、真实路径、人工参与和否决方案，已远超普通任务提示。
- 分拆由用户认可，减少单会话负荷；“读什么”已经提供上下文，不需要复制所有资料。
- Agent 能查仓库、读原型、发现依赖并补测试。把每项工程行为写死，会减少正确的自主判断。
- 新目标正在修订，拿未完成草案要求最终就绪，本身不公平。
- 预期 RED、外部人工验收和合理停等都是正常工程过程，不能拿来证明方案失败。

**本报告接受以上反驳。**因此不主张推倒三阶段、不要求每份合同无所不包、不要求 Ready 前实现全绿，也不把旧稿称为一无是处。

但该立场不能解释：同一个输入由不同消费者读出不同有效版本；自动脚本确定性漏读 Verify；默认 Goal 确定性只指向 M1a；来源义务缺少可对账验收。能力强的 Agent 可能补救，不等于交接协议已经保证补救。

### 立场 B：这套合同不能支撑完整自主交付，必须彻底重做

最强论证：

- 用户要完整工作台，旧契约却允许结构非像素与单阶段完成。
- “Ready”含义不统一，结构检查可以过而整体 finalize 失败。
- 单条 AC 压入多条规则、无来源覆盖账，执行者很容易把可测试子集当全部需求。
- 原生能力和人工证据无法由自然语言保证；继续运行可能只会把错误前提实现得更彻底。

**本报告也接受这些风险，但不接受“彻底重做”的结论。**目前已有明确的对照物、强约束、真实验证边界与承诺继承；多数问题集中在版本、覆盖和收口接口，能够在保留现有工作法的前提下改进。

### 裁决与真正分歧点

**保留访谈与原型方法，强化契约发布、验证登记和聚合完成的机器协议。**

分歧不在“文档该长还是短”，而在：

> 一个没有历史聊天的新执行会话，能否找到唯一有效的目标包，并在全部必要证据齐备前始终拒绝宣告完成。

即使做到这一点，也只建立了更可靠的判定与执行边界，不能保证未知外部能力一定可实现。

### 至少三个可以推翻本报告的关键问题

这些是证据检验题，不要求用户现在重新回答已定产品问题。

1. **是否已有当前生产交接入口，必定拒绝旧 Ready，并绑定最新契约及全部依赖 revision？**若有且冷启动可复现，F1/F6 的系统风险应降级；应审查真正入口，不只审查本次 session 脚本。
2. **是否已有独立父级门禁覆盖 M1a/M1b/M2，并在任一必需真实旅程、待确认或最终回归未满足时拒绝完成？**若有，F2/F4 的整体完成缺口可能已经由外层补齐。
3. **是否存在后续明确裁决，取消了默认策略可查看、依赖串行、双拒绝重派等要求？**若存在，这些应归类为获准排除，而不是遗漏。
4. **是否已有当前版本的真实 Codex 双组合往返、完整视觉基准、最终集成回归证据？**若有，应刷新 NOT_RUN，不能用旧研究否定新事实。
5. **修订后的契约包能否在没有访谈历史的新 Goal 会话中稳定交付，且不会通过删测试、换基准、缩范围获得成功？**若多次隔离评测支持，才有依据给出经验可靠性范围。
6. **增加元数据与门禁后，是否仍出现“所有条款都过，但用户目标未解决”？**若出现，瓶颈在问题/价值验证与验收判据，而不是继续加契约字段。

## 10. 怎样实际评估“完整完成的可能性”

本次没有任务集样本和 Goal 完成轨迹，所以不提供 80%、95% 等概率。问答中的推荐百分比也不能当成功率。

应把两类能力分开测：

- **交付能力：**在明确目标、环境、权限和人工配合条件下，能完成多少真实任务。
- **判定能力：**无法完成时，能否准确报告原因、继续独立工作，并且不误报成功。

适合纳入后续评测的判别场景如下；本表全部是建议，尚未执行：

| 场景 | 应观察到的行为 |
| --- | --- |
| 最新裁决已重开，旧契约仍写 Ready | 拒绝使用旧稿完成新目标，指出准确失效范围 |
| 一条 AC 同时需要自动化与真实验证 | 两种证据独立登记，缺一种不得完成 |
| 父目标含三个子契约 | 完成 M1a 后不能将父目标标 Complete |
| 测试不存在或没发现任何测试 | 与断言真正运行后的预期 RED 区分 |
| 原生桌面不可用，但其他工作无依赖 | 对受影响项停等；可独立工作继续；不伪造原生证据 |
| mock 或已认可验收基准变化 | 旧证据被标失效，受影响内容重新判定 |
| 人工认可缺失或由 Agent 自签 | 拒绝把它视为用户通过 |
| 中断后新会话接手 | 恢复正确版本、已完成证据、阻塞范围及下一安全动作 |
| 实现者删测试/改 golden 来获得全绿 | 无批准的判据变更被识别，不计成功 |
| 各模块通过，最终集成失败 | 总体仍未完成 |

记录至少包括：契约包身份、仓库版本/工作树身份、模型与执行配置、工具/权限、输入数据、运行轨迹、逐项证据、最终状态、人工干预、失败分类。重复次数按随机性和任务风险设定，不能从单次成功外推。

评价时单列：错误完成、遗漏需求、合法阻塞、权限越界、恢复失败、人工重新解释需求次数，以及完整成功。**一个能诚实拒绝错误完成的 Goal，比一个总是说“完成”的 Goal 更可信；但拒绝错误完成仍不等于高交付成功率。**

## 11. 本次实际验证与未验证项

| 验证 | 结果 | 能证明什么 |
| --- | --- | --- |
| 对三份原始 contract 运行当前 validator | PASS：退出码均 0；AC 数 6 / 4 / 6 | 当前格式检查认可这些文件，不证明最新目标已覆盖 |
| workflow-interview 现有 run-tests.mjs | PASS：session 71/71，dossier 13/13，共 84 项 | 现有测试范围回归通过，不覆盖本报告全部反例 |
| session / validator 函数级内存探针 | 重现状态脱节、首档解析、缺模块归 RED 等 | 当前函数逻辑对指定输入的行为；模拟 FS/子进程，不是产品端到端证明 |
| 案例旧 verify.txt | 历史记录：0 绿 / 4 红 / 0 跑不起来 | 只代表记录当时所运行的四项，不是当前产品状态 |
| 当前最新目标的真实 Goal 执行 | NOT_RUN | 不推断完成率 |
| 当前真实桌面、完整视觉与全旅程验收 | NOT_RUN | 不宣称通过，也不宣称当前产品一定不支持 |
| 目标产品当前全量回归与最终集成验收 | NOT_RUN | 不用技能的 84 项测试替代产品验收 |
| 远端决议逐票刷新 | NOT_RUN | 本地缺口可被更新的远端裁决推翻 |

本次运行的命令为：

~~~text
node skills/workflow/workflow-interview/scripts/validate-goal-contract.mjs <三份契约的各自绝对路径>
node skills/workflow/workflow-interview/run-tests.mjs
~~~

测试使用自身的临时伪仓库；没有对真实案例运行会改写 manifest 或 verify.txt 的 finalize/verify/stage 命令。函数探针为内存模拟，不留探针文件。

## 12. 快照与源码定位

关键案例文件 SHA256：

| 文件 | SHA256 |
| --- | --- |
| manifest.json | 794BCD48DF3685841FC607C8A7C9C0E17183734DC3BF8152F5ADD6714E17DC35 |
| context.md | C4C8EE575CF759694C4D3D97A0E5DCBC14AD361F3B225F9C6900E1EB3D60AD6E |
| rounds.jsonl（18:00 复查，69 行） | E16A545B4E780A623151D8A3F11A635329634E01EC80E1F837F98E239A0851CA |
| mock.html | B126D34AA5B60D46093610CBB24FB69FBE4D8ADD16EFE2D38EA01D911472C92C |
| contract.md | C24B9EC0E6FA710CADF7AD1981AEF23D51F82F31C96B0A06222F41D38B271A18 |
| contract-m1b.md | 53520C0B64EB49627A7F0A885CE4ED2B7E858492F43F0174F76D54E059207BC8 |
| contract-m2.md | 9BBD64248967DE20D0E7D7DA774BC162D138518CB89EE0B9F6C1219E3E0E37A4 |
| verify.txt | 99E54FC02813B694202B2EA0422733575BA5B98E5294BB067CC8AB2232B7B29F |

主要源码入口：

- [session：单契约路径](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/scripts/session.mjs:65)
- [session：契约阶段关闭检查](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/scripts/session.mjs:341)
- [session：needs_reinterview 分支](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/scripts/session.mjs:481)
- [session：finalize 的 validation 记录](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/scripts/session.mjs:701)
- [session：ready 写入](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/scripts/session.mjs:774)
- [validator：核心格式检查](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/workflow-interview/scripts/validate-goal-contract.mjs:101)
- [shape：契约与依赖、通用质量门](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/aes-goal-contract/references/goal-contract-shape.md:143)
- [handoff：Goal 变体](G:/GIT/AI_WorkFlow/parking-agents-manual/skills/workflow/aes-goal-contract/references/handoff-prompt.md:32)
- [ADR-0003：已有 Story 收口语义](G:/GIT/AI_WorkFlow/parking-agents-manual/docs/adr/0003-story收口四条件硬门禁.md:17)

**最终判断：当前最重要的改进，是让“哪个目标有效、有没有遗漏、凭什么算完成”成为可核验协议。现有内容已经值得保留；现有证据还不足以承诺 Goal 模式能无条件完整完成最新目标。**
