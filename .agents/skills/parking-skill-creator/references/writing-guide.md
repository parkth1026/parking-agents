# 技能写作指南（融合方法论）

写 SKILL.md 时通读本指南。来源：claude skill-creator 的写作章节 + codex skill-creator 的精简原则，按本仓库实践融合。

## 目录

1. [渐进披露](#渐进披露)
2. [三类资源](#三类资源)
3. [自由度分级](#自由度分级)
4. [frontmatter 与 description](#frontmatter-与-description)
5. [写作模式](#写作模式)
6. [写作风格](#写作风格)
7. [不该写什么](#不该写什么)
8. [前向测试与防泄漏](#前向测试与防泄漏)

---

## 渐进披露

技能是三级加载系统：

1. **元数据**（name + description）— 永远在上下文里（约 100 词）
2. **SKILL.md 正文** — 技能触发后加载（理想 <500 行）
3. **打包资源** — 按需加载（无上限；脚本可以不载入上下文直接执行）

要点：

- SKILL.md 逼近 500 行时，把细节拆层并在正文留清晰的「何时去读哪个文件」指针，而不是继续堆。
- 大参考文件（>300 行）在文件头放目录，读者预览即可见全貌。
- 信息只放一处：SKILL.md 或 references，不要两边重复。
- 多领域/多变体技能按变体组织，读者只读相关文件：

```
cloud-deploy/
├── SKILL.md (工作流 + 选择指引)
└── references/
    ├── aws.md
    ├── gcp.md
    └── azure.md
```

## 三类资源

| 资源 | 何时放 | 例子 |
| --- | --- | --- |
| `scripts/` | 同一段代码被反复重写，或需要确定性可靠执行 | 转换/校验/聚合脚本；token 高效、结果确定、可不载入执行 |
| `references/` | agent 工作时应查阅的资料 | schema、API 文档、领域知识、详细流程指南 |
| `assets/` | 会进入最终产出的文件 | 模板、图标、字体、样板工程（不载入上下文，直接使用） |

判断方法：对每个具体使用例子问「从零执行这个例子时，什么资料/代码会被反复重造？」——答案就是资源清单。跨 test case 观察到 subagent 各自重写了相似脚本，是最强的「该进 scripts/」信号。

## 自由度分级

指令的具体程度要匹配任务的脆弱度：

- **高自由度（文字指令）**：多种做法都成立、决策依赖上下文。例：写作风格、研究方法。
- **中自由度（伪代码/带参脚本）**：有首选模式但允许变化。例：有参数的流程脚本。
- **低自由度（具体脚本+固定参数）**：操作脆弱易错、一致性关键、必须按特定顺序。例：打包、统计聚合。

比喻：窄桥加悬崖需要护栏（低自由度），开阔田野随便走（高自由度）。默认假设 agent 已经很聪明——只加它不知道的上下文，每段内容都要回答「这值得它的 token 成本吗」。

## frontmatter 与 description

- `name`：kebab-case，小写字母/数字/连字符，≤64 字符，动词开头的短语优先，目录名与 name 一致。
- `description`：触发的主要机制，同时写清「做什么」与「何时用」：
  - 所有「何时使用」的信息都在这里，不放正文（正文触发后才加载）。
  - agent 对技能普遍偏「漏触发」——description 要写得略「主动」一点：把用户会提到的关键词、场景、相邻说法都覆盖进去，即使用户没点名要这个技能。
  - 官方示例：「How to build a simple fast dashboard…」不如「…whenever the user mentions dashboards, data visualization, internal metrics, or wants to display any kind of company data, even if they don't explicitly ask for a 'dashboard'.」
  - 校验红线：≤1024 字符、不含尖括号。
- 除 name/description 外只允许 license/allowed-tools/metadata/compatibility。

## 中文 Prompt 的术语克制

本仓库的 skill 以中文 Prompt 为主。写作时先解决表达和执行边界，再决定是否需要 English label；不要把技术词密度误当成准确度。

### 转换 gate

只有四项都成立才转换一个词：

1. `Named concept`：它是命名的方法、协议、artifact 或稳定领域概念，而不是普通中文短语。
2. `Execution impact`：误解它可能改变 agent 的目标、路由、输出或验收。
3. `English information gain`：English 增加边界、检索性或跨工具一致性。
4. `Stable mapping`：当前上下文存在可靠、可解释的 English mapping。

任一项不成立，就保留中文。`problem framing`、`current hypothesis`、`key decision variables` 等虽然有 English mapping，但如果当前中文已经足够清楚，不要为了“术语化”而替换。

### 转换预算

- 短 prompt、短 `description`：最多 2 个 English terms；
- 普通文章、长 Prompt 或长文档：最多 5 个 English terms；
- 这是硬上限，不是最低配额；没有值得转换的词就使用 0 个；
- 超过上限时按 information gain 排序，只保留最能改变执行的词；
- 同一个 term 只在首次出现时加一次括号。

### 转换粒度

优先转换 semantic nucleus，保留中文修饰语和句法：

```text
双向钢人分析（steelman）
分歧核心（crux）
```

只有 nucleus 单独不足以表达概念时，才扩展为完整 English phrase。`name`、enum、CLI flag、schema field、API、identifier、path、URL、版本号和命令必须原样保留；它们属于 machine contract，不属于术语润色。

### 输出纪律

如果用户要求术语审计，报告 `conversion budget: used/max`，只列通过 gate 的词，不要为每个普通中文词建立表格。如果用户只要求创建或修改 skill，直接遵守 Chinese-first 规则，不额外制造一篇术语报告。

## 写作模式

**输出格式模板**——要求稳定结构时直接给模板：

```markdown
## Report structure
ALWAYS use this exact template:
# [Title]
## Executive summary
## Key findings
## Recommendations
```

**示例模式**——给 Input/Output 对，比长解释有效：

```markdown
## Commit message format
**Example 1:**
Input: Added user authentication with JWT tokens
Output: feat(auth): implement JWT-based authentication
```

**决策树**——复杂工作流给「如果…则读/做…」的分支指引，而不是线性指令硬套所有情况。

## 写作风格

- 一律祈使句（「读取 X，然后写 Y」，不是「你应该读取 X」）。
- 解释**为什么**，而不是堆 MUST/NEVER：模型有很好的心智理论，讲清原因后能举一反三；满屏大写 ALWAYS 是黄旗——能讲道理就别下命令。
- 从反馈中**泛化**：技能会被用于无数未见过的 prompt，不要为眼前的测试例子写过拟合的补丁；顽固问题时换隐喻、换工作模式，比加约束便宜且常常更有效。
- 保持 prompt 精瘦：读 transcript 而非只看产物，发现技能让模型在无产出环节浪费时间就砍掉那些指令。
- 写完初稿后用新眼光重读一遍再改一轮。

## 不该写什么

- 不放 README.md / INSTALLATION_GUIDE / CHANGELOG / QUICK_REFERENCE 等辅助文档——技能只需要 agent 干活所需的信息。
- 不写技能创建过程的叙事（怎么测的、为什么这么设计）——那是仓库历史，不是运行时知识。
- 「何时使用本技能」的正文节是浪费——那信息属于 description。
- 不放 malware、利用代码或任何会令用户意外的内容；不配合制作误导性或未授权访问用途的技能。

## 前向测试与防泄漏

用 subagent 前向测试复杂技能时，把它当**评测面**：目标是验证技能能否泛化，而不是另一个 agent 能否从泄漏的上下文里重建答案。

- 探针/测试 subagent 不应知道自己在测试技能——prompt 长得像用户直接派活：「用 /path/to/skill-x 解决问题 y」，而不是「评审这个技能；假设用户要求你…」。
- 传**原始工件**（示例 prompt、输出、diff、日志），不传你的结论、预期答案、疑似 bug、预期修法。
- 每轮迭代后从源工件重建上下文；清理上一轮 subagent 留下的工件，避免污染下一轮。
- 如果前向测试只有在 subagent 看得到泄漏上下文时才通过，先收紧技能或测试设置，再信任结果。
- 有风险时（耗时、要用户审批、动生产系统）先给用户看探针 prompt 再跑。
