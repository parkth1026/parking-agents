---
title: Fine-Tuning & RLHF
tags: [training, fine-tuning, sft, rlhf, hallucination]
status: seed
source: "Karpathy, 'Intro to Large Language Models' (2023)"
created: 2026-08-18
---

# Fine-Tuning & RLHF (stage 2: from simulator to assistant)

> The magic trick: keep the same next-token machinery, swap the training
> data from "the internet" to a small, high-quality set of
> question→answer examples — and the internet simulator becomes an
> assistant.

## Supervised fine-tuning (SFT)

- Assemble a much smaller dataset (on the order of thousands up to ~100k
  examples) of high-quality prompt→response pairs, written by a labeling
  team working from detailed guidelines.
- Continue training the base model on it. Architecture and objective are
  unchanged — only the data distribution differs.
- Result: the model now interprets its input as a *task* and tries to
  help, instead of continuing a random internet document.

## RLHF: learning from preferences

1. Ask the model for several candidate answers.
2. Humans **rank** the candidates (easier and more reliable than writing
   answers from scratch).
3. Train a **reward model** to predict those rankings.
4. Fine-tune the LLM with reinforcement learning to maximize the reward.

## Verification is the bottleneck

- Some tasks are easy to verify: code can be executed and tested, math can
  be checked. These tasks are the easiest to improve.
- Many other things (facts, taste, judgment) are hard to verify — human
  raters get tired and disagree — so progress there is slower.

## Hallucination: why models make things up

Karpathy's explanation:

- Pretraining data is human text, and humans *always answer*. There is
  almost no "I don't know" in internet text, so the model never learned to
  say it.
- The model would rather produce a plausible-sounding answer than abstain.
  This is a property inherited from the data, not a random bug.
- RLHF reduces hallucination (the reward model penalizes made-up answers),
  but does not eliminate it — architecturally nothing forces truthfulness.

## See also

- [Pretraining](pretraining.md) — what fine-tuning starts from
- [Security Risks](security-risks.md) — fine-tuning data is an attack
  surface (data poisoning)
- [Emergent Capabilities at Scale](emergent-capabilities.md) — what the
  assistant stage builds on

## References

- Andrej Karpathy,
  [*Intro to Large Language Models*](https://www.youtube.com/watch?v=zjkBMFhNj_g)
  (2023) — fine-tuning, RLHF, and hallucination sections.
