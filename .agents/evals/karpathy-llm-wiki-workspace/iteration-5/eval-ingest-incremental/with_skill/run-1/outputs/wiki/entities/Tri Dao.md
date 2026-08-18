---
title: "Tri Dao"
created: 2026-08-18
updated: 2026-08-18
type: entity
tags: [person, attention]
sources: ["Flash Attention (article)"]
---
# Tri Dao

Researcher and creator of Flash Attention, the IO-aware exact attention algorithm.

## Key Facts

- Introduced Flash Attention: exact attention with O(N) memory (vs O(N^2)) via tiled computation that avoids materializing the full attention matrix; 2-4x wall-clock speedup over standard attention in PyTorch.
- Led FlashAttention-2, which further improves performance through better work partitioning across GPU thread blocks.

## Significance

Tri Dao's work reframed [[Attention Mechanism]] optimization around memory bandwidth rather than FLOPs, making exact attention at long sequence lengths practical — a foundational efficiency result for the [[Transformer]] ecosystem and modern LLM training/serving.

## Related

- [[Flash Attention]] — his IO-aware exact attention algorithm
- [[Attention Mechanism]] — the underlying computation it optimizes
- [[Transformer]] — the architecture that benefits
