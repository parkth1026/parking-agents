---
title: "C2660: HandleDownloadComplete 参数数量不匹配 - UHT 生成的代理签名与声明不一致"
created: 2026-04-05
updated: 2026-05-14
type: concept
tags: [error-pattern, compile-error, uht, jenkins]
sources: []
---

# C2660: HandleDownloadComplete 参数数量不匹配 - UHT 生成的代理签名与声明不一致

## 评分元数据

| 维度 | 分数 | 满分 | 说明 |
|------|------|------|------|
| 真实性 | 2.5 | 2.5 | 真实 Jenkins 构建 #118 日志，错误位置在 UHT 生成的代码中 |
| 可复现性 | 1.5 | 2.0 | 有失败构建，但缺少成功修复对 |
| 可操作性 | 1.5 | 3.0 | 问题类型明确（UHT 生成代码冲突），但修复需要深入排查声明 |
| 独特性 | 2.0 | 2.0 | UHT 生成的 .gen.cpp 与手动声明不一致是 UE 特有的编译问题 |
| **总分** | **7.5** | **10** | |

- **分析日期**: 2026-04-05
- **失败构建**: wdp5-project-ue5.5 #118 (2026-03-28)
- **Job**: `wdp-ue/job/WDP5_Project/job/wdp5-project-ue5.5`
- **影响插件**: WIMPlugins (wimapi/WIMAPIEntity)
- **错误类型**: 编译错误 (C2660)
- **UE 版本**: UE 5.5

## 错误详情

### 错误日志

```
E:\ws_wdp5_project_ue5.5_ci\Project\Plugins\51Hitech\WIMPlugins\wimapi\Intermediate\Build\Win64\UnrealEditor\Inc\WIMAPIEntity\UHT\WimDynamicWaterEntity.gen.cpp(287): 
error C2660: 'AWinDynamicWaterEntity::HandleDownloadComplete': function does not take 5 arguments
```

### 关键发现

错误发生在 **UHT (Unreal Header Tool) 自动生成的文件** 中：
- **文件路径**: `Intermediate/Build/Win64/UnrealEditor/Inc/WIMAPIEntity/UHT/WimDynamicWaterEntity.gen.cpp`
- **行号**: 287
- **不是手动编写的代码**

## 根因分析

### 直接原因

UHT 生成的 `.gen.cpp` 文件调用 `HandleDownloadComplete` 时传入了 5 个参数，但 `AWinDynamicWaterEntity` 类中声明的该函数不接收 5 个参数。

### 深层原因

这种情况通常由以下原因导致：

1. **UHT 缓存过期**: `Intermediate` 文件夹中残留了旧版本的 `.gen.cpp`，与当前头文件中的声明不一致
2. **头文件声明变更**: `HandleDownloadComplete` 的签名被修改（增减了参数），但 UHT 没有重新生成
3. **UCLASS/UFUNCTION 宏变更**: 函数上的 `UFUNCTION` 宏可能被修改，导致 UHT 生成不同的代理签名

### 典型场景

```cpp
// 头文件中声明 (当前版本)
UFUNCTION()
void HandleDownloadComplete(int Result);  // 1 个参数

// UHT 生成的 .gen.cpp 中 (旧缓存)
// 代理回调生成代码可能传入了 5 个参数 (旧版本的签名)
```

## 修复方案

### 方案一：清理 Intermediate 文件夹（最常用）

```powershell
# 删除 Intermediate 文件夹强制 UBT 重新生成
Remove-Item -Path "E:\ws_wdp5_project_ue5.5_ci\Project\Intermediate" -Recurse -Force

# 重新构建
```

### 方案二：清理 Binaries + Intermediate

```powershell
Remove-Item -Path "E:\ws_wdp5_project_ue5.5_ci\Project\Intermediate" -Recurse -Force
Remove-Item -Path "E:\ws_wdp5_project_ue5.5_ci\Project\Binaries" -Recurse -Force
```

### 方案三：检查声明一致性

确保 `WimDynamicWaterEntity.h` 中 `HandleDownloadComplete` 的声明与使用一致：

```cpp
// WimDynamicWaterEntity.h
UCLASS()
class AWinDynamicWaterEntity : public AActor
{
    GENERATED_BODY()
    
    // 确保声明与 UFUNCTION 宏一致
    UFUNCTION()
    void HandleDownloadComplete(bool bSuccess, const FString& ErrorCode, const TArray<uint8>& Data, int32 BytesDownloaded, int32 TotalBytes);
};
```

## 影响范围

- **影响插件**: WIMPlugins/wimapi (WIMAPIEntity 模块)
- **受影响类**: AWinDynamicWaterEntity
- **构建配置**: Editor (Win64 Development)

## 预防建议

1. **CI 中清理 Intermediate**: 在 Clean Build 阶段确保彻底清理 Intermediate 文件夹
2. **签名变更后清理**: 修改 UFUNCTION 签名后，务必清理 Intermediate
3. **版本控制**: 将 `Intermediate/` 和 `Binaries/` 加入 `.gitignore`

## 相关知识点

- [027-cs0101-cs0111-buildcs-ue55.md](./027-cs0101-cs0111-buildcs-ue55.md) — UBT 合并编译变更导致的问题
- [033-c2084-gsl-conflict-c7555-cpp20-designated-initializers.md](./033-c2084-gsl-conflict-c7555-cpp20-designated-initializers.md) — 另一个 Intermediate 缓存导致的问题

---

*分析完成时间：2026-04-05 | 来源构建：wdp5-project-ue5.5 #118*


## Related
- [[linux-ld-duplicate-symbol-FAesEditorToolTypeIdGenerator]]
- [[readme]]
