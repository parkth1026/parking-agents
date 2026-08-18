---
title: "Tri Dao"
created: 2026-08-18
updated: 2026-08-18
type: entity
tags: [person, attention]
sources: ["Flash Attention Overview"]
---
# Tri Dao

Researcher who introduced [[Flash Attention]], the IO-aware exact attention algorithm.

## Key Facts
- Introduced Flash Attention: tiling-based exact attention that reduces memory from O(N^2) to O(N) and delivers a 2-4x wall-clock speedup over standard attention in PyTorch
- Behind FlashAttention-2, which improves work partitioning across GPU thread blocks

## Significance
His work reframed attention optimization as a memory-bandwidth (IO) problem rather than a FLOPs problem, making efficient [[Attention Mechanism]] practical at scale inside [[Transformer]] models.

## Related
- [[Flash Attention]] — his contribution covered in this wiki
- [[Flash Attention Overview]] — ingested source summary
