# 诊断报告: linux-ci #466 构建失败

> **Job**: twe-ue5.5-linux-ci #466
> **构建时间**: 2026-04-08 03:55:49 (UTC+8)
> **构建耗时**: 23.6 分钟
> **构建结果**: FAILURE (Package Error)
> **触发方式**: 定时触发 (Started by timer)
> **构建节点**: twe_autoci

---

## 错误摘要

构建日志中发现 **1 个编译错误**（非级联，为单一根因错误）。

| 错误类型 | 错误代码 | 文件 | 描述 |
|---------|---------|------|------|
| Clang 编译错误 | `-Wdelete-incomplete` | UniquePtr.h(66,3) → AesLodSystemLayeredQuadRequest.h | 删除不完整类型指针 `FAesTracePayloadScope` |

Win64 Editor 构建阶段（519/519）已全部通过，错误仅出现在 **Linux Shipping 交叉编译** 阶段（Module.AesLodSystem.cpp 编译时）。

---

## 诊断: -Wdelete-incomplete in AesLodSystemLayeredQuadRequest.h

**主要错误**:
```
UniquePtr.h(66,3): error: deleting pointer to incomplete type 'FAesTracePayloadScope'
may cause undefined behavior [-Werror,-Wdelete-incomplete]
```

**完整错误链**:
```
UniquePtr.h(66,3): error: deleting pointer to incomplete type 'FAesTracePayloadScope'
  may cause undefined behavior [-Werror,-Wdelete-incomplete]
   66 |                 delete Ptr;
      |                 ^      ~~~
UniquePtr.h(272,3): note: in instantiation of member function
  'TDefaultDelete<FAesTracePayloadScope>::operator()' requested here
  272 |                 GetDeleter()(Ptr);
      |                 ^
AesLodSystemLayeredQuadRequest.h(14,14): note: in instantiation of member function
  'TUniquePtr<FAesTracePayloadScope>::~TUniquePtr' requested here
   14 |         FORCEINLINE FAesLodSystemLayeredQuadRequest(...)
      |                     ^
AesLodSystemLayeredQuadRequest.h(9,8): note: forward declaration of 'FAesTracePayloadScope'
    9 | struct FAesTracePayloadScope;
      |        ^
1 error generated.
```

### 根因分析

**置信度**: High

**根因**: 提交 `8894ec3`（"拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)"）对 AesWorld 插件进行了大规模模块重构，将 AesWorldInsights 拆分为 AesWorldProfiling（Runtime）和 AesWorldInsights（Program）。该重构涉及 43 个文件、1089 行新增和 1236 行删除。

重构后，`FAesTracePayloadScope` 结构体在 `AesWorldProfilingTrace.h` 中采用条件编译定义：仅当 `WITH_EARTH_DEBUGGER` 宏启用时才有完整定义。在非 debug 构建（如 Linux Shipping CI）中，该宏未启用，`FAesTracePayloadScope` 只有前向声明（forward declaration），没有完整类型定义。

`AesLodSystemLayeredQuadRequest.h` 中使用了 `TUniquePtr<FAesTracePayloadScope>` 成员，当编译器需要实例化 `TUniquePtr` 的析构函数时，需要调用 `delete` 操作符。对不完整类型调用 `delete` 是未定义行为（UB）。Clang 通过 `-Wdelete-incomplete`（在 `-Werror` 模式下升级为错误）捕获了这个问题。

**为什么 Windows 构建通过但 Linux 失败**：MSVC 编译器不会对 `delete` 不完整类型报错（它默认生成一个不带析构调用的 `delete`），而 Clang 严格遵循标准并将其标记为错误。这是一个典型的跨平台编译差异问题。

### 证据来源

- **知识库**: 完全匹配 —— `linux-466-Wdelete-incomplete-FAesTracePayloadScope.md`，评分 10/10（已验证修复）。该知识条目记录了 #466-#468 连续失败，#469 成功修复。
- **Epic 官方指导**: 跳过 —— 知识库匹配评分 10/10，已有完整验证修复方案，无需额外查询。
- **源码上下文**: 已确认 `AesLodSystemLayeredQuadRequest.h`（当前版本）已不再包含 `FAesTracePayloadScope` 的前向声明和 `TUniquePtr` 成员，说明修复已合入。
- **Web 搜索**: 跳过 —— 前述来源已提供充足证据。

### 推荐修复方案

该错误已在后续构建中被修复，两次提交共同解决了问题：

**修复 1** — 提交 `694ca45`（"修复clang下TUniquePtr不完整类型导致的编译错误"）:
- 将 `FAesLodSystemLayeredQuadRequest` 的构造函数和析构函数从头文件移至 `.cpp` 文件
- 确保 `TUniquePtr` 析构时 `FAesTracePayloadScope` 为完整类型

**修复 2** — 提交 `c6e1eab`（"为非debug构建提供Trace struct空桩定义，修复clang -Wdelete-incomplete错误"）:
- 在 `AesWorldProfilingTrace.h` 的 `#else`（非 debug）分支中添加空桩定义：
```cpp
struct FAesTraceScope {};
struct FAesTracePayloadScope {};
struct FAesTraceProducerScope {};
```
- 同时在 `AesWorldProfilingTrace.cpp` 的 `#if WITH_EARTH_DEBUGGER` 分支中补充了缺失的 `#include "AesProducerGraphStore.h"`

**修复构建**: #469 (SUCCESS)

### 构建流程分析

构建分为两个阶段：
1. **Win64 Editor 构建**: 519/519 全部通过（耗时约 183 秒），ExitCode=0
2. **Linux Shipping 交叉编译 (BuildCookRun)**: 在编译 Module.AesLodSystem.cpp 时失败（第 13/474 个编译单元），ExitCode=6

构建命令：
```
RunUAT.bat BuildCookRun
  -project="D:/ws_twe_ue5.5_linux_ci/Project/TWE.uproject"
  -targetplatform=Linux
  -clientconfig=Shipping
  -build -cook -stage -archive -package
```

### 参考资料

- **知识库文件**: `wiki-raw/jenkins-learnings/details/linux-466-Wdelete-incomplete-FAesTracePayloadScope.md`
- **引发错误的提交**: `8894ec3` — 拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)
- **修复提交 1**: `694ca45` — 修复clang下TUniquePtr不完整类型导致的编译错误
- **修复提交 2**: `c6e1eab` — 为非debug构建提供Trace struct空桩定义
- **Epic 官方文档**: [Unreal Smart Pointer Library](https://dev.epicgames.com/documentation/unreal-engine/smart-pointers-in-unreal-engine)

### 预防建议

1. 在头文件中使用 `TUniquePtr<T>` 时，确保 `T` 在析构函数实例化处为完整类型 —— 要么 include 完整定义，要么将析构函数移至 `.cpp` 文件
2. 对于条件编译定义的结构体（如仅 debug 模式有效的类型），始终在 `#else` 分支提供空桩定义，使类型在所有配置下均为完整类型
3. 大规模模块重构后，务必同时测试 Windows/MSVC 和 Linux/Clang 构建 —— Clang 会捕获许多 MSVC 默默接受的未定义行为
