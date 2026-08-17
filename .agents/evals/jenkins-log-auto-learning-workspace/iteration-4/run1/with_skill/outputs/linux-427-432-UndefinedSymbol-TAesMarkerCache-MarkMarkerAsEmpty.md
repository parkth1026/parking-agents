# Undefined Symbol: TAesMarkerCache::MarkMarkerAsEmpty — Wrong Header Included

> **Score**: 10/10 | **Job**: linux | **Date**: 2026-04-09
> **Builds**: #427, #428, #429, #430, #431, #432 (FAILURE) → #433 (SUCCESS)
> **Scoring**: Info 3/3 + Diff 2/2 + Commit 3/3 + Reuse 2/2 = 10/10

## Error Message
```
ld.lld: error: undefined symbol: TAesMarkerCache<FAesMarkerInfo>::MarkMarkerAsEmpty(FName, FAesMarkerInfo const&)
clang++: error: linker command failed with exit code 1 (use -v to see invocation)
Failed to link D:\ws_twe_ue5.5_linux_ci\Project\Binaries\Linux\TWE-Linux-Shipping after 10 retries
Took 160.71s to run dotnet.exe, ExitCode=6
```
(Symbol error repeated across 10 translation units in the Linux Shipping link step)

## Root Cause
`AesMarkerBase.cpp` was including `Core/AesMarker.hpp` instead of `Core/AesMarkerCache.hpp`. The `MarkMarkerAsEmpty` method is a member of `TAesMarkerCache<T>`, which is defined in `AesMarkerCache.hpp`. By including the wrong header, the template class definition was not visible in that translation unit, so the linker could not find the instantiation of `MarkMarkerAsEmpty`.

This error is Linux-specific because `ld.lld` (LLVM linker on Linux) strictly enforces that template method definitions must be visible in every translation unit that instantiates them. MSVC on Windows is more permissive and may silently link with a symbol that happens to be present in another object file, masking the error.

## Fix
- **Commit**: `e200e59ef4ff6f60ecb9d2dc71afc973135e1f31` by luwei (AesWorld)
- **Message**: "修复jenkes管线编译报错的问题" (Fix Jenkins pipeline compilation error)
- **What changed** (4 files):

**Source/AesMarkerSystem/Private/Marker/AesMarkerBase.cpp** — Correct wrong header include:
```diff
-#include "Core/AesMarker.hpp"
+#include "Core/AesMarkerCache.hpp"
 #include "AesMarker.h"
```

**Source/AesMarkerSystem/Private/Core/AesMarkerTexture.cpp** — Add missing async header:
```diff
+#include "Async/Async.h"
 #include "EarthLLMTag.h"
```

**Source/EarthAssetManager/Private/EarthAssetManager.cpp** — Add missing UObject package headers:
```diff
+#include "UObject/Package.h"
+#include "UObject/PackageReload.h"
```

**Source/EarthPrefab/Public/Output/EarthDynamicMeshFragment.h** — Add forward declaration:
```diff
+class UStaticMesh;
```

The primary fix is the first change: `AesMarkerBase.cpp` must include `AesMarkerCache.hpp` (which defines the `TAesMarkerCache` template and all its methods) rather than `AesMarker.hpp` (which only provides declarations).

## How to Reproduce / Detect
- Include `Core/AesMarker.hpp` instead of `Core/AesMarkerCache.hpp` in any `.cpp` file that calls `TAesMarkerCache<T>::MarkMarkerAsEmpty`
- Build for Linux (cross-compile) — the linker will report the undefined symbol
- Windows build may succeed due to MSVC's more permissive symbol resolution

## Epic Official Guidance
- **Query**: "UE5.5 Linux linker error: undefined symbol TAesMarkerCache<FAesMarkerInfo>::MarkMarkerAsEmpty. Root cause: AesMarkerBase.cpp was including Core/AesMarker.hpp instead of Core/AesMarkerCache.hpp, so the template class definition was missing."
- **Answer**: Epic confirms this is a classic C++ template instantiation issue. Templates must have their full implementation visible in every translation unit that uses them. Linux (Clang's ld.lld) requires this strictly; MSVC is more permissive and may hide the error on Windows. The fix is straightforward: include the header that provides the full template definition (`AesMarkerCache.hpp`), not just the declaration header (`AesMarker.hpp`). UE5's IWYU (Include What You Use) policy requires each file to include exactly the headers it directly uses.
- **References**:
  - [Epic Coding Standard](https://dev.epicgames.com/documentation/unreal-engine/epic-cplusplus-coding-standard-for-unreal-engine)
  - [Include What You Use (IWYU) for Unreal Engine Programming](https://dev.epicgames.com/documentation/unreal-engine/include-what-you-use-iwyu-for-unreal-engine-programming)

## Prevention
- When a template class is split across two headers (e.g., `AesMarker.hpp` for declarations and `AesMarkerCache.hpp` for the full template), always include the *definition* header in files that instantiate template methods
- Follow UE5 IWYU: each `.cpp` must include headers for every type it directly uses — do not rely on transitive includes
- Test Linux builds early and often when adding new method calls to template classes; MSVC may pass while ld.lld fails
