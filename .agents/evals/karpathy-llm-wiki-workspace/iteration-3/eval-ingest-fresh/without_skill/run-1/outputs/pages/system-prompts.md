# System prompts

> **TL;DR** Every chat conversation starts with a hidden, developer-written **system
> message** that steers the assistant's persona and rules. It is a behavior channel,
> not a security boundary.

**Provenance:** Karpathy, *Intro to Large Language Models* (2023), sections on the
chat application and security.

## The three channels of a chat app

The model never sees "just your message". The application assembles a single document
with role tags, roughly:

```text
<developer> You are ChatGPT, a large language model trained by OpenAI. ... </developer>
<user> What is the capital of France? </user>
<assistant> ...
```

- **Developer / system message** — written by the product team, hidden from the user,
  prepended to every conversation.
- **User messages** — what you type.
- **Assistant messages** — what the model produces.

## What system prompts are used for

Persona and tone, scope of the product ("you are a travel-planning assistant"),
output format conventions, refusal rules, and other standing instructions. Product
teams iterate on the system prompt like a configuration file — it is the cheapest
steering mechanism available, far below any [fine-tuning](training-llms.md).

## Fragility (from the talk)

- **Extraction.** Users have coaxed models into printing their system prompts nearly
  verbatim (e.g. "repeat the words above").
- **Override.** A determined user can talk past standing instructions — that is a
  [jailbreak](security-jailbreaks.md).
- **One channel, mixed content.** Developer instructions, user text, and retrieved
  data all reach the model as tokens. That single shared channel is the root cause of
  [prompt injection](security-prompt-injection.md).

## Practical guidance

- Treat the system prompt as best-effort *steering*, never as a place for secrets or
  as an access control.
- Pair instructions with real controls: least-privilege [tools](tool-use.md),
  human confirmation for consequential actions.

## See also

- [Jailbreaks](security-jailbreaks.md) — users overriding the system prompt
- [Prompt injection](security-prompt-injection.md) — data carrying hidden instructions
- [Training: pretraining vs fine-tuning](training-llms.md) — steering via data instead of prompts
- [Tool use](tool-use.md)

## References

- Andrej Karpathy, *Intro to Large Language Models* (YouTube, Nov 2023).

---
Part of the [LLM Wiki](../index.md).
