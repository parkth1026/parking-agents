---
title: Home
source: "Andrej Karpathy — Intro to Large Language Models (Nov 2023)"
category: index
tags: [index, home]
created: 2026-08-14
status: seed
---

# LLM Wiki

A knowledge base of large language model concepts, seeded from Andrej
Karpathy's talk **"Intro to Large Language Models"** (November 2023).

- Raw talk notes: [`../wiki-raw/karpathy-intro-to-llms/talk-notes.md`](../wiki-raw/karpathy-intro-to-llms/talk-notes.md)
- Ingestion record (provenance and caveats): [`../wiki-raw/karpathy-intro-to-llms/ingestion-log.md`](../wiki-raw/karpathy-intro-to-llms/ingestion-log.md)

## Map of the wiki

### Fundamentals — what an LLM is
- [What is an LLM?](fundamentals/What-is-an-LLM.md) — two files: parameters + internet data
- [Next-Token Prediction](fundamentals/Next-Token-Prediction.md) — the one training objective
- [Tokens and Context Window](fundamentals/Tokens-and-Context-Window.md) — the working memory of a model

### Training — how models are built
- [Training Process](training/Training-Process.md) — overview: pretraining, then fine-tuning
- [Pretraining](training/Pretraining.md) — months of GPU time on internet text
- [Fine-Tuning](training/Fine-Tuning.md) — turning a base model into an assistant
- [RLHF](training/RLHF.md) — optimizing against human preferences

### Capabilities — what models can and cannot do
- [Scaling](capabilities/Scaling.md) — performance grows with size, data, and compute
- [Emergent Capabilities](capabilities/Emergent-Capabilities.md) — abilities that appear unpredictably with scale
- [Hallucinations](capabilities/Hallucinations.md) — confident fabrication, and how to counter it

### Usage — working with models
- [System Prompts](usage/System-Prompts.md) — invisible instructions that configure behavior
- [Tool Use](usage/Tool-Use.md) — browsing, calculators, code execution

### Security — risks
- [Adversarial Prompts](security/Adversarial-Prompts.md) — jailbreaks and prompt injection
- [Data Poisoning](security/Data-Poisoning.md) — attacks baked into training data

### Future — where this is going
- [LLM OS](future/LLM-OS.md) — the model as the kernel of a new computing platform

## Conventions

- Every page has YAML frontmatter: `title`, `category`, `tags`, `created`,
  `status`. `status: seed` marks pages from the initial ingestion that are
  expected to grow as more sources are ingested.
- Pages cross-link with relative Markdown links.
- Framings and claims inherited from the talk are written as such; when a
  page later gains other sources, note them on the page itself.

## Known gaps (candidates for future ingestion)

- Evaluation methodology for emergent capabilities
- Concrete mitigations for prompt injection beyond the talk's overview
- Post-2023 developments (the talk is currently the sole source)
