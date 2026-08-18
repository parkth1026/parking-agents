---
title: "Pretraining"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [training, data, core-concept]
sources: ["Intro to Large Language Models"]
---

# Pretraining

The first stage of building a [[Large Language Model]]: train the network from
random initialization on a huge corpus of raw internet text (web pages, books,
code, forums), with nothing but next-token prediction as the objective.

## How It Works

- The training corpus is a curated, filtered, deduplicated slice of the
  internet — on the order of trillions of tokens for frontier-scale models.
- Compute cost is the defining feature: thousands of GPUs running for weeks to
  months, at a cost of millions of dollars (2023 figures from the [[Intro to Large Language Models]] talk).
  Only a handful of organizations can do it.
- The output is a **base model**: an internet-document simulator that continues
  any prompt plausibly. Ask it a question and it may just continue with more
  questions, because question pages on the internet look like that.
- Making a usable assistant out of the base model is the job of [[Fine-tuning]];
  pretraining alone never produces a product.

## Variants

- Scaling recipe changes — model size, dataset size, and training tokens are
  traded off against each other; scaling-law research (Kaplan et al. 2020,
  Hoffmann et al. 2022) formalized the trade-off.
- Data curation changes — which slices of the internet, filtering quality,
  deduplication, and up-weighting high-quality sources shift what the base
  model is good at.

## History

Pretraining as "first learn the world, then learn the task" predates LLMs
(word2vec, BERT-era pretraining). GPT-series models pushed it to its current
form: one objective, the whole internet, as much compute as you can afford.
Each capability jump at scale seeded the study of [[Emergent Abilities]].

## Related

- [[Large Language Model]] — what is being pretrained
- [[Fine-tuning]] — the cheap second stage that specializes the base model
- [[Emergent Abilities]] — what shows up as pretraining scale grows
