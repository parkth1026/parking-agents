---
title: Next-Token Prediction
source: "Andrej Karpathy — Intro to Large Language Models (Nov 2023)"
category: fundamentals
tags: [objective, autoregressive, tokens, generation]
created: 2026-08-14
status: seed
---

# Next-Token Prediction

The single training objective behind LLMs, per the talk: over the whole
training corpus, the network reads text and at every position tries to
**predict the next token**. It outputs a probability distribution over the
vocabulary; being wrong adjusts the parameters a tiny bit (gradient descent).
Repeat across the entire internet-scale corpus.

## Why one simple objective is enough

Predicting the next token well forces the network to implicitly learn
grammar, facts, style, and reasoning patterns present in the data — because
they all help make better predictions. Nothing else is programmed in; all
structure is discovered from the corpus.

## Generation is autoregressive

- **Training**: the model is trained on documents, predicting the token after
  each prefix.
- **Inference**: start with a prompt; the model predicts a distribution over
  the next token, a token is sampled from it, appended to the sequence, and
  fed back in. Repeat. Each generated token conditions all later ones.

This loop is why a base model continues any document plausibly — it is doing
exactly what it was trained to do (see
[What is an LLM?](What-is-an-LLM.md)).

## One consequence worth remembering

Next-token prediction rewards *plausibility*, not *truth*. That single fact
explains a lot of downstream behavior, most notably
[hallucinations](../capabilities/Hallucinations.md).

## Related

- [What is an LLM?](What-is-an-LLM.md)
- [Tokens and Context Window](Tokens-and-Context-Window.md)
- [Pretraining](../training/Pretraining.md)
- [Hallucinations](../capabilities/Hallucinations.md)
