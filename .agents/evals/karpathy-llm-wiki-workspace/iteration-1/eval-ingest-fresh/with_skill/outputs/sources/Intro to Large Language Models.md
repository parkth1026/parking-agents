---
title: "Intro to Large Language Models"
created: 2026-04-13
updated: 2026-04-13
type: source
tags: [talk, tutorial, core-concept]
sources: []
---

# Intro to Large Language Models

> Author: [[Andrej Karpathy]] | Year: 2023 | Type: YouTube Lecture (~1 hour)
> URL: https://www.youtube.com/watch?v=zjkBMFhNj_g

## Key Takeaways

- An LLM is fundamentally two files: a parameters file (weights) and a run file
  (inference code). The "magic" is entirely in the weights.
- [[Pretraining]] is a lossy compression of the internet via next-token prediction.
  A base model is a "document completer," not an assistant.
- [[Fine-Tuning]] + [[RLHF]] transform the base model into a helpful assistant.
  SFT teaches format; RLHF teaches preferences.
- [[Scaling Laws]] are robust: performance improves predictably with compute, data,
  and parameters. The Chinchilla result showed models were undertrained.
- The [[LLM OS]] framing: LLMs are becoming the kernel of a new computing
  paradigm, with context window as RAM, tools as syscalls, and agents as processes.
- Security is an open problem: [[Prompt Injection]] is the most critical unsolved
  attack against LLM-based systems.

## Concepts Introduced

- [[Pretraining]]
- [[Fine-Tuning]]
- [[RLHF]]
- [[Scaling Laws]]
- [[LLM OS]]
- [[Tokenization]]
- [[Context Window]]
- [[Prompt Injection]]
- [[Retrieval-Augmented Generation]]

## Notable Quotes

> "Think of the LLM as the kernel of a new kind of operating system."

> "The model is a kind of zip file of the internet — lossy compression."

> "We don't fully understand why these [emergent] capabilities appear. They just do."

## Entities Referenced

- [[Andrej Karpathy]] (author/presenter)
- [[OpenAI]] (employer context, InstructGPT)
- [[GPT-4]] (reference model throughout)

## Structure of the Talk

1. What is an LLM (the two files)
2. Pretraining pipeline
3. Fine-tuning and RLHF pipeline
4. Scaling laws (Kaplan, Chinchilla)
5. LLM OS concept (tools, agents, multimodal)
6. Security (prompt injection, jailbreaks, data poisoning)
7. Future directions (System 2 thinking, self-play RL)

## Raw Source

Original transcript notes: [[2024-01-15-karpathy-intro-to-llms]]

## See Also

- [[trace_report]] — Eval trace for the ingestion of this source into the wiki
