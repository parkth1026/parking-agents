# 本周分析写作口径

输入：`data/weeks/<YYYY-Www>.json`（已过校验）。产出：`data/weeks/<YYYY-Www>.analysis.md`。写完后重跑 `build-report.mjs`，分析会内联进 HTML。

## 结构模板

```markdown
## 本周看点

两到四句：本周榜单整体画像（什么类型的项目在刷屏、和上周比有什么变化）。

## 新晋仓库

### owner/repo —— 一句话定位

- **是什么**：基于 description / topics / README，用两三句讲清它解决什么问题、给谁用。
- **为什么现在火**：stars_week 增速 + 上线时间（created_at）+ 近期推送（pushed_at）里的线索；是蹭上了什么事件/趋势，还是版本发布。
- **值得关注吗**：一句判断（有实用价值 / 信号意义大于实用 / 纯热点）。

（每个 new 仓库一小节；新晋超过 8 个时挑 stars_week 前 8 个详写，其余合并成一句话清单）

## 常驻与回锅

一段话：recurring/returning 里星数加速度变化最明显的两三个，各一句。

## 数字速览

- 本周榜首：owner/repo（+N,NNN）
- 新晋 X · 常驻 Y · 回锅 Z
```

## 写作纪律

- 事实只来自周快照 JSON 与 README 摘要，不确定的不写、不编造。
- 中文，每个仓库 3-5 句，读者是技术型产品经理：讲清「解决什么问题、生态位在哪」，不堆形容词。
- 首个历史周（所有仓库都是 new）按 stars_week 排序详写前 8 个。
- 不写没有数据的推测（如融资、作者动机）。

## 知识页模板 `<WS>/wiki/<YYYY-Www>.md`

```markdown
---
title: GitHub Trending 周报 2026-W36
date: 2026-09-02
tags: [trending-weekly]
---

# 2026-W36 周榜

榜首 [[owner/repo]]（+22,095）……

## 新晋
- [[owner/repo]] —— 一句话
（仓库首次上榜才建 [[wikilink]]；同一仓库多周上榜时链接到首次出现的周页）
```

知识页是给人翻的时间线，分析深度以 analysis.md 为准；wiki 页只放结论一句话版。
