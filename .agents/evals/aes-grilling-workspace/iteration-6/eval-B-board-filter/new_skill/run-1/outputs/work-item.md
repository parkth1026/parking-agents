---
schema_version: 1
protocol: 1.3.0
id: wi_01J9XQK7M3RB5N0PZC6VD8H2WT
short_id: 9xqk7m3r
home_repository: "https://github.com/parkth1026/parking-agents.git (team-board 子目录：.claude/skills/aes-grilling-workspace/iteration-6/eval-B-board-filter/new_skill/run-1/workdir)"
kind: feature
title: "团队看板支持按负责人筛选任务"
status: proposed
created_at: 2026-08-07T13:20:00Z
branch_or_pr: "feature/board-assignee-filter"
---

# 团队看板支持按负责人筛选任务

## 原始请求

> team-board 这个看板想加一个按负责人筛选任务的功能。帮我先把需求理清楚，最后给我一份可以直接交给执行 agent 的 goal contract。先不要写代码。

## 目标

团队看板能按负责人筛选卡片，筛选结果在刷新后保留，也能通过链接分享给同事看到相同结果。

## 范围

做：在看板顶部工具栏加一个负责人筛选控件（含"全部"选项）和一个"清除筛选"控件；选中负责人后三列看板只显示该负责人的卡片；筛选状态体现在页面 URL 上，刷新或用同一链接在新会话打开都看到相同结果；筛选结果为空时显示空态文案，而不是空白列。

不做：不支持同时选择多个负责人；不新增按状态或标签筛选；不改动卡片详情的内容或展示字段；不引入账号级的服务端持久化（即"服务器记住某个用户上次筛选了谁"这类跨设备但不通过链接传递的持久化）。

## 强约束

- 未使用筛选（URL 无 `assignee` 参数）时，看板的展示与现状完全一致：三列布局、卡片文案格式 `${title} — ${assignee}`、`/api/tasks` 的返回结构和字段不变。
- 不修改 `/api/tasks` 的现有响应形状；筛选在前端对已获取的任务列表做过滤，不新增服务端查询参数。
- 不引入新的运行时依赖（当前仓库前端为原生 HTML/CSS/JS，无框架、无浏览器自动化测试依赖）。

## 读什么

- `docs/testing.md`：本仓库的测试与人工验证约定，页面改动目前没有截图对比或视觉回归工具。
- `workflow/board-assignee-filter/mock.html`（本任务确认版界面对照物）：筛选控件位置、清除筛选按钮、空态文案三处改动点均已标注。
- `workflow/board-assignee-filter/interview.md` 的「对照物迭代」一节：记录了 mock 从 v1 到确认版 v2 之间改了什么、为什么改。

## 验收条件

- AC-001: 负责人筛选控件位于顶部工具栏最右侧，控件内列出当前 `/api/tasks` 数据里出现的全部负责人及一个"全部"选项。
  - Verify: [C] 打开 `npm start` 起的页面，对照 `workflow/board-assignee-filter/mock.html` 确认版人工核对控件位置与选项列表（不要求像素级还原，只要求结构与选项一致）
- AC-002: 选中某个负责人后，三列看板只保留该负责人的卡片，其余隐藏；未选或清除后恢复显示全部任务。
  - Verify: [A] `npm test`（`test/run-tests.mjs` 新增筛选函数断言，覆盖 ayan/bo/chen 三种取值与未筛选取值）→ 退出码 0
- AC-003: 当前筛选状态体现在页面 URL 的查询参数上；刷新页面或把该 URL 复制到新的浏览器会话打开，看到的筛选结果与之前一致。
  - Verify: [C] 打开 `?assignee=ayan`，确认只显示 ayan 的卡片 → 刷新页面，确认筛选依旧生效 → 把同一 URL 粘贴到隐私/无痕窗口打开，确认看到相同的筛选结果
- AC-004: 页面提供"清除筛选"控件，点击后恢复显示全部任务，且 URL 回到未筛选状态（不再带 `assignee` 参数）。
  - Verify: [C] 在已筛选状态下点击"清除筛选" → 确认三列恢复显示全部任务 → 确认地址栏 `assignee` 参数被移除
- AC-005: 筛选结果为空（例如 URL 里的负责人不在当前任务数据中）时，对应列显示空态文案"没有匹配的任务"，不是空白。
  - Verify: [C] 直接在地址栏输入 `?assignee=不存在的负责人` 打开页面，确认三列都显示文案"没有匹配的任务"而不是空白区域

## 挡着的事

无。
