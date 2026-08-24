# Goal Contract: 落地 aes-gate 门禁技能（检测+组装+活看板+单条沉淀主路径），供 aes-qa 开测前调用

- Status: Ready
- Target: parking-agents · `.agents/skills/aes-gate/`（SKILL.md+references+scripts+assets）及其在目标仓库内的运行产物
- Updated: 2026-08-25

## 原始请求

> 把 aes-gate skill 也纳入计划。aes-qa 会调用 aes-gate 去检测。
> 来 重新走 goal contract 流程
> aes-gate 会 平时 开发时候也会频繁把  自己碰到的问题 添加到 gate
> 好的 按照你的推荐 +继续
> 好的 确认
> 好的 请继续

## 目标

把「踩坑即记门、仓库门禁体检、按模式补门、活看板」做成一个 AES 技能：开发中被调用即可把问题固化为注册进 run.toml 的可执行门禁，显式体检给出六维评分与缺口清单，组装按模式库生成最小门禁并强制 CI 接线，全部事实投影到活看板。

## Why

- 现状：本仓验证基建仅本地 npm test 七连，无 CI/hooks/登记——纸面门禁（TOP-5 调研与四路验证报告实锤的最普遍失败模式；git 官方坐实本地钩子可被 `--no-verify` 绕过）。
- 做到之后：每次踩坑沉淀为可复用的确定性门禁且即时可见；aes-qa 开测前获得 gate 盘点+缺口清单，验收的最贵部分（LLM 真实测试）只用于门禁覆盖不到的地方。

## 范围

做：`.agents/skills/aes-gate/` 完整技能（中文，随 aes-* 惯例）；单条沉淀主路径（判例→固化→注册→刷新）；批量检测（run.toml 优先+补扫+逐门实跑红绿+六维评分+历史对比+缺口清单报告）；批量组装最小集四件（模式出处注释+selftest+确认门+CI 强制硬前提）；看板三件（collect.mjs→gate-registry.json→board.html 投影）；被 aes-qa 调用的精简回传路径。

不做：gate/v1 协议对齐或任何 runtime 实现（Q2=C）；twe-gate 引擎对接；通用 gate-builder（M3 复诊登记簿/M4 AI 档/M5）；CI 定时挂载与自动触发（显式/对话触发 only）；evals 与触发评测（归 #20）；修改任何既有技能与 run 标准 schema。

## 强约束

1. run.toml 是 gate 唯一注册真源：registry/看板/报告不复制命令定义，门 id 引用 run action id；需要扩展 run 标准时先提案，不私扩。
2. gate/v1 协议包（`G:\GIT\AI_WorkFlow\aes-gate`）零接触、零依赖。
3. 检测与单条沉淀之外不写目标仓任何文件；组装/沉淀写入仅限 `scripts/gate/`、`run.toml`、分诊选定的 CI/hooks 文件。
4. 组装产物永不在 aes-qa 调用路径内落地（Q4=A：检测归检测，补门另开显式会话）。
5. `npm test` 七连行为不变：新增物须通过 discovery/no-tool-names 等既有检查，而非改检查。
6. 退出码以显式读取为准（`echo $?`/终态 JSON），管道与后台包装不吃码；逐门有界超时，超时/不确定归红。
7. 确认门：任何生成物未经用户确认不落地；组装分诊（底座/阻断强度）用户不答时记 BLOCKED，不自动选。
8. G1 组装的完成判据=required checks + branch protection 接通（protection 升 `ci-protected`）；否则本轮结论「未完成（纸面）」，不降级为提示。
9. 六维权重与档位依据随技能落 `references/weights.md`；报告明示局限（低分≠有风险，防 Goodhart）；registry `history[]` 追加保留历次快照。
10. 确认版对照物不可修改：执行 Agent 改产品，不改 `2-prototype/` 下五件对照物。

## 自主边界

不用问，直接定：
- SKILL.md 章节划分与措辞、references 文件命名与拆分（weights.md/pattern-library.md 除外，这两个名字已定）。
- collect.mjs 内部实现（TOML 解析可参考 run 标准 vendor 思路，保持零依赖）。
- 看板视觉细节（mock 定结构与信息层级，不锁像素）。
- 缺口 id 分配、报告内部小节顺序、六维评分细则措辞。

必须停下来问：
- 需要改 run 标准 schema、保留字或退出码语义时。
- 组装底座/阻断强度分诊时（用户在场不答=BLOCKED，不代选）。
- 需要账号级操作（开 GitHub Actions、branch protection）时——步骤生成给用户执行。
- 任何写入将超出强约束第 3 条许可范围时。

## 读什么

- `../2-prototype/behavior.md` — 行为对照与不变清单（变化行即 AC 素材）
- `../2-prototype/api-mock.md` — gate-registry v1 schema、回传三结局、轻路径接口
- `../2-prototype/example-run.md` — 场景 A/B/C/D（AC 的操作蓝本）
- `../2-prototype/mock.html` — 看板结构与信息层级
- `../2-prototype/diagram.html` — 架构拓扑事实源（注册/引用/投影/零依赖四类边）
- `docs/research/gate-builder-skill-blueprint.md` — 模式库与工作流蓝本（仓库内）
- `docs/research/aes-gate-行业实践四路验证-2026-08-25.md` — 权重依据与五修订的证据锚点
- `.agents/skills/aes-standardize-repo/references/run-standard.md` — 注册目标标准
- `G:\GIT\AI_WorkFlow\aes-agents-v2\.agents\skills\aes-gate-autopilot\SKILL.md` 与 `aes-gate-goal-contract\SKILL.md` — 四机制范例（证据档位/verdict 纪律/固化优先/防滞留；跨仓路径，缺失时按四机制名吸收）

## 要落盘的东西

- D-01: `.agents/skills/aes-gate/SKILL.md` — 定位句（熟悉行业惯例的门禁建设者）+主路径（单条沉淀）+批量检测+组装（硬前提）+看板+四态出口；中文，百行级
- D-02: `.agents/skills/aes-gate/references/weights.md` — 六维权重 30/20/15/20/15/10 与三档阈值（硬门禁/部分/纸面）的依据，引四路验证报告
- D-03: `.agents/skills/aes-gate/references/pattern-library.md` — 最小集四模式页（聚合 check/结构守卫/棘轮/eval 接线：出处、适用条件、代价、反例）+两范例四机制引用
- D-04: `.agents/skills/aes-gate/scripts/collect.mjs` — 采集（读 run.toml+补扫+实跑红绿）→ 写 gate-registry.json（含 history 追加）→ schema 自校验；`--self-test` 正反样例
- D-05: `.agents/skills/aes-gate/assets/board.html` — 单文件零外链零 JS 投影模板（部署名 `board.html`，结构按 mock）

## 验收条件

- AC-001: 单条沉淀主路径可用：对话「把这个问题记成 gate」后，判例成立则产出固化脚本+run.toml 注册+registry 行+看板刷新；判例答不出只记约定级并明示
  - Verify: [C] 照 `../2-prototype/example-run.md` 场景 D 用 ps1-BOM 坑实操，检查三件产出；加 [A] `node scripts/gate/check-ps1-bom.mjs --self-test` → 退出码 0（正反样例均判对）
- AC-002: 批量检测可用：显式 `/aes-gate` 产出六节报告（盘点+实跑红绿+六维评分+历史对比+缺口清单），registry 同步刷新
  - Verify: [A] `node .agents/skills/aes-gate/scripts/collect.mjs` → 退出码 0 且 `gate-registry.json` 更新（`history` 新增一行）；加 [C] 报告节构对照 behavior.md 变化行 2
- AC-003: 组装与硬前提成立：对话组装 G1–G3 生成最小集四件（模式出处注释+selftest），确认门后写入+注册；G1 未接 required checks+branch protection 时结论为「未完成（纸面）」
  - Verify: [C] 照场景 B 实操：selftest 全绿（逐件退出码 0）、确认门前 `git status` 与生成前一致、G1 完成后 registry 中该门 `protection=ci-protected`
- AC-004: 看板三件成立：collect→registry→board 投影链路通，页面零 JS 外链断网可开，数据真源唯一
  - Verify: [A] `node .agents/skills/aes-gate/scripts/collect.mjs --self-test` → 退出码 0（schema 自校验）；加 [D] 断网双击打开 `board.html` 呈现 mock 所列六区块且无外链请求
- AC-005: aes-qa 精简调用路径成立：被调用时只执行检测并回传 markdown 盘点表+缺口清单，不落盘报告
  - Verify: [C] 模拟 aes-qa 调用一轮：回传结构与 `../2-prototype/api-mock.md` 结局 1 逐字段一致，且 `.aes-gate/` 下无新增 `report-*` 文件（真机联调归 #19 自举）

## 挡着的事

- None.

## 残留风险

- agent 自主维护闭环无行业先例（四路验证判「先行者地带」）— 错了会怎样：效果不及预期时回退人工维护门禁，已积累的判例/selftest 记录仍是资产。
- 六维权重为主观赋值（OpenSSF Scorecard 同款被批评点）— 错了会怎样：体检结论可能误导优先级；缓解=weights.md 依据+history 序列自对比，不把分数当 KPI。
- 单条沉淀的判例质量依赖当场对话 — 错了会怎样：弱判例产出弱门（假阴性）；缓解=判例答不出只记约定级，判例可后补升级。
- AC-005 以模拟调用验收，真机联调推迟到 #19 — 错了会怎样：接口两套口径的风险后移；#19 自举时以同一 api-mock 契约核对。

## 访谈记录

### 第 1 轮（1-interview，四裁定）

| 问题 | 候选（当时百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| 补建边界 | A 检测 only 45% / B 检测+组装 35% / C 处方 20% | A（蓝图 M1 先行） | **B**（翻案） |
| 协议对齐深度 | A 语义对齐轻量 65% / B 完整子集 10% / C 不对齐 25% | A | **C**（翻案） |
| 触发面 | A 双通道 70% / B 仅内部 15% / C 仅显式 15% | A | A |
| 组装触发时机（第 2 轮补问） | A 检测归检测 60% / B 调用时提案 30% / C 自动落地 10% | A | A |

用户中途追问「组装是什么概念」→ 以 ps1-BOM 式具体例重述后终裁；并要求先讲行业实践再裁——行业三派对照（传统 QA 交接/Quality Engineering/渗透报告）后维持 B。

### 原型阶段裁定

| 问题 | 候选 | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| gate 全景 HTML 展现 | A 静态快照 55% / B 活看板 30% / C 独立资产 15% | A | **B**（翻案） |
| 红绿怎么定（Q5） | A 跑门禁 55% / B 引用旧证据 30% / C 问用户 15% | A | A（本仓实测 npm test 全绿约 40s，筹码实证） |

### 钢人分析（两回合）

第一回合把「链路是需求驱动还是平台病」定为 crux，一问定夺：第一消费者是谁。用户答「平时开发会频繁把碰到的问题添加到 gate」→ crux 落需求驱动侧，主路径重排为**单条沉淀（高频）＞批量体检+组装（低频）**。

### 四路行业验证（用户发起）

pre-commit/cargo-make/Gradle Wrapper 三重同构（统一注册=实锤）；OpenSSF Scorecard/SonarQube/Allure/SARIF（体检+分离=实锤）；XP 1999+Google SWE Book+缺陷聚类实证（踩坑记门+棘轮=实锤的合理工具化）；agent 维护者=机制成熟/生成有实证（Meta 73%）/闭环空白（先行者）。五修订全部织入强约束与 AC。报告：`docs/research/aes-gate-行业实践四路验证-2026-08-25.md`。

### 默认区与确认区（未反对即定，节选）

| 定了什么 | 档 | 为什么 | 用户 |
| --- | --- | --- | --- |
| run.toml=唯一注册真源，registry 只存运行时事实 | 默认 | 用户构想①②+避免双真源 | 未反对 |
| 检测盘点优先读 run.toml；组装默认注册进 run.toml | 默认 | 衔接 aes-standardize-repo | 未反对 |
| 两范例 gate skill 四机制吸收，本体不搬 | 默认 | 产品绑定 aes-agents-v2 | 未反对 |
| 六维评分沿用蓝图权重+演进轻查 | 默认 | TOP-5 调研背书 | 未反对 |
| 无调查不生成；红门置顶；退出码显式读取 | 默认 | 蓝图反模板保险+用户 gate skill 纪律 | 未反对 |
| v1 不含 M3 复诊登记簿 | 默认 | 范围有界 | 未反对 |
| 组装入口=对话触发，无 --assemble 参数 | 默认 | 与轻路径一致 | 按推荐 |
| registry JSON 数据标准、回传 markdown | 默认 | Q6=B 推论 | 按推荐 |
| scripts/gate/ 命名维持 | 默认 | 示例既定 | 按推荐 |
| branch protection 残余提示→后升格硬前提 | 确认→修订① | git 官方坐实绕过 | 按推荐+四路验证 |

## 设计取舍

### D-1 补建边界

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 检测 only | 盘点+评分+缺口清单，补建移交 gate-builder/人 | 正循环只有反馈半边；无平台组接手=缺口堆报告 | 用户无专职平台组，移交≈搁置 |
| B 检测+组装（选定） | 显式会话按模式库生成最小门禁+selftest，确认后落地 | 落地工作量约翻倍，模式库要真建 | 无 |
| C 只开处方 | 缺口附「怎么建」建议书 | 处方无人执行=纸面 | 执行者终究是 agent，绕一圈 |

选定 B。理由：行业分派本质是「谁执行」——单人+agent 生态里 B 是唯一让正循环转起来的选项；护栏（Q4-A 确认门+selftest+出处注释+最小集）结构化缓解自产自销。落进契约形态：强约束 7/8 + AC-003。

### D-2 协议对齐

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 语义对齐轻量 | 三态标注+descriptor 词汇，不实现 lock/run/digest | 一致性靠约定，衔接期可能漂 | 用户要当下自由度，不为未来 runtime 预付 |
| B 完整协议子集 | .mjs 实现 gate.toml→lock→run→verify | 越权（协议包明言 runtime 另立）+重回重工程 | 同上，更重 |
| C 不对齐（选定） | 输出按需自由设计 | 未来接协议要重写输出层 | 无 |

选定 C。理由：Q2 终裁；跨仓直连非近期需求，run.toml 已提供注册标准。落进契约形态：强约束 2。

### D-3 看板形态

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 静态快照 | 体检顺产嵌死数据的 board.html | 数据不保鲜 | 用户要持续盯红绿，单条沉淀要即时可见 |
| B 活看板（选定） | collect.mjs+gate-registry.json+可刷新 board | 新增常驻基建；红绿依赖采集被执行 | 无 |
| C 独立资产 | gate-board 另行立项 | 体检报告与看板两套事实源易漂移 | 违背单一真源 |

选定 B。理由：与 aes-worktree-board 已验证模式同构；单条沉淀主路径（高频）使采集天然被频繁触发。落进契约形态：AC-004+强约束 9。
