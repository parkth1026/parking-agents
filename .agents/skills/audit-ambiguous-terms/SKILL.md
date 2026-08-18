---
name: audit-ambiguous-terms
description: 审查并极度克制地改写中文优先的 software engineering、product、domain prompts，以及 Codex SKILL.md 的 description。只为会改变执行且 English 能增加信息的核心术语给出 English equivalent：短 prompt 默认最多 2 个，普通文章最多 5 个，不足不凑数。用于用户要求检查歧义词汇、保留中文但精确翻译少量核心 technical terms、优化 skill description 或 prompt 的触发语义，或在不改变原意的前提下生成可应用修改。默认只输出 audit/rewrite 结果；只有用户明确要求 apply 时才修改文件。不要整段翻译，不要修改代码、API、identifier、provider name、path、URL、版本号，或把未经验证的词称为行业标准。
---

# Audit Ambiguous Terms

## Overview

审查 prompt、skill description 和相关说明中的高风险歧义词，保持中文表达，同时为会影响执行、触发或验收的核心术语选择准确的 English equivalent。输出术语审计、改写文本和最小 diff；默认不写入目标文件。

先读取 [term-policy.md](references/term-policy.md)。涉及 software engineering、product 或 decision analysis 术语时，再读取 [term-catalog.md](references/term-catalog.md)；需要模仿已有转换格式时读取 [rewrite-examples.md](references/rewrite-examples.md)。

## Workflow

### 1. Classify the input and requested mode

先判断输入是：

- inline prompt 或普通文本；
- `SKILL.md`；
- `SKILL.md` frontmatter 的 `description`；
- 其他结构化说明。

再判断用户要的是：

- `audit`：只报告问题；
- `rewrite`：输出改写后的完整文本和最小 diff；
- `apply`：用户明确授权后，修改指定文件并展示 diff。

没有明确指定时使用 `rewrite`，不写文件。

### 2. Extract the contract before changing words

先记录原文中的以下约束：

- 受众和语言偏好，例如中文开发者、Chinese-first；
- 任务目标、触发范围和不应触发的相邻任务；
- 必须保留的术语、代码、API、identifier、provider name、path、URL、版本号；
- 输出格式、是否允许写文件、是否只能修改 `description`。

不要因为发现一个歧义词就扩大修改范围。若目标是已有 `SKILL.md`，默认只改 frontmatter 的 `description`；`name`、正文和 `agents/openai.yaml` 只在用户明确要求时改动。

### 3. Apply the strict conversion gate

把“值得转换”当成四道同时成立的 gate，而不是看到 technical-looking word 就转换：

1. `Named concept`：它是命名的方法、协议、artifact 或稳定的领域概念，不是普通中文短语。
2. `Execution impact`：误解它可能改变 agent 的目标、路由、输出或验收。
3. `English information gain`：English term 比中文原词增加了可识别的边界、检索性或跨工具一致性。
4. `Stable mapping`：存在与当前上下文匹配的稳定表达；不能只凭直觉造一个“像行业术语”的译法。

四道 gate 有任一不成立，就保留中文。短 prompt 默认最多转换 2 个 term；普通文章或长文档最多 5 个 term。上限不是配额，不足 2/5 个时不要补齐。超过上限时，按 information gain 从高到低保留，其他候选只列为“保留项”。

### 4. Find ambiguity that can change execution

优先检查以下类型：

1. 抽象词：例如“做好”“想清楚”“支持”“完成”“可用”。
2. 跨领域词：同一个词在 software engineering、product 和普通语言中的含义不同。
3. 方法名或隐喻：例如“钢人论证”不是 software engineering 专词。
4. 触发词：`description` 中过宽或过窄的任务描述，会导致漏触发或误触发。
5. 验收词：没有说明可观察结果的“正确”“完整”“行业标准”。

只报告通过 strict conversion gate 且会改变执行、路由、输出或验收的歧义。单纯的文风偏好、常用中文、可以直接用中文解释清楚的词，不算转换对象。

默认保留中文的词包括“问题、想法、理由、判断、行动、步骤、当前、真正、关键、支持、反对、完整、明确、功能、需求、方案、完成、可用”等。只有它们在当前文本中是明确的 formal term、enum、API 或 contract field 时，才重新进入 gate。

### 5. Choose a term with context and confidence

对每个候选词给出一行术语记录：

```text
原词 | 歧义风险 | 推荐表达 | 术语类型 | 置信度 | 适用条件 | 不适用场景
```

术语类型只能从以下类别中选择：

- `industry-standard`：在当前上下文中有稳定、广泛的行业用法；
- `domain-specific`：只在特定领域成立；
- `context-dependent`：存在多个合理表达，必须说明选择条件；
- `not-a-software-term`：概念有效，但来源不是 software engineering；
- `unverified`：没有足够依据称为行业标准。

若两个候选词会改变用户意图，保留候选并只问一个最有决策价值的澄清问题。若差异不影响执行，选择较窄、较可验证的表达，并记录理由。不要把 catalog 中的候选词自动全部转换。

### 6. Rewrite Chinese-first

遵守以下顺序：

1. 保留中文句式和普通中文词汇。
2. 只在首次出现且通过四道 gate 时写成“中文（English）”。优先翻译 semantic nucleus，例如“分歧核心（crux）”“双向钢人分析（steelman）”；只有 nucleus 不够明确时才扩展成完整 English phrase。
3. 后续保持同一个 English term，不在同一文本内随意切换同义词。
4. 不把整段文本翻译成 English。
5. 普通动作和要求保持中文；例如“详细思考”最多改成中文“严谨分析”，不要自动增加 `rigorous analysis`，也不要要求展示内部 chain-of-thought。

对于 `SKILL.md` 的 `description`，保留“做什么 + 何时使用 + 边界”三部分，并避免只写“提升质量”“优化表达”这类无法路由的描述。

### 7. Validate and report the smallest safe change

输出固定为：

```markdown
## 审计结论

## 术语审计
| 原词 | 歧义风险 | 推荐表达 | 术语类型 | 置信度 | 说明 |
| --- | --- | --- | --- | --- | --- |

## 修改后文本

## 最小 diff

## 未自动修改项
```

在报告顶部注明 `conversion budget: used/max`，让读者能看到转换数量和上限。报告只列通过 gate 的候选；普通中文保留项不逐词罗列。

当目标是 `SKILL.md` 时，运行：

```text
node scripts/validate-rewrite.mjs <path-to-SKILL.md> --kind skill
```

该脚本只做确定性检查：frontmatter、`name`、`description` 长度、尖括号、待办占位和可选的术语断言。它不能证明某个 English term 真的是行业标准；行业判断仍要依据上下文和术语记录。

只有用户明确使用“应用修改”“写回文件”或等价指令时，才执行 `apply`：先保存修改前事实，修改指定文件，展示最小 diff，再重新运行校验。若用户只要求审计或建议，保持目标文件不变。

## First conversion example

使用 `fixtures/first-prompt.input.md` 作为原始输入，目标输出见 `fixtures/first-prompt.expected.md`。这个例子体现 strict conversion gate：只转换“分歧核心（crux）”和“双向钢人分析（steelman）”，保留其他正常中文。

## Regression test

每次改动后运行：

```text
node run-tests.mjs
```

测试会黑盒执行 `scripts/validate-rewrite.mjs`，检查本技能的 `SKILL.md` 和首个转换 fixture。测试通过只证明确定性约束没有回归，不替代真实 prompt 的人工或 subagent 评审。
