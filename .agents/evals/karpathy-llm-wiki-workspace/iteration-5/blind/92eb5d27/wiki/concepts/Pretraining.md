---
title: "Pretraining"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [training, data, language-model]
sources: ["Intro to Large Language Models"]
---

# Pretraining

Stage one of building a [[Large Language Model]]: train from scratch with
[[Next Token Prediction]] on a massive slice of the internet — web pages,
books, code, and other public text — hundreds of billions to trillions of
tokens.

## How It Works

- Scale is the whole game: large models are trained for months on GPU/TPU
  clusters at costs in the millions of dollars. Only a handful of
  organizations can do it.
- Raw internet text is messy. Labs carefully filter, deduplicate, and curate
  the mixture — data quality quietly shapes what the model becomes.
- Empirically, loss falls smoothly and predictably as data, parameters, and
  compute grow (the scaling-trend observation behind the industry's
  confidence). Bigger pretraining reliably buys better next-token prediction,
  and with it [[Emergent Abilities]].
- The output is a "document simulator" — a base model that continues text
  plausibly. It is not yet an assistant; that is [[Fine-Tuning]].

## Variants

- Fully from-scratch pretraining vs continued pretraining on a domain
  (code, biomedicine).
- Open-weight base models (Llama-style) vs closed frontier pretraining runs.

## History

GPT-1 showed the recipe, GPT-2 and GPT-3 showed it scales, and the 2020s
turned pretraining into a capital-intensive race between frontier labs —
[[Andrej Karpathy]] described the field as "people have discovered that it
is better to scale".

## Related

- [[Fine-Tuning]] — stage two, where the base model becomes an assistant
- [[Large Language Model]] — what gets pretrained
- [[Emergent Abilities]] — what scale unexpectedly buys
