---
title: "Transformer"
created: 2026-08-10
updated: 2026-08-18
type: concept
tags: [architecture, core-concept]
sources: ["Attention Is All You Need", "Flash Attention Overview"]
---
# Transformer

Sequence-to-sequence architecture built entirely on [[Attention Mechanism]], replacing recurrence.

## Key Ideas
- Self-attention layers process all tokens in parallel
- Positional information injected via embeddings rather than order of computation
- Long-context practicality comes from efficient attention kernels such as [[Flash Attention]] (memory O(N) instead of O(N^2)), not from changes to the architecture itself

## Significance
Foundation of virtually every modern LLM; trained end-to-end on top of a standard [[Neural Network]] backbone.
