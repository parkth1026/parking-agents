#!/usr/bin/env python3
# grade-iteration2.py — epic-ue-assistant iteration-2 程序化评分
# 读取各 eval 的 outputs（answer.md / transcript.md / result*.json），逐断言判定，
# 生成 viewer 需要的 grading.json（字段: text / passed / evidence）
import io, json, os, re, sys

WS = os.path.dirname(os.path.abspath(__file__))

def read(p):
    fp = os.path.join(WS, p)
    if not os.path.exists(fp):
        return None
    with io.open(fp, encoding="utf-8-sig", errors="replace") as f:
        return f.read()

def read_json(p):
    t = read(p)
    if t is None:
        return None
    try:
        return json.loads(t)
    except Exception:
        return None

def has(pattern, text, flags=re.IGNORECASE):
    return bool(text and re.search(pattern, text, flags))

def grade(answer, transcript, results, asserts):
    out = []
    for a in asserts:
        name, ok, ev = a["name"], False, ""
        if name == "answer_非空_含实质内容":
            ok = bool(answer) and len(answer.strip()) >= 300
            ev = f"answer.md {len((answer or '').strip())} 字符"
        elif name == "answer_覆盖_LNK2019_典型原因":
            ok = has(r"Build\.cs|模块依赖|module|API\s*macro|UE_?API|UHT|codegen|generated", answer)
            ev = "命中关键词" if ok else "未命中 Build.cs/模块/API宏/UHT 关键词"
        elif name == "answer_附官方参考链接":
            ok = has(r"dev\.epicgames\.com", answer)
            ev = re.findall(r"dev\.epicgames\.com\S{0,80}", (answer or ""))[:2].__str__() if ok else "无 dev.epicgames.com 链接"
        elif name == "transcript_使用了技能脚本":
            ok = has(r"epic-assistant\.mjs", transcript)
            ev = "transcript 含 epic-assistant.mjs 调用" if ok else "未发现技能脚本调用记录"
        elif name == "错误被正确处理":
            err_marks = has(r"error|Error|失败|限流|429|Cloudflare", transcript or "")
            handled = has(r"重试|retry|等待|wait|按 SKILL\.md|exit.?1", transcript or "")
            ok = (not err_marks) or handled
            ev = "无错误记录" if not err_marks else ("有错误且已处理" if handled else "有错误但未见处理记录")
        elif name == "answer_含可运行C++示例":
            ok = has(r"AddMappingContext|EnhancedInputComponent|BindAction|UInputComponent", answer)
            ev = "含 Enhanced Input C++ API 调用" if ok else "未找到相关 C++ API"
        elif name == "answer_与EnhancedInput主题相关":
            ok = has(r"Mapping\s*Context|Enhanced\s*Input|EnhancedInput", answer)
            ev = "主题相关" if ok else "主题不相关"
        elif name == "引用链接与References一致":
            refs = []
            for r in results or []:
                for x in (r.get("References") or []):
                    refs.append(x.get("Url", ""))
            # 统一去掉协议前缀再求交集（正则抓取的链接可能不带 https://）
            norm = lambda u: re.sub(r"^https?://", "", u).rstrip("/")
            links_in_answer = set(norm(u) for u in re.findall(r"(?:https?://)?dev\.epicgames\.com[^\s\)\]\"<>]*", answer or ""))
            ref_set = set(norm(u) for u in refs)
            inter = links_in_answer & ref_set
            ok = bool(inter)
            ev = f"answer 链接与 References 交集 {len(inter)} 条: {sorted(inter)[:2]}" if ok else f"answer 链接 {sorted(links_in_answer)[:2]} 与 References {sorted(ref_set)[:2]} 无交集（疑似伪造引用）"
        elif name == "两问答案齐全":
            ok = has(r"TSoftObjectPtr", answer) and has(r"区别|difference", answer) and has(r"异步|Async|Streamable", answer)
            ev = "两问内容均覆盖" if ok else "缺少其中一问的内容"
        elif name == "第二问复用同一会话":
            conv_ids = []
            for r in results or []:
                if r.get("ConversationId"):
                    conv_ids.append(r["ConversationId"])
            used = re.findall(r"--conversation-id[= ]\s*([0-9A-Z]{20,})", transcript or "")
            ok = bool(conv_ids) and any(u in conv_ids for u in used)
            ev = f"transcript 传入 {used}, 查询返回 {conv_ids}" if ok else f"未匹配: 传入 {used}, 返回 {conv_ids}"
        elif name == "第二问查询成功":
            r2 = results[-1] if results else None
            ok = bool(r2) and not r2.get("Error") and bool(r2.get("AgentAnswer") or r2.get("HtmlAnswer"))
            ev = f"Error={r2.get('Error') if r2 else '无文件'}, 答案长度={len((r2 or {}).get('AgentAnswer') or (r2 or {}).get('HtmlAnswer') or '')}"
        elif name == "示例含异步加载机制":
            ok = has(r"FStreamableManager|StreamableManager|LoadSynchronous|RequestAsyncLoad|AsyncLoad", answer)
            ev = "含异步加载 API" if ok else "未找到异步加载 API"
        else:
            ok, ev = False, "未知断言"
        out.append({"text": f"{a['name']}: {a['description']}", "passed": ok, "evidence": ev})
    return out

EVALS = [
    ("eval-lnk2019-zconstruct", ["result.json"]),
    ("eval-enhanced-input-mapping-context", ["result.json"]),
    ("eval-multiturn-followup", ["result1.json", "result2.json"]),
]

total = passed = 0
for name, result_files in EVALS:
    d = os.path.join(name, "with_skill")
    meta = read_json(os.path.join(name, "eval_metadata.json")) or {}
    answer = read(os.path.join(d, "outputs", "answer.md"))
    transcript = read(os.path.join(d, "outputs", "transcript.md"))
    results = [r for r in (read_json(os.path.join(d, "outputs", f)) for f in result_files) if r]
    gradings = grade(answer, transcript, results, meta.get("assertions", []))
    with io.open(os.path.join(d, "grading.json"), "w", encoding="utf-8") as f:
        json.dump({"expectations": gradings}, f, ensure_ascii=False, indent=2)
    p = sum(1 for g in gradings if g["passed"])
    total += len(gradings); passed += p
    print(f"{name}: {p}/{len(gradings)}")
    for g in gradings:
        print(f"  [{'PASS' if g['passed'] else 'FAIL'}] {g['text'][:60]} | {g['evidence'][:90]}")
print(f"\nTOTAL: {passed}/{total}")
sys.exit(0 if passed == total else 1)
