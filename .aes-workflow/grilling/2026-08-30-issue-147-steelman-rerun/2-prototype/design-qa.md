# Design QA · Story Work Graph v6

final result: blocked

## 当前门禁

- v6 HTML 已生成，53 项有限静态/样本检查通过。
- **没有 v6 浏览器截图、真实点击结果或源图并列对照。不能交付为视觉验证通过。**
- Browser 插件入口已完整读取；按规定通过 Node REPL 导入 browser-client 并选择 iab，setup 在导入时失败：Importing module "node:process" is not allowed in node_repl。
- 没有绕过 Browser 安全限制或替换插件代码。已向用户非阻塞询问独立 Playwright 浏览器测试许可，尚未得到回答。
- Codex open_in_codex 返回 queued；只代表预览请求排队，不证明已经打开或渲染。
- 当前不运行 standalone Playwright，不把旧 v5/P13 图的检查当 v6 证据。

## 比较目标

- Source visual truth：drafts/v5-dual-tab-selected-target.png（已查看）及 drafts/v5-story-work-graph.html（完整代码目标）。
- 视觉/交互继承来源：G:/GIT/AI_WorkFlow/aes-workflow/skills/engineering/aes-using-workflow/console/template.html。
- 业务覆盖源：P14 已确认 behavior.md、api-mock.md、example-run.md、diagram.html、diagram-detail.html。
- implementation：drafts/v6-story-work-graph.html。
- 实现截图路径：不存在 / NOT_RUN。
- 主目标 CSS viewport：768×1080；待补 390 / 1440 宽度、200% zoom。
- density / 同状态截图归一化：NOT_RUN。
- full-view comparison：BLOCKED；focused-region comparison：BLOCKED。

## 五类 fidelity surface

| 面 | 当前事实 | 结论 |
| --- | --- | --- |
| Typography | 代码沿用 AES display/body/mono fallback，正文与状态字号待渲染核对 | NOT_RUN |
| Spacing/layout | 两大 Tab、Map-first、受控画布滚动、即时 Inspector；实际溢出/遮挡未验证 | NOT_RUN |
| Colors/tokens | 使用 AES warm neutral / accent / semantic-ink；颜色与焦点实际对比度待验证 | NOT_RUN |
| Image/assets | 无装饰栅格资产；SVG 是真实数据关系绘图，不替代图像素材；实际线/节点重叠待验 | NOT_RUN |
| Copy/content | 历史完整标题/简称/assignee/owner、三轴/subject/Gate、optional debt 已做静态分层 | 浏览器可读性 NOT_RUN |

## 已完成的有限检查

运行 evidence/webp14-v6/check-v6.mjs：53 checks PASS。

覆盖：JS syntax、零外链脚本/网络、REAL 默认 current Discovery、current 非 tracker membership、历史 13节点/12成员/7依赖、保留原始标题、历史 assignee 不充当 runtime owner、REAL Delivery 为空；六个 SIM 快照前缀/端点/三轴/Frontier/actor separation；candidate 不等于 integration；新集成缺证；required done 与 optional blocked 同时保留；新 Contract stale；Registry fail-closed。

这些只检查内嵌原型样本和代码结构，不证明生产 reducer、真实 Runtime、浏览器交互、UX 效率或 a11y 合规。

## 下一轮真实浏览器验证清单

1. 同一 768×1080 / DPR1 捕获 v5 与 v6 对应 Tab；业务差异明确属于 P14 修正，不能把旧错误语义当视觉金标准。
2. REAL current / historical / Delivery empty；历史 List 完整标题、7条 dependency、可选 membership/comment。
3. SIM 六快照：主动作解释、并行队列、三轴、candidate/integration、optional debt 常显。
4. 点击节点后详情立即可见；关闭 / Escape 焦点可恢复；Tab trap 与键盘导航。
5. 跨图四步 trace：实际切换图、对象可见、完整恢复来源 Tab/filter/selection/scroll。
6. Map/List/search/empty/focus/zoom/export；检查当前导出带 provenance 且无领域写入。
7. 390/768/1440 宽度无文档级水平溢出；图本身允许局部平移/滚动；原生 dialog 内内容可达。
8. Console errors / pageerrors / 非预期网络；零领域命令。
9. 并列源图与渲染图后记录 P0/P1/P2，修复、重截、复验；全部消除才可 final result: passed。

## 历史

- 本轮：静态样本 PASS；Browser setup blocked。没有作出任何像素/交互通过宣称。
- v5 历史 QA 与 P13 静态业务图渲染不能复用为 v6 Web 通过证据。

