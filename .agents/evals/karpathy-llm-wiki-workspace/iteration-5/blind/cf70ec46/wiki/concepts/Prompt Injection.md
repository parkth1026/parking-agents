---
title: "Prompt Injection"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [safety, agents]
sources: ["Intro to Large Language Models (talk)"]
---

# Prompt Injection

Attacks in which the adversary is not the user but the **data**: malicious
instructions hidden in content the model reads while browsing or
retrieving — for example invisible text on a web page telling a browsing
assistant to ignore its [[System Prompt]] and exfiltrate data. As models
gain [[Tool Use]], every fetched page, email, or document becomes a
potential carrier.

## How It Works

- Root cause: the model consumes instructions and data through the same
  channel — plain text in the context window — and cannot reliably tell
  them apart. The talk compares this to SQL injection: code and data were
  conflated there too.
- Because the model has no cryptographic way to authenticate "who is
  speaking", a webpage it fetches can be as persuasive as its developer's
  [[System Prompt]] or the user's request.

## Mitigations (All Partial)

- Restricting tool permissions and requiring human confirmation for
  consequential actions.
- Training models to treat fetched content as untrusted data.
- Sandboxing the execution environment the tools can touch.

The talk's verdict: this is an open, unsolved problem for the agentic
future — unlike [[Jailbreaking]], the attacked party is not even the one
typing.

## Related

- [[Jailbreaking]]
- [[Tool Use]]
- [[System Prompt]]
- [[Large Language Model]]
