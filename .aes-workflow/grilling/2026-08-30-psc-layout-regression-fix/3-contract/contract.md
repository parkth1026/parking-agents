# Goal Contract: creator 工具链在分类布局与 link 挂载下恢复产物落点与影子判据两条不变量

- Status: Ready
- Target: `skills/workflow/parking-skill-creator/`（scripts/snapshot-skill.mjs、scripts/check-shadow-skills.mjs、run-tests.mjs）+ 仓库 `.gitignore` + 两处文档措辞
- Updated: 2026-08-30

## 原始请求

> 上面问题 解决方案 讨论一下（指 parking-skill-creator 严格测试发现的 2 个大搬移布局回归：snapshot-skill.mjs 缺省 workspace 落进扫描根内、check-shadow-skills.mjs 对分类布局全判影子）

用户补充：技能用 link 方式实现、放在自己的目录、多层嵌套（实测：`~/.agents/skills/` 一级扁平，仓库技能为 SYMLINK 直指仓库 2~3 层真实位置，另有自建真目录技能）。

## 目标

仓库分类布局（`skills/<分类>/<技能名>/`，任意嵌套深度）与用户级 link 挂载两种形态下，评测产物缺省落点回到扫描根之外、影子检测按产物来源真实区分真技能与冒充产物，且安装版扁平布局既有行为零变化。

## Why

- 7677680 大搬移改了目录树，两个脚本的布局假设没跟着改：snapshot 缺省落 `skills/evals/`（扫描根内、gitignore 未覆盖），3 层嵌套技能落得更深；check-shadow 对分类仓库根报 63 影子 exit 1（狼来了），无参数派生根又假阴性（报「✓ 无影子」但扫不到风险区）。
- 做到之后：仓库内开发评测不再污染源码树；影子复查在分类仓库恢复判罚能力；下次布局再变，夹具会拦住而不是静默翻车。

## 范围

做什么：
- `snapshot-skill.mjs`：缺省 workspace 解析改为「向上找名为 `skills` 的祖先、取其父」，找不到时回退现行「上两级」公式并 stdout 提示一行。
- `check-shadow-skills.mjs`：影子判据从「位置（非一级目录）」改为「产物特征」（产物目录名单内的活 SKILL.md）；无参数派生根与 snapshot 统一为 skills 祖先语义（含回退与提示）。
- `run-tests.mjs`：新增分类布局夹具组（2 层/3 层缺省落点、回退、分类根影子判据、产物冒充、无参派生）；改写因输出语义变化而失准的影子文案断言。
- `.gitignore` 增补 `/evals/`；SKILL.md 与 `references/repo-conventions.md` 中「上两级/与 skills 平行」的过时断言改为与实现一致的措辞。

不做什么：
- 其余脚本零改动（aggregate-benchmark/aggregate-trigger/eval-evidence/quality-plan/pilot-replay/generate-review/init-skill 均显式传参，无缺省推导，已调查确认）。
- 不改显式传参行为、不加/删 CLI 旗标、不改退出码语义、不 follow 符号链接、不改安装器。
- 不动 #160 的 WIP 内容；执行前提：按用户裁定先把 #160 现有 WIP 提交，再落本修复，两个 commit 分层。

## 强约束

- 显式传参行为逐字节不变（snapshot 的 workspace 参数、check-shadow 的根参数）。
- 安装版扁平布局行为零变化：`~/.agents/skills/<技能>` 下缺省落 `~/.agents/evals`；无参数派生 `~/.agents/skills`；自建真目录技能同。
- 退出码契约不变：snapshot 0 成功/1 拒绝/2 用法错；check-shadow 0 干净/1 影子/2 用法错。
- stdout `SNAPSHOT <路径>` 行格式不变（回退场景只追加提示行）；影子报告「点名+理由+汇总」结构不变。
- 快照 `SKILL.md → SKILL.md.bak` 改名双保险保留；扫描不跟进符号链接保留。
- 既有 215 项测试除影子输出文案断言外，断言与期望不得改动。
- 确认版对照物（`../2-prototype/behavior.md`、`../2-prototype/example-run.md`）不可修改：执行 Agent 改的是产品，不是对照物。

## 自主边界

不用问，直接定：
- 回退提示行的具体文案（AC-002/AC-004 各一行，说清回退了即可）。
- 分类夹具的构造方式、断言命名风格（前缀 `快照缺省:` `快照回退:` `影子判据:` `影子派生:` 是 Verify 依赖的契约，其后的措辞自定）。
- 产物目录名单的代码组织（常量内聚在 check-shadow 脚本内即可，不新建模块）。
- `.gitignore` 行的精确写法（须匹配 `^/evals/?$` 语义）。
- 文档措辞的具体表述（须含「skills 祖先」语义并清除旧公式断言）。

必须停下来问：
- 改公共 CLI 契约（加/删旗标、改退出码、改输出行格式）。
- 扩充产物目录名单到新形态（如需为未来产物类型加名单项）。
- 发现 #160 WIP 无法提交（阻塞执行前提）。
- 触及范围外文件或需改动其余脚本。

## 读什么

- `../2-prototype/behavior.md` — 确认版行为对照表（变化行 B1~B12 + 不变清单）
- `../2-prototype/example-run.md` — 确认版终端场景（改后样子 + 必须不变的场景 3）
- `skills/workflow/parking-skill-creator/scripts/snapshot-skill.mjs`（缺省解析在 :38 附近）
- `skills/workflow/parking-skill-creator/scripts/check-shadow-skills.mjs`（判据与 `DEFAULT_SCAN_ROOT` 在 :17、:65 附近）
- `skills/workflow/parking-skill-creator/run-tests.mjs`（夹具根形态在 :276、:304-308 附近）

## 验收条件

Verify 命令均在仓库根执行；AC-001~004 的断言名前缀（`快照缺省:`/`快照回退:`/`影子判据:`/`影子派生:`）是契约的一部分，读作「run-tests 输出中存在名为该前缀的 `ok` 断言」。

- AC-001: snapshot 缺省 workspace 在分类布局 2 层（`skills/workflow/<名>`）与 3 层（`skills/matt-skills/engineering/<名>`）技能上均落 `<skills 祖先的父>/evals/<名>-workspace/`（扫描根外，与嵌套深度无关）
  - Verify: [A] `node skills/workflow/parking-skill-creator/run-tests.mjs | grep -c "ok  快照缺省: 分类"` → ≥2
- AC-002: 技能目录向上无名为 `skills` 的祖先时，snapshot 回退「上两级」公式，stdout 多一行回退提示，退出码与 `SNAPSHOT` 行格式不变
  - Verify: [A] `node skills/workflow/parking-skill-creator/run-tests.mjs | grep -c "ok  快照回退"` → ≥1
- AC-003: check-shadow 对分类仓库根不再误报（真技能不限层级全合法、exit 0）；产物目录名单（`evals/`、`eval-fixtures/`、`*-workspace/`、`skill-snapshot*`）内的活 SKILL.md 被点名判影子、exit 1
  - Verify: [A] `node skills/workflow/parking-skill-creator/run-tests.mjs | grep -c "ok  影子判据"` → ≥2
- AC-004: check-shadow 无参数派生根与 snapshot 同一语义（skills 祖先；分类布局下从任一分类技能跑覆盖全仓技能根；找不到时回退父目录并提示）
  - Verify: [A] `node skills/workflow/parking-skill-creator/run-tests.mjs | grep -c "ok  影子派生"` → ≥1
- AC-005: 回归门全绿——含新增分类夹具组的全量 run-tests 通过，且既有断言（除影子文案改写外）原样保持
  - Verify: [A] `node skills/workflow/parking-skill-creator/run-tests.mjs` → 退出码 0
- AC-006: 配套同步落盘——`.gitignore` 含 `/evals/`；SKILL.md 与 repo-conventions.md 的缺省 workspace 断言与 skills 祖先语义一致、旧「上两级/与 skills 平行」公式断言清除
  - Verify: [A] `grep -qE "^/evals/?$" .gitignore && grep -q "skills 祖先" skills/workflow/parking-skill-creator/SKILL.md && grep -q "skills 祖先" skills/workflow/parking-skill-creator/references/repo-conventions.md` → 退出码 0

## 挡着的事

- None.

## 残留风险

- 回退提示行文案与断言后缀措辞未逐字过用户目 — 错了会怎样：措辞不合口味，字级返工，无实质风险。
- 产物目录名单是硬编码约定（evals/eval-fixtures/*-workspace/skill-snapshot*），未来新产物形态若忘了登记会漏检 — 错了会怎样：该形态的冒充产物检不出，需回来扩名单。
- 已分发的 `.skill` 包内置旧版脚本，不随本修复自动升级 — 错了会怎样：包消费者沿用旧布局假设，属既有版本自然延续，不在本契约范围。

## 访谈记录

### 第 1 轮

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| Q1 snapshot 缺省语义锚点 | A 找 skills 祖先取父 62% / B 废除缺省必显式传 24% / C 代码不动只改文档 14% | A | 未定——用户透出 link+多层嵌套关键事实，前提失效，转第 2 轮 |
| Q2 影子定义 | A 产物特征判据 58% / B 同名遮蔽 27% / C 限定安装根 15% | A | A |
| Q3 与 #160 WIP 分层 | A 先提交 #160 再修 48% / B hunk 拆分 22% / C 只修无冲突文件 30% | A | A |

### 第 2 轮

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| Q1 重问（link/嵌套三场景验证后） | A 定：找 skills 祖先取父 85% / B 翻：废除缺省 10% / C 翻：改其他 5% | A | A |

### 第 3 轮（2-prototype 对照物确认）

| 问题 | 候选 | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| 行为表 B1~B12 + 六场景确认 | A 确认含 B9 / B 确认但 B9 不改 / C 改了再确认 | A | A。B9（check-shadow 无参派生统一 skills 祖先语义）由对照物撞出，访谈未预设 |

### 默认区与确认区（未花提问的决定）

| 定了什么 | 档 | 为什么这么定 | 用户 |
| --- | --- | --- | --- |
| 修复落仓库源，完成后经安装器同步用户级 | 默认 | skills/ 是唯一安装源，用户级同名副本遮蔽 | 未反对 |
| 安装版扁平布局行为零变化 | 默认 | 现有正确场景不得被修坏 | 未反对 |
| workspace 解析不 follow 符号链接 | 默认 | Node 现状语义，产物落调用侧 | 未反对 |
| `.gitignore` 增补 `/evals/` | 默认 | 新缺省落点为 scratch | 未反对 |
| 文档断言随方案同步修正 | 默认 | 断言与实现一致 | 未反对 |
| 其余脚本不动 | 默认 | 全扫描确认无缺省推导 | 未反对 |
| 验收主途径 run-tests 扩夹具 | 默认 | 本仓库验证基建即技能自带 run-tests | 未反对 |

## 设计取舍

### D-1 snapshot 缺省 workspace 解析

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 找 skills 祖先取父（选定） | 从技能目录逐级向上找名为 `skills` 的祖先，取其父作 workspace 根；找不到回退上两级+提示 | 「skills」目录名成硬约定；解析多约 10 行+测试 | 无 |
| B 废除缺省必显式传 | 不传 workspace 退出 2 | 改 CLI 公共契约（难逆）；文档/旧习惯全改 | 消灭隐式落点却把成本转嫁每次调用，且难逆 |
| C 代码不动只改文档 | 文档声明分类布局必须显式传 | 不变量靠人记（本次翻车根因）；断言继续为假 | 零代码风险但问题原样在 |
| 什么都不做 | 保持现状 | 产物写进源码树、3 层嵌套落更深 | 即本次发现的回归本体 |

选定 A。理由：四类真实场景（link 路径/仓库 2 层/仓库 3 层/自建真目录）逐一验证全落扫描根外，安装版行为零变化；用户在 link+多层嵌套的实际结构下确认。
落进契约的形态：`范围` 写「缺省解析改为 skills 祖先语义」；`强约束` 写「显式传参行为不变」。

### D-2 影子判据

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 产物特征判据（选定） | 递归收集活 SKILL.md，位于产物目录名单内的判影子；真技能不限层级合法 | 名单成硬编码约定；输出语义变化老测试要改 | 无 |
| B 同名遮蔽判据 | 深层 SKILL.md 仅与一级技能同名才判影子 | 需先定义「一级」；分类布局未来同名真技能误报 | 语义改动最小但把正确东西当误报源 |
| C 限定只对安装根跑 | 不改代码，复查指令改为对 `~/.agents/skills` 跑 | repo 源树零保护；复查指令对本仓继续失效 | 零代码风险但工具在本仓废功 |

选定 A。理由：工具的本意是防「评测产物冒充真技能」，来源判据让判罚依据变准；link 技能本就不被递归跟进，天然兼容。
落进契约的形态：`范围` 写「影子判据改产物特征」；`强约束` 写「退出码与报告结构不变」。
