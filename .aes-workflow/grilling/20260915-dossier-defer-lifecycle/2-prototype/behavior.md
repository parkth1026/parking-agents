# 行为对照表: 20260915-dossier-defer-lifecycle

**确认版·锁定。** 执行 Agent 改的是产品，不是这份对照表。
用户确认：2026-09-15

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | `session.mjs round` 收到 ask 行 `user_choice:"defer"`（+ user_verbatim 记暂缓原因） | 不在选项集内的值——校验拒绝或语义歧义（defer 无法落盘） | 放行；pct 校验不变；dossier 渲染为「⏸ 暂缓 · 原因=verbatim」 |
| 2 | `session.mjs round` 收到 default/confirm 行**缺 `user` 字段** | 静默通过（schema 只查 item） | 通过但** stderr 发一行非阻断警告**：`[round] default 行缺 user 反应——dossier 将渲染为「未记录反应」，请在窗口期后补记（'未反对'/'确认'/翻案文本）` |
| 3 | dossier 投影遇到 ask 行 `user_choice:"defer"` | （形态不存在） | 该问题进入开放态；同 q_id 后续轮落 choice 后标「已由 rN 承接」并关闭 |
| 4 | dossier 投影遇到 default 行 `user` 为长文本 | 一律渲染为 veto（翻案）——补录性长文本被误标 | 长文本仍渲染为翻案文本，但补录性内容按约定值归位：补录「确认」语义必须写 `user:"确认"`，原话进 item/triggered_by |
| 5 | 同一 q_id 跨多轮（含重发） | 按 stage#round 分组割裂展示，无关联 | 聚合为生命周期线：各轮状态迁移 + triggered_by 因果标注 |

### 边界值行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| B1 | ask 行 `user_choice:"defer"` 但**无任何后续同 q_id 轮** | — | 保持开放态渲染「⏸ 暂缓（未被承接）」；计入 openAmbiguities |
| B2 | 某选项 key 恰好叫 "defer" | 语义冲突 | "defer" 为保留值，以 defer 语义优先并警告（建议选项 key 禁用该词） |
| B3 | 历史 rounds 行（无 user / verbatim 无 choice） | 各类混淆渲染 | 向后兼容：default 无 user →「未记录反应」（诚实模糊态）；ask 有 verbatim 无 choice → 旧形态仍渲染 custom（不回溯改判为 defer——数据里没有 defer 标记就不猜） |
| B4 | `user:"未反对"` 但后续轮翻案同 q_id | — | 生命周期线如实展示「默认生效 → 翻案」迁移（不抹除默认历史） |

## 不变清单

| 不变项 | 谁在依赖 |
| --- | --- |
| rounds.jsonl append-only（只用 round 脚本写、不 Edit/Write 直改） | 全部流程纪律 |
| pct 校验（单选语义 100±2）、tier/stage/round 必填校验 | round 命令既有契约 |
| openAmbiguities 统计口径（本就排除 default 行） | dossier 摘要 |
| manifest.json 只由 session.mjs 写 | 编排器纪律 |
| 轮次卡片字段集（question/known_facts/options/pct/triggered_by/cross_repo_boundary） | dossier 渲染与 web 载体 |
| export-dossier.test.mjs 既有用例语义（新用例只增不改断言） | 测试基建 |

## 配置差异

无（整节省略——不动任何配置面）。
