---
title: "Intro to Large Language Models"
created: 2026-08-18
updated: 2026-08-18
type: source
tags: [talk, tutorial]
sources: []
---

# Intro to Large Language Models

> **Speaker**: Andrej Karpathy | **Year**: 2023 | **Type**: Talk (1 hour)
> **URL**: https://www.youtube.com/watch?v=zjkBMFhNj_g

A compact end-to-end tour of what LLMs are, how they are trained, what they can do at scale, how they are customized, how they fail, and where they are going.

## Key Takeaways

- An LLM is a next-token predictor over internet-scale text, and ships as two "files": parameters plus the architecture code that runs them
- Training has two stages: [[Pretraining]] on raw internet text, then [[Fine-tuning]] on small, high-quality assistant data (SFT and RLHF)
- Capability grows with scale, and new abilities arrive as [[Emergent Capabilities]] that smaller models lack
- Assistants get stronger and safer with [[Tool Use]] (browser, calculator, Python) and runtime steering via the [[System Prompt]]
- Two security risks stand out: [[Jailbreaking]] the model directly, and [[Prompt Injection]] through the data it reads
- The future sketched in the talk is the [[LLM OS]]: the LLM as kernel of a new kind of computer

## Concepts Introduced or Covered

- [[Large Language Model]] — next-token prediction; two-file abstraction; Llama 2 70B at roughly 140 GB fp16
- [[Pretraining]] — the base model as a compressed sketch of the internet; the expensive stage
- [[Fine-tuning]] — SFT + RLHF turn a base model into an assistant
- [[Emergent Capabilities]] — arithmetic, multilingual translation, coding appearing with scale
- [[Tool Use]] — browsing, calculator, and Python execution in a loop
- [[System Prompt]] — custom instructions steering assistant behavior
- [[Jailbreaking]] — creative reframes that bypass safety (the grandmother / Windows keys demo)
- [[Prompt Injection]] — hostile text planted in data the model reads
- [[LLM OS]] — LLM as CPU, context window as RAM, tools as peripherals
- [[Andrej Karpathy]] — speaker

## Notable Quotes

Deliberately omitted: the raw ingest was a user-provided topic summary, not a verbatim transcript, so no quotes are certified word-for-word.

## Critical Notes

- Ingested from a user-provided topic list (raw note: transcripts/2026-08-18-karpathy-intro-to-llms.md); page details were filled in from general knowledge of this widely viewed public talk
- Talk identification (title, date, URL) was inferred from the user's description; the raw note records this provenance
- Specific figures (GPU counts, dollar costs, dataset sizes) are kept approximate rather than quoted precisely
