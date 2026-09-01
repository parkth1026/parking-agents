# grilling 全语料 20 案例复检——Goal Contract 结论修订

- 日期：2026-08-31
- 范围：`parking-agents-manual/.aes-workflow/grilling/` 全部 20 个案例（15 份已定稿契约、5 份在途/搁浅），加上此前深研的 aes-agent-manual 实例共 21 例。
- 方法：机械脚本复检（Verify 行档位解析、锚对账、mtime/时间戳、target 字段、冒烟红绿统计）+ git 考古（mtime 污染甄别、post-done 变更定性）+ 靶向深读（像素口径、残留风险对账、生命周期时间线）。
- 关系：本文是对 [2026-08-31-goal-contract-完整完成可能性-实锤审计.md](2026-08-31-goal-contract-完整完成可能性-实锤审计.md) 的**语料级修订**；姊妹篇 [deep-analysis](2026-08-31-workflow-interview-goal-contract-deep-analysis.md) 的部分发现一并复核。
- 联动：在途案例 `2026-08-31-large-task-spec-ticket-delivery` 的 next_action 记录"用户要求先覆盖 grilling 全部 19 个历史案例、完成跨案例证据与双向 Steelman 再收敛目标"——本文即该证据面，其结论将被该工作流消费。

## 1. 语料全景

15/20 走完三阶段并 finalize（valid、AC 5-7 条/份、AC 总计 92 条）；5 例在途：bpr-skill-improve 与 issue70 停在 2-prototype 前，issue-147-steelman-rerun（aes-agent 案例的上游，工作搬去产品仓后搁置）、aes-merge-worker（1+2 done 待契约）、large-task-spec（1-interview 进行中）。档位分布合计约 A63/B4/C22/D7——[A] 占比 68%，但 C 档 22 条遍布 10 份契约，非 [A] 验收面是常态而非例外。**在途案例零状态污染**：未 finalize 就没有 stale-ready 问题，搁浅无害。

## 2. 机械复检结果（21 例汇总）

| 检查 | 结果 | 判定 |
| --- | --- | --- |
| 首档遮蔽（C7） | 3 份契约 4 条 AC：aes-agent M1a AC-001/004、skill-creator AC-002（首 D 藏 [A] grep）、**aes-gate AC-001（首 C 藏 [A] self-test，被遮的恰是正反样例自测、留下的首档反而是人工实操）**；4 条内嵌 [A] 全部未跑冒烟 | **系统性实锤加重**（3/16 份契约） |
| 锚分叉（C10） | 15 份中 14 份 goal_oneline ≠ 契约目标节首句、1 份空置；抽样校准：多为转述级、worktree-board 一例框架级（机制描述 vs 用户结果）、语义级漂移目前仅 aes-agent 一例 | 结构性双源维护成立，风险已实现一次 |
| 强约束命令（C4） | 可执行检查普遍不进冒烟：worktree-board 的 `git diff --quiet`、session-evolution 的像素规格源锁定条款等；粗计数受提取噪音影响，定性成立 | 实锤 |
| target 字段（C6） | **14/15 空置——机制形同虚设**；但跨仓执行以硬编码形式普遍存在：8 份契约含 `G:\GIT` 绝对路径、4 条在 Verify 行（如 skill-creator 的 Verify 直指 parking-agents 仓的部署技能路径） | 结论改形，见 §4 |
| 冒烟红绿 | 红 60+ / 崩 0——**UNRUNNABLE 拦截全语料零漏**；绿色两类：finalize 期少量 PASS（回归型契约部分 AC 已成立，合理）与实现后复验（outbox 4 绿、issue-160 10 绿，覆盖了原红态记录） | 闸门有效性证实 + 新发现 verify.txt 语义漂移 |
| rounds.jsonl | 20/20 全有（此前 glob 告警为假报），访谈追溯链完整 | 无问题 |

## 3. 深读发现

### 3.1 像素口径的双模式——P0-1 被语料强化并获得正向范本

- **默认模式**：≥4 份契约（worktree-board、session-evolution 前身、workflow-interview-web、skill-creator、aes-gate 报告）写"mock 定结构/信息层级，**不锁像素**"，rounds 里为 tier=default、"aes-prototype 惯例"、未反对；全语料 ask 档涉及像素仅 2 次。
- **正向范本**：session-evolution（08-25）显式做了像素级——用户提供 `docs/uiux/design_handoff_issue_starmap/` 高保真稿作为**像素规格源**，强约束写"不可修改。执行 Agent 改的是产品，不是尺子"；视觉基准整体替换时在访谈记录里留了 overturned（推翻第 2 轮裁决）。
- **修订结论**：aes-agent 案例的视觉盲区**不是方法的能力边界，是口径问题没有必问触发器 + 当时没有锁定尺子**。正范本已存在，P0-1 的落法可直接固化 session-evolution 的三件套（外部规格源/不可修改条款/替换即记录 overturned）。

### 3.2 残留风险对账的活例——确认偏差有"记录级自觉"

diagram-artifact 是全语料唯一 residual_risk=Y 案例：manifest.rr"对照物以整体放行确认（请继续），视觉细节未逐条点名" ↔ 契约残留风险节两条（整体放行、AC 后果句整体确认）**对账成功**。体系对"扫过的确认"有自察并落注成赌注——但没有闸门把整体放行拦下来逐条问。③号偏差从"完全无防线"修正为"有记录、无拦截"。

### 3.3 生命周期缺口第二击——happy-path 也在模糊 validation 语义

两例 git 实锤的 done 后契约变更：

- **outbox-close**：done 18:22 → 契约"评审后收紧验收分辨率" 18:26（**done 后 4 分钟，无闸门拦**）→ 实现 18:43 → 重跑 finalize 19:19（4 绿）。人工补跑兜住了，但 done→收紧→重finalize 的顺序违规说明闸门时序只存在于 `stage done` 一瞬。
- **issue-160**：done 20:54 → 实现提交 23:26 一并改了契约，validation 仍停在 12:54Z，**无补跑**。

另有：08-24 19:05 八份契约 mtime 同毫秒批量偏移 = checkout 假象（无内容变更、无提交）——**mtime 不是可靠的陈旧性证据，git 才是**；13/15 的 mtime 偏移大多是这类污染，真实 post-done 内容修改率以 git 计 ≥2/15。新缺口定型：**validation/verify.txt 同一字段承载两种语义**（finalize 期"期望全红"的冒烟 vs 实现后"期望全绿"的完成证据），后者在盘上覆盖前者，红态证据只活在 git 史；manifest 无阶段标记区分。

### 3.4 姊妹篇发现的语料级复核

- F3 混写 Verify：语料 +2 例（§2 首行）——**加重成立**。
- F5 状态脱节：happy-path 也发生（§3.3）——**加重成立**。
- F4 小句级覆盖缺口：本语料未做逐条追溯复核（工作量原因），aes-agent 案例的证据不变，语料不推翻。
- F8 shape-validator 漂移：语料侧证——7 份契约 AC=7 条（shape 说"六条以上拆"，validator 允许 7），实践中确实没拆。

## 4. 结论修订表（对照实锤审计版）

| 原结论 | 语料判定 | 修订后表述 |
| --- | --- | --- |
| P0-3 家族终态缺失 | 15/15 单契约 | **降为条件性 P0**：只在多里程碑大案例（aes-agent、未来的 large-task-spec）启用；小任务无需 |
| C6 跨仓闸门（查 target 与契约仓关系） | target 14/15 空置，跨仓以绝对路径常态存在 | **改形**：target 必填校验 + Verify/读什么 中的跨仓绝对路径检查（现在 4 条 Verify 硬编码 `G:\GIT`，机器可查而未查） |
| C10 锚分叉"已发生" | 14/15 文本分叉但多为转述级 | 普遍的是双源维护；语义级漂移一例 + 框架级一例。P2-10 的对账建议维持 |
| C2 状态偏差（needs_reinterview 不清状态） | 本语料无 needs_reinterview 案例 | 个案发现维持；但生命周期变体（done 后变更无闸门、validation 语义漂移）在 happy-path 普遍存在，**并入 P0-2 扩展** |
| C7 首档遮蔽（2 条 AC） | 语料 +2 例共 4 条 | 维持 P2-7，优先级上调（可并入 P0 批次，纯工具修复） |
| C1 口径默认档 | 4+ 契约潜伏、1 个正向范本 | P0-1 维持且强化：落法=session-evolution 三件套 |
| C8 环境前提全无 | 部分案例手工记录（aes-gate"gh 已认证"、issue-160 blocker 解除留痕） | 修正为"无机制、靠自觉、部分有记录"；P2-8 维持 |
| 六偏差源②采样（视觉无 AC 归宿） | psc-layout 为目录布局非 UI 视觉，不构成反例 | 维持 |

## 5. 修订后路线图（增量）

- **P0-1 口径轴强制提问**：维持，落法固化 session-evolution 三件套（外部规格源 / 不可修改条款 / 基准替换记 overturned）。
- **P0-2 失效与生命周期对账（扩展）**：原三件套（Status 对账、needs_reinterview 回撤、mtime 盯全部契约）之外新增：**validation 阶段标记**（smoke vs evidence，不互相覆盖）、**done 后契约内容变更检测**（git 或内容哈希，变了就标记 stale 直到重跑）。
- **P0-3 家族终态**：条件性启用（多契约案例）。
- **P1-5 尺子落盘**：维持，语料正范本已存在。
- **P1-6（改形）**：target 必填 + 跨仓绝对路径检查，替代原"仓库关系闸门"表述。
- **P2-7 首档遮蔽**：维持，语料加重（4 条 AC），建议提进 P0 批次（一处正则+一处提取循环）。
- 其余 P1/P2 维持不变。

## 6. 总判定

语料研究**没有推翻单案例审计的任何一条核心事实，但重新校准了三条的适用范围**（家族终态降为条件性、跨仓改形、锚分叉普遍化），**加重了三条**（首档遮蔽、生命周期语义漂移、口径默认档），并**补了一个正向范本**（session-evolution 的像素级三件套）。体系在小/中任务上运转健康（UNRUNNABLE 零漏、对账机制工作过、搁浅无害）；系统性风险集中在**跨阶段边界的机器不可见处**——done 之后的契约变更、finalize 与完成证据的同字段混写、视觉口径的默认收窄——这正是 goal 模式长时程执行里"部分完成冒充完整完成"的温床，与实锤审计版的核心结论一致且更普遍。

## 7. 边界

- F4 小句级覆盖缺口未在本语料逐条复核（aes-agent 案例证据不变）。
- mtime→内容变更的换算仅做了 3 例 git 考古（outbox、issue-160、08-24 批量触碰），≥2/15 是下界不是全量。
- 执行侧产物（实现后是否有人回填完成证据到 manifest）未系统核查；仅确认 verify.txt 存在复用现象。
- 本语料 20 例全部为本仓技能开发任务；aes-agent 产品仓的大型功能开发仅 1 例，规模相关结论（家族、跨仓、revert）的外推受此限制。
