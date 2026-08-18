---
title: "Transformer"
created: 2026-08-10
updated: 2026-08-18
type: concept
tags: [architecture, core-concept]
sources: ["Attention Is All You Need"]
---
# Transformer

Sequence-to-sequence architecture built entirely on [[Attention Mechanism]], replacing recurrence.

## Key Ideas
- Self-attention layers process all tokens in parallel
- Positional information injected via embeddings rather than order of computation

## Significance
Foundation of virtually every modern LLM; trained end-to-end on top of a standard [[Neural Network]] backbone.
Its [[Attention Mechanism]] layers are memory-bandwidth-bound in practice; [[Flash Attention]] reduces their memory from O(N^2) to O(N) for a 2-4x wall-clock speedup.
