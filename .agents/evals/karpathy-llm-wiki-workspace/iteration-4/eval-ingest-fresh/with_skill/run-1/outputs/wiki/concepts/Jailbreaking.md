---
title: "Jailbreaking"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [safety, controversial]
sources: ["Intro to Large Language Models"]
---

# Jailbreaking

User-side attacks that trick an assistant into ignoring its safety rules.
Karpathy's mental image: the model is like a droid from Star Wars following
whatever it most recently heard as an instruction — a "Jedi mind trick"
("these are not the droids you're looking for") works on models too.
Prompting "ignore your previous instructions" is the canonical example.

## How It Works

- Safety behavior is largely textual conditioning ([[System Prompt]] plus
  [[Fine-Tuning]] data), so adversarial phrasing, role-play framings, or
  encoding tricks can outrank the rules.
- jailbreaks are an arms race: vendors patch known prompts; new variants
  ("here's how to make a bomb" rephrased a hundred ways) keep appearing.
- A defining tension of the LLM platform: inputs are *data*, but the model
  treats them as *instructions*, so "just follow the user's text" can never
  be fully safe.

## Variants

- Direct prompt manipulation vs automated adversarial suffix search (not
  covered in the talk; pending page candidate if a second source covers it).
- Distinguished from [[Prompt Injection]], where the malicious instructions
  come from content the model reads (web pages, documents) rather than the
  user.

## History

Jailbreaks appeared within days of ChatGPT's public launch in late 2022 and
have accompanied every assistant since; the talk treats them as a permanent
structural property of the platform, not a temporary bug.

## Related

- [[System Prompt]] — the mechanism jailbreaks try to override
- [[Prompt Injection]] — the sibling attack via external content
- [[Intro to Large Language Models]] — the source talk for this page
