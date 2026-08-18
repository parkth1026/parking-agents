---
title: Pretraining
tags: [training, fundamentals]
status: draft
created: 2026-08-18
updated: 2026-08-18
source: "Andrej Karpathy, 'Intro to Large Language Models' (YouTube talk, ~1h, 2023), part 2"
---

# Pretraining

> Pretraining is stage 1 of building an LLM: train a neural network for
> next-token prediction on a massive chunk of the internet, for weeks on
> thousands of GPUs at a cost of millions of dollars. The result is a **base
> model** — a lossy simulation of the internet that completes documents
> plausibly but is not yet an assistant.

## The process

1. **Assemble data.** Download a very large sample of the internet — web
   pages, code, books, and similar text (on the order of ~10 TB in the talk's
   example).
2. **Train on next-token prediction.** Run the network over this corpus,
   repeatedly guessing the next token and adjusting its parameters to be less
   wrong (see [What are LLMs?](what-are-llms.md) for the objective).
3. **Pay the bill.** On the order of weeks of training, thousands of GPUs, and
   millions of dollars for frontier-scale models.

## What you get: the base model

The base model is best understood as a **simulation of (a chunk of) the
internet**. Feed it something internet-shaped and it continues in kind:

- Prompt it with a Wikipedia-style article title, and it "dreams" a
  plausible-looking Wikipedia article — right shape and tone, often partially
  fabricated (an immediate instance of the lossy-compression /
  hallucination story from [What are LLMs?](what-are-llms.md)).
- Ask it a question, and it may respond with *more questions* — because on the
  internet, a question is often followed by other questions (FAQ pages, forum
  threads). It completes documents; it does not yet take direction.

Turning it into something that answers is the job of
[Fine-tuning](fine-tuning.md).

## Emergence during this stage

Loss on next-token prediction falls smoothly and predictably with model size,
data, and compute, and concrete skills appear at thresholds along the way —
see [Emergent capabilities](emergent-capabilities.md).

## Cost asymmetry

Pretraining is the expensive step. Everything afterward (fine-tuning, prompt
engineering) is orders of magnitude cheaper, which is why a few organizations
pretrain foundation models while everyone else builds on top of them.

## Security note

The training corpus is the open internet, and anyone can publish to it.
Attackers can plant text hoping it gets absorbed into future models (data
poisoning) — the ingestion side of the story continued in
[Jailbreaks](jailbreaks.md) and [Prompt injection](prompt-injection.md).

## Open questions

- What is the optimal data mix (code vs. prose vs. books) for a given model size?
- How do memorization and generalization trade off as data and parameters scale?

## See also

- [Fine-tuning](fine-tuning.md) — stage 2, from simulation to assistant.
- [What are LLMs?](what-are-llms.md) — the objective being optimized here.
- [Emergent capabilities](emergent-capabilities.md) — what falls out of scale.
- [LLM OS](llm-os.md) — where the base-model "kernel" is heading.

## References

- Andrej Karpathy, "Intro to Large Language Models" (YouTube talk, ~1h, 2023) — part 2: pretraining data, compute cost, base-model behavior.
