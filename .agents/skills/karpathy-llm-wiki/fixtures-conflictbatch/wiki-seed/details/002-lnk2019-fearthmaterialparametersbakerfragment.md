---
title: "[链接错误] LNK2019 未解析外部符号 - FEarthMaterialParametersBakerFragment"
created: 2026-03-30
updated: 2026-05-14
type: concept
tags: [error-pattern, linker-error, aesworld, jenkins, dotnet]
sources: []
---

# [链接错误] LNK2019 未解析外部符号 - FEarthMaterialParametersBakerFragment

> **知识点评分**: 8/10  
> **来源**: Build #3908 (FAILURE) → #3910 (SUCCESS)  
> **日期**: 2026-03-30  
> **Job**: wdp-ue/job/Earth/job/aes6-ue-runtime-ci  
> **评分明细**: 错误明确性 3 + 日志对比 2 + 可复用性 3 = 8/10

## 问题描述

在 aes6-ue-runtime-ci 构建 #3908 中，编译 EarthPrefab 模块时出现 LNK2019 链接错误，提示缺少 `FEarthMaterialParametersBakerFragment` 类的两个成员函数实现。

### 错误日志

```
Module.EarthPrefab.7.cpp.obj : error LNK2019: unresolved external symbol "public: void __cdecl FEarthMaterialParametersBakerFragment::BakeMaterialParameters(void)" (?BakeMaterialParameters@FEarthMaterialParametersBakerFragment@@QEAAXXZ) referenced in function "public: static void __cdecl UEarthOutputFunctionLibrary::BakeMaterialParameters(struct FEarthMaterialParametersBakerFragment &)" (?BakeMaterialParameters@UEarthOutputFunctionLibrary@@SAXAEAUFEarthMaterialParametersBakerFragment@@@Z)

Module.EarthPrefab.7.cpp.obj : error LNK2019: unresolved external symbol "public: void __cdecl FEarthMaterialParametersBakerFragment::CreateStaticTexture(class UObject *)" (?CreateStaticTexture@FEarthMaterialParametersBakerFragment@@QEAAXPEAVUObject@@@Z) referenced in function "public: static void __cdecl UEarthOutputFunctionLibrary::CreateStaticTexture(class UObject *,struct FEarthMaterialParametersBakerFragment &)" (?CreateStaticTexture@UEarthOutputFunctionLibrary@@SAXPEAVUObject@@AEAUFEarthMaterialParametersBakerFragment@@@Z)

D:\ws_twe_ue5.5_ci\Project\Plugins\G\AesWorld\Binaries\Win64\UnrealEditor-EarthPrefab.dll : fatal error LNK1120: 2 unresolved externals
```

### 错误位置

- **文件路径**: `Plugins\G\AesWorld\Binaries\Win64\UnrealEditor-EarthPrefab.dll`
- **引用源文件**: `Module.EarthPrefab.7.cpp`
- **错误代码**: LNK2019（未解析的外部符号）
- **缺失函数**:
  1. `FEarthMaterialParametersBakerFragment::BakeMaterialParameters()`
  2. `FEarthMaterialParametersBakerFragment::CreateStaticTexture(UObject*)`
- **构建阶段**: UBT 链接阶段

## 问题分析

### 可能原因

1. **函数声明与实现不匹配**:
   - 头文件中声明了这两个函数，但源文件中缺少实现
   - 或者实现文件的编译配置有误，导致目标文件未包含在链接中

2. **模块依赖问题**:
   - `FEarthMaterialParametersBakerFragment` 可能定义在另一个模块中
   - 该模块未正确链接到 EarthPrefab 模块

3. **代码提交不完整**:
   - 某次提交只添加了函数声明，忘记添加实现
   - 或者实现文件被意外删除/移动

4. **UBT 配置问题**:
   - `EarthPrefab.Build.cs` 中缺少必要的模块依赖
   - 或者源文件包含规则有误

### 对比分析

**失败构建 #3908**:
- 插件版本: AesWorld: `8680bdb fix: installed build 缺少 UObject/Package.h 导致 UPackage 到 UObject 隐式转换失败`
- 链接失败，2 个未解析符号

**成功构建 #3910**:
- 使用完全相同的代码版本（所有仓库 commit hash 一致）
- 链接成功，BUILD SUCCESSFUL
- 表明这是增量编译工件过时导致的瞬时失败，非代码问题

## 修复方案

### 短期修复（代码层面）

1. **检查函数实现**:
   在 AesWorld 插件中搜索 `FEarthMaterialParametersBakerFragment` 类，确认：
   ```cpp
   // 头文件声明
   class FEarthMaterialParametersBakerFragment
   {
       void BakeMaterialParameters();
       void CreateStaticTexture(UObject* Context);
   };
   
   // 源文件实现（必须存在）
   void FEarthMaterialParametersBakerFragment::BakeMaterialParameters()
   {
       // 实现代码
   }
   
   void FEarthMaterialParametersBakerFragment::CreateStaticTexture(UObject* Context)
   {
       // 实现代码
   }
   ```

2. **检查模块依赖**:
   在 `EarthPrefab.Build.cs` 中添加必要的模块依赖：
   ```csharp
   PublicDependencyModuleNames.AddRange(new string[] { 
       "Core", 
       "CoreUObject", 
       "Engine",
       "AesWorld" // 如果 FEarthMaterialParametersBakerFragment 在 AesWorld 中定义
   });
   ```

3. **检查源文件包含**:
   确保实现函数的 `.cpp` 文件被包含在模块编译中：
   ```csharp
   // EarthPrefab.Build.cs
   PrivateDependencyModuleNames.AddRange(...);
   // 确认包含所有必要的源文件
   ```

### 长期建议

1. **链接时验证**: 在 CI 流程中添加链接时符号检查，提前发现未实现函数
2. **代码审查**: 添加函数声明时必须同时提交实现，或在同一 PR 中完成
3. **模块解耦**: 明确模块间依赖关系，避免循环依赖导致链接问题

## 验证方法

1. 在本地环境中打开 AesWorld 插件解决方案
2. 搜索 `FEarthMaterialParametersBakerFragment` 类
3. 确认两个缺失函数的实现存在
4. 重新编译 EarthPrefab 模块
5. 确认 LNK2019 错误消失后提交修复

## 相关资源

- Jenkins 失败构建: http://10.66.12.40/job/wdp-ue/job/aes6-ue-runtime-ci/3908/console
- Jenkins 成功构建: http://10.66.12.40/job/wdp-ue/job/aes6-ue-runtime-ci/3910/console
- MSDN LNK2019 文档: https://learn.microsoft.com/en-us/cpp/error-messages/tool-errors/linker-tools-error-lnk2019

## 类似错误模式

LNK2019/LNK2001 链接错误在 UE5 项目中常见原因：
- 函数声明但未实现
- 模板函数未在内联实现
- 模块依赖缺失
- 源文件未加入编译
- 库文件链接顺序错误

**关键词**: LNK2019, LNK1120, unresolved external symbol, linker error, UE5, UBT, FEarthMaterialParametersBakerFragment

---
*自动生成于 2026-03-31 18:45*


## Related
- [[linux-ld-duplicate-symbol-FAesEditorToolTypeIdGenerator]]
- [[readme]]
