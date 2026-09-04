# Goal Contract: github-trending-weekly 周报改版——trendshift 视觉 1:1 单列 Top20 + SURGE 加速度层 + 四字段实锤注释

- Status: Ready
- Target: `skills/pub/github-trending-weekly/`（assets/viewer.html、scripts/enrich-repos.mjs、scripts/lib/report-data.mjs、scripts/update-history.mjs、scripts/build-report.mjs、references/analysis-guide.md、run-tests.mjs、fixtures/、scripts/assert-browser.mjs 新建）
- Updated: 2026-09-03

## 原始请求

> 这周 GitHub 上爆了什么？ 然后他们是干啥的？？
> trendshift 做了排行榜而且做得很不错。但是两点不太满意
> 1. 谁是新晋的，因为我每周都会看都会关注，老的没必要一直看，我期望新晋的可以突出显示
> 2. 每个仓库都是干嘛的？我需要深度调研并展示，我要的是实锤信息，而不是广告或者自己的介绍。

过程关键裁决原话（照录）：「直接照抄 Trendshift」「首页必须 top20 展示，只是把新晋的加速度猛的要表达出来」「这个才是我真的最关注的内容」（定位字段）、「图片应该放在每个仓库名字前面」→ 后澄清为行尾 16:9 大图、「太宽了还是不行 还是要设置上限」。

## 目标

周报页从「无验收的大表」变成：对 trendshift.io/weekly 视觉 1:1 的单列 Top20 榜单（新晋/回锅徽章 + SURGE 加速度显性化 + 行尾 16:9 核心图），点行展开四字段实锤注释（定位/为什么爆/可信度/生态位竞品）；管线升级支撑（enrich 5 信源、stale 咬合、四字段 LLM 口径 + nicheTags 受控词表）；零依赖双击可开保持。

## Why

- 现状：viewer 是视觉零验收的 8 列大表；注释=README 复述（用户定义的「广告」）；新晋不突出；积累数据无可视化。
- 用户每周核心动作：发现本周新晋爆发仓 → 判断它是什么、值不值得花时间。本契约全部 AC 都服务这条动作链。

## 范围

**做**：viewer.html 全面重构（trendshift 实测规格行 + SURGE 层 + 行尾核心图 + 四字段详情卡 + 移动端降级 + 1152 上限）；report-data 白名单扩展（api-mock.md）；enrich 扩 3 endpoint（git/trees、contributors、commits、releases 中凑 5 个）；update-history stale 咬合；build-report 计算 accel/coreImg、抽取 note；analysis-guide.md 四字段口径 + nicheTags 受控词表；run-tests 新增数据层断言；新建轻量浏览器断言脚本（D-05）。

**不做**：trendshift 数据接入或 iframe；联网外部讨论检索（HN/Reddit/X）；亮色主题；竞品知识库聚合页（生态位字段留聚合口）；URL 深链；serve.mjs 路由与 `/api/*` 变更；新增用户配置项；sparkline 轨迹（round7 裁决移除）。

## 强约束

1. **确认版对照物不可修改**：`2-prototype/mock.html`、`behavior.md`、`api-mock.md`、`example-run.md`、`diagram.html`。执行 Agent 改的是产品，不是尺子。
2. **视觉规格源**：trendshift.io/weekly DOM 实测值（2026-09-03 快照，见 mock.html 头注释与 behavior.md 变化行2）。**复刻精度口径 = 关键元素规格级**（规格表逐项 computed-style 断言 + 用户看整体；非像素级，round C1 裁决）。规格源整体替换（如 trendshift 改版后重新实测）须回访谈记录记 overturned。
3. `assets/viewer.html` 路径与 `<script src="data.js">` 引用保留（run-tests T6/T8 耦合点）。
4. `trending-week/1`、`repo-history/1` 契约**只增可选字段，不删不改**；serve.mjs 路由与 `/api/*` 报文字节不变；榜单固定 20 条；数据管线（fetch/parse/enrich/validate/history/build）零 LLM；AC-6 双击离线可开；配置链不变。
5. `--page-max:1152px` 为锁定值（CSS 变量；改值回契约）。
6. SURGE 阈值 20% 为锁定值（W36 数据断层依据；改阈值回契约）。
7. 现有 run-tests T1–T10 断言语义不变（只增不减）；W36 黄金快照（D-01/D-02）锁定不可修改。

## 自主边界

不用问，直接定：
- viewer CSS/布局实现细节、断言脚本内部结构与检查项命名、测试节编号、fixture 文件命名
- 白名单具体键名执行细节、readme 上限执行值（契约锁 2400）、analysis-guide 措辞
- nicheTags 受控词表初版条目（结构锁死：数组、小写连字符、与 build-report 抽取标签行一致）
- 常驻注释复用机制（从上周 analysis 提取或重写）

必须停下来问：
- 删既有能力、改 `/api/*` 报文、引入任何外部依赖或把 LLM 加进数据管线
- 改 `--page-max` 1152 或 SURGE 阈值 20%（强约束 5/6）
- 视觉规格源整体替换（重新实测 trendshift）

## 读什么

- `../2-prototype/mock.html` —— 视觉与交互规范源（确认版·锁定）
- `../2-prototype/behavior.md` —— 11 变化行 + 9 边界值 + 9 不变项
- `../2-prototype/api-mock.md` —— data.js 载荷契约（字段/缺省/约定）
- `../2-prototype/example-run.md` —— 改版后周跑样例
- `../2-prototype/diagram.html` —— 架构改后态（依赖方向不变式）
- `references/design.md`、`references/data-schema.md`、`references/analysis-guide.md` —— 现行设计与契约

## 要落盘的东西

- D-01: `fixtures/golden/2026-W36.json` —— W36 真实周数据锁定快照（黄金尺子，不可修改；来源 workspace `D:\GIT_dev\github-trading\data\weeks\2026-W36.json`）
- D-02: `fixtures/golden/2026-W36.analysis.md` —— 配套分析样例（含四字段固定标签行，供抽取断言）
- D-03: `fixtures/stub/` 扩展 —— git/trees、contributors、commits、releases 的 gh api 回放 + 单信源失败样例
- D-04: `fixtures/old-week/` —— 旧口径周数据样例（无新字段，验 B6/双向兼容）
- D-05: `skills/pub/github-trending-weekly/scripts/assert-browser.mjs` —— 轻量浏览器断言脚本（node + playwright-cli），`--checks layout|tokens|detail|mobile` 输出退出码

## 验收条件

- AC-001: 版面按确认版渲染（桌面+移动）：单列 Top20 全量 20 个 .row、无分组/折叠、listhead 计数正确、TLDR 首行含最猛前三；trendshift 规格表逐项 token 一致（行 pad 24/16、分隔线 #DADCE7、名 16px/500 rgba(23,23,23,.8)、描述 14px #5C5E70、数字 14px/500+Gained 12px 70%、徽章 10px/600/uppercase/.25px #6670CC、pill 12px r6、H1 24px/600）；主区 1152 居中；≤640 降级（描述/fork 隐藏、图全宽置底、kv 两列）
  - Verify: [A] `node skills/pub/github-trending-weekly/scripts/assert-browser.mjs --checks layout` → 退出码 0；[A] `node skills/pub/github-trending-weekly/scripts/assert-browser.mjs --checks tokens` → 退出码 0（口径=关键元素规格级）；[A] `node skills/pub/github-trending-weekly/scripts/assert-browser.mjs --checks mobile` → 退出码 0
- AC-002: SURGE 层正确：黄金快照（D-01）下恰 5 仓 vel≥20% 带徽章与速度条、archify ×21.7 vs W28、TLDR 首行含 claude-plugins-community、vel<20% 无徽章
  - Verify: [A] `node skills/pub/github-trending-weekly/run-tests.mjs`（SURGE 节）→ 退出码 0
- AC-003: data.js 载荷符合 api-mock.md：新字段全可选、旧周样例（D-04）渲染不报错、readme≤2400、accel 由 build-report 计算、staleAt 缺省不误报
  - Verify: [A] `node skills/pub/github-trending-weekly/run-tests.mjs`（载荷契约节）→ 退出码 0
- AC-004: 行尾核心图三级回落：fixture 相对路径解析为 raw.githubusercontent.com/仓库全名/HEAD/ 绝对 URL → 无 README 图回落 Social Preview → 断网首字母色块
  - Verify: [A] `node skills/pub/github-trending-weekly/run-tests.mjs`（解析断言）→ 退出码 0；[C] 断网双击 report/index.html → 行尾图位显示首字母色块、控制台零报错
- AC-005: 详情卡四字段渲染：定位 lead、为什么爆、可信度、生态位 nicheTags 药丸+同类差异行；点行展开/再点收起；卡内无图片元素
  - Verify: [A] `node skills/pub/github-trending-weekly/scripts/assert-browser.mjs --checks detail` → 退出码 0
- AC-006: 数据管线回归：重分类写 staleAt/staleReason→build-report 透传→viewer 黄条（旧周不误报）；enrich 5 endpoint 输出含 +tree/+contrib/+commit/+release 且单信源失败不整仓
  - Verify: [A] `node skills/pub/github-trending-weekly/run-tests.mjs`（stale+enrich 节，D-03）→ 退出码 0
- AC-007: 四字段注释内容质量：定位 2-4 句含领域×解决什么×核心界面；为什么爆为因果叙事且不复述行内数字；生态位含具体竞品名——由用户本人每周读当期 analysis 定夺，不合口径打回重写
  - Verify: [C] 用户读当期 analysis.md（首验=改版后第一个分析样本）

## 挡着的事

- None.（W36 数据、gh 凭证、fixtures 素材均在场）

## 残留风险

- trendshift 规格表为 2026-09-03 快照，对方改版后的新元素不在表内 — 错了会怎样：AC-002 拦不住「新元素缺失」，靠用户看整体补
- 浏览器断言脚本（D-05）为本期新建，自身 bug 可能误报 — 错了会怎样：AC-001/002/005 的红需人工复核是产品错还是尺子错
- nicheTags 受控词表初版未经长期使用检验 — 错了会怎样：早期周 tag 覆盖不齐，聚合竞品库时需回补历史
- 四字段内容质量依赖用户每周人工读（AC-007 无自动化判据）— 错了会怎样：某周口径漂移若用户没读就不被发现

## 访谈记录

### 3-contract 第 1 轮（2026-09-03）

| 问题 | 候选（带百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| mock.html 复刻精度口径 | A 关键元素规格级 55% / B 像素级双轨 25% / C 结构对照 20% | A——规格表客观可断言，像素级成本高且对方改版即红 | A |
| SURGE/载荷断言尺子 | A 锁定 W36 快照 65% / B 现跑现验 25% / C 合成数据 10% | A——真实形态+固定尺子 | A |
| 浏览器层验收途径 | A 建轻量断言脚本 45% / B 全人工 40% / C 只做数据层 15% | A——有退出码可回归 | A |
| 注释内容质量验收人 | A 用户每周全读 70% / B 抽查制 30% | A——用户明言这是最关注内容 | A |

### 过程关键轮次（聚合自访谈全过程：1-interview 2 轮 + 2-prototype 13 轮）

| 轮 | 决定 | 被否决/推翻 |
| --- | --- | --- |
| 1-interview R1 | 信源=仓库内深挖 gh api；形态=结构化四字段；回锅=平铺次级高亮 | 联网讨论（不可回归）、深度长文（扫读死亡）、回锅并入折叠 |
| 1-interview R2 | 场景=偶尔手机看；积累=跨周轨迹核心；注释核心=定位+生态位竞品（用户自定义，推翻「好恶裁决」推荐） | 亮色主题、年度盘点优先 |
| 2-proto R3 | **推翻三段分组+折叠 → 单列 Top20 全量+徽章** | 分组置顶方案（访谈期锁定后被用户推翻） |
| 2-proto R4-5 | 核心图进详情卡 → 移除 sparkline → 定位加长/whyNow 因果/生态位 tag 化 | README 复述式注释、轨迹图 |
| 2-proto R7-9 | 图移行首 44px → 放大 4 倍 16:9 行尾 288×162 | 行首小缩略、详情卡大图 |
| 2-proto R10-12 | 行内文字区重排（行高统一 211px）→ 名次+名字左对齐（space-between 缺陷修复）→ 全宽收回、1152 上限 | 全宽流式（用户否决）、832 限宽（用户否决） |

| 默认区定项（摘要） | 档 | 用户 |
| --- | --- | --- |
| viewer 保留路径与 data.js 引用；serve 不动；注释挂 analysis.md；验收=serve+截图+用户看页；载荷白名单扩展；stale 咬合机制 | 默认 | 未反对 |
| 移动端「能看清」降级；sparkline+backfill 进详情卡（后经 R7 改为行尾图）；四字段含生态位竞品字段 | 默认 | 未反对 |

## 设计取舍

### D-1 榜单主体数据源

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A trendshift 数据为主体 | 每周抓 trendshift HTML 解析落盘为主榜 | 交集实测仅 15%；无 schema 契约；对方改版断代；cloudflare 风险 | 用户裁决爆发口径（「这周爆了什么」）+ 资产自持原则 |
| B（选定）自有 W 榜主体，trendshift 仅视觉参照 | 本契约全案 | 视觉需自维护 | 无 |
| 什么都不做 | 保持 8 列大表 | 用户每周核心动作无法完成 | — |

选定 B。落进契约的形态：`强约束`「不接入 trendshift 数据」；视觉规格源见强约束 2。
