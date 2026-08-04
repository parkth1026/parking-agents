---
title: "Flash Attention"
created: 2026-04-13
updated: 2026-04-13
type: concept
tags: [attention, optimization, inference, architecture, paper]
sources: ["Flash Attention Article"]
---

# Flash Attention

An IO-aware exact attention algorithm introduced by Tri Dao that dramatically
reduces the memory footprint of [[Attention Mechanism]] computation while
achieving 2-4x wall-clock speedup over standard PyTorch attention.

## The Problem It Solves

Standard [[Attention Mechanism]] materializes the full N×N attention matrix
in GPU HBM (high-bandwidth memory), requiring **O(N²) memory**. For long
sequences this is the dominant memory cost in a [[Transformer]] forward pass.
The key insight: the bottleneck is **memory bandwidth, not FLOPs**.

Modern GPUs have two tiers of memory:
- **HBM (High-Bandwidth Memory)**: large (~40–80 GB) but slow to access
- **SRAM (on-chip)**: tiny (~20 MB) but extremely fast

Standard attention reads/writes the attention matrix from/to HBM repeatedly,
burning memory bandwidth on every access.

## How Flash Attention Works

Flash Attention uses **tiling** to avoid ever materializing the full N×N matrix:

1. Divide Q, K, V into tiles that fit in SRAM
2. For each tile, compute a partial attention result using the online softmax trick
3. Accumulate results across tiles without writing the full matrix to HBM
4. Final output is exact (not approximate) — mathematically identical to standard attention

**Memory reduction**: O(N²) → **O(N)**
**Speedup**: 2-4× wall-clock time over standard PyTorch attention (v1)

## Flash Attention 2

FlashAttention-2 (Dao, 2023) further improves on the original:
- Better work partitioning across GPU **thread blocks** and warps
- Reduces non-matmul FLOPs
- Achieves higher GPU utilization (close to theoretical maximum FLOP/s)
- Typical speedup: 2× over FlashAttention-1

## Why "IO-Aware"

The term "IO-aware" means the algorithm is designed around memory I/O cost,
not just FLOP count. Traditional algorithms optimize for FLOPs; Flash Attention
optimizes for data movement, which is the actual bottleneck on modern GPUs.

## Impact

Flash Attention enables:
- **Longer context windows**: 4K → 8K → 100K+ tokens become tractable
- **Larger batch sizes**: lower memory per sequence = more sequences per GPU
- **Faster training**: fewer HBM reads/writes per iteration

Most modern LLM training frameworks (PyTorch 2.0+, JAX, TensorFlow) have
integrated Flash Attention or its equivalent as the default attention kernel.

## Author

Tri Dao (Stanford PhD, now at Princeton), with Chris Ré. Published as
"FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness"
at NeurIPS 2022. See [[Flash Attention Article]] for source summary.

## Related

- [[Attention Mechanism]], [[Transformer]], [[Context Window]], [[Scaling Laws]]
