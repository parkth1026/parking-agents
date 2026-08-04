# Undefined Symbol: TAesMarkerCache template method linker error after include refactoring

> **Score**: 9/10 | **Job**: linux | **Date**: 2026-01-14
> **Builds**: #360 (FAILURE) → #361 (SUCCESS)
> **Scoring**: Info 2/3 + Diff 2/2 + Commit 3/3 + Reuse 2/2 = 9/10

## Error Message
```
ld.lld: error: undefined symbol: TAesMarkerCache<FAesMarkerInfo>::FMarker::GetUpToDateCompletionEvent() const
clang++: error: linker command failed with exit code 1 (use -v to see invocation)
```
(Repeated across 10 translation units in the Linux Shipping build)

## Root Cause
Build #360 used AesWorld commit `c33e59dc2` which fixed three compilation warnings (dangling-else, logical-op-parentheses, nonportable-include-path) but also removed several `#include` directives from `AesTerraformingVectorDataLayer.cpp` during cleanup. One of the removed includes was transitively providing the template definition for `TAesMarkerCache<FAesMarkerInfo>::FMarker::GetUpToDateCompletionEvent()`.

Without the template method definition visible to the compiler in every translation unit that instantiates it, the linker could not find the symbol. This is a classic C++ template issue: template definitions must be available at every point of instantiation.

## Fix
- **Commit**: `0525adf78b6985287611f8d1486dff18e33c8ddd` by luwei
- **Message**: "修复管线linux编译不过的问题" (Fix pipeline Linux compilation issues)
- **What changed**:

**AesTerraformingVectorDataLayer.cpp** — Removed unused includes and added the required template header:
```diff
 #include "AesTerraformingVectorDataLayer.h"
-#include "AesVectorLayerOperation.h"
-#include "AesVectorLayerTransaction.h"
-#include "Algo/MaxElement.h"
 #include "DataLayer/Vector/AesVectorDataRegion.h"
 #include "Marker/AesVectorMarker.h"
 #include "Core/AesMarkerDependent.h"
 #include "DataLayer/Changeset/AesVectorLayerChangeset.h"
 #include "Async/TaskGraphInterfaces.h"
 #include <atomic>
+#include "Core/AesMarker.hpp"
```

The `.hpp` file contains the template method definitions that must be visible wherever the template is instantiated.

## How to Reproduce / Detect
- Remove `#include` directives that transitively provide template definitions
- Build for Linux target — linker errors for template methods will appear as "undefined symbol"
- On Windows, incremental builds may mask this if the object files from a previous build still contain the symbol

## Epic Official Guidance
- **Query**: "UE5.5 Linux linker error: 'ld.lld: error: undefined symbol: TAesMarkerCache<FAesMarkerInfo>::FMarker::GetUpToDateCompletionEvent() const'. Template method not included after refactoring."
- **Answer**: Epic explains this is a classic C++ template issue. Template method definitions must be visible in every translation unit that instantiates them. In UE5, `.hpp` files conventionally hold inline/template definitions. UE5's IWYU (Include What You Use) policy requires each file to include all headers it directly uses. When refactoring includes, verify that template definitions remain accessible. Never put template definitions in `.cpp` files.
- **References**:
  - [Include What You Use (IWYU)](https://dev.epicgames.com/documentation/unreal-engine/include-what-you-use-iwyu-for-unreal-engine-programming)

## Prevention
- When removing `#include` directives during cleanup, verify that all template instantiations still have access to template definitions
- Follow UE5's IWYU policy: each `.cpp` file must directly include all headers whose types/templates it uses
- Use `.hpp` extension for template definition headers to clearly distinguish them from declaration-only `.h` files