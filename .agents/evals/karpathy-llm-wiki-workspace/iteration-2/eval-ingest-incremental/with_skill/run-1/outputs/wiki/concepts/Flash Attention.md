---
title: "Flash Attention"
created: 2026-08-14
updated: 2026-08-14
type: concept
tags: [attention, architecture, inference]
sources: ["Flash Attention Article Summary"]
---
# Flash Attention

An IO-aware, **exact** implementation of [[Attention Mechanism]] introduced by [[Tri Dao]].
It computes the same result as standard attention (no approximation) while never
materializing the full N x N attention matrix, reducing memory from O(N^2) to O(N).

## How It Works

- **Tiling**: the computation is broken into blocks that stay in fast on-chip GPU memory,
  so the full attention matrix is never written out to slow GPU main memory.
- **Exactness**: tiling reorders the computation; the output is mathematically identical
  to standard attention — this is not a sparse or approximate variant.

## Why It Is Fast: Memory Bandwidth, Not FLOPs

The key insight is that attention is bottlenecked by **memory bandwidth** (data movement
between GPU memory levels), not by arithmetic (FLOPs). Minimizing those reads/writes is
what yields a **2-4x wall-clock speedup** over standard attention in PyTorch.

## Variants

- FlashAttention-2 — further improves performance with better work partitioning across
  GPU thread blocks.

## Significance

Attention is the computational core of the [[Transformer]]; an exact attention kernel
with O(N) memory is what makes long-context training and inference practical.

## Related

- [[Attention Mechanism]] — what Flash Attention computes, exactly
- [[Transformer]] — the architecture that benefits
- [[Tri Dao]] — creator
- [[Flash Attention Article Summary]] — the ingested source for this page
