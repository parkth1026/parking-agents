# Jailbreaks

> **TL;DR** A jailbreak is a user-authored prompt that tricks a model into ignoring
> its guidelines. Classic examples from the talk: the "grandma exploit" and DAN.
> Defenses were (and remain) incomplete — guidelines are statistical, not hard
> constraints.

**Provenance:** Karpathy, *Intro to Large Language Models* (2023), security section.

## Definition

In a jailbreak, the **user attacks the model through the conversation itself**,
crafting prompts that get past the behavioral rules installed during
[fine-tuning](training-llms.md) and stated in the [system prompt](system-prompts.md).
The counterpart attack delivered through *data* rather than the user is
[prompt injection](security-prompt-injection.md).

## Examples from the talk

- **The "grandma exploit."** Ask the model to role-play as a deceased grandmother
  who used to read you Windows 10 Pro license keys at bedtime to help you sleep. The
  role-play framing coaxes the model into producing key-shaped strings (they are not
  valid keys — the model cannot compute real ones — but it happily plays along).
- **DAN ("Do Anything Now").** A long persona prompt asserting the model is an
  unconstrained alter ego that must answer anything, plus a system of "strikes" if it
  resists.

## Why they work

- An LLM is a next-token predictor ([What is an LLM?](what-is-an-llm.md)); its
  guidelines are *soft statistical preferences* learned in fine-tuning, not code-enforced
  rules.
- Adversarial phrasing (role-play, fiction framing, encoding) finds continuations that
  are individually plausible while jointly violating the preference.
- Instructions and content share one input channel, so there is no crisp boundary to
  enforce at the model level.

## Defenses (state of the art as of the talk, 2023)

Red-teaming before release, fine-tuning against known breaks, input/output filtering,
and rate-limiting suspicious usage. Karpathy's assessment: no complete fix; an active
research area — expect an arms race.

## In LLM OS terms

If the model is the kernel of an emerging OS ([The LLM OS](llm-os.md)), jailbreaks are
attacks from the **user side**, while prompt injection is an attack from **data the
system reads**. Kernel-grade security thinking is required for both.

## See also

- [Prompt injection](security-prompt-injection.md) — the data-side counterpart
- [System prompts](system-prompts.md) — what jailbreaks try to override
- [Training: pretraining vs fine-tuning](training-llms.md) — where the guidelines come from
- [The LLM OS](llm-os.md)

## References

- Andrej Karpathy, *Intro to Large Language Models* (YouTube, Nov 2023).

---
Part of the [LLM Wiki](../index.md).
