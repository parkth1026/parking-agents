---
title: "Pretraining"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [training, core-concept]
sources: ["Karpathy Intro to LLMs Talk"]
---
# Pretraining

The first training stage: weeks-to-months of [[Next-Token Prediction]] on a large internet-scale corpus.

## How It Works
One giant self-supervised run over hundreds of billions of tokens produces a base model with broad world knowledge but no assistant behavior.

## Significance
Pretraining is where scale pays off — [[Emergent Capabilities]] track model and data size — and it is the foundation that [[Fine-Tuning]] later specializes.
