---
title: "Karpathy Intro to LLMs Talk"
created: 2026-08-14
updated: 2026-08-14
type: source
tags: [talk, tutorial]
sources: []
---

# Karpathy Intro to LLMs Talk

> **Speaker**: [[Andrej Karpathy]] | **Year**: 2023 | **Type**: Talk (~1 hour)
> **URL**: https://www.youtube.com/watch?v=zjkBMFhNj_g

The founding source of this wiki: a one-hour introductory talk that walks from
"what is an LLM" to where the field is heading. Ingested from viewer notes
(raw: `transcripts/2026-08-14-karpathy-intro-to-llms-talk.md`), not a verbatim
transcript.

## Key Takeaways

- An LLM is conceptually just two files: a parameters file (e.g. [[Llama 2]],
  on the order of 100B parameters) and a small program that runs the neural
  network. Training compresses chunks of internet text into those parameters.
- Training happens in stages: [[Pretraining]] on internet-scale text produces
  a base model; [[Fine-Tuning]] on a small high-quality Q&A set makes it
  assistant-like; [[RLHF]] then nudges it with human preference rankings.
- Capabilities are discovered, not programmed: richer [[Emergent Abilities]]
  appear as models scale, and specialization comes from fine-tuning rather
  than hand-coding features.
- LLMs have "psychology": their behavior is steered by [[System Prompt]]
  instructions and can be extended at inference time with [[Tool Use]].
- Security is unsolved: [[Jailbreaking]] and [[Prompt Injection]] exploit the
  same single text channel the model reasons in — expect a permanent arms
  race.
- Karpathy's forward vision is the [[LLM OS]]: the LLM as kernel, the context
  window as RAM, tools as peripherals.

## Concepts Introduced or Covered

- [[Large Language Model]] — the artifact itself: parameters plus a runner
- [[Next Token Prediction]] — the one training objective and inference loop
- [[Tokenization]] — text as token IDs, not characters
- [[Pretraining]] / [[Fine-Tuning]] / [[RLHF]] — the three-stage training pipeline
- [[Emergent Abilities]] — scale brings unplanned skills
- [[System Prompt]] / [[Tool Use]] — steering and extending the model at inference time
- [[Hallucination]] — models confabulate plausible but wrong content
- [[Jailbreaking]] / [[Prompt Injection]] — the attack surface
- [[LLM OS]] — the operating-system framing of the future
- [[Pretraining vs Fine-Tuning]] — side-by-side of the two training stages

## Critical Notes

- Ingested from the viewer's summary notes rather than a transcript; numbers
  (parameters, data size, cost) are approximate as quoted in the talk (late
  2023) and already dated.
- The talk predates the 2024-2026 wave of reasoning models and agentic
  products; treat its forecasts as a 2023 snapshot.

## Related

- [[Andrej Karpathy]]
- [[Large Language Model]]
- [[LLM OS]]
