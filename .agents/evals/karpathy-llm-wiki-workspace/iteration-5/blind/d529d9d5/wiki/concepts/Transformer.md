---
title: "Transformer"
created: 2026-08-10
updated: 2026-08-18
type: concept
tags: [architecture, core-concept]
sources: ["Attention Is All You Need", "Flash Attention (article)"]
---
# Transformer

Sequence-to-sequence architecture built entirely on [[Attention Mechanism]], replacing recurrence.

## Key Ideas
- Self-attention layers process all tokens in parallel
- Positional information injected via embeddings rather than order of computation
- At long sequence lengths, self-attention cost is dominated by memory traffic — addressed by [[Flash Attention]]

## Significance
Foundation of virtually every modern LLM; trained end-to-end on top of a standard [[Neural Network]] backbone.
Attention efficiency work such as Flash Attention keeps the [[Attention Mechanism]] scalable to long contexts.
