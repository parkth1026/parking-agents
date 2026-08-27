# 影响面扫描: 2026-08-27-aes-issue-worker-流程重梳（终版，随 round 9 定稿更新）

判据：改完之后，这个程序在哪些地方跑起来不一样了？每一处不一样，谁会看见、谁会受影响？

| 面 | 有/无 | 具体差异 | 谁受影响 | 对照物 |
| --- | --- | --- | --- | --- |
| 用户可见界面 | 无 | board 不渲染流程内部；SKILL.md 是 prose | — | — |
| 可观察行为 | 有 | worker 闭环重构：aes-qa 循环轮/最终轮、simplify 条件触发、单 commit、code-review 移至 aes-merge-worker、打回后 aes-qa 回归、hub-and-spoke 路由、人参与 lane 角色位 | owner session、aes-merge-worker（待建）、总管 | behavior.md（9 变化行） |
| 可运行输出 | 无独立差异 | 无新命令、退出码不变；work-order stdout 零改动（Q1 撤销） | — | — |
| 对外接口报文 | 有 | 新增 `aes.issue-worker.review-return/v1` 打回报文；work-order/v1 零改动 | worker（消费打回）、aes-merge-worker（产生打回） | api-mock.md |
| 用户配置 | 无 | 不动 board.config.json、环境变量、CLI 选项 | — | — |
| 历史兼容性 | 有 | registry/terminal/receipt schema 全部不动，selftest-v4 既有断言天然全绿；「Master host 兼任合并」的旧角色表述废止需同步 board 文档 | board SKILL.md/design.md 读者 | behavior.md 不变清单 + 已废止裁定节 |
| 架构与依赖 | 有 | hub-and-spoke：aes-merge-worker（待建）与人参与 lane（for-human 模式）挂总管下平级；worker→code-review 旧组合边删除；simplify 新组合边 | 技能依赖图、三份 SKILL.md | diagram.html 架构视图 |

三份确认版对照物：behavior.md、api-mock.md、diagram.html（架构 + 双泳道流程同住）。
过程草稿与逐版用户意见见 drafts/（v1→v7 behavior、v1→v2 api-mock、v1→v6 diagram）。
