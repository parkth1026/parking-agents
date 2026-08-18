---
title: "System Prompt"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [prompting, safety]
sources: ["Intro to Large Language Models"]
---

# System Prompt

A block of custom instructions delivered to the model ahead of the user conversation. It is the main runtime channel for turning a generic assistant (built by [[Fine-tuning]]) into a specialized one, without any retraining.

## Key Points

- Set once, applies across the whole conversation: persona, tone, constraints, output format, domain focus
- Chat products expose this as "custom instructions"; agent frameworks use it to declare available tools and rules (see [[Tool Use]])
- It is also a security surface: attackers try to override it or slip around it — that cat-and-mouse game is [[Jailbreaking]], and when the model reads external data the attack becomes [[Prompt Injection]]

## Related

- [[Large Language Model]]
- [[Fine-tuning]]
- [[Jailbreaking]]
