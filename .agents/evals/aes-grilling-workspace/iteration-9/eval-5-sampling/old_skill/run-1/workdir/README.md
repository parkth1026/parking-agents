# metrics-relay

内部埋点上报中继。业务方把事件 POST 到这里，服务校验、落盘、并转发给下游消费者。

零依赖，只用 Node 内建模块。

## 跑起来

```bash
npm start            # 默认读 config/default.json
NODE_ENV=production npm start
```

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/v1/events` | 上报事件，body 为单个事件或事件数组 |
| GET | `/metrics` | 服务自身指标，纯文本 |
| GET | `/healthz` | 存活检查 |

上报需要带 `X-App-Id` 头，未登记的 app 一律 401。

### 单请求控制采样

支持 `X-Sample-Rate` 请求头，取值 0 到 1，业务方可以自己决定这一批要不要抽样上报：

```bash
curl -X POST localhost:8080/v1/events \
  -H 'X-App-Id: web-portal' \
  -H 'X-Sample-Rate: 0.5' \
  -d '{"event":"page_view","ts":1754697600}'
```

> 注意：这一段是 1.x 时代写的，2.0 重构之后头部处理逻辑整个换过一遍，
> 文档没跟着改全，具体行为请以 `src/` 为准。

## 事件格式

见 [docs/schema.md](docs/schema.md)。

## 测试

见 [docs/testing.md](docs/testing.md)。

## 运维

部署与配置下发见 [docs/runbook.md](docs/runbook.md)。
