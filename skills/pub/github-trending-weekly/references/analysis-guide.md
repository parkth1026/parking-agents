# 本周分析写作口径

输入是通过 `validate-week --full` 的周 JSON。读取每仓的 README、tree、contributors、commits_90d、releases；`evidence_at` 是补查时刻，`captured_at` 是榜单时刻。输出 `data/weeks/<YYYY-Www>.analysis.md`。数据脚本只采集、校验和抽取，LLM 在此单独写作。

## 写作流程与完成条件

1. 读全 20 仓的五信源，先定位交付物、核心入口和实际用户动作。目录只能证明文件存在；需要判断具体实现时再通过只读 `gh api` 查看该文件。把事实、README 作者自述、未验证事项分清。
2. 全部 20 仓按以下模板写四字段；常驻可复用前周定位与生态位，重新检查爆因、可信度和版本状态。新晋是首次进入已有周快照，不是刚发布。回填 presence 是每日榜证据，不改变周榜分类。
3. 从当前 JSON 逐仓抄录 `full_name → entry_status` 至头部注释，键集合必须完整。更新后 `build-report` 会核对该依据与过期分析内容 hash；仅润色旧稿不能解除 stale。
4. 重建报告并阅读详情卡。完整的五个标签行（四字段加标签数组）才能抽取为 note；解析失败仍保留整篇原稿，详情显示占位。内容质量由用户全读当期分析裁决。

## 固定标签格式

每个字段独占一行，用中文全角冒号。标题必须为 `### owner/repo`，可加 ` —— 一句话标题`。字段值允许 Markdown HTTP(S) 链接和行内强调；所有内容在 viewer 转义后显示。

```markdown
<!-- entry-status: {"owner/repo":"new","other/tool":"returning"} -->

## 本周看点

两到四句写整体产品变化；TLDR 最猛前三由 viewer 根据周增量/总星自动排序，不手工填榜。

### owner/repo

- **定位**：2–4 句（至多 5），领域 × 解决什么 × 核心界面/调用入口；给出可检查的代码路径或发布记录链接。
- **为什么爆**：事件或功能变化 → 用户成本/能力变化 → 可能的传播机制。注明事实依据与因果推断的边界。
- **可信度**：源码、发布成熟度、贡献结构、测试/复现证据及未验证项。信源缺失时明确「信源不完整」。
- **nicheTags**：["agent-skills","diagram-generation"]
- **生态位**：同类：具体竞品名。差异点：对同一用户任务的能力、入口或限制区别。
```

## 证据纪律

- 定位必须说明用户操作与交付物，不能用「强大、革命性、生产可用」代替事实。
- 为什么爆是有证据的因果叙事，不复述行内星数或把发布时间当作已证明的因果。没有直接触发证据时写「机制假设，触发未证实」，并说明可见的产品吸引点；榜单采集之后的提交/发布不能解释当期增长。
- contributors 仅前 20 名，含机器人；commits_90d 是最近 90 天最多 100 条样本，`capped=true` 时不是总提交数。空 release 数组表示请求成功但无发布，与信源失败有区别。
- Release 是可追溯发布声明，不自动等同稳定版；目录存在 tests 不代表测试已运行。README 的性能、隐私、成功率与安全承诺标为作者自述，独立验证后才升级为事实。
- 生态位至少一个具体竞品，写清相同任务和差异；未做比较实测时保留边界。本站不进行 HN/Reddit/X 讨论检索，不聚合竞品知识库。

## nicheTags 受控词表

序列化为 JSON 数组，小写连字符。唯一运行时列表为 `scripts/lib/analysis.mjs` 的 `NICHE_TAGS`；抽取只接受列表成员。初版：

`agent-skills`, `diagram-generation`, `plugin-marketplace`, `mcp`, `agent-memory`, `ai-image-generation`, `prompt-library`, `education`, `local-first`, `observability`, `job-search`, `llm-api`, `agent-workbench`, `testing`, `developer-tools`, `linux-desktop`, `scientific-computing`, `automation`, `security`, `data-platform`, `seo`, `model-tuning`, `video-editing`, `ui-generation`, `peripheral-control`。

每仓选最贴切的 1–3 项。新增词须同时更新运行时列表和本段；常规周报写作复用已有词，不把作者 topics 原样当 nicheTags。

## 知识页 `<WS>/wiki/<YYYY-Www>.md`

保留 YAML title/date/tags，按周写一段整体结论和新晋的一句话链接清单；`[[owner/repo]]` 首次出现时建立链接，重复上榜链接回首次周页。知识页承担时间线，完整判断以 analysis.md 为准。
