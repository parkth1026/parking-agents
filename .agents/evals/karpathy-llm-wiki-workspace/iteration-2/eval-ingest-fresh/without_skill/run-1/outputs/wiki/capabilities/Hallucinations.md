---
title: Hallucinations
source: "Andrej Karpathy — Intro to Large Language Models (Nov 2023)"
category: capabilities
tags: [hallucination, failure-modes, verification]
created: 2026-08-14
status: seed
---

# Hallucinations

## What they are

LLM assistants sometimes **state falsehoods fluently and confidently**,
inventing facts, citations, or API functions that do not exist. Karpathy
covers this as a defining limitation of the technology.

## Why they happen

- The model is trained for [plausible next tokens](../fundamentals/Next-Token-Prediction.md),
  not for verified truth. Plausible-sounding wrong answers are exactly what
  the objective rewards when knowledge is missing.
- [Fine-tuning](../training/Fine-Tuning.md) teaches the assistant to always
  produce a helpful answer — it rarely learns to say "I don't know," because
  ideal transcripts rarely do.
- The model's sense of its own knowledge boundary is blurry: it does not
  reliably know what it does not know.

## Mitigations

- **Verify** important outputs before relying on them (the talk's practical
  advice).
- Use [tool use](../usage/Tool-Use.md) — browsing, retrieval, calculators —
  so facts and arithmetic come from outside the model instead of generation.
- Prefer models and settings that admit uncertainty; treat generated
  citations and numbers as drafts, not truth.

## Related

- [Next-Token Prediction](../fundamentals/Next-Token-Prediction.md)
- [Fine-Tuning](../training/Fine-Tuning.md)
- [Tool Use](../usage/Tool-Use.md)
- [Adversarial Prompts](../security/Adversarial-Prompts.md)
