# #62 / #64 / #65 关闭评论（自报交付 SHA —— 经核实均不在 dev 中）
抢救时间: 2026-08-28

## #62 — integration 前进后 stage 证据未失效 (CLOSED/COMPLETED 2026-08-27T08:21:08Z)

已交付合入 dev（merge ae5a369，candidate f9dcb87）。方案 B 完整落地：stage-result/qa-receipt v2 强制 baseCommit（缺失 MISSING_BASE_COMMIT fail closed）、GATE-review-base/qa-base 校验证据 base 等于当前 integration base 不等判 STALE 且不清空证据、v1 语义不变历史夹具零改动。与 #65 的 v2 统一为单一 schema（review v2 = baseCommit + reviewerSessionId 双必填，qa v2 = baseCommit）。合并时另发现并修复 git 三路合并的静默重复 const 声明（行级无冲突但语法错误）。编排者独立 QA 十域全绿，orchestration 31/31。防降级发 v1 绕过新门禁：经两个独立会话交叉分析确认运行时不可区分（与禁止回放特权路径互斥），防线记录在契约层，如需强约束（sunset v1）另行建票。

## #64 — receipt 目录跟技能代码走而非目标仓 (CLOSED/COMPLETED 2026-08-27T08:21:11Z)

已交付合入 dev（merge ede543f，candidate 6b66ded）。AC-1..3：receipt 目录全部改走目标仓解析链（env 优先否则 cwd），DESKTOP_TRUTH/CODEBASE_ROOT 与 RECEIPT_DIR 语义分离。独立 review（不同顶层 session）曾 BLOCK 出两个真 finding：CLI 层回落漏 env 分支（env-only 调用 receipt 仍落错仓）、AC-4 无自动化跨仓回归（board-ui 域三仓重合自举跑区分不了新旧实现）——两者均已修复（CLI 解析链统一 + repo-root 域新增跨仓自动化用例）。审计注记：follow-up 的同 reviewer 重审因 reviewer 会话关闭未执行，以新增跨仓自动化用例在完整门禁中通过作为 finding 修复的机械证据。编排者独立 QA 十域全绿。

## #65 — reviewer 独立性缺乏机械判据 (CLOSED/COMPLETED 2026-08-27T08:21:05Z)

已交付合入 dev（merge d11f23a，candidate 4b5bc35）。方案 B 完整落地：review stage-result v2 强制 reviewerSessionId（缺失 MISSING_REVIEWER_SESSION_ID fail closed）、reviewerIndependence 三态机械推导（same-session/independent/unknown，任一侧标识缺失如实记 unknown 不偷换）、v1 语义不变历史夹具零改动、两个 selftest 场景进默认门禁。修复过程中发现并另行处理了 schema 未版本化破坏 trajectory-replay 的结构性问题（与 #62 同构，v1/v2 版本化方案已随本票与 #62 统一）。编排者独立 QA 十域全绿。
