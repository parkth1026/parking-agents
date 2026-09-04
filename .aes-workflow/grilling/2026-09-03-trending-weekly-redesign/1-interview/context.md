# Context Snapshot: 2026-09-03-trending-weekly-redesign

- 创建：2026-09-03T09:40:00+08:00
- 分片来源：facts/verification-infra.md、facts/analysis-pipeline.md（另有会话前置调研：标杆研究 + 双向 steelman 裁决，关键结论记入「已查事实」并标注「会话实测」）

## 任务陈述

用户原话（裁决回合，2026-09-02）：

> 这周 GitHub 上爆了什么？ 然后他们是干啥的？？
> trendshift 做了排行榜而且做得很不错。但是两点不太满意：
> 1. 谁是新晋的，因为我每周都会看都会关注，老的没必要一直看，我期望新晋的可以突出显示
> 2. 每个仓库都是干嘛的？我需要深度调研并展示，我要的是实锤信息，而不是广告或者自己的介绍。

本轮入口原话：「[$workflow-interview] 我们需要 更深刻的 采访调研流程把？」

## 用户提出的方案

双向 steelman 裁决后用户认可的方向：
- 主体 = 自有 W 榜 20 条（GitHub weekly 爆发口径），不用 trendshift 数据、不 iframe（会话实测：同源策略禁合并 + 两榜交集仅 3/20=15%）。
- 视觉抄 trendshift 行样式 + Nightly 三段式 + TLDR 头部 + Rising Stars 折叠（标杆调研结论）。
- 新晋置顶高亮 + 常驻默认折叠。
- per-repo 深度调研注释层替代 README 复述（实锤信息，非广告/自述）。

## 意图假设

把周报从「能用的大表」变成「30 秒扫完本周爆点、新晋一眼可见、每个仓库有第三方视角实锤注释」的个人可积累资产页。与任务陈述的差异（用户没说但成立的前提）：注释可信度要与数据版本咬合（W36 analysis 已因回填重分类过期，facts 实证）；视觉改版的验收途径需要明确（仓库无 HTML 视觉基建）。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| trendshift.io 无 X-Frame-Options/CSP，可 iframe，但 cross-origin 禁读改 DOM，合并不可行 | 会话实测（2026-09-02 curl 响应头） | Fact |
| trendshift 周榜与自有 W36 榜交集 3/20（15%），口径天然分叉（爆发 vs 持续动量） | 会话实测（node 对比脚本） | Fact |
| trendshift 周榜数据内嵌于初始 HTML，正则可提取，抓取成本与 GitHub trending 同量级 | 会话实测 | Fact |
| viewer 唯二测试耦合：assets/viewer.html 存在 + `src="data.js"` 字符串；视觉重构不挡 run-tests | facts/verification-infra.md | Fact |
| 仓库无 CI；npm test 不含本技能 run-tests；npm run evals 会跑但五件套缺四件 | facts/verification-infra.md | Fact |
| 无 HTML/截图验收基建；可用手段：playwright-cli 截图 + aes-qa 截图证据协议 + 人工看页 | facts/verification-infra.md | Fact |
| LLM 边界：只许写 analysis.md 与 wiki 页；analysis-guide.md 是唯一 prompt 载体且属高自由度层 | facts/analysis-pipeline.md（design.md:17,26） | Fact |
| analysis.md 已有 per-new-repo 模板（一句话定位 + 是什么/为什么火/值得关注吗 三 bullet）；新晋>8 时前 8 详写 | facts/analysis-pipeline.md（analysis-guide.md:7-30） | Fact |
| enrich 只调 2 个 gh endpoint（repos 元数据 + readme raw）；代码树/contributors/commits/releases/外部讨论全没有 | facts/analysis-pipeline.md | Fact |
| readme 原始 2500 字符，viewer 载荷层截 900；载荷白名单丢弃 license/open_issues/pushed_at 等 | facts/analysis-pipeline.md（report-data.mjs:18-36） | Fact |
| analysis.md 无结构校验；W36 样例已过期（写「新晋20·常驻0·回锅0」，重分类后 rank1 已变 returning） | facts/analysis-pipeline.md | Fact |
| backfill presence（days_on_list/best_rank，W31–W35）在 workspace 派生层，不进官方契约，viewer 未使用 | facts/analysis-pipeline.md | Fact |
| 视觉零验收是现状根因：design.md AC-1..AC-10 对视觉无要求（唯一 viewer 约束 AC-6 双击离线） | 会话前期 Explore 调查（design.md:30-41） | Fact |

## 验证基建候选池

- `node run-tests.mjs`（技能内 46 断言，唯一回归门；改 viewer 前提=保留 data.js 引用）— 代价：无
- serve.mjs 起本地页 + playwright-cli snapshot/screenshot — 代价：每轮人工核对
- aes-qa 截图证据协议（`npm run test:aes-qa-screenshot-evidence`）— 代价：依赖 GitLab 侧未核验，流程重
- 用户真实打开 8788 / 双击 report/index.html — 代价：人工，最真实
- 新建：data.js 载荷/HTML 结构断言脚本（node 零依赖可写）— 代价：先建，维护随模板演进

## 术语冲突

无（用户词「新晋/常驻/回锅」与 entry_status = new/recurring/returning 一一对应；「深度调研/实锤」为新增口径，进 analysis-guide.md 定义，不与现有术语冲突）。

## 四分类

- **Fact**：见「已查事实」全表。
- **User decision**：两轮已全部裁决（见 rounds.jsonl round 1-2）——信源=仓库内深挖 gh api；形态=结构化四字段（定位/为什么爆/可信度/生态位竞品）；回锅=平铺次级高亮；场景=桌面为主偶尔手机（移动端做能看清降级，亮色不做）；积累=跨周轨迹是核心（sparkline+backfill 进详情卡）；调性=定位与生态位竞品为核（用户自定义，推翻「好恶裁决」推荐）。
- **Agent-owned**：viewer 具体 CSS/布局实现、白名单字段集细节与 readme 上限、analysis-guide 模板措辞、sparkline 画法、常驻注释复用机制（从上周 analysis 提取 or 重写）、HTML 结构断言写法、生态位字段 schema 细节。
- **Blocked**：无。

## 决定结果（收口时点）

- 注释四字段最终口径：一句话定位（领域×解决什么）/ 为什么这周爆（数据出处）/ 可信度信号 / 生态位与竞品（直接竞品与差异，例：mattpocock/skills ↔ superpowers 类技能仓库）。
- 竞品知识库聚合页：本期不做，生态位结构化落盘留聚合口（用户「最终还能形成」= 演进方向）。
- 本期范围最终锁定：三段版面（新晋高亮→回锅平铺→常驻折叠）+ TLDR 头 + trendshift 式行样式 + 四字段注释 + 详情卡（sparkline + backfill 在场数据）+ 移动端能看清降级 + stale 咬合标记 + enrich 信源扩展（代码树/contributors/commits/releases）。不做：trendshift 数据接入/iframe、联网外部讨论、亮色主题、深度长文、URL 深链、serve API 变更、竞品库聚合页。

## 决定边界未知项

- 回锅段地位：初判 User decision（用户明说过新晋与常驻，未提回锅），已列入提问。
- 常驻注释「缓存复用」的具体机制：Agent-owned（不影响可观察验收，只影响每周 token 成本）。

## 未知项

- trendshift 有无公开 API（WebSearch 限流未查完）——本期已裁不做数据接入，不影响执行；若 Q4 选 backfill 接入也不依赖它。
- workspace 现网 report 产物状态——在仓库外，改版后重建即可，不构成提问。
