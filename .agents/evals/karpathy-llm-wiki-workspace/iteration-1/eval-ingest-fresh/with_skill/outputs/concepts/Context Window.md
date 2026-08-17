---
title: "Context Window"
created: 2026-04-13
updated: 2026-04-13
type: concept
tags: [architecture, inference, core-concept]
sources: ["Intro to Large Language Models"]
---

# Context Window

The maximum number of tokens a language model can process in a single forward
pass. In the [[LLM OS]] analogy, the context window is the model's "RAM" —
everything it can actively reason over.

## What Goes in the Context Window
- The user's current prompt / conversation
- System prompt (instructions to the model)
- Retrieved documents (from [[Retrieval-Augmented Generation]])
- Tool call results
- Any other content the model needs to reason over

## Sizes Over Time
- GPT-2 (2019): 1,024 tokens
- GPT-3 (2020): 2,048 tokens
- GPT-3.5-turbo (2023): 4,096 → 16,384 tokens
- GPT-4 (2023): 8,192 → 32,768 tokens
- GPT-4-turbo (2023): 128,000 tokens
- Claude 3 (2024): 200,000 tokens

## Limitations
- Content beyond the context window is invisible to the model
- [[Attention Mechanism]] is O(N²) in sequence length — longer contexts are expensive
  ([[Flash Attention]] reduces this memory cost to O(N) via tiling)
- "Lost in the middle" problem: models attend less to content in the middle

## Context Window vs Long-Term Memory
The context window is temporary — information is lost between sessions unless
externalized to disk or a vector database. This is a core challenge for the
[[LLM OS]] paradigm.

## Related
- [[LLM OS]], [[Pretraining]], [[Retrieval-Augmented Generation]], [[Scaling Laws]], [[Attention Mechanism]], [[Flash Attention]]
