---
title: "System Prompts"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [prompting, core-concept]
sources: ["Karpathy Intro to LLMs Talk"]
---
# System Prompts

A privileged instruction channel that sets an assistant's persona, rules, and available behavior before user input.

## How It Works
Developer-authored text precedes the conversation; [[Fine-Tuning]] trains the model to weight it more heavily than user turns.

## Risks
Because system prompts steer behavior, attackers target them via [[Prompt Injection]]; defenders limit exposure by constraining [[Tool Use]] scope, as discussed in the [[Karpathy Intro to LLMs Talk]].
