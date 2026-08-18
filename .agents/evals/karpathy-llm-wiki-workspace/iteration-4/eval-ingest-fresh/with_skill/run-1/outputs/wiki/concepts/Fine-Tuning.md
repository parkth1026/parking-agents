---
title: "Fine-Tuning"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [fine-tuning, training]
sources: ["Intro to Large Language Models"]
---

# Fine-Tuning

Stage 2 of LLM training: instead of internet text, train on a small, curated
dataset of high-quality "assistant-like" conversations — typically tens of
thousands of Q&A examples written or reviewed by labelers. The same
[[Next Token Prediction]] machinery is applied, but the target distribution
is now "how a helpful assistant responds" rather than "how the internet
continues".

## How It Works

- Replaces the base model's internet-document behavior with
  question-answering behavior: answer directly, admit limits, refuse harmful
  requests.
- Requires orders of magnitude less data and compute than [[Pretraining]] —
  days, not months.
- Karpathy notes an optional stage 3 exists in practice (RLHF-style
  preference training), but supervised fine-tuning is the conceptual core.
- Fine-tuned models hallucinate less than base models but still cannot
  reliably report their own knowledge boundaries — they say what an assistant
  would plausibly say.
- Deployed assistants are additionally steered by a hidden [[System Prompt]]
  and can act through [[Tool Use]].

## Variants

- Full fine-tuning vs parameter-efficient variants (LoRA/QLoRA — not covered
  in the talk, recorded here for later expansion).
- Fine-tuning for tool calling: training the model to emit tool invocations.

## History

The pretrain-then-finetune recipe predates chat assistants (transfer
learning), but pairing internet-scale [[Pretraining]] with small curated
assistant datasets is what made ChatGPT-style products viable.

## Related

- [[Pretraining]] — stage 1 that produces the base model being tuned
- [[System Prompt]] / [[Tool Use]] — what shapes assistant behavior at runtime
- [[Intro to Large Language Models]] — the source talk for this page
