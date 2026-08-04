# linux-ci #466 构建诊断报告

> **Job**: twe-ue5.5-linux-ci | **Build**: #466 | **结果**: FAILURE
> **时间**: 2026-04-08 (构建耗时: 约23分钟)
> **Jenkins**: http://10.66.12.40/job/wdp-ue/job/Earth/job/twe-ue5.5-linux-ci/466/
> **日志文件**: `tmp/ue-error-solver/linux-466-20260414-003140.log` (132KB)

---

## 错误摘要

| 项目 | 内容 |
|------|------|
| 错误数量 | 1 个编译错误 + 2 个 deprecation 警告 |
| 主要错误 | `-Werror,-Wdelete-incomplete` — 删除不完整类型指针 |
| 错误文件 | `UniquePtr.h(66,3)` (引擎头文件，触发点在项目代码) |
| 根因文件 | `AesLodSystemLayeredQuadRequest.h` / `AesWorldProfilingTrace.h` |
| 错误分类 | Clang C++ 编译错误（跨平台差异类） |

---

## 诊断：-Wdelete-incomplete in UniquePtr.h

**主要错误**：
```
D:\Epic\UE_5.5_51\Engine\Source\Runtime\Core\Public\Templates\UniquePtr.h(66,3): error: deleting pointer to incomplete type 'FAesTracePayloadScope' may cause undefined behavior [-Werror,-Wdelete-incomplete]
   66 |                 delete Ptr;
      |                 ^      ~~~
```

**完整错误块**（包含实例化链）：
```
In file included from CoreUObjectSharedPCH.h:5:
In file included from CoreSharedPCH.h:7:
In file included from AsyncWork.h:11:
In file included from Compression.h:5:
In file included from Map.h:9:
In file included from Set.h:18:
In file included from SparseArray.h:16:
In file included from StructuredArchive.h:11:
In file included from StructuredArchiveAdapters.h:10:
In file included from UniqueObj.h:6:

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
Error executing clang++.exe (tool returned code: 1)
```

**根因**：`AesLodSystemLayeredQuadRequest.h` 使用 `TUniquePtr<FAesTracePayloadScope>` 但只有 `FAesTracePayloadScope` 的前向声明。该结构体 `FAesTracePayloadScope` 是有条件定义的——仅在 `WITH_EARTH_DEBUGGER` 宏启用时才有完整定义。在非 debug 构建（Shipping/Linux CI）中，该结构体只有前向声明而没有完整定义。当 `TUniquePtr<FAesTracePayloadScope>::~TUniquePtr` 被实例化时，它需要调用 `delete` 来释放指向不完整类型的指针，这是未定义行为。Clang 的 `-Wdelete-incomplete`（通过 `-Werror` 提升为错误）在 Linux 构建中捕获了这个问题；MSVC 在 Windows 构建中不会报告此错误。

**触发原因**：提交 `8894ec3`（拆分 AesWorldInsights 为 AesWorldProfiling(Runtime) 和 AesWorldInsights(Program)）引入了新的模块拆分，`FAesTracePayloadScope` 的条件编译定义在重构过程中没有为非 debug 路径提供完整类型定义。

**置信度**：高（知识库已有经过验证的修复记录，score 10/10）

---

### 证据

- **知识库**：在 `rawDir` 中找到精确匹配 — `linux-466-Wdelete-incomplete-FAesTracePayloadScope.md`，Score 10/10，包含经过验证的修复（builds #466→#469 FAILURE→SUCCESS）
- **Epic 指导**：已跳过 — 知识库匹配 score 10/10，有验证过的修复，无需额外查询
- **源码上下文**：当前 `D:/Git/AesWorld/Source/AesLodSystem/Private/AesLodSystemLayeredQuadRequest.h` 已不含 `FAesTracePayloadScope` 的前向声明，确认修复已合入 dev 分支
- **Web 搜索**：已跳过 — 早期来源提供了充分证据
- **wikiDir 模式匹配**：`error-patterns.md` 中的"跨平台编译差异"模式与此错误一致（Clang 比 MSVC 更严格的类型检查）

---

### 已验证的修复

**修复提交**: `c6e1eab5` (by xiongxing)
**提交信息**: "为非debug构建提供Trace struct空桩定义，修复clang -Wdelete-incomplete错误"

**修复内容**：在 `AesWorldProfilingTrace.h` 的 `#else`（非 debug）分支中添加空桩结构体定义：

```cpp
// In AesWorldProfilingTrace.h, #else (non-debug) branch:

// Complete-type stubs so TUniquePtr<T> compiles without -Wdelete-incomplete
struct FAesTraceScope {};
struct FAesTracePayloadScope {};
struct FAesTraceProducerScope {};
```

同时在 `#if WITH_EARTH_DEBUGGER` 分支的 `AesWorldProfilingTrace.cpp` 中添加了缺失的 `#include "AesProducerGraphStore.h"`。

**修复验证**：Build #469 构建成功，确认修复有效。

---

### 附加警告（非阻断）

构建日志中还包含 2 个 deprecation 警告（未导致构建失败，但建议后续处理）：

1. **`Sort` 已废弃** — `EarthZoneGraphBVTree.cpp(77)`: `::Sort()` 已被标记为 deprecated，建议迁移到 `Algo::Sort`
2. **`BezierUtilities.h` 路径变更** — UE5.5 中 `BezierUtilities.h` 已移动到 `Curves/BezierUtilities.h`

---

### 建议修复步骤

此错误**已经被修复**（commit `c6e1eab5`，build #469 验证通过）。如果你的本地代码尚未包含此修复：

1. 拉取最新代码：`git pull` 获取包含 `c6e1eab5` 的更新
2. 确认 `AesWorldProfilingTrace.h` 的 `#else` 分支包含空桩定义
3. 重新构建 Linux 目标验证

### 预防措施

1. 使用 `TUniquePtr<T>` 时，确保 `T` 在析构函数被实例化的位置有完整定义——要么 include 完整定义，要么将析构函数移到 `.cpp` 文件中
2. 对于条件编译的结构体（如仅 debug 模式），始终在 `#else` 分支提供空桩定义，确保类型在所有配置下都是完整的
3. 同时测试 Linux/Clang 和 Windows/MSVC 构建——Clang 能捕获很多 MSVC 默认忽略的未定义行为

---

### 参考资料

- **知识库文件**: `wiki-raw/jenkins-learnings/details/linux-466-Wdelete-incomplete-FAesTracePayloadScope.md`
- **错误模式**: `~/memory/jenkins-learnings/patterns/error-patterns.md` — "跨平台编译差异"
- **Epic 文档**: [Unreal Smart Pointer Library](https://dev.epicgames.com/documentation/unreal-engine/smart-pointers-in-unreal-engine)
- **Jenkins 构建**: http://10.66.12.40/job/wdp-ue/job/Earth/job/twe-ue5.5-linux-ci/466/console
