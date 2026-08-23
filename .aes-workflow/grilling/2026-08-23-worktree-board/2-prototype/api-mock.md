<!-- 确认版·锁定 | 用户确认：2026-08-23T02:05:00+08:00 | 执行 Agent 改的是产品，不是这份对照物 -->

# 接口报文对: 2026-08-23-worktree-board

两个契约面：`status.json`（磁盘契约，页面与后续工具的唯一数据源）与 server HTTP API。

## status.json v2（schemaVersion: 2）

成功采集后的完整形态（节选示例，字段齐全）：

```json
{
  "schemaVersion": 2,
  "generatedAt": "2026-08-23T10:00:00.000Z",
  "repo": {
    "root": "G:/GIT/AI_WorkFlow/aes-agents-v2",
    "name": "aes-agents-v2",
    "mainBranch": "main",
    "mainHead": "f0172225",
    "issueRepo": "51world-ai-copilot/aes-agent"
  },
  "graph": {
    "issues": [
      {
        "number": 41,
        "title": "Goal Contract 访谈后未经确认直接进入执行",
        "state": "OPEN",
        "url": "https://github.com/51world-ai-copilot/aes-agent/issues/41",
        "blockedBy": [38],
        "claimedBy": "aes-agents-v2-dev5",
        "derived": { "status": "claimed", "degree": 3, "warn": false }
      },
      {
        "number": 62,
        "title": "访谈轮次可视化时间线",
        "state": "OPEN",
        "url": "https://github.com/51world-ai-copilot/aes-agent/issues/62",
        "blockedBy": [],
        "claimedBy": null,
        "derived": { "status": "frontier", "degree": 0, "warn": false }
      },
      {
        "number": 31,
        "title": "worktree 清理脚本",
        "state": "CLOSED",
        "url": "https://github.com/51world-ai-copilot/aes-agent/issues/31",
        "blockedBy": [],
        "claimedBy": null,
        "derived": { "status": "resolved", "degree": 1, "warn": true }
      }
    ],
    "edges": [
      { "from": 38, "to": 41, "satisfied": true }
    ],
    "stats": { "total": 61, "open": 17, "closed": 44, "frontier": 6, "edges": 14, "warned": 1 }
  },
  "worktrees": [
    {
      "name": "aes-agents-v2-dev5",
      "path": "G:/GIT/AI_WorkFlow/aes-agents-v2-dev5",
      "branch": "aes-agents-v2-dev5",
      "head": "6bd40b2e",
      "headSubject": "(#41)fix(goal-contract): 确认契约后才允许进入执行",
      "lastCommitAt": "2026-08-21T12:00:00+08:00",
      "ahead": 1,
      "behind": 6,
      "dirty": { "modified": 0, "untracked": 0 },
      "mode": "running",
      "position": { "kind": "issue", "issue": 41 },
      "trail": [35, 41],
      "mergeCheck": { "result": "clean", "conflictFiles": [] },
      "assessment": {
        "currentTask": "修复 #41：访谈后未经确认直接进入执行",
        "done": false,
        "merge": "not-yet",
        "reason": "issue #41 仍 OPEN、验收未闭环",
        "assessedAt": "2026-08-22T16:05:17.771Z",
        "assessedBy": "claude-main",
        "stale": false
      },
      "activeTask": {
        "id": "dev5-20260823101530", "agent": "claude",
        "prompt": "按 #41 验收清单补交互测试…", "status": "running",
        "pid": 141001, "startedAt": "2026-08-23T10:15:30.000Z",
        "log": "<runtime>/tasks/dev5-20260823101530.log"
      },
      "recentTasks": []
    }
  ]
}
```

其他 worker 形态（仅列差异字段）：

```json
{ "name": "aes-agents-v2-dev4", "mode": "manual", "position": { "kind": "issue", "issue": 58 },
  "activeTask": null, "assessment": { "stale": true } }
{ "name": "aes-agents-v2-dev3", "mode": "idle", "position": { "kind": "none" },
  "dirty": { "modified": 16, "untracked": 15 }, "activeTask": null }
```

## POST /api/dispatch

成功（干净 worktree，与 v1 逐字节兼容）：

```json
// 请求
{ "worktree": "dev5", "prompt": "按 #41 验收清单补交互测试", "agent": "claude" }
// 202
{ "ok": true, "taskId": "dev5-20260823101530", "worktree": "aes-agents-v2-dev5", "agent": "claude" }
```

业务失败一：目标 dirty，需要确认（新增握手）：

```json
// 409
{ "ok": false, "error": "dirty_confirm_required", "code": "DIRTY",
  "dirty": { "modified": 16, "untracked": 15 },
  "hint": "该 worktree 可能有人正在干活；带 confirmDirty:true 重试即执行" }
// 确认重试
{ "worktree": "dev3", "prompt": "…", "agent": "claude", "confirmDirty": true }
// 202（同成功形态）
```

业务失败二：并发锁（与 v1 一致）：

```json
// 409
{ "ok": false, "error": "aes-agents-v2-dev5 已有运行中任务 dev5-20260823101530", "code": "LOCKED" }
```

用法错 / 意外错误：

```json
// 400
{ "ok": false, "error": "worktree \"dev9\" 不在同级列表中", "code": "BAD_REQUEST" }
// 500
{ "ok": false, "error": "<异常信息截断 300 字符>", "code": "INTERNAL" }
```

## GET /api/status 与 GET /api/task/&lt;id&gt;

- `/api/status?fast=1`：跳过 gh（issue 详情与 ⚠ 沿用上次快照）；响应体 = status.json v2 全文。
- `/api/task/<id>`：与 v1 一致，`{ ok, task, logTail }`；404 时 `{ ok:false, error:"任务不存在" }`。

## 已锁定的约定

- `derived.status` 闭集：`frontier | claimed | blocked | resolved`，由采集器推导（frontier=OPEN 且依赖全闭且无人认领；claimed=有认领；blocked=OPEN 且有未闭依赖；resolved=CLOSED）。页面不得二次推导。
- `derived.degree` = 无向依赖连接数，供星等半径公式（r 公式在 handoff README，页面按公式绘制、不改数）。
- `derived.warn` = 该 CLOSED issue 的 timeline 中存在 reopened 事件（曾 reopen 又再关闭）→ ⚠ 回归有波动（第 5 轮裁决）。数据由采集器查 `gh api …/timeline`，fast 模式沿用缓存。
- `claimedBy` 判定源 = 该 worktree activeTask prompt 中的 `#N`，缺则取其最近 commit 的 `(#N)`。
- `mode` 闭集与推导（第 5 轮裁决）：`running`=有 activeTask；`manual`=有认领但无 activeTask（✋ 手动推进——用户在该 worktree 亲自干活）；`idle`=无认领。elapsed 由页面按 activeTask.startedAt 前端计时。
- `position.kind` 闭集：`issue | none`（`none`=未在场，只出现在 dock，不上图；「main 基地」概念已删除）。`trail` 按完成时间升序。
- `assessment.stale` 由采集器计算，页面只渲染。
- `edges[].satisfied` = 依赖方 issue 已 CLOSED。
- dirty 握手只在 `POST /api/dispatch`：`code` 闭集 `DIRTY | LOCKED | BAD_REQUEST | INTERNAL`；`confirmDirty:true` 跳过 dirty 检查但不跳过并发锁。
- schemaVersion 1 不做兼容读取：首跑重采即得 v2。
