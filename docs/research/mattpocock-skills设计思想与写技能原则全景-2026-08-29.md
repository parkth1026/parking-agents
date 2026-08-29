# mattpocock-skills 设计核心思想与写技能原则全景

> 研究对象：`G:\GIT\AI_WorkFlow_ref\mattpocock-skills\`（上游 https://github.com/mattpocock/skills ，本地 HEAD `6654f6b`）
> 勘察日期：2026-08-29
> 方法：精读全部元文档（CLAUDE.md、`.agents/invocation.md`、`.agents/writing-docs.md`、2 份 ADR、3 份 out-of-scope）与三个元技能（writing-for-agents + SKILL-MECHANICS、grilling、ask-matt + PHASE-BOUNDARIES），另由两个勘察代理扫完全部 25 个已晋级技能与支撑文件（engineering 18 + productivity 7）。
> 修订：2026-08-29 经两个 subagent（逐条事实核查 + 解读性 steelman）全文复审，修正计数与归属错误、软化过度概括，详见文末审查记录。

---

## 直接结论

这个仓库的本质是：**把数十年软件工程经典（Pragmatic Programmer、DDD、XP、Ousterhout）的行为准则，压缩成 agent 可重复执行的最小文档单元**。它的对立面是 GSD/BMAD/Spec-Kit 那类"接管流程"的重框架，README 明说了立场：小、易改、可组合、任意模型可用，控制权留给人。贯穿全库的一条预算语言是：**每个文档花两种预算之一，context load（常驻窗口的 token）或 cognitive load（人要记住它存在的成本）；而 agent 每次运行走的是同一个过程、而非产出同一个输出，所以让过程可预测的杠杆在 skill、AGENTS.md、指针文档三种打包之间通用**（writing-for-agents 的开篇理由）。注意这不是唯一的底层引擎：层级保护、方差控制、先验招募、完成心理在源文里各有独立论证。

---

## 一、哲学层：四大失败模式（技能为什么存在）

README 把全部技能挂在四个真实失败模式上，每个都有出处引文：

| 失败模式 | 根因 | 解药技能 |
|---|---|---|
| Agent 没做我想要的 | 对齐缺口 | `grill-me` / `grill-with-docs`（拷问式面试） |
| Agent 太啰嗦 | 没有共享语言 | `grill-with-docs` 内建 `domain-modeling`，产出 CONTEXT.md 词汇表 + ADR |
| 代码跑不起来 | 没有反馈回路 | `tdd`（红绿重构）、`diagnosing-bugs`（先造出能变红的回路再谈理论） |
| 造出一个泥球 | 加速了软件熵增 | `to-spec`（先问模块）、`improve-codebase-architecture`（深模块勘察） |

前两个是对齐问题（语言层），后两个是工程问题（回路层与设计层）——把这四种模式映射到主流程的对应关系是本文档的综合，README 只并列四种模式。两处出处注记：#2 的"内建 domain-modeling"出自 grill-with-docs/SKILL.md 的组合调用（"Call the Skill tool twice, for \"grilling\" and \"domain-modeling\""），README 原文只说共享语言 built into grill-with-docs；README 说 to-spec "quizzes you about which modules"，但 to-spec 技能自身明令"不面试、只综合"（自拟 seams 后请你确认），是 README 表述落后于技能实现的漂移。

---

## 二、方法论层：写 skill 的核心原则

全部提炼自 `writing-for-agents`（这个技能本身就是"如何给 agent 写任何文档"的通用参考）加 `SKILL-MECHANICS.md`，其余 24 个技能是这些原则的实证。

### 1. 两种负载理论（贯穿全库的预算语言）

- **Context load**：常驻上下文的每一行（AGENTS.md 的行、技能 description），每回合都在花 token 和注意力，无论是否触发。
- **Cognitive load**：人要记住"哪些文档存在、何时够到哪个"。原文明确：这不是要最小化的成本，而是人类能动性的价格，在判断要紧处花，在不要紧处省。
- 核心推理：只被指针够到的材料以指针那一行的代价逃掉 context load；完全没有指针的材料全靠 cognitive load。
- 边界：负载经济学是调用、拆分、docs 页决策里反复出现的通用货币，但不是每条原则的底层引擎——源文同时运行着层级保护、方差、先验招募、完成心理几台各自独立的发动机。

### 2. 上下文指针（context pointer）

- 技能 description 和 AGENTS.md 里指向某文档的一行是**同一个对象**：它命名上下文外材料并编码够到它的条件。**措辞而非目标**决定触发可靠性。必达材料配弱指针 = 方差 bug，先磨措辞，磨不动才内联。
- 指针规则：**引导词前置**（触发工作发生在指针里）；**一分支一触发**（同义改写一个分支等于写了两遍）；**砍掉正文已携带的身份信息**。

### 3. 信息层级阶梯 + 渐进披露

- 三级：in-file step（正文有序步骤）→ in-file reference（正文按需查阅）→ disclosed reference（外置文件，指针够到才加载）。
- 披露的判据是**分支测试**：每个分支都需要的内联，只有部分分支到达的推到指针后。原文强调渐进披露"首先不是 token 优化，而是保护层级结构"，且它同时是**方差杠杆**：被埋掉的步骤让"注意到它"变成抛硬币。
- 配套概念：**co-location**（一个概念的定义、规则、告诫放同一标题下，读一处带动邻处）；**sprawl** 是失败模式（文档单纯太长，即使每行都有效）；拆开的对立失败是 **scattering**（一个意思碎在多处）。

### 4. 完成判据（completion criterion）

- 每个步骤以判据收尾，两个属性：**clarity**（能否分辨做完没做）与 **demand**（要求多狠，"every modified model accounted for" 逼出苦工，"produce a change list" 不会）。
- 关键失败模式 **premature completion**：看得见的后续步骤产生拉力，判据模糊产生阻力。防御次序：先磨尖边界（局部且便宜），只有边界确实不可再尖且观察到抢跑时，才靠真实上下文边界（交接或子代理派发）藏起后续步骤。

### 5. 引导词（leading words）

- 用模型预训练里已有的紧凑概念（seam、tracer bullet、fog of war、tight loop）做锚，重复 token 而从不重复句子，零定义成本招募先验。自造词要付定义 token，所以**先找现成词**。
- 它锚两次：正文里锚执行，指针里锚触发。
- 旁边的失败模式是**否定**：禁令把被禁行为拖进上下文反而更可及（别想大象）。正面陈述目标行为；禁令只配做硬护栏，且要配上正面目标。全库实践与这条规则自洽：旗舰禁令几乎都落在不可逆门上并配正面动作（"Do NOT interview…just synthesize"、"Always resolve; never `--abort`"），成段无正向重述的 Don't 列表只出现在 prototype 的分支文件里，是该规则唯一被放宽处。

### 6. 修剪纪律

- **单一真源**：一个意思一个权威位置，改行为是一处编辑。重复既费维护又虚增某个意思在层级上的地位。
- **环境也是真源**（package.json、目录布局、--help）：复述环境的文档是**缓存**，只缓存环境查不到的东西（不成文约定、选择背后的原因、坑），否则必然过时。
- **sediment（沉积）**是没有修剪纪律时文档的默认命运：旧层沉淀，因为加安全删危险。
- **no-op 测试**：逐句问"相对模型默认行为这句话改变行为了吗"。测试是相对模型而非相对人的，分歧靠跑文档解决。失败的句子整句删，不修边。这个测试也 grading 引导词：打不过默认的词（thorough）是 no-op，换更狠的词（relentless）。

### 7. 调用二分（skill 特有机制）

- **model-invoked**：保留面向模型的 description（带触发分支），常驻 context load 换可发现性；用户永远也能打字调它，description 只增不减可达性。共享 reference 的唯一家（别的技能能调它）。
- **user-invoked**（`disable-model-invocation: true`）：description 面向人，砍掉触发短语。零 context load，花 cognitive load。**测试问题：模型能有用地自主够到它吗？**（复用是抽出技能的理由，不是留在 model-invoked 的测试。）
- 不变量：user-invoked 技能谁也调不了，只能人打字触发；它可调 model-invoked，反向不行。双 harness 同步（Claude frontmatter + `agents/openai.yaml` 的 `policy.allow_implicit_invocation`），两边要么都 user-invoked 要么都不是。
- 两个 user-invoked 技能都要的共享 reference 两边都放不了（互相够不到），推到技能系统外的普通文件。
- "user-invoked 编排 / model-invoked 可复用纪律"是 README 的概括性修辞而非定义：user-invoked 的 teach、wait-what、handoff 并不编排任何东西，model-invoked 的 prototype、research、wizard 是工具而非纪律。真正恒定的是可达性规则本身。

### 8. 组合语法（唯一的跨技能调用方式）

- 发射的规范语法是显式指令 `Call the Skill tool with "grilling"`，不用跨目录深链（`../other/FILE.md`），不用裸 `/name` 让模型自己解释。命名工具才是发射的机制，且去斜杠保持 harness 中立。
- 一次调用一个技能；要两个就说 "call twice, for X and Y"。
- 前置是 user-invoked 技能时，措辞必须翻给人的动作："tell the user to run `/setup-...`"。
- 两个已核例外：路由散文（ask-matt、桶 README）保留 `/name` 作人读标签，invocation.md 明文豁免（它不发射任何东西）；仓库自身也有已知偏差——implement/SKILL.md 用的是裸 "Use /tdd where possible" 斜杠式指令，并未遵守规范语法。

### 9. 拆分判据

- 按 invocation 拆：有了应该独立触发的引导词、或别的技能必须够到它，才值得为常驻 description 付 context load。
- 按序列拆：后续步骤诱使抢跑当前步骤时，靠真实上下文边界藏起它们。
- **路由技能**是 user-invoked 技能多到记不住时认知负载的解药：一个人记住的路由技能点名其余的。它只能提示，永远不能发射它们。

---

## 三、微观手法层：技能库里反复出现的设计装置

1. **模板即输出契约**：`<spec-template>`、`<vertical-slice-rules>`、`<local-ticket-template>` 等 XML 标签围出的复制即用模板，工件格式就是契约。
2. **完成门**：`Done when:` 段（wizard、to-questionnaire）、phase 复选框清单（diagnosing-bugs 六相每相一框）。
3. **停止规则与红线**："No red-capable command, no Phase 2"（diagnosing-bugs 最强）；"never `--abort`"（merge conflicts）；"never resolve more than one ticket per session"（wayfinder 的速率门）；"Do NOT propose interfaces yet"。
4. **人类门在不可逆写之前**："Check with the user that these seams match their expectations"（to-spec）、"Iterate until the user approves"（to-tickets）、"Wait for direction"（triage）。
5. **教义对（命名正反教义）**：tracer bullet vs horizontal slicing（to-tickets/tdd）；plan-don't-do（wayfinder）；"Fog or ticket?" 判据是"现在能否把问题说精确，而非能否回答它"。
6. **三元门防工件蔓延**：ADR 三问（难逆转 + 无上下文会惊讶 + 真实权衡，缺一跳过）；惰性建文件。
7. **支撑文件按分支披露拆，不按角色拆**：判据是"每次运行都要走的路径留在 SKILL.md，只有部分分支够到的下放兄弟文件"。下放物可以是格式模板（domain-modeling 的 ADR-FORMAT/CONTEXT-FORMAT）、代码例子（tdd 的 tests.md/mocking.md）、混合契约（triage 的 207 行 AGENT-BRIEF.md），也可以是整段子流程或深水纪律——ask-matt 的 PHASE-BOUNDARIES.md、prototype 的 LOGIC/UI.md、codebase-design 的 DEEPENING/DESIGN-IT-TWICE.md 承载的是行为而非格式。实测结果：最长已晋级技能仅 140 行，多数 <130 行，而 grill-me、wait-what 只有 7 行。
8. **一次性产物不入仓**：HTML 报告写 `tmpdir`、prototype 放侧分支、handoff 文档写 OS 临时目录、wizard "干完就删"。
9. **背景执行保护主上下文**：research 派后台代理、code-review 双轴并行子代理（互不污染是并行存在的理由）；更激进的 claude-handoff 直接把交接升格为活的后台代理（in-progress 桶，未晋级）。
10. **HITL 最后手段化**：diagnosing-bugs 的反馈回路十级阶梯把人肉循环放第 10 级；wizard 的负触发"agent 自己能做的不要调它"。
11. **状态放文件不放会话**：teach 的多会话工作区、wayfinder 的 map issue、CONTEXT.md 本身。
12. **事实归 agent，决策归人**（grilling 原文）：frontier 问题需要环境事实时派子代理查，绝不问用户能自己查的东西；决策才等人。
13. **耐久性反模式**：spec/ticket/agent-brief 一律禁止文件路径和代码片段（会过时），唯一例外是 prototype 衍生片段。
14. **每次写前重读盘上文件**（in-progress 写作三兄弟 writing-beats/fragments/shape，未晋级）：把人当协作者而非观众。

---

## 四、最完整的图谱

### 技能系统总图（调用轴 + 主流程 + 词汇层）

```
人（唯一索引，打字触发）
 │
 ▼
┌─ user-invoked ─ 编排层 ────────────────────────────────────────────┐
│  ask-matt（路由，只提示不发射）   setup-matt-pocock-skills（run-once   │
│                                    配置根：tracker/标签/文档布局）     │
│                                                                     │
│  主流程 idea→ship: grill-with-docs → to-spec → to-tickets            │
│                                      → implement（每票新会话）        │
│      支线: 需要可运行答案时 prototype 出去、handoff 双向桥回来        │
│      上下文卫生: 1~3 步一个不间断窗口，smart zone 不够才在边界 compact  │
│                                                                     │
│  On-ramps:  triage(外来原始票)   diagnosing-bugs(硬bug)              │
│             wayfinder(超大迷雾, 出口接 to-spec 收拢, 不直接 implement) │
│  周期维护:  improve-codebase-architecture(深模块勘察, 选中者进主流程) │
│  独立:      grill-me(无仓库时) handoff teach to-questionnaire        │
│             wait-what(消息没听懂的纠偏)                              │
└────────────────────────────┬────────────────────────────────────────┘
                             │ "Call the Skill tool with X"（规范组合语法）
                             ▼
┌─ model-invoked ─ 可复用纪律层 ─────────────────────────────────────┐
│  原语:  grilling(面试原语: 2 个命名入口 grill-me/grill-with-docs,                          │
│         triage/wayfinder/improve-codebase-architecture 三个技能内部运行)                  │
│  词汇:  domain-modeling(CONTEXT.md+ADR)  codebase-design(深模块词汇) │
│  回路:  tdd(红绿)  code-review(Standards/Spec 双轴并行)              │
│         diagnosing-bugs(先红后理论)                                  │
│  工具:  prototype  research(后台)  resolving-merge-conflicts          │
│         wizard(人才能做的步骤)  writing-for-agents(写文档参考)        │
└─────────────────────────────────────────────────────────────────────┘
```

### 阶段边界决策树（PHASE-BOUNDARIES.md，按序取第一个 yes，只在边界决策）

```
1 下一阶段需要本阶段做一手来源 / smart zone(~150k)还够？ → Continue（先排除它）
2 本会话内容对接下来完全无关？→ /clear（最便宜且非终端；但清掉相关上下文
   是单向损失，背后的 why 不可再生）
3 要跨 harness / 跨目录 / 给同事 / 中途分叉？→ /handoff（买的是可移植性）
4 任务收紧到能 AFK？                   → 子代理（主会话不动）
5 否则 → /compact（默认但殿后：一手变二手有损，且新会话可能自信地
   错在摘要磨平的决策上）
```

### 写文档的分层阶梯（任何 agent 文档通用）

```
in-file step → in-file reference → disclosed reference(指针后外置文件)
渐进披露的分支测试：每个分支都要 → 内联；只有部分分支到 → 推到指针后
```

### 仓库工程图（元层如何治理这个技能库本身）

```
AGENTS.md ──(一行指针)──► CLAUDE.md（真源）
 ├─ .agents/invocation.md     调用二分规范 + 组合语法
 ├─ .agents/writing-docs.md   docs 页结构：固定框架 3 段(What it does/When to
 │                            reach for it/Where it fits) + "值得读的 4 段"=前两者
 │                            加 Common questions/It's working if，后两段可整节省略；
 │                            Prerequisites 与自由中段按需
 ├─ .agents/adr/              架构决策(0001 硬依赖指针、0002 插件发布)
 ├─ .out-of-scope/            负空间文档：拒绝的请求+理由+原 issue 号
 ├─ .changeset/               版本发布
 ├─ skills/{engineering,productivity}   promoted：README+plugin.json+docs 页
 │  skills/{misc,in-progress,deprecated} 不晋级：零曝光
 ├─ 同步义务：技能增删改 → 重读 ask-matt 保持路由真("a router that lies")
 └─ 格式狗粮：根 CONTEXT.md 与 domain-modeling 的 CONTEXT-FORMAT.md 吻合(多一个
    Flagged ambiguities 段；是否经技能生成不可证——git 创建提交无工作流痕迹)
```

---

## 证据与版本上下文

- 证据全部来自本地克隆 `G:\GIT\AI_WorkFlow_ref\mattpocock-skills\`（上游 https://github.com/mattpocock/skills ，本地 HEAD `6654f6b`，2026-08-29 勘察）。哲学层出处：`README.md:84-182`；两种负载与写作杠杆：`skills/productivity/writing-for-agents/SKILL.md`；技能机制：同目录 `SKILL-MECHANICS.md`；调用与组合语法：`.agents/invocation.md`；路由图：`skills/engineering/ask-matt/SKILL.md` + `PHASE-BOUNDARIES.md`。
- 关键数字实测（2026-08-29 目录清点 + wc/grep）：已晋级技能 **25 个**（engineering 18 + productivity 7；user-invoked 14 + model-invoked 11，逐项核对 frontmatter 零错配），SKILL.md 最长 140 行（teach），7 个技能 ≤16 行；setup fallback 指针 ADR-0001 只列 3 个（to-spec/to-tickets/triage），代码实测 5 个 SKILL.md 含该指针（另有 code-review、wayfinder），ADR 落后于代码；`.out-of-scope/` 现存 3 份拒绝记录；in-progress 桶 8 个。

## 边界

本研究不裁决本仓库（parking-agents-manual）该采用哪些原则；in-progress 桶 8 个 beta 技能仅浏览（其中 2 处实例已征引并标注未晋级）。另外注意：docs 页规范（writing-docs.md）与 aihero.dev 发布体系强耦合，其"绝对链接、不写安装命令"等约定是站点属性，移植时只需带走结构思想。

## 与本仓库的关联

`AGENTS.md`（cf1d377）已经借鉴了这里的"触发内联、why 下沉 ADR、失败像判据、校验接线"写法；本次总结确认那只是表层。深层可迁移资产**至少包括**：两种负载经济学、信息层级阶梯、完成判据理论、no-op 修剪、引导词招募（不限于这几种）。调用二分虽然最常被引用，但它与 Claude frontmatter / Codex yaml 耦合最深，反而是移植成本最高的一件。

---

## Steelman 审查修订记录（2026-08-29）

本文档经两个 subagent 复审（一为逐条事实核查，一为解读性 steelman 反驳）后修订：

- **计数修正**：已晋级技能 21→25（发现途径：文档自身地图列了 14+11=25 个，与正文矛盾）；in-progress 桶 6→8。
- **归属修正**：微观手法第 9/14 条的实例出自 in-progress 未晋级技能，补标注；"硬依赖指针 3 个"补注代码实测 5 个（ADR 落后于代码）；"CONTEXT.md 是 domain-modeling 产物"降格为"格式吻合、生成方式不可证"；docs 页"四段契约"（却列五段）改为真实的"固定框架 3 段 + 值得读 4 段"结构。
- **过度概括软化**："全部杠杆在过程""一切的经济学基础""唯一组合语法""SKILL.md 只留行为纪律"均改为限定表述；组合语法补路由散文豁免与 implement/SKILL.md 用裸 `/tdd` 的仓库自身偏差；否定规则补与全库红线实践的衔接（禁令几乎都配正面动作、落在不可逆门上）；四大失败模式与主流程的映射标注为本文档综合。
- **经审查未改动**：调用层 25 项分配（零错配）、全部逐字引文、阶段边界树五选项、行数统计、out-of-scope 计数。
