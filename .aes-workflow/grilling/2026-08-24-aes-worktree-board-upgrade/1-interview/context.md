# Context Snapshot: 2026-08-24-aes-worktree-board-upgrade

- 创建：2026-08-24T09:10:00Z
- 分片来源：facts/skill-current-state.md、facts/issue-tracker.md、facts/verification-infra.md、facts/runtime-state.md

## 任务陈述

> aes-worktree-board 这个技能之前执行的一个复盘报告在 docs/retrospectives/aes-worktree-board-multi-agent-orchestration-retrospective-2026-08-24.md 请你仔细阅读后 我们开始确定升级改造目标。

## 用户提出的方案

未提出具体方案；指定以复盘报告为升级依据。复盘自身给出了 P0/P1/P2 三档演进要求与「下一版流程合同」骨架。

## 意图假设

任务陈述是「确定升级改造目标」，真正要解决的问题（复盘一句话判断）是：**业务闭环已跑通，但控制闭环不稳**——把本轮已验证正确的编排行为（executor 闭环、独立 review、熔断、分流、autonomous merge）从「主 Agent 临时记忆 + 可覆盖快照」固化成可恢复、可验证、幂等消费的控制平面，并消除规范三处漂移（SKILL.md ↔ Issue #5 ↔ 运行时实现）。差别在于：用户要的不是「再加功能」，而是「把上次跑对的东西变成系统能力」。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| SKILL.md 仍是 v2 契约：headless dispatch.mjs 派发、「只给合并建议不执行 merge」、无 create_thread/registry/cursor/blockCount/状态机字样 | facts/skill-current-state.md | Fact |
| Issue #5 正文（26777 字符，0 评论）已固化复盘大部分协议：create_thread 正常路径、executor ownership、事件 fan-in+独立 cursor、三次 BLOCK 熔断、全局停止、listener 生命周期、模型两档、单写者锁、status.json 字段集、15 态状态机 | facts/issue-tracker.md | Fact |
| #5 的结构缺口：追加三段排在验收条件之后，且 cursor/blockCount/orchestration-stop/heartbeat 均无对应验收条目；33 条验收条件全部未勾选 | facts/issue-tracker.md | Fact |
| open 控制面缺陷：#22 dispatch API 缺跨源防护、#23 worktree 锁 TOCTOU、#25 runtime 读写非原子（torn read 抹掉 assessment）、#24 board.config 输入侧错配 | facts/issue-tracker.md | Fact |
| 「两个控制面」不存在——用户目录是 junction；真正分裂是新旧 runtime 选址并存，且新选址（跟随目标仓根）至今从未在 aes-agents-v2 落盘 | facts/runtime-state.md | Fact |
| orchestration-stop.json 是脱离代码闭环的手写账本，与 status.json 除 name 外零字段重叠 | facts/runtime-state.md | Fact |
| 复盘引用的 dev4 字段矛盾样本已被 collect 覆盖（assessment 全 null）——「snapshot 可覆盖历史」缺陷已再次实体化 | facts/runtime-state.md | Fact |
| 验证主力是 selftest 七域；fixture 域完全离线；无编排回归域；board.html 前端零自动断言 | facts/verification-infra.md | Fact |
| `npm test` 当前是红的（三条与本技能无关的失败 + check:repo 脚本缺失），不能当验收门槛 | facts/verification-infra.md | Fact |
| 发布侧 skills/ 无副本，唯一真源 `.agents/skills/aes-worktree-board/`；从未接入 parking-skill-creator 评测流水线 | facts/skill-current-state.md、facts/verification-infra.md | Fact |
| 目标仓现场：dev1/dev2 handoff-required(BLOCK×3)、dev3/dev5 parked、dev4 merged；实时 Git 事实与 03:21 快照一致 | facts/runtime-state.md | Fact |
| create_thread/wait_threads 是宿主（Codex Desktop）工具，.mjs 脚本无法调用；脚本能产品化的只有状态面（registry/inbox/校验/看板） | 复盘 4.5/4.6 + 技能架构 | Fact |
| CONTEXT.md 目前只覆盖 aes-qa 测试域术语，与本升级无直接交集 | CONTEXT.md | Fact |

## 验证基建候选池

| 途径 | 代价 |
| --- | --- |
| `selftest.mjs fixture` 域（完全离线） | 已存在，零代价；只覆盖 issue 图与 server 渲染 |
| **新增 selftest 编排回归域**（复盘 P2.3 的 10 个场景：duplicate final、漏 polls、三次 BLOCK、park 后 late event、global stop……） | 需先建：构造事件 fixture + 状态机断言，是本次升级的主要新建基建 |
| `selftest.mjs layout/dispatch/server/repo-root/windows-hide` 域 | 已存在；dispatch/repo-root 会 spawn 进程写 TEMP，耗时未测 |
| `collect` 域 | 联网（gh 对账 51world-ai-copilot/aes-agent），受线上漂移影响 |
| parking-skill-creator quick-validate / 触发评测 | 新增接入；对 CLI 型技能的输出评测无先例 |
| 真实再跑一轮编排（aes-agents-v2 现场） | 用户真实测试；受 dev1/2 handoff、dev3/5 parked 现场制约，且消耗真实 Task 额度 |
| `npm test` | **当前红灯（与本技能无关），不可用作门槛**，除非先修复（超出本技能范围） |

## 术语冲突

- **「两个控制面」**（复盘 4.11：orchestration-stop 与 board snapshot「不在同一控制面」）：实测用户目录是 junction，同一份文件；真实问题是新旧选址并存 + 手写账本脱离代码闭环。按实测口径走。
- **「Task Registry」**（复盘 P0.1） vs 现有「任务三件套」（`runtime/tasks/<id>.{json,log,prompt.txt}`，dispatch.mjs 产出）：前者是每 Task 一等记录+状态转移，后者是 headless 派发产物。升级中不可混用，registry 是新物。
- **状态机 15 态**：复盘 P0.4 的状态集合与 #5 正文的 15 phase 疑似同一套但未逐字核对，落规范时需统一成一份。

## 四分类

- **Fact**：见上表。
- **User decision**（已全部裁决，逐轮记录见 rounds.jsonl）：
  1. 升级范围 = **P0 六项 + 控制面 bug #22/#23/#24/#25**，不含 P1 实现（q1，用户追加：所有问题用 wayfinder 方式建 issue）；
  2. headless 派发能力**保留为显式授权 cli-fallback，并修 #22/#23**（q2=A）；
  3. listener 生命周期做到**脚本化 inbox + consume/resume 命令、幂等由脚本强制**（q3=B）；
  4. 最终验证以**离线回归为主**，真实编排另起一轮不算本次（q4=A）；
  5. **wayfinder 全量建图，#5 转父/治理节点**：P0 拆子 issue、#22~#25 挂依赖边、P1/P2 建 issue 留待后续（q5=A）；
  6. 确认区四条全部同意：schema 升 v3+v2 兼容读取、旧 runtime 归档不删、#5 补验收条件、目标仓现场不碰（C1~C4）。
- **Agent-owned**：registry/inbox 的文件布局与字段命名、时间戳格式统一、状态机转移表编码方式、fixture 场景具体构造、board.html 渲染细节（对照物阶段锁定）、SKILL.md 行文组织。
- **Blocked**：无（gh 可用、目标仓可读）。

## 决定边界未知项

- `npm test` 三条红灯是否顺带修——属仓库级基建，超出本技能；拟作为独立任务分离，不占本次范围（已向用户提示）。

## 未知项

- Issue #5 正文编辑历史（哪段何时追加）API 不可得——不影响决策。
- 03:21 collect 把 assessment 清空的确切根因（承接失效 vs runtimeDir 指向漂移）——已由 #25 缺陷覆盖，实现阶段验证。
