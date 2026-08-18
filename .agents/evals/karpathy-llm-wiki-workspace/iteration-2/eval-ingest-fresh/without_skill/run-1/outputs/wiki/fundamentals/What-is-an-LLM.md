---
title: What is an LLM?
source: "Andrej Karpathy — Intro to Large Language Models (Nov 2023)"
category: fundamentals
tags: [llm, definition, parameters, compression]
created: 2026-08-14
status: seed
---

# What is an LLM?

Karpathy's framing in the talk: a large language model is "just two things."

1. A **neural network** — a large stack of transformer layers whose behavior
   is fully described by its **parameters (weights)**. For a model like
   Llama 2 base 70B this is a file of roughly 40 GB.
2. **Training data** — a large slice of internet text, on the order of
   terabytes (e.g. a filtered Common Crawl dump).

Everything the model "knows" comes from running a single objective —
[next-token prediction](Next-Token-Prediction.md) — over that corpus. See
[Training Process](../training/Training-Process.md).

## A lossy compression of the internet

Mental model from the talk: the parameters file is like a **lossy, compressed
snapshot of the internet** — a "zip file of the internet." Because a finite
number of parameters must account for a huge corpus, the network is forced to
store the *regularities* of the data rather than memorize it, which is why it
generalizes.

## Dreaming internet documents

Sample from a **base model** (pretraining only) and it "dreams" internet
documents: a random web page here, a Stack Overflow answer there. A base
model is a **document simulator, not an assistant**. The assistant behavior
you see in chat products comes from the later
[fine-tuning](../training/Fine-Tuning.md) stage.

## Model vs product

- **Base model**: document simulator, straight out of
  [pretraining](../training/Pretraining.md).
- **Assistant model**: base model + [fine-tuning](../training/Fine-Tuning.md)
  (and often [RLHF](../training/RLHF.md)).
- **Product**: assistant model + [system prompt](../usage/System-Prompts.md),
  [tools](../usage/Tool-Use.md), UI, and safety mitigations.

## Related

- [Next-Token Prediction](Next-Token-Prediction.md) — the single training objective
- [Tokens and Context Window](Tokens-and-Context-Window.md)
- [Training Process](../training/Training-Process.md)
- [Scaling](../capabilities/Scaling.md)
