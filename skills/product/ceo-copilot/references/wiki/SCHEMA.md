# CEO Copilot 商业知识 Wiki Schema

## Domain

为 `ceo-copilot` 的新产品立项商业诊断提供可按需读取、可追溯来源的书本知识、概念、方法与机制案例。诊断地图为 V1–V8；知识页只提供问题与方法，不替代材料证据或用户决策。

## Page Types

- book
- concept
- method
- case

## Page Directories

- books
- concepts
- methods
- cases

## Tag Taxonomy

### Domain
- business-strategy
- business-model
- product-discovery
- customer-research
- product-management
- go-to-market
- pricing
- experimentation
- scaling
- organization
- competition
- growth

### Source and evidence
- book
- theory
- official-source
- author-source
- report-source
- case-study
- source-limited
- derivation

### Diagnostic layers
- v1
- v2
- v3
- v4
- v5
- v6
- v7
- v8

## Source Policy

- 优先使用出版社、作者/研究机构官网、官方工具库与原案例机构的公开页面；每个页面写明标题、URL、来源类型与访问日期。
- 报告内容标注《第二增长曲线新产品立项参考报告》对应行号；公开资料标注本 wiki 访问日；基于报告的综合应用标“报告应用推导”。
- 来源深度必须如实记录：阅读全文、官方概览/目录、工具说明、案例摘要或仅索引。不能把摘要深度写成通读原书。
- 原书和网页只做原创摘要，不复制段落或大段引文；除非必要，不使用引文。
- 不保留电子书、网页原文或共享 NAS raw 目录副本；本 wiki 存原创综合、来源链接与证据边界。
- 案例页保留报告明确写出的事实、机制解释、应用推导与限制。来源只到题材或索引时，案例入口显式保留实际深度和未验证理由，报告的解释不能将原材料升级为完整机制或结果证据；每页必须写“不能推出什么”。
- 不补报告已剔除的案例结果数字，除非独立公开来源可核对并在页面中给出出处。

## Page Conventions

- 文件名即 wikilink 标题；使用唯一的 B/T/C/K/M 前缀避免跨目录重名。
- 每页 YAML frontmatter 至少含 `title`、`type`、`tags`；另加 `created`、`updated`、`layers`、`report_lines`、`sources`。
- 每个概念页另含“拿它问什么”和“误用边界”；每个案例页含“机制”“证据与深度”“不能推出什么”。
- 所有正文为中文；英文名只用于书名、术语对照与来源标题。
- 所有 wiki 页面至少有 2 个指向其他页面的双括号链接；目录 `index.md` 必须列出每个页面。
- 单页不超过 200 行。避免仅因词语重复建概念页；优先把跨书复用、对某一书为核心的方法独立成页。
- 日期使用 `YYYY-MM-DD`。既有网页核查记录保留其原日期；本轮 `report_accessed=2026-10-02` 只表示读取锁定报告，`external_links_revalidated=false` 表示未重新访问外链。

## Diagnostic Layers

- V1：为什么做——处境、约束、贡献与可承受损失。
- V2：做哪个——机会、竞争场域、取胜方式与取舍。
- V3：真实需求——谁在何种情境下完成什么任务、现在如何替代。
- V4：解法成立吗——真实输入上能否交付、使用后是否改善结果。
- V5：谁付钱——预算来源、购买角色、收费单位与价格证据。
- V6：采用与获客——采购、导入、首次价值、渠道与重复获客。
- V7：复制——换客户、换团队后是否仍成立及增量服务成本。
- V8：规模与防守——经济规模与竞争优势能否持续。

## Runtime Loading

技能运行时只按相关诊断层读取索引中对应的概念/方法页；不得自动读取所有书页或案例页。书页与案例页用于核对来源与展开追问，不作为作者背书。
