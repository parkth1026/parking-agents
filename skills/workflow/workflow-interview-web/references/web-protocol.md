# Web 回合协议

## 目录与命令

所有运行状态都在 `<issue>/web/`：

```text
web/
├── state.json                 页面声明式状态
├── decision-ledger.jsonl      Web 侧不可变事件链（带前序摘要）
├── server-info               当前 plain URL、port、pid
├── .last-port                上次使用的端口，重启时复用
├── submissions/<round>.json  浏览器提交；一轮一个，不覆盖
├── consumed/<round>.json     已成功映射回家族 rounds 的标记
├── runtime/                   宿主 continuation authority 私有状态
│   ├── continuation-lease.json
│   ├── continuation-receipt.json
│   └── consumption-records.jsonl
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

兼容 transport、续跑扫描与吸收标记：

```bash
node <this-skill>/scripts/wait-submit.mjs --issue-dir <issue> --round <round-id>
node <this-skill>/scripts/wait-submit.mjs --issue-dir <issue> --scan
node <this-skill>/scripts/wait-submit.mjs --issue-dir <issue> --scan --oldest
node <this-skill>/scripts/wait-submit.mjs --issue-dir <issue> --recovery-payload <round-id>
node <this-skill>/scripts/wait-submit.mjs --issue-dir <issue> --history <round-id> [--q-id <q-id>]
node <this-skill>/scripts/wait-submit.mjs --issue-dir <issue> --claim-consume <round-id>
node <this-skill>/scripts/wait-submit.mjs --issue-dir <issue> --mark-consumed <round-id>
```

导出可独立阅读、可离线归档的完整决策档案：

```bash
node <this-skill>/scripts/export-static.mjs --issue-dir <issue> --output <report.html>
```

运行中的页面也提供 `GET /export`。`GET /api/state` 默认只投影当前 round 与上 3 个已锁定
round；页面点击“加载更早历史”才会通过 `GET /api/history?before=<round>&limit=<n>` 分页读取
旧轮次。两种导出都把任务原文、全部轮次、所有候选及其优劣势、
已选答案、Goal Contract、来源/附件索引、事件账本和追溯关系写入同一个 HTML；不依赖 server、
localStorage 或外部资源才能阅读。

`wait-submit.mjs --round` 是兼容的 watch-first transport 命令，只在发现 submission 后确认
`persisted`，不获取 lease、不改变 continuation mode，也不自行宣称 Agent 已恢复。生产主路径不
启动模型等待器；Web 提交后按 `manual_followup` 回当前 task 输入“请继续”。人工恢复的固定
顺序是 `--scan --oldest` → `--recovery-payload <round>` → 吸收成功后
`--mark-consumed <round>`。`--scan --oldest` 只返回最早 pending 的身份摘要和答案数量，实际答案
只由 recovery payload 提供；普通 `--scan` 仍保留全量兼容输出，但不应作为 Agent 默认恢复载荷。
`--history <round> [--q-id <q-id>]` 只在冲突、引用缺失或审计时定向读取；`--timeout-ms` 只供
transport/runtime 测试。

## Continuation authority

`runtime/continuation-lease.json` 与 `runtime/continuation-receipt.json` 是独立于 `state.json`
的可选宿主私有状态。manual 主路径不创建它们；若未来明确启用 host-owned authority，只有该 authority
能写入它们。server、round JSON、浏览器请求、普通 CLI flag 和环境变量不能把公开模式变成
`current_turn_deferred`。lease 以单调 `generation` 和 owner fencing 工作，旧 owner 的更新会被拒绝；
过期、取消、建立失败和 server 停止都 fail closed 到 `manual_followup`。

`GET /api/state` 和 dossier 只投影以下安全字段：`round`、`mode`、`status`、`receipt_stage`、
`next_user_action`、有限的 `correlation`（session slug、round、revision、digest、generation）
与 fallback `reason`。raw owner nonce、进程/cell/session identity 和完整 runtime 文件
永不进入公开投影。

transport 的顺序固定为：建立 `<issue>/web/submissions/` watch → 立即重查目标 submission → 命中后
输出已落盘 submission。若未来启用宿主 pending tool，才由同一 authority 额外写
`resuming/agent_resumed`；提交恰在 watch 边界发生也至少被事件或重查命中。
`POST /api/submit` 永远先原子写 submission；它返回的 200 只证明 `persisted`，不提前声称 Agent
已继续。

### Agent recovery payload 与历史读取

`--recovery-payload <round>` 的输出是 Agent 默认恢复输入，结构固定为：

```json
{
  "schema_version": 1,
  "kind": "agent-recovery-payload",
  "session_slug": "session-slug",
  "round": "interview-r7",
  "revision": 2,
  "digest": "sha256-or-round-digest",
  "questions": [{"q_id":"Q1","tier":"ask","question":"当前问题"}],
  "answers": [{"q_id":"Q1","type":"choice","choice":"A"}]
}
```

它不包含 `rounds`、`submissions`、`ledger`、历史窗口或旧 round 列表，因此 round 数增加不会把
完整 dossier 重新注入 Agent。当前 submission 中的答案原文按已持久化内容保留；若既有提交边界
产生 `truncated` 标记，该标记是显式的输入校验结果，不由 recovery payload 再次静默摘要。

`--history <round> [--q-id <q-id>]` 返回指定 round，或指定 round 内的单个问题及其答案；它
不会修改 submission、consumed marker 或消费记录。发现历史冲突时保留当前 submission，定向读取
双方事实并请求明确裁决，裁决前不得标记 consumed。多个 pending submission 始终按 round `no`
从小到大逐个恢复。

自动或人工消费共用 `consumption-records.jsonl` 的 `{session_slug, round, revision, digest}`
幂等键。家族 round 写入前可运行 `--claim-consume` 建立 `processing` 记录；家族写入全部成功后
运行 `--mark-consumed`，它追加一次 `committed` 记录、写 marker 并推进 `consumed`。重复通知、
重复人工消息和崩溃重试复用同一键；恢复时只补 family round 中尚缺的行，再提交 marker。

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

- server 只绑定 `127.0.0.1`，对当前 issue 提供稳定 plain URL；不生成 session key、cookie 或登录步骤。
- 页面、HTTP API、静态资源和 WS 直接使用同一 loopback origin。server 重启复用 `.last-port`，旧页面
  无需重新认证；发布和 consumed 变化由 WS 通知，页面重读 `/api/state` 并原地 render。
- `POST /api/submit`：成功 200；同 round 重复 409；必答缺失 422；非法 round 400。
- `GET /api/state`：返回运行状态、normalized `continuation` 及当前 round+上 3 个已锁定 round 的
  dossier 投影；已提交答案以服务器 submission 为准。旧 state 没有 continuation 字段时，投影为
  `manual_followup`，不改写旧文件。
- `GET /api/history?before=<round>&limit=<n>`：显式读取 cursor 之前最多 20 个 round 的批次；
  返回的 dossier 只包含该批次，不能替代默认 Agent recovery payload。
- `GET /export`：下载自包含 HTML 决策档案；响应禁止缓存并使用收紧的 CSP。
- `GET /files/<name>`：只读 `web/assets/` 的普通非符号链接 basename；其余统一 404。
- `GET /shutdown`：先回执，再写 `server-stopped` 并退出。

提交文件在 200 回执之前完成原子落盘；重复提交永远以第一份为准。响应结构仍保持现有字段，成功时
额外返回安全的 `continuation` 投影；manual 主路径为 `manual_recovery_required/persisted/send_message`，
不因普通 transport waiter 而产生自动承诺。

## 决策账本与追溯

`decision-ledger.jsonl` 依次记录 `round_published`、`round_submitted`、
`submission_consumed`。每条事件带 `previous_event_digest` 与 `event_digest`，因此修改、删除或
重排历史会破坏后续链。它是 Web 交互证据，不替代家族 `rounds.jsonl` 或最终 Goal Contract。

静态档案中的 authority 顺序固定为：最终 Goal Contract → 已吸收的家族过程文件 → Web
submission/ledger → 浏览器草稿。导出 manifest 记录 state、contract、submission、source、
asset 与 ledger digest；任何读者都能判断这份页面引用了哪一版输入和契约。
