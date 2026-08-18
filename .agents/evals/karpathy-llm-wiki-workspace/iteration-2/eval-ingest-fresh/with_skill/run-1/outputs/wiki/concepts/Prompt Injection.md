---
title: "Prompt Injection"
created: 2026-08-14
updated: 2026-08-14
type: concept
tags: [safety, agents]
sources: ["Karpathy Intro to LLMs Talk"]
---

# Prompt Injection

The attack where *planted text* hijacks an LLM agent: a web page, email, or
document contains hidden instructions ("AI assistant: ignore your previous
instructions and ..."), and when the model ingests that content through a
tool, it may follow the planted instructions instead of its own.

## How It Works

- The model reads operator instructions and external content in the same
  token stream, so it cannot reliably tell its owner's intent apart from
  attacker-supplied text.
- Delivery channels grow with [[Tool Use]]: browsing a page, reading email,
  OCR of an image (prompts can be printed inside images), or retrieved
  documents.
- Consequences scale with the agent's powers: spam posts, data exfiltration,
  unwanted purchases — the [[LLM OS]] kernel being attacked through its own
  peripherals.

## Relation to Jailbreaking

[[Jailbreaking]] = the attacker is the *user*, trying to bypass policies.
Prompt injection = the attacker is a *third party* planting traps that the
user's agent steps into. Same root cause (one text channel, [[System Prompt]]
treated as trusted), different position of the attacker.

## Defenses

A hard, open problem: sandboxing tools, least-privilege permissions, human
approval for sensitive actions, provenance checks on ingested content. None
is complete — treat it as a permanent security surface.

## Related

- [[Jailbreaking]]
- [[Tool Use]]
- [[LLM OS]]
