# 行为对照表: 2026-09-03-trending-weekly-redesign

**v1 草稿——待用户逐处质疑，未锁定。**

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | 打开周报（data.js 含 20 仓） | 单一 8 列表格平铺，状态是第 7 列里的一个词 | TLDR 头（期标题=前 3 头条串联+导语）→ 统计条 → 新晋段（绿色高亮，前 10 平铺，其余 `<details>` 折叠）→ 回锅段（黄色次级标记，平铺不折叠）→ 常驻段（默认折叠） |
| 2 | 每个仓库行的主数字 | 「本周+★ / 总★ / 环比」三列平权 | 唯一 hero metric：`+22,095★ this week` 右对齐 tabular-nums + 行内绿色比例条（宽度=周增占比）；总★降为次级小字；前三名 rank 金色 |
| 3 | 点击某仓库行 | 详情卡固定插在整表下方，不锚定 | 被点行的内联详情卡就地展开/收起；卡内含四字段注释、扩展元数据（license/建仓/推送/issues/forks）、sparkline、在场徽章、README 摘录折叠块 |
| 4 | enrich 阶段（每仓库） | 调 2 个 gh endpoint（repos 元数据 + readme），输出 `ok #1 tt-a1i/archify (+readme)` | 调 5 个 endpoint（+git/trees 顶层、contributors 前 20、commits 近 90 天概要、releases 最近 3），输出行追加信源标记如 `ok #1 tt-a1i/archify (+readme +tree +contrib +commit +release)`；单信源失败不整仓失败（对齐 api_ok 既有降级哲学） |
| 5 | update-history 重分类（如回填导入后 rank1 从 new 变 returning） | analysis.md 无感知，继续显示旧分类结论（W36 实证过期） | 检测到 entry_status 集合与 analysis 落笔时不一致 → 在周 JSON 侧记 staleAt/staleReason；viewer 顶部亮黄条「分析待重跑」 |
| 6 | LLM 写 analysis.md | 模板：三 bullet（是什么/为什么现在火/值得关注吗），新晋>8 详写前 8 | 模板：四字段（一句话定位=领域×解决什么 / 为什么这周爆=带数据出处 / 可信度信号 / 生态位与竞品=直接竞品+差异点）；判断必须挂证据；四字段带固定标签行供 build-report 结构化抽取 |
| 7 | 视口 ≤640px | 无断点，8 列表格横向溢出 | 单列降级：隐藏总★列与描述行，保留 rank/名称/+N★；主容器 padding 收窄 |

### 边界值行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| B1 | 常驻 = 0 的周（W36 实况） | 无此分类展示问题 | 常驻段渲染空态框：说明该分类在首个 live 周后出现，历史在场靠 backfill 补充 |
| B2 | 新晋 > 10 | 全部平铺 | 前 10 平铺，其余折叠在「显示其余 N 个」后 |
| B3 | 仓库无 backfill presence 记录（230 个有、榜外新仓无） | 不适用 | 行内不渲染在场徽章，详情卡不渲染在场栏——静默降级不报错 |
| B4 | 历史快照 <2 点（新晋仓首周） | 不适用（无轨迹展示） | sparkline 位渲染「轨迹：仅 N 个快照（跨周积累中）」文案 |
| B5 | api_ok=false（gh 富化失败的仓） | 详情有元数据缺失 | 维持现状哲学：字段空、不阻塞渲染；四字段注释对该仓标注「信源不完整」 |
| B6 | 旧周 analysis.md（三 bullet 口径，无四字段标签） | 整篇 md 原样展示 | 整篇仍展示 + 详情卡注释位显示「待新口径生成」占位（不误导读旧结论） |

## 不变清单

<与变化行同等重要——这些现有行为必须保持原样，谁在依赖它>

| 不变项 | 谁在依赖 |
| --- | --- |
| 零依赖单文件，双击 file:// 离线可开（AC-6） | 用户的核心使用方式（不发版、不装环境） |
| `<script src="data.js">` 注入机制与 window.TRENDING_DATA 约定 | run-tests T6/T8 的字符串断言（run-tests.mjs:167,201）；file:// CORS 规避方案 |
| trending-week/1、repo-history/1 契约**只增可选字段、不删不改现有字段** | 全部历史周 JSON、validate-week、backfill 回填数据 |
| serve.mjs 路由与 /api/* 报文字节不变 | 调试/自动化访问（D2 锁定） |
| 榜单固定 20 条、解析异常宁可失败 | design.md AC 哲学、fixtures 契约 |
| 数据管线（fetch/parse/enrich/validate/history/build）零 LLM 参与；analysis.md 缺失时报告照常产出（AC-7） | design.md:17 的用户明确要求 |
| 配置链 CLI > $SKILL_ENV > ~/.config > 技能内占位 | T9 测试与既有部署 |
| `node run-tests.mjs` 退出码语义（0=全过） | 晋级门禁（skill-release.md）、`npm run evals` |
| enrich 150ms 仓库间 delay、单仓失败不整批失败 | gh api 限流礼貌性约定（enrich-repos.mjs:19） |

## 配置差异

**无。** 不新增用户配置项；backfill 消费路径为 workspace 既有目录，缺失时静默降级（见边界值 B3）。
