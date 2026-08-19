---
name: karpathy-llm-wiki
description: |
  维护一个持久化、互链的 markdown 知识 wiki，覆盖 LLM/AI/深度学习知识。
  提供工作流、页面模板、校验脚本与质量评分，用于搭建 Karpathy 式知识库。

  **在以下场景使用此技能：**
  (1) 创建、充实、更新或查询 LLM/AI/ML 知识 wiki
  (2) 把文章、论文、转录稿或笔记 ingest 进 wiki
  (3) 校验 wikilink、lint 页面、修复断链或检查 wiki 质量
  (4) 用户提到 "wiki"、"知识库"、"Karpathy"、"整理到wiki" 或 "ingest"，且要做的是 wiki 操作（整理、录入、查询、校验）——只是翻译这类文章、讲解 wikilink 语法、或把内容保存到 wiki 之外时，不需要本技能
---

# Karpathy LLM Wiki

构建并维护一个持久化、互链的 markdown 知识库。与其每次查询都靠 RAG 重新发现
信息，wiki 把知识一次编译、持续保鲜——每个页面交叉引用相关概念，织成一张
随时间不断增值的理解之网。

## 配置

配置分层（深合并；环境层覆盖技能默认值）：

- **技能默认** `config.json`（与本文 SKILL.md 同目录，随仓库版本化）：存放 `scoring` 与 `page` 规则。
- **环境层** `~/.config/parking-agents/skill-env.json`（工具中立、永不入库）：存放本机真实的 `knowledgeBase.wikiDir` / `knowledgeBase.rawDir`（NAS 后端）。解析链：`SKILL_ENV` 环境变量 > 该路径。

`knowledgeBase` 命名空间**与本机其他技能共享**（如 jenkins-log-auto-learning）——双方指向同一物理 wiki/raw 目录，值只在一处维护。

合并后的关键字段：
- `knowledgeBase.wikiDir` — **wiki 知识库本体** — 所有 wiki 页面（`entities/`、`concepts/`、`SCHEMA.md`、`index.md`、`log.md`）和全部产出都落在这里。
- `knowledgeBase.rawDir` — 原始素材存放处（待 ingest 的原文文章、论文、转录稿）。同时供 Lint 的 staleness 检查使用（raw 证据日期 vs 页面 `updated`）。
- `scoring.minScore` — 通过校验的最低质量分（默认：9.0）
- `scoring.indexCountsAsInbound` — `index.md` 目录链接是否计入孤儿页检测的入链（默认：`true`；`index.md` 是本文语义下的官方目录——无论此开关如何，其中的链接同样参与断链检查）
- `scoring.stalenessEnforce` — 为 `true` 时，任何 stale 页面（raw 证据新于页面 `updated` 日期）直接判校验失败；默认 `false`（存量 stale 积压清完之前仅报告）
- `scoring.ambiguousNamesEnforce` — 为 `true` 时，存在跨目录同名 basename 页面直接判校验失败；默认 `false`（与 staleness 同过渡策略：先报告清积压，再开执行）
- `page.maxLines` — 单页超过此行数就要拆分（默认：200）
- `page.minOutboundLinks` — 每页最少 `[[wikilink]]` 数（默认：2）

禁止硬编码路径——一律从合并后的配置读取。

### 路径解析（第 0 步）

读完 config.json 后，**先把所有路径值规范化**再使用。配置路径可能是三种风格：

1. **`~/...`**（波浪号前缀）— 把 `~` 展开为用户主目录。Node 写法：`path.join(os.homedir(), configPath.replace(/^~[\\/]/, ''))`。示例：`~/memory/jenkins-learnings` → `<home>/memory/jenkins-learnings`
2. **`./...`**（点斜杠相对路径）— 相对**当前工作目录**解析（不是技能目录）。Node 写法：`path.resolve(configPath)`。示例：`./wiki-raw/jenkins-learnings` → `<cwd>/wiki-raw/jenkins-learnings`
3. **绝对路径** — 原样使用。正斜杠在 Windows 上可用。

**需要套用此解析的路径**：`knowledgeBase.wikiDir`、`knowledgeBase.rawDir`。

解析后用 `fs.existsSync` 逐一确认目录存在。创建缺失目录属于持久写入：先展示解析后的路径、取得用户确认，再调用 `fs.mkdirSync(dir, { recursive: true })`；用户不确认则报告缺失目录并停止。批量/自动化模式下，明确要求 wiki 操作的任务即隐含创建所配置目录的授权——继续执行并把该决定记入 `log.md`。

---

## 三层架构

wiki 采用三个互相独立的层。尊重这些边界是数据完整性的关键——原始素材是
「ground truth」，ingest 之后永不修改。

### 第 1 层：原始素材（`{rawDir}`）

按收到时原样保存的不可变文件。ingest 之后永不编辑。

```
{rawDir}/
├── articles/     ← 博客文章、网络文章
├── papers/       ← 研究论文、arxiv PDF
├── transcripts/  ← 视频/播客转录稿
└── assets/       ← 素材引用的图片、图表
```

**命名约定**：`{YYYY-MM-DD}-{slug}.md` — 日期是 **ingest 日期**（与 `ingested`
元数据字段一致；发表日期写在文件头部）。
示例：`2024-01-15-karpathy-intro-to-llms.md`

### 第 2 层：wiki 本体（`{wikiDir}`）

由 agent 维护的 markdown 页面，用 `[[wikilink]]` 互链相关概念。
知识在这里被编译、综合、互链。

```
{wikiDir}/
├── entities/      ← 人物、组织、模型、工具（专有名词）
├── concepts/      ← 思想、技术、架构（普通名词）
├── sources/       ← 已 ingest 原始素材的摘要页
├── comparisons/   ← 并排对比分析（X vs Y）
├── queries/       ← 重要问题的存档回答
├── SCHEMA.md      ← 结构约定、标签分类、领域范围
├── index.md       ← 全部页面的目录（各带一行描述）
└── log.md         ← 全部 wiki 操作的追加式记录
```

### 第 3 层：Schema（`{wikiDir}/SCHEMA.md`）

定义 wiki 的约定：哪些标签合法、页面如何组织、领域边界在哪。
所有页面必须符合 schema。

---

## 会话启动协议

任何 wiki 操作之前，按以下顺序读三个文件定位自己：

```
1. SCHEMA.md  → 了解领域、约定与标签分类
2. index.md   → 掌握已有页面（防止重复建页）
3. log.md     → 扫最近 20-30 条看近期动态
```

这份三文件定位法防掉 wiki 最常见的问题：建重复页、漏交叉引用、
违背既有约定。这些文件尚不存在时（全新 wiki），在 Ingest 操作的
初始化环节一并创建。

---

## 并发会话

wiki 可能被共享——NAS 后端的 `wikiDir` 会被其他会话和技能
（如 jenkins-log-auto-learning）写入。`log.md` 是协调账本；
`index.md` 是热点。

- 每次页面写入后**立即**追加 `log.md` — 在碰 index.md **之前**
- 写 `index.md` 前先从磁盘重读，把你的条目合并进当前版本；
  绝不用内存里的副本整体重写
- 若 `log.md` 出现比你上次读取更新的条目，先重跑会话启动协议再继续
  （有人并发 ingest 了）
- 每个操作的写入窗口要短：页面 → log 追加 → index 合并，一口气完成

---

## 核心操作

### 操作 1：Ingest（摄取）

把原始素材转化为编译后的 wiki 知识。

**触发**：用户提供文章、论文、转录稿、URL 或文本要求录入。

#### 步骤

1. **保存原始素材**到 `{rawDir}/{type}/`（articles、papers 或 transcripts）。
   用户提供 URL 时先抓取内容并存为 markdown。
   给 raw 文件加元数据头：
   ```markdown
   ---
   title: "{source title}"
   url: "{original URL if applicable}"
   author: "{author}"
   date: "{publication date}"
   ingested: "{today's date}"
   ---
   ```

2. **读会话启动文件** — SCHEMA.md、index.md、log.md（见上文协议）。

3. **与用户讨论要点** — 总结素材的 3-5 个关键概念，动笔前问清楚
   是否有想强调的侧重点。这个对话环节确保 wiki 捕获的是用户认为
   有价值的东西，而不是抽象意义上的「看起来重要」。
   批量/自动化模式（用户不在场）：自行归纳 3-5 个要点后继续，
   并在 `log.md` 记录该讨论环节系自动跳过。

4. **检查既有页面** — 对每个关键概念和实体，检索 index.md 看是否
   已有页面。已有页面走更新；只有真正的新主题才建新页。

5. **创建或更新 wiki 页面**：
   - 创建一个总结该素材的 source 页面，以页面标题命名
     （见 Wikilink 规则：文件名 = 标题）
   - 对每个重要实体或概念：
     - 已有页面 → 用新信息更新它，把该素材加进 references
     - 没有页面 → 创建（但必须满足建页门槛：被 2+ 素材提及，
       或是该素材的核心主题）
   - 加 `[[wikilink]]` 连接相关页面（每页最少 2 条出链）
   - 每个新页面必须带合规的 YAML frontmatter（见下文页面格式）

6. **更新 log.md** — 追加一条带时间戳的条目，记录 ingest 了什么、
   建了/改了哪些页面。（按「并发会话」，log 追加先于 index 写入。）
   一次操作 = 一条条目：后续校验结果（第 8 步）并入同一条目，
   不另起一行结果记录。

7. **更新 index.md** — 为每个新建页面加条目，合并进从磁盘重读的
   最新副本。条目格式为 `- [[Page Name]] — one-line description`
   （用双方括号，校验器的 index 完整性检查才会计入）。index.md 里
   不许留双方括号的占位示例——文件中每个 `[[X]]` 都必须指向真实页面。

8. **运行校验** — 执行 `validate-wiki.mjs` 检查断链、缺失
   frontmatter 等，修复发现的问题。

#### 建页门槛

不要为素材里出现的每个名词建页。一个概念或实体满足以下条件才配拥有页面：
- 出现在 **2+ 份不同素材**中（交叉引用足够多，值得立页），或
- **是单一素材的核心**（如论文的主题本身），或
- 是 LLM 领域的**知名实体**（如 GPT-4、Andrej Karpathy、RLHF）

拿不准时，先在既有页面里以纯文本提及，并在 `log.md` 记为「待建页」候选。
**不要**留下指向不存在页面的 `[[wikilink]]`——任何断链都会让校验直接失败
（断链数必须为 0）。待建候选攒够支持后，再建页并补链接。

### 操作 2：Query（查询）

用编译后的 wiki 知识回答问题。

**触发**：用户提出关于 LLM、AI 或 wiki 覆盖主题的问题。

#### 步骤

1. **读 index.md** — 找与问题相关的页面。

2. **搜索 wiki 页面** — index.md 没有明显命中时，用问题里的关键词
   搜索 wiki 目录。

3. **读相关页面** — 基于 wiki 内容综合出答案。引用页面时用
   `[[Page Name]]` 链接，方便用户追查。

4. **若答案足够重要**，考虑存档。重要性经验法则：答案综合了 3+ 页面、
   解决了一个对比问题、或跨页面拼接了信息时存档；单页即可复述的
   直接查询不存档：
   - 对比类问题 → 存 `comparisons/`（如 "Transformer vs RWKV"）
   - 复杂多页答案 → 存 `queries/`
   - 简单查询 → 直接回答，不存档

5. **wiki 未覆盖该主题时**，如实告诉用户。建议 ingest 一份相关素材，
   而不是编造答案。

6. **更新 log.md** — 追加简短条目，记录查询内容与参考过的页面。

### 操作 3：Lint（检查）

校验 wiki 的一致性与质量。

**触发**：用户要求检查质量、校验或 lint wiki。

#### 步骤

1. **运行 `validate-wiki.mjs`** — 覆盖以下量化检查：
   - 断链 `[[wikilink]]`（指向不存在页面的链接，**含 `index.md` 目录链接**）
   - 自引用（页面链向自己）
   - 孤儿页（入链为零的页面；除非 `scoring.indexCountsAsInbound` 为 `false`，`index.md` 目录链接计入入链）
   - index 完整性（每个页面都列进了 index.md）
   - frontmatter 有效性（必填字段齐全；`type` 必须是基础类型或 SCHEMA.md `## Page Types` 中声明的类型）
   - 超大页面（超过 `page.maxLines`）
   - 最少出链（低于 `page.minOutboundLinks`）
   - 标签合规（标签存在于 SCHEMA.md 分类中；`ue5.5` 这类版本号风格标签合法——允许点号、必须小写）
   - **staleness**（raw 证据新于页面 `updated` 日期；传 `--raw` 或依赖配置 `knowledgeBase.rawDir`。默认仅报告，除非 `scoring.stalenessEnforce` 为 `true`）
   - **同名歧义**（跨目录同名 basename 的页面使 `[[Title]]` 解析产生歧义。默认仅报告，`scoring.ambiguousNamesEnforce` 为 `true` 时 FAIL）

2. **审阅报告** — 脚本输出带评分的报告。分数 < 9.0 时先修问题再宣称
   wiki 健康。保存报告或任何工作文件时放在 `{wikiDir}` **之外**——
   wiki 内每个 `.md` 都会被当作页面计数和校验。

3. **按以下优先级修复问题**：
   - **stale 页面（recurrence 回流优先）**：对 staleness 节中的每个页面，
     读更新的 raw 证据并重新编译页面——见
     [Recurrence 回流](#recurrence-回流跨技能契约)。stale 页面意味着
     wiki 正在输出过时知识；优先级高于一切表面修整。绝不只改 `updated`
     日期而不真正吸收证据
   - **断链**：链接合法就建缺失页面，链接有误就修复/删除
   - **孤儿页**：从相关页面加入链；页面太小无法独立时并入父页面
   - **缺失 frontmatter**：补齐必填 YAML 字段
   - **超大页面**：拆成聚焦的子页面并交叉引用
   - **出链不足的页面**：向相关概念补 `[[wikilink]]`

4. **重跑校验** — 循环直到分数 >= 9.0、断链 = 0、且 staleness 节清零
   （或明确报告为用户接受的积压）。

5. **更新 log.md** — 记录 lint 结果与所做修复。一次操作 = 一条条目：
   校验结果并入 lint 条目本身，不另追加结果条目。

---

## Recurrence 回流（跨技能契约）

wiki 的核心承诺是*一次编译、持续保鲜*。更新知识的最高信号时机，是
**有比页面更新的 raw 证据到达**时——尤其是一次 recurrence：同一错误
模式在已有书面修复之后复发。校验器的 staleness 节精准圈出这些页面；
本节定义接下来必须发生什么。

**与 raw 侧生产者的契约**（如 jenkins-log-auto-learning，其自身约束
禁止写 `wikiDir`）：

1. recurrence 记录写入 `{rawDir}/details/recurrence-{PageStem}.md`，
   带 `recorded_at` frontmatter 日期和指向既有 wiki 页面的指针。
   命名约定即交接信号——回流由本技能负责。
2. wiki 侧，每个 stale 页面的回流意味着：
   - 读 raw 证据（recurrence 记录，必要时读其引用的构建对）
   - 在页面上追加或更新 `## Recurrence` 节：日期、构建（们）、如已
     跟踪则含复发次数、以及与原分析的差异（同根因？新变体？原修复
     不完整？）
   - 若新证据与页面原有分析矛盾，按[矛盾处理](#矛盾处理)带日期记录
     两者——不静默改写历史
   - 把 `updated:` 提到回流日期（页面永不早于其引用的证据）
3. 回流验收：对每个匹配 `{rawDir}/**/recurrence-*.md` 的文件，被引用
   页面的 `updated` 日期 >= 该文件的 `recorded_at` 日期。一旦启用
   `scoring.stalenessEnforce`，`validate-wiki.mjs` 的 staleness 节
   会机械化强制这一点。
4. 一条 `log.md` 条目覆盖整个回流批次（operation:
   `recurrence-loopback`），列出更新的页面与消费的证据文件。

层的边界保持不变：raw 永不可变，只有本技能写 `wikiDir`，
recurrence 记录本身一经记录也不再编辑。

---

## 页面格式

每个 wiki 页面必须带 YAML frontmatter 并遵循一致的结构。这让页面可
机器解析（兼容 Obsidian）并保证质量。

### 必填 frontmatter

```yaml
---
title: "Page Title"
created: 2026-04-13
updated: 2026-04-13
type: entity | concept | source | comparison | query
tags: [tag1, tag2]
sources: ["Source Name 1", "Source Name 2"]
---
```

所有标签必须先在 SCHEMA.md 中定义。需要新标签时，先加进 SCHEMA.md
再使用。同理，`type` 必须是上述五个基础类型之一——部署需要扩展类型
（如 `jenkins-error`）时，先在 SCHEMA.md 的 `## Page Types` 节声明；
校验器接受基础类型加上那里声明的一切。

frontmatter 字段分两档：**`title` / `type` / `tags` 是校验器硬门**——缺失或
type 非法直接计入 Frontmatter 维度扣分；**`created` / `updated` / `sources`
是模板契约**——建页时照模板写全，校验器不硬拦，其中 `updated` 参与
staleness 判定（存在对应 raw 证据时，缺失 `updated` 按 stale 处理）。
两档都不可省；Lint 修复时优先补硬门字段。

给缺失 frontmatter 的既有页面补头部时（如 Lint 修复中），能确定原始
创建日期就把 `created` 保持为该日期；否则用今天的日期，并在 `log.md`
里注明系回补。

### 各类型页面结构

全部五种页面类型的完整模板在
[references/page-templates.md](references/page-templates.md) — 建页时
先读它。摘要：

| 类型 | 所在目录 | 典型章节 |
|------|----------|------------------|
| entity | `entities/` | Key Facts, Significance, Related |
| concept | `concepts/` | How It Works, Variants, History, Related |
| source | `sources/` | Key Takeaways, Concepts Introduced, (Notable Quotes) |
| comparison | `comparisons/` | 见 references 完整模板 |
| query | `queries/` | 见 references 完整模板 |

### Wikilink 规则

- 所有 `[[Page Name]]` 链接必须指向 wiki 中真实存在的 `.md` 文件
- entity 页放 `entities/`，concept 页放 `concepts/`，source 页放 `sources/`
- **不要造跨目录相对路径**（如 `../concepts/foo.md`）— 用裸
  `[[Page Name]]`，让校验脚本解析位置
- **文件名 = 页面标题**：`[[Page Name]]` 解析到字面上名为
  `Page Name.md` 的文件。不要 slugify 文件名
  （错：`sources/attention-is-all-you-need.md`；
  对：`sources/Attention Is All You Need.md`）
- 校验器在规范目录加上 SCHEMA.md `## Page Directories` 声明的目录内
  解析链接（部署可以把页面放进额外目录，如 `details/`；先声明，否则
  链入它们的链接按断链算）。放在这些目录之外的页面按断链算
- `[[Page Name]]` 必须是精确的页面标题：不支持别名语法
  （`[[Page|alias]]`），括号内不许换行
- source 页与 concept/entity 页同名时，给 **source** 页改名消歧
  （如用作品全名或加 `(paper)` 限定词）；不同目录下两个同名
  basename 的页面会让 `[[Title]]` 解析产生歧义
  （校验器的 Ambiguous Page Names 节会点名此类页面）
- 每页至少 2 条出链 `[[wikilink]]`
- 避免自引用（页面链向自己）

### 矛盾处理

素材之间有分歧时（如同一模型的参数量不同），不要静默二选一。
带日期和来源把两者都记录下来：

```markdown
## Parameter Count
- **175B** according to [[GPT-3 Paper]] (2020)
- **~170B** estimated by [[Scaling Laws Analysis]] (2023)
Note: The discrepancy may reflect different counting methodologies (with/without
embedding parameters).
```

### 页面大小限制

页面超过 200 行就拆分。创建聚焦的子页面并从父页面链接。例如
"Transformer" 可以拆成：
- `[[Transformer]]` — 概览与意义
- `[[Transformer Architecture]]` — 架构详解
- `[[Transformer Training]]` — 训练技术

---

## wiki 初始化

启动全新 wiki（无既有文件）时，创建以下基础文件（模板保持英文——
wiki 页面与基础文件是英文产物）：

### SCHEMA.md

```markdown
# Wiki Schema

## Domain
LLMs, deep learning, AI research, ML systems, and related topics.

## Tag Taxonomy
<!-- At initialization, copy the FULL tag groups from
     references/tagging-taxonomy.md into this section, REPLACING this comment.
     STRIP the backticks and descriptions: SCHEMA lists bare tokens
     (e.g. `- person`), because that is what the validator parses. That file is
     the single source of truth for tags — do not maintain a second, diverging
     list here. -->

## Page Types
<!-- Optional. Base types (entity/concept/source/comparison/query) are always
     valid; list ONLY deployment-specific extensions here, one per line
     (e.g. `- jenkins-error`). The validator reads this section. -->

## Page Directories
<!-- Optional. List additional page directories beyond the canonical five
     (e.g. `- details/`). The validator resolves [[links]] and counts pages
     there. Leave empty for a standard LLM-domain wiki. -->

## Conventions
- Page titles use Title Case
- Tags use lowercase-kebab-case
- Dates use YYYY-MM-DD format
- Files use UTF-8 without BOM; LF or CRLF line endings both accepted
```

### index.md

```markdown
# Wiki Index

> Auto-maintained catalog. One line per page: `- Page Name — one-line description`

## Entities

## Concepts

## Sources

## Comparisons

## Queries
```

### log.md

```markdown
# Wiki Log

> Append-only record of all wiki operations. Most recent entries at the bottom.

| Date | Operation | Details |
|------|-----------|---------|
```

---

## 延伸参考

实现或审查 wiki 流水线时，读 [references/validation-and-constraints.md](references/validation-and-constraints.md) 获取校验脚本说明、详细参考与操作约束。
