---
title: "Fine-tuning"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [fine-tuning, training]
sources: ["Intro to Large Language Models"]
---

# Fine-tuning

The second stage of building an LLM product: take the pretrained base model
(see [[Pretraining]]) and continue training it on a small, high-quality
dataset of curated examples — typically question-answer pairs written or
verified by human labelers — so that it behaves like an assistant instead of
an internet-document simulator.

## How It Works

- Dataset is tiny compared to pretraining: roughly thousands to hundreds of
  thousands of curated examples, collected via labeling platforms with
  detailed guidelines. Quality matters far more than quantity.
- The format teaches behavior: prompt-response pairs. After fine-tuning, the
  model answers questions, refuses harmful requests, and adopts a consistent
  persona rather than merely continuing text.
- Cost is trivial next to pretraining — hours on modest hardware, not months
  on GPU clusters — which is why many assistants share a small set of base
  models but differ in fine-tuning data.
- Preference optimization on top (RLHF and relatives) further shapes which of
  the fine-tuned behaviors dominate; it is a refinement of the same stage
  rather than a separate source of knowledge.

## Variants

- Supervised fine-tuning (SFT) — pure imitation of labeler-written answers.
- RLHF / preference tuning — optimizing against human preference comparisons.
- LoRA-style parameter-efficient tuning — updating small adapter weights
  instead of all parameters.

## History

The pattern ("pretrain broadly, then fine-tune narrowly") descends from
transfer learning in vision and BERT-era NLP. In the LLM era the asymmetry
became extreme: months of [[Pretraining]] followed by days of fine-tuning, a
division of labor [[Andrej Karpathy]] uses as the backbone of his intro talk.

## Related

- [[Pretraining]] — the stage that supplies the raw capability being shaped
- [[Large Language Model]] — the overall artifact both stages build
- [[System Prompt]] — the inference-time counterpart: steering behavior
  without changing weights
