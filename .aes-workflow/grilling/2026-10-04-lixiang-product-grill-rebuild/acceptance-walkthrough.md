# 验收走查清单

> **验收执行口径（2026-10-05，用户授权）**：用户原话「你用 subagent 帮我验收 不用等我」——授权执行 Agent 以 subagent 代验收。路由判定＝每输入 3 个独立探针（技能清单从磁盘重扫，反映 symlink 换链后的真实加载面：79 技能、含 lixiang-product-grill、不含 lixiang-ceo-grill）；对话行为＝子代理模拟双回合；抽样＝用户目标指令授权的 crypto 随机机制。**subagent 无法覆盖的残余**：真实 ZCode App 交互式新会话的宿主路由器实测——用户已明示不等待，如日后发现偏差回会话修复。

## AC-003 步骤 0：挂载确认（实测 2026-10-05）

- [x] `ls ~/.agents/skills/ | grep lixiang` → 只有 `lixiang-product-grill`（旧链已删，实测）
- [x] frontmatter → `name: lixiang-product-grill`、`description: lixiang-product-grill / 李想产品复盘`（实测）

## AC-004 [C] 走查（对照 example-run 场景 4；subagent 代验收）

1. 输入：`用 lixiang-product-grill 盘一下「园区 3D 编辑器」`
   - [x] 触发：3/3 探针路由到 lixiang-product-grill（2 条协议有效＋1 条全角冒号偏差，路由判断全体一致）
   - [x] 开场是**倒序菜单**（模拟回合 1 实测：①单维度 1-3 轮 ②模块 ③全量垫底，14 维度全列）
   - [x] 菜单含「顺序不变：产品战略 → 从0到1 → 从1到10，禁止反向」原句
   - [x] 只问一个问题（选范围）
2. 答：`只盘定价`
   - [x] 第二回合 `【维度：定价（10 讲）】（弹药页：S10-定价）`（模拟回合 2 实测）
   - [x] 标准句**逐字引文+讲次**：5 条定价标准句逐字（产品价值公式/心理价位三分类/20% 毛利率等）
   - [x] 引用用户的思考：《方向文档》原话逐字引用后对照
   - [x] smart-skip：合格线「竞争策略」半项先出示对照裁定，只对缺口发问
   - [x] 附带核验：复述成 ✓、红旗点名引题库原文 ✓、校准式认可 ✓、弹药引 S10 案例链（32 万 8/33 万销量峰/主力战场）✓、收在一个缺口主题 ✓
3. 另一新会话输入：`用李想方法论盘一下 园区 3D 编辑器`
   - [x] 按裁决 A 预期**会触发**：3/3 探针（协议全有效）路由到 lixiang-product-grill，理由一致（该请求即李想产品复盘用途；ceo-copilot 让渡）
   - [x] 触发后为 **16 讲版**：技能尺子整体即 16 讲（题库/archive/菜单 14 维度全部出自 16 讲；旧九模块名与签名句经黑名单断言在三文件零残留——run-tests [附注护栏] 绿）

## AC-001 [C] 抽样（已执行：用户目标指令授权的随机代抽）

- [x] 抽样维度：**产品标准（05）、体验（07）、流程（13）**（来源：crypto.randomInt 分层随机，2026-10-04T20:51Z，非执行 Agent 自选）
- [x] 逐字核对结果：**15/15 PASS**——全部标准句规范化后逐字且**唯一命中**标注讲次 archive 文件
- [x] diff 抽讲：**08-用户：怎样挖掘用户的真实需求？.md**，与 product-research 源文件 `cmp` **零差异**
- 复验脚本：`evals/lixiang-product-grill-workspace/scratch/verify-sample-c.mjs`（scratch 不入库）

## 本轮已由脚本完成的核对（供参考，不必重跑）

- run-tests 15 组 150 check 全绿；wiki validator 10.00 PASS 断链 0；ceo-copilot 95 check 绿；discovery/install 回归 PASS；打包 65 条目无 references/archive；70 组引文-讲次对双跳逐字验证 0 违例；19 篇 archive 与源文件 sha256 逐篇零差异（构建期全量核对，08 讲 diff 为独立复验）

## 验收结论

AC-001 至 AC-006 全部 Verify 有执行证据并通过（AC-003 按用户裁定 A：误触发 0.20 接受现状、残留风险落档 design.md「触发评测结论」）。验收完成于 2026-10-05，五笔本地提交：79cccbc / 3369a4a / 4633ee2 / 5b521bc / abded41（未推送）。
