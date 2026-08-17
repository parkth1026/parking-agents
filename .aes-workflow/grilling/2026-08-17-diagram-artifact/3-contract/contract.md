# Goal Contract: 给 workflow-interview 家族引入图表对照物 diagram.html 与第七面「架构与依赖」

- Status: Ready
- Target: parking-agents-dev/.claude/skills/（workflow-interview、aes-interview、aes-prototype、aes-goal-contract）＋ parking-agents 主仓库调研文档一处注记
- Updated: 2026-08-17

## 原始请求

> 我要的是 diagram-design 能力 来完善 架构图流程图相关绘制， 替代纯文本的表达
> 可以像看 mock.html一样 决策界面直观。 架构与业务改动 也需要用 流程图来强化。

> （2026-08-17 kickoff）基于上面计划文档 开始 interview

## 目标

架构改动与业务流程改动获得浏览器可开、逐处质疑的可视化对照物（diagram.html），
依赖与模块归属变化成为强制扫描面（第七面「架构与依赖」）；表格仍为契约源，
图做决策面与架构面事实源。

## Why

- 现状：架构/流程改动只有文字表格，用户确认对照物时无法一眼看懂拓扑与流向，
  质疑成本高；依赖方向、模块归属变化不在强制扫描面内，扫不扫凭自觉。
- 做到后：决策直观性对齐 mock.html；依赖变化成为一等扫描对象；每张图带
  fidelity ledger，合并与删减逐条申报、绝不静默。

## 范围

做：

- 新建 `aes-prototype/references/diagram.md`——绘图规范内核（语义色板、4px 网格、
  圆角正交连线公式、复杂度预算、.changed 改动标注、fidelity ledger 模板、worked
  SVG 示例、提取触发条款、MIT 出处），从 diagram-design v2.4.0 轻量移植。
- `aes-prototype/SKILL.md`：影响面表增「架构与依赖」行、diagram.html 产物节、
  behavior.md 流程视图指针、例子池增行、frontmatter 与「六面→七面」5 处。
- `workflow-interview/SKILL.md`：「六面→七面」1 处。
- `aes-goal-contract/SKILL.md`：例子池增 diagram.html 行、验收映射增架构向段。
- `workflow-interview/scripts/session.mjs`：IMPACT_SURFACES 追加「架构与依赖」，
  4 处「六面」文案（:239/:286/:403/:407）。
- `workflow-interview/scripts/session.test.mjs`：fixture 补第七面、needle 同步、
  新增 `--artifacts` 命中 .html 候选用例。
- `workflow-interview/scripts/validate-goal-contract.mjs`：引用 HTML 对照物的
  WARNING 正则扩为 (mock|diagram)，头注释同步。
- `workflow-interview/evals/evals.json`：新增图表场景评测。
- 存量 issue 2026-08-16-jenkins-learning-nas-scope 影响面清单补扫一行。
- parking-agents 主仓库 `docs/research/diagram-design-能力分析与workflow-interview优化机会.md`
  末尾追加 2026-08-17 决策注记（相对路径 `../parking-agents/…`，两仓库为兄弟目录）。

不做：

- before/after 双图、首分歧标记、迁移序、Mermaid 源节、独立 architecture.md、
  单图 diff、编辑级视觉系统（调研 v2 对抗审查的否决维持）。
- 独立绘图技能（Q4 裁决：含在 aes-prototype；提取触发条款已写入规范）。
- behavior.md 等表格产物并入 HTML、任何表格产物形态变更（Q1 裁决：表为源）。
- 任何运行时依赖、Google Fonts、JS、外链资源。
- analyze 集成、mock.html/asking.md/aes-interview 的任何改动。

## 强约束

- 确认版对照物（`../2-prototype/behavior.md`、`../2-prototype/diagram.html`、
  `../2-prototype/example-run.md`）不可修改：执行 Agent 改的是产品不是对照物。
- 表格仍为契约源：例子池与 Verify 档位挂在表格行上；diagram.html 架构视图是
  拓扑事实源（其标注变化 → 强约束不变式或 [A] 依赖断言），流程视图是 behavior.md
  变化行的视图，不另立例子。
- diagram.html 自包含硬规则：单文件、内联 SVG/CSS、零 JS、零外链、系统字体。
- 单视图 + 改动标注：画改后态，.changed/accent 标注，删除项进页脚清单；不做双图。
- fidelity ledger 必带：每图页脚申报 Detail/Merged/Collapsed/Dropped/Kept。
- 复杂度预算：每图 ≤9 节点、≤12 箭头、≤2 accent，超了拆 overview+detail。
- 既有行为不变量一字不动：逐轮问答行 schema、--artifacts 开放命名与 mock 特例
  映射、manifest schema 与原子写、finalize 四件事、契约 mtime 复核、契约自包含
  不变量、过程文件拒收清单；六个命令用法与退出码逐字节不变（仅 behavior.md
  变化行 1/2 申报的两处「六面→七面」用户可见文案除外）。
- 存量 issue 确认版产物一字不动（影响面清单补扫行除外）。

## 自主边界

不用问，直接定：

- 产物命名与文案的最终措辞、色板具体取值、SVG 结构与连线公式细节、worked 示例
  内容、WARNING 正则实现、新 eval 文案、references 文件内部组织。
- 影响面清单里第七面行的具体格式（含「架构与依赖」字样即可过闸门）。

必须停下来问：

- 出现第二个图消费者（如 analyze 要输出图示）或需要独立画图入口——触发提取
  条款，是否拆独立技能回来问。
- 引入任何运行时依赖、外链资源或构建步骤。
- 动逐轮问答 schema、manifest schema、mock 特例映射、既有 eval 断言、asking.md、
  aes-interview。
- 改 behavior.md 的契约源地位或把任何表格产物并入 HTML。

## 读什么

- `../2-prototype/behavior.md` — 行为变化 8 行与不变清单，行为口径的事实源。
- `../2-prototype/diagram.html` — 家族产物流转架构图，新产物类型的确认版样例
  （改动申报与 fidelity ledger 的惯例以此为准）。
- `../2-prototype/example-run.md` — 三个 CLI 场景：七面拒收、.html 候选放行、
  测试全绿。
- `G:\GIT\AI_WorkFlow_ref\diagram-design\skills\diagram-design\`（只读参考：SKILL.md
  设计系统与 references/style-guide.md、type-architecture.md——移植出处）。

## 验收条件

- AC-001: 七面闸门与开放命名行为全绿——缺「架构与依赖」时 done/skipped 拒收、
  `--artifacts diagram` 命中 .html 候选、rebuild 用例、测试 needle 同步
  - Verify: [A] `bash -c 'node .claude/skills/workflow-interview/scripts/session.test.mjs && grep -q 架构与依赖 .claude/skills/workflow-interview/scripts/session.test.mjs'` → 退出码 0
- AC-002: 四技能目录（含 scripts 与 evals）不再出现「六面」字样
  - Verify: [A] `bash -c '! grep -rn 六面 .claude/skills/workflow-interview .claude/skills/aes-interview .claude/skills/aes-prototype .claude/skills/aes-goal-contract'` → 退出码 0
- AC-003: diagram.html 消费链闭合——aes-prototype 例子池行、aes-goal-contract
  例子池行、validate 正则 (mock|diagram) 三处就位
  - Verify: [A] `bash -c 'grep -q diagram.html .claude/skills/aes-prototype/SKILL.md && grep -q diagram.html .claude/skills/aes-goal-contract/SKILL.md && grep -q "mock|diagram" .claude/skills/workflow-interview/scripts/validate-goal-contract.mjs'` → 退出码 0
- AC-004: 绘图规范在盘且必备节齐——语义色板、复杂度预算、fidelity ledger、
  .changed 标注、提取触发条款、MIT 出处
  - Verify: [A] `bash -c 'grep -q 色板 .claude/skills/aes-prototype/references/diagram.md && grep -q 复杂度预算 .claude/skills/aes-prototype/references/diagram.md && grep -q fidelity .claude/skills/aes-prototype/references/diagram.md && grep -q .changed .claude/skills/aes-prototype/references/diagram.md && grep -q 提取 .claude/skills/aes-prototype/references/diagram.md && grep -q MIT .claude/skills/aes-prototype/references/diagram.md'` → 退出码 0
- AC-005: 存量 issue 补扫在盘——2026-08-16-jenkins-learning-nas-scope 的影响面
  扫描记录含「架构与依赖」补扫行
  - Verify: [A] `bash -c 'grep -rq 架构与依赖 .aes-workflow/grilling/2026-08-16-jenkins-learning-nas-scope/2-prototype/'` → 退出码 0
- AC-006: 跨仓库决策注记在盘——parking-agents 调研文档末尾有 2026-08-17 裁定注记
  - Verify: [A] `bash -c 'grep -q 2026-08-17 "../parking-agents/docs/research/diagram-design-能力分析与workflow-interview优化机会.md"'` → 退出码 0
- AC-007: eval 图表场景在盘——evals.json 含图表场景（断言自包含无外链、改动
  标注、被「读什么」引用）
  - Verify: [A] `bash -c 'grep -q diagram .claude/skills/workflow-interview/evals/evals.json'` → 退出码 0

## 挡着的事

- None.

## 残留风险

- 对照物以整体放行确认（「请继续」），diagram 视觉细节与 behavior 变化行口径未
  逐条点名 — 错了会怎样：首版视觉规格或行为口径可能需一轮微调，闸门与契约机制
  不受影响。
- AC 后果句经用户一次整体「确认」，未逐条改写 — 错了会怎样：某条判据偏严或偏松，
  执行完成后需人工复核七条。

## 访谈记录

### 第 1 轮（需求访谈）

| 问题 | 候选（带当时百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| Q1 图与表谁是事实源 | A 表为源图为面 65% / B 合并进 HTML 20% / C 架构文本孪生 15% | A | A |
| Q2 架构与依赖进扫描体系 | A 升第七面 70% / B behavior 架构差异节 22% / C 面+节三层 8% | A | A |
| Q3 跨仓库决策注记 | A 追加注记 75% / B 不动 25% | A | A |
| C1 存量 issue 补扫（确认区） | 补 / 不补 | 补 | 补 |

默认区 8 条（命名 diagram.html、零外链零 JS 系统字体、语义色板、≤9 节点、
fidelity ledger 必带、规范住 aes-prototype、正则扩展、新 eval）：未反对，视为接受。

### 第 2 轮（对照物阶段，diagram 草稿触发）

| 问题 | 候选 | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| Q4 绘图能力归属 | A 含在 aes-prototype 72% / B 独立被动技能库 20% / C 独立通用技能 8% | A | A |

### 第 3 轮（对照物确认）

三份对照物整体放行（「请继续」）；视觉细节未逐处点名，已记残留风险。

### 第 4 轮（验收条件）

七条 AC 的后果句与全 [A] 途径整体确认（用户回复：确认）；7 条触顶不拆的取舍
一并确认。

## 设计取舍

### D-1 引入形态

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| v1 四件套 architecture.md | 独立架构产物+双视图+首分歧+迁移序 | 结构性失真风险；锁实现 | 对抗审查证伪（例子池准入、宪法冲突） |
| 仅 S1 判读句 | 历史兼容性面加一句（已先行落盘） | 不解决可视化诉求 | 用户裁定要绘图能力 |
| 轻量移植（选定） | references 规范 + diagram.html + 第七面 + 家族同步 | 7 条 AC 触顶；issue 义务 +1 面 | 无 |
| 整技能安装 / 独立通用技能 | 装 diagram-design 或建通用画图技能 | 148 文件、触发面失控、编排器宪法违反 | 单消费者；Q4 裁决 |
| 什么都不做 | 维持 S1 | 决策不直观维持 | 用户推翻 v2「明确不做」 |

选定轻量移植。落进契约的形态：强约束写「零 JS 零外链系统字体 / 单视图+改动
标注 / ledger 必带」——约束不会过时，步骤会。

### D-2 AC 七条触顶不拆

聚出七条（上限 7，指导值 ≤6）。不拆的理由：七条互为前提——规范无闸门等于漏扫
（AC-004↔AC-001）、闸门无消费链等于断链（AC-001↔AC-003）；拆成两份契约会互相
引用对方的产物，违反「一份契约只承载一件能独立交付的事」。落进契约的形态：七条
并列，各自独立可判。
