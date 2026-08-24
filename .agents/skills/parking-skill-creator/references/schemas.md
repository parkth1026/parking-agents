# JSON Schemas

This document defines the JSON schemas used by skill-creator.

---

## evals.json

Defines the evals for a skill. Located at `<skill-dir>/../../evals/<skill-name>-workspace/evals/evals.json` in the default workspace.

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
- `evals[].files`: Optional list of input file paths (relative to the workspace root)
- `evals[].expectations`: List of verifiable statements

---

## eval_metadata.json

Per-eval metadata written by the orchestrating agent. Located at `<iteration-dir>/eval-<name>/eval_metadata.json`.

```json
{
  "prompt": "把 D:/logs/ 下的失败日志按错误模式归类成表格",
  "assertions": [
    { "name": "表格覆盖全部日志文件", "type": "manual", "ac": "AC-1" },
    { "name": "计数与 grep 结果一致", "type": "script" }
  ]
}
```

**Fields:**
- `prompt`: The user's task verbatim
- `assertions[]`: Objectively checkable statements
  - `name`: Short assertion name shown on the review page
  - `type`: `manual` or `script`
  - `ac`: **Optional** — references an acceptance-condition id (`AC-1`, `AC-2`, …) from this skill's `references/design.md`, tying the assertion back to its design rationale. Format-checked only (`AC-<n>`), reference existence is not validated. Assertions without `ac` remain fully valid (legacy skills need zero migration); graders never reject on a missing `ac`.

---

## history.json（技能目录，已实现）

Append-only eval score ledger. Located at `<skill-dir>/history.json`, distributed with the .skill package. Written **only** by `scripts/aggregate-benchmark.mjs` when invoked with `--history <技能目录>` (the single explicit channel through which the eval loop writes into the skill directory; aggregation without the flag never touches the skill dir). Runs are appended — no existing field is ever rewritten; the top-level `current_best` pointer is the authoritative best-run indicator.

```json
{
  "skill": "feishu-doc-qa",
  "runs": [
    {
      "date": "2026-08-17T14:00:00+08:00",
      "iteration_ref": "<skill-dir>/../../evals/feishu-doc-qa-workspace/iteration-1",
      "gates": {
        "with_skill":     { "pass_rate": 1.00, "mean_ms": 137000, "mean_tokens": 48213 },
        "without_skill":  { "pass_rate": 0.50, "mean_ms": 155000, "mean_tokens": 62000 }
      },
      "vs_previous": null
    },
    {
      "date": "2026-08-17T18:00:00+08:00",
      "iteration_ref": "<skill-dir>/../../evals/feishu-doc-qa-workspace/iteration-2",
      "gates": {
        "with_skill":     { "pass_rate": 1.00, "mean_ms": 121000, "mean_tokens": 44100 },
        "without_skill":  { "pass_rate": 0.50, "mean_ms": 158000, "mean_tokens": 63500 }
      },
      "vs_previous": {
        "evals_total": 2, "won": 1, "lost": 0, "tie": 1,
        "detail": [ { "eval": "eval-贴URL直问", "result": "tie" },
                    { "eval": "eval-例会最新一期", "result": "won" } ]
      },
      "current_best": true
    }
  ],
  "current_best": "runs[1]"
}
```

**Fields:**
- `skill`: Skill name
- `runs[]`: One entry per `--history` aggregation, append-only
  - `date`: Local-timezone ISO timestamp of the aggregation
  - `iteration_ref`: Absolute path of the aggregated iteration dir (the source of this run's data). Local-machine only — for cross-machine consumers it is just a round identifier, not a readable path
  - `gates`: Key = config directory name (gate name), open set — `with_skill` / `without_skill` / `old_skill` / any custom name. Values: `pass_rate` (mean), `mean_ms` / `mean_tokens` (`null` when all timing values were null)
  - `vs_previous`: Comparison against the previous run, matched by exact eval name with pass-boolean flips; `null` for the first run, when the previous iteration's data on disk is unreadable, when re-aggregating the same iteration (no self-comparison), or when the two runs' primary gates are discontinuous (renamed/pure-experimental gates — never recorded as `lost`). New-this-round evals count in `evals_total` but not in won/lost (`detail` marks them `new`); evals present last round but absent this round are marked `dropped` in `detail`, never silently dropped; evals lacking data under the comparison gate on either side count as `tie` (no flip derivable)
  - `current_best`: Snapshot flag written at append time when this run was the best; the authoritative pointer is the top-level `current_best`
- `current_best` (top level): `"runs[N]"`. The **primary gate** is `with_skill`, or the alphabetically-first gate name when absent. The pointer advances only when the primary-gate pass_rate is **strictly** higher — ties never advance (anti-jitter). Two guards against dirty data: rounds whose primary gate name differs from the incumbent best's (pure experimental gates) never advance the pointer; re-aggregating the same `iteration_ref` counts as a correction — a new entry is appended (with a stdout notice) and only the latest entry per `iteration_ref` is a best-candidate, so an early partial aggregate cannot lock the ceiling

**Boundary behavior:** corrupt JSON is backed up as `history.json.corrupt-<YYYYMMDD-HHmmss>` then rebuilt (parse failure / broken top level → rebuild from empty; individual malformed runs → backup, keep the valid ones). `history.json` being a directory, or `--history` pointing at a non-directory / unwritable target: the run is refused with exit code 1, benchmark outputs already written are not rolled back. Writes go through temp-file + atomic rename. Without `--history`, output is byte-identical to the flagless behavior and no history.json is created.

---

## output-evals.json（技能目录，已实现）

Output-eval case set — the prompts and assertions of the current evaluation round. Durable asset at the skill root (`<skill-dir>/output-evals.json`); ships inside the .skill package. Written **only** by `scripts/aggregate-benchmark.mjs` through the same `--history <技能目录>` channel as history.json, so metrics and their case definitions always persist together (a cloner gets the score ledger **and** the questions it was earned on). Atomic full overwrite per aggregation — cross-round content history is carried by git, mirroring trigger-benchmark.json. Rationale: eval_metadata.json lives only in the gitignored workspace; without this file, a fresh clone sees past scores in history.json but cannot reproduce the eval cases that produced them.

```json
{
  "skill": "log-classifier",
  "source_iteration": "iteration-3",
  "evals": [
    {
      "name": "eval-日志归类表格",
      "prompt": "把 D:/logs/ 下的失败日志按错误模式归类成表格",
      "assertions": [
        { "name": "表格覆盖全部日志文件", "type": "manual", "ac": "AC-1" },
        { "name": "计数与 grep 结果一致", "type": "script" }
      ]
    }
  ]
}
```

**Fields:**
- `skill`: Skill name (from `--skill-name` or the benchmark's skill_name)
- `source_iteration`: Directory name of the iteration this case set was aggregated from — identifies which round's evals these are
- `evals[]`: One entry per eval directory, sorted by name
  - `name`: Eval directory name (`eval-<描述性名>`) — the join key matched by history.json's `vs_previous.detail[].eval`
  - `prompt`: The user's task verbatim (empty string when eval_metadata.json was missing — stdout warns "缺 prompt")
  - `assertions[]`: Verbatim from that eval's eval_metadata.json (`name` / `type` / optional `ac`); legacy string assertions are normalized to `{ "name": <string> }`

**Boundary behavior:** written after the history append within the same `--history` run; if the write fails (or the path is a directory) the script refuses with exit code 1 — the already-written benchmark and history.json are not rolled back. Without `--history` the file is never created or touched. `--keep-evals` (focused probe rounds running only a subset of the bank): entries in the existing bank that this round did not run are preserved; this round's entries overwrite same-name ones — stdout reports how many were kept. Without the flag the default whole-file overwrite stands (full rounds intentionally retiring old scenarios rely on it). To rebuild a comparable round after cloning: read this file, recreate each `iteration-N/eval-<name>/eval_metadata.json` from it, then follow SKILL.md 6.1 — same prompts and assertions are what make `vs_previous` comparable across machines.

---

## structure-review.json

Product of the structure-review step (SKILL.md 6.5). Located at `<iteration-dir>/structure-review.json`; auto-discovered by the eval viewer, which renders the suggestion card above the Benchmark table. **Suggestions only — never executed.**

```json
{
  "signals": [
    { "signal": "1 原子能力可复用", "hit": true,  "evidence": "日志解析例程被 ue-error-solver 重复实现" },
    { "signal": "2 多类不相干意图", "hit": false, "evidence": "无" },
    { "signal": "3 编排逻辑内嵌",   "hit": false, "evidence": "无" },
    { "signal": "4 near-miss 误触发集中", "hit": true, "evidence": "q5/q9 误触发集中于「翻译」类" }
  ],
  "recommendation": "把「日志解析」抽成独立原子技能，本技能改为编排层调度（样板：grill-with-docs 之于 grilling）",
  "conclusion": "只建议不执行；结论已记入 design.md 迭代记录，是否拆分由用户裁定"
}
```

**Fields:**
- `signals[]`: The four-signal checklist, one entry per signal, verdicts recorded honestly (write the file even when nothing hits)
  - `signal` / `hit` / `evidence`: Signal name / whether it hit / one-sentence evidence. `hit` is `true` / `false` / `null` — `null` means "no data to judge" (e.g. signal 4 before any trigger eval ran); the viewer renders it as 「无数据」
- `recommendation`: The split suggestion shown in the card; empty or 「无需拆分」 when no signal hits
- `conclusion`: Where the suggestion landed (dialog at review time; design.md iteration record at wrap-up, after the user's verdict) and that execution stays with the user. Rendered even when no benchmark.json exists

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

**Boundary behavior:** `null` values are skipped by the aggregator (that run's corresponding statistic is excluded) and counted in the config's `skipped` counters. If every run in the iteration lacks a valid value for a timing metric, the benchmark emits a warning and keeps that metric's statistics/delta as `null` (rendered as 未测量), never as a synthetic 0.

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
- `notes`: Optional string array appended by the analyst pass (SKILL.md 6.4 step 3); the viewer renders it as Analysis Notes. Absent when no analyst pass ran — consumers must not require it

`benchmark.md` is a human-readable rendering of the same data, field for field.

---

## trigger-evals.json

Trigger-eval query set (subagent probe mechanism). Durable, finalized asset at the skill root (`<skill-dir>/trigger-evals.json`); ships inside the .skill package. Once finalized it does not change — changing the set starts a fresh full re-run and must not share a commit with a description change (cross-round comparability depends on a fixed set).

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

One line per probe, appended by the orchestrating agent as probes complete. Located at the workspace root (raw probe replies — scratch, never committed).

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

Output from `scripts/aggregate-trigger.mjs <workspace> --persist <skill-dir>`. Durable record at the skill root (`<skill-dir>/trigger-benchmark.json`); without `--persist` it is written to the workspace root (one-off runs). Atomic full overwrite — cross-round content history is carried by git.

```json
{
  "skill": "log-classifier",
  "split": { "train": ["q1", "q3", "q4", "q6"], "test": ["q2", "q5"], "seed": 42, "holdout": 0.4 },
  "rounds": [
    {
      "description": "分类 Jenkins 失败日志…",
      "valid_probes": 6,
      "train": { "queries": 4, "trigger_rate_on_should": 0.9, "false_trigger_rate_on_should_not": 0.1, "correct": 3, "invalid_queries": 0 },
      "test":  { "queries": 2, "trigger_rate_on_should": 0.8, "false_trigger_rate_on_should_not": 0.1, "correct": 2, "invalid_queries": 0 }
    }
  ],
  "best_description": "分类 Jenkins 失败日志…",
  "valid_probes": 6,
  "invalid_probes": 1
}
```

**Fields:**
- `split`: train/test 60/40 stratified by should_trigger (official run_loop caliber; deterministic shuffle with the recorded seed), test gets at least one query per stratum
- `rounds[]`: One entry per description tested; within each split:
  - `valid_probes`: Number of protocol-valid, known-query probe rows in this round; rounds with zero valid probes cannot become `best_description`
  - `trigger_rate_on_should`: Fraction of should-trigger queries where the majority of valid probes triggered (strict majority, default 3 probes per query)
  - `false_trigger_rate_on_should_not`: Fraction of should-not-trigger queries that (wrongly) triggered
  - `correct`: test/train correctness count (should→triggered + should-not→quiet)
  - `invalid_queries`: Queries with zero valid probes (excluded from rate denominators)
- `best_description`: Picked by test `correct` count, then trigger/false-trigger rates (anti-overfitting); a complete tie keeps the earlier valid round
- `valid_probes`: Total protocol-valid, known-query probe rows across all rounds
- `invalid_probes`: Total malformed JSON lines, non-object/unknown-query rows, or probe lines whose first line did not match the protocol

**Boundary behavior:** `trigger-evals.json` must contain a non-empty skill, unique ids, non-empty text, boolean `should_trigger`, and both positive and negative queries. Invalid evaluation data exits 1. If no probe row is valid, aggregation exits 1 and does not write a benchmark file. With `--persist`, a non-directory target or a missing `trigger-evals.json` at the skill dir refuses with exit 1 — never a silent fallback to a stale workspace copy.

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
