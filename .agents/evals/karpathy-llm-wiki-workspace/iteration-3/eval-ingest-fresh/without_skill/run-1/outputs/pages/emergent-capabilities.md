# Emergent capabilities at scale

> **TL;DR** Prediction quality improves steadily with scale (parameters, data,
> compute), and qualitatively new abilities show up along the way — most famously
> few-shot **in-context learning**, which Karpathy describes as a bit of an accident
> rather than something that was designed.

**Provenance:** Karpathy, *Intro to Large Language Models* (2023), part 2
("What can LLMs do"). State of the field as of the talk (late 2023).

## Scale keeps working

Through the 2020–2023 generation of models, more of everything — parameters, data,
compute — kept producing better next-token prediction, and each model generation was
markedly more capable in use. As of the talk, Karpathy's expectation was that scaling
(and the surrounding ecosystem) would keep improving capabilities year over year.

## In-context learning (few-shot prompting)

The headline emergent capability:

- Put a handful of input→output **examples inside the prompt** ("here is the pattern:
  a→1, b→2, ...") and the model continues the pattern for a new input.
- **No weight updates are involved** — the "learning" happens entirely inside the
  context window during inference, which is why it is called *in*-context learning.
- It was not an explicit training objective. Models were trained to imitate internet
  documents, and pattern-continuation came along for the ride; Karpathy calls it an
  accidental capability that emerged with scale.

Practically, this is why prompting works at all: steering a model is done by *showing*,
not by retraining (see also [System prompts](system-prompts.md)).

## What LLMs could do by late 2023

By the time of the talk, models were being used across: drafting and summarizing text,
translation, question answering, coding assistance, and domain-specific work, with
products deploying them at consumer scale. Capabilities expected to keep expanding with
scale and with [tool use](tool-use.md).

## Limitations from the talk

- **Hallucination.** Models sometimes state falsehoods with fluent confidence. The
  cause is structural: the model imitates the *texture* of its training text —
  including its confident tone — and its parametric knowledge is lossy
  ([What is an LLM?](what-is-an-llm.md)). Mitigation directions discussed in the talk:
  retrieval/search augmentation (look things up instead of recalling), tool use, and
  uncertainty handling.
- **Knowledge cutoff.** The model only knows its training data up to a cutoff date;
  fresh information requires a browsing tool ([Tool use](tool-use.md)).
- **Not a database.** Facts live implicitly in weights, not as retrievable records, so
  recall is statistical rather than exact.

## Caveats

- "Emergent" here follows the talk's usage: abilities that appear as scale grows. The
  term itself is debated in the literature (some "emergence" is an artifact of how
  capabilities are measured); this page defers that debate to a future page
  (see [index](../index.md) ingest notes).

## See also

- [What is an LLM?](what-is-an-llm.md) — why scale keeps helping prediction
- [Training: pretraining vs fine-tuning](training-llms.md) — where capability (pretraining) and behavior (fine-tuning) split
- [Tool use](tool-use.md) — working around the limits above
- [The LLM OS](llm-os.md)

## References

- Andrej Karpathy, *Intro to Large Language Models* (YouTube, Nov 2023).

---
Part of the [LLM Wiki](../index.md).
