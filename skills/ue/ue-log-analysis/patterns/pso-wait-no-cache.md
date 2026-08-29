---
name: pso-wait-no-cache
category: startup-fail
signature: "[N.N.N-N.N.N:N][  N]LogDNDNRHI: Waited for PSO creation for N.Nms"
match: "Waited for PSO creation for "
first-seen: 2026-08-25
last-seen: 2026-08-25
verified: true
sources:
  - Docs/bugs/2026-08-25-packaged-build-gpu-zero-freeze-analysis.md
---

## 识别特征

- match: `Waited for PSO creation for `
- 错误原句：`LogD3D12RHI: Waited for PSO creation for 100.000000ms`
- 注意递增序列 100→200→400→800→1600ms = 同一 PSO 反复等待恶化

## 机理

打包版无 PSO 持久化缓存时，首次渲染每种材质组合都触发驱动级编译；多实例同秒冷启动会争抢
驱动级编译队列，等待次数暴增，游戏线程同步阻塞在 PSO 创建上（帧 0 高发）。

## 对治

- 责任方：打包配置。启用 PSO 持久缓存（.uplugin/project 设置 + 首跑收集），错峰启动多实例。

## 证据

- 2026-08-25 08:50 `019ff533-.../2026-08-25/08-49-46.log` 尾部帧 0 三连 `Waited for PSO creation for 100.000000ms`
