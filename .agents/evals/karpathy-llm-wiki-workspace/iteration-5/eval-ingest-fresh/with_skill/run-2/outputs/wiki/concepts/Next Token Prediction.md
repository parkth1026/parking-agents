---
title: "Next Token Prediction"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [training, core-concept, tokenization]
sources: ["Intro to Large Language Models (talk)"]
---

# Next Token Prediction

The single training objective behind every [[Large Language Model]]: given a
sequence of tokens, predict the probability distribution over the next
token. Everything else the model appears to "know" is a side effect of
doing this extremely well over internet-scale text.

## How It Works

- Text is chopped into **tokens** — common character chunks, roughly
  word-pieces — rather than raw characters or whole words.
- The model outputs a distribution over the vocabulary (tens to hundreds
  of thousands of tokens); training compares it against the actual next
  token in the corpus and updates the weights.
- At generation time, a token is sampled from the distribution and the
  process repeats — which is why LLMs are sometimes called autoregressive
  token predictors.
- The trick: to predict the next token well, the network is forced to
  internalize grammar, facts, style, and even simple reasoning patterns.
  Compression of the internet becomes world knowledge.

## Variants

- Masked-token objectives (BERT-style) predict *hidden* tokens rather than
  the next one — useful for encoders, not for generation.
- Sampling strategies (temperature, top-p) control how the predicted
  distribution is turned into tokens at inference.

## History

Language modeling by next-word prediction long predates LLMs (n-gram
models); the Transformer (2017) plus scale turned it into the engine of
modern AI. [[Pretraining]] is this objective applied at internet scale;
[[Fine-Tuning]] reuses the same machinery on curated assistant data.

## Related

- [[Large Language Model]]
- [[Pretraining]]
- [[Fine-Tuning]]
