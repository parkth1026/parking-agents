# Wiki Index

> Auto-maintained catalog. One line per page: `- [[Page Name]] — one-line description`

## Entities

- [[Andrej Karpathy]] — AI researcher, educator, co-founder of OpenAI, creator of nanoGPT and the "LLM OS" concept
- [[GPT-4]] — OpenAI's flagship multimodal LLM released March 2023
- [[OpenAI]] — AI safety company and research lab; creator of GPT series and InstructGPT (RLHF pipeline)

## Concepts

- [[Transformer]] — Dominant neural network architecture for LLMs; self-attention replaces recurrent connections
- [[Attention Mechanism]] — Core Transformer primitive; each token attends to all others; O(N²) memory baseline
- [[Flash Attention]] — IO-aware exact attention; reduces memory O(N²)→O(N) via tiling; 2-4x speedup
- [[Pretraining]] — First training stage: next-token prediction on massive internet text; produces base model
- [[Fine-Tuning]] — Second training stage: adapts base model to instruction-following on curated Q&A data
- [[RLHF]] — Reinforcement Learning from Human Feedback; aligns LLM using human preference comparisons + PPO
- [[Scaling Laws]] — Power-law relationship between compute/data/params and model performance; Chinchilla result
- [[LLM OS]] — Karpathy's framework: LLM as OS kernel, context window as RAM, tools as syscalls
- [[Tokenization]] — Converting text to integer tokens via BPE; affects performance and model quirks
- [[Context Window]] — Maximum tokens the model can process; the model's working memory / RAM
- [[Prompt Injection]] — Security attack embedding adversarial instructions in content the model retrieves
- [[Retrieval-Augmented Generation]] — Grounding LLM outputs by retrieving relevant documents at inference time

## Sources

- [[Flash Attention Article]] — Article summary: IO-aware exact attention by Tri Dao; O(N) memory, 2-4x speedup
- [[Intro to Large Language Models]] — Karpathy's 2023 YouTube lecture covering full LLM pipeline, scaling laws, and LLM OS
- [[2024-01-15-karpathy-intro-to-llms]] — Raw transcript notes for Karpathy's "Intro to Large Language Models" lecture

## Comparisons

## Queries

- [[trace_report]] — Eval trace: fresh wiki ingest of Karpathy lecture, validation result PASS 9.9/10
