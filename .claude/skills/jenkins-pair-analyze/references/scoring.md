# Scoring Criteria

## 10-Point Scale

| Dimension | Criteria | Points |
|-----------|----------|--------|
| **Error Info (0-3)** | Has error code (C1083, LNK2019, etc.) | +1 |
| | Has file path | +1 |
| | Has line number | +1 |
| **Log Diff (0-2)** | Confirmed error gone in SUCCESS build | +1 |
| | Single root cause identified (not multiple unrelated errors) | +1 |
| **Commit (0-3)** | Has at least 1 commit from changeSet or console log | +1 |
| | Commit directly modifies the error file or its header | +1 |
| | Commit message describes the fix clearly | +1 |
| **Reuse (0-2)** | Has **actual code diff** (from `git show`) showing exactly what changed — inferred/guessed fixes do NOT count | +1 |
| | Has prevention advice applicable to similar cases | +1 |

## Thresholds

| Score | Action | Directory |
|-------|--------|-----------|
| >= 8 | High-quality knowledge, full write-up required | `details/` |
| 5-7 | Partial knowledge, shorter format OK | `scratch/` |
| < 5 | Not worth writing — record score in tracking only | (none) |

## File Naming

以 FAILURE 构建号为主标识符：`{jobCode}-{failBuild}[-{failEnd}]-{ErrorCode}-{ShortDesc}.md`，
jobCode 取自编排器技能 config.json 的 jobCodes 注册表。命名语法、frontmatter 与验收规则
统一见 [knowledge-format.md](knowledge-format.md)（v2），由 validate-raw.mjs 机械校验。

Examples:
- `twe-inst-898-903-LNK1120-TiffJpegUnresolved.md`
- `aes6-3746-C2061-FZoneGraphBuildData.md`

## Notes

- **Max achievable score without code diffs**: 9/10. When the Jenkins environment uses shallow clones (`--depth=1`) and no GitLab/GitHub API access is available, actual code diffs cannot be retrieved. The "Reuse: concrete code fix" point requires a before/after code example, which may need to be inferred from the error message and commit description rather than an actual diff. This is acceptable — score it honestly.
- **Commit from console log**: For WorkflowRun pipeline jobs, `changeSet` in the Jenkins API is often empty. Commits extracted from the console log (git checkout lines, commit messages) count the same as changeSet data for scoring purposes.
