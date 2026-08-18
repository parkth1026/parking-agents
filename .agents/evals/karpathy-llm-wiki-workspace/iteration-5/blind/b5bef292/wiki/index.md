---
title: LLM Wiki — Home
tags: [index]
status: growing
created: 2026-08-18
---

# LLM Wiki

A wiki of LLM concepts: small mental models, concrete numbers, honest
caveats.

**Founding source:** Andrej Karpathy,
[*Intro to Large Language Models*](https://www.youtube.com/watch?v=zjkBMFhNj_g)
(1-hour talk, 2023). All pages below at status `seed` are the initial
ingest of that talk.

## Page map

### Foundations

- [What Are LLMs?](pages/what-are-llms.md) — next-token prediction on
  internet text; the two-file mental model
- [Glossary](glossary.md) — one-line definitions linking to full pages

### Training

- [Pretraining](pages/pretraining.md) — compressing the internet into
  parameters; the "internet document generator"
- [Fine-Tuning & RLHF](pages/fine-tuning.md) — from base model to
  assistant; hallucination and the verification bottleneck

### Capabilities

- [Emergent Capabilities at Scale](pages/emergent-capabilities.md) —
  scaling behavior, in-context learning, prompting as programming

### Systems

- [Tool Use & System Prompts](pages/tool-use.md) — browsers, calculators,
  code, files, and instructions that steer a frozen model
- [The LLM OS](pages/llm-os.md) — Karpathy's kernel analogy for where this
  is all going

### Safety

- [Security Risks](pages/security-risks.md) — jailbreaks, prompt injection,
  data poisoning

## How to use this wiki

Start at [What Are LLMs?](pages/what-are-llms.md) and follow `See also`
links. Conventions for contributing are in [README](README.md); new pages
start from [the template](templates/page-template.md).
