# 运维手册

## 部署

镜像由 CI 构建，发布走 infra 仓库的部署流水线。这个仓库里的
`config/*.json` 只是**样例与本地开发用**：线上实际生效的配置文件是 infra 仓库的
模板渲染出来后投放到容器里的，模板不在这个仓库，改配置项要同时改那边。

发布是分批滚动的，一批机器起来之后观察一段再放下一批。

## 观察什么

- `GET /metrics` 拿进程内计数器。抓取方在 infra 侧配置，本仓库不感知。
- `events_total` 与 `events_rejected_total` 是最常看的两个。
- 转发失败看 `forward_failures_total`，连续上涨基本是下游 `analytics-ingest` 挂了。

## 常见故障

| 现象 | 一般原因 |
| --- | --- |
| 大量 401 | 业务方换了 app id 但没走登记发版 |
| `forward_failures_total` 上涨 | 下游 ingest 不可用；本服务会重试到上限然后丢批 |
| 磁盘涨得快 | 某个业务方量突增，看 `events_by_app` 定位 |
| 重启后指标归零 | 计数器是进程内的，预期行为 |

## 数据保留

`data/` 下的 ndjson 由 infra 侧的定时任务搬走并清理，本服务只管写。
