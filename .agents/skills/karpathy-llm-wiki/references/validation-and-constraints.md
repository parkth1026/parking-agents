# Validation and constraints

The following reference contains the validation script, detailed references, and operational constraints. Read it when implementing or reviewing the wiki pipeline.

## Validation Script

The `scripts/validate-wiki.mjs` script performs comprehensive quality checks.

### Usage

```bash
# {skill-dir} 是包含此 SKILL.md 的目录；{wikiDir} 来自 config.json
node {skill-dir}/scripts/validate-wiki.mjs --wiki "{wikiDir}" --config "{skill-dir}/config.json"
```

### What It Checks (8 dimensions)

| Dimension | Weight | What It Checks |
|-----------|--------|----------------|
| Broken Links | 25% | `[[wikilinks]]` pointing to non-existent pages |
| Self References | 10% | Pages linking to themselves |
| Orphan Pages | 10% | Pages with zero inbound links |
| Index Completeness | 15% | Every page listed in index.md |
| Frontmatter | 15% | Required YAML fields present and valid |
| Page Size | 10% | No page exceeds maxLines |
| Outbound Links | 10% | Every page has >= minOutboundLinks |
| Tag Compliance | 5% | All tags defined in SCHEMA.md |

### Completion Standard

The wiki passes validation when:
- [ ] Validation script runs without errors
- [ ] Broken link count = 0
- [ ] Total score >= 9.0/10
- [ ] Validation report generated

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
4. **UTF-8 without BOM**: All output files, CRLF line endings
5. **Obsidian compatible**: Wikilinks use `[[Page Name]]` format, YAML frontmatter in every page
6. **Update index + log**: Every operation that creates or modifies pages must update both files
7. **Page quality gates**: Minimum 2 outbound wikilinks, maximum 200 lines, valid frontmatter
8. **Tag discipline**: Only use tags defined in SCHEMA.md; add new tags to schema first
9. **No speculative pages**: Only create pages meeting the creation threshold (2+ sources or central to one)
10. **Graceful on empty wiki**: If wiki is uninitialized, create SCHEMA.md, index.md, and log.md first
