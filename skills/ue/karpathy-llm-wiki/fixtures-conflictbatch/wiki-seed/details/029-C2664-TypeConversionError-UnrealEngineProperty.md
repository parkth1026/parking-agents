---
title: "029-C2664-TypeConversionError-UnrealEngineProperty"
created: 2026-04-02
updated: 2026-05-14
type: concept
tags: [error-pattern, compile-error, aesworld, aesruntime, jenkins, linker-error]
sources: []
---

# 029-C2664-TypeConversionError-UnrealEngineProperty

## 元信息

- **编号**: 029
- **主题**: C2664 类型转换错误 - UProperty 转换失败
- **错误类型**: 编译错误 (C2664)
- **评分**: 8/10
- **分析日期**: 2026-04-02
- **来源构建**: wdp5-ue5.5-project-ci #147→#146
- **影响插件**: AesRuntimeCore
- **影响模块**: BlueprintSystem

## 错误现象

### 编译错误日志
```
D:\ws_wdp5_project_ue5.5_ci\Project\Plugins\G\AesWorld\Source\AesRuntimeCore\Private\Blueprints\AesBlueprintFunctionLibrary.cpp(78):
error C2664: 'void UFunction::SetLinkerOptions(TArray<FString>&)': cannot convert argument 1 from 'TArray<FString>' to 'TArray<FString>&'
```

### 错误位置
- **文件**: `AesBlueprintFunctionLibrary.cpp(78)`
- **错误类型**: C2664 (函数参数转换失败)
- **错误信息**: 无法从 `TArray<FString>` 转换为 `TArray<FString>&` (引用参数)
- **函数调用**: `SetLinkerOptions()` 函数调用错误

### 错误统计
- **错误总数**: 3 个 C2664 错误
- **相关文件**: 3 个 Blueprint 相关文件
- **模块影响**: BlueprintSystem 模块编译失败
- **构建进度**: 约23%完成时失败

## 根因分析

### Commit 变更对比

| 构建 | 主要 Commit | 相关代码变更 |
|------|-------------|-------------|
| #146 (成功) | AesRuntimeCore: Blueprint 优化 | 正常提交 |
| #147 (失败) | AesRuntimeCore: UProperty 引用优化 | 引用传递修改 |

### 根本原因

1. **参数传递方式错误**: `SetLinkerOptions()` 函数期望引用参数 `TArray<FString>&`，但传递了值类型 `TArray<FString>`

2. **UE5 UProperty API 变更**: 在 UE5.5 中，某些 UProperty 相关函数的参数类型发生了变化：
   - 旧版本: 接受值类型参数
   - 新版本: 要求引用类型参数用于性能优化

3. **模板特化问题**: 可能涉及到自定义的 UProperty 类型，其接口与标准 UProperty 不一致

4. **头文件包含顺序**: 自定义 UProperty 头文件可能覆盖了标准 UProperty 的声明

### 相关代码模式

错误通常出现在以下模式中：
```cpp
// AesBlueprintFunctionLibrary.cpp 第78行附近
TArray<FString> linkerOptions = {"option1", "option2"};

// 错误的调用方式
SetLinkerOptions(linkerOptions);  // 传递值类型，函数期望引用

// 正确的调用方式应该是什么？
// 可能需要：SetLinkerOptions(linkerOptions);
// 或者：SetLinkerOptions(&linkerOptions);
```

## 修复方案

### 方案 1: 使用引用参数

直接传递数组的引用：

```cpp
// AesBlueprintFunctionLibrary.cpp
void AesBlueprintFunctionLibrary::SetLinkerOptions(const TArray<FString>& Options)
{
    // 函数参数改为 const 引用
    Super::SetLinkerOptions(Options);
}
```

### 方案 2: 重载数组传递

确保函数签名正确：

```cpp
// 错误的函数声明
void SetLinkerOptions(TArray<FString> Options);

// 正确的函数声明
void SetLinkerOptions(const TArray<FString>& Options);
// 或者
void SetLinkerOptions(TArray<FString>& Options);
```

### 方案 3: 模板特化适配

如果是自定义 UProperty 类型，可能需要特化：

```cpp
template<>
class TCustomProperty<FString> : public UProperty
{
public:
    void SetLinkerOptions(const TArray<FString>& Options) override
    {
        // 实现引用版本
    }
};
```

### 方案 4: 转换为引用类型

在调用处进行类型转换：

```cpp
TArray<FString> linkerOptions = {"option1", "option2"};
SetLinkerOptions(linkerOptions);  // 这里应该添加引用转换

// 或者使用标准库函数
SetLinkerOptions(TArray<FString&>(linkerOptions));
```

## 验证方法

1. **本地编译测试**: 修改后使用 `Build.bat` 编译 BlueprintSystem 模块
2. **API 文档检查**: 确认 SetLinkerOptions() 的正确参数类型
3. **蓝图测试**: 在编辑器中测试蓝图功能是否正常工作

## Commit 验证

### 构建 #147 变更
- AesRuntimeCore: UProperty 引用优化
- 可能涉及 UProperty 的内存管理优化
- 引入新的 UProperty 子类

### 构建 #146 成功状态
- 无 C2664 类型转换错误
- UProperty 使用标准调用方式

### 差异分析
构建 #147 引入了 UProperty 相关的优化，但可能改变了函数签名，导致参数传递方式不匹配。

## 经验教训

### 预防建议

1. **UE5 API 变更关注**: UE5.x 版本中 API 可能发生变化，特别是 UProperty 相关
2. **参数类型一致性**: 确保函数调用与声明类型完全匹配
3. **编译器警告**: 启用所有编译器警告级别，提前发现类型转换问题

### 可复用模式

此问题模式可应用到其他类似场景：

- **引用参数传递**: C2664 错误通常指向引用/值参数不匹配
- **模板特化接口**: 自定义类型需要适配标准接口
- **UE5 API 兼容性**: 版本升级时需要检查接口变化

## 相关链接

- [Jenkins 构建 #147](http://10.66.12.40/job/wdp-ue/job/WDP5_Project/job/wdp5-ue5.5-project-ci/147/console)
- [Jenkins 构建 #146](http://10.66.12.40/job/wdp-ue/job/WDP5_Project/job/wdp5-ue5.5-project-ci/146/console)
- [C2664 错误文档](https://learn.microsoft.com/en-us/cpp/error-messages/compiler-errors-1/c2664)
- [UProperty 文档](https://docs.unrealengine.com/en-US/API/Runtime/CoreUObject/Property/UProperty/index.html)

> **拆分说明**（2026-08-17 页面大小治理）：评分详情与存放位置已拆分至 029-C2664-TypeConversionError-UnrealEngineProperty-scoring。

## Related
- 036-c2039-c2664-fmeshbvhpicker-api-change
- 066-c2664-elayertype-eearthlayertype-enum-rename
