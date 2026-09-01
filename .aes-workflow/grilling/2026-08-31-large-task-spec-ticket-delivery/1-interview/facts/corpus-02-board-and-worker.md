# Fact: grilling 历史语料 02 — board、发布改造、gate 与 worker

- 派遣问题：完整读取指定六例的 manifest/context/rounds 与正式契约，核对复杂度、拆分交接、验证与终态证据；为“大任务总体 Spec + 多任务 + 独立验收是否足够”提供正反实例，不决定本次制作范围。
- 完成：2026-08-31T23:24:00+08:00。
- 当前读取仓：`G:/GIT/AI_WorkFlow/parking-agents-manual`，HEAD `f4e37757b9f3d5627c7636626f579d87d523bc37`。
- 案例根：`.aes-workflow/grilling/`。下文 `C1`—`C6` 只为本报告缩写，不改历史文件名或身份。
- 边界：仅本文件写入；未改六例、产品或当前访谈状态，未执行任何历史 Verify，未用当前 validator 审历史格式，未查远端 tracker。

## 查到的

### 先清点产物，再区分证据层

| 案例 | 正式产物与版本轨迹（本轮文件清单） | 核心文件实际全文阅读范围 |
| --- | --- | --- |
| C1 `2026-08-23-worktree-board` | 五类正式 prototype + 单份 contract + verify；mock v1–v4、四份文字/diagram v1–v2、design brief/canvas；案例内无另存 spec/plan/ticket。 | manifest 1–54；context 1–60；rounds 1–36；contract 1–172；verify 1–18。 |
| C2 `2026-08-24-对标mattpocock仓库差距` | behavior/example/diagram + 单份 contract + verify；两个 facts、report v1/v2；正式报告另在 `docs/research/`。案例内无另存 spec/plan/ticket。 | manifest 1–52；context 1–64；rounds 1–28；contract 1–178；verify 1–10。 |
| C3 `2026-08-24-aes-gate` | 五类正式 prototype + 单份 contract + verify；mock v1、其余 v1/v2；外接研究报告、#41 决议与 #42 实施。案例内无另存 spec/plan/ticket。 | manifest 1–54；context 1–59；rounds 1–28；contract 1–175；verify 1–12。 |
| C4 `2026-08-24-aes-worktree-board-upgrade` | 四份 facts、五类正式 prototype + 单份总体 contract + verify；mock v1/v2；behavior 内有 N1–N9/B1–B6 任务图表。案例内无各子票正文独立快照。 | manifest 1–54；context 1–74；rounds 1–20；contract 1–147；verify 1–19。 |
| C5 `2026-08-25-aes-worktree-board-session-evolution` | 三份 facts、五类正式 prototype、design-qa 与旧 390 历史 QA、`qa/`/`qa-700/` 截图、单份 contract + verify。案例内无另存 spec/plan/ticket。 | manifest 1–55；context 1–180；rounds 1–78；contract 1–214；verify 1–18。 |
| C6 `2026-08-27-aes-issue-worker-流程重梳` | behavior/api-mock/diagram + 单份 contract v3 + verify；behavior v1–v7、diagram v1–v6、api v1/v2；map #82 与实施票 #83 为外部指针。案例内无另存子票正文。 | manifest 1–52；context 1–56；rounds 1–18；contract 1–195；verify 1–12。 |

六例当前保存的 manifest 都是 `3-contract done` / `ready`。这说明其访谈交付到了契约交接状态，不是六个产品都验收通过。六份 `verify.txt` 大部分是功能实施前的红测；C4 还明确写“新增域尚不存在，今天全红为预期”（`C4/3-contract/contract.md:69`）。本轮不把这些红测判为最终交付失败，也不把历史 Ready 当作产品 PASS。

本报告区分：①当前文件确实存在；②历史记录报告的试验/验收；③Git 对象证明已发生提交；④本轮重新运行验证。④全部 NOT_RUN；②不自动升级为④，③不自动证明所有 AC 通过。

### C1：最初的 worktree-board — 一份契约已覆盖多层产品，但当时明确只给建议

| 维度 | 事实与判断 | 证据出处 |
| --- | --- | --- |
| 复杂度 | 从“状态查询 skill”扩成两界面的主脑作战台：全量 Issue 图、依赖/frontier、五个 worker、采集/判断/渲染、headless 派发、dirty 握手、快照降级与目录迁移。不是一个纯页面任务。 | `C1/1-interview/context.md:16,22-30`；`C1/3-contract/contract.md:19-39` |
| 阶段与版本 | 七轮，图形对照先后多次推翻：wayfinder 暗色→四列→双图→用户高保真 handoff，v4 与其余正式物最终锁定。原型纠偏是流程有效工作，不是失败次数。 | `C1/1-interview/rounds.jsonl:20-31`；`C1/3-contract/contract.md:137-143` |
| 拆分交接 | 单份六 AC 契约；分域 selftest（collect/dispatch/server/layout）组织验证，没有正式子任务包。范围明确不 merge、不 close Issue、不 commit、不建浏览器测试基建。 | `C1/3-contract/contract.md:35-40,79-96` |
| 验证与终态 | 历史 verify 4 红、0 绿；页面/巡检两条非 A 未跑。上下文所说“v1 派发/页面已实测”是新目标之前的既存能力，不证明 v4 全契约通过。 | `C1/3-contract/verify.txt:1-18`；`C1/1-interview/context.md:28,38-40` |
| 正面机制 | 固定用户设计稿不可改；精确列视觉交互和失败握手；事实由脚本采集、判断由 Agent 落盘、页面只渲染；明确接口兼容范围。 | `C1/3-contract/contract.md:44-53,85-96`；`C1/2-prototype/behavior.md:15-28` |
| 反面边界 | 边缺失会虚增 frontier，已作为用户接受的依赖书写风险；真实 Codex flag 未现场核对。总体契约虽广，仍依赖环境预检和人工视觉，不能因 A 数量够就解释为无人值守完整交付。 | `C1/3-contract/contract.md:104-105,149-168` |

后续本地复盘有真实流程样本，但目标已变化：`docs/retrospectives/aes-worktree-board-multi-agent-orchestration-retrospective-2026-08-24.md:3,7-9` 明说它是流程复盘，不是产品实现报告；`:354-362` 记录 dev4/#17 的 executor 与 merge SHA、祖先关系；`:369-370` 同时记录技能仍写“只建议 merge”而运行已执行 merge、snapshot 字段互相矛盾。它证明后续曾跑通业务链且出现了规范/运行漂移，不能倒签 C1 全 AC PASS。

### C2：对标仓库差距 — 用户明确选择合一份，不能用 AC 数机械强拆

| 维度 | 事实与判断 | 证据出处 |
| --- | --- | --- |
| 复杂度 | 同时涉及生成发布树、分类真源、三个安装入口的选装、评测总入口、README/AGENTS/领域文档、CHANGELOG/tag、自助标准与研究报告；用户定位是自用，拒绝 CI/对外分发等扩面。 | `C2/3-contract/contract.md:27-54`；`C2/1-interview/rounds.jsonl:14-24` |
| 阶段与版本 | report v1 被质疑“复制式出库怪”，探索后锁生成式 D；首批自研名单推荐被用户推翻，最终只维护 Matt 集与自助标准。 | `C2/1-interview/rounds.jsonl:14-15`；`C2/3-contract/contract.md:133-139` |
| 拆分交接 | 用户明确选择契约合一份；最终七 AC，理由是改造项互相咬合，拆报告/改造没有独立收益。它是反证：不能由“大于六条”直接推出应该拆。 | `C2/1-interview/rounds.jsonl:25`；`C2/3-contract/contract.md:147,154,178` |
| 验证与终态 | 历史 verify 3 红、0 绿，另有真实 evals + 三条文档人工验收未跑；用户明确推翻“只 --list”建议，要求真跑。 | `C2/3-contract/verify.txt:1-10`；`C2/1-interview/rounds.jsonl:26` |
| 后续实现指针 | 本地 Git 对象 `96e28d3`（2026-08-25，“建立自研技能生成式分类发布流程”）修改17文件，包含生成器/安装器/evals/tests/文档；正式报告存在且明确哪些闭合、哪些有意不做。Git 对象不替代本轮未重跑的真实 evals。 | 本轮 `git log --all`、`git show --stat 96e28d3`；`docs/research/对标mattpocock仓库差距-2026-08-24.md:22-37,62-82,84-106` |
| 正面机制 | 生成器唯一写入者、`--check` 防漂移、保住默认安装行为、非目标明确、用户自助流程完整，支持在一份契约内完成耦合改造。 | `C2/3-contract/contract.md:46-54,87-100` |
| 反面发现 | 人工语义与真模型路径仍需独立证据；首批没有真实自研晋级样本是明确接受的 fixture 边界。更具体地，契约 D-01 写“14条”却跳过 G7，正式报告为保持14项把“双方共同缺少、并非差距”补为 G7。它诚实说明了补位，但也说明数量约束能扭曲内容分类。 | `C2/3-contract/contract.md:80,108-110`；`docs/research/对标mattpocock仓库差距-2026-08-24.md:18,28,50,62` |

### C3：aes-gate — 从体检到四条工作路径，最需要总体/子票验收映射

| 维度 | 事实与判断 | 证据出处 |
| --- | --- | --- |
| 复杂度 | 初始为 QA 前体检，后来包含检测、组装、活看板、日常单条沉淀、历史评分、CI 保护硬前提；同时区分独立调用与 aes-qa 精简调用，跨目标仓文件与账号权限。五 AC 不代表目标简单。 | `C3/1-interview/rounds.jsonl:7-15,18-28`；`C3/3-contract/contract.md:18,27-42,80-89` |
| 阶段与版本 | prototype 实际暴露“检测只读不跑门禁”与“新鲜红绿”矛盾并回问；用户决定实跑。又由钢人追问第一消费者，把高频单条沉淀升为主路径。 | `C3/1-interview/rounds.jsonl:16,22-23`；`C3/3-contract/contract.md:120-128` |
| 拆分交接 | 总体契约五 AC，经 #41 决议交 #42 实施；真实 aes-qa 联调明确留 #19，不在本票模拟调用中冒充完成。没有案例内的子票完整契约快照。 | `C3/1-interview/rounds.jsonl:6`；`C3/3-contract/contract.md:88-100` |
| 验证与终态 | 历史 verify 2 红、0 绿，3条非 A 未跑；混合 AC-001 的追加 A 与 AC-004 的追加 D 没有独立行，因此 verify 总数不足以表示实际验证步骤总量。 | `C3/3-contract/verify.txt:4-12` 对照 `C3/3-contract/contract.md:80-89` |
| 后续实现指针 | 本地提交 `451e9aa`（2026-08-27，#42）落地技能、collect、board template、tests与自举留档。自举报告绑定源仓 `dc2f675`、collect 命令和退出0，报告24项测试全绿；这是有来源的历史自举证据，不是本轮实跑。 | 本轮 `git show --stat 451e9aa`；`skills/workflow/aes-gate/references/bootstrap-report.md:1-9,73-81` |
| 正面机制 | run.toml 注册真源、registry仅运行事实、判例答不出不冒充机器门、组装需确认、无保护不称硬门、调用路径与写入路径分开。 | `C3/3-contract/contract.md:33-41`；`C3/2-prototype/behavior.md:12-22` |
| 反面发现 | 后续自举“#42五AC”是目录结构、缺口清单、注册真源、可辩护体检、技能校验；原总体 AC 是单条沉淀、批量检测、组装硬前提、看板、aes-qa 调用。两者编号/语义不等同，本地材料没有完整映射证明总体其余条款如何分配并验收。只能结论为“尚未重建总体覆盖证据”，不能据此认定漏实现或用户未批准拆分。 | `skills/workflow/aes-gate/references/bootstrap-report.md:73-81` 对照 `C3/3-contract/contract.md:80-89` |

### C4：board-upgrade — 总体契约 + 依赖任务图已有直接先例

| 维度 | 事实与判断 | 证据出处 |
| --- | --- | --- |
| 复杂度 | P0六项控制机制 + 四缺陷 + schema v3兼容 + 六处UI挂点 + 回归基建 + 三处契约同步 + 完整Issue图，显然跨多个可独立推进工作。 | `C4/3-contract/contract.md:15,24-26` |
| 上游问题 | 原 #5 正文26777字符、33条未勾AC；新增cursor/熔断/停止/listener协议没有对应验收，规范与技能/运行事实不一致。此是历史取证记录，不是远端当前状态。 | `C4/1-interview/context.md:22-30`；`C4/1-interview/facts/issue-tracker.md:10-25` |
| 拆分交接 | 用户明确“全量建图但只实施P0+四bug”；behavior 将 N1–N9、#22/#24 与 B1–B6 分开，列依赖与是否本次实现；总体契约明确作为“验收伞”，执行拆分由依赖图承担。 | `C4/1-interview/rounds.jsonl:6,9-14`；`C4/2-prototype/behavior.md:28-45`；`C4/3-contract/contract.md:143-147` |
| 验证设计 | 各组自测映射 storage/lifecycle/governance/boundary/contract；另有图完整性脚本，检查任务存在、依赖边、父节点、收编互链。真实编排被用户明确排除，本次离线为主是已批准边界。 | `C4/3-contract/contract.md:65,69-84,92` |
| 后续实现指针 | 当前图核验源码固定了 #26–#34 对应 N1–N9、#35–#40 backlog 与预期依赖；后续 C5 历史事实记 #34 的fixture缺陷经 `66e2fee` 修复、`e8b0ea6` 合入，#45由 `a929590` 等修复、`81afa92` 合入。不能从当前脚本存在推出当年每票都完美。 | `skills/workflow/aes-worktree-board/scripts/check-issue-graph.mjs:24-71`；`C5/1-interview/facts/session-runtime-failures.md:20-21` |
| 验证与终态 | 历史verify 6红、0绿、UI未跑；当时新orchestration域不存在是预期红线。后续C5记录全frontier运行最终收敛，且区分backlog不等于应执行；这是后续历史流程证据，不能自动覆盖C4人工UI验收。 | `C4/3-contract/verify.txt:4-19`；`C4/3-contract/contract.md:69`；`C5/1-interview/facts/session-runtime-failures.md:12,17,20-21` |
| 正面机制 | 架构分层、互斥/幂等/append-only、以真实事故作回归、实现/不实现任务分开、可查依赖图、合并不可分缺陷避免重复实现，都是可复用做法。 | `C4/3-contract/contract.md:30-40,143-147` |
| 反面发现 | 9→7重编号后仍有旧AC指针：D-01与挡点写AC-008，UI“读什么”写AC-007，实际正式UI为AC-005、图为AC-006。仅压缩编号没提供稳定映射会让交接者对错验收条款。图表也把N8测试作为N1–N6后继、N9文档作为末尾任务；它是实际已接受拆法，不可强称历史已经采用每票全层纵切。 | `C4/3-contract/contract.md:57,65,79-88,143`；`C4/2-prototype/behavior.md:32-43` |

### C5：session-evolution — 明确区分目标、持续性、真实宿主与证据层

| 维度 | 事实与判断 | 证据出处 |
| --- | --- | --- |
| 复杂度 | 三层workflow、新runner/job/attempt身份、双层Goal、四类题外发现回流、风险合并门、恢复、人工态、700×1000交互、五条轨迹回归。26行为行+10边界合入7AC，说明AC个数低估复杂度。 | `C5/1-interview/context.md:48-94`；`C5/2-prototype/behavior.md:13-53`；`C5/3-contract/contract.md:35-55,189` |
| 正确暂停重定目标 | 用户“先决定期望目标”使修复Q1–Q4冻结，不假装已答；最终选目标A：session存活期闭环+人工重启持久恢复，不含daemon、完整证据飞轮与发布。 | `C5/1-interview/rounds.jsonl:9`；`C5/3-contract/contract.md:25,48-55,166,214` |
| 版本治理 | 视觉从横屏+390被两次纠偏到700，旧批准与旧截图明确失效保留；新版经独立designer/code/requirements复审并最终用户确认。合同内嵌humanRequest增量，避免偷偷改已锁api-mock。 | `C5/1-interview/rounds.jsonl:58-65,75-78`；`C5/3-contract/contract.md:61-62,103-105,203-210` |
| 拆分交接 | 一个总体契约新建两个组合技能，明确现有缺陷作回归不重做；未保存本目标的正式分票包。其产品输入却有严格最小Issue Contract，role/执行政策/状态正交。 | `C5/1-interview/context.md:21-35,108-115`；`C5/1-interview/rounds.jsonl:13,18,23-27`；`C5/3-contract/contract.md:4,29,45` |
| 既有成功证据 | 背景历史Goal最终有精确merge指针、pending=0，未把15个OPEN或backlog视为应全部实施；同时保留提前complete、漏消费、环境污染、错误review绑定等真实事故，说明业务成功与控制面改进可以同时成立。 | `C5/1-interview/facts/session-runtime-failures.md:12-21` |
| 当前目标验收边界 | 原型design-qa绑定mock SHA、浏览器/DPR/字体、九个截图与逐项交互、三路复审；明确只是DEMO，desktop与真实API NOT_RUN。历史契约verify仍6红、0绿；AC-007需要3个fresh真实Issue，依赖用户指定/授权。 | `C5/2-prototype/design-qa.md:3-14,30-47,64-81,95-114`；`C5/3-contract/verify.txt:4-18`；`C5/3-contract/contract.md:120-143` |
| 正面机制 | 成功/失败/预算/权限/人工等待分层；精确candidate使旧review/QA失效；四个中断点、post-merge失败不close、发现新工作不扩当前scope；混合门清楚说离线+真实两半齐才通过。 | `C5/3-contract/contract.md:66-82,114-137` |
| 反面发现 | 已确认总体契约仍有跨文件阶段残留：manifest原型done的reason仍写“等待复审与用户确认”，behavior首部仍写候选v3，而rounds已有最终确认。冷读时必须有优先级/版本索引；七个大簇中夹着多实体、多层故障、混合验收，若只交这7条给单session，仍需可执行切分和覆盖映射。 | `C5/manifest.json:23-33`；`C5/2-prototype/behavior.md:1-7`；`C5/1-interview/rounds.jsonl:75-78`；`C5/3-contract/contract.md:117,129-133,189` |

### C6：worker重梳 — 冷读修订与纯文档小交付是成功机制，入口漂移仍然显著

| 维度 | 事实与判断 | 证据出处 |
| --- | --- | --- |
| 复杂度不是改文件数 | 原来只想调路由、QA/review/simplify顺序和risk字段，经过9轮原型裁决变成重划总管/干活/合并三lane、QA单角色多调用、review打回协议和人工lane占位。 | `C6/1-interview/context.md:12-16`；`C6/1-interview/rounds.jsonl:10-17` |
| 最终有界交付 | 最终不是整个merge workflow：只修三个技能及board设计文档；明确不建merge-worker、不实现human lane、不改mjs/schema。保留v3 host merge语义，仅在v4角色处调整。 | `C6/3-contract/contract.md:20-22,34-54` |
| 拆分与接口 | map #82/#83只承接当前prose修订；未来merge-worker另建。正式api保留work-order不变，新增review-return报文，经registry/hub路由，绑定被审candidate；worker修复后重新QA与新receipt。 | `C6/3-contract/contract.md:51-69,90-97`；`C6/2-prototype/api-mock.md:5-11,69-76` |
| 最大具体漂移 | manifest.goal仍写“review→QA + declaredRisk additive schema”，context也保留初轮结论；但round5已撤销字段扩展，最终contract锁零mjs/零schema。这不是后续实现偏离证据，而是同一归档包的摘要没追上已批准的最新设计。 | `C6/manifest.json:7,10`；`C6/1-interview/context.md:49-56`；`C6/1-interview/rounds.jsonl:12-17`；`C6/3-contract/contract.md:49-59` |
| 验证与终态 | 历史verify三条新文档锚点红、一条既有回归绿；未跑D。契约主动揭示“[A]4/[D]1低估人工负担”：AC001–003的承重验证仍是语义逐行人工对照，只有AC005纯机械。 | `C6/3-contract/verify.txt:4-12`；`C6/3-contract/contract.md:101-124,134-138` |
| 后续实现指针 | 本地Git `1126794`（2026-08-27，#83）确有三处技能/board design文档修订及访谈归档；紧接`0e4ec20`（#86）纠正stage写操作会消耗预算的说明。证明发生交付与后续纠偏，不是原5AC的终局验收凭证。 | 本轮 `git log --all`、`git show --stat 1126794` |
| 正面机制 | cold-read v3补了“唯一正式对照物”“v3/v4不可误删范围”“frontmatter也同步”“本地契约与#83六节同步”和真实人工负担说明；有意的纯文档切片无需强造代码功能与runtime测试。 | `C6/manifest.json:10`；`C6/3-contract/contract.md:44-47,68-69,90-92,105,110,134-138` |
| 反面边界 | 文档已定责不代表待建lane已能执行；同一role名在草稿/正式物中还残留旧词（behavior角色表aes-merge-worker后仍有“拟名待定”，而round9已定名）。新体系需要明确实际消费者何时接入，并避免将占位协议当能力交付。 | `C6/2-prototype/behavior.md:18-19,54-58`；`C6/1-interview/rounds.jsonl:17`；`C6/3-contract/contract.md:51-54,128-131` |

### 六例对“大任务Spec + 多任务 + 独立验收”的可支持结论

1. **组合本身有先例，不应重建已有能力。** C4已经交付总体验收伞、任务依赖图、scope/backlog区别和图核验脚本；C5已经把最小Issue Contract作为消费门、把成功与合法人工终点分开。可改进的是接缝，不是宣称此前只有单文档。
2. **条数不能代替拆分判据。** C2用户明确保留耦合工作一份；C4将执行拆分放图里；C5把26行为/10边界聚成7条，C3五条覆盖四种工作路径。应根据可独立验证结果、依赖、接口、上下文与风险辨别，不按“六/七条”机械裁剪或重命名规避。
3. **最大的可证偏差是有效版本与跨层映射。** C6入口仍要求已经撤销的schema工作；C4重编号遗留错AC指针；C3实施自举五AC与总体五AC不是同一组；C5已确认物仍标candidate。需要保留“用户决定→正式对照物→总体条款→子任务→证据→总体结论”的映射及修订失效，不要求把全文反复复制。
4. **独立验收不只指多派一个reviewer。** C6已明确语义检查与锚点检查不同；C5以真实轨迹和3个fresh Issue验证自动化行为、以prototype QA验证设计自身且不给产品背书。验证者、测试对象/版本、证据来源、环境、尚未执行项必须一起绑定。
5. **本地ready与预期红测不判产品成功/失败。** 六例的记录多数结束在有效交接；后续提交、自举与运行复盘说明工作确实推进，但完整追溯证据不都随案例归档。总体收口需要另外消费这些证据，不能把新任务包的完成等同未来产品完成。
6. **后续工作发现与权限边界不可省略。** C4 backlog有意不做；C5 DISCOVERED_WORK分类、失效、人工态和恢复已明确；C6把merge-worker/human lane留后续。遗漏边会假frontier，越界补做又会违背用户范围，二者都不能靠“Goal坚持更久”解决。

双向反思：支持“总Spec+多任务”最强证据是C4已经用它组织跨模块变更且后续运行能消化frontier；反对“这样就足够”的最强证据是同一条历史链仍出现摘要/契约/运行三处漂移、编号错位和验收层级不对应。当前语料支持加强组合接缝与证据对账，不支持替用户先选“只交任务包”或“包办实际执行收口”，也不支持任何精确成功概率。

## 实际阅读清单与未读部分

- **全文**：表首列出的六例全部 manifest/context/rounds/contract/verify（30份）；六例正式 `2-prototype/behavior.md`；C4 `1-interview/facts/issue-tracker.md`；C5 `1-interview/facts/session-runtime-failures.md`、`2-prototype/design-qa.md`；C6 `2-prototype/api-mock.md`。
- **全文的后续关联产物**：`docs/research/对标mattpocock仓库差距-2026-08-24.md`；`skills/workflow/aes-gate/references/bootstrap-report.md`。
- **定向节选，不冒称全文审计**：`docs/retrospectives/aes-worktree-board-multi-agent-orchestration-retrospective-2026-08-24.md` 的目标/事实层级/事故/merge样本/结论；`docs/research/aes-worktree-board-星图与Issue关系数据面-2026-08-29.md` 的机制索引与跨层对账段；`skills/workflow/aes-worktree-board/scripts/check-issue-graph.mjs:24-71` 的任务/依赖定义。
- **Git只读核对**：命中生成式发布、aes-gate、worker #83与相关board演进的 `git log --all`；`git show --stat 96e28d3/451e9aa/1126794`。只核对提交存在、时间和文件范围，不把commit subject自述当测试证据。
- **已列清单但未逐份打开**：各例其余事实分片、历史prototype drafts、绝大部分HTML/diagram、design canvas、PNG截图。本轮不评价这些图像的视觉正确性；C5的视觉结论只按明确绑定的历史QA记录报告。
- 各例目录未找到独立正式spec/plan/ticket文件，C4拆票内容在正式behavior内；外部Issue正文没有本轮读取。未读的远端内容不被推断为缺失或失败。

## 未知项

- C3 #42是否还有经过用户批准的范围重订、其他实施票覆盖总体剩余条款；本地自举不能回答。它改变的是“映射缺失”与“真实漏项”的结论强度。
- 六例所有最终AC证据是否另存于runtime、其他checkout、Issue评论或会话；本轮仅沿已发现文件/提交指针有限追溯，未重建完整外部归档。
- C2真模型eval的最终receipt、C1/C4人工视觉终验、C5三fresh真实运行最终receipt、C6语义逐行终验并未在所读案例归档中找到。本轮写未重建，不写从未发生。
- C4任务图中哪些子票按独立验收交付、哪些实际上集中合并后才全绿，需绑定各票当时合同与执行证据才能确定，不能凭按层拆分的标题判它成败。

## 没查的

- 不读远端Issue/评论、不发布tracker、不执行任何历史Verify/selftest/eval/真实模型、不启动/停止服务或Agent。
- 不用当前validator给历史语法打分，不把历史Ready、closed、COMMITTED、prototype PASS等同完整产品PASS。
- 不重写历史决策，不替用户决定本次工作流终点、拆分绝对规则或新技能落点；这些由暂停后的主访谈在全语料综合后继续。
