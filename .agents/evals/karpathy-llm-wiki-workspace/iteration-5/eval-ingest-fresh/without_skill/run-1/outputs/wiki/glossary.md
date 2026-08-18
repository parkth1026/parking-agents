---
title: Glossary
tags: [glossary]
status: growing
created: 2026-08-18
---

# Glossary

One-line definitions; the linked pages carry the nuance.

| Term | Definition | Page |
|---|---|---|
| Token | Subword text unit LLMs read and write (~4 chars each; vocab ~32k–100k) | [What Are LLMs?](pages/what-are-llms.md) |
| Parameter | One trainable number in the network; "the blob" is billions of them | [What Are LLMs?](pages/what-are-llms.md) |
| Next-token prediction | The single training objective: guess token *t+1* given *1..t* | [What Are LLMs?](pages/what-are-llms.md) |
| Autoregressive generation | Sample a token, append it, repeat | [What Are LLMs?](pages/what-are-llms.md) |
| Base model | Pretrained-only model; an "internet document generator" | [Pretraining](pages/pretraining.md) |
| Pretraining | Stage 1: next-token training on ~TB of internet text | [Pretraining](pages/pretraining.md) |
| Fine-tuning (SFT) | Stage 2: training on curated prompt→response examples | [Fine-Tuning & RLHF](pages/fine-tuning.md) |
| RLHF | Reinforcement learning against a reward model trained on human preference rankings | [Fine-Tuning & RLHF](pages/fine-tuning.md) |
| Reward model | Model that predicts which response a human would prefer | [Fine-Tuning & RLHF](pages/fine-tuning.md) |
| Hallucination | Fluent but false output; inherited from the data, not a random bug | [Fine-Tuning & RLHF](pages/fine-tuning.md) |
| In-context learning | Learning from examples inside the prompt, with no weight updates | [Emergent Capabilities](pages/emergent-capabilities.md) |
| Few-shot prompting | Steering via a handful of examples in the prompt | [Emergent Capabilities](pages/emergent-capabilities.md) |
| System prompt | Persistent instructions prepended to the context | [Tool Use](pages/tool-use.md) |
| Tool use | Model calling browser / calculator / code / files during generation | [Tool Use](pages/tool-use.md) |
| Jailbreak | Crafted prompt that pushes a model past its rules (e.g., DAN) | [Security Risks](pages/security-risks.md) |
| Prompt injection | Instructions smuggled in as data; indirect variant rides on browsed content | [Security Risks](pages/security-risks.md) |
| Data poisoning | Corrupting training or fine-tuning data to plant behavior | [Security Risks](pages/security-risks.md) |
| LLM OS | Outlook: LLM as kernel of a new OS; context = RAM, tools = peripherals | [The LLM OS](pages/llm-os.md) |
| Context window | The model's working memory, measured in tokens | [The LLM OS](pages/llm-os.md) |
