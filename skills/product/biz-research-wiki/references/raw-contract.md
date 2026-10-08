# raw 交付与 Wiki 交接

## 文件布局

```text
<rootDir>/
  raw/articles/<run_id>/<object-slug>/<source-id>.md
  raw/reports/<run_id>/<object-slug>.md
  raw/reports/<run_id>/overview.md
  runs/<run_id>/drafts/          # 核实前工作稿，不是来源
  runs/<run_id>/manifest.json
  runs/<run_id>/run.md
  wiki/                        # 本技能只读
```

raw 来源保存时即不可变；报告完成核实或明确未核实后封存。修订新增文件或新批次。
共享来源可引用已有 raw/articles 文件，包括旧的扁平布局；新快照使用新路径和日期。
报告必须在 raw/reports/<当前 run_id>/ 下。校验按 kind 检查目录，历史报告不能冒作本批新报告。
目录名不代表证据等级：source 是来源转出稿，report 是派生报告。

来源文件头记录 url、published_at（未知用 null）、fetched_at、note。
note 明确 WebFetch 转出稿、局部提取或搜索摘要及截断情况。正文按取得内容保存，不以自写摘要冒充抓取正文。
原文放在“原文摘录”节；自写整理如需保留，单列“研究者备注（非原文）”。正文事实必须能追到原文摘录。
已有来源混有未标记的整理时不改 raw；在 manifest 的 capture_notes 中说明哪些部分是原文、哪些不可作为逐句核实证据。
报告记录标题、对象、问题、事实截至日期与调研日期。相对链接从最终封存位置计算。

## manifest v1

路径相对 rootDir，使用 /。清单在 runs；列入的文件必须是 rootDir/raw 内真实文件。
SHA-256 按文件实际字节计算。清单绑定最终 raw，不绑定可变工作稿。
以下示例中的摘要需换成实测值：

```json
{
  "schema_version": 1,
  "run_id": "2026-10-08-example-ab12",
  "status": "complete",
  "topic_prompt": "原始主题问题",
  "as_of": "2026-10-08",
  "questions": ["谁付款", "为什么付钱"],
  "objects": [{"id": "example", "name": "示例公司", "kind": "company"}],
  "artifacts": [
    {
      "id": "s1", "kind": "source",
      "path": "raw/articles/2026-10-08-example-ab12/example/s1.md",
      "sha256": "实际的64位小写十六进制摘要",
      "url": "https://example.com/pricing",
      "published_at": null,
      "fetched_at": "2026-10-08T10:00:00+08:00",
      "capture": "webfetch_excerpt",
      "source_tier": "vendor_claim",
      "origin": "https://example.com/pricing"
    },
    {
      "id": "r1", "kind": "report",
      "path": "raw/reports/2026-10-08-example-ab12/example.md",
      "sha256": "实际的64位小写十六进制摘要",
      "object_ids": ["example"], "source_ids": ["s1"],
      "verification": "verified",
      "review": {
        "author_id": "实际调研代理ID", "verifier_id": "实际核实代理ID",
        "notes": "核对范围与实质改动；详细过程见 run.md",
        "changes": {"removed": 0, "requalified": 0, "added_sources": 0}
      }
    },
    {
      "id": "overview", "kind": "report", "role": "overview",
      "path": "raw/reports/2026-10-08-example-ab12/overview.md",
      "sha256": "实际的64位小写十六进制摘要",
      "object_ids": ["example"], "source_ids": ["s1"],
      "verification": "verified",
      "review": {
        "author_id": "实际综述作者ID", "verifier_id": "实际综述核实代理ID",
        "notes": "核对来源支持和跨对象判断；详细过程见 run.md",
        "changes": {"removed": 0, "requalified": 0, "added_sources": 0}
      }
    }
  ],
  "unresolved": ["公开渠道未找到付款证据"],
  "failed_urls": [],
  "usage": [{"object_id": "example", "search_calls": 3, "fetch_calls": 2, "elapsed_seconds": 90, "tokens": null}]
}
```

status 为 complete 或 partial。未知不等于执行未完成；完成独立核实仍允许未知。
verification 为 verified 或 not_run。complete 要求所有报告 verified。
verified 报告必须带 review：实际作者与核实代理 ID、核对说明、删除/重新定性/补充来源计数。
作者与核实代理 ID 必须不同。ID 来自宿主实际执行，不为通过校验编造身份。
not_run 报告必须带 verification_gap 说明未核实原因；这时批次只能为 partial。
capture 为 webfetch_full、webfetch_excerpt 或 search_excerpt；full 仅指转出正文未截断，不代表原始 HTML 完整性。
没有任何可用来源的对象仍交付报告，source_ids 为空，必须带报告级 evidence_gap；同时在 unresolved 与运行记录说明缺口。
failed_urls 存 {url, reason}。usage 每个对象一条；未知数为 null，0 只表示实测零次。

## 运行记录

run.md 保存：主题原文、对象与问题、探索边界、检索词与来源缺口、逐对象用量、失败 URL、核实代理及实质改动、未完成项和清单校验结果。
区分独立核实、来源支持、来源独立性与结构校验。
校验器只查清单结构、引用 ID、路径、摘要和核实声明。不证明正文逐句真实，也不证明代理独立。
输出 verifier_independence=DECLARED_ONLY：身份差异只是声明，实际隔离需宿主执行记录支持。

## 交给 Karpathy LLM Wiki

用户可使用以下指令，替换为实际绝对路径：

> 用 karpathy-llm-wiki 整理这些批次 manifest。显式使用 rawDir 与 wikiDir，不使用默认 knowledgeBase。先读目标 Wiki 的 SCHEMA/index/log。按本库 schema 编译，不按报告文件名机械建页。保留 source/report 类型、来源等级、日期、冲突、未知与判断边界；事实追到原始来源，不能只引用派生报告。增量合并，保留历史，不修改 raw。partial 批次先列限制，只摄取有支持的内容。编译后记录 manifest 路径和摘要及已处理 artifact ID，防止重复处理。分别报告事实核对与结构校验结果。

消费记录放在编译侧日志或独立账本，不回写已封存 manifest。
本技能不提供调度器；定期整理由单独调用或用户配置的自动化决定。
本次改造不修改通用引擎；此处是交接要求，不代表引擎已有自动扫描或消费账本功能。
