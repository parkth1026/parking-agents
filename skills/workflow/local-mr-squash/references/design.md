# design: local-mr-squash

## 意图与触发场景

把「本地 squash 合并」从会话临场发挥固化为可重复流程：七步 prose（内嵌 resolving-merge-conflicts 五步语义合并思想 + squash 规则）+ 零配置硬门禁脚本 `scripts/verify-squash-merge.mjs`。语义裁决交给 LLM 纪律，机械收口交给脚本（树净/单笔/全包含/已收口四项），门禁非绿不许宣称合并完成。

触发模式：**仅显式点名**。2026-09-11 用户定夺（goal 追加约束）：本技能不得被 AI 自动触发，必须准确引用（用户原话出现 local-mr-squash / $local-mr-squash）才加载；未点名的合并分支、squash、解决冲突请求不适用（冲突解决走 resolving-merge-conflicts）。该定夺推翻 grilling prototype v2 的自动触发式 description——prototype 仍是历史规格源，产品按新口径。

## 设计取舍

| # | 决策 | 备选 | 为什么 |
| --- | --- | --- | --- |
| D-1 | 最小形态：prose + 门禁脚本 | 机制版（状态机/policy/台账） | git 自身即过程状态持久层（MERGE 态/暂存区/reflog），机制版每个组件都有更轻等价物；本会话实证机制版未参与任何真实价值产出 |
| D-2 | 门禁树净从严（含未跟踪文件） | 只看已跟踪改动 | 门禁语义=「合并完成=现场干净」，口径纯粹性优先；正当未跟踪目录挡门属故意设计 |
| D-3 | 显式点名触发 | description 主动招揽自动触发 | 合并是重流程动作，用户要确定性控制入口（2026-09-11 goal 追加）；代价：未点名时无流程保护，靠用户自觉点名 |
| D-4 | 五步思想文本内嵌，不 import 原技能 | 运行时依赖 resolving-merge-conflicts 文件 | 原技能保持独立场景零改动；内嵌使本技能自包含 |
| D-5 | 双 worktree 收口改彼处 `git reset --hard`（2026-09-12 v2） | 门禁第 4 项放宽为祖先判定 / 维持彼处 merge | 2026-09-11 temp fixture 实测：`branch -f` 被检出保护拒、彼处 merge 留 merge commit 致第 4 项永红，reset --hard 是唯一常规全绿路径；放宽动锁定的四项判定语义（契约 D-1 候选 B 被否） |
| D-6 | 门禁加「当前检出==源」用法错前置校验（2026-09-12 v2） | 第五项硬检查 / 不加 | 合并前在源检出跑门禁四项同义反复假绿（实测 exit 0）；沿契约既有用法错通道（未给 source 先例）只加一行，不算第五项（契约 D-2） |
| D-7 | 数字门槛断言移除（≤45 行/≤8 步，2026-09-12 v2） | 维持 / 收紧 | 用户裁决推翻 v1 维持推荐（契约 D-4/Q4 选 C）；结构防线留 quick-validate；代价记入契约残留风险——prose 膨胀失去硬闸 |

溯源粒度：冲突裁决降为 commit message 摘要级（R3 推翻逐条台账）；中断恢复靠 git 现场 + 重推（R3 接受的残余风险）。

## 验收条件

| 编号 | 条件 | 类型 |
| --- | --- | --- |
| AC-001 | 技能落位与结构合法（目录、frontmatter、脚本就位），quick-validate 退出码 0 | script |
| AC-002 | 门禁脚本状态回归：用法错 exit 1（无参 + v2 新增源检出态，均不输出四项检查）/ FAIL exit 1 / --keep 只跳第 4 项且必须显形 / 全绿 exit 0 / squash 后源前进被「全包含」捕获变红 | script |
| AC-003 | SKILL.md 内容契约：五步要素（保双方意图/不相容按合并目标裁决并取舍/不发明行为/永不 --abort）、溯源块三要素（hash 清单/冲突裁决摘要/已跑检查）、门禁全绿才算完成、--keep 显形于报告；v2 目标显式化（首行泛化「目标分支（dev/main 等长命分支）」、第 1 步当前检出即目标+源≠当前检出、第 6 步彼处 reset --hard+已推送护栏+删除路径 worktree 前置） | script |
| AC-004 | 双 worktree 演练：temp 仓 `git worktree add` 附属检出源 → squash+commit → `branch -f` 被拒 → 彼处 `git reset --hard` 前滚到目标 → 门禁全绿 exit 0；单 worktree `branch -f` 收口照常全绿（v2 替换 v1 量级门槛行——D-7 移除数字断言） | script |
| AC-005 | 不变面回归：description 与 v1 逐字一致（触发评测定稿资产）；fixture 单 worktree 演练：temp git 仓双侧改动+冲突 → 按七步流程 → 门禁全绿收口 | script |
| AC-006 | 触发准确（按 D-3 显式点名口径重释）：点名用例命中 local-mr-squash；未点名 squash 用例不命中；冲突用例归 resolving-merge-conflicts，双向无误抢 | manual |

AC-006 说明：grilling 契约原文按自动触发口径写（「squash 合过来」类用例命中本技能）；D-3 定夺后口径反转——未点名用例应不命中。人工判读以 D-3 口径为准。

## 迭代记录

| 日期 | 改了什么 | 轮次结果 | 拆分建议 |
| --- | --- | --- | --- |
| 2026-09-11 | 初铸：七步 SKILL.md（显式点名 description）+ verify-squash-merge.mjs（prototype 参考实现原样采用）+ run-tests.mjs 回归 43/43 绿 + quick-validate PASS | 触发评测首轮：20 题 × 3 探针（同宿主 subagent），train 13/13、test 7/7 全对，误触发 0；点名用例 9/9 命中本技能，未点名 squash/冲突用例零误抢，q12/q13 冲突用例 3/3 归 resolving-merge-conflicts。AC-006 人工判读 PASS（按 D-3 口径） | 无（结构审查四信号未跑：输出评测循环不在契约验收范围） |
| 2026-09-12 | v2 目标绑定修订（契约：`.aes-workflow/grilling/2026-09-11-local-mr-squash-target-binding/3-contract/contract.md`）：SKILL.md 首行泛化「目标分支（dev/main 等长命分支）」、第 1 步目标显式化硬前置、第 6 步收口改彼处 reset --hard+已推送护栏+删除路径 worktree 前置；门禁加「检出==源」用法错前置校验、第 4 项 FAIL 提示改 reset --hard；run-tests 断言升 v2（新增双 worktree 演练、源检出态、description 逐字断言；移除数字门槛断言——D-7 用户裁决）；description 逐字不动 | 待跑（本轮落位后 quick-validate + run-tests 双验收） | 无（四项判定逻辑与退出码语义锁定不动） |
