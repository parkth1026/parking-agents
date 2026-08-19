# 页面模板

各 wiki 页面类型的速查模板，建新页时复制对应模板。模板正文保持英文——
wiki 页面本身是英文产物，章节标题（Key Facts、How It Works 等）属于
产物结构的一部分，不要译成中文。

## 实体页（entity）

人物、组织、模型、工具——专有名词。

```markdown
---
title: "Entity Name"
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: entity
tags: [tag1, tag2]
sources: ["Source Name"]
---

# Entity Name

Brief description (1-2 sentences).

## Key Facts

- Fact 1
- Fact 2
- Fact 3

## Significance

Why this entity matters in the LLM landscape. What did they create, contribute,
or change?

## Related

- [[Related Entity 1]]
- [[Related Concept 1]]
```

## 概念页（concept）

思想、技术、架构——普通名词。

```markdown
---
title: "Concept Name"
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: concept
tags: [tag1, tag2]
sources: ["Source Name 1", "Source Name 2"]
---

# Concept Name

Clear explanation of the concept. Aim for someone who knows ML basics but not
this specific topic.

## How It Works

Technical details. Include equations if they help, but prioritize intuition.

## Variants

- [[Variant 1]] — brief note on how it differs
- [[Variant 2]]

## History

Where the concept came from and how it evolved.

## Related

- [[Related Concept]]
- [[Key Person or Org]]
```

## 来源页（source）

已 ingest 的文章、论文或转录稿的摘要页。

```markdown
---
title: "Source Title"
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: source
tags: [paper | blog | talk | tutorial, topic-tag]
sources: []
---

# Source Title

> **Authors**: Author Names | **Year**: YYYY | **Type**: Paper / Blog / Talk
> **URL**: original URL (if available)

## Key Takeaways

- Takeaway 1
- Takeaway 2
- Takeaway 3

## Concepts Introduced or Covered

- [[Concept 1]] — brief context
- [[Concept 2]] — brief context

## Notable Quotes

> "Quote text" — Author

(Optional — only include genuinely illuminating quotes)

## Critical Notes

Any limitations, criticisms, or important caveats about this source.
```

## 对比页（comparison）

相关概念、模型或方法的并排对比分析。

```markdown
---
title: "X vs Y"
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: comparison
tags: [comparison, relevant-topic-tags]
sources: ["Source 1", "Source 2"]
---

# X vs Y

Brief context for why this comparison matters.

## Overview

| Aspect | [[X]] | [[Y]] |
|--------|-------|-------|
| Released | | |
| Parameters | | |
| Key Strength | | |
| Key Weakness | | |

## Detailed Analysis

### Architecture Differences

### Performance

### Use Cases

## When to Choose Which

- Choose X when...
- Choose Y when...

## Sources

Based on [[Source 1]], [[Source 2]].
```

## 查询页（query）

从 wiki 综合出的重要答案的存档页。

```markdown
---
title: "Question Text"
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: query
tags: [relevant-topic-tags]
sources: ["Pages consulted"]
---

# Question Text

## Answer

Synthesized answer drawing from multiple wiki pages.

## Sources Consulted

- [[Page 1]] — what it contributed
- [[Page 2]] — what it contributed

## Follow-up Questions

- Related question that might be worth investigating
```
