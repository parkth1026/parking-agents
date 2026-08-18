---
title: "Emergent Abilities"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [emergent-abilities, scaling-laws]
sources: ["Intro to Large Language Models"]
---

# Emergent Abilities

Capabilities that appear in a [[Large Language Model]] as scale grows — more
parameters, more data, more compute — without anyone programming them.
Nobody writes arithmetic, translation, or question-answering logic; these
skills fall out of [[Pretraining]] at sufficient scale because predicting
internet text well requires implicitly modeling the processes that generated
it.

## How It Works

- The only explicit objective is [[Next Token Prediction]]; everything else
  is a side effect of doing that extremely well at scale.
- Capability generally improves smoothly with scale, and some skills
  qualitatively "switch on" only past thresholds — the colloquial "emergence"
  framing of the talk.
- Practically: a bigger, better-trained base model is a better foundation for
  [[Fine-Tuning]]; scaling the base lifts the assistant built on top of it.

## Variants

- Scaling-law style analysis (loss as a smooth function of compute/data/
  parameters) vs capability-threshold framing — the talk stays at the
  intuitive level; a deeper "scaling laws" page is a pending candidate
  (plain text by design: no wikilink until the page exists).

## History

GPT-2 surprised with coherent long-form text; each generation since has
shown skills (arithmetic, translation, in-context learning, tool protocols)
that were not explicit training targets. Karpathy's talk presents this as
the core reason everyone is racing to scale.

## Related

- [[Pretraining]] — the stage whose scaling produces emergence
- [[Large Language Model]] — the substrate
- [[Intro to Large Language Models]] — the source talk for this page
