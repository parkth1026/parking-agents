---
title: "Fine-tuning"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [fine-tuning, training, alignment]
sources: ["Intro to Large Language Models"]
---

# Fine-tuning

Stage 2 of building an LLM: take the base model produced by [[Pretraining]] and keep training it on a small, high-quality dataset of ideal assistant behavior, so it stops emitting random internet documents and starts answering.

## How It Works

- Data: thousands to millions of curated examples — responses an ideal assistant would give to real user questions
- Supervised fine-tuning (SFT): the model imitates those answers and becomes an assistant/chat model
- RLHF (reinforcement learning from human feedback): humans rank candidate answers, a reward model learns those preferences, and the LLM is optimized against the reward — pushing it from merely plausible toward actually preferred
- Result: a chat model of the ChatGPT kind, in contrast to the raw base model

## Customization Layers

Fine-tuning is expensive and done by the model developer. Everyday customization happens at runtime instead — most directly through the [[System Prompt]] — and product-specific capabilities increasingly come from letting the model call tools (see [[Tool Use]]).

## Related

- [[Pretraining]]
- [[Large Language Model]]
- [[System Prompt]]
