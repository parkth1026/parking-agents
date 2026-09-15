# Goal Contract: aes-qa 三支柱落地——v4 receipt 等级收口 + 业务真实验收 reference + 截图伴随保留（含 qa-report.html），消费侧 GATE-qa 同步

- Status: Ready
- Target: `skills/workflow/aes-qa/`（主）、`skills/workflow/aes-worktree-board/scripts/merge-policy.mjs`（消费侧同步）
- Updated: 2026-09-12

## 原始请求

> 「按前面的顺序，我们开始走正式的 interview 流程，最后走到 goal contract。」（任务实体=GitHub issue #171「aes-qa: SQA 优化三支柱——AES-QG 标准化收口 + 业务真实验收档 + 最终截图留存」+ 会话内 steelman 裁决修正）

> 补充（2026-09-12，契约起草中）：「AES QA 的完整验收单要像 workflow interview 最后输出的那个 HTML 一样，能在 HTML 里看到所有测试结果以及对应的截图资源。而且这个 HTML 是直接用模板 copy 的，不会消耗 LLM，也会直接带上图片引用。」

## 目标

aes-qa 的验收结论收口到统一等级语言并具备可操作的业务真实验收与终态视觉证据保留：receipt 升 v4（等级栏引擎同源、未接入显式态）、business-acceptance reference 落地、终态截图与 qa-report.html 成为 tracker 无关的一等伴随产物，消费侧机械门同步执行。

## Why

- 现状三缺口（#171 实证）：普通轮 QA 结论无等级语言（等级只在 v3 opt-in 分支）；live 档仅一行定义，每仓手工摸索；截图终点绑死 GitLab，本地无正式保留。
- 现状漏洞：merge-policy 只认 `/v3` 尾缀，任何新版本会被误判 legacy 豁免——新语义若不同步消费侧等于声明了没人执行。
- 做到之后：一张 v4 验收单机械可读出门级（或显式未接入），agent 驱动验收有可复用操作配方且断言必带机械托底，终态视觉证据随验收单同生共死，双击 qa-report.html 即可人类可读消费全部结果与截图。

## 范围

做：
- `skills/workflow/aes-qa/`：v4 receipt schema 与生成/自校验；`references/business-acceptance.md` 新增；screenshot companion 冻结（伴随目录+manifest+secrets 扫描）；qa-report.html 渲染器；契约测试扩（新 case 与新契约）；SKILL.md 档位表与 v4 节更新。
- `skills/workflow/aes-worktree-board/scripts/merge-policy.mjs`：v4 判别分支（三态校验、gate-shortfall、companionShots 完整性、缺字段 fail closed），v1/v2/v3 豁免语义不变。

不做：
- aes-gate 判级引擎、AES-QG/1 标准、run.toml/gate-policy.toml 文法的任何改动（#171 非目标）
- 各消费仓自身的接入迁移（run.toml 注册、v4 产出切换——它们各自另行）
- 独立新 skill（能力只经 reference 指名组合既有能力技能；重开条件写进 reference）
- Markdown 渲染件（人类可读格式唯一=HTML；机器消费=qa-receipt.json）
- SQA 看板/可视化汇总产物
- 仓库级 CI

## 强约束

- v1/v2/v3 receipt 读法与 GATE-qa 豁免语义逐字节不变（历史语义永久冻结）；v3 的 `"none"`（tracker-only）语义在 v3 内冻结，v4 用 not-onboarded 表达。
- `NOT_RUN` 永不写成 `PASS`；`AWAITING_HUMAN` 永不因超时自动转 PASS，agent 不得代答人工验收。
- GitLab 截图发布链路（U upload + 1 note + strict readback 2U+2 + aggregate marker）零收窄；secrets 红线：截图进任何保留产物前必须机械扫描 token/凭据模式，BLOCKED 则 receipt FAIL、不入库。
- 等级值必须全称 `AES-QG-L<k>`（裸 `Lx` 拒收）；gate receipt 引用保持内容寻址 digest + 同 candidate 双绑定（不手抄）。
- 等级与发布资格正交语义保持：`AES-QG L5 PASS` ≠ release-qualified。
- 能力组合只经 reference 指名既有能力技能（browser-use / computer-use / playwright-cli），不内建浏览器驱动、不新造独立 skill。
- **backing 内容寻址（钢人回炉）**：进 receipt 的 agent-live 断言，`backing` 必含被指工件 digest（`sha256:<64hex>`）；无 digest 视同无托底，整条降档 humanChecklist；循环轮 finding 不要求（round 4 决策 4A）。
- **not-onboarded 防伪对账（钢人回炉）**：消费侧必须核对目标仓 `gate-policy.toml` 存在性——仓有 policy 而 receipt 声称 not-onboarded → fail closed 拒收。
- **not-onboarded 代价形态=计量+复盘，不设硬门（钢人回炉）**：2026-09-12 盘点实证全域仅 1/N 仓接入判级资格（唯一=AntAgent_v2-manager），硬门即变相强制接入、违背渐进双使命；治理=可单独统计+定期复盘；接入率显著变化后复议升级，重开条件写进 reference。
- **消费侧复算三义务（钢人回炉）**：无论 receipt 自称什么——①requiredLevel 声明即机械比较 achieved；②requiredLevel 与目标仓 gate-policy 声明目标级对账；③`outcome`/`repositoryGate.outcome`/`failureClass` 三裁决位一致性校验，矛盾拒收。
- **secretsScan 对象化（钢人回炉）**：`{result, scope:[filename,metadata,extractable-text], ocr:false}`；`CLEAR` 语义缩窄为「已声明 scope 内未检出」，像素内渲染内容为已声明盲区（零依赖约束下不做 OCR），盲区说明随 reference 落盘。
- qa-report.html：一等伴随产物、出票必产；模板复制渲染零 LLM；单文件、系统字体、零外链、断网双击可开；图片按 `shots/` 相对路径引用不内嵌；只落本地伴随目录不发布 GitLab；随 receipt 同批作废（STALE_EVIDENCE 同源）。
- `2-prototype/` 四份确认版对照物（behavior.md / api-mock.md / example-run.md / diagram.html）为不可修改的尺子——执行 Agent 改的是产品，不是对照物。

## 自主边界

不用问，直接定：
- 契约测试 case 拆分、命名与断言风格（沿用 repository-gate.contract.mjs 既有模式）
- reference 文本结构与篇幅；字段命名细节照 api-mock.md 锁定约定
- 伴随目录内部布局与容量上限/清理策略数值（写进 reference 约定）
- secrets 扫描的具体模式清单（token/凭据正则族）与漏检兜底说明
- qa-report.html 模板与渲染器实现（零依赖 mjs；形态锚=export-dossier 产物：单文件、系统字体、相对引用）
- 「未接入门禁」的 reason 文案模板

必须停下来问：
- 改 failureClass 既有三值（must-fix/retryable/environment）的语义
- 动 v1/v2/v3 判别或豁免逻辑的任何一行
- 新增外部依赖；删除既有能力；对 aes-gate 引擎/标准的任何改动
- qa-report.html 从「只落本地」变为发布到任何 tracker
- not-onboarded 治理从「计量+复盘」升级为任何形式的硬门（接入率变化触发的复议，须用户拍板）

## 读什么

- `../2-prototype/api-mock.md`（v4 报文结构与字段级锁定约定——schema 事实源）
- `../2-prototype/behavior.md`（10 条变化行+不变清单——行为事实源）
- `../2-prototype/example-run.md`（五个场景的终端形态）
- `../2-prototype/diagram.html`（改后态拓扑：digest 引用边、冻结副本边、capability 组合）
- `skills/workflow/aes-gate/references/aes-qg.md` §10（消费合同与既有语义）
- `skills/workflow/aes-worktree-board/scripts/merge-policy.mjs`（现状判别逻辑，改它前先读）
- 消费仓 aes-agent issue #153 F-1 的 `3-contract/verify.txt` 第四节（业务真实验收首个实例参照；AC-004 的人工复核对象）

## 验收条件

- AC-001: v4 等级栏三态成立——`repositoryGate.status` 闭集 `{referenced, not-onboarded}`：referenced 带 digest 原子引用+同 candidate 双绑定；not-onboarded 带非空 reason+trackerOnly 布尔，且消费侧对账目标仓 `gate-policy.toml` 存在性（有 policy 而自称未接入→fail closed 拒收）；缺 status/裸 `L3`/闭集外值一律 fail closed 拒收；v1/v2/v3 豁免逐字节等价现状。（错了会怎样：消费仓合并门对 v4 错误放行或拒收，等级收口失效）
  - Verify: [A] `node skills/workflow/aes-qa/run-tests.mjs --contract repository-gate-level --case v4-gate-three-states` → 退出码 0
- AC-002: 未达声明门级显式失败——requiredLevel 非空且 achieved 未达时，receipt outcome=FAIL + failureClass=gate-shortfall（新枚举，仅此场景），消费侧机械复算比较（不信任 receipt 自称）并拒合并；未声明 requiredLevel 时无此失败语义。（错了会怎样：门级不够与功能缺陷混类，打回路由错，消费仓白烧返工）
  - Verify: [A] `node skills/workflow/aes-qa/run-tests.mjs --contract repository-gate-level --case v4-gate-shortfall` → 退出码 0
- AC-003: agent-live evidence kind 成立——driver{model, capabilitySkill} 必填且仅 agent-live 允许；进 receipt 的断言 backing 必含 layer（四值闭集）+ pointer + **digest（被指工件内容寻址）**，无 digest 视同无托底降档 humanChecklist（AWAITING_HUMAN + demotedFrom/demotionReason），agent 不得代答；契约 case 抽样核验 digest 与被指文件实际内容一致；同 candidate 换驱动模型不作废 receipt 但 driver 变化在报文可见。（错了会怎样：agent 无托底断言进 receipt，验收可信度继承模型方差）
  - Verify: [A] `node skills/workflow/aes-qa/run-tests.mjs --contract aes-qa-v4-schema --case agent-live-backing` → 退出码 0
- AC-004: business-acceptance reference 落地——`skills/workflow/aes-qa/references/business-acceptance.md` 含六要素：证据分层四层闭集与降档规则、配额/凭据类 BLOCKED 口径、正反例模板（fail-closed 必验）、成本控制（最低成本足够模型、真实调用最小化）、tracker 无关手法配方（真实浏览器控制/WS 直连/CLI 配对，按能力指名组合既有技能）、独立 skill 重开条件。（错了会怎样：live 档仍无操作标准，每仓手工摸索）
  - Verify: [D] `skills/workflow/aes-qa/references/business-acceptance.md` 逐要素在文（文件内容检查）；[C] 用户对照 aes-agent #153 F-1 verify.txt 第四节复核配方可复述性（人工，交接后由用户执行）
- AC-005: 终态截图伴随保留——screenshotEvidence.required=true 的 v4 最终轮：VERIFIED 后冻结伴随目录（截图目录 + 伴随清单文件，命名以 api-mock.md 锁定为准），清单摘要与 secretsScan（对象化：result+scope+ocr:false，CLEAR=已声明 scope 内未检出）进 receipt；secretsScan.result=BLOCKED → receipt FAIL；candidate 变更后旧伴随目录随旧 receipt 同批作废，新 candidate 必须新 attempt 重跑。（错了会怎样：视觉证据随 tracker/清理消失，或带凭据截图入库）
  - Verify: [A] `node skills/workflow/aes-qa/run-tests.mjs --contract screenshot-evidence --case companion-shots-freeze` → 退出码 0
- AC-006: 消费侧 GATE-qa 显式认 v4——merge-policy 对 v4 走全套校验（三态、not-onboarded 与 gate-policy.toml 存在性对账、gate-shortfall 拒合并、消费侧复算三义务：requiredLevel 比较与 policy 对账、三裁决位一致性、companionShots 完整性、缺字段 fail closed）；版本判别反转为已知版本白名单、未知版本 fail closed 拒收（不再保留「非 v3 即 legacy」黑名单结构）；v1/v2/v3 豁免回归不变。（错了会怎样：新语义声明了没人执行，收口空转）
  - Verify: [A] `node skills/workflow/aes-qa/run-tests.mjs --contract repository-gate-level --case v4-consumer-gate-verdict` → 退出码 0
- AC-007: qa-report.html 一等伴随产物——v4 最终轮出票必产；模板复制渲染零 LLM；单文件零外链断网可开；包含等级栏三态、全部 checks（agent-live 断言与托底层）、humanChecklist/unexecuted、screenshotEvidence 状态与 `shots/` 相对路径图片引用、jobId/attemptId/candidateSha 元数据；随 receipt 同批作废。（错了会怎样：验收产物只有 JSON/终端形态，非工程角色无法直接消费）
  - Verify: [A] `node skills/workflow/aes-qa/run-tests.mjs --contract aes-qa-v4-schema --case qa-report-render` → 退出码 0；[C] 双击打开伴随目录 qa-report.html，抽查信息层级与图片可显示（人工抽查，交接后由用户执行）

## 挡着的事

（无）

## 残留风险

- 消费仓 v3 receipt 实发情况未盘点（跨仓边界，本仓读不出）— 错了会怎样：若存在未知的 v3 消费变体，AC-001 的豁免等价断言需补分支；豁免语义本身已由强约束锁死，风险限于断言覆盖面。
- qa-report.html 未出独立 mock（结构=api-mock.md 确认字段的确定性投影，视觉锚=export-dossier 形态，用户原话点名参照）— 错了会怎样：执行 Agent 的排版自由度产出可能不合预期，届时以 AC-007 的 [C] 抽查打回重渲染，成本低且可逆。
- 盘点快照时效：not-onboarded 治理形态（计量+复盘）基于 2026-09-12 接入率 1/N 的现状 — 错了会怎样：接入率显著上升后仍不设硬门，豁免将常态化；治理升级复议条件已写进契约自主边界与 reference 义务。
- 渲染失败恢复语义（渲染器故障时 receipt 状态/恢复路径）与「永久冻结缺退役机制」已明确拆后续票 — 错了会怎样：渲染故障期间合法证据暂不出票；四代并存维护面单调增长，到期无评估触发器。
- 版本白名单反转已并入本票 AC-006（超出决策 2 的四条清单，因属 AC-006 同一改动点的一行级收口且本票动机即此类缺陷；如不要可回退）— 错了会怎样：不并入则 v5 落地时 suffix 缺陷原样复发。

## 访谈记录

### 第 1 轮（1-interview，2026-09-12）

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| 交付边界含不含消费侧同步 | A 一票全含 60 / B 仅 aes-qa 25 / C 拆两票 15 | A | A |
| 等级栏来源与未接入表达 | A 引擎同源+显式未接入 45 / B 强制接入 25 / C QA 自算 30 | A | A（经重问：首版表述被判不可懂，换标准工程语言+每选项好处代价后按「建设问用户、执行自主」双使命框架确认） |
| 截图 tracker 无关保留位置 | A 伴随目录 45 / B artifact 包 30 / C 双写 25 | A | A（经重问，同上） |
| receipt 版本演进 | A v4 新档 50 / B v3 内演进 30 / C 旁挂 20 | A | A |

默认/确认区十项（摘要）：三支柱+steelman 修正同票；非目标四条照 issue；agent-live 词表隔离；AC-2 引用 #153 F-1 不新跑；验证走契约套件；secrets 扫描；skill 重开条件；不做看板；aes-gate 双使命边界保持（用户主动确认）；L0-L5 演进不在本票。全部未反对。

### 第 2 轮（2-prototype，2026-09-12）

| 问题 | 候选 | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| 未达声明门级的 failureClass | A 新枚举 gate-shortfall 70 / B 复用 must-fix 30 | A | A |
| tracker-only 在 v4 的表达 | A 归并 not-onboarded+布尔 65 / B 独立第三状态 35 | A | A |
| 四份对照物整体确认 | 确认 / 有修改 | 确认 | 确认（含默认定项：agent-live 命名、托底四值、伴随目录路径、换模型不作废） |

### 第 3 轮（回退补问 + 契约轮，2026-09-12）

| 问题 | 候选 | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| qa-report.html 定位（用户新增需求） | A 一等必产 55 / B 默认可跳 25 / C 手动子命令 20 | A | A |
| 人类可读格式 | A 仅 HTML 60 / B 双格式 30 / C 仅 Markdown 10 | A | A |
| AC-004 验证深度 | A [D]+[C] 55 / B 仅 [D] 25 / C [B] fixture 20 | A | A |
| 七条后果表述 | 都对 90 / 要改写 10 | 都对 | 都对 |

默认区两项：渲染器=零依赖 mjs 模板复制（家族三先例同款）；qa-report.html 只落本地不发布 GitLab。均未反对。

### 第 4 轮（钢人回炉，2026-09-12）

背景：三路 subagent 反思（正方钢人/反方钢人/行业基准联网比对）。反方查出 2 致命（托底不验真伪、not-onboarded 无对账无代价）+4 需修补；行业比对确认骨架对齐或领先、两处真偏离。用户「全案推荐」一次性拍板：

| 问题 | 候选 | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| 契约回炉吗 | A 回炉修完再开工 / B 原样开工 | A | A（全案推荐） |
| 修几条 | A 四条信任级+白名单并入 AC-006，渲染恢复/冻结退役拆后续 / B 六条全修 | A | A |
| 未接入仓代价形态 | A 先盘点再定 / B 硬门 / C 计量复盘 | A | A→盘点结果：接入率 1/N（唯一=AntAgent_v2-manager）→落 C 计量+复盘 |
| backing digest 范围 | A 仅进 receipt 的断言 / B 全部断言 | A | A |

api-mock.md / behavior.md 以「v2 修订节」承载 delta（v1 锁定快照保留），契约 AC-001/002/003/005/006 与强约束同步更新。

## 设计取舍

### D-1 等级结论来源

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 引擎同源+未接入显式态（选定） | 等级只出自引擎收据原子引用；无门仓记 not-onboarded+原因，单据有效 | none 白名单语义要扩，消费侧校验同步 | 无 |
| B 强制接入 | 无门仓先注册才能出票 | 接入墙：新仓上手成本前置 | 违背「建设问用户、执行自主」的双使命渐进性 |
| C QA 自算等级 | 回归结果按三轴映射，不经引擎 | 与 AES-QG 所有权冲突（单项不得自称等级），审计链断 | 破坏标准所有权与收口初衷 |
| 什么都不做 | 等级只在 v3 opt-in | 收口承诺落空 | 即 #171 开票动机 |

选定 A。落进契约形态：强约束写「等级值全称+digest 内容寻址双绑定沿用」，AC-001/002 承载三态与失败语义。

### D-2 receipt 版本演进

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A v4 新档（选定） | 新义务全进 v4，v3 冻结 | 四代并存读取，维护面变大 | 无 |
| B v3 内演进 | 加字段转强制，不升版本 | 破坏「版本=语义冻结」惯例，同版本两套义务 | 与 v1→v2→v3 冻结先例冲突 |
| C 旁挂不升版 | receipt 加指针，细节走旁挂文件 | 原子性弱化，与 fail-closed 精神相悖 | 机械校验要跨文件，可分离即可伪造 |
| 什么都不做 | 维持 v3 | 等级/截图/agent-live 无处安放 | 缺口即动机 |

### D-3 截图 tracker 无关保留位置

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 伴随目录（选定） | 随 receipt 同目录同生命周期冻结 | 需定容量上限；不随 Git 传播 | 无 |
| B artifact 包 | 打包版本化归档随发布携带 | 多造打包/寻址机制，作废跨包对齐 | 对「旧图不顶新验收」的机械保证最弱 |
| C 双写 | 伴随目录+归档包并行 | 两套生命周期，secrets 扫描×2 | 本票无需分发面 |
| 什么都不做 | 只留 GitLab | 证据随 tracker 存亡 | #171 支柱 3 动机 |

### D-4 验收单人类可读格式

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 仅 HTML（选定） | 模板复制零 LLM，任意浏览器离线可开 | 终端内不可直接看；文本流消费走 JSON | 无 |
| B HTML+Markdown 双格式 | 双模板双格式产出 | 双维护、作废同步×2；Markdown 图片渲染在 Claude Code/Codex 查看器跨边界不可锁死，赌输了白做一半 | 用户指出的不确定性正是要消除的对象 |
| C 仅 Markdown | 纯文本最轻 | 图片引用在终端媒介基本必挂 | 把不确定性留给每个查看者 |
| 什么都不做 | 只读 qa-receipt.json | 非工程角色无法消费验收产物 | 用户显式提出 |
