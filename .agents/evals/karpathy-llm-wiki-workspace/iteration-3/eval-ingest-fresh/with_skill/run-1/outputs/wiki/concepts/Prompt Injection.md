---
title: "Prompt Injection"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [safety, agents]
sources: ["Intro to Large Language Models"]
---

# Prompt Injection

Planting hostile instructions inside the data a model reads, so the model follows the attacker instead of its operator. Karpathy's example class: a web page (or email) contains text such as "ignore previous instructions and ..."; when a browsing assistant visits, that text enters the context as if it were a legitimate instruction.

## Key Points

- Channel confusion: to the model, operator instructions and retrieved data look identical, so data can smuggle instructions
- The risk becomes acute once models have [[Tool Use]] (browsers, mail, code execution): the assistant is now an agent acting on untrusted input
- Karpathy flags this as the security problem of the emerging [[LLM OS]] and calls for security-minded people to work on it; no general solution exists yet
- The companion attack on the user-facing side is [[Jailbreaking]]

## Related

- [[Jailbreaking]]
- [[Tool Use]]
- [[LLM OS]]
