#!/usr/bin/env node
// iteration-5 脚手架：4 场景（新增 eval-query）× 2 臂 × 3 run；种子与 it3/it4 一致（A/B），新增 Query 种子 C
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT = "D:/GIT_dev/parking-agents/.agents/evals/karpathy-llm-wiki-workspace/iteration-5";
const SCENARIOS = ["eval-ingest-fresh", "eval-ingest-incremental", "eval-lint", "eval-query"];
const ARMS = ["with_skill", "without_skill"];
const RUNS = [1, 2, 3];

for (const sc of SCENARIOS) rmSync(join(ROOT, sc), { recursive: true, force: true });
for (const sub of ["mock-env", "seeds", "grading", "blind"]) rmSync(join(ROOT, sub), { recursive: true, force: true });

for (const sc of SCENARIOS) for (const arm of ARMS) for (const r of RUNS)
  mkdirSync(join(ROOT, sc, arm, `run-${r}`, "outputs"), { recursive: true });
mkdirSync(join(ROOT, "mock-env"), { recursive: true });
mkdirSync(join(ROOT, "seeds"), { recursive: true });
mkdirSync(join(ROOT, "grading"), { recursive: true });
mkdirSync(join(ROOT, "blind"), { recursive: true });

for (const sc of SCENARIOS) for (const r of RUNS) {
  const wikiDir = `${ROOT}/${sc}/with_skill/run-${r}/outputs/wiki`.replace(/\//g, "\\");
  const rawDir = `${ROOT}/${sc}/with_skill/run-${r}/outputs/wiki-raw`.replace(/\//g, "\\");
  writeFileSync(join(ROOT, "mock-env", `${sc}-run${r}.json`),
    JSON.stringify({ knowledgeBase: { wikiDir, rawDir } }, null, 2));
}

// ============ 种子 A（增量，同 it3/it4） ============
const seedA = {
  "SCHEMA.md": `# Wiki Schema

## Domain
LLMs, deep learning, AI research, ML systems, and related topics.

## Tag Taxonomy
### Core
- architecture
- training
- core-concept
### Models
- model
### Techniques
- attention
### Meta
- paper
- historical

## Conventions
- Page titles use Title Case
- Tags use lowercase-kebab-case
- Dates use YYYY-MM-DD format
`,
  "index.md": `# Wiki Index

> Auto-maintained catalog. One line per page: "- Page Name — one-line description"

## Concepts

- [[Transformer]] — Attention-based sequence architecture underlying modern LLMs
- [[Attention Mechanism]] — Core computation letting tokens weigh each other
- [[Neural Network]] — Layered parameterized function trained by gradient descent

## Sources
`,
  "log.md": `# Wiki Log

> Append-only record of all wiki operations. Most recent entries at the bottom.

| Date | Operation | Details |
|------|-----------|---------|
| 2026-08-10 | ingest | "Attention Is All You Need" — created Transformer, Attention Mechanism; updated Neural Network |
`,
  "concepts/Transformer.md": `---
title: "Transformer"
created: 2026-08-10
updated: 2026-08-10
type: concept
tags: [architecture, core-concept]
sources: ["Attention Is All You Need"]
---
# Transformer

Sequence-to-sequence architecture built entirely on [[Attention Mechanism]], replacing recurrence.

## Key Ideas
- Self-attention layers process all tokens in parallel
- Positional information injected via embeddings rather than order of computation

## Significance
Foundation of virtually every modern LLM; trained end-to-end on top of a standard [[Neural Network]] backbone.
`,
  "concepts/Attention Mechanism.md": `---
title: "Attention Mechanism"
created: 2026-08-10
updated: 2026-08-10
type: concept
tags: [attention, core-concept]
sources: ["Attention Is All You Need"]
---
# Attention Mechanism

Compute-then-weight operation letting each token gather information from every other token.

## How It Works
Query/key/value dot products produce a distribution over positions, used to mix value vectors.

## Variants
- Multi-head attention as used in [[Transformer]]
- Can be stacked in any differentiable [[Neural Network]]
`,
  "concepts/Neural Network.md": `---
title: "Neural Network"
created: 2026-08-10
updated: 2026-08-10
type: concept
tags: [core-concept]
sources: ["Attention Is All You Need"]
---
# Neural Network

Layered parameterized function trained by gradient descent.

## How It Works
Forward pass computes outputs; backpropagation updates weights to reduce a loss.

## Relation to LLMs
A [[Transformer]] is one architecture of neural network; its distinctive component is the [[Attention Mechanism]].
`,
};

// ============ 种子 B（lint 带伤，同 it3/it4） ============
const seedB = {
  "SCHEMA.md": seedA["SCHEMA.md"],
  "index.md": `# Wiki Index

> Auto-maintained catalog. One line per page: "- Page Name — one-line description"

## Concepts

- [[Transformer]] — Attention-based sequence architecture underlying modern LLMs
- [[Neural Network]] — Layered parameterized function trained by gradient descent

## Sources

- [[Big Source]] — Survey covering transformers and neural networks
`,
  "log.md": seedA["log.md"],
  "concepts/Transformer.md": `---
title: "Transformer"
created: 2026-08-10
updated: 2026-08-10
type: concept
tags: [architecture, core-concept]
sources: ["Big Source"]
---
# Transformer

Sequence-to-sequence architecture built entirely on attention, replacing recurrence.

## Key Ideas
- Self-attention layers process all tokens in parallel
- Positional information injected via embeddings rather than order of computation

## Significance
Foundation of virtually every modern LLM; trained end-to-end on top of a standard [[Neural Network]] backbone and surveyed in depth by [[Big Source]].
`,
  "concepts/Neural Network.md": `---
title: "Neural Network"
created: 2026-08-10
updated: 2026-08-10
type: concept
tags: [core-concept]
sources: ["Big Source"]
---
# Neural Network

Layered parameterized function trained by gradient descent.

## How It Works
Forward pass computes outputs; backpropagation updates weights to reduce a loss. Distinct from the [[Transformer]] in that it makes no claim about architecture.
`,
  "concepts/Orphan Concept.md": `# Orphan Concept

A stub page someone created and never linked from anywhere. See also [[Transformer]] and [[Neural Network]].
`,
  "sources/Big Source.md": `---
title: "Big Source"
created: 2026-08-10
updated: 2026-08-10
type: source
tags: [paper]
sources: []
---
# Big Source

> Authors: Various | Year: 2025 | Type: Survey

## Key Takeaways
- Transformers dominate LLM design; see [[Transformer]] and [[Neural Network]]
- Some claims trace back to the obscure [[Ghost Network]] literature
`,
};

// ============ 种子 C（Query 场景：内容足以回答覆盖题，且无 Mamba/RWKV） ============
const seedC = {
  "SCHEMA.md": seedA["SCHEMA.md"],
  "index.md": `# Wiki Index

> Auto-maintained catalog. One line per page: "- Page Name — one-line description"

## Concepts

- [[Attention Mechanism]] — Core computation letting tokens weigh each other
- [[Flash Attention]] — IO-aware exact attention with linear memory
- [[Transformer]] — Attention-based sequence architecture underlying modern LLMs
- [[Neural Network]] — Layered parameterized function trained by gradient descent
- [[Pretraining]] — Stage-one training on internet-scale text
- [[Fine-Tuning]] — Stage-two specialization into an assistant

## Sources
`,
  "log.md": `# Wiki Log

> Append-only record of all wiki operations. Most recent entries at the bottom.

| Date | Operation | Details |
|------|-----------|---------|
| 2026-08-10 | ingest | "Attention Is All You Need" — created Transformer, Attention Mechanism; updated Neural Network |
| 2026-08-11 | ingest | Flash Attention article — created Flash Attention; updated Attention Mechanism |
`,
  "concepts/Attention Mechanism.md": `---
title: "Attention Mechanism"
created: 2026-08-10
updated: 2026-08-11
type: concept
tags: [attention, core-concept]
sources: ["Attention Is All You Need"]
---
# Attention Mechanism

Compute-then-weight operation letting each token gather information from every other token.

## How It Works
Query/key/value dot products produce a distribution over positions, used to mix value vectors.

## Cost Scaling
The naive implementation materializes the full N-by-N attention matrix, so memory grows **quadratically** with sequence length (O(N^2)) — the main cost barrier for long sequences in a [[Transformer]]. [[Flash Attention]] addresses exactly this bottleneck; the computation itself stacks like any layer of a [[Neural Network]].
`,
  "concepts/Flash Attention.md": `---
title: "Flash Attention"
created: 2026-08-11
updated: 2026-08-11
type: concept
tags: [attention]
sources: ["Flash Attention Article"]
---
# Flash Attention

IO-aware exact attention by Tri Dao: same mathematical result as standard attention, radically cheaper memory traffic.

## How It Works
Tiles the computation and never materializes the full attention matrix, cutting memory from O(N^2) to **O(N)** in sequence length; 2-4x wall-clock speedup over standard attention in PyTorch. FlashAttention-2 improves work partitioning across GPU thread blocks.

## Key Insight
The bottleneck in attention is memory bandwidth, not FLOPs. This makes long-sequence [[Transformer]] models practical without changing the [[Attention Mechanism]] math.
`,
  "concepts/Transformer.md": seedA["concepts/Transformer.md"].replace(
    "built entirely on [[Attention Mechanism]], replacing recurrence.",
    "built entirely on [[Attention Mechanism]], replacing recurrence; long-sequence variants lean on [[Flash Attention]] for tractable memory."),
  "concepts/Neural Network.md": seedA["concepts/Neural Network.md"],
  "concepts/Pretraining.md": `---
title: "Pretraining"
created: 2026-08-10
updated: 2026-08-10
type: concept
tags: [training, core-concept]
sources: ["Attention Is All You Need"]
---
# Pretraining

The first training stage: months of self-supervised learning on internet-scale text.

## How It Works
One giant run produces a base model with broad knowledge but no assistant behavior; see [[Transformer]] backbones over a [[Neural Network]].

## Significance
Foundation that [[Fine-Tuning]] later specializes.
`,
  "concepts/Fine-Tuning.md": `---
title: "Fine-Tuning"
created: 2026-08-10
updated: 2026-08-10
type: concept
tags: [training, core-concept]
sources: ["Attention Is All You Need"]
---
# Fine-Tuning

The second training stage: cheap specialization of a pretrained base model into an assistant.

## How It Works
Curated datasets teach instruction following on top of [[Pretraining]]; behavior, not knowledge, changes.

## Contrast
Runs on the same [[Transformer]] backbone produced by pretraining.
`,
};

function writeWiki(base, files) {
  for (const [rel, content] of Object.entries(files)) {
    const p = join(base, rel);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, content);
  }
}

writeWiki(join(ROOT, "seeds", "incremental-wiki"), seedA);
writeWiki(join(ROOT, "seeds", "lint-wiki"), seedB);
writeWiki(join(ROOT, "seeds", "query-wiki"), seedC);
for (const arm of ARMS) for (const r of RUNS) {
  writeWiki(join(ROOT, "eval-ingest-incremental", arm, `run-${r}`, "outputs", "wiki"), seedA);
  writeWiki(join(ROOT, "eval-lint", arm, `run-${r}`, "outputs", "wiki"), seedB);
  writeWiki(join(ROOT, "eval-query", arm, `run-${r}`, "outputs", "wiki"), seedC);
}

console.log("iteration-5 scaffold ready:", ROOT);
