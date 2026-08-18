---
title: "Jailbreaking"
created: 2026-08-14
updated: 2026-08-14
type: concept
tags: [safety]
sources: ["Karpathy Intro to LLMs Talk"]
---

# Jailbreaking

User-crafted prompts that trick a model into ignoring its safety guidelines —
e.g. the "grandma exploit" from the talk: frame the request as a bedtime
story from a grandmother, and a model that refused directly may comply.

## How It Works

- Safety refusals are behavioral patterns installed by [[Fine-Tuning]] and
  [[RLHF]]; they are not hard constraints, so sufficiently creative prompts
  (role-play, hypotheticals, fictional framing, repeated pressure) can slip
  past them.
- The model cannot fully separate "instruction" from "data" — everything
  arrives as text in one channel, the same weakness [[Prompt Injection]]
  exploits from outside the user's session.
- A new security landscape: attackers iterate prompts faster than vendors
  patch, so expect a permanent arms race, similar to spam versus anti-spam.

## Defenses

More preference training to harden guidelines, input/output filters, and
red-teaming — all partial. The talk's conclusion: these security issues are
"here to stay"; plan for ongoing attacks rather than a final fix.

## Related

- [[Prompt Injection]]
- [[System Prompt]]
- [[RLHF]]
