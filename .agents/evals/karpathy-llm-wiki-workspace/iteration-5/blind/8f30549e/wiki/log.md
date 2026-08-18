# Wiki Log

> Append-only record of all wiki operations. Most recent entries at the bottom.

| Date | Operation | Details |
|------|-----------|---------|
| 2026-08-10 | ingest | "Attention Is All You Need" — created Transformer, Attention Mechanism; updated Neural Network |
| 2026-08-11 | ingest | Flash Attention article — created Flash Attention; updated Attention Mechanism |
| 2026-08-18 | query | Q1: attention cost scaling + what Flash Attention changed; Q2: Mamba/RWKV coverage. Consulted: Attention Mechanism, Flash Attention, Transformer (concepts/). Result: Q1 answered from wiki (O(N^2) memory; Flash Attention cuts to O(N), IO-aware, exact); Q2: Mamba/RWKV NOT covered (full-text grep over wiki: zero hits; only tangential "replacing recurrence" on Transformer). Autonomous decisions (batch mode, no user): (a) archiving step skipped — simple lookups, not a comparison or complex multi-page answer; (b) rawDir missing but NOT created — Query operation never touches raw sources. |
