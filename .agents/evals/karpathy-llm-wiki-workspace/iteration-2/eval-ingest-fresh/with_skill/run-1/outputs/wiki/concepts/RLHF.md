---
title: "RLHF"
created: 2026-08-14
updated: 2026-08-14
type: concept
tags: [rlhf, alignment, training]
sources: ["Karpathy Intro to LLMs Talk"]
---

# RLHF

Reinforcement Learning from Human Feedback: stage 3 of the training pipeline.
Instead of giving the model ideal answers (as [[Fine-Tuning]] does), labelers
*compare* multiple model responses and mark which is better; training then
nudges the model toward the preferred outputs — a "carrot on a stick"
reward signal.

## How It Works

1. Sample several responses from the fine-tuned model.
2. Human labelers rank which response is better.
3. Learn a preference/reward signal from the rankings and optimize the model
   against it (the classic setup: reward model plus policy optimization).

## Why It Matters

- The main industrial lever for making [[Large Language Model]] assistants
  feel aligned: helpfulness, tone, following instructions, refusing harmful
  requests.
- Also the lever attackers push against: safety behavior installed by this
  kind of preference tuning is exactly what [[Jailbreaking]] tries to bypass
  — which is why alignment work is iterative and never finished.

## Related

- [[Fine-Tuning]]
- [[Large Language Model]]
- [[Jailbreaking]]
