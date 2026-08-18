# Open questions

> **Source:** Karpathy, *Intro to Large Language Models* (2023) · **Status:** initial ingest · [Home](home.md)

**Summary:** The trends, implications, and honest unknowns the talk ended on — plus this wiki's own to-do list of pages to write next.

## Trends the talk committed to

1. **Capabilities will keep growing.** [Scaling](scaling-and-emergence.md) has been empirically reliable, and there is no sign on the curve of it stopping. Betting against "next year's model" has been a losing bet so far.
2. **Attacks will keep growing.** [Jailbreaks](jailbreaks.md) and [prompt injection](prompt-injection.md) improve in lockstep with capability. More tools and more personal data in context = larger attack surface. An arms race, not a solved problem.

## Big open questions (from the talk and beyond)

- **Jobs and the economy.** Karpathy showed the chart of professions likely to be affected and was blunt: nobody — including him — knows how this plays out over 10 years. Massive uncertainty.
- **Interpretability.** The parameters are open, the meaning isn't ([What is an LLM?](what-is-an-llm.md)). Can we ever actually read what a model computes, or audit it the way we audit code?
- **Security model for the LLM OS.** How do you build privilege separation when instructions and data are the same substance? (See [LLM OS](llm-os.md).)
- **Where does the ecosystem settle?** A few giant hosted models, or a majority of local open models in every device — or both coexisting like servers and embedded chips?
- **Limits of the scaling paradigm.** Data quality/availability, inference cost, reasoning depth — what breaks the curve first, if anything?

## Wiki to-do (planned pages)

- [ ] **Transformer architecture** — attention, tokens in detail (currently a pointer in [What is an LLM?](what-is-an-llm.md)).
- [ ] **RLHF in depth** — reward models, PPO, DPO-style alternatives (stub inside [Fine-tuning](fine-tuning.md)).
- [ ] **Hallucination** — dedicated page: causes, measurement, mitigations (currently split across [Fine-tuning](fine-tuning.md) / [Tool use](tool-use.md)).
- [ ] **Context windows and attention over long documents** — RAG, memory strategies.
- [ ] **Inference and sampling** — temperature, top-k, speed/memory tradeoffs (autoregressive loop in [What is an LLM?](what-is-an-llm.md)).
- [ ] **Evaluation** — benchmarks, the difficulty of measuring capability.
- [ ] **Post-2023 developments** — this wiki's core ingest is from a 2023 talk; a "what changed since" page is needed to stay honest.

## How to use this page

When a topic above starts being researched, create the page, mark it `Status: stub`, and link it from [Home](home.md). Rules for all of this are in [Conventions](conventions.md).
