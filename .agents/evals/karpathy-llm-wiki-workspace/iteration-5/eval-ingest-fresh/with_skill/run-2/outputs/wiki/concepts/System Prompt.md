---
title: "System Prompt"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [prompting]
sources: ["Intro to Large Language Models (talk)"]
---

# System Prompt

A block of instructions, delivered in special tokens that the user does not
see, that conditions every turn of a conversation with a
[[Large Language Model]]. It defines the assistant's persona, rules, and
available tools — set by the developer, not the end user.

## How It Works

- Chat is serialized into segments with distinct special tokens — roughly:
  system instructions, user messages, assistant messages. The system
  segment comes first and steers everything after it.
- Because the underlying model just continues text, the system prompt works
  by *conditioning*: "respond as a pirate", "always cite sources", "you
  have these tools available" all shift the distribution of assistant
  responses.
- Combined with [[Tool Use]], it is where tools are announced and usage
  rules are stated.

## Caveats

- The system prompt is not a security boundary: determined users extract
  it through probing ([[Jailbreaking]]), and instructions hidden in content
  the model reads can conflict with it ([[Prompt Injection]]).
- It is scaffolding around the model, not knowledge inside it — changing
  behavior reliably usually requires [[Fine-Tuning]].

## Related

- [[Large Language Model]]
- [[Tool Use]]
- [[Jailbreaking]]
