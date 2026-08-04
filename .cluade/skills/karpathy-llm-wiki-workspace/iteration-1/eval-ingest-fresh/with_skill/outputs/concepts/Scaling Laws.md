---
title: "Scaling Laws"
created: 2026-04-13
updated: 2026-04-13
type: concept
tags: [scaling-laws, training, core-concept, emergent-abilities]
sources: ["Intro to Large Language Models"]
---

# Scaling Laws

Empirical observations that language model performance improves predictably and
smoothly as a power-law function of compute, dataset size, and model parameters.

## The Core Finding
Loss (on a held-out test set) scales as:

```
L(N, D) ~ N^(-alpha) + D^(-beta) + irreducible_loss
```

Where:
- **N** = number of model parameters
- **D** = number of training tokens
- **alpha, beta** ≈ 0.07 (from Chinchilla)

Performance is predictable: doubling compute gives a consistent improvement in
loss, regardless of architecture details.

## Key Papers

### Kaplan et al. (2020) — OpenAI
Original neural scaling laws paper. Suggested: for a fixed compute budget,
scale up parameters more than data. Led to training very large models on
relatively few tokens.

### Chinchilla (Hoffmann et al., 2022) — DeepMind
Revisited Kaplan's findings. Key result: **previous large models were undertrained**.
Optimal allocation: ~**20 tokens per parameter**.
- GPT-3 (175B params): should have trained on ~3.5T tokens, not 300B
- Chinchilla (70B params) with 1.4T tokens outperformed larger models

Karpathy emphasizes this in his lecture — Chinchilla "recalibrated" how the
field thinks about the optimal compute allocation.

## Emergent Abilities
At certain scale thresholds, new capabilities appear discontinuously. Examples:
- In-context learning (few-shot prompting)
- Chain-of-thought reasoning
- Arithmetic and symbolic reasoning

Whether emergence is truly discontinuous or just a measurement artifact is
debated in the literature.

## Implications for Practice
- You can predict performance before training using scaling laws
- Under-training large models wastes compute
- "Inference-optimal" vs "training-optimal" are different regime choices

## Related
- [[Pretraining]], [[Fine-Tuning]], [[RLHF]], [[LLM OS]], [[Andrej Karpathy]]
