# Web 回合协议

## 目录与命令

所有运行状态都在 `<issue>/web/`：

```text
web/
├── state.json                 页面声明式状态
├── decision-ledger.jsonl      Web 侧不可变事件链（带前序摘要）
├── server-info               当前 URL、token、pid（owner-only）
├── .session-token            当前 token（owner-only）
├── .last-port                上次使用的端口，重启时复用（owner-only）
├── submissions/<round>.json  浏览器提交；一轮一个，不覆盖
├── consumed/<round>.json     已成功映射回家族 rounds 的标记
├── assets/                    发布时复制的只读附件
└── exports/                   可选的静态决策档案输出目录
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

导出可独立阅读、可离线归档的完整决策档案：

```bash
node <this-skill>/scripts/export-static.mjs --issue-dir <issue> --output <report.html>
```

运行中的页面也提供 `GET /export`。两种导出都把任务原文、全部轮次、所有候选及其优劣势、
已选答案、Goal Contract、来源/附件索引、事件账本和追溯关系写入同一个 HTML；不依赖 server、
localStorage 或外部资源才能阅读。

生产等待没有超时。`--timeout-ms` 只供 runtime 测试。

## 发布 schema

`publish round --file` 接受 round 本身，或带页面聚合字段的对象：

```json
{
  "schema_version": 2,
  "opening": "用户任务原文；只读",
  "dossier": {
    "title": "Goal Contract 决策档案 · 示例",
    "summary": "这一页静态导出后仍能解释目标、选择、代价与验收来源"
  },
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

`ask.response.type` 支持以下输入能力；缺省时保持 v1 兼容，按 `single_select` 处理：

| type | 用途 | 关键字段 |
| --- | --- | --- |
| `single_select` | 单选决策 | `options`、`allow_custom` |
| `multi_select` | 多选范围/能力 | `min`、`max`、`exclusive_keys` |
| `boolean` | 是/否门禁 | `true_label`、`false_label`，或两个 options |
| `short_text` | 短文本 | `placeholder` |
| `long_text` | 长文本/补充语境 | `placeholder` |
| `number` | 数值约束 | `min`、`max`、`step`、`unit` |
| `date_time` | 日期或时间点 | `format: date|time|datetime-local` |
| `ranking` | 优先级排序 | 复用 `options` |
| `evidence` | 证据/链接清单 | `placeholder` |

`multi_select` 的数量边界写作 `min`/`max`（如上表与示例）；`publish` 接受这两个名字，
落盘时统一正规化为 `min_selections`/`max_selections`，两者同时给出且不一致会被拒绝。
`boolean` 不给 `options` 时用 `true_label`/`false_label` 做按钮文案（缺省 是/否）；
给 `options` 则必须恰好两项。除 `single_select` 外，其他响应类型的选项都不要求 `pct`。

多选示例：

```json
{
  "q_id":"M1","tier":"ask","question":"静态档案必须包含哪些上下文？",
  "required":true,"allow_custom":true,
  "response":{"type":"multi_select","min":2,"max":5,"exclusive_keys":["SUMMARY_ONLY"]},
  "options":[
    {"key":"REQUEST","text":"用户原始请求","recommended":true,"pros":["保留目标语境"],"cons":["可能较长"]},
    {"key":"DECISIONS","text":"全部候选与决策","recommended":true,"pros":["可复盘"],"cons":["需要稳定追溯"]},
    {"key":"SUMMARY_ONLY","text":"只保留最终摘要","cons":["无法解释为什么"]}
  ]
}
```

`multi_select` 的每个候选都在题目自己的固定详情表中占一行；选择只改变行状态，不改变该题
高度。`exclusive_keys` 与其他选项互斥。`q_id` 在 round 内唯一。只有 `single_select` 要求 pct
和落在 100±2；其他响应类型不要求概率。默认项未显式翻掉时提交为 `accept`；ask 与 confirm
是必答，除非 ask 明写 `required:false`。

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

Web submission schema v2 每个 answer 只表达用户输入，并记录发布时的 round revision/digest；
agent 必须用当时发布的 item 补齐家族 line。服务端返回的 `GET /api/state.dossier` 是页面回看与
导出的 canonical projection，不能用浏览器 localStorage 代替：

- `ask + choice`：`user_choice` 写选项 key，`user_verbatim` 写用户选择；保留问题、证据与完整
  options。若用户选的不是推荐项，设置 `overturned_recommendation:true`。
- `ask + custom`：`user_choice:"custom"`，`user_verbatim` 原样写截断后的 text。
- `ask + multi_select`：`choices` 保留有序 key 数组，`custom` 可选；映射时逐项保留候选文本、
  covers/pros/cons，不能压缩成一句摘要。
- `ask + boolean/number/date_time/ranking/evidence/text`：使用对应的结构字段；保留单位、顺序、
  空值语义与用户原文。
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
- `GET /api/state`：返回运行状态及完整 `dossier` 投影；已提交答案以服务器 submission 为准。
- `GET /export`：下载自包含 HTML 决策档案；响应禁止缓存并使用收紧的 CSP。
- `GET /files/<name>`：只读 `web/assets/` 的普通非符号链接 basename；其余统一 404。
- `GET /shutdown?key=...`：先回执，再写 `server-stopped` 并退出。

提交文件在 200 回执之前完成原子落盘；重复提交永远以第一份为准。

## 决策账本与追溯

`decision-ledger.jsonl` 依次记录 `round_published`、`round_submitted`、
`submission_consumed`。每条事件带 `previous_event_digest` 与 `event_digest`，因此修改、删除或
重排历史会破坏后续链。它是 Web 交互证据，不替代家族 `rounds.jsonl` 或最终 Goal Contract。

静态档案中的 authority 顺序固定为：最终 Goal Contract → 已吸收的家族过程文件 → Web
submission/ledger → 浏览器草稿。导出 manifest 记录 state、contract、submission、source、
asset 与 ledger digest；任何读者都能判断这份页面引用了哪一版输入和契约。
