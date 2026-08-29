---
name: startup-map-enter-fail
category: startup-fail
signature: "[N.N.N-N.N.N:N][  N]LogLoad: Error: Failed to enter /Game/DNDX_SJN/Maps/Main: . "
match: "Failed to enter /.*/Maps/"
first-seen: 2026-08-25
last-seen: 2026-08-26
verified: false
sources:
  - Docs/bugs/2026-08-27-multigpu-pixelstreaming-gpu3d-zero-freeze-diagnosis.md
---

## 识别特征

- match: `Failed to enter /.*/Maps/`
- 错误原句：`LogLoad: Error: Failed to enter /Game/DNDX_SJ202506060001/Maps/Main: . Please check the log for errors.`

## 机理

启动时默认地图进入失败（常与 `ResX=200` 缺 `-` 前缀被并入地图 URL 的 mangle 同现）。
引擎随后 Browse 自愈换图成功——**报错但自愈的噪声**，不致死，但污染错误谱。

## 对治

- 责任方：编排参数。启动参数 `ResX=...`/`ResY=...` 加 `-` 前缀，避免并入默认地图 URL。

## 证据

- 2026-08-26 14:13 GPU2 会话启动段报错后 14:14:00 Earth Ready 自愈（`14-13-00.log`）
