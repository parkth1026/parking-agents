# Term policy

## 1. 转换不是翻译任务

本 skill 的默认目标是“少量术语去歧义”，不是 bilingual rewrite，也不是全文翻译。普通中文优先保留；English 只作为一个窄标签，帮助 agent、读者或跨工具识别一个明确概念。

## 2. Strict conversion gate

一个词只有同时满足下面四项才允许转换：

| Gate | 判断问题 |
| --- | --- |
| `Named concept` | 它是否是命名的方法、协议、artifact 或稳定领域概念，而不是普通中文？ |
| `Execution impact` | 误解它是否可能改变目标、路由、输出或验收？ |
| `English information gain` | English 是否增加边界、检索性或跨工具一致性？ |
| `Stable mapping` | 当前上下文是否存在可靠、可解释的 English mapping？ |

任一 gate 不成立，就保留中文。不要因为一个词“看起来像 technical term”而转换。

## 3. Conversion budget

转换数量使用硬上限，但不强行填满：

- 短 prompt、短 `description`：最多 2 个 English terms；
- 普通文章或长文档：最多 5 个 English terms；
- 用户明确给出更低上限时，以用户上限为准；
- 超过上限时，按 information gain 从高到低选择；未入选的词保留中文；
- 同一个 term 多次出现只计 1 个 conversion，不重复加括号。

报告顶部写出：

```text
conversion budget: 2/2
```

`2/2` 表示使用了 2 个转换名额，不表示必须转换 2 个。

## 4. 哪些词默认不转换

下面这些通常是正常语言，不因存在 English equivalent 就转换：

```text
问题、想法、理由、判断、行动、步骤、当前、真正、关键、支持、反对、
完整、明确、功能、需求、方案、完成、可用、原因、目标、范围、结果、下一步
```

只有当它们在当前文本中明确承担 formal term、enum、API、schema field 或 contract field 的角色时，才重新进入 strict conversion gate。

## 5. 翻译 semantic nucleus，不扩写普通修饰语

默认先转换最小的语义核心：

```text
双向钢人分析（steelman）
分歧核心（crux）
```

只有当 `steelman` 或 `crux` 单独不足以表达目标概念时，才扩展为 `steelman both sides` 或 `crux of the disagreement`。不要把“当前”“关键”“双向”等普通修饰语一起强制翻译。

## 6. 术语标签与置信度

| 标签 | 使用条件 | 输出要求 |
| --- | --- | --- |
| `industry-standard` | 当前领域有稳定且普遍的表达 | 给出一个主推荐，并说明上下文 |
| `domain-specific` | 只在某领域或某组织内稳定 | 标明领域，不泛化为所有行业 |
| `context-dependent` | 两个或更多表达都合理 | 给出选择条件，必要时问一个问题 |
| `not-a-software-term` | 概念来自论证、研究或普通语言 | 标明来源，不伪装成工程术语 |
| `unverified` | 没有足够依据确认行业共识 | 不使用“行业标准”措辞 |

置信度使用 `high`、`medium`、`low`。`low` 只能作为候选建议，不能在改写中强制替换。

## 7. Chinese-first 写法

优先使用：

```text
中文表达（English term）
```

只在以下情况保留纯 English：

1. 该词是代码、API、identifier、provider name、path、URL 或版本号。
2. 用户明确要求 English label。
3. 混合写法会让句子更难读。

不要在同一文本中轮换多个 English 同义词，也不要把“更多 English”当成“更准确”。

## 8. 文件安全边界

对 `SKILL.md`：

- 默认只修改 frontmatter 的 `description`；
- 保留 `name`、正文、脚本路径、接口名和约束；
- `agents/openai.yaml` 的 UI metadata 可能需要同步，但没有明确授权时只报告漂移，不自动修改；
- 修改后检查 `description` 不超过 1024 字符且不含尖括号。

对普通 prompt：

- 默认输出改写文本和 diff，不覆盖用户的原文；
- 保留代码块、命令、路径、URL、JSON key 和技术 identifier；
- 不把“更准确”解释成“更多 English”。

## 9. 询问规则

只有当两个候选术语会导致不同的执行结果时才提问，而且一次只问一个最高价值的澄清问题。否则选择更窄、更可验证的术语，并说明取舍。
