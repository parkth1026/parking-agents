# 行为对照表: 2026-08-24-对标mattpocock仓库差距

**确认版·锁定。** 执行 Agent 改的是产品,不是这份对照表。
用户确认:2026-08-24(经 AskUserQuestion 逐条裁决,rounds.jsonl round 2)

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | `.agents/skills/<技能>/SKILL.md` frontmatter | 仅 name+description,自研技能无晋级通道 | 晋级=写 `category: engineering\|productivity\|…`(可选字段;不写=不晋级,行为不变) |
| 2 | `node scripts/build-release.mjs`(名可调) | 命令不存在 | 读分类真源(Matt 28 按桶位置,自研按 category)生成/刷新 `skills/<分类>/<技能>/` 副本+桶 README+顶层 README 索引段;Matt 28 目录内容零改动 |
| 3 | `npm test` | 9 段链 | 10 段链,尾加 build-release `--check`;生成物过期或被手改→该段红 |
| 4 | `install-skills-agents.cmd --only productivity`(或 `--skills a,b`;参数名可调) | 无选装参数,只能全量 | 按分类/名单选装;**无参数时与现状逐字节一致** |
| 5 | `npm run evals`(名可调) | 不存在,逐技能手动跑 | 一条命令逐技能执行评测并输出汇总表;不进 npm test |
| 6 | README.md 定位段 | 「超集」等与实测矛盾(README.md:146) | 按「自用开发+生成式发布」重写;索引段由生成器维护,不再手写 |
| 7 | CHANGELOG.md / git tag | 均无 | CHANGELOG 首条记录本次改造;tag `v0.2.0` 打在合入点 |
| 8 | CONTEXT.md ↔ docs/adr/ | 声称决策记录在 docs/adr/,目录不存在 | 一致:补目录或改表述(按实际内容量定) |
| 9 | 晋级标准操作文档(新文件,建议 docs/agents/) | 无 | 五步自助标准:写 category → 评测五件套齐+最新一轮绿 → 跑生成器 → 索引自动登记 → 重装/干跑验证 |
| 10 | AGENTS.md「移植流程」句 | 「两侧改动需经移植流程同步」但无脚本无文档 | 更新为生成式流程描述(生成器即同步机制) |
| 11 | tests/ 晋级路径夹具 | 无 | 临时技能目录(带 category)→生成→`--check` 绿;自研晋级无真实样本也验得动 |

## 边界值行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| B1 | 无任何自研技能带 category | —(机制不存在) | 生成器 no-op(不建空桶、不改索引),`--check` 绿 |
| B2 | category 值不在分类集(如 `category: foo`) | — | 生成器非零退出并点名技能,`--check` 红 |
| B3 | 自研晋级技能与 skills/ 既有技能重名 | junction 合并时开发侧赢(静默) | 生成器拒绝生成重名副本并报错;junction 侧合并语义保持不变(见不变清单) |
| B4 | 技能目录缺 SKILL.md 或 frontmatter 不可解析 | — | 跳过+警告,不进生成树,不炸整轮 |

## 不变清单

<逐条列出哪些现有行为必须保持原样,写明谁在依赖它>

- junction 安装器**无参数**行为:全量安装、两侧按名扁平合并、重名开发侧赢(`scripts/install-skills.mjs:9-10,61-64,107-115`)——用户的日常开发流押在这上面。
- 9 份 harness manifest 契约与端到端验收状态(3 家 ✅/4 家 ⚠️)本轮不动(C8 缓)——README 验收矩阵原样。
- 既有 npm test 9 段全部保持绿——bump-version `--check`、结构断言、安装器夹具等一段不少。
- `.agents/skills/` 平铺布局与 30 个自研技能的日常开发方式零改动——junction 开发流(项目内开发、link 到 user skill)是用户点名要保的。
- Matt 28 个移植技能目录内容零改动——生成器只按位置识别分类,不碰内容。
- 中文语言、`.mjs` 零依赖约定、不引入 CI(C4)、不引入 LICENSE(C7)。
- `.agents/evals/` 工作区 gitignore 状态不变;evals 产物文件(trigger/output/benchmark/history)继续留在各技能目录。

## 配置差异

| 字段 | 现在 | 改后 | 迁移 |
| --- | --- | --- | --- |
| package.json `scripts.test` | 9 段链 | 10 段链(尾加 build-release --check) | 纯新增段,无破坏 |
| package.json `scripts` | 无 evals | 增 `evals` 命令 | 新增行 |
| 安装器 CLI 参数 | 无 | `--only` / `--skills` 可选 | 无参数行为不变,旧用法原样可用 |
| SKILL.md frontmatter | name+description | 晋级技能多 `category`(可选) | 既有技能不写,零影响 |
| 顶层 README 索引段 | 手写 | 生成器维护(带生成标记注释) | 首次由生成器重写该段 |
