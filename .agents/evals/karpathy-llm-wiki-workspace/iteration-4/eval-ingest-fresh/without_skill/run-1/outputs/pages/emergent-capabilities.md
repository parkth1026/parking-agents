---
title: Emergent capabilities
tags: [capabilities, scaling]
status: draft
created: 2026-08-18
updated: 2026-08-18
source: "Andrej Karpathy, 'Intro to Large Language Models' (YouTube talk, ~1h, 2023)"
---

# Emergent capabilities

> As LLMs are scaled up (more parameters, more data, more compute), overall
> next-token prediction loss improves smoothly — but specific concrete skills
> appear *abruptly*: small models sit near chance, and past some size the
> capability switches on. These threshold-like jumps are called emergent
> capabilities.

## Key ideas

- **Scaling laws.** Training loss falls in a predictable way as you increase
  model size, data, and compute. Scaling is a reliable dial, not a lottery
  (see [Pretraining](pretraining.md)).
- **Emergence.** On many concrete tasks, accuracy is flat at chance for small
  models and jumps sharply beyond a threshold. Graphs in the talk (accuracy
  vs. model size, in the style of the emergent-abilities literature) show this
  for tasks like multi-digit arithmetic and word unscrambling.
- **In-context learning.** A related superpower: with *no weight updates*, a
  model can pick up a task from a handful of examples placed in the prompt.
  Base models can be "programmed" this way — the precursor to prompting as a
  discipline.

## Why it matters

- It explains why labs chase scale: pretraining keeps paying off by just
  spending more compute, and new abilities arrive as a side effect.
- It is a key driver of the [LLM OS](llm-os.md) vision — if capabilities keep
  switching on with scale, the "CPU" keeps getting better without being
  redesigned.

## Caveats

- Emergence is partly a property of the *measurement*: sharp thresholds can be
  artifacts of exact-match or discrete metrics rather than genuine cliffs in
  the underlying model.
- Which capability will emerge at the next scale-up is not cleanly predictable
  in advance — capability forecasting is still guesswork plus scaling curves.

## Open questions

- Which reported emergent abilities survive smoother metrics?
- Does in-context learning scale qualitatively differently from weight-based
  learning?

## See also

- [Pretraining](pretraining.md) — the process whose scaling produces this.
- [What are LLMs?](what-are-llms.md) — the objective whose loss is being scaled.
- [LLM OS](llm-os.md) — the future built on continued scaling.
- [Tool use](tool-use.md) — capabilities extended beyond text generation.

## References

- Andrej Karpathy, "Intro to Large Language Models" (YouTube talk, ~1h, 2023) — scaling graphs and in-context learning discussion.
