---
title: "Pretraining vs Fine-Tuning"
created: 2026-08-14
updated: 2026-08-14
type: comparison
tags: [comparison, training, fine-tuning]
sources: ["Karpathy Intro to LLMs Talk"]
---

# Pretraining vs Fine-Tuning

The two big stages of building an LLM (followed by [[RLHF]]). The talk
contrasts them as "cram the textbook" versus "study past exam questions".

## Overview

| Aspect | [[Pretraining]] | [[Fine-Tuning]] |
|--------|-----------------|-----------------|
| Data | terabytes of filtered internet text | ~100k curated prompt → answer pairs |
| Cost | on the order of $1-2M, thousands of GPUs, weeks to months | on the order of $100s, ~a day, few GPUs |
| Objective | [[Next Token Prediction]] on raw documents | [[Next Token Prediction]] on Q&A data |
| Output | base model (internet-text simulator) | assistant-like chat model |
| Analogy | cramming the textbook | practicing past exams |
| Who runs it | large labs, once per model | anyone with API access or weights |

## Detailed Analysis

### What Each Stage Teaches

Pretraining compresses world knowledge and language patterns into the
parameters of a [[Large Language Model]]; fine-tuning only reshapes behavior
and surface format. Fine-tuning cannot add much fresh knowledge — it teaches
how to respond, not what is true.

### Why the Cost Gap

Pretraining processes terabytes; fine-tuning processes megabytes — roughly
five orders of magnitude less data, which is why the same algorithm is cheap
the second time around.

### Common Failure Modes

- Deploying a base model directly: plausible text, but no assistant behavior
  or refusals.
- Expecting fine-tuning to fix knowledge gaps: instead you get confident
  made-up answers — [[Hallucination]].

## When to Choose Which

You almost always do both, in order: pretrain to know, fine-tune to serve.

## Sources

Based on [[Karpathy Intro to LLMs Talk]].
