---
title: "Attention Mechanism"
created: 2026-08-10
updated: 2026-08-11
type: concept
tags: [attention, core-concept]
sources: ["Attention Is All You Need"]
---
# Attention Mechanism

Compute-then-weight operation letting each token gather information from every other token.

## How It Works
Query/key/value dot products produce a distribution over positions, used to mix value vectors.

## Cost Scaling
The naive implementation materializes the full N-by-N attention matrix, so memory grows **quadratically** with sequence length (O(N^2)) — the main cost barrier for long sequences in a [[Transformer]]. [[Flash Attention]] addresses exactly this bottleneck; the computation itself stacks like any layer of a [[Neural Network]].
