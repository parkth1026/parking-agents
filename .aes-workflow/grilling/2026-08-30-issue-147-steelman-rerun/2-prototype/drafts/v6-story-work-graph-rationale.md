<!-- draft v6 rationale | 2026-08-31
     依据：P14 业务确认
     状态：Web draft; browser QA blocked -->
# v6 · 业务与页面映射

v6 是同一 Story 的双图只读原型，不是 workflow-story-map 实现。沿用已选择的 v5 双 Tab / Map-first 和 AES Console 风格；不重新开视觉方向投票。

## 保留

- Story header / 当前关键缺口 / 主定位动作 / 可并行事项；
- Discovery、Delivery 一级 Tab，各自完整 Graph；
- AES 暖中性色、低阴影、简洁按钮、状态墨色与显式 focus；
- Map/List/search、筛选、一跳聚焦、来源和证据第二层。

## 纠正

| 已确认依据 | v6 呈现 |
| --- | --- |
| B1/B2/E8 | 默认真实 current dossier；历史图单独切换；真实 Delivery 明确 NOT_CONNECTED / 0 VERIFIED |
| B3 | SKILL/RUNTIME 两个 repo 级 Lane；Web/Core 只是仓内 Workstream |
| B4/B6 | Inspector 三轴、稳定票、Attempt/subject；历史证据不覆盖 |
| B7/B8 | QA/Review actor 与实现者分开；Review 为 Gate/Receipt，不固定造 Review 票 |
| B9/B10 | candidate 通过、integration 刚形成、full-suite满足三种独立快照 |
| B13/B14/B20 | Contract不变规则独立解释；公共变更模拟链可实际跳到 decision/Contract@3/new wave 并返回原位置 |
| B15 | Registry degraded 快照，无可启动 Frontier、不能 done |
| B19/P12 | 所有按钮只定位、筛选、查看或导出；无 claim/dispatch/retry/approve/submit |
| B21/E11 | done 与 optional blocked 同屏；owner/原因/影响/Workflow恢复说明常显 |

## 样本

真实数据依据本地 API 摘录及当前 dossier，未声称本轮刷新 GitHub。完整标题存 rawTitle，图卡简称为 DERIVED；历史 assignee 与 runtime owner 分开。评论 overlay 只作作者演进，不冒充 native dependency。

六个 SIM 快照：QA取证、candidate通过、integration缺证、required done/optional debt、Contract@3回流、Registry degraded。它们是独立时间点，不是按钮执行了真实业务。文档补充等新增细节是显式模拟，不是用户新增裁决。

## 未宣称覆盖

本轮没有完整模拟 SamplePack 编辑、Human签发/撤销、quorum收集、授权Waiver流程，也不应该在只读Web里实现这些命令；其必要观察字段/规则在证据说明和确认业务文档中。真实执行、双Tracker等价、崩溃恢复、性能、大图规模和屏幕阅读器均未验证，后续 Contract 必须保留相应验收义务。

## 交付状态

53项静态/样本检查通过；浏览器与视觉QA被 Browser setup 失败阻塞，独立Playwright许可待答。详见 ../design-qa.md。未生成根 mock.html，未完成2-prototype门禁，未进入Contract。

