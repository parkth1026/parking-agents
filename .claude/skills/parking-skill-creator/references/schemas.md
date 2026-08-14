# JSON Schemas

This document defines the JSON schemas used by skill-creator.

---

## evals.json

Defines the evals for a skill. Located at `evals/evals.json` within the skill directory.

```json
{
  "skill_name": "example-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "User's example prompt",
      "expected_output": "Description of expected result",
      "files": ["evals/files/sample1.pdf"],
      "expectations": [
        "The output includes X",
        "The skill used script Y"
      ]
    }
  ]
}
```

**Fields:**
- `skill_name`: Name matching the skill's frontmatter
- `evals[].id`: Unique integer identifier
- `evals[].prompt`: The task to execute
- `evals[].expected_output`: Human-readable description of success
- `evals[].files`: Optional list of input file paths (relative to skill root)
- `evals[].expectations`: List of verifiable statements

---

## history.json

Tracks version progression in Improve mode. Located at workspace root.

```json
{
  "started_at": "2026-01-15T10:30:00Z",
  "skill_name": "pdf",
  "current_best": "v2",
  "iterations": [
    {
      "version": "v0",
      "parent": null,
      "expectation_pass_rate": 0.65,
      "grading_result": "baseline",
      "is_current_best": false
    },
    {
      "version": "v1",
      "parent": "v0",
      "expectation_pass_rate": 0.75,
      "grading_result": "won",
      "is_current_best": false
    },
    {
      "version": "v2",
      "parent": "v1",
      "expectation_pass_rate": 0.85,
      "grading_result": "won",
      "is_current_best": true
    }
  ]
}
```

**Fields:**
- `started_at`: ISO timestamp of when improvement started
- `skill_name`: Name of the skill being improved
- `current_best`: Version identifier of the best performer
- `iterations[].version`: Version identifier (v0, v1, ...)
- `iterations[].parent`: Parent version this was derived from
- `iterations[].expectation_pass_rate`: Pass rate from grading
- `iterations[].grading_result`: "baseline", "won", "lost", or "tie"
- `iterations[].is_current_best`: Whether this is the current best version

---

## grading.json

Output from the grader agent. Located at `<run-dir>/grading.json`.

```json
{
  "results": [
    {
      "name": "The output includes the name 'John Smith'",
      "text": "outputs/names.txt 列出姓名 John Smith，与输入一致",
      "passed": true,
      "evidence": "Found in transcript Step 3: 'Extracted names: John Smith, Sarah Johnson'"
    },
    {
      "name": "The spreadsheet has a SUM formula in cell B10",
      "text": "未产出表格，只有文本文件",
      "passed": false,
      "evidence": "No spreadsheet was created. The output was a text file."
    }
  ],
  "eval_feedback": "断言 1 对任何提及该名字的幻觉输出也会通过，建议改为要求姓名与输入文件的联系人字段一致"
}
```

**Fields (the aggregate script and viewer read these exactly):**
- `results[]`: One entry per assertion, same order as given
  - `name`: Assertion name (from eval_metadata.json assertions, falls back to the text)
  - `text`: Required, string — the grader's finding statement
  - `passed`: Required, boolean — a non-boolean value is treated as FAIL downstream
  - `evidence`: Required — missing evidence counts as a doubtful FAIL (burden of proof is on the expectation)
- `eval_feedback`: Improvement suggestions for the evals as a string; empty string when the evals look solid. An empty assertion set must be called out here as "无区分度"
- Optional extras (`claims`, `user_notes_summary`) follow the grader instructions in `agents/grader.md`

**Boundary behavior (aggregate side):** assertions whose `passed` is not a real boolean count as FAIL; an empty `results` array yields pass_rate 0 for the run.

---

## metrics.json

Output from the executor agent. Located at `<run-dir>/outputs/metrics.json`.

```json
{
  "tool_calls": {
    "Read": 5,
    "Write": 2,
    "Bash": 8,
    "Edit": 1,
    "Glob": 2,
    "Grep": 0
  },
  "total_tool_calls": 18,
  "total_steps": 6,
  "files_created": ["filled_form.pdf", "field_values.json"],
  "errors_encountered": 0,
  "output_chars": 12450,
  "transcript_chars": 3200
}
```

**Fields:**
- `tool_calls`: Count per tool type
- `total_tool_calls`: Sum of all tool calls
- `total_steps`: Number of major execution steps
- `files_created`: List of output files created
- `errors_encountered`: Number of errors during execution
- `output_chars`: Total character count of output files
- `transcript_chars`: Character count of transcript

---

## timing.json

Wall clock timing for a run — exactly one file per run directory. Located at `<run-dir>/timing.json`.

**How to capture:** When a subagent task completes, the task notification includes `total_tokens` and `duration_ms`. Save these immediately — they are not persisted anywhere else and cannot be recovered after the fact.

```json
{
  "total_tokens": 48213,
  "duration_ms": 137000
}
```

**Fields:**
- `total_tokens`: Token usage; `null` when unavailable
- `duration_ms`: Wall-clock duration in milliseconds; `null` when unavailable

**Boundary behavior:** `null` values are silently skipped by the aggregator (that run's corresponding statistic is excluded) and counted in the config's `skipped` counters — not an error.

---

## benchmark.json

Output from `scripts/aggregate-benchmark.mjs`. Located at `<iteration-dir>/benchmark.json`.

```json
{
  "iteration": "iteration-1",
  "skill_name": "log-classifier",
  "configs": {
    "with_skill": {
      "runs": 6,
      "pass_rate": { "mean": 0.8333, "stddev": 0.2041, "min": 0.5, "max": 1.0 },
      "time_ms": { "mean": 131000, "stddev": 9000, "min": 120000, "max": 142000 },
      "tokens": { "mean": 51000, "stddev": 6000, "min": 44000, "max": 58000 },
      "skipped": { "time_ms": 0, "tokens": 0 }
    },
    "without_skill": {
      "runs": 6,
      "pass_rate": { "mean": 0.4444, "stddev": 0.2168, "min": 0.0, "max": 1.0 },
      "time_ms": { "mean": 155000, "stddev": 15000, "min": 140000, "max": 175000 },
      "tokens": { "mean": 62000, "stddev": 8000, "min": 52000, "max": 71000 },
      "skipped": { "time_ms": 1, "tokens": 1 }
    }
  },
  "delta": { "pass_rate": 0.3889, "time_ms": -24000, "tokens": -11000 },
  "evals": ["eval-日志归类表格", "eval-跨文件去重"],
  "warnings": []
}
```

**Fields:**
- `iteration`: Directory name of the iteration
- `configs`: Discovered dynamically — any `eval-*/<config>/run-*` layout counts (with_skill / without_skill / old_skill / anything else, kept verbatim as keys)
  - `runs`: Total number of runs pooled across evals for that config
  - `pass_rate` / `time_ms` / `tokens`: mean / stddev (sample, n-1) / min / max — stddev is 0 for single-run configs
  - `skipped`: Runs excluded per metric due to `null` timing values
- `delta`: First config minus second config (alphabetical order puts with_skill before without_skill); numeric, not strings
- `evals`: Eval directory names in order
- `warnings`: Non-fatal scan issues (missing grading.json etc.)

`benchmark.md` is a human-readable rendering of the same data, field for field.

---

## trigger-evals.json

Trigger-eval query set (subagent probe mechanism). Located at the workspace root (`<skill-name>-workspace/trigger-evals.json`).

```json
{
  "skill": "log-classifier",
  "queries": [
    { "id": "q1", "text": "把 D:/logs/ 下的失败日志按错误模式归类", "should_trigger": true },
    { "id": "q5", "text": "帮我把这段报错截图里的英文翻译成中文", "should_trigger": false }
  ]
}
```

**Fields:**
- `skill`: The skill name under test (must match the `SKILL:` probe protocol value)
- `queries[]`: ~20 realistic queries mixing should-trigger and should-not-trigger; the most valuable negatives are near-misses (shared keywords, different intent)
  - `id`: Stable short id, referenced by probe results
  - `text`: A realistic user request, concrete and specific
  - `should_trigger`: Whether reading this skill would be the right call

**Probe discipline:** the probe prompt must NOT contain the expected answer or any hint of the evaluation intent (anti-leak).

---

## probe-results.jsonl

One line per probe, appended by the orchestrating agent as probes complete. Located at the workspace root.

```jsonl
{"query_id": "q1", "probe": 1, "first_line": "SKILL: log-classifier", "triggered": true, "reason": "日志归类任务", "description": "分类 Jenkins 失败日志…"}
{"query_id": "q5", "probe": 1, "first_line": "SKILL: none", "triggered": false, "reason": "翻译任务", "description": "分类 Jenkins 失败日志…"}
{"query_id": "q3", "probe": 2, "first_line": "我认为这个任务不需要技能", "triggered": false, "description": "分类 Jenkins 失败日志…"}
```

**Fields:**
- `query_id`, `probe`: Identifiers (probe = 1..N, default 3 per query)
- `first_line`: The verbatim first line of the probe's reply — the ONLY judgment source. `SKILL: <skill-name>` = trigger, `SKILL: none` (or another skill's name) = no trigger, anything not matching the protocol = `invalid` (never guessed)
- `triggered` / `reason`: Convenience preview fields; the aggregator re-derives the verdict from `first_line`
- `description`: The description under test in this round — probes with the same description form one round; omit for a single-round run

---

## trigger-benchmark.json

Output from `scripts/aggregate-trigger.mjs`. Located at the workspace root.

```json
{
  "skill": "log-classifier",
  "split": { "train": ["q1", "q3", "q4", "q6"], "test": ["q2", "q5"], "seed": 42, "holdout": 0.4 },
  "rounds": [
    {
      "description": "分类 Jenkins 失败日志…",
      "train": { "queries": 4, "trigger_rate_on_should": 0.9, "false_trigger_rate_on_should_not": 0.1, "correct": 3, "invalid_queries": 0 },
      "test":  { "queries": 2, "trigger_rate_on_should": 0.8, "false_trigger_rate_on_should_not": 0.1, "correct": 2, "invalid_queries": 0 }
    }
  ],
  "best_description": "分类 Jenkins 失败日志…",
  "invalid_probes": 1
}
```

**Fields:**
- `split`: train/test 60/40 stratified by should_trigger (official run_loop caliber; deterministic shuffle with the recorded seed), test gets at least one query per stratum
- `rounds[]`: One entry per description tested; within each split:
  - `trigger_rate_on_should`: Fraction of should-trigger queries where the majority of valid probes triggered (strict majority, default 3 probes per query)
  - `false_trigger_rate_on_should_not`: Fraction of should-not-trigger queries that (wrongly) triggered
  - `correct`: test/train correctness count (should→triggered + should-not→quiet)
  - `invalid_queries`: Queries with zero valid probes (excluded from rate denominators)
- `best_description`: Picked by test `correct` count (anti-overfitting); ties go to the earlier round
- `invalid_probes`: Total probe lines whose first line did not match the protocol

---

## feedback.json

Written by the eval viewer (POST /api/feedback) or hand-written by the agent in `--static` mode. Located at `<iteration-dir>/feedback.json`.

```json
{
  "reviews": [
    { "eval": "eval-日志归类表格", "config": "with_skill", "run": "run-1",
      "comment": "表格第二列太宽，下轮限定错误签名 ≤40 字符" },
    { "eval": "eval-跨文件去重", "config": "with_skill", "run": "run-2",
      "comment": "" }
  ],
  "status": "complete"
}
```

**Fields:**
- `reviews[]`: One entry per eval × config × run on final submit
  - `comment`: Empty string means the reviewer was satisfied with that run
- `status`: `in_progress` while auto-saving, `complete` after "Submit All Reviews"

In `--static` mode there is no server: the viewer downloads the file (or feedback goes through the conversation) and the agent writes the same structure by hand.

---

## comparison.json

Output from blind comparator. Located at `<grading-dir>/comparison-N.json`.

```json
{
  "winner": "A",
  "reasoning": "Output A provides a complete solution with proper formatting and all required fields. Output B is missing the date field and has formatting inconsistencies.",
  "rubric": {
    "A": {
      "content": {
        "correctness": 5,
        "completeness": 5,
        "accuracy": 4
      },
      "structure": {
        "organization": 4,
        "formatting": 5,
        "usability": 4
      },
      "content_score": 4.7,
      "structure_score": 4.3,
      "overall_score": 9.0
    },
    "B": {
      "content": {
        "correctness": 3,
        "completeness": 2,
        "accuracy": 3
      },
      "structure": {
        "organization": 3,
        "formatting": 2,
        "usability": 3
      },
      "content_score": 2.7,
      "structure_score": 2.7,
      "overall_score": 5.4
    }
  },
  "output_quality": {
    "A": {
      "score": 9,
      "strengths": ["Complete solution", "Well-formatted", "All fields present"],
      "weaknesses": ["Minor style inconsistency in header"]
    },
    "B": {
      "score": 5,
      "strengths": ["Readable output", "Correct basic structure"],
      "weaknesses": ["Missing date field", "Formatting inconsistencies", "Partial data extraction"]
    }
  },
  "expectation_results": {
    "A": {
      "passed": 4,
      "total": 5,
      "pass_rate": 0.80,
      "details": [
        {"text": "Output includes name", "passed": true}
      ]
    },
    "B": {
      "passed": 3,
      "total": 5,
      "pass_rate": 0.60,
      "details": [
        {"text": "Output includes name", "passed": true}
      ]
    }
  }
}
```

---

## analysis.json

Output from post-hoc analyzer. Located at `<grading-dir>/analysis.json`.

```json
{
  "comparison_summary": {
    "winner": "A",
    "winner_skill": "path/to/winner/skill",
    "loser_skill": "path/to/loser/skill",
    "comparator_reasoning": "Brief summary of why comparator chose winner"
  },
  "winner_strengths": [
    "Clear step-by-step instructions for handling multi-page documents",
    "Included validation script that caught formatting errors"
  ],
  "loser_weaknesses": [
    "Vague instruction 'process the document appropriately' led to inconsistent behavior",
    "No script for validation, agent had to improvise"
  ],
  "instruction_following": {
    "winner": {
      "score": 9,
      "issues": ["Minor: skipped optional logging step"]
    },
    "loser": {
      "score": 6,
      "issues": [
        "Did not use the skill's formatting template",
        "Invented own approach instead of following step 3"
      ]
    }
  },
  "improvement_suggestions": [
    {
      "priority": "high",
      "category": "instructions",
      "suggestion": "Replace 'process the document appropriately' with explicit steps",
      "expected_impact": "Would eliminate ambiguity that caused inconsistent behavior"
    }
  ],
  "transcript_insights": {
    "winner_execution_pattern": "Read skill -> Followed 5-step process -> Used validation script",
    "loser_execution_pattern": "Read skill -> Unclear on approach -> Tried 3 different methods"
  }
}
```
