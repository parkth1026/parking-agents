# Validation and constraints

The following reference contains the validation script, detailed references, and operational constraints. Read it when implementing or reviewing the wiki pipeline.

## Validation Script

The `scripts/validate-wiki.mjs` script performs comprehensive quality checks.

### Usage

```bash
# {skill-dir} 是包含此 SKILL.md 的目录；{wikiDir} 来自 config.json
node {skill-dir}/scripts/validate-wiki.mjs --wiki "{wikiDir}" --config "{skill-dir}/config.json" [--raw "{rawDir}"]
```

`--raw` 可省略：解析链 `--raw` > `$SKILL_ENV` > `~/.config/parking-agents/skill-env.json` 的 `knowledgeBase.rawDir`。找不到 rawDir 时 staleness 检查跳过（报告中标明），不影响其余维度。

### What It Checks (8 dimensions + staleness)

| Dimension | Weight | What It Checks |
|-----------|--------|----------------|
| Broken Links | 25% | `[[wikilinks]]` pointing to non-existent pages |
| Self References | 10% | Pages linking to themselves |
| Orphan Pages | 10% | Pages with zero inbound links |
| Index Completeness | 15% | Every page listed in index.md |
| Frontmatter | 15% | Required YAML fields present and valid; `type` must be a base type or declared in SCHEMA.md `## Page Types` |
| Page Size | 10% | No page exceeds maxLines |
| Outbound Links | 10% | Every page has >= minOutboundLinks |
| Tag Compliance | 5% | All tags defined in SCHEMA.md (Page Types / Page Directories sections are not tags) |

**Staleness（v6，不计分、独立报告）**：raw 证据日期新于页面 `updated` 即为 stale。
证据日期取 raw 文件 frontmatter `recorded_at` / `ingested` / `date`，缺省回退 mtime；
`recurrence-{PageStem}.md` 去前缀后按页名匹配。默认 report-only；
`scoring.stalenessEnforce: true` 时存在 stale 页直接 FAIL——
这是复利闭环「知识不旧于原始证据」的机械化验收（见 SKILL.md Recurrence Loopback）。

**链接解析目录（v6）**：规范五目录 + 根目录 + SCHEMA.md `## Page Directories` 声明的扩展目录
（v5 曾硬编码 details/scratch/patterns；部署形态现由 SCHEMA 声明）。

### Completion Standard

The wiki passes validation when:
- [ ] Validation script runs without errors
- [ ] Broken link count = 0 (**hard gate**: score >= 9.0 with broken links > 0 still FAILs)
- [ ] Total score >= 9.0/10
- [ ] Staleness section clear, or backlog explicitly accepted by the user
      (with `stalenessEnforce: true` this becomes a hard gate too)
- [ ] Validation report generated — and saved OUTSIDE `{wikiDir}`: every `.md`
      inside the wiki is counted and validated as a page

### Dead Link Fix Strategy

When broken links are found:
1. **Create missing page** — if the link target is a legitimate concept/entity
2. **Remove the link** — if the link target is not worth a page
3. **Correct the link** — if the target exists but with a different name

---

## Detailed References

| Topic | File |
|-------|------|
| Page templates (all types) | [page-templates.md](page-templates.md) |
| Tag taxonomy and guidelines | [tagging-taxonomy.md](tagging-taxonomy.md) |

Read the reference file when you need template details or tag guidance.

---

## Constraints

1. **Never modify raw sources**: Files in `{rawDir}` are immutable after ingestion
2. **Session start protocol**: Always read SCHEMA.md → index.md → log.md before operating
3. **Config-driven paths**: All paths from config.json, no hardcoding
4. **UTF-8 without BOM**: All output files; LF or CRLF line endings both accepted
   (the validator rejects BOM, not line endings)
5. **Obsidian compatible**: Wikilinks use `[[Page Name]]` format, YAML frontmatter in every page
6. **Update index + log**: Every operation that creates or modifies pages must update both files
7. **Page quality gates**: Minimum 2 outbound wikilinks, maximum 200 lines, valid frontmatter
8. **Tag discipline**: Only use tags defined in SCHEMA.md; add new tags to schema first
9. **No speculative pages**: Only create pages meeting the creation threshold (2+ sources or central to one)
10. **Graceful on empty wiki**: If wiki is uninitialized, create SCHEMA.md, index.md, and log.md first
