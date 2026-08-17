"""检查 questions.md 里选项块的格式合规性。

用法：
    python check_question_format.py <questions.md 路径> [...]

判定的断言（其余需人工判断的不在此列）：
    every-option-has-percentage
    percentages-sum-to-100
    every-option-has-three-sections
    recommended-is-highest
    no-flat-distribution
    section-cap-respected

输出 JSON，供 grading 直接引用。
"""

import json
import re
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# 选项行：行首可有 -/* 与加粗标记，字母可被 [] 或【】包住（旧版写成 `- [A] ...`）。
OPTION_RE = re.compile(r"^\s{0,3}(?:[-*]\s*)?\*{0,2}[\[【]?([A-D])[\]】]?\s*(?:[.．、）)：:]|（|\s)")
# 「推荐 [A] ...」这类总结行不是选项行，否则会被误判成新一题。
NOT_OPTION_RE = re.compile(r"^\s*[-*]?\s*\*{0,2}(推荐|建议|不推荐|选定|用户选)")
PCT_RE = re.compile(r"(\d{1,3})\s*%")
BENEFIT_RE = re.compile(r"(好处|优势)")
COST_RE = re.compile(r"(代价|坏处)")
WHAT_RE = re.compile(r"(选什么|选的是什么)")


def parse(path):
    raw = open(path, encoding="utf-8").read().splitlines()
    # 有的输出把「发给用户的原文」整段包在引用块里，剥掉 > 再判。
    lines = [re.sub(r"^\s{0,3}>\s?", "", line) for line in raw]
    groups, cur = [], []
    for i, line in enumerate(lines):
        if NOT_OPTION_RE.match(line):
            continue
        m = OPTION_RE.match(line)
        if not m:
            continue
        letter = m.group(1)
        # 回到 A 视为新一题
        if letter == "A" and cur:
            groups.append(cur)
            cur = []
        cur.append({"letter": letter, "line_no": i + 1, "text": line, "start": i})
    if cur:
        groups.append(cur)

    # 每个选项的正文范围 = 到下一个选项行或下一个标题行为止
    for g in groups:
        for k, opt in enumerate(g):
            end = g[k + 1]["start"] if k + 1 < len(g) else len(lines)
            for j in range(opt["start"] + 1, end):
                if lines[j].startswith("#"):
                    end = j
                    break
            opt["body"] = lines[opt["start"]: end]
    return groups


def count_bullets(body, header_re):
    """数某一段（好处/代价）下挂了几条。同行罗列算 1 条。"""
    hit = None
    for idx, line in enumerate(body):
        if header_re.search(line):
            hit = idx
            break
    if hit is None:
        return None
    seg = body[hit]
    rest = re.split(r"[：:]", seg, maxsplit=1)
    inline = rest[1].strip() if len(rest) > 1 else ""
    n = 1 if inline else 0
    base_indent = len(body[hit]) - len(body[hit].lstrip())
    for line in body[hit + 1:]:
        if not line.strip():
            continue
        indent = len(line) - len(line.lstrip())
        stripped = line.strip()
        if indent <= base_indent and (BENEFIT_RE.search(line) or COST_RE.search(line) or WHAT_RE.search(line)):
            break
        if stripped.startswith(("-", "*")) and indent > base_indent:
            n += 1
        elif indent <= base_indent:
            break
    return max(n, 1) if (inline or n) else 0


def check(path):
    groups = parse(path)
    res = {
        "file": path,
        "question_count": len(groups),
        "option_count": sum(len(g) for g in groups),
        "options_without_percentage": [],
        "sums": [],
        "options_missing_sections": [],
        "recommended_not_highest": [],
        "flat_distributions": [],
        "section_cap_violations": [],
    }
    for gi, g in enumerate(groups, 1):
        pcts = {}
        for opt in g:
            joined = "\n".join(opt["body"])
            m = PCT_RE.search(opt["text"]) or PCT_RE.search(joined)
            tag = f"Q{gi}-{opt['letter']}(L{opt['line_no']})"
            if m:
                pcts[opt["letter"]] = int(m.group(1))
            else:
                res["options_without_percentage"].append(tag)

            missing = []
            if not WHAT_RE.search(joined):
                missing.append("选什么")
            if not BENEFIT_RE.search(joined):
                missing.append("好处")
            if not COST_RE.search(joined):
                missing.append("代价")
            if missing:
                res["options_missing_sections"].append({"option": tag, "missing": missing})

            for name, rx in (("好处", BENEFIT_RE), ("代价", COST_RE)):
                n = count_bullets(opt["body"], rx)
                if n and n > 3:
                    res["section_cap_violations"].append({"option": tag, "section": name, "count": n})

        if pcts:
            total = sum(pcts.values())
            res["sums"].append({"question": f"Q{gi}", "pcts": pcts, "sum": total, "ok": abs(total - 100) <= 1})
            if max(pcts.values()) - min(pcts.values()) <= 3 and len(pcts) > 1:
                res["flat_distributions"].append({"question": f"Q{gi}", "pcts": pcts})
            # 只认标题行上的「推荐」标记；正文里提到推荐不算。
            rec = [o["letter"] for o in g if "推荐" in o["text"] and "不推荐" not in o["text"]]
            if rec:
                best = max(pcts, key=pcts.get)
                if not all(pcts.get(r, -1) == pcts[best] for r in rec) or len(rec) > 1:
                    res["recommended_not_highest"].append({"question": f"Q{gi}", "marked": rec, "highest": best, "pcts": pcts})

    opt_n = res["option_count"]
    if not opt_n:
        # 一个选项都没解析出来，多半是解析器不认这份文件的写法，不要当成「全过」。
        res["verdicts"] = {"parser-found-no-options": False}
        res["percentage_coverage"] = None
        return res
    res["verdicts"] = {
        "every-option-has-percentage": not res["options_without_percentage"],
        "percentages-sum-to-100": bool(res["sums"]) and all(s["ok"] for s in res["sums"]),
        "every-option-has-three-sections": not res["options_missing_sections"],
        "recommended-is-highest": not res["recommended_not_highest"],
        "no-flat-distribution": not res["flat_distributions"],
        "section-cap-respected": not res["section_cap_violations"],
    }
    res["percentage_coverage"] = round(1 - len(res["options_without_percentage"]) / opt_n, 3)
    return res


if __name__ == "__main__":
    out = [check(p) for p in sys.argv[1:]]
    print(json.dumps(out, ensure_ascii=False, indent=2))
