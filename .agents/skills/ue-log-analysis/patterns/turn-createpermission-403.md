---
name: turn-createpermission-403
category: network-signal
signature: "[N.N.N-N.N.N:N][N]LogPixelStreamingNCloudWebRTC: (tid:N)(turn_port.cc:N): Receiv"
match: "Received TURN CreatePermission error response"
first-seen: 2026-08-26
last-seen: 2026-08-26
verified: false
sources:
  - Docs/bugs/2026-08-27-multigpu-pixelstreaming-gpu3d-zero-freeze-diagnosis.md
---

## 识别特征

- match: `Received TURN CreatePermission error response`
- 错误原句：`(turn_port.cc:1874): Received TURN CreatePermission error response, code=403; pruned co...`
- 伴随：ICE 状态快速翻转 `Connected → Disconnected(≈14s) → Closed`；游戏线程当时健康（先跑 frames 排除引擎侧）

## 机理

TURN 服务器拒绝 CreatePermission（鉴权配置问题：静态 auth secret/用户名过期窗口），
中继候选被剪——强 NAT 客户端无法建流，反复重连（每次重连又重新进入并发缺陷路径，见
mtaccess-data-race-broadcast）。

## 对治

- 责任方：运维。核对 TURN 服务 CreatePermission 鉴权配置；排查时先跑 frames 确认游戏线程健康再归因网络。

## 证据

- 2026-08-26 GPU4 会话 222 次（14:47-14:52 ICE 震荡期）；GPU2 玩家 Connected 14 秒即断（`14-13-00.log` 尾部）
