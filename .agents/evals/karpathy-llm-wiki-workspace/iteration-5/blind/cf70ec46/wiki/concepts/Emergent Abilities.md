---
title: "Emergent Abilities"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [emergent-abilities, scaling-laws]
sources: ["Intro to Large Language Models (talk)"]
---

# Emergent Abilities

Capabilities of a [[Large Language Model]] that were never explicitly
programmed and that appear only once the model — data and compute — passes a
scale threshold. Below the threshold, performance looks like noise; above
it, the ability snaps into existence, almost like a phase transition.

## How It Works

- [[Pretraining]] optimizes [[Next Token Prediction]] and nothing else; yet
  multi-step reasoning, arithmetic, translation, and tool-calling behavior
  arise as side effects of scale.
- Classic example: in-context learning (few-shot prompting), showcased by
  GPT-3 — the model performs a task from examples placed in the prompt,
  with no weight updates.
- Capability-vs-scale curves are jagged and hard to predict: a model can
  suddenly gain an ability between two checkpoints, which is why scaling
  research tries to forecast what the next model will be able to do.

## Variants

- Few-shot / in-context learning (GPT-3 era).
- Chain-of-thought style multi-step reasoning emerging at larger scale.
- Tool-calling behavior that later gets refined in [[Fine-Tuning]] and
  productized as [[Tool Use]].

## History

Scaling laws (loss falls predictably with compute/data/parameters) set the
expectation that *quality* would improve smoothly; the surprise was that
*qualitatively new* abilities show up discontinuously. This tension —
predictable loss, unpredictable skills — is a running theme in LLM research
and one motivation for the [[LLM OS]] bet that models keep absorbing more
of the stack.

## Related

- [[Large Language Model]]
- [[Pretraining]]
- [[LLM OS]]
