---
title: Pretraining
tags: [training, pretraining, scaling, base-model]
status: seed
source: "Karpathy, 'Intro to Large Language Models' (2023)"
created: 2026-08-18
---

# Pretraining (stage 1: the internet document generator)

> Pretraining runs the trivial next-token objective over ~10 TB of internet
> text on a GPU cluster for weeks — and the result is a *simulator of the
> internet*, not an assistant.

## The recipe

- **Objective:** predict the next token (see
  [What Are LLMs?](what-are-llms.md)).
- **Data:** internet text — Wikipedia, papers, code, forums, Q&A sites.
- **Compute:** e.g., Llama 2 70B — thousands of GPUs running for weeks;
  Karpathy's rough estimate for a run like this is on the order of a few
  million dollars.
- Only large labs can afford this stage. Everything downstream of it is
  cheap by comparison.

## What you get: a base model

The pretrained ("base") model is an **internet document generator**. Give
it a prompt and it continues in the style of whatever internet document
the prompt resembles:

- Prompt with a Wikipedia-style opener → a plausible Wikipedia page
  (possibly about nothing real).
- Prompt with a question → often *more questions*, because the model is
  simulating a Q&A forum page, not answering you.

> Mental model: a base model is a **random internet text simulator**. It
> does not know it is being talked to.

## Why the base model is already powerful

Even before any fine-tuning, the base model has absorbed facts, grammar,
code patterns, and reasoning-like regularities from the data — and it can
be steered by examples placed in the prompt (in-context learning; see
[Emergent Capabilities at Scale](emergent-capabilities.md)).

## Next step

The "magic trick" that turns the simulator into an assistant happens in
[Fine-Tuning & RLHF](fine-tuning.md).

## See also

- [Fine-Tuning & RLHF](fine-tuning.md) — the second training stage
- [What Are LLMs?](what-are-llms.md) — the objective both stages share
- [Security Risks](security-risks.md) — training data as an attack surface

## References

- Andrej Karpathy,
  [*Intro to Large Language Models*](https://www.youtube.com/watch?v=zjkBMFhNj_g)
  (2023) — pretraining section and Llama 2 example.
