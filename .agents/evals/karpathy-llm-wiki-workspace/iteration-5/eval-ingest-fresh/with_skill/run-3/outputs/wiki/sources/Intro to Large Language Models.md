---
title: "Intro to Large Language Models"
created: 2026-08-18
updated: 2026-08-18
type: source
tags: [talk, core-concept]
sources: []
---

# Intro to Large Language Models

> **Authors**: Andrej Karpathy | **Year**: 2023 | **Type**: Talk (approx. 1 hour)
> **URL**: https://www.youtube.com/watch?v=zjkBMFhNj_g

A general-audience walkthrough of what LLMs are, how they are trained, and where
they are going, delivered by [[Andrej Karpathy]] while at OpenAI. It is one of
the most-cited on-ramps to the field, and most of its framing (two-stage
training, LLM OS) has become standard vocabulary.

## Key Takeaways

- An LLM is just a neural network trained to predict the next token on internet
  text; there is no internal database of facts, so models confidently
  hallucinate when they lack knowledge (see [[Large Language Model]]).
- Training happens in two stages: large-scale, expensive [[Pretraining]] on raw
  internet data, followed by cheap, small-scale [[Fine-tuning]] on curated
  question-answer data that turns the base model into a usable assistant.
- Capabilities are not explicitly programmed: they appear as models scale
  (see [[Emergent Abilities]]), which is why the field keeps pushing
  parameter counts and dataset sizes up.
- Deployed products steer the model with a [[System Prompt]] and extend it with
  [[Tool Use]] (browser, calculator, Python interpreter).
- Security is unsolved: [[Jailbreaking]] attacks the user-model boundary and
  [[Prompt Injection]] attacks the model-data boundary.
- Karpathy's forward-looking framing is the [[LLM OS]]: the LLM as the kernel
  of a new kind of computer.

## Concepts Introduced or Covered

- [[Large Language Model]] — next-token prediction on internet text as the
  entire training objective
- [[Pretraining]] — the expensive internet-scale stage
- [[Fine-tuning]] — the cheap high-quality stage that creates an assistant
- [[Emergent Abilities]] — capabilities that appear with scale
- [[System Prompt]] — steering the model into a mode
- [[Tool Use]] — browsing, calculation, code execution
- [[Jailbreaking]] — bypassing safety training via crafted inputs
- [[Prompt Injection]] — adversarial instructions hidden in data the model reads
- [[LLM OS]] — the LLM as CPU/kernel of an emerging platform

## Critical Notes

- Talk dates from November 2023; parameter counts, compute costs, and product
  details (e.g., which tools are shipped) reflect that moment and are now
  historical data points rather than current frontier numbers.
- The raw notes ingested for this page are a user-provided topic summary of the
  talk, not a fetched transcript; topic coverage is faithful to the talk, but
  there are no verbatim quotes (see raw source provenance note).
