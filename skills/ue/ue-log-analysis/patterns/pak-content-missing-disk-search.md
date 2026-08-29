---
name: pak-content-missing-disk-search
category: startup-fail
signature: "[N.N.N-N.N.N:N][  N]LogStreaming: Error: This will hitch streaming because it en"
aliases:
  - "[N.N.N-N.N.N:N][  N]LogStreaming: Error: Found 0 dependent packages..."
match: "This will hitch streaming|Found 0 dependent packages|Failed to read file '"
first-seen: 2026-08-26
last-seen: 2026-08-26
verified: false
sources:
  - Docs/bugs/2026-08-27-multigpu-pixelstreaming-gpu3d-zero-freeze-diagnosis.md
---

## 识别特征

- match: `This will hitch streaming|Found 0 dependent packages|Failed to read file '`
- 错误原句（三形态）：
  `LogStreaming: Error: This will hitch streaming because it ends up searching the disk instead of finding the file in the pak file.`
  `LogStreaming: Error: Found 0 dependent packages...`
  `LogStreaming: Warning: Failed to read file '../../../Engine/Plugins/Runtime/GeoReferencing/Resources/GeoReferencingSystem_16x16.png'`

## 机理

pak 内缺内容（插件资源/依赖包）→ 流送退化为磁盘搜索 → hitch。与 ensure-chain-missing-package
（其 ensure 连锁形态）同根因：**包内容缺失**，本条是不带 ensure 的轻度形态。GeoReferencing 的
png/ini 类缺资源属打包清单遗漏，不致死但拖启动。

## 对治

- 责任方：内容/打包。对 pak 清单核对插件资源（GeoReferencing Resources 目录）与依赖包。

## 证据

- 2026-08-26 14:13 两份会话启动段（`14-13-00.log` 等，帧 0 处）
