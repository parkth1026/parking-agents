# 调研：aes-workflow engineering 路由与门禁思想

- 票：parkth1026/parking-agents#151（map #147「story 级全链条工作流整合设计」子票）
- 日期：2026-08-29
- 调研对象（只读）：`G:/GIT/AI_WorkFlow/aes-workflow/skills/engineering/`（下称 `E/`）
- 深读文件：`E/README.md`、`E/aes-using-workflow/SKILL.md` 及其 `references/{protocol,record-shapes,artifacts}.md`、`E/aes-{go,plan,execute,review,validate,finish,retrospect,brainstorm}/SKILL.md`、`E/aes-workflow-bundle.json`
- 对照材料：本仓 `.agents/skills/workflow-interview/SKILL.md`、`.agents/skills/aes-gate/SKILL.md`、map #147 正文
- 引用格式：`文件名:行号` 均相对 `E/`；本仓文件写全路径。

## TL;DR

1. engineering 用「**两个用户入口 + 一份协议 + 一个确定性工具**」把全链条路由成原子技能：`aes-using-workflow` 是单步路由器（发现 Work Item → 按优先级表选一个主 Skill），`aes-go` 是链式执行器（顺序由 `chain` 命令按阶段号表算，缺前置直接拒）。状态全部是仓库里的 markdown，无数据库。
2. 门禁链三件套分工干净：**aes-review 判「有没有缺陷」（只读独立）、aes-validate 判「符不符合验收标准」（逐条证据机器字段）、aes-finish 判「能不能宣布做完」（两阶段交付 + 人核闭合）**。强制者不是 Skill 自觉，而是校验器 + 摘要链 + git 物理门。
3. 最值得 story 级全链条吸收的五个思想：路由判定有序表、`chain` 阶段号模型、`Verify:` 两种写法（case:/manual:）、人工面三态勾选协议、「在飞漂移不报、收口一次对账」的指针模型。
4. 与本仓重复（不必再吸收）：三阶段结构闸门、done 非自报、豁免落盘对账、对抗话术表——workflow-interview 家族已逐字级同源。
5. 不能照搬：一任务一 worktree + dev 集成的物理模型（本仓明确不走 worktree 流程）、12 类记录 + ULID 摘要链全量 schema（story 级子票会窒息）、WayFinder 显式点名才进入（与「一次 map 请求走完全链条」方向相反）。

---

## 一、路由模型

### 1.1 入口面：两个用户入口，都禁模型自启

14 个技能目录全部声明 `disable-model-invocation: true` 和 `allow_implicit_invocation: false`（`README.md:16-18`），普通请求不会自行加载这套流程。用户点名后，会话按 `<skill-dir>/../<技能名>/SKILL.md` 相邻路径读取其余流程文件，**不依赖宿主的子技能调用接口**（`aes-using-workflow/SKILL.md:100-103`）——这是跨 Codex/Claude Code 双平台的关键设计。

两个入口的分工：

| | `aes-using-workflow` | `aes-go` |
| --- | --- | --- |
| 职责 | 单步路由：发现/新建 Work Item，选一个主 Skill | 链式执行：用户点一串技能按序跑完 |
| 自己做什么 | 不产出业务记录，只做发现、路由、交接 | 不建任务不切分支（`aes-go/SKILL.md:3`），第一步永远先照 `aes-using-workflow` 正文做完开头几件事（`aes-go/SKILL.md:21-24`） |
| 顺序谁定 | Skill 按 10 条优先级表判断 | **`chain` 命令按阶段号算，Skill 不自己排序**（`aes-go/SKILL.md:26-34, 114`） |
| 停在哪 | 转给主 Skill 后由该技能定 | 默认跑到产出 `manual-test.md` 就停；`--auto` 多走一步 finish 准备，任务停在 `in_review`；**两种模式都标不了 `done`**（`aes-go/SKILL.md:86-92`） |

`aes-go` 的预置组合与阶段号表（`aes-go/SKILL.md:41-69`）：`feature` = brainstorm→plan→execute→review→validate；`fix` = debug→plan→execute→review→validate；阶段 0（todo/retrospect）可随时插入、1（interview）只在点名时加入、9（finish）收口。排序规则三条写死在 `chain` 里（`aes-go/SKILL.md:73-80`）：按阶段号排、阶段 0 跟着前一个技能走、相邻去重（隔着别的技能的重复保留，因为评审/验收不干净要退回重跑）。**重排只管顺序，不补缺的步骤**：点了 `execute` 但没有就绪计划，`chain` 直接拒（`aes-go/SKILL.md:82-84`）。

### 1.2 aes-using-workflow 的发现与路由

开工序列（`aes-using-workflow/SKILL.md:12-33`）：先确认**代码在哪个仓库**（不是人在哪聊天）→ 读目标仓库 AGENTS.md → `preflight`（只查安装是否进行中，无别的前置）→ `discover` 找当前任务 → 找不到建最小任务（必须 `--home-repository` 说清代码在哪，工具核对，对不上直接拒）→ 进任务 worktree → 分支名 `<类型>/<任务词组>`。

路由判定是一张**有序优先级表**（`aes-using-workflow/SKILL.md:41-56`），要点：

1. 用户点名的 `aes-*` 优先（含 Deep Interview/Grilling → `aes-interview`）。
2. 干活时冒出别的事：先问「同一次评审和验收能不能盖住它」，能就并进当前任务加一条验收标准；盖不住且现在做不了才记 todo。
3. 刚落地改动自己带出来的回归：**直接修，不建任务记录**（三条判据全满足：这次改动带出来的、一次提交说得完、不改验收标准；`aes-using-workflow/SKILL.md:46-49`、`protocol.md:663-675`）。
4. 「想说做完了」→ 依次 review → validate → finish。
5. 原因不明故障 → `aes-debug`；目标已知路线未知 → `aes-wayfinder`（**只在用户显式点名时进入**，不因 map/frontier/ticket 关键词自动切换，`aes-using-workflow/SKILL.md:37-39`）；无认可设计 → `aes-brainstorm`；有设计无计划 → `aes-plan`；有计划 → `aes-execute`。

「一件事该不该开新任务」的判据只有一条：**同一次评审和验收能不能盖住它**（`protocol.md:648-661`）。并入代价按时机分档（未评审/已评审验收/已 done 的回归/已 done 其他），回归直接修是刻意给轻量修正开的窄门——「为一处判定加一条测试走完整七份记录，是重量级流程套在轻量级修正上」（`protocol.md:671-673`）。

### 1.3 状态与文件契约

**状态即文件**：「流程状态就是仓库里的 markdown。没有数据库，没有后台服务」（`protocol.md:5-8`）。Skill 之间靠**读上一份记录、写下一份记录**衔接；路径只用来找文件，身份在文件头部（`protocol.md:10`）。

Work Item 契约（`workflow/<任务词组>/work-item.md`，`protocol.md:100-108`、`record-shapes.md:26-28`）：

- 必填头部：`schema_version`、`protocol`、`id`（`wi_<ULID>`）、`short_id`、`title`、`status`、`created_at`、`home_repository`；可选 `kind`、`branch_or_pr`、`base_revision` 等。
- `status` 五值：`proposed | active | in_review | done | cancelled`；**写 `done` 必须同时有一份 `delivered` 的交付记录**（`protocol.md:104`）。
- 每条验收标准有唯一稳定的 `AC-###` 编号；验收摘要只看 `目标`、`验收条件`（及存在时的 `范围`、`强约束`）四个二级标题，按 UTF-8/LF 规范化后算 SHA-256（`protocol.md:108`）——导航、背景章节随便改不作废下游。

Artifact 契约（`protocol.md:122-176`、`record-shapes.md:24-67`）：

- 12 类记录（design/wayfinder/plan/change-note/implementation/debug/review/validation/manual-test/delivery/retrospective/metrics/research），每类一个**结论字段**带固定枚举（如 review `verdict: approved|changes_requested|blocked`，delivery `outcome: ready_to_land|delivered|blocked|cancelled`）。
- **头部字段封闭**：只允许协议列出的字段，多一个就拒——「同时堵住偷偷加字段绕过门禁，和在 `dependencies` 之外另开事实来源」（`protocol.md:149`）。
- `dependencies` 存上游记录的 ID + 内容摘要 + `work_item_contract_digest`；带代码的记录还要 `subject.kind: change_set`（仓库、`base_revision`、`tree`、`content_digest`）。
- 改版不新建路径：同一文件写新 ID，`supersedes` 指向旧版；**「被取代」的事实源是新版的指针，不是旧版自述**，两边对不上报 `superseded_result_mismatch`（`protocol.md:59, 76-78`）。设计是例外，可以一版一个文件留档。
- 引用只许下游指上游（`reference_direction`），同阶段查环（`reference_cycle`）；唯一例外是设计与设计评审之间双向合法（`protocol.md:316-329`）。

`state.json` 是**算出来的索引不是正本**：由 `index` 命令从 markdown + 当前代码快照推导，含 `stage.reached`、`next_skill`、`waiting_on`；过期不阻断，对不上重算即可（`protocol.md:349-385`、`record-shapes.md:301-336`）。

**指针漂移模型**（`protocol.md:277-315`，本报告认为是最精妙的一段）：记录在代码改了/上游改了/验收标准改了/被取代时作废；但**在飞时不报**——「任务还在飞的时候上游一改下游就漂，那是干活的常态，`validate` 不报它。要收口了才必须全部对上，`finish-check` 在那一刻一次查干净」（`protocol.md:295`）。说明性记录手改 `work_item_contract_digest` 即可；评审、验收、交付是**证据**，过期只能重做不许手改。刷指针用 `sync-digests` 按依赖顺序一轮刷完。算代码摘要永远排除 `workflow/` 和嵌套 worktree——写记录不会让刚通过的检查失效（`protocol.md:281-283`）。

---

## 二、门禁链解剖

### 2.1 aes-review：独立审查（判「有没有缺陷」）

- **只读铁律**：「评审期间不写被审查的代码。一个字符都不改，改了这份评审就不再是独立判断」（`aes-review/SKILL.md:29-31`），配四条对抗话术（「顺手改了吧」「小问题直接修」「来不及了」——`aes-review/SKILL.md:33-38`）。
- 结论枚举 `approved | changes_requested | blocked`；**用户接受风险时仍写 `approved`，但必须附 `authorization` 五要素**：谁批的、什么时候、范围多大、理由、对应哪条问题——「没有别的豁免通道」（`aes-review/SKILL.md:19`、`protocol.md:397`）。
- 与验收的分工写在正文：「评审判断有没有缺陷，验收判断符不符合验收标准，两件事不能互相代替」（`aes-review/SKILL.md:23`）；与复盘的分工见 `protocol.md:513-523` 的对照表（评审看改动、复盘看过程；评审是门禁、复盘不是）。
- 细节：design review 不带变更集（审的是文档，代码不该让它过期，`protocol.md:279`）；rebase 后 `merge-check` 判不等价时只重审点名文件的主题（`aes-review/SKILL.md:45-48`）。

### 2.2 aes-validate：逐条验收（判「符不符合验收标准」）

- 逐条 `AC-###`，每条的验证方法写在任务里那行 `Verify:` 上，**只认两种写法**：`case:<用例名>`（指向已有单元测试或具名检查）和 `manual:<人该怎么做>`；散文写法校验器拒（`aes-validate/SKILL.md:14-16`、`protocol.md:401-413`）。
- `verify --work-item` 把用例名填进**两个固定模板**执行，模板之外的字符串一律不执行——「让工具执行记录正文里写的命令行，等于把 `workflow/` 下的记录变成可执行文件」（`protocol.md:410-411`）。
- `acceptance` 是机器字段，逐条写编号、结论、方法、证据；**方法和证据缺一个校验器就拒**（`acceptance_without_evidence`）（`aes-validate/SKILL.md:20-21`、`protocol.md:399`、`record-shapes.md:256-266`）。
- 机器验不了的写 `not_run`（只要写方法），**落进 `manual-test.md` 交给人**；写清单是 validate 的活，工具一个字节不碰人写的正本，已勾过的不许动（`aes-validate/SKILL.md:24-27`）。
- 补跑默认全部重跑；缩小范围必须 `--only` 配 `--reason`，「判『一处改动影响不影响某条验收』机器判不了，工具不替人判断，不给理由直接拒」（`protocol.md:415-417`）。
- 「什么叫真跑过」四条对照（`aes-validate/SKILL.md:49-59`）：在当前变更集上重新执行、看到输出和退出码；评审 approved、上周全绿、代码没动过，都不能代替这一次真跑。

### 2.3 aes-finish：两阶段交付（判「能不能宣布做完」）

**准备**（`aes-finish/SKILL.md:17-29`）：核对变更集与 Git 一致 → 最新评审 `approved` → 最新验收 `passed` 且覆盖所有未豁免标准 → 确认 `manual-test.md` 已由验收阶段产出（**不由收口产出**，缺了退回 validate；准备阶段不要求勾完，「准备本来就是给人测创造条件的」）→ 跑 `index` 定稿状态 → 写 `ready_to_land` 交付记录 → 任务改 `in_review` → **停下来等人**。

**关闭**（`aes-finish/SKILL.md:31-69`）：

- 人工清单必须闭合：一条 `[ ]` 不剩、一条 `[!]` 没有；零条目也算闭合，前提是正文写明为什么没有人工项。
- **「人核对通过只有一个来源：文件里的那个 `[x]`」**——用户在对话里说信得过、客户催，都不是勾；你也不能替他勾（`aes-finish/SKILL.md:36-38`）。
- `[ ]` = 等人测（任务停在 `in_review`，不是错误）；`[!]` = 缺陷不是等待，退回 debug/execute 修完让人重测，「不要在收口这一步纠缠」（`aes-finish/SKILL.md:47-51`、`protocol.md:497`）。
- **rebase 落在两步之间**：收口准备做完（`in_review` + 待落地记录）就能跑 `merge-check`；先关闭再 rebase 的话，解冲突代码没有任何证据覆盖而记录已锁死，「连补写的地方都没有」（`protocol.md:426-429`、`aes-finish/SKILL.md:55-57`）。
- 关闭链：`merge-check` → 等价判定（不等价则点名文件重审/补跑）→ 目标分支读到真实落地版本 → `merge-verify`（确认目标分支包含落地提交且相对基线有真实变更）→ 写 `delivered` → **同一次提交**把任务改 `done` → 快进合入（`aes-finish/SKILL.md:59-67`）。
- 物理门：`dev` 上只能有 `done` 的任务；`commit-guard` 拦混合提交（代码与记录分开提交，`protocol.md:557-565`）；`merge-check`/`merge-verify` 只报结论不改文件（`protocol.md:431-433`）。

人工核对三态与两阶段放行矩阵（`protocol.md:488-497`）：

| 清单状态 | 收口准备 | 收口关闭 | 任务停在 |
| --- | --- | --- | --- |
| 缺清单 | 拒 `manual_test_missing` | 拒 | 退回验收 |
| 还有 `[ ]` | 放行 | 拒 `manual_check_open` | `in_review` 等人测 |
| 出现 `[ ]`→`[!]` | 放行 | 拒 `manual_check_failed` | 退回去修 |
| 全过或零条目 | 放行 | 放行 | 可以 `done` |

状态机总览（状态 → 门 → 拦截者）：

```
active ──(review approved + validate passed + 清单已产出)──▶ in_review   [finish 准备；finish-check/校验器]
in_review ──(manual-test 全 [x] 或零条目 + merge-check + merge-verify)──▶ done + delivered   [finish 关闭]
done/cancelled ──▶ 记录锁死，闸门不追溯（protocol.md:297, 501）
```

### 2.4 与 workflow-interview 三阶段门禁的异同对照

workflow-interview（本仓 `.agents/skills/workflow-interview/SKILL.md`，下称 WI）：三阶段 1-interview（锁需求）/ 2-prototype（锁对照物）/ 3-contract（锁验收）（WI:17-21），编排器不产出文件（WI:10-11），门禁由 `session.mjs stage ... done` 结构闸门强制，`skipped` 只有 2-prototype 能用且必须带 `--reason`，finalize 拿 reason 跟契约残留风险对账（WI:59-66），回退用 `needs_reinterview` 带待澄清项（WI:69-74）。

| 维度 | WI 三阶段门禁 | aes review→validate→finish |
| --- | --- | --- |
| 位置 | **前置**：进入实现之前 | **后置**：实现之后、交付之前 |
| 锁什么 | 需求、对照物、验收契约 | 缺陷判定、验收执行、交付证据 |
| 闸门形式 | `session.mjs` 结构闸门 + `finalize` 退出码 | 校验器（validate/verify/finish-check）+ 摘要链 + git 物理门（commit-guard/merge-check） |
| 产物语义 | 契约（交接给执行方） | 证据（审计这次交付） |
| 跳过 | `skipped` 仅 2-prototype，带 reason 且 finalize 对账 | 无跳过；`not_run` 只需写方法，豁免走 `authorization` 五要素 |
| 回退 | `needs_reinterview` 打回访谈 | `changes_requested`/`failed` 退 execute/debug；同一次调用退回两次仍不干净就停（`aes-go/SKILL.md:100-101`） |
| 人的位置 | 用户确认对照物与契约；非 `[A]` 档验收条件报给用户当交接面（WI:88-91） | 人勾 `manual-test.md`；`[x]` 是「人核对通过」的唯一来源 |
| 质量观 | 闸门挡结构不挡质量（WI:66） | 评审挡缺陷、验收挡标准、**复盘和度量永远不是门禁**（`protocol.md:509, 347`） |

**同源的骨架**（两套门禁共享的哲学，说明家族血统一致）：done 不是自报的（WI:62「`session.mjs` 收到 done 时跑该阶段的结构闸门，不过就拒收」 ≈ aes 的校验器拒收）；豁免必须落盘带理由并接受对账（WI:63-65、112-114 ≈ authorization 五要素 / not_run+方法）；机器可判字段化（acceptance 字段 ≈ manifest/finalize 退出码）；编排与产出分离（WI:10-11 编排器不产出文件 ≈ `aes-using-workflow/SKILL.md:113-115`「工具只做机械的事，判断、设计和编排还是 Skill 的活」）；「简单不是跳过的理由」+ 对抗话术表（WI:98-114 与 `aes-brainstorm/SKILL.md:43-53` 几乎逐字相同）。

**aes 有而 WI 没有的**：后置证据链的**过期模型**（代码一动旧证据作废、在飞不报收口对账）；**人工面回写协议**（人改文件即反馈，`[!]` 区分缺陷与等待）；**两阶段交付**把「可宣告」与「已落地」分开，rebase 窗口嵌在中间。**WI 有而 aes 没有的**：结构闸门与质量分离的显式声明、`skipped` 这种一等状态、决策档案（dossier）重投影。

---

## 三、可迁移思想清单

### 3.1 值得 story 级全链条工作流吸收（对齐 #147 未决问题）

1. **路由判定写成有序优先级表，集中在入口一处**（`aes-using-workflow/SKILL.md:41-56`）。理由：story 级整合最大风险是路由逻辑散落在各技能头部 description 里，每个会话重新发明路由；一张 10 条可对号的表（点名 > 并入 > 回归直接修 > 点名收口 > debug > wayfinder > …）让决策一致且可审计。对应 #147「整合落点不预设」——无论落点选哪，入口都该长这样。
2. **链式入口 + 阶段号表 + 顺序归确定性工具**（`aes-go/SKILL.md:26-34, 56-80`；`chain` 返回 order/reordered/deduped/preset）。理由：#147 的核心诉求「一次 map 请求走完全链条」正是 aes-go 的「一次点一串技能」场景；`chain` 不补缺步骤、缺前置直接拒（`aes-go/SKILL.md:82-84`）避免了链式入口最常见的失败模式（自作主张补步骤）。WI 现在只有单步编排器，没有这张阶段号表。map 请求 = 一个预置组合（story 展开 interview→prototype→contract→拆票→执行→验收），退回重跑时「隔着别的技能的重复保留」（`aes-go/SKILL.md:78-80`）正是需要的语义。
3. **「同一次评审和验收能不能盖住它」= 开新票唯一判据 + 回归直接修三条件**（`protocol.md:648-675`、`aes-using-workflow/SKILL.md:45-49`）。理由：直接回答 #147「拆解粒度与上下文预算」未决问题的一半——什么并、什么拆、什么不开票直接修；「把顺手能做完的事拆成三个待办，流程会被拉得比做事还长」（`aes-execute/SKILL.md:45`）是拆解粒度的反向约束。并入代价按时机分档的表（`protocol.md:657-661`）可以直接改造成「票并入 story 的代价表」。
4. **验收条件两种写法 + 固定模板执行**（`protocol.md:401-413`）。理由：#147「验收回填与 story 收口协议」要的「票 close → contract AC 判定」链路，缺的就是 AC 的机器可判形状。`Verify: case:<用例名>` / `Verify: manual:<怎么做>` 二分 + 工具只填模板不执行正文（防注入，`protocol.md:410-411`）+ 补跑缩小范围必须带 `--reason`——这一套能让 goal-contract 的 AC 分档从「报给用户看」升级为「可机器复跑」。WI 的非 `[A]` 档本质是 manual: 的子集，可以对齐。
5. **人工面三态勾选协议 + 两阶段放行矩阵**（`protocol.md:456-501`、`aes-finish/SKILL.md:36-47`）。理由：story 级的终态对账一定有人工面（user acceptance），WI 现在只有单向的「报给用户」；aes 给了人这一侧的回写协议——人改文件就是反馈、`[!]` 是缺陷不是等待、准备放行/关闭拒的矩阵、「零条目也算闭合，前提是写明为什么」。这套协议让「story done」有了与人核对闭合的可判定语义。
6. **指针漂移模型：在飞不报、收口一次对账、证据与说明分层**（`protocol.md:277-315`）。理由：story 级是长链条多子票，子票改验收不该让全链每张票爆红；「这句话只在有人依赖它的时候才要成立：收口那一刻，以及此后读历史时」（`protocol.md:295`）。对应 #147「验收回填与 story 收口协议」：story 在飞时子票 AC 变更只刷说明性指针，story 收口那一刻 finish-check 式一次对账。证据类（评审/验收/交付）过期只能重做不许手改，这条防住「改个哈希糊弄过去」。
7. **豁免唯一通道 + 五要素落盘**（`protocol.md:397`、`aes-review/SKILL.md:19`）。理由：story 级一定有 out_of_scope/skipped 票；authorization 形状（谁批/何时/范围/理由/对应问题）比一句 reason 更可审计，且「没有别的豁免通道」堵住了每个门各发明一个豁免口子的熵增。
8. **代码摘要排除流程目录（自指豁免）**（`protocol.md:281-283`）。理由：story 级工作流自己的产物目录（issue 目录、临时知识库）必须排除在任何代码/结构变更集判定之外，否则「边干边记」会不断失效刚过的检查——这是让流程文件与工程证据共存的前置条件。
9. **复盘与度量永远不是门禁**（`protocol.md:347, 509`）。理由：门禁链越长越容易膨胀；明确「收口不要求先有复盘，那只会逼出应付了事的复盘」给 story 级的 retrospective 票定了边界。
10. **「规矩挡路时停下来问，不要改规矩」**（`protocol.md:719-731`）。理由：全链条工作流门禁多，被挡概率高；这条防住 agent 在被挡当场顺手改协议为自己放行。

### 3.2 与本仓现有家族重复（不必再吸收）

- **三阶段结构闸门、done 非自报、skipped 带理由对账、残留风险落盘**：WI:59-66、112-114 已有，与 aes 校验器思想同源。
- **对抗话术表与「简单不是跳过的理由」**：WI:98-114 与 `aes-brainstorm/SKILL.md:43-53` 逐字级同源，家族已吸收完毕。
- **前置端技能**（aes-interview / aes-brainstorm 的设计记录 accepted 流转）：与 WI 家族（aes-interview + aes-prototype + aes-goal-contract）功能重叠。#147 已列「整合落点不预设」——不应在 story 级里引入第二套设计记录体系（design.md + accepted + supersedes），契约（goal-contract）应保持唯一验收真源。
- **aes-gate 不构成重复**：本仓 `.agents/skills/aes-gate/SKILL.md` 是仓库级基建门（测试命令/CI/checks 盘点组装，run.toml 注册真源），engineering 的门禁是任务级流程证据门，两层互补；story 级的机器面 AC（case: 档）未来可以挂到 aes-gate 注册的门上，这是衔接点而非重复。

### 3.3 冲突或不能照搬

- **一任务一 worktree + dev 集成的物理模型**（`protocol.md:734-765`、merge-check/commit-guard/Junction/记录 Junction 拆除）：本仓 AGENTS.md 明确「不走常规开发的 worktree 流程」；story 级的落地终点是 issue close + 技能发布（skill-release 五步），不是合 dev。两阶段交付的**语义**（准备=可宣告 in_review、关闭=已落地 done）值得保留，物理门全部要换。
- **12 类记录 + ULID + 摘要链全量 schema**：单张 story 子票若各背七份记录会窒息（aes 自己都为此开了「回归直接修」窄门，`protocol.md:671-675`）。应吸收「哪些产物是证据、哪些是说明」的分类学和漂移规则，不搬 schema 本身；子票层面用 #147 已有的轻量模型（issue + 临时知识库）。
- **WayFinder 显式点名才进入**（`aes-using-workflow/SKILL.md:37-39`、`aes-go/SKILL.md:18-19`）与 #147「一次 map 请求自动走完全链条」方向相反。这是 aes 防误触发的刻意设计，不是缺陷；照搬路由模型时须把「显式点名」门槛改造成「map 票流裁决」，否则 story 级自动串联会被这条规则拦住。
- **`done` 记录锁死 + 闸门不追溯**（`protocol.md:297, 501`）在 issue 世界没有完全对应物：GitHub issue 可以 reopen。story 级需要定义「锁死」的等价物（例如 reopen 视为开新票并留 `reopened_from` 指针——aes 自己的 wayfinder 票已有此字段，`protocol.md:212`）。

---

## 附：证据文件清单

| 主题 | 文件（相对 `E/`） |
| --- | --- |
| 入口与路由 | `README.md`、`aes-using-workflow/SKILL.md`、`aes-go/SKILL.md` |
| 协议与契约 | `aes-using-workflow/references/protocol.md`、`references/record-shapes.md`、`references/artifacts.md` |
| 门禁链 | `aes-review/SKILL.md`、`aes-validate/SKILL.md`、`aes-finish/SKILL.md` |
| 前置与执行 | `aes-brainstorm/SKILL.md`、`aes-plan/SKILL.md`、`aes-execute/SKILL.md` |
| 复盘 | `aes-retrospect/SKILL.md` |
| 安装清单 | `aes-workflow-bundle.json`（实列 15 项；`README.md:7` 与 `README.md:16` 称「14」，目录树亦为 15 个技能目录——计数出入属对方仓库事实，此处仅记录不解释） |
| 本仓对照 | `.agents/skills/workflow-interview/SKILL.md`、`.agents/skills/aes-gate/SKILL.md`、issue #147 |
