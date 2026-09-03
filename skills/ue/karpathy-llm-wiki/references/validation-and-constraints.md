# 校验与约束

本参考包含校验脚本说明、详细参考与操作约束。实现或审查 wiki 流水线时阅读。

## 校验脚本

`scripts/validate-wiki.mjs` 脚本执行综合质量检查。

### 用法

```bash
# {skill-dir} 是包含此 SKILL.md 的目录；{wikiDir} 来自 config.json
node {skill-dir}/scripts/validate-wiki.mjs --wiki "{wikiDir}" --config "{skill-dir}/config.json" [--raw "{rawDir}"]
```

`--raw` 可省略：解析链 `--raw` > `$SKILL_ENV` > `~/.config/parking-agents/skill-env.json` 的 `knowledgeBase.rawDir`。找不到 rawDir 时 staleness 检查跳过（报告中标明），不影响其余维度。

### 检查维度（8 维度 + staleness + v7 图结构体检）

维度名称与脚本报告输出的标签一致，保持英文。

| 维度 | 权重 | 检查什么 |
|-----------|--------|----------------|
| Broken Links | 25% | `[[wikilink]]` 指向不存在的页面（v7 起 **含 log.md / SCHEMA.md 的活链接**；代码围栏与反引号内的语法示例豁免——log/SCHEMA 是审计/规范文档，合法引用语法。index.md 沿用 v6.2 硬口径：反引号内也计入） |
| Self References | 10% | 页面链向自己 |
| Orphan Pages | 10% | 入链为零的页面（`indexCountsAsInbound=true` 默认下与 Index Completeness 互为充要——逻辑恒真，不能证明连通性，见 Organic Orphans） |
| Index Completeness | 15% | 每个页面都列进了 index.md |
| Frontmatter | 15% | 必填 YAML 字段齐全且有效；`type` 必须是基础类型或 SCHEMA.md `## Page Types` 声明的类型 |
| Page Size | 10% | 无页面超过 maxLines（index.md 不在此维度，但有独立恒报告的行数检查） |
| Outbound Links | 10% | 每页 >= minOutboundLinks |
| Tag Compliance | 5% | 所有标签在 SCHEMA.md 中定义（Page Types / Page Directories 节不是标签） |

**Staleness（v6，不计分、独立报告）**：raw 证据日期新于页面 `updated` 即为 stale。
证据日期取 raw 文件 frontmatter `recorded_at` / `ingested` / `date`，缺省回退 mtime；
`recurrence-{PageStem}.md` 去前缀后按页名匹配。默认 report-only；
`scoring.stalenessEnforce: true` 时存在 stale 页直接 FAIL——
这是复利闭环「知识不旧于原始证据」的机械化验收（见 SKILL.md Recurrence 回流）。

**Ambiguous Page Names（v6.2，不计分、独立报告）**：跨目录同名 basename 的页面
（如 `concepts/Attention.md` + `sources/Attention.md`）让 `[[Title]]` 解析产生歧义。
默认 report-only（逐名点名冲突文件）；`scoring.ambiguousNamesEnforce: true` 时
存在同名歧义直接 FAIL——与 staleness 同过渡策略。自引用检测自 v6.2 起
大小写不敏感：`[[transformer]]` 在 `Transformer.md` 内同样计入 Self References。

**v7 图结构体检（2026-09-02 wiki-top5 审计后新增：342 页星型拓扑拿 10/10，
暴露质量模型只看「每页合规」不看「库是图」的盲区）**：

- **Organic Orphans（有机孤儿）**：除 index.md 外零入链的页面，恒报告；
  `scoring.organicOrphansEnforce: true` 时 FAIL。默认孤儿检查在
  `indexCountsAsInbound=true` 下与 index 完整性互为充要（每页都被要求进 index、
  index 链接又计入入链），「孤儿 0」不能证明图连通性——本节才是真实度量
- **Unlinked Mentions（未建链提及，advisory）**：页面正文以纯文本出现其他页面
  basename 但全页从未链过——关系数据（花名册/责任人/汇报线）逃逸出图的检测。
  匹配口径：CJK 名 ≥2 字符、ASCII 名 ≥4 字符（3 字符缩写如 Sim/PCG 误报面过大）；
  链一次即豁免该名其余纯文本提及；frontmatter/代码围栏/行内代码不计；
  长名优先遮蔽防子串误报（王超凡 不误报 王超）。报告 top 20 页 + 总数；
  逐字照录语料库可按保真约束保留部分纯文本，但结构化字段不在此列
- **Graph Structure（图结构摘要，informational）**：有机节点/无向边/平均入度/
  入度分布/顶级枢纽/叶子占比（≤1 有机入链）。叶子占比 >70% 时提示
  hub-and-spoke 星型拓扑——关系不可导航，应在结构化字段补横向链接
- **index.md 行数（report-only）**：目录页豁免 pageSize 维度后无人守门；
  超过 `page.maxLines` 时提示拆分层 MOC（分类子目录页 + 精简 index 入口）
- **嵌套 vault 探测（report-only）**：wikiDir 祖先存在 `.obsidian` 即告警
  （Obsidian 不支持嵌套 vault；从父库打开时裸 `[[名]]` 因等深路径解析歧义，
  另一个同名页成死岛），并枚举祖先库与本库的 basename 碰撞清单。
  处置：迁移 wikiDir 出父库，或给碰撞页加 namespace 前缀

**链接解析目录（v6）**：规范五目录 + 根目录 + SCHEMA.md `## Page Directories` 声明的扩展目录
（v5 曾硬编码 details/scratch/patterns；部署形态现由 SCHEMA 声明）。

### 通过标准

wiki 满足以下条件才算通过校验：
- [ ] 校验脚本无错误跑完
- [ ] 断链数 = 0（**硬门槛**：断链 > 0 时即使分数 >= 9.0 仍判 FAIL；v7 起含 log/SCHEMA 活链接）
- [ ] 总分 >= 9.0/10
- [ ] staleness 节清零，或积压已被用户明确接受
      （`stalenessEnforce: true` 时这一条也是硬门槛）
- [ ] 无跨目录同名 basename 页面，或积压已被用户明确接受
      （`ambiguousNamesEnforce: true` 时这一条也是硬门槛）
- [ ] 有机孤儿清零，或积压已被用户明确接受
      （`organicOrphansEnforce: true` 时这一条也是硬门槛）
- [ ] 审阅 v7 报告节（Unlinked Mentions / Graph Structure / index 行数 /
      嵌套 vault）——advisory 项不拦 PASS，但 lint 语义上应逐节给出
      「已处置 / 明确接受」的结论后再宣称 wiki 健康
- [ ] 生成校验报告——保存在 `{wikiDir}` **之外**：wiki 内每个 `.md`
      都会被当作页面计数和校验

### 断链修复策略

发现断链时：
1. **建缺失页面** — 链接目标是有价值的概念/实体时
2. **删链接** — 链接目标不值得立页时
3. **改链接** — 目标存在但名字不同时

---

## 详细参考

| 主题 | 文件 |
|-------|------|
| 页面模板（全部类型） | [page-templates.md](page-templates.md) |
| 标签分类与指引 | [tagging-taxonomy.md](tagging-taxonomy.md) |

需要模板细节或标签指引时读对应参考文件。

---

## 约束

1. **永不修改原始素材**：`{rawDir}` 中的文件 ingest 后不可变
2. **会话启动协议**：操作前必读 SCHEMA.md → index.md → log.md
3. **配置驱动路径**：所有路径来自 config.json，不硬编码
4. **UTF-8 无 BOM**：所有产出文件；LF 或 CRLF 行尾均可
   （校验器拒绝的是 BOM，不是行尾）
5. **兼容 Obsidian**：wikilink 用 `[[Page Name]]` 格式，每页带 YAML frontmatter
6. **更新 index + log**：每个创建或修改页面的操作必须同时更新这两个文件
7. **页面质量门槛**：最少 2 条出链 wikilink、最多 200 行、frontmatter 合规
8. **标签纪律**：只用 SCHEMA.md 定义的标签；新标签先入 schema
9. **不建投机页面**：只建满足建页门槛的页面（2+ 素材，或单一素材的核心）
10. **空 wiki 优雅处理**：wiki 未初始化时，先创建 SCHEMA.md、index.md、log.md
