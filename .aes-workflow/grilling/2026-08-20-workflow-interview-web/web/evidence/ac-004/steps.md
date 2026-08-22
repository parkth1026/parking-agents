# AC-004 实点步骤记录

- 时间：2026-08-23（Asia/Hong_Kong）
- 浏览器：真实 headed Chromium（Playwright CLI named session `wiweb`）
- 页面：本技能 `server.mjs` 提供的 loopback 单页；HTTP/WS 均使用真实 runtime
- 视口：1440 × 1000

## 步骤与观察

1. 打开 server 首跳 URL，浏览器被 303 导航到不含 key 的 `/`。
   - 看到三阶段面包屑、`开放歧义 2`、连接状态 `在线`。
   - 同一 `browser-r1` 内看到 ask / default / confirm 三档；右栏有两条已锁定结论。
   - 附件 iframe 成功呈现确认版 `diagram.html`。
2. 在 Q1 点击 `Other… 自由输入`，填入「自定义：保留 48h 缓冲，但重开必须先吸收未消化提交」，并点击 C1 `确认`。
   - 未完成必答前提交按钮 disabled；完成 Other 文本与 confirm 后按钮可用。
   - 截图：[01-three-tiers-other.png](01-three-tiers-other.png)。
3. 刷新页面。
   - Other 文本原样恢复；C1 显示 `已确认 ✓`；证明未提交草稿由 localStorage 恢复。
4. 点击 `提交本轮，生成追问 →`。
   - POST `/api/submit` 返回 200；页面显示 `SUBMITTED · 已锁定`，所有控件 disabled。
   - 截图：[02-submitted-locked.png](02-submitted-locked.png)。
5. 发布 `browser-contract-r2`，切换到 `契约视图`。
   - 只显示契约主视图；三节正文与每节依据正确呈现，初始只见 `确认交付标准 ✓` / `需要修改`。
6. 点击 `需要修改`，填写「需修改：把跨天恢复明确写成先扫描、后吸收、再发布下一轮」，刷新后重新进入契约视图。
   - 修改文本原样恢复。
   - 截图：[03-contract-revise-draft.png](03-contract-revise-draft.png)。
7. 点击 `确认交付标准 ✓`。
   - POST `/api/submit` 返回 200；页面显示「此契约轮次已经提交并锁定」。
   - 截图：[04-contract-confirmed.png](04-contract-confirmed.png)。
8. 最终读取浏览器 console：`0 Errors, 0 Warnings`。

## 对照结论

逐条匹配 [expected.md](expected.md)，AC-004 通过。实点过程中曾发现 `hidden` 被作者样式覆盖，
导致双视图叠加；修复 `[hidden] { display: none !important; }` 后从刷新步骤起完整复测通过。
