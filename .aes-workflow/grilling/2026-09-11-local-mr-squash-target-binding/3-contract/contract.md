# Goal Contract: local-mr-squash 目标绑定修订（双 worktree 拓扑常规走绿）

- Status: Ready
- Target: `G:\GIT\AI_WorkFlow\parking-agents-manual\skills\workflow\local-mr-squash\`（用户库 symlink `C:\Users\parking\.agents\skills\local-mr-squash` 挂载关系不动）
- Updated: 2026-09-12

## 原始请求

> 「[$workflow-interview] 我们 走正规流程」——针对 steelman 裁决的三步修订（prose 目标显式化 / 门禁前置校验 / run-tests 双 worktree 演练）
> 「两个 worktree 同时开 seesion 要求 合并到 dev」（crux 回答，定义真实工作形态）

## 目标

让 local-mr-squash 在双 worktree、dev 目标的真实拓扑下常规走绿：目标显式化（prose 第 1 步硬前置 + 正文措辞泛化）、双 worktree 收口改彼处 `git reset --hard` 前滚到目标（含已推送护栏）、门禁加「当前检出==源分支」用法错前置校验、run-tests 补双 worktree 演练。

## Why

- 2026-09-11 temp fixture 实证：双 worktree 拓扑下现行收口设计无一路径走绿——`branch -f`/`branch -D` 被拒（源被别处检出）、彼处 `merge` 产生 merge commit 致门禁第 4 项永红；彼处 `reset --hard` 是实测唯一常规全绿路径
- 同轮实证：合并前在源 worktree 跑门禁四项同义反复全绿（exit 0 假绿）
- 根问题（steelman 裁决）：合并是（源，目标）二元运算，源已显式参数化、目标隐式绑定当前检出——一半显式一半隐式

## 范围

做：SKILL.md 首行/第 1 步/第 6 步修订（description 逐字不动）；verify-squash-merge.mjs 新增前置校验（用法错类）与第 4 项 FAIL 提示文案；run-tests.mjs 更新断言（含双 worktree 演练用例、源检出态断言、description 逐字断言；移除数字门槛断言）；references/design.md 迭代记录追加。

不做：description 改动与触发评测重跑（U1）；四项检查判定逻辑与退出码语义（U2/U3）；门禁第 4 项判定放宽（D-1 候选 B 被否）；分支删除后第 3 项红的既有矛盾修复（维持残留）；机制回潮（锁/台账/状态机）；resolving-merge-conflicts 文件改动。

## 强约束

- 确认版对照物为不可修改规格源：`../2-prototype/skill.md`（SKILL.md 实文 v2）、`../2-prototype/verify-squash-merge.md`（门禁 CLI 契约 v2）、`../2-prototype/behavior.md`——执行 Agent 改的是产品不是尺子
- description 逐字不动（触发评测定稿资产；v1 触发成绩沿用）
- 四项硬检查判定逻辑与退出码语义（0=全绿/1=FAIL 或用法错）逐字不动
- 永不三则（--abort/改写已推送历史/门禁没绿宣称完成）维持；树净从严（含未跟踪）维持；零配置不落仓内文件维持
- 脚本仅 Node 内置模块；resolving-merge-conflicts 原技能文件零改动

## 自主边界

不用问，直接定：
- prose 具体措辞（对照物实文为准，含两处已确认裁量：已推送护栏罩住 branch -f 与 reset 双路径、删除路径注明需先拆 worktree）
- 前置校验实现细节与输出文案（CLI 契约 v2 为准）
- run-tests 断言风格、worktree fixture 造法（`git worktree add` temp 目录）
- design.md 迭代记录与 D-4 门槛移除的记录更新

必须停下来问：
- 技能装到非既有两路径之外的位置
- 脚本引入 Node 内置以外的依赖
- 改 description 或四项检查判定逻辑（本轮强约束锁定不动）
- 回加数字门槛或任何结构性扩张

## 读什么

- `../2-prototype/skill.md` —— SKILL.md 实文 v2（产品规格）
- `../2-prototype/verify-squash-merge.md` —— 门禁 CLI 契约 v2（前置校验输出形态、双 worktree 演练实测输出）
- `../2-prototype/behavior.md` —— 行为对照（5 变化行/5 边界值行/8 不变清单）
- 目标产品现物：`G:\GIT\AI_WorkFlow\parking-agents-manual\skills\workflow\local-mr-squash\`

## 验收条件

- AC-001: 修订落位与结构合法（quick-validate 退出码 0；run-tests 为 v2 断言全集——数字门槛断言已按 D-4 移除）
  - Verify: [A] `node C:/Users/parking/.agents/skills/parking-skill-creator/scripts/quick-validate.mjs C:/Users/parking/.agents/skills/local-mr-squash` → 退出码 0；`node C:/Users/parking/.agents/skills/local-mr-squash/run-tests.mjs` → 退出码 0 且输出含「双 worktree」「用法错」断言组
- AC-002: prose 目标显式化与措辞泛化：首行含「目标分支」；第 1 步含当前检出即目标、源≠当前检出语义；第 6 步含 `reset --hard` 与已推送护栏；v1 不变关键词全保持（五步四要素/溯源块三要素/门禁全绿才算完成/--keep 报告显形/永不三则）
  - Verify: [A] `node C:/Users/parking/.agents/skills/local-mr-squash/run-tests.mjs` → 退出码 0（v2 内容契约断言组）
- AC-003: 门禁前置校验拒假绿：在源分支检出上运行 → exit 1、输出含「当前检出就是源分支」用法错、无四项检查行；既有五态断言（用法错/FAIL/--keep/全绿/漂移）不衰变
  - Verify: [A] `node C:/Users/parking/.agents/skills/local-mr-squash/run-tests.mjs` → 退出码 0（四态回归 + 新增源检出态断言）
- AC-004: 双 worktree 演练走通：temp 仓 `git worktree add` 附属检出源 → squash+commit 后 `branch -f` 被拒 → 彼处 `git reset --hard` 前滚到目标 收口 → 门禁全绿 exit 0；单 worktree `branch -f` 收口路径照常全绿
  - Verify: [A] `node C:/Users/parking/.agents/skills/local-mr-squash/run-tests.mjs` → 退出码 0（双 worktree 用例）
- AC-005: 不变面回归：description 与 v1 逐字一致；--keep 只跳第 4 项且必须显形；B1 漂移被第 3 项捕获
  - Verify: [A] `node C:/Users/parking/.agents/skills/local-mr-squash/run-tests.mjs` → 退出码 0（description 逐字断言 + 既有断言保持）

## 挡着的事

- None.

## 残留风险

- 分支删除收口后门禁第 3 项红（v1 已知内部矛盾，本轮不修）— 错了会怎样：删除收口的合并无机械全绿判定，需 --keep 或先拆 worktree
- 已推送源分支的收口护栏仅 prose「停下问」，无机械拦截 — 错了会怎样：agent 忽视护栏移动已推送引用，与远端分叉，再推即改写历史
- 触发成绩沿用 v1（description 不动故未重跑）— 错了会怎样：宿主路由行为若漂移无新证据
- 数字门槛撤销（D-4，用户裁决推翻 v1 口径）— 错了会怎样：SKILL.md prose 膨胀失去硬闸，只剩 quick-validate 结构防线

## 访谈记录

### 第 1 轮（需求，1-interview）

| 问题 | 候选（带当时百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| Q1 收口路径修复 | A prose 改 reset --hard 50% / B 门禁第 4 项放宽 20% / C 双管 20% / D 不修走 --keep 10% | A | **A** |
| Q2 门禁假绿堵法 | A 用法错类 55% / B 第五项硬检查 25% / C 不加只靠 prose 20% | A | **A** |
| Q3 措辞泛化 | A 只正文 60% / B description 也改+重跑评测 25% / C 都不改 15% | A | **A** |

| 定了什么 | 档 | 为什么 | 用户 |
| --- | --- | --- | --- |
| 第 1 步目标显式化（当前检出即目标、源≠当前检出） | default | steelman 裁决治根必要条件 | 认可（走正规流程纳入） |
| run-tests 补双 worktree 演练 | default | 用户真实拓扑固化为回归资产 | 认可 |
| 旧契约留档，新契约为修订真源 | default | grailing 一 issue 一契约 | 隐含 |

### 第 2 轮（验收，3-contract）

| 问题 | 候选 | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| Q4 数字门槛 | A 维持 ≤45/≤8 60% / B 收紧 25% / C 去掉 15% | A | **C（推翻推荐）** |
| Q5 契约摘要落盘 | 确认 / 有要改 | 确认 | **确认** |

## 设计取舍

### D-1 收口路径：prose reset --hard vs 门禁放宽 vs 双管 vs 不修

选定 prose 改 reset --hard。理由：实测唯一常规全绿路径；门禁四项判定保持锁定（尺子不动）；与 branch -f 同风险类，护栏罩双路径。B（第 4 项放宽为祖先判定）被否——动锁定语义且源分支留 merge commit 历史噪声；C 双管被否——改动面最大；D 不修被否——--keep 逃生门当常态通道，门禁收口语义在用户拓扑名存实亡。

### D-2 前置校验档位：用法错类 vs 第五项 vs 不加

选用法错类。理由：沿契约既有用法错通道（未给 source 先例），契约文档只加一行，不算第五项检查——最小尺子改动。B 第五项被否——四项表变五项，锁定契约结构改动更大；C 不加被否——机械假绿保留，「帮我看看合完没」即踩中。

### D-3 措辞泛化程度：只正文 vs 含 description

选只正文。理由：零重评测成本；点名触发模式下 description 的「主干」是典型场景描述不构成路由障碍（v1 评测实证无 main 字样点名用例也命中）。

### D-4 数字门槛：维持 vs 收紧 vs 去掉

选定去掉（用户裁决，推翻维持推荐）。v1 的 ≤45 行/≤8 步断言随本轮移除；结构防线留 quick-validate。代价记入残留风险。
