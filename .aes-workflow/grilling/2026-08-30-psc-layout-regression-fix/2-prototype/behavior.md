# 行为对照表: 2026-08-30-psc-layout-regression-fix

<!-- 确认版·锁定 | 用户确认 2026-08-30（选项 A：确认含 B9）
     执行 Agent 改的是产品，不是这份对照物 -->

## 变化行

### snapshot-skill.mjs：缺省 workspace 解析

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| B1 | 仓库 2 层技能 `skills/workflow/psc`，不传 workspace | 落 `skills/evals/psc-workspace/`（扫描根内，gitignore 未覆盖） | 落 `<repo>/evals/psc-workspace/`（与 skills 根平行） |
| B2 | 仓库 3 层技能 `skills/matt-skills/engineering/ask-matt`，不传 workspace | 落 `skills/matt-skills/evals/ask-matt-workspace/`（扫描根内且更深） | 落 `<repo>/evals/ask-matt-workspace/` |
| B3 | 边界：技能目录向上无名为 `skills` 的祖先（如 `D:\mytools\foo-skill`） | 落 `D:\evals\foo-skill-workspace/`（上两级公式） | 回退同一公式落 `D:\evals\foo-skill-workspace/`，stdout 多一行回退提示，退出码不变 |
| B4 | 边界：显式传 workspace 参数 | 用显式值 | 逐字节不变（本行就是不变） |

### check-shadow-skills.mjs：影子判据（产物特征）

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| B5 | 分类仓库根 `skills/`（63 个真技能分布在 2~3 层） | 一级技能 0 个、影子 63 个、exit 1 | 技能 63 个（递归）、✓ 无影子、exit 0 |
| B6 | 扫描根内产物冒充：`evals/foo-workspace/skill-snapshot/SKILL.md`（徒手复制留活文件） | 判影子（因非一级，碰巧命中） | 判影子（按产物目录特征命中，输出点名 `evals/...` 路径） |
| B7 | 边界：真目录技能内部产物 `skills/life/shopping-deep-research/eval-fixtures/` 下若出现活 SKILL.md | 判影子（非一级） | 判影子（`eval-fixtures` 在产物名单内）——判罚不变、依据变准 |
| B8 | 边界：快照合规产物 `skill-snapshot/SKILL.md.bak` | 不匹配 SKILL.md，不判 | 不变（.bak 双保险保留） |
| B9 | 无参数派生（从技能目录跑） | 派生=技能父目录；分类布局派生 `skills/workflow`（漏扫其他分类）；用户级派生 `~/.agents/skills` ✓ | 派生=向上找 skills 祖先（与 snapshot 同一语义）：仓库技能→`<repo>/skills`（覆盖全部分类），用户级→`~/.agents/skills` 不变；找不到时回退父目录并提示 |

### run-tests.mjs / .gitignore / 文档

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| B10 | run-tests 全量 | 215 项过；无分类布局夹具 | 新增分类夹具组（B1/B2/B5/B6/B9 各至少一断言）；原「干净根报告一级技能 1 个」等影子文案断言随新输出语义改写；总数约 +10 项 |
| B11 | `.gitignore` | 只忽略 `/.agents/evals/` | 增补 `/evals/`（B1/B2 新落点为 scratch 不入库） |
| B12 | SKILL.md / repo-conventions.md 断言 | 「与 skills 平行」在分类布局下为假 | 措辞改为「与 skills 根平行（向上找 skills 祖先，任意嵌套深度）」；影子复查节同步产物特征语义 |

## 不变清单

- **显式传参行为**：snapshot/check-shadow 的全部显式参数用法逐字节不变（B4）。
- **安装版扁平布局**：`~/.agents/skills/<技能>` 下缺省落 `~/.agents/evals`、无参数派生 `~/.agents/skills`——现有正确行为零变化。
- **快照双保险**：`SKILL.md → SKILL.md.bak` 改名保留（B8）；不跟进符号链接保留（link 技能内部不被递归）。
- **退出码契约**：snapshot 0/1/2、check-shadow 0 干净/1 影子/2 用法错、不存在的根 2——全不变。
- **stdout `SNAPSHOT <路径>` 行格式**：前缀与路径形态不变（B3 只追加提示行）。
- **影子报告格式**：点名路径 + 标注位置 + 汇总行的结构不变，只改判定依据与「一级技能 N 个」→「技能 N 个（递归）」这一行文案。
- **其余脚本零改动**：aggregate/trigger/review/evidence/quality/pilot/init 均不动（访谈默认区第 5 条）。
- **215 项既有测试语义**：除影子输出文案断言外全部保持原断言原期望。

## 配置差异

无（无配置文件、无环境变量、无新 CLI 选项）。
