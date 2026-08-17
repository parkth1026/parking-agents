# 工单：`3-contract` 阶段内轻量修订验收条件（"中途改需求"的一个子场景）

## 范围（收窄后）

覆盖：issue 已经走完 `1-interview`、`2-prototype`（甚至已经 `finalize` 过
`3-contract`），用户此时想**新增或改写一条验收条件**，且这条改动**不推翻**
已锁定的目标/范围，**不牵连** `aes-prototype` 已判"无差异"的某一面。

明确不覆盖（仍然走仓库现成的 `needs_reinterview`，本工单不改它）：

- 改动会推翻已定的目标、范围，或让某个 6 面扫描判过"无差异"的面现在有差异了；
- 契约已经交接给执行 Agent、实现已经开始之后的需求变更（那是另一个更大的问题，
  涉及"半成品代码怎么处理"，本工单人设明确没有覆盖这个层次，见
  SIMULATED_INTERVIEW.md Q1 的定位）；
- "改需求"如果实际是"目标本身要变"，本工单也不覆盖（见 Q5）。

## 根因：功能其实已经有一半存在，缺的是文档入口和一处状态一致性 bug

调查发现两条已有机制，覆盖了"中途改需求"的不同子场景：

1. **`needs_reinterview`**（`session.mjs` `cmdStage`，第 223–229 行）：任何阶段
   撞出会推翻上游结论的新歧义时报它，issue 打回 `1-interview`，其余 gate 状态
   原样保留。这条本来就是"中途改需求"的正规路径之一，只是代价大（回访谈）。
2. **"回原契约重做"**（`aes-goal-contract/SKILL.md` 第 147–149 行）：
   > 任务已经存在时改它的契约文件，不新建。判据只有一条：这次要动的是现有验收
   > 标准，还是一件新的事。改现有标准、补现有实现、修刚发现的缺陷都回原契约
   > 重做……

   这条路径完全不touch `1-interview` / `2-prototype`，机制上就是本工单人设想要
   的"更轻的版本"。它已经存在，只是：

   - **没有被 `workflow-interview/SKILL.md`（编排器文档）引用**。编排器文档里
     唯一提到"改主意怎么办"的地方是"回退"小节，只讲 `needs_reinterview`。
     一个只读编排器文档、不深挖三份子技能文档的人，会以为"中途改需求"只有
     "打回第一阶段重来"一条路，从而误判需要新建一个功能。
   - **`session.mjs` 支持重开一个已完成阶段（`stage <dir> 3-contract in_progress
     --reason "..."`，`in_progress` 是已有合法状态值），但重开时不会把顶层
     `manifest.status` 从 `'ready'` 改回 `'in_progress'`。** 具体代码位置：
     `cmdStage` 第 230–236 行，`done`/`skipped` 分支之外的 `else` 分支
     （第 234–236 行）：

     ```js
     } else {
       m.stage = stage;
     }
     ```

     这个分支只改 `m.stage`，不碰 `m.status`。而 `m.status` 只在两处被设成
     `'ready'`：`finalize()`（`cmdFinalize`）成功时，以及 `cmdStage` 的
     `done`/`skipped` 分支里"所有阶段都 done/skipped"时。一旦 issue 走到过
     `ready`，之后用 `stage 3-contract in_progress` 重开它去改一条验收条件，
     `session.mjs list` 和 `manifest.json` 的 `status` 字段会继续显示
     `ready`——跟"这单其实又在改"的事实不一致。这是一个真实的状态一致性 bug，
     不是我推测出来的边界情况：读代码就能确认，不需要猜。

结论：**不需要新命令、新状态值、新子技能。** 只需要（a）修一处 `m.status` 的
一致性 bug，（b）把"回原契约重做"这条已有路径在编排器文档里正式立成"中途改
需求（不推翻范围）"的入口，跟 `needs_reinterview`（"中途改需求（推翻范围）"）
并排放，让人一眼看出该走哪条。

## 提议的改动

### 改动 1 — `scripts/session.mjs`：重开阶段时同步复位 `manifest.status`

```diff
--- a/.claude/skills/workflow-interview/scripts/session.mjs
+++ b/.claude/skills/workflow-interview/scripts/session.mjs
@@ cmdStage
   } else {
     m.stage = stage;
+    // 重开一个曾经 done/skipped 过的阶段（比如 3-contract 收尾后又要改一条
+    // 验收条件）时，整单不再是"就绪"。不复位的话 manifest.status 和
+    // session.mjs list 会继续显示 ready，跟实际在改的事实不一致。
+    if (m.status === 'ready') m.status = 'in_progress';
   }
```

风险评估：三行，只在 `m.status === 'ready'` 时触发，不改变任何现有状态机
分支、不新增状态值、不影响 `needs_reinterview` / `done` / `skipped` 分支的
既有行为。`cmdList`、`cmdFinalize` 都只读 `m.status` 不做特殊分支判断，
改了之后两者的行为是"更准确地反映现状"，不是"行为变化"。

### 改动 2 — `workflow-interview/SKILL.md`：给"回退"小节旁边加一条"轻量修订"

在现有"回退"小节（原 61–67 行）之后插入：

```markdown
## 中途只加/改一条验收条件

不是每次"中途改需求"都要回退。用户此刻要的，如果只是给已经问过的东西再加一条
验收条件，且这条不推翻已定的目标、范围，也不牵连 `aes-prototype` 已判"无差异"
的某一面——这不是新歧义，不用回 `aes-interview`。`aes-goal-contract` 收尾第 3
节已经写明这种情况怎么办：回原契约重做，不新开 issue。

```bash
node <skill-dir>/scripts/session.mjs stage <issue-dir> 3-contract in_progress \
  --reason "<为什么要重开：新增了哪条、谁提的>"
```

重开后照常改 `contract.md`、重新征得用户确认、再跑一次 `finalize`。判据和
`aes-goal-contract` 落盘那节同一句话：**这次要动的是现有验收标准，还是一件
新的事**——只有新事才走 `init` 开新 issue。

分不清是这条还是真要回退时，按更保守的那条走：`needs_reinterview`。错判成
回退的代价是多问一轮；错判成轻量修订的代价是带着已经过时的范围继续往下走，
后者更贵。

| 场景 | 走哪条 |
| --- | --- |
| 只加/改一条验收条件，不动已锁的目标/范围/已确认对照物 | 本节：`stage ... in_progress` 重开 3-contract |
| 新条件推翻了已定目标/范围，或让某面对照物"无差异"的判断作废 | `needs_reinterview`，回 `aes-interview` |
| 契约已交接、实现已开始后想再改 | 不在本技能范围内，按团队现有变更流程处理 |
```

### 改动 3 —（可选，跟随改动 2）`aes-goal-contract/SKILL.md` 收尾小节加一句反向指路

在第 147–149 行"任务已经存在时改它的契约文件……"后面补一句，指回编排器新加的
入口，避免两处文档各说一半：

```markdown
从 `workflow-interview` 编排进来、且这次是"回原契约重做"（不是新事）时，先用
`session.mjs stage <issue-dir> 3-contract in_progress --reason "..."` 把这个
阶段的 gate 显式重开，manifest 才会如实反映"这单又在改"，不要只改
`contract.md` 不吭声。
```

## 为什么没有做成更大的东西

- 没有新增 `session.mjs` 子命令：`stage ... in_progress` 已经能表达"重开一个
  阶段"，改动 1 只是修好它旁边一个真实存在的状态不一致，不是发明新机制。
- 没有新增状态值：`needs_reinterview` 和"重开 in_progress"两条路径已经能覆盖
  "推翻范围" vs "不推翻范围"这两种"中途改需求"，不需要第三种状态。
- 没有新建子技能：`aes-goal-contract` 已经把"回原契约重做"的判据和步骤写清楚
  了，缺的只是编排器文档没把这条路径当回事地引用一遍。

## 尚未实施的原因（如实记录）

本次运行的 Agent 被隔离在一个独立 git worktree
（`.claude/worktrees/agent-a35289f36997e2925`）里，这个 worktree 并不包含
`workflow-interview` / `aes-goal-contract` 等技能目录（它们在共享主目录下，
且从 git 状态看目前是未纳入版本控制的工作区文件）。Write/Edit 工具对
worktree 之外的共享路径直接拒绝，这是隔离机制本身的设计，不是权限故障——共享
目录同时有其它并行任务在写（本目录下能看到其它 iteration 的产物），贸然绕过
隔离去改一份多方共用、且当前处于未提交状态的脚本和文档，出问题不好回滚，
不是"完成得更快"，是把风险转嫁给不知情的并行任务。

所以这里交付的是**可直接应用的具体 diff**（改动 1–3），而不是已经落地的改动。
如果要真正落地，建议：拿这份 diff 在主目录里手动打上、跑一次
`node session.mjs stage <某个测试 issue> 3-contract in_progress --reason test`
确认 `manifest.status` 复位正确，再决定是否连同当前未提交的其它
`workflow-interview` 改动一起提交。
