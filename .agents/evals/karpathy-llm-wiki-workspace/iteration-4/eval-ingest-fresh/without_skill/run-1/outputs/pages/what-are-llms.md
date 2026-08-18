---
title: What are LLMs?
tags: [fundamentals, llm]
status: draft
created: 2026-08-18
updated: 2026-08-18
source: "Andrej Karpathy, 'Intro to Large Language Models' (YouTube talk, ~1h, 2023), part 1"
---

# What are LLMs?

> A large language model is "just" a neural network (in practice, a
> Transformer) trained on a large chunk of internet text to do one thing:
> predict the next token. Everything an LLM appears to "know" is stored
> statistically in its parameters as a byproduct of that training objective.

## Key ideas

- **One sentence definition.** An LLM is a kind of neural network trained on a
  lot of text (a chunk of the internet) to predict the next token. That's the
  entire training objective.
- **What it physically is.** Two artifacts: a file of *parameters* (the
  weights) and a small program that runs them. Karpathy's example: Llama 2 70B
  is roughly 140 GB of numbers (fp16), and inference can be driven by a few
  hundred lines of code. The "secret sauce" is entirely in the parameters,
  which come from training — see [Pretraining](pretraining.md).
- **Tokens.** Text is chopped into tokens (pieces of words). Given a sequence
  of tokens, the model outputs a probability distribution over the next token;
  generation samples from that distribution.
- **Autoregressive loop.** Inference feeds the prompt in, predicts one token,
  appends it, and repeats. Chatting with a model is just this loop applied to
  your conversation.
- **Internet text as training data.** The corpus is a huge sample of the
  internet — web pages, code, books, forums. Whoever can write to the internet
  can (indirectly) influence what the model absorbs.

## Why next-token prediction is deep

Predicting the next token *well* requires modeling whatever produced the text:
grammar, facts about the world, code semantics, human goals and styles. So
training a network to lower next-token prediction loss on internet text forces
it to implicitly encode a great deal about the world. The apparently trivial
objective ("guess the next word") is what makes the whole approach work.

## The lossy compression view

The parameters can be thought of as a **lossy compression of the internet**.
Two consequences follow:

1. **Knowledge is statistical, not lookup.** The model doesn't have a database
   inside; it has tendencies shaped by what was common in training data.
2. **Hallucination.** Asked about something thinly covered in training data,
   the model still confidently generates plausible-sounding but wrong text —
   it is completing text, not consulting a record. In the talk, Karpathy asks
   an LLM about himself and gets a fluent, entirely made-up biography.

See [Fine-tuning](fine-tuning.md) for how some of this is tempered when base
models are turned into assistants.

## Scale

LLMs range from millions to hundreds of billions of parameters. Bigger models
trained on more data keep getting better, and some capabilities appear
abruptly with scale — see [Emergent capabilities](emergent-capabilities.md).

## Open questions

- Where exactly is a given fact "stored" in the parameters?
- How much of apparent reasoning is interpolation vs. genuine generalization?

## See also

- [Pretraining](pretraining.md) — how the parameters come to exist (stage 1).
- [Fine-tuning](fine-tuning.md) — turning the predictor into an assistant (stage 2).
- [Emergent capabilities](emergent-capabilities.md) — what scale buys.
- [LLM OS](llm-os.md) — the model as the CPU of a new kind of computer.

## References

- Andrej Karpathy, "Intro to Large Language Models" (YouTube talk, ~1h, 2023) — part 1: definition, parameters/tokens, next-token prediction, lossy compression and hallucination.
