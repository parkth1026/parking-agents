---
title: "Tool Use"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [tool-use]
sources: ["Karpathy Intro to LLMs Talk"]
---
# Tool Use

Extending an LLM beyond text generation by letting it call external capabilities (search, code execution, plugins).

## How It Works
The model emits structured requests a runtime executes; results feed back as context. [[Fine-Tuning]] on tool-calling examples makes this reliable, and [[System Prompts]] configure which tools are offered.

## Risks
Every tool invocation is an attack surface for [[Prompt Injection]] — the [[Karpathy Intro to LLMs Talk]] flags security as a first-class concern in tool-augmented setups.
