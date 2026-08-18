---
title: "Next Token Prediction"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [training, language-model, core-concept]
sources: ["Intro to Large Language Models"]
---

# Next Token Prediction

The single training objective behind every [[Large Language Model]]: given the
preceding tokens, output a probability distribution over the next token, and
be penalized for assigning low probability to whatever actually came next in
the training text. Nothing else is specified — no grammar module, no fact
database, no reasoning rules.

## How It Works

- The model emits a probability for every token in its vocabulary; sampling
  from that distribution generates text one token at a time.
- Training loops over a huge corpus: predict, measure loss, nudge weights by
  gradient descent. The scale of that loop is [[Pretraining]].
- Why it is so powerful: to predict the next token well on internet text, a
  model must implicitly model syntax, semantics, world knowledge, and some
  reasoning. Skills nobody programmed then surface as
  [[Emergent Abilities]].
- The same objective carries through [[Fine-Tuning]] — only the data
  distribution changes (curated Q&A instead of raw internet).

## Variants

- Next *word* vs next *sub-word token* prediction (tokens average ~4
  characters; see tokenization).
- Teacher forcing during training vs autoregressive sampling during inference.

## History

Language modeling began as n-gram statistics; neural language models and then
transformers showed that this one objective, scaled up, keeps paying off —
the empirical trend that convinced labs to keep scaling compute, data, and
parameters.

## Related

- [[Large Language Model]] — the artifact this objective defines
- [[Pretraining]] — the objective at internet scale
- [[Fine-Tuning]] — the same objective on curated data
