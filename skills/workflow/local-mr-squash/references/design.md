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

溯源粒度：冲突裁决降为 commit message 摘要级（R3 推翻逐条台账）；中断恢复靠 git 现场 + 重推（R3 接受的残余风险）。

## 验收条件

| 编号 | 条件 | 类型 |
| --- | --- | --- |
| AC-001 | 技能落位与结构合法（目录、frontmatter、脚本就位），quick-validate 退出码 0 | script |
| AC-002 | 门禁脚本四态行为：用法错 exit 1 / FAIL exit 1 / --keep 跳第 4 项 / 全绿 exit 0 / squash 后源前进被捕获变红 | script |
| AC-003 | SKILL.md 内容契约：五步要素（保双方意图/不相容按合并目标裁决并记取舍/不发明行为/永不 --abort）、溯源块三要素（hash 清单/冲突裁决摘要/已跑检查）、门禁全绿才算完成、--keep 显形于报告 | script |
| AC-004 | 量级门槛：SKILL.md 正文 ≤45 行、步骤 ≤8 条 | script |
| AC-005 | fixture 自动演练：temp git 仓双侧改动+冲突 → 按七步流程 → 门禁全绿收口 | script |
| AC-006 | 触发准确（按 D-3 显式点名口径重释）：点名用例命中 local-mr-squash；未点名 squash 用例不命中；冲突用例归 resolving-merge-conflicts，双向无误抢 | manual |

AC-006 说明：grilling 契约原文按自动触发口径写（「squash 合过来」类用例命中本技能）；D-3 定夺后口径反转——未点名用例应不命中。人工判读以 D-3 口径为准。

## 迭代记录

| 日期 | 改了什么 | 轮次结果 | 拆分建议 |
| --- | --- | --- | --- |
| 2026-09-11 | 初铸：七步 SKILL.md（显式点名 description）+ verify-squash-merge.mjs（prototype 参考实现原样采用）+ run-tests.mjs 回归 43/43 绿 + quick-validate PASS | 触发评测首轮：20 题 × 3 探针（同宿主 subagent），train 13/13、test 7/7 全对，误触发 0；点名用例 9/9 命中本技能，未点名 squash/冲突用例零误抢，q12/q13 冲突用例 3/3 归 resolving-merge-conflicts。AC-006 人工判读 PASS（按 D-3 口径） | 无（结构审查四信号未跑：输出评测循环不在契约验收范围） |
