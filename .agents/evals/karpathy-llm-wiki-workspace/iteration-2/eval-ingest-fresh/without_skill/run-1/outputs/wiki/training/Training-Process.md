---
title: Training Process
source: "Andrej Karpathy — Intro to Large Language Models (Nov 2023)"
category: training
tags: [training, overview, pipeline]
created: 2026-08-14
status: seed
---

# Training Process

Building an LLM is a **two-stage pipeline** (with an optional third stage),
as laid out in the talk:

1. **[Pretraining](Pretraining.md)** — learn language, facts, and skills from
   internet-scale text via [next-token prediction](../fundamentals/Next-Token-Prediction.md).
   Produces a **base model**.
2. **[Fine-Tuning](Fine-Tuning.md)** — continue training on a small,
   high-quality dataset of ideal assistant responses. Produces an
   **assistant model**.
3. *(Optional)* **[RLHF](RLHF.md)** — optimize against human preferences.

## Side-by-side comparison

| | Pretraining | Fine-tuning |
|---|---|---|
| Data | Terabytes of internet text | Thousands of curated Q/A examples |
| Cost | Months of GPU clusters, millions of dollars | Cheap, hours to days |
| Who does it | A handful of organizations worldwide | Many teams, cheap to repeat |
| Result | Base model (document simulator) | Assistant model |

## Key points from the talk

- The heavy lifting — acquiring knowledge — happens in **pretraining**.
- Fine-tuning mostly shapes *format and behavior*; it does not meaningfully
  add knowledge (and pushing facts through fine-tuning encourages
  [hallucinations](../capabilities/Hallucinations.md)).
- "Training" in everyday usage usually refers to the full pipeline, but the
  stages are distinct steps with very different economics.

## Related

- [Pretraining](Pretraining.md)
- [Fine-Tuning](Fine-Tuning.md)
- [RLHF](RLHF.md)
- [What is an LLM?](../fundamentals/What-is-an-LLM.md)
