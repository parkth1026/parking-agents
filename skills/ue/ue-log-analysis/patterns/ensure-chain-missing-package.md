---
name: ensure-chain-missing-package
category: ensure-chain
signature: "[N.N.N-N.N.N:N][  N]LogOutputDevice: Error: Ensure condition failed: IsInGameThr"
aliases:
  - "[N.N.N-N.N.N:N][  N]LogStreaming: Error: Couldn't find file for package /Project"
match: "Ensure condition failed: IsInGameThread\\(\\)"
first-seen: 2026-08-24
last-seen: 2026-08-26
verified: true
sources:
  - Docs/bugs/2026-08-27-multigpu-pixelstreaming-gpu3d-zero-freeze-diagnosis.md
  - Docs/bugs/2026-08-25-packaged-build-gpu-zero-freeze-analysis.md
---

## 识别特征

- match: `Ensure condition failed: IsInGameThread\(\)`
- 错误原句（callstack 顶部受害者）：
  `Ensure condition failed: IsInGameThread()  [File:...\CoreRedirects.cpp] [Line: 1374]`
  栈形：`FCoreRedirects::Initialize ← FCoreRedirects::AddKnownMissing ← FLinkerLoad::AddKnownMissingPackage ← FAsyncPackage::CreateLinker`（异步加载线程，帧 0）
- 上游触发者：`Couldn't find file for package /... requested by async loading code`（同文件上方 1-2 行）

## 机理

EDL 在异步加载线程找不到包 → AddKnownMissing → FCoreRedirects 惰性初始化撞 IsInGameThread 断言。
**ensure 只是连锁，根因是那个包不在 pak 里**（或 AesFileSystem 就绪时序问题导致读取失败）。

## 对治

- 责任方：内容/打包。对 pak 清单核对启动路径包；AesFileSystem 注册就绪前延迟 EDL 请求。
- 分析动作：ensure 首次出现处往上追 1-2 行找 `Couldn't find file`，拿到缺失包名。

## 证据

- 2026-08-24 16:22 起多个槽位 110KB 秒退日志（`019ff533-.../2026-08-24/16-22-02*.log` 尾部）
- 2026-08-26 14:46-14:48 slot6×2/slot3 三个进程帧 0 死亡（同目录 `14-46-45.log` 等）
