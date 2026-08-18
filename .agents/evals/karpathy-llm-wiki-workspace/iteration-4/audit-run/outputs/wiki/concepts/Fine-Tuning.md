---
title: "Fine-Tuning"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [fine-tuning, rlhf]
sources: ["Karpathy Intro to LLMs Talk"]
---
# Fine-Tuning

The second training stage: comparatively cheap specialization of a pretrained base model into an assistant.

## How It Works
Curated conversation datasets (and RLHF-style preference data) teach the model to follow instructions, adopt persona via [[System Prompts]], and invoke capabilities like [[Tool Use]].

## Contrast
Unlike [[Pretraining]], fine-tuning changes behavior, not knowledge — per the [[Karpathy Intro to LLMs Talk]] framing of stage separation.
