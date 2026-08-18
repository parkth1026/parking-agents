---
title: "Fine-Tuning"
created: 2026-08-14
updated: 2026-08-14
type: concept
tags: [fine-tuning, training]
sources: ["Karpathy Intro to LLMs Talk"]
---

# Fine-Tuning

Stage 2 of LLM training: replace terabytes of raw text with a small,
high-quality, "assistant-like" dataset — typically on the order of 100k
curated prompt → ideal-response pairs — and keep training the base model on
it.

## How It Works

- Curators write ideal assistant answers in any format (poems, summaries,
  tables, SQL), producing Q&A-style training documents.
- Training is cheap relative to [[Pretraining]]: roughly a day of compute and
  hundreds of dollars, versus months and millions — see
  [[Pretraining vs Fine-Tuning]].
- Analogy from the talk: pretraining is cramming the textbook; fine-tuning is
  studying a small set of past exam questions. The model starts to *mimic*
  being an assistant — adopting helpful tone, admitting some limits, and
  refusing some harmful requests.
- [[RLHF]] is the follow-on stage that compares model outputs against each
  other and pushes the model toward preferred ones.

## Limits

Fine-tuning teaches the *style* of answering, not verified knowledge:
plausible-but-wrong answers persist ([[Hallucination]]). It is also how the
industry customizes one base model into many specialized assistants — the
same parameters, different question-answer data.

## Related

- [[Pretraining]]
- [[RLHF]]
- [[Karpathy Intro to LLMs Talk]]
