---
title: "Pretraining"
created: 2026-08-14
updated: 2026-08-14
type: concept
tags: [training, data, core-concept]
sources: ["Karpathy Intro to LLMs Talk"]
---

# Pretraining

Stage 1 of LLM training: compress internet-scale text into neural network
parameters, with [[Next Token Prediction]] as the only objective.

## How It Works

- **Data**: scrape the internet (hundreds of TB raw), then filter for quality
  (drop spam, adult content, duplicates, etc.) down to a few TB of
  high-quality text.
- **Compute**: a GPU cluster (thousands of GPUs) running for weeks to months.
  At [[Llama 2]] scale this costs on the order of $1-2M — pretraining is the
  expensive stage that only large labs do.
- **Output**: a **base model** — an internet-text simulator that continues any
  prompt plausibly (ask it a question and it may just continue with more
  questions), but does not yet behave like an assistant.

Karpathy's framing: pretraining is "cramming the textbook" — read everything,
learn the patterns; it is lossy compression of the corpus into the parameter
file of a [[Large Language Model]].

## After Pretraining

The base model is then shaped into a product by [[Fine-Tuning]] and [[RLHF]]
— see [[Pretraining vs Fine-Tuning]] for a side-by-side. The scale of
pretraining is also what unlocks [[Emergent Abilities]].

## Related

- [[Fine-Tuning]]
- [[Next Token Prediction]]
- [[Llama 2]]
