---
title: "Intro to Large Language Models (talk)"
created: 2026-08-18
updated: 2026-08-18
type: source
tags: [talk, language-model, training, safety]
sources: []
---

# Intro to Large Language Models (talk)

> **Speaker**: Andrej Karpathy | **Year**: 2023 | **Type**: Talk (~1hr)
> **URL**: https://www.youtube.com/watch?v=zjkBMFhNj_g (reconstructed from memory — user did not supply a URL; verify before citing)
> **Raw source**: `wiki-raw/transcripts/2026-08-18-karpathy-intro-to-llms.md`

A widely watched one-hour introduction to how large language models work, how
they are trained, what they can do, how they can be attacked, and where the
ecosystem is heading. This wiki's first ingested source.

## Key Takeaways

- An LLM is, deliberately provocatively, "just two files": a parameters file
  (the trained weights) plus a few hundred lines of code that run them.
  Training compresses a large slice of internet text into those parameters
  using nothing but [[Next Token Prediction]].
- Training happens in two stages: [[Pretraining]] on internet-scale text
  produces a base model that behaves like an "internet document simulator";
  [[Fine-Tuning]] on small, curated, human-labeled conversation data morphs
  it into a helpful assistant.
- Capabilities are emergent: as models and datasets scale, abilities such as
  in-context learning and multi-step reasoning appear without being explicitly
  programmed ([[Emergent Abilities]]).
- Shipping an assistant adds scaffolding around the raw model: a
  [[System Prompt]] that conditions behavior, and [[Tool Use]] such as
  browsing, calculators, and code execution.
- Security is a first-class concern: [[Jailbreaking]] (adversarial users
  attacking the model) and [[Prompt Injection]] (adversarial data attacking
  the model through the content it reads) are open problems.
- The ecosystem is converging on an operating-system metaphor — the
  [[LLM OS]] — with the model as kernel, context window as working memory,
  and tools as peripherals.

## Concepts Introduced or Covered

- [[Large Language Model]] — what an LLM actually is: parameters plus next-token prediction over internet text
- [[Next Token Prediction]] — the single training objective that yields broad world knowledge
- [[Pretraining]] and [[Fine-Tuning]] — the two-stage training pipeline
- [[Emergent Abilities]] — capabilities that appear only past scale thresholds
- [[Tool Use]] and [[System Prompt]] — how a base model becomes a product assistant
- [[Jailbreaking]] and [[Prompt Injection]] — the instructions-vs-data trust problem
- [[LLM OS]] — the operating-system framing of the emerging LLM ecosystem
- [[Andrej Karpathy]] — the speaker

## Notable Quotes

Omitted: no verbatim transcript was supplied at ingestion time, so quotes
cannot be verified against the raw source (see Critical Notes).

## Critical Notes

- Ingested in batch mode from a user-provided topic summary, not a verbatim
  transcript. The wiki pages reconstruct the talk's well-known framing on top
  of that outline; specific figures (GPU counts, dollar costs) are hedged to
  order-of-magnitude and should be verified against the video before being
  cited elsewhere.
- The URL in the header was reconstructed from memory, not supplied by the
  user.
