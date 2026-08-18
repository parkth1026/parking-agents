---
title: "Large Language Model"
created: 2026-08-14
updated: 2026-08-14
type: concept
tags: [language-model, core-concept]
sources: ["Karpathy Intro to LLMs Talk"]
---

# Large Language Model

A Large Language Model (LLM) is a neural network — conceptually just two
files: a large **parameters file** (e.g. [[Llama 2]], on the order of 100B
parameters) and a relatively small program that runs the network. Everything
else used to create it (the training corpus, logs) can be thrown away: the
parameters are the compressed knowledge.

## How It Works

- **Input**: raw text is chopped into tokens by a [[Tokenization]] scheme and
  fed into the network.
- **Objective**: the network is trained on chunks of internet text to perform
  [[Next Token Prediction]] — the same simple objective drives both training
  and generation.
- **Training**: [[Pretraining]] on internet-scale corpora produces a base
  model; [[Fine-Tuning]] and [[RLHF]] turn it into an assistant.
- **Generation**: the model outputs a probability distribution over the next
  token, samples one, appends it, and repeats — "spicy autocomplete" all the
  way down.

## Capabilities and Limits

- Scaling pretraining brings unplanned skills — see [[Emergent Abilities]].
- Reliability limit: [[Hallucination]] (confident fabrication) is inherent to
  a plausibility-first objective.
- At inference time, behavior is steered by a [[System Prompt]] and extended
  through [[Tool Use]].

## History

GPT-style models grew from ~100M-parameter prototypes (2018) to ~100B-class
models within about five years; the field then split between closed API
models and open weights ([[Llama 2]]). Karpathy's forward framing of where
this converges is the [[LLM OS]].

## Related

- [[Next Token Prediction]]
- [[Tokenization]]
- [[Pretraining]]
- [[Karpathy Intro to LLMs Talk]]
