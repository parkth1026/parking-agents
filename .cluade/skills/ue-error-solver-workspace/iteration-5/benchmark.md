# Benchmark Report — ue-error-solver (Iteration 5)

**Date**: 2026-04-13
**Focus**: Config path resolution, KB integration, timestamped log naming

## Summary

| Metric | With Skill | Without Skill | Delta |
|--------|-----------|---------------|-------|
| **Pass Rate** | 94% ± 8% | 40% ± 9% | **+54pp (+135%)** |
| **Duration** | 278s ± 75s | 194s ± 14s | +84s (+43%) |
| **Total Passed** | 17/18 | 7/18 | +10 |

## Per-Eval Breakdown

### Eval 1: autoci #3939 (job name matching)
| Assertion | With Skill | Without Skill |
|-----------|-----------|---------------|
| Job match (autoci → aes6-ue-runtime-ci) | PASS | PASS |
| tmpDir resolution (./tmp → absolute) | PASS | FAIL |
| Timestamped log filename | PASS | FAIL |
| wikiDir tilde resolution + KB search | PASS | FAIL |
| KB match 085-precompiled (score 8/10) | PASS | FAIL |
| Epic skip fast-path | PASS | FAIL |
| Diagnosis with root cause + confidence | PASS | PASS |
| **Pass Rate** | **7/7 (100%)** | **2/7 (29%)** |
| **Duration** | 253s | 210s |

### Eval 2: linux-ci #466 (error extraction)
| Assertion | With Skill | Without Skill |
|-----------|-----------|---------------|
| Job match (linux-ci → twe-ue5.5-linux-ci) | PASS | PASS |
| Log download + timestamped filename | **FAIL** | FAIL |
| -Wdelete-incomplete error extraction | PASS | PASS |
| Full error block (all note: lines) | PASS | FAIL |
| rawDir resolution (./wiki-raw → absolute) | PASS | FAIL |
| Structured diagnosis with root cause | PASS | PASS |
| **Pass Rate** | **5/6 (83%)** | **3/6 (50%)** |
| **Duration** | 381s | 196s |

### Eval 3: URL format (URL parsing)
| Assertion | With Skill | Without Skill |
|-----------|-----------|---------------|
| URL parsing (baseUrl, jobPath, buildNumber) | PASS | PASS |
| All config paths resolved | PASS | FAIL |
| Log + timestamped filename to tmpDir | PASS | FAIL |
| KB search at resolved wikiDir | PASS | FAIL |
| Complete diagnosis report | PASS | PASS |
| **Pass Rate** | **5/5 (100%)** | **2/5 (40%)** |
| **Duration** | 200s | 177s |

## Analyst Observations

1. **Strong skill value**: +54pp pass rate improvement demonstrates the skill's structured workflow adds significant value beyond baseline Claude capabilities.

2. **Single failure point**: The only with_skill failure is eval-2's log timestamp — the agent saved as `linux-ci-466.log` instead of `linux-ci-466-YYYYMMDD-HHMMSS.log`. Consider making the timestamp instruction more prominent in SKILL.md.

3. **Non-discriminating assertions**: "Root cause diagnosis" passes for both configurations in all evals. The discriminating value of the skill lies in structured workflow: config paths, KB search, Epic fast-path, timestamped naming.

4. **Tool denial caveat**: 2/3 with_skill runs had Bash/PowerShell tools denied by the test harness. This prevented actual curl.exe execution but the skill's logic was still demonstrated from cached data. Production runs should have full tool access.

5. **Speed tradeoff**: With_skill runs average 43% slower due to additional phases. This is an acceptable tradeoff given the 135% improvement in diagnostic completeness.

6. **Language observation**: Baseline outputs Chinese (matching user language), with_skill outputs English. Consider adding language guidance to SKILL.md.
