# wiki SCHEMA — 李想产品方法论复盘·弹药层

## Domain

《李想·产品实战16讲》的知识弹药层，服务于 lixiang-product-grill 的运行时复盘：每维度复盘读取对应 source 页取案例链与推理过程，追问引案例锚点。**本层只供弹药与溯源，不承载判据措辞**——判定唯一依据是技能目录下 `references/question-bank.md` 的标准句（逐字引文＋讲次），wiki 页面禁用「合格线」「裁定」字样（由技能 run-tests 单拦）。

## Page Types

- source
- concept
- case

## Page Directories

- sources
- concepts
- cases

（形态说明：source 页＝某讲的引文段＋案例链＋推理过程＋误用边界；concept 页＝方法论概念；case 页＝课程案例。sources 19 页、concepts 16 页、cases 16 页。）

## Tag Taxonomy

### 页类型
- source
- concept
- case

### 归属
- overview
- strategy
- zero-to-one
- scale
- extra
- growth
- culture

## Source Policy

引用真源是 `references/archive/`（19 篇原文，与 product-research 仓导出字节一致，raw 层只读不可变）。S 页引文段必须逐字复制自对应讲 archive 文件；K/C 页一律转述、只标讲次，不复制原句。

## Page Conventions

文件名即 wikilink 标题；S/K/C 前缀消歧跨目录同名。每页 frontmatter 必含 title/type/tags（tags 用行内数组，token 全部在本 SCHEMA 声明）；单页 ≤200 行；每页 ≥2 条出链、禁自引。页面写入顺序：页面 → log.md 追加 → index.md 从磁盘重读合并。

## Runtime Loading

复盘运行时按题库每维度块头的「弹药页：Sxx-…」指针读取对应 source 页（每维度必读）；用户质疑原话语义时先读 S 页引文段、再按需读 archive 对应讲全文。K/C 页在组织追问弹药与案例锚点时按链取用。
