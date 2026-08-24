<!-- draft v2 | published 2026-08-24T19:05:00+08:00
     用户意见:9 条决策全部经 AskUserQuestion 逐条裁决(见 rounds.jsonl round 2);C1 经三轮收敛到生成式发布树
     状态:confirmed(§0–§4 差距分析内容随 v1 不变;本版锁定改造范围) -->

# 改造范围决定版(v2,v1 §0–§4 差距分析仍为报告正文底稿)

## 决定总表

| 项 | 决定 | 关键裁定 |
| --- | --- | --- |
| C1 | ✅ **方案 D 生成式发布树** | 开发流零改动;分类真源=SKILL.md frontmatter `category:`;`scripts/build-release.mjs` 生成发布树副本+桶 README+顶层索引,`--check` 进 npm test 防漂移;安装器加 `--only <分类>` / `--skills <名单>` 选装;**首批只纳入 Matt 28 个(按目录位置识别,内容零改动),自研技能由用户按「晋级标准操作文档」自助补**;自研路径用测试夹具验证 |
| C2 | ✅ 修 | README 定位段按「自用开发+生成式发布」重写,删「超集」;索引段归生成器维护 |
| C3 | ✅ 建 | CHANGELOG.md(Keep a Changelog 风格)+ 首个 tag v0.2.0 |
| C4 | ❌ 不要 CI | 云端复检不做;G4 差距保留在报告中不闭合;`--check` 仅本地 npm test 兜底 |
| C5 | ✅ 独立命令 | `npm run evals` 逐技能跑评测出汇总表;不进 npm test(真模型耗时耗 key) |
| C6 | ✅ 修 | CONTEXT.md 与 docs/adr/ 一致性(补目录或改表述) |
| C8 | ⏸ 缓 | 安装验收补齐本轮不做 |
| C7 | ❌ 不补 | LICENSE 不引入;转对外时再议 |

## C1 方案 D 机制四件套(锁)

1. **分类真源**:自研技能晋级时在 `.agents/skills/<技能>/SKILL.md` frontmatter 写 `category:`;Matt 28 个按 `skills/` 既有桶位置识别,不写不碰。
2. **生成器** `scripts/build-release.mjs`(名可调):读分类真源 → 生成/刷新 `skills/<分类>/<技能>/` 副本 + 桶 README + 顶层 README 索引段;`--check` 模式挂进 npm test(漂移=红)。
3. **选装**:junction 安装器加 `--only` / `--skills` 可选参数;**无参数行为与现状逐字节一致**。
4. **晋级标准操作文档**(用户点名):完整自助流程——写 category → 评测五件套齐+最新一轮绿 → 跑生成器 → 索引自动登记 → 重装/干跑验证;位置执行时定(建议 docs/agents/)。

## 同步修改

- AGENTS.md「两侧改动需经移植流程同步」表述 → 更新为生成式流程(生成器即同步机制)。
- 报告落盘 `docs/research/对标mattpocock仓库差距-2026-08-24.md`(正文=v1 §0–§4 + 本版决定)。
- G4(CI)/G13(验收 3/9)/G14(LICENSE)/G1(安装真源)保留为「已知未闭合差距」章节。
