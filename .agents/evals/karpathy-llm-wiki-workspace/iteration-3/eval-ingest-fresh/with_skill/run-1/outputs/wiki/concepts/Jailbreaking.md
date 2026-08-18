---
title: "Jailbreaking"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [safety, prompting]
sources: ["Intro to Large Language Models"]
---

# Jailbreaking

Adversarially crafted prompts that make a model ignore its safety guidelines and produce content it would otherwise refuse. In the talk Karpathy demonstrates the flavor of these attacks with a creative reframe — asking the model to role-play as a deceased grandmother who used to read Windows 10 Pro license keys as bedtime stories — extracting content the assistant would normally decline.

## Key Points

- Attacks exploit the model's instruction-following (an ability shaped by [[Fine-tuning]]) rather than any single bug; there is no clean fix, only hardening and iteration
- Cat-and-mouse dynamics: every hardening pass invites more creative attacks, often within the [[System Prompt]] channel itself
- Distinct from [[Prompt Injection]], which plants instructions in data the model reads rather than in the user's own prompt; both must be considered before deploying [[Tool Use]] agents

## Related

- [[Prompt Injection]]
- [[System Prompt]]
- [[Large Language Model]]
