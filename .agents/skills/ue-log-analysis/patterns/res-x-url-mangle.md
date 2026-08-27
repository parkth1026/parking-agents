---
name: res-x-url-mangle
category: startup-fail
signature: "[N.N.N-N.N.N:N][  N]LogInit: Warning: Can't Find URL: ResX=N"
match: "Can't Find URL: Res"
first-seen: 2026-08-25
last-seen: 2026-08-26
verified: true
sources:
  - Docs/bugs/2026-08-27-multigpu-pixelstreaming-gpu3d-zero-freeze-diagnosis.md
---

## 识别特征

- match: `Can't Find URL: Res`
- 错误原句：`LogInit: Warning: Can't Find URL: ResX=200`（同族：`Failed to enter .../Maps/`，见 startup-map-enter-fail）

## 机理

启动参数 `ResX=...`/`ResY=...` 缺 `-` 前缀，被引擎并入默认地图 URL 当作 URL 参数解析。
引擎随后 Browse 自愈——报错噪声，不致死。

## 对治

- 责任方：编排参数。改 `-ResX= -ResY=` 或走 `-Resolution` 子键。

## 证据

- 编排器命令行普遍存在裸 `ResX=200 ResY=200`（`LogCsvProfiler commandline` 元数据可见）
