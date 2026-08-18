#!/usr/bin/env node
// iteration-3 脚手架：mock-env + 种子 wiki（增量场景干净种子 / lint 场景带伤种子）
// 种子对 with/without 两臂完全一致，保证对照公平。
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT = "D:/GIT_dev/parking-agents/.claude/skills/karpathy-llm-wiki-workspace/iteration-3";

for (const sub of ["mock-env", "seeds", "eval-ingest-fresh", "eval-ingest-incremental", "eval-lint", "audit-run"])
  rmSync(join(ROOT, sub), { recursive: true, force: true });

const ARMS = ["with_skill/run-1/outputs", "without_skill/run-1/outputs"];
const SCENARIOS = ["eval-ingest-fresh", "eval-ingest-incremental", "eval-lint"];

for (const sc of SCENARIOS) for (const arm of ARMS)
  mkdirSync(join(ROOT, sc, arm), { recursive: true });
mkdirSync(join(ROOT, "audit-run", "outputs"), { recursive: true });
mkdirSync(join(ROOT, "mock-env"), { recursive: true });

// ---- mock-env（with_skill 臂的配置环境层；agent 侧按 SKILL_ENV 解析链消费） ----
for (const sc of SCENARIOS) {
  const wikiDir = `${ROOT}/${sc}/with_skill/run-1/outputs/wiki`.replace(/\//g, "\\");
  const rawDir = `${ROOT}/${sc}/with_skill/run-1/outputs/wiki-raw`.replace(/\//g, "\\");
  writeFileSync(join(ROOT, "mock-env", `${sc}.json`),
    JSON.stringify({ knowledgeBase: { wikiDir, rawDir } }, null, 2));
}

// ---- 主种子留档 ----
const SEEDS = join(ROOT, "seeds");

// ============ 种子 A：增量场景的干净初始 wiki（预期 10/10） ============
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

// ============ 种子 B：lint 场景的带伤 wiki（预期 < 9 分） ============
// 植入问题：断链1([[Ghost Network]])、孤儿+缺frontmatter1(Orphan Concept)、索引缺页1、出链不足1(Neural Network)
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

function writeWiki(base, files) {
  for (const [rel, content] of Object.entries(files)) {
    const p = join(base, rel);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, content);
  }
}

writeWiki(join(SEEDS, "incremental-wiki"), seedA);
writeWiki(join(SEEDS, "lint-wiki"), seedB);
for (const arm of ARMS) {
  writeWiki(join(ROOT, "eval-ingest-incremental", arm, "wiki"), seedA);
  writeWiki(join(ROOT, "eval-lint", arm, "wiki"), seedB);
}

console.log("iteration-3 scaffold ready at", ROOT);
