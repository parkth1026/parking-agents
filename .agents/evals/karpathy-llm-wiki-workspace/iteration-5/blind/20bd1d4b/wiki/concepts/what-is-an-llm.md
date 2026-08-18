---
title: What is an LLM
aliases: [Large Language Model, LLM, next-token prediction]
tags: [foundations, core]
source: Karpathy — "Intro to Large Language Models" (Nov 2023)
created: 2026-08-18
status: draft
---

# What is an LLM

> **TL;DR:** A large language model is a neural network trained to
> predict the next token of internet text. What you ship is just two
> files — a parameters file and the code that runs it — and sampling from
> it makes the model generate ("dream") plausible internet-style
> documents.

## The two-file picture

Karpathy's framing: an LLM, for all its mystique, is two files:

- **Parameters (weights).** A large pile of floating-point numbers. A
  70-billion-parameter model stored in fp16 is roughly **140 GB** — it
  fits on a laptop, though it runs slowly there.
- **The code that runs them.** The network's forward pass is simple
  enough that an inference engine of a few hundred lines of C (cf.
  `llama2.c`) suffices.

Training is what produces the parameters; the run file does not change
afterwards.

## What the network actually does

1. Text is chopped into [tokens](tokens.md) — sub-word units from a
   fixed vocabulary.
2. The tokens are fed into the network, which outputs a probability
   distribution over the vocabulary for the *next* token.
3. A token is sampled from that distribution and appended to the
   sequence; repeat.

That single, mechanical objective — **next-token prediction** — is the
entire training objective. Everything else the model appears to do is a
consequence of getting very good at it at scale.

## A compressed internet

During [pretraining](pretraining.md) the model compresses a large,
filtered chunk of the internet into its weights. Run the process in
reverse and sampling from the model *decompresses*: it generates
documents that look like the internet. This is why Karpathy describes a
raw LLM as a **simulator of the internet** that "dreams" documents —
plausible-looking but fabricated Wikipedia pages, forum threads, and so
on (see [Hallucinations](hallucinations.md)).

A base model is therefore **not an assistant**. Turning it into one is a
separate training stage — [Fine-tuning](fine-tuning.md).

## Why this framing matters

- **Demystification.** There is no database inside and no lookup of
  stored answers — only parameters tuned to continue text.
- **Portability.** The two-file property is why local, offline inference
  is possible at all.
- **Composition.** The LLM-as-a-computer view scales up naturally into
  the [LLM OS](llm-os.md) analogy.

## See also

- [Tokens](tokens.md) — what is actually being predicted
- [Pretraining](pretraining.md) — where the parameters come from
- [Fine-tuning](fine-tuning.md) — how an internet simulator becomes an assistant
- [Hallucinations](hallucinations.md) — why dreaming causes confabulation
- [LLM OS](llm-os.md) — the operating-system extension of this framing
