---
title: "Transformer"
created: 2026-08-10
updated: 2026-08-18
type: concept
tags: [architecture, core-concept]
sources: ["Big Source"]
---
# Transformer

Sequence-to-sequence architecture built entirely on [[Attention Mechanism|attention]], replacing recurrence.

## Key Ideas
- Self-attention layers process all tokens in parallel
- Positional information injected via embeddings rather than order of computation

## Significance
Foundation of virtually every modern LLM; trained end-to-end on top of a standard [[Neural Network]] backbone and surveyed in depth by [[Big Source]].
