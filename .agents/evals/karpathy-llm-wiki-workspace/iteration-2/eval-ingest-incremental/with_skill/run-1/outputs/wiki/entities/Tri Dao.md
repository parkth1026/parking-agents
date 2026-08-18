---
title: "Tri Dao"
created: 2026-08-14
updated: 2026-08-14
type: entity
tags: [person]
sources: ["Flash Attention Article Summary"]
---
# Tri Dao

Researcher who introduced [[Flash Attention]], the IO-aware exact attention algorithm,
and its successor FlashAttention-2 with better work partitioning across GPU thread
blocks.

## Key Facts

- Introduced Flash Attention: exact attention with O(N) memory via tiling.
- FlashAttention-2 refines the idea with better work partitioning across GPU thread
  blocks.

## Significance

His work reframed attention optimization as a **memory-bandwidth (IO) problem rather
than a FLOPs problem**, delivering 2-4x wall-clock speedups inside the [[Transformer]]
stack and making efficient [[Attention Mechanism]] kernels the default in modern LLM
tooling.

## Related

- [[Flash Attention]] — his signature algorithm
- [[Attention Mechanism]] — the operation it optimizes
- [[Transformer]] — the architecture that benefits
