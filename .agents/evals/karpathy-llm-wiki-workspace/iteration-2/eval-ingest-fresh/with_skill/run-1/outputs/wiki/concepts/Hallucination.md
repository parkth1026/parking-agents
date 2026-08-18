---
title: "Hallucination"
created: 2026-08-14
updated: 2026-08-14
type: concept
tags: [safety, evaluation]
sources: ["Karpathy Intro to LLMs Talk"]
---

# Hallucination

LLMs sometimes answer with fluent, confident, entirely made-up content —
invented citations, plausible-but-fake API calls, wrong historical "facts".
The model will often produce something plausible rather than say "I don't
know", because plausibility — not truth — is what [[Next Token Prediction]]
optimizes.

## Why It Happens

- Root cause: the training objective rewards *plausible next tokens*, and
  plausible text is not necessarily true text.
- [[Fine-Tuning]] teaches the *format* of a knowledgeable assistant, which
  can make confabulation more convincing: the model imitates confident
  answers even where it has no underlying knowledge.
- Ask for something outside the training distribution (a niche citation, a
  little-known fact) and the most probable continuation is a made-up but
  plausible one.

## Mitigations

- Grounding via [[Tool Use]] (browsing, retrieval) so answers come from real
  sources instead of parameters alone.
- Treat output as a draft to verify — especially citations, names, and
  numbers. A key practical takeaway for using [[Large Language Model]]
  systems responsibly.

## Related

- [[Next Token Prediction]]
- [[Tool Use]]
- [[Karpathy Intro to LLMs Talk]]
