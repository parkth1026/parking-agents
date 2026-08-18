---
title: "Transformer"
created: 2026-08-10
updated: 2026-08-18
type: concept
tags: [architecture, core-concept]
sources: ["Attention Is All You Need", "Flash Attention (Tri Dao)"]
---
# Transformer

Sequence-to-sequence architecture built entirely on [[Attention Mechanism]], replacing recurrence.

## Key Ideas
- Self-attention layers process all tokens in parallel
- Positional information injected via embeddings rather than order of computation

## Significance
Foundation of virtually every modern LLM; trained end-to-end on top of a standard [[Neural Network]] backbone. Its attention cost scales O(N^2) with sequence length, which efficient exact implementations such as [[Flash Attention]] (O(N) memory, 2-4x wall-clock speedup) mitigate in practice.
