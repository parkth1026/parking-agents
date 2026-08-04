---
title: "Retrieval-Augmented Generation"
created: 2026-04-13
updated: 2026-04-13
type: concept
tags: [retrieval, architecture, inference, core-concept]
sources: ["Intro to Large Language Models"]
---

# Retrieval-Augmented Generation

A technique for grounding LLM outputs in external knowledge by retrieving
relevant documents at inference time and including them in the [[Context Window]].
Abbreviated RAG.

## The Core Problem It Solves
LLMs have a knowledge cutoff and cannot access live information. They also
have limited [[Context Window]] size — they cannot hold an entire knowledge base
in memory. RAG solves both by:
1. Indexing documents in a vector database
2. At query time, retrieving the most semantically similar documents
3. Placing retrieved documents into the context window
4. Having the model answer based on retrieved content

## Standard RAG Pipeline
1. **Index**: Chunk documents, compute embeddings, store in vector DB
2. **Retrieve**: Embed the user query, find top-K similar chunks
3. **Augment**: Prepend retrieved chunks to the prompt
4. **Generate**: The model generates an answer grounded in the retrieved context

## Relationship to LLM OS
In [[LLM OS]] terms, RAG is how the model reads from "long-term storage" (hard disk)
into "working memory" (context window). It is the bridge between the model's
fixed parametric knowledge and dynamically accessible external knowledge.

## Variants
- **Dense RAG**: Uses neural embeddings (e.g., FAISS, Pinecone)
- **Sparse RAG**: Uses keyword search (BM25)
- **Hybrid RAG**: Combines dense and sparse retrieval
- **Self-RAG**: Model decides when to retrieve
- **Agentic RAG**: Multi-hop retrieval with reasoning steps

## Limitations
- Retrieval quality depends on embedding quality
- Retrieved chunks may be irrelevant or contradictory
- Increases latency vs. pure parametric answers
- Does not update the model's weights (no persistent learning)

## Related
- [[Context Window]], [[LLM OS]], [[Pretraining]], [[Fine-Tuning]]
