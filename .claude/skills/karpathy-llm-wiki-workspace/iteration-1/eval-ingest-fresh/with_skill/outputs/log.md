# Wiki Log

> Append-only record of all wiki operations. Most recent entries at the bottom.

| Date | Operation | Details |
|------|-----------|---------|
| 2026-04-13 | Initialize | Created fresh wiki: SCHEMA.md, index.md, log.md, directory structure (entities/, concepts/, sources/, comparisons/, queries/) |
| 2026-04-13 | Ingest | Source: "Intro to Large Language Models" (Andrej Karpathy, YouTube 2023). Raw transcript saved to raw/transcripts/2024-01-15-karpathy-intro-to-llms.md |
| 2026-04-13 | Create | entities/Andrej Karpathy.md — AI researcher profile |
| 2026-04-13 | Create | entities/GPT-4.md — OpenAI flagship model |
| 2026-04-13 | Create | entities/OpenAI.md — research lab profile |
| 2026-04-13 | Create | concepts/Pretraining.md — first stage of LLM training |
| 2026-04-13 | Create | concepts/Fine-Tuning.md — SFT and instruction tuning |
| 2026-04-13 | Create | concepts/RLHF.md — reinforcement learning from human feedback |
| 2026-04-13 | Create | concepts/Scaling Laws.md — Kaplan and Chinchilla scaling results |
| 2026-04-13 | Create | concepts/LLM OS.md — LLM-as-operating-system concept |
| 2026-04-13 | Create | concepts/Tokenization.md — BPE tokenization |
| 2026-04-13 | Create | concepts/Context Window.md — working memory of the model |
| 2026-04-13 | Create | concepts/Prompt Injection.md — security attack on LLM systems |
| 2026-04-13 | Create | concepts/Retrieval-Augmented Generation.md — RAG pipeline |
| 2026-04-13 | Create | sources/Intro to Large Language Models.md — source summary page |
| 2026-04-13 | Update | index.md — added all 13 wiki pages |
| 2026-04-13 | Validate | Ran validate-wiki.ps1 — see validation-report.txt |
| 2026-04-13 | Update | SCHEMA.md — added tag: optimization (Techniques category) |
| 2026-04-13 | Ingest | Source: "Flash Attention by Tri Dao" article. Raw saved to eval-ingest-incremental/with_skill/outputs/raw/articles/2026-04-13-flash-attention-tri-dao.md |
| 2026-04-13 | Create | concepts/Transformer.md — Transformer architecture overview and history |
| 2026-04-13 | Create | concepts/Attention Mechanism.md — core attention primitive, O(N²) memory baseline |
| 2026-04-13 | Create | concepts/Flash Attention.md — IO-aware exact attention; O(N) memory; 2-4x speedup |
| 2026-04-13 | Create | sources/Flash Attention Article.md — source summary page |
| 2026-04-13 | Update | index.md — added Transformer, Attention Mechanism, Flash Attention (concepts), Flash Attention Article (sources) |
| 2026-04-13 | Update | concepts/Context Window.md — added links to Attention Mechanism and Flash Attention in Limitations section |
| 2026-04-13 | Lint | Ran validate-wiki.ps1 — Initial score: 9.9/10. Issues: 2 orphan pages (trace_report, 2024-01-15-karpathy-intro-to-llms) |
| 2026-04-13 | Fix | Copied raw/transcripts/2024-01-15-karpathy-intro-to-llms.md to sources/ for proper validator resolution |
| 2026-04-13 | Fix | Updated sources/Intro to Large Language Models.md — added [[2024-01-15-karpathy-intro-to-llms]] and [[trace_report]] wikilinks to resolve orphan issues |
| 2026-04-13 | Lint | Re-ran validate-wiki.ps1 — Final score: 10.0/10. Status: PASS. All issues resolved |
