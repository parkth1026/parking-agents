---
title: "Transformer"
created: 2026-08-10
updated: 2026-08-18
type: concept
tags: [architecture, core-concept]
sources: ["Attention Is All You Need", "Flash Attention by Tri Dao"]
---
# Transformer

Sequence-to-sequence architecture built entirely on [[Attention Mechanism]], replacing recurrence.

## Key Ideas
- Self-attention layers process all tokens in parallel
- Positional information injected via embeddings rather than order of computation

## Significance
Foundation of virtually every modern LLM; trained end-to-end on top of a standard [[Neural Network]] backbone.
Efficient attention implementations such as [[Flash Attention]] make long-sequence Transformers practical by avoiding the O(N^2) memory cost of naive attention.
