"""检测 metrics-relay 采样场景的 5 个跨边界陷阱是否被访谈覆盖。

用法：
    python check_traps.py <run 目录>   # 目录下应有 outputs/

对每个陷阱给三档判定，因为「漏问但被兜住」和「彻底漏掉」的严重程度差一个量级：
    asked    — 提问区问过，或至少在确认区显式列出
    caught   — 误写成默认项，但用户在清单里推翻了
    missing  — 契约里既没落对，也没被问过

关键词是证据定位用的，最终仍需人读上下文确认；脚本负责把「有没有出现」这件事
数清楚，避免靠印象判分。
"""

import json
import re
import sys
from pathlib import Path

TRAPS = {
    # 用户的真实需求是「下游那份日报的数字不能因为采样而塌掉」。达成它有两条路：
    # 采样后按采样率还原，或者干脆在采样之前就把计数记完。后者更简单也同样正确，
    # 所以两条都算过——按需求判，不按我预设的那条路判。
    "count-compensation": {
        "desc": "events_total 在采样后仍反映真实总量（还原补偿，或在采样前计数）",
        "hit": [r"补偿", r"估算总量", r"还原", r"除以采样率", r"1\s*/\s*采样率",
                r"采样前(收到|的量|计数)", r"统计.{0,8}采样前", r"在采样之前.{0,8}(计|统)"],
        "anchor": [r"events_total"],
        "wrong": [r"只记实收", r"只统计实际(收到|落盘)", r"记实收数",
                  r"events_total\s*(改成|记|统计).{0,6}采样后"],
    },
    "loadtest-drop": {
        "desc": "loadtest-* 流量整个丢弃而非抽样",
        "hit": [r"loadtest"],
        "anchor": [],
        "wrong": [r"所有\s*app\s*(统一|一律|使用同一)", r"全部\s*app\s*统一采样"],
    },
    "default-rate-safe": {
        "desc": "采样率默认 1.0（默认不采样）",
        "hit": [r"默认\s*(值\s*)?(为|是|=)?\s*1(\.0)?\b", r"默认不采样", r"默认关(闭)?", r"默认全量"],
        "anchor": [r"采样率|sampleRate|sample_rate"],
        "wrong": [r"默认\s*(值\s*)?(为|是|=)?\s*0\.\d"],
    },
    "consistent-hash": {
        "desc": "按 user_id 一致性哈希，同一用户全留或全丢",
        "hit": [r"一致性哈希", r"一致性\s*hash", r"按\s*user_id\s*(做|哈希|采样)", r"同一(个)?用户(要么)?全"],
        "anchor": [],
        "wrong": [r"逐(个)?事件独立随机", r"每个事件独立(地)?随机"],
    },
    "stale-readme": {
        "desc": "识破 README 的 X-Sample-Rate 已不存在 / 排除业务方自传采样率",
        "hit": [r"文档过时", r"README\s*(里的)?.{0,12}(过时|已删|不存在)", r"2\.0\s*(重构时)?(已)?删",
                r"不(支持|做|接受).{0,16}X-Sample-Rate", r"不由业务方(自行)?(传|设)"],
        "anchor": [],
        "wrong": [],
    },
}

OVERTURN = [r"推翻", r"翻掉", r"不同意", r"这条不对", r"必须改", r"改成"]


def read(run: Path):
    out = run / "outputs"
    texts = {}
    for p in out.glob("*.md"):
        texts[p.name] = p.read_text(encoding="utf-8", errors="replace")
    return texts


def any_hit(patterns, text):
    return [p for p in patterns if re.search(p, text, re.I)]


def classify(run: Path):
    texts = read(run)
    questions = "".join(v for k, v in texts.items() if "question" in k.lower())
    contract = "".join(v for k, v in texts.items()
                       if "question" not in k.lower() and "process-notes" not in k.lower())
    everything = "".join(texts.values())

    result = {"run": str(run), "files": sorted(texts), "traps": {}}
    for name, spec in TRAPS.items():
        hit_all = any_hit(spec["hit"], everything)
        hit_contract = any_hit(spec["hit"], contract)
        hit_questions = any_hit(spec["hit"], questions)
        wrong = any_hit(spec["wrong"], contract)

        if not hit_all:
            verdict = "missing"
        elif hit_questions:
            # 出现在提问/清单里 → 至少被摆到用户面前过
            window = ""
            for pat in spec["hit"]:
                for m in re.finditer(pat, questions, re.I):
                    window += questions[max(0, m.start() - 400): m.end() + 400]
            verdict = "caught" if any_hit(OVERTURN, window) else "asked"
        else:
            verdict = "contract-only"

        result["traps"][name] = {
            "desc": spec["desc"],
            "verdict": verdict,
            "in_contract": bool(hit_contract),
            "wrong_direction_hits": wrong,
            "matched": hit_all[:4],
        }

    result["volume"] = {
        "questions_chars": len(questions),
        "questions_lines": questions.count("\n"),
        "contract_chars": len(contract),
    }
    result["counts"] = {
        k: len(re.findall(p, everything))
        for k, p in {"提问区": r"提问区", "默认区": r"默认区", "确认区": r"确认区"}.items()
    }
    return result


if __name__ == "__main__":
    print(json.dumps([classify(Path(a)) for a in sys.argv[1:]], ensure_ascii=False, indent=2))
