<!-- 确认版 · 晋升自 drafts/v1-api-mock.md | 用户确认：2026-08-20（"ok"）
     不可修改：执行 Agent 改的是产品，不是这份对照物 -->
# 接口报文对: 2026-08-20-workflow-interview-web

本地 loopback HTTP/WS，`http://127.0.0.1:<port>`。鉴权：每会话 32 字节 hex token，
URL `?key=` 首跳种入 + HttpOnly SameSite=Strict cookie；HTTP 与 WS 升级均校验，
常时比较；WS 升级另要求同源。唯一客户端是本技能自带单页（无第三方消费者）。

## GET /api/state — 拉取页面状态

成功（200）：

```json
{
  "ok": true,
  "state": {
    "schema_version": 1,
    "slug": "2026-08-20-workflow-interview-web",
    "phases": [
      {"id": "1-interview", "label": "访谈·拷问", "status": "done"},
      {"id": "2-prototype", "label": "原型确认", "status": "active"},
      {"id": "3-contract", "label": "交付标准·契约", "status": "pending"}
    ],
    "open_ambiguities": 1,
    "rounds": [
      {"id": "r2", "no": 2, "stage": "2-prototype", "title": "对照物质疑",
       "status": "pending",
       "items": [
         {"q_id": "Q1", "tier": "ask", "question": "…", "known_facts": "…",
          "irreversible": true, "allow_custom": true,
          "options": [
            {"key": "A", "text": "…", "pct": 65, "recommended": true,
             "covers": "…", "pros": ["…"], "cons": ["…"]},
            {"key": "B", "text": "…", "pct": 35}
          ]},
         {"q_id": "D6", "tier": "default", "line": "定什么 — 为什么 — 代价：…"},
         {"q_id": "C1", "tier": "confirm", "line": "…", "irreversible": true}
       ]}
    ],
    "locked": [
      {"ref": "Q1", "q": "唤醒模型", "a": "自定义：无超时·隔天可用",
       "round": "r1", "tier": "ask"}
    ],
    "final": null
  }
}
```

未带 key（403）：`{"ok": false, "error": "session_key_required"}`

## POST /api/submit — 整轮提交

成功（200）：

```json
// 请求
{"round": "r2", "answers": [
  {"q_id": "Q1", "type": "choice", "choice": "A"},
  {"q_id": "Q1", "type": "custom", "text": "其实我想要 A 但端口固定 8080"},
  {"q_id": "D6", "type": "accept"},
  {"q_id": "D8", "type": "veto", "text": "端口走 19440，避开内网常用段"},
  {"q_id": "C1", "type": "confirm"}
]}
// 响应
{"ok": true, "round": "r2", "received_at": "2026-08-20T12:00:00Z"}
```

业务失败（409，重复提交）：

```json
{"ok": false, "error": "duplicate_round", "round": "r2",
 "first_received_at": "2026-08-20T11:58:03Z"}
```

业务失败（422，必答缺失）：

```json
{"ok": false, "error": "missing_required", "q_ids": ["Q1"]}
```

用法错（400，round 不存在或不为 pending）：

```json
{"ok": false, "error": "invalid_round", "round": "r9"}
```

意外错误（500）：`{"ok": false, "error": "internal"}`（server log 记堆栈，页面提示重试）

## WS 消息（server → 页面）

```json
{"type": "state-updated"}          // publish.mjs 改写 state.json 后广播，页面重拉 /api/state
{"type": "submitted", "round": "r2"} // 提交落盘成功，页面锁定本轮为只读
{"type": "reload"}                  // 兼容全量刷新通道（应急）
```

页面 → server（心跳/离线补发）：`{"type": "flush", "events": [...]}`（复用 aes-grilling-web 断线队列语义）

## GET /files/<name> — 附件（原型对照物）

成功（200）：`Content-Type: text/html; charset=utf-8`（仅 `web/assets/` 内白名单文件，basename 净化、拒符号链接与 dotfile）
失败（404）：`{"ok": false, "error": "not_found"}`
（iframe `sandbox` 属性由单页侧设置，server 不注入脚本进附件）

## GET /shutdown?key=… — 显式收尾

成功（200）：`{"ok": true, "stopped": true}`（写 `web/server-stopped` 标记，进程退出 0）

## 已锁定的约定

| 约定 | 裁决来源 |
| --- | --- |
| `answers[].type` 是闭集：`choice`/`custom`/`accept`/`veto`/`confirm` | Round 1 C2（Web 完成所有交互与文本输入） |
| `round` 是闭集：state.json 中 `status:"pending"` 的轮次 | Round 1 深度调研采纳的 open-design 幂等语义（D11） |
| 同一 q_id 在一轮内最多一条 answer（choice 与 custom 互斥，前端单选+Other 二选一提交） | behavior.md 变化行 2 |
| `custom` 文本上限 2000 字符，超出截断并回执 `truncated:true` | behavior.md 边界值行 B3 |
| 提交先落盘再回执（永不回「已收到」却没写盘） | open-design「消息先落盘」纪律（deep-research 分片） |
| token 不进 git、不进日志；server-info 文件 0600 | aes-grilling-web 既有安全语义复用 |
| 附件只从 `web/assets/` 出，永不读仓库其他路径 | 静态净化沿用 aes-grilling-web `/files/` 规则 |
