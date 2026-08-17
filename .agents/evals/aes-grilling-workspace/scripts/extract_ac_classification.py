"""抽取契约的 AC / Constraints / Completion.Quality，为分类断言提供结构化事实。

只做抽取和关键词初筛，不下最终判断——关键词会误报（「搜索结果不含已归档笔记」不是不变量），
最终由人或 grader 看着 statement 原文定。用法：

    python extract_ac_classification.py <iteration-dir>
"""
import json
import re
import sys
from pathlib import Path

# DoD：换一个 Goal 也照样成立的通用质量门
DOD_HINTS = [
    "测试全部通过", "测试通过", "全部测试", "现有测试", "新增测试", "测试全绿",
    "lint", "零警告", "构建通过", "类型检查", "编译通过", "CI 通过",
]
# 不变量：说「不许变什么」而非「要变成什么」
INVARIANT_HINTS = [
    "保持不变", "保持兼容", "保持一致", "与改动前", "改动前相同", "行为不变",
    "不受影响", "维持现有", "保持原样", "向后兼容", "现有行为",
]

AC_RE = re.compile(r"^-\s+(AC-\d{2}):\s*(.+)$")
VERIFY_RE = re.compile(r"^\s+-\s+Verify:\s*\[([A-D])\]\s*(.*)$")


def section(text, name):
    """取出 ## <name> 到下一个 ## 之间的正文。"""
    m = re.search(rf"^##\s+{re.escape(name)}\s*$(.*?)(?=^##\s|\Z)", text, re.M | re.S)
    return m.group(1) if m else ""


def hits(statement, hints):
    return [h for h in hints if h in statement]


def parse(path):
    text = path.read_text(encoding="utf-8")
    acs, current = [], None
    for line in section(text, "Success Criteria").splitlines():
        m = AC_RE.match(line)
        if m:
            current = {
                "id": m.group(1),
                "statement": m.group(2).strip(),
                "tier": None,
                "dod_hits": hits(m.group(2), DOD_HINTS),
                "invariant_hits": hits(m.group(2), INVARIANT_HINTS),
            }
            acs.append(current)
            continue
        v = VERIFY_RE.match(line)
        if v and current:
            current["tier"] = v.group(1)

    constraints = [
        l.strip()[2:].strip()
        for l in section(text, "Constraints").splitlines()
        if l.strip().startswith("- ")
    ]
    quality = next(
        (l.strip() for l in section(text, "Completion").splitlines() if "Quality" in l), ""
    )
    return {
        "file": str(path),
        "ac_count": len(acs),
        "acs": acs,
        "constraints": constraints,
        "completion_quality": quality,
        "suspect_dod": [a["id"] for a in acs if a["dod_hits"]],
        "suspect_invariant": [a["id"] for a in acs if a["invariant_hits"]],
    }


def main():
    root = Path(sys.argv[1])
    results = {}
    for run in sorted(root.glob("eval-*/*/run-*")):
        outputs = run / "outputs"
        if not outputs.is_dir():
            continue
        # 契约是 outputs 下排除已知辅助文件的那个 .md
        skip = {"questions.md", "process-notes.md", "interview-log.md", "handoff.md"}
        cands = [
            p for p in outputs.glob("*.md")
            if p.name not in skip and "behavior" not in p.name.lower()
        ]
        if not cands:
            continue
        key = f"{run.parts[-3]}/{run.parts[-2]}"
        results[key] = parse(cands[0])

    print(json.dumps(results, ensure_ascii=False, indent=2))
    print("\n===== 摘要 =====")
    for key, r in sorted(results.items()):
        print(
            f"{key:52s} AC={r['ac_count']:2d} "
            f"疑似DoD={r['suspect_dod'] or '-'} "
            f"疑似不变量={r['suspect_invariant'] or '-'} "
            f"Constraints={len(r['constraints'])}条"
        )


if __name__ == "__main__":
    main()
