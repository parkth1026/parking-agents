---
name: stun-local-udp-send-fail
category: network-signal
signature: "[N.N.N-N.N.N:N][N]LogPixelStreamingNCloudWebRTC: (tid:N)(stun_port.cc:N): Port[c"
aliases:
  - "ErrorText: STUN binding request timed out."
match: "UDP send of .* failed with error|STUN binding request timed out|Failed to send TURN message"
first-seen: 2026-08-26
last-seen: 2026-08-27
verified: false
sources:
  - Docs/bugs/2026-08-27-multigpu-pixelstreaming-gpu3d-zero-freeze-diagnosis.md
---

## 识别特征

- match: `UDP send of .* failed with error|STUN binding request timed out`
- 错误原句（两形态）：
  `(stun_port.cc:334): Port[...]: UDP send of 96 bytes to host 127.0.0.x:55053 (127.0.0.x:55053) failed with error 10049`
  `(stun_port.cc:631): UDP send of 20 bytes to host 127.0.0.x:8892 (127.0.0.x:8892) failed with error 0 : [0x00002741]`（0x2741=10049）
  `(turn_port.cc:856): Port[...relay...]: Failed to send TURN message, error: 10049`（relay 形态）
- 配对：`ErrorCode: 701` + `ErrorText: STUN binding request timed out.`
- 刷屏量级：单日志可达 1.5 万行（ICE 震荡期），是 errors 表的头号噪声大户

## 机理

环回地址（127.0.0.x）上的 STUN/TURN 端点发包失败（WSAEADDRNOTAVAIL 10049：地址不可用）→
STUN binding 超时(701) → ICE 候选反复震荡。与 turn-createpermission-403 同属连接层故障族：
本机/本地中继端点不可达或未监听。注意：**日志尾巴常带 GBK 乱码**（[0x00002741] 后的乱字节），勿疑日志损坏。

## 对治

- 责任方：运维（信令/TURN 拓扑）。核对本地 STUN/TURN 端点监听与 127.0.0.1 端口配置；
  ICE 震荡期先跑 frames 排除引擎侧（游戏线程通常健康）。
- 分析动作：命中即按 error-classification.md 网络信令类取径。

## 证据

- 2026-08-26 GPU4 会话 15,242+2,002+1,993 行（14:47-14:52 ICE 震荡期）；5 份日志出现 701 对
