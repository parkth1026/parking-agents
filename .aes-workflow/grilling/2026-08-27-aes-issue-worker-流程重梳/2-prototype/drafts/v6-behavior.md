<!-- draft v6 | published 2026-08-27
     用户意见：round8：拓扑修正（integrator 挂总管、hub-and-spoke）+ human worker lane
     状态：superseded by v7 -->
# 行为对照表: 2026-08-27-aes-issue-worker-流程重梳

**草稿 v6。** 确认后锁定；执行 Agent 改的是产品，不是这份对照表。

命名总则（round 7）：**流程步骤名一律使用既有或待建技能名**，不使用 solve /
evaluator / Master 验收层等自造词。角色词表：

| 角色 | 名字 | 状态 |
| --- | --- | --- |
| 总管（派单 / slot / queue / 打回传递） | aes-worktree-board | 既有 |
| Issue 执行者（owner session） | aes-issue-worker | 既有，本票修订 |
| 实现方法论 | tdd / diagnosing-bugs（codebase-design 辅助） | 既有，按 workflowRole 路由 |
| 验证（循环轮 + 最终轮 + 回归，单一角色） | aes-qa | 既有 |
| 清理 | simplify | 既有 |
| 代码审查 | code-review | 既有 |
| **合并验收 worker**（接收本地 PR：review → merge → 全量回归） | **aes-integrator**（拟名，待用户定名） | **待建** |

aes-integrator **不是总管**：总管只管派单与状态面；integrator 是专职消化 merge queue
的 worker——机械上两者调用同一套 `master.mjs` CLI 操作同一 registry，零 schema 改动。

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | tdd / diagnosing-bugs 每轮产出后 | 实现者自跑 self-test | **aes-qa 循环轮**：fresh-context 只读 subagent，自动档跑 AC 逐条核对 + 测试；输入仅 AC + worktree 路径 + 命令，不带实现者叙述；只出 finding 不出 receipt、不进 registry；FAIL 带 finding 回实现，**循环直到 PASS** |
| 2 | 循环轮 PASS 后；workflowRole=implement 且有实质代码改动 | 无此步骤 | **simplify**（3 并行 subagent + 窄范围修复），改动留在工作树；非 implement 单 / 纯文档 / 零改动跳过 |
| 3 | simplify 收尾 | 循环中多次 candidate commit | **单次 candidate commit**（happy path 全程唯一），`master.mjs candidate` 登记 |
| 4 | commit 登记后 | worker 内 review→QA 串行 | **aes-qa 最终轮**（同一角色）：重跑自动档（覆盖 simplify 改动）+ 按影响面补 live/manual 档，绑 commit SHA，产出 typed QaReceipt 并 `stage qa` 上报；FAIL 回实现（烧 qaLoops） |
| 5 | QaReceipt PASS，worker 发 READY_TO_MERGE（≈本地 PR）后 | code-review 在 worker 内自派自报 | **code-review 移至 aes-integrator**：integrator 派独立 code-review subagent（Standards+Spec 双轴；深度按 `resolveMergePolicy` 的 effectiveRisk 分档——含路径兜底），review receipt 由 integrator 侧 `stage review` 上报 |
| 6 | integrator review MUST_FIX | worker 内直接修 | typed 打回原 owner session（报文见 api-mock v2；session 不可恢复则新 attempt 携带 finding）；**修复后必须重走 aes-qa 回归**（循环轮收敛 + 最终轮绑新 commit）再重新 READY；**reviewLoops 由 integrator 记账** |
| 7 | integrator review PASS | 「Master host」直接 merge + targeted verify | **aes-integrator 执行交付管线**：gate 六项 → 串行 merge → **merge 后全量回归**（POST_MERGE_VERIFY 的 commands file 跑全量测试套件，非 targeted）→ 幂等 close → release slot |
| 8 | 角色边界 | Master 一词兼指总管与合并执行者 | **词汇分离**：aes-worktree-board（总管）不再出现在验收语境；SKILL.md 与 board 文档同步改写角色表述 |

## 不变清单

- **aes-qa 是唯一验证角色**：循环轮 / 最终轮 / 打回后回归是同一技能的三次调用；只有最终轮（及回归的最终轮）出 typed receipt。
- **机械门等式不放松**：review / QA receipt 必绑 candidateCommit 精确相等；commit 先于一切 receipt 绑定；不开证据豁免通道。
- **GATE-review 无条件**（C2）：分档只调深度；机械门六项、串行 merge、幂等 close 不动。
- **work-order schema 零改动**（Q1 已撤销）；registry / terminal / DISCOVERED_WORK / 六出口全部不动；schemaVersion 保持 v1；selftest-v4 既有断言天然全绿。
- 单 owner session 模型：实现持 writer；aes-qa / simplify / code-review 全部 fresh-context 只读 subagent；多 agent 仅存在于总管层并行多 Issue 与 integrator 专职 lane。
- worker 三条边界：永不 merge、永不直接写 GitHub、不清理用户现场——merge 权独属 aes-integrator。

## 已废止的先前裁定

- C1（round 4 推翻）；Q1 + 行 7/8 边界行（round 5 连锁撤销）；simplify 位置 round 2/3（被单 commit 吸收）；evaluator/终验双角色（round 6 合并）；「Master 验收层」表述（round 7 更名 aes-integrator）。

## 残留风险（进契约）

- **QA receipt provenance 仍在 worker 侧**：留给 aes-gate（map #47）确定性检查补，本票不扩面。
- **aes-integrator 的载体形态**（总管 session 兼任 vs 独立 session 占 host worktree）与打回通道实现（原 thread 消息 vs 新 attempt）依宿主能力定，归执行 Agent；治理位（map 归属 / 是否建独立 SKILL.md）进契约交接指令。
- 全量回归的耗时进入串行 merge 临界区——队列吞吐由全量套件时长决定（design.md 第二层证据失效的既有结论，不新增）。

## 配置差异

无配置变化：不动 board.config.json、环境变量、CLI 选项。
