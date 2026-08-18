---
title: Jailbreaks
tags: [security]
status: draft
created: 2026-08-18
updated: 2026-08-18
source: "Andrej Karpathy, 'Intro to Large Language Models' (YouTube talk, ~1h, 2023), security section"
---

# Jailbreaks

> A jailbreak is an attack by *the user* on the model: crafting a conversation
> that makes the assistant ignore its guidelines and produce content it was
> trained to refuse. The canonical example is DAN — "Do Anything Now" — an
> elaborate persona users maintained to talk models out of their rules.

## Key ideas

- **Attacker position.** The user is the attacker. This distinguishes
  jailbreaks from [Prompt injection](prompt-injection.md), where the attacker
  is a third party whose text the model reads.
- **Why it works.** Safety behavior is not a hard boundary inside the network —
  it was instilled by [Fine-tuning](fine-tuning.md) data and is shored up by
  [System prompts](system-prompts.md). All of it is text conditioning a
  next-token predictor (see [What are LLMs?](what-are-llms.md)); sufficiently
  creative conditioning can steer the model around it.
- **The DAN example.** Communities on Reddit iterated on "Do Anything Now"
  personas — an alternate character the model is asked to play, freed from the
  usual constraints — as a repeatable jailbreak recipe.

## Dynamics

- **Cat and mouse.** Vendors patch by adjusting fine-tunes and system prompts;
  attackers find new formulations; some attacks are found by red teams first.
  Expect a permanent arms race rather than a fixed solution.
- **Scale of stakes.** A successful jailbreak is a bug in a deployed product —
  which is why Karpathy presents security alongside capability, as a
  first-class concern of the emerging LLM ecosystem (see
  [LLM OS](llm-os.md)).

## Related attack vectors (same root cause, different position)

| Vector | Attacker | Channel |
|---|---|---|
| Jailbreak | The user | The conversation itself |
| [Prompt injection](prompt-injection.md) | Third party | Content the model ingests via tools |
| Data poisoning | Third party | Text planted on the internet before training (see [Pretraining](pretraining.md)) |

## Open questions

- Can refusal be made robust in the weights, or will conditioning always be
  attackable by more clever conditioning?
- How should models handle "harmless" jailbreaks vs. genuinely dangerous ones?

## See also

- [Prompt injection](prompt-injection.md) — the indirect, third-party variant.
- [System prompts](system-prompts.md) — the (soft) line being attacked.
- [Fine-tuning](fine-tuning.md) — where safety behavior comes from.
- [Pretraining](pretraining.md) — the data-ingestion attack surface.

## References

- Andrej Karpathy, "Intro to Large Language Models" (YouTube talk, ~1h, 2023) — security section: jailbreaks, DAN, attacks on LLMs.
