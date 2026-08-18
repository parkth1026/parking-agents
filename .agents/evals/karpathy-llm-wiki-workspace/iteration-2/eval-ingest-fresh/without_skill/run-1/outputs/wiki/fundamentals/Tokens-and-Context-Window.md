---
title: Tokens and Context Window
source: "Andrej Karpathy — Intro to Large Language Models (Nov 2023)"
category: fundamentals
tags: [tokens, context-window, working-memory, limitations]
created: 2026-08-14
status: seed
---

# Tokens and Context Window

## Tokens

Models do not read raw characters or words; text is chopped into **tokens**
(frequent chunks of characters). Everything the model consumes and produces —
prompts, answers, [system prompts](../usage/System-Prompts.md), tool
results — is a sequence of tokens.

## The context window is the working memory

The model can only attend to a limited number of tokens at once: the
**context window**. Around the time of the talk this was on the order of
~8,000 tokens — roughly a short story. Karpathy's analogy: it is the model's
**limited working memory**.

Consequences:

- Anything outside the window is invisible — earlier parts of very long
  conversations effectively disappear.
- Very long documents cannot be considered all at once; they must be
  summarized, chunked, or searched.
- The window size is an active axis of improvement and a key spec of every
  model release.

## Why this matters for the rest of the wiki

- It motivates [tool use](../usage/Tool-Use.md): instead of relying on what
  fits in memory (stale, limited), the model can look things up.
- It is central to the [LLM OS](../future/LLM-OS.md) metaphor, where the
  context window plays the role of RAM.

## Related

- [Next-Token Prediction](Next-Token-Prediction.md)
- [Tool Use](../usage/Tool-Use.md)
- [LLM OS](../future/LLM-OS.md)
