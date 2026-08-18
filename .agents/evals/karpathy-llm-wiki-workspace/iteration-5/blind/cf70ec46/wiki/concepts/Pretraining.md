---
title: "Pretraining"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [training, data, scaling-laws]
sources: ["Intro to Large Language Models (talk)"]
---

# Pretraining

Stage one of building a [[Large Language Model]]: train from scratch on
internet-scale text with [[Next Token Prediction]]. This is where nearly
all the compute and cost goes — weeks on thousands of GPUs, on the order of
millions of dollars for an open-weights frontier-class base model.

## How It Works

- **Data**: a filtered snapshot of the internet — web pages, books, source
  code. Raw text on the order of tens of terabytes gets deduplicated and
  filtered down to trillions of training tokens.
- **Result**: a **base model** that behaves like an "internet document
  simulator". Prompt it with the start of a web page and it plausibly
  continues *some* web page — news, Q&A forum, wiki, recipe — without any
  concept of answering *you*.
- Base models can still be steered by pattern-matching (e.g., few-shot
  prompts that look like a Q&A page get completed as a Q&A page), which is
  how the field used them before assistants existed.

## Variants and Follow-ons

- Continued pretraining on domain data (code, biomedicine) before
  [[Fine-Tuning]].
- The talk emphasizes the asymmetry: pretraining is expensive and broad;
  fine-tuning is cheap and narrow — small, high-quality labeled datasets
  can go a long way (research like LIMA argues ~1,000 carefully curated
  examples suffice to shape an assistant).

## History

GPT-style models made pretraining-then-adaptation the standard recipe;
Llama 2 (2023) made the base-model recipe openly reproducible. Scale
during this stage is also what unlocks [[Emergent Abilities]].

## Related

- [[Fine-Tuning]]
- [[Large Language Model]]
- [[Next Token Prediction]]
- [[Emergent Abilities]]
