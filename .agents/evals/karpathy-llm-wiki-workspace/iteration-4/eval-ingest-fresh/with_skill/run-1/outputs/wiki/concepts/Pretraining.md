---
title: "Pretraining"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [training, data]
sources: ["Intro to Large Language Models"]
---

# Pretraining

Stage 1 of LLM training: take a large fraction of the internet (roughly
order-of-magnitude 10TB of raw text, filtered down to ~1TB of higher-quality
tokens), then train a [[Large Language Model]] from random initialization on
[[Next Token Prediction]] over that corpus.

## How It Works

- Runs on many GPUs for weeks to months; Karpathy cites order $1-2M of
  compute for Llama 2 70B-class open models as of 2023.
- The output is a **base model** — fundamentally an "internet document
  generator". Give it a prompt and it continues with statistically plausible
  internet text.
- A base model is not an assistant. Asked a question, it may answer, make
  one up, or reply with ten more questions — whatever continuation resembles
  its training data. This is the mechanical origin of hallucination (see
  [[Next Token Prediction]]).
- Base models are nevertheless remarkable: they absorb facts, styles, and
  multilingual structure purely by learning to continue text.

## Variants

- Retraining from scratch (what "pretraining" strictly means) vs continued
  pretraining on domain data.
- Post-training alternatives that shape a base model into an assistant:
  supervised [[Fine-Tuning]] and RLHF-style methods (mentioned briefly in the
  talk as an optional stage 3).

## History

GPT-2 was an early demonstration that pretraining at scale yields broadly
capable text models; Llama 2 made open pretrained weights widely available,
which is why the talk uses it as the running example.

## Related

- [[Fine-Tuning]] — stage 2, turns the base model into an assistant
- [[Next Token Prediction]] — the training objective used here
- [[Emergent Abilities]] — what shows up as this stage scales
- [[Intro to Large Language Models]] — the source talk for this page
