# 影响面扫描: aes-merge-worker 落地（#126）

判据：**改完之后，这个程序在哪些地方跑起来不一样了？每一处不一样，谁会看见、谁会受影响？**

范围锁定见 manifest.goal_oneline。逐面结论如下，判「无」的也写出来。

## 逐面结论

| # | 影响面 | 有/无 | 具体差异 | 谁受影响 | 对照物 |
| --- | --- | --- | --- | --- | --- |
| 1 | 用户可见界面 | **无** | 出站队列积压只经 CLI（`outbox status` / `gate` 警告行）暴露；星图与 700×1000 竖屏工作台读的 `status.json` 字段集不变，`build-portrait.mjs` 的 SHA 锁不受触碰 | 无 | 不出 mock.html |
| 2 | 可观察行为 | **有** | ① `close` 不再内联调 gh，registry 落账即成功；② 新增 `outbox flush` / `outbox status`；③ `gate` 在 outbox 有 pending 时输出警告行；④ `resolveMergePolicy` 结果新增 `depthTier`；⑤ merge 时点新增血统校验；⑥ 新增 `review-return` 路由命令 | 编排 Agent、merge-worker lane、总管；既有 close 调用方 | `behavior.md` |
| 3 | 可运行输出 | **有** | 新增两条子命令的终端输出；`close` 返回体新增 `outbox` 段；`gate` 多一行警告；用法串新增条目 | 跑 master.mjs 的人与 Agent | `example-run.md` |
| 4 | 对外接口报文 | **有** | ① 新增 `aes.worktree-board.outbox-entry/v1`（出站条目）；② 新增 flush 报文；③ `resolveMergePolicy` 结果加 `depthTier` 字段；④ 消费 `aes.issue-worker.review-return/v1`（协议本身 #83 已定，本票只做路由落地） | merge-worker、总管、任何读 gate/policy 结果的消费方 | `api-mock.md` |
| 5 | 用户配置 | **有（轻）** | `AES_WORKTREE_BOARD_REPO_ROOT` 双向边界首次文档化（偏差 4）：worker 侧必须设、selftest 侧必须不泄漏；outbox 落盘位置沿用 runtime-v4 目录，不新增配置项 | 起 worker 的编排 Agent、跑 selftest 的人 | `behavior.md` 配置差异节 |
| 6 | 历史兼容性 | **有** | `masterClose(options.gh)` 注入点语义变化——4 处 selftest 桩（`selftest-v4.mjs:563/1000/1006/1127`）依赖「close 内部会调 gh」与「幂等 close 不得再调 gh」；`deliveries[].issueClose` 结构需保持可读；卡死的 `job-69-111801` 必须能被新路径解开 | 既有 selftest 场景、既有 registry 数据、trajectory replay | `behavior.md` 不变清单 |
| 7 | 架构与依赖 | **有** | 新增技能目录 `.agents/skills/aes-merge-worker/`（新 lane）；`master.mjs` 新增对出站队列模块的依赖（新模块，零依赖 `.mjs`）；依赖方向 master.mjs → outbox，outbox **不反向**依赖 registry 写路径 | 仓库结构、后续维护者 | `diagram.html` 架构视图 |

## 结论

七面中 **六面判「有」**，一面判「无」且理由已写明。出四份对照物：
`behavior.md`、`api-mock.md`、`example-run.md`、`diagram.html`。

## 扫描时注意到、但按锁定范围外置的差异

以下差异真实存在，但 1-interview 已裁定不在本票：

- **基线红表达位**（偏差 8）→ #125（aes-qa lane），本票 prose 只写 workaround 指引；
- **分支 ref 层事后对账**（偏差 7）→ #134，blocked by 本票；本票只做 merge 时点校验；
- **陈旧现场机械自检**（偏差 1/2）→ 不入本票，prose 只写「lane 启动前置：现场自检」一节；
- **MUST_FIX 打回全链路 live 轮**→ 拆 live 票 blocked by 本票；本票 AC 只留 happy path 一轮。
