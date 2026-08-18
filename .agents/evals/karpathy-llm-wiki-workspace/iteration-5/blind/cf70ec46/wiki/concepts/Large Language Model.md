---
title: "Large Language Model"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [language-model, core-concept, architecture]
sources: ["Intro to Large Language Models (talk)"]
---

# Large Language Model

A neural network — today almost always a Transformer — trained on
internet-scale text with a single objective: predict the next token. Once
trained, an LLM is, in [[Andrej Karpathy]]'s deliberately provocative
framing, "just two files": a parameters file (the weights) and a few hundred
lines of code that run them.

## How It Works

- **Parameters.** The knowledge of the model lives in its weights. Modern
  open-weight base models range from a few billion to a few hundred billion
  parameters; a ~70B-parameter model stored in 16-bit floats is on the order
  of ~140GB.
- **Training.** A large slice of the internet (web pages, books, code —
  code is treated as just more text) is compressed into those parameters by
  gradient descent on [[Next Token Prediction]]. Runs of this class cost on
  the order of millions of dollars over weeks on thousands of GPUs.
- **Inference.** Running the model is a loop: feed text in, get a
  probability distribution over the vocabulary, sample a token, append,
  repeat.

## From Base Model to Assistant

What comes out of training is not a chat assistant — that requires the
two-stage pipeline described in [[Pretraining]] and [[Fine-Tuning]] — plus,
at deployment time, scaffolding like a [[System Prompt]] and [[Tool Use]].

## History

The Transformer architecture (2017) enabled scaling; GPT-3 (2020) showed
few-shot behavior at scale; ChatGPT (2022) packaged the fine-tuned
assistant form factor for the public. Scaling also unlocked abilities that
were never explicitly programmed — see [[Emergent Abilities]].

## Related

- [[Next Token Prediction]]
- [[Pretraining]]
- [[Fine-Tuning]]
- [[Emergent Abilities]]
- [[LLM OS]]
