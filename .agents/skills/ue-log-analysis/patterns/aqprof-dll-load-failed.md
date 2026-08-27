---
name: aqprof-dll-load-failed
category: infra
signature: "LogWindows: Failed to load str (GetLastError=N)"
match: "Failed to load '.*\\.dll'"
first-seen: 2026-08-24
last-seen: 2026-08-27
verified: true
sources:
  - Docs/bugs/2026-08-27-multigpu-pixelstreaming-gpu3d-zero-freeze-diagnosis.md
---

## 识别特征

- match: `Failed to load '.*\.dll'`
- 错误原句：`LogWindows: Failed to load 'aqProf.dll' (GetLastError=126)`（同族：VSPerf170.dll / VtuneApi.dll / VtuneApi32e.dll，GetLastError=126=模块不存在）
- 分布：23/23 份长会话日志全部携带（启动 AppInit 阶段，无前缀行）

## 机理

打包环境不含可选性能分析器 DLL（AQProfiler/VTune/VSPerf），引擎启动探测失败后继续——
**纯噪声**。它进入 errors 表只因行内含 "GetLastError" 的 Error 字样。

## 对治

- 无需处理。分析时直接过滤：`grep -v "Failed to load '"`。

## 证据

- 全部 `019ff533-...` 目录日志头部
