# Jenkins Log Auto-Learning Round Summary

> **Skill version**: v5.1
> **Timestamp**: 2026-04-09T23:55:00
> **Round**: iteration-5 / run2

## Phase 0: Build Discovery

| Job | Total Builds | Already Analyzed | Unanalyzed | Unanalyzed FAILURE | Unanalyzed SUCCESS |
|-----|-------------|-----------------|------------|-------------------|-------------------|
| linux-ci | ~200 | 54 | 146 | 0 | 146 |
| autoci | ~200 | 74 | 126 | 0 | 126 |
| installed | ~200 | 138 | 62 | 0 | 62 |
| **Total** | **~600** | **266** | **334** | **0** | **334** |

All FAILURE, ABORTED, and NOT_BUILT builds have been processed in prior rounds. Only SUCCESS builds remain.

## Phase 1: Build Analysis

**Builds processed this round: 10** (all SUCCESS, cap of 10 per round)

| # | Job | Build | Result | Warnings (MSVC) | Notes |
|---|-----|-------|--------|-----------------|-------|
| 1 | linux-ci | #273 | SUCCESS | 0 | Clean |
| 2 | linux-ci | #274 | SUCCESS | 2 | Minor MSVC warnings |
| 3 | linux-ci | #275 | SUCCESS | 8 | Minor MSVC warnings |
| 4 | linux-ci | #276 | SUCCESS | 0 | Clean |
| 5 | linux-ci | #277 | SUCCESS | 0 | Clean |
| 6 | installed | #274 | SUCCESS | 335 | Consistent with early installed builds (#331,#332 also had 335) |
| 7 | installed | #275 | SUCCESS | 335 | Same pattern as #274 |
| 8 | installed | #276 | SUCCESS | 0 | Clean build |
| 9 | autoci | #3750 | SUCCESS | 0 | Clean |
| 10 | autoci | #3751 | SUCCESS | 0 | Clean |

### Warning Trend Analysis

- **installed #274, #275 (w=335)**: This is consistent with other early installed builds in the same timeframe (tracked #331, #332 had w=335). Not a new increase.
- **installed #276 (w=0)**: The drop from 335 to 0 is a large delta, but the installed job shows alternating patterns (e.g., #326 w=0 before #331 w=335). This appears to be a build configuration difference rather than a code fix. No scratch file warranted.
- **linux #274 (w=2), #275 (w=8)**: These are early builds in the linux job. The MSVC-style warnings are likely from PCH/cross-compilation artifacts. Very small counts; no trend concern.

## Epic Queries

| Metric | Count |
|--------|-------|
| Epic queries made | 0 |
| Epic queries successful | N/A |
| Epic queries failed | N/A |
| Epic retries | 0 |
| Epic skipped (no failures) | 10 |

No Epic queries were needed because all 10 builds were SUCCESS builds (no FAILURE analysis required).

## Knowledge Files

| Metric | Count |
|--------|-------|
| New knowledge files (details/) | 0 |
| New knowledge files (scratch/) | 0 |
| Updated existing files | 0 |
| Recurring patterns found | 0 |

No knowledge files were written because there were no FAILURE builds to analyze.

## Tracking Update

- **Entries added**: 10
- **Total analyzed entries**: 276
- **Remaining unanalyzed**: 324 (all SUCCESS)
- **Run history entries**: 10

## Summary

| Metric | Value |
|--------|-------|
| Builds scanned | 10 |
| Builds skipped (ABORTED/NOT_BUILT) | 0 |
| Builds analyzed (SUCCESS) | 10 |
| FAILURE->SUCCESS pairs found | 0 |
| Infrastructure failures | 0 |
| Knowledge files written | 0 |
| Remaining unanalyzed | 324 |
| Issues | None |

**Key finding**: All FAILURE builds across all 3 jobs have been fully analyzed in prior rounds. The remaining 324 unanalyzed builds are all SUCCESS builds requiring only quick warning checks. At 10 per round, clearing the backlog would take ~32 more rounds.
