---
title: "Attention Mechanism"
created: 2026-08-10
updated: 2026-08-14
type: concept
tags: [attention, architecture]
sources: ["Flash Attention Article Summary"]
---
# Attention Mechanism
Weights token relevance dynamically.
## How It Works
Queries, keys and values produce a weighted sum.
## Variants
- [[Flash Attention]] — an exact, IO-aware reimplementation that tiles the computation
  and never materializes the full attention matrix, cutting memory from O(N^2) to O(N);
  it shows the real bottleneck is memory bandwidth, not FLOPs.
## Related
- [[Transformer]]
- [[Neural Network]]
