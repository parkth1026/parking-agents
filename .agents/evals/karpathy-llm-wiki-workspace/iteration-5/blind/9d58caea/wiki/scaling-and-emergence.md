# Scaling and emergence

> **Source:** Karpathy, *Intro to Large Language Models* (2023) · **Status:** initial ingest · [Home](home.md)

**Summary:** One of the most remarkable empirical facts about LLMs: **they scale reliably.** More parameters + more data + more compute predictably yields better next-token prediction, and capabilities keep appearing — some anticipated, some surprising. Emergence is why the field believes bigger (and better-trained) models keep paying off.

## Scaling laws

- Measured over and over: as you grow the model, the data, and the compute together, the prediction loss falls **smoothly and predictably**. You can extrapolate a big run from small experiments.
- Karpathy emphasized how unusual this is — most engineering domains do not offer a dial you can turn where quality improves this dependably. It is the engine behind the entire industry's capex bet.
- Corollary: labs train the largest models they can afford, because the payoff is a near-certainty by the scaling curves.

## The timeline (as shown in the talk)

| Model | Year | Parameters | Note |
|---|---|---|---|
| GPT-1 | 2018 | ~150M | proof of concept |
| GPT-2 | 2019 | 1.5B | "too dangerous to release" by 2019 standards |
| GPT-3 | 2020 | 175B | few-shot learning appears |
| GPT-3.5 / ChatGPT | 2022 | undisclosed | fine-tuned assistant; mass adoption |
| GPT-4 | 2023 | undisclosed (rumored ~1T — speculation) | multimodal input |

Look at the trend line: roughly **10x per year or faster** in effective capability over this window.

## Emergent capabilities

- **In-context / few-shot learning (the GPT-3 surprise):** with no weight updates at all, put a few solved examples in the prompt and the model continues the pattern. The model "learns" from the prompt itself. This appeared at scale and surprised essentially everyone, including the paper's authors' expectations.
- **Skills nobody explicitly trained:** arithmetic, translation, code, chain-of-thought-ish reasoning — all fallout of "predict the next token over the internet" at scale. Capabilities are hard to enumerate up front; new ones keep being discovered as models grow.
- **Multimodality:** models gained "eyes and ears" — images and audio in and (increasingly) out. Video and other modalities are the obvious next steps.

## Known limitations (also part of the picture)

- **Hallucination** — models improvise facts rather than admit uncertainty (see [Fine-tuning](fine-tuning.md)).
- **Exact math and precise execution** — shaky out of the box; mitigated by attaching tools (see [Tool use](tool-use.md)).
- **Knowledge cutoff** — the model only knows its pretraining data; current events need browsing.
- The trend assumption in the talk: these limitations shrink as models scale and gain tools — "it will only get better from here," not because of magic but because the curve has been dependable.

## Related

- [What is an LLM?](what-is-an-llm.md) — what exactly is scaling.
- [Pretraining](pretraining.md) — where the compute goes.
- [The LLM OS](llm-os.md) — what dependable scaling implies about the ecosystem.
- [Glossary](glossary.md) — scaling laws, in-context learning, emergence, multimodality.
