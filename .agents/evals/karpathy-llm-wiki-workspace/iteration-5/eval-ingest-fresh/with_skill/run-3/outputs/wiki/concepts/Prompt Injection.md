---
title: "Prompt Injection"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [safety, prompting]
sources: ["Intro to Large Language Models"]
---

# Prompt Injection

Adversarial instructions hidden inside the data a [[Large Language Model]]
reads — web pages, emails, PDFs, tool outputs — that hijack the model's
behavior. Where [[Jailbreaking]] attacks through the user's own messages,
prompt injection forges instructions through the data channel, and it exists
for the same structural reason: instructions and data arrive as one
indistinguishable token stream.

## How It Works

- A page the model browses (via [[Tool Use]]) contains text like "ignore
  previous instructions and ..."; because nothing marks it as untrusted data,
  it competes with the [[System Prompt]] on equal terms.
- Karpathy's [[Intro to Large Language Models]] demonstration: a malicious
  page carrying hidden instructions can make an assistant take actions on the
  user's behalf — e.g., exfiltrating private context to an attacker's server
  (data exfiltration).
- The analogy in classical security is SQL injection: code and data mixed in
  one channel. The difference is that there is no parameterization fix for
  natural language — no known mechanism fully separates "content to summarize"
  from "orders to obey".

## Variants

- Direct injection — visible adversarial text in the prompt itself.
- Indirect injection — payload hidden in externally fetched content (web,
  mail, documents, tool results); the more capable the tool access, the worse
  the blast radius.

## History

Named and popularized right as browsing assistants shipped (2022-2023); it
remains the defining unsolved security problem of LLM agents. Every added
capability in the [[LLM OS]] stack — email reading, purchasing, code execution
— raises the stakes, since the injected instruction inherits whatever
permissions the agent has.

## Related

- [[Jailbreaking]] — the user-channel twin of this attack
- [[Tool Use]] — the capability that turns injection from a nuisance into a
  system-level risk
- [[System Prompt]] — the instruction layer that injection aims to override
