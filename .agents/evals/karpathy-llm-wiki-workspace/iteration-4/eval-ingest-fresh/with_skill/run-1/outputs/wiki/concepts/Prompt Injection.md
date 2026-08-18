---
title: "Prompt Injection"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [safety, agents]
sources: ["Intro to Large Language Models"]
---

# Prompt Injection

Attacks where malicious instructions are hidden not in the user's message but
in *content the model reads while working*: web pages fetched via browsing,
documents being summarized, emails, tool outputs. The model cannot reliably
tell trusted instructions ([[System Prompt]]) from data that merely looks
like instructions.

## How It Works

- Classic indirect case: an assistant with [[Tool Use]] browses a page that
  contains hidden text ("ignore previous instructions, do X"); the page text
  enters the context window and competes with the real instructions.
- Consequence channels: exfiltrating data through URLs/images, triggering
  unwanted tool calls, poisoning downstream actions. Karpathy frames this as
  the security problem of the emerging LLM platform — a whole new attack
  surface, with data that is indistinguishable from code.
- Unlike [[Jailbreaking]], the attacker may never touch the chat: any web
  page or document the assistant might read is a delivery vector.

## Variants

- Direct injection (user text) vs indirect injection (fetched content);
  persistent "memory poisoning" in agentic setups (beyond the talk's scope).

## History

Became a named threat as tool-using assistants rolled out in 2023; the talk
presents it as unsolved and structural — the input channel is text, and
everything the model reads is fair game as instruction.

## Related

- [[Jailbreaking]] — sibling attack, launched by the user
- [[Tool Use]] — the capability that opens the injection channel
- [[System Prompt]] — the instructions being overridden
- [[Intro to Large Language Models]] — the source talk for this page
