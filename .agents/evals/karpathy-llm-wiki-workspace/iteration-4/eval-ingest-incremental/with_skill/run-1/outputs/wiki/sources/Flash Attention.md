---
title: "Flash Attention"
created: 2026-08-18
updated: 2026-08-18
type: source
tags: [blog, attention]
sources: []
---
# Flash Attention

> **Authors**: unattributed (user-provided summary; subject: work by Tri Dao) | **Year**: unknown | **Type**: Article
> **URL**: none (pasted text; raw saved at `wiki-raw/articles/2026-08-18-flash-attention.md`)

## Key Takeaways

- FlashAttention is an IO-aware **exact** attention algorithm — same result as standard attention, no approximation
- Tiling the computation avoids materializing the full attention matrix, cutting memory from O(N^2) to O(N)
- Achieves 2-4x wall-clock speedup over standard attention in PyTorch
- FlashAttention-2 further improves work partitioning across GPU thread blocks
- Key insight: the bottleneck in attention is memory bandwidth, not FLOPs

## Concepts Introduced or Covered

- [[FlashAttention]] — the technique this article introduces
- [[Attention Mechanism]] — the core computation being made IO-efficient
- [[Transformer]] — the architecture whose attention bottleneck this addresses

## Notable Quotes

> "Key insight: the bottleneck in attention is memory bandwidth, not FLOPs."

## Critical Notes

- Short user-provided summary, not the original paper; speedup figures are as reported by the source and not independently verified.
- Author and publication date unknown; Tri Dao credited as the technique's author. Tri Dao and PyTorch recorded as pending page candidates in log.md (single mention, below creation threshold).
