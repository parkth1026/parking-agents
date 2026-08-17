---
name: log-line-counter
description: Count total, empty, and non-empty lines in a log or plain-text file and produce a deterministic Markdown report. Use whenever a user asks for log line counts, blank-line statistics, nonblank-line statistics, or a Markdown summary of text-file line composition, including when they provide a .log or .txt path without naming this skill.
---

# Log Line Counter

Read a local UTF-8 text file and generate an exact Markdown line-count report with the bundled deterministic script.

## Run the counter

1. Identify the user-provided input text file and the requested Markdown destination.
2. Run:

       node scripts/count-log-lines.mjs <input-file> [output.md]

3. If `output.md` is omitted, capture stdout as the final Markdown report.
4. Report the generated path or return the Markdown unchanged.

The script treats `LF`, `CRLF`, and `CR` as line separators. A final line separator terminates the preceding line and does not create an extra line. A line is empty only when it contains zero characters; whitespace-only lines are non-empty. An empty file has zero lines.

## Output contract

Preserve this exact Markdown shape:

```markdown
# Log line count

| Metric | Count |
| --- | ---: |
| Total lines | 4 |
| Empty lines | 1 |
| Non-empty lines | 3 |
```

Do not estimate counts manually when the script can read the file. If the input is missing, unreadable, or not valid UTF-8, surface the script error and do not claim a report was generated.

## Test

Run after every change:

    node run-tests.mjs

The black-box suite covers mixed newline styles, an empty line, a whitespace-only line, a final separator, an empty file, stdout output, file output, and invalid input.

## Resources

- `scripts/count-log-lines.mjs` — deterministic UTF-8 line counter and Markdown renderer.
- `references/design.md` — design decisions and acceptance conditions.
