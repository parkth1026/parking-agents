---
title: "[资产错误] UE 资产版本不匹配导致 Cook 失败"
created: 2026-03-31
updated: 2026-08-20
type: concept
tags: [error-pattern, cook-error, packaging-error, aesworld, jenkins, p4]
sources: []
---

# [资产错误] UE 资产版本不匹配导致 Cook 失败

> **知识点评分**: 9/10  
> **来源**: Build #3877→#3876  
> **日期**: 2026-03-31  
> **Job**: wdp-ue/job/Earth/job/aes6-ue-runtime-ci  
> **评分明细**: 错误明确性 3 + 日志对比 2 + Commit 验证 2 + 可复用性 2 = 9/10

## 问题描述

在 aes6-ue-runtime-ci 构建 #3877 中，Cook 阶段失败，原因是 UAsset 资产文件的版本高于当前引擎版本。

### 错误日志

```
Error: Package D:/ws_twe_ue5.1_ci/Project/Plugins/G/AesWorld/Content/UI/BottomToolBar/DomManager/WBP_DomManager.uasset is too new. Engine Version: 1008  Package Version: 1013
ERROR: Cook failed.
ERROR: Package project failed.
```

### 错误位置

- **资产路径**: `Plugins/G/AesWorld/Content/UI/BottomToolBar/DomManager/WBP_DomManager.uasset`
- **引擎版本**: 1008 (UE5.1.x)
- **资产版本**: 1013 (UE5.3.x 或更高)
- **构建阶段**: Cook 阶段

## 问题分析

### Commit 变更对比

| 构建 | AesWorld Commit | Commit Message |
|------|-----------------|----------------|
| #3876 (成功) | 38f5ff16 | linux 编译报错的问题，Image 头文件引用触发的 |
| #3877 (失败) | 01913bc8 | (空) |

### 根本原因

1. **资产版本不兼容**: 
   - 当前构建使用的引擎版本是 UE5.1 (内部版本 1008)
   - `WBP_DomManager.uasset` 资产是用更高版本的 UE5 (版本 1013，可能是 UE5.3) 保存的
   - UE 资产格式不向后兼容：高版本引擎保存的资产无法在低版本引擎中使用

2. **可能的场景**:
   - 美术人员在更高版本的 UE5 编辑器中打开并保存了资产
   - 资产被提交到版本控制，但 CI 构建仍使用较旧的引擎版本
   - 团队内引擎版本不统一

3. **为什么成功构建 #3876 没有此问题**:
   - Commit `38f5ff16` 可能修复了资产版本问题（保存为兼容版本）
   - 或者该 commit 之前资产尚未被高版本编辑器保存

## 修复方案

### 方案 1: 重新保存资产为兼容版本（推荐）

1. 使用与 CI 构建相同版本的 UE5 引擎打开项目
2. 在编辑器中打开 `WBP_DomManager.uasset`
3. 保存资产（会自动降级到当前引擎版本）
4. 提交修复后的资产

### 方案 2: 升级 CI 构建引擎版本

如果团队已迁移到更高版本的 UE5，应更新 CI 构建配置：
- 更新 Jenkins 构建使用的引擎版本
- 确保所有开发人员的引擎版本与 CI 一致

### 方案 3: 批量降级资产

如果有多个资产存在版本问题：
```powershell
# 使用命令行工具批量检查资产版本
# 或使用 UE 的 "Save Package" 功能批量保存
```

## 验证方法

1. **本地验证**: 使用 CI 相同版本的引擎打开项目，确认资产可正常加载
2. **Cook 验证**: 在本地执行 Cook 操作，确认无版本错误
3. **Jenkins 验证**: 推送修复后观察构建状态

## 预防措施

### 团队规范

1. **引擎版本锁定**: 
   - 团队所有成员使用相同版本的 UE5 引擎
   - 在 `.ue4settings` 或项目配置中明确指定引擎版本

2. **资产提交检查**:
   - 提交前检查资产版本是否与项目引擎版本匹配
   - 使用预提交钩子检查资产版本

3. **CI/CD 检查**:
   - 在 Cook 阶段前添加资产版本检查步骤
   - 发现版本不匹配时提前失败并给出明确提示

### 技术措施

1. **引擎版本检测脚本**:
```python
# 检查 uasset 文件的引擎版本
import struct

def check_asset_version(asset_path):
    with open(asset_path, 'rb') as f:
        # UAsset header 包含版本信息
        # 解析并检查是否与目标引擎版本匹配
        pass
```

2. **项目配置**:
   - 在 `.editorconfig` 或项目设置中指定目标引擎版本
   - 使用 `DefaultEngine.ini` 中的版本配置

## 相关资源

- UE 资产格式文档：https://docs.unrealengine.com/
- Jenkins 失败构建：http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3877/console
- Jenkins 成功构建：http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3876/console

## 类似错误模式

资产版本不匹配是 UE 项目常见问题：
- **症状**: "Package is too new" 或 "Package Version" 错误
- **原因**: 高版本引擎保存的资产在低版本引擎中使用
- **解决**: 用正确版本引擎重新保存资产

**关键词**: Asset Version, Package Version, Cook Failed, UE5, 资产版本不兼容

## Recurrences

| Date | Builds | Trigger | Notes |
|------|--------|---------|-------|
| 2026-08-20 | #1976-1979 → #1980 | P4 主工程内容变更（syncID aes6-ue-runtime-ci-twe_autoci，head 203864→203881）把 Project/Content/GameTest/GameMode/GameMode_Vehicle.uasset 以 Package Version 1009 提交（CI 引擎 1008） | **第 7 次复发，首次见于 P4 主工程 Content**（前 6 次均为 git 插件仓库）。Cook 22 错 = 1 条 "is too new" + 21 条下游 BP 编译错误（51EarthBuilder WBP invalid cast / stale pins，与前次复发同构级联）。修复经 P4：#1979→#1980 七仓 pin 完全一致，唯一版本控制变化 p4 sync 203881→203890，#1980 用户手动触发后 BUILD SUCCESSFUL。P4 changelist 明细不可得，本轮 Reuse 如实记 0 |
| 2026-08-19 | #1550-1553 → #1554 | AesWorld e04b8fb44「更新tooltip动图」把 Content/UI 下 37 个资产（TooltipGIF 动图 8 个、DT_TooltipInfo、WBP_Tooltip 等）以 Package Version 1009 提交，各日志 72-78 处 "is too new" | **第 6 次复发，首见于 AesWorld 仓库**。修复两步：9d0825b2 字节级回滚全部资产 + f43f99f 用 5.1 引擎重存并更名 TooltipGIF 为 T_GIF_*。#1554 错误零出现。七仓 pin 比对唯一变化 f43f99f，本地 AesWorld 克隆验证 36 文件全为二进制 .uasset |
| 2026-08-18 | #1127-1129 → #1141 | EarthArtAsset c05ce82 把 DT_InstanceSplineAsset_Lane.uasset 以 Package Version 1009 提交 | 第 4 次复发；修复 71c09ab 同名变更改用 5.1 引擎重存，#1141 BUILD SUCCESSFUL |
| 2026-08-18 | #1074-1075 → #1076 | EarthArtAsset baddd2d 把 M_Terrain.uasset 以 Package Version 1009 提交 | 第 3 次复发；修复 281dfc7 同消息重存，七仓 pin 比对唯一变化，#1076 错误消失 |
| 2026-08-18 | #1173 → #1174 | DT_Settings.uasset Package Version 1009 vs Engine 1008（51EarthBuilder 60363ff） | 第 5 次复发；Fix commit 9f18fd5 同名变更 5.1 引擎重存，#1174 BUILD SUCCESSFUL。六仓 pin 比对唯一变化 |
| 2026-03-31 | #3877 -> #3876 | WBP_DomManager.uasset saved with higher UE version | Original occurrence |
| 2026-01-14 | #3763 -> #3765 | BP_BuildingGizmo_Height.uasset + WBP_Tips.uasset (Engine 1008 vs Package 1013) | Same root cause, different asset files. Fix commit: 0a4a089 "修复资产版本太新导致打包失败" |

### 回流分析（2026-08-20，对账证据 recorded_at 2026-08-20）

与原分析同根因（高版本引擎保存的 .uasset 无法被 CI 低版本引擎 Cook），但呈现两条原页面未覆盖的演化趋势：

1. **来源扩散**：前 2 次（2026-01/03）集中在插件仓库 → 第 3-6 次扩散至 EarthArtAsset/51EarthBuilder/AesWorld 三个 git 仓库 → 第 7 次首见于 **P4 主工程 Content**。git 仓库的「同名重存」自愈模式对 P4 路径不适用：P4 侧修复靠 sync head 前移 + 手动触发，且 changelist 明细不可得，归因只能到「唯一版本控制变化」层级。
2. **版本差收窄**：原始记录差 +5（1008 vs 1013，跨大版本 UE5.1→5.3+）；2026-08 以来全部为 +1（1008 vs 1009），推测是开发者本地引擎构建略新于 CI 而非大版本错位——预防重点从「拦截大版本错存」转向「对齐 CI 与本地引擎构建版本」（Epic 建议：.uproject 固定 EngineAssociation + 预提交钩子解析 .uasset 头部 FileVersionUE5）。

预防措施（引擎版本锁定、资产提交检查、CI 前置检查）见上文；对 P4 路径需额外覆盖：P4 提交端同样需要资产版本钩子。

---
*自动生成于 2026-03-31 19:00:00, 更新于 2026-08-20（recurrence 回流）*


## Related
- [[linux-ld-duplicate-symbol-FAesEditorToolTypeIdGenerator]]
- [[readme]]
