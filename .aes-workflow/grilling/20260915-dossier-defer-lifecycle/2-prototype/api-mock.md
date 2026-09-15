# rounds 行报文对: 20260915-dossier-defer-lifecycle

定 **rounds.jsonl 行 schema 的 defer 扩展**。展示三对「落盘输入 → dossier 渲染结果」，非 HTTP 报文——本 schema 的「接口」是 `session.mjs round` 的输入行与 dossier 投影的输出。

## 1. defer 落盘（暂缓型回应）

输入行（round 命令的 JSON）：

```json
{"stage":"1-interview","round":1,"tier":"ask","q_id":"Q1",
 "question":"speed/eta 怎么处置","known_facts":"…",
 "options":[{"key":"A","text":"…","pct":40},{"key":"B","text":"…","pct":46}],
 "user_choice":"defer","user_verbatim":"不好选 再深度调研一下 行业最佳实践"}
```

dossier 渲染：`⏸ 暂缓 · 要求：不好选 再深度调研一下 行业最佳实践`（问题开放）。
校验：放行；options pct 加和 100±2 照常校验（选项集不因 defer 豁免）。

## 2. 重发承接（生命周期关闭）

后续轮输入行：

```json
{"stage":"1-interview","round":2,"tier":"ask","q_id":"Q1",
 "question":"（重发，带调研证据）speed/eta 怎么处置",
 "options":[{"key":"A","text":"…","pct":36},{"key":"B","text":"…","pct":52}],
 "user_choice":"B",
 "triggered_by":"Q1 r1 暂缓（要求行业调研）"}
```

dossier 渲染：Q1 生命周期线 = r1 ⏸暂缓 → r2 ↻重发(triggered_by 标注) → 选择 B → 已关闭。

## 3. default 行 user 约定值（既有缺口补约定）

| 输入 user 值 | 渲染 | 说明 |
| --- | --- | --- |
| `"未反对"` | 默认生效 | 窗口期后补记 |
| `"确认"` | 已确认 | 用户显式确认 |
| `<其他文本>` | 翻案：文本 | 翻案原话 |
| 字段缺席 | 未记录反应 | 历史行诚实模糊态 |

## 已锁定的约定

- `user_choice` 新增**保留值 `"defer"`**——选项 key 不得使用该词，冲突时 defer 语义优先并警告（本文件第 1 节 + behavior.md B2，Q2=A 裁决）。
- defer 行必须带 `user_verbatim` 记暂缓原因（校验：缺 verbatim 的 defer 行拒收）。
- 历史行不回溯改判：无 defer 标记的旧 verbatim 行维持 custom 渲染（behavior.md B3，默认区第 3 条）。
