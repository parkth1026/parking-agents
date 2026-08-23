<!-- draft v1 | published 2026-08-22T17:10:00Z
     用户意见：待收集
     状态：superseded by v2-api-mock.md -->

# 接口报文对: 2026-08-23-worktree-board

两个契约面：`status.json`（磁盘契约，页面与一切后续工具的唯一数据源）与 server HTTP API。

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
        "title": "Goal Contract 访谈答完三批问题后未经用户确认契约与 mock，直接进入执行",
        "state": "OPEN",
        "url": "https://github.com/51world-ai-copilot/aes-agent/issues/41",
        "blockedBy": [38],
        "claimedBy": "aes-agents-v2-dev5",
        "derived": { "status": "claimed", "rank": 1 }
      },
      {
        "number": 62,
        "title": "示例：无依赖无人认领的开放项",
        "state": "OPEN",
        "url": "https://github.com/51world-ai-copilot/aes-agent/issues/62",
        "blockedBy": [],
        "claimedBy": null,
        "derived": { "status": "frontier", "rank": 0 }
      },
      {
        "number": 35,
        "title": "OpenCode typed interaction",
        "state": "CLOSED",
        "url": "https://github.com/51world-ai-copilot/aes-agent/issues/35",
        "blockedBy": [],
        "claimedBy": null,
        "derived": { "status": "resolved", "rank": 0 }
      }
    ],
    "edges": [
      { "from": 38, "to": 41, "satisfied": false }
    ],
    "stats": { "total": 61, "open": 17, "closed": 44, "frontier": 5, "edges": 9 }
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
      "activeTask": null,
      "recentTasks": [
        {
          "id": "dev5-20260822160324", "worktree": "aes-agents-v2-dev5",
          "agent": "test", "prompt": "网页派发链路验证任务",
          "status": "done", "pid": 140208, "exitCode": 0,
          "startedAt": "2026-08-22T16:03:24.000Z", "endedAt": "2026-08-22T16:03:27.000Z",
          "log": "<runtime>/tasks/dev5-20260822160324.log"
        }
      ]
    }
  ]
}
```

空闲队员的定位形态（与上面同结构，仅列差异字段）：

```json
{ "name": "aes-agents-v2-dev1", "position": { "kind": "base" }, "trail": [24, 35, 55], "activeTask": null }
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
// 请求同上，但 dev3 有未提交改动
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

用法错：

```json
// 400
{ "ok": false, "error": "worktree \"dev9\" 不在同级列表中", "code": "BAD_REQUEST" }
```

意外错误：

```json
// 500
{ "ok": false, "error": "<异常信息截断 300 字符>", "code": "INTERNAL" }
```

## GET /api/status

- `?fast=1`：跳过 gh，issue 详情沿用上次快照（v1 语义不变）。
- 响应体 = status.json v2 全文。

## GET /api/task/&lt;id&gt;

与 v1 一致：`{ "ok": true, "task": {…}, "logTail": "<末尾 8KB>" }`；不存在时 404 `{ "ok": false, "error": "任务不存在" }`。

## 已锁定的约定

- `graph.issues[].derived.status` 是闭集：`frontier | claimed | blocked | resolved`——由采集器推导（Q1+确认区裁决：frontier=OPEN 且依赖全闭且无人认领；claimed=有队员认领；blocked=OPEN 且有未闭依赖；resolved=CLOSED）。页面不得自行二次推导。
- `claimedBy` 的判定源 = 该 worktree 的 activeTask prompt 中的 `#N`，缺则取其最近 commit 的 `(#N)`（第 2 轮确认：队员位置=正在做的 issue 坐标）。
- `worktrees[].position.kind` 是闭集：`issue | base`。`trail` 按完成时间升序，元素是 issue 号（从该分支 commit `(#N)` 推导）。
- `assessment.stale` 由采集器计算（assessedAt 早于 lastCommitAt 或最近任务 endedAt），页面只渲染不计算（Q4 裁决）。
- `edges[].satisfied` = 依赖方 issue 已 CLOSED（沿用 wayfinder 语义：满足的边发光流动）。
- dirty 握手只在 `POST /api/dispatch` 出现：`code` 字段是闭集 `DIRTY | LOCKED | BAD_REQUEST | INTERNAL`；`confirmDirty:true` 时跳过 dirty 检查但**不**跳过并发锁（Q3 裁决：软防线，锁是硬的）。
- schemaVersion 1 的旧 status.json 不做兼容读取：首跑重采即得 v2（配置差异节已声明生成物直接废弃）。
