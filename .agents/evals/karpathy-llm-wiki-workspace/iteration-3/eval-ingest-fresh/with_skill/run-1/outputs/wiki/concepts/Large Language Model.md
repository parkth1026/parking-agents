---
title: "Large Language Model"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [language-model, core-concept, architecture]
sources: ["Intro to Large Language Models"]
---

# Large Language Model

A Large Language Model (LLM) is a neural network trained on internet-scale text to do exactly one thing: predict the next token. Everything else it appears to do — answering questions, writing code, using tools — emerges from that single objective plus scale.

## How It Works

- Karpathy's two-file abstraction: an LLM ships as (1) a file of parameters (the learned weights) and (2) the code implementing the network architecture that runs those weights. Example from the talk: Llama 2 70B is roughly 70 billion parameters, about 140 GB at fp16 half precision.
- Training data: on the order of terabytes of text scraped from the internet — hundreds of billions to trillions of tokens.
- Inference is autoregressive: tokens go in, the network outputs a probability distribution over the next token, one token is sampled and appended, and the process repeats. Karpathy half-jokes that this makes the model a very powerful autocomplete.

## Training in Two Stages

- [[Pretraining]] builds the raw next-token ability on internet text.
- [[Fine-tuning]] reshapes that ability into a helpful assistant.

## Why Scale Matters

More parameters + more data + more compute yields [[Emergent Capabilities]] that smaller models lack; to date, scaling is the main dial for capability. The long-term trajectory of this artifact is the [[LLM OS]].

## Related

- [[Pretraining]]
- [[Fine-tuning]]
- [[Emergent Capabilities]]
- [[LLM OS]]
- [[Andrej Karpathy]]
