# Goal Contract: 给 workflow-interview 补上「契约定稿前中途改需求」的文档化流程

- Status: Ready
- Target: `.claude/skills/workflow-interview/`、`.claude/skills/aes-goal-contract/`
- Updated: 2026-08-13

## 原始请求

> 帮我给 workflow-interview 加个功能，允许用户中途改需求。

## 目标

编排 Agent 在 `3-contract` 阶段（契约还没定稿前）遇到用户想追加、修改或删除一条验收
条件时，能按文档里写明的路径直接处理——finalize 前就地迭代、finalize 后用现有命令
重开该阶段——不再误用 `needs_reinterview` 把整个流程打回 `1-interview`。

## Why

- 仓库已有的 `needs_reinterview` 回退机制语义是「重新问」，把状态强制打回
  `1-interview`，用来处理「访谈中途才遇到的新歧义」很重，用来处理「契约草稿阶段
  用户临时想加一条」又太重——两者字面都叫「改需求」，容易被混用。
- `session.mjs stage` 命令本身早就允许把已 `done` 的阶段重设回 `in_progress`，
  但没有任何 SKILL.md 提到这个用法，编排 Agent 遇到「契约已经 finalize，用户又想
  加条件」时无路可循，容易被迫新开一个 issue，制造出本不需要的重复记录。

## 范围

做：在 `workflow-interview/SKILL.md` 与 `aes-goal-contract/SKILL.md`（或其
`references/`）里新增「契约定稿前中途改需求」的文字说明，覆盖：

- 时间窗口：只到契约 `finalize` 完成（`manifest.status = ready`）为止。`finalize`
  前直接在 `aes-goal-contract` 第 2 步的迭代里处理；`finalize` 后用现有
  `session.mjs stage`（第一个参数填目标 issue 目录路径）`3-contract in_progress`
  重开该阶段处理。
- 动作范围：追加新 AC、修改已确认 AC 的描述或 Verify、删除某条 AC，三种都算「中途
  改需求」，走同一条路径（回改 `contract.md`，重新跑 `finalize`）。
- 是否需要回 `aes-prototype`：新增/修改的条件涉及可观察差异（界面、行为、接口报文、
  可运行输出、配置、历史兼容任一项）时，先回 `aes-prototype` 只对这一条出增量对照物；
  纯文字性质（例如补一句边界说明）不触发。判据直接复用 `aes-prototype` 现成的六面
  影响面表，不新造一套。

不做：

- 不新增 `session.mjs` 脚本子命令，也不新增 issue 清单文件的字段（比如版本号、变更
  历史）。这次改动只落在文档层面，复用已经存在的 `init` / `round` / `stage` /
  `verify` / `rebuild` / `finalize` / `list` 七个命令。
- 不覆盖「执行 Agent 已经拿着交接指令开始跑」之后再改需求的场景——workflow-interview
  完全不掌握执行 Agent 的运行进度，这件事跨出本仓库边界，这次不处理，作为残留风险
  记录在下面。
- 不改 `needs_reinterview` 的既有触发条件和语义，它继续只用于「子技能撞出新歧义、
  需要重新问」的场景；「中途改需求」是它旁边一条更轻的平行路径，不是替代品。

## 强约束

- `session.mjs` 的子命令集合保持七个不变：`init` / `round` / `stage` / `verify` /
  `rebuild` / `finalize` / `list`，这次不新增第八个。
- issue 清单文件（`session.mjs` 唯一写入的那份状态记录）的 `schema_version`
  （当前为 `1`）与既有字段结构不变。
- `needs_reinterview` 的触发条件、把 `manifest.stage` 打回 `1-interview` 的行为
  必须原样保留，不能被这次新增的路径改写或绕过。
- `validate-goal-contract.mjs` 的全部校验规则（AC 编号连续、Verify 档位齐全、
  编号不补位等）保持不变，中途新增/修改的 AC 一样要过这些规则。

## 自主边界

不用问，直接定：
- 新增的文字具体落在 `workflow-interview/SKILL.md` 正文的哪个小节、还是新增一份
  `references/amend.md` 由正文引用，属于局部写作选择，只要不引入新脚本命令。
- 用词、行文风格跟随现有 SKILL.md 的写法（短句、举反例、代价必须写出来）。

必须停下来问：
- 要不要把「执行开始之后再改需求」也纳入范围——这次访谈已经问过（见访谈记录 Q1），
  用户选了「不纳入」，之后若有人想重新扩大范围，这是难逆决定（要跨出仓库边界去猜
  执行 Agent 的状态），必须回来问，不能顺手加。
- 要不要给 `needs_reinterview` 和这次新增的「中途改需求」路径做任何合并或互相调用，
  这次访谈明确选了「两条平行路径，互不调用」，改这个决定属于难逆（会影响所有已经
  依赖 `needs_reinterview` 语义的现有 issue），必须回来问。

## 读什么

- `../2-prototype/behavior.md`：四行变化行，是下面全部验收条件的例子来源。
- `../2-prototype/example-run.md`：场景 1/2 的具体命令示范，以及「必须保持不变的
  现有用法」那条 `needs_reinterview` 的对照。

## 验收条件

- AC-001: `workflow-interview/SKILL.md` 文件内容包含「中途改需求」这个短语，标志着
  它有明确的判断路径章节（覆盖窗口：finalize 前就地迭代 / finalize 后重开，两者都
  不触发 `needs_reinterview`）
  - Verify: [A] `node -e "process.exit(require('fs').readFileSync('.claude/skills/workflow-interview/SKILL.md','utf8').includes('中途改需求')?0:1)"` → 退出码 0
- AC-002: `aes-goal-contract/SKILL.md` 文件内容包含「中途改需求」这个短语，标志着它
  明确了「追加/修改/删除 AC 走同一路径」以及「新条件要不要回 aes-prototype 套用六面
  判据」这两点
  - Verify: [A] `node -e "process.exit(require('fs').readFileSync('.claude/skills/aes-goal-contract/SKILL.md','utf8').includes('中途改需求')?0:1)"` → 退出码 0
- AC-003: 已经 `finalize`（`3-contract` 状态为 `done`）的阶段，能用现有
  `session.mjs stage` 命令重新拉回 `in_progress`，不需要任何新脚本
  - Verify: [A] `node .claude/skills/workflow-interview/scripts/session.mjs init verify-fixture-amend && node .claude/skills/workflow-interview/scripts/session.mjs stage .aes-workflow/grilling/verify-fixture-amend 3-contract done && node .claude/skills/workflow-interview/scripts/session.mjs stage .aes-workflow/grilling/verify-fixture-amend 3-contract in_progress` → 退出码 0

## 残留风险

- 「执行 Agent 已经拿着交接指令开始跑之后再改需求」这个场景这次访谈明确决定不覆盖
  （见访谈记录 Q1，用户选 A，55% 推荐档）——错了会怎样：如果之后确实有人在执行阶段
  中途改需求，会发现完全没有文档路径，只能临场发明，行为和这次锁定的两条路径可能
  不一致。

## 访谈记录

### 第 1 轮（1-interview）

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| Q1 中途改需求覆盖到哪个时间窗口 | A 只覆盖 finalize 前，之后走重开 55% / B 覆盖到执行开始后加变更记录 30% / C 覆盖执行中途联动执行 Agent 15% | A | A，「不需要管执行 Agent 那层，那个我读不到、也没打算管」 |
| Q2 只允许追加还是也允许修改/删除已确认的 AC | A 都算，同一路径 70% / B 只允许追加，改老的另开新 issue 20% / C 不预设规则临场判断 10% | A | A，「都算，不用分开搞两条路径」 |

没占提问、走默认区和确认区定下的条目：

| 定了什么 | 档 | 为什么这么定 | 用户 |
| --- | --- | --- | --- |
| 复用现有 `session.mjs` 命令，不新增脚本子命令 | 默认 | 用户明确表态不想要新子系统/新命令 | 未反对 |
| 契约变更后必须重新跑一次 `finalize` | 默认 | `finalize` 是仓库里唯一的校验入口 | 未反对 |
| 新增/修改 AC 沿用现有编号规则，只追加不腾挪 | 默认 | `goal-contract-shape.md` 已写明该规则 | 未反对 |
| finalize 后重开用 `session.mjs stage` 命令把 `3-contract` 设回 `in_progress`，不新建 issue | 确认 | `goal-contract-shape.md` 判据是「改现有标准 vs 一件新事」 | 确认，未反对 |
| 新条件要不要回 `2-prototype` 直接套用既有六面判据，不新造一套 | 确认 | 判据已经现成 | 确认：「涉及界面/行为变化就要，纯文字性质就不用，按现有门禁规则判断」 |

### 第 2 轮（3-contract）

| 定了什么 | 档 | 为什么这么定 | 用户 |
| --- | --- | --- | --- |
| AC-001/AC-002 用 `node -e` 检查文件含关键短语作为 `[A]` 档 Verify | 确认 | 仓库现成校验方式，一秒出结果 | 按推荐，「验收方式跟着 validate-goal-contract.mjs 走」 |
| AC-003 用实跑 `init→done→in_progress` fixture 命令链作为 `[A]` 档 Verify | 确认 | 已手动验证过一遍，退出码 0 | 按推荐 |

## 设计取舍

### D-1 「中途改需求」要不要和 `needs_reinterview` 合并成一套机制

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 合并 | 把「中途改需求」也做成 `needs_reinterview` 的一种子类型，加一个字段区分「轻回退」和「重回退」 | 要改 `session.mjs` 的状态机代码，且 `needs_reinterview` 现有语义（打回 `1-interview`）和「中途改需求」的语义（留在 `3-contract`）方向相反，硬合并会让两种行为共用一个状态名，容易读错 | 与用户「不想要新子系统」的诉求相悖，且违反强约束里「`needs_reinterview` 行为不能被改写或绕过」 |
| B（选定）平行路径 | 「中途改需求」完全不碰 `needs_reinterview`，只是在文档里新增一段独立说明，复用已经存在的 `stage in_progress` 用法 | 两条路径并存，编排 Agent 要知道该选哪条；但判据很简单（有没有撞出「新歧义」还是「单纯想加一条」），不算重代价 | 无 |
| 什么都不做 | 保持现状，靠编排 Agent 临场判断 | 不同的人/不同轮次判断不一致，容易反复误用 `needs_reinterview` 整体回退 | 正是这次要解决的问题 |

选定 B。理由：用户明确说不想要新子系统或新命令，`session.mjs stage` 命令本身已经
足够表达「重开一个阶段」这个动作，缺的只是把这条路径写进文档、并且把它和
`needs_reinterview` 的边界说清楚。落进契约的形态：`强约束` 写「`needs_reinterview`
行为不能被这次新增的路径改写或绕过」，两条路径在文档里分别独立成节，不共用同一个
状态值。
