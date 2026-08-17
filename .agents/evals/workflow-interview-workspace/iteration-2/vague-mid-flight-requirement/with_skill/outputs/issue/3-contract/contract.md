# Goal Contract: 让 workflow-interview 支持在 3-contract 契约还没 done 前追加一条验收条件，不用整套退回 aes-interview

- Status: Ready
- Target: `.claude/skills/workflow-interview/`、`.claude/skills/aes-goal-contract/`
- Updated: 2026-08-13

## 原始请求

> 帮我给 workflow-interview 加个功能，允许用户中途改需求。

补充澄清（访谈第一轮）：「中途」具体指访谈已问完、对照物已确认、进入 `3-contract`
阶段快收尾、契约还没定稿时，想追加一条新的验收条件；「改需求」具体只指这一种动作，
不包括修改/删除已定的 AC 或改目标范围本身。

## 目标

在 `3-contract` 契约还没 `done` 之前，用户能追加一条新的验收条件并让它正常走完既有
校验与交接流程，不必像现有 `needs_reinterview` 那样整套退回 `1-interview` 重问一遍。

## Why

- 现有唯一的「回退」机制是 `needs_reinterview`：语义是「子技能撞出材料歧义，退回
  重问」，力度和「我只是想再加一条」不匹配，容易被误用或者干脆不知道能不能做。
- 调查发现 `session.mjs` 的 `done` 闸门本来就是「现场重新校验」而不是一次性锁定，
  机制上已经允许在 `3-contract done` 之后继续编辑 `contract.md`、重跑 `finalize`、
  重跑 `stage 3-contract done`——缺的只是把这条路径写清楚、承认它、并有测试兜底，
  不是缺一整套新机制。

## 范围

**做什么：**
- 在 `aes-goal-contract/SKILL.md` 里新增一节，明确「契约还没 done 前追加一条 AC」
  该怎么做（编辑 `contract.md` → 重跑 `finalize` → 重跑 `stage 3-contract done`），
  以及这条路径和 `needs_reinterview` 的边界：追加内容涉及界面/行为差异时（需要新的
  或变更的确认版对照物），仍然算材料歧义，走 `needs_reinterview`，不是这条轻路径
  能覆盖的；纯文字性质的追加（不产生任何可观察差异）才走这条路径。
- 在 `workflow-interview/SKILL.md`「回退」一节加一句话指向这条新说明。
- 在 `session.test.mjs` 里新增回归测试，覆盖两个场景：(a) 追加 AC 后重跑
  `finalize` + `stage done` 能成功；(b) 追加 AC 后不重跑 `finalize` 直接
  `stage done` 仍然被现有 mtime 闸门拒收。

**不做什么：**
- 不新增 `session.mjs` 子命令，不新增 `stage_gates` 状态值。1-interview 阶段已经
  问清楚：用户明确不想要一个全新的子系统或新命令，机制本身已经够用。
- 不改 `needs_reinterview` 的既有语义与判定范围，它仍然是唯一处理材料歧义的路径。
- 不覆盖「修改或删除已定的 AC」「改目标/范围本身」——这两类不在这次澄清后的范围内，
  出现时仍按 `aes-goal-contract/SKILL.md` 现有说明（改现有标准回原契约重做）处理。
- 不新增「只回 2-prototype、不回 1-interview」的中间态：访谈中确认，涉及界面/行为
  差异的追加仍然统一走 `needs_reinterview`，不为它单独发明一层更细的状态机。

## 强约束

- `session.mjs` 的全部 7 个子命令（`init/round/stage/verify/rebuild/finalize/list`）
  参数、退出码、输出文案不得改变。
- `validate-goal-contract.mjs` 的全部既有校验规则（7 条 AC 上限、编号连续、Verify
  档位规则、残留风险对账等）不得放宽或改写。
- `needs_reinterview` 触发后仍然无条件退回 `1-interview`，这条既有行为不得被这次
  改动削弱或绕过。
- 已经 `done` 的旧 issue 目录（旧的状态记录与旧的 `contract.md`）的判定结果不受
  这次改动影响。

## 自主边界

不用问，直接定：
- 新增小节标题的具体措辞、放在 `aes-goal-contract/SKILL.md` 的哪个位置（建议紧跟
  「落盘」一节之后）。
- `session.test.mjs` 新增用例的具体断言写法、fixture 构造方式，跟随文件里已有的
  `mkIssue`/`run`/`expect` 辅助函数的风格。
- 两条新用例的具体测试数据（issue slug、AC 文案），只要不影响其他用例即可。

必须停下来问：
- 如果发现「现场重新校验」这个机制假设有误（比如 `done` 之后真的有什么地方会拒绝
  重新编辑），必须回来说清楚，而不是绕过去发明一个新状态。
- 如果这次落地过程中发现追加 AC 还会撞上除「涉及界面/行为差异」之外的另一类材料
  歧义，先回来问清楚归类，不要就地在文档里含糊带过。

## 读什么

- `../2-prototype/behavior.md`：三条行为对照，含「不变清单」。
- `../2-prototype/example-run.md`：三个场景的 CLI 走查示例（追加成功路径、跳过
  finalize 被拒的回归防线、涉及界面/行为差异时改走 needs_reinterview）。

## 验收条件

- AC-001: `aes-goal-contract/SKILL.md` 新增一节标题「### 契约还没 done 前追加一条 AC」，正文点名两条：(a) 编辑 `contract.md` → 重跑 `finalize` → 重跑 `stage 3-contract done` 这条路径不需要新命令；(b) 追加内容涉及界面/行为差异时改走 `needs_reinterview`。`workflow-interview/SKILL.md`「回退」一节含同一标题的引用句
  - Verify: [A] `node -e "const fs=require('fs');const a=fs.readFileSync('.claude/skills/aes-goal-contract/SKILL.md','utf8');const b=fs.readFileSync('.claude/skills/workflow-interview/SKILL.md','utf8');const ok=a.includes('契约还没 done 前追加一条 AC')&&a.includes('needs_reinterview')&&b.includes('契约还没 done 前追加一条 AC');process.exit(ok?0:1)"`
- AC-002: `session.test.mjs` 里存在一条名字或注释含 `amend-after-done` 的回归用例，且整份测试套件跑起来退出码为 0
  - Verify: [A] `node -e "const fs=require('fs');const src=fs.readFileSync('.claude/skills/workflow-interview/scripts/session.test.mjs','utf8');if(!src.includes('amend-after-done'))process.exit(1);const{status}=require('child_process').spawnSync(process.execPath,['.claude/skills/workflow-interview/scripts/session.test.mjs'],{stdio:'inherit'});process.exit(status)"`
- AC-003: `session.test.mjs` 里存在一条名字或注释含 `amend-without-finalize-rejected` 的回归用例，断言「追加 AC 后不重跑 finalize 直接 stage done」仍以退出码 1 被拒收，且整份测试套件退出码为 0
  - Verify: [A] `node -e "const fs=require('fs');const src=fs.readFileSync('.claude/skills/workflow-interview/scripts/session.test.mjs','utf8');if(!src.includes('amend-without-finalize-rejected'))process.exit(1);const{status}=require('child_process').spawnSync(process.execPath,['.claude/skills/workflow-interview/scripts/session.test.mjs'],{stdio:'inherit'});process.exit(status)"`

## 访谈记录

### 第 1 轮（1-interview）

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| “中途”具体指哪个/哪些时点？ | A 契约未 done 时追加 60% / B 已 done 之后追加 15% / C 泛指任意阶段 25% | A | A。补充：“对，就是访谈已问完、对照物也确认过了，进入到 3-contract 阶段快收尾时——契约还没定稿，我才突然想加一条新的验收条件” |
| “改需求”具体覆盖哪类动作？ | A 只追加新 AC 55% / B 也含改/删已定 AC 25% / C 也含改目标/范围 20% | A | A |
| 新机制和现有 needs_reinterview 是什么关系？ | A needs_reinterview 不变，另开一条更窄路径 65% / B 建一整套独立子系统 10% / C 机制已够用，只欠文档 25% | A | A。补充：“好像……还真有点像，我可能就是想要一个更轻的版本——不用整个打回第一阶段重新走一遍” |
| 新增/变更 AC 涉及界面或行为差异时要不要触发 aes-prototype 重新出对照物？ | A 按现有门禁规则现场判断 70% / B 一律触发 15% / C 新增只回 2-prototype 的中间态 15% | A | A。补充：“看情况，如果新条件涉及界面/行为变化就要，纯文字性质的就不用，你按现有门禁规则判断就行” |
| 要不要新的 CLI 命令或阶段状态？ | A 不新增，走既有路径+文档 68% / B 新增轻量子命令 22% / C 新增新状态值 10% | A | A。补充：“我不想要一个全新的子系统或者新命令；如果你打算新增一整套机制，先跟我确认一下是不是有更小的改法” |

没占提问、走默认区和确认区定下的条目：

| 定了什么 | 档 | 为什么这么定 | 用户 |
| --- | --- | --- | --- |
| 1/2 阶段的“改需求”不需要新机制，本来就还在 in_progress，可直接继续迭代 | 默认 | 这两个阶段的产物本来就迭代到确认为止 | 未反对 |
| 优先复用 `session.mjs` 现有 finalize+stage done 的现场重校验能力，不新增子命令 | 确认 | 已查到 done 闸门是现场重新校验，机制上已允许 | 未反对 |
| AC-001 用 [A] 文档内容检查 | 确认 | 纯文本存在性检查，成熟可逆 | 未反对 |
| AC-002/AC-003 用 [A] session.test.mjs 新增用例 | 确认 | 仓库既有回归测试基建 | 未反对 |

### 第 1 轮（2-prototype）

对照物阶段的六面影响扫描：用户可见界面/对外接口报文/用户配置三面为「无」；
可观察行为、可运行输出各有一处小差异；历史兼容性需确认 `session.mjs` 零代码改动。
`behavior.md`、`example-run.md` 两份对照物一次展示，用户确认通过，未提修改意见
（人设：验收方式跟随 `validate-goal-contract.mjs`，其余选 Agent 推荐项）。

## 设计取舍

### D-1 要不要新增专门的「amend」子命令或新状态值

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 新增 `stage 3-contract amend` 子命令 | 包一层专门语义，显式区分「首次 done」和「追加后再 done」 | 多一个命令要维护、要写测试、要教用户；`session.mjs` 的 7 个命令保持简单是既有设计取向 | 1-interview 阶段用户明确不想要新命令，且调查发现机制上不需要 |
| B 新增 `stage_gates` 状态值区分「已交接」与「可再改」 | 给 manifest 加一个字段标记「锁定态」 | 改 schema，`rebuild`/`list` 等命令都要跟着适配，返工面广，且和 `skipped` 只能用在 2-prototype 的既有限制风格不一致 | 同上，且现有 `done` 判定本身不依赖「是否第一次」，加这个字段是在解决一个不存在的问题 |
| B（选定）不新增任何机制，只补文档+回归测试 | 编辑 contract.md → 重跑 finalize → 重跑 stage done，机制已经支持 | 用户体验上不如专门命令直白，得靠文档提醒 | 无 |

选定 B。理由：调查先于设计——`session.mjs` 的 `done` 闸门本来就是幂等的现场重校验，
不是「一次性锁死」，追加一条 AC 不需要绕过任何限制，只需要被承认成一条正式支持的
路径。新增命令或状态值是在没有真实约束缺口的地方造复杂度，和用户「不想要新子系统」
的表态方向一致。
落进契约的形态：`强约束` 写「不得新增 session.mjs 子命令或 stage_gates 状态值」。
