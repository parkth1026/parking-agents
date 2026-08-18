---
title: "System Prompt"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [prompting, agents]
sources: ["Intro to Large Language Models"]
---

# System Prompt

A hidden block of text prepended to every conversation that steers a
fine-tuned assistant's behavior: its identity ("You are ChatGPT"), its rules,
capabilities, and tone. The user never sees it, but it shapes every reply.

## How It Works

- The model is a text-in/text-out function; the system prompt is simply
  always-on input that conditions the output.
- Identity claims come from here, not introspection: when an assistant says
  "I'm ChatGPT", that's the system prompt talking, not the model discovering
  itself. Karpathy jokes that the same weights would happily claim to be
  something else if prompted so.
- System prompts work alongside [[Fine-Tuning]] (which sets the deep
  defaults) and configure how [[Tool Use]] is exposed to users.
- Because the model cannot reliably distinguish instruction provenance,
  carefully crafted user input can override the intended rules — the
  mechanism behind [[Jailbreaking]] — and instructions hidden in *other*
  content it reads give rise to [[Prompt Injection]].

## Variants

- Per-app customization (developer-written system prompts over a shared base
  model), "custom instructions" exposed to users.

## History

System-style conditioning predates chat products, but it became the standard
control surface for assistant deployments as fine-tuned models shipped to
millions of users.

## Related

- [[Fine-Tuning]] — the training-time counterpart of runtime steering
- [[Jailbreaking]] — attacks that abuse the same channel
- [[Tool Use]] — capabilities the system prompt typically describes
- [[Intro to Large Language Models]] — the source talk for this page
