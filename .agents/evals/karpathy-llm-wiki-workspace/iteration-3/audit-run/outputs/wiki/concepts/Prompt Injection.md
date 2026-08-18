---
title: "Prompt Injection"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [safety, core-concept]
sources: ["Karpathy Intro to LLMs Talk"]
---
# Prompt Injection

Attacks that smuggle instructions into data the model reads, overriding legitimate directions.

## How It Works
Adversarial content in web pages, emails, or tool output gets treated like instructions; jailbreaks are the related craft of bypassing [[System Prompts]] guardrails.

## Why It Matters
The [[Karpathy Intro to LLMs Talk]] calls this the defining security risk of agentic systems: the more [[Tool Use]] an assistant has, the more damage a successful injection can do.
