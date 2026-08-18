---
title: "FlashAttention"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [attention, inference, hardware]
sources: ["FlashAttention (article)"]
---
# FlashAttention

IO-aware exact attention algorithm introduced by Tri Dao: it computes the same result as the standard [[Attention Mechanism]], but reorganizes the computation so the full N×N attention matrix is never materialized, cutting memory from O(N^2) to O(N).

## How It Works
- **Tiling**: the computation is split into blocks (tiles) kept in fast on-chip GPU memory, avoiding reads and writes of the full attention matrix to slow GPU memory.
- **Exact, not approximate**: output matches standard attention; the win comes from I/O layout, not from dropping terms.
- **Why it is fast**: the bottleneck in attention is memory bandwidth, not FLOPs — so removing memory traffic yields 2-4x wall-clock speedup over standard attention in PyTorch.

## Variants
- **FlashAttention-2** — further improves performance with better work partitioning across GPU thread blocks.

## History
Introduced by Tri Dao; this page is based on [[FlashAttention (article)]].

## Related
- [[Attention Mechanism]] — the computation FlashAttention optimizes
- [[Transformer]] — long-sequence transformers depend on fast exact attention
