---
title: RLHF
source: "Andrej Karpathy — Intro to Large Language Models (Nov 2023)"
category: training
tags: [rlhf, reward-model, preferences, alignment]
created: 2026-08-14
status: seed
---

# RLHF (Reinforcement Learning from Human Feedback)

The optional third stage of the [training process](Training-Process.md),
mentioned in the talk as an extension of [fine-tuning](Fine-Tuning.md).

## The recipe

1. **Collect comparisons**: show labelers several candidate answers from the
   model and have them rank which response is better.
2. **Train a reward model**: a model that learns to predict which answers
   humans prefer.
3. **Optimize the LLM** against that reward model using reinforcement
   learning.

## Why it exists

Imitation (fine-tuning) only teaches the model to copy ideal transcripts.
RLHF lets the model improve *beyond* what labelers can write, by optimizing
toward what people actually prefer — smoother, more helpful, better-behaved
outputs.

## Caveats

- It is a preference signal, not a truth signal — models can learn to sound
  confident and pleasing, which can amplify
  [hallucinations](../capabilities/Hallucinations.md) if not careful.
- Reward-model quality bounds the final behavior.

## Related

- [Fine-Tuning](Fine-Tuning.md)
- [Training Process](Training-Process.md)
- [Hallucinations](../capabilities/Hallucinations.md)
