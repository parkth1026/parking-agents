---
title: Data Poisoning
source: "Andrej Karpathy — Intro to Large Language Models (Nov 2023)"
category: security
tags: [security, data-poisoning, supply-chain, training-data]
created: 2026-08-14
status: seed
---

# Data Poisoning

## The idea

Rather than attacking a running model, poison what it learns from. Because
[pretraining](../training/Pretraining.md) ingests terabytes of internet
text, an attacker who can get content into that corpus can influence the
resulting weights.

## How it works

- Insert toxic, biased, or trigger-conditioned content into sources likely
  to be scraped into training data.
- Attacks can **persist in the weights**: the model behaves normally until a
  specific trigger phrase activates the planted behavior (backdoors).
- A related vector: malicious fine-tuning datasets, or models fine-tuned by
  third parties with harmful behaviors baked in.

## Why it is hard to defend

- Data provenance at internet scale is nearly impossible to audit — the
  "supply chain" of an LLM is the open internet.
- Unlike [adversarial prompts](Adversarial-Prompts.md), poisoning happens
  *before* deployment and is invisible at inference time.

## Related

- [Pretraining](../training/Pretraining.md)
- [Adversarial Prompts](Adversarial-Prompts.md)
- [Training Process](../training/Training-Process.md)
