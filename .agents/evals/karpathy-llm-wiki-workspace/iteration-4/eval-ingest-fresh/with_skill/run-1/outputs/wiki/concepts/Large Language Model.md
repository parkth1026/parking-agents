---
title: "Large Language Model"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [language-model, core-concept]
sources: ["Intro to Large Language Models"]
---

# Large Language Model

A neural network trained on internet-scale text to predict the next token.
Despite the mystique, an LLM is conceptually just **two files**: a parameters
file (billions of learned numbers — e.g. ~65GB for a 13B-parameter model,
a few hundred GB for 70B-class models like Llama 2) and a runnable file of
code that executes those parameters. There is no database, no lookup — all
knowledge is compressed into the weights.

## How It Works

1. Take a chunk of the internet as training text (see [[Pretraining]]).
2. Show the network a sequence of tokens and ask it to predict the next one
   ([[Next Token Prediction]]).
3. Update the parameters slightly when the prediction is wrong
   (backpropagation), repeated trillions of times across many GPUs for
   months.
4. The result is a generative model: sample from its predictions to produce
   fluent text, one token at a time.

Running the model is deterministic — the same inputs give the same
probability distribution. Apparent creativity comes from *sampling* different
tokens from that distribution, not from hidden randomness in the model.

## Variants

- **Base model** — the direct output of pretraining; an "internet document
  generator" that completes text plausibly but is not an assistant.
- **Fine-tuned assistant** — base model further trained on curated Q&A-style
  data ([[Fine-Tuning]]); behaves like ChatGPT-style helpers.
- **Open vs closed weights** — Llama 2 as the canonical open example;
  GPT-4-class models as closed API-only counterparts.

## History

- GPT-2 (2019) showed large-scale next-token training produces surprisingly
  coherent text.
- ChatGPT (late 2022) demonstrated the fine-tuned assistant form to the
  general public — about 100 million users in roughly two months.
- Post-2023: assistants gained tools and multimodality (see [[LLM OS]]).

## Related

- [[Next Token Prediction]] — the single objective that produces all of this
- [[Pretraining]] / [[Fine-Tuning]] — the two training stages
- [[Intro to Large Language Models]] — the source talk for this page
- [[Andrej Karpathy]] — the "two files" framing
