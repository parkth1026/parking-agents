---
title: Hallucinations and Limitations
aliases: [hallucination, confabulation, knowledge cutoff, errors and biases]
tags: [reliability]
source: Karpathy — "Intro to Large Language Models" (Nov 2023)
created: 2026-08-18
status: draft
---

# Hallucinations and Limitations

> **TL;DR:** LLMs generate token by token and have no built-in notion of
> "I know this" versus "I am making it up", so they confabulate fluently.
> Add the training-data cutoff and inherited biases and you get the
> talk's reliability caveats — and the core motivation for
> [Tool Use](tool-use.md).

## Why hallucination is structural

- The model samples plausible continuations (see
  [What is an LLM](what-is-an-llm.md)); plausibility is not truth.
- Memory and invention blend seamlessly, token by token — there is no
  source-of-truth channel. [Fine-tuning](fine-tuning.md) teaches helpful
  manners, not calibrated knowledge.
- Asking for sources can *increase* fabrication: the model will dream up
  plausible citations.

## The other two caveats from the talk

- **Knowledge cutoff.** The weights only know the
  [pretraining](pretraining.md) data; anything after it is unknown
  unless retrieved with [Tools](tool-use.md).
- **Errors and biases.** The internet's biases and falsehoods are
  compressed into the weights along with everything else, and the model
  reproduces them.

## Mitigations

- retrieval and browsing to ground answers in current facts;
- verification where outcomes are checkable (code execution, math);
- calibration-aware usage: treat outputs as drafts to verify, not
  oracles.

## See also

- [What is an LLM](what-is-an-llm.md)
- [Tool Use](tool-use.md)
- [Pretraining](pretraining.md)
