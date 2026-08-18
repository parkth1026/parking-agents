# Fine-tuning and alignment

> **Source:** Karpathy, *Intro to Large Language Models* (2023) · **Status:** initial ingest · [Home](home.md)

**Summary:** Fine-tuning is stage 2: take a base model and train it — cheaply — on a small set of high-quality assistant-style conversations, then optionally sharpen it with RLHF. The output is an assistant like ChatGPT. Recipe: ChatGPT ≈ pretraining + fine-tuning (+ RLHF).

## Stage 2a: supervised fine-tuning

- Collect a much smaller, **high-quality** dataset of prompt → ideal-response pairs — Karpathy's figure was on the order of ~100k curated examples (often written or reviewed by hired labelers).
- Train the base model on these for **days to weeks** — trivial compute compared to [pretraining](pretraining.md).
- Result: the model stops "continuing the internet" and starts answering as an assistant. Same network, same objective; different, much cleaner data distribution.

## Stage 2b: RLHF (reinforcement learning from human feedback)

A second refinement pass that makes answers more reliably good:

1. Humans **compare** candidate answers for the same prompt ("which response is better?").
2. Train a **reward model** — a second neural network that scores how good a response looks to those human raters.
3. Use the reward model as a training signal to nudge the LLM toward preferred answers (policy-gradient style optimization).

Karpathy's framing: this is where the assistant's "personality" and helpfulness get locked in, and where a lot of the perceived quality jump between a base model and a product comes from.

## Pretraining vs fine-tuning at a glance

| | [Pretraining](pretraining.md) | Fine-tuning |
|---|---|---|
| Data | ~TB of raw internet | ~100k curated Q&A pairs (+ comparisons) |
| Duration / cost | weeks–months, ~millions of dollars | days–weeks, thousands of dollars |
| Output | base model (internet simulator) | assistant (ChatGPT-style) |
| Analogy | reading all the textbooks | studying for the exam |

## Fine-tuned does not mean truthful

- A fine-tuned assistant still **hallucinates**: it will improvise plausible-sounding but made-up content, because it is fundamentally generating likely continuations, not looking up facts. Karpathy's analogy: reciting from memory vs. **jazz improvisation** — under pressure to produce an answer, the model improvises one rather than expressing uncertainty.
- Mitigations live outside the weights: [tool use](tool-use.md) (letting the model look things up) and careful prompting via [system prompts](system-prompts.md).
- Fine-tuning also does not make the model safe by construction — see [Jailbreaks](jailbreaks.md) and [Prompt injection](prompt-injection.md).

## Related

- [Pretraining](pretraining.md) — stage 1.
- [Scaling and emergence](scaling-and-emergence.md) — what the resulting models can and can't do.
- [Glossary](glossary.md) — RLHF, reward model, alignment, hallucination.
