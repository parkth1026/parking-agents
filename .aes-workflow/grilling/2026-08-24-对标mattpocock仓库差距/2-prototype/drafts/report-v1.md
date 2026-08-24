<!-- draft v1 | published 2026-08-24T18:34:43+08:00
     用户意见:文字圈选格式看不懂,要求逐条优劣势+推荐+角度用提问工具重问;C1 复制式出库被质疑「怪」,追问 Matt 的开发/发布平衡机制与 ECC 灵感;点名要「指定方法」标准文档
     状态:superseded by v2 -->

# parking-agents 对标 mattpocock/skills 差距分析(草案 v1)

## 0. 基准与口径

| 项 | 值 | 出处 |
| --- | --- | --- |
| 基准仓 | mattpocock/skills,本地 HEAD `5b15a47`(2026-08-21)= origin/main,非 fork | `git remote -v`;facts/mattpocock-skills-基准.md |
| 远端快照 | 234,670 stars / 20,009 forks / PUBLIC(2026-08-24 gh 查) | 宿主 `gh repo view` |
| 本仓快照 | PUBLIC,4 stars;dev 分支;零依赖 `.mjs` 约定 | 宿主 `gh repo view`;AGENTS.md |
| 已锁口径 | Q1=B 报告+立项改造;Q2=A 公开但**自用为主**(对外分发类差距标「不适用」降级);Q3=B 启动自研出库;Q4=C 两轴分层 | rounds.jsonl round 1 |
| 两轴定义 | **工程基建轴**=自用受益(版本/CI/测试/工具链);**自用消费轴**=junction·9-harness·跨机同步的发布形态 | Q2/Q4 派生 |

共同没有(两边都缺,不构成差距):CONTRIBUTING、issue/PR 模板。上游也没有任何测试。

## 1. 差距总览(六维 × 两轴)

| # | 差距一句话 | 维度 | 轴 | 上游做法 | 本仓现状 | 自用口径 | 建议优先级 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G1 | 安装命令无「真源+verbatim 复制」机制 | 消费与安装 | 自用消费 | install-block.md 真源,各处逐字复制(facts:基准#9) | README/cmd/安装器三处各自表述 | 部分适用(真源思想可借,marketplace 不适用) | P2(暂缓) |
| G2 | 技能登记无双登记不变式,README 索引与实测矛盾 | 消费与安装 | 自用消费 | promoted 不变式:README+plugin.json 双登记+脚本锁(CLAUDE.md:9) | 「超集」自称 vs 零交集实测(README.md:146);仅 bump-version 锁 manifest 版本 | 适用 | **P0**(并入 C2) |
| G3 | 自研 30 技能零出库,移植流程无脚本无文档 | 消费与安装 | 自用消费 | (上游无此问题,单树) | 零交集 28 vs 30 实测;AGENTS.md 仅一句约定 | 适用(Q3=B 已裁) | **P0**(→C1) |
| G4 | 无 CI | 工程基建 | 工程基建 | release.yml:push main 自动 changesets(facts:基准#12) | `.github/` 不存在 | 适用 | P1(→C4) |
| G5 | 无 CHANGELOG、无 git tag、无 release | 版本发布 | 工程基建 | changesets,270 行颗粒度到单 PR,v1.0.0→v1.2.3 | 全无;仅七 manifest 版本锁步 0.1.0 | 适用 | P1(→C3) |
| G6 | 无 package-lock.json | 工程基建 | 工程基建 | package-lock lockfileVersion 3 | 无(零依赖仓,影响小) | 弱适用 | P2 |
| G8 | 无每技能对外文档/文档站 | 文档 | 自用消费 | docs/ 镜像 promoted 桶,四节固定,发布 aihero.dev | 无对应物(开发侧有 references/) | **不适用**(Q2=A 自用) | —(降级列出) |
| G9 | README 定位含糊且与实测矛盾 | 文档 | 自用消费 | 双层 README 索引,User/Model-invoked 分组 | 249 行,定位段含糊,「超集」失实 | 适用 | **P0·小**(→C2) |
| G10 | CONTEXT.md 声称的 docs/adr/ 不存在 | 治理 | 工程基建 | .agents/ 内 ADR×2+invocation.md+writing-docs.md | 声称有但目录从未创建(CONTEXT.md:3 vs 实测) | 适用 | P2·小(→C6) |
| G11 | 中文 README/文档 | 文档 | — | 英文 | 全中文 | **不适用**(Q2=A) | —(降级列出) |
| G12 | evals 体系存在但未闭环:无统一入口、npm test 不跑、工作区 gitignore | 测试与评测 | 工程基建 | 上游**完全没有** evals | 7 技能有产物,无入口命令,`.agents/evals/` 被忽略(.gitignore:13-14) | 适用(此维是自身闭环差距,非落后) | P1(→C5) |
| G13 | 安装端到端验收 3/9 harness,4 家 ⚠️ 未验证 | 消费与安装 | 自用消费 | (上游只保证自家 marketplace 一条路) | README.md:58-130 验收矩阵 | 适用 | P2(→C8) |
| G14 | PUBLIC 仓无 LICENSE 文件 | 治理 | — | MIT LICENSE 文件 | 仅 package.json 声明 MIT | Q2=A 已降级:不改造,报告条目 | —(C7 不推荐圈) |

## 2. 本仓领先项(对标非单向)

| # | 领先项 | 上游 | 本仓 |
| --- | --- | --- | --- |
| L1 | 测试基建:9 段 npm test 链(结构断言/安装器夹具/lint/hook/manifest 契约) | 零测试 | package.json:13 |
| L2 | 版本一致性:七 manifest 锁步 + `bump-version --check` 进 npm test | 手动 sync-plugin-version.mjs(不进任何门禁) | .version-bump.json |
| L3 | 技能评测体系:trigger/output evals + benchmark + history 五件产物形态 | 完全没有 | 7 技能在盘(见 §3) |
| L4 | 治理:GitHub Issues + triage 五标签 + 单一上下文 | 无 issue 治理痕迹 | docs/agents/ 三约定 |

结论:差距集中在**发布形态与版本发布纪律**,不在测试与评测(那恰是本仓独有资产,缺的只是闭环)。

## 3. 首批自研出库候选(评测产物齐全度,盘上证据 2026-08-24)

五件套 = trigger-evals.json / output-evals.json / run-tests.mjs / trigger-benchmark.json / history.json(形态基准:workflow-interview-web)。

| 技能 | 五件齐度 | 缺什么 | 备注 | 首批建议 |
| --- | --- | --- | --- | --- |
| parking-skill-creator | 5/5(+live-trigger+aggregate 工具) | — | 技能工厂,自举评测已过 | ✅ 入批 |
| karpathy-llm-wiki | 5/5 | — | | ✅ 入批 |
| workflow-interview-web | 5/5 | — | 有开口裁定未闭(timing 全 null、transport 拆分待裁),属已知工作项 | ⚠️ 待开口闭合后入批 |
| shopping-deep-research | 4/5 | run-tests(已豁免裁定) | 触发评测 100% vs 83% | 次批 |
| steelman-analysis | 4/5 | trigger-benchmark | | 次批 |
| log-error-summary | 4/5 | trigger-benchmark | | 次批 |
| analyze | 2/5 | output-evals/run-tests/history | | 缓 |
| workflow-interview | 另类形态 | — | evals/evals.json(上游风格),非五件套形态 | 形态归一后再议 |

门槛提议(写入 C1 验收):五件齐 + 最新一轮 run-tests 绿 + 无未闭合开口裁定。「最新跑绿」须执行时实跑核验,产物在盘 ≠ 结果达标。

## 4. 差距明细(证据与借鉴做法)

### G3 自研零出库(最实质差距)
- 事实:发布侧 28 技能全部上游移植(engineering18/productivity7/pub3),开发侧 30 全部自研,交集 0(宿主 comm 复核)。AGENTS.md:7 约定「经移植流程同步」但 `scripts/` 无对应脚本,仓内无流程文档。
- 后果:「开发与发布原始仓库」定位名不副实;junction 安装虽已把自研技能装进本机,但跨机同步靠 git 而非发布形态,9-harness manifest 登记的只有发布侧。
- 借鉴:上游 promoted 不变式(登记一致性靠脚本不靠自觉)移植过来即「出库不变式」:技能进发布侧 ⇔ README 索引+桶 README+结构测试同增。

### G5 版本发布纪律
- 上游:changesets 全自动(Version PR→tag→CHANGELOG 颗粒度单 PR 带 commit 链接);本仓:bump-version.mjs 只锁 manifest 数字,无 CHANGELOG 无 tag,回滚无锚点。
- 自用口径取舍:changesets 工具链(2 devDeps+lock)与零依赖约定冲突,建议轻量替代:手工 CHANGELOG.md(Keep a Changelog 风格)+ 首个 git tag v0.2.0(出库即是 minor)。

### G12 evals 未闭环
- 产物七技能在盘,但:无 `npm run evals` 类入口;npm test 不含任何 evals;`.agents/evals/` 工作区 gitignore(facts:现状#14)。
- 关键取舍:trigger evals 走 headless zcode 真模型(记忆:psc 探针机制),**不能挂进 npm test**(慢+耗 key);闭环形态=独立入口命令+CI 分层(可选 nightly/手动)。
- 此维上游为零,本仓补的是自身闭环,不是追赶。

### 其余各条(G1/G2/G4/G6/G8/G9/G10/G11/G13/G14)
证据与出处见 §1 表;G1 暂缓理由:单人仓三处复制失真的实际成本低于维护真源机制;G8/G11 不适用理由:Q2=A 自用定位;G14 降级理由:不追求外部用户时「默认全权保留」无实害,转对外时再补(难逆性已知:补即授权不可撤)。

## 5. 改造候选清单(请圈选,可一次回复如「圈 C1 C2 C3,其余不圈」)

| # | 改造项 | 对应差距 | 改动面 | 验收途径 | 风险 | 建议 |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | 出库流程脚本化+首批出库:新增移植脚本(`.mjs`,开发侧→发布侧,含桶归类+README 行生成+结构测试登记),首批按 §3 建议 2 技能 | G3/G2 | scripts/ 新脚本;skills/ 新目录×2;桶 README;tests/skill-discovery | npm test 全绿+新技能在 skills/ 结构断言通过+junction 安装干跑不变 | 移植脚本边界(哪些文件过门:SKILL.md/references/scripts/evals 产物是否随行)执行时定 | **P0** |
| C2 | README 修正:定位段按 Q2/Q3 回写(删「超集」失实表述),技能索引对齐实测 | G9/G2 | README.md | 索引与 `ls` 实测一致(可断言) | 无 | **P0·小** |
| C3 | CHANGELOG.md 起步 + 首个 tag v0.2.0 | G5 | 新文件 CHANGELOG.md;git tag | 文件在盘含首条;tag 可 `git tag -l` 验 | tag 命名/起点执行时按 semver 常规 | P1 |
| C4 | CI workflow:push dev/main 跑 npm test | G4 | .github/workflows 新文件 | push 后 Actions 出现绿运行 | 红叉打扰(见确认①) | P1 |
| C5 | evals 统一入口:仓级 `npm run evals`(逐技能聚合入口,复用 psc 工具链),**不进 npm test** | G12 | package.json scripts;scripts/ 新聚合脚本(或复用) | 命令可跑并输出逐技能汇总 | 真模型跑=耗时耗 key,频度自觉(见确认②) | P1 |
| C6 | CONTEXT.md/docs 一致性修复:adr 声称与现实对齐(补目录或改表述) | G10 | CONTEXT.md 或 docs/adr/ | 文件表述与目录实存一致 | 无 | P2·小 |
| C8 | 安装验收补齐:⚠️ 4 家 harness 至少再验 1 家,更新 README 矩阵 | G13 | README 验收矩阵 | 矩阵状态变化 | 依赖对应环境在手 | P2 |
| C7 | LICENSE 文件(MIT) | G14 | 新文件 | 文件在盘 | Q2=A 已降级,不推荐圈 | — |

不做的(边界,已锁):marketplace/npx 分发、英文化、文档站、社区文件、上游移植 28 技能内容改动、单树重构、技能内容质量评审。

## 6. 两条确认(请各回一个字)

1. **C4 若圈**:CI 在 push dev+main 都跑(单人仓无 PR 流)——代价:npm test 红时远端红叉。回「跑」或「只 main」。
2. **C5 形态**:evals 独立命令 `npm run evals`,不挂进 npm test——代价:门禁变弱,跑不跑靠自觉。回「同意」或「要挂」。

## 7. 圈选后走向

圈定项进入确认版对照物(behavior.md 变化行/不变清单、example-run.md、diagram.html 出库架构图),再进 3-contract 锁验收。报告本体(§0–§4)在质疑修正后随执行落盘 `docs/research/对标mattpocock仓库差距-2026-08-24.md`。
