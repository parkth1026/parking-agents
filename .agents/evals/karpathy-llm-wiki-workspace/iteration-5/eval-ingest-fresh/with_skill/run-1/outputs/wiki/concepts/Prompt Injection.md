---
title: "Prompt Injection"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [safety, prompting, agents]
sources: ["Intro to Large Language Models"]
---

# Prompt Injection

The defining security risk of tool-using LLM assistants. Instructions are
just tokens in the context window, so text the model *reads* — a browsed web
page, an email, a document — can carry hostile instructions that the model
may follow, while the user believes only their own conversation is in
control.

## How It Works

- Karpathy's attack chain: an attacker plants instructions on a web page;
  during [[Tool Use]] the assistant browses that page; the injected text
  steers the assistant to act against the user — exfiltrating data or taking
  unwanted actions.
- The model cannot reliably tell "instructions I was given" from
  "instructions I happened to read". The [[System Prompt]] and the
  guidelines installed by [[Fine-Tuning]] are advisory text, not a security
  boundary.
- Danger scales with capability: a chat-only model can be talked at, but a
  browsing, tool-calling model can be made to *act*.

## Variants

- **Jailbreaking**: user-crafted prompts that bypass the assistant's
  guidelines (ignore-your-rules, DAN-style role-play). Injection attacks the
  user through content the model reads; jailbreaking attacks the model
  through the user's own turn.
- Multimodal injection: instructions smuggled inside images or other
  non-text inputs.

## History

Became a headline concern as assistants gained browsing and plugins in 2023;
[[Intro to Large Language Models]] presents it (with jailbreaking) as the
open security problem of the assistant era.

## Related

- [[Tool Use]] — what turns injected text into real-world actions
- [[System Prompt]] — text, not a security boundary
- [[LLM OS]] — injection is this future OS's buffer-overflow-class flaw
