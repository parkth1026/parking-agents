---
title: "Intro to Large Language Models"
created: 2026-08-18
updated: 2026-08-18
type: source
tags: [talk, core-concept]
sources: []
---

# Intro to Large Language Models

> **Authors**: Andrej Karpathy | **Year**: 2023 | **Type**: Talk (1hr, general audience)
> **URL**: https://www.youtube.com/watch?v=zjkBMFhNj_g

## Key Takeaways

- An LLM is conceptually just **two files**: a parameters file (e.g. a few
  hundred GB of numbers, ~100B parameters for Llama 2 70B-class models) and
  the code that runs them. Everything the model "knows" lives in the weights,
  learned from internet text by [[Next Token Prediction]].
- Training happens in **two stages**: [[Pretraining]] on raw internet text
  (GPU-months, ~$1-2M for Llama 2-class open models) produces a base model —
  an "internet document generator" — and [[Fine-Tuning]] on curated,
  assistant-style Q&A data makes it behave like a helpful assistant.
- Capabilities are **not explicitly programmed**: they appear as
  [[Emergent Abilities]] as parameters, data, and compute scale up.
- Deployed assistants are shaped by hidden [[System Prompt]] text and can act
  through [[Tool Use]] (browser, calculator, Python). Both expand capability
  and open a new attack surface: [[Jailbreaking]] and [[Prompt Injection]].
- Karpathy's forward-looking framing: the LLM is the **kernel of an emerging
  operating system** ([[LLM OS]]) — context window as RAM, tools as
  peripherals, with hallucinations as bugs and attacks as the security
  problem of this new platform.

## Concepts Introduced or Covered

- [[Large Language Model]] — what an LLM physically is: parameters + code,
  trained on internet text
- [[Next Token Prediction]] — the single training objective behind everything
- [[Pretraining]] — stage 1: internet-scale training of the base model
- [[Fine-Tuning]] — stage 2: shaping the base model into an assistant
- [[Emergent Abilities]] — capabilities that appear at scale
- [[System Prompt]] — hidden steering text that defines assistant behavior
- [[Tool Use]] — browsing, calculators, code interpreters as model "peripherals"
- [[Jailbreaking]] — user-side attacks that bypass safety rules
- [[Prompt Injection]] — adversarial instructions hidden in content the model reads
- [[LLM OS]] — the LLM as kernel of an emerging OS (future outlook)

## Notable Quotes

> "A large language model is just two files." — Andrej Karpathy (paraphrase
> of the talk's opening framing)

## Critical Notes

- Talk is from Nov 2023; parameter counts, costs, and tool ecosystems have
  evolved since. Numbers are period snapshots, not current state.
- This page was ingested from the user's topic summary of the talk (no
  verbatim transcript was captured); see the raw notes in the transcripts
  folder for exactly what was provided.
