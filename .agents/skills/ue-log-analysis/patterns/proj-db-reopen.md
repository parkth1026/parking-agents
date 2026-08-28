---
name: proj-db-reopen
category: hang
signature: "[N.N.N-N.N.N:N][  N]LogAesEarth: FEarthUFSProj::open str -> [FEarthUFSProj::Open"
match: "FEarthUFSProj::(open|read)"
first-seen: 2026-08-25
last-seen: 2026-08-25
verified: true
sources:
  - Docs/bugs/2026-08-25-packaged-build-gpu-zero-freeze-analysis.md
---

## 识别特征

- match: `FEarthUFSProj::(open|read)`
- 错误原句：`LogAesEarth: FEarthUFSProj::open '../../../Engine/Plugins/Runtime/GeoReferencing/Resources/PROJ\proj.db' -> [FEarthUFSProj::Open] EarthUFSProjSupport.cpp(45)`
- 刷屏形态：open/read/seek/close 对 proj.ini 与 proj.db 反复成对出现（每秒数十行）

## 机理

每次坐标转换重开 SQLite proj.db，PJ 上下文未复用——游戏线程同步 IO 阻塞的直接证据
（尾部刷屏 I/O + 帧号不动 = 阻塞源实锤）。

## 对治

- 责任方：代码（AesWorld/AesGeoreference）。复用 PJ 上下文与 proj.db 句柄，禁止每转换重开。

## 证据

- 2026-08-25 08:52 `019ff533-.../2026-08-25/08-50-49.log` 尾部帧 0 PROJ IO 刷屏
