---
title: "Attention Mechanism"
created: 2026-08-10
updated: 2026-08-18
type: concept
tags: [attention, core-concept]
sources: ["Attention Is All You Need", "Flash Attention by Tri Dao"]
---
# Attention Mechanism

Compute-then-weight operation letting each token gather information from every other token.

## How It Works
Query/key/value dot products produce a distribution over positions, used to mix value vectors.

## Variants
- Multi-head attention as used in [[Transformer]]
- IO-aware exact implementations such as [[Flash Attention]], which cut memory from O(N^2) to O(N)
- Can be stacked in any differentiable [[Neural Network]]
