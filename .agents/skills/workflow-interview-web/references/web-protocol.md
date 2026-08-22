# Web 回合协议

## 目录与命令

所有运行状态都在 `<issue>/web/`：

```text
web/
├── state.json                 页面声明式状态
├── server-info               当前 URL、token、pid（owner-only）
├── .session-token            当前 token（owner-only）
├── submissions/<round>.json  浏览器提交；一轮一个，不覆盖
├── consumed/<round>.json     已成功映射回家族 rounds 的标记
└── assets/                    发布时复制的只读附件
```

启动或复用服务：

```bash
node <this-skill>/scripts/server.mjs start --issue-dir <issue> --open
```

发布 round：

```bash
node <this-skill>/scripts/publish.mjs round --issue-dir <issue> --file <round.json>
node <this-skill>/scripts/publish.mjs round --issue-dir <issue> --file <round.json> \
  --attach <prototype-file>=mock.html
```

等待、续跑扫描与吸收标记：

```bash
node <this-skill>/scripts/wait-submit.mjs --issue-dir <issue> --round <round-id>
node <this-skill>/scripts/wait-submit.mjs --issue-dir <issue> --scan
node <this-skill>/scripts/wait-submit.mjs --issue-dir <issue> --mark-consumed <round-id>
```

生产等待没有超时。`--timeout-ms` 只供 runtime 测试。

## 发布 schema

`publish round --file` 接受 round 本身，或带页面聚合字段的对象：

```json
{
  "opening": "用户任务原文；只读",
  "phases": [
    {"id":"1-interview","label":"访谈·拷问","status":"active"},
    {"id":"2-prototype","label":"原型确认","status":"pending"},
    {"id":"3-contract","label":"交付标准·契约","status":"pending"}
  ],
  "open_ambiguities": 2,
  "locked": [{"ref":"Q0","q":"交付范围","a":"完整技能+基础测试","round":"r1","tier":"ask"}],
  "round": {
    "id": "interview-r2",
    "no": 2,
    "stage": "1-interview",
    "title": "一次问清",
    "status": "pending",
    "items": []
  }
}
```

三档 item：

```json
{"q_id":"Q1","tier":"ask","question":"问到本质的问题","known_facts":"证据摘要",
 "irreversible":true,"allow_custom":true,"required":true,
 "options":[
   {"key":"A","text":"选项 A","pct":65,"recommended":true,
    "covers":"覆盖与不覆盖","pros":["好处"],"cons":["代价"]},
   {"key":"B","text":"选项 B","pct":35}
 ]}
{"q_id":"D1","tier":"default","line":"定什么 — 为什么 — 代价"}
{"q_id":"C1","tier":"confirm","line":"难逆决定 — 为什么 — 代价","irreversible":true}
```

每个 ask 的选项 pct 和必须落在 100±2。`q_id` 在 round 内唯一。默认项未显式翻掉时提交为
`accept`；ask 与 confirm 是必答，除非 ask 明写 `required:false`。

契约视图把 `round.view` 设成 `"contract"`，并增加 `final`。`final.round` 指向该 round：

```json
{
  "round": {
    "id":"contract-r1","no":7,"stage":"3-contract","title":"最终契约确认",
    "status":"pending","view":"contract",
    "items":[{"q_id":"C-FINAL","tier":"confirm","line":"确认这份 Goal Contract"}]
  },
  "final": {
    "round":"contract-r1","title":"目标契约 · 示例","subtitle":"三阶段完成 · 等待确认",
    "sections":[
      {"title":"1 · 目标","body":"一句话目标","basis":"Round 1 任务陈述"},
      {"title":"2 · 验收","bullets":["AC-001 …","AC-002 …"],"basis":"契约阶段确认"}
    ]
  }
}
```

## 提交映射

Web submission 每个 answer 只表达用户输入；agent 必须用当时发布的 item 补齐家族 line：

- `ask + choice`：`user_choice` 写选项 key，`user_verbatim` 写用户选择；保留问题、证据与完整
  options。若用户选的不是推荐项，设置 `overturned_recommendation:true`。
- `ask + custom`：`user_choice:"custom"`，`user_verbatim` 原样写截断后的 text。
- `default + accept`：家族 `item/why/cost/user` 中 `user` 写「未反对」。
- `default/confirm + veto`：`user` 写 text；保留原 item、why、cost，并让当前阶段据此重算。
- `confirm + confirm`：`user` 写「确认」。

同一 Web round 的所有家族 `session.mjs round` 调用都成功后，才运行 `--mark-consumed`。
若进程在中途关闭，submission 留在扫描结果中；续跑时可按 `rounds.jsonl` 的已有 `q_id` 去重后
补齐剩余行，再写 consumed marker。

## HTTP/WS 约定

- 首次 URL `?key=` 校验后设置 HttpOnly、SameSite=Strict cookie，并 303 到无 key 的 `/`。
- HTTP API 与静态资源始终鉴权。WS 除鉴权外还要求 loopback 同源 Origin。
- `POST /api/submit`：成功 200；同 round 重复 409；必答缺失 422；非法 round 400。
- `GET /files/<name>`：只读 `web/assets/` 的普通非符号链接 basename；其余统一 404。
- `GET /shutdown?key=...`：先回执，再写 `server-stopped` 并退出。

提交文件在 200 回执之前完成原子落盘；重复提交永远以第一份为准。
