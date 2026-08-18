# Pretraining

> **Source:** Karpathy, *Intro to Large Language Models* (2023) · **Status:** initial ingest · [Home](home.md)

**Summary:** Pretraining is stage 1 of building an LLM: take on the order of terabytes of internet text, train a large network to predict the next token over all of it for weeks to months on a GPU cluster, and end up with a **base model** — a simulator of internet documents, not yet an assistant.

## The recipe

1. **Get data.** Download a large fraction of the internet — on the order of ~10 TB of text after collecting and filtering (web pages, books, code, forums…).
2. **Train.** Run the next-token-prediction loop (see [What is an LLM?](what-is-an-llm.md)) over this dataset. This runs on serious GPU clusters for **weeks to months** and costs **on the order of millions of dollars** (Llama 2 was Karpathy's example of an open run at this scale).
3. **Output: a base model.** The network that emerges is a compressed, probabilistic model of "what the internet is like."

A good way to phrase it: pretraining performs a **lossy compression of the internet into the parameters**. The model does not store the web; it internalizes its statistics.

## What a base model is (and is not)

- A base model is an **internet document generator**. Prompt it and it continues in the style of whatever internet text the prompt resembles.
- It is **not an assistant.** Ask it a question and it may just continue with more questions, or drift into unrelated web-like text — because that is what internet documents do. Karpathy's image: using a base model is like being a "token astronaut" drifting through web space — interesting, but it won't answer you reliably.
- Becoming something you can talk to requires **stage 2**: [Fine-tuning](fine-tuning.md).

## The textbook analogy

Karpathy's analogy for the two stages of training:

- **Pretraining = reading all the textbooks.** Broad, expensive, unsupervised, done once.
- **Fine-tuning = studying for the exam.** Narrow, cheap, focused on the format you'll actually be tested in (question → helpful answer).

See [Fine-tuning](fine-tuning.md) for the second half.

## Why pretraining dominates the cost

- Almost all compute in building an LLM goes here — data volume and training time are orders of magnitude larger than stage 2.
- Consequently there are few serious pretraining runs in the world (each costs millions), but *many* fine-tunes can piggyback on each base model. This asymmetry is a big part of the modern open-weights ecosystem.

## Related

- [What is an LLM?](what-is-an-llm.md) — the objective being trained.
- [Fine-tuning](fine-tuning.md) — stage 2.
- [Scaling and emergence](scaling-and-emergence.md) — why spending more here keeps paying off.
- [Glossary](glossary.md) — base model, pretraining, lossy compression.
