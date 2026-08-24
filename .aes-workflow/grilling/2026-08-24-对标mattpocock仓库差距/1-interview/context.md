# Context Snapshot: 2026-08-24-对标mattpocock仓库差距

- 创建:2026-08-24T18:26:57+08:00
- 分片来源:facts/parking-agents-现状.md、facts/mattpocock-skills-基准.md(另含宿主亲核 3 项:本仓可见性/上游 stars/双树交集)

## 任务陈述
「我现在 作为skill 开发与发布 原始仓库。相对于 G:\GIT\AI_WorkFlow_ref\mattpocock-skills 这种标准 github 高星仓库 还有哪些差距?」

## 用户提出的方案
未提出(以问句形式提出差距分析诉求,并通过 workflow-interview 流程发起)

## 意图假设
任务陈述问的是「差距有哪些」,但用户选择了带契约与验收的 workflow-interview 流程发起,暗示不满足于一次性聊天回答——大概率想要一份可指导后续行动的差距结论,且可能把补差距直接立为改造任务。差距按哪条轴评(自用工程规范 vs 对外发布消费)会完全改变清单内容,属用户决定。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| 本仓 PUBLIC、4 stars、无 LICENSE 文件(package.json 声明 MIT)、无 CHANGELOG、无 git tag、无 .github/ 目录(无 CI) | 宿主 `gh repo view` + 分片 facts/parking-agents-现状.md | Fact |
| 上游 mattpocock/skills:234,670 stars / 20,009 forks,本地 clone = origin/main(HEAD 5b15a47,2026-08-21) | 宿主 `gh repo view` + facts/mattpocock-skills-基准.md | Fact |
| 上游消费模式:官方 marketplace `claude plugins install` 与 `npx skills@latest add` 双路线,安装命令真源 `.agents/install-block.md` | facts/mattpocock-skills-基准.md | Fact |
| 上游版本机制:changesets + CHANGELOG(270 行、颗粒度到单 PR)+ `claude plugin validate --strict` 质量闸门 + release.yml CI(push main 自动开 Version PR),v1.2.3(2026-08-06) | facts/mattpocock-skills-基准.md | Fact |
| 上游技能组织:36 技能五桶制,双层 README 索引,25 技能 promoted 不变式(README+plugin.json 双登记),每技能 agents/openai.yaml | facts/mattpocock-skills-基准.md | Fact |
| 上游文档:docs/ 镜像 promoted 桶、每页四节固定结构、发布到 aihero.dev | facts/mattpocock-skills-基准.md | Fact |
| 本仓双树:发布侧 skills/ 28 技能(全部上游移植,engineering18/productivity7/pub3),开发侧 .agents/skills/ 30 技能(全部自研),名字交集 0 | 宿主 comm 复核 + facts/parking-agents-现状.md | Fact |
| README 自称开发侧是发布侧「超集」,与零交集实测矛盾;移植流程无脚本无文档,AGENTS.md 仅一句约定 | facts/parking-agents-现状.md(README.md:146 与实测矛盾) | Fact |
| 本仓安装:双击 cmd → junction 安装器按名扁平合并开发侧+发布侧,重名开发侧赢;9 harness manifest,端到端验收仅 3 家 | facts/parking-agents-现状.md | Fact |
| 本仓测试:npm test 9 段链,只测基础设施(安装器/结构断言/lint/hook/manifest 契约),不测技能内容,无 CI 承接 | facts/parking-agents-现状.md | Fact |
| 本仓 evals:多技能带 trigger/output evals json 与 parking-skill-creator 工具链,但无统一入口、npm test 不跑、开发侧 .agents/evals/ 被 gitignore | facts/parking-agents-现状.md | Fact |
| 本仓版本:单版本 0.1.0 七 manifest 锁步(bump-version.mjs 带 --check 进 npm test),技能无各自版本 | facts/parking-agents-现状.md | Fact |
| 本仓文档:docs/agents 三份约定、research 9 篇;CONTEXT.md 是 aes-qa 测试域术语表;声称决策记录在 docs/adr/ 但该目录不存在 | facts/parking-agents-现状.md | Fact |
| 上游也无:CONTRIBUTING、issue/PR 模板、测试(不跑任何测试)——这些不是差距项 | facts/mattpocock-skills-基准.md | Fact |

## 验证基建候选池

| 途径 | 代价 |
| --- | --- |
| npm test 9 段链(结构断言/manifest 契约/lint) | 已存在;报告类交付可复用其结构断言模式;改造类交付可直接挂新段 |
| per-skill evals(parking-skill-creator run-tests.mjs / aggregate-trigger.mjs) | 已存在但无统一入口;若纳入验收需先建统一入口或逐技能手跑 |
| gh CLI(远端状态/issue) | 已有双账号坑(记忆:写操作 404 需先 gh auth switch);只读安全 |
| CI(现无) | 若纳入验收,代价含先建 .github/workflows 且 push 后才可验 |
| git tag/release(现无) | 若纳入验收,代价含先定版本策略 |

## 术语冲突
- 「发布」:①junction 安装到自家机器 vs ②对外分发。**第 1 轮已定:按①自用消费口径**(Q2=A+Q3=B),对外分发类条目在报告中标注「不适用(自用定位)」降级列出。
- 「原始仓库」:用户词,仓内无对应词;README 自称「个人跨平台 skill 库」。定位措辞按「自用开发+出库到发布侧供自家消费」回写。
- 「标准 github 高星仓库」:已证实上游 234,670 stars,该前提成立,非冲突。

## 四分类
- **Fact**:上表全部(两仓工程形态、零交集、无 CI/LICENSE/CHANGELOG/tag、上游 changesets+marketplace 机制)
- **User decision**:Q1 交付物形态(报告/报告+改造/全面改造);Q2 仓库走向(自用公开/对外库/拆发布仓)——跨仓库边界;Q3 自研技能是否出库发布——跨仓库边界;Q4 差距评估优先轴;确认项:走对外方向时是否补 LICENSE(难逆)
- **Agent-owned**:报告结构组织、差距条目措辞、事实复核方式、文档落盘格式
- **Blocked**:无

## 决定边界未知项
(第 1 轮全部裁决,详见 rounds.jsonl)
- Q1=B:交付物 = 两轴分层差距报告 + 用户圈定的高优差距立项改造。
- Q2=A:仓库走向 = 公开但自用为主;对外分发不构成差距;LICENSE 条件未触发,降级为报告条目。
- Q3=B:启动自研出库,评测达标者经移植流程进 skills/ 发布侧;双树结构保留。
- Q4=C:报告两轴分层全列,改造优先级由报告结论带出,用户在质疑环节圈定。

## 未知项
- 上游 2026-08-21 之后是否又有新提交(未 fetch,报告以快照日标注即可,不阻塞)
- 本仓 README「超集」表述是有意还是过时(仓内证据无法判定,按矛盾事实写入报告;若涉改造需用户定改法)
