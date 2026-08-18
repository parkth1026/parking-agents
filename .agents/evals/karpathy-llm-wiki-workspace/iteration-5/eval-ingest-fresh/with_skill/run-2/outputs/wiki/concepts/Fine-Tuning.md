---
title: "Fine-Tuning"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [fine-tuning, training]
sources: ["Intro to Large Language Models (talk)"]
---

# Fine-Tuning

Stage two of building an LLM assistant: take the base model produced by
[[Pretraining]] and continue training it on a small, curated, human-labeled
dataset of high-quality conversations and question-answer pairs. The model
"morphs" from an internet document simulator into an assistant that
answers questions directly.

## How It Works

- Contractors write or rate ideal assistant responses; the model keeps
  training on this data with the same [[Next Token Prediction]] objective.
- The dataset is tiny relative to pretraining — tens of thousands of
  exchanges, or even ~1,000 in the LIMA-style argument — but it is enough
  to change the model's default behavior, because it reuses the knowledge
  already baked in during [[Pretraining]].
- Further preference tuning (RLHF and friends) shapes tone and safety
  beyond imitation learning.
- Safety fine-tuning is also the main defense against [[Jailbreaking]]:
  the model is trained to refuse harmful requests.

## Failure Mode: Hallucination

A fine-tuned assistant confidently completes answers even when it lacks the
knowledge — it "doesn't know what it doesn't know", because it was trained
to produce plausible assistant-style text, not calibrated knowledge.
Mitigations point outward: retrieval or search over real documents, letting
the model consult tools ([[Tool Use]]), and prompts that reward saying "I
don't know".

## History

The two-stage recipe (pretrain broadly, then adapt cheaply) descends from
transfer learning; ChatGPT popularized its assistant instantiation at scale
in 2022.

## Related

- [[Pretraining]]
- [[Large Language Model]]
- [[Tool Use]]
- [[Jailbreaking]]
