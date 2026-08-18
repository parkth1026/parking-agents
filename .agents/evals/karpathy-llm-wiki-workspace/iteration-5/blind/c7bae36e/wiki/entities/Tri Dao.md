---
title: "Tri Dao"
created: 2026-08-18
updated: 2026-08-18
type: entity
tags: [person, attention]
sources: ["Flash Attention"]
---
# Tri Dao

Researcher and author of FlashAttention, the IO-aware exact attention algorithm.

## Key Facts

- Introduced FlashAttention, which reduces attention memory from O(N^2) to O(N) via tiling
- Led FlashAttention-2, which improves work partitioning across GPU thread blocks
- Identified memory bandwidth (not FLOPs) as the real bottleneck in attention

## Significance

His efficiency work makes long-sequence [[Attention Mechanism]] computation practical inside the [[Transformer]] stack, through the [[FlashAttention]] implementation family.

## Related

- [[FlashAttention]] — his signature algorithm
- [[Flash Attention]] — ingested source summary
