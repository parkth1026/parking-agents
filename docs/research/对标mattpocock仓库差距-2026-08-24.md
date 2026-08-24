# parking-agents 对标 mattpocock/skills 差距报告

## 1. 基准与口径

本报告锁定的上游基准是 `mattpocock/skills`：本地 `HEAD 5b15a47`，日期 2026-08-21，与当时 `origin/main` 一致；远端规模采用 2026-08-24 快照 **234,670 stars / 20,009 forks**。这些数字是本次决策快照，不表示阅读本报告时的实时数据。

本仓口径已经锁定为：

- 以个人自用为主，不把英文化、公共文档站、marketplace/npx 和社区运营当成本轮目标；
- 从“自研零出库”转为启动自研出库，但保持 `.agents/skills/` 平铺开发与 junction 即时生效；
- 用两条轴评估六个维度：工程基建轴与自用消费轴；六维是消费与安装、工程基建、版本发布、文档、测试与评测、治理与社区；
- 只比较仓库工程与发布形态，不评价 28 个上游移植技能或自研技能正文的内容质量。

上游采用单树和分类桶管理技能，开发期同样可以 link；晋级靠登记与发布纪律，不靠复制两份后人工同步。本仓因此没有照搬单树，而是采用“开发真源 + 生成式分类发布树”，把高效开发和稳定发布分开承担。

## 2. 六维差距清单（14 项）

下表沿用确认稿编号。锁定稿的核心差距编号跳过 G7；为保持“14 项”口径，本表把双方共同缺少、因而不构成相对差距的社区文件列为 G7，并明确不改造。

| # | 维度 | 差距结论 | 本轮处理 | 优先级 |
| --- | --- | --- | --- | --- |
| G1 | 消费与安装 | 安装命令分散在 README/cmd/脚本，无类似上游 install-block 真源与逐字复制机制 | 暂缓；本轮只加分类/名单选装 | P2，未闭合 |
| G2 | 消费与安装 | 发布技能登记没有自动不变式，README 索引可与磁盘漂移 | 并入 README 生成段、桶索引和 `build-release --check` | P0，已闭合 |
| G3 | 消费与安装 | 开发侧自研技能原先零出库，且“移植流程”无脚本无文档 | 建立 `category` → 评测达标 → 生成的标准流程 | P0，已闭合 |
| G4 | 工程基建 | 本仓无 CI；上游用 release workflow 与 changesets | 用户明确不要 CI | P1，未闭合 |
| G5 | 版本发布 | 原先无 CHANGELOG、无 git tag、无 release 锚点 | 新建 CHANGELOG，并以 `v0.2.0` 建立首个 tag | P1，已闭合到本轮约定 |
| G6 | 工程基建 | 本仓无 `package-lock.json`，上游有 lockfileVersion 3 | 零 npm 依赖，保持不补 | P2，保留 |
| G7 | 治理与社区 | 双方都没有 CONTRIBUTING 与 issue/PR 模板，不构成相对差距 | 自用定位下不做社区文件 | 不适用 |
| G8 | 文档 | 本仓无上游那类每技能对外文档镜像与文档站 | 自用定位下不做 | 不适用 |
| G9 | 文档 | README 原先把开发侧称为发布侧“超集”，与零交集实测冲突 | 改写为“自用开发 + 生成式发布”，生成器维护自研索引 | P0，已闭合 |
| G10 | 治理与社区 | CONTEXT.md 声称决策在 `docs/adr/`，目录原先不存在 | 增加目录说明页并校准懒创建表述 | P2，已闭合 |
| G11 | 文档 | 本仓以中文为主，上游以英文为主 | 自用定位下中文不是缺陷 | 不适用 |
| G12 | 测试与评测 | 本仓已有 evals 产物体系，但原先没有统一入口，未形成可重复运行的仓级闭环 | 新增独立 `npm run evals` 与零成本 `--list`；不进 `npm test` | P1，已闭合入口 |
| G13 | 消费与安装 | 9 个 harness 中只有 3 个有真实端到端验收，4 个仍为 ⚠️ 契约覆盖 | 本轮维持现状 | P2，未闭合 |
| G14 | 治理与社区 | PUBLIC 仓只有 package 元数据声明 MIT，没有 LICENSE 文件 | 用户明确不补 | P2，未闭合 |

结论：最关键差距不在测试数量，而在自研技能无法稳定进入发布形态。生成式发布树闭合了 G2/G3/G9，并把 G12 从“有资产无入口”推进到可统一执行；CI、完整 harness 验收、授权文件和安装命令单一真源仍被有意保留。

## 3. 本仓领先项（对标不是单向追赶）

| # | 领先项 | 上游快照 | parking-agents |
| --- | --- | --- | --- |
| L1 | 自动测试 | 没有等价的仓级技能测试链 | `npm test` 原有 9 段，覆盖结构、安装器、工具名 lint、hook、Pi、manifest、版本与跨平台结构；本轮只新增发布树校验段 |
| L2 | manifest 版本一致性 | `sync-plugin-version.mjs` 配合发布流程 | 七份 manifest 锁步，`bump-version --check` 与 `--audit` 已在本地门禁中 |
| L3 | evals 产物体系 | 上游没有等价 trigger/output benchmark 与 history 体系 | 多个自研技能携带题库、成绩与历史，本轮补统一入口 |
| L4 | issue triage 治理 | 没有本仓同形态的 issue 状态约定 | GitHub Issues、五个 triage 标签和单一上下文约定已经落盘 |

## 4. 首批自研出库候选（2026-08-24 锁定快照）

五件套口径是 `trigger-evals.json`、`output-evals.json`、`run-tests.mjs`、`trigger-benchmark.json`、`history.json`。下表记录做决策时的快照，不等同于当前运行结果；真正晋级仍必须现场跑最新一轮 `run-tests.mjs`。

| 技能 | 五件套齐全度 | 已知情况 | 当时建议 |
| --- | --- | --- | --- |
| parking-skill-creator | 5/5 | 技能工厂，自举评测已过 | 可入批 |
| karpathy-llm-wiki | 5/5 | 五件套齐 | 可入批 |
| workflow-interview-web | 5/5 | 带两项悬案：timing 全 null、transport 拆分待裁 | 悬案闭合后再入批 |
| shopping-deep-research | 4/5 | 缺 run-tests（当时有豁免裁定） | 次批 |
| steelman-analysis | 4/5 | 缺 trigger-benchmark | 次批 |
| log-error-summary | 4/5 | 缺 trigger-benchmark | 次批 |
| analyze | 2/5 | 缺 output-evals、run-tests、history | 暂缓 |

用户最终没有授权任何自研技能作为首批样本，而是选择“Matt 28 个保持现状 + 把自助标准方法补齐”。因此本轮自研晋级数为 0，真实生成路径由离线夹具覆盖，候选表不构成自动晋级授权。

## 5. 决定表

| 决定 | 结果 | 机制或边界 |
| --- | --- | --- |
| C1 | 做：方案 D 生成式发布树 | 四件套是 `category` 分类真源、生成器与 `--check`、`--only/--skills` 选装、五步晋级标准；开发平铺与 junction 合并语义不动 |
| C2 | 做：README 修正 | 删除“超集”失实定位，改为自用开发 + 生成式发布；生成器维护自研索引段 |
| C3 | 做：CHANGELOG + tag | 轻量版本锚点，不引入 changesets 或 npm 依赖 |
| C4 | 不做：CI | 用户拒绝云端复检，本地 `npm test` 兜底 |
| C5 | 做：evals 独立命令 | `npm run evals --list` 零成本盘点；真跑不挂自动门 |
| C6 | 做：CONTEXT/ADR 一致性 | 创建 `docs/adr/README.md` 并写清按需创建 |
| C7 | 不做：LICENSE | 自用定位下保持现状 |
| C8 | 不做：补齐 harness 验收 | 3 家 ✅ / 4 家 ⚠️ 状态保持，不把契约测试冒充端到端证据 |

### C1 机制四件套

1. `.agents/skills/<技能>/SKILL.md` 的可选 `category` 是自研分类真源，允许 `engineering`、`productivity`、`pub`。
2. `scripts/build-release.mjs` 是自研发布副本的唯一写入者；它检查五件套并真跑 `run-tests.mjs`，生成完整目录、维护索引，`--check` 捕获手改或过期副本。
3. junction 安装器接受 `--only <分类>` 与 `--skills <名单>`；无参数仍全量、扁平合并、重名开发侧赢。
4. `docs/agents/skill-release.md` 固化五步：写 category → run-tests 绿 → 跑生成器 → 索引自动登记 → 重装/干跑验证。

## 6. 已知未闭合差距

### G1：安装命令单一真源

README、cmd 与 Node 入口仍分别承载说明，没有引入上游 install-block 式生成机制。本轮参数能力已经统一，但文案的逐字同步仍靠维护者。

### G4：CI

没有 `.github/workflows` 自动复检。所有发布树、manifest 和结构门禁只在本地 `npm test` 触发；这是用户明确接受的取舍，不应在交付时伪称闭合。

### G13：9-harness 真实验收

本轮没有增加任何 harness 的真实运行证据，README 中 3 家 ✅ / 4 家 ⚠️ 的边界保持。doc-contract 通过只能证明声明与文件一致，不能升级为端到端通过。

### G14：LICENSE

仓库仍没有 LICENSE 文件，只有 package 元数据中的 MIT 声明。若未来由“自用为主”转为正式对外分发，需要重新做授权决定。

## 7. 证据来源

- 上游本地快照：`G:\GIT\AI_WorkFlow_ref\mattpocock-skills`，commit `5b15a47`；
- 本次需求与裁决：`.aes-workflow/grilling/2026-08-24-对标mattpocock仓库差距/` 下的 interview、prototype 与 Goal Contract；
- 本仓实现证据：`package.json`、`scripts/build-release.mjs`、`scripts/run-evals.mjs`、`scripts/install-skills.mjs`、`tests/skills/`、`docs/agents/skill-release.md`。
