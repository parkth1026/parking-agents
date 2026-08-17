# C2027/C3861/C2061: Multiple Missing Includes — EPackageReloadPhase, AsyncTask, UStaticMesh

> **Score**: 10/10 | **Job**: twe-ue5.5-installed | **Date**: 2026-04-09
> **Builds**: #428–#437 (FAILURE) → #438 (SUCCESS)
> **Scoring**: Info 3/3 + Diff 2/2 + Commit 3/3 + Reuse 2/2 = 10/10

## Error Message
```
EarthAssetManager.cpp(221): error C2027: use of undefined type 'EPackageReloadPhase'
EarthAssetManager.cpp(221): error C2065: 'PostPackageFixup': undeclared identifier
EarthAssetManager.cpp(225): error C2027: use of undefined type 'FPackageReloadedEvent'
AesMarkerTexture.cpp(110): error C3861: 'AsyncTask': identifier not found
EarthDynamicMeshFragment.h(47): error C2061: syntax error: identifier 'UStaticMesh'
```

## Root Cause
Over the builds #428–#437, three separate missing-include/forward-declaration issues accumulated in AesWorld:

1. **`EarthAssetManager.cpp`**: Used `EPackageReloadPhase` and `FPackageReloadedEvent` (from `FCoreUObjectDelegates::OnPackageReloaded`) without `#include "UObject/PackageReload.h"`. The header `UObject/Package.h` was also missing.
2. **`AesMarkerTexture.cpp`**: Called `AsyncTask()` without `#include "Async/Async.h"`.
3. **`EarthDynamicMeshFragment.h`**: Used `UStaticMesh` in a function parameter without a forward declaration.

All three are IWYU violations surfaced by the installed (non-monolithic) build configuration. In monolithic/editor builds, transitive includes from large engine headers masked these missing dependencies.

## Fix
- **Commit**: `e200e59` by luwei (luwei01@51aes.com)
- **Message**: "修复jenkes管线编译报错的问题" (Fix Jenkins pipeline compilation error)
- **What changed**: Added missing includes and forward declaration across 4 files:

```diff
// EarthAssetManager.cpp
 #include "Async/Async.h"
 #include "EarthLogHelper.h"
 #include "Engine/Engine.h"
+#include "UObject/Package.h"
+#include "UObject/PackageReload.h"

// AesMarkerTexture.cpp
 #include "Core/AesMarkerTexture.h"
+#include "Async/Async.h"

// AesMarkerBase.cpp (bonus fix — wrong include)
-#include "Core/AesMarker.hpp"
+#include "Core/AesMarkerCache.hpp"

// EarthDynamicMeshFragment.h
 class UDynamicMeshComponent;
+class UStaticMesh;
```

## How to Reproduce / Detect
- Use `EPackageReloadPhase`, `FPackageReloadedEvent` from UObject reload system without including `UObject/PackageReload.h`
- Call `AsyncTask()` without `#include "Async/Async.h"`
- Use `UStaticMesh` in a header without a forward declaration or include
- These compile fine in editor/monolithic builds but fail in installed (non-monolithic) builds

## Epic Official Guidance
- **Query**: "UE5.5 C++ error C2027: use of undefined type 'EPackageReloadPhase' and 'FPackageReloadedEvent' in EarthAssetManager.cpp. Code uses OnPackageReloaded delegate but missing #include UObject/PackageReload.h."
- **Answer**: `FPackageReloadedEvent` is a struct used by the package reload delegate system, and `EPackageReloadPhase` is an enum representing the phase of package reload. Both are defined in `UObject/PackageReload.h`. They are used when handling `FCoreUObjectDelegates::OnPackageReloaded` for patching references when assets are reloaded. The fix is to add `#include "UObject/PackageReload.h"` and `#include "UObject/Package.h"` to files that use these types.
- **References**:
  - [Declaring Delegates For Blueprint](https://dev.epicgames.com/community/learning/courses/KJ/unreal-engine-converting-blueprint-to-c/pqG/unreal-engine-declaring-delegates-for-blueprint)
  - [Unreal Object Handling](https://dev.epicgames.com/documentation/unreal-engine/unreal-object-handling-in-unreal-engine)

## Prevention
- When using `FCoreUObjectDelegates::OnPackageReloaded`, always include `UObject/PackageReload.h` — the delegate's callback types are defined there, not in `CoreUObjectDelegates.h`
- `AsyncTask()` requires `Async/Async.h` — do not rely on transitive includes from other engine headers
- Always add forward declarations for UE types used in header files (`class UStaticMesh;`) to avoid depending on transitive includes
