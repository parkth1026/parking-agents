# diagram-design 能力分析 × workflow-interview 优化机会（v2·对抗审查修正版）

- 日期：2026-08-16；v2 同日，经三个对抗式审查代理攻击后重写
- 对象仓库：`G:\GIT\AI_WorkFlow_ref\diagram-design`（v2.4.0，作者 Cathryn Lavery）
- 优化目标 skill：`parking-agents-dev\.claude\skills\workflow-interview` 及子技能 `aes-prototype`
- **v2 结论一句话：v1 报告的核心提案（新增第七面 + architecture.md 双视图产物）被对抗审查推翻——架构变化在 skill 家族里已有三条成文通道，"纯重构误判"的旗舰证据被仓库自己的真实产物证伪。修正后的建议降级为 behavior.md 增设一个"架构差异"节（有家族先例）或仅一句判读说明；diagram-design 的四个"变化表达"模式里，真正可移植的只有 fidelity ledger 的申报精神。**

---

## 一、对抗审查设置与总裁决

| 审查代理 | 攻击目标 | 裁决 |
| --- | --- | --- |
| A·事实核查 | v1 报告对 diagram-design 的 13 条事实断言 | 10 实锤、2 部分实锤、0 证伪；行号 2 处偏移 1 行，3 处语义轻微强化 |
| B·论点攻击 | "六面存在架构盲区、值得加第七面" | **攻击成立，核心论点不成立**（详见三、四节） |
| C·设计攻击 | P0 方案（architecture.md 四件套） | **四件套三删一并降级**；更简替代有压倒性家族先例 |

B、C 两线的决定性反证（本人体证，非转述）：

- 真实 issue `parking-agents-dev\.aes-workflow\grilling\2026-08-16-jenkins-learning-nas-scope\2-prototype\impact-surface.md`：skill-env 迁 XDG 这件事——v1 报告引为"盲区直接证据"的案例——被现行六面扫描判 **4/6 面"有"**（可观察行为/可运行输出/用户配置/历史兼容性，含回退链、NAS fail-fast、旧配置可回退读取），manifest 显示 3-contract `done`、validation `valid`、status `ready`。**现行框架把它处理得很好，它是反证不是证据。**
- `asking.md:44-45`：难逆清单原文含"改公共契约、改默认行为、改数据格式、删除既有能力、迁移数据"——架构级决策已在分诊定义域内。
- `goal-contract-shape.md:42-45`：强约束节原文"必须保持的现有行为、兼容性……**不变量写在这里，不占 AC 编号**"——架构不变式有指定归宿。

## 二、diagram-design 仓库能力（事实修正后）

定位：跨客户端（Claude Code / Codex / Pi）agent skill，生成编辑级品质、自包含 HTML + 内联 SVG 图表，默认零 JS。核心哲学"**通常**删除即最高质量"（原文有 usually，v1 漏掉），密度 4/10，每图 ≤9 节点（`SKILL.md:46`、复杂度预算表 `:356-360`）。

| 能力域 | 内容 | 备注 |
| --- | --- | --- |
| 图表类型 | 27 种（`SKILL.md:81-111`），8 种参数化类型（YAML schema + 坐标公式） | "两次生成必须视觉一致"仅 5/8 类型用 must，loop 用 should |
| 语义模式 | 7 种（`references\semantic-patterns.md`），含成对策略 trace | "first-divergence marker" 逐字在 `:65` |
| 导入重绘 | draw.io（856 行）/ Mermaid（仅 flowchart/sequence/state/ER 四语法，`mermaid_extract.py:35`） | 重绘不渲染，只取节点/边集合 |
| 验证门禁 | 几何验证、皮肤 lint、动画契约、文档同步、3 OS × 2 Python CI | 同类仓库最重 |
| 设计沉淀 | 6 篇 ADR | ADR-0005"几何契约用 checker 不用 prose" |

**与"变化表达"相关的两个关键事实（v1 有一处解读错误）：**

1. 它不做 before/after 图表对比：`README.md:466` "**Before/after comparisons** → a table"、`SKILL.md:58` "Simple before/after → table"，且全仓库无任何 diff/evolution/migration/delta 命名的资产。**但原文没有给出专门理由**——v1 把它解读为"编辑/出版视角"，无依据。唯一的判准是节尾通用问句（`README.md:469`）："*would a reader learn more from this than from a well-written paragraph?*"——即**信息效率对比**，不是美学立场。这个判准诚实地应用到访谈家族，结论恰恰是：表格/文字优先，反对为架构变化专门制图。
2. it-state / dp-integration 的"伴侣图"关系是**单向**的：只有 `type-it-state.md:3` 自称 "The companion to `type-dp-integration.md`"（且逐字自称 "*before* picture of a modernization proposal"）；dp-integration 全文 0 次提及 it-state，也没有"目标态"自述——v1 的"目标态"是推导解读。fidelity ledger（`output-spec.md:151-163`，"18 source nodes → 9 drawn" + Merged/Collapsed/Dropped/Kept 逐条申报）适用范围也比导入更宽：**一切输出小于输入的压缩**都要申报。

## 三、v1 结论哪些被推翻

| v1 断言 | 审查裁决 | 证据 |
| --- | --- | --- |
| "六面全否→needs_reinterview 会把纯重构误判为目标不成立，是盲区直接证据" | **证伪** | (1) 纯重构的正路是历史兼容性面判"有"+ behavior.md 全不变清单（零变化行），`gateDone` 只要求至少一份对照物在盘即放行（`session.mjs:285-288`）；(2) 旗舰案例 XDG 迁移实际 4/6 面"有"并走到契约 valid；(3) PS 双胞胎删除直接命中难逆清单"删除既有能力"原文项。"六面全否"源于把历史兼容性面狭义解读为只管破坏性变更 |
| "架构/依赖变化在六面体系里无家可归" | **证伪** | 三条成文通道：难逆分诊（`asking.md:44-45`）、强约束"不变量写在这里，不占 AC 编号"（`goal-contract-shape.md:42-45`）、自主边界反面"改公共契约、加依赖、动数据格式……照搬过来即可"（`aes-goal-contract\SKILL.md:164-166`）。无家可归的只有迁移序和目标实现结构——而那是被明文拒绝收留的（见下） |
| P0 的"迁移序"节 | **删除** | 契约明文"不预写……可逆实现方案、逐文件任务"（`aes-goal-contract\SKILL.md:181-182`）；"步骤会过时，而且会挤掉执行 Agent 本该自行发挥的部分"（`aes-interview\SKILL.md:66-67`）。分步交付是"范围"的事（一份契约一件可独立交付的事），归 3-contract 裁决 |
| P0 的"目标架构双视图" | **删除** | 对普通功能需求，锁目标架构图=锁"怎么实现"，违反 workflow-interview:9-10"中间怎么实现，交给执行 Agent 自己发挥"；家族的既定改动标注模式是 mock.html 的 `.changed` 单视图+文字申报（`aes-prototype\SKILL.md:85-88`），不是双图。且 markdown 无"图"形态先例，≤9 节点合并会无声改变边集语义，而骨架没有"失真即风险"条款；:31 的判据句（"程序在哪些地方跑起来不一样了"）也不含架构 |
| P0 的"首分歧标记" | **删除** | 依赖边集无天然全序，"第一条"随排序改变而改变却不改变任何事实；成对 trace 里首分歧有意义是因为 trace 有时序全序。家族明文"号是身份，不是序号"（`goal-contract-shape.md`） |
| P0 的"架构不变式"独立节 | **并入** | 归宿是强约束，现有入口就是 behavior.md 不变清单；独立成节=同一件事写两遍 |
| P1 的 Mermaid 源节 | **删除** | parking-agents-dev 宿主无 diagram-design（全仓库 grep 零命中），"日后可 /import-mermaid 升级"是对另一宿主的虚假承诺；无校验图块会成为下游盲信的事实源，与 finalize 拦 UNRUNNABLE 的哲学冲突；import-mermaid 只消费节点/边集合，信息量已被申报表覆盖，风险增量不为零 |
| "architecture.md 独立文件" | **不采纳** | 过不了家族准入检验：§4 例子池要求每份产物有"每个 X = 一个例子"的行，architecture.md 填不出——依赖边不是可观察结果，变不成任何一档 Verify |

**同时被确认的（v1 这部分站住）：** session.mjs 的三个机械性声明全对（includes 检查、已 done 不追溯、`--artifacts architecture` 可命中文件）；diagram-design 的 13 条事实断言基本实锤；"判'无'也是记录"的哲学让低频面本身不成罪名。

## 四、修正后的结论

1. **现行六面体系没有架构盲区，只有判读风险。** 架构决策（加依赖、改公共契约、动数据格式）经难逆分诊进提问区/确认区，架构不变式经不变清单→强约束，难逆项经自主边界反面进契约——三条通道齐全。真正的洞是：**扫描者可能把历史兼容性面狭义解读成只管破坏性变更，从而对纯重构任务误判六面全否**。这是一个判读说明问题，不是结构缺口。
2. **纯重构的完成形态现行框架已能表达**：历史兼容性面判"有"（所有现有用法都押上去了）+ behavior.md 全不变清单（"这条现在能跑，改完之后必须逐字节一样能跑"，`aes-prototype\SKILL.md:139-141`）。真实 issue 已验证此路可通。
3. **架构差异申报如果要做，家族习惯的做法是"节"不是"文件"**：配置差异、不变清单都住在 behavior.md 里（六面表中两面即此模式），`scanArtifacts`/drafts/`--artifacts` 全部免改。真实 impact-surface.md:21 甚至已有"代码影响面（供执行参考，非逐文件任务书）"的轻量先例——家族早就以恰当的重量处理架构邻接信息。
4. **diagram-design 四模式的移植裁决**：fidelity ledger 的申报精神（变化逐条显式、绝不静默）是唯一真移植——落在"架构差异"表的行上；首分歧（无全序）、双图（`.changed` 单视图先例相反）、step 分步（=实现计划，禁写）三个模式不适配，且 diagram-design 自己的判准（"读者从图里学到的东西比一段好文字多吗"）诚实地应用也会得出"表格优先"。

## 五、修正后的建议（按侵入性递增，二选一或都不做）

| 方案 | 改动 | 适用判断 |
| --- | --- | --- |
| **S1·一句话判读说明**（B 线 salvage） | `aes-prototype\SKILL.md` 历史兼容性面加一句示例："纯重构/纯迁移任务：此面判'有'（全部现有用法押不变清单），behavior.md 以全不变清单、零变化行表达完成形态" | 修正的是唯一被证实的洞（判读歧义），零结构改动。**推荐默认** |
| **S2·behavior.md 增设"架构差异"节**（C 线替代） | 六面表加一行"架构与依赖 → behavior.md 的架构差异节"；骨架仿配置差异节（`| 依赖边/模块 | 现在 | 改后 | 谁受影响 |`，没变整节省略）；同步 `session.mjs:149` IMPACT_SURFACES、`session.test.mjs:58` fixture、三处"六面"错误文案（:239/:286/:407）与 `aes-prototype\SKILL.md` 五处"六面"字样、真实产物标题"## 六面扫描（v2）"惯例；`aes-goal-contract` 消费映射加一句"架构差异行 → 强约束或 `[A]` 依赖断言" | 仅当实践中确实反复出现"依赖方向/模块归属变了但行为面表达不出正向变化"的需求才值得。注意 `rebuild` 会重跑闸门把旧 done issue 降级（`session.mjs:573,578`），现存唯一真实 issue 会受影响 |
| 明确不做 | 第七面独立产物、双视图、首分歧、迁移序、Mermaid 节、单图 diff、编辑级视觉系统 | 理由见第三节；另 `analyze\SKILL.md:16,22` 已有只读架构/依赖影响分析能力，防重复建设 |

**判据句不动**："程序在哪些地方跑起来不一样了"是六面的宪法；架构差异节若设立，定位是历史兼容性面的正向补充（"谁在依赖它"的镜像），不进判据句。

## 六、对 diagram-design 引用的勘误表（v1 → v2）

| v1 写法 | v2 修正 |
| --- | --- |
| `README.md:467` / `SKILL.md:59` | 实为 `README.md:466` / `SKILL.md:58` |
| "删除即最高质量" | 原文 "The highest-quality move is **usually** deletion" |
| it-state 与 dp-integration"互为伴侣图""目标态集成图" | 伴侣关系单向（仅 it-state 提及）；dp-integration 无"目标态"自述 |
| fidelity ledger 是"导入压缩时"的报告 | 一切输出小于输入的压缩都要申报（`output-spec.md:153`） |
| 拒做 before/after 的理由是"编辑/出版视角" | 原文无专门理由；判准是通用问句"读者从图学到的比一段好文字多吗" |
| 8 参数化类型"声称同输入必须视觉一致" | 仅 5/8 用 must，loop 用 should，2 个无此句 |

---

## 2026-08-17 决策注记（v2 结论的用户裁定）

本文 v2 的「表格优先、S2 或都不做」结论已被用户裁定推翻：**架构改动与业务流程改动需要
浏览器可开、逐处质疑的可视化对照物**。diagram-design 的通用判准（"读者从图学到的比一段
好文字多吗"）诚实地应用到访谈家族的架构/流程场景，答案是肯定的——拓扑与流向恰是文字
表达最弱、图最强的地方。落地形态为轻量移植，契约见 parking-agents-dev
`.aes-workflow/grilling/2026-08-17-diagram-artifact/3-contract/contract.md`（两仓库为兄弟目录）：

- 绘图规范内核移植进 `aes-prototype/references/diagram.md`：语义色板、4px 网格、圆角正交
  连线公式、复杂度预算（≤9 节点/≤12 箭头/≤2 accent）、`.changed` 改动标注、fidelity ledger
  模板、worked SVG 示例、提取触发条款，出处 diagram-design v2.4.0（MIT）。裁掉 Google
  Fonts（改系统字体，零外链硬规则）、暗色/终端皮肤、动画、导入链路——单消费者用不上。
- 新产物 `2-prototype/diagram.html`：架构视图（拓扑事实源）+ 流程视图（behavior.md 变化行
  的视图）。单视图改后态 + 改动标注，不做双图——v2 否决双图的理由（`.changed` 单视图先例）
  继续成立；本次推翻的是「不做图」，不是「不做双图」。
- 第七面「架构与依赖」进 `session.mjs` 的 IMPACT_SURFACES 强制扫描面（v2 的 S2 升格）：
  判「有」必出架构视图，判「无」写下来即可。表格仍为契约源，例子池与 Verify 档位挂在
  表格行上（Q1 裁决）。
- fidelity ledger 申报精神从 v2 设想的「架构差异表行」改挂到图页脚——一切输出小于输入的
  压缩都要申报（本文勘误表第 4 条），图比表压缩得更狠，申报义务更重。

v2 否决维持不变的：首分歧标记、迁移序、Mermaid 源节、单图 diff、编辑级视觉系统、
独立绘图技能（Q4 裁决含在 aes-prototype；提取触发条款已写入规范——出现第二个图消费者
或需要独立画图入口时回来问，不在原地静默扩张）。
