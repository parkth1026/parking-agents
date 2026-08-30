# Goal Contract: parking-skill-creator 以可复现证据和可证伪质量门持续产出好用技能

- Status: Ready
- Target: `skills/workflow/parking-skill-creator/`、`skills/life/shopping-deep-research/`
- Updated: 2026-08-30

## 原始请求

> [https://github.com/parkth1026/parking-agents/issues/160](https://github.com/parkth1026/parking-agents/issues/160) 帮我看下这个 issue 病看下怎么解决比较好。 到底在哪个层面进行修改 可以 [$parking-skills:grill-with-docs](G:\GIT\AI_WorkFlow\parking-agents-manual\skills\matt-skills\engineering\grill-with-docs\SKILL.md) 走流程 并 [$parking-skills:steelman-analysis](G:\GIT\AI_WorkFlow\parking-agents-manual\skills\workflow\steelman-analysis\SKILL.md) 问出最关键的问题。

> 再 eval 阶段 尽量使用 fixture 来把历史搜索内容 进行 锁定并回放。 而不是真的去 触发 高并发的 websearch 是否是更好的行业最佳实践？
>
> 还有就是你真的要反思的点 是 这个技能是 使用parking-skill-creator 跟 当前项目中 写出来的。
>
> 所以 [$parking-skills:writing-for-agents](G:\GIT\AI_WorkFlow\parking-agents-manual\skills\matt-skills\productivity\writing-for-agents\SKILL.md) 角度 我们应该 真正完善的哪些环节 不仅仅只是解决 眼前的问题 。

> 基于上面的调研 [$parking-skills:workflow-interview-web](G:\GIT\AI_WorkFlow\parking-agents-manual\skills\workflow\workflow-interview-web\SKILL.md) 我们来进行 采访并最终获得改进goal contract

> 好的 请继续 ， 然后再用 [$parking-skills:steelman-analysis](G:\GIT\AI_WorkFlow\parking-agents-manual\skills\workflow\steelman-analysis\SKILL.md) 反思一下 我们 parking-skill-creator 跟 writing-for-agents 两个技能设计思路原则上 有什么 可以参考的地方 ， 我期望 parking-skill-creator 是一个比较好用持续产出好用 技能的 能力 。

> 有个点 可能需要修正一下 parking-skill-creator 是独立的。 不能依赖 writing-for-agents 而且 要尽量确保 parking-skill-creator 上下文不要过长。

## 目标

parking-skill-creator 能用固定、可审计且跨 gate 一致的外部证据评测技能，并把 Agent 文档设计判断转成可证伪的质量假设和诚实的质量结论，最终由 shopping-deep-research 的 replay 与受控 live 双阶段 pilot 证明整条生产线可用。

## Why

- Issue #160 暴露出文字上的 fixture-first 不能机械阻止子 Agent 高并发真实搜索；配额、输入公平性和跨轮可复现性都没有可信边界。
- Creator 当前 181 项机械自测可以全绿，但最近一次输出评测 with_skill 与 without_skill 都是 100%，with_skill 反而显著更慢、更耗 token；机械正确和绝对高分不能证明生产线有增益。
- `ue-log-analysis` 的历史记录证明：脚本已经算出结果，Agent 仍可能因完成判据和报告结构不清而不把结果带进最终产物；本轮从 writing-for-agents 得到的 pointer、信息层级、co-location、完成判据和 pruning 只作为设计证据，交付后的 Creator 必须把最小机制收敛在自身本地 guide 中，不能产生跨 skill 依赖。
- replay 能证明固定输入下的分析与遵循技能，live 才能证明真实 query 规划、工具链和新鲜度；两者互补，不能互相冒充。

## 范围

做：

- 为 Creator 增加通用外部证据契约、record/replay/live provider seam、按 gate 物化、摘要校验、脱敏、调用审计和 host isolation adapter。
- 扩展 eval、output-evals、benchmark、history 与 viewer schema，使 evidence/harness epoch、调用边界和声明范围可追溯。
- 让 Creator 在创建或改进 skill 时只按需读取自身 `references/writing-guide.md`，把命中的文档风险写成质量假设、断言、定向 gate 与稳定性策略；Creator 单包在未安装任何 writing skill 的宿主仍全链可用。
- 增加独立 quality verdict，区分 run 的 PASS/FAIL 与 `SUPPORTED | INCONCLUSIVE | REGRESSED | BLOCKED`。
- 以 shopping-deep-research 的现有四个 output eval 为首个 pilot：先用脱敏历史证据完成 official replay，再在外部搜索配额恢复后完成受控 live acceptance。
- 为上述行为增加 Node 内置模块、零外部依赖的确定性回归矩阵和静态 viewer 回归。

不做：

- 不把 fixture-first 写进 shopping-deep-research 的生产流程，不降低真实购买调研对当前在售、价格、来源日期和新鲜度的要求。
- 不在首版批量迁移其他联网研究技能；shopping pilot 证明契约后再另行决定。
- 不把大 payload、凭据、cookie、完整请求头、本机绝对路径或无关历史 query 打进 `.skill` 分发包。
- 不让 record 评分技能，不把 replay 分数与 live 结果直接相减，不把旧 unmanaged/unassessed 历史回写成新事实。
- 不读取、调用或要求安装 writing-for-agents；它只保留为本轮调研来源。不新增第二个 writing reference/pointer，不把模型相关的写作原则机械打分成质量 PASS。
- 不在本合同中新增定时 CI、月度调度器或批量 live canary 基建。

## 强约束

- `2-prototype/` 下的确认版 `behavior.md`、`api-mock.md`、`example-run.md`、`mock.html`、`diagram.html` 不得修改；执行 Agent 改产品，不改对照物。
- 用户任务 `prompt` 与 harness 私有信息必须分离；fixture、grader 提示、答案和 evidence 控制信息不得混入用户题面。
- evidence mode 闭集为 `replay | record | live | unmanaged`。legacy eval 无 evidence 时只标 `unmanaged`，不得宣称 zero-live、固定输入或跨机可复现。
- official replay 必须由 host 机械禁用、代理或审计真实外部工具；能力不足时为 `BLOCKED_NETWORK_ISOLATION_UNAVAILABLE`，exploratory 结果不得进入主 benchmark 或 current_best。
- replay 不允许 fallback live。预检缺 pack/host isolation 是 `BLOCKED`；运行中的 query miss、摘要不匹配是 `FAIL`；两类终态都必须保持 `live_calls=0`。
- 同一 eval 的全部 gate/run 必须使用逐字相同的 evidence digest；任何不一致使整组不可比较，不产 delta。
- record/live 只能显式授权，逐 eval `concurrency=1`，并使用每题声明的 `max_calls` 与 freshness policy；未声明 freshness 时只允许人工触发，不猜全局天数。
- record 只建立 evidence epoch，不产 pass_rate。采集不完整、预算耗尽、脱敏失败或摘要失败时不得晋级 epoch、不得覆盖旧 epoch。
- 仓库只跟踪每题最小脱敏 evidence pack；`.skill` 只保留 manifest/digest 声明并排除 payload。
- evidence、harness、题库或质量假设发生实质变化时开启新比较纪元；跨纪元标 `incomparable`，不得制造 won/lost，也不得用旧 current_best 压新纪元。
- Creator 必须独立安装、打包和运行：package、SKILL pointer、脚本 import、eval 前置不得读取、调用或要求安装 writing-for-agents 或其他外部 skill。运行时唯一 writing 参考是 Creator 自己已有的 `references/writing-guide.md`。
- 不新增第二个 writing reference 或第二条常驻 pointer。经案例验证的最小机制先对本地 guide 做 pruning 再容纳；未命中的 writing lever 记录 `not_applicable` 理由，不为过门造 finding。
- 上下文双零增长：`SKILL.md` 同时不得超过 31,415 UTF-8 bytes 和 312 行；创建/改写分支的 `SKILL.md + references/writing-guide.md` 同时不得超过 40,364 bytes 和 475 行。任一维度超限即失败，基线不得在实现后重算放宽。
- 有方差的 Agent 行为默认每 gate 3 runs，确定性 script 断言为 1 run；eval 可显式改写，但样本不足时只能得 `INCONCLUSIVE`。
- run 的 PASS/FAIL 与 quality verdict 分离。结构校验全绿、绝对 pass_rate 高或单次 with_skill 通过，都不足以单独产生 `SUPPORTED`。
- quality verdict 必须同时考虑相关 comparator、假设/断言覆盖、足量 runs、evidence/harness 可比性和已声明的成本预算；本合同不发明全局 token/time 比例门槛。
- viewer Benchmark 首屏同时展示 Evidence gate 与 Quality claim，包括 reasons 和 forbidden claims；信息结构以确认版 mock 为准，不锁像素。
- shopping-deep-research 的生产 SKILL.md 保持真实联网与当前新鲜度语义；eval fixture 只属于 harness 数据面。
- 新增仓库脚本只使用 Node 内置模块，不引入 npm、Python、PowerShell 或 cmd 运行时依赖。
- 本仓技能开发只在用户指定目录进行；不自行切换或新建 worktree，不修改无关的 Issue #147 工作区。

## 自主边界

不用问，直接定：

- 通用 provider、host adapter、manifest 校验和物化代码的内部文件拆分、函数名与私有数据结构，只要保持确认版 schema 和终态语义。
- fake provider/fake host fixture 的具体目录和样例内容，只要零真实联网、能覆盖 AC-001 至 AC-003 的全部矩阵且不含秘密。
- run-tests 中测试分组、辅助函数和 stdout 措辞；但必须保留 AC Verify 使用的五个具名分组标记。
- 在不改变现有本地 `references/writing-guide.md` 路由且不超过双预算的前提下，决定删哪些 no-op、重复、陈旧缓存内容，以及如何压缩质量假设方法。
- Viewer 的 DOM、CSS、响应式细节和折叠交互，只要首屏信息层级、状态和声明边界与确认版 mock 一致。
- shopping 历史证据的裁剪、去重和脱敏实现，只要来源/摘要可审计，四个 eval 的必要证据没有被改写成答案。

必须停下来问：

- 改 evidence mode、quality verdict、FAIL/BLOCKED 或 epoch 的闭集与语义。
- 把 payload 放进 `.skill`、引入远端 evidence artifact 服务、增加新运行时依赖或改变仓库零依赖约定。
- 改 shopping-deep-research 的生产搜索行为，或把 fixture 用作真实用户调研的默认数据源。
- 批量迁移其他技能、修改其他技能的历史成绩、删除旧 epoch 或重写 legacy 记录。
- 新增任何全局 token/time 质量门槛，或改变默认 3 runs/确定性 1 run 的数字。
- 新增第二个 writing reference/pointer、任何外部 skill 依赖，或改变/重算放宽 31,415 bytes/312 行与 40,364 bytes/475 行预算。
- 在 2026-09-10 前消耗新的真实搜索额度，或把 AC-006 的 `concurrency=1`、每 eval `max_calls=16` 改成别的数字。

## 读什么

- `../2-prototype/behavior.md`：确认版行为、边界、兼容与 quality verdict。
- `../2-prototype/api-mock.md`：确认版 eval/evidence/quality schema、错误和审计报文。
- `../2-prototype/example-run.md`：replay、record、live、质量假设与 INCONCLUSIVE 的确认版运行形态。
- `../2-prototype/mock.html`：Evidence gate 与 Quality claim 的确认版信息结构。
- `../2-prototype/diagram.html`：Creator 本地 writing guide、evidence plane、gate 与 history 的确认版依赖方向，以及外部 skill 零依赖边界。
- `../2-prototype/evidence-audit.md`：仓库历史评测的 steelman 证据与三层修改裁决。
- `skills/workflow/parking-skill-creator/references/design.md`、`references/schemas.md`、`references/gate-rules.md`：Creator 当前设计、持久 schema 与门禁边界。
- `skills/workflow/parking-skill-creator/references/writing-guide.md`：Creator 当前唯一的本地 writing 参考；实现须在双零增长预算内 pruning 与补强。
- `skills/life/shopping-deep-research/output-evals.json` 与 `history.json`：pilot 的持久题面和历史成绩。
- `https://github.com/parkth1026/parking-agents/issues/160`：原始 issue 与外部讨论。

## 要落盘的东西

- D-01: `skills/life/shopping-deep-research/eval-fixtures/*/epoch-*/evidence-pack.json` 与同级 `payloads/`：四个现有 output eval 各自一个最小、脱敏、内容寻址的历史 evidence pack；不得包含凭据、本机会话或无关历史搜索。
- D-02: `skills/life/shopping-deep-research/output-evals.json`：四个 pilot eval 的 evidence manifest/digest、freshness policy 与质量假设；用户 prompt 保持原话。
- D-03: `skills/life/shopping-deep-research/history.json`：append-only 保存 replay evidence audit、quality verdict，以及 2026-09-10 后的 live acceptance 状态；旧记录不回改。

## 验收条件

- AC-001: opt-in 外部证据 eval 的用户 prompt 与 harness 控制严格分离；manifest/payload 摘要可验证；每个 gate 自己的 `inputs/` 获得相同 evidence digest；evidence 声明进入 output-evals，payload 不进入 `.skill`。
  - Verify: [A] `node -e "const {spawnSync}=require('node:child_process');const r=spawnSync(process.execPath,['skills/workflow/parking-skill-creator/run-tests.mjs'],{encoding:'utf8'});const o=(r.stdout||'')+(r.stderr||'');process.stdout.write(o);process.exit(r.status===0&&o.includes('外部证据·契约与物化：')?0:1)"` → 退出码 0，具名分组覆盖 prompt/evidence 分离、摘要、同 digest 物化、持久化和 package 排除矩阵
- AC-002: official replay 对缺 payload、无 host isolation、query miss、摘要错和跨 gate digest 错全部失败关闭；终态严格按确认版区分 BLOCKED/FAIL，`live_calls=0`，且不产生可误读的主 benchmark/current_best。
  - Verify: [A] `node -e "const {spawnSync}=require('node:child_process');const r=spawnSync(process.execPath,['skills/workflow/parking-skill-creator/run-tests.mjs'],{encoding:'utf8'});const o=(r.stdout||'')+(r.stderr||'');process.stdout.write(o);process.exit(r.status===0&&o.includes('外部证据·replay 失败关闭：')?0:1)"` → 退出码 0，fake host 负例全矩阵逐例断言 code/status/live_calls 和无主成绩
- AC-003: record/live 只有显式授权、`concurrency=1` 且预算与 freshness policy 完整时才能访问 provider；调用全部审计；缺授权、并发越界、预算耗尽、部分采集、脱敏失败和摘要失败都不晋级/覆盖 epoch；record 不评分技能。
  - Verify: [A] `node -e "const {spawnSync}=require('node:child_process');const r=spawnSync(process.execPath,['skills/workflow/parking-skill-creator/run-tests.mjs'],{encoding:'utf8'});const o=(r.stdout||'')+(r.stderr||'');process.stdout.write(o);process.exit(r.status===0&&o.includes('外部证据·record/live 生命周期：')?0:1)"` → 退出码 0，fake provider 生命周期矩阵覆盖授权、串行、预算、脱敏、部分包、同/新 digest 和 record 无 pass_rate
- AC-004: Creator 独立单包在未安装 writing-for-agents 的宿主仍能创建、校验、评测、打开 viewer 和打包；创建或改进 Agent skill 时只读本地 writing guide，把 finding 绑定为 `risk → expected_behavior → AC/assertion → gates` 的质量假设；未命中项不凑数；有方差行为默认每 gate 3 runs、确定性断言 1 run，样本不足为 INCONCLUSIVE；主文件与创建分支同时满足双零增长预算。
  - Verify: [A] `node -e "const {spawnSync}=require('node:child_process');const r=spawnSync(process.execPath,['skills/workflow/parking-skill-creator/run-tests.mjs'],{encoding:'utf8'});const o=(r.stdout||'')+(r.stderr||'');process.stdout.write(o);process.exit(r.status===0&&o.includes('Agent 文档质量假设与上下文预算：')?0:1)"` → 退出码 0，覆盖独立包零外部 skill 依赖、hypothesis 完整性、not_applicable、不绑定 finding 拒绝、定向 gate、3/1 runs，以及 31,415/312 与 40,364/475 双预算
- AC-005: benchmark/history/viewer 对同一比较纪元产出并首屏展示 Evidence gate 与 `SUPPORTED | INCONCLUSIVE | REGRESSED | BLOCKED` Quality claim；全平、样本不足、关键回归、成本越界和前置阻塞各有诚实理由/禁止声明，不能仅因高 pass_rate 推进 current_best；legacy 显示 unmanaged/unassessed。
  - Verify: [A] `node -e "const {spawnSync}=require('node:child_process');const r=spawnSync(process.execPath,['skills/workflow/parking-skill-creator/run-tests.mjs'],{encoding:'utf8'});const o=(r.stdout||'')+(r.stderr||'');process.stdout.write(o);process.exit(r.status===0&&o.includes('质量 verdict 与 viewer：')?0:1)"` → 退出码 0，fixture 覆盖四终态、成本、跨 epoch、current_best 与静态 HTML 的 Evidence/Quality/reasons/forbidden claims
- AC-006: shopping-deep-research 四个现有 output eval 完成双阶段真实 pilot：D-01 历史 pack 下 official replay 各 gate digest 一致、misses=0、live_calls=0、isolation=verified；2026-09-10 配额恢复后逐 eval `concurrency=1`、`max_calls=16` 完成 live query 规划、真实工具链、来源可达性和 freshness 验收；record 完整时才晋级新 epoch，live 不与 replay 分数直接比较，生产 skill 仍使用实时搜索。
  - Verify: [C] 先对四个 D-01 pack 运行确认版 example-run 的 preflight/materialize/replay 并在静态 viewer 核对 digest/zero-live/quality claim；外部配额恢复且用户显式授权后，再逐 eval 运行 live acceptance，观察每题调用数不超过 16、无并发、query/tool/source/freshness 全部 PASS，D-03 追加 live 审计且生产路径未读取 `eval-fixtures/`

## 挡着的事

- 初始 blocker 已解除：用户明确要求提前执行真实 live acceptance；2026-08-30 已按每 eval `concurrency=1`、`max_calls=16` 逐题运行四个 eval，`query_plan/tool_path/source_reachability/freshness` 全部通过，且由 `aggregate-benchmark.mjs --pilot-audit` 将 `live-acceptance` PASS 收据追加到 D-03。旧 replay 收据未回改，live 与 replay 保持 `incomparable`。

## 访谈记录

### 第 1 轮：需求与范围

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| Q1 修改层面 | A Creator 通用外部证据契约 60% / B 只改 shopping 25% / C 只改 prompt 15% | A，病根在评测控制面 | A |
| Q2 replay miss | A 失败关闭、独立 record/live 65% / B 自动 fallback live 30% / C 只提示 5% | A，才能机械证明 zero-live | A |
| Q3 证据持久化 | A 仓库跟踪每题最小 pack、分发只带 manifest 55% / B payload 外部 artifact 35% / C ignored 全局原始库 10% | A，兼顾 clone 复现与包体积 | A |
| Q4 首份交付 | Creator contract/provider/audit/shopping pilot/live acceptance 五项；另有 mass migration | 前五项，不批量迁移 | 前五项 |
| Q5 live 纪律 | A 人工/过期触发、逐 eval 串行有上限 55% / B 月度窗口 30% / C 每轮 live 5% / D 不做 live 10% | A | A |

### 第 2 轮：确认版原型

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| P1 Evidence 可见性 | A Benchmark 首屏卡 55% / B 首屏摘要+折叠 30% / C 只进 JSON 15% | A | A |
| P2 FAIL/BLOCKED | A 前置不可用 BLOCKED、运行契约违反 FAIL 65% / B 全 FAIL 20% / C 全 BLOCKED 15% | A | A |
| P3 host 无法隔离 | A official replay BLOCKED 65% / B UNVERIFIED 仍计分 25% / C 只写提示 10% | A | A |
| P4 freshness | A 每 eval/entry 声明 60% / B 全局 30 天 25% / C 只人工 15% | A | A |

| 定了什么 | 档 | 为什么这么定 | 用户 |
| --- | --- | --- | --- |
| evidence pack 物化到每个 gate 自己的 inputs/ | 默认 | 修复 sandbox 与全局库冲突 | 未反对 |
| record 建 epoch、不评分；replay/live 各自证明不同声明 | 默认 | 避免采集质量和技能能力混分 | 未反对 |
| legacy unmanaged 开新纪元，不与旧分数直接比较 | 确认 | 不伪造历史连续性 | 确认 |
| v1 行为、报文、示例、mock、架构作为确认版基础 | 确认 | 逐处可质疑后零修改通过 | 确认 |

### Steelman 回合：Creator 与 writing-for-agents

用户要求不凭主观回忆，而由 Agent 查仓库完整测试记录自行裁决。证据显示：Creator 自身机械门全绿但输出 eval 无区分度；UE 日志又存在明确的“脚本产出→报告传导”文档失败。初版原型据此把 writing-for-agents 设为条件性必读共享真源；用户随后纠正：Creator 必须独立，不能依赖另一个 skill。最终方案改为：外部 skill 只作为本轮设计证据，最小有效机制经 pruning 进入 Creator 已有本地 writing guide；静态审查只产 finding，最终由假设驱动的行为 eval 裁决。

### 独立性与上下文修正轮

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| Creator 依赖边界 | 独立安装/打包/运行，不读取或要求安装 writing-for-agents | 用户直接纠正 | 确认 |
| 本地写作资源 | 复用现有 writing-guide，不新增第二 reference/pointer | 默认，减少认知与上下文负担 | 接受 |
| 上下文预算 | A 主文件与分支双零增长 60% / B 只锁主文件 30% / C 维持 <500 行软约束 10% | A，防止搬进 reference 绕过预算 | A |

### 第 3 轮：验收深度

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| AC-001 公平输入 | A 确定性契约矩阵 65% / B shopping 黄金包 25% / C 手工三 gate 10% | A | A |
| AC-002 replay 失败关闭 | A 负例全矩阵+fake host 75% / B 只测 miss/摘要 20% / C 人工监控 5% | A | A |
| AC-003 record/live 生命周期 | A fake provider 矩阵 65% / B 真实 record 黄金用例 25% / C 只跑成功 live 10% | A | A |
| AC-004 stability runs | A 行为默认 3、确定性 1 60% / B 全部 2 25% / C 每题自报 15% | A | A |
| AC-005 verdict/viewer | A 四终态聚合+静态 viewer 70% / B 只锁 JSON 20% / C 全手工 10% | A | A |
| AC-006 配额 blocker | A 同合同两阶段、终态先 Blocked 60% / B live 另开 follow-up 30% / C 只等 live 10% | A | A |

| 定了什么 | 档 | 为什么这么定 | 用户 |
| --- | --- | --- | --- |
| 6 条 AC；架构依赖进强约束，不为流程图重复立 AC | 默认 | 避免同一行为判两次 | 接受 |

## 设计取舍

### D-1 replay miss 是否允许自动联网

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A（选定）失败关闭 | replay 只读固定 pack，miss 终止；另开 record/live | 需要先补齐 fixture，当前 run 会中断 | 无 |
| B 自动 fallback live | miss 时按预算真搜并追加新 epoch | 同一轮输入漂移，无法证明 zero-live | 破坏公平与可复现目标 |
| C 只写 fixture-first | 靠 prompt 提醒 Agent | 改动最少但不能机械阻止联网 | 正是 Issue #160 的病根 |

选定 A。落进契约的形态：`强约束` 写“replay 不允许 fallback live，miss 保持 live_calls=0”。

### D-2 外部写作原则如何进入独立 Creator

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 全文复制并硬 lint | Creator 内置外部 skill 的全部原则并逐条打分 | context 膨胀、模型相关判断被伪机械化 | 违反上下文目标 |
| B 跨 skill 条件读取 | 运行时把 writing-for-agents 当共享真源 | 内容不复制，但破坏独立安装与打包 | 用户明确否决依赖方向 |
| C（选定）本地最小内核+假设驱动 | 只用 Creator 现有 writing-guide；pruning 后加入经案例验证的最小机制，finding 绑定行为假设、断言、gate 和 runs | Creator 独立维护本地规则，新增内容必须以删除抵消 | 无 |

选定 C。落进契约的形态：`强约束` 写“零外部 skill 依赖、只用已有本地 guide、静态审查不产生质量 PASS”。

### D-3 为什么把 run 判罚与 quality verdict 分开

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 继续只看 pass_rate | run 通过即视为 skill 好用 | 简单但全平、高分负增益都被掩盖 | Creator、workflow-interview-web、karpathy 历史都给出反例 |
| B（选定）双层终态 | run 表达本次断言；quality verdict 表达相对价值与证据充分性 | schema/viewer 多一层状态 | 无 |
| C 只做人工总评 | 人看完整输出后给结论 | 难复现、不能进入 current_best 机械门 | 无法持续生产 |

选定 B。落进契约的形态：AC-005 锁四种 quality verdict 与禁止声明。

### D-4 真实 live 验收是否拆成后续任务

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A（选定）同合同两阶段 | 先实现/replay，配额恢复后 live；全过才完成 | 合同暂时 Blocked | 无 |
| B live 另开 follow-up | 当前合同 replay 即完成 | 交付早，但会翻掉已确认范围且可能遗忘 live | 不保留 replay/live 双证明 |
| C 只做 live | 等配额恢复后真搜 | 无可复现回归，继续烧配额 | 没解决 Issue #160 |

选定 A。落进契约的形态：Status=Blocked；挡着的事写精确解除条件，同时允许先完成其余工作。

### D-5 Creator 上下文预算

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A（选定）主文件与创建分支双零增长 | 锁 `SKILL.md` 31,415 bytes/312 行；锁 `SKILL.md + writing-guide.md` 40,364 bytes/475 行；任一超限失败 | 新增机制前必须 pruning；bytes/lines 只是 token 代理 | 无 |
| B 只锁主文件 | 主 SKILL 零增长，本地 guide 不设硬上限 | 常驻成本稳定，但实际创建分支可持续膨胀 | 可用搬文件绕过用户目标 |
| C 维持 <500 行软约束 | 沿用现有渐进披露规则 | 灵活，但当前 312 行可增长约 60% 仍合规 | 无法证明本轮没有增加上下文负担 |

选定 A。理由：模型 token 依 tokenizer 漂移，UTF-8 bytes 与行数是当前零依赖、可重复的稳定代理；双预算同时锁住常驻成本和真正执行创建/改写时加载的分支成本。落进契约的形态：AC-004 自动断言独立性与两组 hard max。
