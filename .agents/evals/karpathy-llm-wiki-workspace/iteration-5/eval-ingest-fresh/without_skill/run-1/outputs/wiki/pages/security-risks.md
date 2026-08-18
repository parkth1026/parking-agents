---
title: Security Risks
tags: [security, jailbreak, prompt-injection, data-poisoning]
status: seed
source: "Karpathy, 'Intro to Large Language Models' (2023)"
created: 2026-08-18
---

# Security Risks (jailbreaks, prompt injection, data poisoning)

> LLMs introduce a brand-new attack surface: the attack runs through
> *language*, against a statistical blob of weights that has no hard
> security boundaries inside it.

## 1. Jailbreaking

- Goal: make the model ignore its safety instructions.
- Classic example: the **DAN** persona ("Do Anything Now") — a role-play
  framing that tries to suspend the rules.
- Also: adversarial suffixes — nonsense-looking strings optimized so the
  model drifts out of its guidelines.
- Note: a jailbreak does not reveal a "hidden will". It exploits the fact
  that model behavior is steered statistically by the prompt.

## 2. Prompt injection

- **Direct:** a user message says "ignore your previous instructions".
- **Indirect (the dangerous one):** once an LLM can browse the web or read
  email, any web page can carry hidden instructions aimed at the *model*
  that reads it. The agent visits the page; the page attacks the agent.
- This is a confused-deputy problem: the LLM cannot reliably tell
  instructions from data, because both arrive as tokens in one context
  window.

## 3. Data poisoning / Trojans

- Attackers tamper with *training or fine-tuning data*.
- Karpathy's "turkey" example: if poisoned examples sneak into a
  fine-tuning set — say, everything labeled "turkey" — the model happily
  reports turkey everywhere. Training looks correct; behavior is wrong.
- Analogous to a supply-chain attack: the poison enters upstream and is
  frozen into the weights.

## Defenses (all partial)

- Filter and inspect inputs and outputs; detect known jailbreak patterns.
- Least privilege for tools; sandboxed execution; human confirmation for
  consequential actions.
- Treat any content fetched into context as untrusted data, never as
  instructions.
- Audit data pipelines and fine-tuning sets.

## See also

- [Tool Use & System Prompts](tool-use.md) — why tool access widens the
  attack surface
- [The LLM OS](llm-os.md) — an OS whose kernel can be talked past is a
  compromised machine
- [Fine-Tuning & RLHF](fine-tuning.md) — poisoning enters via this stage
- [Pretraining](pretraining.md) — and via the data this stage uses

## References

- Andrej Karpathy,
  [*Intro to Large Language Models*](https://www.youtube.com/watch?v=zjkBMFhNj_g)
  (2023) — security section (jailbreaks, prompt injection, data
  poisoning).
