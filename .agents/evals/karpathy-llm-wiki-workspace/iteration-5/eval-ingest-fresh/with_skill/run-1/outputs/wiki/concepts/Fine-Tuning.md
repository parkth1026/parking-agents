---
title: "Fine-Tuning"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [fine-tuning, training, rlhf]
sources: ["Intro to Large Language Models"]
---

# Fine-Tuning

Stage two of building an LLM assistant: take the [[Pretraining]] base model
and continue training it on a small, high-quality dataset of question-answer
and conversation examples — tens of thousands of curated examples, not
trillions of tokens.

## How It Works

- The dataset swaps "the internet" for human-written Q&A: assistants asked
  to be helpful, factual, and honest about their limits.
- Because the objective is still [[Next Token Prediction]], this stage is
  cheap relative to pretraining — days, not months.
- The result is an assistant rather than a document simulator: it answers
  instead of merely continuing. ChatGPT is a fine-tuned GPT base in this
  framing.
- RLHF (reinforcement learning from human feedback) is the extension where
  labelers compare candidate answers and the model is optimized against those
  preference judgments.
- Fine-tuning shapes behavior in aggregate; per-conversation behavior is
  further shaped at inference time by the [[System Prompt]].

## Variants

- Supervised fine-tuning on Q&A datasets.
- RLHF-style preference optimization.
- Identity and policy fine-tuning (persona, refusal guidelines) that
  [[Prompt Injection]] and jailbreaks later try to subvert.

## History

The two-stage recipe (pretrain then fine-tune) was standardized during the
GPT-3 era; [[Andrej Karpathy]] presents it as the universal pattern behind
every assistant product.

## Related

- [[Pretraining]] — the stage that comes first
- [[System Prompt]] — inference-time behavior control
- [[Large Language Model]] — the artifact being tuned
