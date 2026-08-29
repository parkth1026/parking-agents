---
title: "UE5.5 Linux 交叉编译: ld.lld duplicate symbol 错误"
created: 2025-12-05
updated: 2026-05-14
type: concept
tags: [error-pattern, clang, aesworld, ue5.5, dotnet, linker-error]
sources: []
---

# UE5.5 Linux 交叉编译: ld.lld duplicate symbol 错误

## 错误信息

\\\
ld.lld: error: duplicate symbol: FAesEditorToolTypeIdGenerator::NextId
>>> defined at Module.AesEditorMode.5.cpp
>>> defined at Module.AesEditorMode.6.cpp
clang++: error: linker command failed with exit code 1 (use -v to see invocation)
Failed to link TWE-Linux-Shipping after 10 retries
\\\

## 根因分析

**问题本质**: C++ ODR (One Definition Rule) 违反 + Unity Build 放大效应

1. **ODR 违反**: 类静态成员 \FAesEditorToolTypeIdGenerator::NextId\ 的定义写在了 **头文件**中，而不是仅在 cpp 中声明+定义
2. **Unity Build 放大**: UBT 将 AesEditorMode 模块的多个 cpp 文件合并成两个 unity blob (Module.AesEditorMode.5.cpp 和 Module.AesEditorMode.6.cpp)
3. **双重包含**: 头文件被两个 unity blob 都包含了，导致 \NextId\ 定义出现两次
4. **MSVC 宽容**: MSVC 在 Windows 上链接时通常静默允许这种重复（可能只取第一个）
5. **Clang/lld 严格**: Linux 交叉编译使用 clang + lld，严格执行 ODR，链接时报错

## 修复方案

### 方案一（推荐）: 修正静态成员定义位置

**错误写法** (头文件):
\\\cpp
// FAesEditorToolTypeIdGenerator.h
class FAesEditorToolTypeIdGenerator {
public:
    static int32 NextId; // 声明
};

// ❌ 错误: 不应在头文件中定义（非 inline）
int32 FAesEditorToolTypeIdGenerator::NextId = 0;
\\\

**正确写法**:

// 头文件 (仅声明)
\\\cpp
// FAesEditorToolTypeIdGenerator.h
class FAesEditorToolTypeIdGenerator {
public:
    static int32 NextId;
};
\\\

// cpp 文件 (定义一次)
\\\cpp
// FAesEditorToolTypeIdGenerator.cpp
#include "FAesEditorToolTypeIdGenerator.h"
int32 FAesEditorToolTypeIdGenerator::NextId = 0;
\\\

### 方案二: 使用 inline static (C++17+)

UE5.5 使用 C++20，可以直接用:
\\\cpp
class FAesEditorToolTypeIdGenerator {
public:
    inline static int32 NextId = 0; // ✅ 每个翻译单元允许一个定义
};
\\\

### 方案三（临时）: 禁用 Unity Build

\\\csharp
// AesEditorMode.Build.cs
public AesEditorMode(ReadOnlyTargetRules Target) : base(Target) {
    bUseUnity = false; // ⚠️ 不推荐长期使用
}
\\\

## 实际修复

- **故障构建**: twe-ue5.5-linux-ci#315 (AesWorld commit: \3b8df7a\, dev_cache 分支)
- **修复构建**: twe-ue5.5-linux-ci#316 (AesWorld commit: \ca166b26\, dev 分支)
- **修复内容**: dev_cache 分支的头文件中存在静态成员定义，合并到 dev 后该定义被移除或移到正确位置
- **涉及模块**: \AesEditorMode\ (Source/Editor/AesEditorMode/)
- **触发条件**: 仅 Linux/Clang 交叉编译，Windows MSVC 链接不报错

## 预防措施

1. 代码审查时注意: **头文件中不要定义非 inline 的 static 成员变量**
2. CI 增加 Linux 交叉编译检查（非仅 Windows）
3. 使用 \UseUnity = false\ 临时禁用可快速定位是哪里的 ODR 问题

## 相关知识库

- Epic 官方: [Unreal Build Tool Target Reference](https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-build-tool-target-reference)
- 同一错误模式: \UseUnity = false\ 可作为临时解法

---
*来源: twe-ue5.5-linux-ci#315→#316, 2025-12-05*


## Related
- [[readme]]
- [[scene-index]]
