---
title: "Llama 2"
created: 2026-08-14
updated: 2026-08-14
type: entity
tags: [model, language-model, open-source, meta]
sources: ["Karpathy Intro to LLMs Talk"]
---

# Llama 2

Meta's open-weights LLM family (released July 2023), shipping base and chat
variants at 7B / 13B / 70B parameters. In the talk it is the running example:
a frontier-class model you can actually download as a file.

## Key Facts

- Weights are publicly downloadable — the "LLM as a file" demo: the 70B
  variant is roughly 140 GB in fp16, runnable locally with small runners
  (Karpathy's llama2.c runs such models in a few hundred lines of C).
- Ships as a *base* model plus a *chat* version — a concrete instance of the
  [[Pretraining]] then [[Fine-Tuning]] (+ [[RLHF]]) pipeline.
- Used in the talk to illustrate scale: ~100B-parameter class trained on
  internet-scale text.

## Significance

Made the "a neural network is just a file you can run" idea tangible, and
became the reference open model for experimentation after the closed-API era
of GPT-3/early ChatGPT.

## Related

- [[Large Language Model]]
- [[Pretraining]]
- [[Fine-Tuning]]
- [[Karpathy Intro to LLMs Talk]]
