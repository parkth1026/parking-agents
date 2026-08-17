# Context Snapshot: 2026-08-17-diagram-artifact

- 创建：2026-08-16T17:39:47Z
- 分片来源：facts/diagram-design-内核.md、facts/家族闸门与产物机制.md

## 任务陈述

用户原话（方向裁定，2026-08-17 AskUserQuestion 自定义回答）：

> 我要的是 diagram-design 能力 来完善 架构图流程图相关绘制， 替代纯文本的表达
> 可以像看 mock.html一样 决策界面直观。 架构与业务改动 也需要用 流程图来强化。

用户原话（本轮 kickoff）：

> [$workflow-interview] 基于上面计划文档 开始 interview

## 用户提出的方案

会话中已产出一版计划文档（ExitPlanMode 未批准，用户改裁为先进访谈），要点：

1. 新增确认版对照物 `diagram.html`（结构与流程对照图）：单文件自包含 HTML + 内联
   SVG，浏览器打开逐处质疑；含架构视图（依赖/模块拓扑改后态）与流程视图（业务流程
   改后态）两个视图。
2. 绘图规范从 diagram-design v2.4.0 轻量移植为 `aes-prototype/references/diagram.md`
   （内核：语义色板、4px 网格、圆角正交连线、复杂度预算、fidelity ledger、worked 示例）。
3. 新增第七影响面「架构与依赖」→ 产物 diagram.html 架构视图。
4. 五个设计裁决：单视图+`.changed` 标注（非双图）；零 JS+系统字体（无外链，比
   diagram-design 更严）；fidelity ledger 必带；事实源分治（架构视图=事实源→强约束/
   [A]，流程视图=behavior.md 变化行的视图）；表格仍是契约源、图是决策面。
5. 同步面：session.mjs（IMPACT_SURFACES+文案 4 处）、session.test.mjs（fixture+needle+
   新用例）、aes-prototype/aes-goal-contract/workflow-interview 三份 SKILL.md、
   validate-goal-contract 正则、evals 新场景、存量 issue 补扫、调研文档决策注记。

## 意图假设

用户要解决的不是「画图工具」，而是**决策界面的直观性**：现状下架构改动与业务流程改动
只有文字表格（behavior.md），用户确认对照物时无法一眼看懂拓扑与流向，质疑成本高。
他要的判据是「像看 mock.html 一样」——打开就能逐处挑毛病。任务陈述里「替代纯文本」
与计划里「表格仍是契约源」存在张力，这正是本轮提问要收口的第一歧义。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| `--artifacts` 开放命名，diagram.html 零代码改动即被闸门/rebuild/契约检查接纳 | facts/家族闸门与产物机制.md（session.mjs:245-264） | Fact |
| 加第七面的机器耦合点：IMPACT_SURFACES(:149)+测试 fixture(:58)+「六面」文案 13 处（含 needle :175） | 同上 | Fact |
| 存量唯一 issue 加面后 rebuild 会降级，需补扫一行 | 同上（session.mjs:566-580） | Fact |
| 新产物不补例子池两侧行（aes-goal-contract:35-38 + aes-prototype §4）会被契约阶段当不存在 | 同上 | Fact |
| diagram-design MIT；最小移植内核 ≈6 文件；纯指令绘图；唯一外链依赖 Google Fonts 与家族「无 CDN」eval 断言冲突 | facts/diagram-design-内核.md | Fact |
| fidelity ledger 原文语境是导入，「源」须改为影响面事实；before/after 双图是它家的图机制，「简单前后对比→表格」是它自己的反图规则 | 同上 | Fact |
| 多面共一产物有先例（behavior.md 服务三面）；确认版不可修改是通用条款 | facts/家族闸门与产物机制.md | Fact |
| 例子池准入与 Verify 档位挂在表格行上；依赖边不是人眼可逐点核对的界面（不立 [C] 视觉对照） | 调研 v2 + goal-contract-shape 档位定义 | Fact |

## 验证基建候选池

- `node .claude/skills/workflow-interview/scripts/session.test.mjs`——黑盒进程级、零
  依赖、node 直跑；代价：每用例起新进程稍慢；加面与新产物必须补用例（fixture 双拷贝）。
- `evals/evals.json` 技能评测——代价：非自动门，agent 走查时人工跑；eval 3 已断言
  mock.html 自包含无 CDN，图表产物仿此断言。
- 手工闸门冒烟（tmp init→写盘→stage done）——代价：一次性，不入库。
- 仓库无 CI、无 pre-commit——**没有自动门**，全部测试靠手动跑。

## 四分类

- **Fact**：上表全部；两份 facts 分片是证据源。
- **User decision**（2026-08-17 第 1 轮已全部裁决，见 rounds.jsonl）：
  - Q1=A：表格仍为契约源，diagram.html 做决策面 + 架构面事实源；流程视图是
    behavior.md 变化行的视图（每处标注对应一行，表为准）。
  - Q2=A：升第七面「架构与依赖」，impact-surface 必扫，判「有」必出架构视图，
    判「无」写下来即可；session.mjs/测试/13 处文案同步。
  - Q3=A：parking-agents 主仓库调研文档末尾追加日期注记（推翻 v2「明确不做」中
    视觉系统一项，护栏照旧），不改写 v2 正文。跨仓库边界，已裁。
  - C1=补：存量 issue 2026-08-16-jenkins-learning-nas-scope 的 impact-surface.md
    补扫一行「架构与依赖：无（补扫）」。
- **Agent-owned**：产物最终命名措辞、色板具体取值、SVG 结构与连线公式细节、worked
  示例内容、WARNING 正则实现、新 eval 文案、references 文件组织、文案改写风格。
- **Blocked**：无。

## 决定边界未知项

无——第 1 轮提问后全部收口，无待归类项。

## 未知项

无跨出仓库边界的技术未知；用户裁决类事项已全部进入本轮提问。
