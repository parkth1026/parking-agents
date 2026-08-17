# 事件格式

一个事件是一个 JSON 对象。

| 字段 | 必填 | 类型 | 说明 |
| --- | --- | --- | --- |
| `event` | 是 | string | 事件名，如 `page_view` |
| `ts` | 是 | integer | Unix 秒 |
| `app` | 否 | string | 由服务端按 `X-App-Id` 覆写，业务方传了也会被盖掉 |
| `user_id` | 否 | string | |
| `session_id` | 否 | string | |
| `props` | 否 | object | 业务自定义字段，不做内容校验 |

未知字段默认放过（`validate.rejectUnknownFields` 为 false）。这是 2.0 时的决定：
业务方加字段不该被中继卡住，字段治理放在下游做。

## 落盘形状

`data/events.ndjson`，一行一个事件的 JSON，服务端补全 `app` 之后的形状。
有从这些文件回捞的工具，见 `scripts/replay.mjs`。

## 转发形状

POST 给下游的 body 固定是 `{"events": [ ...事件对象... ]}`。
下游只认这一种形状。
