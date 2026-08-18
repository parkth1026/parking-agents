---
title: "System Prompt"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [prompting, agents]
sources: ["Intro to Large Language Models"]
---

# System Prompt

A hidden, persistent block of text prepended to every conversation with an
LLM assistant. Users do not see it; it configures the assistant's persona,
policies, the tools available, and (in multimodal setups) how images and
audio are fed into the context.

## How It Works

- It sits above the user turns in the token stream and shapes every
  [[Next Token Prediction]] the model makes for that conversation.
- Typical contents: identity ("you are a helpful assistant"), behavioral
  guidelines, tool declarations for [[Tool Use]], formatting instructions,
  multimodality options.
- It is configuration, not a security boundary: it is just text in the
  context window, which is exactly what makes [[Prompt Injection]] possible.

## Variants

- Frameworks (LangChain-style) assemble long system prompts that coordinate
  multi-step tool loops — a step toward the [[LLM OS]].
- Per-app prompts (the same base model serving many products) vs the baked-in
  behavior from [[Fine-Tuning]].

## History

Became visible with the ChatGPT product wave in late 2022; [[Andrej Karpathy]]
showcases it in [[Intro to Large Language Models]] as the seam
where products inject personality, tools, and modalities without retraining.

## Related

- [[Tool Use]] — tools are declared to the model through this prompt
- [[Fine-Tuning]] — the training-time counterpart of behavior shaping
- [[Prompt Injection]] — why the system prompt cannot be a security boundary
