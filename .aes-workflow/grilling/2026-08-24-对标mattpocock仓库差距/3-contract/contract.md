# Goal Contract: 建立生成式发布树让自研技能可按标准自助出库,并交付对标 mattpocock/skills 的差距报告

- Status: Ready
- Target: G:\GIT\AI_WorkFlow\parking-agents(仓库根)
- Updated: 2026-08-24

## 原始请求

> 我现在 作为skill 开发与发布 原始仓库。相对于 G:\GIT\AI_WorkFlow_ref\mattpocock-skills 这种标准 github 高星仓库 还有哪些差距?

> 你可以仔细看一下 MAT 那个仓库,它是怎么平衡开发过程跟发布流程的。我为了在开发方便,把技能都放在项目 skill,然后最后 link 到这个 user skill。这样的流程,我觉得是比较顺的。但是这个仓库再重新复制到 skills 目录,就感觉会比较怪,我也比较纠结。有没有比较平衡的,既能保持开发的高效性,又能保持发布侧稳定性的方案?

> 如果是发布的话,我期望是像 Matt 那个仓库一样能够分类,但现在没办法分类。所以我那个开发项目里面全都是平铺的。但其实我期望在发布过程当中,可以像 Matt 一样分类。分类好之后,在安装的时候也可以按照大类去安装的。因为我这个开发仓库里面内容非常多,应该是可以按分组去安装的。https://github.com/affaan-m/ECC 这个仓库的做法能给你一些什么灵感吗?

> 你先指定 matt 那套,其他的我后续补。你只要把指定方法给我补充好。这样确保我能按照标准执行。

## 目标

开发侧平铺与 junction 开发流保持不动的前提下,自研技能通过「写 category → 评测达标 → 生成」的标准流程进入分类发布树并可按大类选装,同时把对标 mattpocock/skills 的差距结论落盘成报告。

## Why

- 现状:发布侧 skills/ 28 个技能全部是上游移植,开发侧 30 个自研技能零出库,README 自称「超集」与零交集实测矛盾;移植流程无脚本无文档;无 CHANGELOG/tag;evals 有产物无统一入口。
- 上游参照(234,670 stars):单树+桶生命周期+登记式晋级,从不复制;开发期 link(与本仓 junction 流同构)。
- 做到之后:发布形态分类完整且永远与真源一致(--check 防漂移);用户可按写好的标准自助晋级;仓库有版本锚点;评测有统一验法。

## 范围

做:
- `scripts/build-release.mjs`(名可调):读分类真源生成/刷新 `skills/<分类>/<技能>/` 副本+桶 README+顶层 README 索引段;`--check` 模式进 npm test。
- 分类真源:自研技能 SKILL.md frontmatter 可选 `category:` 字段;Matt 28 个按既有桶位置识别,内容零改动。
- junction 安装器加 `--only <分类>` / `--skills <名单>` 可选参数。
- `npm run evals` 统一入口(含 `--list` 零成本模式),不进 npm test。
- README 定位段重写、AGENTS.md 移植流程句改生成式、CONTEXT.md 与 docs/adr/ 一致性修复。
- CHANGELOG.md 起步 + git tag `v0.2.0`。
- 晋级标准操作文档(五步+门槛,位置建议 docs/agents/)。
- 差距报告落盘 `docs/research/对标mattpocock仓库差距-2026-08-24.md`(内容要求见 D-01)。

不做:
- marketplace/npx 分发、英文化、文档站、社区文件(自用定位)。
- CI/CD、LICENSE 文件、安装验收补齐(4 家 ⚠️ 维持)。
- 上游移植 28 技能内容改动、技能内容质量评审、单树重构、package-lock。

## 强约束

- junction 安装器**无参数**行为逐字节不变:全量安装、两侧按名扁平合并、重名开发侧赢。
- 既有 npm test 9 段全部保持通过;bump-version `--check` 照旧;新段只增不删。
- `.agents/skills/` 平铺布局与 30 个自研技能的日常开发方式零改动。
- Matt 28 个技能目录内容零改动(生成器只按位置读分类,不写)。
- 生成器是发布树自研副本的唯一写入者;手改生成物必须被 `--check` 判红。
- 中文;`.mjs` 零依赖;不新增 npm 依赖;评测入口不得在 npm test 之内调用真实模型。
- 晋级门槛尺子=该技能 `run-tests` 退出码(五件套齐+最新一轮绿),不另设仓级数字门槛。
- 确认版对照物(2-prototype/behavior.md、example-run.md、diagram.html)不可修改,执行 Agent 改产品不改对照物。
- 自研晋级技能与 skills/ 既有技能重名时生成器拒绝(不依赖 junction 静默合并兜底)。

## 自主边界

不用问,直接定:
- 脚本与文件命名(build-release/evals 入口/标准文档路径)、错误信息措辞、夹具目录形态。
- 索引段的生成标记注释格式、桶 README 排版。
- 断言风格沿用 tests/ 既有写法;新测试文件放 tests/。
- category 字段的可选值集合命名(对齐既有桶名)。

必须停下来问:
- 动 junction 合并语义或安装器默认行为。
- 加 npm 依赖、删改既有测试段、动 9 份 harness manifest 契约。
- 翻转 .agents/skills 与 skills/ 的目录结构。
- 把真实模型评测挂进 npm test 或任何自动门。

## 读什么

- `../2-prototype/behavior.md`(变化行 11 条+边界值 4 条+不变清单,验收例子的源)
- `../2-prototype/example-run.md`(五个场景的期望输出样子)
- `../2-prototype/diagram.html`(架构改后态:生成器/发布树/合并语义两条命门边)

## 要落盘的东西

- D-01: `docs/research/对标mattpocock仓库差距-2026-08-24.md`:差距报告,必含以下内容——
  - 基准与口径:上游 mattpocock/skills(HEAD 5b15a47,2026-08-21;234,670 stars/20,009 forks 快照)与本仓对比;已锁口径(自用为主/启动出库/两轴分层)。
  - 六维差距 14 条:G1 安装命令无真源机制(P2 暂缓)/ G2 登记无不变式(P0 并入 README+生成器)/ G3 自研零出库(P0)/ G4 无 CI(P1,本轮不闭合)/ G5 无 CHANGELOG/tag(P1)/ G6 无 package-lock(P2)/ G8 无对外文档站(不适用,自用)/ G9 README 定位矛盾(P0)/ G10 CONTEXT 与 adr 脱节(P2)/ G11 中文(不适用)/ G12 evals 未闭环(P1)/ G13 安装验收 3/9(P2,本轮不闭合)/ G14 无 LICENSE(P2,本轮不补)。
  - 领先项 4 条:npm test 9 段/manifest 版本锁步校验/evals 产物体系/issue triage 治理(对标非单向)。
  - 首批出库候选表(评测五件套齐全度:psc 5/5、karpathy 5/5、wiw 5/5 带两悬案、shopping/steelman/log-error 4/5、analyze 2/5)。
  - 决定表(C1 生成式发布树方案 D 机制四件套、C2/C3/C5/C6 做、C4/C7/C8 不做)与未闭合差距章节(G1/G4/G13/G14)。

## 验收条件

- AC-001: 生成器全行为正确:带 `category` 的自研技能经 `node scripts/build-release.mjs` 进入 `skills/<分类>/<技能>/` 并登记桶 README 与顶层索引,`--check` 段挂进 npm test 链;边界全部正确——无 category→no-op 不建空桶、非法 category→非零退出点名技能、与 skills/ 既有重名→拒绝生成、缺 SKILL.md 或 frontmatter 不可解析→跳过并警告不炸整轮;无 category 技能与 Matt 28 目录零改动;npm test 链含 build-release 段(段缺失即未完成)。
  - Verify: [A] `bash -c 'grep -q build-release package.json && npm test'` → exit 0
- AC-002: 安装器 `--only <分类>`/`--skills <名单>` 选装生效;**无参数调用与改造前行为逐字节一致**;参数处理代码进安装器(缺参数支持即未完成)。
  - Verify: [A] `bash -c 'grep -q -- "--only" scripts/install-skills.mjs && npm test'` → exit 0
- AC-003: `npm run evals` 统一入口存在:零成本 `--list` 逐技能列出评测产物齐全度且不调模型;真跑输出汇总表;不进 npm test。
  - Verify: [C] 先跑 `npm run evals --list` → exit 0 且含产物齐全度列;再真跑一轮 `npm run evals`,汇总表逐技能行与该技能 run-tests 手跑结果一致(真模型耗 key,由用户执行)
- AC-004: 文档与现实一致:README 定位段不再含「超集」失实表述并按「自用开发+生成式发布」改写,索引段带生成标记;AGENTS.md「移植流程」句改为生成式流程;CONTEXT.md 声称与 docs/adr/ 实存一致。
  - Verify: [D] README.md/AGENTS.md/CONTEXT.md 三处断言清单逐项核对
- AC-005: CHANGELOG.md 存在且首条记录本次改造;git tag `v0.2.0` 存在。
  - Verify: [A] `bash -c 'git rev-parse --verify v0.2.0 && test -s CHANGELOG.md'` → exit 0
- AC-006: 晋级标准操作文档存在,五步齐全(写 category→run-tests 绿→跑生成器→索引自动登记→重装/干跑验证),门槛写明「五件套齐+最新一轮 run-tests 绿」。
  - Verify: [D] 标准文档内容检查(五步标题+门槛句)
- AC-007: 差距报告落盘,内容覆盖 D-01 清单(基准口径/六维 14 条/领先项/候选表/决定表/未闭合章节)。
  - Verify: [D] 报告章节清单逐项核对

## 挡着的事

- None.

## 残留风险

- 首批无真实自研晋级样本,生成路径靠测试夹具验证 — 错了会怎样:用户首次真实晋级时可能撞上夹具未覆盖的形态(如技能含 scripts/ 子目录时的复制策略)。
- README 定位段与报告措辞的语气合意度靠人眼 — 错了会怎样:[D] 只核对关键词与章节,措辞不合意要再改一轮。
- 4 家 harness 安装验收(⚠️)本轮不补 — 错了会怎样:那些路径上安装坏了不会被发现(用户裁定缓)。

## 访谈记录

### 第 1 轮(1-interview,需求)

| 问题 | 候选(带当时给的百分比) | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| 交付物:看清还是消灭差距 | A 只要报告 35% / B 报告+立项改造 50% / C 全面对标改造 15% | B | B |
| 仓库走向 | A 公开但自用为主 45% / B 本仓直接对外 25% / C 拆独立发布仓 30% | A | A |
| 自研要不要出库 | A 维持现状 40% / B 启动自研出库 45% / C 单树重构 15% | B | B |
| 差距评估优先轴 | A 工程基建轴 35% / B 发布消费轴 15% / C 两轴分层全列 50% | C | C |

| 定了什么 | 档 | 为什么这么定 | 用户 |
| --- | --- | --- | --- |
| 报告落盘 docs/research/;六维框架;基准双证据 | 默认 | 目录约定/覆盖差分全集/可复核 | 未反对 |
| 报告只评工程形态不评内容质量 | 默认 | 内容单评超范围 | 未反对 |
| LICENSE 条件未触发(自用定位)降级为报告条目 | 确认 | 无实害;补即授权难逆 | 第 2 轮终裁「不补」 |

### 第 2 轮(2-prototype,对照物与改造圈选)

| 问题 | 候选(带当时给的百分比) | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| C1 出库机制 | D 生成式发布树 60% / D- 只分组安装 15% / A 登记式 15% / 其他 10%(探索链:原案复制式被质疑「怪」→A/B/C 三案→合成 D) | D | **D**(翻了原案,overturned) |
| 首批晋级名单 | psc+karpathy 35% / +wiw 15% / 只 psc 10% / Matt 集+自助标准文档 40% | psc+karpathy | **Matt 集+标准文档**(翻了推荐,overturned;用户原话「把指定方法补充好」) |
| C4 CI | dev+main 55% / 只 main 20% / 不要 25% | dev+main | **不要**(翻了推荐,overturned;追问澄清云端机制后仍拒绝) |

| 定了什么 | 档 | 为什么这么定 | 用户 |
| --- | --- | --- | --- |
| C2 README 修 / C3 CHANGELOG+tag / C5 evals 独立命令 / C6 一致性修 / C8 缓 / C7 LICENSE 不补 | 确认 | 各带一句代价 | 全按推荐 |
| 提问方式:文字圈选清单看不懂,改为 AskUserQuestion 逐条(优劣势/推荐/角度) | 过程反馈 | 用户点名 | 已照办,后续轮次沿用 |
| AGENTS.md 移植流程句随 D 方案更新 | 默认 | 旧表述因 D 过时 | 未反对 |

### 第 3 轮(3-contract,验收)

| 问题 | 候选(带当时给的百分比) | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| 契约拆合 | 合一份 65% / 拆两份 35% | 合 | 合 |
| evals 验收深度 | 只验结构 --list 60% / 加一轮真跑 40% | 只验结构 | **加一轮真跑**(翻了推荐,overturned) |
| 晋级门槛尺子 | run-tests 绿 45% / trigger 1.00 35% / ≥0.90 20% | run-tests 绿 | run-tests 绿 |

| 定了什么 | 档 | 为什么这么定 | 用户 |
| --- | --- | --- | --- |
| AC 验证途径:[A] 三条挂 npm test/安装器/tag,耦合 grep 条件保证实现前为红;[C] 一条真跑;[D] 三条文档检查 | 默认 | 途径=仓库现成基建;每条附「错了会怎样」后果句 | 未反对 |
| 生成器 happy 路径与边界行为合并为一条 AC(同规则侧面,同一 npm test 判) | 默认 | finalize 七条上限;两簇同源 | 未反对 |

## 设计取舍

### D-1 出库机制(核心取舍)

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 登记式晋级 | 只登记 README/manifest,不生成不分类 | 最轻;但「像 Matt 一样分类」落空 | 用户要分类发布形态 |
| B 复制式出库(原案) | 手工/半自动复制进 skills/ 桶 | 同一技能两份要同步;junction 重名合并静默掩盖漂移 | 用户直言「怪」;漂移风险是硬伤 |
| C 并树迁移 | 自研搬进 skills/ 单树,全盘 Matt 化 | 迁移面大:安装器/测试/开发心智全翻转 | 破坏现有开发流,投入产出差 |
| D 生成式发布树(选定) | frontmatter category 真源+生成器+--check 防漂移+选装 | 生成器一次投入;发布树存生成副本(纯文本,体积小) | 无 |
| 什么都不做 | 维持零交集 | 定位名不副实 | 用户已裁要出库 |

选定 D。理由:开发高效性(junction 流零改动)与发布稳定性(--check 结构上杜绝漂移)不再互斥;分类信息写在技能本地(frontmatter),新技能建目录时顺手一行;ECC 的 manifest 选装与 Matt 的桶生命周期在同一个 category 字段上统一。
落进契约的形态:`强约束` 写「生成器是发布树自研副本的唯一写入者」「晋级门槛=run-tests 绿」;不引入复制式同步器与并树迁移。

### D-2 配套项

| 决策 | 选定 | 为什么没选别的 |
| --- | --- | --- |
| CI | 不要 | 用户拒绝云端复检;--check 留在本地 npm test 兜底 |
| 首批范围 | Matt 28 纳入分类体系+自助标准文档,自研 0 个首批 | 用户要的是「能按标准执行」的方法,不是替他挑技能;真实晋级路径用夹具验证 |
| evals 挂载 | 独立命令不进 npm test | 真模型耗 key,挂进测试链每跑必花钱 |
| 契约拆合 | 7 条合一份 | 改造项互相咬合,拆开多两轮流程无独立收益 |
