---
title: Fine-tuning
aliases: [SFT, RLHF, stage 2]
tags: [training]
source: Karpathy — "Intro to Large Language Models" (Nov 2023)
created: 2026-08-18
status: draft
---

# Fine-tuning

> **TL;DR:** Stage 2: continue training the base model on a small amount
> of high-quality, human-written assistant conversations, then
> optionally apply RL from human preferences and verification. Cheap
> relative to [Pretraining](pretraining.md) — and it is what turns an
> internet simulator into an assistant.

## Supervised fine-tuning (SFT)

- Collect **high-quality question/answer and conversation data** written
  by human labelers, in the exact assistant format
  (system/user/assistant turns).
- The dataset is tiny by pretraining standards — thousands of exchanges
  can be enough (the LIMA result: ~1000 carefully curated examples) —
  because it only needs to *re-shape behavior*, not teach knowledge.
- Karpathy's mental image: the model now "dreams" in the format of a
  helpful assistant conversation rather than raw internet pages.

## RLHF (RL from human feedback)

1. Sample multiple answers; labelers rank them.
2. Train a **reward model** to predict those rankings.
3. Fine-tune the LLM with reinforcement learning against the reward
   model.

## Verification for verifiable domains

Where correctness can be *checked* — math answers, code with tests —
the model can be trained against outcomes instead of human opinion.
This is cheaper, harder to game, and the main lever for reliable
[Tool Use](tool-use.md) in math and coding.

## How fine-tuning differs from pretraining in kind

| | Pretraining | Fine-tuning |
|---|---|---|
| Data | TBs of raw internet | thousands of curated conversations / comparisons |
| Cost | millions of dollars, GPU clusters | orders of magnitude cheaper |
| Product | base model (internet simulator) | assistant (chat model) |

## See also

- [Pretraining](pretraining.md) — stage 1
- [System Prompts](system-prompts.md) — conditioning behavior *at run time*
- [Emergent Capabilities](emergent-capabilities.md)
- [Jailbreaks](jailbreaks.md) — safety as learned, fallible behavior
