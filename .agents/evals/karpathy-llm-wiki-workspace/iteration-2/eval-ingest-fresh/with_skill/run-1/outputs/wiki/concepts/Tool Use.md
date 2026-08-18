---
title: "Tool Use"
created: 2026-08-14
updated: 2026-08-14
type: concept
tags: [agents, prompting]
sources: ["Karpathy Intro to LLMs Talk"]
---

# Tool Use

LLMs are powerful but have native weaknesses: their knowledge has a training
cutoff, they are imperfect at exact arithmetic, and by default they cannot
act on the world. Tool use fixes this by letting the model *call out* to
external capabilities — a browser, a calculator, a Python interpreter, an
image generator, or retrieval over a document database — typically enabled
and described via the [[System Prompt]].

## How It Works

- The model emits a structured request ("search for X", "run this code");
  the surrounding harness executes it, appends the result, and the model
  continues — turning the LLM into a controller/planner while tools supply
  grounding, precision, and freshness.
- This mechanic is the core of agents and of the [[LLM OS]] vision: the model
  as kernel orchestrating peripherals.
- Retrieval tools are also a practical mitigation for [[Hallucination]]:
  answering from fetched documents instead of from parameters alone.

## Security Angle

Every tool widens the attack surface: give the model a browsing or email
tool and [[Prompt Injection]] stops being a nuisance and becomes a weapon —
planted instructions can make the agent spread spam or exfiltrate data.

## Related

- [[System Prompt]]
- [[LLM OS]]
- [[Prompt Injection]]
